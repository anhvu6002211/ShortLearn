import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { FlashListRef } from '@shopify/flash-list';
import { WebView } from 'react-native-webview';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { SubtitleCue } from './src/components/LanguageReactorOverlay';
import { DueCard } from './src/components/FlashcardReview';
import {
  LearningInsight,
  SavedItem,
  SavedItemsBulkLearningUpdate,
} from './src/components/SavedItemsView';
import { Rating } from './src/utils/srsAlgorithm';
import { apiRequest, getApiError } from './src/services/api';
import { findSubtitleCue } from './src/utils/binarySearchSubtitles';
import {
  DEFAULT_LEARNING_DISPLAY_PREFERENCES,
  LearningDisplayPreferences,
  loadLearningDisplayPreferences,
  saveLearningDisplayPreferences,
} from './src/services/learningPreferences';
import { CardLabelColor, LearningStage, WordLearningState } from './src/types/learning';
import {
  clearYouTubeSession,
  fetchYouTubeAccount,
  loadYouTubeSession,
  saveYouTubeSession,
  YouTubeSession,
} from './src/services/youtubeAuth';
import {
  createYouTubeTarget,
  parseVideoTarget,
  TIKTOK_HOME_URL,
  VideoPlatform,
  VideoTarget,
  YOUTUBE_SHORTS_HOME_URL,
} from './src/services/videoPlatform';
import { TIKTOK_INJECTED_SCRIPT } from './src/webview/tiktokBridge';
import { MainTab, AuthStackParamList } from './src/navigation/types';
import { AuthStack } from './src/navigation/AuthStack';
import { MainTabs } from './src/navigation/MainTabs';
import { AppRuntimeProvider } from './src/providers/AppRuntimeProvider';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';
import { useWebViewActivity } from './src/hooks/useWebViewActivity';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { ShortsScreen } from './src/screens/ShortsScreen';

const GOOGLE_YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
// Android client (package + SHA-1) is verified by Google Play services. The
// native SDK uses the Web client ID as the OAuth audience at runtime.
const isGoogleOAuthConfigured = Boolean(GOOGLE_ANDROID_CLIENT_ID && GOOGLE_WEB_CLIENT_ID);
const navigationRef = createNavigationContainerRef<AuthStackParamList>();

const TRANSLATION_CACHE_LIMIT = 150;
const TRANSLATION_TIMEOUT_MS = 8_000;
const TRANSLATION_CONCURRENCY = 3;
const TRANSLATION_UNAVAILABLE_TEXT = 'Chưa thể dịch sang tiếng Việt. Hãy kiểm tra kết nối mạng.';
const translationCache = new Map<string, string>();
const translationRequests = new Map<string, Promise<string>>();

const normalizeTranslationComparison = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const isUsableTranslation = (sourceText: string, translatedText: unknown): translatedText is string => {
  if (typeof translatedText !== 'string') return false;
  const translated = translatedText.trim();
  if (!translated || translated === '(Chưa có bản dịch AI)') return false;
  return normalizeTranslationComparison(sourceText) !== normalizeTranslationComparison(translated);
};

const extractGoogleTranslation = (payload: unknown): string | null => {
  // Một số phản hồi clients5 trả thẳng chuỗi JSON thay vì bọc trong mảng.
  if (typeof payload === 'string') return payload.trim() || null;
  if (!Array.isArray(payload) || payload.length === 0) return null;

  // clients5.google.com returns ["Bản dịch"].
  if (typeof payload[0] === 'string') return payload[0].trim() || null;

  // translate.googleapis.com returns [[['Bản dịch', 'Source', ...], ...], ...].
  if (Array.isArray(payload[0])) {
    const translated = payload[0]
      .map((segment: unknown) => (
        Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''
      ))
      .join('')
      .trim();
    return translated || null;
  }

  return null;
};

const requestTranslation = async (url: string): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return extractGoogleTranslation(await response.json());
  } finally {
    clearTimeout(timeout);
  }
};

// Dịch dự phòng trên thiết bị. Hai endpoint được thử tuần tự và các yêu cầu
// trùng lặp dùng chung một Promise để tránh bị Google giới hạn tốc độ.
const translateDirect = async (text: string): Promise<string> => {
  const normalizedText = text.trim();
  if (!normalizedText) return '';
  const cached = translationCache.get(normalizedText);
  if (cached) return cached;
  const existingRequest = translationRequests.get(normalizedText);
  if (existingRequest) return existingRequest;

  const encodedText = encodeURIComponent(normalizedText);
  const request = (async () => {
    const urls = [
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodedText}`,
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=${encodedText}`,
    ];

    for (const url of urls) {
      try {
        const translated = await requestTranslation(url);
        if (!isUsableTranslation(normalizedText, translated)) continue;

        if (translationCache.size >= TRANSLATION_CACHE_LIMIT) {
          const oldestKey = translationCache.keys().next().value;
          if (oldestKey) translationCache.delete(oldestKey);
        }
        translationCache.set(normalizedText, translated);
        return translated;
      } catch {
        // Thử endpoint kế tiếp khi timeout hoặc thiết bị tạm mất mạng.
      }
    }

    throw new Error(TRANSLATION_UNAVAILABLE_TEXT);
  })();

  translationRequests.set(normalizedText, request);
  try {
    return await request;
  } finally {
    if (translationRequests.get(normalizedText) === request) {
      translationRequests.delete(normalizedText);
    }
  }
};

const runWithConcurrency = async <T,>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index], index);
      }
    }
  );
  await Promise.all(runners);
};

