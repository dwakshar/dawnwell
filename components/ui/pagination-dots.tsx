import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { total: number; current: number };

export default function PaginationDots({ total, current }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === current ? colors.accent : colors.hairline,
              width: i === current ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
});
