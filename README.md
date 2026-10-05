# 📱 ShortLearn — Bilingual AI YouTube Shorts English Learning

> **ShortLearn**: Nền tảng học tiếng Anh thông minh qua video ngắn YouTube Shorts kết hợp **Khoang phụ đề Language Reactor song ngữ**, **Tra từ vựng 1 chạm dừng video**, **Tự động kích hoạt âm thanh & vuốt chuyển mượt mà** và **Thuật toán lặp lại ngắt quãng (SRS / SM-2 & FSRS)**.

---

## 📚 Hệ Thống Tài Liệu Dự Án

| Tài liệu | Mô tả |
| :--- | :--- |
| 🗺️ **[ROADMAP.md](file:///d:/java/app%20short/ROADMAP.md)** | **Lộ trình kỹ thuật 6 giai đoạn, kiến trúc On-Device/Server, ma trận rủi ro & nhật ký phiên bản** |
| 🌟 **[APP_FEATURES.md](file:///d:/java/app%20short/APP_FEATURES.md)** | Đặc tả đầy đủ 10 tính năng Người dùng & 7 tính năng Hệ thống AI của ứng dụng |
| 🎧 **[LANGUAGE_REACTOR_MOBILE.md](file:///d:/java/app%20short/LANGUAGE_REACTOR_MOBILE.md)** | Thiết kế khoang phụ đề song ngữ độc lập phong cách Language Reactor trên di động |
| 🔬 **[OPTIMIZATION_V2.md](file:///d:/java/app%20short/OPTIMIZATION_V2.md)** | Chi tiết các trục nâng cấp tối ưu (FSRS, Throttling, DOM GC, DLX, Sliding Window) |
| ⚡ **[POC_GUERRILLA.md](file:///d:/java/app%20short/POC_GUERRILLA.md)** | Kỹ thuật đánh chặn DOM Shorts & kiểm thử tự động trên thiết bị thực tế qua ADB |

---

## ✨ Điểm Nổi Bật Của Ứng Dụng (MVP v0.8)

1. **🎬 Trải nghiệm YouTube Shorts Native & Sạch sẽ**:
   - Loại bỏ hoàn toàn thanh topbar, pivot bar rác, nút "Open App" và các popup gây phiền của YouTube web mobile.
2. **🔊 Tự động Bật Tiếng (Auto-Unmute 0 Chạm)**:
   - Tự động bỏ mute video (`video.muted = false`, `volume = 1.0`) và tự click nút âm thanh sau 400ms ngay khi mở app.
3. **👆 Vuốt chuyển Video Siêu mượt (Capture Phase Touch)**:
   - Bắt cử chỉ vuốt tay tại **Capture Phase** trước khi thẻ WebView nuốt sự kiện, giúp người dùng vuốt lên/xuống chuyển Shorts tự nhiên như app gốc.
4. **💬 Khoang Phụ Đề Song Ngữ Độc Lập (Language Reactor Overlay)**:
   - Phụ đề native che trên video bị triệt tiêu 100% bằng CSS `::cue` và `TextTrack.mode = 'hidden'`.
   - Lời thoại được đưa xuống khoang riêng biệt phía dưới màn hình (nền tối `#0F172A`), dòng tiếng Anh dạng nút chạm và dòng tiếng Việt màu hổ phách `#FDE047`.
5. **🔍 Chạm Từ Tra Nghĩa & Dừng Video Tức Thì**:
   - Chạm vào bất kỳ từ vựng nào trong câu để video dừng phát tức thì (`PAUSE_VIDEO`) và mở Popup tra nghĩa tiếng Việt cùng ngữ cảnh câu gốc.
6. **⚡ Dịch Thuật Kép (Client-First 0ms + Backend AI)**:
   - Dịch tức thời trên điện thoại qua Google Translate API GTX (nhận diện mọi ngôn ngữ).
   - Kiến trúc dự phòng backend: Trích xuất timedtext trực tiếp từ YouTube, sẵn sàng tích hợp Groq Whisper STT + LLM (Gemini / Groq Llama 3.3).
7. **🧠 Hệ Thống Ôn Tập SRS (SuperMemo-2 & FSRS)**:
   - Thuật toán SM-2 chuẩn hóa (`srsAlgorithm.ts`) với ngưỡng an toàn Ease Factor $\ge 1.3$, tự động lập lịch khoảng cách ôn tập cho từng thẻ từ vựng.
   - Giao diện thẻ Flashcard tương tác (`FlashcardReview.tsx`) với 4 nút đánh giá: *Again*, *Hard*, *Good*, *Easy*.

---

## 🗂️ Cấu Trúc Dự Án (Monorepo Directory Layout)

```text
shortlearn/
├── ROADMAP.md                  # Bản kế hoạch kiến trúc & tiến độ 6 giai đoạn (Cập nhật liên tục)
├── APP_FEATURES.md             # Đặc tả chi tiết tất cả chức năng ứng dụng
├── LANGUAGE_REACTOR_MOBILE.md  # Thiết kế khoang phụ đề Language Reactor
├── OPTIMIZATION_V2.md          # Đặc tả các trục nâng cấp tối ưu V2
├── POC_GUERRILLA.md            # Tài liệu kỹ thuật PoC & kiểm thử thiết bị
├── README.md                   # Hướng dẫn tổng quan & khởi chạy nhanh (file này)
├── docker-compose.yml          # Triển khai toàn bộ stack dịch vụ backend
├── init.sql                    # SQL DDL khởi tạo DB, bảng & index chuẩn hóa
├── redis.conf                  # Cấu hình Redis maxmemory 256MB + allkeys-lru
├── .env.example                # File mẫu biến môi trường
│
├── frontend/             # Ứng dụng Di động (React Native Expo SDK 57)
│   ├── src/
│   │   ├── components/
│   │   │   ├── LanguageReactorOverlay.tsx  # Khoang phụ đề song ngữ độc lập phía dưới
│   │   │   ├── FlashcardReview.tsx         # Màn hình thẻ lật ôn tập từ vựng SRS
│   │   │   └── SubtitleOverlay.tsx         # Overlay phụ đề dạng nổi (Legacy)
│   │   ├── utils/
│   │   │   ├── binarySearchSubtitles.ts    # Thuật toán tìm kiếm cue nhanh O(log N)
│   │   │   └── srsAlgorithm.ts             # Thuật toán lặp lại ngắt quãng SM-2
│   │   └── injected_script.js              # Tham khảo mã script tiêm vào WebView
│   ├── App.tsx                 # Entrypoint: WebView Shorts + Injected Script V7 + Modal tra từ
│   ├── app.json                # Cấu hình Expo project
│   └── package.json            # Dependencies: Expo 57, RN 0.86, react-native-webview
│
├── backend/                # Trạm trung chuyển API (Node.js & Express - Scaffold)
│   ├── src/
│   │   ├── config/             # db.js (MySQL pool), redis.js, rabbitmq.js
│   │   ├── controllers/        # subtitleController.js, vocabController.js
│   │   ├── routes/             # subtitleRoutes.js, vocabRoutes.js
│   │   └── server.js           # Express App (Rate limiting & CORS)
│   ├── Dockerfile
│   └── package.json
│
└── ai-worker/                  # Worker cào phụ đề & Dịch AI (Python - Scaffold)
    ├── src/
    │   ├── core/               # config.py (Environment loader)
    │   ├── scrapers/           # youtube_scraper.py (Transcript API + Whisper Fallback)
    │   ├── translators/        # llm_translator.py (Groq / Gemini Flash)
    │   └── worker.py           # RabbitMQ consumer
    ├── Dockerfile
    └── requirements.txt
```

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh

### 1. Xem giao diện trên máy tính — không cần điện thoại

```bash
cd frontend
npm.cmd install
npm.cmd run web
```

Expo sẽ mở giao diện Web cục bộ. Nếu trình duyệt không tự bật, mở địa chỉ được Terminal hiển thị (mặc định là `http://localhost:8081`).

> Nếu PowerShell báo chặn `npm.ps1`, chạy một lần `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`, sau đó dùng bình thường `npm run web`. Chính sách này cho phép script cục bộ, còn script tải từ Internet vẫn cần chữ ký. Nếu không muốn đổi chính sách, dùng `npm.cmd run web` thay cho `npm run web`.

**Cách nhanh nhất trên Windows:** nhấp đúp `frontend\\run-web.cmd` hoặc chạy `./run-web.cmd`. File này mở trình duyệt tại `http://localhost:8090` mà không dùng `npm.ps1`.

### 2. Trải nghiệm Trực tiếp trên Điện thoại (Expo Go)
Cách nhanh nhất để chạy ứng dụng trực tiếp trên điện thoại Android / iOS mà không cần cài đặt backend:

```bash
# 1. Di chuyển vào thư mục app
cd "frontend"

# 2. Cài đặt các gói phụ thuộc (nếu chưa cài)
npm install

# 3. Cấu hình API Gateway (thiết bị thật: dùng IP LAN của máy tính)
cp .env.example .env

# 4. Khởi động Metro Bundler với đường truyền Tunnel
npx expo start --tunnel
```

Biến `EXPO_PUBLIC_API_URL` nhận địa chỉ gốc của API Gateway, ví dụ `http://192.168.1.10:5000` (thay bằng IP LAN của máy bạn). App tự thêm prefix `/api/v1`; Android Emulator có thể dùng `http://10.0.2.2:5000`. App không còn chứa IP LAN cố định trong mã nguồn.

> **Cách kết nối trên điện thoại:**
> 1. Tải app **Expo Go** từ Google Play Store hoặc Apple App Store.
> 2. Mở camera hoặc quét mã QR hiển thị trên Terminal/trình duyệt.
> 3. Nếu điện thoại và máy tính khác mạng Wi-Fi, tham số `--tunnel` sẽ tự động tạo kết nối thông suốt qua ngrok.
> 4. Muốn tải lại mã nguồn mới nhất: **Lắc điện thoại** -> Bấm **"Reload"**.

#### Kiểm thử qua USB/ADB (không phụ thuộc Wi-Fi)

Kết nối điện thoại đã bật **USB debugging**, sau đó chuyển hai cổng của điện thoại về máy phát triển. Cấu hình này cần chạy lại sau khi rút cáp hoặc khởi động lại thiết bị.

```bash
adb devices
adb reverse tcp:8081 tcp:8081 # Metro / Expo
adb reverse tcp:5000 tcp:5000 # API Gateway

# frontend/.env
EXPO_PUBLIC_API_URL=http://127.0.0.1:5000

cd frontend
npx expo start --lan
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```

`adb reverse` cho phép Expo Go và ứng dụng trên điện thoại gọi máy phát triển bằng `127.0.0.1`, kể cả khi Wi-Fi bị chặn client isolation.

#### Liên kết tài khoản YouTube

ShortLearn dùng **Google Sign-In native** (bộ chọn tài khoản Google của Android), không đưa biểu mẫu đăng nhập vào WebView hay Chrome. Điều này giữ mật khẩu ngoài ứng dụng và phù hợp với yêu cầu OAuth hiện tại của Google. Hiện quyền yêu cầu là `youtube.readonly`, chỉ đủ để đọc hồ sơ/kênh của chính người dùng.

1. Trong Google Cloud Console, bật **YouTube Data API v3**, thiết lập OAuth consent screen và thêm tài khoản thử nghiệm nếu app chưa được xác minh.
2. Tạo OAuth client **Android** cho package `com.shortlearn.app` cùng SHA-1 của bản development/release build.
3. Tạo thêm OAuth client loại **Web application**. Client ID Web này bắt buộc cho Google Sign-In native, kể cả khi ứng dụng chỉ chạy Android; không điền Client Secret vào ứng dụng.
4. Điền Android Client ID và Web Client ID vào `frontend/.env` theo [.env.example](frontend/.env.example), sau đó tạo lại development build.
5. Khi consent screen ở trạng thái Testing, thêm đúng tài khoản Google sẽ đăng nhập vào danh sách **Test users**. OAuth không thể hoàn tất trong Expo Go vì Expo Go không chứa native Google Sign-In của ShortLearn.

```bash
cd frontend
npx expo prebuild
npx expo run:android --device
```

Sau khi mở bản development build, vào tab **Tài khoản** để đăng nhập, đổi tài khoản hoặc ngắt liên kết. Phiên truy cập ngắn hạn được mã hóa trong bộ nhớ an toàn của thiết bị; app không lưu mật khẩu hay refresh token.

---

### 2. Khởi chạy Toàn bộ Hạ tầng Backend (Tùy chọn)
Dành cho việc phát triển hệ thống lưu trữ đồng bộ và worker AI:

```bash
# Bước 1: Sao chép biến môi trường
cp .env.example .env

# Bước 2: Khởi chạy các container cơ sở dữ liệu và queue qua Docker
docker compose up -d mysql redis rabbitmq

# Bước 3: Khởi chạy API Gateway (Node.js)
cd backend
npm install
npm run dev

# Bước 4: Khởi chạy AI Worker (Python)
cd ../ai-worker
pip install -r requirements.txt
python -m src.worker
```

**Các cổng dịch vụ:**
- **API Gateway**: `http://localhost:5000`
- **RabbitMQ Management**: `http://localhost:15672` (Tài khoản: `guest` / `guest`)
- **MySQL**: `localhost:3306` (Database: `shortlearn_db`)
- **Redis Cache**: `localhost:6379`

Sau khi backend chạy, tab **Ôn tập** trong app sẽ tải các thẻ đến hạn. Nút **Lưu Flashcard** trong popup tra từ ghi thật vào `user_vocabulary`; bốn mức đánh giá cập nhật lịch FSRS qua API Gateway.

### Kiểm tra dịch vụ

```bash
# Liveness: tiến trình API còn hoạt động
curl http://localhost:5000/health

# Readiness: MySQL, Redis và RabbitMQ đều sẵn sàng
curl http://localhost:5000/health/ready
```

API chỉ nhận YouTube video ID hợp lệ, giới hạn request tạo phụ đề theo IP và tránh đẩy trùng task. Nếu Worker xử lý lỗi ba lần, endpoint trả trạng thái `FAILED`; gửi lại `POST /api/v1/subtitles/request` với `{ "retry": true }` để thử lại có chủ đích.

### API xác thực

Các endpoint đều nằm dưới `/api/v1/auth`:

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| POST | `/register` | Tạo tài khoản và gửi OTP xác minh email |
| POST | `/login` | Đăng nhập bằng email/mật khẩu |
| POST | `/otp/request` | Yêu cầu OTP cho `verify_email`, `login` hoặc `password_reset` |
| POST | `/otp/verify` | Xác minh OTP; trả token đăng nhập hoặc reset token |
| POST | `/forgot-password` | Khởi tạo OTP đặt lại mật khẩu với phản hồi chống dò email |
| POST | `/reset-password` | Đổi mật khẩu bằng reset token và thu hồi các phiên cũ |
| POST | `/refresh` | Xoay refresh token và cấp access token mới |
| POST | `/logout` | Thu hồi phiên gắn với refresh token |

Access token mặc định sống 15 phút; refresh token sống 30 ngày và chỉ bản băm SHA-256
được lưu trong MySQL. OTP sống 10 phút, chỉ lưu HMAC và bị vô hiệu hóa sau khi dùng.
Trong development, `AUTH_OTP_DELIVERY_MODE=console` in mã OTP ở log backend. Production
phải cấu hình `AUTH_OTP_DELIVERY_MODE=webhook`, `AUTH_OTP_WEBHOOK_URL`, `JWT_SECRET` và
`OTP_HMAC_SECRET`; không bật `AUTH_EXPOSE_OTP` trong production.

Các API dữ liệu cá nhân dưới `/api/v1/vocabulary` và `/api/v1/learning` bắt buộc
gửi access token. Backend lấy người dùng từ token và phiên đã xác minh; không gửi
`user_id` hoặc `userId` trong query/body:

```bash
curl -H "Authorization: Bearer <access_token>" \
  "http://localhost:5000/api/v1/vocabulary/saved?limit=100"
```

Token đúng chữ ký nhưng thuộc phiên đã logout, hết hạn hoặc có `auth_version` cũ
vẫn bị từ chối với HTTP `401`.

### Whisper cục bộ dự phòng

AI worker dùng `faster-whisper` trên máy khi YouTube không có caption hoặc khi
video TikTok cần nhận dạng lời nói. Cấu hình mặc định `base.en` chạy CPU INT8,
lọc khoảng lặng bằng VAD và không cần khóa dịch vụ đám mây. Mô hình chỉ tải một
lần vào `ai-worker/.models` khi chạy trực tiếp hoặc volume Docker
`whisper_models`. Chỉ đặt `WHISPER_PROVIDER=groq` khi đã có khóa Groq và muốn ưu
tiên dịch vụ này trước engine cục bộ.
