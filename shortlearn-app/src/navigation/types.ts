import { NavigatorScreenParams } from '@react-navigation/native';
import { VideoPlatform } from '../services/videoPlatform';

export type MainTab = 'shorts' | 'review' | 'account';

export type MainTabsParamList = {
  Shorts: { platform?: VideoPlatform; openPicker?: boolean } | undefined;
  Review: undefined;
  Account: { platform?: VideoPlatform } | undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  Otp: { email: string; purpose: 'signup' | 'password_reset' };
  ForgotPassword: undefined;
  Main: NavigatorScreenParams<MainTabsParamList> | undefined;
};
