import React, { useState, useEffect, useRef } from "react";
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

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = "match" | "cover" | "email" | "tailor" | "interview";

interface KeywordResult {
  percentage: number;
  score: number;
  total: number;
  matched: string[];
  missing: string[];
  recommendation: string;
}

interface ModeConfig {
  key: Mode;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const MODES: ModeConfig[] = [
  { key: "match",    label: "CV Match",     icon: "analytics-outline",      color: theme.colors.accent.cyan,   description: "Keyword gap analysis" },
  { key: "cover",    label: "Cover Letter", icon: "document-text-outline",  color: theme.colors.accent.green,  description: "Tailored cover letter" },
  { key: "email",    label: "App Email",    icon: "mail-outline",            color: theme.colors.accent.orange, description: "Short application email" },
  { key: "tailor",   label: "Tailor CV",    icon: "create-outline",          color: theme.colors.accent.gold,   description: "CV bullet points & summary" },
  { key: "interview",label: "Interview",    icon: "mic-outline",             color: "#9B59B6",                  description: "Prep questions & answers" },
];

// ── Main screen ───────────────────────────────────────────────────────────────

export default function JobPrepScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const scrollRef = useRef<ScrollView>(null);

  const params = useLocalSearchParams<{
    jobTitle?: string;
    jobCompany?: string;
    jobDescription?: string;
    jobUrl?: string;
  }>();

  const jobTitle       = params.jobTitle || "Untitled Role";
  const jobCompany     = params.jobCompany || "";
  const jobDescription = params.jobDescription || "";
  const jobUrl         = params.jobUrl || "";

  // Per-mode cache so we never re-generate when switching tabs
  const [results, setResults] = useState<Partial<Record<Mode, KeywordResult | string>>>({});
  const [loading, setLoading] = useState<Partial<Record<Mode, boolean>>>({});
  const [edited, setEdited]   = useState<Partial<Record<Mode, string>>>({});

  const [activeMode, setActiveMode] = useState<Mode>("match");
  const [hasCv, setHasCv]           = useState(true);
  const [tracked, setTracked]       = useState(false);
  const [tracking, setTracking]     = useState(false);
  const [copied, setCopied]         = useState(false);

  // ── Init: check CV + duplicate guard ─────────────────────────────────────
  useEffect(() => {
    db.getCVVault().then((v: CVVault) => setHasCv(!!(v.cvText && v.cvText.length > 50)));

    db.getApplications().then((apps) => {
      const already = apps.find((a) =>
        (jobUrl && a.job_url === jobUrl) ||
        (a.role.toLowerCase() === jobTitle.toLowerCase() &&
         jobCompany && a.company.toLowerCase() === jobCompany.toLowerCase())
      );
      if (already) setTracked(true);
    });
  }, []);

  // ── Generate for the active mode ─────────────────────────────────────────
  const generate = async (mode: Mode) => {
    if (!jobDescription) {
      Alert.alert("No description", "This job doesn't have a description. Open the job page and use Extract & Track to pull the full details first.");
      return;
    }
    setLoading((p) => ({ ...p, [mode]: true }));
    try {
      let result: KeywordResult | string;
      switch (mode) {
        case "match":
          result = await aiService.analyzeKeywords(jobDescription);
          break;
        case "cover":
          result = await aiService.generateCoverLetter(jobTitle, jobCompany, jobDescription);
          break;
        case "email":
          result = await aiService.generateApplicationEmail(jobTitle, jobCompany, jobDescription);
          break;
        case "tailor":
          result = await aiService.tailorCVPoints(jobDescription);
          break;
        case "interview":
          result = await aiService.generateInterviewPrep(jobTitle, jobCompany, jobDescription);
          break;
      }
      setResults((p) => ({ ...p, [mode]: result }));
      if (typeof result === "string") setEdited((p) => ({ ...p, [mode]: result as string }));
    } catch (e: any) {
      Alert.alert("Generation failed", e?.message || "Check your Gemini API key in Settings and try again.");
    } finally {
      setLoading((p) => ({ ...p, [mode]: false }));
    }
  };

