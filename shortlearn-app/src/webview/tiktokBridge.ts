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
  var FEED_IDS_KEY = 'shortlearn:tiktok-feed-ids';
  var FEED_URLS_KEY = 'shortlearn:tiktok-feed-urls';
  var feedIds = [];
  var feedUrls = {};

  try {
    var savedFeedIds = JSON.parse(sessionStorage.getItem(FEED_IDS_KEY) || '[]');
    var savedFeedUrls = JSON.parse(sessionStorage.getItem(FEED_URLS_KEY) || '{}');
    if (Array.isArray(savedFeedIds)) feedIds = savedFeedIds.filter(function(id) { return /^\\d{5,32}$/.test(String(id)); });
    if (savedFeedUrls && typeof savedFeedUrls === 'object') feedUrls = savedFeedUrls;
  } catch (e) {}

  function rememberFeedItems(payload) {
    try {
      var items = payload && (payload.itemList || payload.item_list || payload.items || payload.aweme_list);
      if (!Array.isArray(items)) return;
      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var id = String(item.id || item.aweme_id || '');
        if (!/^\\d{5,32}$/.test(id)) continue;
        if (feedIds.indexOf(id) === -1) feedIds.push(id);
        var author = item.author || {};
        var username = String(author.uniqueId || author.unique_id || item.author_unique_id || '');
        if (username) feedUrls[id] = 'https://www.tiktok.com/@' + encodeURIComponent(username) + '/video/' + id;
      }
      sessionStorage.setItem(FEED_IDS_KEY, JSON.stringify(feedIds));
      sessionStorage.setItem(FEED_URLS_KEY, JSON.stringify(feedUrls));
    } catch (e) {}
  }

  try {
    var originalFetch = window.fetch;
    window.fetch = function() {
      return originalFetch.apply(this, arguments).then(function(response) {
        try {
          var url = String(response.url || '');
          if (url.indexOf('/api/recommend/item_list/') !== -1 || url.indexOf('/api/preload/item_list/') !== -1) {
            response.clone().json().then(rememberFeedItems).catch(function() {});
          }
        } catch (e) {}
        return response;
      });
    };

    var originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__shortLearnFeedRequest = String(url || '').indexOf('/api/recommend/item_list/') !== -1 ||
        String(url || '').indexOf('/api/preload/item_list/') !== -1;
      if (this.__shortLearnFeedRequest) {
        this.addEventListener('load', function() {
          try { rememberFeedItems(JSON.parse(this.responseText)); } catch (e) {}
        });
      }
      return originalXhrOpen.apply(this, arguments);
    };
  } catch (e) {}

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

  function videoIdFrom(value) {
    var match = String(value || '').match(/\\\/(?:video|v|player\\\/v1)\\\/(\\d{5,32})(?:[/?#]|$)/i);
    return match && match[1] ? match[1] : '';
  }

  function getVideoId() {
    var directId = videoIdFrom(location.href);
    if (directId) return directId;

    try {
      var canonical = document.querySelector('link[rel="canonical"]');
      var canonicalId = videoIdFrom(canonical && canonical.getAttribute('href'));
      if (canonicalId) return canonicalId;
    } catch (e) {}

    try {
      var playerFrame = document.querySelector('iframe[src*="tiktok.com/player/v1/"]');
      var frameId = videoIdFrom(playerFrame && playerFrame.getAttribute('src'));
      if (frameId) return frameId;
    } catch (e) {}

    // TikTok For You keeps /foryou in the address bar. Find the ID on the
    // card containing the currently playing/most-visible video instead.
    try {
      var node = getActiveVideo();
      for (var depth = 0; node && depth < 9; depth++, node = node.parentElement) {
        if (node.getAttribute) {
          var attributes = ['data-video-id', 'data-item-id', 'data-id'];
          for (var a = 0; a < attributes.length; a++) {
            var attributeId = String(node.getAttribute(attributes[a]) || '').match(/^\\d{5,32}$/);
            if (attributeId) return attributeId[0];
          }
        }
        var ownLink = node.matches && node.matches('a[href*="/video/"]') ? node : null;
        var nearbyLink = ownLink || (node.querySelector && node.querySelector('a[href*="/video/"]'));
        var nearbyId = videoIdFrom(nearbyLink && nearbyLink.getAttribute('href'));
        if (nearbyId) return nearbyId;
      }

      var links = document.querySelectorAll('a[href*="/video/"]');
      var bestId = '';
      var bestArea = 0;
      for (var i = 0; i < links.length; i++) {
        var rect = links[i].getBoundingClientRect();
        var visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
        var visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        var area = visibleWidth * visibleHeight;
        var linkId = videoIdFrom(links[i].getAttribute('href'));
        if (linkId && area > bestArea) {
          bestId = linkId;
          bestArea = area;
        }
      }
      if (bestId) return bestId;

      var resources = performance.getEntriesByType('resource');
      for (var r = resources.length - 1; r >= 0; r--) {
        var resourceUrl = String(resources[r].name || '');
        if (resourceUrl.indexOf('/api/item/availability/') === -1) continue;
        var itemIdsMatch = resourceUrl.match(/[?&]itemIds=([^&]+)/);
        if (!itemIdsMatch) continue;
        var itemIds = decodeURIComponent(itemIdsMatch[1]).match(/\\d{5,32}/g);
        if (itemIds && itemIds[0]) return itemIds[0];
      }
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

  function dismissAppPrompt() {
    try {
      var candidates = document.querySelectorAll('button, [role="button"]');
      for (var i = 0; i < candidates.length; i++) {
        var text = String(candidates[i].innerText || candidates[i].textContent || '').trim().toLowerCase();
        var label = String(candidates[i].getAttribute('aria-label') || '').trim().toLowerCase();
        if (text === 'not now' || text === 'không phải bây giờ' || label === 'close' || label === 'đóng') {
          candidates[i].click();
          return;
        }
      }
    } catch (e) {}
  }

  function scanCaptions(root) {
    if (!shortLearnActive) return;
    dismissAppPrompt();
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

  function storedFeedVideoIds() {
    return feedIds.slice();
  }

  function feedVideoIds() {
    var ids = storedFeedVideoIds();
    var currentId = lastVideoId || getVideoId();
    if (currentId && ids.indexOf(currentId) === -1) ids.push(currentId);

    try {
      var resources = performance.getEntriesByType('resource');
      for (var r = resources.length - 1; r >= 0; r--) {
        var resourceUrl = String(resources[r].name || '');
        if (resourceUrl.indexOf('/api/item/availability/') === -1) continue;
        var match = resourceUrl.match(/[?&]itemIds=([^&]+)/);
        if (!match) continue;
        var discovered = decodeURIComponent(match[1]).match(/\\d{5,32}/g) || [];
        for (var i = 0; i < discovered.length; i++) {
          if (ids.indexOf(discovered[i]) === -1) ids.push(discovered[i]);
        }
      }

      var links = document.querySelectorAll('a[href*="/video/"]');
      for (var l = 0; l < links.length; l++) {
        var linkId = videoIdFrom(links[l].getAttribute('href'));
        if (linkId && ids.indexOf(linkId) === -1) ids.push(linkId);
      }
      feedIds = ids;
      sessionStorage.setItem(FEED_IDS_KEY, JSON.stringify(feedIds));
    } catch (e) {}
    return ids;
  }

  function openFeedVideo(offset) {
    var ids = feedVideoIds();
    if (!ids.length) return false;
    var currentId = lastVideoId || getVideoId();
    var currentIndex = ids.indexOf(currentId);
    var targetIndex = currentIndex >= 0 ? currentIndex + offset : (offset > 0 ? 1 : 0);
    if (targetIndex < 0 || targetIndex >= ids.length) return false;
    var targetId = ids[targetIndex];
    var targetUrl = feedUrls[targetId];
    if (!targetUrl) {
      var matchingLink = document.querySelector('a[href*="/video/' + targetId + '"]');
      targetUrl = matchingLink && matchingLink.href;
    }
    if (!targetUrl) return false;
    location.href = targetUrl;
    return true;
  }

  function nextVideo() {
    if (openFeedVideo(1)) return;
    var button = document.querySelector(
      '[data-e2e="arrow-right"], [data-e2e="arrow-down"], button[aria-label*="next" i], button[aria-label*="tiếp" i]'
    );
    if (button) button.click();
    else window.scrollBy({ top: window.innerHeight || 800, behavior: 'smooth' });
  }

  function previousVideo() {
    if (openFeedVideo(-1)) return;
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
