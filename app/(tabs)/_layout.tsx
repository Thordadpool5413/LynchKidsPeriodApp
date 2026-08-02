import React from 'react';
import { Tabs } from 'expo-router';
import { colors, fonts } from '@/theme';
import { GardenGlyph, type GardenGlyphName } from '@/components/garden-glyph';

const icon = (name: GardenGlyphName, color: string) => <GardenGlyph name={name} color={color} size={23} />;

export default function TabLayout() {
  return (
    <Tabs detachInactiveScreens screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.canvas },
      headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
      tabBarActiveTintColor: colors.lavender,
      tabBarInactiveTintColor: colors.inkMuted,
      tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: colors.line, height: 82, paddingTop: 7, paddingBottom: 16 },
      tabBarLabelStyle: { fontFamily: fonts.utility, fontSize: 11 },
      lazy: true,
      freezeOnBlur: true,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => icon('flower', color) }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color }) => icon('calendar', color) }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color }) => icon('journal', color) }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: ({ color }) => icon('learn', color) }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => icon('more', color) }} />
    </Tabs>
  );
}
