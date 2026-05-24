import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

export default function HistoryScreen() {
  const { colors, fontSize, fontFamily } = useTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text
          style={[
            styles.title,
            {
              color: colors.ink,
              fontFamily: fontFamily.display,
              fontSize: fontSize['3xl'],
            },
          ]}>
          History
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    lineHeight: 40,
  },
});
