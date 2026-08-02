import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts as useFredoka, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { useFonts as useNunito, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AppStoreProvider } from '@/store/app-store';
import { colors } from '@/theme';

export default function RootLayout() {
  const [fredokaLoaded] = useFredoka({ Fredoka_600SemiBold, Fredoka_700Bold });
  const [nunitoLoaded] = useNunito({ Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold });
  if (!fredokaLoaded || !nunitoLoaded) return null;

  return (
    <AppStoreProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plus" options={{ title: 'Glitter Plus', presentation: 'modal' }} />
        <Stack.Screen name="ask-bloom" options={{ title: 'Ask Glitter' }} />
        <Stack.Screen name="care-request" options={{ title: 'Ask my grown-up', presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.85, 1] }} />
        <Stack.Screen name="calendar-day" options={{ title: 'Edit a day', presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.75, 1] }} />
        <Stack.Screen name="activities" options={{ title: 'Garden activities' }} />
        <Stack.Screen name="self-care" options={{ title: 'Self-Care Studio' }} />
        <Stack.Screen name="achievements" options={{ title: 'Sticker garden' }} />
        <Stack.Screen name="school-kit" options={{ title: 'School confidence kit' }} />
        <Stack.Screen name="parent" options={{ title: 'Grown-up space' }} />
        <Stack.Screen name="privacy" options={{ title: 'Your privacy' }} />
      </Stack>
    </AppStoreProvider>
  );
}