  // ── Tracking ──────────────────────────────────────────────────────────────
  const markApplied = async () => {
    if (tracked || tracking) return;
    setTracking(true);
    try {
      const kw = results.match as KeywordResult | undefined;
      const cvContent = (edited.tailor || results.tailor as string || "");
      await db.addApplication({
        role: jobTitle,
        company: jobCompany || "Unknown",
        job_url: jobUrl || undefined,
        status: "applied",
        date_applied: new Date().toISOString(),
        source: jobCompany || undefined,
        cover_letter: (edited.cover || results.cover as string || undefined),
        application_email: (edited.email || results.email as string || undefined),
        cv_tailoring: cvContent || undefined,
        interview_prep: (results.interview as string || undefined),
        notes: kw ? `CV Match: ${kw.percentage}% · ${kw.matched.slice(0, 4).join(", ")}` : undefined,
      });
      setTracked(true);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setTracking(false);
    }
  };

  // ── Copy ──────────────────────────────────────────────────────────────────
  const copyActive = async () => {
    const text = activeMode === "match"
      ? formatKeywords(results.match as KeywordResult)
      : (edited[activeMode] || results[activeMode] as string || "");
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasResult = !!results[activeMode];
  const isLoading = !!loading[activeMode];
  const cfg = MODES.find((m) => m.key === activeMode)!;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{jobTitle}</Text>
          {jobCompany ? <Text style={styles.headerSub} numberOfLines={1}>{jobCompany}</Text> : null}
        </View>

        {/* Track button in header */}
        <TouchableOpacity
          style={[styles.trackBtn, tracked && styles.trackBtnDone]}
          onPress={tracked ? () => router.push("/(tabs)/kanban") : markApplied}
          disabled={tracking}
        >
          {tracking
            ? <ActivityIndicator size="small" color={tracked ? theme.colors.accent.green : theme.colors.text.inverse} />
            : <Ionicons
                name={tracked ? "checkmark-circle" : "checkmark-circle-outline"}
                size={15}
                color={tracked ? theme.colors.accent.green : theme.colors.text.inverse}
              />
          }
          <Text style={[styles.trackBtnText, tracked && { color: theme.colors.accent.green }]}>
            {tracked ? "Tracked" : tracking ? "Saving…" : "Mark Applied"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── No CV warning ──────────────────────────────────────────────── */}
      {!hasCv && (
        <TouchableOpacity style={styles.noCvRow} onPress={() => router.push("/cv-vault")}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.colors.accent.orange} />
          <Text style={styles.noCvText}>No CV stored — AI uses your profile only. </Text>
          <Text style={[styles.noCvText, { color: theme.colors.accent.cyan }]}>Add CV →</Text>
        </TouchableOpacity>
      )}

      {/* ── Mode tabs ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.modeTabs}
        contentContainerStyle={styles.modeTabsContent}
      >
        {MODES.map((m) => {
          const active = m.key === activeMode;
          const done   = !!results[m.key];
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeTab, active && { borderColor: m.color, backgroundColor: m.color + "18" }]}
              onPress={() => setActiveMode(m.key)}
            >
              <Ionicons name={m.icon as any} size={14} color={active ? m.color : theme.colors.text.muted} />
              <Text style={[styles.modeTabText, active && { color: m.color, fontWeight: "700" }]}>{m.label}</Text>
              {done && <View style={[styles.modeDot, { backgroundColor: m.color }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* No description fallback */}
        {!jobDescription && (
          <View style={styles.noDescCard}>
            <Ionicons name="document-outline" size={28} color={theme.colors.text.muted} />
            <Text style={styles.noDescTitle}>No job description available</Text>
            <Text style={styles.noDescSub}>Use "Extract & Track" from the feed to pull the full job details, then come back here.</Text>
          </View>
        )}

