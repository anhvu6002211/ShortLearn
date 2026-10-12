# ShortLearn — Roadmap triển khai

> Cập nhật: 11/10/2026. Lịch sử kiến trúc, audit và đặc tả cũ: [`docs/ROADMAP_ARCHIVE.md`](docs/ROADMAP_ARCHIVE.md).
>
> Phạm vi: MVP học tiếng Anh qua YouTube Shorts/TikTok, phụ đề song ngữ, lưu từ và ôn FSRS. Liên kết nền tảng chỉ triển khai qua OAuth chính thức; không lưu mật khẩu, OTP hoặc cookie của nhà cung cấp.

## Quy ước

- `[x]` chỉ dùng cho hạng mục đã nghiệm thu hoặc có kiểm tra tự động pass.
- Không dựng dữ liệu giả cho streak, lịch sử, notification hoặc catalog.
- Không nâng dependency, sửa native Android/Gradle hoặc đổi API contract ngoài task.
- Kiểm tra bắt buộc: mobile `npm run typecheck`; backend `npm run check && npm test`; worker `.\.venv\Scripts\python.exe -m unittest discover test`.

## Đã hoàn thành

### Nền tảng ứng dụng

- [x] Mobile: 4 tab **Shorts · Khám phá · Ôn tập · Cá nhân**; WebView giữ mounted khi đổi tab.
- [x] Onboarding 3 trang; có thể mở lại từ Cá nhân.
- [x] Loading/empty/error/offline state và Retry tại Shorts/Saved Items.
- [x] Settings phụ đề, auto-pause; preference lưu SecureStore; Back Android đóng Settings.
- [x] Explore nhận URL YouTube Shorts/TikTok hợp lệ và mở bằng WebView hiện có.
- [x] Sửa hiển thị tiếng Việt tại luồng phụ đề và thông báo liên quan.

### Tài khoản và học tập

- [x] Backend auth: JWT/refresh rotation, scrypt, OTP HMAC, rate limit, phân quyền theo user; `npm run check` và 39/39 test pass.
- [x] Mobile session: SecureStore, restore, refresh/retry, logout/revoke session.
- [x] Đã nghiệm thu: đăng ký → OTP email → xác minh → đăng nhập; quên mật khẩu → OTP → đổi mật khẩu → đăng nhập; guest không tạo session và không thể lưu flashcard.
- [x] Cá nhân tách phiên ShortLearn khỏi phiên nền tảng; hiển thị số từ đã lưu/thẻ đến hạn từ runtime.
- [x] Lưu từ vựng, tải thẻ đến hạn và chấm điểm FSRS đã có API/UI.

### Hạ tầng phát triển

- [x] Local Android development build gọi được API HTTP qua cleartext traffic.
- [x] Stack MySQL, Redis, RabbitMQ, API Gateway và AI worker có cấu hình chạy cục bộ.

## Ưu tiên triển khai

### P0 — Nghiệm thu MVP trước khi phát hành thử

- [ ] **E2E phụ đề cho video thật.**
  - Kiểm tra YouTube Shorts và TikTok: tạo task → RabbitMQ → worker → lưu kết quả → app hiển thị phụ đề song ngữ.
  - Kiểm tra video không có caption, lỗi worker, retry có chủ đích và trạng thái `FAILED`; UI không treo hoặc hiển thị lỗi kỹ thuật.
  - DoD: mỗi nền tảng có ít nhất một ca thành công và một ca lỗi được xử lý rõ ràng.

- [ ] **E2E dữ liệu học có tài khoản.**
  - Kiểm tra lưu từ trùng, tải lại app, refresh token, chấm bốn mức FSRS, đổi tài khoản và cô lập dữ liệu giữa hai user.
  - DoD: không mất dữ liệu, không gửi `user_id` từ client, lịch ôn thay đổi đúng sau mỗi rating.

- [ ] **Ma trận runtime mobile.**
  - First install, returning user, logout, access token hết hạn, mất mạng, backend không sẵn sàng, Settings Back Android, đổi tab khi WebView đang phát.
  - DoD: không màn trắng; không lộ stack/secret; WebView không reload ngoài ý muốn.

- [ ] **Sẵn sàng môi trường thử nghiệm.**
  - Rà soát `.env.example`, biến bắt buộc, CORS origin, JWT/OTP secret, delivery OTP, `/health/ready` và log không chứa token/OTP.
  - DoD: môi trường sạch khởi động được theo README; cấu hình thiếu hoặc sai báo lỗi an toàn.

