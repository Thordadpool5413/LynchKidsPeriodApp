import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors, fonts } from '@/theme';

const icon = (symbol: string, color: string) => <Text style={{ fontSize: 21, color }}>{symbol}</Text>;

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.canvas },
      headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
      tabBarActiveTintColor: colors.lavender,
      tabBarInactiveTintColor: colors.inkMuted,
      tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: colors.line, height: 82, paddingTop: 7, paddingBottom: 16 },
      tabBarLabelStyle: { fontFamily: fonts.utility, fontSize: 11 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => icon('🌸', color) }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color }) => icon('🗓️', color) }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color }) => icon('📖', color) }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: ({ color }) => icon('🌈', color) }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => icon('✨', color) }} />
    </Tabs>
  );
}
