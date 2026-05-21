import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router";
import { urlParser, ParsedJob } from "@/src/services/urlParser";
import { db } from "@/src/services/storage";
import { aiService, getGeminiApiKey, setGeminiStatusCallback } from "@/src/services/gemini";
import { aiService as docsService } from "@/src/services/claude";
import { notificationService } from "@/src/services/notifications";
import { theme } from "@/src/theme";

type InputMode = "url" | "text";
type MatchResult = { score: number; percentage: number; matched: string[]; missing: string[]; recommendation: string };

export default function JobCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefillUrl?: string }>();
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [url, setUrl] = useState(params.prefillUrl || "");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [parsed, setParsed] = useState<ParsedJob | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [analyzingMatch, setAnalyzingMatch] = useState(false);
  const [matchExpanded, setMatchExpanded] = useState(true);

  useFocusEffect(useCallback(() => {
    getGeminiApiKey().then(k => setHasApiKey(!!k));
  }, []));

  const parse = async () => {
    const key = await getGeminiApiKey();
    if (!key) {
      Alert.alert(
        "Gemini API Key Required",
        "To extract job details, you need a free Gemini API key. It takes 2 minutes to set up.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "Go to Settings", onPress: () => router.push("/(tabs)/settings") },
        ]
      );
      return;
    }

    const input = inputMode === "url" ? url.trim() : text.trim();
    if (!input) {
      Alert.alert(
        "Empty input",
        inputMode === "url" ? "Please paste a job URL first" : "Please paste job ad text first"
      );
      return;
    }

    setLoading(true);
    setParsed(null);
    setParseError(null);
    setGeneratedEmail("");
    setGeneratedCoverLetter("");
    setGeminiStatusCallback((msg) => setLoadingStep(msg));

    try {
      setLoadingStep(inputMode === "url" ? "Fetching job page..." : "Reading job ad...");
      const result = inputMode === "url"
        ? await urlParser.parseFromUrl(input)
        : await urlParser.parseFromText(input);
      setLoadingStep("Parsing with AI...");
      setParsed(result);
      setMatchResult(null);
      // Kick off CV match analysis in the background — non-blocking
      runMatchAnalysis(result.rawText);
    } catch (err: any) {
      setParseError(err.message || "Could not extract job details. Try switching to 'Paste Text'.");
    } finally {
      setGeminiStatusCallback(null);
      setLoading(false);
      setLoadingStep("");
    }
  };

  const runMatchAnalysis = async (jobText: string) => {
    if (!jobText) return;
    setAnalyzingMatch(true);
    try {
      const result = await docsService.analyzeKeywords(jobText);
      setMatchResult(result);
    } catch {
      // Silent fail — match analysis is a bonus, not critical
    } finally {
      setAnalyzingMatch(false);
    }
  };

  const generateEmail = async () => {
    if (!parsed) return;
    setGenerating("email");
    setGenError(null);
    try {
      const email = await aiService.generateApplicationEmail(parsed.role, parsed.company, parsed.rawText, "confident");
      setGeneratedEmail(email);
    } catch (err: any) {
      setGenError(err.message || "Failed to generate email. Check your Gemini API key in Settings.");
    } finally {
      setGenerating(null);
    }
  };

  const generateCoverLetter = async () => {
    if (!parsed) return;
    setGenerating("cover");
    setGenError(null);
    try {
      const letter = await aiService.generateCoverLetter(parsed.role, parsed.company, parsed.rawText, "confident", "standard");
      setGeneratedCoverLetter(letter);
    } catch (err: any) {
      setGenError(err.message || "Failed to generate cover letter. Check your Gemini API key in Settings.");
    } finally {
      setGenerating(null);
    }
  };

  const saveAndTrack = async () => {
    if (!parsed) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const saved = await db.addApplication({
        company: parsed.company || "Unknown Company",
        role: parsed.role || "Unknown Role",
        contact_email: parsed.contactEmail,
        job_url: parsed.sourceUrl,
        deadline: parsed.deadline,
        location: parsed.location,
        salary: parsed.salary,
        requirements: parsed.requirements,
        status: "applied",
        cover_letter: generatedCoverLetter,
        application_email: generatedEmail,
        source: parsed.sourceName,
        notes: `Source: ${parsed.sourceName}`,
      });

      // Schedule reminders in the background (non-blocking)
      const company = parsed.company || "Unknown Company";
      const role = parsed.role || "Unknown Role";
      notificationService.scheduleFollowUpReminder(company, role, saved.id, 7);
      if (parsed.deadline) {
        notificationService.scheduleDeadlineReminder(company, role, parsed.deadline);
      }

      setSaveSuccess(true);
    } catch (err: any) {
      setGenError(err.message || "Could not save application.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Job Capture</Text>
          <Text style={styles.subtitle}>Paste URL or job ad → AI does the rest</Text>
        </View>
      </View>

      {/* API Key warning banner */}
      {hasApiKey === false && (
        <TouchableOpacity
          style={styles.warningBanner}
          onPress={() => router.push("/(tabs)/settings")}
          activeOpacity={0.8}
        >
          <Ionicons name="key-outline" size={18} color={theme.colors.accent.orange} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Gemini API Key Required</Text>
            <Text style={styles.warningSubtitle}>Tap here to add your free API key in Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.accent.orange} />
        </TouchableOpacity>
      )}

      {/* Input mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, inputMode === "url" && styles.modeBtnActive]}
          onPress={() => setInputMode("url")}
        >
          <Ionicons name="link-outline" size={16} color={inputMode === "url" ? theme.colors.bg.primary : theme.colors.text.secondary} />
          <Text style={[styles.modeBtnText, inputMode === "url" && styles.modeBtnTextActive]}>From URL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, inputMode === "text" && styles.modeBtnActive]}
          onPress={() => setInputMode("text")}
        >
          <Ionicons name="document-text-outline" size={16} color={inputMode === "text" ? theme.colors.bg.primary : theme.colors.text.secondary} />
          <Text style={[styles.modeBtnText, inputMode === "text" && styles.modeBtnTextActive]}>Paste Text</Text>
        </TouchableOpacity>
      </View>

      {/* Supported boards */}
      {inputMode === "url" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boardsScroll} contentContainerStyle={styles.boardsContainer}>
          {["BrighterMonday", "MyJobMag", "LinkedIn", "Fuzu", "JobWebKenya", "Indeed", "ReliefWeb"].map((b) => (
            <View key={b} style={styles.boardChip}>
              <Text style={styles.boardChipText}>{b}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Paste Text tip */}
      {inputMode === "text" && (
        <View style={styles.tipBanner}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.accent.cyan} />
          <Text style={styles.tipText}>
            Open the job page, select all the text, copy it, then paste here. Works even when URLs fail.
          </Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        {inputMode === "url" ? (
          <TextInput
            style={styles.urlInput}
            placeholder="https://brightermonday.co.ke/jobs/..."
            placeholderTextColor={theme.colors.text.muted}
            value={url}
            onChangeText={setUrl}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <TextInput
            style={[styles.urlInput, styles.textArea]}
            placeholder="Paste the full job advertisement here..."
            placeholderTextColor={theme.colors.text.muted}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        )}

        <TouchableOpacity
          style={[styles.parseBtn, (loading || hasApiKey === false) && styles.parseBtnDisabled]}
          onPress={parse}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color={theme.colors.bg.primary} size="small" />
              <Text style={styles.parseBtnText}>{loadingStep || "Working..."}</Text>
            </>
          ) : (
            <>
              <Ionicons name="scan-outline" size={18} color={theme.colors.bg.primary} />
              <Text style={styles.parseBtnText}>Extract Job Details</Text>
            </>
          )}
        </TouchableOpacity>

        {parseError && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#ff000018", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#ff000044" }}>
            <Ionicons name="close-circle" size={18} color={theme.colors.accent.red || "#ff4444"} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ff4444", fontWeight: "600", fontSize: 13, marginBottom: 4 }}>Could Not Extract</Text>
              <Text style={{ color: "#ff7777", fontSize: 12, lineHeight: 18 }}>{parseError}</Text>
              {inputMode === "url" && (
                <TouchableOpacity onPress={() => { setInputMode("text"); setParseError(null); }} style={{ marginTop: 8 }}>
                  <Text style={{ color: theme.colors.accent.cyan, fontSize: 12, fontWeight: "600" }}>→ Switch to Paste Text instead</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Parsed result */}
      {parsed && (
        <View style={styles.resultContainer}>
          <View style={styles.jobSummary}>
            <View style={styles.sourceBadge}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.accent.green} />
              <Text style={styles.sourceText}>Extracted from {parsed.sourceName}</Text>
            </View>

            <Text style={styles.jobCompany}>{parsed.company || "Company not found"}</Text>
            <Text style={styles.jobRole}>{parsed.role || "Role not found"}</Text>

            <View style={styles.jobMeta}>
              {parsed.location ? <MetaChip icon="location-outline" text={parsed.location} /> : null}
              {parsed.deadline ? <MetaChip icon="calendar-outline" text={`Deadline: ${parsed.deadline}`} color={theme.colors.accent.orange} /> : null}
              {parsed.salary ? <MetaChip icon="cash-outline" text={parsed.salary} color={theme.colors.accent.green} /> : null}
              {parsed.contactEmail ? <MetaChip icon="mail-outline" text={parsed.contactEmail} /> : null}
            </View>
          </View>

          {/* ── CV Match Card ── */}
          {(analyzingMatch || matchResult) && (
            <View style={[styles.matchCard, matchResult && {
              borderColor:
                matchResult.percentage >= 70 ? theme.colors.accent.green + "55" :
                matchResult.percentage >= 40 ? theme.colors.accent.orange + "55" :
                theme.colors.accent.red + "55",
            }]}>
              <TouchableOpacity
                style={styles.matchHeader}
                onPress={() => setMatchExpanded(v => !v)}
                activeOpacity={0.8}
              >
                <View style={styles.matchTitleRow}>
                  <Ionicons name="analytics-outline" size={16} color={
                    !matchResult ? theme.colors.text.muted :
                    matchResult.percentage >= 70 ? theme.colors.accent.green :
                    matchResult.percentage >= 40 ? theme.colors.accent.orange :
                    theme.colors.accent.red
                  } />
                  <Text style={styles.matchTitle}>CV Match Analysis</Text>
                  {analyzingMatch && <ActivityIndicator size="small" color={theme.colors.accent.cyan} style={{ marginLeft: 6 }} />}
                </View>
                {matchResult && (
                  <View style={[styles.matchScoreBadge, {
                    backgroundColor:
                      matchResult.percentage >= 70 ? theme.colors.accent.green + "22" :
                      matchResult.percentage >= 40 ? theme.colors.accent.orange + "22" :
                      theme.colors.accent.red + "22",
                  }]}>
                    <Text style={[styles.matchScoreText, {
                      color:
                        matchResult.percentage >= 70 ? theme.colors.accent.green :
                        matchResult.percentage >= 40 ? theme.colors.accent.orange :
                        theme.colors.accent.red,
                    }]}>{matchResult.percentage}%</Text>
                  </View>
                )}
                {matchResult && (
                  <Ionicons
                    name={matchExpanded ? "chevron-up" : "chevron-down"}
                    size={14} color={theme.colors.text.muted}
                  />
                )}
              </TouchableOpacity>

              {analyzingMatch && !matchResult && (
                <Text style={styles.matchAnalyzing}>Comparing your CV against this role...</Text>
              )}

              {matchResult && matchExpanded && (
                <View style={styles.matchBody}>
                  {/* Score bar */}
                  <View style={styles.matchBarBg}>
                    <View style={[styles.matchBarFill, {
                      width: `${matchResult.percentage}%` as any,
                      backgroundColor:
                        matchResult.percentage >= 70 ? theme.colors.accent.green :
                        matchResult.percentage >= 40 ? theme.colors.accent.orange :
                        theme.colors.accent.red,
                    }]} />
                  </View>
                  <Text style={styles.matchBarLabel}>
                    {matchResult.score} of {matchResult.score + matchResult.missing.length} key skills matched
                  </Text>

                  {/* Matched keywords */}
                  {matchResult.matched.length > 0 && (
                    <View style={styles.matchSection}>
                      <Text style={styles.matchSectionLabel}>✓ You have these</Text>
                      <View style={styles.matchPillRow}>
                        {matchResult.matched.map((kw) => (
                          <View key={kw} style={styles.matchedPill}>
                            <Text style={styles.matchedPillText}>{kw}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Missing keywords */}
                  {matchResult.missing.length > 0 && (
                    <View style={styles.matchSection}>
                      <Text style={[styles.matchSectionLabel, { color: theme.colors.accent.orange }]}>
                        ⚠ Gaps to address in your cover letter
                      </Text>
                      <View style={styles.matchPillRow}>
                        {matchResult.missing.map((kw) => (
                          <View key={kw} style={styles.missingPill}>
                            <Text style={styles.missingPillText}>{kw}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Recommendation */}
                  {matchResult.recommendation && (
                    <View style={styles.matchRec}>
                      <Ionicons name="bulb-outline" size={14} color={theme.colors.accent.gold} />
                      <Text style={styles.matchRecText}>{matchResult.recommendation}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {parsed.requirements.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Requirements</Text>
              {parsed.requirements.slice(0, 5).map((r, i) => (
                <View key={i} style={styles.requirementRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.requirementText}>{r}</Text>
                </View>
              ))}
              {parsed.requirements.length > 5 && (
                <Text style={styles.moreText}>+{parsed.requirements.length - 5} more</Text>
              )}
            </View>
          )}

          {genError && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#ff000018", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#ff000044" }}>
              <Ionicons name="close-circle" size={18} color="#ff4444" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: "#ff4444", fontSize: 13, lineHeight: 18 }}>{genError}</Text>
            </View>
          )}

          {saveSuccess && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.colors.accent.green + "22", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.colors.accent.green + "55" }}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.accent.green, fontWeight: "700", fontSize: 14 }}>Saved to Job Tracker!</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/applications")} style={{ marginTop: 4 }}>
                  <Text style={{ color: theme.colors.accent.cyan, fontSize: 13 }}>View Applications →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Primary CTA: open full AI suite with all job data prefilled */}
          <TouchableOpacity
            style={styles.aiSuiteBtn}
            onPress={() => router.push({
              pathname: "/(tabs)/ai-writer",
              params: {
                prefill_company: parsed.company || "",
                prefill_role: parsed.role || "",
                prefill_description: parsed.rawText || "",
              },
            })}
          >
            <Ionicons name="sparkles" size={20} color={theme.colors.bg.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.aiSuiteBtnTitle}>Open Full AI Suite</Text>
              <Text style={styles.aiSuiteBtnSub}>Cover letter · CV tailor · Interview prep · Q&A · Follow-up</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.bg.primary} />
          </TouchableOpacity>

          <Text style={styles.actionsTitle}>Quick Generate</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, generating === "email" && styles.actionBtnDisabled]}
              onPress={generateEmail}
              disabled={!!generating}
            >
              {generating === "email"
                ? <ActivityIndicator color={theme.colors.accent.cyan} size="small" />
                : <Ionicons name="mail-outline" size={18} color={theme.colors.accent.cyan} />
              }
              <Text style={styles.actionBtnText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, generating === "cover" && styles.actionBtnDisabled]}
              onPress={generateCoverLetter}
              disabled={!!generating}
            >
              {generating === "cover"
                ? <ActivityIndicator color={theme.colors.accent.cyan} size="small" />
                : <Ionicons name="document-text-outline" size={18} color={theme.colors.accent.cyan} />
              }
              <Text style={styles.actionBtnText}>Cover Letter</Text>
            </TouchableOpacity>
          </View>

          {generatedEmail ? (
            <GeneratedContent title="Application Email" content={generatedEmail} />
          ) : null}

          {generatedCoverLetter ? (
            <GeneratedContent title="Cover Letter" content={generatedCoverLetter} />
          ) : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={saveAndTrack}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={theme.colors.bg.primary} size="small" />
              : <><Ionicons name="add-circle-outline" size={20} color={theme.colors.bg.primary} /><Text style={styles.saveBtnText}>Save to Job Tracker</Text></>
            }
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MetaChip({ icon, text, color = theme.colors.text.secondary }: any) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.metaChipText, { color }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function GeneratedContent({ title, content }: { title: string; content: string }) {
  return (
    <View style={styles.generatedCard}>
      <View style={styles.generatedHeader}>
        <Text style={styles.generatedTitle}>{title}</Text>
        <TouchableOpacity onPress={() => {
          Clipboard.setStringAsync(content);
          Alert.alert("Copied!", "Content copied to clipboard.");
        }}>
          <Ionicons name="copy-outline" size={18} color={theme.colors.accent.cyan} />
        </TouchableOpacity>
      </View>
      <Text style={styles.generatedText}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.bg.card, alignItems: "center", justifyContent: "center" },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, marginTop: 4 },
  warningBanner: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: "#2a1f0e", borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.accent.orange + "55" },
  warningTitle: { color: theme.colors.accent.orange, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.sm },
  warningSubtitle: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 2 },
  tipBanner: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.accent.cyanDim, borderRadius: theme.radius.md, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.accent.cyan + "33" },
  tipText: { flex: 1, color: theme.colors.accent.cyan, fontSize: theme.font.sizes.xs, lineHeight: 16 },
  modeToggle: { flexDirection: "row", marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.full, padding: 4, borderWidth: 1, borderColor: theme.colors.bg.border },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.full },
  modeBtnActive: { backgroundColor: theme.colors.accent.cyan },
  modeBtnText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  modeBtnTextActive: { color: theme.colors.bg.primary },
  boardsScroll: { marginBottom: theme.spacing.sm },
  boardsContainer: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm },
  boardChip: { paddingHorizontal: theme.spacing.sm, paddingVertical: 4, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.bg.border },
  boardChipText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.xs },
  inputContainer: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.md },
  urlInput: { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.md, color: theme.colors.text.primary, fontSize: theme.font.sizes.md, borderWidth: 1, borderColor: theme.colors.bg.border },
  textArea: { minHeight: 160, textAlignVertical: "top" },
  parseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, backgroundColor: theme.colors.accent.cyan, borderRadius: theme.radius.full, padding: theme.spacing.md },
  parseBtnDisabled: { opacity: 0.6 },
  parseBtnText: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.bold, fontSize: theme.font.sizes.md },
  resultContainer: { margin: theme.spacing.md, gap: theme.spacing.md },
  jobSummary: { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border },
  sourceBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: theme.spacing.sm },
  sourceText: { color: theme.colors.accent.green, fontSize: theme.font.sizes.xs },
  jobCompany: { color: theme.colors.text.primary, fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.bold },
  jobRole: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.md, marginTop: 4 },
  jobMeta: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.bg.elevated, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: 4 },
  metaChipText: { fontSize: theme.font.sizes.xs },
  section: { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border },
  sectionTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, marginBottom: theme.spacing.sm },
  requirementRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginBottom: 6 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent.cyan, marginTop: 6 },
  requirementText: { flex: 1, color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, lineHeight: 20 },
  moreText: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 4 },
  actionsTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.md },
  actions: { flexDirection: "row", gap: theme.spacing.sm },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.accent.cyan + "55" },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  generatedCard: { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border },
  generatedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.sm },
  generatedTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold },
  generatedText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, lineHeight: 20 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, backgroundColor: theme.colors.accent.green, borderRadius: theme.radius.full, padding: theme.spacing.md },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.bold, fontSize: theme.font.sizes.md },
  aiSuiteBtn: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.accent.cyan, borderRadius: theme.radius.lg, padding: theme.spacing.md },
  aiSuiteBtnTitle: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.bold, fontSize: theme.font.sizes.md },
  aiSuiteBtnSub: { color: theme.colors.bg.primary + "cc", fontSize: theme.font.sizes.xs, marginTop: 2 },

  // CV Match card
  matchCard: {
    backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.bg.border, overflow: "hidden",
  },
  matchHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: theme.spacing.md,
  },
  matchTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  matchTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 14 },
  matchAnalyzing: {
    color: theme.colors.text.muted, fontSize: 12, fontStyle: "italic",
    paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md,
  },
  matchScoreBadge: {
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3,
  },
  matchScoreText: { fontWeight: "800", fontSize: 15 },
  matchBody: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, gap: 12 },
  matchBarBg: {
    height: 6, backgroundColor: theme.colors.bg.elevated,
    borderRadius: 3, overflow: "hidden",
  },
  matchBarFill: { height: 6, borderRadius: 3 },
  matchBarLabel: { color: theme.colors.text.muted, fontSize: 11, marginTop: -4 },
  matchSection: { gap: 6 },
  matchSectionLabel: {
    color: theme.colors.accent.green, fontSize: 11,
    fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5,
  },
  matchPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  matchedPill: {
    backgroundColor: theme.colors.accent.green + "18",
    borderWidth: 1, borderColor: theme.colors.accent.green + "44",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  matchedPillText: { color: theme.colors.accent.green, fontSize: 11, fontWeight: "600" },
  missingPill: {
    backgroundColor: theme.colors.accent.orange + "15",
    borderWidth: 1, borderColor: theme.colors.accent.orange + "44",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  missingPillText: { color: theme.colors.accent.orange, fontSize: 11, fontWeight: "600" },
  matchRec: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: theme.colors.accent.gold + "12",
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: theme.colors.accent.gold + "33",
  },
  matchRecText: { flex: 1, color: theme.colors.text.secondary, fontSize: 12, lineHeight: 17 },
});
