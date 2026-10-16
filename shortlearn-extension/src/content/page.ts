import { loadEnglishCues } from './youtube/captions.js';
import { observesCaptionMutation, readVisibleCaption } from './youtube/domCaptions.js';
import { isSupportedYouTubePage, youtubeVideoId } from './youtube/video.js';

const SOURCE = 'shortlearn-page';
let activeId: string | null = null;
let generation = 0;
let scheduled = false;
let lastText = '';

function emit(type: string, payload: Record<string, unknown> = {}): void {
  window.postMessage({ source: SOURCE, type, ...payload }, location.origin);
}
function emitDomCaption(): void {
  const text = readVisibleCaption();
  if (text && text !== lastText) { lastText = text; emit('CAPTION', { text, time: document.querySelector('video')?.currentTime ?? 0 }); }
}
async function refresh(): Promise<void> {
  const videoId = youtubeVideoId();
  if (!isSupportedYouTubePage() || !videoId) return emit('UNSUPPORTED');
  if (videoId === activeId) return;
  activeId = videoId; lastText = ''; const current = ++generation;
  emit('VIDEO', { videoId });
  for (const delay of [0, 1000, 2500]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const cues = await loadEnglishCues(videoId).catch(() => []);
    if (current !== generation) return;
    if (cues.length) return emit('CUES', { videoId, cues });
  }
  emit('FALLBACK', { videoId });
  emitDomCaption();
  await new Promise(resolve => setTimeout(resolve, 5000));
  if (current === generation && !lastText) emit('NO_CAPTION', { videoId });
}
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; void refresh(); });
}
const observer = new MutationObserver(records => {
  if (records.some(observesCaptionMutation)) emitDomCaption();
  schedule();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('yt-navigate-finish', schedule);
window.addEventListener('popstate', schedule);
schedule();