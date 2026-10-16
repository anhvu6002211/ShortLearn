const MATCHES = ['/watch', '/shorts/'];
export function youtubeVideoId(url = location.href): string | null {
  const parsed = new URL(url);
  const shorts = parsed.pathname.match(/^\/shorts\/([\w-]{11})/);
  if (shorts) return shorts[1];
  const watch = parsed.searchParams.get('v');
  return parsed.pathname === '/watch' && watch && /^[\w-]{11}$/.test(watch) ? watch : null;
}
export function isSupportedYouTubePage(): boolean { return MATCHES.some(value => location.pathname.startsWith(value)); }
