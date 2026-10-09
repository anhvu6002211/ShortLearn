# 🧠 ShortLearn AI Worker — Hướng Dẫn Phát Triển Cho AI (ai-worker/)

> File này quy định chi tiết cấu trúc, quy tắc lập trình và kiểm thử cho module AI Background Worker (`ai-worker/`).

---

## 1. ⚙️ Tech Stack & Kiến Trúc Cốt Lõi

- **Ngôn ngữ**: Python 3.10+.
- **Message Consumer**: `pika` 1.3.2 (kết nối RabbitMQ, prefetch QoS, Dead-Letter Exchange `subtitles_dlx`).
- **Video & Audio Ingestion**: `yt-dlp`, `youtube-transcript-api`.
- **Speech-to-Text (STT)**:
  - Mặc định: Faster-Whisper local (`base.en`, CPU INT8, VAD). Thư viện lưu mô hình trong `ai-worker/.models`.
  - `WHISPER_PROVIDER=local`: ưu tiên local.
  - `WHISPER_PROVIDER=groq`: ưu tiên Groq Whisper nếu có API key, sau đó fallback về local.
- **Dịch Thuật AI (LLM Batch Translation)**:
  - Hỗ trợ Google Gemini (`gemini-2.5-flash`) và Groq (`llama-3.3-70b-versatile`).
  - Provider chính được cấu hình bằng `PRIMARY_LLM=groq|gemini`.
  - Mặc định hiện tại: `PRIMARY_LLM=groq`.
  - Nếu provider chính lỗi, quá quota hoặc trả dữ liệu không hợp lệ, thử provider còn lại.
- **Lưu trữ & Cache**: `mysql-connector-python` (ghi bảng `videos` và `subtitles`), `redis` 5.2 (cache key `subtitles:{platform}:{video_id}`).
- **Validation**: `pydantic` v2 / `task_validation.py`.

---

## 2. 🗂️ Bản Đồ Cấu Trúc Mã Nguồn `ai-worker/src/`

```text
ai-worker/
├── src/
│   ├── core/
│   │   └── config.py            # Đọc biến môi trường (RabbitMQ, MySQL, Redis, Gemini/Groq keys, Whisper model)
│   │
│   ├── scrapers/                # Tầng trích xuất âm thanh & văn bản gốc
│   │   ├── platform_scraper.py  # Điều hướng cào phụ đề theo platform ('youtube' | 'tiktok')
│   │   ├── youtube_scraper.py   # Lấy timedtext tự nhiên qua youtube-transcript-api; fallback qua Whisper nếu thiếu caption
│   │   ├── tiktok_scraper.py    # Tải audio TikTok bằng yt-dlp và chuyển sang Whisper STT
│   │   └── media_whisper.py     # Bộ giải mã âm thanh: Faster-Whisper cục bộ và Groq Whisper API
│   │
│   ├── translators/             # Tầng dịch thuật song ngữ AI
│   │   └── llm_translator.py    # Dịch theo lô (batches) giữ nguyên start_time/end_time, giữ ngữ cảnh câu
│   │
│   ├── utils/                   # Tiện ích xử lý dữ liệu phụ đề
│   │   └── sliding_window.py    # Thuật toán gộp các mảnh phụ đề ngắn/vụn (cues) thành câu thoại hoàn chỉnh
│   │
│   ├── task_validation.py       # Xác thực & chuẩn hóa message nhận từ RabbitMQ
│   └── worker.py                # Consumer chính: lắng nghe queue, điều phối cào -> dịch -> lưu DB -> cache Redis -> ACK
│
├── test/                        # Bộ unit tests cho scraper, whisper, translator
├── requirements.txt             # Danh sách thư viện Python chuẩn
└── Dockerfile                   # Build container cho worker
```

---

## 3. 🧩 Phân Định Trách Nhiệm Rõ Ràng (Separation of Concerns)

1. **Scraper (`src/scrapers/`)**:
   - Nhiệm vụ DUY NHẤT: Trả về danh sách phụ đề tiếng Anh gốc `[{ start_time, end_time, text }]`.
   - Không được thực hiện dịch thuật hoặc thao tác database trong thư mục này.
2. **Translator (`src/translators/`)**:
   - Nhiệm vụ DUY NHẤT: Nhận danh sách cue tiếng Anh và dịch sang tiếng Việt, trả về danh sách `[{ start_time, end_time, text, translation }]`.
   - Phải xử lý lỗi mạng mềm dẻo: Thử provider chính (`PRIMARY_LLM`) trước; nếu lỗi, quá quota hoặc trả dữ liệu không hợp lệ thì tự động chuyển sang provider còn lại.
