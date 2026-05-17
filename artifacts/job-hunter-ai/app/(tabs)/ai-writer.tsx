import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Share, Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { aiService } from "@/src/services/gemini";
import { db } from "@/src/services/storage";
import { useColors } from "@/hooks/useColors";

type WritingMode = "cover_letter" | "email" | "cv_tailor" | "interview_prep" | "follow_up" | "keyword_match" | "qa";

const MODES: { key: WritingMode; label: string; icon: string; description: string }[] = [
  { key: "cover_letter", label: "Cover Letter", icon: "document-text-outline", description: "Generate a tailored cover letter" },
  { key: "email", label: "App Email", icon: "mail-outline", description: "Write a professional job application email" },
  { key: "keyword_match", label: "CV Match", icon: "analytics-outline", description: "Score your CV against the job description" },
  { key: "qa", label: "Q&A", icon: "chatbubble-outline", description: "Answer any application form question" },
  { key: "cv_tailor", label: "Tailor CV", icon: "person-outline", description: "Get tailored CV bullet points for this role" },
  { key: "interview_prep", label: "Interview Prep", icon: "mic-outline", description: "Likely questions & suggested answers" },
  { key: "follow_up", label: "Follow-Up", icon: "refresh-outline", description: "Follow up on a submitted application" },
];