// Đoạn Script tiêm vào YouTube Shorts: 
// 1. TRIỆT TIÊU HOÀN TOÀN PHỤ ĐỀ NATIVE Ở TRÊN (Cả HTML5 video::cue & DOM elements)
// 2. Chuyển hướng toàn bộ lời thoại vào khoang Language Reactor ở dưới
// 3. Giữ cử chỉ vuốt mượt mà không bị YouTube nuốt
const INJECTED_SCRIPT = `
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

function ShortLearnApp() {
  const { authenticatedRequest, isAuthenticated } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const transcriptListRef = useRef<FlashListRef<SubtitleCue>>(null);
  const transcriptAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTranscriptVisibleRef = useRef(false);
  const transcriptFollowPausedUntilRef = useRef(0);
  const pendingReplayRef = useRef<{
    videoId: string;
    time: number;
    platform: VideoPlatform;
  } | null>(null);
  const subtitleRequestIdRef = useRef<number>(0);
  const subtitleGenerationRef = useRef<number>(0);
  const subtitleWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentVideoIdRef = useRef<string>('');
  const currentPlatformRef = useRef<VideoPlatform>('youtube');
  const subtitlesRef = useRef<SubtitleCue[]>([]);
  const activeCueRef = useRef<SubtitleCue | null>(null);
  const subtitleSourceRef = useRef<'none' | 'client' | 'server' | 'live'>('none');
  const lastPlaybackTimeRef = useRef<number>(0);
  const savedItemsAbortRef = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState<MainTab>('shorts');
  const [accountPlatform, setAccountPlatform] = useState<VideoPlatform>('youtube');
  const [isBottomNavVisible, setIsBottomNavVisible] = useState<boolean>(true);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [currentPlatform, setCurrentPlatform] = useState<VideoPlatform>('youtube');
  const [webViewUri, setWebViewUri] = useState<string>(YOUTUBE_SHORTS_HOME_URL);
  const [isPlatformPickerVisible, setIsPlatformPickerVisible] = useState<boolean>(false);
  const [isShortPickerVisible, setIsShortPickerVisible] = useState<boolean>(false);
  const [shortPickerPlatform, setShortPickerPlatform] = useState<VideoPlatform>('youtube');
  const [shortUrlInput, setShortUrlInput] = useState<string>('');
  const [shortUrlError, setShortUrlError] = useState<string | null>(null);

  const navigateToMainTab = useCallback((tab: MainTab) => {
    setActiveTab(tab);
    if (!navigationRef.isReady()) return;
    if (tab === 'review') navigationRef.navigate('Main', { screen: 'Review' });
    else if (tab === 'account') navigationRef.navigate('Main', { screen: 'Account' });
    else navigationRef.navigate('Main', { screen: 'Shorts' });
  }, []);

  // Mặc định nạp sẵn phụ đề để khoang Language Reactor luôn hiển thị ngay từ frame đầu tiên
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [shortsViewportHeight, setShortsViewportHeight] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasNoCaptions, setHasNoCaptions] = useState<boolean>(false);
  const [autoPauseEnabled, setAutoPauseEnabled] = useState<boolean>(false);

  // Trạng thái Popup Từ vựng Language Reactor
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [contextSentence, setContextSentence] = useState<string>('');
  const [wordMeaning, setWordMeaning] = useState<string>('');
  const [isTranslatingWord, setIsTranslatingWord] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isSavingWord, setIsSavingWord] = useState<boolean>(false);

  // Trạng thái Saved Items và bộ ôn FSRS được dẫn xuất từ cùng một nguồn dữ liệu.
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedItemSummary, setSavedItemSummary] = useState({ totalItems: 0, totalDue: 0 });
  const [learningInsight, setLearningInsight] = useState<LearningInsight | null>(null);
  const [isLoadingSavedItems, setIsLoadingSavedItems] = useState<boolean>(false);
  const [savedItemsError, setSavedItemsError] = useState<string | null>(null);
  const [learningDisplayPreferences, setLearningDisplayPreferences] = useState<LearningDisplayPreferences>(
    DEFAULT_LEARNING_DISPLAY_PREFERENCES,
  );

  // Liên kết YouTube dùng Google Sign-In native; tuyệt đối không đăng nhập Google bên trong WebView.
  const [youTubeSession, setYouTubeSession] = useState<YouTubeSession | null>(null);
  const [isLoadingYouTubeSession, setIsLoadingYouTubeSession] = useState<boolean>(true);
  const [isSigningInYouTube, setIsSigningInYouTube] = useState<boolean>(false);
  const [isDisconnectingYouTube, setIsDisconnectingYouTube] = useState<boolean>(false);
  const [youTubeNotice, setYouTubeNotice] = useState<string | null>(null);
  const isExpoGo = Constants.appOwnership === 'expo';
  const savedDueCount = savedItemSummary.totalDue;
  const activeInjectedScript = currentPlatform === 'tiktok'
    ? TIKTOK_INJECTED_SCRIPT
    : INJECTED_SCRIPT;
  const wordLearningStates = useMemo<Record<string, WordLearningState>>(() => {
    const result: Record<string, WordLearningState> = {};
    savedItems.forEach((item) => {
      const normalizedWord = item.word.trim().toLocaleLowerCase();
      if (!normalizedWord) return;
      const appearance = item as SavedItem & {
        learning_stage?: LearningStage | null;
        card_label?: CardLabelColor | null;
      };
      result[normalizedWord] = {
        learningStage: appearance.learning_stage || 'learning',
        cardLabel: appearance.card_label || null,
      };
    });
    return result;
  }, [savedItems]);

  const transcriptIndexByStartTime = useMemo(() => {
    const index = new Map<number, number>();
    subtitles.forEach((cue, cueIndex) => index.set(cue.start_time, cueIndex));
    return index;
  }, [subtitles]);

  const activeTranscriptIndex = activeCue
    ? transcriptIndexByStartTime.get(activeCue.start_time) ?? -1
    : -1;

  const handleTranscriptScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The transcript starts immediately after the full-height Shorts header.
    // Requiring a deliberate scroll keeps it hidden on first load as designed.
    isTranscriptVisibleRef.current = event.nativeEvent.contentOffset.y >= 72;
  }, []);

  const pauseTranscriptFollowing = useCallback(() => {
    // Give the learner time to read another cue without the active cue pulling
    // the list away. Following resumes on a later cue after this quiet period.
    transcriptFollowPausedUntilRef.current = Date.now() + 4_000;
  }, []);

  useEffect(() => {
    if (
      activeTranscriptIndex < 0 ||
      !isTranscriptVisibleRef.current ||
      Date.now() < transcriptFollowPausedUntilRef.current
    ) {
      return;
    }

    if (transcriptAutoScrollTimerRef.current) {
      clearTimeout(transcriptAutoScrollTimerRef.current);
    }

    transcriptAutoScrollTimerRef.current = setTimeout(() => {
      if (
        !isTranscriptVisibleRef.current ||
        Date.now() < transcriptFollowPausedUntilRef.current
      ) {
        return;
      }

      transcriptListRef.current?.scrollToIndex({
        index: activeTranscriptIndex,
        animated: true,
        viewPosition: 0.32,
      });
    }, 90);

    return () => {
      if (transcriptAutoScrollTimerRef.current) {
        clearTimeout(transcriptAutoScrollTimerRef.current);
        transcriptAutoScrollTimerRef.current = null;
      }
    };
  }, [activeTranscriptIndex]);

  const clearSubtitleWaitTimer = useCallback(() => {
    if (subtitleWaitTimerRef.current) {
      clearTimeout(subtitleWaitTimerRef.current);
      subtitleWaitTimerRef.current = null;
    }
  }, []);

  const armSubtitleWaitTimer = useCallback((
    videoId: string,
    platform: VideoPlatform = currentPlatformRef.current,
  ) => {
    clearSubtitleWaitTimer();
    subtitleWaitTimerRef.current = setTimeout(() => {
      if (
        currentVideoIdRef.current === videoId &&
        currentPlatformRef.current === platform &&
        subtitlesRef.current.length === 0 &&
        subtitleSourceRef.current === 'none'
      ) {
        activeCueRef.current = null;
        setActiveCue(null);
        setHasNoCaptions(true);
        setLoading(false);
      }
    }, 7_000);
  }, [clearSubtitleWaitTimer]);

  useEffect(() => () => clearSubtitleWaitTimer(), [clearSubtitleWaitTimer]);

  useEffect(() => {
    let isMounted = true;
    loadYouTubeSession()
      .then((session) => {
        if (isMounted) setYouTubeSession(session);
      })
      .finally(() => {
        if (isMounted) setIsLoadingYouTubeSession(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadLearningDisplayPreferences().then((preferences) => {
      if (isMounted) setLearningDisplayPreferences(preferences);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateLearningDisplayPreferences = useCallback((
    patch: Partial<LearningDisplayPreferences>,
  ) => {
    setLearningDisplayPreferences((current) => {
      const next = { ...current, ...patch };
      void saveLearningDisplayPreferences(next).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    if (isExpoGo || !isGoogleOAuthConfigured) return;

    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: [GOOGLE_YOUTUBE_SCOPE],
      offlineAccess: false,
    });
  }, [isExpoGo]);

  const handleYouTubeSignIn = async () => {
    if (!isGoogleOAuthConfigured) {
      Alert.alert(
        'Thiếu cấu hình Google OAuth',
        'Cần Android OAuth Client ID và Web OAuth Client ID trong file .env, rồi khởi động lại Metro. Không dùng Client Secret trong ứng dụng.'
      );
      return;
    }
    if (isExpoGo) {
      Alert.alert(
        'Cần development build',
        'Expo Go không nhận callback OAuth của Google. Hãy chạy ShortLearn bằng development build để đăng nhập YouTube.'
      );
      return;
    }

    setIsSigningInYouTube(true);
    setYouTubeNotice(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (isCancelledResponse(result)) {
        setYouTubeNotice('Đăng nhập đã được hủy.');
        return;
      }

      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) throw new Error('Google không cấp access token.');

      const account = await fetchYouTubeAccount(accessToken);
      const session: YouTubeSession = {
        accessToken,
        // Google access token is normally valid for one hour. The app asks for
        // a new sign-in after it expires instead of storing a refresh token.
        expiresAt: Date.now() + 60 * 60 * 1000,
        account,
      };
      await saveYouTubeSession(session);
      setYouTubeSession(session);
      setYouTubeNotice('Đã liên kết tài khoản YouTube.');
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        setYouTubeNotice('Đăng nhập đã được hủy.');
      } else if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setYouTubeNotice('Thiết bị chưa có hoặc cần cập nhật Google Play services.');
      } else {
        setYouTubeNotice('Không thể đăng nhập. Kiểm tra Web OAuth Client ID, SHA-1 Android và tài khoản Test user trong Google Cloud.');
      }
    } finally {
      setIsSigningInYouTube(false);
    }
  };

  const handleYouTubeDisconnect = async () => {
    setIsDisconnectingYouTube(true);
    setYouTubeSession(null);
    await clearYouTubeSession();

    try {
      if (!isExpoGo) {
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
      }
    } catch {
      // Token có thể đã hết hạn; dữ liệu cục bộ vẫn phải được xóa.
    } finally {
      setIsDisconnectingYouTube(false);
      setYouTubeNotice('Đã ngắt liên kết tài khoản YouTube trên thiết bị này.');
    }
  };

  const fetchSavedItems = useCallback(async () => {
    savedItemsAbortRef.current?.abort();
    if (!isAuthenticated) {
      setSavedItems([]);
      setSavedItemSummary({ totalItems: 0, totalDue: 0 });
      setLearningInsight(null);
      setIsLoadingSavedItems(false);
      setSavedItemsError('Đăng nhập ShortLearn để xem và đồng bộ các mục đã lưu.');
      return;
    }

    const controller = new AbortController();
    savedItemsAbortRef.current = controller;

    try {
      setIsLoadingSavedItems(true);
      setSavedItemsError(null);
      // Insight is optional: failure must never stop access to the saved deck.
      const insightRequest = authenticatedRequest('/learning/insights', {
        signal: controller.signal,
      })
        .then(async (response) => response.ok ? response.json() : null)
        .catch(() => null);
      const response = await authenticatedRequest('/vocabulary/saved?limit=100', {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(await getApiError(response));
      }
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const totalItems = Number(data.total_items);
      const totalDue = Number(data.total_due);
      setSavedItems(items);
      setSavedItemSummary({
        totalItems: Number.isFinite(totalItems) ? totalItems : items.length,
        totalDue: Number.isFinite(totalDue)
          ? totalDue
          : items.reduce((count: number, item: SavedItem) => count + (Number(item.is_due) ? 1 : 0), 0),
      });
      const insight = await insightRequest;
      if (insight?.engine === 'adaptive_rules_v1' && insight?.recommendation && insight?.metrics) {
        setLearningInsight(insight as LearningInsight);
      } else if (!controller.signal.aborted) {
        setLearningInsight(null);
      }
    } catch {
      if (controller.signal.aborted) return;
      setSavedItems([]);
      setSavedItemSummary({ totalItems: 0, totalDue: 0 });
      setLearningInsight(null);
      setSavedItemsError('Không thể tải mục đã lưu. Hãy kiểm tra kết nối rồi thử lại.');
    } finally {
      if (savedItemsAbortRef.current === controller) {
        savedItemsAbortRef.current = null;
        setIsLoadingSavedItems(false);
      }
    }
  }, [authenticatedRequest, isAuthenticated]);

  useEffect(() => {
    fetchSavedItems();
    return () => savedItemsAbortRef.current?.abort();
  }, [fetchSavedItems]);

  const updateVocabularyCards = useCallback(async (
    itemIds: number[],
    updates: { learningStage?: LearningStage; cardLabel?: CardLabelColor | null },
  ) => {
    if (itemIds.length === 0) return;
    const response = await authenticatedRequest('/vocabulary/cards', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: itemIds,
        ...(updates.learningStage ? { learning_stage: updates.learningStage } : {}),
        ...(updates.cardLabel !== undefined ? { card_label: updates.cardLabel } : {}),
      }),
    });
    if (!response.ok) throw new Error(await getApiError(response));
    await fetchSavedItems();
  }, [authenticatedRequest, fetchSavedItems]);

  const handleCycleCardLabel = useCallback(async (word: string) => {
    if (!learningDisplayPreferences.longPressCyclesCardLabel) return;
    const normalizedWord = word.trim().toLocaleLowerCase();
    const item = savedItems.find((candidate) => candidate.word.trim().toLocaleLowerCase() === normalizedWord);
    if (!item) {
      Alert.alert('Chưa phải thẻ', 'Hãy chạm từ và lưu vào Mục đã lưu trước khi gắn màu.');
      return;
    }

    const labels: Array<CardLabelColor | null> = [null, 'red', 'green', 'yellow', 'blue'];
    const currentLabel = (item as SavedItem & { card_label?: CardLabelColor | null }).card_label || null;
    const nextLabel = labels[(labels.indexOf(currentLabel) + 1) % labels.length];
    try {
      await updateVocabularyCards([item.id], { cardLabel: nextLabel });
    } catch (error) {
      Alert.alert('Không thể đổi màu thẻ', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  }, [learningDisplayPreferences.longPressCyclesCardLabel, savedItems, updateVocabularyCards]);

  const handleBulkUpdateLearningStage = useCallback(async ({
    itemIds,
    learningStage,
  }: SavedItemsBulkLearningUpdate) => {
    await updateVocabularyCards(itemIds, { learningStage });
  }, [updateVocabularyCards]);

  // Gộp các cue và kéo dài thời gian để câu hiển thị liền mạch không bị ngắt quãng
  const processAndTranslateCues = async (rawCues: any[]) => {
    const generation = subtitleGenerationRef.current;
    try {
      setLoading(true);
      setHasNoCaptions(false);

      if (!Array.isArray(rawCues) || rawCues.length === 0) {
        if (generation !== subtitleGenerationRef.current) return;
        clearSubtitleWaitTimer();
        subtitleSourceRef.current = 'none';
        subtitlesRef.current = [];
        activeCueRef.current = null;
        setSubtitles([]);
        setActiveCue(null);
        setHasNoCaptions(true);
        return;
      }

      const merged: any[] = [];
      let current = {
        start: Number(rawCues[0].start),
        end: Number(rawCues[0].start) + Number(rawCues[0].duration),
        text: rawCues[0].text.trim(),
      };

      for (let i = 1; i < rawCues.length; i++) {
        const c = rawCues[i];
        const end = Number(c.start) + Number(c.duration);
        const duration = end - current.start;

        if (duration >= 5.0 || /[.!?]$/.test(current.text)) {
          merged.push(current);
          current = { start: Number(c.start), end: end, text: c.text.trim() };
        } else {
          current.text += ' ' + c.text.trim();
          current.end = end;
        }
      }
      if (current.text) merged.push(current);

      // Kéo dài end_time đến sát lúc câu sau bắt đầu để không có khoảng trống đen giữa các câu
      for (let k = 0; k < merged.length; k++) {
        if (k < merged.length - 1) {
          merged[k].end = Math.max(merged[k].end, merged[k + 1].start);
        } else {
          merged[k].end += 2.5;
        }
      }

      // 1. Đưa phụ đề lên giao diện NGAY LẬP TỨC để người dùng thấy ngay (0ms trễ)
      const immediateList: SubtitleCue[] = merged.map((item, idx) => ({
        cue_index: idx,
        start_time: Number(item.start.toFixed(2)),
        end_time: Number(item.end.toFixed(2)),
        en_text: item.text,
        vi_text: 'Đang dịch...',
      }));
      if (generation !== subtitleGenerationRef.current) return;
      clearSubtitleWaitTimer();
      subtitleSourceRef.current = 'client';
      subtitlesRef.current = immediateList;
      setSubtitles(immediateList);
      const currentCue = findSubtitleCue(immediateList, lastPlaybackTimeRef.current);
      activeCueRef.current = currentCue;
      setActiveCue(currentCue);
      setLoading(false);

      // 2. Giới hạn số request chạy cùng lúc để tránh Google Translate
      // throttling; thất bại phải hiện thông báo, không được lặp lại câu Anh.
      void runWithConcurrency(merged, TRANSLATION_CONCURRENCY, async (item, i) => {
        let vi = TRANSLATION_UNAVAILABLE_TEXT;
        try {
          vi = await translateDirect(item.text);
        } catch {
          // Giữ thông báo tiếng Việt để người dùng biết dịch vụ đang lỗi.
        }
        if (generation !== subtitleGenerationRef.current) return;
        setSubtitles(prev => {
          const updated = [...prev];
          if (updated[i]) {
            updated[i] = { ...updated[i], vi_text: vi };
          }
          subtitlesRef.current = updated;
          return updated;
        });
        setActiveCue(curr => {
          if (curr && curr.en_text === item.text) {
            const translatedCue = { ...curr, vi_text: vi };
            activeCueRef.current = translatedCue;
            return translatedCue;
          }
          return curr;
        });
      });
    } catch (e) {
      console.warn('Lỗi xử lý phụ đề:', e);
    } finally {
      if (generation === subtitleGenerationRef.current) setLoading(false);
    }
  };

  // 🎯 TÍCH HỢP SERVER-SIDE AI: Kéo phụ đề từ Server (Redis Cache + Groq/Gemini / Whisper)
  const fetchSubtitlesFromServer = async (
    videoId: string,
    platform: VideoPlatform = currentPlatformRef.current,
  ) => {
    if (!videoId) return false;
    const requestId = ++subtitleRequestIdRef.current;

    const applyReadySubtitles = (payload: any): boolean => {
      if (
        requestId !== subtitleRequestIdRef.current ||
        payload?.status !== 'READY' ||
        !Array.isArray(payload.data) ||
        payload.data.length === 0
      ) {
        return false;
      }

      const serverCues: SubtitleCue[] = payload.data
        .map((cue: any, index: number): SubtitleCue => {
          const enText = String(cue?.en_text ?? '').trim();
          const viText = typeof cue?.vi_text === 'string' ? cue.vi_text.trim() : '';
          return {
            cue_index: Number.isFinite(Number(cue?.cue_index)) ? Number(cue.cue_index) : index,
            start_time: Number(cue?.start_time),
            end_time: Number(cue?.end_time),
            en_text: enText,
            vi_text: isUsableTranslation(enText, viText) ? viText : 'Đang dịch...',
          };
        })
        .filter((cue: SubtitleCue) => (
          Boolean(cue.en_text) &&
          Number.isFinite(cue.start_time) &&
          Number.isFinite(cue.end_time) &&
          cue.end_time >= cue.start_time
        ));
      if (serverCues.length === 0) return false;

      clearSubtitleWaitTimer();
      subtitleSourceRef.current = 'server';
      subtitlesRef.current = serverCues;
      setSubtitles(serverCues);
      const currentCue = findSubtitleCue(serverCues, lastPlaybackTimeRef.current);
      activeCueRef.current = currentCue;
      setActiveCue(currentCue);
      setHasNoCaptions(false);

      const untranslatedCues = serverCues
        .map((cue, index) => ({ cue, index }))
        .filter(({ cue }) => cue.vi_text === 'Đang dịch...');
      void runWithConcurrency(
        untranslatedCues,
        TRANSLATION_CONCURRENCY,
        async ({ cue, index }) => {
          let vi = TRANSLATION_UNAVAILABLE_TEXT;
          try {
            vi = await translateDirect(cue.en_text);
          } catch {
            // Không cho bản dịch server rỗng/sai rơi về nguyên văn tiếng Anh.
          }
          if (
            requestId !== subtitleRequestIdRef.current ||
            subtitleSourceRef.current !== 'server'
          ) return;
          setSubtitles(prev => {
            if (
              !prev[index] ||
              prev[index].en_text !== cue.en_text ||
              prev[index].start_time !== cue.start_time
            ) return prev;
            const updated = [...prev];
            updated[index] = { ...updated[index], vi_text: vi };
            subtitlesRef.current = updated;
            return updated;
          });
          setActiveCue(prev => {
            if (
              !prev ||
              prev.en_text !== cue.en_text ||
              prev.start_time !== cue.start_time
            ) return prev;
            const updated = { ...prev, vi_text: vi };
            activeCueRef.current = updated;
            return updated;
          });
        }
      );
      return true;
    };

    try {
      setLoading(true);
      const requestResponse = await apiRequest('/subtitles/request', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ video_id: videoId, platform }),
      });

      if (!requestResponse.ok) {
        throw new Error(await getApiError(requestResponse));
      }

      const initialPayload = await requestResponse.json();
      if (applyReadySubtitles(initialPayload)) return true;

      // Worker xử lý bất đồng bộ: poll nhẹ để nhận kết quả mà không chặn phụ đề client-first.
      if (initialPayload?.status === 'PROCESSING') {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          if (requestId !== subtitleRequestIdRef.current) return false;

          const pollResponse = await apiRequest(
            `/subtitles/${encodeURIComponent(videoId)}?platform=${encodeURIComponent(platform)}`,
          );
          if (!pollResponse.ok) continue;
          const pollPayload = await pollResponse.json();
          if (applyReadySubtitles(pollPayload)) return true;
          if (pollPayload?.status === 'FAILED') break;
        }
      }
    } catch {
      // Phụ đề từ WebView vẫn là nguồn chính khi dịch vụ nền tạm thời không khả dụng.
    } finally {
      if (requestId === subtitleRequestIdRef.current) setLoading(false);
    }
    return false;
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const messagePlatform: VideoPlatform = data.platform === 'tiktok'
        ? 'tiktok'
        : data.platform === 'youtube'
          ? 'youtube'
          : currentPlatformRef.current;

      if (data.type !== 'VIDEO_CHANGED' && messagePlatform !== currentPlatformRef.current) {
        return;
      }

      if (data.type === 'VIDEO_CHANGED') {
        const videoId = data.videoId;
        subtitleRequestIdRef.current += 1;
        subtitleGenerationRef.current += 1;
        currentVideoIdRef.current = videoId || '';
        currentPlatformRef.current = messagePlatform;
        lastPlaybackTimeRef.current = 0;
        subtitleSourceRef.current = 'none';
        subtitlesRef.current = [];
        activeCueRef.current = null;
        setHasNoCaptions(false);
        setActiveCue(null);
        setSubtitles([]);
        setCurrentPlatform(messagePlatform);
        if (videoId) {
          setCurrentVideoId(videoId);
          setLoading(true);
          armSubtitleWaitTimer(videoId, messagePlatform);
          fetchSubtitlesFromServer(videoId, messagePlatform);

          const pendingReplay = pendingReplayRef.current;
          if (
            pendingReplay?.videoId === videoId &&
            pendingReplay.platform === messagePlatform
          ) {
            pendingReplayRef.current = null;
            setTimeout(() => {
              webViewRef.current?.postMessage(JSON.stringify({
                action: 'SEEK_TO',
                time: pendingReplay.time,
              }));
            }, 700);
          }
        }
      } else if (data.type === 'CAPTIONS_EXTRACTED') {
        // Chỉ xử lý nếu chưa có phụ đề cao cấp từ Server-Side AI
        const captionVideoId = data.videoId;
        const belongsToCurrentVideo = !captionVideoId || captionVideoId === currentVideoIdRef.current;
        if (belongsToCurrentVideo && subtitleSourceRef.current !== 'server') {
          processAndTranslateCues(data.cues);
        }
      } else if (data.type === 'LIVE_CAPTION_SNIFFED') {
        // Phụ đề bắt trực tiếp từ Sniffer (triệt tiêu ở trên, hiển thị ngay ở dưới)
        const liveText = data.text;
        const liveTime = typeof data.time === 'number' ? data.time : 0;
        const currentActiveCue = activeCueRef.current;
        if (
          liveText &&
          subtitleSourceRef.current !== 'server' &&
          (!currentActiveCue || currentActiveCue.en_text !== liveText)
        ) {
          // Hiển thị ngay lên khoang Language Reactor (0ms trễ)
          const newCue: SubtitleCue = {
            start_time: liveTime,
            end_time: liveTime + 6.0,
            en_text: liveText,
            vi_text: 'Đang dịch nghĩa...',
          };
          clearSubtitleWaitTimer();
          subtitleSourceRef.current = 'live';
          activeCueRef.current = newCue;
          setActiveCue(newCue);
          setHasNoCaptions(false);
          setLoading(false);

          // Dịch dự phòng trên thiết bị để phụ đề trực tiếp không chặn trải nghiệm.
          translateDirect(liveText)
            .then((vi) => {
              setActiveCue(prev => {
                if (!prev || prev.en_text !== liveText) return prev;
                const translatedCue = { ...prev, vi_text: vi };
                activeCueRef.current = translatedCue;
                return translatedCue;
              });
            })
            .catch(() => {
              setActiveCue(prev => {
                if (!prev || prev.en_text !== liveText) return prev;
                const failedCue = { ...prev, vi_text: TRANSLATION_UNAVAILABLE_TEXT };
                activeCueRef.current = failedCue;
                return failedCue;
              });
            });
        }
      } else if (data.type === 'TIME_UPDATE') {
        const t = Number(data.time ?? data.currentTime);
        if (!Number.isFinite(t)) return;
        lastPlaybackTimeRef.current = t;
        const latestSubtitles = subtitlesRef.current;
        const currentActiveCue = activeCueRef.current;
        if (latestSubtitles.length > 0) {
          const found = findSubtitleCue(latestSubtitles, t);

          // Auto-pause khi kết thúc câu nếu bật tính năng
          if (autoPauseEnabled && currentActiveCue && !found && !isModalVisible) {
            webViewRef.current?.postMessage(JSON.stringify({ action: 'PAUSE_VIDEO' }));
          }

          if (found && (!currentActiveCue || currentActiveCue.start_time !== found.start_time)) {
            activeCueRef.current = found;
            setActiveCue(found);
          } else if (!found && currentActiveCue) {
            activeCueRef.current = null;
            setActiveCue(null);
          }
        } else if (
          subtitleSourceRef.current === 'live' &&
          currentActiveCue &&
          t > currentActiveCue.end_time + 0.2
        ) {
          activeCueRef.current = null;
          setActiveCue(null);
        }
      }
    } catch (e) { }
  };

  const {
    handleWebViewLoadEnd,
    handleWebViewMessage,
  } = useWebViewActivity({
    active: activeTab === 'shorts',
    injectedScript: activeInjectedScript,
    onMessage: handleMessage,
    webViewRef,
  });

  // 🎯 CHẠM VÀO TỪ -> DỪNG VIDEO TỨC THÌ & MỞ TỪ ĐIỂN LANGUAGE REACTOR
  const handleWordPress = async (word: string, fullSentence: string) => {
    if (!word) return;

    // 1. Dừng video ngay tức thì
    webViewRef.current?.postMessage(JSON.stringify({ action: 'PAUSE_VIDEO' }));

    // 2. Mở popup từ điển Language Reactor
    setSelectedWord(word);
    setContextSentence(fullSentence);
    setWordMeaning('');
    setIsModalVisible(true);

    // 3. Tra nghĩa từ vựng tức thì
    try {
      setIsTranslatingWord(true);
      const meaning = await translateDirect(word);
      setWordMeaning(meaning);
    } catch {
      setWordMeaning(TRANSLATION_UNAVAILABLE_TEXT);
    } finally {
      setIsTranslatingWord(false);
    }
  };

  // Đóng Popup & Video tự phát tiếp
  const handleCloseAndResume = () => {
    setIsModalVisible(false);
    webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
  };

  // Tua lại đầu câu
  const handleReplayCue = () => {
    if (activeCue) {
      webViewRef.current?.postMessage(JSON.stringify({
        action: 'SEEK_TO',
        time: activeCue.start_time,
      }));
    }
  };

  // Nhảy sang câu tiếp theo
  const handleNextCue = () => {
    if (!activeCue || subtitles.length === 0) return;
    const currentIdx = subtitles.findIndex(c => c.start_time === activeCue.start_time);
    if (currentIdx !== -1 && currentIdx + 1 < subtitles.length) {
      const next = subtitles[currentIdx + 1];
      webViewRef.current?.postMessage(JSON.stringify({
        action: 'SEEK_TO',
        time: next.start_time,
      }));
    }
  };

  const handleTranscriptCuePress = useCallback((cue: SubtitleCue) => {
    activeCueRef.current = cue;
    setActiveCue(cue);
    webViewRef.current?.postMessage(JSON.stringify({
      action: 'SEEK_TO',
      time: cue.start_time,
    }));
  }, []);

  const resetSubtitlesForVideo = (videoId: string | null, platform: VideoPlatform) => {
    subtitleRequestIdRef.current += 1;
    subtitleGenerationRef.current += 1;
    currentVideoIdRef.current = videoId || '';
    currentPlatformRef.current = platform;
    lastPlaybackTimeRef.current = 0;
    subtitleSourceRef.current = 'none';
    subtitlesRef.current = [];
    activeCueRef.current = null;
    setCurrentVideoId(videoId || '');
    setCurrentPlatform(platform);
    setHasNoCaptions(false);
    setLoading(Boolean(videoId));
    setSubtitles([]);
    setActiveCue(null);
    isTranscriptVisibleRef.current = false;
    transcriptFollowPausedUntilRef.current = 0;
    transcriptListRef.current?.scrollToOffset({ offset: 0, animated: false });
    if (videoId) armSubtitleWaitTimer(videoId, platform);
  };

  const openVideoTarget = (target: VideoTarget) => {
    resetSubtitlesForVideo(target.videoId, target.platform);
    if (!target.videoId) setLoading(true);
    setShortPickerPlatform(target.platform);
    setWebViewUri(target.url);
  };

  const openShortById = (videoId: string) => {
    openVideoTarget(createYouTubeTarget(videoId));
  };

  const closePlatformPicker = () => {
    setIsPlatformPickerVisible(false);
    webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
  };

  const handleSelectPlatform = (platform: VideoPlatform) => {
    setIsPlatformPickerVisible(false);
    setShortPickerPlatform(platform);
    if (platform === currentPlatform) {
      webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
      return;
    }
    resetSubtitlesForVideo(null, platform);
    setWebViewUri(platform === 'youtube' ? YOUTUBE_SHORTS_HOME_URL : TIKTOK_HOME_URL);
  };

  const handleOpenTikTokAccount = () => {
    setIsPlatformPickerVisible(false);
    setShortPickerPlatform('tiktok');
    if (currentPlatform !== 'tiktok') {
      resetSubtitlesForVideo(null, 'tiktok');
      setWebViewUri(TIKTOK_HOME_URL);
    }
    navigateToMainTab('shorts');
    setTimeout(() => {
      webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
    }, 250);
  };

  const handleOpenYouTubeAccount = () => {
    setIsPlatformPickerVisible(false);
    setShortPickerPlatform('youtube');
    if (currentPlatform !== 'youtube') {
      resetSubtitlesForVideo(null, 'youtube');
      setWebViewUri(YOUTUBE_SHORTS_HOME_URL);
    }
    navigateToMainTab('shorts');
    setTimeout(() => {
      webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
    }, 250);
  };

  const closeShortPicker = () => {
    setIsShortPickerVisible(false);
    setShortUrlError(null);
    webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
  };

  const handleOpenShortFromLink = () => {
    const target = parseVideoTarget(shortUrlInput, shortPickerPlatform);
    if (!target) {
      setShortUrlError(shortPickerPlatform === 'youtube'
        ? 'Dán liên kết YouTube hợp lệ hoặc mã video gồm 11 ký tự.'
        : 'Dán liên kết TikTok hợp lệ hoặc mã video TikTok.');
      return;
    }

    setShortUrlError(null);
    setIsShortPickerVisible(false);
    setShortUrlInput('');
    openVideoTarget(target);
  };

  // Chuyển sang Video Short kế tiếp
  const handleNextShort = () => {
    webViewRef.current?.postMessage(JSON.stringify({ action: 'NEXT_SHORT' }));
  };

  // Quay lại Video Short trước
  const handlePrevShort = () => {
    webViewRef.current?.postMessage(JSON.stringify({ action: 'PREV_SHORT' }));
  };

  // Lưu thật từ đang tra vào backend FSRS thay vì chỉ hiển thị thông báo giả lập.
  const handleSaveToSRS = async () => {
    if (!selectedWord || !wordMeaning || isTranslatingWord) return;
    if (!isAuthenticated) {
      Alert.alert('Cần đăng nhập', 'Đăng nhập ShortLearn để lưu và đồng bộ flashcard.');
      return;
    }

    try {
      setIsSavingWord(true);
      const response = await authenticatedRequest('/vocabulary/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: selectedWord,
          meaning: wordMeaning,
          context_sentence: contextSentence,
          video_id: currentVideoId || null,
          timestamp_mark: activeCue?.start_time ?? 0,
        }),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      await fetchSavedItems();
      Alert.alert('Đã lưu', `Từ “${selectedWord}” đã được thêm vào bộ thẻ FSRS.`);
      handleCloseAndResume();
    } catch (error) {
      Alert.alert('Không thể lưu từ', error instanceof Error ? error.message : 'API Gateway chưa khả dụng.');
    } finally {
      setIsSavingWord(false);
    }
  };

  const handleRateCard = async (card: DueCard, rating: Rating) => {
    const response = await authenticatedRequest('/vocabulary/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: card.word,
        rating,
      }),
    });

    if (!response.ok) {
      throw new Error(await getApiError(response));
    }

    await fetchSavedItems();
  };

  const handleReplayContext = (videoId: string, timestamp: number) => {
    if (!videoId) return;
    const targetTime = Math.max(0, timestamp - 2);
    navigateToMainTab('shorts');

    if (videoId === currentVideoId) {
      setTimeout(() => {
        webViewRef.current?.postMessage(JSON.stringify({ action: 'SEEK_TO', time: targetTime }));
      }, 100);
      return;
    }

    pendingReplayRef.current = { videoId, time: targetTime, platform: 'youtube' };
    openShortById(videoId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={activeTab === 'review' ? 'dark-content' : 'light-content'}
        backgroundColor={activeTab === 'review' ? '#F7F8FC' : '#000000'}
      />

      <AuthStack
        renderMain={() => (
          <MainTabs
            bottomNavigationVisible={isBottomNavVisible}
            dueCount={savedDueCount}
            onActiveTabChange={setActiveTab}
            onBottomNavigationVisibleChange={setIsBottomNavVisible}
            onTabPress={(tab) => {
              webViewRef.current?.postMessage(JSON.stringify({ action: 'PAUSE_VIDEO' }));
              if (tab === 'shorts') {
                setShortPickerPlatform(currentPlatform);
                setIsPlatformPickerVisible(true);
              } else if (tab === 'review') {
                fetchSavedItems();
              }
            }}
            renderShorts={() => (
              <ShortsScreen
                activeCue={activeCue}
                autoPauseEnabled={autoPauseEnabled}
                currentPlatform={currentPlatform}
                handleWebViewLoadEnd={handleWebViewLoadEnd}
                handleWebViewMessage={handleWebViewMessage}
                hasNoCaptions={hasNoCaptions}
                injectedScript={activeInjectedScript}
                isSavingWord={isSavingWord}
                isTranslatingWord={isTranslatingWord}
                isVisible={activeTab === 'shorts'}
                learningDisplayPreferences={learningDisplayPreferences}
                loading={loading}
                selectedWord={selectedWord}
                shortsViewportHeight={shortsViewportHeight}
                subtitles={subtitles}
                transcriptListRef={transcriptListRef}
                uri={webViewUri}
                webViewRef={webViewRef}
                wordLearningStates={wordLearningStates}
                wordLookupVisible={isModalVisible}
                wordMeaning={wordMeaning}
                onCloseWordLookup={handleCloseAndResume}
                onNextCue={handleNextCue}
                onNextShort={handleNextShort}
                onOpenShortPicker={() => {
                  setShortPickerPlatform(currentPlatform);
                  setShortUrlError(null);
                  setIsShortPickerVisible(true);
                  webViewRef.current?.postMessage(JSON.stringify({ action: 'PAUSE_VIDEO' }));
                }}
                onPrevShort={handlePrevShort}
                onReplayCue={handleReplayCue}
                onSaveWord={handleSaveToSRS}
                onTranscriptCuePress={handleTranscriptCuePress}
                onTranscriptScroll={handleTranscriptScroll}
                onTranscriptScrollBegin={pauseTranscriptFollowing}
                onToggleAutoPause={() => setAutoPauseEnabled(!autoPauseEnabled)}
                onViewportHeightChange={setShortsViewportHeight}
                onWordLongPress={learningDisplayPreferences.longPressCyclesCardLabel
                  ? handleCycleCardLabel
                  : undefined}
                onWordPress={handleWordPress}
              />
            )}
            renderReview={() => (
              <ReviewScreen
                items={savedItems}
                totalItems={savedItemSummary.totalItems}
                totalDue={savedItemSummary.totalDue}
                learningInsight={learningInsight}
                isLoading={isLoadingSavedItems}
                errorMessage={savedItemsError}
                onRefresh={fetchSavedItems}
                onRateCard={handleRateCard}
                onReplayContext={handleReplayContext}
                onBulkUpdateLearningStage={handleBulkUpdateLearningStage}
              />
            )}
            renderAccount={() => (
              <AccountScreen
                accountPlatform={accountPlatform}
                isDisconnectingYouTube={isDisconnectingYouTube}
                isExpoGo={isExpoGo}
                isGoogleOAuthConfigured={isGoogleOAuthConfigured}
                isLoadingYouTubeSession={isLoadingYouTubeSession}
                isSigningInYouTube={isSigningInYouTube}
                learningDisplayPreferences={learningDisplayPreferences}
                youTubeNotice={youTubeNotice}
                youTubeSession={youTubeSession}
                onAccountPlatformChange={setAccountPlatform}
                onDisconnectYouTube={handleYouTubeDisconnect}
                onLearningDisplayChange={updateLearningDisplayPreferences}
                onOpenTikTok={handleOpenTikTokAccount}
                onOpenYouTube={handleOpenYouTubeAccount}
                onSignInYouTube={handleYouTubeSignIn}
              />
            )}
          />
        )}
      />

      {/* Chọn nguồn video khi người dùng bấm tab Shorts. */}
      <Modal
        visible={isPlatformPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={closePlatformPicker}
      >
        <View style={styles.platformPickerBackdrop}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Đóng bộ chọn nền tảng"
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={closePlatformPicker}
          />
          <View style={styles.platformPickerCard}>
            <View style={styles.platformPickerHeader}>
              <View>
                <Text style={styles.platformPickerTitle}>Chọn nền tảng Shorts</Text>
                <Text style={styles.platformPickerDescription}>Bạn muốn học với video từ đâu?</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                style={styles.platformPickerCloseButton}
                onPress={closePlatformPicker}
              >
                <Text style={styles.platformPickerCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.platformOptionsRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Mở YouTube Shorts"
                style={[
                  styles.platformOption,
                  currentPlatform === 'youtube' && styles.platformOptionYouTubeActive,
                ]}
                onPress={() => handleSelectPlatform('youtube')}
              >
                <View style={[styles.platformLogo, styles.youtubeLogo]}>
                  <Text style={styles.youtubePlayIcon}>▶</Text>
                </View>
                <Text style={styles.platformOptionTitle}>YouTube</Text>
                <Text style={styles.platformOptionCaption}>Shorts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Mở TikTok"
                style={[
                  styles.platformOption,
                  currentPlatform === 'tiktok' && styles.platformOptionTikTokActive,
                ]}
                onPress={() => handleSelectPlatform('tiktok')}
              >
                <View style={[styles.platformLogo, styles.tiktokLogo]}>
                  <View style={styles.tiktokRoseDot} />
                  <Text style={styles.tiktokNoteIcon}>♪</Text>
                </View>
                <Text style={styles.platformOptionTitle}>TikTok</Text>
                <Text style={styles.platformOptionCaption}>For You</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mở một video cụ thể từ liên kết hoặc mã video. */}
      <Modal
        visible={isShortPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={closeShortPicker}
      >
        <KeyboardAvoidingView
          style={styles.shortPickerKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.shortPickerBackdrop}>
            <View style={styles.shortPickerCard}>
              <View style={styles.shortPickerHandle} />
              <Text style={styles.shortPickerTitle}>
                Mở {shortPickerPlatform === 'youtube' ? 'YouTube Short' : 'video TikTok'}
              </Text>
              <Text style={styles.shortPickerDescription}>
                {shortPickerPlatform === 'youtube'
                  ? 'Dán liên kết YouTube Shorts, video YouTube hoặc mã video để mở ngay trong chế độ học.'
                  : 'Dán liên kết TikTok hoặc mã video để mở ngay trong chế độ học.'}
              </Text>
              <View style={styles.shortPickerPlatformRow}>
                <TouchableOpacity
                  style={[
                    styles.shortPickerPlatformButton,
                    shortPickerPlatform === 'youtube' && styles.shortPickerPlatformYouTubeActive,
                  ]}
                  onPress={() => {
                    setShortPickerPlatform('youtube');
                    setShortUrlError(null);
                  }}
                >
                  <View style={styles.shortPickerYouTubeIcon}>
                    <Text style={styles.shortPickerYouTubePlay}>▶</Text>
                  </View>
                  <Text style={styles.shortPickerPlatformLabel}>YouTube</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.shortPickerPlatformButton,
                    shortPickerPlatform === 'tiktok' && styles.shortPickerPlatformTikTokActive,
                  ]}
                  onPress={() => {
                    setShortPickerPlatform('tiktok');
                    setShortUrlError(null);
                  }}
                >
                  <View style={styles.shortPickerTikTokIcon}>
                    <Text style={styles.shortPickerTikTokNote}>♪</Text>
                  </View>
                  <Text style={styles.shortPickerPlatformLabel}>TikTok</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={shortUrlInput}
                onChangeText={(value) => {
                  setShortUrlInput(value);
                  if (shortUrlError) setShortUrlError(null);
                }}
                placeholder={shortPickerPlatform === 'youtube'
                  ? 'https://youtube.com/shorts/...'
                  : 'https://www.tiktok.com/@user/video/...'}
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleOpenShortFromLink}
                style={[styles.shortUrlInput, shortUrlError && styles.shortUrlInputError]}
              />
              {shortUrlError && <Text style={styles.shortUrlErrorText}>{shortUrlError}</Text>}
              <View style={styles.shortPickerActions}>
                <TouchableOpacity
                  style={styles.shortPickerCancelButton}
                  onPress={closeShortPicker}
                >
                  <Text style={styles.shortPickerCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shortPickerOpenButton} onPress={handleOpenShortFromLink}>
                  <Text style={styles.shortPickerOpenText}>
                    Mở {shortPickerPlatform === 'youtube' ? 'YouTube' : 'TikTok'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={false}
        transparent
        animationType="slide"
        onRequestClose={handleCloseAndResume}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.lrCard}>
            {/* Header: Từ vựng */}
            <View style={styles.lrHeader}>
              <View>
                <Text style={styles.lrWord}>{selectedWord}</Text>
                <Text style={styles.lrTag}>Language Reactor Flashcard</Text>
              </View>
              <TouchableOpacity
                style={styles.closeIconBtn}
                onPress={handleCloseAndResume}
              >
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Định nghĩa từ vựng */}
            <View style={styles.meaningBox}>
              <Text style={styles.boxLabel}>ĐỊNH NGHĨA TIẾNG VIỆT:</Text>
              {isTranslatingWord ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <Text style={styles.meaningText}>{wordMeaning || 'Đang tra nghĩa...'}</Text>
              )}
            </View>

            {/* Ngữ cảnh trong video */}
            <View style={styles.contextBox}>
              <Text style={styles.boxLabel}>CÂU GỐC TRONG VIDEO:</Text>
              <Text style={styles.contextSentence}>"{contextSentence}"</Text>
            </View>

            {/* Nút hành động */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.replayButton}
                onPress={() => {
                  handleCloseAndResume();
                  handleReplayCue();
                }}
              >
                <Text style={styles.replayButtonText}>⟲ Nghe lại câu này</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, (isSavingWord || isTranslatingWord) && styles.disabledButton]}
                onPress={handleSaveToSRS}
                disabled={isSavingWord || isTranslatingWord}
              >
                {isSavingWord ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>⭐ Lưu Flashcard</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Đóng & tiếp tục phát */}
            <TouchableOpacity
              style={styles.resumeButton}
              onPress={handleCloseAndResume}
            >
              <Text style={styles.resumeButtonText}>▶ Đóng & Tiếp tục phát video</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <AppRuntimeProvider>
            <ShortLearnApp />
          </AppRuntimeProvider>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  learningView: {
    flex: 1,
  },
  learningScroll: {
    flex: 1,
  },
  learningScrollContent: {
    backgroundColor: '#000000',
    paddingBottom: 12,
  },
  shortsViewport: {
    minHeight: 520,
  },
  hiddenView: {
    display: 'none',
  },
  reviewView: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoTopBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  openShortButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 7,
  },
  openShortButtonText: {
    color: '#082F49',
    fontSize: 27,
    fontWeight: '500',
    lineHeight: 29,
  },
  subtitleDock: {
    height: 190,
    backgroundColor: '#0F172A',
    borderTopWidth: 2,
    borderTopColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },
  transcriptPanel: {
    minHeight: 41,
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 0,
    backgroundColor: '#050B13',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#334155',
    borderRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  transcriptHeader: {
    height: 41,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  transcriptTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  transcriptSource: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2,
  },
  transcriptList: {
    flex: 1,
  },
  transcriptRow: {
    minHeight: 62,
    marginHorizontal: 8,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#050B13',
    borderLeftWidth: 2,
    borderLeftColor: '#334155',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.10)',
  },
  transcriptRowActive: {
    backgroundColor: '#0A1826',
    borderLeftColor: '#38BDF8',
  },
  transcriptRowLast: {
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },
  transcriptTime: {
    width: 42,
    paddingTop: 2,
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  transcriptTimeActive: {
    color: '#38BDF8',
  },
  transcriptCopy: {
    flex: 1,
    paddingRight: 7,
  },
  transcriptEnglish: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  transcriptEnglishActive: {
    color: '#FFFFFF',
  },
  transcriptVietnamese: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  transcriptVietnameseActive: {
    color: '#CBD5E1',
  },
  transcriptPlay: {
    width: 16,
    color: '#38BDF8',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
  },
  transcriptEmpty: {
    minHeight: 176,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  transcriptEmptyVirtual: {
    minHeight: 176,
    marginHorizontal: 8,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#050B13',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#334155',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  transcriptFooter: {
    height: 8,
  },
  transcriptEmptyText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },

  statusBadge: {
    position: 'absolute',
    top: 72,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10000,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  statusText: {
    color: '#38BDF8',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  noCaptionBadge: {
    position: 'absolute',
    top: 72,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10000,
  },
  noCaptionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  platformPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  platformPickerCard: {
    backgroundColor: '#0B0F19',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  platformPickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  platformPickerTitle: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '800',
  },
  platformPickerDescription: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 5,
  },
  platformPickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  platformPickerCloseText: {
    color: '#CBD5E1',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '500',
  },
  platformOptionsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  platformOption: {
    flex: 1,
    minHeight: 148,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: '#151A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformOptionYouTubeActive: {
    borderColor: '#FF0033',
    backgroundColor: 'rgba(255, 0, 51, 0.08)',
  },
  platformOptionTikTokActive: {
    borderColor: '#25F4EE',
    backgroundColor: 'rgba(37, 244, 238, 0.08)',
  },
  platformLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  youtubeLogo: {
    width: 74,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#FF0033',
  },
  youtubePlayIcon: {
    color: '#FFFFFF',
    fontSize: 27,
    marginLeft: 4,
  },
  tiktokLogo: {
    backgroundColor: '#050505',
    overflow: 'hidden',
  },
  tiktokRoseDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FE2C55',
    right: 8,
    bottom: 8,
    opacity: 0.65,
  },
  tiktokNoteIcon: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    textShadowColor: '#25F4EE',
    textShadowOffset: { width: -2, height: 1 },
    textShadowRadius: 0,
  },
  platformOptionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  platformOptionCaption: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  shortPickerKeyboard: {
    flex: 1,
  },
  shortPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  shortPickerCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  shortPickerHandle: {
    width: 38,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#475569',
    alignSelf: 'center',
    marginBottom: 18,
  },
  shortPickerTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  shortPickerDescription: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 16,
  },
  shortPickerPlatformRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  shortPickerPlatformButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shortPickerPlatformYouTubeActive: {
    borderColor: '#FF0033',
    backgroundColor: 'rgba(255, 0, 51, 0.09)',
  },
  shortPickerPlatformTikTokActive: {
    borderColor: '#25F4EE',
    backgroundColor: 'rgba(37, 244, 238, 0.09)',
  },
  shortPickerYouTubeIcon: {
    width: 28,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#FF0033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortPickerYouTubePlay: {
    color: '#FFFFFF',
    fontSize: 10,
    marginLeft: 1,
  },
  shortPickerTikTokIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortPickerTikTokNote: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: '#25F4EE',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 0,
  },
  shortPickerPlatformLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  shortUrlInput: {
    height: 52,
    color: '#F8FAFC',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 14,
    fontSize: 14,
  },
  shortUrlInputError: {
    borderColor: '#F87171',
  },
  shortUrlErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  shortPickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  shortPickerCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortPickerCancelText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  shortPickerOpenButton: {
    flex: 1.25,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortPickerOpenText: {
    color: '#082F49',
    fontSize: 15,
    fontWeight: '800',
  },
  lrCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  lrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lrWord: {
    color: '#38BDF8',
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  lrTag: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  closeIconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
  },
  meaningBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  contextBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  boxLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  meaningText: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  contextSentence: {
    color: '#F8FAFC',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  replayButton: {
    flex: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  replayButtonText: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  accountView: {
    flexGrow: 1,
    backgroundColor: '#090D16',
    padding: 20,
  },
  accountHero: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 22,
  },
  accountHeroPlatforms: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  accountHeroPlatformIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#090D16',
  },
  accountHeroYouTubeIcon: {
    backgroundColor: '#FF0033',
    zIndex: 2,
  },
  accountHeroTikTokIcon: {
    backgroundColor: '#050505',
    marginLeft: -8,
    borderColor: '#25F4EE',
  },
  accountHeroYouTubeGlyph: {
    color: '#FFFFFF',
    fontSize: 21,
    marginLeft: 3,
  },
  accountHeroTikTokGlyph: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
  },
  accountHeroIcon: {
    color: '#FF3D3D',
    fontSize: 44,
    marginBottom: 12,
  },
  accountTitle: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
  },
  accountDescription: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  accountPlatformSwitcher: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 10,
  },
  accountPlatformButton: {
    flex: 1,
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountPlatformYouTubeActive: {
    borderColor: '#FF335F',
    backgroundColor: 'rgba(255, 0, 51, 0.10)',
  },
  accountPlatformTikTokActive: {
    borderColor: '#25F4EE',
    backgroundColor: 'rgba(37, 244, 238, 0.08)',
  },
  accountPlatformLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  accountPlatformLogoYouTube: {
    backgroundColor: '#FF0033',
  },
  accountPlatformLogoTikTok: {
    backgroundColor: '#030303',
    borderWidth: 1,
    borderColor: 'rgba(37, 244, 238, 0.65)',
  },
  accountPlatformYouTubeGlyph: {
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 2,
  },
  accountPlatformTikTokGlyph: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  accountPlatformCopy: {
    flex: 1,
  },
  accountPlatformName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  accountPlatformStatus: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  accountCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
  },
  accountCardEyebrow: {
    color: '#FF6B86',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 7,
  },
  accountLoadingText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  accountIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  accountAvatarText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  accountAvatarTikTok: {
    backgroundColor: '#050505',
    borderWidth: 2,
    borderColor: '#25F4EE',
  },
  accountAvatarTikTokText: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
  },
  accountIdentityText: {
    flex: 1,
  },
  accountConnected: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  accountName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  accountEmail: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
  },
  accountTikTokMode: {
    color: '#25F4EE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  accountCardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  accountCardDescription: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  googleLoginButton: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLoginButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  youTubeOpenButton: {
    minHeight: 47,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 0, 51, 0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF335F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTubeOpenButtonText: {
    color: '#FF8BA3',
    fontSize: 14,
    fontWeight: '800',
  },
  accountYouTubeHint: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tikTokLoginButton: {
    minHeight: 49,
    backgroundColor: '#050505',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#25F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tikTokLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: '#FE2C55',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  accountTikTokHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 13,
  },
  accountSecondaryButton: {
    minHeight: 45,
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  accountSecondaryButtonText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  accountDisconnectButton: {
    minHeight: 45,
    borderColor: 'rgba(248, 113, 113, 0.7)',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountDisconnectButtonText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '700',
  },
  accountNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  accountNoticeTitle: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  accountNoticeText: {
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 19,
  },
  accountStatusText: {
    color: '#93C5FD',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
  },
  accountPrivacyText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  bottomNavShell: {
    position: 'relative',
    zIndex: 100,
    elevation: 20,
    marginTop: -18,
    paddingTop: 18,
    overflow: 'visible',
  },
  bottomNavCloseButton: {
    position: 'absolute',
    top: 0,
    right: 10,
    zIndex: 2,
    elevation: 21,
    width: 32,
    height: 24,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavCloseButtonSaved: {
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  bottomNavCloseText: {
    color: '#CBD5E1',
    fontSize: 20,
    lineHeight: 21,
    fontWeight: '600',
  },
  bottomNavCloseTextSaved: {
    color: '#475569',
  },
  bottomNavRestoreButton: {
    alignSelf: 'flex-end',
    minWidth: 76,
    height: 30,
    marginRight: 10,
    marginVertical: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavRestoreButtonSaved: {
    borderColor: '#D8DEE8',
    backgroundColor: '#FFFFFF',
  },
  bottomNavRestoreText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomNavRestoreTextSaved: {
    color: '#475569',
  },
  bottomNavSaved: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    color: '#64748B',
    fontSize: 21,
    textAlign: 'center',
  },
  navLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  navActive: {
    color: '#38BDF8',
  },
  navActiveSaved: {
    color: '#2563EB',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 17,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  resumeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
});
