import { format } from 'date-fns';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts/dist/BarChart';
import { LineChart } from 'react-native-gifted-charts/dist/LineChart';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyNoHabits from '@/components/empty-states/no-habits';
import Card from '@/components/ui/card';
import Pill from '@/components/ui/pill';
import Skeleton from '@/components/ui/skeleton';
import StreakFlame from '@/components/ui/streak-flame';
import { Body, Caption, Display, Label, Mono, Title } from '@/components/ui/typography';
import { useEarliestActivityDate } from '@/hooks/use-history';
import { useRangeAggregate, useRangeSeries, useScorecards } from '@/hooks/use-stats';
import { getCellInfo } from '@/lib/history';
import type {
  RangeAggregateResult,
  ScorecardEntry,
  SeriesPoint,
  StatRange,
} from '@/lib/queries/stats';
import { getTodayISO } from '@/lib/today';
import { useNavigationStore } from '@/stores/navigation-store';
import { useTheme } from '@/theme/ThemeProvider';

const H_PAD = 20;
const CARD_PAD = 20;

// ── Root screen ───────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const { colors, tabBar } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [range, setRange] = useState<StatRange>('week');

  const {
    data: aggregate,
    isLoading: aggLoading,
    isError: aggError,
    refetch: refetchAgg,
  } = useRangeAggregate(range);

  const {
    data: series,
    isLoading: seriesLoading,
    isError: seriesError,
    refetch: refetchSeries,
  } = useRangeSeries(range);

  const {
    data: scorecards,
    isLoading: scorecardsLoading,
    isError: scorecardsError,
    refetch: refetchScorecards,
  } = useScorecards(range);

  const { data: earliestDate } = useEarliestActivityDate();

  const isLoading = aggLoading || seriesLoading || scorecardsLoading;

  // Consider "no habits" only when all three loaded and scorecards is empty
  const allLoaded = !aggLoading && !seriesLoading && !scorecardsLoading;
  const hasNoHabits = allLoaded && (scorecards?.length ?? 0) === 0;

  const onRefresh = useCallback(() => {
    refetchAgg();
    refetchSeries();
    refetchScorecards();
  }, [refetchAgg, refetchSeries, refetchScorecards]);

  const habitCount = scorecards?.length ?? 0;
  const headerSub = useMemo(() => {
    if (habitCount === 0) return 'No habits yet';
    if (earliestDate) {
      return `Tracking ${habitCount} habit${habitCount === 1 ? '' : 's'} since ${format(
        earliestDate,
        'MMM d',
      )}`;
    }
    return `${habitCount} habit${habitCount === 1 ? '' : 's'} tracked`;
  }, [habitCount, earliestDate]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      {hasNoHabits ? (
        <EmptyNoHabits
          title="Nothing to show yet"
          body="Add a habit on Today and start checking in to see your stats."
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: tabBar.height + 32 }]}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }>
          {/* index 0 — header */}
          <View style={[styles.header, { paddingHorizontal: H_PAD }]}>
            <Display style={styles.headerTitle}>Stats</Display>
            <Body color="ink-mute">{headerSub}</Body>
          </View>

          {/* index 1 — range selector (sticky) */}
          <View
            style={[
              styles.rangeTabs,
              { paddingHorizontal: H_PAD, backgroundColor: colors.bg },
            ]}>
            <SegmentedControl
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'alltime', label: 'All time' },
              ]}
              selected={range}
              onSelect={(v) => setRange(v as StatRange)}
            />
          </View>

          {/* index 2 — summary */}
          <View style={[styles.section, { paddingHorizontal: H_PAD }]}>
            {isLoading ? (
              <SkeletonCard height={140} />
            ) : aggError ? (
              <ErrorCard />
            ) : aggregate ? (
              <SummaryCard aggregate={aggregate} range={range} />
            ) : null}
          </View>

          {/* index 3 — chart */}
          <View style={[styles.section, { paddingHorizontal: H_PAD }]}>
            {isLoading ? (
              <SkeletonCard height={180} />
            ) : seriesError ? (
              <ErrorCard />
            ) : series ? (
              <ChartCard series={series} range={range} screenWidth={screenWidth} />
            ) : null}
          </View>

          {/* index 4 — per-habit scorecards */}
          <View style={{ paddingHorizontal: H_PAD }}>
            <View style={styles.scorecardsHeader}>
              <Title style={styles.scorecardsTitle}>By habit</Title>
              <Caption color="ink-mute">
                {range === 'week'
                  ? 'this week'
                  : range === 'month'
                  ? 'this month'
                  : 'all time'}
              </Caption>
            </View>

            {isLoading ? (
              [0, 1, 2].map((i) => (
                <View key={i} style={styles.scorecardGap}>
                  <SkeletonCard height={72} />
                </View>
              ))
            ) : scorecardsError ? (
              <ErrorCard />
            ) : (
              scorecards?.map((sc) => (
                <View key={sc.habitId} style={styles.scorecardGap}>
                  <ScorecardItem scorecard={sc} range={range} />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Segmented control ──────────────────────────────────────────────────────────

type SegmentOption = { value: string; label: string };
type SegmentedControlProps = {
  options: SegmentOption[];
  selected: string;
  onSelect: (value: string) => void;
};

function SegmentedControl({ options, selected, onSelect }: SegmentedControlProps) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={[
        styles.segmentedTrack,
        { backgroundColor: colors['surface-2'], borderRadius: radii.pill },
      ]}>
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.segmentItem,
              isSelected && {
                backgroundColor: colors.bg,
                borderRadius: radii.pill,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2,
              },
            ]}>
            <Label style={{ color: isSelected ? colors.ink : colors['ink-soft'] }}>
              {opt.label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Summary card ───────────────────────────────────────────────────────────────

type SummaryCardProps = { aggregate: RangeAggregateResult; range: StatRange };

function SummaryCard({ aggregate, range }: SummaryCardProps) {
  const { colors } = useTheme();

  const delta =
    aggregate.previousCompletionPct !== null
      ? aggregate.completionPct - aggregate.previousCompletionPct
      : null;

  const deltaLabel = useMemo(() => {
    if (delta === null) return null;
    const rangeLabel = range === 'week' ? 'last week' : 'last month';
    if (delta === 0) return `Even vs ${rangeLabel}`;
    const sign = delta > 0 ? '▲' : '▼';
    return `${sign} ${Math.abs(delta)}% vs ${rangeLabel}`;
  }, [delta, range]);

  const deltaPillVariant: 'sage' | 'default' =
    delta !== null && delta > 0 ? 'sage' : 'default';

  return (
    <Card>
      <View style={styles.summaryRow1}>
        <Display
          style={styles.summaryBigPct}
          accessibilityLabel={`${aggregate.completionPct} percent completion ${
            range === 'week' ? 'this week' : range === 'month' ? 'this month' : 'all time'
          }`}>
          {`${aggregate.completionPct}%`}
        </Display>
        {aggregate.currentLongestStreakDays >= 1 && (
          <StreakFlame count={aggregate.currentLongestStreakDays} size="sm" />
        )}
      </View>

      <View style={styles.summaryRow2}>
        <StatCell value={String(aggregate.checkInCount)} label="Check-ins" />
        <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
        <StatCell value={String(aggregate.perfectDays)} label="Perfect days" />
        <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
        <StatCell value={String(aggregate.activeHabits)} label="Active habits" />
      </View>

      {range !== 'alltime' && deltaLabel !== null && (
        <View style={styles.summaryRow3}>
          <Pill variant={deltaPillVariant}>{deltaLabel}</Pill>
        </View>
      )}
    </Card>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCell}>
      <Mono style={styles.statValue}>{value}</Mono>
      <Caption color="ink-mute">{label}</Caption>
    </View>
  );
}

// ── Chart card ─────────────────────────────────────────────────────────────────

type ChartCardProps = { series: SeriesPoint[]; range: StatRange; screenWidth: number };

function ChartCard({ series, range, screenWidth }: ChartCardProps) {
  const { colors } = useTheme();
  const isReducedMotion = useReducedMotion();
  const chartWidth = screenWidth - H_PAD * 2 - CARD_PAD * 2;
  const allZero = series.every((s) => s.pct === 0);

  const cardTitle =
    range === 'week'
      ? 'This week'
      : range === 'month'
      ? 'Daily completion — month'
      : 'Last 12 weeks';

  const a11yLabel = useMemo(() => {
    if (series.length === 0) return 'No data';
    const avg = Math.round(series.reduce((s, p) => s + p.pct, 0) / series.length);
    const max = series.reduce((a, b) => (a.pct >= b.pct ? a : b));
    const min = series.reduce((a, b) => (a.pct <= b.pct ? a : b));
    const kind = range === 'alltime' ? 'Line chart' : 'Bar chart';
    return `${kind}, ${
      range === 'week'
        ? `week of ${series[0]?.label}`
        : range === 'month'
        ? 'last 30 days'
        : 'last 12 weeks'
    }, average ${avg} percent. Highest ${max.label} ${max.pct} percent. Lowest ${
      min.label
    } ${min.pct} percent.`;
  }, [series, range]);

  return (
    <Card>
      <Title style={styles.chartTitle}>{cardTitle}</Title>
      {allZero ? (
        <View style={styles.chartEmpty}>
          <Body color="ink-mute" align="center">
            Nothing yet — check in on Today to begin.
          </Body>
        </View>
      ) : (
        <View accessible accessibilityLabel={a11yLabel}>
          {range === 'alltime' ? (
            <AllTimeLineChart
              series={series}
              chartWidth={chartWidth}
              accentColor={colors.accent}
              inkMuteColor={colors['ink-mute']}
              isReducedMotion={isReducedMotion ?? false}
            />
          ) : (
            <CompletionBarChart
              series={series}
              range={range}
              chartWidth={chartWidth}
              accentColor={colors.accent}
              inkMuteColor={colors['ink-mute']}
              isReducedMotion={isReducedMotion ?? false}
            />
          )}
        </View>
      )}
    </Card>
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────────

type BarChartInnerProps = {
  series: SeriesPoint[];
  range: 'week' | 'month';
  chartWidth: number;
  accentColor: string;
  inkMuteColor: string;
  isReducedMotion: boolean;
};

function CompletionBarChart({
  series,
  range,
  chartWidth,
  accentColor,
  inkMuteColor,
  isReducedMotion,
}: BarChartInnerProps) {
  const barWidth = range === 'week' ? 22 : 6;
  const n = series.length;
  const initialSpacing = 10;
  const spacing =
    range === 'week'
      ? Math.max(
          4,
          Math.floor(
            (chartWidth - barWidth * n - initialSpacing * 2) / Math.max(n - 1, 1),
          ),
        )
      : 3;

  const data = series.map((s) => ({
    value: s.pct,
    label: s.label,
    frontColor: accentColor,
    topLabelComponent: () => (
      <View style={{ alignItems: 'center', marginBottom: 2, minHeight: 18 }}>
        {s.pct > 0 && (
          <Text
            style={{
              fontSize: 9,
              color: inkMuteColor,
              fontFamily: 'Inter_400Regular',
              lineHeight: 11,
            }}>
            {`${s.pct}%`}
          </Text>
        )}
        {s.isToday && (
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: accentColor,
              marginTop: 2,
            }}
          />
        )}
      </View>
    ),
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={range === 'month'}>
      <BarChart
        data={data}
        width={range === 'week' ? chartWidth : undefined}
        height={120}
        barWidth={barWidth}
        spacing={spacing}
        initialSpacing={initialSpacing}
        endSpacing={initialSpacing}
        maxValue={100}
        noOfSections={4}
        hideRules
        hideYAxisText
        yAxisThickness={0}
        xAxisThickness={0}
        xAxisLabelTextStyle={{
          fontSize: range === 'week' ? 10 : 8,
          color: inkMuteColor,
          fontFamily: 'Inter_400Regular',
        }}
        topLabelContainerStyle={{ height: 22 }}
        isAnimated={!isReducedMotion}
        animationDuration={300}
        barBorderRadius={3}
      />
    </ScrollView>
  );
}

// ── Line chart ─────────────────────────────────────────────────────────────────

type LineChartInnerProps = {
  series: SeriesPoint[];
  chartWidth: number;
  accentColor: string;
  inkMuteColor: string;
  isReducedMotion: boolean;
};

function AllTimeLineChart({
  series,
  chartWidth,
  accentColor,
  inkMuteColor,
  isReducedMotion,
}: LineChartInnerProps) {
  const spacing = Math.max(
    8,
    Math.floor((chartWidth - 20) / Math.max(series.length - 1, 1)),
  );

  const data = series.map((s, idx) => ({
    value: s.pct,
    label: idx % 4 === 0 ? s.label : '',
    hideDataPoint: !s.isToday,
    dataPointColor: accentColor,
    dataPointRadius: 4,
    labelTextStyle: {
      fontSize: 9,
      color: inkMuteColor,
      fontFamily: 'Inter_400Regular',
    },
  }));

  return (
    <LineChart
      data={data}
      width={chartWidth}
      height={120}
      spacing={spacing}
      initialSpacing={10}
      endSpacing={10}
      color={accentColor}
      thickness={2}
      maxValue={100}
      hideRules
      hideYAxisText
      yAxisThickness={0}
      xAxisThickness={0}
      dataPointsRadius={0}
      dataPointsColor="transparent"
      isAnimated={!isReducedMotion}
      animationDuration={400}
    />
  );
}

// ── Scorecard item ─────────────────────────────────────────────────────────────

type ScorecardItemProps = { scorecard: ScorecardEntry; range: StatRange };

function ScorecardItem({ scorecard, range }: ScorecardItemProps) {
  const { colors } = useTheme();
  const todayISO = getTodayISO();
  const setPreselect = useNavigationStore((s) => s.setHistoryPreselectHabitId);

  const handlePress = useCallback(() => {
    setPreselect(scorecard.habitId);
    router.navigate('/(tabs)/history');
  }, [scorecard.habitId, setPreselect]);

  const a11yLabel = `${scorecard.name}, ${scorecard.completionPct} percent ${
    range === 'week' ? 'this week' : range === 'month' ? 'this month' : 'all time'
  }, ${scorecard.currentStreakDays} day streak. Open in history.`;

  const cellSize = range === 'alltime' ? 10 : 8;

  return (
    <Card
      onPress={handlePress}
      accessibilityLabel={a11yLabel}
      style={styles.scorecardCard}>
      <View style={styles.scorecardRow}>
        {/* Left */}
        <View style={styles.scorecardLeft}>
          <View style={styles.scorecardNameRow}>
            <View
              style={[styles.scorecardDot, { backgroundColor: scorecard.colorTag }]}
            />
            <Body style={styles.scorecardName} numberOfLines={1}>
              {scorecard.name}
            </Body>
          </View>
          <Caption color="ink-mute">{`${scorecard.targetPerDay}× per day`}</Caption>
        </View>

        {/* Middle: mini heatmap */}
        <View style={[styles.scorecardHeatmap, { gap: 2 }]}>
          {scorecard.cells.map((cell) => {
            const completed = cell.hasData
              ? Math.round(cell.pct * scorecard.targetPerDay)
              : 0;
            const target = cell.hasData ? scorecard.targetPerDay : 0;
            const info = getCellInfo(
              cell.key,
              todayISO,
              completed,
              target,
              colors,
              scorecard.colorTag,
            );
            return (
              <View
                key={cell.key}
                style={[
                  { width: cellSize, height: cellSize, borderRadius: 2 },
                  { backgroundColor: info.bgColor },
                ]}
              />
            );
          })}
        </View>

        {/* Right */}
        <View style={styles.scorecardRight}>
          <Mono style={styles.scorecardPct}>{`${scorecard.completionPct}%`}</Mono>
          {scorecard.currentStreakDays >= 2 ? (
            <StreakFlame count={scorecard.currentStreakDays} size="sm" />
          ) : (
            <Caption color="ink-mute">{`${scorecard.currentStreakDays}d`}</Caption>
          )}
        </View>
      </View>
    </Card>
  );
}

// ── Skeleton + Error ───────────────────────────────────────────────────────────

function SkeletonCard({ height }: { height: number }) {
  return <Skeleton width="100%" height={height} radius={14} />;
}

function ErrorCard() {
  const { colors, radii } = useTheme();
  return (
    <View
      style={[
        styles.errorCard,
        { backgroundColor: colors.surface, borderRadius: radii.card },
      ]}>
      <Body color="ink-soft" align="center">
        Couldn't load. Pull down to retry.
      </Body>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: 8 },

  header: { paddingBottom: 4, gap: 2 },
  headerTitle: { fontSize: 32, lineHeight: 40 },

  rangeTabs: {
    paddingVertical: 10,
  },
  segmentedTrack: {
    flexDirection: 'row',
    padding: 3,
    height: 36,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { marginBottom: 12 },

  summaryRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryBigPct: { fontSize: 56, lineHeight: 64 },

  summaryRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  statValue: { fontSize: 18, lineHeight: 24 },

  summaryRow3: { alignItems: 'flex-start' },

  chartTitle: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 12,
  },
  chartEmpty: { paddingVertical: 32, alignItems: 'center' },

  scorecardsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  scorecardsTitle: { fontSize: 20, lineHeight: 26 },
  scorecardGap: { marginBottom: 12 },

  scorecardCard: { padding: 16 },
  scorecardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scorecardLeft: { flex: 1, gap: 2, minWidth: 0 },
  scorecardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scorecardDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  scorecardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },

  scorecardHeatmap: { flexDirection: 'row', flexShrink: 0 },

  scorecardRight: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  scorecardPct: { fontSize: 20, lineHeight: 26 },

  errorCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
});
