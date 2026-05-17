import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { feedService, FeedJob, JOB_SOURCES } from "@/src/services/feedService";
import { theme } from "@/src/theme";
import { formatDistanceToNow } from "date-fns";

const FILTERS = ["All", "High Match", "Kenya", "NGO/International", "East Africa", "Development"];

export default function FeedScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");
  const [loadingSource, setLoadingSource] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadCached = async () => {
    const cached = await feedService.getCachedFeed();
    const last = await feedService.getLastFetchTime();
    if (cached.length > 0) {
      setJobs(cached);
      setLastFetch(last);
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  const fetchFresh = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    setProgress({});

    try {
      const fresh = await feedService.fetchAllFeeds((source, count) => {
        setLoadingSource(source);
        setProgress((prev) => ({ ...prev, [source]: count }));
      });

      setJobs(fresh);
      setLastFetch(new Date());
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch {
      Alert.alert("Feed Error", "Some sources could not be fetched. Showing cached results.");
      await loadCached();
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingSource("");
    }
  };

  useFocusEffect(useCallback(() => {
    loadCached().then(async () => {
      const last = await feedService.getLastFetchTime();
      const stale = !last || Date.now() - last.getTime() > 30 * 60 * 1000;
      if (stale) fetchFresh();
    });
  }, []));

  const filteredJobs = jobs.filter((job) => {
    if (filter === "All") return true;
    if (filter === "High Match") return job.relevanceScore >= 60;
    return job.sourceCategory === filter;
  });

  const newCount = jobs.filter((j) => j.isNew).length;
  const highMatchCount = jobs.filter((j) => j.relevanceScore >= 60).length;

  const openJob = async (job: FeedJob) => {
    await feedService.markAsSeen([job.id]);
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, isNew: false } : j));
    Linking.openURL(job.url).catch(() => Alert.alert("Cannot open link", job.url));
  };

  const captureJob = (job: FeedJob) => {
    router.push({ pathname: "/job-capture", params: { prefillUrl: job.url } });
  };

  if (loading && jobs.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
        <Text style={styles.loadingTitle}>Scanning job boards...</Text>
        {loadingSource ? (
          <Text style={styles.loadingSource}>📡 {loadingSource}</Text>
        ) : null}
        <View style={styles.sourcesList}>
          {JOB_SOURCES.filter((s) => s.enabled).map((s) => (
            <View key={s.id} style={styles.sourceProgress}>
              <Text style={styles.sourceIcon}>{s.icon}</Text>
              <Text style={styles.sourceName}>{s.name}</Text>
              {progress[s.name] !== undefined ? (
                <Text style={[styles.sourceCount, { color: theme.colors.accent.green }]}>
                  {progress[s.name]} jobs
                </Text>
              ) : (
                <ActivityIndicator size="small" color={theme.colors.text.muted} />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Job Feed</Text>
          <Text style={styles.subtitle}>
            {lastFetch ? `Updated ${formatDistanceToNow(lastFetch, { addSuffix: true })}` : "Loading..."}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchFresh(true)}
          disabled={refreshing}
        >
          {refreshing
            ? <ActivityIndicator color={theme.colors.accent.cyan} size="small" />
            : <Ionicons name="refresh" size={20} color={theme.colors.accent.cyan} />
          }
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{jobs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statChip, { borderColor: theme.colors.accent.green + "44" }]}>
          <Text style={[styles.statNum, { color: theme.colors.accent.green }]}>{highMatchCount}</Text>
          <Text style={styles.statLabel}>High Match</Text>
        </View>
        <View style={[styles.statChip, { borderColor: theme.colors.accent.orange + "44" }]}>
          <Text style={[styles.statNum, { color: theme.colors.accent.orange }]}>{newCount}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={[styles.statChip, { borderColor: theme.colors.accent.cyan + "44" }]}>
          <Text style={[styles.statNum, { color: theme.colors.accent.cyan }]}>
            {JOB_SOURCES.filter((s) => s.enabled).length}
          </Text>
          <Text style={styles.statLabel}>Sources</Text>
        </View>
      </View>

      {/* Filters */}
      <FlatList
        horizontal
        data={FILTERS}
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item && styles.filterChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Job list */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchFresh(true)}
              tintColor={theme.colors.accent.cyan}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No jobs found</Text>
              <Text style={styles.emptyText}>
                {filter !== "All" ? "Try switching to 'All' filter" : "Pull down to refresh"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onOpen={() => openJob(item)}
              onCapture={() => captureJob(item)}
            />
          )}
        />
      </Animated.View>
    </View>
  );
}

