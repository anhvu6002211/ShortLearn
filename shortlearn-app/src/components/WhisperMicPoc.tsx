import React, { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import { initWhisper, WhisperContext } from 'whisper.rn/index';
import { RealtimeTranscriber } from 'whisper.rn/realtime-transcription/index';
import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter';
import type { RealtimeTranscribeEvent } from 'whisper.rn/realtime-transcription/types';
import { colors, radii, spacing, typography } from '../styles/theme';

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin';
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/ggml-tiny.bin`;
type PocStatus = 'idle' | 'downloading' | 'loading' | 'listening' | 'stopping' | 'error';

interface WhisperMicPocProps {
  compact?: boolean;
}

export const WhisperMicPoc: React.FC<WhisperMicPocProps> = ({ compact = false }) => {
  const [status, setStatus] = useState<PocStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const contextRef = useRef<WhisperContext | null>(null);
  const transcriberRef = useRef<RealtimeTranscriber | null>(null);

  const stop = async () => {
    if (status !== 'listening') return;
    setStatus('stopping');
    try {
      await transcriberRef.current?.stop();
      await contextRef.current?.release();
      transcriberRef.current = null;
      contextRef.current = null;
      setStatus('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus('error');
    }
  };

  useEffect(() => () => {
    void transcriberRef.current?.stop();
    void contextRef.current?.release();
  }, []);

  const start = async () => {
    setError('');
    setText('');
    try {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Cần quyền microphone để thử nghiệm.');
      }
      if (!(await RNFS.exists(MODEL_PATH))) {
        setStatus('downloading');
        const download = RNFS.downloadFile({
          fromUrl: MODEL_URL,
          toFile: MODEL_PATH,
          progressDivider: 2,
          progress: ({ bytesWritten, contentLength }) => contentLength > 0 && setProgress(Math.round((bytesWritten / contentLength) * 100)),
        });
        const result = await download.promise;
        if (result.statusCode < 200 || result.statusCode >= 300) throw new Error(`Tải model thất bại: HTTP ${result.statusCode}`);
      }
      setStatus('loading');
      const context = await initWhisper({ filePath: `file://${MODEL_PATH}` });
      contextRef.current = context;
      const transcriber = new RealtimeTranscriber(
        { whisperContext: context, audioStream: new AudioPcmStreamAdapter(), fs: RNFS },
        { audioSliceSec: 8, realtimeProcessingPauseMs: 500, initRealtimeAfterMs: 1000, transcribeOptions: { language: 'auto', maxThreads: 4 } },
        {
          onTranscribe: (event: RealtimeTranscribeEvent) => {
            const result = event.data?.result?.trim();
            if (result) setText(result);
          },
          onError: (cause: string) => {
            setError(cause);
            setStatus('error');
          },
        },
      );
      transcriberRef.current = transcriber;
      await transcriber.start();
      setStatus('listening');
    } catch (cause) {
      await contextRef.current?.release();
      contextRef.current = null;
      transcriberRef.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus('error');
    }
  };

  const busy = status === 'downloading' || status === 'loading' || status === 'stopping';
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      {!compact && <Text style={styles.title}>POC phụ đề qua microphone</Text>}
      {!compact && <Text style={styles.copy}>Whisper tiny đa ngôn ngữ chạy offline. Model khoảng 75 MB, chỉ tải khi bắt đầu.</Text>}
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {status === 'downloading' ? `Đang tải model ${progress}%` : status === 'loading' ? 'Đang nạp model…' : status === 'listening' ? 'Mic đang nghe' : status === 'stopping' ? 'Đang dừng…' : compact ? 'Phụ đề mic đang tắt' : 'Sẵn sàng'}
      </Text>
      {!!text && <Text selectable style={[styles.result, compact && styles.compactResult]}>{text}</Text>}
      {!!error && <Text selectable style={styles.error}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={status === 'listening' ? 'Tắt phụ đề microphone' : 'Bật phụ đề microphone'} disabled={busy} onPress={status === 'listening' ? stop : start} style={[styles.button, compact && styles.compactButton, busy && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{status === 'listening' ? 'Tắt mic' : 'Bật mic'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  compactCard: { backgroundColor: 'rgba(9,13,22,0.92)', padding: spacing.sm, borderColor: colors.primaryBorder },
  title: { color: colors.text, fontSize: typography.bodyMedium, fontWeight: '900' },
  copy: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  status: { color: colors.primaryLight, fontSize: 12, fontWeight: '800', marginTop: spacing.md },
  result: { color: colors.text, fontSize: typography.bodyMedium, lineHeight: 22, marginTop: spacing.md },
  compactResult: { fontSize: 18, lineHeight: 24, textAlign: 'center', fontWeight: '800', marginTop: spacing.sm },
  error: { color: '#fb7185', fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  button: { minHeight: 48, marginTop: spacing.md, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  compactButton: { minHeight: 40, marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: typography.bodyMedium, fontWeight: '900' },
});
