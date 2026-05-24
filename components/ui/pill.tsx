import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Label } from '@/components/ui/typography';
import type { LucideIcon } from 'lucide-react-native';

export type PillVariant = 'default' | 'accent' | 'sage' | 'amber' | 'outlined';

export type PillProps = {
  variant?: PillVariant;
  icon?: LucideIcon;
  children: React.ReactNode;
};

export default function Pill({ variant = 'default', icon: Icon, children }: PillProps) {
  const { colors, radii } = useTheme();

  type VariantStyle = { bg: string; border?: string; textColor: string };
  const variantMap: Record<PillVariant, VariantStyle> = {
    default: { bg: colors['surface-2'], textColor: colors.ink },
    accent: { bg: colors.accent, textColor: '#ffffff' },
    sage: { bg: colors.sage, textColor: '#ffffff' },
    amber: { bg: colors.amber, textColor: '#ffffff' },
    outlined: { bg: 'transparent', border: colors.hairline, textColor: colors.ink },
  };

  const v = variantMap[variant];

  const containerStyle: ViewStyle = {
    backgroundColor: v.bg,
    borderRadius: radii.pill,
    borderWidth: v.border ? StyleSheet.hairlineWidth * 2 : 0,
    borderColor: v.border,
    paddingHorizontal: 12,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  };

  return (
    <View style={containerStyle}>
      {Icon && <Icon size={12} color={v.textColor} />}
      <Label style={{ color: v.textColor }}>{children}</Label>
    </View>
  );
}
