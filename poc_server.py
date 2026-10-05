import os
import json
import time
import tempfile
import re
import logging
from typing import Optional, List, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import requests
from dotenv import load_dotenv

# Load biến môi trường từ .env
load_dotenv()

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [ShortLearn-AI]: %(message)s'
)
logger = logging.getLogger("ShortLearn-Server")

# ==========================================
# CẤU HÌNH API KEYS & PROVIDERS
# ==========================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
CACHE_TTL = 60 * 60 * 48  # 48 giờ

# Khởi tạo Gemini nếu có key
gemini_model = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_NAME,
            generation_config={"response_mime_type": "application/json"}
        )
        logger.info(f"✅ [Gemini] Configured successfully with model: {GEMINI_MODEL_NAME}")
    except Exception as e:
        logger.warning(f"⚠️ [Gemini] Initialization warning: {e}")

# ==========================================
# HỆ THỐNG CACHE HYBRID (REDIS + IN-MEMORY FALLBACK)
# ==========================================
redis_client = None
_MEM_CACHE: Dict[str, Tuple[float, Any]] = {}

import socket

def init_redis():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.2)
        res = s.connect_ex((REDIS_HOST, REDIS_PORT))
        s.close()
        if res == 0:
            import redis
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True, socket_timeout=0.5)
            r.ping()
            logger.info(f"✅ [Redis] Connected to redis://{REDIS_HOST}:{REDIS_PORT}")
            return r
    except Exception:
        pass
    logger.info("ℹ️ [Cache] Redis not detected. Utilizing High-Performance In-Memory TTL Cache.")
    return None

redis_client = init_redis()

def cache_get(key: str) -> Optional[List[Dict[str, Any]]]:
    if redis_client:
        try:
            val = redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"⚠️ [Redis Get Error]: {e}")
    # In-memory fallback
    if key in _MEM_CACHE:
        expire_at, data = _MEM_CACHE[key]
        if time.time() < expire_at:
            return data
        else:
            del _MEM_CACHE[key]
    return None

def cache_set(key: str, data: List[Dict[str, Any]], ttl_seconds: int = CACHE_TTL):
    if redis_client:
        try:
            redis_client.setex(key, ttl_seconds, json.dumps(data, ensure_ascii=False))
            return
        except Exception as e:
            logger.warning(f"⚠️ [Redis Set Error]: {e}")
    _MEM_CACHE[key] = (time.time() + ttl_seconds, data)

