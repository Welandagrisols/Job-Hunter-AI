import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { db } from "@/src/services/storage";
import { useColors } from "@/hooks/useColors";
import { JobApplication, STATUS_LABELS } from "@/src/types";

function getDeadlineInfo(deadlineStr: string, colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / msPerDay);

  if (daysLeft < 0) return { label: "Overdue", color: colors.destructive, icon: "alert-circle" as const };
  if (daysLeft === 0) return { label: "Due today!", color: colors.destructive, icon: "alert-circle" as const };
  if (daysLeft === 1) return { label: "1 day left", color: colors.destructive, icon: "time-outline" as const };
  if (daysLeft <= 3) return { label: `${daysLeft} days left`, color: colors.orange, icon: "time-outline" as const };
  if (daysLeft <= 7) return { label: `${daysLeft} days left`, color: colors.orange, icon: "calendar-outline" as const };
  return { label: `${daysLeft} days left`, color: colors.green, icon: "calendar-outline" as const };
}

const STATUS_FILTERS = ["all", "this_week", "applied", "interview", "offer", "rejected", "waiting", "withdrawn"];

function isThisWeek(app: JobApplication): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const week = new Date(now);
  week.setDate(week.getDate() + 7);

  if (app.deadline) {
    const d = new Date(app.deadline);
    if (!isNaN(d.getTime()) && d >= now && d <= week) return true;
  }
  if (app.interview_date) {
    const d = new Date(app.interview_date);
    if (!isNaN(d.getTime()) && d >= now && d <= week) return true;
  }
  return false;
}

export default function ApplicationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [filtered, setFiltered] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadApps = useCallback(async () => {
    try {
      const data = await db.getApplications();
      setApplications(data);
      applyFilters(data, search, statusFilter);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useFocusEffect(useCallback(() => { loadApps(); }, [loadApps]));

  const applyFilters = (apps: JobApplication[], q: string, status: string) => {
    let result = apps;
    if (status === "this_week") {
      result = result.filter(isThisWeek);
    } else if (status !== "all") {
      result = result.filter((a) => a.status === status);
    }
    if (q) {
      const lower = q.toLowerCase();
      result = result.filter((a) =>
        a.company.toLowerCase().includes(lower) || a.role.toLowerCase().includes(lower)
      );
    }
    setFiltered(result);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    applyFilters(applications, q, statusFilter);
  };

  const handleStatusFilter = (s: string) => {
    setStatusFilter(s);
    applyFilters(applications, search, s);
  };

  const deleteApp = (id: string, company: string) => {
    Alert.alert("Delete Application", `Remove your application to ${company}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await db.deleteApplication(id); loadApps(); } },
    ]);
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      applied: colors.statusApplied,
      interview: colors.statusInterview,
      offer: colors.statusOffer,
      rejected: colors.statusRejected,
      withdrawn: colors.statusWithdrawn,
      waiting: colors.statusWaiting,
    };
    return map[status] || colors.primary;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>Applications</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={{ height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 }}
              onPress={() => router.push("/(tabs)/kanban")}
            >
              <Ionicons name="grid-outline" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Kanban</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 }}
              onPress={() => router.push("/smart-import")}
            >
              <Ionicons name="sparkles" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Import</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
              onPress={() => router.push("/add-application")}
            >
              <Ionicons name="add" size={22} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Capture from URL shortcut */}
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}
          onPress={() => router.push("/job-capture")}
        >
          <Ionicons name="scan-outline" size={16} color={colors.green} />
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13 }}>Capture from job URL or paste text → AI auto-fills everything</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
          placeholder="Search company or role..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={handleSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={STATUS_FILTERS}
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const color = item === "all"
            ? colors.primary
            : item === "this_week"
              ? colors.green
              : statusColor(item);
          const active = statusFilter === item;
          const label = item === "all"
            ? "All"
            : item === "this_week"
              ? "⚡ This Week"
              : STATUS_LABELS[item];
          return (
            <TouchableOpacity
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
                backgroundColor: active ? color + "22" : colors.card,
                borderWidth: 1, borderColor: active ? color + "55" : colors.border,
              }}
              onPress={() => handleStatusFilter(item)}
            >
              <Text style={{ color: active ? color : colors.textSecondary, fontSize: 13, fontWeight: active ? "600" : "400" }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: 16, marginTop: 8, marginBottom: 4 }}>
        {filtered.length} application{filtered.length !== 1 ? "s" : ""}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: Platform.OS === "web" ? 50 : 40 }}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Ionicons name="briefcase-outline" size={44} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15, fontWeight: "600" }}>No applications found</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>Add your first application or use Job Capture</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = statusColor(item.status);
          return (
            <TouchableOpacity
              style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}
              onPress={() => router.push({ pathname: "/add-application", params: { id: item.id } })}
              onLongPress={() => deleteApp(item.id, item.company)}
            >
              <View style={{ width: 4, backgroundColor: color }} />
              <View style={{ flex: 1, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={{ flex: 1, color: colors.foreground, fontWeight: "600", fontSize: 15 }}>{item.company}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: color + "22", borderWidth: 1, borderColor: color + "55" }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color }}>{STATUS_LABELS[item.status]}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>{item.role}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Applied {format(new Date(item.date_applied), "MMM d, yyyy")}
                  </Text>
                  {item.deadline && (() => {
                    const dl = getDeadlineInfo(item.deadline, colors);
                    if (!dl) return null;
                    return (
                      <View style={{
                        flexDirection: "row", alignItems: "center", gap: 4,
                        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
                        backgroundColor: dl.color + "20",
                        borderWidth: 1, borderColor: dl.color + "50",
                      }}>
                        <Ionicons name={dl.icon} size={10} color={dl.color} />
                        <Text style={{ color: dl.color, fontSize: 10, fontWeight: "700" }}>{dl.label}</Text>
                      </View>
                    );
                  })()}
                </View>
                {item.location && (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>📍 {item.location}</Text>
                )}
                {item.notes ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, fontStyle: "italic" }} numberOfLines={1}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
