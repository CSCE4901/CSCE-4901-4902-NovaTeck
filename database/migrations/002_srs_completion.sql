-- Apply after 001_live_job_sync.sql on existing NovaTeck databases.
ALTER TABLE Jobs ADD COLUMN experience_level VARCHAR(50) NULL AFTER salary_range;
ALTER TABLE Users ADD COLUMN resume_filename VARCHAR(255) NULL AFTER resume_url;

CREATE TABLE IF NOT EXISTS HR_Contacts (
  contact_id INT NOT NULL AUTO_INCREMENT, company_id INT NOT NULL, name VARCHAR(255) NOT NULL,
  email VARCHAR(255), phone VARCHAR(50), PRIMARY KEY (contact_id),
  CONSTRAINT fk_contacts_company FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS Password_Reset_Tokens (
  reset_id INT NOT NULL AUTO_INCREMENT, user_id INT NOT NULL, token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL, used_at DATETIME NULL, PRIMARY KEY (reset_id),
  UNIQUE KEY uq_reset_token_hash (token_hash),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS Skill_Trend_Snapshots (
  snapshot_date DATE NOT NULL, skill_id INT NOT NULL, active_job_count INT NOT NULL,
  avg_salary DECIMAL(12,2) NULL, PRIMARY KEY (snapshot_date, skill_id),
  CONSTRAINT fk_trend_skill FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE OR REPLACE VIEW v_skill_trends AS
SELECT sts.snapshot_date, s.skill_id, s.skill_name, sts.active_job_count, sts.avg_salary
FROM Skill_Trend_Snapshots sts JOIN Skills s ON s.skill_id = sts.skill_id;
