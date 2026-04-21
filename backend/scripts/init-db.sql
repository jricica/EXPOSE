-- EXPOSE Database Initialization Script
-- This script sets up the initial database schema for local development

-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS expose;
USE expose;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bio TEXT NULL,
    display_name VARCHAR(100) NULL,
    avatar_url TEXT NULL,
    INDEX idx_users_email (email),
    INDEX idx_users_username (username),
    INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    likes INT NOT NULL DEFAULT 0,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_posts_user_id (user_id),
    INDEX idx_posts_created_at (created_at),
    INDEX idx_posts_created_at_id (created_at, id),
    INDEX idx_posts_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (post_id, user_id),
    INDEX idx_post_likes_user_id (user_id),
    INDEX idx_post_likes_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Followers table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS followers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_follow (follower_id, following_id),
    INDEX idx_followers_follower_id (follower_id),
    INDEX idx_followers_following_id (following_id),
    INDEX idx_followers_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for development
INSERT IGNORE INTO users (id, username, email, password_hash, bio, display_name) VALUES
(1, 'johndoe', 'john@example.com', '$2b$10$dummy.hash.for.development', 'Hello, I am John!', 'John Doe'),
(2, 'janedoe', 'jane@example.com', '$2b$10$dummy.hash.for.development', 'Jane here, loving life!', 'Jane Doe'),
(3, 'testuser', 'test@example.com', '$2b$10$dummy.hash.for.development', 'Just testing things out', 'Test User');

INSERT IGNORE INTO posts (id, user_id, content, expires_at) VALUES
(1, 1, 'Hello world! This is my first post on EXPOSE. 🌍 #firstpost', DATE_ADD(NOW(), INTERVAL 24 HOUR)),
(2, 2, 'Beautiful sunset today! 📸 #sunset #photography', DATE_ADD(NOW(), INTERVAL 24 HOUR)),
(3, 1, 'Working on something exciting... stay tuned! 🚀', DATE_ADD(NOW(), INTERVAL 24 HOUR)),
(4, 3, 'Testing the platform. Everything looks great! 👍', DATE_ADD(NOW(), INTERVAL 24 HOUR));

INSERT IGNORE INTO followers (follower_id, following_id) VALUES
(1, 2),
(1, 3),
(2, 1),
(3, 1),
(3, 2);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));

-- Add some useful views for analytics
CREATE OR REPLACE VIEW user_stats AS
SELECT
    u.id,
    u.username,
    u.display_name,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT pl.id) as total_likes_given,
    COUNT(DISTINCT liked_posts.id) as total_likes_received,
    COUNT(DISTINCT f1.id) as followers_count,
    COUNT(DISTINCT f2.id) as following_count,
    u.created_at as joined_at
FROM users u
LEFT JOIN posts p ON u.id = p.user_id AND p.is_deleted = 0
LEFT JOIN post_likes pl ON u.id = pl.user_id
LEFT JOIN post_likes liked_posts ON u.id = liked_posts.post_id
LEFT JOIN followers f1 ON u.id = f1.following_id
LEFT JOIN followers f2 ON u.id = f2.follower_id
GROUP BY u.id, u.username, u.display_name, u.created_at;

-- Grant permissions for the application user (if using MySQL)
-- GRANT ALL PRIVILEGES ON expose.* TO 'expose_user'@'%';
-- FLUSH PRIVILEGES;