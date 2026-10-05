-- Adds Language Reactor-style learning stages and optional colour labels.
-- Safe to run repeatedly on MySQL 5.7+ and MySQL 8.x.

DELIMITER //

DROP PROCEDURE IF EXISTS migrate_vocabulary_learning_metadata//
CREATE PROCEDURE migrate_vocabulary_learning_metadata()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_vocabulary'
      AND column_name = 'learning_stage'
  ) THEN
    ALTER TABLE user_vocabulary
      ADD COLUMN learning_stage ENUM('known', 'learning', 'later')
      NOT NULL DEFAULT 'learning'
      AFTER state;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_vocabulary'
      AND column_name = 'card_label'
  ) THEN
    ALTER TABLE user_vocabulary
      ADD COLUMN card_label ENUM('red', 'green', 'yellow', 'blue')
      NULL DEFAULT NULL
      AFTER learning_stage;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'user_vocabulary'
      AND index_name = 'idx_user_learning_stage'
  ) THEN
    CREATE INDEX idx_user_learning_stage
      ON user_vocabulary (user_id, learning_stage);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'user_vocabulary'
      AND index_name = 'idx_user_card_label'
  ) THEN
    CREATE INDEX idx_user_card_label
      ON user_vocabulary (user_id, card_label);
  END IF;
END//

CALL migrate_vocabulary_learning_metadata()//
DROP PROCEDURE migrate_vocabulary_learning_metadata//

DELIMITER ;
