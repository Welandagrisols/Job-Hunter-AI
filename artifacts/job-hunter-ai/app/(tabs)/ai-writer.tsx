import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Share, Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { aiService } from "@/src/services/claude";
import { useColors } from "@/hooks/useColors";

type WritingMode = "email" | "cover_letter" | "cv_tailor" | "interview_prep" | "follow_up";

const MODES: { key: WritingMode; label: string; icon: string; description: string }[] = [
  { key: "email", label: "App Email", icon: "mail-outline", description: "Write a professional job application email" },
  { key: "cover_letter", label: "Cover Letter", icon: "document-text-outline", description: "Generate a full cover letter" },
  { key: "cv_tailor", label: "Tailor CV", icon: "person-outline", description: "Get CV bullet points for any role" },
  { key: "interview_prep", label: "Interview Prep", icon: "mic-outline", description: "Questions & answers for interviews" },
  { key: "follow_up", label: "Follow-Up", icon: "refresh-outline", description: "Follow up on an application" },
];

export default function AIWriterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [mode, setMode] = useState<WritingMode>("email");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [daysSince, setDaysSince] = useState("7");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!company.trim() && mode !== "cv_tailor") {
      Alert.alert("Missing info", "Please enter the company name");
      return;
    }
    if (!jobDescription.trim() && mode !== "follow_up") {
      Alert.alert("Missing info", "Please paste the job description");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      let output = "";
      if (mode === "email") output = await aiService.generateApplicationEmail(role, company, jobDescription);
      else if (mode === "cover_letter") output = await aiService.generateCoverLetter(role, company, jobDescription);
      else if (mode === "cv_tailor") output = await aiService.tailorCVPoints(jobDescription);
      else if (mode === "interview_prep") output = await aiService.generateInterviewPrep(role, company, jobDescription);
      else output = await aiService.generateFollowUp(company, role, parseInt(daysSince) || 7);
      setResult(output);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate. Check your Anthropic API key in Settings.");
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
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>AI Writer</Text>
        <Text style={{ color: colors.primary, fontSize: 13, marginTop: 2 }}>Powered by Claude AI</Text>
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
            onPress={() => { setMode(m.key); setResult(""); }}
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
        {mode !== "cv_tailor" && (
          <>
            <InputField label="Company" placeholder="e.g. Amiran Kenya Ltd" value={company} onChange={setCompany} colors={colors} />
            <InputField label="Job Title" placeholder="e.g. Cereal Agronomist" value={role} onChange={setRole} colors={colors} />
          </>
        )}

        {mode === "follow_up" && (
          <InputField label="Days Since Application" placeholder="7" value={daysSince} onChange={setDaysSince} keyboardType="numeric" colors={colors} />
        )}

        {mode !== "follow_up" && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
              {mode === "cv_tailor" ? "Job Description (paste full JD)" : "Job Description"}
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.card, borderRadius: 12, padding: 14,
                color: colors.foreground, fontSize: 15, minHeight: 120,
                borderWidth: 1, borderColor: colors.border, textAlignVertical: "top",
              }}
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
              <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>Generate with AI</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {result ? (
        <View style={{ margin: 16, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Generated Content</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
                onPress={() => Share.share({ message: result })}
              >
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13 }}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
                onPress={() => Share.share({ message: result })}
              >
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