function JobCard({ job, onOpen, onCapture }: {
  job: FeedJob;
  onOpen: () => void;
  onCapture: () => void;
}) {
  const scoreColor =
    job.relevanceScore >= 70 ? theme.colors.accent.green :
    job.relevanceScore >= 40 ? theme.colors.accent.orange :
    theme.colors.text.muted;

  const scoreLabel =
    job.relevanceScore >= 70 ? "High Match" :
    job.relevanceScore >= 40 ? "Possible" :
    "Low Match";

  return (
    <TouchableOpacity style={[styles.card, job.isNew && styles.cardNew]} onPress={onOpen} activeOpacity={0.8}>
      {job.isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}

      <View style={styles.cardSource}>
        <Text style={styles.sourceEmoji}>{job.sourceIcon}</Text>
        <Text style={[styles.cardSourceName, { color: job.sourceColor }]}>{job.source}</Text>
        <Text style={styles.cardTime}>
          {formatDistanceToNow(new Date(job.publishedAt), { addSuffix: true })}
        </Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{job.title}</Text>

      {job.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>{job.description}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor + "22", borderColor: scoreColor + "55" }]}>
          <View style={[styles.scoreDot, { backgroundColor: scoreColor }]} />
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {job.relevanceScore}% · {scoreLabel}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.captureBtn} onPress={onCapture}>
            <Ionicons name="add-circle-outline" size={16} color={theme.colors.accent.cyan} />
            <Text style={styles.captureBtnText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.openBtn} onPress={onOpen}>
            <Ionicons name="open-outline" size={16} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {job.relevanceReason ? (
        <Text style={styles.relevanceReason}>🎯 {job.relevanceReason}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  loadingContainer: { flex: 1, backgroundColor: theme.colors.bg.primary, paddingTop: 80, paddingHorizontal: theme.spacing.md, alignItems: "center" },
  loadingTitle: { color: theme.colors.text.primary, fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.bold, textAlign: "center", marginTop: theme.spacing.md },
  loadingSource: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm, textAlign: "center", marginTop: theme.spacing.sm },
  sourcesList: { marginTop: theme.spacing.lg, gap: theme.spacing.sm, width: "100%" },
  sourceProgress: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  sourceIcon: { fontSize: 16 },
  sourceName: { flex: 1, color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm },
  sourceCount: { fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.semibold },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.sm },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.bg.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.bg.border },
  statsRow: { flexDirection: "row", paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  statChip: { flex: 1, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.sm, alignItems: "center", borderWidth: 1, borderColor: theme.colors.bg.border },
  statNum: { fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  statLabel: { fontSize: 9, color: theme.colors.text.muted, marginTop: 2 },
  filterScroll: { maxHeight: 44 },
  filterContainer: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, alignItems: "center" },
  filterChip: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.bg.card, borderWidth: 1, borderColor: theme.colors.bg.border },
  filterChipActive: { backgroundColor: theme.colors.accent.cyan, borderColor: theme.colors.accent.cyan },
  filterText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm },
  filterTextActive: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.semibold },
  list: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm, paddingBottom: 40 },
  card: { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border, position: "relative" },
  cardNew: { borderColor: theme.colors.accent.cyan + "55" },
  newBadge: { position: "absolute", top: theme.spacing.sm, right: theme.spacing.sm, backgroundColor: theme.colors.accent.cyan, borderRadius: theme.radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { color: theme.colors.bg.primary, fontSize: 9, fontWeight: theme.font.weights.bold },
  cardSource: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: theme.spacing.xs },
  sourceEmoji: { fontSize: 14 },
  cardSourceName: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  cardTime: { flex: 1, textAlign: "right", color: theme.colors.text.muted, fontSize: theme.font.sizes.xs },
  cardTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.md, lineHeight: 22, marginBottom: 6 },
  cardDescription: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, lineHeight: 18, marginBottom: theme.spacing.sm },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: theme.spacing.sm, paddingVertical: 4, borderRadius: theme.radius.full, borderWidth: 1 },
  scoreDot: { width: 6, height: 6, borderRadius: 3 },
  scoreText: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  cardActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  captureBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.accent.cyanDim, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: theme.colors.accent.cyan + "44" },
  captureBtnText: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  openBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg.elevated, borderRadius: theme.radius.full },
  relevanceReason: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: theme.spacing.xs, fontStyle: "italic" },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: theme.colors.text.primary, fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.semibold, marginTop: theme.spacing.md },
  emptyText: { color: theme.colors.text.muted, textAlign: "center", marginTop: theme.spacing.sm },
});
