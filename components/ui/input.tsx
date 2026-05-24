import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  TextInput,
  View,
  Pressable,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { Label, Caption } from '@/components/ui/typography';
import type { LucideIcon } from 'lucide-react-native';

export type InputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  onIconRightPress?: () => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
  maxLength?: number;
} & Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'keyboardType'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'autoFocus'
  | 'editable'
>;

const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    value,
    onChangeText,
    placeholder,
    label,
    error,
    icon: LeftIcon,
    iconRight: RightIcon,
    onIconRightPress,
    secureTextEntry,
    multiline,
    maxLength,
    autoCapitalize,
    keyboardType,
    returnKeyType,
    onSubmitEditing,
    autoFocus,
    editable,
  },
  ref,
) {
  const { colors, radii, mode } = useTheme();
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0);
  const errorAnim = useSharedValue(error ? 1 : 0);

  const hairline = colors.hairline;
  const accent = colors.accent;
  const errorColor = mode === 'light' ? '#dc2626' : '#ef4444';

  useEffect(() => {
    errorAnim.value = withTiming(error ? 1 : 0, { duration: 150 });
  }, [error, errorAnim]);

  useEffect(() => {
    focusAnim.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, focusAnim]);

  const containerAnimStyle = useAnimatedStyle(() => {
    const borderColor =
      errorAnim.value > 0.5
        ? errorColor
        : interpolateColor(focusAnim.value, [0, 1], [hairline, accent]);
    return { borderColor };
  });

  const containerBase: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    paddingHorizontal: 16,
    minHeight: multiline ? 96 : 48,
    paddingVertical: multiline ? 12 : 0,
    gap: 8,
  };

  return (
    <View style={{ gap: 6 }}>
      {label && <Label color="ink-soft">{label}</Label>}
      <Animated.View style={[containerBase, containerAnimStyle]}>
        {LeftIcon && <LeftIcon size={18} color={colors['ink-mute']} />}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors['ink-mute']}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            lineHeight: 24,
            color: colors.ink,
            paddingVertical: 0,
            minHeight: multiline ? 72 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {RightIcon && (
          <Pressable
            onPress={onIconRightPress}
            accessibilityLabel="Input action"
            hitSlop={8}
          >
            <RightIcon size={18} color={colors['ink-mute']} />
          </Pressable>
        )}
      </Animated.View>
      {error && <Caption style={{ color: errorColor }}>{error}</Caption>}
    </View>
  );
});

export default Input;
