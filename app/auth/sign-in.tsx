import { useState } from 'react';
import { View, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body, Caption } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Reveal from '@/components/ui/reveal';
import { useAuthStore } from '@/stores/auth-store';
import { isValidEmail } from '@/lib/validators';
import * as haptics from '@/lib/haptics';

export default function SignInScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { sendStatus, sendError, signInWithMagicLink } = useAuthStore();
  const [email, setEmail] = useState('');

  const canSubmit = isValidEmail(email) && sendStatus !== 'sending';

  async function handleSend() {
    if (!canSubmit) return;
    await signInWithMagicLink(email.trim().toLowerCase());
    if (useAuthStore.getState().sendStatus === 'sent') {
      await haptics.success();
      router.push({ pathname: '/auth/verify', params: { email: email.trim().toLowerCase() } });
    } else {
      await haptics.error();
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.content, { paddingHorizontal: spacing[6] }]}>
          <Reveal direction="up" delay={0}>
            <Title style={styles.headline}>Sign in to sync{'\n'}across devices.</Title>
          </Reveal>
          <Reveal direction="up" delay={100}>
            <Body color="ink-soft" style={styles.subhead}>
              Dawnwell works fully offline. Sign in only when you want your rituals on more than one
              device.
            </Body>
          </Reveal>

          <Reveal direction="up" delay={180}>
            <View style={{ gap: 16 }}>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                label="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={handleSend}
                error={sendError && sendStatus === 'error' ? sendError : undefined}
              />
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={sendStatus === 'sending'}
                disabled={!canSubmit}
                accessibilityLabel="Send magic link to email address"
                onPress={handleSend}
              >
                Send magic link
              </Button>
            </View>
          </Reveal>
        </View>

        <View style={[styles.footer, { paddingHorizontal: spacing[6], paddingBottom: spacing[6] }]}>
          <Pressable
            accessibilityLabel="Skip sign in and use app offline"
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
          >
            <Caption color="ink-mute" align="center">
              Skip for now
            </Caption>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: 24 },
  headline: { fontSize: 34, lineHeight: 42 },
  subhead: { lineHeight: 26 },
  footer: { alignItems: 'center' },
});
