import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { initDatabase } from '@/src/database/schema';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/src/context/AuthContext';
import { AccentProvider } from '@/src/context/AccentContext';
import { useSync } from '@/src/hooks/useSync';
import OfflineBanner from '@/src/components/OfflineBanner';
import SuscripcionGate from '@/src/components/SuscripcionGate';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function SyncInit() {
  useSync();
  return null;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="micajadigital.db" onInit={initDatabase}>
        <AuthProvider>
          <AccentProvider>
            <SyncInit />
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <OfflineBanner />
            <SuscripcionGate />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="tutorial" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AccentProvider>
        </AuthProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
