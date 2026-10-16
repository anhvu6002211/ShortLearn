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
  - [x] Đổi video tự xóa lỗi; video/WebView vẫn hoạt động và không remount khi subtitle lỗi; khu transcript/error card đã bỏ theo quyết định sản phẩm.
  - [x] Typecheck, release build, cài đè, cold launch và logcat pass.
  - [ ] Nghiệm thu chủ động từng failure mode: mất mạng, dừng tunnel/backend, video giới hạn vùng, worker fail và retry phục hồi; lỗi cần hiển thị tại subtitle overlay hoặc thông báo không chặn video.
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

### Web responsive/PWA — Client bổ sung sau khi P0 mobile ổn định

- [ ] **WEB-1 — Chốt contract xử lý URL dùng chung.**
  - Tái sử dụng auth, subtitle request/status, tra/lưu từ và review API hiện có; chuẩn hóa input `platform + canonical video URL/ID` và trạng thái `PENDING | PROCESSING | READY | FAILED`.
  - YouTube/TikTok dùng extractor riêng ở worker nhưng trả cùng subtitle contract; ưu tiên caption chính thức, fallback tải audio + Whisper.
  - Lưu transcript tiếng Anh trước; dịch Việt là bước sau để hết quota dịch không chặn toàn bộ phụ đề.
  - DoD: contract/test backend-worker pass; không tạo API song song hoặc phụ thuộc DOM feed/WebView.

- [ ] **WEB-2 — MVP web responsive: dán URL → xử lý → học.**
  - Tạo module `shortlearn-web/` sau khi WEB-1 ổn định; chạy trên desktop/mobile browser, có thể Add to Home Screen.
  - Chỉ gồm đăng nhập, ô URL, trạng thái xử lý, video/embed khi được phép, phụ đề Anh–Việt và retry rõ ràng.
  - Không làm feed vuốt, browser extension, catalog, notification hoặc UI giả trong MVP.
  - DoD: URL hợp lệ/không hợp lệ, video có/không caption, worker fail và quota dịch đều có trạng thái hữu hạn; responsive và keyboard-accessible.

- [ ] **WEB-3 — Learning dùng chung tài khoản.**
  - Tái sử dụng API tra/lưu từ, danh sách đã lưu và bốn rating FSRS; đồng bộ với mobile bằng cùng ShortLearn account.
  - Ưu tiên cookie HttpOnly/SameSite/Secure thay `localStorage`; hoàn thiện CORS/CSRF và Privacy trước public beta.
  - DoD: lưu từ trên web xuất hiện ở mobile, review không chấm hai lần và đăng xuất thu hồi session đúng.

- [ ] **WEB-4 — Triển khai HTTPS/PWA.**
  - Production dùng origin HTTPS ổn định, không dùng Quick Tunnel; service worker không cache token hoặc dữ liệu riêng tư.
  - SEO cho landing/public policy; trang học/auth không index.
  - DoD: deploy repeatable, offline shell không giả trạng thái học, accessibility/performance đạt baseline đã chốt.

### Android external captions — YouTube WebView + phụ đề ngoài ứng dụng

> Nhánh triển khai: `feat/youtube-external-captions-poc-20261015`. Không merge `main` trước khi build và nghiệm thu thiết bị. Mọi dấu `[x]` bên dưới chỉ áp dụng cho phần đã kiểm tra; UI/POC không được coi là overlay hoặc capture hoàn chỉnh.

#### Kết quả audit M1 — 15/10/2026

