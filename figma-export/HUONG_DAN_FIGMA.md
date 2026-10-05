# 🎨 Hướng Dẫn Đồng Bộ Giao Diện ShortLearn Sang Figma Make

> 🔗 **Dự án Figma Make của bạn:** [E-learning platform development](https://www.figma.com/make/9RRGxgu9XwSBnm9LkNeIv8/E-learning-platform-development?p=f&t=OZ4NPEHXLtGGFAly-0)  
> 🕒 **Thời gian cập nhật:** Tháng 10/2026  
> 📱 **Nguồn dữ liệu:** Android Studio Emulator (`emulator-5554`) & Ứng dụng ShortLearn React Native

---

## 📂 Danh mục tài nguyên đã cập nhật trong `figma-export/`

Thư mục [figma-export](file:///d:/java/app%20short/figma-export/) đã được cập nhật toàn diện để khớp với file Figma Make của bạn:

1. **[index.html](file:///d:/java/app%20short/figma-export/index.html)**: Giao diện trực quan tích hợp nút mở dự án Figma của bạn và các nút **"Copy SVG"** một chạm.
2. **Thư mục vector [svg/](file:///d:/java/app%20short/figma-export/svg/)**:
   - `desktop_elearning_platform.svg`: **Bản thiết kế toàn cảnh Dashboard E-Learning** (1440 x 900) đồng bộ với giao diện Figma Make (thanh điều hướng bên trái, khung điện thoại chạy Shorts ở giữa, bảng phụ đề ngữ cảnh & timeline ở bên phải, các chỉ số từ vựng/streak bên dưới).
   - `screen_shorts_player.svg`: Màn hình YouTube Shorts kèm khoang Language Reactor 190 px theo đúng component trong app.
   - `screen_tiktok_player.svg`: Màn hình TikTok Learning mới; dock phụ đề, bản dịch và hàng điều khiển đồng bộ với YouTube.
   - `screen_word_popover.svg`: Popup tra từ ngữ cảnh (phiên âm, nghĩa, nút lưu Flashcard SRS, đổi nhãn trạng thái).
   - `screen_saved_items.svg`: Màn hình danh sách từ vựng đã lưu (Saved items) với bảng phân loại, bộ lọc và gợi ý FSRS.
   - `screen_account_settings.svg`: Màn hình liên kết tài khoản YouTube và tùy chỉnh hiển thị Giai đoạn học tập.
   - `screen_modal.svg`: Hộp thoại Bottom Sheet dán link YouTube Shorts.
3. **Thư mục ảnh chụp [screens/](file:///d:/java/app%20short/figma-export/screens/)**: 5 ảnh chụp từ thiết bị ảo Android Studio và 1 preview TikTok được render từ SVG vector.

---

## 🚀 3 Bước nhanh nhất để đưa vào dự án Figma Make của bạn

### ⚡ Cách 1: Copy mã SVG và dán trực tiếp (Khuyên dùng - Nhanh nhất)
1. Mở file [index.html](file:///d:/java/app%20short/figma-export/index.html) bằng trình duyệt (Chrome / Edge).
2. Tại màn hình bạn cần (ví dụ: *Bản Thiết Kế Toàn Cảnh Desktop* hoặc *Shorts Player di động*), bấm nút **"📋 Copy SVG"**.
3. Mở tab dự án của bạn: [Figma Make - E-learning platform development](https://www.figma.com/make/9RRGxgu9XwSBnm9LkNeIv8/E-learning-platform-development?p=f&t=OZ4NPEHXLtGGFAly-0).
4. Nhấn phím **`Ctrl + V`** (hoặc `Cmd + V` trên macOS) vào canvas Figma.
5. **Kết quả:** Figma sẽ tự động chuyển thành Frame hoàn chỉnh với đầy đủ các Layer vector, chữ có thể chỉnh sửa font, đổi màu và icon riêng biệt.

---

### 📂 Cách 2: Kéo thả trực tiếp file SVG vào Figma
1. Mở thư mục [svg/](file:///d:/java/app%20short/figma-export/svg/) trong File Explorer của Windows.
2. Kéo thả trực tiếp file `desktop_elearning_platform.svg` hoặc các file `screen_*.svg` vào cửa sổ Figma.
3. Các file SVG sẽ trở thành các Frame vector chuẩn, không bị vỡ nét và có thể sửa đổi từng thành phần.

---

### 🧩 Cách 3: Dùng Plugin Figma `html.to.design`
1. Trên Figma, vào menu **Plugins** -> tìm kiếm plugin **`html.to.design`**.
2. Kéo thả file [index.html](file:///d:/java/app%20short/figma-export/index.html) vào plugin.
3. Plugin sẽ tự động phân tích và tạo thành các Figma Component với Auto-layout đầy đủ.

---

## 🎨 Design System & Thông số UI của ShortLearn

### 1. Bảng màu (Color Palette)

| Tên màu | Mã Hex | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Dark Base** | `#070B14` / `#090D16` | Nền chính của toàn bộ ứng dụng (Dark mode sâu) |
| **Surface Card** | `#0F172A` / `#1E293B` | Nền của các thẻ, Dock Language Reactor, popup tra từ |
| **Subtitle Dock** | `#191B1E` / `#292C31` | Nền dock và nút điều khiển đồng bộ giữa YouTube và TikTok |
| **Border Subtle** | `rgba(255, 255, 255, 0.08)` | Đường viền các card và vùng ngăn cách |
| **Sky Accent** | `#38BDF8` | Màu thương hiệu chính, nút thêm video, từ đang chọn |
| **Amber Accent** | `#F59E0B` / `#FBBF24` | Phụ đề tiếng Việt, từ vựng đang học (`learning`) |
| **Purple Accent** | `#A855F7` / `#A259FF` | Phụ đề tiếng Anh, cụm từ vựng |
| **Emerald Success** | `#10B981` / `#4ADE80` | Nút lưu Flashcard, trạng thái kết nối thành công |
| **Rose / YouTube** | `#EF4444` | Huy hiệu số lượng thẻ đến hạn, icon YouTube, tiến trình phát |
| **TikTok Cyan / Rose** | `#25F4EE` / `#FE2C55` | Nhận diện nền tảng TikTok và tiến trình phát |
| **Text Primary** | `#F8FAFC` | Tiêu đề chính, từ vựng tiếng Anh |
| **Text Secondary** | `#94A3B8` | Mô tả phụ, phiên âm IPA, nhãn nút phụ |

### 2. Bảng màu Giai đoạn học tập (Learning Stages)
- **Đã biết / Gợi ý (`known`)**: Chữ màu trắng `#FFFFFF`
- **Đang học (`learning`)**: Chữ màu cam hổ phách `#F97316` / `#FBBF24`
- **Để sau (`later`)**: Chữ màu xám `#64748B`
- **Thẻ màu cũ**: Gạch chân dưới từ (Đỏ `#EF4444`, Xanh lá `#22C55E`, Vàng `#EAB308`, Xanh dương `#3B82F6`)

### 3. Quy chuẩn dock phụ đề dùng chung
- Chiều cao: `190 px` trên frame mobile `390 × 844`.
- Từ tiếng Anh là các lớp text tương tác gọn, không dùng chip lớn; từ đang học dùng `#FF9D42`.
- Bản dịch tiếng Việt dùng `#E7E9ED`, ngăn cách bằng đường `#393D42`.
- Bốn điều khiển dùng chung: **Lại câu**, **Pause**, **Câu tiếp**, **Video/Short tiếp**.
