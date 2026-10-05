import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthPlaceholderScreen: React.FC = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderTitle}>ShortLearn</Text>
    <Text style={styles.placeholderText}>Luồng xác thực đang được kết nối với backend.</Text>
  </View>
);

interface AuthStackProps {
  renderMain: () => React.ReactElement;
}

export const AuthStack: React.FC<AuthStackProps> = ({ renderMain }) => (
  <Stack.Navigator
    id="AuthStack"
    initialRouteName="Main"
    screenOptions={{ headerShown: false, animation: 'none' }}
  >
    <Stack.Screen name="SignIn" component={AuthPlaceholderScreen} />
    <Stack.Screen name="SignUp" component={AuthPlaceholderScreen} />
    <Stack.Screen name="Otp" component={AuthPlaceholderScreen} />
    <Stack.Screen name="ForgotPassword" component={AuthPlaceholderScreen} />
    <Stack.Screen name="Main">
      {renderMain}
    </Stack.Screen>
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '900' },
  placeholderText: { color: '#94A3B8', fontSize: 14, marginTop: 10, textAlign: 'center' },
});
