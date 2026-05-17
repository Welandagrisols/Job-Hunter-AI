import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { db, JobApplication, EmailAlert } from "../services/supabase";
import { gmailService } from "../services/gmail";
import { theme } from "../theme";
import { format } from "date-fns";

export default function DashboardScreen({ navigation }: any) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [alerts, setAlerts] = useState<EmailAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  const loadData = async () => {
    try {
      const [apps, emailAlerts, connected] = await Promise.all([
        db.getApplications(),
        db.getAlerts(false),
        gmailService.isSignedIn(),
      ]);
      setApplications(apps || []);
      setAlerts(emailAlerts || []);
      setGmailConnected(connected);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const checkEmails = async () => {
    if (!gmailConnected) {
      navigation.navigate("Settings");
      return;
    }
    setChecking(true);
    await gmailService.checkForNewEmails();
    await loadData();
    setChecking(false);
  };

  // Stats
  const stats = {
    total: applications.length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer: applications.filter((a) => a.status === "offer").length,
    unreadAlerts: alerts.filter((a) => !a.is_read).length,
  };

  const recentAlerts = alerts.filter((a) => !a.is_read).slice(0, 3);
  const recentApps = applications.slice(0, 5);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
          tintColor={theme.colors.accent.cyan}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day, Wesley 👋</Text>
          <Text style={styles.subtitle}>Your job hunt at a glance</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkBtn, checking && styles.checkBtnActive]}
          onPress={checkEmails}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color={theme.colors.accent.cyan} size="small" />
          ) : (
            <Ionicons name="mail-outline" size={22} color={theme.colors.accent.cyan} />
          )}
        </TouchableOpacity>
      </View>

      {/* Gmail Status Banner */}
      {!gmailConnected && (
        <TouchableOpacity
          style={styles.banner}
          onPress={() => navigation.navigate("Settings")}
        >
          <Ionicons name="warning-outline" size={18} color={theme.colors.accent.orange} />
          <Text style={styles.bannerText}>
            Connect Gmail to enable automatic email monitoring
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.accent.orange} />
        </TouchableOpacity>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatCard label="Applied" value={stats.total} color={theme.colors.accent.cyan} icon="briefcase-outline" />
        <StatCard label="Interviews" value={stats.interview} color={theme.colors.accent.green} icon="people-outline" />
        <StatCard label="Offers" value={stats.offer} color={theme.colors.accent.gold} icon="trophy-outline" />
        <StatCard label="Unread" value={stats.unreadAlerts} color={theme.colors.accent.orange} icon="notifications-outline" />
      </View>

      {/* Unread Alerts */}
      {recentAlerts.length > 0 && (
        <Section
          title="New Emails"
          onSeeAll={() => navigation.navigate("Alerts")}
        >
          {recentAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onPress={() => navigation.navigate("Alerts")}
            />
          ))}
        </Section>
      )}

      {/* Recent Applications */}
      <Section
        title="Recent Applications"
        onSeeAll={() => navigation.navigate("Applications")}
        onAdd={() => navigation.navigate("AddApplication")}
      >
        {recentApps.length === 0 ? (
          <EmptyState
            message="No applications yet. Start tracking your job hunt!"
            onAction={() => navigation.navigate("AddApplication")}
            actionLabel="Add First Application"
          />
        ) : (
          recentApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onPress={() => navigation.navigate("ApplicationDetail", { id: app.id })}
            />
          ))
        )}
      </Section>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatCard({ label, value, color, icon }: any) {
  return (
    <View style={[styles.statCard, { borderColor: color + "33" }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AlertCard({ alert, onPress }: { alert: any; onPress: () => void }) {
  const color = (theme.colors.classificationColors as any)[alert.classification] || theme.colors.accent.cyan;
  const label = (theme.classificationLabels as any)[alert.classification] || "Email";

  return (
    <TouchableOpacity style={styles.alertCard} onPress={onPress}>
      <View style={[styles.alertDot, { backgroundColor: color }]} />
      <View style={styles.alertContent}>
        <Text style={[styles.alertLabel, { color }]}>{label}</Text>
        <Text style={styles.alertSubject} numberOfLines={1}>{alert.subject}</Text>
        <Text style={styles.alertFrom} numberOfLines={1}>{alert.from_email}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.text.muted} />
    </TouchableOpacity>
  );
}

function AppCard({ app, onPress }: { app: JobApplication; onPress: () => void }) {
  const statusColor = (theme.colors.status as any)[app.status] || theme.colors.accent.cyan;

  return (
    <TouchableOpacity style={styles.appCard} onPress={onPress}>
      <View style={styles.appCardLeft}>
        <Text style={styles.appCompany}>{app.company}</Text>
        <Text style={styles.appRole}>{app.role}</Text>
        <Text style={styles.appDate}>
          Applied {format(new Date(app.date_applied), "MMM d, yyyy")}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor + "55" }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {(theme.statusLabels as any)[app.status]}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function Section({ title, onSeeAll, onAdd, children }: any) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionActions}>
          {onAdd && (
            <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
              <Ionicons name="add" size={18} color={theme.colors.accent.cyan} />
            </TouchableOpacity>
          )}
          {onSeeAll && (
            <TouchableOpacity onPress={onSeeAll}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

function EmptyState({ message, onAction, actionLabel }: any) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="briefcase-outline" size={40} color={theme.colors.text.muted} />
      <Text style={styles.emptyText}>{message}</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAction}>
        <Text style={styles.emptyBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.bg.primary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingTop: 60,
    paddingBottom: theme.spacing.md,
  },
  greeting: { fontSize: theme.font.sizes.xxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  subtitle: { fontSize: theme.font.sizes.sm, color: theme.colors.text.secondary, marginTop: 2 },
  checkBtn: {
    width: 44, height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  checkBtnActive: { borderColor: theme.colors.accent.cyan },
  banner: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.accent.orangeDim,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.accent.orange + "55",
    gap: 8,
  },
  bannerText: { flex: 1, color: theme.colors.accent.orange, fontSize: theme.font.sizes.sm },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    flex: 1, backgroundColor: theme.colors.bg.card,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
    alignItems: "center", borderWidth: 1,
  },
  statValue: { fontSize: theme.font.sizes.xxl, fontWeight: theme.font.weights.bold, marginTop: 4 },
  statLabel: { fontSize: theme.font.sizes.xs, color: theme.colors.text.secondary, marginTop: 2 },
  section: { paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.sm },
  sectionTitle: { fontSize: theme.font.sizes.lg, fontWeight: theme.font.weights.semibold, color: theme.colors.text.primary },
  sectionActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  addBtn: {
    width: 28, height: 28, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.cyanDim,
    alignItems: "center", justifyContent: "center",
  },
  seeAll: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm },
  alertCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.colors.bg.card,
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.bg.border,
    gap: theme.spacing.sm,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertContent: { flex: 1 },
  alertLabel: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  alertSubject: { color: theme.colors.text.primary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium, marginTop: 2 },
  alertFrom: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.xs, marginTop: 2 },
  appCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: theme.colors.bg.card,
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  appCardLeft: { flex: 1 },
  appCompany: { color: theme.colors.text.primary, fontSize: theme.font.sizes.md, fontWeight: theme.font.weights.semibold },
  appRole: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, marginTop: 2 },
  appDate: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 4 },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm, paddingVertical: 4,
    borderRadius: theme.radius.full, borderWidth: 1,
  },
  statusText: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  emptyState: { alignItems: "center", paddingVertical: theme.spacing.xl },
  emptyText: { color: theme.colors.text.secondary, textAlign: "center", marginTop: theme.spacing.sm },
  emptyBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.accent.cyanDim,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "55",
  },
  emptyBtnText: { color: theme.colors.accent.cyan, fontWeight: theme.font.weights.semibold },
});
