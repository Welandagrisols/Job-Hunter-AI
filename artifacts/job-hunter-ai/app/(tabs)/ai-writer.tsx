import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Share, Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { aiService } from "@/src/services/claude";
import { useColors } from "@/hooks/useColors";

type WritingMode = "cover_letter" | "email" | "cv_tailor" | "interview_prep" | "follow_up" | "keyword_match" | "qa";

const MODES: { key: WritingMode; label: string; icon: string; description: string }[] = [
  { key: "cover_letter", label: "Cover Letter", icon: "document-text-outline", description: "Generate a full tailored cover letter" },
  { key: "email", label: "App Email", icon: "mail-outline", description: "Write a professional job application email" },
  { key: "keyword_match", label: "Keyword Match", icon: "analytics-outline", description: "See how well your profile matches the job" },
  { key: "qa", label: "Q&A", icon: "chatbubble-outline", description: "Answer any application form question instantly" },
  { key: "cv_tailor", label: "Tailor CV", icon: "person-outline", description: "Get tailored CV bullet points for this role" },
  { key: "interview_prep", label: "Interview Prep", icon: "mic-outline", description: "Likely questions & suggested answers" },
  { key: "follow_up", label: "Follow-Up", icon: "refresh-outline", description: "Follow up on a submitted application" },
];

const MODE_TITLES: Record<WritingMode, string> = {
  cover_letter: "Cover Letter",
  email: "Application Email",
  cv_tailor: "Tailored CV Points",
  interview_prep: "Interview Prep",
  follow_up: "Follow-Up Email",
  keyword_match: "Keyword Match",
  qa: "Application Answer",
};

interface KeywordResult {
  score: number;
  total: number;
  percentage: number;
  matched: string[];
  missing: string[];
  recommendation: string;
}

