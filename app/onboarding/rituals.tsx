import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body, Label, Caption } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Reveal from '@/components/ui/reveal';
import PaginationDots from '@/components/ui/pagination-dots';

export default function RitualsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const RITUAL_EXAMPLES = [
    {
      name: 'Morning',
      color: colors.amber,
      habits: ['Drink water', 'Meditate', 'Journal'],
    },
    {
      name: 'Focus',
      color: colors.sage,
      habits: ['Deep work block', 'No phone for 1 hr'],
    },
    {
      name: 'Evening',
      color: colors.accent,
      habits: ['Walk outside', 'Read', 'Lights out by 11'],
    },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing[6] }]}>
        <Reveal direction="up" delay={0}>
          <Title style={styles.headline}>Habits live{'\n'}inside rituals.</Title>
        </Reveal>
        <Reveal direction="up" delay={100}>
          <Body color="ink-soft">
            Group your habits into Morning, Focus, Evening, or your own rituals. Rhythm beats
            willpower.
          </Body>
        </Reveal>

        <View style={styles.cards}>
          {RITUAL_EXAMPLES.map((ritual, i) => (
            <Reveal key={ritual.name} direction="up" delay={180 + i * 80}>
              <Card variant="default" style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.dot, { backgroundColor: ritual.color }]} />
                  <Label style={{ fontFamily: 'Inter_600SemiBold' }}>{ritual.name}</Label>
                </View>
                {ritual.habits.map((habit) => (
                  <View key={habit} style={[styles.habitRow, { borderTopColor: colors.hairline }]}>
                    <Caption color="ink-soft">{habit}</Caption>
                  </View>
                ))}
              </Card>
            </Reveal>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingHorizontal: spacing[6], paddingBottom: spacing[6] }]}>
        <PaginationDots total={3} current={1} />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          accessibilityLabel="Continue to notification permissions screen"
          onPress={() => router.push('/onboarding/permissions')}
        >
          Continue
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: 24 },
  headline: { fontSize: 34, lineHeight: 42 },
  cards: { gap: 10 },
  card: { padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  habitRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 4 },
  footer: { gap: 24 },
});
