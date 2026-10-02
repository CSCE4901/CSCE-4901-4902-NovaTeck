#!/usr/bin/env python3
"""Job sync."""

from __future__ import annotations

import argparse
import html
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

from urllib.robotparser import RobotFileParser

import requests
from dotenv import load_dotenv

import db
from nlp_tagger import tag_skills_for_job

load_dotenv(Path(__file__).with_name(".env"))
LOG = logging.getLogger("novateck.job_sync")
API_URL = "https://api.adzuna.com/v1/api/jobs/us/search/{page}"
SOURCES_FILE = Path(__file__).with_name("crawler") / "company_sources.json"
DFW_PLACES = ("dallas", "fort worth", "arlington", "plano", "irving", "frisco", "richardson", "addison", "carrollton", "mckinney", "allen", "garland", "grapevine", "southlake", "dfw", "denton", "lewisville", "coppell", "flower mound", "the colony", "euless", "bedford", "hurst", "keller", "mansfield", "burleson", "wylie", "prosper", "colleyville", "westlake", "roanoke")

# Only include technology jobs.
TECH_TITLE_TERMS = re.compile(
    r"\b(?:software|developer|development|engineer|engineering|data|analytics?|"
    r"scientist|machine learning|artificial intelligence|ai\b|cloud|devops|"
    r"site reliability|sre\b|cyber|security|information technology|\bit\b|"
    r"systems?|network|infrastructure|database|qa\b|quality assurance|"
    r"technical|ux\b|ui\b|product (?:manager|designer)|solutions architect|"
    r"architect|programmer|automation|robotics|firmware|embedded)\b",
    re.IGNORECASE,
)
NON_TECH_TITLE_TERMS = re.compile(
    r"\b(?:production|inventory|warehouse|manufactur(?:ing|er)|facilities|"
    r"recruit(?:er|ing)|sourcer|talent acquisition|human resources|\bhr\b|"
    r"accounting|payroll|legal|sales|marketing|communications?|"
    r"administrative|executive assistant|office manager|custodian|driver|"
    r"food|chef|barista|retail)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SyncSettings:
    app_id: str = ""
    app_key: str = ""
    location: str = "Dallas, TX"
    query: str = "technology"
    pages: int = 5
    results_per_page: int = 50

    @classmethod
    def from_environment(cls, require_adzuna: bool = False) -> "SyncSettings":
        def positive_int(name: str, default: int, maximum: int) -> int:
            try:
                value = int(os.environ.get(name, default))
            except ValueError as exc:
                raise ValueError(f"{name} must be an integer") from exc
            return max(1, min(value, maximum))

        app_id = os.environ.get("ADZUNA_APP_ID", "").strip()
        app_key = os.environ.get("ADZUNA_APP_KEY", "").strip()
        if require_adzuna and (not app_id or not app_key):
            raise ValueError("ADZUNA_APP_ID and ADZUNA_APP_KEY must be set")
        return cls(app_id, app_key, os.environ.get("JOB_SYNC_LOCATION", "Dallas, TX").strip(),
                   os.environ.get("JOB_SYNC_QUERY", "technology").strip(),
                   positive_int("JOB_SYNC_PAGES", 5, 20),
                   positive_int("JOB_SYNC_RESULTS_PER_PAGE", 50, 50))


def clean_text(value: Any) -> str:
    text = html.unescape(str(value or ""))
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip()


def parse_posted_date(value: Any) -> str | None:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000).date().isoformat()
    text = str(value or "").strip()
    try:
        return date.fromisoformat(text[:10]).isoformat() if text else None
    except ValueError:
        return None


def closing_date(item: dict[str, Any]) -> str | None:
    """Only use explicit source deadlines; never infer expiry from posting age."""
    for key in ("validThrough", "closingDate", "closing_date", "applicationDeadline", "application_deadline"):
        value = parse_posted_date(item.get(key))
        if value:
            return value
    return None


def format_salary(item: dict[str, Any]) -> str | None:
    low, high = item.get("salary_min"), item.get("salary_max")
    if low is None and high is None:
        return None
    try:
        return f"${float(low):,.0f} - ${float(high):,.0f}" if low is not None and high is not None else f"${float(low if low is not None else high):,.0f}"
    except (TypeError, ValueError):
        return None


def is_dfw(location: str) -> bool:
    return any(re.search(r"(?<![a-z])" + re.escape(place) + r"(?![a-z])", location.lower()) for place in DFW_PLACES)


def is_tech_job(title: str) -> bool:
    """Is tech job."""
    policy_title = re.sub(r"\b(?:manufacturing|production)\b", "", title, flags=re.IGNORECASE) if re.search(r"\b(?:engineer|engineering)\b", title, re.IGNORECASE) else title
    return bool(TECH_TITLE_TERMS.search(title)) and not bool(NON_TECH_TITLE_TERMS.search(policy_title))


