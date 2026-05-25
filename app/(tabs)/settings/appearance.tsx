import { ArrowLeft, Moon, Sun, SunMoon } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import Card from '@/components/ui/card';
import IconButton from '@/components/ui/icon-button';
import { Body, Caption, Label, Title } from '@/components/ui/typography';
import { useTheme } from '@/theme/ThemeProvider';
import { useThemeStore, type ThemePreference } from '@/lib/stores/theme-store';

type Option = { value: ThemePreference; label: string; Icon: typeof Sun };

const OPTIONS: Option[] = [
  { value: 'system', label: 'System', Icon: SunMoon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export default function AppearanceScreen() {
  const { colors, spacing, radii } = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemeStore();
  const reducedMotion = useReducedMotion();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing[4] }]}>
        <IconButton
          icon={ArrowLeft}
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        />
        <Title>Appearance</Title>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}
        showsVerticalScrollIndicator={false}>

        {/* Picker */}
        <Card variant="flat" style={[styles.pickerCard, { gap: spacing[3] }]}>
          <Caption color="ink-mute">Theme</Caption>
          <View style={styles.pickerRow}>
            {OPTIONS.map(({ value, label, Icon }) => {
              const selected = preference === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setPreference(value)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? colors.accent : colors['surface-2'],
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[4],
                      height: 40,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${label} theme`}>
                  <Icon
                    size={14}
                    color={selected ? '#ffffff' : colors['ink-mute']}
                    strokeWidth={1.75}
                  />
                  <Label style={{ color: selected ? '#ffffff' : colors.ink }}>{label}</Label>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Theme preview */}
        <Caption color="ink-mute" style={styles.previewLabel}>
          Preview
        </Caption>
        <Card variant="raised" style={styles.previewCard}>
          <View style={styles.previewRow}>
            <View
              style={[
                styles.previewDot,
                { backgroundColor: colors.accent },
              ]}
            />
            <View style={styles.previewText}>
              <Body>Morning meditation</Body>
              <Caption color="ink-mute">10 day streak</Caption>
            </View>
            <View style={[styles.previewBadge, { backgroundColor: colors['surface-2'] }]}>
              <Caption color="ink-mute">Done</Caption>
            </View>
          </View>
          <View style={[styles.previewDivider, { backgroundColor: colors.hairline }]} />
          <View style={styles.previewRow}>
            <View
              style={[
                styles.previewDot,
                { backgroundColor: colors.sage },
              ]}
            />
            <View style={styles.previewText}>
              <Body>Evening journal</Body>
              <Caption color="ink-mute">3 day streak</Caption>
            </View>
          </View>
        </Card>
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
  content: { gap: 8, paddingBottom: 48 },
  pickerCard: { padding: 16 },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  previewLabel: { marginTop: 16, marginHorizontal: 4 },
  previewCard: { gap: 0, padding: 0, overflow: 'hidden' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  previewDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  previewText: { flex: 1, gap: 2 },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  previewDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
});
