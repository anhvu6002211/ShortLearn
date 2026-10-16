# Chrome Web Store release checklist

## Required assets

- [ ] Final 128 px icon and promotional artwork approved.
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
- [x] ZIP generated from `dist/` and SHA-256 recorded.
- [ ] Chrome runtime matrix complete.
- [ ] Edge runtime matrix complete.
- [ ] Auth/save/review/Android sync tested with a real ShortLearn account.
- [ ] User-gesture tab capture, audible playback, revoke, close-tab, and suspend tested.
- [ ] Accessibility keyboard/screen-reader audit complete.
- [ ] CPU/RAM 15-minute baseline recorded.
- [ ] Legal approval for STT engine/license; not shipped until approved.