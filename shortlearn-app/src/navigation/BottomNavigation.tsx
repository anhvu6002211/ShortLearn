import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, touchTarget, typography } from '../styles/theme';
import { MainTab } from './types';

interface BottomNavigationProps {
  activeTab: MainTab;
  dueCount: number;
  visible: boolean;
  onHide: () => void;
  onShow: () => void;
  onOpenShorts: () => void;
  onOpenExplore: () => void;
  onOpenReview: () => void;
  onOpenAccount: () => void;
}

type TabItem = {
  key: MainTab;
  label: string;
  icon: string;
  onPress: () => void;
};

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  dueCount,
  visible,
  onHide,
  onShow,
  onOpenShorts,
  onOpenExplore,
  onOpenReview,
  onOpenAccount,
}) => {
  if (!visible) {
    return (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mở thanh điều hướng" onPress={() => setTimeout(onShow, 80)} style={styles.restoreButton}>
        <Text style={styles.restoreText}>⌃  Menu</Text>
      </TouchableOpacity>
    );
  }

  const tabs: TabItem[] = [
    { key: 'shorts', label: 'Shorts', icon: '◉', onPress: onOpenShorts },
    { key: 'explore', label: 'Khám phá', icon: '⌕', onPress: onOpenExplore },
    { key: 'review', label: 'Ôn tập', icon: '▣', onPress: onOpenReview },
    { key: 'account', label: 'Cá nhân', icon: '◎', onPress: onOpenAccount },
  ];

  return (
    <View style={styles.shell}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ẩn thanh điều hướng" hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }} onPress={onHide} style={styles.closeButton}>
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>
      <View style={styles.nav}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              onPress={tab.onPress}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <View style={styles.iconWrap}>
                <Text style={[styles.navIcon, active && styles.navActive]}>{tab.icon}</Text>
                {tab.key === 'review' && dueCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{dueCount}</Text></View> : null}
              </View>
              <Text style={[styles.navLabel, active && styles.navActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: { position: 'relative', zIndex: 100, elevation: 20, marginTop: -14, paddingTop: 14, overflow: 'visible' },
  nav: { flexDirection: 'row', backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.primaryBorder, paddingVertical: 10, paddingHorizontal: 10, minHeight: 72 },
  closeButton: { position: 'absolute', top: 0, right: 13, zIndex: 2, elevation: 21, minWidth: touchTarget, minHeight: touchTarget, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.borderStrong, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textMuted, fontSize: 19, lineHeight: 21, fontWeight: '700' },
  restoreButton: { alignSelf: 'flex-end', minWidth: 78, minHeight: touchTarget, marginRight: 12, marginVertical: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  restoreText: { color: colors.textMuted, fontSize: typography.label, fontWeight: '800' },
  navItem: { flex: 1, minHeight: 52, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center' },
  navItemActive: { backgroundColor: 'rgba(56,189,248,0.18)', borderWidth: 1, borderColor: colors.primaryBorder },
  iconWrap: { minWidth: 28, minHeight: 27, alignItems: 'center', justifyContent: 'center' },
  navIcon: { color: colors.textMuted, fontSize: 24, textAlign: 'center', lineHeight: 27, fontWeight: '800' },
  navLabel: { color: colors.textMuted, fontSize: typography.label, fontWeight: '900', marginTop: 3 },
  navActive: { color: colors.primaryLight },
  badge: { position: 'absolute', top: -7, right: -15, minWidth: 19, paddingHorizontal: 4, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: colors.vietnamese, alignItems: 'center', borderWidth: 2, borderColor: colors.canvas },
  badgeText: { color: '#2A1700', fontSize: 10, fontWeight: '900' },
});
