import re
from typing import List, Dict, Any

def merge_cues_sliding_window(
    raw_cues: List[Dict[str, Any]], 
    max_duration_sec: float = 16.0, 
    max_words: int = 35
) -> List[Dict[str, Any]]:
    """
    Gộp các mốc thời gian phụ đề ngắn (1-2s) thành các đoạn hoàn chỉnh (10-16s)
    dựa trên dấu chấm câu hoặc ngưỡng thời gian / số lượng từ.
    """
    if not raw_cues:
        return []

    merged_chunks = []
    
    current_chunk = {
        "start_time": round(float(raw_cues[0]["start"]), 2),
        "end_time": round(float(raw_cues[0]["start"]) + float(raw_cues[0]["duration"]), 2),
        "text": raw_cues[0]["text"].strip()
    }

    sentence_enders = re.compile(r'[.!?]$')

    for cue in raw_cues[1:]:
        cue_start = round(float(cue["start"]), 2)
        cue_end = round(cue_start + float(cue["duration"]), 2)
        cue_text = cue["text"].strip()

        if not cue_text:
            continue

        chunk_duration = cue_end - current_chunk["start_time"]
        chunk_words_count = len(current_chunk["text"].split())
        has_ended = bool(sentence_enders.search(current_chunk["text"]))

        # Điều kiện tách chunk mới:
        # 1. Câu kết thúc bằng dấu chấm và đã dài tối thiểu 8 giây hoặc 15 từ
        # 2. Hoặc chunk hiện tại đã vượt quá max_duration_sec
        # 3. Hoặc số từ vượt quá max_words
        should_split = (
            (has_ended and (chunk_duration >= 8.0 or chunk_words_count >= 15)) or
            chunk_duration >= max_duration_sec or
            chunk_words_count >= max_words
        )

        if should_split:
            merged_chunks.append(current_chunk)
            current_chunk = {
                "start_time": cue_start,
                "end_time": cue_end,
                "text": cue_text
            }
        else:
            current_chunk["text"] += " " + cue_text
            current_chunk["end_time"] = cue_end

    if current_chunk["text"]:
        merged_chunks.append(current_chunk)

    # Đánh chỉ mục cue_index
    for idx, item in enumerate(merged_chunks):
        item["cue_index"] = idx

    return merged_chunks
