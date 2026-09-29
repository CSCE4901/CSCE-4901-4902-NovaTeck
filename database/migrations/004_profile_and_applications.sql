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
