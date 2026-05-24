import { useEffect } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body, Caption } from '@/components/ui/typography';
import Reveal from '@/components/ui/reveal';
import { useAuthStore } from '@/stores/auth-store';

export default function VerifyScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const session = useAuthStore((s) => s.session);

  // When the magic-link deep link arrives, supabase fires onAuthStateChange →
  // auth store updates session → this effect navigates to tabs automatically.
  useEffect(() => {
    if (session) {
      router.replace('/(tabs)');
    }
  }, [session, router]);

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
  footer: { alignItems: 'center' },
});
