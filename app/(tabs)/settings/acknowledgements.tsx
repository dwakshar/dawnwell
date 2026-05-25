/**
 * Acknowledgements — lists OSS dependencies and their licenses.
 *
 * The licenses.json file at assets/licenses.json is the source of truth.
 * To regenerate it after adding new dependencies:
 *   npx license-checker --json --out assets/licenses.json --fields name,version,licenses,repository
 * (add license-checker as a devDependency if not present)
 *
 * Having this screen is a soft requirement for Play Store and App Store submission.
 */

import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, ExternalLink } from 'lucide-react-native';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import IconButton from '@/components/ui/icon-button';
import { Body, Caption, Title } from '@/components/ui/typography';
import { useTheme } from '@/theme/ThemeProvider';

import licensesData from '@/assets/licenses.json';

type License = {
  name: string;
  version: string;
  license: string;
  url?: string;
};

const LICENSES: License[] = licensesData as License[];

export default function AcknowledgementsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

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
        <Title>Acknowledgements</Title>
      </View>

      <FlatList
        data={LICENSES}
        keyExtractor={(item) => item.name}
        contentContainerStyle={[styles.list, { paddingHorizontal: spacing[4], paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Caption color="ink-mute" style={styles.intro}>
            Dawnwell is built on the shoulders of these open-source libraries. Thank you to all
            contributors.
          </Caption>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.hairline }]} />
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { paddingVertical: spacing[4], paddingHorizontal: spacing[5] }]}
            onPress={item.url ? () => Linking.openURL(item.url!) : undefined}
            disabled={!item.url}
            activeOpacity={item.url ? 0.6 : 1}
            accessibilityLabel={`${item.name} — ${item.license}`}
            accessibilityRole={item.url ? 'link' : 'text'}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body>{item.name}</Body>
              <Caption color="ink-mute">
                {item.version} · {item.license}
              </Caption>
            </View>
            {item.url && <ExternalLink size={14} color={colors['ink-mute']} />}
          </TouchableOpacity>
        )}
        style={[styles.listContainer, { backgroundColor: colors.surface, borderRadius: 14 }]}
      />
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
  list: { gap: 0 },
  intro: { marginBottom: 16 },
  listContainer: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },
});
