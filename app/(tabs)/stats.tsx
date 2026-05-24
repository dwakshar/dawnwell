import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body } from '@/components/ui/typography';

export default function StatsScreen() {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.container, { paddingHorizontal: spacing[6] }]}>
        <Title>Stats</Title>
        <Body color="ink-soft">Coming soon.</Body>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: 12 },
});
