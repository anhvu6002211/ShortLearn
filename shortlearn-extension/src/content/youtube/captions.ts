import { parseJson3, type SubtitleCue } from '../../shared/subtitles.js';

type Player = Element & { getPlayerResponse?: () => any };
export async function loadEnglishCues(videoId: string): Promise<SubtitleCue[]> {
  const player = document.querySelector('#movie_player, .html5-video-player') as Player | null;
  const response = player?.getPlayerResponse?.();
  if (response?.videoDetails?.videoId !== videoId) return [];
  const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks)) return [];
  const track = tracks.find((item: any) => item.languageCode === 'en' || item.languageCode?.startsWith('en-')) ?? tracks[0];
  if (!track?.baseUrl) return [];
  const url = new URL(track.baseUrl);
  url.searchParams.set('fmt', 'json3');
  const result = await fetch(url);
  return result.ok ? parseJson3(await result.json()) : [];
}
