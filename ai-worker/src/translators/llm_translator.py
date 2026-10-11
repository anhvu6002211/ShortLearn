import json
import logging
from typing import List, Dict, Any, Optional
from groq import Groq
import google.generativeai as genai
from ..core.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL, PRIMARY_LLM

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_BASE = """Bạn là chuyên gia dịch thuật phụ đề song ngữ Anh - Việt cao cấp cho ứng dụng học tiếng Anh ShortLearn.
Nhiệm vụ của bạn:
1. Nhận vào mảng phụ đề tiếng Anh có cue_index kèm mốc thời gian start_time và end_time.
2. Dịch từng câu sang tiếng Việt một cách tự nhiên, đúng ngữ cảnh hội thoại thực tế của người bản xứ.
3. Giữ NGUYÊN VẸN cue_index, start_time và end_time cho từng mục; không gộp, bỏ hay đổi thứ tự các mục.
4. Chỉ trả về DUY NHẤT một chuỗi JSON hợp lệ theo định dạng:
[
  {
    "cue_index": 0,
    "start_time": 0.0,
    "end_time": 3.5,
    "en_text": "Original English sentence",
    "vi_text": "Bản dịch tiếng Việt tương ứng"
  }
]
Không được thêm bất kỳ lời dẫn hay markdown block ```json nào ngoài JSON thuần."""


