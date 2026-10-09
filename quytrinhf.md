# 📋 ShortLearn — Quy Trình Phát Triển Chuẩn Cho AI / Vibe Coding (SOP)

> Tài liệu này chuẩn hóa toàn bộ các quy trình tương tác, phân tích ý tưởng, lập kế hoạch và thực thi code cho lập trình viên và các trợ lý AI (Gemini, Claude Code, Codex, Cursor...) trong toàn bộ dự án **ShortLearn**.

---

## 🧭 Mục lục Quy trình

1. [Quy Trình 1: Phân Tích Ý Tưởng Mới (Feature Ideation / RFC)](#-quy-trình-1-phân-tích-ý-tưởng-mới-feature-ideation--rfc)
2. [Quy Trình 2: Rà Soát Code Thực Tế & Cập Nhật ROADMAP](#-quy-trình-2-rà-soát-code-thực-tế--cập-nhật-roadmap)
3. [Quy Trình 3: Thực Thi Task Chuẩn (Task Execution Workflow)](#-quy-trình-3-thực-thi-task-chuẩn-task-execution-workflow)

---

## 💡 Quy Trình 1: Phân Tích Ý Tưởng Mới (Feature Ideation / RFC)

Áp dụng khi người dùng hoặc nhóm phát triển đưa ra một ý tưởng, tính năng mới hoặc thay đổi lớn trong sản phẩm.

### 🛑 Nguyên tắc tiên quyết
> **TUYỆT ĐỐI KHÔNG VIẾT CODE NGAY LẬP TỨC.** Mọi ý tưởng đều phải trải qua bước phân tích tác động và chuyển hóa thành đặc tả kỹ thuật chi tiết.

### Các bước thực hiện:
1. **Đọc tài liệu quy chuẩn:** Đọc `AGENTS.md` (root và module liên quan) để nắm các điều cấm kỵ và tech stack.
2. **Kiểm tra trạng thái hiện tại:** Đối chiếu `ROADMAP.md` và mã nguồn hiện có xem chức năng này đã tồn tại, đang dở dang hay trùng lặp với tính năng nào chưa.
3. **Xác định phạm vi ảnh hưởng (Blast Radius):** Nêu rõ ý tưởng tác động đến module nào (`shortlearn-app`, `backend`, `ai-worker` hay hạ tầng DB/Queue).
4. **Đánh giá đa chiều:**
   - **Lợi ích:** Đem lại giá trị gì cho người học tiếng Anh hoặc hiệu năng hệ thống?
   - **Rủi ro:** Có làm gãy luồng video, làm chậm WebView, rò rỉ token hay vi phạm chính sách của bên thứ ba không?
   - **Độ phức tạp:** Ước lượng mức độ (Nhỏ / Vừa / Lớn).
5. **Soạn thảo Bản đặc tả kỹ thuật chuẩn:**
   - **Mục tiêu tính năng:** Định nghĩa ngắn gọn kết quả cần đạt được.
   - **User flow:** Các bước thao tác cụ thể của người dùng trên ứng dụng.
   - **UI/UX dự kiến:** Bố cục màn hình, màu sắc (theo dark theme `#000000` / `#090D16`), vị trí nút bấm, trạng thái active.
   - **Logic xử lý:** Luồng dữ liệu, thuật toán (nếu có), cơ chế debounce/throttle.
   - **Dữ liệu cần lưu:** Thay đổi schema MySQL, cấu trúc Redis key hoặc Secure Store.
   - **Thay đổi API / Backend:** Các endpoint mới hoặc cập nhật middleware/controller.
   - **Thay đổi Mobile App:** Components, screens, navigation params hoặc hooks cần thêm/sửa.
   - **Thay đổi AI Worker:** Có cần cập nhật scraper, Whisper STT hay LLM prompt không?
   - **Edge cases:** Mất mạng, video không có tiếng/phụ đề, token hết hạn, người dùng vuốt nhanh, spam bấm nút.
   - **Điều kiện hoàn thành (Definition of Done):** Tiêu chí kiểm tra rõ ràng để xác nhận task đã xong.
   - **Bộ test cần chạy:** Lệnh test cụ thể cho từng module.
   - **Mức ưu tiên:** P0 (bắt buộc/sống còn), P1 (quan trọng), P2 (nâng cao).
6. **Đề xuất tích hợp vào ROADMAP.md:** Đưa vào sprint/giai đoạn phù hợp mà **không sửa source code**.

---

## 🗺️ Quy Trình 2: Rà Soát Code Thực Tế & Cập Nhật ROADMAP

Áp dụng khi cần tổng kết tiến độ, chuyển giao sprint hoặc chuẩn bị kế hoạch phát triển tiếp theo.

### 🛑 Nguyên tắc tiên quyết
> **KHÔNG ĐÁNH DẤU HOÀN THÀNH CHỈ DỰA VÀO VĂN BẢN.** Mọi dấu tích `[x]` phải được chứng minh bằng mã nguồn đang chạy và các bài kiểm thử thành công.

### Các bước thực hiện:
1. **Đối chiếu thực tế (Source Code Audit):** Quét mã nguồn để phân loại từng task trong `ROADMAP.md` thành 4 trạng thái:
   - ✅ **Đã hoàn thành (Done):** Mã nguồn đã có, hoạt động đúng và pass toàn bộ typecheck/test.
   - 🔄 **Hoàn thành một phần (Partial):** Đã có khung/service nhưng còn thiếu UI, thiếu persistence hoặc chưa kết nối hoàn chỉnh.
   - ⏳ **Chưa làm (Todo):** Mới chỉ có mô tả hoặc placeholder, chưa có logic thật.
   - 🚫 **Không còn phù hợp (Deprecated):** Đã thay đổi định hướng sản phẩm hoặc bị thay thế bởi giải pháp tối ưu hơn.
2. **Bảo toàn các task chưa hoàn thành:** Giữ nguyên các task Todo/Partial; bổ sung ghi chú hiện trạng chính xác.
3. **Lập kế hoạch giai đoạn tiếp theo (Next Sprint Planning):**
   - Chỉ lập kế hoạch vừa đủ cho 1 giai đoạn ngắn (3–5 task then chốt), không vẽ kế hoạch quá xa xôi.
   - Tuân thủ thứ tự ưu tiên nghiêm ngặt:
     1. **Bug / Tính ổn định & An toàn** (bảo vệ injected script, sửa crash, vá lỗ hổng bảo mật).
     2. **Chức năng core chưa hoàn thiện** (auth session, lưu từ vựng thật, đồng bộ backend).
     3. **Hiệu năng (Performance)** (virtualization, giảm re-render, tách monolithic component).
     4. **Trải nghiệm người dùng (UX)** (loading state, error message, offline banner).
     5. **Tính năng mới (New Features)** (chỉ làm khi core đã vững chắc).
4. **Cấu trúc mỗi task mới trong ROADMAP:**
   - **Mục tiêu:** Rõ ràng, đo lường được.
   - **Mức ưu tiên:** P0 / P1 / P2.
   - **File/Module liên quan:** Chỉ định đường dẫn cụ thể.
   - **Điều kiện hoàn thành (DoD):** Tiêu chí nghiệm thu rõ ràng.
   - **Kiểm thử / Verification:** Lệnh chạy test hoặc kịch bản kiểm tra thủ công.
   - **Dependency:** Cần task nào hoàn thành trước.
5. **Cập nhật ROADMAP.md:** Ghi nhận ngày cập nhật, tóm tắt các việc vừa đóng, các việc tồn đọng và kế hoạch mới. **Không sửa source code ứng dụng**.

---

## ⚡ Quy Trình 3: Thực Thi Task Chuẩn (Task Execution Workflow)

Áp dụng khi bắt tay vào sửa code cho một task cụ thể từ `ROADMAP.md`.

### Bước 1: Trước khi viết code (Pre-code Checklist)
1. **Chọn task:** Chọn đúng task chưa hoàn thành đầu tiên theo thứ tự ưu tiên trong `ROADMAP.md`.
2. **Tìm implementation hiện tại:** Dùng `grep_search` hoặc `view_file` xem mã nguồn hiện tại đang giải quyết vấn đề đó thế nào.
3. **Xác định trạng thái code:** Đọc kỹ luồng dữ liệu, các edge cases và hàm dùng chung.
4. **Báo cáo kế hoạch ngắn (Short Plan):** Nêu rõ:
   - Sẽ sửa những file nào?
   - Vì sao phải sửa các file đó?
   - Dự kiến thay đổi logic gì?
5. **Nguyên tắc Minimal Blast Radius:** Chỉ thay đổi tối thiểu cần thiết, tuyệt đối không refactor lan man ngoài phạm vi của task.

### Bước 2: Thực hiện chỉnh sửa mã nguồn
- Tôn trọng triệt để các điều cấm trong `AGENTS.md` (không rewrite, không đổi framework, không làm gãy injected script).
- Tái sử dụng components, hooks, services và utils có sẵn.
- Giữ vững TypeScript types và CommonJS/Python styling chuẩn.

### Bước 3: Sau khi viết code (Post-code Verification)
Bắt buộc chạy lệnh kiểm thử tương ứng với module bị tác động:
- **`shortlearn-app/`:**
  ```powershell
  cd shortlearn-app
  npm run typecheck
  ```
  *(Nếu có chỉnh sửa cấu hình native Android: `npx expo run:android`)*
- **`backend/`:**
  ```powershell
  cd backend
  npm run check
  npm test
  ```
  *(Đảm bảo 100% test pass, không có regression)*
- **`ai-worker/`:**
  ```powershell
  cd ai-worker
  .\.venv\Scripts\python.exe -m unittest discover test
  ```
  *(Đảm bảo 14 test pass)*

### Bước 4: Nghiệm thu & Chốt task
1. Kiểm tra lại hoạt động trên thực tế hoặc qua kịch bản kiểm thử.
2. Nếu có lỗi: Sửa lỗi ngay và chạy lại bước kiểm thử cho đến khi pass hoàn toàn.
3. **Chỉ khi task thực sự hoàn thành:** Cập nhật tick `[x]` trong `ROADMAP.md` kèm ghi chú ngày nghiệm thu và kết quả test.
4. **Dừng lại báo cáo người dùng:** Không tự ý chuyển sang task tiếp theo mà chưa có sự đồng ý của người dùng.
Hãy phân tích toàn bộ project hiện tại "ShortLearn" trước khi thực hiện bất kỳ thay đổi nào.











Tôi có một ý tưởng mới cho ShortLearn:

[VIẾT Ý TƯỞNG CỦA TÔI Ở ĐÂY]

Hãy KHÔNG code ngay.

Trước tiên:
1. Đọc AGENTS.md.
2. Kiểm tra ROADMAP.md và implementation hiện tại.
3. Xác định ý tưởng này có trùng với chức năng hiện có không.
4. Xác định nó ảnh hưởng đến module/file nào.
5. Chỉ ra lợi ích, rủi ro và độ phức tạp.
6. Nếu ý tưởng còn mơ hồ, hãy biến nó thành đặc tả rõ ràng.

Hãy viết chi tiết:
- Mục tiêu tính năng.
- User flow.
- UI/UX dự kiến.
- Logic xử lý.
- Dữ liệu cần lưu.
- API/backend có cần thay đổi không.
- Mobile có cần thay đổi không.
- ai-worker có liên quan không.
- Edge cases.
- Điều kiện hoàn thành.
- Test cần chạy.
- Mức ưu tiên P0/P1/P2.
- Ước lượng độ khó: nhỏ / vừa / lớn.

Sau đó đề xuất cách thêm ý tưởng này vào ROADMAP.md.

KHÔNG sửa source code.
Chỉ cập nhật ROADMAP.md sau khi đã phân tích đầy đủ.


Đọc AGENTS.md, ROADMAP.md và kiểm tra trạng thái code hiện tại của ShortLearn.

Nhiệm vụ lần này CHỈ LÀ cập nhật kế hoạch tiếp theo trong ROADMAP.md.
KHÔNG sửa source code.

Hãy:

1. Đối chiếu ROADMAP.md với implementation thực tế.
2. Xác định:
   - Task nào đã hoàn thành.
   - Task nào hoàn thành một phần.
   - Task nào chưa làm.
   - Task nào không còn phù hợp.
3. Không đánh dấu hoàn thành chỉ dựa vào ROADMAP; phải xác minh bằng source code.
4. Giữ lại các task chưa hoàn thành.
5. Dựa trên trạng thái hiện tại, lập kế hoạch cho giai đoạn tiếp theo.

Mỗi task mới cần có:
- Mục tiêu.
- Mức ưu tiên: P0 / P1 / P2.
- Các file/module dự kiến liên quan.
- Điều kiện để coi là hoàn thành.
- Test hoặc cách kiểm tra.
- Dependency nếu có.

Sắp xếp task theo thứ tự nên thực hiện.

Ưu tiên:
1. Bug / tính ổn định.
2. Chức năng core chưa hoàn thiện.
3. Performance.
4. UX.
5. Feature mới.

Không lập kế hoạch quá xa.
Chỉ tạo kế hoạch đủ cho giai đoạn phát triển tiếp theo.

Sau khi phân tích:
- Cập nhật ROADMAP.md.
- Không sửa bất kỳ source code nào.
- Cuối cùng tóm tắt:
  + Những task vừa đóng.
  + Những task còn tồn đọng.
  + Plan mới được thêm.
  + Task nên làm đầu tiên tiếp theo.




  Đọc AGENTS.md và phần liên quan trong ROADMAP.md.

Kiểm tra trạng thái code hiện tại của ShortLearn và chọn task chưa hoàn thành đầu tiên theo thứ tự ưu tiên trong ROADMAP.md.

Trước khi sửa code:
1. Tìm implementation hiện tại.
2. Xác định task đang ở trạng thái nào.
3. Nói ngắn gọn sẽ sửa những file nào và vì sao.
4. Chỉ thay đổi tối thiểu cần thiết.
5. Không refactor ngoài phạm vi task.

Sau khi sửa:
1. Chạy typecheck/test phù hợp.
2. Sửa lỗi nếu có.
3. Kiểm tra lại chức năng.
4. Chỉ khi task thực sự hoàn thành mới cập nhật ROADMAP.md.
5. Không tự chuyển sang task tiếp theo.




Đọc AGENTS.md và AGENTS.md của module liên quan.

Đọc task tiếp theo trong ROADMAP.md.
Kiểm tra implementation hiện tại và thực hiện task đó.

Nếu có nhiều task độc lập, hãy chia cho các agent song song theo
quy tắc Multi-Agent.

Chạy toàn bộ verification liên quan trước khi đánh dấu hoàn thành.
Cập nhật ROADMAP.md sau khi xác minh thành công.




Đọc AGENTS.md và AGENTS.md của module liên quan.

Đọc task tiếp theo trong ROADMAP.md và kiểm tra implementation hiện tại.

Nếu có các task độc lập, chia multi-agent theo ownership.
Thực hiện theo acceptance criteria.
Chạy verification đầy đủ.
Chỉ cập nhật ROADMAP sau khi đạt Definition of Done.




Đọc Root AGENTS.md và AGENTS.md của module liên quan.

Đọc các task ưu tiên cao nhất chưa hoàn thành trong ROADMAP.md.
Đối chiếu với implementation hiện tại.

Nếu có nhiều task độc lập, chia multi-agent theo ownership và dependency.
Thực hiện các task an toàn có thể chạy song song.

Chạy verification theo Definition of Done.
Chỉ cập nhật ROADMAP.md sau khi task được xác minh hoàn thành.