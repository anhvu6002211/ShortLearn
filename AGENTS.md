# 🤖 ShortLearn — Hướng Dẫn Phát Triển Cho AI / Vibe Coding (Root)

> Tài liệu này là kim chỉ nam tối cao cho các trợ lý AI lập trình (Gemini, Codex, Claude Code, Cursor...) khi đọc, phân tích và chỉnh sửa mã nguồn trong toàn bộ repository **ShortLearn**.

---

## 1. 🏗️ Tổng Quan Kiến Trúc Toàn Dự Án

Dự án ShortLearn là một monorepo gồm 3 module độc lập phối hợp với nhau:

```text
shortlearn/
├── shortlearn-app/      # [Frontend Di động] React Native 0.86 + Expo SDK 57 + TypeScript
├── backend/             # [API Gateway] Node.js 18+ (CommonJS) + Express 4.21 + MySQL + Redis + RabbitMQ
├── ai-worker/           # [AI Background Worker] Python 3.10+ + Faster-Whisper + yt-dlp + LLM (Gemini/Groq)
├── docker-compose.yml   # Stack dịch vụ phụ trợ: MySQL 8, Redis 7, RabbitMQ
├── init.sql             # SQL DDL khởi tạo schema, bảng, index và migration
├── redis.conf           # Cấu hình Redis bộ nhớ đệm
├── README.md            # Tài liệu tổng quan & hướng dẫn khởi chạy
└── AGENTS.md            # File quy chuẩn này
```

### Chi tiết công nghệ từng module:
1. **`shortlearn-app/`**:
   - **Framework**: React Native 0.86.3, Expo SDK ~57.0.26, TypeScript ~5.9.3.
   - **Điều hướng & Danh sách**: `@react-navigation/native` v7, `@shopify/flash-list` v2.
   - **Trình phát Video & Intercept**: `react-native-webview` 13.16.1 (chạy YouTube Shorts / TikTok mweb với injected JavaScript đánh chặn DOM).
   - **Xác thực & Bảo mật**: `@react-native-google-signin/google-signin` (native OAuth cho YouTube scope), `expo-secure-store` (lưu trữ token an toàn).
   - **Package ID**: `com.shortlearn.app`.

2. **`backend/`**:
   - **Framework**: Node.js (CommonJS, native `node --test`), Express 4.21.2.
   - **Lưu trữ & Cache**: `mysql2` (connection pool có health check), `redis` 4.7 (cache timedtext & session).
   - **Message Queue**: `amqplib` (RabbitMQ producer đẩy task cào/dịch phụ đề với DLX).
   - **Bảo mật & Auth**: `jsonwebtoken` (JWT access token), `crypto` (scrypt hash password, SHA-256 digest refresh token, HMAC-SHA256 OTP), `express-rate-limit`.

3. **`ai-worker/`**:
   - **Runtime**: Python 3.10+, RabbitMQ Consumer (`pika`).
   - **Speech-to-Text**:
     - Hỗ trợ Faster-Whisper local (`base.en`, CPU INT8, VAD) và Groq Whisper API.
     - Provider / thứ tự ưu tiên được xác định bởi cấu hình `WHISPER_PROVIDER`.
     - Xem `ai-worker/AGENTS.md` và implementation hiện tại để xác định behavior chính xác.
   - **Video/Audio Ingestion**: `yt-dlp`, `youtube-transcript-api`.
   - **AI Translation**:
     - Hỗ trợ Groq Llama 3.3 70B và Google Gemini `gemini-2.5-flash`.
     - Provider chính được cấu hình qua `PRIMARY_LLM=groq|gemini`.
     - Mặc định hiện tại: `PRIMARY_LLM=groq`.
     - Nếu provider chính lỗi, quá quota hoặc trả dữ liệu không hợp lệ, translator fallback sang provider còn lại.
   - **Dữ liệu**: `mysql-connector-python`, `redis`, `pydantic`.

