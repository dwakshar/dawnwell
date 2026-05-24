import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Sun,
  Moon,
  Star,
  Heart,
  Search,
  Eye,
  ChevronRight,
  Plus,
} from 'lucide-react-native';

import { ThemeContext, useTheme } from '@/theme/ThemeProvider';
import { tokens, type ThemeColors } from '@/theme/tokens';

import { Display, Title, Heading, Body, Label, Caption, Mono } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import Input from '@/components/ui/input';
import Pill from '@/components/ui/pill';
import Card from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import BottomSheet from '@/components/ui/bottom-sheet';
import Drawer from '@/components/ui/drawer';
import HabitDot from '@/components/ui/habit-dot';
import StreakFlame from '@/components/ui/streak-flame';
import Reveal from '@/components/ui/reveal';

export default function Showcase() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const themeValue = useMemo(
    () => ({
      mode,
      colors: tokens.colors[mode] as ThemeColors,
      radii: tokens.radii,
      spacing: tokens.spacing,
      fontSize: tokens.fontSize,
      fontWeight: tokens.fontWeight,
      lineHeight: tokens.lineHeight,
      fontFamily: tokens.fontFamily,
      tabBar: tokens.tabBar,
      touchTarget: tokens.touchTarget,
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <ShowcaseContent
        mode={mode}
        onToggle={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}
      />
    </ThemeContext.Provider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing[8] }}>
      <View
        style={{
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
          marginBottom: spacing[4],
          paddingBottom: spacing[2],
        }}
      >
        <Caption color="ink-mute">{title.toUpperCase()}</Caption>
      </View>
      <View style={{ gap: spacing[3] }}>{children}</View>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {children}
    </View>
  );
}

