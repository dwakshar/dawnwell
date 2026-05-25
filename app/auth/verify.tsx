import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body, Caption } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import Reveal from '@/components/ui/reveal';
import { useAuthStore } from '@/stores/auth-store';

const RESEND_COOLDOWN_S = 30;

export default function VerifyScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const session = useAuthStore((s) => s.session);
  const { sendStatus, signInWithMagicLink } = useAuthStore();

  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // When the magic-link deep link arrives, supabase fires onAuthStateChange →
  // auth store updates session → this effect navigates to tabs automatically.
  useEffect(() => {
    if (session) {
      router.replace('/(tabs)');
    }
  }, [session, router]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_S);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    if (!email || cooldown > 0 || sendStatus === 'sending') return;
    await signInWithMagicLink(email);
    startCooldown();
  }

  function handleOpenMailApp() {
    Linking.openURL('mailto:').catch(() => {});
  }

  const resendLabel =
    sendStatus === 'sending'
      ? 'Sending…'
      : cooldown > 0
        ? `Resend in ${cooldown}s`
        : 'Resend link';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing[6] }]}>
        <Reveal direction="up" delay={0}>
          <Title style={styles.headline}>Check your{'\n'}email.</Title>
        </Reveal>
        <Reveal direction="up" delay={100}>
          <Body color="ink-soft">
            We sent a magic link to{' '}
            <Body style={{ fontFamily: 'Inter_600SemiBold', color: colors.ink }}>{email}</Body>
            {'. '}Tap it on this device to sign in.
          </Body>
        </Reveal>

        <Reveal direction="fade" delay={200}>
          <View style={[styles.waitingRow, { borderColor: colors.hairline }]}>
            <ActivityIndicator size="small" color={colors['ink-mute']} />
            <Caption color="ink-mute">Waiting for you to tap the link…</Caption>
          </View>
        </Reveal>

        <Reveal direction="up" delay={300}>
          <View style={styles.actions}>
            <Button
              variant="primary"
              size="md"
              fullWidth
              onPress={handleOpenMailApp}
              accessibilityLabel="Open mail app"
            >
              Open mail app
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              disabled={cooldown > 0 || sendStatus === 'sending'}
              loading={sendStatus === 'sending'}
              onPress={handleResend}
              accessibilityLabel={resendLabel}
            >
              {resendLabel}
            </Button>
          </View>
        </Reveal>
      </View>

      <View style={[styles.footer, { paddingHorizontal: spacing[6], paddingBottom: spacing[6] }]}>
        <Pressable
          accessibilityLabel="Use a different email address"
          accessibilityRole="button"
          onPress={() => router.back()}
        >
          <Caption color="ink-mute" align="center">
            Use a different email
          </Caption>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: 28 },
  headline: { fontSize: 34, lineHeight: 42 },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  actions: { gap: 12 },
  footer: { alignItems: 'center' },
});
