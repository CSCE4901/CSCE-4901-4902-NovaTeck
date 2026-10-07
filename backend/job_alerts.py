"""New-job alerts from profile skills and explicit job preferences."""
from datetime import date, timedelta
import re
import db
from reminders import as_date


def salary_matches(job, preference):
    if not preference or preference == 'No preference':
        return True
    salary = job.get('salary_range') or ''
    if re.search(r'hour|/hr', salary, re.I):
        return False
    def amounts(text):
        return [float(value.replace(',', '')) * (1000 if suffix else 1) for value, suffix in re.findall(r'\$\s*([\d,]+(?:\.\d+)?)([kK]?)', text)]
    offered, requested = amounts(salary), amounts(preference)
    if not offered or not requested:
        return False
    lower = 0 if preference.startswith('Under') else min(requested)
    upper = float('inf') if '+' in preference else max(requested)
    return max(offered) >= lower and min(offered) <= upper


def matching_new_jobs(user_id, today=None):
    today = today or date.today()
    profile = db.get_profile_details(user_id)
    skills = db.get_user_skills(user_id)
    if not skills:
        skills = (db.get_user_by_id(user_id) or {}).get('skills', '').split(',')
    jobs = db.get_jobs(discipline=profile.get('career_focus'), location=(profile.get('preferred_location') or '').split(',')[0].strip() or None,
                       work_type=','.join(profile.get('work_types') or []) or None, limit=None, exclude_applications_user_id=user_id)
    with db.get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT job_id FROM Hidden_Jobs WHERE user_id=%s', (user_id,))
        hidden = {row['job_id'] for row in cur.fetchall()}
    saved = {job['job_id'] for job in db.get_saved_jobs(user_id)}
    recent = []
    for job in jobs:
        posted = as_date(job.get('date_posted') or job.get('date_crawled'))
        if not posted or not today - timedelta(days=7) <= posted <= today or job['job_id'] in hidden | saved:
            continue
        if not salary_matches(job, profile.get('salary_range')):
            continue
        recent.append(job)
    matches = db.add_resume_matches(user_id, recent, profile_override=skills) if recent else []
    return [{'id':f"job-{job['job_id']}", 'job_id':job['job_id'], 'title':job['title'], 'company':job.get('company_name'), 'kind':'New matching job', 'date':as_date(job.get('date_posted') or job.get('date_crawled')).isoformat(), 'message':f"{job['resume_match_pct']}% profile skill match · {job.get('location') or 'Location not listed'}", 'overdue':False} for job in sorted(matches, key=lambda row:row['resume_match_pct'] or 0, reverse=True) if (job.get('resume_match_pct') or 0) >= 50 and job.get('resume_required_count',0) >= 3]