def lever_description(item: dict[str, Any]) -> str:
    """Lever description."""
    parts = [clean_text(item.get("descriptionPlain") or item.get("description"))]
    for section in item.get("lists") or []:
        heading = clean_text(section.get("text"))
        content = clean_text(section.get("content"))
        if heading or content:
            parts.append(f"{heading}: {content}".strip())
    return "\n".join(part for part in parts if part)


def normalize_listing(item: dict[str, Any]) -> dict[str, Any] | None:
    """Map an Adzuna response to NovaTeck's stable internal job shape."""
    source_url = str(item.get("redirect_url") or "").strip()
    title = clean_text(item.get("title"))
    company = clean_text((item.get("company") or {}).get("display_name"))
    if not source_url or not title or not company:
        return None
    location = clean_text((item.get("location") or {}).get("display_name"))
    return {"company_name": company[:255], "title": title[:255], "description": clean_text(item.get("description")),
            "location": location[:255] or None, "job_type": clean_text(item.get("contract_type")).replace("_", " ").title() or None,
            "salary_range": format_salary(item), "source_url": source_url[:1000], "date_posted": parse_posted_date(item.get("created")), "closing_date": closing_date(item)}


@dataclass(frozen=True)
class CompanySource:
    name: str
    provider: str
    board: str
    careers_url: str
    source_type: str
    website_url: str | None = None

    @property
    def key(self) -> str:
        return f"{self.source_type}:{self.board}"


def load_company_sources(path: Path = SOURCES_FILE) -> list[CompanySource]:
    with path.open(encoding="utf-8") as handle:
        records = json.load(handle)
    return [CompanySource(**record) for record in records]


class PublicCompanyFeeds:
    """Publiccompanyfeeds."""
    def __init__(self, sources: list[CompanySource], session: requests.Session | None = None):
        self.sources = sources
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": "NovaTeck-DFW-Job-Tracker/1.0 (educational project)"})
        self.last_request_at: dict[str, float] = {}
        self.rate_limit_seconds = 1.0
        self.robots = {}

    def _get_json(self, url: str) -> Any:
        host = urlparse(url).netloc
        if host not in self.robots:
            robots_url = f"{urlparse(url).scheme}://{host}/robots.txt"
            response = self.session.get(robots_url, timeout=30, allow_redirects=False)
            parser = RobotFileParser(robots_url)
            if response.status_code == 404:
                parser.parse([])
            elif response.status_code == 200:
                parser.parse(response.text.splitlines())
            else:
                raise requests.RequestException(f"Cannot verify robots.txt for {host}")
            self.robots[host] = parser
            self.last_request_at[host] = time.monotonic()
        policy = self.robots[host]
        agent = self.session.headers['User-Agent']
        if not policy.can_fetch(agent, url):
            raise requests.RequestException(f"robots.txt disallows collection from {host}")
        delay = max(self.rate_limit_seconds, policy.crawl_delay(agent) or 0)
        elapsed = time.monotonic() - self.last_request_at.get(host, 0)
        if elapsed < delay:
            time.sleep(delay - elapsed)
        response = self.session.get(url, timeout=30, allow_redirects=False)
        if 300 <= response.status_code < 400:
            raise requests.RequestException("Feed redirect requires a reviewed source configuration")
        self.last_request_at[host] = time.monotonic()
        response.raise_for_status()
        self.source_http_status = response.status_code
        return response.json()

    def listings_for(self, source: CompanySource) -> Iterable[dict[str, Any]]:
        if source.source_type == "lever":
            for item in self._get_json(f"https://api.lever.co/v0/postings/{source.board}?mode=json"):
                location = clean_text((item.get("categories") or {}).get("location"))
                title = clean_text(item.get("text"))
                if not is_dfw(location) or not is_tech_job(title):
                    continue
                yield {"company_name": source.name, "title": title[:255],
                       "description": lever_description(item),
                       "location": location[:255], "job_type": clean_text((item.get("categories") or {}).get("commitment")) or None,
                       "salary_range": None, "source_url": str(item.get("hostedUrl") or "")[:1000],
                       "date_posted": parse_posted_date(item.get("createdAt")), "closing_date": closing_date(item), "_provider": source.key, "source_http_status": getattr(self, "source_http_status", None)}
        elif source.source_type == "greenhouse":
            payload = self._get_json(f"https://boards-api.greenhouse.io/v1/boards/{source.board}/jobs?content=true")
            for item in payload.get("jobs", []):
                locations = clean_text((item.get("location") or {}).get("name"))
                # Office metadata can describe a different headquarters; prefer the job location.
                if not locations:
                    locations = ", ".join(clean_text(o.get("location")) for o in item.get("offices", []) if o.get("location"))
                title = clean_text(item.get("title"))
                if not is_dfw(locations) or not is_tech_job(title):
                    continue
                yield {"company_name": source.name, "title": title[:255],
                       "description": clean_text(item.get("content")), "location": locations[:255], "job_type": None,
                       "salary_range": None, "source_url": str(item.get("absolute_url") or "")[:1000],
                       "date_posted": parse_posted_date(item.get("first_published")), "closing_date": closing_date(item), "_provider": source.key, "source_http_status": getattr(self, "source_http_status", None)}
        else:
            raise ValueError(f"Unsupported company source type: {source.source_type}")


