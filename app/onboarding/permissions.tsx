import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import Reveal from '@/components/ui/reveal';
import PaginationDots from '@/components/ui/pagination-dots';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { storage, StorageKey } from '@/lib/storage';
import * as haptics from '@/lib/haptics';

export default function PermissionsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const complete = useOnboardingStore((s) => s.complete);
  const [requesting, setRequesting] = useState(false);

  async function handleAllow() {
    setRequesting(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      storage.setString(
        StorageKey.NOTIFICATIONS_PERMISSION,
        status === 'granted' ? 'granted' : 'denied',
      );
      await haptics.success();
    } catch {
      storage.setString(StorageKey.NOTIFICATIONS_PERMISSION, 'undetermined');
    } finally {
      setRequesting(false);
      complete();
      router.replace('/(tabs)');
    }
  }

  function handleSkip() {
    storage.setString(StorageKey.NOTIFICATIONS_PERMISSION, 'undetermined');
    complete();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing[6] }]}>
        <Reveal direction="up" delay={0}>
          <Title style={styles.headline}>Gentle reminders,{'\n'}only if you want them.</Title>
        </Reveal>
        <Reveal direction="up" delay={120}>
          <Body color="ink-soft">
            Dawnwell can send a quiet notification when it's time for a habit. You can change this
            anytime in Settings.
          </Body>
        </Reveal>
      </View>

      <View style={[styles.footer, { paddingHorizontal: spacing[6], paddingBottom: spacing[6] }]}>
        <PaginationDots total={3} current={2} />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={requesting}
          accessibilityLabel="Allow notification permissions"
          onPress={handleAllow}
        >
          Allow notifications
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          accessibilityLabel="Skip notifications and continue"
          onPress={handleSkip}
        >
          Maybe later
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: 24 },
  headline: { fontSize: 34, lineHeight: 42 },
  footer: { gap: 12 },
});
