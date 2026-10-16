export interface SubtitleCue { start: number; duration: number; text: string }

export function parseJson3(payload: unknown): SubtitleCue[] {
  if (!payload || typeof payload !== 'object' || !('events' in payload) || !Array.isArray(payload.events)) return [];
  return payload.events.flatMap((event: any) => {
    if (!Array.isArray(event?.segs) || typeof event.tStartMs !== 'number') return [];
    const text = event.segs.map((segment: any) => typeof segment?.utf8 === 'string' ? segment.utf8 : '').join('').replace(/♪|\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    return text ? [{ start: event.tStartMs / 1000, duration: (typeof event.dDurationMs === 'number' ? event.dDurationMs : 2500) / 1000, text }] : [];
  });
}

export function cueAt(cues: SubtitleCue[], time: number): SubtitleCue | null {
  let low = 0, high = cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (time >= cue.start && time <= cue.start + cue.duration) return cue;
    if (time < cue.start) high = mid - 1; else low = mid + 1;
  }
  return null;
}
