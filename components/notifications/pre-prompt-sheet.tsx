import React, {
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import BottomSheet, { BottomSheetView } from '@/components/ui/bottom-sheet';
import Button from '@/components/ui/button';
import { Body, Heading } from '@/components/ui/typography';
import { useTheme } from '@/theme/ThemeProvider';
import { requestPermission } from '@/lib/notifications';
import { storage, StorageKey } from '@/lib/storage';

// ─── Public handle ─────────────────────────────────────────────────────────

export type PrePromptSheetHandle = {
  open: () => void;
  close: () => void;
};

// ─── Props ─────────────────────────────────────────────────────────────────

type Props = {
  /** Called after the OS grants permission. Schedule the pending habit here. */
  onGrant: () => Promise<void>;
  /** Called when the user dismisses or the OS denies. Habit is already saved. */
  onDismiss: () => void;
};

// ─── Component ─────────────────────────────────────────────────────────────

const PrePromptSheet = forwardRef<PrePromptSheetHandle, Props>(
  function PrePromptSheet({ onGrant, onDismiss }, ref) {
    const { spacing } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }));

    const handleEnableReminders = async () => {
      setLoading(true);
      const result = await requestPermission();
      setLoading(false);
      setIsOpen(false);
      if (result === 'granted') {
        await onGrant();
      } else {
        onDismiss();
      }
    };

    const handleNotNow = () => {
      storage.setNumber(StorageKey.NOTIF_PREPROMPT_DISMISSED, Date.now());
      setIsOpen(false);
      onDismiss();
    };

    return (
      <BottomSheet
        open={isOpen}
        onClose={handleNotNow}
        snapPoints={['55%']}
      >
        <BottomSheetView style={[styles.container, { paddingHorizontal: spacing[4] }]}>
          <Heading style={styles.heading}>Let Dawnwell remind you?</Heading>

          <Body color="ink-soft" style={styles.line}>
            We'll nudge you at the times you set. Nothing else.
          </Body>
          <Body color="ink-soft" style={styles.line}>
            No sounds, no badges. You can turn this off anytime in Settings.
          </Body>

          <View style={styles.buttons}>
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={loading}
              onPress={() => void handleEnableReminders()}
              accessibilityLabel="Enable reminders"
            >
              Enable reminders
            </Button>
            <Button
              variant="ghost"
              size="md"
              fullWidth
              onPress={handleNotNow}
              accessibilityLabel="Not now"
            >
              Not now
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

export default PrePromptSheet;

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingBottom: 40,
    flex: 1,
  },
  heading: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 22,
    lineHeight: 30,
    marginBottom: 16,
  },
  line: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  buttons: {
    marginTop: 28,
    gap: 12,
  },
});
