import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Mở thanh điều hướng"
        onPress={() => setTimeout(onShow, 80)}
        style={[
          styles.restoreButton,
          activeTab === 'review' && styles.restoreButtonSaved,
        ]}
      >
        <Text style={[
          styles.restoreText,
          activeTab === 'review' && styles.restoreTextSaved,
        ]}>⌃  Menu</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.shell}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Ẩn thanh điều hướng"
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        onPress={onHide}
        style={[
          styles.closeButton,
          activeTab === 'review' && styles.closeButtonSaved,
        ]}
      >
        <Text style={[
          styles.closeText,
          activeTab === 'review' && styles.closeTextSaved,
        ]}>×</Text>
      </TouchableOpacity>

      <View style={[styles.nav, activeTab === 'review' && styles.navSaved]}>
        <TouchableOpacity
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Chọn nền tảng Shorts"
          onPress={onOpenShorts}
        >
          <Text style={[styles.navIcon, activeTab === 'shorts' && styles.navActive]}>🎬</Text>
          <Text style={[styles.navLabel, activeTab === 'shorts' && styles.navActive]}>Shorts</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} accessibilityRole="button" accessibilityLabel="Khám phá video" onPress={onOpenExplore}>
          <Text style={[styles.navIcon, activeTab === 'explore' && styles.navActive]}>⌕</Text>
          <Text style={[styles.navLabel, activeTab === 'explore' && styles.navActive]}>Khám phá</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={onOpenReview}>
          <View>
            <Text style={[
              styles.navIcon,
              activeTab === 'review' && styles.navActive,
              activeTab === 'review' && styles.navActiveSaved,
            ]}>🔖</Text>
            {dueCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{dueCount}</Text>
              </View>
            )}
          </View>
          <Text style={[
            styles.navLabel,
            activeTab === 'review' && styles.navActive,
            activeTab === 'review' && styles.navActiveSaved,
          ]}>Đã lưu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={onOpenAccount}>
          <Text style={[styles.navIcon, activeTab === 'account' && styles.navActive]}>👤</Text>
          <Text style={[styles.navLabel, activeTab === 'account' && styles.navActive]}>Cá nhân</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    zIndex: 100,
    elevation: 20,
    marginTop: -18,
    paddingTop: 18,
    overflow: 'visible',
  },
  nav: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  navSaved: { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0' },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 10,
    zIndex: 2,
    elevation: 21,
    width: 32,
    height: 24,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonSaved: { borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  closeText: { color: '#CBD5E1', fontSize: 20, lineHeight: 21, fontWeight: '600' },
  closeTextSaved: { color: '#475569' },
  restoreButton: {
    alignSelf: 'flex-end',
    minWidth: 76,
    height: 30,
    marginRight: 10,
    marginVertical: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreButtonSaved: { borderColor: '#D8DEE8', backgroundColor: '#FFFFFF' },
  restoreText: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
  restoreTextSaved: { color: '#475569' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { color: '#64748B', fontSize: 21, textAlign: 'center' },
  navLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 1 },
  navActive: { color: '#38BDF8' },
  navActiveSaved: { color: '#2563EB' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 17,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
