"""Seed from crawler."""

from dotenv import load_dotenv
load_dotenv()

import json
import os
import sys

import db
from nlp_tagger import tag_skills_for_job


# Path to crawler's JSON output (relative to this script)
CRAWLER_JSON_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "crawler",
    "jobs.json"
)


def load_crawler_data():
    """Load jobs from the crawler's JSON output."""
    if not os.path.exists(CRAWLER_JSON_PATH):
        print(f"[seed] ⚠ Crawler JSON not found at: {CRAWLER_JSON_PATH}")
        print(f"[seed] Run the crawler first:")
        print(f"[seed]   cd crawler && python3 crawler.py")
        return None

    print(f"[seed] ✓ Found crawler output: {CRAWLER_JSON_PATH}")

    with open(CRAWLER_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"[seed] ✓ Loaded {len(data.get('jobs', []))} jobs from crawler")
    print(f"[seed] ✓ Loaded {len(data.get('companies', []))} companies from crawler")

    return data


def normalize_job(job, companies_lookup):
    """Convert crawler's job format to seed format."""
    company_name = job.get("company_name") or job.get("company")

    return {
        "company": company_name,
        "title": job.get("title", "Untitled Position"),
        "location": job.get("location", "Dallas, TX"),
        "job_type": job.get("job_type", "Full-time"),
        "salary_range": job.get("salary_range", "Competitive"),
        "date_posted": job.get("date_posted", "2026-04-01"),
        "source_url": job.get("source_url", ""),
        "description": job.get("description", ""),
    }


def run_seed():
    print("=" * 60)
    print("[seed] NovaTeck Crawler → Database Pipeline")
    print("[seed] Connecting Suraj's crawler to Shubekshya's database")
    print("=" * 60)

    # Step 1: Load crawler data
    data = load_crawler_data()
    if data is None:
        print("\n[seed] ✗ Cannot proceed without crawler data.")
        print("[seed] Either run the crawler first, or use seed_jobs.py for hardcoded data.")
        sys.exit(1)

    crawler_companies = data.get("companies", [])
    crawler_jobs = data.get("jobs", [])

    # Step 2: Insert companies into database
    print("\n[seed] Inserting companies...")
    company_ids = {}
    for company in crawler_companies:
        name = company.get("name") if isinstance(company, dict) else company
        cid = db.insert_company(name)
        if cid:
            company_ids[name] = cid
            print(f"[seed]   ✓ Company '{name}' -> id={cid}")

    # Also try the standard 3 in case crawler used different names
    for name in ["Texas Instruments", "AT&T", "Raytheon", "Raytheon Technologies"]:
        if name not in company_ids:
            cid = db.insert_company(name)
            if cid:
                company_ids[name] = cid

    # Step 3: Insert jobs from crawler output
    print(f"\n[seed] Inserting {len(crawler_jobs)} jobs from crawler...")
    inserted = 0
    skipped = 0

    for raw_job in crawler_jobs:
        job = normalize_job(raw_job, company_ids)

        # Find matching company
        cid = company_ids.get(job["company"])
        if not cid:
            # Try fuzzy match (e.g., "Raytheon Technologies" -> "Raytheon")
            for known_name in company_ids.keys():
                if known_name.lower() in job["company"].lower() or job["company"].lower() in known_name.lower():
                    cid = company_ids[known_name]
                    break

        if not cid:
            print(f"[seed]   ⚠ Skipped — unknown company: {job['company']}")
            skipped += 1
            continue

        # Insert job
        job_id = db.insert_job(
            company_id=cid,
            title=job["title"],
            source_url=job["source_url"],
            description=job["description"].strip(),
            location=job["location"],
            job_type=job["job_type"],
            salary_range=job["salary_range"],
            date_posted=job["date_posted"],
        )

        if not job_id:
            print(f"[seed]   ⚠ Skipped duplicate: {job['title']}")
            skipped += 1
            continue

        # NLP skill tagging (Mani's module)
        try:
            tagged = tag_skills_for_job(job["description"])
            for item in tagged:
                skill_id = db.insert_skill(item["skill_name"])
                if skill_id:
                    db.link_job_skill(job_id, skill_id, item["requirement_type"])

            inserted += 1
            print(f"[seed]   ✓ Job {job_id}: {job['title']} ({len(tagged)} skills tagged)")
        except Exception as e:
            print(f"[seed]   ⚠ NLP failed for job {job_id}: {e}")
            inserted += 1

    print("\n" + "=" * 60)
    print(f"[seed] ✓ Done!")
    print(f"[seed]   Inserted: {inserted} jobs")
    print(f"[seed]   Skipped:  {skipped} jobs")
    print(f"[seed]   Source:   {CRAWLER_JSON_PATH}")
    print("=" * 60)

    # Step 4: Pre-populate test user skills
    test_user = db.get_user_by_email("student@test.com")
    if test_user:
        uid = test_user["user_id"]
        print(f"\n[seed] Populating skills for test user (id={uid})...")
        for skill_name in ["Python", "SQL", "React", "Git", "JavaScript"]:
            sid = db.insert_skill(skill_name)
            if sid:
                db.add_user_skill(uid, sid)
        print("[seed] ✓ Test user skills added: Python, SQL, React, Git, JavaScript")

    print("\n[seed] 🎉 Database ready for MVP demo!")
    print("[seed] Next steps:")
    print("[seed]   1. python3 app.py            (start backend)")
    print("[seed]   2. cd ../frontend && npm run dev   (start frontend)")
    print("[seed]   3. Open Safari: http://127.0.0.1:3000")


if __name__ == "__main__":
    run_seed()