# ==========================================
# FASTAPI APP SETUP
# ==========================================
app = FastAPI(
    title="ShortLearn AI Server",
    description="High-performance Bilingual Subtitles & AI Translation Pipeline"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SubtitleRequest(BaseModel):
    video_id: str
    platform: Optional[str] = "youtube"

@app.get("/")
def home():
    return {
        "status": "ShortLearn AI Server is ONLINE",
        "version": "v2.0-Gemini-Whisper",
        "gemini_active": bool(gemini_model),
        "groq_active": bool(GROQ_API_KEY),
        "redis_connected": bool(redis_client),
        "endpoints": [
            "GET /health",
            "POST /api/v1/subtitles/request",
            "GET /api/v1/subtitles/{video_id}",
            "GET /subtitles/{video_id}"
        ]
    }

@app.get("/health")
def health():
    return {
        "status": "HEALTHY",
        "redis": "CONNECTED" if redis_client else "IN_MEMORY_FALLBACK",
        "gemini": "READY" if gemini_model else "DISABLED",
        "groq": "READY" if GROQ_API_KEY else "DISABLED",
        "timestamp": time.time()
    }

# ==========================================
# TIER 1: YOUTUBE TRANSCRIPT API (HTTP FAST ~300ms)
# ==========================================
def fetch_tier1_transcript(video_id: str) -> List[Dict[str, Any]]:
    from youtube_transcript_api import YouTubeTranscriptApi
    yta = YouTubeTranscriptApi()
    
    # 1. Thử kéo tiếng Anh chuẩn hoặc auto-generated
    try:
        fetched = yta.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
    except Exception:
        try:
            fetched = yta.fetch(video_id)
        except Exception as e:
            logger.info(f"ℹ️ [Tier 1] No transcript found for {video_id}: {e}")
            return []

    cues = []
    for item in fetched:
        s = getattr(item, 'start', None) if not isinstance(item, dict) else item.get('start')
        d = getattr(item, 'duration', None) if not isinstance(item, dict) else item.get('duration')
        t = getattr(item, 'text', '') if not isinstance(item, dict) else item.get('text', '')
        clean_t = re.sub(r'\[.*?\]|\(.*?\)|♪|\u266a', '', str(t)).strip()
        if clean_t:
            cues.append({
                'start': float(s or 0.0),
                'duration': max(0.5, float(d or 0.0)),
                'text': clean_t
            })
    return cues

# ==========================================
# TIER 2: AUDIO FALLBACK (GROQ WHISPER / GEMINI AUDIO)
# ==========================================
def fetch_tier2_audio_transcription(video_id: str) -> List[Dict[str, Any]]:
    import yt_dlp
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    logger.info(f"🎵 [Tier 2 Audio] Attempting audio extraction for video {video_id}...")

    with tempfile.TemporaryDirectory() as tmp_dir:
        audio_out_path = os.path.join(tmp_dir, f"{video_id}.m4a")
        ydl_opts = {
            'format': '139/249/250/251/bestaudio[abr<=64]/bestaudio',
            'outtmpl': audio_out_path,
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'socket_timeout': 10,
            'retries': 2,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            if not os.path.exists(audio_out_path):
                files = os.listdir(tmp_dir)
                if files:
                    audio_out_path = os.path.join(tmp_dir, files[0])
                else:
                    logger.warning(f"❌ [Tier 2] Audio download failed for {video_id}")
                    return []

            file_size_kb = os.path.getsize(audio_out_path) / 1024
            logger.info(f"📦 [Tier 2] Downloaded audio: {file_size_kb:.1f}KB")

            # 1. Thử với Groq Whisper nếu có key
            if GROQ_API_KEY:
                try:
                    from groq import Groq
                    groq_client = Groq(api_key=GROQ_API_KEY)
                    with open(audio_out_path, "rb") as f:
                        transcription = groq_client.audio.transcriptions.create(
                            file=(os.path.basename(audio_out_path), f.read()),
                            model="whisper-large-v3",
                            response_format="verbose_json",
                            temperature=0.0
                        )
                    segments = getattr(transcription, 'segments', []) or []
                    cues = []
                    for seg in segments:
                        txt = str(seg.get('text', '')).strip()
                        if txt:
                            cues.append({
                                'start': float(seg.get('start', 0.0)),
                                'duration': max(0.5, float(seg.get('end', 0.0) - seg.get('start', 0.0))),
                                'text': txt
                            })
                    if cues:
                        logger.info(f"✅ [Groq Whisper] Transcribed {len(cues)} cues for {video_id}")
                        return cues
                except Exception as e:
                    logger.warning(f"⚠️ [Groq Whisper Error]: {e}")

            # 2. Thử với Google Gemini Audio Transcription nếu có key
            if GEMINI_API_KEY:
                try:
                    import google.generativeai as genai
                    audio_file = genai.upload_file(audio_out_path)
                    transcribe_prompt = (
                        "Transcribe the English speech in this audio clip. "
                        "Return a JSON array of segments with start_time, duration, and text. "
                        "Format: [{\"start\": 0.0, \"duration\": 3.5, \"text\": \"...\"}]"
                    )
                    res = gemini_model.generate_content([audio_file, transcribe_prompt])
                    genai.delete_file(audio_file.name)
                    parsed = json.loads(res.text.strip())
                    if isinstance(parsed, list) and len(parsed) > 0:
                        logger.info(f"✅ [Gemini Audio STT] Transcribed {len(parsed)} cues for {video_id}")
                        return parsed
                except Exception as e:
                    logger.warning(f"⚠️ [Gemini Audio STT Error]: {e}")

        except Exception as e:
            logger.error(f"❌ [Tier 2 Audio Extraction Error]: {e}")

    return []

# ==========================================
# SLIDING WINDOW: GỘP CÂU HOÀN CHỈNH (5-12s)
# ==========================================
def merge_cues_sliding_window(raw_cues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not raw_cues:
        return []

    merged = []
    current = {
        "start": round(raw_cues[0]["start"], 2),
        "end": round(raw_cues[0]["start"] + raw_cues[0]["duration"], 2),
        "text": raw_cues[0]["text"].strip()
    }
    
    sentence_end = re.compile(r'[.!?]$')
    for cue in raw_cues[1:]:
        cue_start = round(cue["start"], 2)
        cue_end = round(cue_start + cue["duration"], 2)
        cue_text = cue["text"].strip()
        
        duration = cue_end - current["start"]
        is_end = bool(sentence_end.search(current["text"]))
        
        if (is_end and duration >= 4.5) or duration >= 12.0:
            merged.append(current)
            current = {"start": cue_start, "end": cue_end, "text": cue_text}
        else:
            current["text"] += " " + cue_text
            current["end"] = cue_end
            
    if current["text"]:
        merged.append(current)

    # Nối đuôi end_time đến sát câu kế tiếp
    for k in range(len(merged) - 1):
        merged[k]["end"] = max(merged[k]["end"], merged[k+1]["start"])
    if merged:
        merged[-1]["end"] += 2.0

    return merged

# ==========================================
# TIER 3: DỊCH THUẬT SONG NGỮ CAO CẤP (GEMINI / GTX)
# ==========================================
def translate_en_to_vi_gtx(text: str) -> str:
    """Fallback dịch nhanh qua Google Translate GTX"""
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {"client": "gtx", "sl": "auto", "tl": "vi", "dt": "t", "q": text}
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, params=params, headers=headers, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            if data and data[0]:
                return "".join([piece[0] for piece in data[0] if piece and piece[0]])
    except Exception:
        pass
    return text

def translate_chunks_with_gemini(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Dịch bằng Google Gemini với Sliding Memory Window"""
    if not gemini_model or not chunks:
        return []

    input_data = [
        {"start_time": c["start"], "end_time": c["end"], "en_text": c["text"]}
        for c in chunks
    ]

    prompt = (
        "Bạn là chuyên gia dịch thuật phụ đề song ngữ Anh - Việt cao cấp cho ứng dụng ShortLearn.\n"
        "Nhiệm vụ: Dịch mảng câu tiếng Anh sau sang tiếng Việt tự nhiên, phù hợp với ngữ cảnh video ngắn của người bản xứ.\n"
        "Yêu cầu:\n"
        "1. Giữ nguyên start_time và end_time cho mỗi phần tử.\n"
        "2. Dịch nghĩa chính xác, văn phong tự nhiên.\n"
        "3. Trả về đúng định dạng JSON mảng các đối tượng:\n"
        f"{json.dumps(input_data, ensure_ascii=False)}"
    )

    try:
        res = gemini_model.generate_content(prompt)
        text_res = res.text.strip()
        data = json.loads(text_res)
        if isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    data = v
                    break
        if isinstance(data, list) and len(data) > 0:
            results = []
            for idx, item in enumerate(data):
                results.append({
                    "cue_index": idx,
                    "start_time": float(item.get("start_time", 0.0)),
                    "end_time": float(item.get("end_time", 0.0)),
                    "en_text": str(item.get("en_text", "")),
                    "vi_text": str(item.get("vi_text", ""))
                })
            return results
    except Exception as e:
        logger.warning(f"⚠️ [Gemini Translation Error]: {e}")

    return []

# ==========================================
# PIPELINE TỔNG HỢP: XỬ LÝ SUBTITLE TOÀN DIỆN
# ==========================================
def process_subtitles_pipeline(video_id: str, platform: str = "youtube") -> Tuple[List[Dict[str, Any]], str]:
    cache_key = f"sub:{platform}:{video_id}"
    
    # 1. Kiểm tra Cache (0ms)
    cached = cache_get(cache_key)
    if cached:
        logger.info(f"⚡ [Cache Hit] Serving {len(cached)} cues for {video_id}")
        return cached, "CACHE_HIT"

    # 2. Tier 1: YouTube Transcript API
    raw_cues = fetch_tier1_transcript(video_id)
    source_type = "ORIGINAL_CAPTIONS"

    # 3. Tier 2: Groq Whisper / Gemini Audio STT nếu Tier 1 không có
    if not raw_cues:
        raw_cues = fetch_tier2_audio_transcription(video_id)
        source_type = "AI_WHISPER_STT"

    if not raw_cues:
        return [], "NO_CAPTIONS"

    # 4. Gộp câu hoàn chỉnh
    merged_cues = merge_cues_sliding_window(raw_cues)
    logger.info(f"🧩 Merged into {len(merged_cues)} sentences for {video_id}")

    # 5. Tier 3: Dịch thuật ngữ cảnh bằng Gemini
    translated = []
    if gemini_model:
        logger.info(f"🧠 Translating via Gemini ({GEMINI_MODEL_NAME})...")
        translated = translate_chunks_with_gemini(merged_cues)

    # Fallback sang GTX nếu Gemini không khả dụng hoặc lỗi
    if not translated:
        logger.info("ℹ️ Translating via Google Translate GTX Fallback...")
        for idx, item in enumerate(merged_cues):
            vi = translate_en_to_vi_gtx(item["text"])
            translated.append({
                "cue_index": idx,
                "start_time": item["start"],
                "end_time": item["end"],
                "en_text": item["text"],
                "vi_text": vi
            })

    # 6. Lưu vào Cache (Redis + Memory)
    if translated:
        cache_set(cache_key, translated)
        logger.info(f"💾 Cached {len(translated)} bilingual cues for {video_id} (Source: {source_type})")

    return translated, source_type

# ==========================================
# REST API ENDPOINTS
# ==========================================
@app.post("/api/v1/subtitles/request")
def request_subtitles(body: SubtitleRequest):
    video_id = body.video_id
    platform = body.platform or "youtube"
    logger.info(f"📥 [POST /request] Video: {video_id} ({platform})")

    data, source = process_subtitles_pipeline(video_id, platform)
    if data:
        return {
            "status": "READY",
            "source": source,
            "video_id": video_id,
            "data": data
        }
    else:
        return {
            "status": "FAILED",
            "source": source,
            "video_id": video_id,
            "message": "Could not extract or transcribe subtitles for this video.",
            "data": []
        }

@app.get("/api/v1/subtitles/{video_id}")
@app.get("/subtitles/{video_id}")
def get_subtitles(video_id: str, platform: str = "youtube"):
    logger.info(f"📥 [GET /subtitles] Video: {video_id}")
    data, source = process_subtitles_pipeline(video_id, platform)
    if data:
        return {
            "status": "READY",
            "source": source,
            "video_id": video_id,
            "data": data
        }
    raise HTTPException(status_code=404, detail="Subtitles not found for this video")

@app.get("/api/v1/vocabulary/due")
def get_due_vocab():
    return {"total_due": 0, "cards": []}

@app.post("/api/v1/vocabulary/save")
def save_vocab():
    return {"success": True, "message": "Saved to review deck"}

if __name__ == "__main__":
    port = int(os.getenv("API_PORT", 5000))
    logger.info(f"🚀 Starting ShortLearn Server-Side AI on http://0.0.0.0:{port} ...")
    uvicorn.run("poc_server:app", host="0.0.0.0", port=port, reload=False)
