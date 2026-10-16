const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_VIDEO_ID = /^\d{15,32}$/;
const SUPPORTED_PLATFORMS = Object.freeze(['youtube', 'tiktok', 'external_capture']);
const LEARNING_STAGES = Object.freeze(['known', 'learning', 'later']);
const CARD_LABELS = Object.freeze(['red', 'green', 'yellow', 'blue']);

function normalizeText(value, { field, maxLength, required = false }) {
  if (value === undefined || value === null) {
    if (required) throw new TypeError(`${field} is required.`);
    return null;
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string.`);
  }

  const normalized = value.replace(/\u0000/g, '').trim();
  if (required && !normalized) throw new TypeError(`${field} is required.`);
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new TypeError(`${field} must not exceed ${maxLength} characters.`);
  }
  return normalized;
}

function normalizeWord(value) {
  const word = normalizeText(value, { field: 'word', maxLength: 100, required: true })
    .normalize('NFKC')
    .toLocaleLowerCase('en-US');

  if (!/[\p{L}\p{N}]/u.test(word)) {
    throw new TypeError('word must contain at least one letter or number.');
  }
  return word;
}

function parseTimestamp(value) {
  if (value === undefined || value === null || value === '') return 0;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > 14_400) {
    throw new TypeError('timestamp_mark must be a number between 0 and 14400.');
  }
  return Number(timestamp.toFixed(2));
}

function normalizeYouTubeVideoId(value) {
  if (typeof value !== 'string' || !YOUTUBE_VIDEO_ID.test(value.trim())) {
    throw new TypeError('video_id must be a valid 11-character YouTube video ID.');
  }
  return value.trim();
}

function normalizeTikTokVideoId(value) {
  if (typeof value !== 'string') {
    throw new TypeError('video_id must be a valid TikTok video ID.');
  }

  const candidate = value.trim();
  let videoId = candidate;

  // Accept canonical share URLs as a convenience, but always reduce them to an
  // opaque numeric ID before using them in SQL, Redis keys, or queue messages.
  if (/^https?:\/\//i.test(candidate)) {
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new TypeError('video_id must be a valid TikTok video ID or canonical video URL.');
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'tiktok.com' && hostname !== 'm.tiktok.com') {
      throw new TypeError('video_id must be a valid TikTok video ID or canonical video URL.');
    }
    const match = parsed.pathname.match(/\/video\/(\d{15,32})(?:\/|$)/);
    videoId = match?.[1] || '';
  }

  if (!TIKTOK_VIDEO_ID.test(videoId)) {
    throw new TypeError('video_id must be a valid 15-32 digit TikTok video ID.');
  }
  return videoId;
}

function normalizePlatform(value) {
  const platform = (value || 'youtube').toString().trim().toLowerCase();
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new TypeError(`platform must be one of: ${SUPPORTED_PLATFORMS.join(', ')}.`);
  }
  return platform;
}

function normalizePlatformVideoId(value, platform = 'youtube') {
  const normalizedPlatform = normalizePlatform(platform);
  if (normalizedPlatform === 'external_capture') {
    throw new TypeError('external_capture must not include video_id.');
  }
  return normalizedPlatform === 'tiktok'
    ? normalizeTikTokVideoId(value)
    : normalizeYouTubeVideoId(value);
}

function normalizeLearningStage(value) {
  if (typeof value !== 'string') {
    throw new TypeError(`learning_stage must be one of: ${LEARNING_STAGES.join(', ')}.`);
  }

  const stage = value.trim().toLowerCase();
  if (!LEARNING_STAGES.includes(stage)) {
    throw new TypeError(`learning_stage must be one of: ${LEARNING_STAGES.join(', ')}.`);
  }
  return stage;
}

function normalizeCardLabel(value) {
  // null deliberately clears the optional legacy colour tag.
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new TypeError(`card_label must be null or one of: ${CARD_LABELS.join(', ')}.`);
  }

  const label = value.trim().toLowerCase();
  if (!CARD_LABELS.includes(label)) {
    throw new TypeError(`card_label must be null or one of: ${CARD_LABELS.join(', ')}.`);
  }
  return label;
}

function parsePositiveIntegerList(value, { field = 'ids', maxItems = 200 } = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty array.`);
  }
  if (value.length > maxItems) {
    throw new TypeError(`${field} must contain at most ${maxItems} items.`);
  }

  const values = value.map((item) => {
    const parsed = typeof item === 'number' ? item : Number(item);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new TypeError(`${field} must contain only positive integers.`);
    }
    return parsed;
  });

  return [...new Set(values)];
}

function normalizeWordList(value, { field = 'words', maxItems = 200 } = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty array.`);
  }
  if (value.length > maxItems) {
    throw new TypeError(`${field} must contain at most ${maxItems} items.`);
  }

  return [...new Set(value.map((word) => normalizeWord(word)))];
}

module.exports = {
  CARD_LABELS,
  LEARNING_STAGES,
  SUPPORTED_PLATFORMS,
  normalizeCardLabel,
  normalizeLearningStage,
  normalizePlatform,
  normalizePlatformVideoId,
  normalizeTikTokVideoId,
  normalizeText,
  normalizeWord,
  normalizeWordList,
  normalizeYouTubeVideoId,
  parsePositiveIntegerList,
  parseTimestamp,
};
