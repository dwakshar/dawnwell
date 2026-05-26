/**
 * Export screen — JSON-only data export via the system share sheet.
 *
 * V1 SCOPE: Export only. Import / restore is not in scope for v1.
 * This is intentional — do not add import logic here. It belongs in v1.x
 * once we've validated the export schema with real users.
 */

import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, Download } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import IconButton from '@/components/ui/icon-button';
import { Body, Caption, Title } from '@/components/ui/typography';
import { db } from '@/db/client';
import { checkIns, habits, rituals } from '@/db/schema';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/theme/ThemeProvider';

type ExportState = 'idle' | 'exporting' | 'success' | 'error';

export default function ExportScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();

  const [state, setState] = useState<ExportState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportedPath, setExportedPath] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setState('exporting');
    setErrorMsg(null);

    try {
      // Read all rows including soft-deleted (export is a full data snapshot)
      const allRituals = db.select().from(rituals).all();
      const allHabitsRaw = db.select().from(habits).all();
      const allCheckIns = db.select().from(checkIns).all();

      // Strip device-local field — reminderNotificationId is per-device, not portable
      const allHabits = allHabitsRaw.map(
        ({ reminderNotificationId: _skip, ...rest }) => rest,
      );

      const exportData = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        user: {
          id: user?.id ?? '',
          email: user?.email ?? '',
        },
        rituals: allRituals,
        habits: allHabits,
        checkIns: allCheckIns,
      };

      const json = JSON.stringify(exportData, null, 2);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `dawnwell-export-${dateStr}.json`;
      const file = new File(Paths.document, fileName);
      file.write(json);

      setExportedPath(file.uri);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Dawnwell data',
        UTI: 'public.json',
      });

      setState('success');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Export failed. Please try again.');
      setState('error');
    }
  }, [user]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing[4] }]}>
        <IconButton
          icon={ArrowLeft}
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        />
        <Title>Export data</Title>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}
        showsVerticalScrollIndicator={false}>
        <Card variant="flat">
          <Body style={{ marginBottom: spacing[2] }}>What's included</Body>
          <Caption color="ink-mute">
            All rituals, habits (including archived), and check-in history — exported as a
            JSON file you can open in any text editor.
          </Caption>
        </Card>

        <Card variant="flat">
          <Caption color="ink-mute">
            Note: this is an export for your records. Importing data back into Dawnwell is
            not available in v1 — it's planned for a future update.
          </Caption>
        </Card>

        {state === 'success' && (
          <Card variant="flat" style={{ borderWidth: 1, borderColor: colors.sage }}>
            <Body style={{ color: colors.sage }}>Exported successfully</Body>
            <Caption color="ink-mute">
              The file was shared. You can also find it in the app's documents folder.
            </Caption>
          </Card>
        )}

        {state === 'error' && errorMsg && (
          <Card variant="flat" style={{ borderWidth: 1, gap: 8, borderColor: '#dc2626' }}>
            <Body style={{ color: '#dc2626' }}>Export failed</Body>
            <Caption color="ink-mute">{errorMsg}</Caption>
            <Button
              variant="secondary"
              size="sm"
              onPress={handleExport}
              accessibilityLabel="Retry export">
              Try again
            </Button>
          </Card>
        )}

        <View style={styles.buttonRow}>
          <Button
            variant="primary"
            size="md"
            icon={Download}
            loading={state === 'exporting'}
            disabled={state === 'exporting'}
            onPress={handleExport}
            accessibilityLabel="Export all data as JSON">
            Export all data
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 12,
  },
  scroll: { flex: 1 },
  content: { gap: 12, paddingBottom: 48 },
buttonRow: { marginTop: 8 },
});
