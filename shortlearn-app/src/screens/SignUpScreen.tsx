import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiRequest, getApiError } from '../services/api';
import { AuthStackParamList } from '../navigation/types';

type AuthNav = NativeStackNavigationProp<AuthStackParamList>;
export const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<AuthNav>();
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!email.trim() || !password) return setError('Vui lòng nhập email và mật khẩu.');
    setBusy(true); setError(null);
    try {
      const response = await apiRequest('/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email:email.trim(), password, display_name:name.trim() || undefined }) }, 8000);
      if (!response.ok) return setError(await getApiError(response));
      const payload = await response.json();
      navigation.replace('Otp', { email: email.trim(), purpose: 'signup', challengeId: payload.verification?.challenge_id });
    } catch { setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.container}>
    <Text style={styles.title}>Tạo tài khoản</Text><Text style={styles.subtitle}>Lưu từ mới và đồng bộ tiến độ học của bạn.</Text>
    <TextInput style={styles.input} placeholder="Tên hiển thị (tuỳ chọn)" placeholderTextColor="#64748B" value={name} onChangeText={setName}/>
    <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748B" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
    <TextInput style={styles.input} placeholder="Mật khẩu" placeholderTextColor="#64748B" secureTextEntry value={password} onChangeText={setPassword}/>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <TouchableOpacity accessibilityRole="button" style={[styles.primary,busy&&styles.disabled]} onPress={submit} disabled={busy}>{busy?<ActivityIndicator color="#FFF"/>:<Text style={styles.primaryText}>Đăng ký</Text>}</TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={()=>navigation.navigate('SignIn')} style={styles.link}><Text style={styles.linkText}>Đã có tài khoản? Đăng nhập</Text></TouchableOpacity>
  </View></KeyboardAvoidingView>;
};
const styles=StyleSheet.create({flex:{flex:1},container:{flex:1,backgroundColor:'#090D16',padding:24,justifyContent:'center'},title:{color:'#F8FAFC',fontSize:30,fontWeight:'900',textAlign:'center'},subtitle:{color:'#94A3B8',fontSize:15,textAlign:'center',marginTop:8,marginBottom:28},input:{backgroundColor:'#111827',borderWidth:1,borderColor:'rgba(148,163,184,.25)',borderRadius:12,paddingHorizontal:14,paddingVertical:12,color:'#F8FAFC',fontSize:15,marginBottom:12},error:{color:'#FCA5A5',fontSize:13,marginBottom:12,textAlign:'center'},primary:{backgroundColor:'#6D5BD0',borderRadius:12,minHeight:48,alignItems:'center',justifyContent:'center',marginTop:4},primaryText:{color:'#FFF',fontSize:16,fontWeight:'800'},disabled:{opacity:.6},link:{alignItems:'center',paddingVertical:16},linkText:{color:'#A78BFA',fontWeight:'700'}});
