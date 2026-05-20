import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { db } from "@/src/services/storage";
import { gmailService } from "@/src/services/gmail";
import { useColors } from "@/hooks/useColors";
import { JobApplication, EmailAlert, STATUS_LABELS, CLASSIFICATION_LABELS } from "@/src/types";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [alerts, setAlerts] = useState<EmailAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const loadData = useCallback(async () => {
    try {
      const [apps, emailAlerts, connected] = await Promise.all([
        db.getApplications(),
        db.getAlerts(false),
        gmailService.isSignedIn(),
      ]);
      setApplications(apps);
      setAlerts(emailAlerts);
      setGmailConnected(connected);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const checkEmails = async () => {
    if (!gmailConnected) { router.push("/(tabs)/settings"); return; }
    setChecking(true);
    await gmailService.checkForNewEmails();
    await loadData();
    setChecking(false);
  };

  const stats = {
    total: applications.length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer: applications.filter((a) => a.status === "offer").length,
    unreadAlerts: alerts.filter((a) => !a.is_read).length,
  };

  const recentAlerts = alerts.filter((a) => !a.is_read).slice(0, 3);
  const recentApps = applications.slice(0, 5);

  // Upcoming deadlines — sorted soonest first, exclude far-past (>14 days overdue)
  const deadlineApps = applications
    .filter((a) => {
      if (!a.deadline) return false;
      const d = new Date(a.deadline);
      if (isNaN(d.getTime())) return false;
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysLeft = Math.ceil((d.getTime() - Date.now()) / msPerDay);
      return daysLeft > -14;
    })
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 6);

  const styles = makeStyles(colors, topPad);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.foreground }]}>Good day, Wesley</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your job hunt at a glance</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/statistics")}
          >
            <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: checking ? colors.primary : colors.border }]}
            onPress={checkEmails}
            disabled={checking}
          >
            {checking
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Ionicons name="mail-outline" size={20} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      {!gmailConnected && (
        <TouchableOpacity
          style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.orange + "55" }]}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Ionicons name="warning-outline" size={16} color={colors.orange} />
          <Text style={[styles.bannerText, { color: colors.orange }]}>
            Connect Gmail to enable automatic email monitoring
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.orange} />
        </TouchableOpacity>
      )}

      <View style={styles.statsRow}>
        {[
          { label: "Applied", value: stats.total, color: colors.primary, icon: "briefcase-outline" },
          { label: "Interviews", value: stats.interview, color: colors.green, icon: "people-outline" },
          { label: "Offers", value: stats.offer, color: colors.gold, icon: "trophy-outline" },
          { label: "Unread", value: stats.unreadAlerts, color: colors.orange, icon: "notifications-outline" },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: s.color + "33" }]}>
            <Ionicons name={s.icon as any} size={16} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick actions */}
      <View style={styles.quickActionsRow}>
        <QuickAction
          icon="newspaper-outline"
          label="Job Feed"
          color={colors.primary}
          colors={colors}
          onPress={() => router.push("/(tabs)/feed")}
        />
        <QuickAction
          icon="scan-outline"
          label="Capture Job"
          color={colors.green}
          colors={colors}
          onPress={() => router.push("/job-capture")}
        />
        <QuickAction
          icon="grid-outline"
          label="Kanban"
          color={colors.orange}
          colors={colors}
          onPress={() => router.push("/(tabs)/kanban")}
        />
        <QuickAction
          icon="bar-chart-outline"
          label="Stats"
          color={colors.gold}
          colors={colors}
          onPress={() => router.push("/statistics")}
        />
      </View>

      {deadlineApps.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Upcoming Deadlines" onSeeAll={() => router.push("/(tabs)/applications")} colors={colors} />
          {deadlineApps.map((app) => {
            const dl = deadlineInfo(app.deadline!, colors);
            if (!dl) return null;
            const sc = statusColorFn(app.status, colors);
            return (
              <TouchableOpacity
                key={app.id}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: colors.card, borderRadius: 12, padding: 12,
                  marginBottom: 8, borderWidth: 1,
                  borderColor: dl.urgency === "critical" ? dl.color + "55" : colors.border,
                  borderLeftWidth: 4, borderLeftColor: dl.color,
                }}
                onPress={() => router.push({ pathname: "/add-application", params: { id: app.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
                    {app.company}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {app.role}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 4,
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                    backgroundColor: dl.color + "20", borderWidth: 1, borderColor: dl.color + "50",
                  }}>
                    <Ionicons name={dl.icon as any} size={10} color={dl.color} />
                    <Text style={{ color: dl.color, fontSize: 10, fontWeight: "700" }}>{dl.label}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: sc + "22" }}>
                    <Text style={{ color: sc, fontSize: 10, fontWeight: "600" }}>{STATUS_LABELS[app.status]}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {recentAlerts.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="New Emails" onSeeAll={() => router.push("/(tabs)/alerts")} colors={colors} />
          {recentAlerts.map((alert) => {
            const color = classificationColor(alert.classification, colors);
            const label = CLASSIFICATION_LABELS[alert.classification] || "Email";
            return (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/alerts")}
              >
                <View style={[styles.dot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertLabel, { color }]}>{label}</Text>
                  <Text style={[styles.alertSubject, { color: colors.foreground }]} numberOfLines={1}>{alert.subject}</Text>
                  <Text style={[styles.alertFrom, { color: colors.textSecondary }]} numberOfLines={1}>{alert.from_email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader
          title="Recent Applications"
          onSeeAll={() => router.push("/(tabs)/applications")}
          onAdd={() => router.push("/add-application")}
          colors={colors}
        />
        {recentApps.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="briefcase-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No applications yet</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.emptyBtn, { borderColor: colors.primary + "55", backgroundColor: colors.primary + "22" }]}
                onPress={() => router.push("/add-application")}
              >
                <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Add Manually</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyBtn, { borderColor: colors.green + "55", backgroundColor: colors.green + "22" }]}
                onPress={() => router.push("/job-capture")}
              >
                <Text style={[styles.emptyBtnText, { color: colors.green }]}>Capture from URL</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          recentApps.map((app) => {
            const statusColor = statusColorFn(app.status, colors);
            return (
              <TouchableOpacity
                key={app.id}
                style={[styles.appCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/add-application", params: { id: app.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.appCompany, { color: colors.foreground }]}>{app.company}</Text>
                  <Text style={[styles.appRole, { color: colors.textSecondary }]}>{app.role}</Text>
                  <Text style={[styles.appDate, { color: colors.textMuted }]}>
                    Applied {format(new Date(app.date_applied), "MMM d, yyyy")}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusColor + "22", borderColor: statusColor + "55" }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {STATUS_LABELS[app.status]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: Platform.OS === "web" ? 50 : 32 }} />
    </ScrollView>
  );
}

function QuickAction({ icon, label, color, colors, onPress }: any) {
  return (
    <TouchableOpacity
      style={{ flex: 1, alignItems: "center", gap: 6 }}
      onPress={onPress}
    >
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: color + "22", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color + "44" }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: "center" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, onSeeAll, onAdd, colors }: {
  title: string; onSeeAll?: () => void; onAdd?: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground }}>{title}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {onAdd && (
          <TouchableOpacity
            style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center" }}
            onPress={onAdd}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={{ color: colors.primary, fontSize: 13 }}>See all</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function deadlineInfo(deadlineStr: string, colors: ReturnType<typeof useColors>) {
  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: "Overdue", color: colors.destructive, icon: "alert-circle", urgency: "critical" };
  if (daysLeft === 0) return { label: "Due today!", color: colors.destructive, icon: "alert-circle", urgency: "critical" };
  if (daysLeft === 1) return { label: "1 day left", color: colors.destructive, icon: "time-outline", urgency: "critical" };
  if (daysLeft <= 3) return { label: `${daysLeft} days left`, color: colors.orange, icon: "time-outline", urgency: "high" };
  if (daysLeft <= 7) return { label: `${daysLeft} days left`, color: colors.orange, icon: "calendar-outline", urgency: "medium" };
  return { label: `${daysLeft} days left`, color: colors.green, icon: "calendar-outline", urgency: "low" };
}

function statusColorFn(status: string, colors: ReturnType<typeof useColors>): string {
  const map: Record<string, string> = {
    applied: colors.statusApplied,
    interview: colors.statusInterview,
    offer: colors.statusOffer,
    rejected: colors.statusRejected,
    withdrawn: colors.statusWithdrawn,
    waiting: colors.statusWaiting,
  };
  return map[status] || colors.primary;
}

function classificationColor(cls: string, colors: ReturnType<typeof useColors>): string {
  const map: Record<string, string> = {
    interview_invite: colors.classInterview,
    offer: colors.classOffer,
    rejection: colors.classRejection,
    assessment: colors.classAssessment,
    follow_up: colors.classFollowUp,
    other: colors.classOther,
  };
  return map[cls] || colors.primary;
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 16,
    },
    greeting: { fontSize: 24, fontWeight: "700" },
    subtitle: { fontSize: 13, marginTop: 2 },
    iconBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: "center",
      justifyContent: "center", borderWidth: 1,
    },
    banner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      marginHorizontal: 16, marginBottom: 16, borderRadius: 12, padding: 12, borderWidth: 1,
    },
    bannerText: { flex: 1, fontSize: 13 },
    statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 20 },
    statCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, gap: 2 },
    statValue: { fontSize: 22, fontWeight: "700" },
    statLabel: { fontSize: 11 },
    quickActionsRow: {
      flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 24,
      backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    section: { paddingHorizontal: 16, marginBottom: 24 },
    alertCard: {
      flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12,
      padding: 14, marginBottom: 8, borderWidth: 1,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    alertLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
    alertSubject: { fontSize: 13, fontWeight: "500" },
    alertFrom: { fontSize: 11, marginTop: 2 },
    emptyCard: {
      alignItems: "center", paddingVertical: 32, borderRadius: 12,
      borderWidth: 1, gap: 12,
    },
    emptyText: { fontSize: 14 },
    emptyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
    emptyBtnText: { fontSize: 13, fontWeight: "600" },
    appCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1,
    },
    appCompany: { fontSize: 15, fontWeight: "600" },
    appRole: { fontSize: 13, marginTop: 2 },
    appDate: { fontSize: 11, marginTop: 4 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    badgeText: { fontSize: 11, fontWeight: "600" },
  });
}