- [x] **Phạm vi UI YouTube-only:** lựa chọn TikTok WebView đã được thay bằng lối vào External Captions Lab; YouTube Shorts tiếp tục dùng WebView, bridge, phụ đề Anh–Việt, tra từ, lưu thẻ và FSRS hiện có. Backend/schema/worker TikTok được giữ để không phá tương thích.
- [x] **Baseline hiện tại:** [`ExternalCaptionsModal.tsx`](shortlearn-app/src/screens/ExternalCaptionsModal.tsx) chỉ là màn hình lab; [`WhisperMicPoc.tsx`](shortlearn-app/src/components/WhisperMicPoc.tsx) nhận microphone bằng `whisper.rn` + `AudioPcmStreamAdapter`, model `ggml-tiny.bin`. Chưa có MediaProjection, AudioPlaybackCapture, foreground service hoặc `TYPE_APPLICATION_OVERLAY`.
- [x] **Audit Hearth:** repository tham khảo dùng Apache-2.0. Kiến trúc phù hợp để học mẫu, không sao chép ứng dụng/UI/thương hiệu: một foreground `CaptionCaptureService` sở hữu consent MediaProjection, `AudioRecord`, caption engine và overlay; overlay tách controller/window/config; PCM/VAD/Whisper tách khỏi UI; stop/revoke tập trung giải phóng recorder, projection, jobs và overlay.
- [x] **Phân loại tái sử dụng:** có thể chuyển thể các pattern lifecycle, state machine, PCM read loop, resampling, VAD gate, tap-through/interactive overlay và test geometry nếu giữ notice/bản quyền Apache-2.0. Phải tự phát triển React Native bridge, Expo config/native registration, tích hợp auth/vocabulary/translation ShortLearn, Smart Subtitle Filter và UX tiếng Việt. Không nhập toàn bộ Hearth hoặc vendored model/thư viện khi chưa audit license riêng.
- [x] **Giới hạn nền tảng:** AudioPlaybackCapture cần Android 10+ và MediaProjection consent cho từng phiên; ứng dụng nguồn/DRM có thể chặn capture. Không bypass. Khi PCM nội bộ không khả dụng phải báo rõ và chỉ dùng microphone sau khi người dùng chủ động chọn.
- [x] **Lựa chọn kiến trúc:** Kotlin native module trong ứng dụng RN hiện tại; một foreground service sở hữu tài nguyên dài hạn; RN chỉ preflight/start/stop/observe state. PCM mono 16 kHz signed 16-bit là contract mục tiêu cho Whisper. Không truyền PCM liên tục qua JS bridge; STT/VAD chạy native để giảm latency, GC và pin.

#### M2 — Native service, quyền và overlay thật

