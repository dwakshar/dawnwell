import { formatDistanceToNow } from 'date-fns';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomSheet, { BottomSheetView } from '@/components/ui/bottom-sheet';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { Body, Caption, Display, Title } from '@/components/ui/typography';
import {
  APP_VERSION,
  BUILD_NUMBER,
  PRIVACY_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
} from '@/lib/about';
import { deleteAccount } from '@/lib/auth/delete-account';
import { cancelAllReminders } from '@/lib/notifications';
import { useSyncStore } from '@/lib/stores/sync-store';
import { useThemeStore } from '@/lib/stores/theme-store';
import { syncNow } from '@/lib/sync/engine';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/theme/ThemeProvider';

// ─── Row helpers ─────────────────────────────────────────────────────────────

type RowProps = {
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: 'terra' | 'red';
  last?: boolean;
};

function SectionRow({ label, right, onPress, destructive, last }: RowProps) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const labelColor =
    destructive === 'red'
      ? '#dc2626'
      : destructive === 'terra'
      ? colors.accent
      : colors.ink;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.row,
        { paddingHorizontal: spacing[5], paddingVertical: spacing[4] },
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
        },
      ]}
      activeOpacity={onPress ? 0.6 : 1}>
      <Body style={{ color: labelColor, fontFamily: fontFamily.sans }}>{label}</Body>
      {right ?? (onPress ? <ChevronRight size={16} color={colors['ink-mute']} /> : null)}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  return (
    <Caption
      color="ink-mute"
      style={{
        marginTop: spacing[6],
        marginBottom: spacing[2],
        marginHorizontal: spacing[2],
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontSize: fontSize.xs,
        fontFamily: fontFamily.sansMedium,
      }}>
      {title}
    </Caption>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsIndex() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const { user, status } = useAuthStore();
  const preference = useThemeStore((s) => s.preference);
  const syncStatus = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const pendingCount = useSyncStore((s) => s.pendingCount);

  // ── Sign-out sheet ──────────────────────────────────────────────────────
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await Promise.race([syncNow(), new Promise<void>((r) => setTimeout(r, 3_000))]);
    } catch {}
    await cancelAllReminders();
    await useAuthStore.getState().signOut();
    setSignOutOpen(false);
    router.replace('/auth/sign-in');
  }, [router]);

  // ── Delete-account sheet ────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteConfirmReady = deleteConfirmText.toLowerCase() === 'delete';

  const handleDeleteAccount = useCallback(async () => {
    if (!deleteConfirmReady) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // deleteAccount() clears MMKV + signs out. Navigate to auth.
      router.replace('/auth/sign-in');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setDeleting(false);
      // Do NOT auto-sign-out on partial-delete failure — state is recoverable on retry.
    }
  }, [deleteConfirmReady, router]);

  // ── Sync inline label ───────────────────────────────────────────────────
  const syncLabel = lastSyncedAt
    ? `${pendingCount > 0 ? `${pendingCount} pending · ` : ''}${formatDistanceToNow(
        lastSyncedAt,
        { addSuffix: true },
      )}`
    : pendingCount > 0
    ? `${pendingCount} pending`
    : 'Never synced';

  const isAuthenticated = status === 'authenticated';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing[4], paddingBottom: 48 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Display style={{ fontSize: 32, lineHeight: 40, marginBottom: spacing[2] }}>
          Settings
        </Display>

        {/* ── APPEARANCE ── */}
        <SectionHeader title="Appearance" />
        <Card variant="flat" style={styles.sectionCard}>
          <SectionRow
            label="Theme"
            right={
              <View style={styles.rowRight}>
                <Caption color="ink-mute" style={{ textTransform: 'capitalize' }}>
                  {preference}
                </Caption>
                <ChevronRight size={16} color={colors['ink-mute']} />
              </View>
            }
            onPress={() => router.push('/settings/appearance')}
            last
          />
        </Card>

        {/* ── HABITS ── */}
        <SectionHeader title="Habits" />
        <Card variant="flat" style={styles.sectionCard}>
          <SectionRow
            label="Notifications"
            onPress={() => router.push('/settings/notifications')}
          />
          <SectionRow
            label="Archived habits"
            onPress={() => router.push('/settings/archived')}
            last
          />
        </Card>

        {/* ── DATA ── */}
        <SectionHeader title="Data" />
        <Card variant="flat" style={styles.sectionCard}>
          {isAuthenticated && (
            <SectionRow
              label="Sync"
              right={
                <View style={styles.rowRight}>
                  <Caption color="ink-mute">{syncLabel}</Caption>
                  <ChevronRight size={16} color={colors['ink-mute']} />
                </View>
              }
              onPress={() => router.push('/settings/sync')}
            />
          )}
          <SectionRow
            label="Export data"
            onPress={() => router.push('/settings/export')}
            last
          />
        </Card>

        {/* ── ACCOUNT ── */}
        <SectionHeader title="Account" />
        <Card variant="flat" style={styles.sectionCard}>
          {isAuthenticated && user ? (
            <>
              <SectionRow
                label={user.email ?? ''}
                right={<Caption color="ink-mute">Email</Caption>}
              />
              <SectionRow
                label="Sign out"
                destructive="terra"
                onPress={() => setSignOutOpen(true)}
              />
              <SectionRow
                label="Delete account"
                destructive="red"
                onPress={() => {
                  setDeleteConfirmText('');
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                last
              />
            </>
          ) : (
            <SectionRow
              label="Sign in"
              onPress={() => router.push('/auth/sign-in')}
              last
            />
          )}
        </Card>

        {/* ── ABOUT ── */}
        <SectionHeader title="About" />
        <Card variant="flat" style={styles.sectionCard}>
          <SectionRow
            label="Version"
            right={
              <Caption color="ink-mute">
                {APP_VERSION} ({BUILD_NUMBER})
              </Caption>
            }
          />
          <SectionRow
            label="Privacy policy"
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <SectionRow
            label="Terms of service"
            onPress={() => Linking.openURL(TERMS_URL)}
          />
          <SectionRow
            label="Send feedback"
            onPress={() =>
              Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                  'Dawnwell feedback',
                )}`,
              )
            }
          />
          <SectionRow
            label="Acknowledgements"
            onPress={() => router.push('/settings/acknowledgements')}
            last
          />
        </Card>
      </ScrollView>

      {/* ── Sign-out confirmation ── */}
      <BottomSheet
        open={signOutOpen}
        onClose={() => !signingOut && setSignOutOpen(false)}
        snapPoints={['38%']}
        enablePanDownToClose={!signingOut}>
        <BottomSheetView style={[styles.sheet, { paddingHorizontal: spacing[6] }]}>
          <Title style={styles.sheetTitle}>Sign out?</Title>
          <Body color="ink-soft" style={styles.sheetBody}>
            Your habits stay on this device. They'll come back when you sign in again.
          </Body>
          <View style={styles.sheetActions}>
            <Button
              variant="ghost"
              size="md"
              onPress={() => setSignOutOpen(false)}
              disabled={signingOut}
              accessibilityLabel="Cancel sign out">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={signingOut}
              onPress={handleSignOut}
              accessibilityLabel="Confirm sign out">
              Sign out
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* ── Delete-account confirmation ── */}
      <BottomSheet
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        snapPoints={['60%']}
        enablePanDownToClose={!deleting}>
        <BottomSheetView style={[styles.sheet, { paddingHorizontal: spacing[6] }]}>
          <Title style={{ marginBottom: 8, color: '#dc2626' }}>Delete account?</Title>
          <Body color="ink-soft" style={styles.sheetBody}>
            This permanently deletes your habits, check-ins, and account. This cannot be
            undone.
          </Body>

          {deleting ? (
            <View style={styles.deletingState}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Body color="ink-mute">Deleting your account…</Body>
            </View>
          ) : (
            <>
              <Input
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder='Type "delete" to confirm'
                autoCapitalize="none"
              />
              {deleteError && (
                <Caption
                  color="ink-mute"
                  style={{ color: '#dc2626', marginTop: spacing[2] }}>
                  {deleteError}
                </Caption>
              )}
              <View style={[styles.sheetActions, { marginTop: spacing[4] }]}>
                <Button
                  variant="ghost"
                  size="md"
                  onPress={() => setDeleteOpen(false)}
                  accessibilityLabel="Cancel account deletion">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="md"
                  disabled={!deleteConfirmReady}
                  onPress={handleDeleteAccount}
                  accessibilityLabel="Confirm account deletion">
                  Delete
                </Button>
              </View>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { gap: 0 },
  sectionCard: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheet: { paddingTop: 8, paddingBottom: 24, gap: 0 },
  sheetTitle: { marginBottom: 8 },
  sheetBody: { marginBottom: 24, lineHeight: 22 },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  deletingState: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
  },
});