def normalize_translations(
    translated: Any,
    chunks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Giữ mốc thời gian và câu gốc do worker kiểm soát, chỉ nhận vi_text từ LLM."""
    if not isinstance(translated, list):
        raise ValueError("LLM response must be a JSON array")
    if len(translated) != len(chunks):
        raise ValueError(
            f"LLM returned {len(translated)} subtitle items for {len(chunks)} input chunks"
        )

    expected_indexes = [int(chunk.get("cue_index", index)) for index, chunk in enumerate(chunks)]
    returned_indexes = [
        candidate.get("cue_index") if isinstance(candidate, dict) else None
        for candidate in translated
    ]
    # When the model follows the contract, map by cue_index rather than by its
    # response order. Older provider responses can omit cue_index, in which
    # case an exact-length positional mapping remains backwards compatible.
    if all(index is not None for index in returned_indexes):
        if len(set(returned_indexes)) != len(returned_indexes) or set(returned_indexes) != set(expected_indexes):
            raise ValueError("LLM response cue_index values do not match the requested chunks")
        candidates_by_index = {
            int(candidate["cue_index"]): candidate
            for candidate in translated
            if isinstance(candidate, dict)
        }
        ordered_candidates = [candidates_by_index[index] for index in expected_indexes]
    else:
        ordered_candidates = translated

    normalized: List[Dict[str, Any]] = []
    for index, chunk in enumerate(chunks):
        candidate = ordered_candidates[index]
        vi_text = candidate.get("vi_text") if isinstance(candidate, dict) else None
        if not isinstance(vi_text, str) or not vi_text.strip():
            raise ValueError(f"LLM response has no Vietnamese translation at chunk {index}")

        en_text = str(chunk["text"]).strip()
        normalized_source = " ".join(en_text.casefold().split())
        normalized_translation = " ".join(vi_text.casefold().split())
        if (
            normalized_translation == normalized_source
            or normalized_translation == "(chưa có bản dịch ai)"
        ):
            raise ValueError(f"LLM response did not translate chunk {index}")

        normalized.append({
            "start_time": float(chunk["start_time"]),
            "end_time": float(chunk["end_time"]),
            "en_text": en_text,
            "vi_text": vi_text.strip()[:4000],
        })

    return normalized


def _build_system_prompt(previous_context: Optional[str] = None) -> str:
    """
    V2: Sliding Memory Window — Truyền ngữ cảnh chunk trước (N-1) vào system prompt
    để duy trì tính nhất quán đại từ nhân xưng, thuật ngữ xuyên suốt các đoạn liền kề.
    """
    if not previous_context:
        return SYSTEM_PROMPT_BASE

    return (
        SYSTEM_PROMPT_BASE + "\n\n"
        "=== NGỮ CẢNH PHÍA TRƯỚC (Context Metadata) ===\n"
        "Đoạn phụ đề tiếng Anh sau đây nằm NGAY TRƯỚC đoạn cần dịch trong video.\n"
        "KHÔNG dịch phần này. Chỉ đọc để hiểu ngữ cảnh, đại từ nhân xưng, tên riêng và chủ đề đang nói.\n"
        f'"""\n{previous_context}\n"""\n'
        "=== KẾT THÚC NGỮ CẢNH ===\n"
    )


def translate_with_groq(
    chunks: List[Dict[str, Any]],
    previous_context: Optional[str] = None
) -> List[Dict[str, Any]]:
    client = Groq(api_key=GROQ_API_KEY)

    input_data = [
        {
            "cue_index": c.get("cue_index"),
            "start_time": c["start_time"],
            "end_time": c["end_time"],
            "en_text": c["text"],
        }
        for c in chunks
    ]

    system_prompt = _build_system_prompt(previous_context)

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(input_data, ensure_ascii=False)}
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content.strip()

    # Loại bỏ code block nếu có
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]

    data = json.loads(content.strip())
    # Nếu data bọc trong object key (ví dụ {"subtitles": [...]})
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
    return data


def translate_with_gemini(
    chunks: List[Dict[str, Any]],
    previous_context: Optional[str] = None
) -> List[Dict[str, Any]]:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config={"response_mime_type": "application/json"}
    )

    input_data = [
        {
            "cue_index": c.get("cue_index"),
            "start_time": c["start_time"],
            "end_time": c["end_time"],
            "en_text": c["text"],
        }
        for c in chunks
    ]

    system_prompt = _build_system_prompt(previous_context)
    prompt = f"{system_prompt}\n\nDữ liệu cần dịch:\n{json.dumps(input_data, ensure_ascii=False)}"
    response = model.generate_content(prompt)

    data = json.loads(response.text.strip())
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
    return data


def translate_subtitles(
    chunks: List[Dict[str, Any]],
    previous_context: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Dịch phụ đề song ngữ: Ưu tiên PRIMARY_LLM, fallback sang provider còn lại nếu lỗi.
    V2: Hỗ trợ Sliding Memory Window qua tham số previous_context.
    """
    if not chunks:
        return []

    errors = []

    if PRIMARY_LLM == "groq" and GROQ_API_KEY:
        try:
            logger.info("🧠 Translating via Groq (%s)...", GROQ_MODEL)
            return normalize_translations(translate_with_groq(chunks, previous_context), chunks)
        except Exception as e:
            logger.error(f"❌ Groq translation failed: {e}")
            errors.append(e)

    if GEMINI_API_KEY:
        try:
            logger.info("🧠 Translating via Google Gemini Flash...")
            return normalize_translations(translate_with_gemini(chunks, previous_context), chunks)
        except Exception as e:
            logger.error(f"❌ Gemini translation failed: {e}")
            errors.append(e)

    if PRIMARY_LLM != "groq" and GROQ_API_KEY:
        try:
            logger.info("🧠 Fallback translating via Groq (%s)...", GROQ_MODEL)
            return normalize_translations(translate_with_groq(chunks, previous_context), chunks)
        except Exception as e:
            logger.error(f"❌ Groq fallback translation failed: {e}")
            errors.append(e)

    # Never mark placeholder text as a completed translation. Raising here lets
    # the worker retry and ultimately mark the video FAILED instead of poisoning
    # MySQL/Redis with a READY result that cannot be translated later.
    if not GROQ_API_KEY and not GEMINI_API_KEY:
        raise RuntimeError("No translation provider is configured (set GROQ_API_KEY or GEMINI_API_KEY).")

    provider_errors = "; ".join(str(error) for error in errors if str(error))
    detail = f": {provider_errors}" if provider_errors else ""
    raise RuntimeError(f"All configured translation providers failed{detail}")


def translate_subtitles_in_batches(
    chunks: List[Dict[str, Any]],
    batch_size: int,
) -> List[Dict[str, Any]]:
    """Translate a video in bounded batches while preserving cross-batch context.

    A full Short can contain many short cues. Sending all cues at once increases
    timeout and malformed-JSON risk; sending one cue at a time multiplies cost
    and latency. This middle ground has deterministic ordering and one-context
    overlap between batches.
    """
    if not chunks:
        return []

    safe_batch_size = max(1, min(int(batch_size), 12))
    translated_cues: List[Dict[str, Any]] = []
    previous_context: Optional[str] = None

    for batch_start in range(0, len(chunks), safe_batch_size):
        batch = chunks[batch_start:batch_start + safe_batch_size]
        translated_cues.extend(
            translate_subtitles(batch, previous_context=previous_context)
        )
        previous_context = " ".join(
            str(chunk.get("text", "")).strip() for chunk in batch[-2:]
        ).strip() or previous_context

    return translated_cues
