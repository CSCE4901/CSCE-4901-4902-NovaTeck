"""Db."""

import os
import re
import hashlib
import logging
from pathlib import Path
from contextlib import contextmanager
import mysql.connector
from mysql.connector import Error
from job_metadata import with_salary
from dotenv import load_dotenv

# Load local database settings.
load_dotenv(Path(__file__).with_name(".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DISCIPLINE_PATTERNS = {
    "software": r"(software|developer|web|frontend|front.?end|backend|back.?end|full.?stack|programmer|computer vision|site reliability|sre|devops)",
    "data_ai": r"(data|machine learning|artificial intelligence|ai |analytics|scientist)",
    "it_cloud_security": r"(information technology|\bit\b|cloud|network|cyber|security|infrastructure|database|systems administrator)",
    "electrical_hardware": r"(electrical|electronics|embedded|hardware|avionics|firmware|power|test equipment)",
    "mechanical": r"(mechanical|manufacturing|thermal|structural|robotics|mechatronic)",
    "aerospace": r"(aerospace|aeronautical|avionics|propulsion|aircraft|flight|spacecraft|v-bat)",
    "mechanical_aerospace": r"(mechanical|aerospace|propulsion|aircraft|structures|vibrations|flight test)",
    "quality_systems": r"(quality|reliability|systems engineering|verification|validation)",
}

# Keep degree suggestions relevant to CS jobs.
DISCIPLINE_EXCLUDED_SKILLS = {
    "software": {
        "aerospace", "aviation", "electrical engineering", "electronics",
        "embedded systems", "flight test", "hardware", "mechanical engineering",
        "quality engineering", "reliability engineering", "test engineering",
        "verification", "validation", "failure analysis", "risk management",
        "root cause analysis", "systems engineering", "autonomous systems", "fmea",
        "fracas", "as9100", "do-178c", "do-254", "cad", "simulink",
    },
}

DB_CONFIG = {
    "host":               os.environ.get("DB_HOST", "localhost"),
    "port":               int(os.environ.get("DB_PORT", 3306)),
    "database":           os.environ.get("DB_NAME", "novatek_db"),
    "user":               os.environ.get("DB_USER"),
    "password":           os.environ.get("DB_PASSWORD"),
    "connection_timeout": 10,
    "use_pure": True,  # Avoid native connector crashes under concurrent Python 3.14 requests.
}


@contextmanager
def get_connection():
    conn = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        yield conn
    except Error as e:
        log.error(f"DB connection error: {e}")
        raise
    finally:
        if conn and conn.is_connected():
            conn.close()


def database_is_healthy():
    """Return whether the configured database accepts a simple query."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            return cur.fetchone()[0] == 1
    except Error:
        return False


# COMPANIES

def insert_company(name, website_url=None, location=None, industry=None):
    sql = "INSERT IGNORE INTO Companies (name, website_url, location, industry) VALUES (%s, %s, %s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (name, website_url, location, industry))
            conn.commit()
            if cur.lastrowid:
                return cur.lastrowid
            cur.execute("SELECT company_id FROM Companies WHERE name = %s", (name,))
            row = cur.fetchone()
            return row[0] if row else None
    except Error as e:
        log.error(f"insert_company failed: {e}")
        return None


def get_company(company_id):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Companies WHERE company_id = %s", (company_id,))
            return cur.fetchone()
    except Exception as e:
        log.error(f"get_company failed: {e}")
        return None


def get_all_companies():
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Companies ORDER BY name")
            return cur.fetchall()
    except Error as e:
        log.error(f"get_all_companies failed: {e}")
        return []


# JOBS

def insert_job(company_id, title, source_url, description=None,
               location=None, job_type=None, salary_range=None, date_posted=None):
    sql = """
        INSERT IGNORE INTO Jobs
            (company_id, title, description, location, job_type, salary_range, source_url, date_posted)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (company_id, title, description, location,
                              job_type, salary_range, source_url, date_posted))
            conn.commit()
            if cur.lastrowid:
                log.info(f"Inserted job: '{title}' (id={cur.lastrowid})")
                return cur.lastrowid
            return None
    except Error as e:
        log.error(f"insert_job failed: {e}")
        return None


def upsert_job(company_id, title, source_url, provider, description=None,
               location=None, job_type=None, salary_range=None, date_posted=None, source_http_status=None, closing_date=None, description_html=None):
    """Upsert job using a source URL without advertising trackers."""
    from job_metadata import canonical_job_url
    source_url = canonical_job_url(source_url)
    from job_html import clean_html
    description_html = clean_html(description_html, source_url)
    select_sql = """SELECT job_id, title, description, location, job_type,
                           salary_range, date_posted, is_active
                    FROM Jobs WHERE source_url = %s"""
    insert_sql = """INSERT INTO Jobs
        (company_id, title, description, location, job_type, salary_range, source_url,
         date_posted, source_provider, last_seen_at, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), TRUE)"""
    update_sql = """UPDATE Jobs SET company_id=%s, title=%s, description=%s,
        location=%s, job_type=%s, salary_range=%s, date_posted=%s,
        source_provider=%s, last_seen_at=NOW(), is_active=TRUE WHERE job_id=%s"""
    values = (company_id, title, description, location, job_type, salary_range, date_posted)
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(select_sql, (source_url,))
            existing = cur.fetchone()
            if not existing:
                insert_values = (company_id, title, description, location, job_type,
                                 salary_range, source_url, date_posted, provider)
                cur.execute(insert_sql, insert_values)
                job_id = cur.lastrowid
                cur.execute("UPDATE Jobs SET source_http_status=%s, closing_date=%s WHERE job_id=%s", (source_http_status, closing_date, job_id))
                if description_html:
                    cur.execute("UPDATE Jobs SET description_html=%s, description_fetched_at=UTC_TIMESTAMP() WHERE job_id=%s", (description_html, job_id))
                conn.commit()
                return job_id, True
            fields = ("title", "description", "location", "job_type", "salary_range", "date_posted")
            comparable_values = values[1:]
            changed = any(
                (existing[field].isoformat() if hasattr(existing[field], "isoformat") else existing[field]) != value
                for field, value in zip(fields, comparable_values)
            ) or not existing["is_active"]
            cur.execute(update_sql, values + (provider, existing["job_id"]))
            cur.execute("UPDATE Jobs SET source_http_status=%s, closing_date=%s WHERE job_id=%s", (source_http_status, closing_date, existing["job_id"]))
            if description_html:
                cur.execute("UPDATE Jobs SET description_html=%s, description_fetched_at=UTC_TIMESTAMP() WHERE job_id=%s", (description_html, existing["job_id"]))
            conn.commit()
            return existing["job_id"], changed
    except Error as e:
        log.error(f"upsert_job failed: {e}")
        return None, False


