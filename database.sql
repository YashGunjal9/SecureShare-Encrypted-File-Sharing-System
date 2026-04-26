CREATE DATABASE IF NOT EXISTS secure_file_share
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE secure_file_share;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS shared_links;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE files (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) DEFAULT NULL,
    size BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_files_user_id (user_id),
    CONSTRAINT fk_files_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE shared_links (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id INT UNSIGNED NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expiry_date DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shared_links_token (token),
    UNIQUE KEY uniq_shared_links_file_id (file_id),
    CONSTRAINT fk_shared_links_file
        FOREIGN KEY (file_id) REFERENCES files(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    file_id INT UNSIGNED DEFAULT NULL,
    action VARCHAR(60) NOT NULL,
    details VARCHAR(255) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_activity_user_id (user_id),
    INDEX idx_activity_file_id (file_id),
    INDEX idx_activity_created_at (created_at),
    CONSTRAINT fk_activity_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_activity_file
        FOREIGN KEY (file_id) REFERENCES files(id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- Default admin login:
-- Email: admin@secureshare.local
-- Password: Admin@12345
-- Change this password after the first login.
INSERT INTO users (name, email, password, role)
VALUES (
    'System Admin',
    'admin@secureshare.local',
    '$2y$10$4vA52gsbvy4rJlmsNRObbOPujZrMmnCecs8sEzs5NSbn2Tbaj8NEm',
    'admin'
);
