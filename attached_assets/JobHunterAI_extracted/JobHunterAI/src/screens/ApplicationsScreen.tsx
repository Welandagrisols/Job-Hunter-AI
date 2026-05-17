import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { db, JobApplication } from "../services/supabase";
import { theme } from "../theme";
import { format } from "date-fns";

const STATUS_FILTERS = ["all", "applied", "interview", "offer", "rejected", "waiting"];

export default function ApplicationsScreen({ navigation }: any) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [filtered, setFiltered] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadApps = async () => {
    try {
      const data = await db.getApplications();
      setApplications(data || []);
      applyFilters(data || [], search, statusFilter);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadApps(); }, []));

  const applyFilters = (apps: JobApplication[], q: string, status: string) => {
    let result = apps;
    if (status !== "all") result = result.filter((a) => a.status === status);
    if (q) {
      const lower = q.toLowerCase();
      result = result.filter(
        (a) => a.company.toLowerCase().includes(lower) || a.role.toLowerCase().includes(lower)
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
    Alert.alert(
      "Delete Application",
      `Remove your application to ${company}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            await db.deleteApplication(id);
            loadApps();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Applications</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("AddApplication")}
        >
          <Ionicons name="add" size={22} color={theme.colors.bg.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={theme.colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search company or role..."
          placeholderTextColor={theme.colors.text.muted}
          value={search}
          onChangeText={handleSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status filters */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const color = item === "all"
            ? theme.colors.accent.cyan
            : (theme.colors.status as any)[item];
          const active = statusFilter === item;
          return (
            <TouchableOpacity
              style={[styles.filterChip, active && { backgroundColor: color + "22", borderColor: color + "55" }]}
              onPress={() => handleStatusFilter(item)}
            >
              <Text style={[styles.filterText, active && { color }]}>
                {item === "all" ? "All" : (theme.statusLabels as any)[item]}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Count */}
      <Text style={styles.count}>{filtered.length} application{filtered.length !== 1 ? "s" : ""}</Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color={theme.colors.text.muted} />
            <Text style={styles.emptyText}>No applications found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusColor = (theme.colors.status as any)[item.status];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("ApplicationDetail", { id: item.id })}
              onLongPress={() => deleteApp(item.id, item.company)}
            >
              <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <Text style={styles.company}>{item.company}</Text>
                  <View style={[styles.badge, { backgroundColor: statusColor + "22", borderColor: statusColor + "55" }]}>
                    <Text style={[styles.badgeText, { color: statusColor }]}>
                      {(theme.statusLabels as any)[item.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.role}>{item.role}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.date}>Applied {format(new Date(item.date_applied), "MMM d, yyyy")}</Text>
                  {item.deadline && (
                    <Text style={styles.deadline}>
                      Deadline: {format(new Date(item.deadline), "MMM d")}
                    </Text>
                  )}
                </View>
                {item.notes ? <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text> : null}
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
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  addBtn: {
    width: 40, height: 40, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.cyan,
    alignItems: "center", justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bg.card,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  searchInput: { flex: 1, color: theme.colors.text.primary, fontSize: theme.font.sizes.md },
  filterScroll: { marginBottom: theme.spacing.xs },
  filterContainer: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm },
  filterChip: {
    paddingHorizontal: theme.spacing.md, paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.card,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  filterText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm },
  count: { color: theme.colors.text.muted, fontSize: theme.font.sizes.sm, paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm },
  list: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: 40 },
  card: {
    flexDirection: "row", backgroundColor: theme.colors.bg.card,
    borderRadius: theme.radius.md, overflow: "hidden",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  statusBar: { width: 4 },
  cardContent: { flex: 1, padding: theme.spacing.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  company: { flex: 1, color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.md },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full, borderWidth: 1 },
  badgeText: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  role: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, marginTop: 4 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  date: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs },
  deadline: { color: theme.colors.accent.orange, fontSize: theme.font.sizes.xs },
  notes: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 4, fontStyle: "italic" },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: { color: theme.colors.text.muted, marginTop: theme.spacing.md },
});
