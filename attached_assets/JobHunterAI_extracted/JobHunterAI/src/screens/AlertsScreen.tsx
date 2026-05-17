import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { db, EmailAlert } from "../services/supabase";
import { gmailService } from "../services/gmail";
import { theme } from "../theme";
import { format } from "date-fns";

export default function AlertsScreen({ navigation }: any) {
  const [alerts, setAlerts] = useState<EmailAlert[]>([]);
  const [selected, setSelected] = useState<EmailAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = async () => {
    try {
      const data = await db.getAlerts(false);
      setAlerts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const checkNow = async () => {
    const connected = await gmailService.isSignedIn();
    if (!connected) {
      Alert.alert("Not Connected", "Please connect your Gmail in Settings first.");
      return;
    }
    setChecking(true);
    const count = await gmailService.checkForNewEmails();
    await load();
    setChecking(false);
    if (count === 0) Alert.alert("All caught up!", "No new recruiter emails found.");
    else Alert.alert("Found emails!", `${count} new recruiter email${count > 1 ? "s" : ""} detected.`);
  };

  const markRead = async (alert: EmailAlert) => {
    await db.markAlertRead(alert.id);
    await load();
    setSelected(null);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.accent.cyan} size="large" /></View>;
  }

  // Alert detail view
  if (selected) {
    const color = (theme.colors.classificationColors as any)[selected.classification] || theme.colors.accent.cyan;
    const label = (theme.classificationLabels as any)[selected.classification] || "Email";

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Email Detail</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={[]}
          ListHeaderComponent={
            <View style={styles.detailContainer}>
              <View style={[styles.classificationBanner, { backgroundColor: color + "22", borderColor: color + "44" }]}>
                <Text style={[styles.classificationLabel, { color }]}>{label}</Text>
              </View>

              <Text style={styles.detailSubject}>{selected.subject}</Text>
              <Text style={styles.detailFrom}>From: {selected.from_email}</Text>
              <Text style={styles.detailDate}>
                {format(new Date(selected.received_at), "MMM d, yyyy 'at' h:mm a")}
              </Text>

              {selected.ai_summary ? (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryHeader}>
                    <Ionicons name="sparkles" size={14} color={theme.colors.accent.cyan} />
                    <Text style={styles.summaryTitle}>AI Summary</Text>
                  </View>
                  <Text style={styles.summaryText}>{selected.ai_summary}</Text>
                </View>
              ) : null}

              {selected.suggested_reply ? (
                <View style={styles.replyCard}>
                  <View style={styles.summaryHeader}>
                    <Ionicons name="mail-outline" size={14} color={theme.colors.accent.green} />
                    <Text style={[styles.summaryTitle, { color: theme.colors.accent.green }]}>
                      Suggested Reply
                    </Text>
                  </View>
                  <Text style={styles.replyText}>{selected.suggested_reply}</Text>
                  <TouchableOpacity
                    style={styles.shareReplyBtn}
                    onPress={() => Share.share({ message: selected.suggested_reply || "" })}
                  >
                    <Ionicons name="share-outline" size={16} color={theme.colors.accent.green} />
                    <Text style={styles.shareReplyText}>Copy Reply</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.detailActions}>
                {!selected.is_read && (
                  <TouchableOpacity style={styles.markReadBtn} onPress={() => markRead(selected)}>
                    <Ionicons name="checkmark-done" size={18} color={theme.colors.bg.primary} />
                    <Text style={styles.markReadText}>Mark as Read</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          renderItem={() => null}
          keyExtractor={() => "empty"}
        />
      </View>
    );
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Email Alerts</Text>
        <TouchableOpacity
          style={[styles.checkBtn, checking && styles.checkBtnActive]}
          onPress={checkNow}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color={theme.colors.accent.cyan} size="small" />
            : <Ionicons name="refresh" size={20} color={theme.colors.accent.cyan} />
          }
        </TouchableOpacity>
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Ionicons name="notifications" size={16} color={theme.colors.accent.orange} />
          <Text style={styles.unreadText}>{unreadCount} unread email{unreadCount > 1 ? "s" : ""}</Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="mail-outline" size={48} color={theme.colors.text.muted} />
            <Text style={styles.emptyTitle}>No emails yet</Text>
            <Text style={styles.emptyText}>Tap the refresh button to check your Gmail</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = (theme.colors.classificationColors as any)[item.classification] || theme.colors.accent.cyan;
          const label = (theme.classificationLabels as any)[item.classification] || "Email";

          return (
            <TouchableOpacity
              style={[styles.alertCard, !item.is_read && styles.alertCardUnread]}
              onPress={() => setSelected(item)}
            >
              <View style={[styles.alertLeft, { borderLeftColor: color }]}>
                {!item.is_read && <View style={[styles.dot, { backgroundColor: color }]} />}
              </View>
              <View style={styles.alertBody}>
                <View style={styles.alertTop}>
                  <Text style={[styles.alertLabel, { color }]}>{label}</Text>
                  <Text style={styles.alertTime}>
                    {format(new Date(item.received_at), "MMM d")}
                  </Text>
                </View>
                <Text style={styles.alertSubject} numberOfLines={1}>{item.subject}</Text>
                <Text style={styles.alertFrom} numberOfLines={1}>{item.from_email}</Text>
                {item.ai_summary && (
                  <Text style={styles.alertSummary} numberOfLines={2}>{item.ai_summary}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.bg.primary },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  checkBtn: {
    width: 44, height: 44, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.card, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  checkBtnActive: { borderColor: theme.colors.accent.cyan },
  unreadBanner: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.accent.orangeDim,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.accent.orange + "44",
  },
  unreadText: { color: theme.colors.accent.orange, fontSize: theme.font.sizes.sm },
  list: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: 40 },
  alertCard: {
    flexDirection: "row", backgroundColor: theme.colors.bg.card,
    borderRadius: theme.radius.md, overflow: "hidden",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  alertCardUnread: { borderColor: theme.colors.bg.elevated },
  alertLeft: { width: 4, borderLeftWidth: 4, borderLeftColor: "transparent" },
  dot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 12, left: -2 },
  alertBody: { flex: 1, padding: theme.spacing.md },
  alertTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alertLabel: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  alertTime: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs },
  alertSubject: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.sm, marginTop: 4 },
  alertFrom: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.xs, marginTop: 2 },
  alertSummary: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 6, fontStyle: "italic" },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, marginTop: theme.spacing.md, fontSize: theme.font.sizes.lg },
  emptyText: { color: theme.colors.text.muted, marginTop: theme.spacing.sm, textAlign: "center" },
  // Detail view
  detailContainer: { padding: theme.spacing.md },
  classificationBanner: {
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
    borderWidth: 1, alignSelf: "flex-start", marginBottom: theme.spacing.md,
  },
  classificationLabel: { fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.sm },
  detailSubject: { color: theme.colors.text.primary, fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.bold, marginBottom: theme.spacing.sm },
  detailFrom: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm },
  detailDate: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 4, marginBottom: theme.spacing.lg },
  summaryCard: {
    backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "33",
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  summaryTitle: { color: theme.colors.accent.cyan, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.sm },
  summaryText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, lineHeight: 20 },
  replyCard: {
    backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.accent.green + "33",
  },
  replyText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, lineHeight: 20 },
  shareReplyBtn: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.xs,
    marginTop: theme.spacing.md, padding: theme.spacing.sm,
    borderTopWidth: 1, borderTopColor: theme.colors.bg.border,
  },
  shareReplyText: { color: theme.colors.accent.green, fontSize: theme.font.sizes.sm },
  detailActions: { marginTop: theme.spacing.md },
  markReadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent.cyan, borderRadius: theme.radius.full, padding: theme.spacing.md,
  },
  markReadText: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.bold },
});
