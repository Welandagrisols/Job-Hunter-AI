import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { theme } from "@/src/theme";
import { db, CVVault } from "@/src/services/storage";
import { aiService } from "@/src/services/claude";

type Phase = "idle" | "loading" | "done" | "error";

interface KeywordResult {
  percentage: number;
  score: number;
  total: number;
  matched: string[];
  missing: string[];
  recommendation: string;
}

export default function CVTailorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const params = useLocalSearchParams<{
    jobTitle?: string;
    jobCompany?: string;
    jobDescription?: string;
    jobUrl?: string;
  }>();

  const jobTitle = params.jobTitle || "Untitled Role";
  const jobCompany = params.jobCompany || "";
  const jobDescription = params.jobDescription || "";

  const [hasCv, setHasCv] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [keywords, setKeywords] = useState<KeywordResult | null>(null);
  const [tailoring, setTailoring] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [editedTailoring, setEditedTailoring] = useState("");
  const [copiedSection, setCopiedSection] = useState<"keywords" | "tailoring" | null>(null);
  const [tracked, setTracked] = useState(false);
  const [trackedAppId, setTrackedAppId] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);

  const jobUrl = params.jobUrl || "";

  useEffect(() => {
    db.getCVVault().then((v: CVVault) => {
      setHasCv(!!(v.cvText && v.cvText.length > 50));
    });
    // Check if already tracked by URL or role+company combo
    if (jobUrl || (jobTitle && jobCompany)) {
      db.getApplications().then((apps) => {
        const match = apps.find((a) =>
          (jobUrl && a.job_url === jobUrl) ||
          (a.role.toLowerCase() === jobTitle.toLowerCase() && jobCompany && a.company.toLowerCase() === jobCompany.toLowerCase())
        );
        if (match) {
          setTracked(true);
          setTrackedAppId(match.id);
        }
      });
    }
  }, []);

  const markApplied = async () => {
    if (tracked || tracking) return;
    setTracking(true);
    try {
      const cvContent = editMode ? editedTailoring : tailoring;
      const newApp = await db.addApplication({
        role: jobTitle,
        company: jobCompany || "Unknown",
        job_url: jobUrl || undefined,
        status: "applied",
        date_applied: new Date().toISOString(),
        source: jobCompany || undefined,
        cv_tailoring: cvContent || undefined,
        notes: keywords
          ? `CV Match: ${keywords.percentage}% · Matched: ${keywords.matched.slice(0, 5).join(", ")}${keywords.missing.length > 0 ? ` · Missing: ${keywords.missing.slice(0, 3).join(", ")}` : ""}`
          : undefined,
      });
      setTracked(true);
      setTrackedAppId(newApp.id);
    } catch {
      Alert.alert("Could not save", "Something went wrong saving this application. Please try again.");
    } finally {
      setTracking(false);
    }
  };

  const runAnalysis = useCallback(async () => {
    if (!jobDescription) {
      Alert.alert("No job description", "This job doesn't have a description to analyse against. Try opening a job with more details.");
      return;
    }
    setPhase("loading");
    setKeywords(null);
    setTailoring("");
    try {
      const [kw, tail] = await Promise.all([
        aiService.analyzeKeywords(jobDescription),
        aiService.tailorCVPoints(jobDescription),
      ]);
      setKeywords(kw);
      setTailoring(tail);
      setEditedTailoring(tail);
      setPhase("done");
    } catch (e: any) {
      setPhase("error");
      Alert.alert("Analysis failed", e?.message || "Could not reach AI. Check your Gemini API key in Settings.");
    }
  }, [jobDescription]);

  const copyText = async (text: string, section: "keywords" | "tailoring") => {
    await Clipboard.setStringAsync(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const keywordsText = keywords
    ? `CV Match: ${keywords.percentage}% (${keywords.score}/${keywords.total} keywords)\n\nMatched: ${keywords.matched.join(", ")}\n\nMissing: ${keywords.missing.join(", ")}\n\nRecommendation: ${keywords.recommendation}`
    : "";

  const scoreColor =
    !keywords ? theme.colors.text.muted :
    keywords.percentage >= 70 ? theme.colors.accent.green :
    keywords.percentage >= 40 ? theme.colors.accent.orange :
    theme.colors.accent.red;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{jobTitle}</Text>
          {jobCompany ? <Text style={styles.headerSub}>{jobCompany}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.cvVaultBtn}
          onPress={() => router.push("/cv-vault")}
        >
          <Ionicons name="document-text-outline" size={16} color={theme.colors.accent.cyan} />
          <Text style={styles.cvVaultBtnText}>CV Vault</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* No CV warning */}
        {hasCv === false && (
          <TouchableOpacity style={styles.noCvBanner} onPress={() => router.push("/cv-vault")}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.accent.orange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noCvTitle}>No CV stored yet</Text>
              <Text style={styles.noCvSub}>Tap to open CV Vault and paste your CV — the analysis will use it for matching.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.accent.orange} />
          </TouchableOpacity>
        )}

        {/* Job snippet */}
        {jobDescription ? (
          <View style={styles.jobSnippet}>
            <Text style={styles.snippetLabel}>Job Description (preview)</Text>
            <Text style={styles.snippetText} numberOfLines={4}>{jobDescription}</Text>
          </View>
        ) : (
          <View style={styles.jobSnippet}>
            <Text style={[styles.snippetText, { color: theme.colors.accent.orange }]}>
              ⚠️ No description available for this job. Results may be limited.
            </Text>
          </View>
        )}

        {/* Already tracked banner */}
        {tracked && (
          <TouchableOpacity
            style={styles.trackedBanner}
            onPress={() => router.push("/(tabs)/kanban")}
            activeOpacity={0.8}
          >
            <View style={styles.trackedBannerLeft}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent.green} />
              <View>
                <Text style={styles.trackedBannerTitle}>Added to Kanban Tracker</Text>
                <Text style={styles.trackedBannerSub}>Tap to open the board and see your pipeline</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.accent.green} />
          </TouchableOpacity>
        )}

        {/* Analyse button */}
        {phase === "idle" || phase === "error" ? (
          <>
            <TouchableOpacity style={styles.analyseBtn} onPress={runAnalysis} activeOpacity={0.8}>
              <Ionicons name="sparkles-outline" size={18} color={theme.colors.text.inverse} />
              <Text style={styles.analyseBtnText}>
                {phase === "error" ? "Retry Analysis" : "Analyse My CV Against This Role"}
              </Text>
            </TouchableOpacity>

            {!tracked && (
              <TouchableOpacity
                style={styles.quickTrackBtn}
                onPress={markApplied}
                disabled={tracking}
                activeOpacity={0.8}
              >
                {tracking
                  ? <ActivityIndicator size="small" color={theme.colors.accent.green} />
                  : <Ionicons name="checkmark-circle-outline" size={17} color={theme.colors.accent.green} />}
                <Text style={styles.quickTrackBtnText}>
                  {tracking ? "Saving..." : "Mark as Applied (skip analysis)"}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : phase === "loading" ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
            <Text style={styles.loadingTitle}>Running analysis...</Text>
            <Text style={styles.loadingDesc}>Comparing your CV against the job description and generating tailoring suggestions.</Text>
          </View>
        ) : null}

        {/* Results */}
        {phase === "done" && keywords && (
          <>
            {/* Score ring */}
            <View style={styles.scoreCard}>
              <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
                <Text style={[styles.scorePercent, { color: scoreColor }]}>{keywords.percentage}%</Text>
                <Text style={styles.scoreLabel}>Match</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scoreTitle}>
                  {keywords.percentage >= 70 ? "Strong match" :
                   keywords.percentage >= 40 ? "Moderate match — room to grow" :
                   "Weak match — significant gaps"}
                </Text>
                <Text style={styles.scoreSubtitle}>
                  {keywords.score} of {keywords.total} key job requirements found in your CV
                </Text>
                <TouchableOpacity style={styles.rerunBtn} onPress={runAnalysis}>
                  <Ionicons name="refresh-outline" size={12} color={theme.colors.text.muted} />
                  <Text style={styles.rerunText}>Re-run</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Keyword pills */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Keyword Analysis</Text>
                <TouchableOpacity onPress={() => copyText(keywordsText, "keywords")}>
                  <Ionicons
                    name={copiedSection === "keywords" ? "checkmark-circle" : "copy-outline"}
                    size={16}
                    color={copiedSection === "keywords" ? theme.colors.accent.green : theme.colors.text.muted}
                  />
                </TouchableOpacity>
              </View>

              {keywords.matched.length > 0 && (
                <>
                  <View style={styles.pillGroupHeader}>
                    <Ionicons name="checkmark-circle-outline" size={13} color={theme.colors.accent.green} />
                    <Text style={[styles.pillGroupLabel, { color: theme.colors.accent.green }]}>
                      In your CV ({keywords.matched.length})
                    </Text>
                  </View>
                  <View style={styles.pillRow}>
                    {keywords.matched.map((kw) => (
                      <View key={kw} style={styles.matchedPill}>
                        <Text style={styles.matchedPillText}>{kw}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {keywords.missing.length > 0 && (
                <>
                  <View style={[styles.pillGroupHeader, { marginTop: 10 }]}>
                    <Ionicons name="close-circle-outline" size={13} color={theme.colors.accent.red} />
                    <Text style={[styles.pillGroupLabel, { color: theme.colors.accent.red }]}>
                      Missing from CV ({keywords.missing.length})
                    </Text>
                  </View>
                  <View style={styles.pillRow}>
                    {keywords.missing.map((kw) => (
                      <View key={kw} style={styles.missingPill}>
                        <Text style={styles.missingPillText}>{kw}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {keywords.recommendation ? (
                <View style={styles.recommendationBox}>
                  <Ionicons name="bulb-outline" size={14} color={theme.colors.accent.gold} />
                  <Text style={styles.recommendationText}>{keywords.recommendation}</Text>
                </View>
              ) : null}
            </View>

            {/* Tailoring suggestions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tailoring Suggestions</Text>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <TouchableOpacity onPress={() => { setEditMode((e) => !e); setEditedTailoring(tailoring); }}>
                    <Ionicons
                      name={editMode ? "close-outline" : "create-outline"}
                      size={16}
                      color={editMode ? theme.colors.accent.red : theme.colors.text.muted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => copyText(editMode ? editedTailoring : tailoring, "tailoring")}>
                    <Ionicons
                      name={copiedSection === "tailoring" ? "checkmark-circle" : "copy-outline"}
                      size={16}
                      color={copiedSection === "tailoring" ? theme.colors.accent.green : theme.colors.text.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {editMode ? (
                <TextInput
                  style={styles.editInput}
                  multiline
                  value={editedTailoring}
                  onChangeText={setEditedTailoring}
                  autoFocus
                  scrollEnabled={false}
                />
              ) : (
                <Text style={styles.tailoringText}>{tailoring}</Text>
              )}
            </View>

            {/* Mark as Applied — big CTA */}
            {!tracked ? (
              <TouchableOpacity
                style={[styles.markAppliedBtn, tracking && { opacity: 0.7 }]}
                onPress={markApplied}
                disabled={tracking}
                activeOpacity={0.8}
              >
                {tracking
                  ? <ActivityIndicator size="small" color={theme.colors.text.inverse} />
                  : <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.text.inverse} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.markAppliedTitle}>
                    {tracking ? "Saving to tracker..." : "Mark as Applied"}
                  </Text>
                  <Text style={styles.markAppliedSub}>
                    Adds to Kanban board with today's date, CV match score & tailoring suggestions
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.trackedBannerInline}
                onPress={() => router.push("/(tabs)/kanban")}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackedInlineTitle}>Tracked ✓  View in Kanban →</Text>
                  <Text style={styles.trackedInlineSub}>CV tailoring suggestions saved to the application record</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Secondary action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: theme.colors.accent.cyan }]}
                onPress={() => router.push({
                  pathname: "/(tabs)/ai-writer",
                  params: {
                    prefill_role: jobTitle,
                    prefill_company: jobCompany,
                    prefill_description: jobDescription,
                  },
                })}
              >
                <Ionicons name="sparkles-outline" size={16} color={theme.colors.text.inverse} />
                <Text style={[styles.actionBtnText, { color: theme.colors.text.inverse }]}>
                  Write Cover Letter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.colors.bg.card, borderWidth: 1, borderColor: theme.colors.bg.border }]}
                onPress={() => router.push("/cv-vault")}
              >
                <Ionicons name="document-text-outline" size={16} color={theme.colors.text.secondary} />
                <Text style={styles.actionBtnText}>Edit CV</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.bg.card, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  headerTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 16 },
  headerSub: { color: theme.colors.text.muted, fontSize: 12, marginTop: 1 },
  cvVaultBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: theme.colors.accent.cyanDim,
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "44",
  },
  cvVaultBtnText: { color: theme.colors.accent.cyan, fontSize: 12, fontWeight: "600" },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  noCvBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.accent.orange + "12",
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.accent.orange + "44",
  },
  noCvTitle: { color: theme.colors.accent.orange, fontWeight: "700", fontSize: 14 },
  noCvSub: { color: theme.colors.text.secondary, fontSize: 12, marginTop: 2, lineHeight: 16 },

  jobSnippet: {
    backgroundColor: theme.colors.bg.card, borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  snippetLabel: {
    color: theme.colors.text.muted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6,
  },
  snippetText: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },

  analyseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: theme.colors.accent.cyan, borderRadius: 14,
    paddingVertical: 16, marginBottom: 24,
  },
  analyseBtnText: { color: theme.colors.text.inverse, fontWeight: "700", fontSize: 16 },

  loadingCard: {
    backgroundColor: theme.colors.bg.card, borderRadius: 14,
    padding: 32, alignItems: "center", marginBottom: 24,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  loadingTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 16, marginTop: 16, marginBottom: 8 },
  loadingDesc: { color: theme.colors.text.muted, fontSize: 13, textAlign: "center", lineHeight: 18 },

  scoreCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: theme.colors.bg.card, borderRadius: 14,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  scoreRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, alignItems: "center", justifyContent: "center",
  },
  scorePercent: { fontSize: 22, fontWeight: "800" },
  scoreLabel: { color: theme.colors.text.muted, fontSize: 10, marginTop: 1 },
  scoreTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 15, marginBottom: 4 },
  scoreSubtitle: { color: theme.colors.text.secondary, fontSize: 12, lineHeight: 16 },
  rerunBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8,
  },
  rerunText: { color: theme.colors.text.muted, fontSize: 11 },

  section: {
    backgroundColor: theme.colors.bg.card, borderRadius: 14,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
  },
  sectionTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 15 },

  pillGroupHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  pillGroupLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  matchedPill: {
    backgroundColor: theme.colors.accent.green + "18",
    borderWidth: 1, borderColor: theme.colors.accent.green + "55",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  matchedPillText: { color: theme.colors.accent.green, fontSize: 12, fontWeight: "600" },
  missingPill: {
    backgroundColor: theme.colors.accent.redDim,
    borderWidth: 1, borderColor: theme.colors.accent.red + "55",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  missingPillText: { color: theme.colors.accent.red, fontSize: 12, fontWeight: "600" },

  recommendationBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    marginTop: 14, backgroundColor: theme.colors.accent.gold + "12",
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: theme.colors.accent.gold + "33",
  },
  recommendationText: { flex: 1, color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },

  tailoringText: {
    color: theme.colors.text.secondary, fontSize: 13, lineHeight: 20,
  },
  editInput: {
    color: theme.colors.text.primary, fontSize: 13, lineHeight: 20,
    backgroundColor: theme.colors.bg.elevated, borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: theme.colors.accent.cyan + "44",
    minHeight: 200,
  },

  trackedBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: theme.colors.accent.green + "14",
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.accent.green + "44",
  },
  trackedBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  trackedBannerTitle: { color: theme.colors.accent.green, fontWeight: "700", fontSize: 14 },
  trackedBannerSub: { color: theme.colors.text.secondary, fontSize: 11, marginTop: 2 },

  quickTrackBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.accent.green + "14",
    borderRadius: 12, paddingVertical: 12, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.accent.green + "44",
  },
  quickTrackBtnText: { color: theme.colors.accent.green, fontWeight: "600", fontSize: 14 },

  markAppliedBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.accent.green,
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 12,
  },
  markAppliedTitle: { color: theme.colors.text.inverse, fontWeight: "700", fontSize: 15 },
  markAppliedSub: { color: theme.colors.text.inverse + "CC", fontSize: 11, marginTop: 2, lineHeight: 14 },

  trackedBannerInline: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.accent.green + "14",
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 12, borderWidth: 1, borderColor: theme.colors.accent.green + "44",
  },
  trackedInlineTitle: { color: theme.colors.accent.green, fontWeight: "700", fontSize: 14 },
  trackedInlineSub: { color: theme.colors.text.secondary, fontSize: 11, marginTop: 2 },

  actionRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 12, paddingVertical: 14,
  },
  actionBtnText: { color: theme.colors.text.secondary, fontWeight: "600", fontSize: 14 },
});