def replace_job_skills(job_id, tags):
    """Replace one job's skill tags atomically; a failed write keeps old tags."""
    with get_connection() as conn:
        try:
            cur = conn.cursor()
            cur.execute('DELETE FROM Job_Skills WHERE job_id=%s', (job_id,))
            for tag in tags:
                cur.execute("INSERT INTO Skills (skill_name, skill_type) VALUES (%s, 'technical') ON DUPLICATE KEY UPDATE skill_name=skill_name", (tag['skill_name'],))
                cur.execute('SELECT skill_id FROM Skills WHERE LOWER(skill_name)=LOWER(%s)', (tag['skill_name'],))
                skill_id = cur.fetchone()[0]
                cur.execute('INSERT INTO Job_Skills (job_id, skill_id, requirement_type) VALUES (%s,%s,%s)', (job_id, skill_id, tag['requirement_type']))
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def clear_job_skills(job_id):
    """Clear job skills."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM Job_Skills WHERE job_id = %s", (job_id,))
            conn.commit()
            return True
    except Error as e:
        log.error(f"clear_job_skills failed: {e}")
        return False


def deactivate_stale_source_jobs(provider, last_successful_sync_started_at):
    """Deactivate stale source jobs."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""UPDATE Jobs SET is_active = FALSE
                           WHERE source_provider = %s AND is_active = TRUE
                             AND last_seen_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)""",
                        (provider,))
            conn.commit()
            return cur.rowcount
    except Error as e:
        log.error(f"deactivate_stale_source_jobs failed: {e}")
        return 0


def get_active_source_jobs(provider):
    """Return the minimum data needed to apply NovaTeck's role policy."""
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("""SELECT job_id, title, location FROM Jobs
                           WHERE source_provider = %s AND is_active = TRUE""", (provider,))
            return cur.fetchall()
    except Error as e:
        log.error(f"get_active_source_jobs failed: {e}")
        return []


def deactivate_jobs(job_ids):
    """Soft-retire known jobs while preserving their history and snapshots."""
    if not job_ids:
        return 0
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            placeholders = ", ".join(["%s"] * len(job_ids))
            cur.execute(f"UPDATE Jobs SET is_active = FALSE WHERE job_id IN ({placeholders})", tuple(job_ids))
            conn.commit()
            return cur.rowcount
    except Error as e:
        log.error(f"deactivate_jobs failed: {e}")
        return 0


def retire_legacy_seed_jobs(maximum_age_days=30):
    """Hide old, untracked demo rows once live data has been ingested."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""UPDATE Jobs SET is_active = FALSE
                           WHERE source_provider IS NULL AND is_active = TRUE
                             AND date_posted < DATE_SUB(CURDATE(), INTERVAL %s DAY)""",
                        (maximum_age_days,))
            conn.commit()
            return cur.rowcount
    except Error as e:
        log.error(f"retire_legacy_seed_jobs failed: {e}")
        return 0


# JOB SYNC RUNS

def start_sync_run(provider, location, query):
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""INSERT INTO Job_Sync_Runs (provider, location, query, status)
                           VALUES (%s, %s, %s, 'running')""", (provider, location, query))
            conn.commit()
            return cur.lastrowid
    except Error as e:
        log.error(f"start_sync_run failed: {e}")
        return None


def finish_sync_run(run_id, status, stats, error_message=None):
    if not run_id:
        return False
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""UPDATE Job_Sync_Runs SET finished_at=NOW(), status=%s,
                fetched_count=%s, upserted_count=%s, error_count=%s, error_message=%s
                WHERE sync_run_id=%s""", (status, stats["fetched"], stats["upserted"],
                                             stats["errors"], error_message, run_id))
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"finish_sync_run failed: {e}")
        return False


def get_latest_sync_run():
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Job_Sync_Runs ORDER BY started_at DESC LIMIT 1")
            return cur.fetchone()
    except Error as e:
        log.error(f"get_latest_sync_run failed: {e}")
        return None


