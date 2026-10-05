export interface SubtitleCue {
  cue_index?: number;
  start_time: number;
  end_time: number;
  en_text: string;
  vi_text: string;
}

/**
 * Thuật toán Binary Search O(log N) tìm nhanh đoạn phụ đề khớp với currentTime
 */
export function findSubtitleCue(subtitles: SubtitleCue[], currentTime: number): SubtitleCue | null {
  if (!subtitles || subtitles.length === 0) return null;

  let low = 0;
  let high = subtitles.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cue = subtitles[mid];

    if (currentTime >= cue.start_time && currentTime <= cue.end_time) {
      return cue;
    }

    if (currentTime < cue.start_time) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // Trường hợp thời gian nằm giữa 2 khoảng nghỉ ngắn (khoảng trống giữa 2 cue < 0.5s)
  // Chọn cue kế tiếp nếu sắp tới trong vòng 0.3s
  if (low < subtitles.length) {
    const nextCue = subtitles[low];
    if (nextCue.start_time - currentTime <= 0.3 && currentTime <= nextCue.end_time) {
      return nextCue;
    }
  }

  return null;
}
