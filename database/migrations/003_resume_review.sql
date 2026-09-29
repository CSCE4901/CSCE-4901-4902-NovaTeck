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