def _job_filters(skill=None, location=None, company_id=None, experience=None, discipline=None, is_active=True, q=None, work_type=None):
    """Build parameterized conditions shared by job search and pagination."""
    conditions = ["j.is_active = %s", "(j.closing_date IS NULL OR j.closing_date >= CURDATE())", "(j.date_posted IS NULL OR j.date_posted >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH))"]
    params = [is_active]
    if work_type:
        requested = [value.strip().lower() for value in work_type.split(',') if value.strip()]
        allowed = {'full-time': ['full-time', 'full time', 'full_time', 'full time employee'], 'part-time': ['part-time', 'part time', 'part_time', 'part time employee'], 'contract': ['contract', 'contractor']}
        values = [variant for value in requested for variant in allowed.get(value, [])]
        work_conditions = []
        if values:
            work_conditions.append("LOWER(j.job_type) IN (" + ",".join(["%s"] * len(values)) + ")")
            params.extend(values)
        if 'internship' in requested:
            work_conditions.append("(LOWER(j.job_type) REGEXP %s OR LOWER(j.title) REGEXP %s)")
            params.extend([r'(intern|internship)', r'(^|[^a-z])intern(ship)?([^a-z]|$)'])
        if work_conditions:
            conditions.append('(' + ' OR '.join(work_conditions) + ')')
    if q:
        conditions.append("(j.title LIKE %s OR j.description LIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if location:
        conditions.append("j.location LIKE %s")
        params.append(f"%{location}%")
    if company_id:
        conditions.append("j.company_id = %s")
        params.append(company_id)
    if skill:
        if isinstance(skill, list):
            values = list(dict.fromkeys(value.strip().lower() for value in skill if value.strip()))[:100]
            if values:
                placeholders = ','.join(['%s'] * len(values))
                conditions.append(f'j.job_id IN (SELECT js.job_id FROM Job_Skills js JOIN Skills s ON js.skill_id = s.skill_id WHERE LOWER(s.skill_name) IN ({placeholders}))')
                params.extend(values)
        else:
            conditions.append('j.job_id IN (SELECT js.job_id FROM Job_Skills js JOIN Skills s ON js.skill_id = s.skill_id WHERE s.skill_name LIKE %s)')
            params.append(f'%{skill}%')
    experience_patterns = {
        "entry": r"(intern|junior|entry|associate|new grad)",
        "mid": r"(engineer|developer|analyst|designer)",
        "senior": r"(senior|sr\.?|staff|lead|principal|director|manager)",
    }
    patterns = [experience_patterns[value] for value in (experience or "").split(",") if value in experience_patterns]
    if patterns:
        conditions.append("LOWER(j.title) REGEXP %s")
        params.append("|".join(patterns))
    disciplines = discipline if isinstance(discipline, list) else [discipline]
    patterns = [DISCIPLINE_PATTERNS[value] for value in dict.fromkeys(disciplines) if value in DISCIPLINE_PATTERNS]
    if patterns:
        conditions.append('(' + ' OR '.join(['LOWER(j.title) REGEXP %s'] * len(patterns)) + ')')
        params.extend(patterns)
    return " AND ".join(conditions), params


def get_jobs(skill=None, location=None, company_id=None, experience=None, discipline=None, is_active=True, limit=50, offset=0, q=None, work_type=None, exclude_applications_user_id=None):
    where, params = _job_filters(skill, location, company_id, experience, discipline, is_active, q=q, work_type=work_type)
    if exclude_applications_user_id is not None:
        where += ' AND NOT EXISTS (SELECT 1 FROM Application_Activity activity WHERE activity.job_id = j.job_id AND activity.user_id = %s)'
        params.append(exclude_applications_user_id)

    sql = f"""
        SELECT j.*, c.name AS company_name, c.website_url AS company_website,
               (SELECT GROUP_CONCAT(s.skill_name ORDER BY s.skill_name SEPARATOR ', ')
                FROM Job_Skills js JOIN Skills s ON js.skill_id = s.skill_id
                WHERE js.job_id = j.job_id AND js.requirement_type = 'required') AS skill_summary
        FROM Jobs j
        JOIN Companies c ON j.company_id = c.company_id
        WHERE {where}
        ORDER BY j.date_posted DESC, j.job_id DESC
    """
    if limit is not None:
        sql += " LIMIT %s OFFSET %s"
        params.extend([limit, offset])

    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(sql, params)
            return [with_salary(job) for job in cur.fetchall()]
    except Error as e:
        log.error(f"get_jobs failed: {e}")
        raise


def get_job_count(skill=None, location=None, company_id=None, experience=None, discipline=None, is_active=True, q=None, work_type=None, exclude_applications_user_id=None):
    """Return the total matching jobs so the UI can paginate honestly."""
    where, params = _job_filters(skill, location, company_id, experience, discipline, is_active, q=q, work_type=work_type)
    if exclude_applications_user_id is not None:
        where += ' AND NOT EXISTS (SELECT 1 FROM Application_Activity activity WHERE activity.job_id = j.job_id AND activity.user_id = %s)'
        params.append(exclude_applications_user_id)
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT COUNT(*) FROM Jobs j WHERE {where}", params)
            return cur.fetchone()[0]
    except Error as e:
        log.error(f"get_job_count failed: {e}")
        raise


def get_search_options():
    """Return safe, compact autocomplete choices sourced from live data."""
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("""SELECT DISTINCT s.skill_name FROM Skills s
                           JOIN Job_Skills js ON js.skill_id = s.skill_id
                           JOIN Jobs j ON j.job_id = js.job_id
                           WHERE j.is_active = TRUE ORDER BY s.skill_name""")
            skills = [row["skill_name"] for row in cur.fetchall()]
            cur.execute("""SELECT c.company_id, c.name,
                                  COUNT(j.job_id) AS active_job_count
                           FROM Companies c
                           LEFT JOIN Jobs j ON j.company_id = c.company_id AND j.is_active = TRUE
                           GROUP BY c.company_id, c.name
                           ORDER BY c.name""")
            companies = cur.fetchall()
            cur.execute("""SELECT DISTINCT location FROM Jobs
                           WHERE is_active = TRUE AND location IS NOT NULL
                           ORDER BY location""")
            locations = [row["location"] for row in cur.fetchall()]
            return {"skills": skills, "companies": companies, "locations": locations}
    except Error as e:
        log.error(f"get_search_options failed: {e}")
        raise


def get_job_by_id(job_id):
    job_sql = """
        SELECT j.*, c.name AS company_name, c.website_url AS company_website, c.industry AS company_industry
        FROM Jobs j
        JOIN Companies c ON j.company_id = c.company_id
        WHERE j.job_id = %s
    """
    skills_sql = """
        SELECT s.skill_name, js.requirement_type
        FROM Job_Skills js
        JOIN Skills s ON js.skill_id = s.skill_id
        WHERE js.job_id = %s
        ORDER BY js.requirement_type
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(job_sql, (job_id,))
            job = cur.fetchone()
            if not job:
                return None
            cur.execute(skills_sql, (job_id,))
            job["skills"] = cur.fetchall()
            from job_metadata import extract_experience, experience_summary, extract_work_type
            stored_experience = job.get("experience_level") or ""
            if len(stored_experience) > 450 or re.search(r'&(?:nbsp|amp|lt|gt);|<[^>]+>', stored_experience):
                stored_experience = ""
            job["experience_level"] = experience_summary(stored_experience) or experience_summary(extract_experience(job.get("description")))
            job["work_arrangement"] = extract_work_type(job.get("description"))
            from job_html import clean_html, group_by_headings
            # Re-sanitize on read as defense against manual or legacy database writes.
            job['description_sections'] = group_by_headings(clean_html(job.get('description_html'), job.get('source_url')))
            return with_salary(job)
    except Error as e:
        log.error(f"get_job_by_id failed: {e}")
        raise


def update_job(job_id, **fields):
    allowed = {"title", "description", "location", "job_type", "salary_range", "date_posted", "is_active"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return False
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    sql = f"UPDATE Jobs SET {set_clause} WHERE job_id = %s"
    params = list(updates.values()) + [job_id]
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params)
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"update_job failed: {e}")
        return False


def delete_job(job_id):
    return update_job(job_id, is_active=False)


# SKILLS

def insert_skill(skill_name, skill_type="technical"):
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT IGNORE INTO Skills (skill_name, skill_type) VALUES (%s, %s)",
                (skill_name, skill_type)
            )
            conn.commit()
            if cur.lastrowid:
                return cur.lastrowid
            cur.execute("SELECT skill_id FROM Skills WHERE skill_name = %s", (skill_name,))
            row = cur.fetchone()
            return row[0] if row else None
    except Error as e:
        log.error(f"insert_skill failed: {e}")
        return None


def link_job_skill(job_id, skill_id, requirement_type="required"):
    sql = "INSERT IGNORE INTO Job_Skills (job_id, skill_id, requirement_type) VALUES (%s, %s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (job_id, skill_id, requirement_type))
            conn.commit()
            return True
    except Error as e:
        log.error(f"link_job_skill failed: {e}")
        return False


# JOB SNAPSHOTS

def insert_snapshot(job_id, title=None, salary_range=None, is_active=True):
    sql = """
        INSERT INTO Job_Snapshots (job_id, snapshot_date, title, salary_range, is_active)
        VALUES (%s, CURDATE(), %s, %s, %s)
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (job_id, title, salary_range, is_active))
            conn.commit()
            return cur.lastrowid
    except Error as e:
        log.error(f"insert_snapshot failed: {e}")
        return None


