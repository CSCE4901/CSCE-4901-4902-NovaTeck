CREATE TABLE IF NOT EXISTS Support_Replies (
    reply_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    support_id INT NOT NULL,
    admin_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (support_id) REFERENCES Support_Requests(support_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
