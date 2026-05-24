import React, { useCallback, useEffect, useRef } from 'react';
import GorhomBottomSheet, {
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@/theme/ThemeProvider';

// Re-export sub-components so feature code never imports @gorhom/bottom-sheet directly
export { BottomSheetScrollView, BottomSheetView };

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  /** When true, renders children directly without a BottomSheetView wrapper —
   *  use when you need mixed BottomSheetView + BottomSheetScrollView layouts. */
  raw?: boolean;
  /** Forwarded to GorhomBottomSheet — set false to block drag-to-dismiss (e.g. unsaved edits). */
  enablePanDownToClose?: boolean;
  onChange?: (index: number) => void;
};

export default function BottomSheet({
  open,
  onClose,
  snapPoints = ['50%', '90%'],
  children,
  raw = false,
  enablePanDownToClose = true,
  onChange,
}: BottomSheetProps) {
  const { colors, radii } = useTheme();
  const sheetRef = useRef<GorhomBottomSheet>(null);

  useEffect(() => {
    if (open) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={enablePanDownToClose}
      onClose={onClose}
      onChange={onChange}
      backdropComponent={renderBackdrop}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
      }}
      handleIndicatorStyle={{
        backgroundColor: colors.hairline,
        width: 40,
        height: 4,
        borderRadius: radii.pill,
      }}
    >
      {raw ? children : <BottomSheetView>{children}</BottomSheetView>}
    </GorhomBottomSheet>
  );
}