def get_snapshots_for_job(job_id):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT * FROM Job_Snapshots WHERE job_id = %s ORDER BY snapshot_date DESC",
                (job_id,)
            )
            return cur.fetchall()
    except Error as e:
        log.error(f"get_snapshots_for_job failed: {e}")
        return []


# USERS

def insert_user(name, email, password_hash, skills=None):
    sql = "INSERT IGNORE INTO Users (name, email, password_hash, skills) VALUES (%s, %s, %s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (name, email, password_hash, skills))
            conn.commit()
            if cur.lastrowid:
                log.info(f"Registered user: {email} (id={cur.lastrowid})")
                return cur.lastrowid
            log.warning(f"Email already registered: {email}")
            return None
    except Error as e:
        log.error(f"insert_user failed: {e}")
        raise


def get_user_by_email(email):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Users WHERE email = %s", (email,))
            return cur.fetchone()
    except Error as e:
        log.error(f"get_user_by_email failed: {e}")
        raise


def get_user_by_id(user_id):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Users WHERE user_id = %s", (user_id,))
            return cur.fetchone()
    except Error as e:
        log.error(f"get_user_by_id failed: {e}")
        raise


def update_user(user_id, **fields):
    allowed = {"name", "skills", "resume_url", "resume_filename", "password_hash"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return False
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    sql = f"UPDATE Users SET {set_clause} WHERE user_id = %s"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, list(updates.values()) + [user_id])
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"update_user failed: {e}")
        return False


def create_password_reset_token(user_id, token):
    """Store one short-lived, single-use password-reset token for a user."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE Password_Reset_Tokens SET used_at=NOW() WHERE user_id=%s AND used_at IS NULL", (user_id,))
            cur.execute("""INSERT INTO Password_Reset_Tokens (user_id, token_hash, expires_at)
                           VALUES (%s, %s, DATE_ADD(NOW(), INTERVAL 30 MINUTE))""", (user_id, token_hash))
            conn.commit()
            return True
    except Error as e:
        log.error(f"create_password_reset_token failed: {e}")
        return False


def reset_password(token, password_hash):
    """Consume a valid reset token and update the password atomically."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("""SELECT reset_id, user_id FROM Password_Reset_Tokens
                           WHERE token_hash=%s AND used_at IS NULL AND expires_at > NOW() FOR UPDATE""", (token_hash,))
            reset = cur.fetchone()
            if not reset:
                conn.rollback()
                return False
            cur.execute("UPDATE Users SET password_hash=%s WHERE user_id=%s", (password_hash, reset["user_id"]))
            cur.execute("UPDATE Password_Reset_Tokens SET used_at=NOW() WHERE reset_id=%s", (reset["reset_id"],))
            conn.commit()
            return True
    except Error as e:
        log.error(f"reset_password failed: {e}")
        return False


def generate_skill_trend_snapshot():
    """Record today's active-job demand for every required skill."""
    sql = """INSERT INTO Skill_Trend_Snapshots (snapshot_date, skill_id, active_job_count, avg_salary)
             SELECT CURDATE(), js.skill_id, COUNT(*), NULL
             FROM Job_Skills js JOIN Jobs j ON j.job_id=js.job_id
             WHERE j.is_active=TRUE AND js.requirement_type='required'
             GROUP BY js.skill_id
             ON DUPLICATE KEY UPDATE active_job_count=VALUES(active_job_count), avg_salary=VALUES(avg_salary)"""
    try:
        with get_connection() as conn:
            cur = conn.cursor(); cur.execute(sql); conn.commit()
            return cur.rowcount
    except Error as e:
        log.error(f"generate_skill_trend_snapshot failed: {e}")
        return 0


# USER SKILLS  (for skill gap analysis)

def add_user_skill(user_id, skill_id):
    """Link a skill to a user. Skips if already linked."""
    sql = "INSERT IGNORE INTO User_Skills (user_id, skill_id) VALUES (%s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id, skill_id))
            conn.commit()
            return True
    except Error as e:
        log.error(f"add_user_skill failed: {e}")
        return False


