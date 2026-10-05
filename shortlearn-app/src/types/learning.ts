export type LearningStage = 'known' | 'learning' | 'later';

export type CardLabelColor = 'red' | 'green' | 'yellow' | 'blue';

export interface WordLearningState {
  learningStage?: LearningStage | null;
  cardLabel?: CardLabelColor | null;
}

export const LEARNING_STAGE_LABELS: Record<LearningStage, string> = {
  known: 'Đã biết',
  learning: 'Đang học',
  later: 'Để sau',
};

export const CARD_LABEL_COLORS: Record<CardLabelColor, string> = {
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#EAB308',
  blue: '#3B82F6',
};