export default function AIWriterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ prefill_company?: string; prefill_role?: string; prefill_description?: string }>();

  const [mode, setMode] = useState<WritingMode>("cover_letter");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [question, setQuestion] = useState("");
  const [daysSince, setDaysSince] = useState("7");
  const [result, setResult] = useState("");
  const [keywordResult, setKeywordResult] = useState<KeywordResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (params.prefill_company) setCompany(params.prefill_company);
    if (params.prefill_role) setRole(params.prefill_role);
    if (params.prefill_description) setJobDescription(params.prefill_description);
  }, [params.prefill_company, params.prefill_role, params.prefill_description]);

  const resetResults = () => { setResult(""); setKeywordResult(null); setCopied(false); };

  const generate = async () => {
    if (mode === "keyword_match") {
      if (!jobDescription.trim()) { Alert.alert("Missing info", "Paste the job description"); return; }
    } else if (mode === "qa") {
      if (!question.trim()) { Alert.alert("Missing info", "Enter the application question"); return; }
    } else if (mode === "follow_up") {
      if (!company.trim()) { Alert.alert("Missing info", "Enter the company name"); return; }
    } else if (mode === "cv_tailor") {
      if (!jobDescription.trim()) { Alert.alert("Missing info", "Paste the job description"); return; }
    } else {
      if (!company.trim()) { Alert.alert("Missing info", "Enter the company name"); return; }
      if (!jobDescription.trim()) { Alert.alert("Missing info", "Paste the job description"); return; }
    }

    setLoading(true);
    resetResults();

    try {
      if (mode === "keyword_match") {
        const kr = await aiService.analyzeKeywords(jobDescription);
        setKeywordResult(kr);
      } else if (mode === "qa") {
        setResult(await aiService.answerApplicationQuestion(question, company, role));
      } else if (mode === "email") {
        setResult(await aiService.generateApplicationEmail(role, company, jobDescription));
      } else if (mode === "cover_letter") {
        setResult(await aiService.generateCoverLetter(role, company, jobDescription));
      } else if (mode === "cv_tailor") {
        setResult(await aiService.tailorCVPoints(jobDescription));
      } else if (mode === "interview_prep") {
        setResult(await aiService.generateInterviewPrep(role, company, jobDescription));
      } else {
        setResult(await aiService.generateFollowUp(company, role, parseInt(daysSince) || 7));
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate. Check your Anthropic API key in Settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const buildHtml = (title: string, body: string, company: string, role: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; margin: 60px; color: #1a1a1a; line-height: 1.7; font-size: 13pt; }
    .header { margin-bottom: 36px; border-bottom: 2px solid #0066cc; padding-bottom: 14px; }
    .doc-title { font-size: 20pt; font-weight: bold; color: #0066cc; margin: 0 0 4px 0; }
    .meta { font-size: 10pt; color: #666; margin: 0; }
    .body { white-space: pre-wrap; word-break: break-word; }
    .footer { margin-top: 48px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9pt; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <p class="doc-title">${title}</p>
    <p class="meta">${[role, company].filter(Boolean).join(" — ")}${role || company ? " &nbsp;|&nbsp; " : ""}Generated by JobHunter AI</p>
  </div>
  <div class="body">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  <div class="footer">Wesley Kipkemoi Koech &nbsp;·&nbsp; JobHunter AI &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
</body>
</html>`;

  const handleDownloadPDF = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const title = MODE_TITLES[mode];
      const html = buildHtml(title, result, company, role);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Save ${title}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Sharing not available", "Your device does not support file sharing.");
      }
    } catch (err: any) {
      Alert.alert("Download failed", err.message || "Could not generate PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      await Share.share({ message: result, title: MODE_TITLES[mode] });
    } catch {}
  };

  const currentMode = MODES.find((m) => m.key === mode)!;
  const scoreColor = keywordResult
    ? keywordResult.percentage >= 70 ? colors.green
      : keywordResult.percentage >= 45 ? colors.orange
      : colors.destructive
    : colors.primary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 50 : 60 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>AI Writer</Text>
        <Text style={{ color: colors.primary, fontSize: 13, marginTop: 2 }}>Powered by Gemini AI</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        style={{ marginBottom: 12 }}
      >
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              backgroundColor: mode === m.key ? colors.primary : colors.card,
              borderWidth: 1, borderColor: mode === m.key ? colors.primary : colors.border,
            }}
            onPress={() => { setMode(m.key); resetResults(); }}
          >
            <Ionicons name={m.icon as any} size={13} color={mode === m.key ? colors.primaryForeground : colors.textSecondary} />
            <Text style={{ color: mode === m.key ? colors.primaryForeground : colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.primary + "22", borderRadius: 10, padding: 10 }}>
        <Ionicons name={currentMode.icon as any} size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13 }}>{currentMode.description}</Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 14 }}>

        {mode === "qa" && (
          <>
            <InputField label="Company" placeholder="e.g. Amiran Kenya Ltd" value={company} onChange={setCompany} colors={colors} />
            <InputField label="Role (optional)" placeholder="e.g. Cereal Agronomist" value={role} onChange={setRole} colors={colors} />
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>Application Question *</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" }}
                placeholder={'e.g. "Why do you want to work here?" or "Describe a challenge you overcame"'}
                placeholderTextColor={colors.textMuted}
                value={question}
                onChangeText={setQuestion}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </>
        )}

        {mode === "keyword_match" && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>Job Description *</Text>
            <TextInput
              style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15, minHeight: 150, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" }}
              placeholder="Paste the full job description here..."
              placeholderTextColor={colors.textMuted}
              value={jobDescription}
              onChangeText={setJobDescription}
              multiline
              numberOfLines={7}
              textAlignVertical="top"
            />
          </View>
        )}

        {mode !== "cv_tailor" && mode !== "keyword_match" && mode !== "qa" && (
          <>
            <InputField label="Company" placeholder="e.g. Amiran Kenya Ltd" value={company} onChange={setCompany} colors={colors} />
            <InputField label="Job Title" placeholder="e.g. Cereal Agronomist" value={role} onChange={setRole} colors={colors} />
          </>
        )}

        {mode === "follow_up" && (
          <InputField label="Days Since Application" placeholder="7" value={daysSince} onChange={setDaysSince} keyboardType="numeric" colors={colors} />
        )}

        {mode !== "follow_up" && mode !== "keyword_match" && mode !== "qa" && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
              {mode === "cv_tailor" ? "Job Description *" : "Job Description"}
            </Text>
            <TextInput
              style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" }}
              placeholder="Paste the full job description here..."
              placeholderTextColor={colors.textMuted}
              value={jobDescription}
              onChangeText={setJobDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        )}

        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: loading ? colors.primary + "99" : colors.primary, borderRadius: 999, padding: 16, marginTop: 4 }}
          onPress={generate}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color={colors.primaryForeground} size="small" />
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>
                {mode === "keyword_match" ? "Analysing..." : "Generating..."}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name={mode === "keyword_match" ? "analytics" : "sparkles"} size={18} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>
                {mode === "keyword_match" ? "Analyse Match" : mode === "qa" ? "Generate Answer" : "Generate with AI"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Keyword Match result ── */}
      {keywordResult && (
        <View style={{ margin: 16, gap: 14 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Profile Match Score</Text>
            <Text style={{ fontSize: 52, fontWeight: "800", color: scoreColor }}>{keywordResult.percentage}%</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {keywordResult.score} of {keywordResult.total} keywords matched
            </Text>
            <View style={{ width: "100%", height: 8, backgroundColor: colors.border, borderRadius: 999, marginTop: 12, overflow: "hidden" }}>
              <View style={{ width: `${keywordResult.percentage}%`, height: "100%", backgroundColor: scoreColor, borderRadius: 999 }} />
            </View>
            <Text style={{ color: scoreColor, fontSize: 12, fontWeight: "600", marginTop: 6 }}>
              {keywordResult.percentage >= 70 ? "Strong Match" : keywordResult.percentage >= 45 ? "Moderate Match" : "Weak Match"}
            </Text>
          </View>
          {keywordResult.matched.length > 0 && (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Matched Keywords</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {keywordResult.matched.map((kw) => (
                  <View key={kw} style={{ backgroundColor: colors.green + "20", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.green + "40" }}>
                    <Text style={{ color: colors.green, fontSize: 13, fontWeight: "500" }}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {keywordResult.missing.length > 0 && (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Ionicons name="alert-circle" size={16} color={colors.orange} />
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Gaps to Address</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {keywordResult.missing.map((kw) => (
                  <View key={kw} style={{ backgroundColor: colors.orange + "20", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.orange + "40" }}>
                    <Text style={{ color: colors.orange, fontSize: 13, fontWeight: "500" }}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {keywordResult.recommendation ? (
            <View style={{ backgroundColor: colors.primary + "15", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.primary + "30" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Ionicons name="sparkles" size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Recommendation</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>{keywordResult.recommendation}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }}
            onPress={generate}
          >
            <Ionicons name="refresh" size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Re-analyse</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Text result (editable) ── */}
      {result ? (
        <View style={{ margin: 16, gap: 0 }}>
          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>
                {MODE_TITLES[mode]}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>Tap to edit</Text>
          </View>

          {/* Editable body */}
          <TextInput
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              color: colors.foreground,
              fontSize: 14,
              lineHeight: 22,
              borderWidth: 1,
              borderColor: colors.border,
              textAlignVertical: "top",
              minHeight: 240,
            }}
            value={result}
            onChangeText={setResult}
            multiline
            textAlignVertical="top"
            autoCorrect
            spellCheck
          />

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            {/* Copy */}
            <TouchableOpacity
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: copied ? colors.green + "22" : colors.card,
                borderRadius: 12, paddingVertical: 12,
                borderWidth: 1, borderColor: copied ? colors.green : colors.border,
              }}
              onPress={handleCopy}
            >
              <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={17} color={copied ? colors.green : colors.foreground} />
              <Text style={{ color: copied ? colors.green : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {copied ? "Copied!" : "Copy"}
              </Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: colors.card, borderRadius: 12, paddingVertical: 12,
                borderWidth: 1, borderColor: colors.border,
              }}
              onPress={handleShare}
            >
              <Ionicons name="share-social-outline" size={17} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Share</Text>
            </TouchableOpacity>

            {/* Download PDF */}
            <TouchableOpacity
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: colors.primary + "20", borderRadius: 12, paddingVertical: 12,
                borderWidth: 1, borderColor: colors.primary + "50",
              }}
              onPress={handleDownloadPDF}
              disabled={downloading}
            >
              {downloading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Ionicons name="document-attach-outline" size={17} color={colors.primary} />
              }
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                {downloading ? "..." : "PDF"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Regenerate link */}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 }}
            onPress={generate}
          >
            <Ionicons name="refresh" size={14} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Regenerate from scratch</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

function InputField({ label, placeholder, value, onChange, keyboardType = "default", colors }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
      />
    </View>
  );
}
