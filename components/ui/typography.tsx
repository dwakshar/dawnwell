import { useTheme } from '@/theme/ThemeProvider';
import type { ColorKey } from '@/theme/tokens';
import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

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
        ]}>
        {children}
      </Text>
    );
  };
}

export const Display = makeTypography('Archivo_500Medium', 40, 48, '400');
export const Title = makeTypography('Archivo_500Medium', 28, 34, '400');
export const Heading = makeTypography('Archivo_500Medium', 20, 26, '400');
export const Body = makeTypography('Archivo_400Regularr', 16, 24, '400');
export const Label = makeTypography('Archivo_400Regular', 14, 20, '400');
export const Caption = makeTypography('Archivo_400Regular', 12, 16, '400');
export const Mono = makeTypography('JetBrainsMono_400Regular', 13, 18, '400');
