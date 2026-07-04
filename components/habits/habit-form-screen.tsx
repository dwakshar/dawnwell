import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { Check, Sparkles, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useController, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TargetStepper from '@/components/habits/target-stepper';
import PrePromptSheet, {
  type PrePromptSheetHandle,
} from '@/components/notifications/pre-prompt-sheet';
import Button from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import Input from '@/components/ui/input';
import Skeleton from '@/components/ui/skeleton';
import { Body, Caption, Heading, Label } from '@/components/ui/typography';
import { getHabit } from '@/db/repos/habits';
import type { Habit, Ritual } from '@/db/schema';
import * as haptics from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { archiveHabit, createHabit, deleteHabitHard, unarchiveHabit, updateHabit } from '@/lib/mutations/habit';
import {
  cancelHabitReminder,
  getPermissionStatus,
  scheduleHabitReminder,
} from '@/lib/notifications';
import {
  getDefaultFormValues,
  HABIT_COLORS,
  HABIT_ICONS,
  ICON_MAP,
} from '@/lib/presets/habit-presets';
import { getRituals } from '@/lib/queries/rituals';
import { queryKeys } from '@/lib/query-keys';
import { HabitFormSchema, type HabitFormValues } from '@/lib/schemas/habit-form';
import { storage, StorageKey } from '@/lib/storage';
import { getTodayISO } from '@/lib/today';
import { useTheme } from '@/theme/ThemeProvider';

// ─── Types ─────────────────────────────────────────────────────────────────

type Props =
  | { mode: 'create'; defaultRitualId?: string }
  | { mode: 'edit'; habitId: string };

// ─── Constants ─────────────────────────────────────────────────────────────

const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

// ─── Helpers ───────────────────────────────────────────────────────────────

function formTimeToDate(time: string): Date {
  const [h = 8, m = 0] = time.split(':').map(Number);
  // Use a fixed base date so the picker value only changes when hour/min change,
  // not on every render (new Date() would cause the spinner to jump constantly).
  return new Date(2000, 0, 1, h, m, 0, 0);
}

function dateToFormTime(date: Date): string {
  return format(date, 'HH:mm');
}

function displayTime(time: string): string {
  return format(formTimeToDate(time), 'h:mm a');
}

function mapHabitToFormValues(h: Habit): HabitFormValues {
  return {
    name: h.name,
    ritualId: h.ritualId,
    icon: h.icon,
    color: h.color,
    target: h.targetPerDay,
    reminderEnabled: h.reminderTime !== null,
    reminderTime: h.reminderTime ?? null,
    reminderDays: h.reminderDays ?? '1111111',
    graceDaysPerWeek: h.graceDaysPerWeek ?? 1,
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Label
        style={{
          color: colors['ink-mute'],
          fontSize: 11,
          letterSpacing: 0.8,
          fontFamily: 'Inter_600SemiBold',
        }}>
        {children.toUpperCase()}
      </Label>
    </View>
  );
}

function SectionDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

// Live preview card at top of form
function PreviewCard({
  name,
  icon,
  color,
  ritualName,
  target,
}: {
  name: string;
  icon: string;
  color: string;
  ritualName: string;
  target: number;
}) {
  const { colors, radii } = useTheme();
  const IconComponent = ICON_MAP[icon] ?? Sparkles;

  return (
    <View style={[styles.previewCard, { backgroundColor: colors.surface, borderRadius: radii.card }]}>
      <View style={[styles.previewIconWrap, { backgroundColor: color, borderRadius: 14 }]}>
        <IconComponent size={30} color="#fff" />
      </View>
      <View style={styles.previewText}>
        <Heading style={{ fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.ink }}>
          {name.trim() || 'Your habit name'}
        </Heading>
        <Caption color="ink-mute">
          {ritualName} · {target}× daily
        </Caption>
      </View>
    </View>
  );
}

// Horizontal pill row for ritual selection
function RitualPicker({
  rituals,
  value,
  onChange,
  accentColor,
}: {
  rituals: Ritual[];
  value: string;
  onChange: (id: string) => void;
  accentColor: string;
}) {
  const { colors, radii } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pillScroll}
      contentContainerStyle={styles.pillScrollContent}
      keyboardShouldPersistTaps="handled">
      {rituals.map((r) => {
        const selected = r.id === value;
        return (
          <Pressable
            key={r.id}
            onPress={() => { void haptics.light(); onChange(r.id); }}
            accessibilityLabel={`${r.name} ritual${selected ? ', selected' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.ritualPill,
              {
                backgroundColor: selected ? accentColor : colors['surface-2'],
                borderRadius: radii.pill,
              },
            ]}>
            <Label
              style={{
                color: selected ? '#fff' : colors.ink,
                fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_400Regular',
              }}>
              {r.name}
            </Label>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// M T W T F S S toggle pills for reminder days
function DaysPicker({
  value,
  onChange,
  accentColor,
}: {
  value: string;
  onChange: (v: string) => void;
  accentColor: string;
}) {
  const { colors, radii } = useTheme();

  const toggle = (index: number) => {
    const arr = value.split('');
    const activeCount = arr.filter((d) => d === '1').length;
    if (arr[index] === '1' && activeCount === 1) return;
    arr[index] = arr[index] === '1' ? '0' : '1';
    void haptics.light();
    onChange(arr.join(''));
  };

  return (
    <View style={styles.daysRow}>
      {DAY_SHORT.map((day, i) => {
        const active = value[i] === '1';
        return (
          <Pressable
            key={i}
            onPress={() => toggle(i)}
            accessibilityLabel={`${DAY_FULL[i] ?? day}${active ? ', selected' : ''}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            style={[
              styles.dayPill,
              {
                backgroundColor: active ? accentColor : colors['surface-2'],
                borderRadius: radii.pill,
              },
            ]}>
            <Label
              style={{
                color: active ? '#fff' : colors['ink-mute'],
                fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                fontSize: 13,
              }}>
              {day}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

// Icon grid
function IconPicker({
  value,
  selectedColor,
  onChange,
}: {
  value: string;
  selectedColor: string;
  onChange: (name: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.iconGrid}>
      {HABIT_ICONS.map(({ name, Component }) => {
        const selected = name === value;
        return (
          <Pressable
            key={name}
            onPress={() => { void haptics.light(); onChange(name); }}
            accessibilityLabel={`${name} icon${selected ? ', selected' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.iconCell,
              { backgroundColor: selected ? selectedColor : colors['surface-2'], borderRadius: 10 },
            ]}>
            <Component size={20} color={selected ? '#fff' : colors['ink-mute']} />
          </Pressable>
        );
      })}
    </View>
  );
}

// Color swatch row
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.colorRow}>
      {HABIT_COLORS.map((c) => {
        const selected = c === value;
        return (
          <Pressable
            key={c}
            onPress={() => { void haptics.light(); onChange(c); }}
            accessibilityLabel={`Color ${c}${selected ? ', selected' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              selected && { borderWidth: 3, borderColor: colors.ink },
            ]}>
            {selected && <Check size={14} color="#fff" strokeWidth={3} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function HabitFormScreen(props: Props) {
  const { colors, spacing, radii } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const prePromptRef = useRef<PrePromptSheetHandle>(null);
  const pendingHabitRef = useRef<Habit | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const archiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const archivePending = useRef(false);

  const [loadingHabit, setLoadingHabit] = useState(props.mode === 'edit');
  const [isArchived, setIsArchived] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [showDeniedNotice, setShowDeniedNotice] = useState(false);
  const [archiveLabel, setArchiveLabel] = useState('Archive habit');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);

  const todayQueryKey = queryKeys.todayView(getTodayISO());

  // ── Form ─────────────────────────────────────────────────────────────────

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isValid, isSubmitting, isDirty },
  } = useForm<HabitFormValues>({
    resolver: zodResolver(HabitFormSchema),
    mode: 'onChange',
    defaultValues: getDefaultFormValues(
      props.mode === 'create' ? (props.defaultRitualId ?? null) : null,
    ),
  });

  const watchedName = watch('name');
  const watchedIcon = watch('icon');
  const watchedColor = watch('color');
  const watchedTarget = watch('target');
  const watchedReminderEnabled = watch('reminderEnabled');
  const watchedReminderTime = watch('reminderTime');
  const watchedReminderDays = watch('reminderDays');
  const watchedGraceDays = watch('graceDaysPerWeek');

  const { field: nameField, fieldState: nameState } = useController({ control, name: 'name' });
  const { field: ritualField } = useController({ control, name: 'ritualId' });
  const { field: iconField } = useController({ control, name: 'icon' });
  const { field: colorField } = useController({ control, name: 'color' });
  const { field: targetField } = useController({ control, name: 'target' });
  const { field: reminderEnabledField } = useController({ control, name: 'reminderEnabled' });
  const { field: reminderTimeField } = useController({ control, name: 'reminderTime' });
  const { field: reminderDaysField } = useController({ control, name: 'reminderDays' });
  const { field: graceDaysField } = useController({ control, name: 'graceDaysPerWeek' });

  // ── Load habit in edit mode ───────────────────────────────────────────────

  useEffect(() => {
    if (props.mode !== 'edit') return;
    void getHabit(props.habitId).then((row) => {
      if (row) {
        reset(mapHabitToFormValues(row));
        setIsArchived(row.archivedAt !== null);
        setArchiveLabel(row.archivedAt !== null ? 'Restore habit' : 'Archive habit');
      }
      setLoadingHabit(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup archive timer on unmount
  useEffect(() => {
    return () => {
      if (archiveTimer.current) clearTimeout(archiveTimer.current);
    };
  }, []);

  // ── Rituals query ─────────────────────────────────────────────────────────

  const { data: rituals = [] } = useQuery({
    queryKey: queryKeys.rituals(),
    queryFn: getRituals,
  });

  // Auto-select the first ritual when creating and no default was provided
  useEffect(() => {
    if (rituals.length > 0 && !ritualField.value) {
      setValue('ritualId', rituals[0]?.id ?? '', { shouldValidate: true });
    }
  }, [rituals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRitual = rituals.find((r) => r.id === ritualField.value);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.habits() });
    queryClient.invalidateQueries({ queryKey: todayQueryKey });
  };

  const createMutation = useMutation({
    mutationFn: createHabit,
    onSuccess: (habit) => { invalidate(); void handlePostSave(habit); },
    onError: (err) => { logger.error('createHabit', err); setMutationError("Couldn't save. Try again."); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: HabitFormValues }) => updateHabit(id, values),
    onSuccess: (habit) => { invalidate(); void handlePostSave(habit); },
    onError: (err) => { logger.error('updateHabit', err); setMutationError("Couldn't save. Try again."); },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveHabit,
    onSuccess: () => { invalidate(); void haptics.success(); router.back(); },
    onError: (err) => { logger.error('archiveHabit', err); setMutationError("Couldn't archive. Try again."); },
  });

  const unarchiveMutation = useMutation({
    mutationFn: unarchiveHabit,
    onSuccess: () => { invalidate(); void haptics.success(); router.back(); },
    onError: (err) => { logger.error('unarchiveHabit', err); setMutationError("Couldn't restore. Try again."); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHabitHard,
    onSuccess: () => { invalidate(); void haptics.warning(); router.back(); },
    onError: (err) => { logger.error('deleteHabit', err); setMutationError("Couldn't delete. Try again."); },
  });

  // ── Notification helpers ─────────────────────────────────────────────────

  const shouldShowPrePrompt = () => {
    const dismissedAt = storage.getNumber(StorageKey.NOTIF_PREPROMPT_DISMISSED);
    return dismissedAt == null || Date.now() - dismissedAt > FOURTEEN_DAYS;
  };

  const handlePostSave = async (habit: Habit) => {
    if (habit.reminderTime == null) {
      void cancelHabitReminder(habit.id);
      router.back();
      return;
    }
    const status = await getPermissionStatus();
    if (status === 'granted') {
      void scheduleHabitReminder(habit);
      router.back();
    } else if (status === 'denied') {
      setShowDeniedNotice(true);
    } else {
      if (shouldShowPrePrompt()) {
        pendingHabitRef.current = habit;
        prePromptRef.current?.open();
      } else {
        router.back();
      }
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = () => {
    setSubmitFailed(false);
    void handleSubmit(
      (values) => {
        setMutationError(null);
        if (props.mode === 'create') {
          createMutation.mutate(values);
        } else {
          updateMutation.mutate({ id: props.habitId, values });
        }
      },
      () => {
        setSubmitFailed(true);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      },
    )();
  };

  // ── Close with dirty-check ────────────────────────────────────────────────

  const handleClose = () => {
    if (isDirty) {
      Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  // ── Archive / Restore ─────────────────────────────────────────────────────

  const handleArchiveOrRestore = () => {
    if (props.mode !== 'edit') return;
    if (isArchived) {
      unarchiveMutation.mutate(props.habitId);
      return;
    }
    if (!archivePending.current) {
      void haptics.warning();
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
      void cancelHabitReminder(props.habitId).then(() => {
        archiveMutation.mutate(props.habitId);
      });
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = () => {
    if (props.mode !== 'edit') return;
    void cancelHabitReminder(props.habitId).then(() => {
      deleteMutation.mutate(props.habitId);
    });
  };

  const isSaving = isSubmitting || createMutation.isPending || updateMutation.isPending;

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loadingHabit) {
    return (
      <>
        <Stack.Screen options={{ gestureEnabled: true }} />
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
          <View style={[styles.header, { paddingHorizontal: spacing[4], borderBottomColor: colors.hairline }]}>
            <IconButton icon={X} variant="ghost" size="md" onPress={() => router.back()} accessibilityLabel="Close" />
            <Heading style={{ fontSize: 17 }}>Edit habit</Heading>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.loadingState}>
            <Skeleton width={200} height={20} radius={6} />
            <View style={{ marginTop: 16, gap: 12 }}>
              <Skeleton width="100%" height={48} radius={12} />
              <Skeleton width="100%" height={48} radius={12} />
              <Skeleton width="80%" height={48} radius={12} />
            </View>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const graceHint =
    watchedGraceDays === 0
      ? 'Must complete on every active day'
      : `Skip up to ${watchedGraceDays} day${watchedGraceDays > 1 ? 's' : ''} per week and stay on track`;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !isDirty }} />

      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.header,
            { paddingHorizontal: spacing[4], borderBottomColor: colors.hairline },
          ]}>
          <IconButton
            icon={X}
            variant="ghost"
            size="md"
            onPress={handleClose}
            accessibilityLabel="Close"
          />
          <Heading style={{ fontSize: 17 }}>
            {props.mode === 'create' ? 'New habit' : 'Edit habit'}
          </Heading>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Live preview card */}
            <PreviewCard
              name={watchedName}
              icon={watchedIcon}
              color={watchedColor}
              ritualName={selectedRitual?.name ?? 'Select a ritual'}
              target={watchedTarget}
            />

            {/* Error / denied banners */}
            {mutationError && (
              <View style={[styles.banner, { backgroundColor: colors['surface-2'], borderRadius: radii.card }]}>
                <Caption style={{ color: colors.accent }}>{mutationError}</Caption>
              </View>
            )}
            {showDeniedNotice && (
              <View style={[styles.banner, { backgroundColor: colors['surface-2'], borderRadius: radii.card, flexDirection: 'row', alignItems: 'center' }]}>
                <Caption color="ink-soft" style={{ flex: 1, lineHeight: 18 }}>
                  Notifications are off in Settings. Open Settings to turn them on.
                </Caption>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => void Linking.openSettings()}
                  accessibilityLabel="Open notification settings">
                  Open Settings
                </Button>
              </View>
            )}

            {/* ── BASICS ──────────────────────────────────────────────────── */}
            <SectionHeader>Basics</SectionHeader>
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.card }]}>
              <View style={styles.cardRow}>
                <View style={styles.nameRow}>
                  <Input
                    value={nameField.value}
                    onChangeText={nameField.onChange}
                    placeholder="Habit name"
                    autoCapitalize="sentences"
                    returnKeyType="done"
                    maxLength={42}
                    error={submitFailed && nameState.error ? nameState.error.message : undefined}
                  />
                  <Caption
                    color={nameField.value.length >= 35 ? 'ink' : 'ink-mute'}
                    style={styles.charCounter}>
                    {nameField.value.length}/40
                  </Caption>
                </View>
              </View>

              <SectionDivider />

              <View style={styles.cardRow}>
                <Label color="ink-soft" style={styles.fieldLabel}>Ritual</Label>
                {rituals.length === 0 ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Skeleton width={72} height={36} radius={18} />
                    <Skeleton width={80} height={36} radius={18} />
                    <Skeleton width={64} height={36} radius={18} />
                  </View>
                ) : (
                  <RitualPicker
                    rituals={rituals}
                    value={ritualField.value}
                    onChange={ritualField.onChange}
                    accentColor={watchedColor}
                  />
                )}
                {submitFailed && !ritualField.value && (
                  <Caption style={{ color: colors['ink-mute'], marginTop: 6 }}>
                    Pick a ritual
                  </Caption>
                )}
              </View>
            </View>

            {/* ── SCHEDULE ────────────────────────────────────────────────── */}
            <SectionHeader>Schedule</SectionHeader>
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.card }]}>
              <View style={styles.cardRow}>
                <TargetStepper
                  value={targetField.value}
                  onChange={targetField.onChange}
                  min={1}
                  max={12}
                />
              </View>

              <SectionDivider />

              <View style={styles.cardRow}>
                <Label color="ink-soft" style={styles.fieldLabel}>Grace days</Label>
                <View style={[styles.rowBetween, { marginTop: 12 }]}>
                  <Body color="ink-soft" style={{ flex: 1, marginRight: 16, lineHeight: 20 }}>
                    {graceHint}
                  </Body>
                  <TargetStepper
                    value={graceDaysField.value}
                    onChange={graceDaysField.onChange}
                    min={0}
                    max={6}
                    hintText=""
                  />
                </View>
              </View>
            </View>

            {/* ── REMINDER ────────────────────────────────────────────────── */}
            <SectionHeader>Reminder</SectionHeader>
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.card }]}>
              <View style={[styles.cardRow, styles.rowBetween]}>
                <Body>Remind me daily</Body>
                <Switch
                  value={reminderEnabledField.value}
                  onValueChange={(v) => {
                    reminderEnabledField.onChange(v);
                    if (v && !watchedReminderTime) reminderTimeField.onChange('08:00');
                    if (!v) setShowAndroidTimePicker(false);
                  }}
                  trackColor={{ false: colors.hairline, true: watchedColor }}
                  thumbColor="#ffffff"
                  accessibilityLabel="Enable daily reminder"
                  accessibilityRole="switch"
                  accessibilityState={{ checked: watchedReminderEnabled }}
                />
              </View>

              {watchedReminderEnabled && (
                <>
                  <SectionDivider />
                  <View style={styles.cardRow}>
                    <Label color="ink-soft" style={styles.fieldLabel}>Active days</Label>
                    <View style={{ marginTop: 10 }}>
                      <DaysPicker
                        value={watchedReminderDays}
                        onChange={reminderDaysField.onChange}
                        accentColor={watchedColor}
                      />
                    </View>
                    <Caption color="ink-mute" style={{ marginTop: 8 }}>
                      {watchedReminderDays === '1111111'
                        ? 'Every day'
                        : watchedReminderDays === '1111100'
                          ? 'Weekdays only'
                          : watchedReminderDays === '0000011'
                            ? 'Weekends only'
                            : `${watchedReminderDays.split('').filter((d) => d === '1').length} days a week`}
                    </Caption>
                  </View>

                  <SectionDivider />
                  <View style={styles.cardRow}>
                    <Label color="ink-soft" style={styles.fieldLabel}>Time</Label>
                    <View style={{ marginTop: 4 }}>
                      {Platform.OS === 'ios' ? (
                        <DateTimePicker
                          value={formTimeToDate(watchedReminderTime ?? '08:00')}
                          mode="time"
                          display="spinner"
                          onValueChange={(_e, date?: Date) => {
                            if (date) reminderTimeField.onChange(dateToFormTime(date));
                          }}
                          accessibilityLabel="Select reminder time"
                          style={styles.timePicker}
                        />
                      ) : (
                        <>
                          <Pressable
                            onPress={() => setShowAndroidTimePicker(true)}
                            style={[styles.androidTimeRow, { borderColor: colors.hairline }]}
                            accessibilityLabel={`Reminder time: ${watchedReminderTime ? displayTime(watchedReminderTime) : '8:00 AM'}. Tap to change.`}>
                            <Body>{watchedReminderTime ? displayTime(watchedReminderTime) : '8:00 AM'}</Body>
                            <Caption color="ink-mute">Tap to change</Caption>
                          </Pressable>
                          {showAndroidTimePicker && (
                            <DateTimePicker
                              value={formTimeToDate(watchedReminderTime ?? '08:00')}
                              mode="time"
                              display="default"
                              onValueChange={(_e, date?: Date) => {
                                setShowAndroidTimePicker(false);
                                if (date) reminderTimeField.onChange(dateToFormTime(date));
                              }}
                              onDismiss={() => setShowAndroidTimePicker(false)}
                            />
                          )}
                        </>
                      )}
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* ── APPEARANCE ──────────────────────────────────────────────── */}
            <SectionHeader>Appearance</SectionHeader>
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.card }]}>
              <View style={styles.cardRow}>
                <Label color="ink-soft" style={styles.fieldLabel}>Icon</Label>
                <View style={{ marginTop: 10 }}>
                  <IconPicker
                    value={iconField.value}
                    selectedColor={watchedColor}
                    onChange={iconField.onChange}
                  />
                </View>
              </View>

              <SectionDivider />

              <View style={styles.cardRow}>
                <Label color="ink-soft" style={styles.fieldLabel}>Color</Label>
                <View style={{ marginTop: 10 }}>
                  <ColorPicker value={colorField.value} onChange={colorField.onChange} />
                </View>
              </View>
            </View>

            {/* ── MANAGE (edit only) ────────────────────────────────────── */}
            {props.mode === 'edit' && (
              <>
                <SectionHeader>Manage</SectionHeader>
                <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.card }]}>
                  <View style={styles.cardRow}>
                    <Button
                      variant="secondary"
                      size="md"
                      fullWidth
                      onPress={handleArchiveOrRestore}
                      loading={archiveMutation.isPending || unarchiveMutation.isPending}
                      accessibilityLabel={archiveLabel}>
                      {archiveLabel}
                    </Button>
                  </View>

                  <SectionDivider />

                  <View style={styles.cardRow}>
                    <Pressable
                      onPress={() => { void haptics.warning(); setShowDeleteConfirm((v) => !v); }}
                      accessibilityLabel="Delete habit permanently"
                      accessibilityRole="button"
                      style={styles.deleteLink}>
                      <Caption color="ink-mute">Delete permanently</Caption>
                    </Pressable>

                    {showDeleteConfirm && (
                      <View
                        style={[
                          styles.deleteConfirm,
                          { backgroundColor: colors['surface-2'], borderRadius: radii.card },
                        ]}>
                        <Body color="ink-soft" style={{ lineHeight: 22 }}>
                          This removes the habit and all its check-ins forever. This cannot be
                          undone.
                        </Body>
                        <View style={styles.deleteButtons}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => setShowDeleteConfirm(false)}
                            accessibilityLabel="Cancel deletion">
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            loading={deleteMutation.isPending}
                            onPress={handleDeleteConfirm}
                            accessibilityLabel="Delete forever">
                            Delete forever
                          </Button>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Sticky save bar ────────────────────────────────────────────── */}
        <View
          style={[
            styles.saveBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.hairline,
              paddingHorizontal: spacing[4],
            },
          ]}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSave}
            disabled={!isValid || isSaving}
            loading={isSaving}
            accessibilityLabel={props.mode === 'create' ? 'Save habit' : 'Save changes'}>
            {props.mode === 'create' ? 'Save habit' : 'Save changes'}
          </Button>
        </View>
      </SafeAreaView>

      <PrePromptSheet
        ref={prePromptRef}
        onGrant={async () => {
          if (pendingHabitRef.current) {
            await scheduleHabitReminder(pendingHabitRef.current);
            pendingHabitRef.current = null;
          }
          router.back();
        }}
        onDismiss={() => {
          pendingHabitRef.current = null;
          router.back();
        }}
      />
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },

  scroll: { flex: 1 },
  content: { paddingTop: 20, paddingBottom: 16 },

  loadingState: { flex: 1, padding: 24 },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  previewIconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    flex: 1,
    gap: 4,
  },

  banner: {
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },

  sectionHeader: {
    marginBottom: 8,
    marginTop: 4,
  },

  card: {
    marginBottom: 24,
    overflow: 'hidden',
  },

  cardRow: {
    padding: 16,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
  },

  fieldLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
    fontFamily: 'Inter_500Medium',
  },

  nameRow: { position: 'relative' },
  charCounter: { position: 'absolute', right: 14, bottom: 10, fontSize: 11 },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  pillScroll: { marginHorizontal: -4, marginTop: 10 },
  pillScrollContent: { paddingHorizontal: 4, gap: 8, flexDirection: 'row' },
  ritualPill: {
    paddingHorizontal: 16,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timePicker: {
    alignSelf: 'flex-start',
    marginLeft: -8,
  },
  androidTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  colorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteLink: { paddingVertical: 4 },
  deleteConfirm: { marginTop: 12, padding: 14, gap: 12 },
  deleteButtons: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },

  saveBar: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
