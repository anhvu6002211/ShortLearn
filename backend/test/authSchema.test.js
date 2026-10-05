const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');
const initSql = fs.readFileSync(path.join(rootDir, 'init.sql'), 'utf8');
const migrationSql = fs.readFileSync(
  path.join(rootDir, 'backend', 'migrations', '003_auth_foundation.sql'),
  'utf8',
);

const expectAll = (source, patterns) => {
  for (const pattern of patterns) {
    assert.match(source, pattern);
  }
};

test('fresh schema contains the required authentication entities', () => {
  expectAll(initSql, [
    /CREATE TABLE IF NOT EXISTS users/i,
    /public_id CHAR\(36\)[\s\S]*NOT NULL/i,
    /email_normalized[\s\S]*GENERATED ALWAYS AS \(LOWER\(TRIM\(email\)\)\)/i,
    /password_hash VARCHAR\(255\) NULL/i,
    /email_verified_at TIMESTAMP NULL/i,
    /failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0/i,
    /auth_version INT UNSIGNED NOT NULL DEFAULT 1/i,
    /CREATE TABLE IF NOT EXISTS user_auth_identities/i,
    /CREATE TABLE IF NOT EXISTS auth_sessions/i,
    /CREATE TABLE IF NOT EXISTS auth_refresh_tokens/i,
    /CREATE TABLE IF NOT EXISTS auth_one_time_codes/i,
  ]);
});

test('refresh tokens and OTP values are represented only by fixed-size hashes', () => {
  for (const source of [initSql, migrationSql]) {
    assert.match(source, /token_hash BINARY\(32\) NOT NULL/i);
    assert.match(source, /code_hash BINARY\(32\) NOT NULL/i);
    assert.doesNotMatch(source, /\brefresh_token\s+(?:VAR)?CHAR/i);
    assert.doesNotMatch(source, /\botp_code\s+(?:VAR)?CHAR/i);
    assert.doesNotMatch(source, /\bcode\s+(?:VAR)?CHAR/i);
  }
});

test('session rotation and OTP abuse controls have lifecycle columns and indexes', () => {
  expectAll(initSql, [
    /family_key CHAR\(36\)/i,
    /parent_token_id BIGINT UNSIGNED NULL/i,
    /used_at TIMESTAMP NULL/i,
    /revoked_at TIMESTAMP NULL/i,
    /attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0/i,
    /max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5/i,
    /expires_at TIMESTAMP NOT NULL/i,
    /consumed_at TIMESTAMP NULL/i,
    /invalidated_at TIMESTAMP NULL/i,
    /idx_auth_sessions_user_active/i,
    /idx_auth_refresh_family/i,
    /idx_auth_otp_lookup/i,
  ]);
});

test('auth records follow user/session deletion and migration can be rerun', () => {
  expectAll(initSql, [
    /fk_auth_identity_user[\s\S]*ON DELETE CASCADE/i,
    /fk_auth_session_user[\s\S]*ON DELETE CASCADE/i,
    /fk_refresh_token_session[\s\S]*ON DELETE CASCADE/i,
    /fk_auth_otp_user[\s\S]*ON DELETE CASCADE/i,
  ]);

  expectAll(migrationSql, [
    /information_schema\.columns/i,
    /information_schema\.statistics/i,
    /CREATE TABLE IF NOT EXISTS user_auth_identities/i,
    /CREATE TABLE IF NOT EXISTS auth_sessions/i,
    /CREATE TABLE IF NOT EXISTS auth_refresh_tokens/i,
    /CREATE TABLE IF NOT EXISTS auth_one_time_codes/i,
  ]);
});
