import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { urlParser, ParsedJob } from "../services/urlParser";
import { db } from "../services/storage";
import { aiService } from "../services/gemini";
import { theme } from "../theme";

type InputMode = "url" | "text";

export default function JobCaptureScreen({ navigation }: any) {
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [parsed, setParsed] = useState<ParsedJob | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");
  const [saving, setSaving] = useState(false);

  const parse = async () => {
    const input = inputMode === "url" ? url.trim() : text.trim();
    if (!input) {
      Alert.alert("Empty input", inputMode === "url" ? "Please paste a job URL" : "Please paste job ad text");
      return;
    }

    setLoading(true);
    setParsed(null);
    setGeneratedEmail("");
    setGeneratedCoverLetter("");

    try {
      setLoadingStep(inputMode === "url" ? "Fetching job page..." : "Reading job ad...");
      const result = inputMode === "url"
        ? await urlParser.parseFromUrl(input)
        : await urlParser.parseFromText(input);

      setParsed(result);
    } catch (err: any) {
      Alert.alert("Parse Error", err.message || "Could not parse job. Try pasting the text directly.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const generateEmail = async () => {
    if (!parsed) return;
    setGenerating("email");
    try {
      const email = await aiService.generateApplicationEmail(
        parsed.role, parsed.company, parsed.rawText, "confident"
      );
      setGeneratedEmail(email);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setGenerating(null);
    }
  };

  const generateCoverLetter = async () => {
    if (!parsed) return;
    setGenerating("cover");
    try {
      const letter = await aiService.generateCoverLetter(
        parsed.role, parsed.company, parsed.rawText, "confident", "standard"
      );
      setGeneratedCoverLetter(letter);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setGenerating(null);
    }
  };

  const saveAndTrack = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      await db.addApplication({
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
        notes: `Source: ${parsed.sourceName}`,
      });
      Alert.alert(
        "Saved! ✅",
        "Application added to your tracker.",
        [{ text: "View Tracker", onPress: () => navigation.navigate("Applications") },
         { text: "OK" }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Job Capture</Text>
        <Text style={styles.subtitle}>Paste URL or job ad → AI does the rest</Text>
      </View>

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
        <View style={styles.supportedBoards}>
          <Text style={styles.supportedLabel}>Works with:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {["BrighterMonday", "MyJobMag", "LinkedIn", "Fuzu", "JobWebKenya", "Indeed"].map((b) => (
              <View key={b} style={styles.boardChip}>
                <Text style={styles.boardChipText}>{b}</Text>
              </View>
            ))}
          </ScrollView>
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
          style={[styles.parseBtn, loading && styles.parseBtnDisabled]}
          onPress={parse}
          disabled={loading}
        >
          {loading ? (
            <><ActivityIndicator color={theme.colors.bg.primary} size="small" /><Text style={styles.parseBtnText}>{loadingStep}</Text></>
          ) : (
            <><Ionicons name="scan-outline" size={18} color={theme.colors.bg.primary} /><Text style={styles.parseBtnText}>Extract Job Details</Text></>
          )}
        </TouchableOpacity>
      </View>

      {/* Parsed result */}
      {parsed && (
        <View style={styles.resultContainer}>
          {/* Job summary */}
          <View style={styles.jobSummary}>
            <View style={styles.sourceBadge}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.accent.green} />
              <Text style={styles.sourceText}>Extracted from {parsed.sourceName}</Text>
            </View>

            <Text style={styles.jobCompany}>{parsed.company || "Company not found"}</Text>
            <Text style={styles.jobRole}>{parsed.role || "Role not found"}</Text>

            <View style={styles.jobMeta}>
              {parsed.location && <MetaChip icon="location-outline" text={parsed.location} />}
              {parsed.deadline && <MetaChip icon="calendar-outline" text={`Deadline: ${parsed.deadline}`} color={theme.colors.accent.orange} />}
              {parsed.salary && <MetaChip icon="cash-outline" text={parsed.salary} color={theme.colors.accent.green} />}
              {parsed.contactEmail && <MetaChip icon="mail-outline" text={parsed.contactEmail} />}
            </View>
          </View>

          {/* Requirements */}
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

          {/* AI Actions */}
          <Text style={styles.actionsTitle}>Generate with AI</Text>
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
              <Text style={styles.actionBtnText}>Application Email</Text>
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

          {/* Generated content */}
          {generatedEmail ? (
            <GeneratedContent title="Application Email" content={generatedEmail} />
          ) : null}

          {generatedCoverLetter ? (
            <GeneratedContent title="Cover Letter" content={generatedCoverLetter} />
          ) : null}

          {/* Save to tracker */}
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

function GeneratedContent({ title, content }: any) {
  const { Alert, Clipboard } = require("react-native");
  return (
    <View style={styles.generatedCard}>
      <View style={styles.generatedHeader}>
        <Text style={styles.generatedTitle}>{title}</Text>
        <TouchableOpacity onPress={() => {
          Clipboard.setString(content);
          Alert.alert("Copied!");
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
  header: { paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.md },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, marginTop: 4 },
  modeToggle: { flexDirection: "row", marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.full, padding: 4, borderWidth: 1, borderColor: theme.colors.bg.border },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.full },
  modeBtnActive: { backgroundColor: theme.colors.accent.cyan },
  modeBtnText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  modeBtnTextActive: { color: theme.colors.bg.primary },
  supportedBoards: { paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm },
  supportedLabel: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginBottom: 6 },
  boardChip: { marginRight: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: 4, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.bg.border },
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
});
