/**
 * Injected JavaScript Code for React Native WebView — V2 Optimized
 * Chạy trực tiếp trong context của m.youtube.com/shorts
 *
 * V2 Changes:
 *  - Throttle giảm xuống 100ms (chính xác cho lyric/hội thoại tốc độ cao)
 *  - CSS Fuzzy Selectors chống A/B testing class name changes
 *  - MutationObserver quét DOM ẩn phụ đề theo nội dung
 *  - DOM Garbage Collection sau mỗi 10 video
 */
export const INJECTED_SHORTS_JAVASCRIPT = `
(function () {
  if (window.__SHORTLEARN_INJECTED__) return;
  window.__SHORTLEARN_INJECTED__ = true;

  // ═══════════════════════════════════════════════════════════════
  // 1. Dọn dẹp UI — 3 lớp phòng thủ chống A/B testing CSS changes
  // ═══════════════════════════════════════════════════════════════
  const injectCSS = () => {
    const styleId = 'shortlearn-custom-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = \`
      /* === Lớp 1: Selector cứng (nhanh, bắt chính xác khi YouTube chưa đổi) === */
      ytm-mobile-topbar-renderer,
      .pivot-bar-renderer,
      .standalone-collection-badge-renderer,
      ytm-pivot-bar-renderer,
      button[aria-label="Open App"],
      .action-sheet-renderer,
      .engagement-panel-container,
      .ytp-subtitles-button,
      .ytp-caption-window-container,
      .caption-window,
      .ytp-caption-segment,

      /* === Lớp 2: Fuzzy Attribute Selectors (kháng đổi tên class) === */
      [class*="caption-window"],
      [class*="caption-segment"],
      [class*="captions-text"],
      [class*="subtitle-container"],
      [aria-label*="Subtitles"],
      [aria-label*="subtitles"],
      [aria-label*="Captions"],
      [aria-label*="captions"],
      [data-purpose*="captions"] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        height: 0 !important;
        overflow: hidden !important;
      }

      /* Giữ trải nghiệm toàn màn hình như Native App */
      body, html {
        overflow: hidden !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
    \`;
    document.head.appendChild(style);
  };

  injectCSS();
  window.addEventListener('DOMContentLoaded', injectCSS);

  // Lớp 3: MutationObserver quét DOM ẩn phụ đề theo nội dung/vị trí
  // Chạy mỗi 3 giây, tìm phần tử có text trùng phụ đề YouTube và ẩn đi
  const captionObserver = new MutationObserver(() => {
    document.querySelectorAll('[class*="caption"], [class*="subtitle"]').forEach(el => {
      if (el.offsetHeight > 0 && el.offsetHeight < 200) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      }
    });
  });
  captionObserver.observe(document.documentElement, {
    childList: true, subtree: true, attributes: false
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. Theo dõi chuyển Shorts trong SPA (History API + PopState)
  // ═══════════════════════════════════════════════════════════════
  let currentVideoId = '';
  let videosSwiped = 0; // Bộ đếm cho DOM GC

  const checkVideoChange = () => {
    const match = location.pathname.match(/\\/shorts\\/([a-zA-Z0-9_-]+)/);
    const newId = match ? match[1] : '';

    if (newId && newId !== currentVideoId) {
      currentVideoId = newId;
      videosSwiped++;

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'VIDEO_CHANGED',
          videoId: newId,
          url: location.href,
          swipeCount: videosSwiped
        }));
      }
    }
  };

  // Override History pushState & replaceState
  const origPush = history.pushState;
  history.pushState = function () {
    origPush.apply(this, arguments);
    checkVideoChange();
  };

  const origReplace = history.replaceState;
  history.replaceState = function () {
    origReplace.apply(this, arguments);
    checkVideoChange();
  };

  window.addEventListener('popstate', checkVideoChange);
  setInterval(checkVideoChange, 500);

  // ═══════════════════════════════════════════════════════════════
  // 3. Đồng bộ currentTime — Throttle 100ms (V2: tăng độ chính xác)
  // ═══════════════════════════════════════════════════════════════
  let lastReportedTime = 0;

  const getActiveVideo = () => {
    const videos = Array.from(document.querySelectorAll('video'));
    return videos.find(v => !v.paused && v.readyState >= 2 && v.clientHeight > 0) || videos[0];
  };

  const bindTimeUpdate = () => {
    const video = getActiveVideo();
    if (video && !video.dataset.shortlearnHooked) {
      video.dataset.shortlearnHooked = 'true';

      video.addEventListener('timeupdate', () => {
        const cur = video.currentTime;
        // V2: Throttle 100ms — đủ chính xác cho lyric/hội thoại tốc độ cao
        if (Math.abs(cur - lastReportedTime) >= 0.10) {
          lastReportedTime = cur;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TIME_UPDATE',
              currentTime: Number(cur.toFixed(2))
            }));
          }
        }
      });

      video.addEventListener('ended', () => {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'VIDEO_ENDED',
            videoId: currentVideoId
          }));
        }
      });
    }
  };

  setInterval(bindTimeUpdate, 400);

  // ═══════════════════════════════════════════════════════════════
  // 4. Nhận lệnh từ Native App (Pause, Play, Seek, DOM GC)
  // ═══════════════════════════════════════════════════════════════
  const handleNativeCommand = (event) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      const video = getActiveVideo();

      if (data.action === 'PAUSE_VIDEO') {
        if (video) video.pause();
      } else if (data.action === 'RESUME_VIDEO') {
        if (video) video.play();
      } else if (data.action === 'SEEK_TO' && typeof data.time === 'number') {
        if (video) video.currentTime = data.time;
      } else if (data.action === 'GC_DOM') {
        // V2: DOM Garbage Collection — giải phóng bộ nhớ video cũ
        const videos = document.querySelectorAll('video');
        const keepLast = 2; // Giữ lại 2 video gần nhất
        videos.forEach((v, i) => {
          if (i < videos.length - keepLast) {
            try {
              v.pause();
              v.removeAttribute('src');
              v.load(); // Giải phóng buffer
            } catch (e) {}
          }
        });

        // Dọn dẹp các element nặng không còn visible
        document.querySelectorAll('img[loading="lazy"]').forEach(img => {
          const rect = img.getBoundingClientRect();
          if (rect.bottom < -window.innerHeight || rect.top > window.innerHeight * 2) {
            img.removeAttribute('src');
          }
        });
      }
    } catch (e) {}
  };

  window.addEventListener('message', handleNativeCommand);
  document.addEventListener('message', handleNativeCommand);
})();
true;
`;
