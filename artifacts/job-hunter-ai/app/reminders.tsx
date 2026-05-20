import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db, FollowUpCandidate } from "@/src/services/storage";
import { aiService } from "@/src/services/claude";
import { notificationService } from "@/src/services/notifications";
import { theme } from "@/src/theme";

const THRESHOLD_OPTIONS = [
  { label: "5 days", value: 5 },
  { label: "7 days", value: 7 },
  { label: "10 days", value: 10 },
  { label: "14 days", value: 14 },
  { label: "21 days", value: 21 },
];

const URGENCY_CONFIG = {
  critical: {
    label: "Needs Urgent Follow-up",
    color: theme.colors.accent.red,
    bg: theme.colors.accent.redDim,
    icon: "alert-circle" as const,
    desc: "No reply in a very long time",
  },
  due: {
    label: "Follow-up Due",
    color: theme.colors.accent.orange,
    bg: theme.colors.accent.orangeDim,
    icon: "time" as const,
    desc: "Past your follow-up threshold",
  },
  upcoming: {
    label: "Coming Up",
    color: theme.colors.accent.cyan,
    bg: theme.colors.accent.cyanDim,
    icon: "notifications-outline" as const,
    desc: "Just crossed your threshold",
  },
};

export default function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [candidates, setCandidates] = useState<FollowUpCandidate[]>([]);
  const [threshold, setThreshold] = useState(7);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async (t?: number) => {
    const savedThreshold = t ?? (await db.getFollowUpThreshold());
    setThreshold(savedThreshold);
    const data = await db.getFollowUpCandidates(savedThreshold);
    setCandidates(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeThreshold = async (days: number) => {
    setLoading(true);
    await db.setFollowUpThreshold(days);
    await load(days);
  };

  const draftFollowUp = async (candidate: FollowUpCandidate) => {
    const { app, daysSinceApplied } = candidate;
    setDrafting(app.id);
    try {
      const email = await aiService.generateFollowUp(app.company, app.role, daysSinceApplied);
      setDrafts((prev) => ({ ...prev, [app.id]: email }));
      setExpanded((prev) => ({ ...prev, [app.id]: true }));
    } catch (err: any) {
      Alert.alert("Could not draft email", err?.message || "Please try again.");
    } finally {
      setDrafting(null);
    }
  };

  const shareEmail = async (app: { company: string; role: string }, text: string) => {
    try {
      await Share.share({
        message: text,
        title: `Follow-up: ${app.role} at ${app.company}`,
      });
    } catch {}
  };

  const scheduleReminder = async (candidate: FollowUpCandidate) => {
    try {
      const granted = await notificationService.requestPermissions();
      if (!granted) {
        Alert.alert("Permission needed", "Allow notifications to schedule a reminder.");
        return;
      }
      await notificationService.scheduleFollowUpReminder(
        candidate.app.company,
        candidate.app.role,
        candidate.app.id,
        1
      );
      Alert.alert("Reminder set!", `You'll be reminded tomorrow to follow up on ${candidate.app.role} at ${candidate.app.company}.`);
    } catch {
      Alert.alert("Could not schedule", "Please try again.");
    }
  };

  const grouped = {
    critical: candidates.filter((c) => c.urgency === "critical"),
    due: candidates.filter((c) => c.urgency === "due"),
    upcoming: candidates.filter((c) => c.urgency === "upcoming"),
  };

  const totalCount = candidates.length;
  const urgentCount = grouped.critical.length + grouped.due.length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Follow-up Reminders</Text>
          <Text style={styles.subtitle}>
            {loading ? "Loading..." : totalCount === 0
              ? "All caught up!"
              : `${urgentCount > 0 ? `${urgentCount} urgent · ` : ""}${totalCount} application${totalCount !== 1 ? "s" : ""} need attention`}
          </Text>
        </View>
        {!loading && urgentCount > 0 && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>{urgentCount}</Text>
          </View>
        )}
      </View>

      {/* Threshold selector */}
      <View style={styles.thresholdCard}>
        <View style={styles.thresholdHeader}>
          <Ionicons name="timer-outline" size={16} color={theme.colors.accent.cyan} />
          <Text style={styles.thresholdLabel}>Flag applications after</Text>
        </View>
        <View style={styles.thresholdOptions}>
          {THRESHOLD_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.thresholdPill,
                threshold === opt.value && styles.thresholdPillActive,
              ]}
              onPress={() => changeThreshold(opt.value)}
            >
              <Text style={[
                styles.thresholdPillText,
                threshold === opt.value && styles.thresholdPillTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.thresholdHint}>
          Applications in "Applied" or "Waiting" status with no update after this period will appear here.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
        </View>
      ) : totalCount === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="checkmark-circle" size={48} color={theme.colors.accent.green} />
          </View>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyText}>
            No applications have gone silent longer than {threshold} days.{"\n"}
            Keep following up regularly to stay on recruiters' radar.
          </Text>
        </View>
      ) : (
        (["critical", "due", "upcoming"] as const).map((urgency) => {
          const group = grouped[urgency];
          if (group.length === 0) return null;
          const cfg = URGENCY_CONFIG[urgency];
          return (
            <View key={urgency} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                </View>
                <View>
                  <Text style={[styles.groupTitle, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.groupDesc}>{cfg.desc}</Text>
                </View>
                <View style={[styles.groupCount, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.groupCountText, { color: cfg.color }]}>{group.length}</Text>
                </View>
              </View>

              {group.map((candidate) => (
                <CandidateCard
                  key={candidate.app.id}
                  candidate={candidate}
                  cfg={cfg}
                  draft={drafts[candidate.app.id]}
                  isDrafting={drafting === candidate.app.id}
                  isExpanded={!!expanded[candidate.app.id]}
                  onToggleExpand={() =>
                    setExpanded((prev) => ({ ...prev, [candidate.app.id]: !prev[candidate.app.id] }))
                  }
                  onDraft={() => draftFollowUp(candidate)}
                  onShare={() => shareEmail(candidate.app, drafts[candidate.app.id])}
                  onSchedule={() => scheduleReminder(candidate)}
                />
              ))}
            </View>
          );
        })
      )}

      {!loading && totalCount > 0 && (
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={16} color={theme.colors.accent.gold} />
          <Text style={styles.tipText}>
            A short, polite follow-up after 7–10 days can significantly increase your response rate. 
            Keep it under 4 sentences — recruiters appreciate brevity.
          </Text>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

type UrgencyCfg = { label: string; color: string; bg: string; icon: string; desc: string };

function CandidateCard({
  candidate, cfg, draft, isDrafting, isExpanded,
  onToggleExpand, onDraft, onShare, onSchedule,
}: {
  candidate: FollowUpCandidate;
  cfg: UrgencyCfg;
  draft?: string;
  isDrafting: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDraft: () => void;
  onShare: () => void;
  onSchedule: () => void;
}) {
  const { app, daysSinceApplied } = candidate;

  return (
    <View style={[styles.card, { borderLeftColor: cfg.color, borderLeftWidth: 3 }]}>
      {/* App info row */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardCompany}>{app.company}</Text>
          <Text style={styles.cardRole} numberOfLines={1}>{app.role}</Text>
          {app.location ? (
            <Text style={styles.cardLocation}>{app.location}</Text>
          ) : null}
        </View>
        <View style={styles.cardDays}>
          <Text style={[styles.cardDaysNum, { color: cfg.color }]}>{daysSinceApplied}</Text>
          <Text style={styles.cardDaysLabel}>days ago</Text>
        </View>
      </View>

      {/* Applied date */}
      <Text style={styles.cardDate}>
        Applied {new Date(app.date_applied).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
      </Text>

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary, isDrafting && styles.actionBtnDisabled]}
          onPress={draft ? onToggleExpand : onDraft}
          disabled={isDrafting}
        >
          {isDrafting ? (
            <ActivityIndicator size="small" color={theme.colors.text.inverse} />
          ) : (
            <Ionicons
              name={draft ? (isExpanded ? "chevron-up" : "eye-outline") : "sparkles-outline"}
              size={15}
              color={theme.colors.text.inverse}
            />
          )}
          <Text style={styles.actionBtnPrimaryText}>
            {isDrafting ? "Drafting..." : draft ? (isExpanded ? "Hide Draft" : "Show Draft") : "AI Draft"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onSchedule}>
          <Ionicons name="notifications-outline" size={15} color={theme.colors.accent.cyan} />
          <Text style={styles.actionBtnText}>Remind Me</Text>
        </TouchableOpacity>
      </View>

      {/* Draft email */}
      {isExpanded && draft && (
        <View style={styles.draftContainer}>
          <View style={styles.draftHeader}>
            <Text style={styles.draftTitle}>Draft Follow-up Email</Text>
            <TouchableOpacity onPress={onShare} style={styles.copyBtn}>
              <Ionicons name="share-outline" size={14} color={theme.colors.accent.cyan} />
              <Text style={styles.copyBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.draftText}>{draft}</Text>
          <TouchableOpacity style={styles.regenerateBtn} onPress={onDraft}>
            <Ionicons name="refresh-outline" size={13} color={theme.colors.text.muted} />
            <Text style={styles.regenerateBtnText}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { paddingTop: 80, alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.colors.bg.card,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.muted, fontSize: 12, marginTop: 1 },
  urgentBadge: {
    backgroundColor: theme.colors.accent.red,
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  urgentBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  thresholdCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  thresholdHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  thresholdLabel: { color: theme.colors.text.primary, fontWeight: "600", fontSize: 14 },
  thresholdOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thresholdPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  thresholdPillActive: {
    backgroundColor: theme.colors.accent.cyanDim,
    borderColor: theme.colors.accent.cyan,
  },
  thresholdPillText: { color: theme.colors.text.muted, fontSize: 12, fontWeight: "500" },
  thresholdPillTextActive: { color: theme.colors.accent.cyan, fontWeight: "700" },
  thresholdHint: { color: theme.colors.text.muted, fontSize: 11, marginTop: 10, lineHeight: 16 },

  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.accent.greenDim,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  emptyTitle: { color: theme.colors.text.primary, fontSize: 20, fontWeight: "700" },
  emptyText: { color: theme.colors.text.muted, fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 8 },

  group: { marginHorizontal: 16, marginBottom: 20 },
  groupHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  groupIcon: {
    width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  groupTitle: { fontSize: 13, fontWeight: "700" },
  groupDesc: { color: theme.colors.text.muted, fontSize: 10 },
  groupCount: {
    marginLeft: "auto",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
  },
  groupCountText: { fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: theme.colors.bg.card,
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  cardCompany: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 16 },
  cardRole: { color: theme.colors.text.secondary, fontSize: 13, marginTop: 1 },
  cardLocation: { color: theme.colors.text.muted, fontSize: 11, marginTop: 2 },
  cardDays: { alignItems: "center", minWidth: 48 },
  cardDaysNum: { fontSize: 26, fontWeight: "800", lineHeight: 30 },
  cardDaysLabel: { color: theme.colors.text.muted, fontSize: 10 },
  cardDate: { color: theme.colors.text.muted, fontSize: 11, marginBottom: 12 },

  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 100,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  actionBtnPrimary: {
    backgroundColor: theme.colors.accent.cyan,
    borderColor: theme.colors.accent.cyan,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: theme.colors.accent.cyan, fontSize: 13, fontWeight: "600" },
  actionBtnPrimaryText: { color: theme.colors.text.inverse, fontSize: 13, fontWeight: "700" },

  draftContainer: {
    marginTop: 12,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  draftHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
  },
  draftTitle: { color: theme.colors.text.secondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyBtnText: { color: theme.colors.accent.cyan, fontSize: 12, fontWeight: "600" },
  draftText: { color: theme.colors.text.primary, fontSize: 13, lineHeight: 20 },
  regenerateBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, alignSelf: "flex-end" },
  regenerateBtnText: { color: theme.colors.text.muted, fontSize: 11 },

  tipCard: {
    marginHorizontal: 16, marginBottom: 16,
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: theme.colors.accent.gold + "11",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: theme.colors.accent.gold + "33",
  },
  tipText: { flex: 1, color: theme.colors.text.muted, fontSize: 12, lineHeight: 18 },
});
