import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export default function NotFoundScreen() {
  const { colors, fontFamily, fontSize } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text
          style={[
            styles.title,
            { color: colors.ink, fontFamily: fontFamily.display, fontSize: fontSize.xl },
          ]}>
          Screen not found.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.accent, fontFamily: fontFamily.sans }]}>
            Go to Today
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    lineHeight: 32,
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 15,
  },
});