### 1.1. 📜 Phạm Vi & Kế Thừa Quy Tắc

`/AGENTS.md` áp dụng cho toàn bộ repository.

Các file `AGENTS.md` bên trong từng module:
- `shortlearn-app/AGENTS.md`
- `backend/AGENTS.md`
- `ai-worker/AGENTS.md`

được phép bổ sung quy tắc cụ thể cho module nhưng **KHÔNG được làm yếu hoặc mâu thuẫn** với các nguyên tắc bắt buộc của Root `AGENTS.md`.

Khi làm việc trong một module:
1. Đọc Root `AGENTS.md`.
2. Đọc `AGENTS.md` gần nhất của module.
3. Áp dụng cả hai.
4. Nếu có mâu thuẫn, dừng và báo rõ trước khi thay đổi code.

---

## 2. 🚫 Các Nguyên Tắc "Bất Di Bất Dịch" (Strict Prohibitions)

Mọi AI khi làm việc trên dự án này **TUYỆT ĐỐI TUÂN THỦ** các điều cấm sau:

1. **KHÔNG viết lại (rewrite) toàn bộ dự án từ đầu.** Tôn trọng mã nguồn đang chạy.
2. **KHÔNG chuyển React Native sang Kotlin / Jetpack Compose.** ShortLearn chọn React Native + Expo để tận dụng WebView DOM intercept linh hoạt trên đa nền tảng.
3. **KHÔNG thay đổi core framework hiện tại:** Không đổi React Native sang Flutter, không đổi Express sang NestJS/Fastify, không đổi Python Worker sang Go/Rust.
4. **KHÔNG xóa các chức năng đang hoạt động bình thường:** Mọi tính năng (phụ đề song ngữ, auto-unmute, swipe capture phase, tra từ 1 chạm, Flashcard FSRS/SM-2, auth session) phải luôn được bảo toàn.
5. **KHÔNG tự ý upgrade dependency** lên phiên bản mới hơn nếu không có yêu cầu rõ ràng từ người dùng.
6. **KHÔNG sửa thư mục `shortlearn-app/android` trực tiếp trừ khi native integration bắt buộc** (ví dụ Google Sign-In native; luôn ưu tiên Expo prebuild config qua `app.json`).
7. **KHÔNG hardcode API keys, token, mật khẩu hoặc secret** trong mã nguồn. Mọi bí mật cấu hình qua `.env`.

---

## 3. 🎯 Quy Tắc AI Chỉnh Sửa Code (Coding Rules)

- **Tìm hiểu code có sẵn trước khi tạo mới:** Luôn kiểm tra xem hàm, hook, type, utility hoặc component tương tự đã tồn tại trong codebase chưa (`src/utils`, `src/services`, `src/components`...).
- **Tối thiểu hóa số file sửa đổi (Minimal Blast Radius):** Ưu tiên sửa đúng file chứa vấn đề. Tránh lan man sửa đổi cấu trúc diện rộng.
- **Tái sử dụng tối đa:**
  - Tái sử dụng các service API (`apiRequest`), hook (`useWebViewActivity`), thuật toán (`binarySearchSubtitles`, `srsAlgorithm`).
  - Tái sử dụng các middleware (`authenticateJwt`), hàm validate (`validation.js`, `authValidation.js`).
- **Không tự ý refactor ngoài phạm vi yêu cầu:** Chỉ tập trung đúng vào tính năng hoặc lỗi mà người dùng yêu cầu giải quyết.

---

## 4. ⚡ Tối Ưu Hóa Ngữ Cảnh & Tiết Kiệm Token (Context & Token Efficiency)

1. **Không nạp toàn bộ tài liệu dài nếu task chỉ liên quan một phần:**
   - `ROADMAP.md`: chỉ đọc section/phase/task liên quan.
   - `APP_FEATURES.md`: chỉ đọc feature liên quan.
   - `POC_GUERRILLA.md`, `OPTIMIZATION_V2.md`, `LANGUAGE_REACTOR_MOBILE.md`: chỉ đọc khi task thực sự cần.