- [ ] **HTTPS công khai 0 đồng cho bản demo/beta.**
  - [x] API Gateway cục bộ được xuất qua Cloudflare Quick Tunnel, không mở port router.
  - [x] `/health` trả `UP`; `/health/ready` trả `READY` với MySQL, Redis và RabbitMQ `UP` qua URL HTTPS công khai.
  - [x] `EXPO_PUBLIC_API_URL` đã đổi khỏi `127.0.0.1`; release bundle chứa URL HTTPS; APK build, cài đè và cold launch pass, logcat sạch lỗi fatal/network.
  - [ ] Nghiệm thu auth, phụ đề AI, lưu từ và ôn tập từ thiết bị dùng 4G/5G; kiểm tra dừng tunnel hiển thị lỗi/retry thay vì loading vô hạn.
  - Giới hạn: máy phát triển và tunnel phải bật; URL Quick Tunnel đổi khi khởi động lại; không dùng cho production/dữ liệu quan trọng.
  - DoD: toàn bộ luồng dữ liệu pass từ thiết bị ngoài LAN; failure mode rõ ràng; URL tunnel không hardcode/commit.

### P1 — Củng cố sau nghiệm thu MVP

- [ ] **Đồng bộ UI theo [Stitch — ShortLearn Android UI Redesign](https://stitch.withgoogle.com/preview/16775457781702016079?node-id=f58671a77d2e402d87a3d2383790b2ca).**
  - [x] **UI-1 — Nền tảng giao diện:** design tokens dark cinematic/glassmorphism tại [`theme.ts`](shortlearn-app/src/styles/theme.ts); không thêm UI framework.
  - [x] **UI-2 — Navigation và state dùng chung:** [`BottomNavigation.tsx`](shortlearn-app/src/navigation/BottomNavigation.tsx), [`StateViews.tsx`](shortlearn-app/src/components/common/StateViews.tsx); giữ 4 tab, badge và touch target tối thiểu 44×44 px.
  - [x] **UI-3 — Khám phá:** [`ExploreScreen.tsx`](shortlearn-app/src/screens/ExploreScreen.tsx); giữ parser URL YouTube Shorts/TikTok, validation và callback WebView.
  - [x] **UI-4 — Shorts và phụ đề:** [`ShortsScreen.tsx`](shortlearn-app/src/screens/ShortsScreen.tsx), [`LanguageReactorOverlay.tsx`](shortlearn-app/src/components/LanguageReactorOverlay.tsx); không đổi bridge, injected script, auto-unmute, capture-phase swipe hoặc trạng thái mounted.
  - [x] **UI-5 — Tra từ/lưu thẻ:** bottom sheet tra từ/lưu Flashcard đã đồng bộ; giữ API lưu từ, guest restriction và trạng thái học thật.
  - [x] **UI-6 — Ôn tập:** [`FlashcardReview.tsx`](shortlearn-app/src/components/FlashcardReview.tsx) đã đồng bộ semantic cho bốn rating; giữ thuật toán/API FSRS.
  - [x] **UI-7 — Cá nhân/cài đặt:** [`AccountScreen.tsx`](shortlearn-app/src/screens/AccountScreen.tsx), [`SettingsScreen.tsx`](shortlearn-app/src/screens/SettingsScreen.tsx); giữ auth, runtime stats và preference thật.
  - [x] **UI-8 — Brand assets:** app icon, adaptive icon và splash dùng assets hiện có qua [`app.json`](shortlearn-app/app.json); không sửa trực tiếp `android/`.
  - [x] **Kiểm tra tự động:** `npm run typecheck` và `npx expo config --type public` pass sau batch UI-8; `npm run typecheck` pass lại sau QA Android.
  - [x] **QA-1 — Layout 390×844:** 5 màn hình, safe area, bottom navigation và bàn phím Explore đã kiểm tra trên emulator `1080×2337 @ 443 dpi`; khu Bản chép lời đã bỏ theo quyết định sản phẩm, còn bottom sheet tra từ sau wipe.
  - [ ] **QA-2 — WebView regression:** cùng instance `RNCWebView` (`84b4708`) vẫn mounted qua Shorts → Explore → Shorts; URL YouTube/TikTok nạp, tap/swipe không crash; TikTok public feed lấy được video ID thật `7691926048987958580`; sau offline/reconnect WebView được tạo lại bình thường (`2800be7`); logcat sạch `FATAL EXCEPTION`/`ReactNativeJS ERROR`/`TypeError`/`Invariant Violation`; còn nghe auto-unmute và kiểm tra replay/câu tiếp/Short tiếp/auto-pause với subtitle thật.
  - [ ] **QA-3 — Learning regression:** Account guest và Review empty state đã kiểm tra với backend qua `adb reverse`; còn lưu từ, tải lại app, bốn rating FSRS, đổi tài khoản và số liệu thật sau wipe.
  - [ ] **QA-4 — Trạng thái và accessibility:** label/touch target chính và empty state đã kiểm tra; chu kỳ tắt/bật Wi‑Fi phục hồi về `MainActivity` không crash/runtime error; còn xác nhận UI error/retry của video, loading, TalkBack focus và contrast trên thiết bị thật.
  - [ ] **QA-5 — Brand/native:** development build cài/chạy thành công; release không-transcript build/cài đè/cold launch pass; còn xác nhận trực quan launcher adaptive icon và splash/lockup đầy đủ.
  - **DoD tổng:** QA-1 → QA-5 pass trên thiết bị Android thật; không đổi API contract hoặc behavior học tập.

- [ ] **Regression tối thiểu.**
  - Bổ sung test cho các lỗi E2E tìm được ở P0; giữ typecheck/backend test/worker test trong quy trình trước merge.
  - Cân nhắc smoke test device cho auth, mở video, lưu từ và review sau khi luồng ổn định.

- [ ] **Progress API thật.**
  - Thiết kế endpoint/schema cho streak và lịch sử học, quy ước timezone, rồi mới hiển thị tại Cá nhân.
  - Không làm UI giả trước khi có contract backend.

- [ ] **Quan sát vận hành tối thiểu.**
  - Log có cấu trúc cho API/worker, correlation ID cho subtitle task, chỉ số queue thất bại/retry và hướng dẫn khôi phục lỗi.
  - Không ghi PII, access token, refresh token hay OTP vào log.

- [ ] **Release signing và cấu hình production.**
  - Tạo release keystore riêng, lưu ngoài repository/secret store; không dùng debug key để phát hành.
  - Quản lý signing bằng biến môi trường hoặc Gradle properties không commit; tăng `versionCode` mỗi bản.
  - Production chỉ dùng API HTTPS và tắt cleartext HTTP; development vẫn cho phép API local có kiểm soát.
  - DoD: APK/AAB release ký đúng key, cài/nâng cấp được, cold launch pass; không có secret trong Git hoặc bundle.

- [ ] **Phân loại lỗi mạng và retry.**
  - [x] Luồng phụ đề phân biệt backend/transport error, worker `FAILED`, AI xử lý quá lâu và video không có subtitle.
  - [x] Transcript dùng `ErrorState` + nút **Thử lại**; đổi video tự xóa lỗi; video/WebView vẫn hoạt động và không remount khi subtitle lỗi.
  - [x] Typecheck, release build, cài đè, cold launch và logcat pass.
  - [ ] Nghiệm thu chủ động từng failure mode: mất mạng, dừng tunnel/backend, video giới hạn vùng, worker fail và retry phục hồi.
  - DoD: copy rõ ràng, retry có giới hạn/backoff, không loading vô hạn và log không lộ dữ liệu nhạy cảm.

- [ ] **TikTok fallback ổn định.**
  - [x] Chọn TikTok mở public For You feed, không ép đăng nhập; đăng nhập phone/email/username vẫn giữ riêng trong Cá nhân.
  - [x] Feed TikTok thật tải trên emulator mà không cần tài khoản; bridge gửi video ID thật `7691926048987958580`; `MainActivity` giữ foreground; release build/cài đè pass; logcat sạch runtime error.
  - [x] Khu Bản chép lời/loading card đã bỏ khỏi UI theo quyết định sản phẩm; phụ đề song ngữ, tra từ và AI nền vẫn giữ; typecheck và release smoke test pass.
  - Google/Facebook không được coi là ổn định trong WebView; chỉ tích hợp Login Kit khi có Client Key, redirect URI, scope tối thiểu và app review.
  - [ ] Nghiệm thu login/failure, đổi video và subtitle reset đúng; cả Gemini và Groq hiện `429`, AI worker đã tạm dừng để tránh retry tốn quota; queue được bảo toàn `34 ready / 0 active`, DLQ `72`; lần chạy sau dùng Gemini primary, `LLM_BATCH_SIZE=12`.
  - DoD: public/login/failure flow đều thoát được, không giả lập username/canonical URL và không bypass chính sách TikTok.

### P2 — Phát hành sau khi beta đã pass

- [ ] **Release signing, HTTPS-only và store build.**
  - Tạo release keystore riêng ngoài repository/secret store; tăng `versionCode` mỗi bản; production tắt cleartext HTTP.
  - Xuất AAB cho Google Play; APK arm64 chỉ tạo khi cần phân phối nội bộ.
  - [x] Đã gỡ `expo-dev-client` cùng dev launcher/menu khỏi dependency tree và production build; typecheck, release build, cài đè và cold launch pass; logcat không có crash/runtime error.
  - [x] APK production-test hiện tại `79,686,316` bytes, SHA-256 `E056EC7D442F0CCF0948DB8B0F32237E95F84447EE43E8611AC1F991CBCBE0D7`; gỡ dev client không giảm đáng kể APK 4 ABI.
  - [x] `bundleRelease` tạo AAB `41,088,794` bytes, SHA-256 `793A29139AC53A12B05B11A10299EF68AD87711EEE686B9B2F25B2F5CA9C304B`; `jarsigner` verify pass nhưng certificate vẫn là `CN=Android Debug`, chỉ dùng kiểm chứng, không upload production.
  - DoD: APK/AAB ký đúng key, nâng cấp được, production không chứa dev launcher/menu, build/cold launch pass.

- [ ] **Audit dependency có kiểm soát.**
  - [x] Đã phân loại `npm audit`: toàn bộ `9 moderate / 28 high / 0 critical`; production `8 moderate / 27 high / 0 critical`; đa số thuộc Expo CLI/Metro/RN transitive tooling.
  - [x] Không chạy `npm audit fix --force`; đề xuất tự động downgrade Expo 57 → 44 và RN 0.86 → 0.72 bị loại vì sai ma trận hiện tại.
  - [x] Đã bỏ khai báo trực tiếp `expo-modules-core`; Expo vẫn cung cấp `57.0.21` transitively; typecheck và release build pass.
  - [x] Expo Doctor cải thiện `18/21` → `20/21`; chỉ còn cảnh báo app config không tự sync vì repository giữ native `android/`.
  - [ ] Theo dõi bản vá tương thích Expo SDK 57/RN 0.86; không nâng dependency riêng lẻ khi upstream chưa xác nhận.
  - DoD: có disposition cho mọi advisory; lỗi runtime có đường xử lý; không tạo regression native.

- [ ] **Privacy, Terms và xóa tài khoản.**
  - Public Terms/Privacy nêu dữ liệu, retention, third party và contact; thêm API/UI xóa tài khoản cùng dữ liệu liên quan.
  - Xóa tài khoản thu hồi session/refresh token và Google access; giải thích rõ cookie TikTok chỉ nằm trong WebView thiết bị.
  - DoD: deletion E2E pass; policy URL và retention sẵn sàng cho store/OAuth review.

- [ ] **Đo WebView trước khi tối ưu.**
  - Giữ instance hiện tại; đo CPU/RAM, listener/timer và cold-start trên thiết bị thật.
  - Chỉ giảm interval/DOM scan khi số liệu chứng minh bottleneck; không phá bridge, swipe, auto-unmute hoặc caption detection.
  - DoD: có baseline và regression YouTube/TikTok; CPU/RAM không tăng theo số lần đổi video/tab.

### Backlog sau beta — Chỉ mở khi có nhu cầu hoặc số liệu

- **Subtitle cache cục bộ:** chỉ làm khi đo thấy mở lại video chậm hoặc có yêu cầu xem subtitle offline; khi đó dùng key đủ ngôn ngữ, TTL và size cap.
- **Offline queue save/review:** chỉ làm khi người dùng cần học offline; phải có idempotency và conflict policy trước.
- **Crash reporting:** thêm Sentry/Crashlytics khi có người dùng ngoài beta nội bộ; bắt buộc scrub token, OTP, cookie và nội dung riêng tư.
- **Cải tiến onboarding:** onboarding 3 trang hiện đã đủ; chỉ thêm chọn ngôn ngữ/nền tảng theo phản hồi thực tế.
- **Progress API, Explore catalog/search, Settings mở rộng:** chỉ làm sau khi contract, nguồn dữ liệu và nhu cầu sản phẩm rõ.
- **Push, Notification Center, deep link:** không phải blocker học tập; hoãn sau MVP ổn định.
- **TikTok Login Kit:** chỉ làm khi có TikTok Developer App, Client Key, redirect URI và review.

## Thứ tự thực hiện

1. Hoàn tất E2E phụ đề, dữ liệu học và ma trận runtime P0.
2. Nghiệm thu HTTPS beta bằng thiết bị thật qua 4G/5G.
3. Nghiệm thu lỗi mạng/retry và TikTok public-feed/login fallback.
4. Hoàn tất QA giao diện, WebView, learning và regression test.
5. Chốt release signing, HTTPS-only, Privacy/Terms và xóa tài khoản.
6. Audit dependency; tạo AAB/store build không chứa dev client.
7. Đo WebView; chỉ tối ưu hoặc mở backlog khi số liệu/nhu cầu chứng minh cần thiết.
