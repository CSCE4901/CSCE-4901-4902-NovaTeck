-- NovaTeck DFW Tech Job Tracker — MySQL Database Schema
-- Version: 2.0 (Sprint 3 MVP)
-- Developer: Shubekshya Acharya
-- Sprint 3 — April 2026

CREATE DATABASE IF NOT EXISTS novatek_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE novatek_db;

-- TABLE 1: Companies
CREATE TABLE Companies (
    company_id   INT           NOT NULL AUTO_INCREMENT,
    name         VARCHAR(255)  NOT NULL,
    website_url  VARCHAR(500),
    location     VARCHAR(255),
    industry     VARCHAR(100),
    date_added   DATETIME      DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id),
    UNIQUE KEY uq_company_name (name)
) ENGINE=InnoDB;

-- TABLE 2: Jobs
CREATE TABLE Jobs (
    job_id        INT           NOT NULL AUTO_INCREMENT,
    company_id    INT           NOT NULL,
    title         VARCHAR(255)  NOT NULL,
    description   TEXT,
    location      VARCHAR(255),
    job_type      VARCHAR(100),
    salary_range  VARCHAR(100),
    experience_level VARCHAR(50),
    source_url    VARCHAR(1000) NOT NULL,
    date_posted   DATE,
    date_crawled  DATETIME      DEFAULT CURRENT_TIMESTAMP,
    source_provider VARCHAR(50),
    last_seen_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
    is_active     BOOLEAN       DEFAULT TRUE,
    PRIMARY KEY (job_id),
    UNIQUE KEY uq_source_url (source_url(500)),
    CONSTRAINT fk_jobs_company
        FOREIGN KEY (company_id) REFERENCES Companies(company_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Auditable history of scheduled job ingestion runs.
CREATE TABLE Job_Sync_Runs (
    sync_run_id    INT           NOT NULL AUTO_INCREMENT,
    provider       VARCHAR(50)   NOT NULL,
    location       VARCHAR(255)  NOT NULL,
    query          VARCHAR(255),
    status         VARCHAR(20)   NOT NULL,
    fetched_count  INT           NOT NULL DEFAULT 0,
    upserted_count INT           NOT NULL DEFAULT 0,
    error_count    INT           NOT NULL DEFAULT 0,
    error_message  TEXT,
    started_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at    DATETIME,
    PRIMARY KEY (sync_run_id),
    INDEX idx_sync_runs_started (started_at)
) ENGINE=InnoDB;

-- TABLE 3: Skills
CREATE TABLE Skills (
    skill_id    INT          NOT NULL AUTO_INCREMENT,
    skill_name  VARCHAR(100) NOT NULL,
    skill_type  VARCHAR(100),
    PRIMARY KEY (skill_id),
    UNIQUE KEY uq_skill_name (skill_name)
) ENGINE=InnoDB;

-- TABLE 4: Job_Skills  (junction table)
CREATE TABLE Job_Skills (
    job_id            INT         NOT NULL,
    skill_id          INT         NOT NULL,
    requirement_type  VARCHAR(50) DEFAULT 'required',
    PRIMARY KEY (job_id, skill_id),
    CONSTRAINT fk_jobskills_job
        FOREIGN KEY (job_id) REFERENCES Jobs(job_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_jobskills_skill
        FOREIGN KEY (skill_id) REFERENCES Skills(skill_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_req_type
        CHECK (requirement_type IN ('required', 'preferred'))
) ENGINE=InnoDB;

-- TABLE 5: Job_Snapshots
CREATE TABLE Job_Snapshots (
    snapshot_id    INT          NOT NULL AUTO_INCREMENT,
    job_id         INT          NOT NULL,
    snapshot_date  DATE         NOT NULL,
    title          VARCHAR(255),
    salary_range   VARCHAR(100),
    is_active      BOOLEAN      DEFAULT TRUE,
    PRIMARY KEY (snapshot_id),
    CONSTRAINT fk_snapshots_job
        FOREIGN KEY (job_id) REFERENCES Jobs(job_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Daily, skill-level market aggregates used by trend reporting.
CREATE TABLE Skill_Trend_Snapshots (
    snapshot_date DATE NOT NULL,
    skill_id INT NOT NULL,
    active_job_count INT NOT NULL,
    avg_salary DECIMAL(12,2) NULL,
    PRIMARY KEY (snapshot_date, skill_id),
    CONSTRAINT fk_trend_skill FOREIGN KEY (skill_id) REFERENCES Skills(skill_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- TABLE 6: Users  (Students)
CREATE TABLE Users (
    user_id        INT           NOT NULL AUTO_INCREMENT,
    name           VARCHAR(255)  NOT NULL,
    email          VARCHAR(255)  NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    resume_url     VARCHAR(500),
    resume_filename VARCHAR(255),
    skills         TEXT,
    created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB;

CREATE TABLE HR_Contacts (
    contact_id INT NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    PRIMARY KEY (contact_id),
    CONSTRAINT fk_contacts_company FOREIGN KEY (company_id) REFERENCES Companies(company_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Password_Reset_Tokens (
    reset_id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    PRIMARY KEY (reset_id),
    UNIQUE KEY uq_reset_token_hash (token_hash),
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- TABLE 7: Saved_Jobs
CREATE TABLE Saved_Jobs (
    user_id   INT      NOT NULL,
    job_id    INT      NOT NULL,
    saved_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, job_id),
    CONSTRAINT fk_savedjobs_user
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_savedjobs_job
        FOREIGN KEY (job_id) REFERENCES Jobs(job_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- TABLE 8: User_Skills  (junction — for skill gap analysis)
CREATE TABLE User_Skills (
    user_id   INT NOT NULL,
    skill_id  INT NOT NULL,
    PRIMARY KEY (user_id, skill_id),
    CONSTRAINT fk_userskills_user
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_userskills_skill
        FOREIGN KEY (skill_id) REFERENCES Skills(skill_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- INDEXES
CREATE INDEX idx_jobs_company      ON Jobs(company_id);
CREATE INDEX idx_jobs_is_active    ON Jobs(is_active);
CREATE INDEX idx_jobs_date_posted  ON Jobs(date_posted);
CREATE INDEX idx_snapshots_job     ON Job_Snapshots(job_id);
CREATE INDEX idx_snapshots_date    ON Job_Snapshots(snapshot_date);
CREATE INDEX idx_jobskills_skill   ON Job_Skills(skill_id);
CREATE INDEX idx_savedjobs_user    ON Saved_Jobs(user_id);
CREATE INDEX idx_userskills_user   ON User_Skills(user_id);

CREATE OR REPLACE VIEW v_skill_trends AS
SELECT sts.snapshot_date, s.skill_id, s.skill_name, sts.active_job_count, sts.avg_salary
FROM Skill_Trend_Snapshots sts JOIN Skills s ON s.skill_id = sts.skill_id;

-- SEED DATA

INSERT INTO Companies (name, website_url, location, industry) VALUES
('Texas Instruments', 'https://careers.ti.com',   'Dallas, TX',   'Semiconductor'),
('AT&T',             'https://www.att.jobs',       'Dallas, TX',   'Telecommunications'),
('Raytheon',         'https://careers.rtx.com',    'McKinney, TX', 'Defense & Aerospace');

INSERT INTO Skills (skill_name, skill_type) VALUES
('Python',           'technical'),
('SQL',              'technical'),
('React',            'technical'),
('Machine Learning', 'technical'),
('AWS',              'technical'),
('Java',             'technical'),
('Docker',           'technical'),
('Communication',    'soft'),
('JavaScript',       'technical'),
('Node.js',          'technical'),
('MySQL',            'technical'),
('Linux',            'technical'),
('Git',              'technical'),
('Flask',            'technical'),
('C++',              'technical');

ALTER TABLE Users ADD COLUMN role ENUM('student', 'admin') NOT NULL DEFAULT 'student';
CREATE TABLE IF NOT EXISTS Unmatched_Skills (
    unmatched_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    date_flagged DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    pending_key VARCHAR(100) GENERATED ALWAYS AS
        (CASE WHEN status = 'pending' THEN skill_name ELSE NULL END) STORED,
    UNIQUE KEY uq_pending_user_skill (user_id, pending_key),
    INDEX idx_unmatched_status (status, date_flagged),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES Users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS User_Profile_Details (
    user_id INT NOT NULL PRIMARY KEY,
    details JSON NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS Application_Activity (
    user_id INT NOT NULL,
    job_id INT NOT NULL,
    status ENUM('Opened employer site','Applied','Interviewing','Offer','Closed') NOT NULL DEFAULT 'Opened employer site',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, job_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES Jobs(job_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS Saved_Resumes (
    user_id INT NOT NULL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    content MEDIUMBLOB NOT NULL,
    detected_skills JSON NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