3. **Worker (`src/worker.py`)**:
   - Nhiệm vụ: Quản lý vòng đời task.
   - Nhận task -> validate qua `task_validation.py` -> gọi scraper -> gọi translator -> mở transaction lưu MySQL -> ghi cache Redis -> ACK message.
   - **Nếu lỗi tạm thời**:
     - Publish sang retry queue `${QUEUE_NAME}_retry`.
     - Retry tối đa `MAX_RETRIES = 3`.
     - Sử dụng exponential backoff bắt đầu từ 10 giây (`delay_ms = RETRY_DELAY_MS * (2 ** retry_count)`: 10s -> 20s -> 40s).
     - Theo dõi số lần thử bằng header `x-retry-count`.
     - *Lưu ý*: Các giá trị như `MAX_RETRIES`, `RETRY_DELAY_MS`, model name và provider mặc định phải lấy từ implementation/config hiện tại khi thực hiện task. Không giả định tài liệu luôn mới hơn mã nguồn.
   - **Nếu vượt quá số lần retry**:
     - Đánh dấu video `FAILED` trong database.
     - NACK không requeue để RabbitMQ chuyển message qua DLX (`subtitles_dlx`).
     - Message cuối cùng được lưu vào `subtitles_tasks_dlq`.

---

## 4. 🚫 Quy Tắc AI Chỉnh Sửa Mã Nguồn

- **Không viết lại worker:** Giữ nguyên topology RabbitMQ, retry queue và các exchange hiện tại.
- **Không hardcode credentials:** Không để lộ Groq API key, Google Gemini key hay thông tin kết nối DB.
- **Bảo toàn định dạng phụ đề:** Đảm bảo `start_time` và `end_time` luôn là số thực (seconds), `text` và `translation` đã được strip khoảng trắng thừa.
- **Tiết kiệm tài nguyên:** `faster-whisper` chạy trên CPU nên phải tận dụng VAD (`vad_filter=True`) để bỏ qua các đoạn im lặng và tránh rò rỉ bộ nhớ.

---

## 5. 🔍 Quy Trình Kiểm Thử & Nghiệm Thu (Verification)

### Chiến lược kiểm thử (Test Strategy)

Trong quá trình phát triển:
- Có thể chạy test file liên quan trước để nhận phản hồi nhanh (fast feedback loop).

Ví dụ:
```powershell
.\.venv\Scripts\python.exe -m unittest test.test_llm_translator
.\.venv\Scripts\python.exe -m unittest test.test_media_whisper
```

Trước khi task được đánh dấu hoàn thành:
- **BẮT BUỘC** chạy toàn bộ:
```powershell
cd ai-worker
.\.venv\Scripts\python.exe -m unittest discover test
```
*(Nếu trên Linux/Mac hoặc môi trường đã kích hoạt venv: `python -m unittest discover test`)*

Task chỉ được coi là hoàn thành khi toàn bộ unit test hiện có **PASS 100%**.

---

## 6. 🤖 Quy Tắc Multi-Agent

Có thể chạy nhiều agent song song khi task độc lập.

**Ví dụ an toàn:**
- Agent A: `src/scrapers/`
- Agent B: `src/translators/`
- Agent C: unit tests cho một feature độc lập

**Không chạy song song nếu nhiều agent cần sửa:**
- `src/worker.py`
- `src/core/config.py`
- Cùng một test file
- Cùng một interface/schema dữ liệu

### Phân định quyền sở hữu file (Task Ownership)

Trước khi chạy song song, mỗi agent phải xác định rõ phạm vi sở hữu:

- **Agent A**:
  - `src/scrapers/**`
  - `test/test_scrapers*.py`
- **Agent B**:
  - `src/translators/**`
  - `test/test_llm_translator.py`
- **Agent C**:
  - Phạm vi được giao riêng

Một file chỉ được thuộc về **một agent duy nhất** trong cùng một đợt triển khai.

Nếu task cần thay đổi shared contract, schema hoặc interface mà nhiều agent phụ thuộc:
1. Dừng triển khai song song phần đó.
2. Hoàn thành thay đổi contract trước.
3. Sau đó mới cho các agent phụ thuộc tiếp tục.

**Mỗi agent phải:**
1. Giới hạn thay đổi trong phạm vi được giao.
2. Không refactor code của agent khác.
3. Chạy test liên quan.
4. Báo rõ file đã sửa.
5. Không merge khi có conflict chưa được review.

---

## 7. 🧭 Nguồn Chân Lý (Source of Truth)

Khi `AGENTS.md`, `ROADMAP.md` và implementation hiện tại không thống nhất:
1. **Không tự ý sửa code để khớp tài liệu.**
2. **Kiểm tra git/source hiện tại.**
3. **Xác định tài liệu nào đã lỗi thời.**
4. **Ưu tiên hành vi đang được test xác nhận.**
5. **Báo rõ sự khác biệt trước khi thay đổi architecture hoặc contract.**
