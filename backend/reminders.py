"""Build private, date-based dashboard reminders without sending email."""
from datetime import date, datetime, timedelta


def as_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def build_reminders(saved, applications, today=None):
    today = today or date.today()
    horizon = today + timedelta(days=7)
    alerts = []
    applied = {row['job_id'] for row in applications if row.get('status') != 'Opened employer site'}
    for job in saved:
        deadline = as_date(job.get('closing_date'))
        if job.get('is_active') in (False, 0) or job['job_id'] in applied:
            continue
        if deadline and today <= deadline <= horizon:
            alerts.append({'id': f"deadline-{job['job_id']}", 'job_id': job['job_id'], 'title': job['title'], 'company': job.get('company_name'), 'kind': 'Application deadline', 'date': deadline.isoformat(), 'message': 'Deadline today' if deadline == today else f"Apply by {deadline.strftime('%b %d')}", 'overdue': False})
    for job in applications:
        if job.get('status') == 'Applied':
            updated = as_date(job.get('updated_at'))
            due = updated + timedelta(days=7) if updated else None
            if due and due <= horizon:
                alerts.append({'id': f"followup-{job['job_id']}", 'job_id': job['job_id'], 'title': job['title'], 'company': job.get('company_name'), 'kind': 'Application follow-up', 'date': due.isoformat(), 'message': 'Follow up with the employer', 'overdue': due < today})
    return sorted(alerts, key=lambda row: (row['date'], row['id']))


def user_reminders(user_id, today=None):
    import db
    today = today or date.today()
    saved, applications = db.get_saved_jobs(user_id), db.get_application_activity(user_id)
    with db.get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT r.*, j.title, c.name AS company_name FROM Job_Reminder_Dates r JOIN Jobs j ON j.job_id=r.job_id JOIN Companies c ON c.company_id=j.company_id WHERE r.user_id=%s', (user_id,))
        custom = cur.fetchall()
    dates = {row['job_id']: row for row in custom}
    for job in saved:
        if dates.get(job['job_id'], {}).get('deadline'):
            job['closing_date'] = dates[job['job_id']]['deadline']
    result = build_reminders(saved, applications, today)
    applied = {job['job_id'] for job in applications if job.get('status') != 'Opened employer site'}
    for row in custom:
        deadline = as_date(row.get('deadline'))
        if deadline and deadline < today and row['job_id'] not in applied:
            result.append({'id':f"deadline-{row['job_id']}", 'job_id':row['job_id'], 'title':row['title'], 'company':row['company_name'], 'kind':'Application deadline', 'date':deadline.isoformat(), 'message':'Application deadline passed', 'overdue':True})
        due = as_date(row.get('follow_up'))
        if due:
            result = [alert for alert in result if alert['id'] != f"followup-{row['job_id']}"]
            if due <= today + timedelta(days=7):
                result.append({'id':f"followup-{row['job_id']}", 'job_id':row['job_id'], 'title':row['title'], 'company':row['company_name'], 'kind':'Application follow-up', 'date':due.isoformat(), 'message':'Follow up with the employer', 'overdue':due < today})
    return sorted(result, key=lambda row:(row['date'],row['id']))
