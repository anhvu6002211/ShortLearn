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
  BackHandler,
} from 'react-native';
import { FlashListRef } from '@shopify/flash-list';
import { WebView } from 'react-native-webview';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { SubtitleCue } from './src/components/LanguageReactorOverlay';
import { SavedItem } from './src/components/SavedItemsView';
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
import { YOUTUBE_INJECTED_SCRIPT } from './src/webview/youtubeBridge';
import { MainTab, AuthStackParamList } from './src/navigation/types';
import { AuthStack } from './src/navigation/AuthStack';
import { MainTabs } from './src/navigation/MainTabs';
import { AppRuntimeProvider } from './src/providers/AppRuntimeProvider';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';
import { useWebViewActivity } from './src/hooks/useWebViewActivity';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { ShortsScreen } from './src/screens/ShortsScreen';
import { PlatformPickerModal } from './src/screens/PlatformPickerModal';
import { ShortUrlPickerModal } from './src/screens/ShortUrlPickerModal';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const GOOGLE_YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
// Android client (package + SHA-1) is verified by Google Play services. The
// native SDK uses the Web client ID as the OAuth audience at runtime.
const isGoogleOAuthConfigured = Boolean(GOOGLE_ANDROID_CLIENT_ID && GOOGLE_WEB_CLIENT_ID);
void SplashScreen.preventAutoHideAsync().catch(() => {});
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
  if (!translated || translated === '(ChÆ°a cÃ³ báº£n dá»‹ch AI)') return false;
  return normalizeTranslationComparison(sourceText) !== normalizeTranslationComparison(translated);
};