2. **Không quét lại toàn bộ repository nếu đã xác định được phạm vi:**
   - Ưu tiên tìm kiếm theo symbol, tên file hoặc từ khóa trong thư mục liên quan.
   - Mở trực tiếp file đã biết khi có thể.

3. **Tránh tạo component/service/helper mới nếu chức năng tương đương đã tồn tại.**

4. **Không đưa nội dung file lớn vào output nếu chỉ cần tóm tắt kết quả.**

---

## 5. 🔄 Quy Trình Chuẩn Cho AI (AI Workflow)

### Bước 1: Trước khi viết code (Pre-code Checklist)
1. **Xác định rõ ràng feature / bug** được yêu cầu.
2. **Định vị file liên quan:** Tìm đúng các file đang xử lý logic đó.
3. **Đọc mã nguồn hiện tại:** Nắm vững flow dữ liệu và các edge case đã được xử lý.
4. **Đọc đúng phần tài liệu liên quan:** (nếu cần đối chiếu nghiệp vụ).
5. **Lập kế hoạch ngắn gọn (short plan):** Liệt kê các bước sẽ thực hiện và các file sẽ tác động.
6. **Thực hiện chỉnh sửa chính xác.**

### Bước 2: Sau khi viết code (Post-code Verification Checklist)
Tuỳ theo module bị chỉnh sửa, AI **bắt buộc** chạy lệnh kiểm tra tương ứng:

- **Nếu sửa `shortlearn-app/`:**
  ```powershell
  cd shortlearn-app
  npm run typecheck
  ```
  *(Nếu có thay đổi native Android build: `npx expo run:android`)*

- **Nếu sửa `backend/`:**
  ```powershell
  cd backend
  npm run check
  npm test
  ```
  *(Yêu cầu: toàn bộ syntax check và test hiện có phải pass)*

- **Nếu sửa `ai-worker/`:**
  ```powershell
  cd ai-worker
  .\.venv\Scripts\python.exe -m unittest discover test
  ```
  *(Yêu cầu: toàn bộ unit test hiện có phải pass)*

---

## 6. 🗺️ Điều Hướng Tài Liệu Chi Tiết

Mỗi module có hướng dẫn chuyên sâu riêng:

- 📱 **Mobile Frontend**: [`shortlearn-app/AGENTS.md`](shortlearn-app/AGENTS.md)
- 🖥️ **Backend API Gateway**: [`backend/AGENTS.md`](backend/AGENTS.md)
- 🧠 **AI Worker**: [`ai-worker/AGENTS.md`](ai-worker/AGENTS.md)

---

## 7. 🧭 Nguồn Chân Lý (Source of Truth)

Phân biệt rõ hai loại thông tin:

### Trạng thái hiện tại
Khi cần xác định hệ thống **HIỆN ĐANG** hoạt động thế nào, ưu tiên:
1. Runtime/configuration thực tế nếu có thể kiểm chứng.
2. Implementation hiện tại.
3. Automated tests đang pass.
4. README / tài liệu mô tả.

### Trạng thái mong muốn
Khi thực hiện feature hoặc task mới, ưu tiên:
1. Yêu cầu hiện tại của người dùng.
2. Task/acceptance criteria trong `ROADMAP.md`.
3. `APP_FEATURES.md` hoặc tài liệu feature liên quan.
4. Implementation hiện tại làm baseline.

Nếu tài liệu và source không thống nhất:
- Không tự ý rewrite code để khớp tài liệu.
- Xác định phần nào mô tả hiện trạng và phần nào mô tả mục tiêu.
- Báo rõ discrepancy nếu nó ảnh hưởng architecture, API contract hoặc dữ liệu.
- Sau khi feature hoàn thành và được kiểm chứng, cập nhật tài liệu liên quan.

