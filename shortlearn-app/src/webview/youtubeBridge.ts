// YouTube Shorts injected script (__SHORTLEARN_LR_V13__).
// Moved verbatim out of App.tsx. DO NOT alter behaviour: transparent native cues,
// auto-unmute, capture-phase swipe gestures, time tracking, timedtext capture and the
// bidirectional bridge (PAUSE/RESUME/SEEK_TO/NEXT_SHORT/PREV_SHORT/SET_APP_ACTIVE).
export const YOUTUBE_INJECTED_SCRIPT = `
(function() {
  if (window.__SHORTLEARN_LR_V13__) return;
  // Android may run the "before content loaded" script against a temporary
  // document. Do not mark the bridge as ready until the real DOM exists;
  // onLoadEnd will inject this script again and complete initialization.
  if (!document.head && !document.body) return;
  window.__SHORTLEARN_LR_V13__ = true;
  var shortLearnActive = true;

  // 1. ÁP DỤNG CSS ẨN TRIỆT ĐỂ PHỤ ĐỀ GỐC Ở TRÊN VIDEO
  function applyStyles() {
    var target = document.head || document.documentElement || document.body;
    if (!target) {
      setTimeout(applyStyles, 30);
      return;
    }
    var existing = document.getElementById('shortlearn-lr-style');
    if (!existing) {
      var style = document.createElement('style');
      style.id = 'shortlearn-lr-style';
      style.textContent = \`
        /* Ẩn triệt để phụ đề WebVTT native của thẻ video */
        ::cue {
          color: transparent !important;
          background: transparent !important;
          background-color: transparent !important;
          text-shadow: none !important;
        }
        video::cue {
          color: transparent !important;
          background: transparent !important;
          background-color: transparent !important;
          text-shadow: none !important;
        }

        /* Ẩn mọi container phụ đề DOM của YouTube ở trên & giữa video */
        .caption-window,
        .ytp-caption-window-container,
        .player-caption-window-container,
        .ytp-caption-segment,
        .caption-segment,
        .captions-text,
        .caption-visual-line,
        ytm-caption-track-renderer,
        ytm-subtitles-container,
        ytm-custom-caption-renderer {
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* Ẩn các thanh công cụ rác che màn hình & header YouTube Shorts */
        ytm-mobile-topbar-renderer,
        .pivot-bar-renderer,
        ytm-pivot-bar-renderer,
        button[aria-label="Open App"],
        .action-sheet-renderer,
        ytm-shorts-player-header,
        .ytm-shorts-player-header,
        ytm-shorts-player-header-renderer,
        .ytm-shorts-player-header-renderer,
        .shorts-player-header {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      \`;
      target.appendChild(style);
    }
  }

  applyStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStyles);
  }

  // 2. KHÓA TEXTTRACK Ở CHẾ ĐỘ 'hidden' ĐỂ TRÌNH DUYỆT KHÔNG VẼ LÊN VIDEO
  try {
    if (false && window.TextTrack && TextTrack.prototype) {
      var origModeDesc = Object.getOwnPropertyDescriptor(TextTrack.prototype, 'mode');
      if (origModeDesc && origModeDesc.set) {
        Object.defineProperty(TextTrack.prototype, 'mode', {
          get: function() { return 'hidden'; },
          set: function(val) {
            // Luôn ép về 'hidden' (vừa nhận được dữ liệu cue, vừa không hiện lên video)
            return origModeDesc.set.call(this, 'hidden');
          },
          configurable: true
        });
      }
    }
  } catch(e) {}

  // 3. HÀM CHUYỂN TIẾP LỜI THOẠI SNIFF ĐƯỢC VỀ REACT NATIVE
  var lastSniffedText = '';
  function forwardSniffedText(raw) {
    if (!shortLearnActive || !raw) return;
    // Làm sạch các ghi chú nhạc cụ [música], [Music], (applause), ♪, khoảng trắng thừa
    var clean = raw
      .replace(/\\[.*?\\]/g, '')
      .replace(/\\(.*?\\)/g, '')
      .replace(/\\u266a|♪/g, '')
      .replace(/\\s+/g, ' ')
      .trim();
    if (!clean || clean.length < 2) return;
    if (clean === lastSniffedText) return;
    lastSniffedText = clean;

    var curVideo = getActiveVideo();
    var curTime = curVideo ? curVideo.currentTime : 0;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'LIVE_CAPTION_SNIFFED',
      text: clean,
      time: Number(curTime.toFixed(2))
    }));
  }

  // 4. Bắt caption theo phần tử thay đổi. Tránh quét toàn bộ span/div mỗi 80ms
  // vì Shorts có DOM rất lớn và làm WebView tiêu tốn CPU/RAM không cần thiết.
  var captionSelector = [
    '.ytp-caption-segment', '.caption-segment', '.captions-text',
    '.caption-visual-line', '.caption-window', 'ytm-caption-track-renderer',
    'ytm-subtitles-container', 'ytm-custom-caption-renderer'
  ].join(',');

  function hideCaptionElement(el) {
    if (!el || (el.id && el.id.indexOf('shortlearn') !== -1)) return;
    var isLeafCaption = el.matches && el.matches(
      '.ytp-caption-segment, .caption-segment, .caption-visual-line, ytm-caption-track-renderer'
    );
    var hasLeafCaption = el.querySelector && el.querySelector(
      '.ytp-caption-segment, .caption-segment, .caption-visual-line, ytm-caption-track-renderer'
    );
    var txt = (el.textContent || el.innerText || '').trim();
    if (
      (!hasLeafCaption || isLeafCaption) &&
      txt &&
      txt.length > 1 &&
      txt.indexOf('Language Reactor') === -1
    ) {
      forwardSniffedText(txt);
    }
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  }

  function hideMusicLeaf(el) {
    if (!el || el.children.length !== 0) return;
    var txt = (el.textContent || '').trim();
    if (!txt || !(/\\[musi/i.test(txt) || txt.indexOf('♪') !== -1)) return;
    hideCaptionElement(el);
    if (el.parentElement) hideCaptionElement(el.parentElement);
  }

  function scanCaptionSubtree(root) {
    try {
      if (!root || root.nodeType !== 1) return;
      if (root.matches && root.matches(captionSelector)) hideCaptionElement(root);
      var captions = root.querySelectorAll ? root.querySelectorAll(captionSelector) : [];
      for (var i = 0; i < captions.length; i++) hideCaptionElement(captions[i]);
      hideMusicLeaf(root);
      var musicLeaves = root.querySelectorAll ? root.querySelectorAll('span:not(:has(*)), div:not(:has(*))') : [];
      for (var j = 0; j < musicLeaves.length; j++) hideMusicLeaf(musicLeaves[j]);
    } catch(e) {}
  }

  // Initial scan chỉ chạy một lần; các lần sau chỉ xử lý subtree vừa thay đổi.
  scanCaptionSubtree(document.documentElement);
  try {
    var captionObserver = new MutationObserver(function(records) {
      if (!shortLearnActive) return;
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        if (record.type === 'characterData') {
          var parent = record.target.parentElement;
          var captionParent = parent && parent.closest ? parent.closest(captionSelector) : null;
          if (captionParent) hideCaptionElement(captionParent);
          else hideMusicLeaf(parent);
          continue;
        }
        var targetCaption = record.target && record.target.closest
          ? record.target.closest(captionSelector)
          : null;
        if (targetCaption) hideCaptionElement(targetCaption);
        for (var j = 0; j < record.addedNodes.length; j++) {
          scanCaptionSubtree(record.addedNodes[j]);
        }
      }
    });
    captionObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } catch(e) {}

  // 5. Bắt cuechange trực tiếp từ TextTrack; fallback quét ít thường xuyên để hỗ trợ player YouTube thay track động.
  var observedTracks = new WeakSet();
  var observedVideos = new WeakSet();
  function forwardActiveCues(track) {
    try {
      if (!track.activeCues || track.activeCues.length === 0) return;
      var cueTexts = [];
      for (var i = 0; i < track.activeCues.length; i++) {
        var cueText = (track.activeCues[i].text || '').replace(/<[^>]+>/g, '').trim();
        if (cueText) cueTexts.push(cueText);
      }
      if (cueTexts.length > 0) forwardSniffedText(cueTexts.join(' '));
    } catch(e) {}
  }

  function bindTracks(video) {
    try {
      if (!video || !video.textTracks) return;
      for (var i = 0; i < video.textTracks.length; i++) {
        var track = video.textTracks[i];
        if (!observedTracks.has(track)) {
          observedTracks.add(track);
          track.addEventListener('cuechange', function(event) { forwardActiveCues(event.target); });
        }
        forwardActiveCues(track);
      }
      if (!observedVideos.has(video)) {
        observedVideos.add(video);
        video.addEventListener('loadedmetadata', function() { bindTracks(video); });
        video.addEventListener('loadeddata', function() { bindTracks(video); });
      }
    } catch(e) {}
  }

  function attachTrackListeners(root) {
    try {
      if (root && root.tagName === 'VIDEO') bindTracks(root);
      var videos = root && root.querySelectorAll ? root.querySelectorAll('video') : document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) bindTracks(videos[i]);
    } catch(e) {}
  }
  attachTrackListeners(document);
  setInterval(function() {
    if (shortLearnActive) attachTrackListeners(document);
  }, 3000);

  // Tự động kích hoạt module phụ đề của YouTube player
  var captionActivatedVideoId = '';
  function enablePlayerCaptions() {
    if (!shortLearnActive) return;
    try {
      var player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
      var playerResponse = player && typeof player.getPlayerResponse === 'function'
        ? player.getPlayerResponse()
        : null;
      var playerVideoId = playerResponse?.videoDetails?.videoId;
      var playerTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (
        player &&
        playerVideoId &&
        playerTracks &&
        playerTracks.length > 0 &&
        captionActivatedVideoId !== playerVideoId &&
        typeof player.loadModule === 'function'
      ) {
        captionActivatedVideoId = playerVideoId;
        player.loadModule('captions');
        if (typeof player.setOption === 'function') {
          player.setOption('captions', 'track', { languageCode: 'en' });
        }
        // YouTube mobile can report subtitles as ON before its renderer is
        // mounted. Force one clean OFF -> ON transition for each video.
        if (
          typeof player.isSubtitlesOn === 'function' &&
          player.isSubtitlesOn() &&
          typeof player.toggleSubtitles === 'function'
        ) {
          player.toggleSubtitles();
        }
        setTimeout(function() {
          var currentPlayer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
          if (
            getCurrentVideoId() === playerVideoId &&
            currentPlayer
          ) {
            if (
              typeof currentPlayer.isSubtitlesOn === 'function' &&
              currentPlayer.isSubtitlesOn() &&
              typeof currentPlayer.toggleSubtitles === 'function'
            ) {
              currentPlayer.toggleSubtitles();
            }
            setTimeout(function() {
              var latestPlayer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
              if (
                getCurrentVideoId() === playerVideoId &&
                latestPlayer &&
                typeof latestPlayer.toggleSubtitlesOn === 'function'
              ) {
                latestPlayer.toggleSubtitlesOn();
              }
            }, 1000);
          }
        }, 1000);
      }

      var ccBtns = document.querySelectorAll(
        'button.ytp-subtitles-button, button[aria-label*="caption" i], button[aria-label*="subtitles" i], button[aria-label*="phụ đề" i]'
      );
      for (var k = 0; k < ccBtns.length; k++) {
        var btn = ccBtns[k];
        if (btn.getAttribute('aria-pressed') === 'false') {
          btn.click();
        }
      }
    } catch(e) {}
  }
  setInterval(enablePlayerCaptions, 2500);

  // 6. PHÂN TÍCH TIMEDTEXT DẠNG JSON3 HOẶC XML
  function parseTimedText(content) {
    if (!content) return [];
    var cues = [];
    try {
      var data = typeof content === 'object' ? content : JSON.parse(content);
      if (data && data.events) {
        data.events.forEach(function(e) {
          if (e.segs && e.tStartMs !== undefined) {
            var text = e.segs.map(function(s) { return s.utf8 || ''; }).join('').replace(/\\u266a|♪/g, '').replace(/\\[.*?\\]/g, '').trim();
            if (text) {
              cues.push({
                start: e.tStartMs / 1000,
                duration: (e.dDurationMs || 2500) / 1000,
                text: text
              });
            }
          }
        });
        if (cues.length > 0) return cues;
      }
    } catch(e) {}

    try {
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(content, 'text/xml');
      var nodes = xmlDoc.getElementsByTagName('text');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var start = parseFloat(n.getAttribute('start') || '0');
        var dur = parseFloat(n.getAttribute('dur') || '2.5');
        var t = (n.textContent || '').replace(/\\u266a|♪/g, '').replace(/\\[.*?\\]/g, '').trim();
        if (t) {
          cues.push({ start: start, duration: dur, text: t });
        }
      }
      if (cues.length > 0) return cues;
    } catch(e) {}

    return cues;
  }

  // 7. BẮT TRỘM NETWORK REQUESTS CHO TIMEDTEXT
  var origFetch = window.fetch;
  window.fetch = async function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
    var resp = await origFetch.apply(this, arguments);
    try {
      if (url.indexOf('/api/timedtext') !== -1) {
        var clone = resp.clone();
        clone.text().then(function(txt) {
          var cues = parseTimedText(txt);
          if (shortLearnActive && cues && cues.length > 0) {
             window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'CAPTIONS_EXTRACTED',
               videoId: getCurrentVideoId(),
               cues: cues
             }));
          }
        }).catch(function() {});
      }
    } catch(e) {}
    return resp;
  };

  // 8. TỰ ĐỘNG BẬT TIẾNG (UNMUTE)
  function autoUnmuteVideo() {
    if (!shortLearnActive) return;
    try {
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        var v = videos[i];
        if (v.muted) v.muted = false;
        if (v.volume < 1.0) v.volume = 1.0;
      }

      var soundButtons = document.querySelectorAll(
        'button[aria-label*="unmute" i], button[aria-label*="bật âm" i]'
      );
      for (var j = 0; j < soundButtons.length; j++) {
        soundButtons[j].click();
      }
    } catch(e) {}
  }
  setInterval(autoUnmuteVideo, 1500);

  function getActiveVideo() {
    var videos = Array.from(document.querySelectorAll('video'));
    return videos.find(function(v) { return !v.paused && v.readyState >= 2; }) || document.querySelector('video');
  }

  // 9. CHỦ ĐỘNG KÉO PHỤ ĐỀ ĐẦY ĐỦ CHO VIDEO QUA PLAYER, WATCH PAGE & TIMEDTEXT LIST
  var captionDeliveredForId = '';

  async function fetchCaptionTrack(track, videoId) {
    try {
      if (!track || !track.baseUrl || !videoId) return false;
      var captionUrl = track.baseUrl;
      if (captionUrl.indexOf('/') === 0) captionUrl = location.origin + captionUrl;
      if (captionUrl.indexOf('fmt=') === -1) captionUrl += '&fmt=json3';

      // Use the original fetch so the timedtext interceptor does not emit the
      // same caption list a second time.
      var response = await origFetch.call(window, captionUrl);
      if (!response.ok) return false;
      var body = await response.text();
      var cues = parseTimedText(body);
      if (!cues || cues.length === 0) return false;

      captionDeliveredForId = videoId;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'CAPTIONS_EXTRACTED',
        videoId: videoId,
        cues: cues
      }));
      return true;
    } catch(e) {
      return false;
    }
  }

  async function fetchYouTubeCaptions(videoId) {
    if (!shortLearnActive || !videoId) return;
    if (captionDeliveredForId === videoId) return;

    // Cách 0: player hiện tại đã có signed caption URL. Đây là nguồn nhanh và
    // ổn định nhất trên Shorts mobile, không cần phân tích HTML.
    try {
      var activePlayer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
      var activeResponse = activePlayer && typeof activePlayer.getPlayerResponse === 'function'
        ? activePlayer.getPlayerResponse()
        : window.ytInitialPlayerResponse;
      var activeVideoId = activeResponse?.videoDetails?.videoId;
      var activeTracks = activeResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (activeVideoId === videoId && activeTracks && activeTracks.length > 0) {
        var activeTrack = activeTracks.find(function(t) {
          return t.languageCode === 'en' || (t.languageCode && t.languageCode.indexOf('en') === 0);
        }) || activeTracks[0];
        if (await fetchCaptionTrack(activeTrack, videoId)) return;
      }
    } catch(e) {}

    // Cách 1: Kéo trang Watch để lấy captionTracks có chữ ký xác thực chuẩn
    try {
      var watchUrl = 'https://www.youtube.com/watch?v=' + videoId;
      var resp = await fetch(watchUrl);
      if (resp.ok) {
        var html = await resp.text();
        var jsonMatch = html.match(/ytInitialPlayerResponse\\s*=\\s*({.+?})\\s*;\\s*(?:var\\s+meta|<\\/script|\\n)/)
                     || html.match(/ytInitialPlayerResponse\\s*=\\s*({.+?})\\s*;/);
        if (jsonMatch && jsonMatch[1]) {
          var pData = JSON.parse(jsonMatch[1]);
          var tracks = pData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks && tracks.length > 0) {
            var bestTrack = tracks.find(function(t) {
              return t.languageCode === 'en' || (t.languageCode && t.languageCode.indexOf('en') === 0);
            }) || tracks[0];

            if (bestTrack && bestTrack.baseUrl) {
              var cUrl = bestTrack.baseUrl;
              if (cUrl.indexOf('fmt=') === -1) cUrl += '&fmt=json3';
              var cResp = await fetch(cUrl);
              if (cResp.ok) {
                var cBody = await cResp.text();
                var cues = parseTimedText(cBody);
                if (cues && cues.length > 0) {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CAPTIONS_EXTRACTED',
                    videoId: videoId,
                    cues: cues
                  }));
                  return;
                }
              }
            }
          }
        }
      }
    } catch(e) {}

    // Cách 2: Kéo danh sách tracks từ API timedtext?type=list
    try {
      var listResp = await fetch('https://www.youtube.com/api/timedtext?type=list&v=' + videoId);
      if (listResp.ok) {
        var xmlTxt = await listResp.text();
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xmlTxt, 'text/xml');
        var trNodes = xmlDoc.getElementsByTagName('track');
        if (trNodes && trNodes.length > 0) {
          var chosen = trNodes[0];
          for (var t = 0; t < trNodes.length; t++) {
            var lCode = trNodes[t].getAttribute('lang_code') || '';
            if (lCode.indexOf('en') === 0) {
              chosen = trNodes[t];
              break;
            }
          }
          var langCode = chosen.getAttribute('lang_code') || 'en';
          var kind = chosen.getAttribute('kind') || '';
          var subUrl = 'https://www.youtube.com/api/timedtext?v=' + videoId + '&lang=' + langCode + '&fmt=json3';
          if (kind) subUrl += '&kind=' + kind;
          var subResp = await fetch(subUrl);
          if (subResp.ok) {
            var subData = await subResp.text();
            var parsed = parseTimedText(subData);
            if (parsed && parsed.length > 0) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CAPTIONS_EXTRACTED',
                videoId: videoId,
                cues: parsed
              }));
              return;
            }
          }
        }
      }
    } catch(e) {}

    // Cách 3: Innertube API nếu có context
    try {
      if (window.ytcfg && typeof window.ytcfg.get === 'function') {
        var apiKey = window.ytcfg.get('INNERTUBE_API_KEY');
        var context = window.ytcfg.get('INNERTUBE_CONTEXT');
        if (apiKey && context) {
          var pRes = await fetch('/youtubei/v1/player?key=' + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: videoId, context: context })
          });
          if (pRes.ok) {
            var pData = await pRes.json();
            var pTracks = pData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (pTracks && pTracks.length > 0) {
              var trUrl = pTracks[0].baseUrl;
              if (trUrl.indexOf('fmt=') === -1) trUrl += '&fmt=json3';
              var trResp = await fetch(trUrl);
              if (trResp.ok) {
                var trText = await trResp.text();
                var trCues = parseTimedText(trText);
                if (trCues && trCues.length > 0) {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CAPTIONS_EXTRACTED',
                    videoId: videoId,
                    cues: trCues
                  }));
                  return;
                }
              }
            }
          }
        }
      }
    } catch(e) {}
  }

  // 10. NHẬN DIỆN VIDEO ĐANG PHÁT
  var lastId = '';
  var lastTime = 0;

  function getCurrentVideoId() {
    var match = location.pathname.match(/\\/shorts\\/([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) return match[1];

    try {
      var player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
      if (player && typeof player.getVideoData === 'function') {
        var vData = player.getVideoData();
        if (vData && vData.video_id) return vData.video_id;
      }
    } catch(e) {}

    try {
      if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.videoDetails && window.ytInitialPlayerResponse.videoDetails.videoId) {
        return window.ytInitialPlayerResponse.videoDetails.videoId;
      }
    } catch(e) {}

    try {
      var links = document.querySelectorAll('a[href*="/shorts/"]');
      for (var i = 0; i < links.length; i++) {
        var rect = links[i].getBoundingClientRect();
        if (rect.top >= 0 && rect.top < (window.innerHeight || 800) && rect.height > 0) {
          var m = (links[i].getAttribute('href') || '').match(/\\/shorts\\/([a-zA-Z0-9_-]{11})/);
          if (m && m[1]) return m[1];
        }
      }
    } catch(e) {}

    return '';
  }

  function checkVideoChange() {
    if (!shortLearnActive) return;
    var currentId = getCurrentVideoId();
    if (currentId && currentId !== lastId) {
      lastId = currentId;
      lastTime = 0;
      lastSniffedText = '';
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'VIDEO_CHANGED',
        videoId: lastId
      }));
      fetchYouTubeCaptions(lastId);
      setTimeout(function() {
        if (lastId === currentId) fetchYouTubeCaptions(currentId);
      }, 1200);
      setTimeout(function() {
        if (lastId === currentId) fetchYouTubeCaptions(currentId);
      }, 3500);
      harvestShortsIds();
    }
  }

  var origPush = history.pushState;
  history.pushState = function() { origPush.apply(this, arguments); checkVideoChange(); };
  var origReplace = history.replaceState;
  history.replaceState = function() { origReplace.apply(this, arguments); checkVideoChange(); };
  window.addEventListener('popstate', checkVideoChange);
  setInterval(checkVideoChange, 1000);
  checkVideoChange();

  // 11. THEO DÕI THỜI GIAN VIDEO
  setInterval(function() {
    if (!shortLearnActive) return;
    var video = getActiveVideo();
    if (video && Math.abs(video.currentTime - lastTime) >= 0.2) {
      lastTime = video.currentTime;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'TIME_UPDATE',
        time: Number(video.currentTime.toFixed(2))
      }));
    }
  }, 250);

  // 12. HÀNG ĐỢI VÀ ĐIỀU HƯỚNG SHORTS
  var shortsQueue = [];
  var historyShorts = [];
  var fallbackShorts = [
    'kJQP7kiw5Fk', 'fJ9rUzIMcZQ', '9bZkp7q19f0', 'RgKAFK5djSk',
    'e-ORhEE9VVg', 'fLexgOxsZu0', '3JZ_D3ELwOQ', '2Vv-BfVoq4g'
  ];

  function harvestShortsIds() {
    if (!shortLearnActive) return;
    try {
      var links = document.querySelectorAll('a[href*="/shorts/"]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        var m = href.match(/\\/shorts\\/([a-zA-Z0-9_-]{11})/);
        if (m && m[1] && m[1] !== lastId && shortsQueue.indexOf(m[1]) === -1 && historyShorts.indexOf(m[1]) === -1) {
          shortsQueue.push(m[1]);
        }
      }
    } catch(e) {}
  }
  setInterval(harvestShortsIds, 3000);
  harvestShortsIds();

  function triggerNextShort() {
    harvestShortsIds();
    var nextBtn = document.querySelector('[aria-label*="next" i], [aria-label*="tiếp" i], #navigation-button-down button');
    if (nextBtn) {
      nextBtn.click();
      return;
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));

    if (shortsQueue.length > 0) {
      var nextId = shortsQueue.shift();
      if (lastId) historyShorts.push(lastId);
      lastId = nextId;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'VIDEO_CHANGED',
        videoId: nextId
      }));
      location.href = '/shorts/' + nextId;
      return;
    }

    if (fallbackShorts.length > 0) {
      var fallbackId = fallbackShorts.shift();
      fallbackShorts.push(fallbackId);
      if (fallbackId !== lastId) {
        if (lastId) historyShorts.push(lastId);
        lastId = fallbackId;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'VIDEO_CHANGED',
          videoId: fallbackId
        }));
        location.href = '/shorts/' + fallbackId;
        return;
      }
    }
    window.scrollBy({ top: window.innerHeight || 800, behavior: 'smooth' });
  }

  function triggerPrevShort() {
    if (historyShorts.length > 0) {
      var prevId = historyShorts.pop();
      if (lastId) shortsQueue.unshift(lastId);
      lastId = prevId;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'VIDEO_CHANGED',
        videoId: prevId
      }));
      location.href = '/shorts/' + prevId;
      return;
    }
    history.back();
  }

  // 13. BẮT CỬ CHỈ VUỐT TAY TẠI CAPTURE PHASE
  var touchStartY = 0;
  var touchStartX = 0;
  var touchStartTime = 0;

  function onTouchStart(e) {
    if (e.touches && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchStartTime = Date.now();
    }
  }

  function onTouchEnd(e) {
    if (e.changedTouches && e.changedTouches.length === 1) {
      var touchEndY = e.changedTouches[0].clientY;
      var touchEndX = e.changedTouches[0].clientX;
      var deltaY = touchStartY - touchEndY;
      var deltaX = Math.abs(touchStartX - touchEndX);
      var duration = Date.now() - touchStartTime;

      if (Math.abs(deltaY) > 35 && Math.abs(deltaY) > deltaX * 1.2 && duration < 700) {
        if (deltaY > 0) {
          triggerNextShort();
        } else {
          triggerPrevShort();
        }
      }
    }
  }

  window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  window.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });

  // 14. NHẬN LỆNH TỪ REACT NATIVE
  function handleNativeCommand(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      var video = getActiveVideo();

      if (data.action === 'SET_APP_ACTIVE') {
        shortLearnActive = data.active !== false;
        if (!shortLearnActive) {
          if (video) video.pause();
        } else {
          checkVideoChange();
          attachTrackListeners(document);
          enablePlayerCaptions();
          autoUnmuteVideo();
        }
        return;
      } else if (data.action === 'PAUSE_VIDEO' && video) {
        video.pause();
      } else if (data.action === 'RESUME_VIDEO' && video) {
        shortLearnActive = true;
        video.play();
      } else if (data.action === 'SEEK_TO' && video && typeof data.time === 'number') {
        shortLearnActive = true;
        video.currentTime = data.time;
        video.play();
      } else if (data.action === 'NEXT_SHORT') {
        shortLearnActive = true;
        triggerNextShort();
      } else if (data.action === 'PREV_SHORT') {
        shortLearnActive = true;
        triggerPrevShort();
      }
    } catch(e) {}
  }

  window.addEventListener('message', handleNativeCommand);
  document.addEventListener('message', handleNativeCommand);
})();
true;
`;
