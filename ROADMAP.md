# ShortLearn — Roadmap đang triển khai

> Cập nhật: 08/10/2026. Lịch sử kiến trúc, audit và đặc tả cũ ở [`docs/ROADMAP_ARCHIVE.md`](docs/ROADMAP_ARCHIVE.md).

## Nguyên tắc thực hiện

- Chỉ đánh dấu `[x]` sau nghiệm thu và lệnh kiểm tra module pass.
- Không thêm dữ liệu giả cho streak, lịch sử hoặc notification.
- Không thay đổi Android/Gradle cho task JS; không nâng dependency ngoài yêu cầu.
- Mobile: `cd shortlearn-app && npm run typecheck`.
- Backend: `cd backend && npm run check && npm test`.
- Worker: `cd ai-worker && .\.venv\Scripts\python.exe -m unittest discover test`.

## Đã hoàn thành

- [x] Auth backend: JWT/refresh, scrypt, HMAC OTP, rate limit, phân quyền user; backend 39/39 test pass.
- [x] Mobile auth session: SecureStore, restore, refresh/retry, logout revoke session.
- [x] Splash, onboarding 3 trang, mở lại onboarding từ Cá nhân.
- [x] `LoadingState`, `EmptyState`, `ErrorState`, `OfflineBanner`, Retry tại Shorts/Saved Items.
- [x] 4 tab: **Shorts · Khám phá · Ôn tập · Cá nhân**. Emulator xác nhận; WebView giữ mounted khi đổi tab.
- [x] Cá nhân tách phiên ShortLearn khỏi YouTube/TikTok; thống kê runtime từ đã lưu/thẻ đến hạn, logout ShortLearn.
- [x] Explore mở URL hợp lệ YouTube Shorts/TikTok bằng WebView sẵn có.
- [x] Settings hiển thị phụ đề và auto-pause; auto-pause lưu SecureStore; Back Android đóng Settings.

## Việc đang mở

### P0 — Auth còn lại

- [x] Nghiệm thu Sign Up, OTP, Forgot Password và guest end-to-end.
  - **Đã nghiệm thu:** register → OTP email → verify → đăng nhập; Forgot Password → OTP → đổi mật khẩu → đăng nhập; guest vào Main không tạo session và bị chặn lưu flashcard.
  - **Đã kiểm tra:** lỗi có thông báo thân thiện; `npm run typecheck` pass.

- [ ] Hoàn thiện liên kết YouTube qua Google OAuth.
  - **Trạng thái:** UI tại `shortlearn-app/src/screens/AccountScreen.tsx`; SDK tại `shortlearn-app/App.tsx`; session tại `src/services/youtubeAuth.ts`. Development build `com.shortlearn.app` đã mở account picker, chưa nghiệm thu callback/token/backend/session.
  - **Cấu hình:** Android OAuth client Google Cloud phải khớp `com.shortlearn.app` + SHA-1 keystore APK. `.env` chỉ có `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_API_URL`; không Client Secret. Đổi `.env` phải restart Metro.
  - **Nghiệm thu:** Cá nhân → YouTube → Đăng nhập Google → chọn account → **Đã liên kết YouTube**; đổi/ngắt liên kết; restart app giữ session. Backend verify ID token server-side; YouTube token không dùng làm ShortLearn auth.
  - **Lỗi code 10:** đối chiếu package/SHA-1 APK với Android OAuth client. Không đổi package sang `shortlearn.app`, không chạy `expo prebuild` để thử OAuth. Native rebuild NDK/New Architecture RN 0.86 là task riêng.
  - **DoD:** toàn bộ nghiệm thu pass; `npm run typecheck` pass; nếu sửa backend, `npm run check && npm test` pass.

### P1 — Nghiệm thu mobile

- [ ] Kiểm thử runtime: first install, returning user, token hết hạn, auth thất bại, Settings Back Android.
  - **DoD:** không màn trắng; lỗi không lộ stack/provider; WebView không reload ngoài ý muốn.

### P2 — UX chỉ khi có contract

- [ ] Profile progress API: streak và lịch sử học.
  - **Dependency:** backend endpoint/schema xác định nguồn dữ liệu và timezone. Không dựng UI giả trước API.

- [ ] Explore catalog/search: từ khóa, chủ đề, lịch sử gần đây.
  - **Dependency:** API/catalog video và pagination. Danh sách dài dùng FlashList.

- [ ] Settings mở rộng: language, dark mode, push, xóa tài khoản.
  - **Dependency:** product decision; push/delete account cần API + policy; không chỉ thêm UI.

### P3 — Chỉ sau MVP

- [ ] Offline toàn cục, cache, hàng đợi idempotent cho save/review.
- [ ] Push review/subtitle processing, xin quyền theo ngữ cảnh.
- [ ] Notification Center, deep link.
- [ ] E2E/auth/navigation/accessibility/performance/crash reporting.
