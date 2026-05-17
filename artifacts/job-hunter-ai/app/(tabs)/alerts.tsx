import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Share, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { db } from "@/src/services/storage";
import { gmailService } from "@/src/services/gmail";
import { useColors } from "@/hooks/useColors";
import { EmailAlert, CLASSIFICATION_LABELS } from "@/src/types";

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [alerts, setAlerts] = useState<EmailAlert[]>([]);
  const [selected, setSelected] = useState<EmailAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await db.getAlerts(false);
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  const clsColor = (cls: string) => {
    const map: Record<string, string> = {
      interview_invite: colors.classInterview,
      offer: colors.classOffer,
      rejection: colors.classRejection,
      assessment: colors.classAssessment,
      follow_up: colors.classFollowUp,
      other: colors.classOther,
    };
    return map[cls] || colors.primary;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (selected) {
    const color = clsColor(selected.classification);
    const label = CLASSIFICATION_LABELS[selected.classification] || "Email";
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 14 }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>Email Detail</Text>
        </View>

        <FlatList
          data={[]}
          renderItem={() => null}
          keyExtractor={() => "e"}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 50 : 40 }}
          ListHeaderComponent={
            <>
              <View style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: color + "22", borderWidth: 1, borderColor: color + "44", marginBottom: 14 }}>
                <Text style={{ color, fontWeight: "600", fontSize: 13 }}>{label}</Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>{selected.subject}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>From: {selected.from_email}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: 20 }}>
                {format(new Date(selected.received_at), "MMM d, yyyy 'at' h:mm a")}
              </Text>

              {selected.ai_summary ? (
                <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.primary + "33" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Ionicons name="sparkles" size={13} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>AI Summary</Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{selected.ai_summary}</Text>
                </View>
              ) : null}

              {selected.suggested_reply ? (
                <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.green + "33" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Ionicons name="mail-outline" size={13} color={colors.green} />
                    <Text style={{ color: colors.green, fontWeight: "600", fontSize: 13 }}>Suggested Reply</Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{selected.suggested_reply}</Text>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}
                    onPress={() => Share.share({ message: selected.suggested_reply || "" })}
                  >
                    <Ionicons name="copy-outline" size={14} color={colors.green} />
                    <Text style={{ color: colors.green, fontSize: 13 }}>Copy Reply</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!selected.is_read && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 999, padding: 16, marginTop: 8 }}
                  onPress={() => markRead(selected)}
                >
                  <Ionicons name="checkmark-done" size={18} color={colors.primaryForeground} />
                  <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>Mark as Read</Text>
                </TouchableOpacity>
              )}
            </>
          }
        />
      </View>
    );
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 14 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>Email Alerts</Text>
        <TouchableOpacity
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: checking ? colors.primary : colors.border }}
          onPress={checkNow}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Ionicons name="refresh" size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      {unreadCount > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.orange + "22", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.orange + "44" }}>
          <Ionicons name="notifications" size={14} color={colors.orange} />
          <Text style={{ color: colors.orange, fontSize: 13 }}>{unreadCount} unread email{unreadCount > 1 ? "s" : ""}</Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: Platform.OS === "web" ? 50 : 40 }}
        scrollEnabled={!!alerts.length}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Ionicons name="mail-outline" size={44} color={colors.textMuted} />
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16, marginTop: 12 }}>No emails yet</Text>
            <Text style={{ color: colors.textMuted, marginTop: 6, textAlign: "center" }}>
              Connect Gmail in Settings and tap refresh
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = clsColor(item.classification);
          const label = CLASSIFICATION_LABELS[item.classification] || "Email";
          return (
            <TouchableOpacity
              style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: item.is_read ? colors.border : colors.elevated }}
              onPress={() => setSelected(item)}
            >
              <View style={{ width: 4, backgroundColor: color }} />
              <View style={{ flex: 1, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {format(new Date(item.received_at), "MMM d")}
                  </Text>
                </View>
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13, marginTop: 4 }} numberOfLines={1}>
                  {item.subject}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  {item.from_email}
                </Text>
                {item.ai_summary && (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6, fontStyle: "italic" }} numberOfLines={2}>
                    {item.ai_summary}
                  </Text>
                )}
              </View>
              {!item.is_read && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, position: "absolute", top: 16, right: 14 }} />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
