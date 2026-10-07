"""Backfill original description HTML from reviewed public hiring-board APIs.

No new jobs or application records are changed. Unsupported, missing, and failed
postings retain their existing plain-text description. API requests use the same
robots policy, redirect restrictions, and per-host delay as regular sync.
"""
import argparse
import json
import logging
from pathlib import Path
import db
from job_html import clean_html, group_by_headings, lever_html
from job_metadata import canonical_job_url
from job_sync import PublicCompanyFeeds, load_company_sources

LOG = logging.getLogger('novateck.backfill')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Save sanitized descriptions; otherwise report only.')
    parser.add_argument('--fixtures-dir', type=Path, help='Save one actual employer HTML fragment per hiring platform for regression tests.')
    args = parser.parse_args()
    sources = {source.key: source for source in load_company_sources()}
    feeds = PublicCompanyFeeds(list(sources.values()))
    cache = {}
    fixtures = set()
    counts = dict(rows=0, populated=0, missing=0, failed=0, unsupported=0, no_headings=0)
    with db.get_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT job_id, source_url, source_provider FROM Jobs ORDER BY job_id')
        rows = cursor.fetchall()
    for job in rows:
        counts['rows'] += 1
        source = sources.get(job['source_provider'])
        if not source:
            counts['unsupported'] += 1
            LOG.warning('Job %s: source is not a configured hiring board; retained text fallback', job['job_id'])
            continue
        try:
            if source.key not in cache:
                try:
                    if source.source_type == 'greenhouse':
                        payload = feeds._get_json(f'https://boards-api.greenhouse.io/v1/boards/{source.board}/jobs?content=true')
                        cache[source.key] = {canonical_job_url(item['absolute_url']): item.get('content') for item in payload.get('jobs', []) if item.get('absolute_url')}
                    else:
                        payload = feeds._get_json(f'https://api.lever.co/v0/postings/{source.board}?mode=json')
                        cache[source.key] = {canonical_job_url(item['hostedUrl']): lever_html(item) for item in payload if item.get('hostedUrl')}
                except Exception as error:
                    cache[source.key] = error
            if isinstance(cache[source.key], Exception):
                raise cache[source.key]
            raw = cache[source.key].get(canonical_job_url(job['source_url']))
            cleaned = clean_html(raw, job['source_url'])
            if not cleaned:
                counts['missing'] += 1
                LOG.warning('Job %s: unavailable or empty source description; retained text fallback', job['job_id'])
                continue
            if args.apply:
                with db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('UPDATE Jobs SET description_html=%s, description_fetched_at=UTC_TIMESTAMP() WHERE job_id=%s', (cleaned, job['job_id']))
                    conn.commit()
            counts['populated'] += 1
            counts['no_headings'] += not any(section['title'] for section in group_by_headings(cleaned))
            if args.fixtures_dir and source.source_type not in fixtures:
                args.fixtures_dir.mkdir(parents=True, exist_ok=True)
                (args.fixtures_dir / f'{source.source_type}.html').write_text(raw, encoding='utf-8')
                (args.fixtures_dir / f'{source.source_type}.json').write_text(json.dumps({'source_url': job['source_url'], 'provider': source.key}, indent=2), encoding='utf-8')
                fixtures.add(source.source_type)
        except Exception:
            counts['failed'] += 1
            LOG.exception('Job %s: backfill failed; retained text fallback', job['job_id'])
    print(json.dumps(counts, indent=2))
    if args.apply:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*), SUM(description_html IS NOT NULL) FROM Jobs')
            total, populated = cursor.fetchone()
            print(f'Database coverage: {populated or 0}/{total} rows contain description HTML')


if __name__ == '__main__':
    main()
