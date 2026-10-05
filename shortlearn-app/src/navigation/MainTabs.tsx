import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomNavigation } from './BottomNavigation';
import { MainTab, MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

interface MainTabsProps {
  bottomNavigationVisible: boolean;
  dueCount: number;
  renderAccount: () => React.ReactElement;
  renderReview: () => React.ReactElement;
  renderShorts: () => React.ReactElement;
  onActiveTabChange: (tab: MainTab) => void;
  onBottomNavigationVisibleChange: (visible: boolean) => void;
  onTabPress: (tab: MainTab) => void;
}

export const MainTabs: React.FC<MainTabsProps> = ({
  bottomNavigationVisible,
  dueCount,
  renderAccount,
  renderReview,
  renderShorts,
  onActiveTabChange,
  onBottomNavigationVisibleChange,
  onTabPress,
}) => (
  <Tab.Navigator
    id="MainTabs"
    initialRouteName="Shorts"
    detachInactiveScreens={false}
    screenOptions={{
      headerShown: false,
      lazy: false,
      freezeOnBlur: false,
      animation: 'none',
    }}
    tabBar={({ state, navigation }) => {
      const routeName = state.routes[state.index]?.name;
      const activeTab: MainTab = routeName === 'Review'
        ? 'review'
        : routeName === 'Account'
          ? 'account'
          : 'shorts';

      const openTab = (tab: MainTab) => {
        onTabPress(tab);
        if (tab === 'review') navigation.navigate('Review');
        else if (tab === 'account') navigation.navigate('Account');
        else navigation.navigate('Shorts');
      };

      return (
        <BottomNavigation
          activeTab={activeTab}
          dueCount={dueCount}
          visible={bottomNavigationVisible}
          onHide={() => onBottomNavigationVisibleChange(false)}
          onShow={() => onBottomNavigationVisibleChange(true)}
          onOpenShorts={() => openTab('shorts')}
          onOpenReview={() => openTab('review')}
          onOpenAccount={() => openTab('account')}
        />
      );
    }}
  >
    <Tab.Screen
      name="Shorts"
      listeners={{ focus: () => onActiveTabChange('shorts') }}
    >
      {renderShorts}
    </Tab.Screen>
    <Tab.Screen
      name="Review"
      listeners={{ focus: () => onActiveTabChange('review') }}
    >
      {renderReview}
    </Tab.Screen>
    <Tab.Screen
      name="Account"
      listeners={{ focus: () => onActiveTabChange('account') }}
    >
      {renderAccount}
    </Tab.Screen>
  </Tab.Navigator>
);
