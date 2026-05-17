import React, { useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "@/src/services/storage";
import { useColors } from "@/hooks/useColors";
import { urlParser } from "@/src/services/urlParser";
import { setGeminiStatusCallback } from "@/src/services/gemini";
import { JobApplication, STATUS_LABELS } from "@/src/types";

const STATUS_OPTIONS: JobApplication["status"][] = ["applied", "interview", "offer", "rejected", "withdrawn", "waiting"];

interface ParsedJob {
  company: string;
  role: string;
  location: string;
  deadline: string;
  contact_email: string;
  salary: string;
  job_description: string;
  requirements: string;
}

export default function SmartImportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [inputMode, setInputMode] = useState<"url" | "text">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedJob | null>(null);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [salary, setSalary] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [status, setStatus] = useState<JobApplication["status"]>("applied");
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      applied: colors.statusApplied,
      interview: colors.statusInterview,
      offer: colors.statusOffer,
      rejected: colors.statusRejected,
      withdrawn: colors.statusWithdrawn,
      waiting: colors.statusWaiting,
    };
    return map[s] || colors.primary;
  };

  const parseJob = async () => {
    const input = inputMode === "url" ? urlInput.trim() : textInput.trim();
    if (!input) {
      setParseError(inputMode === "url" ? "Please paste a job link first." : "Please paste the job text first.");
      return;
    }
    setParsing(true);
    setParsed(null);
    setParseError(null);
    setSaveSuccess(false);
    setLoadingStep(inputMode === "url" ? "Fetching job page..." : "Reading job ad...");
    setGeminiStatusCallback((msg) => setLoadingStep(msg));
    try {
      const result = inputMode === "url"
        ? await urlParser.parseFromUrl(input)
        : await urlParser.parseFromText(input);

      setParsed(result as any);
      setCompany(result.company || "");
      setRole(result.role || "");
      setLocation(result.location || "");
      setDeadline(result.deadline || "");
      setContactEmail(result.contactEmail || "");
      setSalary(result.salary || "");
      setJobDescription(result.responsibilities?.join("\n") || "");
      setRequirements(result.requirements?.join("\n") || "");
    } catch (err: any) {
      setParseError(err.message || "Could not parse the job. Try pasting the text directly.");
    } finally {
      setGeminiStatusCallback(null);
      setLoadingStep("");
      setParsing(false);
    }
  };

  const saveApplication = async (goToAIWriter = false) => {
    if (!company.trim() || !role.trim()) {
      setParseError("Company name and job title are required to save.");
      return;
    }
    setSaving(true);
    setParseError(null);
    try {
      const notes = [
        location && `Location: ${location}`,
        salary && `Salary: ${salary}`,
        jobDescription,
        requirements && `Requirements:\n${requirements}`,
      ].filter(Boolean).join("\n\n");

      await db.addApplication({
        company: company.trim(),
        role: role.trim(),
        contact_email: contactEmail.trim(),
        job_url: inputMode === "url" ? urlInput.trim() : "",
        deadline: deadline.trim() || undefined,
        status,
        notes: notes.trim(),
        date_applied: new Date().toISOString(),
      } as any);

      if (goToAIWriter) {
        router.replace({
          pathname: "/(tabs)/ai-writer",
          params: {
            prefill_company: company.trim(),
            prefill_role: role.trim(),
            prefill_description: [jobDescription, requirements].filter(Boolean).join("\n\n"),
          },
        });
      } else {
        setSaveSuccess(true);
      }
    } catch (err: any) {
      setParseError(err.message || "Could not save application.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 14,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground }}>Smart Import</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad + 40, gap: 16 }}
      >
        <View style={{ backgroundColor: colors.primary + "15", borderRadius: 12, padding: 12, flexDirection: "row", gap: 10 }}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={{ flex: 1, color: colors.primary, fontSize: 13, lineHeight: 20 }}>
            Paste a job link or the full job description — AI will extract all the details for you.
          </Text>
        </View>

        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {(["url", "text"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={{
                flex: 1, paddingVertical: 10, alignItems: "center",
                backgroundColor: inputMode === mode ? colors.primary : "transparent",
              }}
              onPress={() => setInputMode(mode)}
            >
              <Text style={{ color: inputMode === mode ? colors.primaryForeground : colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                {mode === "url" ? "Job Link" : "Paste Text"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {inputMode === "url" ? (
          <TextInput
            style={{
              backgroundColor: colors.card, borderRadius: 12, padding: 14,
              color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border,
            }}
            placeholder="https://careers.company.com/job/..."
            placeholderTextColor={colors.textMuted}
            value={urlInput}
            onChangeText={setUrlInput}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <TextInput
            style={{
              backgroundColor: colors.card, borderRadius: 12, padding: 14,
              color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border,
              minHeight: 160, textAlignVertical: "top",
            }}
            placeholder="Paste the full job advertisement text here..."
            placeholderTextColor={colors.textMuted}
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        )}

        <TouchableOpacity
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            backgroundColor: parsing ? colors.primary + "99" : colors.primary,
            borderRadius: 999, padding: 14,
          }}
          onPress={parseJob}
          disabled={parsing}
        >
          {parsing ? (
            <>
              <ActivityIndicator color={colors.primaryForeground} size="small" />
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>{loadingStep || "Analysing job ad..."}</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>Parse with AI</Text>
            </>
          )}
        </TouchableOpacity>

        {parseError && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#ff000018", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#ff000044" }}>
            <Ionicons name="close-circle" size={18} color="#ff4444" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#ff4444", fontSize: 13, lineHeight: 18 }}>{parseError}</Text>
              {inputMode === "url" && (
                <TouchableOpacity onPress={() => { setInputMode("text"); setParseError(null); }} style={{ marginTop: 6 }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>→ Switch to Paste Text instead</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {saveSuccess && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.green + "22", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.green + "55" }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Application Saved!</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/applications")} style={{ marginTop: 4 }}>
                <Text style={{ color: colors.primary, fontSize: 13 }}>View in Applications →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {parsed && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "600" }}>Extracted — review and edit below</Text>
            </View>

            <Field label="Company *" colors={colors}>
              <TextInput style={inputStyle(colors)} value={company} onChangeText={setCompany}
                placeholder="Company name" placeholderTextColor={colors.textMuted} />
            </Field>

            <Field label="Role / Job Title *" colors={colors}>
              <TextInput style={inputStyle(colors)} value={role} onChangeText={setRole}
                placeholder="Job title" placeholderTextColor={colors.textMuted} />
            </Field>

            <Field label="Location" colors={colors}>
              <TextInput style={inputStyle(colors)} value={location} onChangeText={setLocation}
                placeholder="City, Country" placeholderTextColor={colors.textMuted} />
            </Field>

            {salary ? (
              <Field label="Salary" colors={colors}>
                <TextInput style={inputStyle(colors)} value={salary} onChangeText={setSalary}
                  placeholder="Salary range" placeholderTextColor={colors.textMuted} />
              </Field>
            ) : null}

            <Field label="Application Deadline" colors={colors}>
              <TextInput style={inputStyle(colors)} value={deadline} onChangeText={setDeadline}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
            </Field>

            <Field label="Contact / Application Email" colors={colors}>
              <TextInput style={inputStyle(colors)} value={contactEmail} onChangeText={setContactEmail}
                placeholder="recruitment@company.com" placeholderTextColor={colors.textMuted}
                keyboardType="email-address" autoCapitalize="none" />
            </Field>

            <Field label="Job Summary" colors={colors}>
              <TextInput
                style={[inputStyle(colors), { minHeight: 90, textAlignVertical: "top" }]}
                value={jobDescription} onChangeText={setJobDescription}
                placeholder="Role summary..." placeholderTextColor={colors.textMuted}
                multiline numberOfLines={4} textAlignVertical="top" />
            </Field>

            <Field label="Key Requirements" colors={colors}>
              <TextInput
                style={[inputStyle(colors), { minHeight: 100, textAlignVertical: "top" }]}
                value={requirements} onChangeText={setRequirements}
                placeholder="Requirements..." placeholderTextColor={colors.textMuted}
                multiline numberOfLines={5} textAlignVertical="top" />
            </Field>

            <Field label="Status" colors={colors}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {STATUS_OPTIONS.map((s) => {
                  const color = statusColor(s);
                  const active = status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                        backgroundColor: active ? color + "22" : colors.card,
                        borderWidth: 1, borderColor: active ? color : colors.border,
                      }}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={{ color: active ? color : colors.textSecondary, fontSize: 13, fontWeight: active ? "600" : "400" }}>
                        {STATUS_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <TouchableOpacity
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: colors.primary, borderRadius: 999, padding: 16,
                opacity: saving ? 0.6 : 1,
              }}
              onPress={() => saveApplication(true)}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />}
              <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>
                Save & Write Cover Letter
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: colors.card, borderRadius: 999, padding: 16,
                borderWidth: 1, borderColor: colors.border, opacity: saving ? 0.6 : 1,
              }}
              onPress={() => saveApplication(false)}
              disabled={saving}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>
                Save Application Only
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    color: colors.foreground,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  };
}
