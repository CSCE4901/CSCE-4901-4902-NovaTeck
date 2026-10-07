"""Retag stored jobs from qualification HTML; default to a read-only comparison."""
import argparse
import json
from pathlib import Path
import db
from nlp_tagger import analyze_job_skills


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup', type=Path, help='Save previous tags before applying changes.')
    args = parser.parse_args()
    with db.get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT job_id, description, description_html FROM Jobs ORDER BY job_id')
        jobs = cur.fetchall()
        cur.execute('SELECT js.job_id, s.skill_name, js.requirement_type FROM Job_Skills js JOIN Skills s ON s.skill_id=js.skill_id ORDER BY js.job_id, s.skill_name')
        previous = cur.fetchall()
    if args.apply and args.backup:
        args.backup.write_text(json.dumps(previous, indent=2))
    old = {}
    for row in previous:
        old.setdefault(row['job_id'], set()).add((row['skill_name'].lower(), row['requirement_type']))
    counts = dict(jobs=len(jobs), changed=0, applied=0, qualification_html=0, text_fallback=0, failed=0)
    for job in jobs:
        try:
            analysis = analyze_job_skills(job['description'], job['description_html'])
            counts[analysis['source']] += 1
            tags = analysis['skills']
            if {(tag['skill_name'], tag['requirement_type']) for tag in tags} != old.get(job['job_id'], set()):
                counts['changed'] += 1
                if args.apply:
                    db.replace_job_skills(job['job_id'], tags)
                    counts['applied'] += 1
        except Exception as error:
            counts['failed'] += 1
            print(f"Job {job['job_id']}: retained old tags after {type(error).__name__}")
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
