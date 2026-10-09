import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'shortlearn.onboarding.completed.v1';

export const hasCompletedOnboarding = async (): Promise<boolean> => {
  try { return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'true'; } catch { return false; }
};

export const completeOnboarding = async (): Promise<void> => {
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
};
