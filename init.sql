-- Khởi tạo Database cho ShortLearn
CREATE DATABASE IF NOT EXISTS shortlearn_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shortlearn_db;

-- 1. Bảng người dùng
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_normalized VARCHAR(255)
      GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
    password_hash VARCHAR(255) NULL,
    display_name VARCHAR(100) NULL,
    avatar_url VARCHAR(2048) NULL,
    status ENUM('active', 'pending_verification', 'disabled', 'deleted')
      NOT NULL DEFAULT 'pending_verification',
    email_verified_at TIMESTAMP NULL DEFAULT NULL,
    password_changed_at TIMESTAMP NULL DEFAULT NULL,
    failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until TIMESTAMP NULL DEFAULT NULL,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    auth_version INT UNSIGNED NOT NULL DEFAULT 1,
    current_level ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2') DEFAULT 'B1',
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_public_id (public_id),
    UNIQUE KEY uq_users_email_normalized (email_normalized),
    INDEX idx_users_status (status),
    INDEX idx_users_locked_until (locked_until)
);

-- 1.1. Danh tính đăng nhập ngoài mật khẩu (Google hiện tại; có thể mở rộng provider khác)
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

-- 1.2. Một phiên tương ứng một thiết bị/lần đăng nhập. session_key không phải secret.
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

-- 1.3. Lịch sử refresh token phục vụ rotation và phát hiện token cũ bị tái sử dụng.
-- Chỉ lưu SHA-256/HMAC digest 32 byte; tuyệt đối không lưu raw refresh token.
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

-- 1.4. OTP/email challenge dùng một lần cho xác minh email, đăng nhập và đặt lại mật khẩu.
-- code_hash phải là HMAC/SHA-256 có secret phía server vì không gian OTP nhỏ.
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

-- 2. Bảng video (Theo dõi trạng thái xử lý AI)
CREATE TABLE IF NOT EXISTS videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    platform_video_id VARCHAR(100) NOT NULL,
    platform ENUM('youtube', 'tiktok') DEFAULT 'youtube',
    title VARCHAR(255) NULL,
    duration INT DEFAULT 0, -- tính theo giây
    status ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED') DEFAULT 'PENDING',
    source_type ENUM('ORIGINAL_CAPTIONS', 'WHISPER_AI') DEFAULT 'ORIGINAL_CAPTIONS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_videos_platform_video (platform, platform_video_id),
    INDEX idx_platform_id (platform_video_id)
);

-- 3. Bảng phụ đề song ngữ
CREATE TABLE IF NOT EXISTS subtitles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    video_id INT NOT NULL,
    cue_index INT NOT NULL DEFAULT 0,
    start_time FLOAT NOT NULL, -- giây (ví dụ: 12.35)
    end_time FLOAT NOT NULL,   -- giây (ví dụ: 15.80)
    en_text TEXT NOT NULL,
    vi_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    INDEX idx_video_time (video_id, start_time, end_time)
);

-- 4. Bảng từ vựng SRS của người dùng (Tương thích FSRS v5 & SM-2)
CREATE TABLE IF NOT EXISTS user_vocabulary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    word VARCHAR(100) NOT NULL,
    phonetic VARCHAR(100) NULL,
    meaning TEXT NOT NULL,
    context_sentence TEXT NULL,
    video_id INT NULL,
    timestamp_mark FLOAT NULL,
    
    -- Trường FSRS v5 (Free Spaced Repetition Scheduler)
    difficulty FLOAT DEFAULT 5.0,        -- D ∈ [1, 10]
    stability FLOAT DEFAULT 0.0,         -- S (ngày)
    retrievability FLOAT DEFAULT 0.0,    -- R ∈ [0, 1]
    lapses INT DEFAULT 0,                -- Số lần quên (rating = Again)
    state VARCHAR(20) DEFAULT 'new',     -- 'new' | 'learning' | 'review' | 'relearning'

    -- Trường tương thích SM-2 cũ
    -- Language Reactor display metadata (separate from the FSRS state above)
    learning_stage ENUM('known', 'learning', 'later') NOT NULL DEFAULT 'learning',
    card_label ENUM('red', 'green', 'yellow', 'blue') NULL DEFAULT NULL,

    srs_stage INT DEFAULT 0,
    repetition_count INT DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INT DEFAULT 0,
    
    next_review TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
    UNIQUE KEY uq_user_word (user_id, word),
    INDEX idx_user_next_review (user_id, next_review),
    INDEX idx_user_learning_stage (user_id, learning_stage),
    INDEX idx_user_card_label (user_id, card_label)
);

-- Tạo một user mẫu (Password hash: demo123)
INSERT IGNORE INTO users
  (id, public_id, email, password_hash, display_name, status, email_verified_at, password_changed_at, current_level)
VALUES
  (1, '00000000-0000-4000-8000-000000000001', 'demo@shortlearn.local',
   'scrypt$32768$8$3$tHmpL0TCsnrL5cjyVPmKwQ$DHOSKOIfnd7jgEiua4yC9dgklGWkTyERh5jSB1n3iPE',
   'ShortLearn Demo', 'active', NOW(), NOW(), 'B1');

-- Tạo dữ liệu từ vựng mẫu để test tính năng ôn tập FSRS ngay lập tức
INSERT IGNORE INTO user_vocabulary 
  (user_id, word, phonetic, meaning, context_sentence, difficulty, stability, retrievability, lapses, state, next_review)
VALUES
  (1, 'serendipity', '/ˌser.ənˈdɪp.ə.t̬i/', 'Sự tình cờ may mắn, duyên may bất ngờ', 'Finding this hidden cafe was pure serendipity.', 4.2, 3.5, 0.85, 0, 'review', NOW()),
  (1, 'resilience', '/rɪˈzɪl.jəns/', 'Khả năng phục hồi, kiên cường vượt khó', 'She showed great resilience in overcoming setbacks.', 5.8, 1.2, 0.72, 1, 'review', NOW()),
  (1, 'ephemeral', '/ɪˈfem.ər.əl/', 'Chóng vạt, phù du, ngắn ngủi', 'Fame in the internet age can be ephemeral.', 6.5, 0.4, 0.50, 0, 'new', NOW());
