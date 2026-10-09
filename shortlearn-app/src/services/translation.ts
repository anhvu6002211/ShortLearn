/**
 * Dịch dự phòng trên thiết bị — tách từ App.tsx để gọn kiến trúc.
 * Giữ nguyên 100% logic V13: cache LRU, dedup Promise, 2 endpoint fallback.
 */

const TRANSLATION_CACHE_LIMIT = 150;
const TRANSLATION_TIMEOUT_MS = 8_000;
export const TRANSLATION_CONCURRENCY = 3;
export const TRANSLATION_UNAVAILABLE_TEXT = 'Chưa thể dịch sang tiếng Việt. Hãy kiểm tra kết nối mạng.';

const translationCache = new Map<string, string>();
const translationRequests = new Map<string, Promise<string>>();

const normalizeTranslationComparison = (value: string): string =>
  value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

export const isUsableTranslation = (
  sourceText: string,
  translatedText: unknown,
): translatedText is string => {
  if (typeof translatedText !== 'string') return false;
  const translated = translatedText.trim();
  if (!translated || translated === '(Chưa có bản dịch AI)') return false;
  return normalizeTranslationComparison(sourceText) !== normalizeTranslationComparison(translated);
};

const extractGoogleTranslation = (payload: unknown): string | null => {
  if (typeof payload === 'string') return payload.trim() || null;
  if (!Array.isArray(payload) || payload.length === 0) return null;
  if (typeof payload[0] === 'string') return payload[0].trim() || null;
  if (Array.isArray(payload[0])) {
    const translated = (payload[0] as unknown[])
      .map((segment: unknown) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
      .join('')
      .trim();
    return translated || null;
  }
  return null;
};

const requestTranslation = async (url: string): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return extractGoogleTranslation(await response.json());
  } finally {
    clearTimeout(timeout);
  }
};

export const translateDirect = async (text: string): Promise<string> => {
  const normalizedText = text.trim();
  if (!normalizedText) return '';
  const cached = translationCache.get(normalizedText);
  if (cached) return cached;
  const existingRequest = translationRequests.get(normalizedText);
  if (existingRequest) return existingRequest;

  const encodedText = encodeURIComponent(normalizedText);
  const request = (async () => {
    const urls = [
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodedText}`,
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=${encodedText}`,
    ];
    for (const url of urls) {
      try {
        const translated = await requestTranslation(url);
        if (!isUsableTranslation(normalizedText, translated)) continue;
        if (translationCache.size >= TRANSLATION_CACHE_LIMIT) {
          const oldestKey = translationCache.keys().next().value;
          if (oldestKey) translationCache.delete(oldestKey);
        }
        translationCache.set(normalizedText, translated);
        return translated;
      } catch {
        // Thử endpoint kế tiếp khi timeout hoặc thiết bị tạm mất mạng.
      }
    }
    throw new Error(TRANSLATION_UNAVAILABLE_TEXT);
  })();

  translationRequests.set(normalizedText, request);
  try {
    return await request;
  } finally {
    if (translationRequests.get(normalizedText) === request) {
      translationRequests.delete(normalizedText);
    }
  }
};

export const runWithConcurrency = async <T,>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
};
