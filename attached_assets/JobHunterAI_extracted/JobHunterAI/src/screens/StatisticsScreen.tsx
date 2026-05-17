import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { db, AppStats } from "../services/storage";
import { theme } from "../theme";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;
const CHART_HEIGHT = 140;

export default function StatisticsScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
      </View>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={60} color={theme.colors.text.muted} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyText}>Start adding job applications to see your stats here</Text>
        </View>
      </View>
    );
  }

  const dailyData = Object.entries(stats.dailyCounts);
  const maxDaily = Math.max(...dailyData.map(([, v]) => v), 1);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Statistics</Text>
        <Text style={styles.subtitle}>Your job hunt overview</Text>
      </View>

      {/* This week card */}
      <View style={styles.weekCard}>
        <View style={styles.weekLeft}>
          <Text style={styles.weekNumber}>{stats.thisWeek}</Text>
          <Text style={styles.weekLabel}>This week</Text>
        </View>
        <View style={styles.weekDivider} />
        <View style={styles.weekRight}>
          <Text style={styles.weekTip}>
            {stats.thisWeek === 0
              ? "Start applying today! 💪"
              : stats.thisWeek < 3
              ? "Good start! Aim for 5/week"
              : stats.thisWeek < 5
              ? "Great momentum! Keep going!"
              : "Excellent! You're crushing it! 🔥"}
          </Text>
        </View>
      </View>

      {/* Key metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard label="Total Applied" value={stats.total} icon="briefcase-outline" color={theme.colors.accent.cyan} />
        <MetricCard label="Interviews" value={stats.interviews} icon="people-outline" color={theme.colors.accent.green} />
        <MetricCard label="Offers" value={stats.offers} icon="trophy-outline" color={theme.colors.accent.gold} />
        <MetricCard label="Rejected" value={stats.rejected} icon="close-circle-outline" color={theme.colors.accent.red} />
      </View>

      {/* Rate cards */}
      <View style={styles.ratesRow}>
        <RateCard label="Response Rate" value={stats.responseRate} color={theme.colors.accent.cyan} description="Applications that got a reply" />
        <RateCard label="Interview Rate" value={stats.interviewRate} color={theme.colors.accent.green} description="Applications → Interview" />
        <RateCard label="Offer Rate" value={stats.offerRate} color={theme.colors.accent.gold} description="Interviews → Offer" />
      </View>

      {/* Daily activity chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Applications — Last 14 Days</Text>
        <View style={styles.barChart}>
          {dailyData.map(([date, count], i) => {
            const barHeight = count > 0 ? Math.max((count / maxDaily) * CHART_HEIGHT, 8) : 4;
            const isToday = date === new Date().toISOString().split("T")[0];
            const dayLabel = new Date(date).toLocaleDateString("en", { weekday: "short" }).slice(0, 1);

            return (
              <View key={date} style={styles.barWrapper}>
                <Text style={styles.barCount}>{count > 0 ? count : ""}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: isToday
                          ? theme.colors.accent.cyan
                          : count > 0
                          ? theme.colors.accent.cyan + "88"
                          : theme.colors.bg.elevated,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isToday && { color: theme.colors.accent.cyan }]}>
                  {i % 2 === 0 ? dayLabel : ""}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Status breakdown donut */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Status Breakdown</Text>
        <View style={styles.statusBreakdown}>
          {[
            { label: "Waiting", value: stats.waiting, color: theme.colors.accent.cyan },
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
                <View
                  style={[
                    styles.statusBar,
                    {
                      width: stats.total > 0 ? `${(item.value / stats.total) * 100}%` : "0%",
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.statusValue, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Insights */}
      <View style={styles.insightsCard}>
        <Text style={styles.chartTitle}>💡 Insights</Text>
        <View style={styles.insights}>
          {stats.responseRate < 20 && stats.total > 3 && (
            <InsightRow icon="alert-circle-outline" color={theme.colors.accent.orange} text="Low response rate. Try tailoring your CV more closely to each job description." />
          )}
          {stats.responseRate >= 20 && (
            <InsightRow icon="checkmark-circle-outline" color={theme.colors.accent.green} text={`Good response rate of ${stats.responseRate}%! Your applications are landing well.`} />
          )}
          {stats.thisWeek === 0 && (
            <InsightRow icon="calendar-outline" color={theme.colors.accent.red} text="No applications this week yet. Aim for at least 5 per week." />
          )}
          {stats.interviews > 0 && stats.offers === 0 && (
            <InsightRow icon="mic-outline" color={theme.colors.accent.cyan} text="You're getting interviews! Use the Interview Prep tool in AI Writer to convert them to offers." />
          )}
          {stats.total === 0 && (
            <InsightRow icon="rocket-outline" color={theme.colors.accent.cyan} text="Add your first application to start tracking your job hunt!" />
          )}
          {stats.thisWeek >= 5 && (
            <InsightRow icon="flame-outline" color={theme.colors.accent.gold} text={`Amazing! ${stats.thisWeek} applications this week. You're on fire!`} />
          )}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MetricCard({ label, value, icon, color }: any) {
  return (
    <View style={[styles.metricCard, { borderColor: color + "33" }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function RateCard({ label, value, color, description }: any) {
  return (
    <View style={styles.rateCard}>
      <Text style={[styles.rateValue, { color }]}>{value}%</Text>
      <Text style={styles.rateLabel}>{label}</Text>
      <Text style={styles.rateDesc}>{description}</Text>
    </View>
  );
}

function InsightRow({ icon, color, text }: any) {
  return (
    <View style={styles.insightRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.bg.primary },
  header: { paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.md },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, marginTop: 2 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100 },
  emptyTitle: { color: theme.colors.text.primary, fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.semibold, marginTop: theme.spacing.md },
  emptyText: { color: theme.colors.text.muted, textAlign: "center", marginTop: theme.spacing.sm, paddingHorizontal: theme.spacing.xl },
  weekCard: { flexDirection: "row", alignItems: "center", marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.accent.cyanDim, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.accent.cyan + "33" },
  weekLeft: { alignItems: "center", paddingRight: theme.spacing.md },
  weekNumber: { fontSize: 48, fontWeight: theme.font.weights.extrabold, color: theme.colors.accent.cyan },
  weekLabel: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm },
  weekDivider: { width: 1, height: 60, backgroundColor: theme.colors.accent.cyan + "33", marginRight: theme.spacing.md },
  weekRight: { flex: 1 },
  weekTip: { color: theme.colors.text.primary, fontSize: theme.font.sizes.md, lineHeight: 22 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  metricCard: { flex: 1, minWidth: "45%", backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: "center", borderWidth: 1, gap: 4 },
  metricValue: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.extrabold },
  metricLabel: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.xs, textAlign: "center" },
  ratesRow: { flexDirection: "row", paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  rateCard: { flex: 1, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.sm, alignItems: "center", borderWidth: 1, borderColor: theme.colors.bg.border },
  rateValue: { fontSize: theme.font.sizes.xxl, fontWeight: theme.font.weights.extrabold },
  rateLabel: { color: theme.colors.text.primary, fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold, textAlign: "center", marginTop: 2 },
  rateDesc: { color: theme.colors.text.muted, fontSize: 9, textAlign: "center", marginTop: 2 },
  chartCard: { marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border },
  chartTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.md, marginBottom: theme.spacing.md },
  barChart: { flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT + 40, gap: 2 },
  barWrapper: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barCount: { color: theme.colors.text.muted, fontSize: 8, marginBottom: 2 },
  barTrack: { width: "100%", height: CHART_HEIGHT, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3, minHeight: 4 },
  barLabel: { color: theme.colors.text.muted, fontSize: 8, marginTop: 4 },
  statusBreakdown: { gap: theme.spacing.sm },
  statusRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, width: 80 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm },
  statusBarContainer: { flex: 1, height: 8, backgroundColor: theme.colors.bg.elevated, borderRadius: 4, overflow: "hidden" },
  statusBar: { height: "100%", borderRadius: 4 },
  statusValue: { width: 24, textAlign: "right", fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.semibold },
  insightsCard: { marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border },
  insights: { gap: theme.spacing.md },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  insightText: { flex: 1, color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, lineHeight: 20 },
});
