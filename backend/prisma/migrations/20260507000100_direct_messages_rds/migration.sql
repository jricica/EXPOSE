-- Direct conversations in RDS (MySQL)
CREATE TABLE IF NOT EXISTS `direct_conversations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_a_id` INT NOT NULL,
  `user_b_id` INT NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_direct_pair` (`user_a_id`, `user_b_id`),
  KEY `idx_direct_conversations_user_a` (`user_a_id`),
  KEY `idx_direct_conversations_user_b` (`user_b_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `direct_messages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT NOT NULL,
  `sender_id` INT NOT NULL,
  `receiver_id` INT NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NULL,
  `edited_at` DATETIME(0) NULL,
  `deleted_at` DATETIME(0) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_direct_messages_conversation_created` (`conversation_id`, `created_at`),
  KEY `idx_direct_messages_sender_created` (`sender_id`, `created_at`),
  KEY `idx_direct_messages_receiver_created` (`receiver_id`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys (idempotent style)
SET @fk_dc_user_a_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'direct_conversations'
    AND COLUMN_NAME = 'user_a_id'
    AND REFERENCED_TABLE_NAME = 'users'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @fk_dc_user_a_stmt := IF(
  @fk_dc_user_a_exists = 0,
  'ALTER TABLE `direct_conversations` ADD CONSTRAINT `fk_direct_conversations_user_a` FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_dc_user_a_stmt FROM @fk_dc_user_a_stmt;
EXECUTE fk_dc_user_a_stmt;
DEALLOCATE PREPARE fk_dc_user_a_stmt;

SET @fk_dc_user_b_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'direct_conversations'
    AND COLUMN_NAME = 'user_b_id'
    AND REFERENCED_TABLE_NAME = 'users'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @fk_dc_user_b_stmt := IF(
  @fk_dc_user_b_exists = 0,
  'ALTER TABLE `direct_conversations` ADD CONSTRAINT `fk_direct_conversations_user_b` FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_dc_user_b_stmt FROM @fk_dc_user_b_stmt;
EXECUTE fk_dc_user_b_stmt;
DEALLOCATE PREPARE fk_dc_user_b_stmt;

SET @fk_dm_conv_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'direct_messages'
    AND COLUMN_NAME = 'conversation_id'
    AND REFERENCED_TABLE_NAME = 'direct_conversations'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @fk_dm_conv_stmt := IF(
  @fk_dm_conv_exists = 0,
  'ALTER TABLE `direct_messages` ADD CONSTRAINT `fk_direct_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_dm_conv_stmt FROM @fk_dm_conv_stmt;
EXECUTE fk_dm_conv_stmt;
DEALLOCATE PREPARE fk_dm_conv_stmt;

SET @fk_dm_sender_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'direct_messages'
    AND COLUMN_NAME = 'sender_id'
    AND REFERENCED_TABLE_NAME = 'users'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @fk_dm_sender_stmt := IF(
  @fk_dm_sender_exists = 0,
  'ALTER TABLE `direct_messages` ADD CONSTRAINT `fk_direct_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_dm_sender_stmt FROM @fk_dm_sender_stmt;
EXECUTE fk_dm_sender_stmt;
DEALLOCATE PREPARE fk_dm_sender_stmt;

SET @fk_dm_receiver_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'direct_messages'
    AND COLUMN_NAME = 'receiver_id'
    AND REFERENCED_TABLE_NAME = 'users'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @fk_dm_receiver_stmt := IF(
  @fk_dm_receiver_exists = 0,
  'ALTER TABLE `direct_messages` ADD CONSTRAINT `fk_direct_messages_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_dm_receiver_stmt FROM @fk_dm_receiver_stmt;
EXECUTE fk_dm_receiver_stmt;
DEALLOCATE PREPARE fk_dm_receiver_stmt;
