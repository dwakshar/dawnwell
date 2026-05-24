/**
 * HabitSheet — create & edit flow for habits.
 *
 * Gesture map:
 *   - Create mode: drag-down or X button → silent discard
 *   - Edit mode, clean form: drag-down or X button → close
 *   - Edit mode, dirty form: drag-down is BLOCKED (enablePanDownToClose=false);
 *     X button first tap → shows inline discard strip; second tap → close
 *
 * Opened imperatively via ref:
 *   sheetRef.current?.openCreate(ritualId?)
 *   sheetRef.current?.openEdit(habitId)
 *   sheetRef.current?.close()
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react-native';

import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from '@/components/ui/bottom-sheet';
import Button from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import Input from '@/components/ui/input';
import Skeleton from '@/components/ui/skeleton';
import TargetStepper from '@/components/habits/target-stepper';
import { Body, Caption, Heading, Label } from '@/components/ui/typography';
import { useTheme } from '@/theme/ThemeProvider';
import * as haptics from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/query-keys';
import { getRituals } from '@/lib/queries/rituals';
import {
  createHabit,
  updateHabit,
  archiveHabit,
  deleteHabitHard,
} from '@/lib/mutations/habit';
import { getHabit } from '@/db/repos/habits';
import { HabitFormSchema, type HabitFormValues } from '@/lib/schemas/habit-form';
import {
  getDefaultFormValues,
  HABIT_COLORS,
  HABIT_ICONS,
  ICON_MAP,
} from '@/lib/presets/habit-presets';
import type { Ritual } from '@/db/schema';

// ─── Public handle ─────────────────────────────────────────────────────────

export type HabitSheetHandle = {
  openCreate: (defaultRitualId?: string) => void;
  openEdit: (habitId: string) => void;
  close: () => void;
};

// ─── Props ─────────────────────────────────────────────────────────────────

export type HabitSheetProps = {
  onClose?: () => void;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function formTimeToDate(time: string): Date {
  const [h = 8, m = 0] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToFormTime(date: Date): string {
  return format(date, 'HH:mm');
}

function displayTime(time: string): string {
  return format(formTimeToDate(time), 'h:mm a');
}

function mapHabitToFormValues(h: {
  name: string;
  ritualId: string;
  icon: string;
  color: string;
  targetPerDay: number;
  reminderTime: string | null;
}): HabitFormValues {
  return {
    name: h.name,
    ritualId: h.ritualId,
    icon: h.icon,
    color: h.color,
    target: h.targetPerDay,
    reminderEnabled: h.reminderTime !== null,
    reminderTime: h.reminderTime ?? null,
  };
}

// ─── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Label
      style={{ color: colors['ink-mute'], marginBottom: 10, fontFamily: 'Inter_600SemiBold' }}
    >
      {children}
    </Label>
  );
}

// ─── Sheet header ─────────────────────────────────────────────────────────

type SheetHeaderProps = {
  mode: 'create' | 'edit';
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  valid: boolean;
  showDiscardStrip: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

function SheetHeader({
  mode,
  onCancel,
  onSave,
  saving,
  valid,
  showDiscardStrip,
  onKeepEditing,
  onDiscard,
}: SheetHeaderProps) {
  const { colors, radii } = useTheme();

  return (
    <BottomSheetView style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <IconButton
          icon={X}
          variant="ghost"
          size="md"
          onPress={onCancel}
          accessibilityLabel="Cancel"
        />
        <Heading style={{ fontFamily: 'Fraunces_400Regular', fontSize: 18 }}>
          {mode === 'create' ? 'New habit' : 'Edit habit'}
        </Heading>
        <Button
          variant="primary"
          size="sm"
          onPress={onSave}
          disabled={!valid || saving}
          loading={saving}
          accessibilityLabel={mode === 'create' ? 'Save habit' : 'Done editing habit'}
        >
          {mode === 'create' ? 'Save' : 'Done'}
        </Button>
      </View>

      {showDiscardStrip && (
        <View style={[styles.discardStrip, { backgroundColor: colors['surface-2'] }]}>
          <Caption color="ink-soft">Discard changes?</Caption>
          <View style={styles.discardActions}>
            <Pressable
              onPress={onKeepEditing}
              accessibilityLabel="Keep editing"
              accessibilityRole="button"
            >
              <Label style={{ color: colors.accent, fontFamily: 'Inter_600SemiBold' }}>
                Keep editing
              </Label>
            </Pressable>
            <Pressable
              onPress={onDiscard}
              accessibilityLabel="Discard changes"
              accessibilityRole="button"
            >
              <Label style={{ color: colors['ink-mute'] }}>Discard</Label>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.headerDivider, { backgroundColor: colors.hairline }]} />
    </BottomSheetView>
  );
}

// ─── Ritual pill row ────────────────────────────────────────────────────────

type RitualPickerProps = {
  rituals: Ritual[];
  value: string;
  onChange: (id: string) => void;
};

function RitualPicker({ rituals, value, onChange }: RitualPickerProps) {
  const { colors, radii } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pillScroll}
      contentContainerStyle={styles.pillScrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {rituals.map((r) => {
        const selected = r.id === value;
        return (
          <Pressable
            key={r.id}
            onPress={() => {
              haptics.light();
              onChange(r.id);
            }}
            accessibilityLabel={`${r.name} ritual${selected ? ', selected' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.ritualPill,
              {
                backgroundColor: selected ? colors.accent : colors['surface-2'],
                borderRadius: radii.pill,
              },
            ]}
          >
            <Label
              style={{
                color: selected ? '#ffffff' : colors.ink,
                fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_400Regular',
              }}
            >
              {r.name}
            </Label>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Icon grid ─────────────────────────────────────────────────────────────

type IconPickerProps = {
  value: string;
  selectedColor: string;
  onChange: (name: string) => void;
};

function IconPicker({ value, selectedColor, onChange }: IconPickerProps) {
  const { colors, radii } = useTheme();

  return (
    <View style={styles.iconGrid}>
      {HABIT_ICONS.map(({ name, Component }) => {
        const selected = name === value;
        return (
          <Pressable
            key={name}
            onPress={() => {
              haptics.light();
              onChange(name);
            }}
            accessibilityLabel={`${name} icon${selected ? ', selected' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.iconCell,
              {
                backgroundColor: selected ? selectedColor : colors['surface-2'],
                borderRadius: 10,
              },
            ]}
          >
            <Component size={20} color={selected ? '#ffffff' : colors['ink-mute']} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Color swatches ────────────────────────────────────────────────────────

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.colorRow}>
      {HABIT_COLORS.map((c) => {
        const selected = c === value;
        return (
          <Pressable
            key={c}
            onPress={() => {
              haptics.light();
              onChange(c);
            }}
            accessibilityLabel={`Color ${c}${selected ? ', selected' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              selected && { borderWidth: 2.5, borderColor: colors.ink },
            ]}
          >
            {selected && (
              <Check size={14} color="#ffffff" strokeWidth={3} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Reminder section ──────────────────────────────────────────────────────

type ReminderSectionProps = {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  reminderTime: string | null;
  onTimeChange: (time: string) => void;
};

function ReminderSection({
  enabled,
  onToggle,
  reminderTime,
  onTimeChange,
}: ReminderSectionProps) {
  const { colors } = useTheme();
  const isReducedMotion = useReducedMotion();
  const [showPicker, setShowPicker] = useState(false);

  const heightAnim = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
    overflow: 'hidden',
  }));

  const handleToggle = (v: boolean) => {
    onToggle(v);
    heightAnim.value = withTiming(v ? 56 : 0, {
      duration: isReducedMotion ? 0 : 220,
    });
    if (!v) setShowPicker(false);
  };

  const currentTime = reminderTime ?? '08:00';
  const pickerDate = formTimeToDate(currentTime);

  const handlePickerChange = (_event: DateTimePickerChangeEvent, date: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    onTimeChange(dateToFormTime(date));
  };

  const handlePickerDismiss = () => setShowPicker(false);

  return (
    <View style={styles.reminderRoot}>
      <View style={styles.reminderRow}>
        <Body color="ink-soft">Remind me daily</Body>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.hairline, true: colors.accent }}
          thumbColor="#ffffff"
          accessibilityLabel="Enable daily reminder"
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
        />
      </View>

      <Animated.View style={animStyle}>
        <Pressable
          onPress={() => setShowPicker((v) => !v)}
          accessibilityLabel={`Reminder time, currently ${enabled && reminderTime ? displayTime(reminderTime) : 'not set'}`}
          accessibilityRole="button"
          style={[styles.timeRow, { borderColor: colors.hairline }]}
        >
          <Body color={reminderTime ? 'ink' : 'ink-mute'}>
            {enabled && reminderTime ? displayTime(reminderTime) : '8:00 AM'}
          </Body>
          <Caption color="ink-mute">Local time, on this device</Caption>
        </Pressable>
      </Animated.View>

      {showPicker && enabled && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={handlePickerChange}
          onDismiss={handlePickerDismiss}
          accessibilityLabel="Select reminder time"
        />
      )}
    </View>
  );
}

// ─── Edit footer ───────────────────────────────────────────────────────────

type EditFooterProps = {
  onArchive: () => void;
  archiveLabel: string;
  onDeletePress: () => void;
  showDeleteConfirm: boolean;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
  deleting: boolean;
};

function EditFooter({
  onArchive,
  archiveLabel,
  onDeletePress,
  showDeleteConfirm,
  onDeleteCancel,
  onDeleteConfirm,
  deleting,
}: EditFooterProps) {
  const { colors, radii } = useTheme();

  return (
    <View style={styles.footer}>
      <Button
        variant="secondary"
        size="md"
        fullWidth
        onPress={onArchive}
        accessibilityLabel={archiveLabel}
      >
        {archiveLabel}
      </Button>

      <Pressable
        onPress={onDeletePress}
        accessibilityLabel="Delete habit permanently"
        accessibilityRole="button"
        style={styles.deleteLink}
      >
        <Caption color="ink-mute">Delete permanently</Caption>
      </Pressable>

      {showDeleteConfirm && (
        <View
          style={[
            styles.deleteConfirm,
            { backgroundColor: colors['surface-2'], borderRadius: radii.card },
          ]}
        >
          <Body color="ink-soft" style={styles.deleteConfirmText}>
            This removes the habit and all its check-ins. This cannot be undone.
          </Body>
          <View style={styles.deleteConfirmButtons}>
            <Button
              variant="secondary"
              size="sm"
              onPress={onDeleteCancel}
              accessibilityLabel="Cancel deletion"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onPress={onDeleteConfirm}
              loading={deleting}
              accessibilityLabel="Delete habit forever"
            >
              Delete forever
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main sheet ────────────────────────────────────────────────────────────

const HabitSheet = forwardRef<HabitSheetHandle, HabitSheetProps>(
  function HabitSheet({ onClose }, ref) {
    const { colors, spacing } = useTheme();
    const queryClient = useQueryClient();

    // — Sheet state
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [currentHabitId, setCurrentHabitId] = useState<string | null>(null);

    // — Confirm UX state
    const [submitFailed, setSubmitFailed] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [showDiscardStrip, setShowDiscardStrip] = useState(false);
    const discardStripTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [archiveLabel, setArchiveLabel] = useState('Archive habit');
    const archiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const archivePending = useRef(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // — Form
    const {
      control,
      handleSubmit,
      reset,
      watch,
      formState: { isValid, isSubmitting, isDirty },
    } = useForm<HabitFormValues>({
      resolver: zodResolver(HabitFormSchema),
      mode: 'onChange',
      defaultValues: getDefaultFormValues(null),
    });

    const watchedColor = watch('color');
    const watchedReminderEnabled = watch('reminderEnabled');
    const watchedReminderTime = watch('reminderTime');
    const watchedTarget = watch('target');

    // — Rituals query
    const { data: rituals = [] } = useQuery({
      queryKey: queryKeys.rituals(),
      queryFn: getRituals,
    });

    // — Mutations
    const todayQueryKey = queryKeys.todayView(new Date().toISOString().slice(0, 10));

    const createMutation = useMutation({
      mutationFn: createHabit,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.habits() });
        queryClient.invalidateQueries({ queryKey: todayQueryKey });
        closeSheet();
      },
      onError: (err) => {
        logger.error('createHabit failed', err);
        setMutationError("Couldn't save. Try again.");
      },
    });

    const updateMutation = useMutation({
      mutationFn: ({ id, values }: { id: string; values: HabitFormValues }) =>
        updateHabit(id, values),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.habits() });
        queryClient.invalidateQueries({ queryKey: todayQueryKey });
        closeSheet();
      },
      onError: (err) => {
        logger.error('updateHabit failed', err);
        setMutationError("Couldn't save. Try again.");
      },
    });

    const archiveMutation = useMutation({
      mutationFn: archiveHabit,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.habits() });
        queryClient.invalidateQueries({ queryKey: todayQueryKey });
        haptics.success();
        closeSheet();
      },
      onError: (err) => {
        logger.error('archiveHabit failed', err);
        setMutationError("Couldn't archive. Try again.");
      },
    });

    const deleteMutation = useMutation({
      mutationFn: deleteHabitHard,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.habits() });
        queryClient.invalidateQueries({ queryKey: todayQueryKey });
        haptics.warning();
        closeSheet();
      },
      onError: (err) => {
        logger.error('deleteHabitHard failed', err);
        setMutationError("Couldn't delete. Try again.");
      },
    });

    // — Cleanup timers
    const clearTimers = () => {
      if (discardStripTimer.current) clearTimeout(discardStripTimer.current);
      if (archiveTimer.current) clearTimeout(archiveTimer.current);
    };

    // — Sheet lifecycle
    const resetSheetState = () => {
      setSubmitFailed(false);
      setMutationError(null);
      setShowDiscardStrip(false);
      setShowDeleteConfirm(false);
      setArchiveLabel('Archive habit');
      archivePending.current = false;
      clearTimers();
    };

    const closeSheet = () => {
      resetSheetState();
      setIsOpen(false);
      onClose?.();
    };

    // — Imperative handle
    useImperativeHandle(ref, () => ({
      openCreate: (defaultRitualId?: string) => {
        resetSheetState();
        setMode('create');
        setCurrentHabitId(null);
        const cachedRituals = queryClient.getQueryData<Ritual[]>(queryKeys.rituals()) ?? [];
        const ritualId = defaultRitualId ?? cachedRituals[0]?.id ?? '';
        reset(getDefaultFormValues(ritualId));
        setIsOpen(true);
      },
      openEdit: (habitId: string) => {
        void getHabit(habitId).then((row) => {
          if (!row) return;
          resetSheetState();
          setMode('edit');
          setCurrentHabitId(habitId);
          reset(mapHabitToFormValues(row));
          setIsOpen(true);
        });
      },
      close: closeSheet,
    }));

    // — Cancel / dismiss
    const handleCancel = useCallback(() => {
      if (mode === 'edit' && isDirty) {
        if (showDiscardStrip) {
          // second tap → discard
          closeSheet();
        } else {
          setShowDiscardStrip(true);
          discardStripTimer.current = setTimeout(() => {
            setShowDiscardStrip(false);
          }, 4000);
        }
      } else {
        closeSheet();
      }
    }, [mode, isDirty, showDiscardStrip]);

    // When gorhom drag-down closes the sheet, reconcile state
    const handleSheetClose = useCallback(() => {
      // Only allow silent dismiss if form is clean (or create mode)
      if (mode === 'create' || !isDirty) {
        closeSheet();
      }
      // If dirty edit — enablePanDownToClose is false so this won't fire from drag.
      // It CAN fire from our own setIsOpen(false), which is intentional.
    }, [mode, isDirty]);

    // — Save
    const handleSave = handleSubmit(
      async (values) => {
        setMutationError(null);
        if (mode === 'create') {
          createMutation.mutate(values);
        } else if (currentHabitId) {
          updateMutation.mutate({ id: currentHabitId, values });
        }
      },
      () => {
        setSubmitFailed(true);
      },
    );

    // — Archive (double-tap confirm)
    const handleArchive = useCallback(() => {
      if (!currentHabitId) return;
      if (!archivePending.current) {
        haptics.warning();
        archivePending.current = true;
        setArchiveLabel('Tap again to archive');
        archiveTimer.current = setTimeout(() => {
          archivePending.current = false;
          setArchiveLabel('Archive habit');
        }, 3000);
      } else {
        if (archiveTimer.current) clearTimeout(archiveTimer.current);
        archivePending.current = false;
        setArchiveLabel('Archive habit');
        archiveMutation.mutate(currentHabitId);
      }
    }, [currentHabitId, archiveMutation]);

    // — Delete
    const handleDeleteConfirm = useCallback(() => {
      if (!currentHabitId) return;
      deleteMutation.mutate(currentHabitId);
    }, [currentHabitId, deleteMutation]);

    const isSaving = isSubmitting || createMutation.isPending || updateMutation.isPending;

    // Block drag-to-dismiss when editing with unsaved changes
    const canDragDismiss = mode === 'create' || !isDirty;

    // — Field controllers
    const { field: nameField, fieldState: nameState } = useController({ control, name: 'name' });
    const { field: ritualField } = useController({ control, name: 'ritualId' });
    const { field: iconField } = useController({ control, name: 'icon' });
    const { field: colorField } = useController({ control, name: 'color' });
    const { field: targetField } = useController({ control, name: 'target' });
    const { field: reminderEnabledField } = useController({ control, name: 'reminderEnabled' });
    const { field: reminderTimeField } = useController({ control, name: 'reminderTime' });

    const nameLength = nameField.value.length;

    return (
      <BottomSheet
        open={isOpen}
        onClose={handleSheetClose}
        snapPoints={['85%']}
        raw
        enablePanDownToClose={canDragDismiss}
      >
        {/* ── Sticky header ── */}
        <SheetHeader
          mode={mode}
          onCancel={handleCancel}
          onSave={handleSave}
          saving={isSaving}
          valid={isValid}
          showDiscardStrip={showDiscardStrip}
          onKeepEditing={() => setShowDiscardStrip(false)}
          onDiscard={closeSheet}
        />

        {/* ── Scrollable body ── */}
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: spacing[4], paddingBottom: 60 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Mutation error strip */}
          {mutationError && (
            <View style={[styles.errorStrip, { backgroundColor: colors['surface-2'] }]}>
              <Caption style={{ color: colors.accent }}>{mutationError}</Caption>
            </View>
          )}

          {/* Section 1 — Name */}
          <View style={styles.section}>
            <View style={styles.nameRow}>
              <Input
                value={nameField.value}
                onChangeText={nameField.onChange}
                placeholder="Habit name"
                autoFocus={mode === 'create'}
                maxLength={42}
                autoCapitalize="sentences"
                returnKeyType="done"
                error={submitFailed && nameState.error ? nameState.error.message : undefined}
              />
              {nameLength > 30 && (
                <Caption color="ink-mute" style={styles.charCounter}>
                  {nameLength}/40
                </Caption>
              )}
            </View>
          </View>

          <SectionDivider />

          {/* Section 2 — Ritual */}
          <View style={styles.section}>
            <SectionLabel>Ritual</SectionLabel>
            {rituals.length === 0 ? (
              <View style={styles.skeletonRow}>
                <Skeleton width={80} height={32} radius={16} />
                <Skeleton width={64} height={32} radius={16} />
                <Skeleton width={72} height={32} radius={16} />
              </View>
            ) : (
              <RitualPicker
                rituals={rituals}
                value={ritualField.value}
                onChange={ritualField.onChange}
              />
            )}
            {submitFailed && !ritualField.value && (
              <Caption style={{ ...styles.fieldError, color: colors['ink-mute'] }}>
                Pick a ritual
              </Caption>
            )}
          </View>

          <SectionDivider />

          {/* Section 3 — Icon */}
          <View style={styles.section}>
            <SectionLabel>Icon</SectionLabel>
            <IconPicker
              value={iconField.value}
              selectedColor={watchedColor}
              onChange={iconField.onChange}
            />
          </View>

          <SectionDivider />

          {/* Section 4 — Color */}
          <View style={styles.section}>
            <SectionLabel>Color</SectionLabel>
            <ColorPicker value={colorField.value} onChange={colorField.onChange} />
          </View>

          <SectionDivider />

          {/* Section 5 — Daily target */}
          <View style={styles.section}>
            <SectionLabel>Daily target</SectionLabel>
            <TargetStepper
              value={targetField.value}
              onChange={targetField.onChange}
              min={1}
              max={12}
            />
          </View>

          <SectionDivider />

          {/* Section 6 — Reminder */}
          <View style={styles.section}>
            <SectionLabel>Reminder</SectionLabel>
            <ReminderSection
              enabled={watchedReminderEnabled}
              onToggle={(v) => {
                reminderEnabledField.onChange(v);
                if (v && !watchedReminderTime) {
                  reminderTimeField.onChange('08:00');
                }
              }}
              reminderTime={watchedReminderTime}
              onTimeChange={reminderTimeField.onChange}
            />
          </View>

          {/* Section 7 — Edit actions */}
          {mode === 'edit' && (
            <>
              <SectionDivider />
              <EditFooter
                onArchive={handleArchive}
                archiveLabel={archiveLabel}
                onDeletePress={() => {
                  haptics.warning();
                  setShowDeleteConfirm((v) => !v);
                }}
                showDeleteConfirm={showDeleteConfirm}
                onDeleteCancel={() => setShowDeleteConfirm(false)}
                onDeleteConfirm={handleDeleteConfirm}
                deleting={deleteMutation.isPending}
              />
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

export default HabitSheet;

// ─── Section divider ───────────────────────────────────────────────────────

function SectionDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 52,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
  },

  discardStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
  },
  discardActions: {
    flexDirection: 'row',
    gap: 16,
  },

  scrollContent: {
    paddingTop: 8,
  },

  section: {
    paddingVertical: 16,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
  },

  nameRow: {
    position: 'relative',
  },
  charCounter: {
    position: 'absolute',
    right: 14,
    bottom: 8,
  },

  fieldError: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
  },

  errorStrip: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    marginTop: 8,
  },

  skeletonRow: {
    flexDirection: 'row',
    gap: 8,
  },

  pillScroll: {
    marginHorizontal: -4,
  },
  pillScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },
  ritualPill: {
    paddingHorizontal: 16,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconCell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  colorRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reminderRoot: {
    gap: 0,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 4,
  },

  footer: {
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
  },
  deleteLink: {
    paddingVertical: 4,
  },
  deleteConfirm: {
    width: '100%',
    padding: 16,
    gap: 12,
  },
  deleteConfirmText: {
    lineHeight: 22,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});
