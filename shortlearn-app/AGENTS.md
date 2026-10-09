# 📱 ShortLearn Mobile App — Hướng Dẫn Phát Triển Cho AI (shortlearn-app/)

> File này quy định chi tiết cấu trúc, quy tắc lập trình và kiểm thử cho ứng dụng React Native / Expo (`shortlearn-app/`).

---

## 1. ⚙️ Tech Stack & Thư Viện Cốt Lõi

- **Core**: React Native 0.86.3, React 19.2.3, Expo SDK ~57.0.26, TypeScript ~5.9.3.
- **Navigation**: React Navigation v7 (`@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`).
- **WebView**: `react-native-webview` 13.16.1.
- **Hiệu năng & Danh sách**: `@shopify/flash-list` v2 (dùng cho phụ đề dài, flashcards, từ vựng đã lưu).
- **Lưu trữ & Bảo mật**: `expo-secure-store` (lưu access token / YouTube session), `expo-splash-screen`.
- **OAuth Native**: `@react-native-google-signin/google-signin` (đăng nhập Google để lấy quyền `youtube.readonly` — KHÔNG đăng nhập qua web form trong WebView).

---

## 2. 🗂️ Bản Đồ Thư Mục `src/` & Thành Phần Hiện Có

Trước khi tạo bất kỳ component, hook hay helper mới nào, AI **phải tra cứu danh sách dưới đây** để tái sử dụng:

```text
shortlearn-app/
├── App.tsx                        # Entry point chính: Bọc Provider, quản lý state phát video, cue active, modal tra từ
├── App.v2_complex.tsx             # Phiên bản thử nghiệm kiến trúc (tham khảo)
├── app.json                       # Cấu hình Expo (plugins, package com.shortlearn.app)
├── package.json                   # Scripts: start, web, android, ios, typecheck
├── tsconfig.json                  # Cấu hình TypeScript kế thừa expo/tsconfig.base
│
└── src/
    ├── components/                # UI Components tái sử dụng
    │   ├── LanguageReactorOverlay.tsx   # Khoang phụ đề song ngữ: từ bấm được, auto-pause, highlight từ active
    │   ├── FlashcardReview.tsx          # Giao diện ôn tập FSRS v5 / SM-2: 4 nút Again/Hard/Good/Easy, audio context replay
    │   ├── SavedItemsView.tsx           # Quản lý từ vựng đã lưu: tìm kiếm, lọc theo deck, cập nhật trạng thái học hàng loạt
    │   ├── ShortVideoWebView.tsx        # Memoized WebView: bọc react-native-webview với các props tăng tốc phần cứng
    │   ├── SubtitleOverlay.tsx          # Component overlay phụ đề cũ (dạng floating)
    │   ├── TranscriptCueRow.tsx         # Memoized row hiển thị 1 câu phụ đề trong FlashList
    │   └── LearningDisplaySettings.tsx  # Modal cấu hình hiển thị (cỡ chữ, ẩn/hiện tiếng Việt)
    │
    ├── hooks/                     # Custom React Hooks
    │   └── useWebViewActivity.ts        # Quản lý trạng thái WebView (tạm dừng khi người dùng chuyển sang tab khác)
    │
    ├── navigation/                # Hệ thống điều hướng
    │   ├── AuthStack.tsx                # Stack auth (SignIn, SignUp, OTP, ForgotPassword, Main)
    │   ├── MainTabs.tsx                 # Bottom Tabs (Shorts, Review, Account)
    │   ├── BottomNavigation.tsx         # Thanh tab bar tùy chỉnh với badge đếm số thẻ đến hạn
    │   └── types.ts                     # Type definitions cho navigation params
    │
    ├── providers/                 # React Context Providers
    │   ├── AuthProvider.tsx             # Quản lý token, login, logout, refresh, API calls có auth
    │   └── AppRuntimeProvider.tsx       # Lưu trạng thái runtime (app ownership, platform info)
    │
    ├── screens/                   # Các màn hình lớn
    │   ├── ShortsScreen.tsx             # Màn hình phát video Shorts + khoang phụ đề + transcript bên dưới
    │   ├── ReviewScreen.tsx             # Màn hình ôn tập từ vựng & flashcards
    │   └── AccountScreen.tsx            # Màn hình liên kết tài khoản YouTube / TikTok & cài đặt
    │
    ├── services/                  # Giao tiếp API & Dịch vụ ngoài
    │   ├── api.ts                       # `apiRequest` bọc fetch với tự động đính token & chuẩn hóa lỗi
    │   ├── learningPreferences.ts       # Lưu/đọc cấu hình học tập và hiển thị qua AsyncStorage
    │   ├── videoPlatform.ts             # Phân tích URL Shorts/TikTok, chuẩn hóa platform ID
    │   └── youtubeAuth.ts               # Tích hợp Google Sign-In native để lấy YouTube channel info
    │
    ├── types/                     # Định nghĩa TypeScript dùng chung
    │   └── learning.ts                  # Types: WordLearningState, LearningStage, CardLabelColor
    │
    ├── utils/                     # Các hàm thuật toán thuần túy (pure functions)
    │   ├── binarySearchSubtitles.ts     # Tìm kiếm nhị phân O(log N) câu phụ đề khớp với thời gian video hiện tại
    │   └── srsAlgorithm.ts              # Thuật toán lặp lại ngắt quãng SM-2 và FSRS
    │
    ├── webview/                   # Injected Scripts điều khiển WebView
    │   └── tiktokBridge.ts              # `TIKTOK_INJECTED_SCRIPT`: JavaScript tiêm vào TikTok mweb
    │
    └── injected_script.js         # Injected Script V2 cũ của YouTube Shorts (tham khảo)
```

