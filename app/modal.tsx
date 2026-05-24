import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export default function ModalScreen() {
  const { colors, fontFamily, fontSize } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text
        style={[
          styles.title,
          { color: colors.ink, fontFamily: fontFamily.display, fontSize: fontSize['3xl'] },
        ]}>
        Modal
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    lineHeight: 40,
  },
});