        {/* Generate prompt — shown when mode hasn't been run yet */}
        {jobDescription && !hasResult && !isLoading && (
          <TouchableOpacity style={[styles.generateBtn, { backgroundColor: cfg.color }]} onPress={() => generate(activeMode)} activeOpacity={0.85}>
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.text.inverse} />
            <Text style={styles.generateBtnText}>Generate {cfg.label}</Text>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={cfg.color} size="large" />
            <Text style={[styles.loadingLabel, { color: cfg.color }]}>Generating {cfg.label}…</Text>
          </View>
        )}

        {/* ── Results per mode ─────────────────────────────────────── */}
        {hasResult && !isLoading && (
          <>
            {activeMode === "match"
              ? <KeywordMatchView kw={results.match as KeywordResult} color={cfg.color} />
              : <TextResultView
                  text={edited[activeMode] || results[activeMode] as string}
                  onEdit={(t) => setEdited((p) => ({ ...p, [activeMode]: t }))}
                />
            }

            {/* Re-generate */}
            <TouchableOpacity style={styles.regenBtn} onPress={() => generate(activeMode)}>
              <Ionicons name="refresh-outline" size={13} color={theme.colors.text.muted} />
              <Text style={styles.regenText}>Regenerate</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>

      {/* ── Bottom bar (copy + open job) ───────────────────────────────── */}
      {hasResult && !isLoading && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.copyBtn} onPress={copyActive}>
            <Ionicons
              name={copied ? "checkmark-circle" : "copy-outline"}
              size={16}
              color={copied ? theme.colors.accent.green : theme.colors.text.secondary}
            />
            <Text style={[styles.copyBtnText, copied && { color: theme.colors.accent.green }]}>
              {copied ? "Copied!" : "Copy"}
            </Text>
          </TouchableOpacity>

          {jobUrl ? (
            <TouchableOpacity
              style={styles.openJobBtn}
              onPress={() => require("react-native").Linking.openURL(jobUrl)}
            >
              <Ionicons name="open-outline" size={15} color={theme.colors.accent.cyan} />
              <Text style={styles.openJobBtnText}>Open Job Page</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Keyword match sub-view ────────────────────────────────────────────────────

function KeywordMatchView({ kw, color }: { kw: KeywordResult; color: string }) {
  const scoreColor =
    kw.percentage >= 70 ? theme.colors.accent.green :
    kw.percentage >= 40 ? theme.colors.accent.orange :
    theme.colors.accent.red;

  return (
    <>
      {/* Score ring */}
      <View style={styles.scoreCard}>
        <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[styles.scorePercent, { color: scoreColor }]}>{kw.percentage}%</Text>
          <Text style={styles.scoreRingLabel}>Match</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scoreTitle}>
            {kw.percentage >= 70 ? "Strong match" :
             kw.percentage >= 40 ? "Moderate match" :
             "Gaps to close"}
          </Text>
          <Text style={styles.scoreSub}>{kw.score} of {kw.total} keywords found in your CV</Text>
        </View>
      </View>

      {/* Matched */}
      {kw.matched.length > 0 && (
        <View style={styles.pillSection}>
          <Text style={[styles.pillLabel, { color: theme.colors.accent.green }]}>
            ✓ In your CV ({kw.matched.length})
          </Text>
          <View style={styles.pillRow}>
            {kw.matched.map((k) => (
              <View key={k} style={[styles.pill, { backgroundColor: theme.colors.accent.green + "18", borderColor: theme.colors.accent.green + "55" }]}>
                <Text style={[styles.pillText, { color: theme.colors.accent.green }]}>{k}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Missing */}
      {kw.missing.length > 0 && (
        <View style={styles.pillSection}>
          <Text style={[styles.pillLabel, { color: theme.colors.accent.red }]}>
            ✗ Missing ({kw.missing.length})
          </Text>
          <View style={styles.pillRow}>
            {kw.missing.map((k) => (
              <View key={k} style={[styles.pill, { backgroundColor: theme.colors.accent.redDim, borderColor: theme.colors.accent.red + "55" }]}>
                <Text style={[styles.pillText, { color: theme.colors.accent.red }]}>{k}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recommendation */}
      {kw.recommendation ? (
        <View style={styles.recBox}>
          <Ionicons name="bulb-outline" size={14} color={theme.colors.accent.gold} />
          <Text style={styles.recText}>{kw.recommendation}</Text>
        </View>
      ) : null}
    </>
  );
}

// ── Text result (editable) ────────────────────────────────────────────────────

function TextResultView({ text, onEdit }: { text: string; onEdit: (t: string) => void }) {
  return (
    <TextInput
      style={styles.resultInput}
      multiline
      value={text}
      onChangeText={onEdit}
      scrollEnabled={false}
      textAlignVertical="top"
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatKeywords(kw?: KeywordResult): string {
  if (!kw) return "";
  return `CV Match: ${kw.percentage}%\n\nMatched: ${kw.matched.join(", ")}\n\nMissing: ${kw.missing.join(", ")}\n\nRecommendation: ${kw.recommendation}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 6,
    borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: theme.colors.bg.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  headerTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 15 },
  headerSub:   { color: theme.colors.text.muted, fontSize: 11, marginTop: 1 },
  trackBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: theme.colors.accent.green,
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7,
  },
  trackBtnDone: { backgroundColor: theme.colors.accent.green + "18", borderWidth: 1, borderColor: theme.colors.accent.green + "44" },
  trackBtnText: { color: theme.colors.text.inverse, fontSize: 12, fontWeight: "700" },

  noCvRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.colors.accent.orange + "12",
    borderBottomWidth: 1, borderBottomColor: theme.colors.accent.orange + "33",
  },
  noCvText: { color: theme.colors.text.secondary, fontSize: 12 },

  modeTabs: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border },
  modeTabsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: "center" },
  modeTab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    borderWidth: 1, borderColor: theme.colors.bg.border,
    backgroundColor: theme.colors.bg.card, position: "relative",
  },
  modeTabText: { color: theme.colors.text.secondary, fontSize: 12 },
  modeDot: {
    position: "absolute", top: 2, right: 2,
    width: 6, height: 6, borderRadius: 3,
  },

  content: { padding: 16 },

  noDescCard: {
    alignItems: "center", paddingVertical: 48,
    backgroundColor: theme.colors.bg.card, borderRadius: 14,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  noDescTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 16, marginTop: 12 },
  noDescSub:   { color: theme.colors.text.muted, fontSize: 13, textAlign: "center", marginTop: 6, paddingHorizontal: 24, lineHeight: 18 },

  generateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 14, paddingVertical: 16, marginBottom: 12,
  },
  generateBtnText: { color: theme.colors.text.inverse, fontWeight: "700", fontSize: 16 },

  loadingCard: { alignItems: "center", paddingVertical: 48 },
  loadingLabel: { fontWeight: "700", fontSize: 15, marginTop: 16 },

  resultInput: {
    backgroundColor: theme.colors.bg.card, borderRadius: 12,
    padding: 14, color: theme.colors.text.primary,
    fontSize: 13, lineHeight: 20,
    borderWidth: 1, borderColor: theme.colors.bg.border,
    minHeight: 200,
  },

  regenBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, marginTop: 10, paddingVertical: 8,
  },
  regenText: { color: theme.colors.text.muted, fontSize: 12 },

  scoreCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: theme.colors.bg.card, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  scoreRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, alignItems: "center", justifyContent: "center",
  },
  scorePercent:   { fontSize: 20, fontWeight: "800" },
  scoreRingLabel: { color: theme.colors.text.muted, fontSize: 10 },
  scoreTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 15, marginBottom: 3 },
  scoreSub:   { color: theme.colors.text.secondary, fontSize: 12, lineHeight: 16 },

  pillSection: { marginBottom: 12 },
  pillLabel:   { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 },
  pillRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "600" },

  recBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: theme.colors.accent.gold + "12",
    borderRadius: 10, padding: 12, marginTop: 4,
    borderWidth: 1, borderColor: theme.colors.accent.gold + "33",
  },
  recText: { flex: 1, color: theme.colors.text.secondary, fontSize: 13, lineHeight: 18 },

  bottomBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.bg.border,
    backgroundColor: theme.colors.bg.primary,
  },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.bg.card, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.colors.bg.border, flex: 1,
    justifyContent: "center",
  },
  copyBtnText: { color: theme.colors.text.secondary, fontWeight: "600", fontSize: 13 },
  openJobBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.accent.cyanDim, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "44", flex: 1,
    justifyContent: "center",
  },
  openJobBtnText: { color: theme.colors.accent.cyan, fontWeight: "600", fontSize: 13 },
});
