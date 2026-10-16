const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeCardLabel,
  normalizeLearningStage,
  normalizePlatform,
  normalizePlatformVideoId,
  normalizeTikTokVideoId,
  normalizeWord,
  normalizeWordList,
  normalizeYouTubeVideoId,
  parsePositiveIntegerList,
  parseTimestamp,
} = require('../src/utils/validation');

test('normalizes vocabulary and request identifiers', () => {
  assert.equal(normalizeWord('  RESILIENCE  '), 'resilience');
  assert.equal(normalizeYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(normalizePlatform('YouTube'), 'youtube');
  assert.equal(normalizePlatform(' TikTok '), 'tiktok');
  assert.equal(normalizePlatform(' External_Capture '), 'external_capture');
  assert.equal(parseTimestamp('12.345'), 12.35);
});

test('normalizes TikTok IDs and canonical URLs', () => {
  const tiktokId = '7381234567890123456';
  assert.equal(normalizeTikTokVideoId(tiktokId), tiktokId);
  assert.equal(
    normalizePlatformVideoId(`https://www.tiktok.com/@shortlearn/video/${tiktokId}?lang=en`, 'tiktok'),
    tiktokId
  );
  assert.equal(normalizePlatformVideoId('dQw4w9WgXcQ', 'youtube'), 'dQw4w9WgXcQ');
});

test('rejects unsafe IDs and unsupported platforms', () => {
  assert.throws(() => normalizeYouTubeVideoId('../unsafe'), /valid 11-character/);
  assert.throws(() => normalizeTikTokVideoId('../unsafe'), /valid 15-32 digit/);
  assert.throws(
    () => normalizeTikTokVideoId('https://evil.example/@user/video/7381234567890123456'),
    /valid TikTok/
  );
  assert.throws(() => normalizePlatform('vimeo'), /platform must be one of/);
  assert.throws(() => normalizePlatformVideoId('dQw4w9WgXcQ', 'external_capture'), /must not include video_id/);
  assert.throws(() => parseTimestamp('-1'), /between 0 and 14400/);
});

test('normalizes learning stages, card labels, and bulk selectors', () => {
  assert.equal(normalizeLearningStage(' KNOWN '), 'known');
  assert.equal(normalizeCardLabel(' Blue '), 'blue');
  assert.equal(normalizeCardLabel(null), null);
  assert.deepEqual(parsePositiveIntegerList([2, '3', 2]), [2, 3]);
  assert.deepEqual(normalizeWordList([' Hello ', 'hello', 'WORLD']), ['hello', 'world']);
});

test('rejects unsupported learning metadata and unsafe bulk selectors', () => {
  assert.throws(() => normalizeLearningStage('mastered'), /learning_stage must be one of/);
  assert.throws(() => normalizeCardLabel('orange'), /card_label must be null or one of/);
  assert.throws(() => parsePositiveIntegerList([]), /non-empty array/);
  assert.throws(() => parsePositiveIntegerList([1, 0]), /positive integers/);
  assert.throws(() => normalizeWordList(new Array(201).fill('word')), /at most 200/);
});
