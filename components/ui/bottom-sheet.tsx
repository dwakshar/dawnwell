import React, { useCallback, useEffect, useRef } from 'react';
import GorhomBottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@/theme/ThemeProvider';

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
};

export default function BottomSheet({
  open,
  onClose,
  snapPoints = ['50%', '90%'],
  children,
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
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
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
      <BottomSheetView>
        {children}
      </BottomSheetView>
    </GorhomBottomSheet>
  );
}