export default function AIWriterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ prefill_company?: string; prefill_role?: string; prefill_description?: string }>();

  const [mode, setMode] = useState<WritingMode>("cover_letter");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [question, setQuestion] = useState("");
  const [daysSince, setDaysSince] = useState("7");
  const [result, setResult] = useState("");
  const [cvMatchResult, setCvMatchResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasCv, setHasCv] = useState(false);

  useEffect(() => {
    db.getCVVault().then((vault) => setHasCv(!!vault.cvText));
    if (params.prefill_company) setCompany(params.prefill_company);
    if (params.prefill_role) setRole(params.prefill_role);
    if (params.prefill_description) setJobDescription(params.prefill_description);
  }, [params.prefill_company, params.prefill_role, params.prefill_description]);

  const resetResults = () => { setResult(""); setCvMatchResult(null); };

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
      if (!company.trim() || !jobDescription.trim()) {
        Alert.alert("Missing info", "Enter company name and job description");
        return;
      }
    }

    setLoading(true);
    resetResults();

    try {
      if (mode === "keyword_match") {
        const vault = await db.getCVVault();
        const score = await aiService.scoreCVMatch(jobDescription, vault.cvText || "");
        setCvMatchResult(score);
      } else if (mode === "qa") {
        setResult(await aiService.answerApplicationQuestion(question, company, role));
      } else if (mode === "email") {
        setResult(await aiService.generateApplicationEmail(role, company, jobDescription));
      } else if (mode === "cover_letter") {
        setResult(await aiService.generateCoverLetter(role, company, jobDescription));
      } else if (mode === "cv_tailor") {
        const vault = await db.getCVVault();
        setResult(await aiService.tailorCVPoints(jobDescription, vault.cvText || undefined));
      } else if (mode === "interview_prep") {
        setResult(await aiService.generateInterviewPrep(role, company, jobDescription));
      } else {
        setResult(await aiService.generateFollowUp(company, role, parseInt(daysSince) || 7));
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate. Check your Gemini API key in Settings.");
    } finally {
      setLoading(false);
    }
  };

  const currentMode = MODES.find((m) => m.key === mode)!;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 50 : 40 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>AI Writer</Text>
            <Text style={{ color: colors.primary, fontSize: 13, marginTop: 2 }}>Powered by Gemini 2.0 Flash</Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: hasCv ? colors.green + "55" : colors.border }}
            onPress={() => router.push("/cv-vault")}
          >
            <Ionicons name={hasCv ? "document-text" : "document-text-outline"} size={15} color={hasCv ? colors.green : colors.textSecondary} />
            <Text style={{ color: hasCv ? colors.green : colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
              {hasCv ? "CV Loaded" : "Add CV"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!hasCv && (
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.orange + "22", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.orange + "44" }}
          onPress={() => router.push("/cv-vault")}
        >
          <Ionicons name="alert-circle-outline" size={16} color={colors.orange} />
          <Text style={{ flex: 1, color: colors.orange, fontSize: 13 }}>Save your CV to get more personalised AI output</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.orange} />
        </TouchableOpacity>
      )}

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
            <MultilineField label="Application Question *" placeholder={'"Why do you want to work here?" or "Describe a challenge you overcame"'} value={question} onChange={setQuestion} colors={colors} lines={4} />
          </>
        )}

        {mode === "keyword_match" && (
          <>
            {hasCv && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.green + "22", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: colors.green + "44" }}>
                <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                <Text style={{ color: colors.green, fontSize: 12 }}>Using your saved CV for matching</Text>
              </View>
            )}
            <MultilineField label="Job Description *" placeholder="Paste the full job description here..." value={jobDescription} onChange={setJobDescription} colors={colors} lines={7} />
          </>
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
          <MultilineField
            label={mode === "cv_tailor" ? "Job Description *" : "Job Description"}
            placeholder="Paste the full job description here..."
            value={jobDescription}
            onChange={setJobDescription}
            colors={colors}
            lines={6}
          />
        )}

        <TouchableOpacity
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            backgroundColor: loading ? colors.primary + "99" : colors.primary,
            borderRadius: 999, padding: 16, marginTop: 4,
          }}
          onPress={generate}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color={colors.primaryForeground} size="small" />
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>Generating...</Text>
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

      {cvMatchResult && (
        <View style={{ margin: 16, gap: 14 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>CV Match Score</Text>
            <Text style={{
              fontSize: 52, fontWeight: "800",
              color: cvMatchResult.score >= 70 ? colors.green : cvMatchResult.score >= 45 ? colors.orange : colors.destructive
            }}>
              {cvMatchResult.score}%
            </Text>
            <View style={{ width: "100%", height: 8, backgroundColor: colors.border, borderRadius: 999, marginTop: 12, overflow: "hidden" }}>
              <View style={{ width: `${cvMatchResult.score}%`, height: "100%", backgroundColor: cvMatchResult.score >= 70 ? colors.green : cvMatchResult.score >= 45 ? colors.orange : colors.destructive, borderRadius: 999 }} />
            </View>
          </View>

          {cvMatchResult.matchedKeywords?.length > 0 && (
            <KeywordChips title="Matched" keywords={cvMatchResult.matchedKeywords} color={colors.green} colors={colors} />
          )}
          {cvMatchResult.missingKeywords?.length > 0 && (
            <KeywordChips title="Missing" keywords={cvMatchResult.missingKeywords} color={colors.orange} colors={colors} />
          )}
          {cvMatchResult.suggestions?.length > 0 && (
            <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginBottom: 10 }}>Suggestions</Text>
              {cvMatchResult.suggestions.map((s: string, i: number) => (
                <Text key={i} style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 6 }}>• {s}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {result ? (
        <View style={{ margin: 16, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Generated Content</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }} onPress={() => Share.share({ message: result })}>
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13 }}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }} onPress={() => Share.share({ message: result })}>
                <Ionicons name="share-outline" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13 }}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}>{result}</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}
            onPress={generate}
          >
            <Ionicons name="refresh" size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

function KeywordChips({ title, keywords, color, colors }: any) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Ionicons name={title === "Matched" ? "checkmark-circle" : "alert-circle"} size={15} color={color} />
        <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>{title} Keywords</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {keywords.map((kw: string) => (
          <View key={kw} style={{ backgroundColor: color + "20", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: color + "40" }}>
            <Text style={{ color, fontSize: 12, fontWeight: "500" }}>{kw}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function InputField({ label, placeholder, value, onChange, keyboardType = "default", colors }: any) {
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

function MultilineField({ label, placeholder, value, onChange, colors, lines = 5 }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15, minHeight: lines * 24, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" }}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={lines}
        textAlignVertical="top"
      />
    </View>
  );
}
