CREATE TABLE IF NOT EXISTS Application_Notes (
 user_id INT NOT NULL,
 job_id INT NOT NULL,
 notes TEXT NOT NULL,
 interview_date DATE NULL,
 PRIMARY KEY (user_id, job_id),
 FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
 FOREIGN KEY (job_id) REFERENCES Jobs(job_id) ON DELETE CASCADE
) ENGINE=InnoDB;
