import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import * as Clipboard from "expo-clipboard";
import { db } from "@/src/services/storage";
import { useColors } from "@/hooks/useColors";
import { EmailAlert, CLASSIFICATION_LABELS } from "@/src/types";

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [alerts, setAlerts] = useState<EmailAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await db.getAlerts(false);
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 8, paddingHorizontal: 16, paddingBottom: 12 },
    title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
    subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    section: { marginHorizontal: 16, marginBottom: 20 },
    sectionTitle: {
      color: colors.textMuted, fontSize: 11, fontWeight: "700",
      textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
    },
    menuCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    menuRow: {
      flexDirection: "row", alignItems: "center", padding: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
    },
    menuRowLast: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
    menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    menuLabel: { flex: 1, color: colors.foreground, fontWeight: "600", fontSize: 15 },
    menuSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: colors.primary + "22" },
    badgeText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
    alertCard: {
      backgroundColor: colors.card, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8,
    },
    alertDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    alertBody: { flex: 1 },
    alertLabel: { fontSize: 11, fontWeight: "700" },
    alertSubject: { color: colors.foreground, fontWeight: "600", fontSize: 14, marginTop: 2 },
    alertFrom: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    alertSummary: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: "italic" },
    emptyAlerts: { alignItems: "center", padding: 24 },
    emptyText: { color: colors.textMuted, marginTop: 8, fontSize: 13 },
  });

  const NAV_ITEMS = [
    {
      icon: "grid-outline", label: "Kanban Board",
      sub: "Visual drag-and-drop pipeline",
      color: colors.purple, bg: colors.purple + "22",
      onPress: () => router.push("/kanban"),
    },
    {
      icon: "create-outline", label: "Content Studio",
      sub: "LinkedIn posts & blog articles",
      color: colors.green, bg: colors.green + "22",
      onPress: () => router.push("/content"),
    },
    {
      icon: "bar-chart-outline", label: "Statistics",
      sub: "Your job hunt analytics",
      color: colors.gold, bg: colors.gold + "22",
      onPress: () => router.push("/statistics"),
    },
    {
      icon: "person-outline", label: "Profile",
      sub: "Edit your professional details",
      color: colors.orange, bg: colors.orange + "22",
      onPress: () => router.push("/profile"),
    },
    {
      icon: "settings-outline", label: "Settings",
      sub: "API keys, Gmail, notifications",
      color: colors.textSecondary, bg: colors.elevated,
      onPress: () => router.push("/settings"),
    },
  ];

  const classColor: Record<string, string> = {
    interview_invite: colors.green,
    offer: colors.gold,
    rejection: colors.destructive,
    assessment: colors.purple,
    follow_up: colors.orange,
    other: colors.primary,
  };

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>More</Text>
        <Text style={s.subtitle}>Tools, alerts & settings</Text>
      </View>

      {/* Quick Navigation */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Quick Access</Text>
        <View style={s.menuCard}>
          {NAV_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={idx === NAV_ITEMS.length - 1 ? s.menuRowLast : s.menuRow}
              onPress={item.onPress}
            >
              <View style={[s.menuIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Email Alerts */}
      <View style={s.section}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={s.sectionTitle}>Email Alerts</Text>
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : alerts.length === 0 ? (
          <View style={s.emptyAlerts}>
            <Ionicons name="mail-outline" size={36} color={colors.textMuted} />
            <Text style={s.emptyText}>No email alerts yet</Text>
          </View>
        ) : (
          alerts.slice(0, 5).map((alert) => {
            const color = classColor[alert.classification] || colors.primary;
            const label = CLASSIFICATION_LABELS[alert.classification] || "Email";
            return (
              <TouchableOpacity
                key={alert.id}
                style={[s.alertCard, !alert.is_read && { borderColor: color + "44" }]}
                onPress={async () => {
                  await db.markAlertRead(alert.id);
                  load();
                  Alert.alert(
                    label,
                    `From: ${alert.from_email}\n\n${alert.ai_summary || alert.snippet}`,
                    [
                      {
                        text: "Copy Reply",
                        onPress: () => alert.suggested_reply && Clipboard.setStringAsync(alert.suggested_reply),
                      },
                      { text: "OK" },
                    ]
                  );
                }}
              >
                <View style={[s.alertDot, { backgroundColor: color }]} />
                <View style={s.alertBody}>
                  <Text style={[s.alertLabel, { color }]}>{label}</Text>
                  <Text style={s.alertSubject} numberOfLines={1}>{alert.subject}</Text>
                  <Text style={s.alertFrom} numberOfLines={1}>{alert.from_email}</Text>
                  {alert.ai_summary && (
                    <Text style={s.alertSummary} numberOfLines={2}>{alert.ai_summary}</Text>
                  )}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {format(new Date(alert.received_at), "MMM d")}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
