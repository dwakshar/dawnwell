import React from 'react';
import { Text, type TextStyle, type TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ColorKey } from '@/theme/tokens';

export type TypographyProps = {
  color?: ColorKey;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: TextStyle;
  children: React.ReactNode;
} & Omit<TextProps, 'style'>;

function makeTypography(
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle['fontWeight'],
) {
  return function TypographyComponent({
    color,
    align,
    numberOfLines,
    style,
    children,
    ...rest
  }: TypographyProps) {
    const { colors } = useTheme();
    return (
      <Text
        numberOfLines={numberOfLines}
        {...rest}
        style={[
          {
            fontFamily,
            fontSize,
            lineHeight,
            fontWeight,
            color: colors[color ?? 'ink'],
            textAlign: align,
          },
          style,
        ]}
      >
        {children}
      </Text>
    );
  };
}

export const Display = makeTypography('Fraunces_400Regular', 40, 48, '400');
export const Title = makeTypography('Fraunces_400Regular', 28, 34, '400');
export const Heading = makeTypography('Fraunces_400Regular', 20, 26, '400');
export const Body = makeTypography('Inter_400Regular', 16, 24, '400');
export const Label = makeTypography('Inter_400Regular', 14, 20, '400');
export const Caption = makeTypography('Inter_400Regular', 12, 16, '400');
export const Mono = makeTypography('JetBrainsMono_400Regular', 13, 18, '400');
