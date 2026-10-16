# ShortLearn Extension

Manifest V3 extension for YouTube, TikTok Web, and Instagram Reels.

## Build

```powershell
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Load `dist/` from `chrome://extensions` using **Load unpacked**.

## Permissions

- `storage`: stores the ShortLearn session inside extension storage, never page DOM/content attributes.
- `tabCapture`: starts only after an explicit popup action for AI Live Captions.
- `offscreen`: owns captured audio and restores tab playback while MV3 service worker may suspend.
- Host access is limited to YouTube, TikTok, and Instagram adapters.

The extension never reads platform cookies, bypasses DRM/login/CAPTCHA, or loads remote executable code. Audio is not uploaded. STT remains disabled until the benchmark and license gate in `docs/AI_LIVE_CAPTIONS_BENCHMARK.md` is complete.

## Current status

YouTube caption overlay and DOM fallback run in Chrome. Authentication/save-word and TikTok/Instagram adapters require environment/runtime acceptance. AI capture lifecycle is scaffolded; no STT engine is shipped.