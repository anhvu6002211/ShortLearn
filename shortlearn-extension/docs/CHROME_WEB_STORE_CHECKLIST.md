# Chrome Web Store release checklist

## Required assets

- [x] Extension icons 16/32/48/128 generated locally and included in `dist/`.
- [ ] Promotional artwork approved.
- [ ] Public Privacy URL and Terms URL deployed over HTTPS.
- [ ] Support/contact URL confirmed.
- [ ] Screenshots captured from tested Chrome release build.

## Product disclosure

- [x] Manifest V3; no remotely hosted executable code.
- [x] Exact host access: YouTube, TikTok, Instagram.
- [x] `storage`: ShortLearn API origin and session tokens in extension storage only.
- [x] `activeTab` + `tabCapture`: capture begins only from explicit popup action.
- [x] `offscreen`: owns tab audio stream and reconnects playback while MV3 worker sleeps.
- [x] No platform cookies, DRM/login/CAPTCHA bypass, or audio upload in this build.
- [ ] Store data-use form reviewed against deployed Privacy policy.

## Verification gate

- [x] TypeScript strict, tests, and production build pass.
- [x] Reproducible `npm run package` generates ZIP from `dist/`.
- [x] ZIP SHA-256: `B3CC1093F93DD2C0AD3D719F7B6C8018AFAF2F01C469974ED5DAF149D57ADD65`.
- [ ] Chrome runtime matrix complete.
- [ ] Edge runtime matrix complete.
- [ ] Auth/save/review/Android sync tested with a real ShortLearn account.
- [ ] User-gesture tab capture, audible playback, revoke, close-tab, and suspend tested.
- [ ] Accessibility keyboard/screen-reader audit complete.
- [ ] CPU/RAM 15-minute baseline recorded.
- [ ] Legal approval for STT engine/license; not shipped until approved.