-- CreateTable
CREATE TABLE IF NOT EXISTS `followers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `follower_id` INTEGER NOT NULL,
    `following_id` INTEGER NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `unique_follow`(`follower_id`, `following_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ensure follower_id foreign key exists
SET @unique_follow_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'followers'
    AND INDEX_NAME = 'unique_follow'
);
SET @unique_follow_stmt := IF(
  @unique_follow_exists = 0,
  'CREATE UNIQUE INDEX `unique_follow` ON `followers`(`follower_id`, `following_id`)',
  'SELECT 1'
);
PREPARE unique_follow_stmt FROM @unique_follow_stmt;
EXECUTE unique_follow_stmt;
DEALLOCATE PREPARE unique_follow_stmt;

-- Ensure follower_id foreign key exists
SET @fk_follower_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'followers'
    AND COLUMN_NAME = 'follower_id'
    AND REFERENCED_TABLE_NAME = 'users'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @fk_follower_stmt := IF(
  @fk_follower_exists = 0,
  'ALTER TABLE `followers` ADD CONSTRAINT `followers_follower_id_fkey` FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_follower_stmt FROM @fk_follower_stmt;
EXECUTE fk_follower_stmt;
DEALLOCATE PREPARE fk_follower_stmt;

-- Ensure following_id foreign key exists
SET @fk_following_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'followers'
    AND COLUMN_NAME = 'following_id'
    AND REFERENCED_TABLE_NAME = 'users'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @fk_following_stmt := IF(
  @fk_following_exists = 0,
  'ALTER TABLE `followers` ADD CONSTRAINT `followers_following_id_fkey` FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_following_stmt FROM @fk_following_stmt;
EXECUTE fk_following_stmt;
DEALLOCATE PREPARE fk_following_stmt;

-- Ensure legacy supporting index exists for post pagination
SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND INDEX_NAME = 'idx_posts_createdAt_id'
);
SET @create_idx_stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_posts_createdAt_id` ON `posts`(`createdAt`, `id`)',
  'SELECT 1'
);
PREPARE idx_stmt FROM @create_idx_stmt;
EXECUTE idx_stmt;
DEALLOCATE PREPARE idx_stmt;
