import { Body, Caption, Title } from '@/components/ui/typography';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/lib/stores/sync-store';
import { useTheme } from '@/theme/ThemeProvider';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/ui/button';
import Pill from '@/components/ui/pill';

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, status, signOut } = useAuthStore();
  const syncStatus = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);

  async function handleSignOut() {
    await signOut();
    router.replace('/auth/sign-in');
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.container, { paddingHorizontal: spacing[6] }]}>
        <Title>Settings</Title>

        {status === 'authenticated' && user ? (
          <View style={styles.section}>
            <Caption color="ink-mute">{user.email}</Caption>
            <Button variant="secondary" size="md" onPress={handleSignOut}>
              Sign out
            </Button>
          </View>
        ) : (
          <View style={styles.section}>
            <Caption color="ink-mute">Not signed in — data is local only.</Caption>
            <Button variant="primary" size="md" onPress={() => router.push('/auth/sign-in')}>
              Sign in
            </Button>
          </View>
        )}

        {status === 'authenticated' && (
          <TouchableOpacity
            onPress={() => router.push('/(settings)/sync')}
            style={styles.syncRow}>
            <View style={styles.syncRowLeft}>
              <Body>Sync</Body>
              {pendingCount > 0 && (
                <Caption color="ink-mute">{pendingCount} pending</Caption>
              )}
            </View>
            <Pill
              variant={
                syncStatus === 'idle' ? 'sage'
                  : syncStatus === 'syncing' ? 'amber'
                  : syncStatus === 'error' ? 'default'
                  : 'outlined'
              }>
              {syncStatus}
            </Pill>
          </TouchableOpacity>
        )}

        <Body color="ink-soft">More settings coming soon.</Body>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: 24 },
  section: { gap: 12 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  syncRowLeft: { gap: 2 },
});
