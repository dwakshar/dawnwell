import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

export default function TodayScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.container, { paddingHorizontal: spacing[6] }]}>
        <Title>Today</Title>
        <Body color="ink-soft" style={styles.subtitle}>
          Today screen — coming in P4.
        </Body>

        {!session && (
          <Card variant="flat" style={styles.syncCard}>
            <Body style={styles.syncText}>Sign in to sync your rituals across devices.</Body>
            <Button
              variant="primary"
              size="sm"
              accessibilityLabel="Sign in to sync across devices"
              onPress={() => router.push('/auth/sign-in')}
            >
              Sign in
            </Button>
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: 12 },
  subtitle: { marginBottom: 8 },
  syncCard: { gap: 16 },
  syncText: { lineHeight: 22 },
});