def get_user_skills(user_id):
    """Return list of skill name strings the user has."""
    sql = """
        SELECT s.skill_name
        FROM User_Skills us
        JOIN Skills s ON us.skill_id = s.skill_id
        WHERE us.user_id = %s
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id,))
            return [row[0] for row in cur.fetchall()]
    except Error as e:
        log.error(f"get_user_skills failed: {e}")
        return []


def set_user_skills_from_list(user_id, skill_names):
    """Set user skills from list."""
    with get_connection() as conn:
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM User_Skills WHERE user_id = %s", (user_id,))
            for name in skill_names:
                cur.execute("SELECT skill_id FROM Skills WHERE LOWER(TRIM(skill_name)) = %s", (name.strip().lower(),))
                row = cur.fetchone()
                if row:
                    cur.execute("INSERT IGNORE INTO User_Skills (user_id, skill_id) VALUES (%s, %s)", (user_id, row[0]))
            cur.execute("UPDATE Users SET skills = %s WHERE user_id = %s", (",".join(skill_names), user_id))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise


# SAVED JOBS

def save_job(user_id, job_id):
    sql = "INSERT IGNORE INTO Saved_Jobs (user_id, job_id) VALUES (%s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id, job_id))
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"save_job failed: {e}")
        return False


def remove_saved_job(user_id, job_id):
    sql = "DELETE FROM Saved_Jobs WHERE user_id = %s AND job_id = %s"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id, job_id))
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"remove_saved_job failed: {e}")
        return False


def get_saved_jobs(user_id):
    sql = """
        SELECT j.*, c.name AS company_name, c.website_url AS company_website, sj.saved_at
        FROM Saved_Jobs sj
        JOIN Jobs j ON sj.job_id = j.job_id
        JOIN Companies c ON j.company_id = c.company_id
        WHERE sj.user_id = %s
        ORDER BY sj.saved_at DESC
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(sql, (user_id,))
            return [with_salary(job) for job in cur.fetchall()]
    except Error as e:
        log.error(f"get_saved_jobs failed: {e}")
        return []


# SKILL GAP ANALYSIS

def get_skill_gap(user_id, job_id):
    """Use the same requirement groups and saved skills as job-card scores."""
    job = get_job_by_id(job_id)
    if not job:
        return {"matched": [], "missing": [], "preferred": [], "match_pct": None, "total_required": 0}
    comparison = add_resume_matches(user_id, [job])[0]
    groups = comparison['resume_requirement_groups']
    return {**comparison,
            'matched': [' / '.join(group['skills']) for group in groups if group['status'] == 'matched'],
            'missing': [' / '.join(group['skills']) for group in groups if group['status'] == 'missing'],
            'preferred': [skill['skill_name'] for skill in job.get('skills', []) if skill['requirement_type'] == 'preferred'],
            'match_pct': comparison['resume_match_pct'], 'total_required': comparison['resume_required_count']}


def get_student_skill_gap_summary(user_id, discipline=None, profile_override=None):
    """Get student skill gap summary."""
    user_skills = get_user_skills(user_id) if profile_override is None else profile_override
    if not user_skills and profile_override is None:
        user = get_user_by_id(user_id)
        if user and user.get("skills"):
            user_skills = [s.strip() for s in user["skills"].split(",")]

    user_set = {s.strip().lower() for s in user_skills}

    conditions = ["j.is_active = TRUE", "js.requirement_type = 'required'", "(j.date_posted IS NULL OR j.date_posted >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH))", "(j.closing_date IS NULL OR j.closing_date >= CURDATE())"]
    params = []
    if discipline in DISCIPLINE_PATTERNS:
        conditions.append("LOWER(j.title) REGEXP %s")
        params.append(DISCIPLINE_PATTERNS[discipline])
    sql = f"""
        SELECT s.skill_name, COUNT(*) AS demand_count
        FROM Job_Skills js
        JOIN Skills s ON js.skill_id = s.skill_id
        JOIN Jobs j ON js.job_id = j.job_id
        WHERE {' AND '.join(conditions)}
        GROUP BY s.skill_name
        ORDER BY demand_count DESC
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(sql, params)
            all_skills = cur.fetchall()

        excluded = DISCIPLINE_EXCLUDED_SKILLS.get(discipline, set())
        all_skills = [skill for skill in all_skills if skill["skill_name"].lower() not in excluded]

        missing_skills = [
            s for s in all_skills if s["skill_name"].lower() not in user_set
        ]
        matched_skills = [
            s for s in all_skills if s["skill_name"].lower() in user_set
        ]

        total_demand = sum(s["demand_count"] for s in all_skills)
        matched_demand = sum(s["demand_count"] for s in matched_skills)
        overall_pct = round((matched_demand / total_demand) * 100) if total_demand else 0

        return {
            "user_skills":     list(user_set),
            "missing_skills":  missing_skills[:10],
            "matched_skills":  matched_skills,
            "overall_match_pct": overall_pct,
            "requested_skill_count": len(all_skills),
            "matched_skill_count": len(matched_skills),
            "discipline": discipline or "all",
        }
    except Error as e:
        log.error(f"get_student_skill_gap_summary failed: {e}")
        return {}


def flag_resume_skills(user_id, skill_names):
    """Flag resume skills."""
    from resume_processing import normalize_skill
    newly_flagged = 0
    with get_connection() as conn:
        try:
            cur = conn.cursor()
            # Serialize uploads by this user, including concurrent duplicate scans.
            cur.execute("SELECT user_id FROM Users WHERE user_id = %s FOR UPDATE", (user_id,))
            if not cur.fetchone():
                raise ValueError("User not found")
            for name in sorted({normalize_skill(s) for s in skill_names}):
                cur.execute("""SELECT s.skill_id FROM User_Skills us
                    JOIN Skills s ON s.skill_id = us.skill_id
                    WHERE us.user_id = %s AND LOWER(TRIM(s.skill_name)) = %s""", (user_id, name))
                if cur.fetchone():
                    continue
                cur.execute("SELECT unmatched_id FROM Unmatched_Skills WHERE user_id = %s AND skill_name = %s AND status = 'pending'", (user_id, name))
                if cur.fetchone():
                    continue
                cur.execute("INSERT INTO Unmatched_Skills (user_id, skill_name) VALUES (%s, %s)", (user_id, name))
                newly_flagged += 1
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    return newly_flagged


def get_flagged_skills(user_id=None):
    """Return the pending review queue, optionally restricted to its owner."""
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        sql = """SELECT u.unmatched_id, u.skill_name, u.user_id, u.date_flagged,
                        u.status, p.name AS submitted_by
                 FROM Unmatched_Skills u JOIN Users p ON p.user_id = u.user_id
                 WHERE u.status = 'pending'"""
        args = ()
        if user_id is not None:
            sql += " AND u.user_id = %s"
            args = (user_id,)
        cur.execute(sql + " ORDER BY u.date_flagged, u.unmatched_id", args)
        return cur.fetchall()


def review_flagged_skill(flag_id, admin_id, approve):
    """Atomically review a pending flag; rejection never changes Skills."""
    with get_connection() as conn:
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Unmatched_Skills WHERE unmatched_id = %s FOR UPDATE", (flag_id,))
            flag = cur.fetchone()
            if not flag or flag['status'] != 'pending':
                conn.rollback()
                return False
            if approve:
                cur.execute("INSERT INTO Skills (skill_name, skill_type) VALUES (%s, 'technical') ON DUPLICATE KEY UPDATE skill_name = skill_name", (flag['skill_name'],))
            cur.execute("UPDATE Unmatched_Skills SET status = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP WHERE unmatched_id = %s",
                        ('approved' if approve else 'rejected', admin_id, flag_id))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise


def get_recommendations(user_id, discipline=None, limit=5):
    """Get recommendations."""
    focus_filter = ' AND LOWER(j.title) REGEXP %s' if discipline in DISCIPLINE_PATTERNS else ''
    args = (user_id, user_id, user_id, user_id, DISCIPLINE_PATTERNS[discipline]) if focus_filter else (user_id, user_id, user_id, user_id)
    limit_clause = " LIMIT %s" if limit is not None else ""
    if limit is not None:
        args = (*args, limit)
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute(f"""SELECT j.job_id, j.title, c.name AS company_name, c.website_url AS company_website, j.location,
                    j.source_url, j.date_posted, j.closing_date, j.is_active, j.salary_range,
                    COUNT(DISTINCT us.skill_id) AS matching_skills,
                    ROUND(100 * COUNT(DISTINCT us.skill_id) / COUNT(DISTINCT js.skill_id)) AS match_pct
                FROM Jobs j JOIN Companies c ON c.company_id = j.company_id
                JOIN Job_Skills js ON js.job_id = j.job_id AND js.requirement_type = 'required'
                LEFT JOIN User_Skills us ON us.skill_id = js.skill_id AND us.user_id = %s
                WHERE j.is_active = 1 AND (j.closing_date IS NULL OR j.closing_date >= CURDATE())
                  AND (j.date_posted IS NULL OR j.date_posted >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH))
                  AND NOT EXISTS (SELECT 1 FROM Saved_Jobs saved WHERE saved.job_id = j.job_id AND saved.user_id = %s)
                  AND NOT EXISTS (SELECT 1 FROM Hidden_Jobs hidden WHERE hidden.job_id = j.job_id AND hidden.user_id = %s)
                  AND NOT EXISTS (SELECT 1 FROM Application_Activity activity WHERE activity.job_id = j.job_id AND activity.user_id = %s){focus_filter}
                GROUP BY j.job_id, j.title, c.name, c.website_url, j.location
                HAVING matching_skills > 0
                ORDER BY match_pct DESC, matching_skills DESC, j.job_id DESC{limit_clause}""", args)
        return cur.fetchall()


def get_market_trends():
    """Get market trends."""
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute("""SELECT s.skill_name, t.snapshot_date, t.active_job_count, t.avg_salary
            FROM Skill_Trend_Snapshots t JOIN Skills s ON s.skill_id = t.skill_id
            WHERE t.snapshot_date >= CURRENT_DATE - INTERVAL 90 DAY
            ORDER BY t.snapshot_date DESC, t.active_job_count DESC LIMIT 1000""")
        return cur.fetchall()


def get_profile_details(user_id):
    """Read the authenticated user's optional profile fields."""
    import json
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT details FROM User_Profile_Details WHERE user_id = %s', (user_id,))
        row = cur.fetchone()
        return json.loads(row[0]) if row else {}


