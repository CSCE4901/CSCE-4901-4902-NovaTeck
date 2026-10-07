CREATE TABLE IF NOT EXISTS Job_Reminder_Dates (
 user_id INT NOT NULL,
 job_id INT NOT NULL,
 deadline DATE NULL,
 follow_up DATE NULL,
 PRIMARY KEY(user_id,job_id),
 FOREIGN KEY(user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
 FOREIGN KEY(job_id) REFERENCES Jobs(job_id) ON DELETE CASCADE
);
