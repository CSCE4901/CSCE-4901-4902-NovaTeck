#!/usr/bin/env python3
"""Migrate."""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

import db

MIGRATIONS = Path(__file__).resolve().parents[1] / "database" / "migrations"


def statements(sql: str):
    """Split this project's semicolon-terminated migration statements."""
    cleaned = "\n".join(line for line in sql.splitlines() if not line.strip().startswith("--"))
    return [part.strip() for part in cleaned.split(";") if part.strip()]


def main():
    with db.get_connection() as conn:
        cur = conn.cursor()
        for file in sorted(MIGRATIONS.glob("*.sql")):
            for statement in statements(file.read_text(encoding="utf-8")):
                # Check the column before adding it.
                if statement.upper().startswith("ALTER TABLE USERS ADD COLUMN ROLE"):
                    cur.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'role'")
                    if not cur.fetchone():
                        cur.execute(statement)
                    continue
                if statement.upper().startswith("ALTER TABLE JOBS ADD COLUMN EXPERIENCE_LEVEL"):
                    cur.execute("""SELECT COLUMN_NAME FROM information_schema.COLUMNS
                                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Jobs'
                                     AND COLUMN_NAME = 'experience_level'""")
                    if not cur.fetchone():
                        cur.execute("ALTER TABLE Jobs ADD COLUMN experience_level VARCHAR(50) NULL AFTER salary_range")
                    continue
                if statement.upper().startswith("ALTER TABLE USERS ADD COLUMN RESUME_FILENAME"):
                    cur.execute("""SELECT COLUMN_NAME FROM information_schema.COLUMNS
                                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users'
                                     AND COLUMN_NAME = 'resume_filename'""")
                    if not cur.fetchone():
                        cur.execute("ALTER TABLE Users ADD COLUMN resume_filename VARCHAR(255) NULL AFTER resume_url")
                    continue
                if statement.upper().startswith("ALTER TABLE JOBS ADD COLUMN SOURCE_HTTP_STATUS"):
                    cur.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Jobs' AND COLUMN_NAME = 'source_http_status'")
                    if not cur.fetchone():
                        cur.execute(statement)
                    continue
                if statement.upper().startswith("ALTER TABLE JOBS"):
                    cur.execute("""SELECT COLUMN_NAME FROM information_schema.COLUMNS
                                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Jobs'""")
                    columns = {row[0] for row in cur.fetchall()}
                    additions = []
                    if "source_provider" not in columns:
                        additions.append("ADD COLUMN source_provider VARCHAR(50) NULL AFTER date_crawled")
                    if "last_seen_at" not in columns:
                        additions.append("ADD COLUMN last_seen_at DATETIME NULL AFTER source_provider")
                    if additions:
                        cur.execute("ALTER TABLE Jobs " + ", ".join(additions))
                    continue
                cur.execute(statement)
            conn.commit()
            print(f"Applied {file.name}")


if __name__ == "__main__":
    main()
