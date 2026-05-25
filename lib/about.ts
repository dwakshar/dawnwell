import Constants from 'expo-constants';

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  String(Constants.expoConfig?.android?.versionCode ?? 1);

// Placeholder URLs — must resolve to real pages before Play Store / App Store submission (P12).
export const PRIVACY_URL = 'https://dawnwell.app/privacy';
export const TERMS_URL = 'https://dawnwell.app/terms';
export const SUPPORT_EMAIL = 'hello@dawnwell.app';
