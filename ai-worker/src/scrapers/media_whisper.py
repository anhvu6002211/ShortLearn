import logging
import os
import tempfile
import threading
from typing import Any, Dict, List

import yt_dlp
from groq import Groq

from ..core.config import (
    GROQ_API_KEY,
    WHISPER_BEAM_SIZE,
    WHISPER_COMPUTE_TYPE,
    WHISPER_CPU_THREADS,
    WHISPER_DEVICE,
    WHISPER_LANGUAGE,
    WHISPER_MODEL,
    WHISPER_MODEL_DIR,
    WHISPER_PROVIDER,
    WHISPER_VAD_MIN_SILENCE_MS,
)

logger = logging.getLogger(__name__)

_local_model = None
_local_model_signature = None
_local_model_lock = threading.Lock()


def _segment_value(segment: Any, key: str, default: Any) -> Any:
    """Handle both dictionaries and Pydantic-style segment objects."""
    if isinstance(segment, dict):
        return segment.get(key, default)
    return getattr(segment, key, default)


def _segments_to_cues(segments: Any) -> List[Dict[str, Any]]:
    cues = []
    for segment in segments or []:
        start = float(_segment_value(segment, 'start', 0.0))
        end = float(_segment_value(segment, 'end', start))
        text = str(_segment_value(segment, 'text', '')).strip()
        if text:
            cues.append({
                'start': max(0.0, start),
                'duration': max(0.5, round(end - start, 2)),
                'text': text,
            })
    return cues


def _get_local_model():
    """Load one quantized model lazily and reuse it across queue tasks."""
    global _local_model, _local_model_signature

    signature = (
        WHISPER_MODEL,
        WHISPER_DEVICE,
        WHISPER_COMPUTE_TYPE,
        WHISPER_CPU_THREADS,
        WHISPER_MODEL_DIR,
    )
    if _local_model is not None and _local_model_signature == signature:
        return _local_model

    with _local_model_lock:
        if _local_model is not None and _local_model_signature == signature:
            return _local_model

        # Lazy import lets a Groq-first deployment start even if the optional
        # native local runtime is temporarily unavailable.
        from faster_whisper import WhisperModel

        options = {
            'device': WHISPER_DEVICE,
            'compute_type': WHISPER_COMPUTE_TYPE,
            'cpu_threads': WHISPER_CPU_THREADS,
        }
        if WHISPER_MODEL_DIR:
            options['download_root'] = WHISPER_MODEL_DIR

        logger.info(
            '[Whisper Local] Loading model=%s device=%s compute=%s.',
            WHISPER_MODEL,
            WHISPER_DEVICE,
            WHISPER_COMPUTE_TYPE,
        )
        _local_model = WhisperModel(WHISPER_MODEL, **options)
        _local_model_signature = signature
        return _local_model


def _transcribe_local(audio_path: str) -> List[Dict[str, Any]]:
    model = _get_local_model()
    language = None if WHISPER_LANGUAGE == 'auto' else WHISPER_LANGUAGE
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=WHISPER_BEAM_SIZE,
        vad_filter=True,
        vad_parameters={'min_silence_duration_ms': WHISPER_VAD_MIN_SILENCE_MS},
        condition_on_previous_text=False,
        word_timestamps=False,
    )
    cues = _segments_to_cues(list(segments))
    logger.info(
        '[Whisper Local] Generated %s cues (language=%s, probability=%.2f).',
        len(cues),
        getattr(info, 'language', language or 'auto'),
        float(getattr(info, 'language_probability', 0.0)),
    )
    return cues


def _transcribe_groq(audio_path: str) -> List[Dict[str, Any]]:
    if not GROQ_API_KEY:
        return []

    groq_client = Groq(api_key=GROQ_API_KEY)
    with open(audio_path, 'rb') as audio_file:
        transcription = groq_client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), audio_file.read()),
            model='whisper-large-v3',
            response_format='verbose_json',
            temperature=0.0,
        )
    return _segments_to_cues(getattr(transcription, 'segments', []) or [])


def _provider_order() -> List[str]:
    if WHISPER_PROVIDER == 'groq' and GROQ_API_KEY:
        return ['groq', 'local']
    providers = ['local']
    if GROQ_API_KEY:
        providers.append('groq')
    return providers


def transcribe_media_url(
    media_url: str,
    media_id: str,
    platform: str,
) -> List[Dict[str, Any]]:
    """Download a small audio stream and transcribe it with Whisper.

    ``media_url`` is constructed by a platform-specific scraper, never accepted
    directly from a queue message. This keeps yt-dlp away from arbitrary URLs.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        audio_out_path = os.path.join(tmp_dir, f'{platform}-{media_id}.m4a')
        ydl_opts = {
            'format': '139/249/250/251/bestaudio[abr<=64]/bestaudio',
            'outtmpl': audio_out_path,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'noplaylist': True,
            'socket_timeout': 10,
            'retries': 2,
        }

        try:
            logger.info('[%s] Downloading low-bitrate audio for %s...', platform, media_id)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([media_url])

            if not os.path.exists(audio_out_path):
                files = os.listdir(tmp_dir)
                if not files:
                    logger.error('[%s] Audio download failed for %s.', platform, media_id)
                    return []
                audio_out_path = os.path.join(tmp_dir, files[0])

            file_size = os.path.getsize(audio_out_path)
            logger.info('[%s] Audio size: %.1fKB.', platform, file_size / 1024)

            for provider in _provider_order():
                try:
                    logger.info('[%s] Transcribing %s with %s Whisper.', platform, media_id, provider)
                    raw_cues = (
                        _transcribe_groq(audio_out_path)
                        if provider == 'groq'
                        else _transcribe_local(audio_out_path)
                    )
                    if raw_cues:
                        logger.info(
                            '[%s] %s Whisper generated %s cues for %s.',
                            platform,
                            provider,
                            len(raw_cues),
                            media_id,
                        )
                        return raw_cues
                except Exception as provider_error:
                    logger.warning(
                        '[%s] %s Whisper failed for %s: %s',
                        platform,
                        provider,
                        media_id,
                        provider_error,
                    )

            return []
        except Exception as error:
            logger.error('[%s] Whisper transcription failed: %s', platform, error)
            return []
