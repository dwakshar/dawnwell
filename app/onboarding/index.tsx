import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Title, Body } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import Reveal from '@/components/ui/reveal';
import PaginationDots from '@/components/ui/pagination-dots';

export default function WelcomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing[6] }]}>
        <Reveal direction="up" delay={0}>
          <Title style={styles.headline}>A daily ritual{'\n'}for tending{'\n'}to yourself.</Title>
        </Reveal>
        <Reveal direction="up" delay={120}>
          <Body color="ink-soft" style={styles.body}>
            Dawnwell is a quiet space for the small habits that shape your days. No
            streaks-as-punishment. No noise. Just rituals.
          </Body>
        </Reveal>
      </View>

      <View style={[styles.footer, { paddingHorizontal: spacing[6], paddingBottom: spacing[6] }]}>
        <PaginationDots total={3} current={0} />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          accessibilityLabel="Continue to next onboarding screen"
          onPress={() => router.push('/onboarding/rituals')}
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
  body: { lineHeight: 26 },
  footer: { gap: 24 },
});
