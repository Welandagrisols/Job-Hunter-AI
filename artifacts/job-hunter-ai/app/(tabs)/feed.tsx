import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert,
  Animated, TextInput, ScrollView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { feedService, FeedJob, JobSource, KeywordFilters } from "@/src/services/feedService";
import { theme } from "@/src/theme";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_FILTERS = ["All", "High Match", "Kenya", "NGO/International", "East Africa", "Development"];

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [sources, setSources] = useState<JobSource[]>([]);
  const [keywordFilters, setKeywordFilters] = useState<KeywordFilters>({ highlights: [], blocks: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loadingSource, setLoadingSource] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [showKeywordPanel, setShowKeywordPanel] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordType, setNewKeywordType] = useState<"highlight" | "block">("highlight");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadCached = async () => {
    const [cached, last, allSources, kf] = await Promise.all([
      feedService.getCachedFeed(),
      feedService.getLastFetchTime(),
      feedService.getSources(),
      feedService.getKeywordFilters(),
    ]);
    setSources(allSources);
    setKeywordFilters(kf);
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
      if (fresh.length > 0) {
        setJobs(fresh);
        setLastFetch(new Date());
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      } else {
        const cached = await feedService.getCachedFeed();
        const last = await feedService.getLastFetchTime();
        if (cached.length > 0) {
          setJobs(cached);
          setLastFetch(last);
          Alert.alert("Using cached jobs", "Could not reach job boards right now. Showing your last saved results.");
        } else {
          Alert.alert("No jobs found", "Could not load jobs from any source. Check your internet connection and try again.");
        }
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }
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

  // Apply keyword + category filters
  const applyFilters = (job: FeedJob): { visible: boolean; highlighted: boolean; matchedHighlight: string } => {
    const text = `${job.title} ${job.description}`.toLowerCase();

    // Block check
    for (const kw of keywordFilters.blocks) {
      if (text.includes(kw.toLowerCase())) return { visible: false, highlighted: false, matchedHighlight: "" };
    }

    // Category filter
    if (categoryFilter === "High Match" && job.relevanceScore < 60) return { visible: false, highlighted: false, matchedHighlight: "" };
    if (categoryFilter !== "All" && categoryFilter !== "High Match" && job.sourceCategory !== categoryFilter) {
      return { visible: false, highlighted: false, matchedHighlight: "" };
    }

    // Highlight check
    for (const kw of keywordFilters.highlights) {
      if (text.includes(kw.toLowerCase())) return { visible: true, highlighted: true, matchedHighlight: kw };
    }

    return { visible: true, highlighted: false, matchedHighlight: "" };
  };

  const processedJobs = jobs
    .map((job) => ({ ...job, ...applyFilters(job) }))
    .filter((j) => j.visible)
    .sort((a, b) => {
      // Highlighted jobs float to top
      if (a.highlighted && !b.highlighted) return -1;
      if (!a.highlighted && b.highlighted) return 1;
      return b.relevanceScore - a.relevanceScore;
    });

  const newCount = jobs.filter((j) => j.isNew).length;
  const highMatchCount = jobs.filter((j) => j.relevanceScore >= 60).length;
  const activeFiltersCount = keywordFilters.highlights.length + keywordFilters.blocks.length;
  const highlightedCount = processedJobs.filter((j) => j.highlighted).length;

  const openJob = async (job: FeedJob) => {
    await feedService.markAsSeen([job.id]);
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, isNew: false } : j));
    Linking.openURL(job.url).catch(() => Alert.alert("Cannot open link", job.url));
  };

  const captureJob = (job: FeedJob) => {
    router.push({ pathname: "/job-capture", params: { prefillUrl: job.url } });
  };

  const prepForJob = (job: FeedJob) => {
    router.push({
      pathname: "/cv-tailor",
      params: {
        jobTitle: job.title,
        jobCompany: job.source,
        jobDescription: job.description || "",
        jobUrl: job.url,
      },
    });
  };

  const addKeyword = async () => {
    const word = newKeyword.trim();
    if (!word) return;
    const updated = await feedService.addKeyword(word, newKeywordType);
    setKeywordFilters(updated);
    setNewKeyword("");
  };

  const removeKeyword = async (word: string, type: "highlight" | "block") => {
    const updated = await feedService.removeKeyword(word, type);
    setKeywordFilters(updated);
  };

  if (loading && jobs.length === 0) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPad + 24 }]}>
        <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
        <Text style={styles.loadingTitle}>Scanning job boards...</Text>
        {loadingSource ? <Text style={styles.loadingSource}>📡 {loadingSource}</Text> : null}
        <View style={styles.sourcesList}>
          {sources.filter((s) => s.enabled).slice(0, 12).map((s) => (
            <View key={s.id} style={styles.sourceProgress}>
              <Text style={styles.sourceIcon}>{s.icon}</Text>
              <Text style={styles.sourceName}>{s.name}</Text>
              {progress[s.name] !== undefined ? (
                <Text style={[styles.sourceCount, { color: theme.colors.accent.green }]}>
                  {progress[s.name]} items
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
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Job Feed</Text>
          <Text style={styles.subtitle}>
            {lastFetch ? `Updated ${formatDistanceToNow(lastFetch, { addSuffix: true })}` : "Loading..."}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, showKeywordPanel && styles.headerBtnActive]}
          onPress={() => setShowKeywordPanel((v) => !v)}
        >
          <Ionicons name="options-outline" size={19} color={showKeywordPanel ? theme.colors.accent.cyan : theme.colors.text.secondary} />
          {activeFiltersCount > 0 && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => fetchFresh(true)}
          disabled={refreshing}
        >
          {refreshing
            ? <ActivityIndicator color={theme.colors.accent.cyan} size="small" />
            : <Ionicons name="refresh" size={19} color={theme.colors.accent.cyan} />}
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{processedJobs.length}</Text>
          <Text style={styles.statLabel}>Showing</Text>
        </View>
        <View style={[styles.statChip, { borderColor: theme.colors.accent.green + "44" }]}>
          <Text style={[styles.statNum, { color: theme.colors.accent.green }]}>{highMatchCount}</Text>
          <Text style={styles.statLabel}>High Match</Text>
        </View>
        {highlightedCount > 0 ? (
          <View style={[styles.statChip, { borderColor: theme.colors.accent.gold + "44" }]}>
            <Text style={[styles.statNum, { color: theme.colors.accent.gold }]}>{highlightedCount}</Text>
            <Text style={styles.statLabel}>Pinned ⭐</Text>
          </View>
        ) : (
          <View style={[styles.statChip, { borderColor: theme.colors.accent.orange + "44" }]}>
            <Text style={[styles.statNum, { color: theme.colors.accent.orange }]}>{newCount}</Text>
            <Text style={styles.statLabel}>New</Text>
          </View>
        )}
        <View style={[styles.statChip, { borderColor: theme.colors.accent.cyan + "44" }]}>
          <Text style={[styles.statNum, { color: theme.colors.accent.cyan }]}>
            {sources.filter((s) => s.enabled).length}
          </Text>
          <Text style={styles.statLabel}>Sources</Text>
        </View>
      </View>

      {/* Keyword filter panel */}
      {showKeywordPanel && (
        <View style={styles.keywordPanel}>
          <Text style={styles.keywordPanelTitle}>Keyword Filters</Text>

          {/* Highlights */}
          <View style={styles.kwSection}>
            <View style={styles.kwSectionHeader}>
              <Ionicons name="star-outline" size={12} color={theme.colors.accent.gold} />
              <Text style={[styles.kwSectionLabel, { color: theme.colors.accent.gold }]}>Highlight & pin to top</Text>
            </View>
            <View style={styles.pillRow}>
              {keywordFilters.highlights.length === 0 && (
                <Text style={styles.kwEmpty}>No keywords yet</Text>
              )}
              {keywordFilters.highlights.map((kw) => (
                <TouchableOpacity
                  key={kw}
                  style={styles.highlightPill}
                  onPress={() => removeKeyword(kw, "highlight")}
                >
                  <Text style={styles.highlightPillText}>{kw}</Text>
                  <Ionicons name="close" size={11} color={theme.colors.accent.gold} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Blocks */}
          <View style={styles.kwSection}>
            <View style={styles.kwSectionHeader}>
              <Ionicons name="eye-off-outline" size={12} color={theme.colors.accent.red} />
              <Text style={[styles.kwSectionLabel, { color: theme.colors.accent.red }]}>Hide from feed</Text>
            </View>
            <View style={styles.pillRow}>
              {keywordFilters.blocks.length === 0 && (
                <Text style={styles.kwEmpty}>No keywords yet</Text>
              )}
              {keywordFilters.blocks.map((kw) => (
                <TouchableOpacity
                  key={kw}
                  style={styles.blockPill}
                  onPress={() => removeKeyword(kw, "block")}
                >
                  <Text style={styles.blockPillText}>{kw}</Text>
                  <Ionicons name="close" size={11} color={theme.colors.accent.red} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Add keyword */}
          <View style={styles.kwAddRow}>
            <TextInput
              style={styles.kwInput}
              placeholder="Add keyword..."
              placeholderTextColor={theme.colors.text.muted}
              value={newKeyword}
              onChangeText={setNewKeyword}
              onSubmitEditing={addKeyword}
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.kwTypeToggle}>
              <TouchableOpacity
                style={[styles.kwTypeBtn, newKeywordType === "highlight" && styles.kwTypeBtnHighlight]}
                onPress={() => setNewKeywordType("highlight")}
              >
                <Text style={[styles.kwTypeBtnText, newKeywordType === "highlight" && { color: theme.colors.accent.gold }]}>
                  ⭐
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.kwTypeBtn, newKeywordType === "block" && styles.kwTypeBtnBlock]}
                onPress={() => setNewKeywordType("block")}
              >
                <Text style={[styles.kwTypeBtnText, newKeywordType === "block" && { color: theme.colors.accent.red }]}>
                  🚫
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.kwAddBtn} onPress={addKeyword} disabled={!newKeyword.trim()}>
              <Ionicons name="add" size={18} color={newKeyword.trim() ? theme.colors.text.inverse : theme.colors.text.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.kwHint}>
            Tap any keyword pill to remove it. ⭐ pins matching jobs to the top · 🚫 hides them completely.
          </Text>
        </View>
      )}

      {/* Category filter chips */}
      <FlatList
        horizontal
        data={CATEGORY_FILTERS}
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, categoryFilter === item && styles.filterChipActive]}
            onPress={() => setCategoryFilter(item)}
          >
            <Text style={[styles.filterText, categoryFilter === item && styles.filterTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Blocked jobs notice */}
      {keywordFilters.blocks.length > 0 && jobs.length > processedJobs.length && (
        <View style={styles.blockedNotice}>
          <Ionicons name="eye-off-outline" size={13} color={theme.colors.text.muted} />
          <Text style={styles.blockedNoticeText}>
            {jobs.length - processedJobs.length - (jobs.length - processedJobs.length - (jobs.filter(j => {
              const t = `${j.title} ${j.description}`.toLowerCase();
              return keywordFilters.blocks.some(b => t.includes(b));
            }).length))} hidden by keyword blocks · tap ⊘ to manage
          </Text>
          <TouchableOpacity onPress={() => setShowKeywordPanel(true)}>
            <Text style={{ color: theme.colors.accent.cyan, fontSize: 11, fontWeight: "600" }}>Manage</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Job list */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        <FlatList
          data={processedJobs}
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
              <Text style={styles.emptyIcon}>
                {activeFiltersCount > 0 ? "🔕" : "🔍"}
              </Text>
              <Text style={styles.emptyTitle}>
                {activeFiltersCount > 0 ? "All jobs filtered out" : "No jobs found"}
              </Text>
              <Text style={styles.emptyText}>
                {activeFiltersCount > 0
                  ? "Your block keywords are hiding everything. Tap the filter icon to adjust them."
                  : categoryFilter !== "All"
                  ? "Try switching to 'All' filter"
                  : "Pull down to refresh"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <JobCard
              job={item}
              highlighted={(item as any).highlighted}
              matchedHighlight={(item as any).matchedHighlight}
              onOpen={() => openJob(item)}
              onCapture={() => captureJob(item)}
              onPrep={() => prepForJob(item)}
            />
          )}
        />
      </Animated.View>
    </View>
  );
}

function JobCard({ job, highlighted, matchedHighlight, onOpen, onCapture, onPrep }: {
  job: FeedJob;
  highlighted: boolean;
  matchedHighlight: string;
  onOpen: () => void;
  onCapture: () => void;
  onPrep: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor =
    job.relevanceScore >= 70 ? theme.colors.accent.green :
    job.relevanceScore >= 40 ? theme.colors.accent.orange :
    theme.colors.text.muted;

  const scoreLabel =
    job.relevanceScore >= 70 ? "High Match" :
    job.relevanceScore >= 40 ? "Possible" :
    "Low Match";

  return (
    <View style={[
      styles.card,
      job.isNew && styles.cardNew,
      highlighted && styles.cardHighlighted,
    ]}>
      {highlighted && (
        <View style={styles.highlightBanner}>
          <Ionicons name="star" size={10} color={theme.colors.accent.gold} />
          <Text style={styles.highlightBannerText}>
            Pinned · matches "{matchedHighlight}"
          </Text>
        </View>
      )}
      {!highlighted && job.isNew && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}

      <TouchableOpacity onPress={onOpen} activeOpacity={0.8}>
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
      </TouchableOpacity>

      <View style={styles.cardFooter}>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor + "22", borderColor: scoreColor + "55" }]}>
          <View style={[styles.scoreDot, { backgroundColor: scoreColor }]} />
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {job.relevanceScore}% · {scoreLabel}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.applyBtn} onPress={() => setExpanded((e) => !e)}>
            <Ionicons name={expanded ? "chevron-up" : "rocket-outline"} size={15} color={theme.colors.accent.cyan} />
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.openBtn} onPress={onOpen}>
            <Ionicons name="open-outline" size={16} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {job.relevanceReason ? (
        <Text style={styles.relevanceReason}>🎯 {job.relevanceReason}</Text>
      ) : null}

      {expanded && (
        <View style={styles.actionMenu}>
          <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setExpanded(false); onPrep(); }}>
            <View style={[styles.actionMenuIcon, { backgroundColor: theme.colors.accent.gold + "22" }]}>
              <Ionicons name="sparkles-outline" size={16} color={theme.colors.accent.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionMenuTitle}>Prep for this role</Text>
              <Text style={styles.actionMenuSub}>Cover letter · CV tailor · email · interview prep</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.actionMenuDivider} />

          <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setExpanded(false); onCapture(); }}>
            <View style={[styles.actionMenuIcon, { backgroundColor: theme.colors.accent.cyan + "22" }]}>
              <Ionicons name="scan-outline" size={16} color={theme.colors.accent.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionMenuTitle}>Extract & Track</Text>
              <Text style={styles.actionMenuSub}>Pull full JD and save to your Kanban tracker</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.actionMenuDivider} />

          <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setExpanded(false); onOpen(); }}>
            <View style={[styles.actionMenuIcon, { backgroundColor: theme.colors.accent.orange + "22" }]}>
              <Ionicons name="globe-outline" size={16} color={theme.colors.accent.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionMenuTitle}>Open Job Page</Text>
              <Text style={styles.actionMenuSub}>View full listing on the job board</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.text.muted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  loadingContainer: {
    flex: 1, backgroundColor: theme.colors.bg.primary,
    paddingHorizontal: theme.spacing.md, alignItems: "center",
  },
  loadingTitle: {
    color: theme.colors.text.primary, fontSize: theme.font.sizes.xl,
    fontWeight: theme.font.weights.bold, textAlign: "center", marginTop: theme.spacing.md,
  },
  loadingSource: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm, textAlign: "center", marginTop: theme.spacing.sm },
  sourcesList: { marginTop: theme.spacing.lg, gap: theme.spacing.sm, width: "100%" },
  sourceProgress: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  sourceIcon: { fontSize: 16 },
  sourceName: { flex: 1, color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm },
  sourceCount: { fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.semibold },

  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm,
  },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 2 },
  headerBtn: {
    width: 38, height: 38, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  headerBtnActive: {
    backgroundColor: theme.colors.accent.cyanDim,
    borderColor: theme.colors.accent.cyan + "55",
  },
  filterCountBadge: {
    position: "absolute", top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: theme.colors.accent.cyan,
    alignItems: "center", justifyContent: "center",
  },
  filterCountText: { color: theme.colors.text.inverse, fontSize: 9, fontWeight: "800" },

  statsRow: { flexDirection: "row", paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  statChip: {
    flex: 1, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md,
    padding: theme.spacing.sm, alignItems: "center", borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  statNum: { fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  statLabel: { fontSize: 9, color: theme.colors.text.muted, marginTop: 2 },

  // Keyword filter panel
  keywordPanel: {
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg,
    padding: 14, borderWidth: 1, borderColor: theme.colors.accent.cyan + "33",
  },
  keywordPanelTitle: {
    color: theme.colors.text.primary, fontWeight: "700", fontSize: 14, marginBottom: 12,
  },
  kwSection: { marginBottom: 10 },
  kwSectionHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  kwSectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  kwEmpty: { color: theme.colors.text.muted, fontSize: 12, fontStyle: "italic" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  highlightPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: theme.colors.accent.gold + "18",
    borderWidth: 1, borderColor: theme.colors.accent.gold + "55",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  highlightPillText: { color: theme.colors.accent.gold, fontSize: 12, fontWeight: "600" },
  blockPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: theme.colors.accent.redDim,
    borderWidth: 1, borderColor: theme.colors.accent.red + "55",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  blockPillText: { color: theme.colors.accent.red, fontSize: 12, fontWeight: "600" },
  kwAddRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  kwInput: {
    flex: 1, backgroundColor: theme.colors.bg.elevated,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    color: theme.colors.text.primary, fontSize: 13,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  kwTypeToggle: { flexDirection: "row", gap: 4 },
  kwTypeBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1, borderColor: theme.colors.bg.border,
    alignItems: "center", justifyContent: "center",
  },
  kwTypeBtnHighlight: { backgroundColor: theme.colors.accent.gold + "18", borderColor: theme.colors.accent.gold + "55" },
  kwTypeBtnBlock: { backgroundColor: theme.colors.accent.redDim, borderColor: theme.colors.accent.red + "55" },
  kwTypeBtnText: { fontSize: 15 },
  kwAddBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: theme.colors.accent.cyan,
    alignItems: "center", justifyContent: "center",
  },
  kwHint: { color: theme.colors.text.muted, fontSize: 10, marginTop: 8, lineHeight: 14 },

  blockedNotice: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: theme.spacing.md, marginBottom: 6,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  blockedNoticeText: { flex: 1, color: theme.colors.text.muted, fontSize: 11 },

  filterScroll: { maxHeight: 44 },
  filterContainer: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, alignItems: "center" },
  filterChip: {
    paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.card, borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  filterChipActive: { backgroundColor: theme.colors.accent.cyan, borderColor: theme.colors.accent.cyan },
  filterText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm },
  filterTextActive: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.semibold },

  list: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm, paddingBottom: 40 },
  card: {
    backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border, position: "relative",
    overflow: "hidden",
  },
  cardNew: { borderColor: theme.colors.accent.cyan + "55" },
  cardHighlighted: {
    borderColor: theme.colors.accent.gold + "66",
    backgroundColor: theme.colors.accent.gold + "06",
  },
  highlightBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: theme.colors.accent.gold + "18",
    marginHorizontal: -theme.spacing.md, marginTop: -theme.spacing.md,
    marginBottom: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: 5,
  },
  highlightBannerText: { color: theme.colors.accent.gold, fontSize: 10, fontWeight: "600" },
  newBadge: {
    position: "absolute", top: theme.spacing.sm, right: theme.spacing.sm,
    backgroundColor: theme.colors.accent.cyan, borderRadius: theme.radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  newBadgeText: { color: theme.colors.bg.primary, fontSize: 9, fontWeight: theme.font.weights.bold },
  cardSource: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: theme.spacing.xs },
  sourceEmoji: { fontSize: 14 },
  cardSourceName: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  cardTime: { flex: 1, textAlign: "right", color: theme.colors.text.muted, fontSize: theme.font.sizes.xs },
  cardTitle: {
    color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold,
    fontSize: theme.font.sizes.md, lineHeight: 22, marginBottom: 6,
  },
  cardDescription: {
    color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm,
    lineHeight: 18, marginBottom: theme.spacing.sm,
  },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: theme.spacing.sm, paddingVertical: 4,
    borderRadius: theme.radius.full, borderWidth: 1,
  },
  scoreDot: { width: 6, height: 6, borderRadius: 3 },
  scoreText: { fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  cardActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  applyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: theme.colors.accent.cyanDim, borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "44",
  },
  applyBtnText: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.xs, fontWeight: theme.font.weights.semibold },
  openBtn: {
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.colors.bg.elevated, borderRadius: theme.radius.full,
  },
  relevanceReason: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: theme.spacing.xs, fontStyle: "italic" },
  actionMenu: {
    marginTop: theme.spacing.sm, backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.bg.border, overflow: "hidden",
  },
  actionMenuItem: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.md },
  actionMenuIcon: { width: 32, height: 32, borderRadius: theme.radius.sm, alignItems: "center", justifyContent: "center" },
  actionMenuTitle: { color: theme.colors.text.primary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.semibold },
  actionMenuSub: { color: theme.colors.text.muted, fontSize: 11, marginTop: 1 },
  actionMenuDivider: { height: 1, backgroundColor: theme.colors.bg.border, marginLeft: 56 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: theme.colors.text.primary, fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.semibold, marginTop: theme.spacing.md },
  emptyText: { color: theme.colors.text.muted, textAlign: "center", marginTop: theme.spacing.sm, paddingHorizontal: 24 },
});
