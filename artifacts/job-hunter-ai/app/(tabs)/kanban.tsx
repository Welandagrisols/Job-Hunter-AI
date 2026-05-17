import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { db, JobApplication } from "@/src/services/storage";
import { theme } from "@/src/theme";
import { format } from "date-fns";

const COLUMNS = [
  { key: "applied", label: "Applied", color: theme.colors.accent.cyan },
  { key: "waiting", label: "Waiting", color: theme.colors.accent.orange },
  { key: "interview", label: "Interview", color: theme.colors.accent.green },
  { key: "offer", label: "Offer", color: theme.colors.accent.gold },
  { key: "rejected", label: "Rejected", color: theme.colors.accent.red },
];

const NEXT_STATUS: Record<string, string> = {
  applied: "waiting",
  waiting: "interview",
  interview: "offer",
  offer: "offer",
  rejected: "applied",
};

export default function KanbanScreen() {
  const router = useRouter();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = async () => {
    const apps = await db.getApplications();
    setApplications(apps);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const moveCard = async (app: JobApplication, newStatus: string) => {
    setMovingId(app.id);
    await db.updateApplication(app.id, { status: newStatus as any });
    await load();
    setMovingId(null);
  };

  const showMoveOptions = (app: JobApplication) => {
    const options = COLUMNS
      .filter((c) => c.key !== app.status)
      .map((c) => ({
        text: `Move to ${c.label}`,
        onPress: () => moveCard(app, c.key),
      }));

    Alert.alert(
      app.company,
      `Current: ${app.status}\nMove to:`,
      [...options, { text: "Cancel", style: "cancel" as const }]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
      </View>
    );
  }

  const totalByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = applications.filter((a) => a.status === col.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kanban Board</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/add-application")}
        >
          <Ionicons name="add" size={22} color={theme.colors.bg.primary} />
        </TouchableOpacity>
      </View>

      {/* Column summary pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillContainer}>
        {COLUMNS.map((col) => (
          <View key={col.key} style={[styles.pill, { borderColor: col.color + "55", backgroundColor: col.color + "11" }]}>
            <Text style={[styles.pillCount, { color: col.color }]}>{totalByStatus[col.key]}</Text>
            <Text style={[styles.pillLabel, { color: col.color }]}>{col.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Kanban columns - horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.board} contentContainerStyle={styles.boardContent}>
        {COLUMNS.map((col) => {
          const colApps = applications.filter((a) => a.status === col.key);

          return (
            <View key={col.key} style={styles.column}>
              <View style={[styles.colHeader, { borderTopColor: col.color }]}>
                <Text style={[styles.colTitle, { color: col.color }]}>{col.label}</Text>
                <View style={[styles.colBadge, { backgroundColor: col.color + "22" }]}>
                  <Text style={[styles.colCount, { color: col.color }]}>{colApps.length}</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.colScroll}>
                {colApps.length === 0 ? (
                  <View style={styles.emptyCol}>
                    <Text style={styles.emptyColText}>No jobs here</Text>
                  </View>
                ) : (
                  colApps.map((app) => (
                    <KanbanCard
                      key={app.id}
                      app={app}
                      color={col.color}
                      moving={movingId === app.id}
                      onPress={() => router.push({ pathname: "/add-application", params: { id: app.id } })}
                      onLongPress={() => showMoveOptions(app)}
                      onMove={() => {
                        const next = NEXT_STATUS[app.status];
                        if (next) moveCard(app, next);
                      }}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.hint}>
        <Ionicons name="information-circle-outline" size={14} color={theme.colors.text.muted} />
        <Text style={styles.hintText}>Tap card to view · Long press to move · Arrow to advance</Text>
      </View>
    </View>
  );
}

function KanbanCard({ app, color, moving, onPress, onLongPress, onMove }: any) {
  const daysSince = Math.floor(
    (Date.now() - new Date(app.date_applied).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <TouchableOpacity
      style={[styles.card, moving && styles.cardMoving]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {moving ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <>
          <View style={styles.cardTop}>
            <Text style={styles.cardCompany} numberOfLines={1}>{app.company}</Text>
            <TouchableOpacity onPress={onMove} style={styles.moveBtn}>
              <Ionicons name="arrow-forward-circle" size={20} color={color} />
            </TouchableOpacity>
          </View>

          <Text style={styles.cardRole} numberOfLines={2}>{app.role}</Text>

          <View style={styles.cardBottom}>
            <Text style={styles.cardDays}>{daysSince}d ago</Text>
            {app.deadline && (
              <Text style={styles.cardDeadline}>
                Due {format(new Date(app.deadline), "MMM d")}
              </Text>
            )}
          </View>

          {app.location && (
            <View style={styles.cardLocation}>
              <Ionicons name="location-outline" size={10} color={theme.colors.text.muted} />
              <Text style={styles.cardLocationText} numberOfLines={1}>{app.location}</Text>
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const COLUMN_WIDTH = 200;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.sm },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  addBtn: { width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.accent.cyan, alignItems: "center", justifyContent: "center" },
  pillScroll: { maxHeight: 50 },
  pillContainer: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, alignItems: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: theme.spacing.sm, paddingVertical: 6, borderRadius: theme.radius.full, borderWidth: 1 },
  pillCount: { fontSize: theme.font.sizes.md, fontWeight: theme.font.weights.bold },
  pillLabel: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.medium },
  board: { flex: 1, marginTop: theme.spacing.sm },
  boardContent: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: 20 },
  column: { width: COLUMN_WIDTH, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.bg.border },
  colHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md, borderTopWidth: 3 },
  colTitle: { fontWeight: theme.font.weights.bold, fontSize: theme.font.sizes.md },
  colBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  colCount: { fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.bold },
  colScroll: { maxHeight: 500 },
  emptyCol: { alignItems: "center", padding: theme.spacing.lg },
  emptyColText: { color: theme.colors.text.muted, fontSize: theme.font.sizes.sm },
  card: { margin: theme.spacing.sm, marginTop: 0, backgroundColor: theme.colors.bg.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.bg.border, minHeight: 80 },
  cardMoving: { opacity: 0.5, alignItems: "center", justifyContent: "center" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardCompany: { flex: 1, color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.sm },
  moveBtn: { padding: 2 },
  cardRole: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.xs, marginTop: 4, lineHeight: 16 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing.sm },
  cardDays: { color: theme.colors.text.muted, fontSize: 10 },
  cardDeadline: { color: theme.colors.accent.orange, fontSize: 10 },
  cardLocation: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  cardLocationText: { color: theme.colors.text.muted, fontSize: 10 },
  hint: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  hintText: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs },
});
