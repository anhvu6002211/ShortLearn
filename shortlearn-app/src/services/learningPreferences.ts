import * as SecureStore from 'expo-secure-store';

export interface LearningDisplayPreferences {
  colorizeByLearningStage: boolean;
  showCardLabelUnderlines: boolean;
  longPressCyclesCardLabel: boolean;
  knownVocabularySize: number;
}

const STORAGE_KEY = 'shortlearn.learning-display-preferences.v1';

export const DEFAULT_LEARNING_DISPLAY_PREFERENCES: LearningDisplayPreferences = {
  colorizeByLearningStage: true,
  showCardLabelUnderlines: true,
  longPressCyclesCardLabel: false,
  knownVocabularySize: 3_000,
};

const normalizePreferences = (value: unknown): LearningDisplayPreferences => {
  if (!value || typeof value !== 'object') return DEFAULT_LEARNING_DISPLAY_PREFERENCES;
  const stored = value as Partial<LearningDisplayPreferences>;
  const vocabularySize = Number(stored.knownVocabularySize);

  return {
    colorizeByLearningStage: stored.colorizeByLearningStage !== false,
    showCardLabelUnderlines: stored.showCardLabelUnderlines !== false,
    longPressCyclesCardLabel: stored.longPressCyclesCardLabel === true,
    knownVocabularySize: [1_000, 3_000, 5_000, 10_000].includes(vocabularySize)
      ? vocabularySize
      : DEFAULT_LEARNING_DISPLAY_PREFERENCES.knownVocabularySize,
  };
};

export const loadLearningDisplayPreferences = async (): Promise<LearningDisplayPreferences> => {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    return stored ? normalizePreferences(JSON.parse(stored)) : DEFAULT_LEARNING_DISPLAY_PREFERENCES;
  } catch {
    return DEFAULT_LEARNING_DISPLAY_PREFERENCES;
  }
};

export const saveLearningDisplayPreferences = async (
  preferences: LearningDisplayPreferences,
): Promise<void> => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
};