---

## 3. 🎥 Quy Tắc Bất Di Bất Dịch Với WebView & YouTube Shorts

Kỹ thuật cốt lõi của ShortLearn là **đánh chặn DOM trên WebView** của YouTube Shorts và TikTok. Đây là khu vực **nhạy cảm nhất** trong codebase:

1. **Tuyệt đối KHÔNG làm gãy (break) Injected JavaScript đang chạy:**
   - Script tiêm vào YouTube Shorts (`INJECTED_SCRIPT` trong `App.tsx` phiên bản `__SHORTLEARN_LR_V13__`) thực hiện 5 nhiệm vụ sống còn:
     - **Triệt tiêu phụ đề gốc:** Ẩn triệt để `video::cue` (transparent) và xóa/ẩn các class DOM phụ đề của YouTube (`.ytp-caption-window-container`, `.caption-window`, `[class*="caption-"]`).
     - **Tự động bật tiếng (Auto-Unmute):** `video.muted = false`, `video.volume = 1.0` và tự kích hoạt trigger sau khi video load.
     - **Cử chỉ vuốt chuyển Shorts mượt mà:** Bắt sự kiện touch tại `Capture Phase` (`window.addEventListener('touchstart', ..., true)`) để ngăn WebView chặn vuốt.
     - **Lấy thời gian phát (Time Tracking):** Lắng nghe `timeupdate` và gửi về React Native qua `window.ReactNativeWebView.postMessage`.
     - **Điều khiển 2 chiều (Bidirectional Bridge):** Nhận lệnh từ React Native (`PAUSE_VIDEO`, `RESUME_VIDEO`, `SEEK_TO`, `NEXT_SHORT`, `PREV_SHORT`).
2. **Kiểm tra kỹ trước khi sửa:**
   - Luôn đọc kỹ mã script inject hiện tại trước khi chạm vào bất kỳ dòng nào.
   - Khi cần điều chỉnh script, hãy kiểm tra tác động trên cả chế độ portrait và khi video tự động chuyển sang video tiếp theo.
3. **Mục tiêu kiến trúc:**
   - Dần dần tách các đoạn script inject khổng lồ ra khỏi file UI React Native (chuyển vào thư mục `src/webview/` tương tự như `src/webview/tiktokBridge.ts`), nhưng **KHÔNG** làm thay đổi bất kỳ hành vi hoặc biến toàn cục nào của script (`window.__SHORTLEARN_LR_V13__`).

---

## 4. 📝 Quy Tắc Viết Code React Native & TypeScript

- **Tuân thủ TypeScript nghiêm ngặt:** Luôn định nghĩa types rõ ràng cho props, state và API payload trong `src/types/`.
- **Tránh re-render không cần thiết:**
  - `ShortVideoWebView` và `TranscriptCueRow` phải luôn được bọc trong `React.memo`.
  - Dùng `useCallback` cho các hàm truyền qua props và `useMemo` cho các phép tính danh sách (`wordLearningStates`, `transcriptIndexByStartTime`).
- **Không can thiệp vào `android/` trừ khi bắt buộc:**
  - Quản lý quyền, orientation, splash screen qua `app.json` và Expo Config Plugins.
  - Chỉ sửa `android/` khi thêm thư viện Native đòi hỏi chỉnh sửa Java/Kotlin hoặc Gradle mà plugin không hỗ trợ.
- **Xác thực và OAuth:**
  - Tuyệt đối không nhúng form đăng nhập Google vào WebView (vi phạm chính sách OAuth của Google và sẽ bị chặn Disallowed User-Agent). Chỉ dùng `@react-native-google-signin/google-signin`.

---

## 5. 🔍 Quy Trình Kiểm Thử & Nghiệm Thu (Verification)

Mỗi khi chỉnh sửa bất kỳ file nào trong `shortlearn-app/`, AI **BẮT BUỘC** thực hiện:

```powershell
cd shortlearn-app
npm run typecheck
```

Lệnh trên chạy `tsc --noEmit`. Chỉ khi output trả về mã `0` (không có bất kỳ lỗi type nào) thì thay đổi mới được coi là hoàn tất.

Nếu có thay đổi liên quan đến cấu hình native:
```powershell
npx expo run:android
```