### Giá trị cấu hình động
Các version dependency, model name, provider mặc định và giá trị cấu hình được ghi trong `AGENTS.md` chỉ mô tả trạng thái tại thời điểm tài liệu được cập nhật.

Khi thực hiện task, nguồn chính xác là:
- `package.json` / `package-lock.json` cho Node.js / React Native.
- `requirements.txt` cho Python.
- `.env.example`, `config.py`, `app.json` và implementation hiện tại cho runtime config.
- Migration / schema hiện tại cho database.

Không downgrade hoặc thay đổi implementation chỉ để khớp một giá trị đã lỗi thời trong `AGENTS.md`.

---

## 8. 🤖 Multi-Agent / Parallel Tasks

Có thể chạy nhiều agent song song khi task độc lập.

### Phân chia ưu tiên
Ví dụ:
- Agent Mobile → `shortlearn-app/**`
- Agent Backend → `backend/**`
- Agent Worker → `ai-worker/**`
- Agent Docs/Test → phạm vi riêng được chỉ định

### Quy tắc ownership
Trước khi bắt đầu, mỗi task phải xác định:
- Module sở hữu
- File dự kiến sửa
- Dependency
- Acceptance criteria
- Verification command

Một file chỉ thuộc về **một agent duy nhất** trong cùng một đợt triển khai.

### Không chạy song song khi
- Hai task sửa cùng file.
- Hai task thay đổi cùng API contract.
- Hai task thay đổi cùng database schema.
- Task B phụ thuộc output của Task A.
- Có migration hoặc shared type/schema chưa ổn định.

Trong trường hợp có dependency:
```text
Task A
  └── hoàn thành + test
        └── xác nhận contract
              └── Task B bắt đầu
```

### Hoàn tất batch
Sau khi các agent hoàn thành:
1. Review diff từng task.
2. Resolve conflict nếu có.
3. Chạy verification của từng module bị ảnh hưởng.
4. Chạy integration test nếu thay đổi xuyên module.
5. Chỉ sau đó cập nhật `ROADMAP.md`.

---

## 9. ✅ Định Nghĩa Hoàn Thành (Definition of Done)

Một task chỉ được đánh dấu `Hoàn thành` khi:

1. Implementation đáp ứng acceptance criteria.
2. Không làm hỏng chức năng hiện có liên quan.
3. Targeted test / typecheck đã pass.
4. Full verification bắt buộc của module đã pass.
5. Không còn lỗi compile / type / syntax phát sinh từ thay đổi.
6. Không hardcode secret hoặc credential.
7. Không có thay đổi ngoài phạm vi task nếu không được giải thích.
8. Tài liệu liên quan được cập nhật nếu behavior hoặc contract thay đổi.
9. `ROADMAP.md` chỉ được cập nhật thành hoàn thành sau khi các bước trên pass.

Nếu chưa xác minh được một bước:
- **Không đánh dấu task hoàn thành.**
- Ghi rõ phần nào chưa được verify.

---

## 10. 🔗 Thay Đổi Xuyên Module (Cross-Module Changes)

Nếu một feature ảnh hưởng từ 2 module trở lên, ví dụ:

```text
shortlearn-app
      ↓
   backend
      ↓
  ai-worker
```

AI phải xác định contract trước khi viết code.

### Thứ tự ưu tiên triển khai:
1. Xác định request / response / schema / event contract.
2. Xác định module producer và consumer.
3. Xác định migration nếu có.
4. Triển khai module nền tảng trước nếu có dependency.
5. Chỉ chạy song song các phần không phụ thuộc nhau.
6. Sau cùng chạy integration verification.

Tuyệt đối không để hai agent tự thay đổi hai phiên bản khác nhau của cùng:
- API request / response
- Database schema
- RabbitMQ message
- Shared type
- Enum / status