const extractGoogleTranslation = (payload: unknown): string | null => {
  // Má»™t sá»‘ pháº£n há»“i clients5 tráº£ tháº³ng chuá»—i JSON thay vÃ¬ bá»c trong máº£ng.
  if (typeof payload === 'string') return payload.trim() || null;
  if (!Array.isArray(payload) || payload.length === 0) return null;

  // clients5.google.com returns ["Báº£n dá»‹ch"].
  if (typeof payload[0] === 'string') return payload[0].trim() || null;

  // translate.googleapis.com returns [[['Báº£n dá»‹ch', 'Source', ...], ...], ...].
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

// Dá»‹ch dá»± phÃ²ng trÃªn thiáº¿t bá»‹. Hai endpoint Ä‘Æ°á»£c thá»­ tuáº§n tá»± vÃ  cÃ¡c yÃªu cáº§u
// trÃ¹ng láº·p dÃ¹ng chung má»™t Promise Ä‘á»ƒ trÃ¡nh bá»‹ Google giá»›i háº¡n tá»‘c Ä‘á»™.
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
        // Thá»­ endpoint káº¿ tiáº¿p khi timeout hoáº·c thiáº¿t bá»‹ táº¡m máº¥t máº¡ng.
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


function ShortLearnApp() {
  const { authenticatedRequest, isAuthenticated, isRestoring } = useAuth();
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

  const [activeTab, setActiveTab] = useState<MainTab>('shorts');
  const [accountPlatform, setAccountPlatform] = useState<VideoPlatform>('youtube');
  const [isBottomNavVisible, setIsBottomNavVisible] = useState<boolean>(true);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [currentPlatform, setCurrentPlatform] = useState<VideoPlatform>('youtube');
  const [webViewUri, setWebViewUri] = useState<string>(YOUTUBE_SHORTS_HOME_URL);
  const [isPlatformPickerVisible, setIsPlatformPickerVisible] = useState<boolean>(true);
  const [isShortPickerVisible, setIsShortPickerVisible] = useState<boolean>(false);
  const [shortPickerPlatform, setShortPickerPlatform] = useState<VideoPlatform>('youtube');
  const [shortUrlInput, setShortUrlInput] = useState<string>('');
  const [shortUrlError, setShortUrlError] = useState<string | null>(null);

  const navigateToMainTab = useCallback((tab: MainTab) => {
    setActiveTab(tab);
    if (!navigationRef.isReady()) return;
    if (tab === 'explore') navigationRef.navigate('Main', { screen: 'Explore' });
    else if (tab === 'review') navigationRef.navigate('Main', { screen: 'Review' });
    else if (tab === 'account') navigationRef.navigate('Main', { screen: 'Account' });
    else navigationRef.navigate('Main', { screen: 'Shorts' });
  }, []);

  // Máº·c Ä‘á»‹nh náº¡p sáºµn phá»¥ Ä‘á» Ä‘á»ƒ khoang Language Reactor luÃ´n hiá»ƒn thá»‹ ngay tá»« frame Ä‘áº§u tiÃªn
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [shortsViewportHeight, setShortsViewportHeight] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasNoCaptions, setHasNoCaptions] = useState<boolean>(false);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);

  // Tráº¡ng thÃ¡i Popup Tá»« vá»±ng Language Reactor
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [contextSentence, setContextSentence] = useState<string>('');
  const [wordMeaning, setWordMeaning] = useState<string>('');
  const [isTranslatingWord, setIsTranslatingWord] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isSavingWord, setIsSavingWord] = useState<boolean>(false);

  // App only keeps this projection for Shorts highlighting and the review badge.
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedDueCount, setSavedDueCount] = useState(0);
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
  const [learningDisplayPreferences, setLearningDisplayPreferences] = useState<LearningDisplayPreferences>(
    DEFAULT_LEARNING_DISPLAY_PREFERENCES,
  );
  const [arePreferencesReady, setArePreferencesReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // LiÃªn káº¿t YouTube dÃ¹ng Google Sign-In native; tuyá»‡t Ä‘á»‘i khÃ´ng Ä‘Äƒng nháº­p Google bÃªn trong WebView.
  const [youTubeSession, setYouTubeSession] = useState<YouTubeSession | null>(null);
  const [isLoadingYouTubeSession, setIsLoadingYouTubeSession] = useState<boolean>(true);
  const [isSigningInYouTube, setIsSigningInYouTube] = useState<boolean>(false);
  const [isDisconnectingYouTube, setIsDisconnectingYouTube] = useState<boolean>(false);
  const [youTubeNotice, setYouTubeNotice] = useState<string | null>(null);
  const isExpoGo = Constants.appOwnership === 'expo';
  const activeInjectedScript = currentPlatform === 'tiktok'
    ? TIKTOK_INJECTED_SCRIPT
    : YOUTUBE_INJECTED_SCRIPT;
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
    loadLearningDisplayPreferences()
      .then((preferences) => {
        if (isMounted) setLearningDisplayPreferences(preferences);
      })
      .finally(() => {
        if (isMounted) setArePreferencesReady(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isRestoring && arePreferencesReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [arePreferencesReady, isRestoring]);

  useEffect(() => {
    if (!isSettingsOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsSettingsOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [isSettingsOpen]);

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
        'Thiáº¿u cáº¥u hÃ¬nh Google OAuth',
        'Cáº§n Android OAuth Client ID vÃ  Web OAuth Client ID trong file .env, rá»“i khá»Ÿi Ä‘á»™ng láº¡i Metro. KhÃ´ng dÃ¹ng Client Secret trong á»©ng dá»¥ng.'
      );
      return;
    }
    if (isExpoGo) {
      Alert.alert(
        'Cáº§n development build',
        'Expo Go khÃ´ng nháº­n callback OAuth cá»§a Google. HÃ£y cháº¡y ShortLearn báº±ng development build Ä‘á»ƒ Ä‘Äƒng nháº­p YouTube.'
      );
      return;
    }

    setIsSigningInYouTube(true);
    setYouTubeNotice(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (isCancelledResponse(result)) {
        setYouTubeNotice('ÄÄƒng nháº­p Ä‘Ã£ Ä‘Æ°á»£c há»§y.');
        return;
      }

      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) throw new Error('Google khÃ´ng cáº¥p access token.');

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
      setShortPickerPlatform('youtube');
      resetSubtitlesForVideo(null, 'youtube');
      setWebViewUri(YOUTUBE_SHORTS_HOME_URL);
      navigateToMainTab('shorts');
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        setYouTubeNotice('ÄÄƒng nháº­p Ä‘Ã£ Ä‘Æ°á»£c há»§y.');
      } else if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setYouTubeNotice('Thiáº¿t bá»‹ chÆ°a cÃ³ hoáº·c cáº§n cáº­p nháº­t Google Play services.');
      } else {
        setYouTubeNotice('KhÃ´ng thá»ƒ Ä‘Äƒng nháº­p. Kiá»ƒm tra Web OAuth Client ID, SHA-1 Android vÃ  tÃ i khoáº£n Test user trong Google Cloud.');
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
      // Token cÃ³ thá»ƒ Ä‘Ã£ háº¿t háº¡n; dá»¯ liá»‡u cá»¥c bá»™ váº«n pháº£i Ä‘Æ°á»£c xÃ³a.
    } finally {
      setIsDisconnectingYouTube(false);
      setYouTubeNotice('ÄÃ£ ngáº¯t liÃªn káº¿t tÃ i khoáº£n YouTube trÃªn thiáº¿t bá»‹ nÃ y.');
    }
  };

  // Gá»™p cÃ¡c cue vÃ  kÃ©o dÃ i thá»i gian Ä‘á»ƒ cÃ¢u hiá»ƒn thá»‹ liá»n máº¡ch khÃ´ng bá»‹ ngáº¯t quÃ£ng
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

      // KÃ©o dÃ i end_time Ä‘áº¿n sÃ¡t lÃºc cÃ¢u sau báº¯t Ä‘áº§u Ä‘á»ƒ khÃ´ng cÃ³ khoáº£ng trá»‘ng Ä‘en giá»¯a cÃ¡c cÃ¢u
      for (let k = 0; k < merged.length; k++) {
        if (k < merged.length - 1) {
          merged[k].end = Math.max(merged[k].end, merged[k + 1].start);
        } else {
          merged[k].end += 2.5;
        }
      }

      // 1. ÄÆ°a phá»¥ Ä‘á» lÃªn giao diá»‡n NGAY Láº¬P Tá»¨C Ä‘á»ƒ ngÆ°á»i dÃ¹ng tháº¥y ngay (0ms trá»…)
      const immediateList: SubtitleCue[] = merged.map((item, idx) => ({
        cue_index: idx,
        start_time: Number(item.start.toFixed(2)),
        end_time: Number(item.end.toFixed(2)),
        en_text: item.text,
        vi_text: 'Äang dá»‹ch...',
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

      // 2. Giá»›i háº¡n sá»‘ request cháº¡y cÃ¹ng lÃºc Ä‘á»ƒ trÃ¡nh Google Translate
      // throttling; tháº¥t báº¡i pháº£i hiá»‡n thÃ´ng bÃ¡o, khÃ´ng Ä‘Æ°á»£c láº·p láº¡i cÃ¢u Anh.
      void runWithConcurrency(merged, TRANSLATION_CONCURRENCY, async (item, i) => {
        let vi = TRANSLATION_UNAVAILABLE_TEXT;
        try {
          vi = await translateDirect(item.text);
        } catch {
          // Giá»¯ thÃ´ng bÃ¡o tiáº¿ng Viá»‡t Ä‘á»ƒ ngÆ°á»i dÃ¹ng biáº¿t dá»‹ch vá»¥ Ä‘ang lá»—i.
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
      console.warn('Lá»—i xá»­ lÃ½ phá»¥ Ä‘á»:', e);
    } finally {
      if (generation === subtitleGenerationRef.current) setLoading(false);
    }
  };

  // ðŸŽ¯ TÃCH Há»¢P SERVER-SIDE AI: KÃ©o phá»¥ Ä‘á» tá»« Server (Redis Cache + Groq/Gemini / Whisper)
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
            vi_text: isUsableTranslation(enText, viText) ? viText : 'Äang dá»‹ch...',
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
        .filter(({ cue }) => cue.vi_text === 'Äang dá»‹ch...');
      void runWithConcurrency(
        untranslatedCues,
        TRANSLATION_CONCURRENCY,
        async ({ cue, index }) => {
          let vi = TRANSLATION_UNAVAILABLE_TEXT;
          try {
            vi = await translateDirect(cue.en_text);
          } catch {
            // KhÃ´ng cho báº£n dá»‹ch server rá»—ng/sai rÆ¡i vá» nguyÃªn vÄƒn tiáº¿ng Anh.
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

      // Worker xá»­ lÃ½ báº¥t Ä‘á»“ng bá»™: poll nháº¹ Ä‘á»ƒ nháº­n káº¿t quáº£ mÃ  khÃ´ng cháº·n phá»¥ Ä‘á» client-first.
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
          if (pollPayload?.status === 'FAILED') {
            setSubtitleError('Không thể tạo phụ đề cho video này. Bạn vẫn có thể xem video hoặc thử lại.');
            break;
          }
        }
        if (requestId === subtitleRequestIdRef.current && subtitleSourceRef.current === 'none') {
          setSubtitleError(current => current ?? 'AI đang xử lý lâu hơn dự kiến. Hãy thử lại sau.');
        }
      }
    } catch (error) {
      if (requestId === subtitleRequestIdRef.current) {
        setSubtitleError(error instanceof Error && error.message
          ? error.message
          : 'Không kết nối được dịch vụ phụ đề. Kiểm tra mạng rồi thử lại.');
      }
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
        setSubtitleError(null);
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
            pendingReplay &&
            pendingReplay.videoId === videoId &&
            pendingReplay.platform === messagePlatform
          ) {
            pendingReplayRef.current = null;
            const replayTime = pendingReplay.time;
            setTimeout(() => {
              webViewRef.current?.postMessage(JSON.stringify({
                action: 'SEEK_TO',
                time: replayTime,
              }));
            }, 700);
          }
        }
      } else if (data.type === 'CAPTIONS_EXTRACTED') {
        // Chá»‰ xá»­ lÃ½ náº¿u chÆ°a cÃ³ phá»¥ Ä‘á» cao cáº¥p tá»« Server-Side AI
        const captionVideoId = data.videoId;
        const belongsToCurrentVideo = !captionVideoId || captionVideoId === currentVideoIdRef.current;
        if (belongsToCurrentVideo && subtitleSourceRef.current !== 'server') {
          processAndTranslateCues(data.cues);
        }
      } else if (data.type === 'LIVE_CAPTION_SNIFFED') {
        // Phá»¥ Ä‘á» báº¯t trá»±c tiáº¿p tá»« Sniffer (triá»‡t tiÃªu á»Ÿ trÃªn, hiá»ƒn thá»‹ ngay á»Ÿ dÆ°á»›i)
        const liveText = data.text;
        const liveTime = typeof data.time === 'number' ? data.time : 0;
        const currentActiveCue = activeCueRef.current;
        if (
          liveText &&
          subtitleSourceRef.current !== 'server' &&
          (!currentActiveCue || currentActiveCue.en_text !== liveText)
        ) {
          // Hiá»ƒn thá»‹ ngay lÃªn khoang Language Reactor (0ms trá»…)
          const newCue: SubtitleCue = {
            start_time: liveTime,
            end_time: liveTime + 6.0,
            en_text: liveText,
            vi_text: 'Äang dá»‹ch nghÄ©a...',
          };
          clearSubtitleWaitTimer();
          subtitleSourceRef.current = 'live';
          activeCueRef.current = newCue;
          setActiveCue(newCue);
          setHasNoCaptions(false);
          setLoading(false);

          // Dá»‹ch dá»± phÃ²ng trÃªn thiáº¿t bá»‹ Ä‘á»ƒ phá»¥ Ä‘á» trá»±c tiáº¿p khÃ´ng cháº·n tráº£i nghiá»‡m.
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

          // Auto-pause khi káº¿t thÃºc cÃ¢u náº¿u báº­t tÃ­nh nÄƒng
          if (learningDisplayPreferences.autoPauseEnabled && currentActiveCue && !found && !isModalVisible) {
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
      const response = await authenticatedRequest('/vocabulary/cards', {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [item.id], card_label: nextLabel }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      setReviewRefreshToken(prev => prev + 1);
    } catch (error) {
      Alert.alert('KhÃ´ng thá»ƒ Ä‘á»•i mÃ u tháº»', error instanceof Error ? error.message : 'Vui lÃ²ng thá»­ láº¡i.');
    }
  }, [authenticatedRequest, learningDisplayPreferences.longPressCyclesCardLabel, savedItems]);

  // ðŸŽ¯ CHáº M VÃ€O Tá»ª -> Dá»ªNG VIDEO Tá»¨C THÃŒ & Má»ž Tá»ª ÄIá»‚N LANGUAGE REACTOR
  const handleWordPress = async (word: string, fullSentence: string) => {
    if (!word) return;

    // 1. Dá»«ng video ngay tá»©c thÃ¬
    webViewRef.current?.postMessage(JSON.stringify({ action: 'PAUSE_VIDEO' }));

    // 2. Má»Ÿ popup tá»« Ä‘iá»ƒn Language Reactor
    setSelectedWord(word);
    setContextSentence(fullSentence);
    setWordMeaning('');
    setIsModalVisible(true);

    // 3. Tra nghÄ©a tá»« vá»±ng tá»©c thÃ¬
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

  // ÄÃ³ng Popup & Video tá»± phÃ¡t tiáº¿p
  const handleCloseAndResume = () => {
    setIsModalVisible(false);
    webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
  };

  // Tua láº¡i Ä‘áº§u cÃ¢u
  const handleReplayCue = () => {
    if (activeCue) {
      webViewRef.current?.postMessage(JSON.stringify({
        action: 'SEEK_TO',
        time: activeCue.start_time,
      }));
    }
  };

  // Nháº£y sang cÃ¢u tiáº¿p theo
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

  const handleExploreTarget = (url: string, platform: VideoPlatform) => {
    const target = parseVideoTarget(url, platform);
    if (!target) return;
    openVideoTarget(target);
    navigateToMainTab('shorts');
  };

  const closePlatformPicker = () => {
    setIsPlatformPickerVisible(false);
    webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
  };

  const handleSelectPlatform = (platform: VideoPlatform) => {
    if (platform === 'tiktok') {
      handleOpenTikTokAccount();
      return;
    }
    setIsPlatformPickerVisible(false);
    void handleYouTubeSignIn();
  };

  const handleOpenTikTokAccount = () => {
    setIsPlatformPickerVisible(false);
    setShortPickerPlatform('tiktok');
    resetSubtitlesForVideo(null, 'tiktok');
    setWebViewUri('https://www.tiktok.com/login');
    navigateToMainTab('shorts');
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
        ? 'DÃ¡n liÃªn káº¿t YouTube há»£p lá»‡ hoáº·c mÃ£ video gá»“m 11 kÃ½ tá»±.'
        : 'DÃ¡n liÃªn káº¿t TikTok há»£p lá»‡ hoáº·c mÃ£ video TikTok.');
      return;
    }

    setShortUrlError(null);
    setIsShortPickerVisible(false);
    setShortUrlInput('');
    openVideoTarget(target);
  };

  // Chuyá»ƒn sang Video Short káº¿ tiáº¿p
  const handleNextShort = () => {
    webViewRef.current?.postMessage(JSON.stringify({ action: 'NEXT_SHORT' }));
  };

  // Quay láº¡i Video Short trÆ°á»›c
  const handlePrevShort = () => {
    webViewRef.current?.postMessage(JSON.stringify({ action: 'PREV_SHORT' }));
  };

  // LÆ°u tháº­t tá»« Ä‘ang tra vÃ o backend FSRS thay vÃ¬ chá»‰ hiá»ƒn thá»‹ thÃ´ng bÃ¡o giáº£ láº­p.
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

      setReviewRefreshToken((token) => token + 1);
      Alert.alert('Đã lưu', `Từ “${selectedWord}” đã được thêm vào bộ thẻ FSRS.`);
      handleCloseAndResume();
    } catch (error) {
      Alert.alert('Không thể lưu từ', error instanceof Error ? error.message : 'API Gateway chưa khả dụng.');
    } finally {
      setIsSavingWord(false);
    }
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
        barStyle="light-content"
        backgroundColor="#090D16"
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
              }
            }}
            renderShorts={() => (
              <ShortsScreen
                activeCue={activeCue}
                autoPauseEnabled={learningDisplayPreferences.autoPauseEnabled}
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
                subtitleError={subtitleError}
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
                onPrevShort={handlePrevShort}
                onReplayCue={handleReplayCue}
                onRetrySubtitles={() => {
                  if (!currentVideoIdRef.current) return;
                  setSubtitleError(null);
                  void fetchSubtitlesFromServer(currentVideoIdRef.current, currentPlatformRef.current);
                }}
                onSaveWord={handleSaveToSRS}
                onTranscriptCuePress={handleTranscriptCuePress}
                onTranscriptScroll={handleTranscriptScroll}
                onTranscriptScrollBegin={pauseTranscriptFollowing}
                onToggleAutoPause={() => updateLearningDisplayPreferences({
                  autoPauseEnabled: !learningDisplayPreferences.autoPauseEnabled,
                })}
                onViewportHeightChange={setShortsViewportHeight}
                onWordLongPress={learningDisplayPreferences.longPressCyclesCardLabel
                  ? handleCycleCardLabel
                  : undefined}
                onWordPress={handleWordPress}
              />
            )}
            renderExplore={() => (
              <ExploreScreen onOpenTarget={handleExploreTarget} />
            )}
            renderReview={() => (
              <ReviewScreen
                isActive={activeTab === 'review'}
                refreshToken={reviewRefreshToken}
                onDueCountChange={setSavedDueCount}
                onSavedItemsChange={setSavedItems}
                onReplayContext={handleReplayContext}
              />
            )}
            renderAccount={() => isSettingsOpen ? (
              <SettingsScreen
                preferences={learningDisplayPreferences}
                onChange={updateLearningDisplayPreferences}
                autoPauseEnabled={learningDisplayPreferences.autoPauseEnabled}
                onToggleAutoPause={() => updateLearningDisplayPreferences({
                  autoPauseEnabled: !learningDisplayPreferences.autoPauseEnabled,
                })}
                onBack={() => setIsSettingsOpen(false)}
              />
            ) : (
              <AccountScreen
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenOnboarding={() => navigationRef.navigate('Onboarding')}
                onLoginTikTok={handleOpenTikTokAccount}
                savedCount={savedItems.length}
                dueCount={savedDueCount}
              />
            )}
          />
        )}
      />

      {/* Bá»™ chá»n ná»n táº£ng vÃ  URL má»Ÿ video */}
      <PlatformPickerModal
        visible={isPlatformPickerVisible}
        currentPlatform={currentPlatform}
        onClose={closePlatformPicker}
        onSelectPlatform={handleSelectPlatform}
      />

      <ShortUrlPickerModal
        visible={isShortPickerVisible}
        platform={shortPickerPlatform}
        urlInput={shortUrlInput}
        error={shortUrlError}
        onClose={closeShortPicker}
        onOpen={handleOpenShortFromLink}
        onPlatformChange={(p) => {
          setShortPickerPlatform(p);
          setShortUrlError(null);
        }}
        onUrlChange={(val) => {
          setShortUrlInput(val);
          if (shortUrlError) setShortUrlError(null);
        }}
      />
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
});
