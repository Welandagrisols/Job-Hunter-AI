import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Dimensions, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db, AppStats } from "@/src/services/storage";
import { theme } from "@/src/theme";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;
const CHART_HEIGHT = 120;

export default function StatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await db.getStats();
    setStats(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg.primary }]}>
        <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
      </View>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Statistics</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={56} color={theme.colors.text.muted} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyText}>Start adding job applications to see your stats here</Text>
        </View>
      </View>
    );
  }

  const dailyData = Object.entries(stats.dailyCounts);
  const maxDaily = Math.max(...dailyData.map(([, v]) => v), 1);

  const sourceEntries = Object.entries(stats.sourceBreakdown).sort(([, a], [, b]) => b - a);

  // Top performing roles: those with at least one interview, sorted by interview rate
  const roleEntries = Object.entries(stats.rolePerformance)
    .filter(([, v]) => v.applied >= 1)
    .sort(([, a], [, b]) => {
      const rateA = a.interviews / a.applied;
      const rateB = b.interviews / b.applied;
      if (rateB !== rateA) return rateB - rateA;
      return b.applied - a.applied;
    })
    .slice(0, 5);

  const responded = stats.interviews + stats.offers + stats.rejected;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Statistics</Text>
          <Text style={styles.subtitle}>Your job hunt at a glance</Text>
        </View>
      </View>

      {/* ── KEY METRICS ROW ── */}
      <View style={styles.keyMetrics}>
        <KeyMetric
          label="Response Rate"
          value={`${stats.responseRate}%`}
          sub={`${responded} of ${stats.total} replied`}
          icon="chatbubble-ellipses-outline"
          color={theme.colors.accent.cyan}
        />
        <View style={styles.keyDivider} />
        <KeyMetric
          label="Avg. Days to Hear Back"
          value={responded === 0 ? "–" : `${stats.avgDaysToResponse}d`}
          sub={responded === 0 ? "No responses yet" : `from ${responded} response${responded !== 1 ? "s" : ""}`}
          icon="time-outline"
          color={theme.colors.accent.green}
        />
        <View style={styles.keyDivider} />
        <KeyMetric
          label="Interview Rate"
          value={`${stats.interviewRate}%`}
          sub={`${stats.interviews} interview${stats.interviews !== 1 ? "s" : ""}`}
          icon="people-outline"
          color={theme.colors.accent.gold}
        />
      </View>

      {/* ── THIS WEEK BANNER ── */}
      <View style={styles.weekCard}>
        <View style={styles.weekLeft}>
          <Text style={styles.weekNumber}>{stats.thisWeek}</Text>
          <Text style={styles.weekLabel}>This week</Text>
        </View>
        <View style={styles.weekDivider} />
        <View style={styles.weekRight}>
          <Text style={styles.weekTip}>
            {stats.thisWeek === 0
              ? "Start applying today!"
              : stats.thisWeek < 3
              ? "Good start. Aim for 5/week."
              : stats.thisWeek < 5
              ? "Great momentum! Keep going."
              : "Excellent! You're on fire. 🔥"}
          </Text>
          <Text style={styles.weekTotal}>{stats.total} total application{stats.total !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {/* ── PIPELINE COUNTS ── */}
      <View style={styles.metricsGrid}>
        <MetricCard label="Total Applied" value={stats.total} icon="briefcase-outline" color={theme.colors.accent.cyan} />
        <MetricCard label="Interviews" value={stats.interviews} icon="people-outline" color={theme.colors.accent.green} />
        <MetricCard label="Offers" value={stats.offers} icon="trophy-outline" color={theme.colors.accent.gold} />
        <MetricCard label="Rejected" value={stats.rejected} icon="close-circle-outline" color={theme.colors.accent.red} />
      </View>

      {/* ── ROLE PERFORMANCE ── */}
      {roleEntries.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="podium-outline" size={16} color={theme.colors.accent.gold} />
            <Text style={styles.cardTitle}>Best-Performing Job Types</Text>
          </View>
          <Text style={styles.cardSub}>Roles ranked by interview rate</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            {roleEntries.map(([role, perf], idx) => {
              const rate = perf.applied > 0 ? Math.round((perf.interviews / perf.applied) * 100) : 0;
              const ROLE_COLORS = [
                theme.colors.accent.gold,
                theme.colors.accent.cyan,
                theme.colors.accent.green,
                theme.colors.accent.orange,
                theme.colors.accent.purple,
              ];
              const color = ROLE_COLORS[idx % ROLE_COLORS.length];
              return (
                <View key={role} style={styles.roleRow}>
                  <View style={styles.roleLeft}>
                    <Text style={[styles.roleRank, { color }]}>#{idx + 1}</Text>
                    <Text style={styles.roleLabel} numberOfLines={1}>{role}</Text>
                  </View>
                  <View style={styles.roleBarContainer}>
                    <View style={[styles.roleBar, { width: `${Math.max(rate, 4)}%` as any, backgroundColor: color }]} />
                  </View>
                  <View style={styles.roleRight}>
                    <Text style={[styles.roleRate, { color }]}>{rate}%</Text>
                    <Text style={styles.roleApplied}>{perf.applied} applied</Text>
                  </View>
                </View>
              );
            })}
          </View>
          {roleEntries.length > 0 && roleEntries[0][1].interviews > 0 && (
            <Text style={styles.roleTip}>
              Focus on <Text style={{ color: theme.colors.accent.gold }}>{roleEntries[0][0]}</Text> — it's converting best for you.
            </Text>
          )}
        </View>
      )}

      {/* ── AVG. RESPONSE TIME DETAIL ── */}
      {responded > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="timer-outline" size={16} color={theme.colors.accent.green} />
            <Text style={styles.cardTitle}>Time to Hear Back</Text>
          </View>
          <View style={styles.responseTimeRow}>
            <View style={styles.responseTimeStat}>
              <Text style={[styles.responseTimeValue, { color: theme.colors.accent.cyan }]}>
                {stats.avgDaysToResponse}
              </Text>
              <Text style={styles.responseTimeUnit}>avg days</Text>
              <Text style={styles.responseTimeSub}>to first response</Text>
            </View>
            <View style={styles.responseTimeDivider} />
            <View style={{ flex: 1, gap: 8 }}>
              <ResponseBenchmark
                label="Typical range"
                value="7–14 days"
                icon="checkmark-circle-outline"
                color={theme.colors.accent.green}
              />
              <ResponseBenchmark
                label="Your average"
                value={`${stats.avgDaysToResponse} day${stats.avgDaysToResponse !== 1 ? "s" : ""}`}
                icon={stats.avgDaysToResponse <= 14 ? "trending-up-outline" : "trending-down-outline"}
                color={stats.avgDaysToResponse <= 14 ? theme.colors.accent.cyan : theme.colors.accent.orange}
              />
              <ResponseBenchmark
                label="Based on"
                value={`${responded} response${responded !== 1 ? "s" : ""}`}
                icon="stats-chart-outline"
                color={theme.colors.text.muted}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── DAILY ACTIVITY CHART ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar-outline" size={16} color={theme.colors.accent.cyan} />
          <Text style={styles.cardTitle}>Applications — Last 14 Days</Text>
        </View>
        <View style={styles.barChart}>
          {dailyData.map(([date, count], i) => {
            const barHeight = count > 0 ? Math.max((count / maxDaily) * CHART_HEIGHT, 8) : 4;
            const isToday = date === new Date().toISOString().split("T")[0];
            const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "short" }).slice(0, 1);
            return (
              <View key={date} style={styles.barWrapper}>
                <Text style={styles.barCount}>{count > 0 ? count : ""}</Text>
                <View style={styles.barTrack}>
                  <View style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: isToday
                        ? theme.colors.accent.cyan
                        : count > 0
                        ? theme.colors.accent.cyan + "77"
                        : theme.colors.bg.elevated,
                    },
                  ]} />
                </View>
                <Text style={[styles.barLabel, isToday && { color: theme.colors.accent.cyan, fontWeight: "700" }]}>
                  {i % 2 === 0 ? dayLabel : ""}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── PIPELINE BREAKDOWN ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="funnel-outline" size={16} color={theme.colors.accent.purple} />
          <Text style={styles.cardTitle}>Pipeline Breakdown</Text>
        </View>
        <View style={{ gap: 10 }}>
          {[
            { label: "Waiting / Applied", value: stats.waiting, color: theme.colors.accent.cyan },
            { label: "Interview", value: stats.interviews, color: theme.colors.accent.green },
            { label: "Offer", value: stats.offers, color: theme.colors.accent.gold },
            { label: "Rejected", value: stats.rejected, color: theme.colors.accent.red },
          ].map((item) => (
            <View key={item.label} style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                <Text style={styles.statusLabel}>{item.label}</Text>
              </View>
              <View style={styles.statusBarContainer}>
                <View style={[
                  styles.statusBar,
                  {
                    width: stats.total > 0 ? `${(item.value / stats.total) * 100}%` as any : "0%",
                    backgroundColor: item.color,
                  },
                ]} />
              </View>
              <Text style={[styles.statusValue, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.ratesRow}>
          <SmallRate label="Response" value={stats.responseRate} color={theme.colors.accent.cyan} />
          <SmallRate label="Interview" value={stats.interviewRate} color={theme.colors.accent.green} />
          <SmallRate label="Offer" value={stats.offerRate} color={theme.colors.accent.gold} />
        </View>
      </View>

      {/* ── SOURCE BREAKDOWN ── */}
      {sourceEntries.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="globe-outline" size={16} color={theme.colors.accent.orange} />
            <Text style={styles.cardTitle}>Where Your Leads Come From</Text>
          </View>
          <View style={{ gap: 10 }}>
            {sourceEntries.map(([source, count], idx) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const SRC_COLORS = [
                theme.colors.accent.cyan,
                theme.colors.accent.green,
                theme.colors.accent.gold,
                theme.colors.accent.orange,
                theme.colors.accent.purple,
              ];
              const color = SRC_COLORS[idx % SRC_COLORS.length];
              return (
                <View key={source} style={styles.statusRow}>
                  <View style={[styles.statusLeft, { width: 120 }]}>
                    <View style={[styles.statusDot, { backgroundColor: color }]} />
                    <Text style={[styles.statusLabel, { fontSize: 11 }]} numberOfLines={1}>{source}</Text>
                  </View>
                  <View style={styles.statusBarContainer}>
                    <View style={[styles.statusBar, { width: `${pct}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.statusValue, { color }]}>{count}</Text>
                </View>
              );
            })}
          </View>
          {sourceEntries.length > 0 && (
            <Text style={styles.sourceTip}>
              {sourceEntries[0][0] !== "Manual / Other"
                ? `${sourceEntries[0][0]} is bringing in the most applications.`
                : "Tag jobs with their source when capturing to track which boards work best."}
            </Text>
          )}
        </View>
      )}

      {/* ── INSIGHTS ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="bulb-outline" size={16} color={theme.colors.accent.gold} />
          <Text style={styles.cardTitle}>Insights</Text>
        </View>
        <View style={{ gap: 12 }}>
          {stats.responseRate < 20 && stats.total > 3 && (
            <InsightRow
              icon="alert-circle-outline"
              color={theme.colors.accent.orange}
              text="Low response rate. Try tailoring your CV more closely to each role using AI Writer → CV Tailoring."
            />
          )}
          {stats.responseRate >= 20 && (
            <InsightRow
              icon="checkmark-circle-outline"
              color={theme.colors.accent.green}
              text={`Strong ${stats.responseRate}% response rate — your applications are landing well.`}
            />
          )}
          {stats.avgDaysToResponse > 0 && stats.avgDaysToResponse <= 7 && (
            <InsightRow
              icon="flash-outline"
              color={theme.colors.accent.cyan}
              text={`Fast turnaround — employers are replying in ${stats.avgDaysToResponse} days on average. You're on their radar.`}
            />
          )}
          {stats.avgDaysToResponse > 21 && (
            <InsightRow
              icon="hourglass-outline"
              color={theme.colors.accent.orange}
              text={`Responses are taking ${stats.avgDaysToResponse} days on average. Consider following up after 7 days using the follow-up button on each application.`}
            />
          )}
          {stats.thisWeek === 0 && (
            <InsightRow
              icon="calendar-outline"
              color={theme.colors.accent.red}
              text="No applications this week. Aim for at least 5 per week to maintain momentum."
            />
          )}
          {stats.interviews > 0 && stats.offers === 0 && (
            <InsightRow
              icon="mic-outline"
              color={theme.colors.accent.cyan}
              text="You're getting interviews — great sign! Use Interview Prep in AI Writer to sharpen your answers and convert them to offers."
            />
          )}
          {stats.thisWeek >= 5 && (
            <InsightRow
              icon="flame-outline"
              color={theme.colors.accent.gold}
              text={`${stats.thisWeek} applications this week — outstanding effort!`}
            />
          )}
          {stats.total > 5 && stats.interviews === 0 && (
            <InsightRow
              icon="search-outline"
              color={theme.colors.accent.orange}
              text="No interviews yet. Try targeting roles that closely match your agronomy experience, or tailor each application with CV Vault."
            />
          )}
          {roleEntries.length > 0 && roleEntries[0][1].interviews > 0 && (
            <InsightRow
              icon="podium-outline"
              color={theme.colors.accent.gold}
              text={`"${roleEntries[0][0]}" is your best-converting role type. Prioritise applying to more of these.`}
            />
          )}
        </View>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function KeyMetric({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: string; color: string;
}) {
  return (
    <View style={styles.keyMetricItem}>
      <Ionicons name={icon as any} size={18} color={color} style={{ marginBottom: 4 }} />
      <Text style={[styles.keyMetricValue, { color }]}>{value}</Text>
      <Text style={styles.keyMetricLabel}>{label}</Text>
      <Text style={styles.keyMetricSub}>{sub}</Text>
    </View>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={[styles.metricCard, { borderColor: color + "33" }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SmallRate({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.smallRate}>
      <Text style={[styles.smallRateValue, { color }]}>{value}%</Text>
      <Text style={styles.smallRateLabel}>{label}</Text>
    </View>
  );
}

function ResponseBenchmark({ label, value, icon, color }: {
  label: string; value: string; icon: string; color: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={{ color: theme.colors.text.muted, fontSize: 12, flex: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function InsightRow({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <View style={styles.insightRow}>
      <View style={[styles.insightIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.colors.bg.card,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "700", color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.muted, fontSize: 12, marginTop: 1 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100 },
  emptyTitle: { color: theme.colors.text.primary, fontSize: 20, fontWeight: "600", marginTop: 16 },
  emptyText: { color: theme.colors.text.muted, textAlign: "center", marginTop: 8, paddingHorizontal: 32, fontSize: 14 },

  // Key metrics
  keyMetrics: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 12,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 16, borderWidth: 1, borderColor: theme.colors.bg.border,
    overflow: "hidden",
  },
  keyMetricItem: { flex: 1, alignItems: "center", padding: 14 },
  keyDivider: { width: 1, backgroundColor: theme.colors.bg.border, marginVertical: 12 },
  keyMetricValue: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  keyMetricLabel: { color: theme.colors.text.primary, fontSize: 10, fontWeight: "600", textAlign: "center" },
  keyMetricSub: { color: theme.colors.text.muted, fontSize: 9, textAlign: "center", marginTop: 2 },

  // Week card
  weekCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: theme.colors.accent.cyanDim,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "33",
  },
  weekLeft: { alignItems: "center", paddingRight: 14 },
  weekNumber: { fontSize: 44, fontWeight: "800", color: theme.colors.accent.cyan },
  weekLabel: { color: theme.colors.accent.cyan, fontSize: 11 },
  weekDivider: { width: 1, height: 52, backgroundColor: theme.colors.accent.cyan + "33", marginRight: 14 },
  weekRight: { flex: 1 },
  weekTip: { color: theme.colors.text.primary, fontSize: 14, lineHeight: 20 },
  weekTotal: { color: theme.colors.text.muted, fontSize: 12, marginTop: 4 },

  // Metric cards
  metricsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, gap: 8, marginBottom: 12,
  },
  metricCard: {
    flex: 1, minWidth: "45%",
    backgroundColor: theme.colors.bg.card,
    borderRadius: 12, padding: 12,
    alignItems: "center", borderWidth: 1, gap: 4,
  },
  metricValue: { fontSize: 28, fontWeight: "800" },
  metricLabel: { color: theme.colors.text.secondary, fontSize: 10, textAlign: "center" },

  // Card
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
  cardTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 14 },
  cardSub: { color: theme.colors.text.muted, fontSize: 11, marginBottom: 4 },

  // Role performance
  roleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  roleLeft: { flexDirection: "row", alignItems: "center", gap: 5, width: 120 },
  roleRank: { fontSize: 11, fontWeight: "700", width: 20 },
  roleLabel: { flex: 1, color: theme.colors.text.secondary, fontSize: 11 },
  roleBarContainer: { flex: 1, height: 7, backgroundColor: theme.colors.bg.elevated, borderRadius: 4, overflow: "hidden" },
  roleBar: { height: "100%", borderRadius: 4 },
  roleRight: { width: 48, alignItems: "flex-end" },
  roleRate: { fontSize: 13, fontWeight: "700" },
  roleApplied: { color: theme.colors.text.muted, fontSize: 9 },
  roleTip: { color: theme.colors.text.muted, fontSize: 11, marginTop: 12, lineHeight: 16 },

  // Response time
  responseTimeRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  responseTimeStat: { alignItems: "center", width: 80 },
  responseTimeValue: { fontSize: 40, fontWeight: "800" },
  responseTimeUnit: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: "600", marginTop: -2 },
  responseTimeSub: { color: theme.colors.text.muted, fontSize: 10, textAlign: "center", marginTop: 2 },
  responseTimeDivider: { width: 1, height: 80, backgroundColor: theme.colors.bg.elevated },

  // Chart
  barChart: {
    flexDirection: "row", alignItems: "flex-end",
    height: CHART_HEIGHT + 36, gap: 2, marginTop: 10,
  },
  barWrapper: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barCount: { color: theme.colors.text.muted, fontSize: 8, marginBottom: 2 },
  barTrack: { width: "100%", height: CHART_HEIGHT, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3, minHeight: 4 },
  barLabel: { color: theme.colors.text.muted, fontSize: 8, marginTop: 4 },

  // Status / pipeline
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 6, width: 110 },
  statusDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  statusLabel: { color: theme.colors.text.secondary, fontSize: 12, flex: 1 },
  statusBarContainer: { flex: 1, height: 7, backgroundColor: theme.colors.bg.elevated, borderRadius: 4, overflow: "hidden" },
  statusBar: { height: "100%", borderRadius: 4 },
  statusValue: { width: 22, textAlign: "right", fontSize: 12, fontWeight: "600" },
  ratesRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  smallRate: { flex: 1, alignItems: "center", backgroundColor: theme.colors.bg.elevated, borderRadius: 10, paddingVertical: 8 },
  smallRateValue: { fontSize: 18, fontWeight: "800" },
  smallRateLabel: { color: theme.colors.text.muted, fontSize: 10, marginTop: 1 },

  // Source
  sourceTip: { color: theme.colors.text.muted, fontSize: 11, marginTop: 12, lineHeight: 16 },

  // Insights
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  insightIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  insightText: { flex: 1, color: theme.colors.text.secondary, fontSize: 13, lineHeight: 19, paddingTop: 5 },
});