- [x] Native module tối thiểu đã khai báo `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, foreground service và `mediaProjection` cho target SDK 36; không thêm dependency.
- [x] Preflight thật trả Android support, overlay permission và service state; UI có `idle | running | stopped | blocked | error` cùng lỗi permission từ native bridge.
- [x] Mỗi lần start mở system MediaProjection consent; không lưu consent, không tự chạy sau boot.
- [x] Foreground service có notification cố định với action Dừng; projection callback, task removal, force-stop và lifecycle service cùng cleanup recorder/projection/overlay.
- [ ] Overlay `TYPE_APPLICATION_OVERLAY` đã xuất hiện thật trên Instagram, có nút thu gọn/Dừng và drag handler; còn nghiệm thu thủ công kéo, thu gọn, Dừng từ overlay và notification.
- [x] AudioPlaybackCapture đã đọc PCM thật trên Android 16/API 36: mono, signed PCM 16-bit, 16 kHz; foreground type `mediaProjection`, overlay và projection đều active, không crash.
- [ ] DoD M2: overlay xuất hiện ngoài ShortLearn và system force-stop giải phóng sạch (`service/projection/overlay=false`); còn xác nhận cả hai nút Dừng và projection revoke bằng thao tác người dùng trước khi đóng M2.

#### M3 — AudioPlaybackCapture → Smart Filter → Whisper → tiếng Anh

- [x] Tạo `AudioPlaybackCaptureConfiguration` từ MediaProjection, `AudioRecord` playback source; zero/silent PCM chuyển sang `blocked` thay vì giả định thành công.
- [x] Microphone fallback chỉ khởi chạy sau lựa chọn rõ ràng bằng nút riêng khi playback bị `blocked`; UI/notification hiển thị nguồn `Âm thanh nội bộ` hoặc `Microphone`, không tự chuyển nguồn. Build pass; còn nghiệm thu audio thật trên máy thật.
- [ ] PCM không đi qua JS: đã có buffer giới hạn 8 giây, PCM 16 kHz mono, RMS VAD/windowing và Whisper local JNI; còn benchmark `tiny`/`base` trên cùng bộ mẫu bằng latency, RTF, RAM, pin và lỗi từ.
- [ ] Smart Subtitle Filter đã có UI ba mức `Nhẹ | Cân bằng | Mạnh`, mặc định `Cân bằng`; native áp dụng profile RMS tương ứng, silence endpoint, loại marker nhạc/im lặng, repetition và duplicate. Còn benchmark false reject/accept và classifier confidence/no-speech/entropy/compression sau audit license; không giả lập chỉ số Whisper chưa được JNI cung cấp.
- [ ] Đo false rejection của lời nói và false acceptance/hallucination trên mẫu speech, instrumental, vocal music, noise, background music và nhiều người nói. Không công bố độ chính xác 100% hoặc dùng một threshold cho mọi nguồn.
- [x] Stop/blocked flush generation và buffer cũ; kết quả inference cũ bị loại, câu trùng liên tiếp không hiện lại. Việc nhận biết vuốt/video mới tự động vẫn cần tín hiệu nguồn khả dụng.
- [ ] DoD M3: JNI, UI ba mức filter và build release đã pass, nhưng còn cần máy thật có model để quan sát ít nhất một nguồn PCM → Whisper → chữ tiếng Anh và nghiệm thu microphone fallback thật.

#### M4 — Song ngữ, tra từ và Flashcard

- [ ] Tiếng Anh luôn hiển thị native độc lập; câu đã lọc phát event tần suất thấp sang RN, dịch Việt tái sử dụng `translation.ts` (LRU cache, Promise dedupe, timeout/fallback) và native generation guard loại kết quả cũ. Typecheck/Kotlin compile pass. Theo quyết định kiến trúc hiện tại, dịch có thể tạm dừng khi Android suspend JS nền; lỗi dịch không xóa câu Anh. Còn nghiệm thu runtime thật.
- [x] Chỉ câu đã qua Smart Filter mới phát event dịch; PCM không qua JS và audio không upload.
- [ ] Chế độ tương tác dùng nút `Tra từ` trên handle để mở panel native riêng; caption chính vẫn `FLAG_NOT_TOUCHABLE`, không chặn gesture video. Panel token hóa tối đa 12 từ, phát event lookup/save sang RN, tái dùng dịch và authenticated vocabulary API; payload dùng `platform: external_capture`, `video_id/timestamp_mark = NULL`. Backend lưu `source_platform`, migration idempotent và 39/39 test pass. Còn nghiệm thu Saved Items/FSRS trên tài khoản thật.
- [x] Không thêm pause/seek/control TikTok, Instagram hoặc YouTube native khi không có API được phép.
- [ ] DoD M4: luồng song ngữ đã build pass nhưng cần máy thật kiểm tra lỗi dịch vẫn giữ câu Anh; tra/lưu từ tương tác và xác nhận Saved Items/FSRS chưa hoàn thành.

#### M5 — QA, hiệu năng và phát hành thử

- [ ] Ma trận Android 13/14/15/16 theo thiết bị có sẵn; app switch, lock screen, revoke projection/overlay/mic, process death, restart phiên, offline/quota, Bluetooth/có dây, nền nhạc, nhiều người nói, vuốt nhanh. Hiện chỉ smoke-test API 36 emulator; máy thật được người dùng cho phép bỏ qua trong đợt này nên không đánh dấu.
- [ ] Test TikTok, YouTube và Instagram native riêng; ghi rõ ứng dụng/version nào cho phép hoặc chặn playback capture. Không suy rộng kết quả một app cho mọi app; chưa có máy thật để thu kết quả.
- [ ] Native status đã instrument `lastInferenceMs`, RTF, transcribed/dropped windows, duplicate và filtered count; typecheck/Kotlin compile pass. Còn thu p50/p95, CPU, RAM, pin/15 phút và false reject/accept trên corpus/máy thật trước khi đặt budget.
- [ ] Regression YouTube WebView, Google Sign-In, auth/session, phụ đề song ngữ, tra/lưu từ và 4 rating FSRS. Backend full 39/39 test pass; release cold-launch emulator pass, nhưng regression tương tác đầy đủ chưa chạy.
- [ ] Verification bắt buộc: `npm run typecheck`, Android debug Kotlin compile và release build đã pass; backend `npm run check` và 39/39 test pass. Còn native unit test, smoke thiết bị thật, README/module docs, Apache NOTICE và license model/thư viện trước merge.

#### Blocker/điều kiện trước M2

- Native module/service chưa tồn tại trên nhánh; M2 là thay đổi native bắt buộc, không thể hoàn thành bằng Expo Go hoặc JS-only.
- Cần Android SDK/emulator hoặc thiết bị Android 10+ để xác nhận MediaProjection và overlay. Build pass không chứng minh playback capture hoạt động.
- Cần audit chính xác target SDK hiện tại và foreground-service requirements Android 14–16 trước khi khai báo manifest; không thêm dependency cho classifier/model trước benchmark và license review.

### Backlog sau beta — Chỉ mở khi có nhu cầu hoặc số liệu

- **Browser extension desktop:** chỉ cân nhắc sau WEB-2; overlay trên trang YouTube/TikTok thật, cần review quyền và vẫn dùng backend/worker chung.
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
7. Chốt WEB-1; sau đó triển khai WEB-2 theo luồng dán URL, không trì hoãn P0 mobile.
8. Hoàn tất M2 external captions trên Android 16: nghiệm thu kéo/thu gọn/Dừng từ overlay và notification, projection revoke; sau đó nối PCM native vào Whisper cho M3.
9. Mở WEB-3/WEB-4 sau khi MVP web pass; extension và tối ưu WebView chỉ mở khi số liệu/nhu cầu chứng minh cần thiết.
