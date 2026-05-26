import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArchiveRestore, ArrowLeft } from 'lucide-react-native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '@/components/ui/card';
import IconButton from '@/components/ui/icon-button';
import { Body, Caption, Title } from '@/components/ui/typography';
import { listHabits } from '@/db/repos/habits';
import { unarchiveHabit } from '@/lib/mutations/habit';
import { ICON_MAP } from '@/lib/presets/habit-presets';
import { queryKeys } from '@/lib/query-keys';
import { useTheme } from '@/theme/ThemeProvider';

export default function ArchivedHabitsScreen() {
  const { colors, spacing, radii } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: archived = [] } = useQuery({
    queryKey: queryKeys.archivedHabits(),
    queryFn: async () => {
      const all = await listHabits({ includeArchived: true });
      return all.filter((h) => h.archivedAt !== null);
    },
  });

  async function handleRestore(id: string) {
    await unarchiveHabit(id);
    qc.invalidateQueries({ queryKey: queryKeys.archivedHabits() });
    qc.invalidateQueries({ queryKey: queryKeys.habits() });
  }

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
        <Title>Archived habits</Title>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing[4], paddingBottom: 48 },
        ]}
        showsVerticalScrollIndicator={false}>
        {archived.length === 0 ? (
          <View style={[styles.empty, { paddingVertical: spacing[12] }]}>
            <Caption color="ink-mute" style={{ textAlign: 'center' }}>
              No archived habits
            </Caption>
          </View>
        ) : (
          <Card variant="flat" style={styles.listCard}>
            {archived.map((habit, i) => (
              <View
                key={habit.id}
                style={[
                  styles.row,
                  { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
                  i < archived.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.hairline,
                  },
                ]}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: habit.color, borderRadius: radii.pill },
                  ]}>
                  {(() => {
                    const IconComponent = ICON_MAP[habit.icon];
                    return IconComponent ? (
                      <IconComponent size={16} color="#ffffff" strokeWidth={1.75} />
                    ) : null;
                  })()}
                </View>
                <Body
                  style={{ ...styles.name, color: colors['ink-soft'] }}
                  numberOfLines={1}>
                  {habit.name}
                </Body>
                <TouchableOpacity
                  onPress={() => handleRestore(habit.id)}
                  style={[
                    styles.restoreBtn,
                    { borderColor: colors.hairline, borderRadius: radii.button },
                  ]}
                  accessibilityLabel={`Restore ${habit.name}`}
                  activeOpacity={0.6}>
                  <ArchiveRestore size={14} color={colors.accent} strokeWidth={1.75} />
                  <Caption style={{ color: colors.accent }}>Restore</Caption>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
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
  content: { gap: 8 },
  listCard: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  dot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: { flex: 1 },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  empty: { alignItems: 'center' },
});