class AdzunaProvider:
    """Optional broad discovery; result pages are not complete closure feeds."""
    key = "adzuna"
    authoritative = False

    def __init__(self, settings: SyncSettings, session: requests.Session | None = None):
        self.settings = settings
        self.session = session or requests.Session()

    def listings(self) -> Iterable[dict[str, Any]]:
        for page in range(1, self.settings.pages + 1):
            response = self.session.get(API_URL.format(page=page), params={"app_id": self.settings.app_id, "app_key": self.settings.app_key,
                "where": self.settings.location, "what": self.settings.query, "results_per_page": self.settings.results_per_page, "content-type": "application/json"}, timeout=30)
            response.raise_for_status()
            results = response.json().get("results", [])
            if not results:
                return
            for item in results:
                job = normalize_listing(item)
                if job:
                    job["_provider"] = self.key
                    job["source_http_status"] = response.status_code
                    yield job
            if len(results) < self.settings.results_per_page:
                return


def ingest_job(job: dict[str, Any], stats: dict[str, int], dry_run: bool) -> None:
    stats["fetched"] += 1
    if dry_run:
        return
    provider = job.pop("_provider")
    company_id = db.insert_company(job.pop("company_name"), location=job.get("location"))
    if not company_id:
        stats["errors"] += 1
        return
    job_id, changed = db.upsert_job(company_id, provider=provider, **job)
    if not job_id:
        stats["errors"] += 1
        return
    stats["upserted"] += 1
    if changed:
        db.insert_snapshot(job_id, job["title"], job["salary_range"], True)
        db.clear_job_skills(job_id)
        for skill in tag_skills_for_job(job["description"]):
            skill_id = db.insert_skill(skill["skill_name"])
            if skill_id and db.link_job_skill(job_id, skill_id, skill["requirement_type"]):
                stats["tagged"] += 1


def sync_jobs(settings: SyncSettings, dry_run: bool = False) -> dict[str, int]:
    """Sync configured company boards plus optional broad discovery."""
    stats = {"fetched": 0, "upserted": 0, "retired": 0, "tagged": 0, "errors": 0}
    run_id = None if dry_run else db.start_sync_run("public_company_feeds", settings.location, settings.query)
    try:
        feeds = PublicCompanyFeeds(load_company_sources())
        # Show companies even when they have no matching jobs.
        for source in feeds.sources:
            db.insert_company(source.name, website_url=source.website_url or source.careers_url,
                              location="Dallas-Fort Worth, TX", industry="Technology")
        for source in feeds.sources:
            if source.website_url:
                with db.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("UPDATE Companies SET website_url=%s WHERE name=%s", (source.website_url, source.name))
                    conn.commit()
            started_at = datetime.now()
            source_completed = False
            try:
                for job in feeds.listings_for(source):
                    ingest_job(job, stats, dry_run)
                source_completed = True
            except requests.RequestException as exc:
                stats["errors"] += 1
                LOG.error("Source %s failed; existing jobs were left active: %s", source.name, exc)
            if not dry_run:
                # Hide older jobs that are outside the tech filter.
                non_tech_ids = [job["job_id"] for job in db.get_active_source_jobs(source.key)
                                if not is_tech_job(job["title"])]
                stats["retired"] += db.deactivate_jobs(non_tech_ids)
                if source_completed:
                    stats["retired"] += db.deactivate_stale_source_jobs(source.key, started_at)
        if settings.app_id and settings.app_key:
            try:
                for job in AdzunaProvider(settings).listings():
                    ingest_job(job, stats, dry_run)
            except requests.RequestException as exc:
                stats["errors"] += 1
                LOG.error("Optional Adzuna discovery failed: %s", exc)
        # Hide sample jobs after a successful live sync.
        if not dry_run and stats["upserted"]:
            stats["retired"] += db.retire_legacy_seed_jobs()
        if not dry_run:
            db.generate_skill_trend_snapshot()
        if run_id:
            db.finish_sync_run(run_id, "completed" if not stats["errors"] else "partial", stats)
        return stats
    except Exception as exc:
        stats["errors"] += 1
        if run_id:
            db.finish_sync_run(run_id, "failed", stats, str(exc))
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Synchronize live DFW job postings into NovaTeck.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and validate without changing MySQL.")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    stats = sync_jobs(SyncSettings.from_environment(), args.dry_run)
    print("Job sync complete: " + ", ".join(f"{name}={value}" for name, value in stats.items()))


if __name__ == "__main__":
    main()
