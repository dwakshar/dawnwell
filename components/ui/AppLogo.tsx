import React from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';

const LOGO = require('@/assets/images/splash-icon.png') as number;

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function AppLogo({ size = 80, style }: Props) {
  return (
    <Image
      source={LOGO}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
