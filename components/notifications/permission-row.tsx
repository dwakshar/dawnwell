/**
 * Stub row for the notifications permission state.
 * P10 will compose this into the Settings screen.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';

import { Body, Caption } from '@/components/ui/typography';
import { useTheme } from '@/theme/ThemeProvider';
import { getPermissionStatus } from '@/lib/notifications';

export default function NotificationPermissionRow() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  useEffect(() => {
    getPermissionStatus().then(setStatus);
  }, []);

  if (status === null) return null;

  return (
    <View style={styles.row}>
      <View style={styles.label}>
        <Body>Reminders</Body>
        <Caption color="ink-mute">
          {status === 'granted' ? 'On' : 'Off — not scheduled'}
        </Caption>
      </View>
      {status !== 'granted' && (
        <Pressable
          onPress={() => void Linking.openSettings()}
          accessibilityLabel="Open Settings to enable notifications"
          accessibilityRole="button"
          style={styles.link}
        >
          <Caption style={{ color: colors.accent }}>Open Settings</Caption>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: {
    gap: 2,
  },
  link: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
});