function ShowcaseContent({
  mode,
  onToggle,
}: {
  mode: 'light' | 'dark';
  onToggle: () => void;
}) {
  const { colors, spacing } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [dotState, setDotState] = useState<'empty' | 'partial' | 'complete'>('empty');

  const cycleDot = () => {
    setDotState((s) =>
      s === 'empty' ? 'partial' : s === 'partial' ? 'complete' : 'empty',
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: 'Showcase',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerRight: () => (
            <Pressable
              onPress={onToggle}
              hitSlop={12}
              accessibilityLabel={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            >
              {mode === 'light' ? (
                <Moon size={20} color={colors.ink} />
              ) : (
                <Sun size={20} color={colors.ink} />
              )}
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing[5], paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TYPOGRAPHY ── */}
        <Section title="Typography">
          <Display>Display 40</Display>
          <Title>Title 28</Title>
          <Heading>Heading 20</Heading>
          <Body>Body 16 — the quick brown fox jumps over the lazy dog.</Body>
          <Label>Label 14 — form labels and captions</Label>
          <Caption color="ink-mute">Caption 12 — meta and timestamps</Caption>
          <Mono>Mono 13 — 7d 14h 03m</Mono>
          <Row>
            <Body color="accent">accent</Body>
            <Body color="ink-soft">ink-soft</Body>
            <Body color="ink-mute">ink-mute</Body>
            <Body color="sage">sage</Body>
            <Body color="amber">amber</Body>
          </Row>
        </Section>

        {/* ── BUTTONS ── */}
        <Section title="Buttons">
          <Row>
            <Button accessibilityLabel="Primary button" onPress={() => {}}>Primary</Button>
            <Button variant="secondary" accessibilityLabel="Secondary button" onPress={() => {}}>Secondary</Button>
            <Button variant="ghost" accessibilityLabel="Ghost button" onPress={() => {}}>Ghost</Button>
            <Button variant="destructive" accessibilityLabel="Destructive button" onPress={() => {}}>Delete</Button>
          </Row>
          <Row>
            <Button size="sm" accessibilityLabel="Small button" onPress={() => {}}>Small</Button>
            <Button size="md" accessibilityLabel="Medium button" onPress={() => {}}>Medium</Button>
            <Button size="lg" accessibilityLabel="Large button" onPress={() => {}}>Large</Button>
          </Row>
          <Row>
            <Button icon={Plus} accessibilityLabel="Button with icon" onPress={() => {}}>With Icon</Button>
            <Button iconRight={ChevronRight} accessibilityLabel="Button with right icon" onPress={() => {}}>Right Icon</Button>
            <Button loading accessibilityLabel="Loading button" onPress={() => {}}>Loading</Button>
            <Button disabled accessibilityLabel="Disabled button" onPress={() => {}}>Disabled</Button>
          </Row>
          <Button fullWidth accessibilityLabel="Full width button" onPress={() => {}}>Full Width</Button>
        </Section>

        {/* ── ICON BUTTONS ── */}
        <Section title="Icon Buttons">
          <Row>
            <IconButton icon={Heart} accessibilityLabel="Ghost icon button" />
            <IconButton icon={Heart} variant="filled" accessibilityLabel="Filled icon button" />
            <IconButton icon={Heart} variant="outlined" accessibilityLabel="Outlined icon button" />
          </Row>
          <Row>
            <IconButton icon={Star} size="sm" accessibilityLabel="Small icon button" />
            <IconButton icon={Star} size="md" accessibilityLabel="Medium icon button" />
            <IconButton icon={Star} size="lg" accessibilityLabel="Large icon button" />
          </Row>
          <Row>
            <IconButton icon={Heart} color={colors.accent} accessibilityLabel="Accent icon" />
            <IconButton icon={Heart} disabled accessibilityLabel="Disabled icon button" />
          </Row>
        </Section>

        {/* ── INPUTS ── */}
        <Section title="Inputs">
          <Input
            value={inputVal}
            onChangeText={setInputVal}
            placeholder="Plain input"
            label="Name"
          />
          <Input
            value={inputVal}
            onChangeText={setInputVal}
            placeholder="With left icon"
            icon={Search}
          />
          <Input
            value={inputVal}
            onChangeText={setInputVal}
            placeholder="With right icon"
            iconRight={Eye}
          />
          <Input
            value=""
            onChangeText={() => {}}
            placeholder="Error state"
            error="This field is required"
          />
          <Input
            value={inputVal}
            onChangeText={setInputVal}
            placeholder="Multiline input..."
            multiline
            label="Notes"
          />
        </Section>

        {/* ── PILLS ── */}
        <Section title="Pills">
          <Row>
            <Pill>Default</Pill>
            <Pill variant="accent">Accent</Pill>
            <Pill variant="sage">Sage</Pill>
            <Pill variant="amber">Amber</Pill>
            <Pill variant="outlined">Outlined</Pill>
          </Row>
          <Row>
            <Pill icon={Star}>With Icon</Pill>
            <Pill variant="accent" icon={Heart}>Accent Icon</Pill>
          </Row>
        </Section>

        {/* ── CARDS ── */}
        <Section title="Cards">
          <Card>
            <Heading>Default Card</Heading>
            <Body color="ink-soft">No shadow, composable children.</Body>
          </Card>
          <Card variant="raised">
            <Heading>Raised Card</Heading>
            <Body color="ink-soft">Subtle shadow on iOS, elevation on Android.</Body>
          </Card>
          <Card variant="flat">
            <Heading>Flat Card</Heading>
            <Body color="ink-soft">Hairline border only.</Body>
          </Card>
          <Card onPress={() => {}} accessibilityLabel="Pressable card">
            <Heading>Pressable Card</Heading>
            <Body color="ink-soft">Tap for scale + haptic.</Body>
          </Card>
        </Section>

        {/* ── SKELETONS ── */}
        <Section title="Skeletons">
          <Skeleton width="100%" height={20} />
          <Skeleton width="70%" height={20} />
          <Skeleton width={48} height={48} radius={24} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={48} height={48} radius={tokens.radii.card} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="80%" height={16} />
              <Skeleton width="50%" height={14} />
            </View>
          </View>
        </Section>

        {/* ── HABIT DOTS ── */}
        <Section title="Habit Dots">
          <Row>
            <HabitDot state="empty" size="sm" accessibilityLabel="Empty small dot" />
            <HabitDot state="partial" size="sm" accessibilityLabel="Partial small dot" />
            <HabitDot state="complete" size="sm" accessibilityLabel="Complete small dot" />
          </Row>
          <Row>
            <HabitDot state="empty" size="md" accessibilityLabel="Empty medium dot" />
            <HabitDot state="partial" size="md" accessibilityLabel="Partial medium dot" />
            <HabitDot state="complete" size="md" accessibilityLabel="Complete medium dot" />
          </Row>
          <Row>
            <HabitDot state="empty" size="lg" accessibilityLabel="Empty large dot" />
            <HabitDot state="partial" size="lg" accessibilityLabel="Partial large dot" />
            <HabitDot state="complete" size="lg" accessibilityLabel="Complete large dot" />
          </Row>
          <Row>
            <HabitDot state={dotState} size="lg" onPress={cycleDot} accessibilityLabel="Tap to cycle state" />
            <Body color="ink-mute">Tap to cycle → {dotState}</Body>
          </Row>
          <Row>
            <HabitDot state="complete" color={colors.sage} accessibilityLabel="Sage colored dot" />
            <HabitDot state="complete" color={colors.amber} accessibilityLabel="Amber colored dot" />
            <HabitDot state="partial" color={colors.sage} accessibilityLabel="Partial sage dot" />
          </Row>
        </Section>

        {/* ── STREAK FLAMES ── */}
        <Section title="Streak Flames">
          <Row>
            <StreakFlame count={0} size="sm" />
            <StreakFlame count={0} size="md" />
            <StreakFlame count={0} size="lg" />
          </Row>
          <Row>
            <StreakFlame count={3} size="sm" />
            <StreakFlame count={3} size="md" />
            <StreakFlame count={3} size="lg" />
          </Row>
          <Row>
            <StreakFlame count={14} size="md" />
            <Caption color="ink-mute">7–29: pulse</Caption>
          </Row>
          <Row>
            <StreakFlame count={42} size="md" />
            <Caption color="ink-mute">30+: accent</Caption>
          </Row>
        </Section>

        {/* ── REVEAL ── */}
        <Section title="Reveal Animations">
          <Reveal direction="up" delay={0}>
            <Card variant="flat">
              <Body>Reveal up (no delay)</Body>
            </Card>
          </Reveal>
          <Reveal direction="up" delay={100}>
            <Card variant="flat">
              <Body>Reveal up (100ms delay)</Body>
            </Card>
          </Reveal>
          <Reveal direction="down" delay={200}>
            <Card variant="flat">
              <Body>Reveal down (200ms delay)</Body>
            </Card>
          </Reveal>
          <Reveal direction="fade" delay={300}>
            <Card variant="flat">
              <Body>Reveal fade (300ms delay)</Body>
            </Card>
          </Reveal>
        </Section>

        {/* ── SHEETS ── */}
        <Section title="Overlays">
          <Row>
            <Button
              onPress={() => setSheetOpen(true)}
              accessibilityLabel="Open bottom sheet"
            >
              Open Bottom Sheet
            </Button>
            <Button
              variant="secondary"
              onPress={() => setDrawerOpen(true)}
              accessibilityLabel="Open drawer"
            >
              Open Drawer
            </Button>
          </Row>
        </Section>
      </ScrollView>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={{ padding: spacing[5], gap: spacing[4] }}>
          <Heading>Bottom Sheet</Heading>
          <Body color="ink-soft">
            This is the @gorhom/bottom-sheet wrapper with Dawnwell styling.
            Drag down or tap the backdrop to dismiss.
          </Body>
          <Button
            variant="secondary"
            onPress={() => setSheetOpen(false)}
            accessibilityLabel="Close sheet"
          >
            Close
          </Button>
        </View>
      </BottomSheet>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <View
          style={{
            flex: 1,
            padding: spacing[5],
            paddingTop: spacing[12],
            gap: spacing[4],
            backgroundColor: colors.surface,
          }}
        >
          <Heading>Drawer</Heading>
          <Body color="ink-soft">
            Right-side drawer with pan-to-dismiss gesture. Drag right to close.
          </Body>
          <Button
            variant="secondary"
            onPress={() => setDrawerOpen(false)}
            accessibilityLabel="Close drawer"
          >
            Close
          </Button>
        </View>
      </Drawer>
    </SafeAreaView>
  );
}
