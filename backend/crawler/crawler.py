#!/usr/bin/env python3
"""Crawler."""
from __future__ import annotations
import argparse
import json
import logging
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser
import requests
from bs4 import BeautifulSoup

LOG = logging.getLogger("novateck.crawler")
DEFAULT_CONFIG = Path(__file__).with_name("crawl_config.json")

@dataclass(frozen=True)
class CrawlSettings:
    seeds: tuple[str, ...]
    max_depth: int = 3
    rate_limit_seconds: float = 4.0
    timeout_seconds: int = 30
    max_retries: int = 3
    robots_ttl_seconds: int = 3600
    user_agent: str = "NovaTeck-DFW-Job-Tracker/1.0 (educational project)"

def normalize_url(url: str) -> str:
    """Return a stable URL key with no fragment and ordered query string."""
    parts = urlsplit(url.strip())
    if parts.scheme.lower() not in {"http", "https"} or not parts.netloc:
        raise ValueError(f"Invalid HTTP(S) URL: {url!r}")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/") or "/", urlencode(sorted(parse_qsl(parts.query, keep_blank_values=True))), ""))

def load_settings(path: Path = DEFAULT_CONFIG) -> CrawlSettings:
    """Load and validate the JSON seed configuration before crawling."""
    data = json.loads(path.read_text(encoding="utf-8"))
    seeds = tuple(normalize_url(url) for url in data.get("seed_urls", []))
    if not 5 <= len(seeds) <= 10 or len(set(seeds)) != len(seeds):
        raise ValueError("configuration must contain 5-10 unique seed_urls")
    return CrawlSettings(seeds=seeds, max_depth=int(data.get("max_depth", 3)),
        rate_limit_seconds=float(data.get("rate_limit_seconds", 4)), timeout_seconds=int(data.get("timeout_seconds", 30)),
        max_retries=int(data.get("max_retries", 3)), robots_ttl_seconds=int(data.get("robots_ttl_seconds", 3600)))

class EthicalCrawler:
    """Breadth-first same-host crawler with strict robots and rate controls."""
    def __init__(self, settings: CrawlSettings, session: requests.Session | None = None):
        self.settings, self.session = settings, session or requests.Session()
        self.session.headers.update({"User-Agent": settings.user_agent})
        self.seen, self.last_request_at, self.robots = set(), {}, {}

    def _request(self, url: str) -> requests.Response | None:
        host = urlsplit(url).netloc
        for attempt in range(self.settings.max_retries):
            elapsed = time.monotonic() - self.last_request_at.get(host, 0)
            if elapsed < self.settings.rate_limit_seconds:
                time.sleep(self.settings.rate_limit_seconds - elapsed)
            try:
                response = self.session.get(url, timeout=self.settings.timeout_seconds, allow_redirects=False)
                if 300 <= response.status_code < 400:
                    LOG.warning("Skipping redirect until destination is configured and its robots policy checked: %s", url)
                    return None
                self.last_request_at[host] = time.monotonic()
                response.raise_for_status()
                return response
            except requests.RequestException as exc:
                LOG.warning("Request %s/%s failed for %s: %s", attempt + 1, self.settings.max_retries, url, exc)
                if attempt + 1 < self.settings.max_retries: time.sleep(2 ** attempt)
        return None

    def _robots_allows(self, url: str) -> bool:
        parts = urlsplit(url); base = f"{parts.scheme}://{parts.netloc}"; cached = self.robots.get(base)
        if not cached or time.monotonic() >= cached[1]:
            response = self._request(f"{base}/robots.txt")
            if response is None:
                LOG.error("Robots policy unavailable; skipping %s", url); return False
            parser = RobotFileParser(); parser.set_url(f"{base}/robots.txt"); parser.parse(response.text.splitlines())
            self.robots[base] = (parser, time.monotonic() + self.settings.robots_ttl_seconds)
        allowed = self.robots[base][0].can_fetch(self.settings.user_agent, url)
        if not allowed: LOG.info("robots.txt disallows %s", url)
        return allowed

    def validate_seeds(self) -> list[str]:
        return [seed for seed in self.settings.seeds if self._robots_allows(seed) and self._request(seed) is not None]

    def crawl(self) -> list[dict[str, Any]]:
        queue = deque((seed, 0) for seed in self.validate_seeds()); results = []
        allowed_hosts = {urlsplit(seed).netloc for seed in self.settings.seeds}
        while queue:
            url, depth = queue.popleft()
            if url in self.seen: continue
            self.seen.add(url)
            if depth > self.settings.max_depth:
                LOG.info("Depth limit reached: %s", url); continue
            if not self._robots_allows(url): continue
            response = self._request(url)
            if response is None: continue
            results.append({"url": url, "depth": depth, "status": response.status_code, "fetched_at": time.time()})
            if depth == self.settings.max_depth or "text/html" not in response.headers.get("Content-Type", ""): continue
            for link in BeautifulSoup(response.text, "html.parser").select("a[href]"):
                try: child = normalize_url(urljoin(url, link["href"]))
                except ValueError: continue
                if urlsplit(child).netloc in allowed_hosts and child not in self.seen: queue.append((child, depth + 1))
        return results

def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl approved public career pages ethically.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("crawl_results.json"))
    args = parser.parse_args(); logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    results = EthicalCrawler(load_settings(args.config)).crawl()
    args.output.write_text(json.dumps(results, indent=2), encoding="utf-8")

if __name__ == "__main__": main()
