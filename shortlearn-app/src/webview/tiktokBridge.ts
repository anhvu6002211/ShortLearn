// Runs only inside a TikTok WebView. It supports both the official player/v1
// page and canonical/share pages, then forwards the same message contract used
// by the existing YouTube bridge to React Native.
export const TIKTOK_INJECTED_SCRIPT = `
(function() {
  if (window.__SHORTLEARN_TIKTOK_V1__) return;
  if (!document.head && !document.body) return;
  window.__SHORTLEARN_TIKTOK_V1__ = true;

  var PLATFORM = 'tiktok';
  var lastVideoId = '';
  var lastCaptionText = '';
  var lastTrackSignature = '';
  var lastReportedTime = -1;
  var observedVideos = new WeakSet();
  var observedTracks = new WeakSet();
  var shortLearnActive = true;

  function send(type, payload) {
    if (!shortLearnActive) return;
    try {
      var message = payload || {};
      message.type = type;
      message.platform = PLATFORM;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    } catch (e) {}
  }

  function getVideoId() {
    var match = location.pathname.match(/\\\/(?:video|v|player\\\/v1)\\\/(\\d{5,32})(?:\\\/|$)/i);
    if (match && match[1]) return match[1];

    try {
      var canonical = document.querySelector('link[rel="canonical"]');
      var canonicalHref = canonical && canonical.getAttribute('href');
      var canonicalMatch = canonicalHref && canonicalHref.match(/\\\/(?:video|v|player\\\/v1)\\\/(\\d{5,32})(?:[/?#]|$)/i);
      if (canonicalMatch && canonicalMatch[1]) return canonicalMatch[1];
    } catch (e) {}

    try {
      var playerFrame = document.querySelector('iframe[src*="tiktok.com/player/v1/"]');
      var frameSrc = playerFrame && playerFrame.getAttribute('src');
      var frameMatch = frameSrc && frameSrc.match(/player\\\/v1\\\/(\\d{5,32})(?:[/?#]|$)/i);
      if (frameMatch && frameMatch[1]) return frameMatch[1];
    } catch (e) {}

    return '';
  }

  function reportVideoChange() {
    if (!shortLearnActive) return;
    var videoId = getVideoId();
    if (!videoId || videoId === lastVideoId) return;
    lastVideoId = videoId;
    lastCaptionText = '';
    lastTrackSignature = '';
    lastReportedTime = -1;
    send('VIDEO_CHANGED', { videoId: videoId });
  }

  function getActiveVideo() {
    var videos = document.querySelectorAll('video');
    var selected = null;
    var bestArea = -1;
    for (var i = 0; i < videos.length; i++) {
      var video = videos[i];
      var rect = video.getBoundingClientRect();
      var visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      var visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      var area = visibleWidth * visibleHeight;
      if (!video.paused) area += 1000000000;
      if (area > bestArea) {
        selected = video;
        bestArea = area;
      }
    }
    return selected;
  }

  function cleanCaption(raw) {
    return String(raw || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\\[.*?\\]/g, '')
      .replace(/\\(.*?\\)/g, '')
      .replace(/\\u266a|♪/g, '')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  function currentTime() {
    var video = getActiveVideo();
    return video && Number.isFinite(video.currentTime) ? video.currentTime : Math.max(0, lastReportedTime);
  }

  function forwardCaption(raw) {
    if (!shortLearnActive) return;
    var text = cleanCaption(raw);
    if (!text || text.length < 2 || text === lastCaptionText) return;
    lastCaptionText = text;
    send('LIVE_CAPTION_SNIFFED', {
      videoId: lastVideoId || getVideoId(),
      text: text,
      time: Number(currentTime().toFixed(2))
    });
  }

  function reportTrackCues(track) {
    try {
      if (!track || !track.cues || track.cues.length === 0) return;
      var cues = [];
      for (var i = 0; i < track.cues.length; i++) {
        var cue = track.cues[i];
        var text = cleanCaption(cue.text);
        if (!text) continue;
        cues.push({ start: Number(cue.startTime), end: Number(cue.endTime), text: text });
      }
      if (cues.length === 0) return;
      var signature = String(cues.length) + ':' + cues[0].text + ':' + cues[cues.length - 1].text;
      if (signature === lastTrackSignature) return;
      lastTrackSignature = signature;
      send('CAPTIONS_EXTRACTED', {
        videoId: lastVideoId || getVideoId(),
        cues: cues
      });
    } catch (e) {}
  }

  function forwardActiveCues(track) {
    try {
      if (!track || !track.activeCues || track.activeCues.length === 0) return;
      var texts = [];
      for (var i = 0; i < track.activeCues.length; i++) {
        var text = cleanCaption(track.activeCues[i].text);
        if (text) texts.push(text);
      }
      if (texts.length > 0) forwardCaption(texts.join(' '));
    } catch (e) {}
  }

  function bindVideo(video) {
    if (!video) return;
    try {
      if (!observedVideos.has(video)) {
        observedVideos.add(video);
        video.addEventListener('timeupdate', function() {
          if (!shortLearnActive) return;
          var time = Number(video.currentTime);
          if (Number.isFinite(time) && Math.abs(time - lastReportedTime) >= 0.2) {
            lastReportedTime = time;
            send('TIME_UPDATE', { time: Number(time.toFixed(2)) });
          }
        });
        video.addEventListener('loadedmetadata', function() { bindVideo(video); });
        video.addEventListener('durationchange', function() { bindVideo(video); });
      }

      if (!video.textTracks) return;
      for (var i = 0; i < video.textTracks.length; i++) {
        var track = video.textTracks[i];
        try {
          if (track.mode === 'disabled') track.mode = 'hidden';
        } catch (e) {}
        if (!observedTracks.has(track)) {
          observedTracks.add(track);
          track.addEventListener('cuechange', function(event) {
            forwardActiveCues(event.target);
            reportTrackCues(event.target);
          });
        }
        forwardActiveCues(track);
        reportTrackCues(track);
      }
    } catch (e) {}
  }

  function bindAllVideos() {
    if (!shortLearnActive) return;
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) bindVideo(videos[i]);
  }

  function applyStyles() {
    var target = document.head || document.documentElement || document.body;
    if (!target || document.getElementById('shortlearn-tiktok-style')) return;
    var style = document.createElement('style');
    style.id = 'shortlearn-tiktok-style';
    style.textContent = [
      '::cue, video::cue { color: transparent !important; background: transparent !important; text-shadow: none !important; }',
      '[data-e2e="video-subtitle"], [data-e2e="subtitle"],',
      '[class*="DivSubtitle"], [class*="SubtitleText"], [class*="subtitle-text"], [class*="CaptionText"] {',
      '  opacity: 0 !important; pointer-events: none !important;',
      '}'
    ].join('\\n');
    target.appendChild(style);
  }

  var captionSelector = [
    '[data-e2e="video-subtitle"]',
    '[data-e2e="subtitle"]',
    '[class*="DivSubtitle"]',
    '[class*="SubtitleText"]',
    '[class*="subtitle-text"]',
    '[class*="CaptionText"]'
  ].join(',');

  function scanCaptions(root) {
    if (!shortLearnActive) return;
    try {
      if (!root || root.nodeType !== 1) return;
      if (root.matches && root.matches(captionSelector)) forwardCaption(root.textContent || root.innerText);
      var nodes = root.querySelectorAll ? root.querySelectorAll(captionSelector) : [];
      for (var i = 0; i < nodes.length; i++) {
        forwardCaption(nodes[i].textContent || nodes[i].innerText);
      }
    } catch (e) {}
  }

  function playerFrame() {
    return document.querySelector('iframe[src*="tiktok.com/player/v1/"]');
  }

  function sendPlayerCommand(type, value) {
    try {
      var frame = playerFrame();
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({
          type: type,
          value: value,
          'x-tiktok-player': true
        }, 'https://www.tiktok.com');
      }
    } catch (e) {}
  }

  function nextVideo() {
    var button = document.querySelector(
      '[data-e2e="arrow-right"], [data-e2e="arrow-down"], button[aria-label*="next" i], button[aria-label*="tiếp" i]'
    );
    if (button) button.click();
    else window.scrollBy({ top: window.innerHeight || 800, behavior: 'smooth' });
  }

  function previousVideo() {
    var button = document.querySelector(
      '[data-e2e="arrow-left"], [data-e2e="arrow-up"], button[aria-label*="previous" i], button[aria-label*="trước" i]'
    );
    if (button) button.click();
    else if (history.length > 1) history.back();
    else window.scrollBy({ top: -(window.innerHeight || 800), behavior: 'smooth' });
  }

  function handleMessage(event) {
    try {
      var data = event.data;
      if (data && typeof data === 'object' && data['x-tiktok-player']) {
        var frame = playerFrame();
        if (event.origin !== 'https://www.tiktok.com') return;
        if (frame && event.source !== frame.contentWindow) return;
        if (data.type === 'onCurrentTime') {
          var value = data.value;
          var time = typeof value === 'number' ? value : Number(value && value.currentTime);
          if (shortLearnActive && Number.isFinite(time) && Math.abs(time - lastReportedTime) >= 0.2) {
            lastReportedTime = time;
            send('TIME_UPDATE', { time: Number(time.toFixed(2)) });
          }
        } else if (data.type === 'onPlayerReady') {
          reportVideoChange();
          bindAllVideos();
        } else if (data.type === 'onPlayerError' || data.type === 'onError') {
          send('PLAYER_ERROR', { error: data.value || null });
        }
        return;
      }

      if (typeof data === 'string') data = JSON.parse(data);
      if (!data || !data.action) return;
      var video = getActiveVideo();
      if (data.action === 'SET_APP_ACTIVE') {
        shortLearnActive = data.active !== false;
        if (!shortLearnActive) {
          if (video) video.pause();
          sendPlayerCommand('pause');
        } else {
          reportVideoChange();
          bindAllVideos();
          scanCaptions(document.documentElement);
        }
        return;
      } else if (data.action === 'PAUSE_VIDEO') {
        if (video) video.pause();
        sendPlayerCommand('pause');
      } else if (data.action === 'RESUME_VIDEO') {
        shortLearnActive = true;
        if (video) video.play().catch(function() {});
        sendPlayerCommand('play');
      } else if (data.action === 'SEEK_TO' && typeof data.time === 'number') {
        shortLearnActive = true;
        if (video) {
          video.currentTime = data.time;
          video.play().catch(function() {});
        }
        sendPlayerCommand('seekTo', data.time);
        sendPlayerCommand('play');
      } else if (data.action === 'NEXT_SHORT') {
        shortLearnActive = true;
        nextVideo();
      } else if (data.action === 'PREV_SHORT') {
        shortLearnActive = true;
        previousVideo();
      }
    } catch (e) {}
  }

  applyStyles();
  reportVideoChange();
  bindAllVideos();
  scanCaptions(document.documentElement);

  try {
    var observer = new MutationObserver(function(records) {
      if (!shortLearnActive) return;
      reportVideoChange();
      for (var i = 0; i < records.length; i++) {
        for (var j = 0; j < records[i].addedNodes.length; j++) {
          scanCaptions(records[i].addedNodes[j]);
        }
      }
      bindAllVideos();
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  } catch (e) {}

  var originalPushState = history.pushState;
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    setTimeout(reportVideoChange, 0);
  };
  var originalReplaceState = history.replaceState;
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    setTimeout(reportVideoChange, 0);
  };
  window.addEventListener('popstate', reportVideoChange);
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);

  setInterval(function() {
    if (!shortLearnActive) return;
    reportVideoChange();
    bindAllVideos();
    var video = getActiveVideo();
    if (video && Number.isFinite(video.currentTime) && Math.abs(video.currentTime - lastReportedTime) >= 0.2) {
      lastReportedTime = video.currentTime;
      send('TIME_UPDATE', { time: Number(video.currentTime.toFixed(2)) });
    }
  }, 1000);
})();
true;
`;