def save_profile_details(user_id, name, email, details):
    """Save profile details."""
    import json
    with get_connection() as conn:
        try:
            cur = conn.cursor()
            cur.execute('UPDATE Users SET name = %s, email = %s WHERE user_id = %s', (name, email, user_id))
            cur.execute('INSERT INTO User_Profile_Details (user_id, details) VALUES (%s, %s) ON DUPLICATE KEY UPDATE details = VALUES(details)', (user_id, json.dumps(details)))
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def get_application_activity(user_id):
    """List only application activity recorded by the user, newest first."""
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute('''SELECT a.job_id, a.status, a.updated_at, n.notes, n.interview_date, j.title, c.name AS company_name, c.website_url AS company_website
            FROM Application_Activity a LEFT JOIN Application_Notes n ON n.user_id = a.user_id AND n.job_id = a.job_id JOIN Jobs j ON j.job_id = a.job_id
            JOIN Companies c ON c.company_id = j.company_id WHERE a.user_id = %s
            ORDER BY a.updated_at DESC''', (user_id,))
        return cur.fetchall()


def set_application_activity(user_id, job_id, status):
    """Set application activity."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('''INSERT INTO Application_Activity (user_id, job_id, status) VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP''', (user_id, job_id, status))
        conn.commit()


def get_admin_overview():
    """Read real system counts, recent users and crawler outcomes for admins."""
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT COUNT(*) AS total_jobs FROM Jobs')
        counts = cur.fetchone()
        cur.execute('SELECT COUNT(*) AS registered_users FROM Users')
        counts.update(cur.fetchone())
        cur.execute('SELECT COUNT(*) AS crawler_runs FROM Job_Sync_Runs')
        counts.update(cur.fetchone())
        cur.execute('SELECT user_id, name, email, role, created_at FROM Users ORDER BY created_at DESC LIMIT 100')
        users = cur.fetchall()
        cur.execute('SELECT * FROM Job_Sync_Runs ORDER BY started_at DESC LIMIT 20')
        runs = cur.fetchall()
        return {'counts': counts, 'users': users, 'runs': runs, 'database': 'ok'}


def add_resume_skills_to_profile(user_id, flag_ids):
    """Add an owner-selected batch atomically without overwriting existing skills."""
    with get_connection() as conn:
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute('SELECT user_id FROM Users WHERE user_id=%s FOR UPDATE', (user_id,))
            if not cur.fetchone():
                return None
            placeholders = ','.join(['%s'] * len(flag_ids))
            cur.execute(f'SELECT * FROM Unmatched_Skills WHERE user_id=%s AND unmatched_id IN ({placeholders}) FOR UPDATE', [user_id, *flag_ids])
            flags = cur.fetchall()
            if len(flags) != len(flag_ids) or any(flag['status'] == 'rejected' for flag in flags):
                conn.rollback()
                return None
            for flag in flags:
                cur.execute("INSERT INTO Skills (skill_name, skill_type) VALUES (%s, 'technical') ON DUPLICATE KEY UPDATE skill_name=skill_name", (flag['skill_name'],))
                cur.execute('SELECT skill_id FROM Skills WHERE LOWER(TRIM(skill_name))=%s', (flag['skill_name'].strip().lower(),))
                cur.execute('INSERT IGNORE INTO User_Skills (user_id, skill_id) VALUES (%s,%s)', (user_id, cur.fetchone()['skill_id']))
                cur.execute("UPDATE Unmatched_Skills SET status='approved', reviewed_by=%s, reviewed_at=CURRENT_TIMESTAMP WHERE unmatched_id=%s", (user_id, flag['unmatched_id']))
            cur.execute('SELECT s.skill_name FROM User_Skills us JOIN Skills s ON s.skill_id=us.skill_id WHERE us.user_id=%s ORDER BY s.skill_name', (user_id,))
            names = [row['skill_name'] for row in cur.fetchall()]
            cur.execute('UPDATE Users SET skills=%s WHERE user_id=%s', (','.join(names), user_id))
            conn.commit()
            return [flag['skill_name'] for flag in flags]
        except Exception:
            conn.rollback()
            raise


def add_resume_skill_to_profile(user_id, flag_id):
    return add_resume_skills_to_profile(user_id, [flag_id]) is not None


def save_resume(user_id, filename, content, skills):
    import json
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('''INSERT INTO Saved_Resumes (user_id, filename, content, detected_skills)
            VALUES (%s, %s, %s, %s) ON DUPLICATE KEY UPDATE filename = VALUES(filename),
            content = VALUES(content), detected_skills = VALUES(detected_skills), updated_at = CURRENT_TIMESTAMP''',
            (user_id, filename, content, json.dumps(skills)))
        conn.commit()


def get_saved_resume(user_id, include_content=False):
    import json
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        columns = 'filename, detected_skills, updated_at, OCTET_LENGTH(content) AS size'
        if include_content:
            columns += ', content'
        cur.execute(f'SELECT {columns} FROM Saved_Resumes WHERE user_id = %s', (user_id,))
        row = cur.fetchone()
        if row:
            row['skills'] = json.loads(row.pop('detected_skills'))
        return row


def add_resume_matches(user_id, jobs, profile_override=None):
    """Compare required skills with saved resume skills, falling back to the profile."""
    if not jobs:
        return jobs
    if profile_override is not None:
        source, saved_skills = 'profile', profile_override
    else:
        resume = get_saved_resume(user_id)
        source = 'resume' if resume else 'profile'
        saved_skills = resume.get('skills', []) if resume else get_user_skills(user_id)
        if not resume and not saved_skills:
            user = get_user_by_id(user_id)
            saved_skills = (user.get('skills') or '').split(',') if user else []
    skills = {str(skill).strip().lower() for skill in saved_skills if str(skill).strip()}
    ids = list(dict.fromkeys(job['job_id'] for job in jobs))
    required = {job_id: set() for job_id in ids}
    html_by_job = {}
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        placeholders = ','.join(['%s'] * len(ids))
        cur.execute(f'''SELECT js.job_id, s.skill_name, j.description_html FROM Job_Skills js
            JOIN Skills s ON s.skill_id = js.skill_id
            JOIN Jobs j ON j.job_id=js.job_id
            WHERE js.requirement_type = 'required' AND js.job_id IN ({placeholders})''', ids)
        for row in cur.fetchall():
            required[row['job_id']].add(row['skill_name'].strip().lower())
            html_by_job[row['job_id']] = row.get('description_html')
    result = []
    for job in jobs:
        needed = required[job['job_id']]
        groups = [{skill} for skill in sorted(needed)]
        extraction_source = 'text_fallback'
        if html_by_job.get(job['job_id']):
            from nlp_tagger import analyze_job_skills
            analysis = analyze_job_skills('', html_by_job[job['job_id']])
            if analysis['source'] == 'qualification_html':
                extraction_source = analysis['source']
                # Do not include new HTML tags until a job has been retagged.
                candidates = [set(group) & needed for group in analysis['required_groups']]
                groups = [group for group in candidates if group]
                covered = set().union(*groups) if groups else set()
                groups += [{skill} for skill in sorted(needed - covered)]
        outcomes, matched_skills, partial_skills, missing_skills = [], set(), set(), set()
        for group in groups:
            hits = group & skills
            partial = not hits and 'sql server' in group and 'sql' in skills
            status = 'matched' if hits else 'partial' if partial else 'missing'
            outcomes.append({'skills': sorted(group), 'status': status})
            if hits:
                matched_skills.update(hits)
            elif partial:
                partial_skills.add('sql server')
            else:
                missing_skills.update(group)
        total = len(groups)
        matched = sum(outcome['status'] == 'matched' for outcome in outcomes)
        partial_count = sum(outcome['status'] == 'partial' for outcome in outcomes)
        credit = matched + 0.5 * partial_count
        result.append({**job, 'resume_match_pct': round(100 * credit / total) if total else None,
                       'resume_match_status': 'ready' if total else 'no_requirements',
                       'resume_match_source': source,
                       'resume_matched_count': matched, 'resume_required_count': total,
                       'resume_matched_skills': sorted(matched_skills),
                       'resume_partial_skills': sorted(partial_skills),
                       'resume_partial_count': partial_count, 'resume_partial_credit': 0.5,
                       'resume_missing_skills': sorted(missing_skills),
                       'resume_requirement_groups': outcomes, 'resume_extraction_source': extraction_source})
    return result


def create_support_request(user_id, subject, message):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('INSERT INTO Support_Requests (user_id, subject, message) VALUES (%s, %s, %s)', (user_id, subject, message))
        support_id = cur.lastrowid
        conn.commit()
        return support_id


def get_support_requests():
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT s.*, u.name, u.email FROM Support_Requests s JOIN Users u ON u.user_id = s.user_id ORDER BY s.created_at DESC LIMIT 200')
        return cur.fetchall()


def update_support_request(support_id, status):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT support_id FROM Support_Requests WHERE support_id = %s', (support_id,))
        if not cur.fetchone():
            return False
        cur.execute('UPDATE Support_Requests SET status = %s WHERE support_id = %s', (status, support_id))
        conn.commit()
        return True


def support_threads(user_id=None):
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        where = 'WHERE s.user_id = %s' if user_id is not None else ''
        cur.execute(f'SELECT s.*, u.name, u.email FROM Support_Requests s JOIN Users u ON u.user_id = s.user_id {where} ORDER BY s.created_at DESC LIMIT 200', (user_id,) if user_id is not None else ())
        rows = cur.fetchall()
        if not rows:
            return rows
        ids = [row['support_id'] for row in rows]
        placeholders = ','.join(['%s'] * len(ids))
        cur.execute(f'SELECT r.reply_id, r.support_id, r.message, r.created_at, u.name AS admin_name FROM Support_Replies r JOIN Users u ON u.user_id = r.admin_id WHERE r.support_id IN ({placeholders}) ORDER BY r.reply_id', tuple(ids))
        replies = cur.fetchall()
        for row in rows:
            row['replies'] = [reply for reply in replies if reply['support_id'] == row['support_id']]
        return rows


def reply_to_support(support_id, admin_id, message):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT support_id FROM Support_Requests WHERE support_id = %s', (support_id,))
        if not cur.fetchone():
            return False
        cur.execute('INSERT INTO Support_Replies (support_id, admin_id, message) VALUES (%s, %s, %s)', (support_id, admin_id, message))
        conn.commit()
        return True


def dismiss_resume_skill(user_id, flag_id):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE Unmatched_Skills SET status = 'rejected', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP WHERE unmatched_id = %s AND user_id = %s AND status = 'pending'", (user_id, flag_id, user_id))
        changed = cur.rowcount > 0
        conn.commit()
        return changed


def save_application_notes(user_id, job_id, notes, interview_date):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT 1 FROM Application_Activity WHERE user_id = %s AND job_id = %s', (user_id, job_id))
        if not cur.fetchone():
            return False
        cur.execute('INSERT INTO Application_Notes (user_id, job_id, notes, interview_date) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE notes=VALUES(notes), interview_date=VALUES(interview_date)', (user_id, job_id, notes, interview_date))
        conn.commit()
        return True


def set_hidden_job(user_id, job_id, hidden):
    with get_connection() as conn:
        cur = conn.cursor()
        if hidden:
            cur.execute('INSERT IGNORE INTO Hidden_Jobs (user_id, job_id) VALUES (%s,%s)', (user_id, job_id))
        else:
            cur.execute('DELETE FROM Hidden_Jobs WHERE user_id = %s AND job_id = %s', (user_id, job_id))
        conn.commit()


def restore_hidden_jobs(user_id):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute('DELETE FROM Hidden_Jobs WHERE user_id = %s', (user_id,))
        count = cur.rowcount
        conn.commit()
        return count


def restore_resume_skill(user_id, flag_id):
    """Undo this owner's dismissal; never undo an administrator's review."""
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT skill_name FROM Unmatched_Skills WHERE unmatched_id=%s AND user_id=%s AND status='rejected' AND reviewed_by=%s FOR UPDATE", (flag_id, user_id, user_id))
        flag = cur.fetchone()
        if not flag:
            conn.rollback()
            return False
        cur.execute("SELECT unmatched_id FROM Unmatched_Skills WHERE user_id=%s AND LOWER(skill_name)=LOWER(%s) AND status='pending'", (user_id, flag['skill_name']))
        if not cur.fetchone():
            cur.execute("UPDATE Unmatched_Skills SET status='pending', reviewed_by=NULL, reviewed_at=NULL WHERE unmatched_id=%s", (flag_id,))
        conn.commit()
        return True


def flagged_skill_impact(user_id, flag_ids=None, discipline=None):
    """Estimate profile-only matches across fresh active jobs using card scoring."""
    flags = get_flagged_skills(user_id)
    wanted = set(flag_ids) if flag_ids is not None else {flag['unmatched_id'] for flag in flags}
    chosen = [flag for flag in flags if flag['unmatched_id'] in wanted]
    profile = get_user_skills(user_id)
    if not profile:
        user = get_user_by_id(user_id)
        profile = (user.get('skills') or '').split(',') if user else []
    focus = ' AND LOWER(title) REGEXP %s' if discipline in DISCIPLINE_PATTERNS else ''
    with get_connection() as conn:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT job_id FROM Jobs WHERE is_active=1 AND (closing_date IS NULL OR closing_date>=CURDATE()) AND (date_posted IS NULL OR date_posted>=DATE_SUB(CURDATE(), INTERVAL 6 MONTH))" + focus, (DISCIPLINE_PATTERNS[discipline],) if focus else ())
        jobs = cur.fetchall()
    before = add_resume_matches(user_id, jobs, profile_override=profile)
    after = add_resume_matches(user_id, jobs, profile_override=[*profile, *(flag['skill_name'] for flag in chosen)])
    valid_before = [job for job in before if job['resume_required_count']]
    valid_after = [job for job in after if job['resume_required_count']]
    counts = {}
    for flag in flags:
        name = flag['skill_name'].strip().lower()
        counts[str(flag['unmatched_id'])] = sum(any(name in group['skills'] for group in job['resume_requirement_groups']) for job in valid_before)
    market_before = get_student_skill_gap_summary(user_id, discipline, profile_override=profile)
    market_after = get_student_skill_gap_summary(user_id, discipline, profile_override=[*profile, *(flag['skill_name'] for flag in chosen)])
    return {'current_market_match': market_before.get('overall_match_pct'),
            'projected_market_match': market_after.get('overall_match_pct'),
            'job_count': len(valid_before),
            'current_average': round(sum(job['resume_match_pct'] for job in valid_before) / len(valid_before), 1) if valid_before else None,
            'projected_average': round(sum(job['resume_match_pct'] for job in valid_after) / len(valid_after), 1) if valid_after else None,
            'skill_job_counts': counts, 'has_saved_resume': bool(get_saved_resume(user_id)), 'selected_count': len(chosen)}
