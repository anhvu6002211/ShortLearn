import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  Modal,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { INJECTED_SHORTS_JAVASCRIPT } from './src/injected_script';
import { SubtitleOverlay } from './src/components/SubtitleOverlay';
import { findSubtitleCue, SubtitleCue } from './src/utils/binarySearchSubtitles';
import { FlashcardReview, DueCard } from './src/components/FlashcardReview';
import { Rating } from './src/utils/srsAlgorithm';

// Địa chỉ IP của máy tính host chạy API Gateway
// 10.0.2.2 cho Android Emulator; khi test trên điện thoại thật thì đổi thành IP LAN máy (ví dụ 192.168.1.x)
const API_BASE_URL = 'http://10.0.2.2:5000/api/v1';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const videoCounterRef = useRef<number>(0);

  // Tab điều hướng: 'shorts' (Xem video) hoặc 'review' (Ôn tập Flashcard)
  const [activeTab, setActiveTab] = useState<'shorts' | 'review'>('shorts');

  // Trạng thái Video Shorts
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState<boolean>(false);

  // Trạng thái Popup từ vựng
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [contextSentence, setContextSentence] = useState<string>('');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isSavingWord, setIsSavingWord] = useState<boolean>(false);

  // Trạng thái Flashcard SRS (FSRS v5)
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [isLoadingDueCards, setIsLoadingDueCards] = useState<boolean>(false);

  // Tải danh sách thẻ cần ôn hôm nay
  const fetchDueCards = useCallback(async () => {
    try {
      setIsLoadingDueCards(true);
      const res = await fetch(`${API_BASE_URL}/vocabulary/due?user_id=1`);
      if (res.ok) {
        const data = await res.json();
        setDueCards(data.cards || []);
      }
    } catch (err) {
      console.warn('Lỗi khi tải danh sách từ vựng cần ôn:', err);
    } finally {
      setIsLoadingDueCards(false);
    }
  }, []);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  // Khi video thay đổi, gọi API Gateway lấy phụ đề
  const fetchSubtitles = async (videoId: string) => {
    try {
      setIsLoadingSubtitles(true);
      const res = await fetch(`${API_BASE_URL}/subtitles/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, platform: 'youtube' }),
      });

      const data = await res.json();
      if (data.status === 'READY' && data.data) {
        setSubtitles(data.data);
      } else {
        // Video đang xử lý AI: Set subtitle rỗng
        setSubtitles([]);
      }
    } catch (err) {
      console.warn('API Gateway connection error:', err);
    } finally {
      setIsLoadingSubtitles(false);
    }
  };

  // Đánh chặn message từ WebView (injected_script.js)
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'VIDEO_CHANGED') {
        setCurrentVideoId(data.videoId);
        setActiveCue(null);
        fetchSubtitles(data.videoId);

        // V2: Kích hoạt DOM Garbage Collection định kỳ sau mỗi 10 video
        videoCounterRef.current += 1;
        if (videoCounterRef.current % 10 === 0) {
          webViewRef.current?.postMessage(JSON.stringify({ action: 'GC_DOM' }));
        }
      } else if (data.type === 'TIME_UPDATE') {
        const time = data.currentTime;
        const matched = findSubtitleCue(subtitles, time);
        setActiveCue(matched);
      }
    } catch (e) {
      // Bỏ qua lỗi parse
    }
  };

  // Tạm dừng video và mở Modal tra từ
  const handleWordPress = (word: string, sentence: string) => {
    if (!word) return;

    // Gửi lệnh Pause về WebView
    webViewRef.current?.postMessage(JSON.stringify({ action: 'PAUSE_VIDEO' }));

    setSelectedWord(word);
    setContextSentence(sentence);
    setIsModalVisible(true);
  };

  // Đóng Modal và tiếp tục phát video
  const closeModalAndResume = () => {
    setIsModalVisible(false);
    webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
  };

  // Lưu từ vựng vào SRS
  const handleSaveToSRS = async () => {
    try {
      setIsSavingWord(true);
      const res = await fetch(`${API_BASE_URL}/vocabulary/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1,
          word: selectedWord,
          meaning: `Nghĩa của "${selectedWord}" trong ngữ cảnh`,
          context_sentence: contextSentence,
          video_id: currentVideoId,
          timestamp_mark: activeCue?.start_time || 0,
        }),
      });

      if (res.ok) {
        Alert.alert('Thành công', `Đã thêm từ "${selectedWord}" vào danh sách ôn tập FSRS v5!`);
        closeModalAndResume();
        fetchDueCards(); // Cập nhật lại số thẻ cần ôn
      } else {
        Alert.alert('Lỗi', 'Không thể lưu từ vựng lúc này.');
      }
    } catch (error) {
      Alert.alert('Lỗi mạng', 'Không thể kết nối đến API Gateway.');
    } finally {
      setIsSavingWord(false);
    }
  };

  // Xử lý chấm điểm thẻ FSRS v5 từ màn hình Flashcard
  const handleRateCard = async (card: DueCard, rating: Rating) => {
    try {
      await fetch(`${API_BASE_URL}/vocabulary/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1,
          word: card.word,
          rating: rating,
        }),
      });
    } catch (err) {
      console.warn('Lỗi khi gửi kết quả ôn tập lên server:', err);
    }
  };

  // Nghe lại đoạn Shorts trong ngữ cảnh (-2s) từ màn hình Flashcard
  const handleReplayContext = (videoId: string, timestamp: number) => {
    setActiveTab('shorts');
    const targetTime = Math.max(0, timestamp - 2);

    // Nếu đang ở cùng video, chỉ cần seek time
    if (videoId === currentVideoId) {
      webViewRef.current?.postMessage(JSON.stringify({ action: 'SEEK_TO', time: targetTime }));
      webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
    } else {
      // Nếu là video khác, chuyển hướng WebView
      const newUrl = `https://m.youtube.com/shorts/${videoId}`;
      webViewRef.current?.injectJavaScript(`
        location.href = '${newUrl}';
        setTimeout(() => {
          const v = document.querySelector('video');
          if (v) { v.currentTime = ${targetTime}; v.play(); }
        }, 1200);
        true;
      `);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Màn hình Shorts Feed */}
      <View style={[styles.mainView, activeTab !== 'shorts' && styles.hiddenView]}>
        <View style={styles.container}>
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://m.youtube.com/shorts' }}
            userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            injectedJavaScriptBeforeContentLoaded={INJECTED_SHORTS_JAVASCRIPT}
            onMessage={handleMessage}
            style={styles.webView}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowsBackForwardNavigationGestures
          />

          {/* Lớp phụ đề song ngữ hiển thị đè lên video */}
          <SubtitleOverlay
            currentCue={activeCue}
            onWordPress={handleWordPress}
          />

          {/* Loading Indicator nhỏ khi đang tải phụ đề */}
          {isLoadingSubtitles && (
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text style={styles.loadingText}>Đang dịch AI...</Text>
            </View>
          )}

          {/* Modal tra từ vựng & Lưu Flashcard */}
          <Modal
            visible={isModalVisible}
            transparent
            animationType="slide"
            onRequestClose={closeModalAndResume}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalContent}>
                <Text style={styles.modalWord}>{selectedWord}</Text>
                <Text style={styles.modalContextLabel}>Ngữ cảnh trong video:</Text>
                <Text style={styles.modalSentence}>"{contextSentence}"</Text>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={handleSaveToSRS}
                    disabled={isSavingWord}
                  >
                    {isSavingWord ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>⭐ Lưu vào Flashcard FSRS</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.closeButton]}
                    onPress={closeModalAndResume}
                  >
                    <Text style={styles.closeButtonText}>Đóng & Tiếp tục</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>

      {/* Màn hình Ôn tập Flashcard (FSRS v5) */}
      {activeTab === 'review' && (
        <View style={styles.mainView}>
          <FlashcardReview
            cards={dueCards}
            isLoading={isLoadingDueCards}
            onRefresh={fetchDueCards}
            onRateCard={handleRateCard}
            onReplayContext={handleReplayContext}
          />
        </View>
      )}

      {/* Thanh Điều Hướng Dưới Cùng (Bottom Navigation Bar) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'shorts' && styles.navItemActive]}
          onPress={() => {
            setActiveTab('shorts');
            webViewRef.current?.postMessage(JSON.stringify({ action: 'RESUME_VIDEO' }));
          }}
        >
          <Text style={[styles.navIcon, activeTab === 'shorts' && styles.navIconActive]}>🎬</Text>
          <Text style={[styles.navLabel, activeTab === 'shorts' && styles.navLabelActive]}>Shorts Feed</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'review' && styles.navItemActive]}
          onPress={() => {
            setActiveTab('review');
            webViewRef.current?.postMessage(JSON.stringify({ action: 'PAUSE_VIDEO' }));
            fetchDueCards();
          }}
        >
          <View style={styles.navIconContainer}>
            <Text style={[styles.navIcon, activeTab === 'review' && styles.navIconActive]}>🧠</Text>
            {dueCards.length > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{dueCards.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navLabel, activeTab === 'review' && styles.navLabelActive]}>Ôn tập SRS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mainView: {
    flex: 1,
  },
  hiddenView: {
    display: 'none',
  },
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingBadge: {
    position: 'absolute',
    top: 20,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10000,
  },
  loadingText: {
    color: '#38BDF8',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalWord: {
    color: '#38BDF8',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  modalContextLabel: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  modalSentence: {
    color: '#F8FAFC',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 20,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  closeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#475569',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  closeButtonText: {
    color: '#CBD5E1',
    fontWeight: '600',
    fontSize: 15,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navItemActive: {},
  navIconContainer: {
    position: 'relative',
  },
  navIcon: {
    fontSize: 22,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  navLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
});
