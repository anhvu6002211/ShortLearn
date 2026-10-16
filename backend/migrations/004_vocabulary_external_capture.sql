-- Preserve vocabulary provenance when no platform video exists.
-- Safe to run repeatedly on MySQL 5.7+ and MySQL 8.x.
DELIMITER //
DROP PROCEDURE IF EXISTS migrate_vocabulary_external_capture//
CREATE PROCEDURE migrate_vocabulary_external_capture()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_vocabulary'
      AND column_name = 'source_platform'
  ) THEN
    ALTER TABLE user_vocabulary
      ADD COLUMN source_platform ENUM('youtube', 'tiktok', 'external_capture')
      NOT NULL DEFAULT 'youtube' AFTER timestamp_mark;
  END IF;
END//
CALL migrate_vocabulary_external_capture()//
DROP PROCEDURE migrate_vocabulary_external_capture//
DELIMITER ;
