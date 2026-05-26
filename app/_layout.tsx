import 'react-native-url-polyfill/auto';

import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from '@expo-google-fonts/archivo';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { type Href, Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { nanoid } from 'nanoid/non-secure';
import { useEffect, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { client, db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { runMigrations } from '@/db/migrate-sync';
import { seedIfEmpty } from '@/db/seed';
import {
  configureNotificationHandler,
  ensureAndroidChannel,
  rescheduleAll,
  setupTapHandler,
} from '@/lib/notifications';
import { queryClient } from '@/lib/query-client';
import { storage, StorageKey } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { initConnectivityWatcher, syncNow, teardownConnectivityWatcher } from '@/lib/sync/engine';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';
import { QueryClientProvider } from '@tanstack/react-query';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <DbBootstrap />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function DbBootstrap() {
  const { colors } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await runMigrations(client, migrations);
        await seedIfEmpty();

        if (!storage.getString(StorageKey.APP_INSTALL_ID)) {
          storage.setString(StorageKey.APP_INSTALL_ID, nanoid(21));
        }

        if (!cancelled) setDbReady(true);
      } catch (e) {
        if (!cancelled) setInitError(e instanceof Error ? e : new Error(String(e)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const error = initError;
  if (error) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: colors.accent, marginBottom: 12, textAlign: 'center' }}>
          Failed to initialize database:{'\n'}
          {error.message}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setInitError(null);
            setRetryKey((k) => k + 1);
          }}
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dbReady) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { colors, mode } = useTheme();
  const scheme = useColorScheme();
  const router = useRouter();
  const completed = useOnboardingStore((s) => s.completed);
  const authStatus = useAuthStore((s) => s.status);

  // Hide splash and navigate once the app state resolves.
  // New users: hide immediately and send to onboarding.
  // Returning users: hide once auth finishes (idle/loading = still resolving).
  useEffect(() => {
    if (!completed) {
      void SplashScreen.hideAsync();
    } else if (authStatus !== 'idle' && authStatus !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [completed, authStatus]);

  // Safety net: always dismiss splash after 8 s regardless of state.
  useEffect(() => {
    const t = setTimeout(() => void SplashScreen.hideAsync(), 8_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(tokens.colors[mode].bg);
  }, [mode]);

  // Restore auth session from MMKV and subscribe to future changes
  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  // Configure expo-notifications handler and ensure Android channel exist
  useEffect(() => {
    configureNotificationHandler();
    void ensureAndroidChannel();
  }, []);

  // Detect timezone changes on app foreground and reschedule all reminders
  useEffect(() => {
    const checkTZ = () => {
      const currentTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const storedTZ = storage.getString(StorageKey.NOTIF_TZ);
      if (storedTZ !== currentTZ) {
        storage.setString(StorageKey.NOTIF_TZ, currentTZ);
        void rescheduleAll();
      }
    };

    checkTZ(); // also run on cold start / first mount

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') checkTZ();
    });
    return () => sub.remove();
  }, []);

  // Sync on app foreground (debounce 2s to let auth restore finish first)
  useEffect(() => {
    let foregroundTimer: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && authStatus === 'authenticated') {
        if (foregroundTimer) clearTimeout(foregroundTimer);
        foregroundTimer = setTimeout(() => void syncNow(), 2_000);
      }
    });

    return () => {
      sub.remove();
      if (foregroundTimer) clearTimeout(foregroundTimer);
    };
  }, [authStatus]);

  // Start connectivity watcher (offline→online auto-sync)
  useEffect(() => {
    initConnectivityWatcher();
    return () => teardownConnectivityWatcher();
  }, []);

  // Route to Today when user taps a habit-reminder notification (live + cold-start)
  useEffect(() => {
    return setupTapHandler(() => router.replace('/(tabs)/' as Href));
  }, [router]);

  // Handle magic-link deep links. Supabase v2 uses PKCE by default on native:
  // the email link redirects to dawnwell://auth/callback?code=xxx, and
  // exchangeCodeForSession trades the code for a session, firing onAuthStateChange
  // which the auth store picks up and navigates to tabs automatically.
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (supabase && url.includes('auth/callback')) {
        supabase.auth.exchangeCodeForSession(url).catch(() => {});
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    // Handle cold-start deep link (app opened directly from magic link email)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });
    return () => sub.remove();
  }, []);

  // Gate: redirect to onboarding if not completed yet
  useEffect(() => {
    if (!completed) {
      router.replace('/onboarding' as Href);
    }
  }, [completed, router]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(settings)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth/sign-in" />
        <Stack.Screen name="auth/verify" />
      </Stack>
    </>
  );
}
