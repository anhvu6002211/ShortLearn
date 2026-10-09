import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { completeOnboarding, hasCompletedOnboarding } from '../services/onboarding';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthStackProps {
  renderMain: () => React.ReactElement;
}

export const AuthStack: React.FC<AuthStackProps> = ({ renderMain }) => {
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding()
      .then((completed) => setShouldShowOnboarding(!completed))
      .finally(() => setIsOnboardingReady(true));
  }, []);

  if (!isOnboardingReady) return null;
  return (
    <Stack.Navigator
      id="AuthStack"
      initialRouteName={shouldShowOnboarding ? 'Onboarding' : 'Main'}
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Stack.Screen name="Onboarding">
        {({ navigation }) => (
          <OnboardingScreen onComplete={() => {
            void completeOnboarding().catch(() => {});
            navigation.replace('Main');
          }} />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Main">
        {renderMain}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
