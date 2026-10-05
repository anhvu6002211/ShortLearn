export type VideoPlatform = 'youtube' | 'tiktok';

export interface VideoTarget {
  platform: VideoPlatform;
  videoId: string | null;
  url: string;
}

export const YOUTUBE_SHORTS_HOME_URL = 'https://m.youtube.com/shorts';
export const TIKTOK_HOME_URL = 'https://www.tiktok.com/foryou?lang=en';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_ID_PATTERN = /^\d{5,32}$/;

const isHost = (hostname: string, domain: string): boolean => {
  const normalizedHostname = hostname.toLocaleLowerCase();
  return normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`);
};

export const createYouTubeTarget = (videoId: string): VideoTarget => ({
  platform: 'youtube',
  videoId,
  url: `https://m.youtube.com/shorts/${encodeURIComponent(videoId)}`,
});

// TikTok documents player/v1 as its stable embedded-player URL. Keeping the
// learning surface on that player avoids the install/login interstitials shown
// by the normal mobile website.
export const createTikTokTarget = (videoId: string): VideoTarget => ({
  platform: 'tiktok',
  videoId,
  url: [
    `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}`,
    '?autoplay=0',
    '&controls=1',
    '&progress_bar=1',
    '&play_button=1',
    '&volume_control=1',
    '&fullscreen_button=0',
    '&timestamp=1',
    '&closed_caption=1',
    '&description=0',
    '&music_info=0',
    '&native_context_menu=0',
  ].join(''),
});

const parseUrl = (rawValue: string): URL | null => {
  const value = rawValue.trim();
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    if (!/^[\w.-]+\.[A-Za-z]{2,}(?:[/?#]|$)/.test(value)) return null;
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
};

const extractYouTubeIdFromUrl = (url: URL): string | null => {
  if (!(isHost(url.hostname, 'youtube.com') || isHost(url.hostname, 'youtu.be'))) return null;

  const queryId = url.searchParams.get('v');
  if (queryId && YOUTUBE_ID_PATTERN.test(queryId)) return queryId;

  const pathMatch = url.pathname.match(
    /(?:^|\/)shorts\/([A-Za-z0-9_-]{11})(?:\/|$)|(?:^|\/)embed\/([A-Za-z0-9_-]{11})(?:\/|$)/i,
  );
  const pathId = pathMatch?.[1] || pathMatch?.[2];
  if (pathId && YOUTUBE_ID_PATTERN.test(pathId)) return pathId;

  if (isHost(url.hostname, 'youtu.be')) {
    const shortId = url.pathname.split('/').filter(Boolean)[0];
    if (shortId && YOUTUBE_ID_PATTERN.test(shortId)) return shortId;
  }

  return null;
};

export const extractTikTokVideoIdFromUrl = (value: string): string | null => {
  const url = parseUrl(value);
  if (!url || !isHost(url.hostname, 'tiktok.com')) return null;

  const match = url.pathname.match(/\/(?:video|v|player\/v1)\/(\d{5,32})(?:\/|$)/i);
  return match?.[1] || null;
};

export const parseVideoTarget = (
  rawValue: string,
  preferredPlatform?: VideoPlatform,
): VideoTarget | null => {
  const value = rawValue.trim();
  if (!value) return null;

  if (YOUTUBE_ID_PATTERN.test(value) && preferredPlatform !== 'tiktok') {
    return createYouTubeTarget(value);
  }
  if (TIKTOK_ID_PATTERN.test(value)) {
    return createTikTokTarget(value);
  }

  const url = parseUrl(value);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return null;

  const youtubeId = extractYouTubeIdFromUrl(url);
  if (youtubeId) return createYouTubeTarget(youtubeId);

  if (isHost(url.hostname, 'tiktok.com')) {
    const tiktokId = extractTikTokVideoIdFromUrl(url.toString());
    if (tiktokId) return createTikTokTarget(tiktokId);

    // vm.tiktok.com and vt.tiktok.com links do not contain the post ID. Let
    // WebView follow the HTTPS redirect; the navigation callback will discover
    // the canonical ID and switch to the stable player URL.
    const isTikTokShareLink = ['vm.tiktok.com', 'vt.tiktok.com'].includes(url.hostname.toLocaleLowerCase())
      || /^\/t\//i.test(url.pathname);
    if (isTikTokShareLink) {
      return { platform: 'tiktok', videoId: null, url: url.toString() };
    }
  }

  return null;
};
