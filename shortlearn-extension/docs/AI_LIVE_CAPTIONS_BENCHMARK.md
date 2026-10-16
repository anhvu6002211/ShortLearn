# AI Live Captions benchmark gate

EXT-5 does not select an STT engine yet. `tabCapture` and offscreen audio lifecycle may be exercised without transmitting audio.

Compare local Whisper/WASM and explicit-consent ShortLearn worker using the same English corpus: p50/p95 latency, real-time factor, peak RAM, CPU, 15-minute energy, word error observations, false rejection/acceptance, download size, license, and server cost. Test speech, speech over music, music-only, noise, and multiple speakers.

No engine ships until license review and measured results exist. RMS/VAD is only a speech gate, never a music/dialogue classifier. Remote processing must remain opt-in per capture session.