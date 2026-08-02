import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { logError } from '@/src/services/logger';
import { instalarManejadorErroresGlobales } from '@/src/services/erroresGlobales';
import { ErrorBoundary as ErrorBoundaryApp } from '@/src/components/ErrorBoundary';

instalarManejadorErroresGlobales();

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  logError('ErrorBoundary', error);
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitulo}>Ups, algo salió mal</Text>
      <Text style={styles.errorMensaje}>{error?.message ?? 'Error desconocido al iniciar la app.'}</Text>
      <Pressable style={styles.errorBoton} onPress={retry}>
        <Text style={styles.errorBotonTexto}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (error) {
    logError('useFonts', error);
    return <RootLayoutNav />;
  }

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
      <SQLiteProvider
        databaseName="micajadigital.db"
        onInit={initDatabase}
        onError={(e) => logError('SQLiteProvider', e)}
      >
        <AuthProvider>
          <AccentProvider>
            <ErrorBoundaryApp>
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
            </ErrorBoundaryApp>
          </AccentProvider>
        </AuthProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  errorTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  errorMensaje: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBoton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  errorBotonTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
