# 🖥️ ShortLearn API Gateway — Hướng Dẫn Phát Triển Cho AI (backend/)

> File này quy định chi tiết cấu trúc, quy tắc lập trình và kiểm thử cho module API Gateway (`backend/`).

---

## 1. ⚙️ Tech Stack & Kiến Trúc Cốt Lõi

- **Runtime & Ngôn ngữ**: Node.js 18+ (chuẩn **CommonJS** `require`/`module.exports`).
- **Framework**: Express 4.21.2.
- **Cơ sở dữ liệu**: MySQL 8 qua driver `mysql2/promise` (connection pooling, parameterized queries).
- **Caching**: Redis 7 qua `redis` client v4.7.
- **Message Broker**: RabbitMQ qua `amqplib` v0.10.4 (channel reuse, Dead-Letter Exchange `subtitles_dlx`).
- **Xác thực & Mã hóa**: `jsonwebtoken`, Node.js native `crypto` (`scrypt` hash mật khẩu, SHA-256 digest refresh token, HMAC-SHA256 OTP).
- **Rate Limiting**: `express-rate-limit` (áp dụng theo IP và theo từng endpoint nhạy cảm: auth, OTP, subtitles).

---

## 2. 🗂️ Bản Đồ Cấu Trúc Mã Nguồn `backend/src/`

```text
backend/
├── src/
│   ├── config/                  # Cấu hình kết nối & Khởi tạo pool
│   │   ├── db.js                # MySQL connection pool + hàm checkDatabase() + closeDatabase()
│   │   ├── redis.js             # Redis client + hàm checkRedis() + closeRedis()
│   │   └── rabbitmq.js          # AMQP connection + getChannel() + closeRabbitMq() + DLX topology
│   │
│   ├── controllers/             # Bộ điều khiển nghiệp vụ (Request -> Service/DB -> Response)
│   │   ├── authController.js    # Register, login, OTP request/verify, reset password, refresh token, logout
│   │   ├── subtitleController.js# Lấy phụ đề theo videoId (Redis cache -> MySQL -> RabbitMQ push), kiểm tra status task
│   │   ├── vocabController.js   # Lưu từ vựng, đọc danh sách đã lưu, cập nhật đánh giá FSRS, bulk update thẻ
│   │   └── learningInsightsController.js # Thống kê tiến độ học, số thẻ đến hạn, gợi ý deck học
│   │
│   ├── middleware/              # Middleware kiểm soát luồng
│   │   └── authenticateJwt.js   # Xác thực Access Token JWT, kiểm tra session active và auth_version trong MySQL
│   │
│   ├── routes/                  # Định tuyến REST API
│   │   ├── authRoutes.js        # Gắn `/api/v1/auth/*`
│   │   ├── subtitleRoutes.js    # Gắn `/api/v1/subtitles/*`
│   │   ├── vocabRoutes.js       # Gắn `/api/v1/vocabulary/*`
│   │   └── learningRoutes.js    # Gắn `/api/v1/learning/*`
│   │
│   ├── services/                # Tầng logic nghiệp vụ độc lập & xử lý tính toán
│   │   ├── authCryptoService.js # Scrypt password hash/verify, token SHA-256 digest, OTP HMAC, sign/verify JWT
│   │   ├── otpDeliveryService.js# Gửi OTP (in ra console ở development; webhook ở production)
│   │   ├── fsrsService.js       # Thuật toán lập lịch ôn tập FSRS phía server (DSR model)
│   │   └── learningInsightsService.js # Thu thập chỉ số học tập người dùng
│   │
│   ├── utils/                   # Hàm tiện ích & Validation
│   │   ├── authValidation.js    # Validate email, mật khẩu mạnh, OTP code, device metadata
│   │   └── validation.js        # Validate & normalize videoId, platform ('youtube' | 'tiktok'), rating FSRS
│   │
│   └── server.js                # Entry point: CORS, rate limiting, request ID, health checks, error handler
│
├── migrations/                  # Các file SQL migration theo thứ tự (idempotent)
├── test/                        # Bộ kiểm thử tích hợp (Node test runner native)
└── package.json                 # scripts: dev, start, check, test
```

---

## 3. 🔒 Ranh Giới Bảo Mật & Quy Tắc Xác Thực (Security Boundary)

1. **User Identity Tuyệt Đối Lấy Từ Token:**
   - Mọi route thuộc `/api/v1/vocabulary/*` và `/api/v1/learning/*` **bắt buộc** đi qua `authenticateJwt`.
   - Controller **chỉ được phép lấy `userId` từ `req.auth.userId`**.
   - Tuyệt đối **từ chối (HTTP 400)** nếu client gửi `user_id` hoặc `userId` trong query, body hoặc route params nhằm ngăn chặn privilege escalation.
2. **Quản Lý Phiên (Session & Token Revocation):**
   - Refresh token chỉ được lưu dưới dạng mã băm SHA-256 trong database.
   - Khi phát hiện refresh token bị tái sử dụng (token reuse), toàn bộ token family và session phải bị thu hồi ngay lập tức.
   - Reset mật khẩu phải tăng `auth_version` của người dùng và vô hiệu hóa mọi phiên đăng nhập cũ.
3. **Phòng Chống SQL Injection:**
   - 100% câu truy vấn MySQL phải sử dụng Parameterized Queries (`db.execute('SELECT ... WHERE id = ?', [id])`). Không bao giờ cộng chuỗi SQL.

---

## 4. 📐 Quy Chuẩn Response & Xử Lý Lỗi (Consistent Error Handling)

1. **Chuẩn hóa phản hồi lỗi:**
   Mọi phản hồi lỗi phải có cấu trúc nhất quán gồm `error` và `request_id`:
   ```json
   {
     "error": "Mô tả lỗi ngắn gọn, thân thiện.",
     "request_id": "c0a80101-1234-5678-abcd-ef0123456789"
   }
   ```
2. **Mã HTTP Status chuẩn:**
   - `400 Bad Request`: Thiếu trường bắt buộc hoặc dữ liệu sai định dạng.
   - `401 Unauthorized`: Token không hợp lệ, phiên đã hết hạn hoặc đã logout.
   - `403 Forbidden`: Không có quyền truy cập tài nguyên.
   - `404 Not Found`: Không tìm thấy endpoint hoặc tài nguyên.
   - `429 Too Many Requests`: Vượt ngưỡng rate limit.
   - `500 Internal Server Error`: Lỗi hệ thống ngoài tầm kiểm soát.

---

## 5. 🔍 Quy Trình Kiểm Thử & Nghiệm Thu (Verification)

Mỗi khi chỉnh sửa mã nguồn backend, AI **BẮT BUỘC** thực hiện 2 lệnh sau:

### 1. Kiểm tra cú pháp (Syntax Check)
```powershell
cd backend
npm run check
```
Đảm bảo tất cả các file controller, route, service, middleware và config đều không có lỗi syntax.

### 2. Chạy toàn bộ Unit & Integration Test
```powershell
cd backend
npm test
```
Toàn bộ **39 bài kiểm thử** (auth, token rotation, JWT boundary, FSRS, vocabulary, platform scraper tasks...) phải **PASS 100%**. Không được để bất kỳ bài kiểm thử nào bị lỗi hoặc bị cancel.
