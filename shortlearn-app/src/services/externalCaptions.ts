import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

export type ExternalCaptionsState = 'idle' | 'requesting_permission' | 'starting' | 'running' | 'stopped' | 'permission_denied' | 'model_missing' | 'blocked' | 'error';
export type ExternalCaptionsSource = 'none' | 'playback' | 'microphone';
export type ExternalCaptionsFilter = 'light' | 'balanced' | 'strong';
export interface ExternalCaptionEvent { text: string; generation: number; }
export interface ExternalWordEvent { word: string; context: string; generation: number; }
export interface ExternalCaptionsMetrics { lastInferenceMs?: number; lastRtf?: number; transcribedWindows?: number; droppedWindows?: number; duplicateCaptions?: number; filteredCaptions?: number; }
export interface ExternalCaptionsStatus { supported: boolean; overlayGranted: boolean; running: boolean; state: ExternalCaptionsState; source: ExternalCaptionsSource; filterLevel: ExternalCaptionsFilter; metrics: ExternalCaptionsMetrics; }
interface ExternalCaptionsNativeModule { getStatus(): Promise<ExternalCaptionsStatus>; requestOverlayPermission(): Promise<boolean>; start(): Promise<void>; startMicrophone(): Promise<void>; setFilterLevel(level: ExternalCaptionsFilter): Promise<void>; setTranslation(sourceText: string, translatedText: string, generation: number): Promise<void>; setLookupResult(word: string, meaning: string, generation: number): Promise<void>; setSaveResult(word: string, message: string, generation: number): Promise<void>; stop(): Promise<void>; }
const nativeModule = NativeModules.ExternalCaptions as ExternalCaptionsNativeModule | undefined;
function requireModule(): ExternalCaptionsNativeModule {
  if (Platform.OS !== 'android' || !nativeModule) throw new Error('Phụ đề ngoài ứng dụng chỉ khả dụng trong Android development build.');
  return nativeModule;
}
export const externalCaptions = {
  getStatus: (): Promise<ExternalCaptionsStatus> => requireModule().getStatus(), requestOverlayPermission: (): Promise<boolean> => requireModule().requestOverlayPermission(),
  start: (): Promise<void> => requireModule().start(), startMicrophone: (): Promise<void> => requireModule().startMicrophone(),
  setFilterLevel: (level: ExternalCaptionsFilter): Promise<void> => requireModule().setFilterLevel(level),
  setTranslation: (event: ExternalCaptionEvent, translatedText: string): Promise<void> => requireModule().setTranslation(event.text, translatedText, event.generation),
  setLookupResult: (event: ExternalWordEvent, meaning: string): Promise<void> => requireModule().setLookupResult(event.word, meaning, event.generation),
  setSaveResult: (event: ExternalWordEvent, message: string): Promise<void> => requireModule().setSaveResult(event.word, message, event.generation),
  subscribe: (listener: (event: ExternalCaptionEvent) => void) => DeviceEventEmitter.addListener('externalCaption', listener),
  subscribeWordLookup: (listener: (event: ExternalWordEvent) => void) => DeviceEventEmitter.addListener('externalWordLookup', listener),
  subscribeWordSave: (listener: (event: ExternalWordEvent) => void) => DeviceEventEmitter.addListener('externalWordSave', listener),
  stop: (): Promise<void> => requireModule().stop(),
};
