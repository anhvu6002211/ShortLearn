-- Authentication foundation for existing ShortLearn databases.
-- Idempotent on MySQL 8.x. Raw passwords, refresh tokens and OTP codes are
-- deliberately excluded: only adaptive password hashes and token/code digests
-- belong in the database.

DELIMITER //

DROP PROCEDURE IF EXISTS migrate_auth_user_columns//
CREATE PROCEDURE migrate_auth_user_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'public_id'
  ) THEN
    ALTER TABLE users
      ADD COLUMN public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id;
  END IF;

  UPDATE users SET public_id = UUID() WHERE public_id IS NULL OR public_id = '';
  ALTER TABLE users
    MODIFY COLUMN public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'uq_users_public_id'
  ) THEN
    CREATE UNIQUE INDEX uq_users_public_id ON users (public_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_normalized'
  ) THEN
    ALTER TABLE users
      ADD COLUMN email_normalized VARCHAR(255)
      GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED AFTER email;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'uq_users_email_normalized'
  ) THEN
    CREATE UNIQUE INDEX uq_users_email_normalized ON users (email_normalized);
  END IF;

  -- Password is nullable for accounts that only use a trusted OAuth identity.
  ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users ADD COLUMN display_name VARCHAR(100) NULL AFTER password_hash;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url VARCHAR(2048) NULL AFTER display_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users
      ADD COLUMN status ENUM('active', 'pending_verification', 'disabled', 'deleted')
      NOT NULL DEFAULT 'active' AFTER avatar_url;
  END IF;

  -- New registrations default to pending; rows migrated above retain 'active'.
  ALTER TABLE users
    MODIFY COLUMN status ENUM('active', 'pending_verification', 'disabled', 'deleted')
    NOT NULL DEFAULT 'pending_verification';

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_verified_at'
  ) THEN
    ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL AFTER status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'password_changed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL AFTER email_verified_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE users
      ADD COLUMN failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER password_changed_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL DEFAULT NULL AFTER failed_login_attempts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL AFTER locked_until;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER last_login_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER current_level;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_status'
  ) THEN
    CREATE INDEX idx_users_status ON users (status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_locked_until'
  ) THEN
    CREATE INDEX idx_users_locked_until ON users (locked_until);
  END IF;
END//

CALL migrate_auth_user_columns()//
DROP PROCEDURE migrate_auth_user_columns//

DELIMITER ;

CREATE TABLE IF NOT EXISTS user_auth_identities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  provider VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider_subject VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  provider_email VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_identity_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_auth_identity_provider_subject (provider, provider_subject),
  INDEX idx_auth_identity_user (user_id),
  INDEX idx_auth_identity_provider_email (provider, provider_email)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id INT NOT NULL,
  device_platform ENUM('android', 'ios', 'web', 'unknown') NOT NULL DEFAULT 'unknown',
  device_name VARCHAR(120) NULL,
  app_version VARCHAR(32) NULL,
  ip_address VARBINARY(16) NULL,
  user_agent VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  revoke_reason VARCHAR(64) NULL,
  CONSTRAINT fk_auth_session_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_auth_sessions_key (session_key),
  INDEX idx_auth_sessions_user_active (user_id, revoked_at, expires_at),
  INDEX idx_auth_sessions_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  family_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash BINARY(32) NOT NULL,
  parent_token_id BIGINT UNSIGNED NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  revoke_reason VARCHAR(64) NULL,
  CONSTRAINT fk_refresh_token_session
    FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_token_parent
    FOREIGN KEY (parent_token_id) REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
  UNIQUE KEY uq_auth_refresh_token_hash (token_hash),
  INDEX idx_auth_refresh_session_active (session_id, revoked_at, expires_at),
  INDEX idx_auth_refresh_family (family_key, issued_at),
  INDEX idx_auth_refresh_parent (parent_token_id)
);

CREATE TABLE IF NOT EXISTS auth_one_time_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  challenge_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id INT NULL,
  email_normalized VARCHAR(255) NOT NULL,
  purpose ENUM('verify_email', 'login', 'password_reset') NOT NULL,
  code_hash BINARY(32) NOT NULL,
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  requested_ip VARBINARY(16) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL DEFAULT NULL,
  invalidated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_auth_otp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_auth_otp_challenge (challenge_key),
  INDEX idx_auth_otp_lookup (email_normalized, purpose, expires_at),
  INDEX idx_auth_otp_user (user_id),
  INDEX idx_auth_otp_cleanup (expires_at, consumed_at, invalidated_at)
);
