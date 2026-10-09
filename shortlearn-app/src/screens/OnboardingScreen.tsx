import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PAGES = [
  ['Học từ Shorts', 'Biến từng video YouTube hoặc TikTok thành một bài học ngắn.'],
  ['Hiểu ngay trong ngữ cảnh', 'Phụ đề song ngữ và tra từ tức thì giúp bạn không bỏ lỡ ý nghĩa.'],
  ['Nhớ lâu hơn', 'Lưu từ mới, sau đó ôn lại bằng lịch FSRS thông minh.'],
] as const;

export const OnboardingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [page, setPage] = useState(0);
  const [title, description] = PAGES[page];
  const isLast = page === PAGES.length - 1;
  return <View style={styles.screen}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Bỏ qua giới thiệu" onPress={onComplete} style={styles.skip}><Text style={styles.skipText}>Bỏ qua</Text></TouchableOpacity>
    <View style={styles.content}>
      <Text style={styles.eyebrow}>SHORTLEARN</Text><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text>
      <View style={styles.dots}>{PAGES.map((_, index) => <View key={index} style={[styles.dot, index === page && styles.dotActive]} />)}</View>
    </View>
    <TouchableOpacity accessibilityRole="button" onPress={() => isLast ? onComplete() : setPage(page + 1)} style={styles.primary}><Text style={styles.primaryText}>{isLast ? 'Bắt đầu học' : 'Tiếp tục'}</Text></TouchableOpacity>
  </View>;
};
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#090D16',padding:24,justifyContent:'space-between'}, skip:{alignSelf:'flex-end',padding:12},skipText:{color:'#94A3B8',fontWeight:'700'},content:{flex:1,justifyContent:'center'},eyebrow:{color:'#A78BFA',fontWeight:'900',letterSpacing:2,fontSize:12},title:{color:'#F8FAFC',fontSize:34,fontWeight:'900',marginTop:18},description:{color:'#CBD5E1',fontSize:17,lineHeight:26,marginTop:14},dots:{flexDirection:'row',gap:8,marginTop:34},dot:{width:8,height:8,borderRadius:4,backgroundColor:'#334155'},dotActive:{width:26,backgroundColor:'#8B5CF6'},primary:{backgroundColor:'#6D5BD0',borderRadius:14,minHeight:54,alignItems:'center',justifyContent:'center'},primaryText:{color:'#FFF',fontSize:16,fontWeight:'900'},
});
