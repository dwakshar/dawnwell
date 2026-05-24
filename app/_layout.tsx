import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { nanoid } from 'nanoid/non-secure';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedIfEmpty } from '@/db/seed';
import { storage, StorageKey } from '@/lib/storage';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_700Bold,
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
    <ThemeProvider>
      <DbBootstrap />
    </ThemeProvider>
  );
}

function DbBootstrap() {
  const { success: migrationsOk, error: migrationError } = useMigrations(db, migrations);
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!migrationsOk) return;

    let cancelled = false;
    (async () => {
      try {
        await seedIfEmpty();

        if (!storage.getString(StorageKey.APP_INSTALL_ID)) {
          storage.setString(StorageKey.APP_INSTALL_ID, nanoid(21));
        }

        if (!cancelled) setDbReady(true);
      } catch (e) {
        if (!cancelled) setInitError(e instanceof Error ? e : new Error(String(e)));
      }
    })();

    return () => { cancelled = true; };
  }, [migrationsOk, retryKey]);

  const error = migrationError ?? initError;
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: '#c2410c', marginBottom: 12, textAlign: 'center' }}>
          Failed to initialize database:{'\n'}{error.message}
        </Text>
        <TouchableOpacity
          onPress={() => { setInitError(null); setRetryKey((k) => k + 1); }}
          style={{
            backgroundColor: '#c2410c',
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

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(tokens.colors[mode].bg);
  }, [mode]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
