import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SubtitleCue } from '../utils/binarySearchSubtitles';

interface SubtitleOverlayProps {
  currentCue: SubtitleCue | null;
  onWordPress: (word: string, contextSentence: string) => void;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ currentCue, onWordPress }) => {
  if (!currentCue) {
    return null;
  }

  // Tách câu tiếng Anh thành từng từ riêng biệt để người dùng có thể chạm vào
  const words = currentCue.en_text.split(/(\s+)/);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.card}>
        {/* Dòng Tiếng Anh tương tác từng từ */}
        <View style={styles.englishSentenceContainer}>
          {words.map((item, index) => {
            const isWhitespace = /^\s+$/.test(item);
            if (isWhitespace) {
              return <Text key={`space-${index}`} style={styles.spaceText}> </Text>;
            }

            // Loại bỏ dấu câu quanh từ khi bấm
            const cleanWord = item.replace(/^[^\w]+|[^\w]+$/g, '');

            return (
              <TouchableOpacity
                key={`word-${index}`}
                activeOpacity={0.6}
                onPress={() => onWordPress(cleanWord, currentCue.en_text)}
                style={styles.wordButton}
              >
                <Text style={styles.wordText}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dòng Tiếng Việt mờ bên dưới */}
        <Text style={styles.vietnameseText}>{currentCue.vi_text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)', // Dark Slate Glassmorphism
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxWidth: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  englishSentenceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  wordButton: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 4,
  },
  wordText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  spaceText: {
    fontSize: 18,
  },
  vietnameseText: {
    color: '#FDE047', // Vàng nhạt dễ đọc trên nền tối
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.95,
  },
});
