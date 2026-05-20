import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
  Share, Linking, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/src/services/storage";
import { notificationService } from "@/src/services/notifications";
import { useColors } from "@/hooks/useColors";
import { JobApplication, STATUS_LABELS } from "@/src/types";
import { aiService, getGeminiApiKey, setGeminiStatusCallback } from "@/src/services/gemini";
import { aiService as docsService } from "@/src/services/claude";
import { urlParser } from "@/src/services/urlParser";

type CustomQ = { id: string; q: string; a: string };

const STATUS_OPTIONS: JobApplication["status"][] = ["applied", "interview", "offer", "rejected", "withdrawn", "waiting"];

const AI_DOC_LABELS: Record<string, string> = {
  application_email: "Application Email",
  cover_letter: "Cover Letter",
  interview_prep: "Interview Prep",
  cv_tailoring: "CV Tailoring Notes",
};

export default function AddApplicationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, focus } = useLocalSearchParams<{ id?: string; focus?: string }>();
  const interviewDateRef = useRef<TextInput>(null);

  const [tab, setTab] = useState<"details" | "documents" | "prep">("details");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [status, setStatus] = useState<JobApplication["status"]>("applied");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  // AI documents
  const [coverLetter, setCoverLetter] = useState("");
  const [applicationEmail, setApplicationEmail] = useState("");
  const [interviewPrep, setInterviewPrep] = useState("");
  const [cvTailoring, setCvTailoring] = useState("");
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<CustomQ[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  // Auto-fill modal state
  const [autoFillVisible, setAutoFillVisible] = useState(false);
  const [autoFillMode, setAutoFillMode] = useState<"url" | "text">("url");
  const [autoFillInput, setAutoFillInput] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillStep, setAutoFillStep] = useState("");
  const [autoFillError, setAutoFillError] = useState("");
  const [autoFillStage, setAutoFillStage] = useState<0 | 1 | 2 | 3 | 4>(0);
  // 0=idle 1=fetching 2=filling fields 3=generating docs 4=done

  useEffect(() => {
    if (id) {
      db.getApplicationById(id).then((app) => {
        if (app) {
          setCompany(app.company);
          setRole(app.role);
          setContactEmail(app.contact_email || "");
          setJobUrl(app.job_url || "");
          setDeadline(app.deadline || "");
          setInterviewDate(app.interview_date || "");
          setStatus(app.status);
          setNotes(app.notes || "");
          setCoverLetter(app.cover_letter || "");
          setApplicationEmail(app.application_email || "");
          setInterviewPrep(app.interview_prep || "");
          setCvTailoring(app.cv_tailoring || "");

          if (focus === "interview_date") {
            setTab("details");
            setTimeout(() => interviewDateRef.current?.focus(), 400);
          }
          if (focus === "documents") setTab("documents");
          if (focus === "prep") setTab("prep");
        }
        setLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`@jobhunter:custom_questions_${id}`)
      .then((raw) => { if (raw) setCustomQuestions(JSON.parse(raw)); })
      .catch(() => {});
  }, [id]);

  const saveCustomQuestions = async (qs: CustomQ[]) => {
    if (!id) return;
    await AsyncStorage.setItem(`@jobhunter:custom_questions_${id}`, JSON.stringify(qs)).catch(() => {});
  };

  const addCustomQuestion = () => {
    const q = newQuestion.trim();
    if (!q) return;
    const updated = [...customQuestions, { id: Date.now().toString(), q, a: "" }];
    setCustomQuestions(updated);
    saveCustomQuestions(updated);
    setNewQuestion("");
  };

  const removeCustomQuestion = (qid: string) => {
    const updated = customQuestions.filter((cq) => cq.id !== qid);
    setCustomQuestions(updated);
    saveCustomQuestions(updated);
  };

  const getAiAnswer = async (qid: string) => {
    const cq = customQuestions.find((q) => q.id === qid);
    if (!cq) return;
    setAnsweringId(qid);
    try {
      const answer = await docsService.answerApplicationQuestion(cq.q, company, role);
      const updated = customQuestions.map((q) => q.id === qid ? { ...q, a: answer } : q);
      setCustomQuestions(updated);
      saveCustomQuestions(updated);
    } catch (err: any) {
      Alert.alert("Could not get answer", err.message || "Please try again.");
    } finally {
      setAnsweringId(null);
    }
  };

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

  const scheduleInterviewReminder = async (dateStr: string, company: string, role: string) => {
    if (!dateStr) return;
    try {
      const date = new Date(dateStr);
      date.setHours(7, 30, 0, 0);
      if (date > new Date()) {
        await notificationService.scheduleInterviewReminder(date, company, role);
      }
    } catch {
      // notifications not available
    }
  };

  const save = async () => {
    if (!company.trim() || !role.trim()) {
      Alert.alert("Required", "Please enter company name and role");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<JobApplication> = {
        company: company.trim(),
        role: role.trim(),
        contact_email: contactEmail.trim(),
        job_url: jobUrl.trim(),
        deadline: deadline.trim() || undefined,
        interview_date: interviewDate.trim() || undefined,
        status,
        notes: notes.trim(),
        cover_letter: coverLetter || undefined,
        application_email: applicationEmail || undefined,
        interview_prep: interviewPrep || undefined,
        cv_tailoring: cvTailoring || undefined,
      };

      if (id) {
        const prev = await db.getApplicationById(id);
        await db.updateApplication(id, payload);
        if (interviewDate && interviewDate !== prev?.interview_date) {
          await scheduleInterviewReminder(interviewDate, company.trim(), role.trim());
        }
        if (deadline.trim() && deadline.trim() !== prev?.deadline) {
          await notificationService.scheduleDeadlineReminder(company.trim(), role.trim(), deadline.trim()).catch(() => {});
        }
      } else {
        await db.addApplication({ ...payload, date_applied: new Date().toISOString() } as any);
        if (interviewDate) {
          await scheduleInterviewReminder(interviewDate, company.trim(), role.trim());
        }
        if (deadline.trim()) {
          await notificationService.scheduleDeadlineReminder(company.trim(), role.trim(), deadline.trim()).catch(() => {});
        }
      }
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  const runAutoFill = async () => {
    const input = autoFillInput.trim();
    if (!input) {
      setAutoFillError("Please paste a job URL or job description text.");
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      setAutoFillError("Gemini API key required. Go to Settings → API Keys to add your free key.");
      return;
    }

    setAutoFilling(true);
    setAutoFillError("");
    setAutoFillStage(1);
    setGeminiStatusCallback((msg) => setAutoFillStep(msg));

    try {
      let jobText = input;
      let resolvedUrl = autoFillMode === "url" ? input : "";

      // ── Stage 1: Fetch page if URL ──
      if (autoFillMode === "url") {
        setAutoFillStep("Fetching job page...");
        const parsed = await urlParser.parseFromUrl(input);
        jobText = parsed.rawText || input;
        resolvedUrl = parsed.sourceUrl || input;
      }

      // ── Stage 2: Extract & fill form fields ──
      setAutoFillStage(2);
      setAutoFillStep("Extracting job details...");
      const filled = await aiService.autoFillApplication(jobText);

      const filledCompany = filled.company || company;
      const filledRole = filled.role || role;
      const filledJobDesc = filled.jobDescription || jobText.slice(0, 1000);

      if (filled.company) setCompany(filled.company);
      if (filled.role) setRole(filled.role);
      if (filled.deadline) setDeadline(filled.deadline);
      if (filled.contactEmail) setContactEmail(filled.contactEmail);
      if (resolvedUrl) setJobUrl(resolvedUrl);

      const notesParts: string[] = [];
      if (filled.location) notesParts.push(`Location: ${filled.location}`);
      if (filled.salary) notesParts.push(`Salary: ${filled.salary}`);
      if (filled.jobDescription) notesParts.push(`\n${filled.jobDescription}`);
      if (filled.notes) notesParts.push(`\nNotes: ${filled.notes}`);
      if (notesParts.length > 0) setNotes(notesParts.join("\n"));

      // ── Stage 3: Generate documents ──
      setAutoFillStage(3);
      setAutoFillStep("Writing cover letter, email & CV notes...");
      const [generatedCover, generatedEmail, generatedCV] = await Promise.allSettled([
        docsService.generateCoverLetter(filledRole, filledCompany, filledJobDesc),
        docsService.generateApplicationEmail(filledRole, filledCompany, filledJobDesc),
        docsService.tailorCVPoints(filledJobDesc),
      ]);

      if (generatedCover.status === "fulfilled") setCoverLetter(generatedCover.value);
      if (generatedEmail.status === "fulfilled") setApplicationEmail(generatedEmail.value);
      if (generatedCV.status === "fulfilled") setCvTailoring(generatedCV.value);

      // ── Stage 4: Done ──
      setAutoFillStage(4);
      setAutoFillStep("");
    } catch (err: any) {
      setAutoFillError(err.message || "Could not extract job details. Try pasting the text instead.");
      setAutoFillStage(0);
    } finally {
      setGeminiStatusCallback(null);
      setAutoFilling(false);
    }
  };

  const closeAutoFillDone = () => {
    setAutoFillVisible(false);
    setAutoFillInput("");
    setAutoFillStage(0);
    setAutoFillStep("");
    setTab("documents");
  };

  const shareDoc = async (content: string, label: string) => {
    try {
      await Share.share({ message: `${label}\n\n${content}` });
    } catch {}
  };

  const shareToWhatsApp = (content: string, label: string) => {
    const text = encodeURIComponent(`${label}\n\n${content}`);
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
      Alert.alert("WhatsApp not found", "WhatsApp is not installed on this device.");
    });
  };

  const generatePrep = async () => {
    if (!role.trim()) {
      Alert.alert("Role required", "Please fill in the job role on the Details tab first.");
      return;
    }
    setGeneratingPrep(true);
    try {
      const jobDesc = notes || role;
      const prep = await docsService.generateInterviewPrep(role, company, jobDesc);
      setInterviewPrep(prep);
      if (id) {
        await db.saveAiDocument(id, "interview_prep", prep);
      }
    } catch (err: any) {
      Alert.alert("Generation failed", err.message || "Please try again.");
    } finally {
      setGeneratingPrep(false);
    }
  };

  const sendViaEmail = (body: string) => {
    const to = encodeURIComponent(contactEmail.trim());
    const subject = encodeURIComponent(`Application for ${role}${company ? ` at ${company}` : ""}`);
    const encodedBody = encodeURIComponent(body);
    const url = `mailto:${to}?subject=${subject}&body=${encodedBody}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("No email app found", "Please install an email app and try again.");
    });
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const aiDocs = [
    { key: "application_email", value: applicationEmail, set: setApplicationEmail },
    { key: "cover_letter", value: coverLetter, set: setCoverLetter },
    { key: "interview_prep", value: interviewPrep, set: setInterviewPrep },
    { key: "cv_tailoring", value: cvTailoring, set: setCvTailoring },
  ];
  const savedDocCount = aiDocs.filter((d) => d.value).length;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 14,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground }}>
          {id ? "Edit Application" : "New Application"}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Auto-Fill Banner (only for new applications) */}
      {!id && (
        <TouchableOpacity
          onPress={() => { setAutoFillVisible(true); setAutoFillError(""); }}
          style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            marginHorizontal: 16, marginBottom: 10, padding: 13,
            backgroundColor: colors.primary + "18",
            borderRadius: 14, borderWidth: 1,
            borderColor: colors.primary + "55",
          }}
          activeOpacity={0.8}
        >
          <View style={{
            width: 34, height: 34, borderRadius: 10,
            backgroundColor: colors.primary + "25",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
              Auto-Fill from Job Posting
            </Text>
            <Text style={{ color: colors.primary, fontSize: 12, marginTop: 1, opacity: 0.75 }}>
              Paste a URL or job description — AI fills the form
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={{ flexDirection: "row", marginHorizontal: 16, marginBottom: 4, backgroundColor: colors.card, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: tab === "details" ? colors.primary : "transparent" }}
          onPress={() => setTab("details")}
        >
          <Text style={{ color: tab === "details" ? colors.primaryForeground : colors.textSecondary, fontWeight: "600", fontSize: 12 }}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: tab === "documents" ? colors.primary : "transparent" }}
          onPress={() => setTab("documents")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ color: tab === "documents" ? colors.primaryForeground : colors.textSecondary, fontWeight: "600", fontSize: 12 }}>Documents</Text>
            {savedDocCount > 0 && (
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: tab === "documents" ? colors.primaryForeground + "33" : colors.primary + "22", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: tab === "documents" ? colors.primaryForeground : colors.primary, fontSize: 9, fontWeight: "700" }}>{savedDocCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: tab === "prep" ? colors.statusInterview : "transparent" }}
          onPress={() => setTab("prep")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="school-outline" size={12} color={tab === "prep" ? colors.primaryForeground : colors.textSecondary} />
            <Text style={{ color: tab === "prep" ? colors.primaryForeground : colors.textSecondary, fontWeight: "600", fontSize: 12 }}>Interview</Text>
            {interviewPrep ? (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tab === "prep" ? colors.primaryForeground : colors.green }} />
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      {tab === "details" ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: bottomPad + 100, paddingTop: 8 }}>
          <Field label="Company *" colors={colors}>
            <TextInput style={inputStyle(colors)} placeholder="e.g. Amiran Kenya Ltd" placeholderTextColor={colors.textMuted} value={company} onChangeText={setCompany} />
          </Field>

          <Field label="Role / Job Title *" colors={colors}>
            <TextInput style={inputStyle(colors)} placeholder="e.g. Cereal Agronomist" placeholderTextColor={colors.textMuted} value={role} onChangeText={setRole} />
          </Field>

          <Field label="Status" colors={colors}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {STATUS_OPTIONS.map((s) => {
                const color = statusColor(s);
                const active = status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? color + "22" : colors.card, borderWidth: 1, borderColor: active ? color : colors.border }}
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

          {status === "interview" && (
            <Field label="Interview Date" colors={colors}>
              <TextInput
                ref={interviewDateRef}
                style={inputStyle(colors)}
                placeholder="YYYY-MM-DD (e.g. 2026-06-10)"
                placeholderTextColor={colors.textMuted}
                value={interviewDate}
                onChangeText={setInterviewDate}
                keyboardType="numeric"
              />
              {interviewDate ? (
                <Text style={{ color: colors.green, fontSize: 12, marginTop: 4 }}>
                  A morning reminder will be scheduled for this date.
                </Text>
              ) : null}
            </Field>
          )}

          <Field label="Application Deadline" colors={colors}>
            <TextInput style={inputStyle(colors)} placeholder="YYYY-MM-DD (e.g. 2026-08-31)" placeholderTextColor={colors.textMuted} value={deadline} onChangeText={setDeadline} />
          </Field>

          <Field label="Contact Email" colors={colors}>
            <TextInput style={inputStyle(colors)} placeholder="recruitment@company.com" placeholderTextColor={colors.textMuted} value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
          </Field>

          <Field label="Job URL" colors={colors}>
            <TextInput style={inputStyle(colors)} placeholder="https://..." placeholderTextColor={colors.textMuted} value={jobUrl} onChangeText={setJobUrl} keyboardType="url" autoCapitalize="none" />
          </Field>

          <Field label="Notes" colors={colors}>
            <TextInput style={[inputStyle(colors), { minHeight: 80, textAlignVertical: "top" }]} placeholder="Any additional notes..." placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" />
          </Field>

          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: saving ? colors.primary + "99" : colors.primary, borderRadius: 999, padding: 16, marginTop: 4 }}
            onPress={save}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <><Ionicons name="checkmark-circle-outline" size={20} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>{id ? "Update" : "Save Application"}</Text></>
            }
          </TouchableOpacity>
        </ScrollView>
      ) : tab === "documents" ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: bottomPad + 40, paddingTop: 8 }}>
          {/* Send via Email banner — shown when application email + contact are both ready */}
          {applicationEmail && contactEmail ? (
            <TouchableOpacity
              onPress={() => sendViaEmail(applicationEmail)}
              activeOpacity={0.8}
              style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: colors.primary + "18",
                borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: colors.primary + "55",
              }}
            >
              <View style={{
                width: 38, height: 38, borderRadius: 10,
                backgroundColor: colors.primary + "25",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="send" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
                  Send via Email
                </Text>
                <Text style={{ color: colors.primary, fontSize: 12, marginTop: 1, opacity: 0.75 }} numberOfLines={1}>
                  To: {contactEmail}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}

          {savedDocCount === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16 }}>No AI documents yet</Text>
              <Text style={{ color: colors.textMuted, textAlign: "center", fontSize: 13, lineHeight: 20 }}>
                Generate a cover letter or application email from the Job Capture screen or AI Writer, and they'll be saved here automatically.
              </Text>
            </View>
          ) : (
            aiDocs.filter((d) => d.value).map((doc) => (
              <AiDocCard
                key={doc.key}
                label={AI_DOC_LABELS[doc.key]}
                content={doc.value}
                colors={colors}
                onShare={() => shareDoc(doc.value, AI_DOC_LABELS[doc.key])}
                onWhatsApp={() => shareToWhatsApp(doc.value, AI_DOC_LABELS[doc.key])}
                onEmail={doc.key === "application_email" && contactEmail ? () => sendViaEmail(doc.value) : undefined}
                onEdit={(v) => doc.set(v)}
                onSave={id ? async () => {
                  await db.saveAiDocument(id, doc.key as any, doc.value);
                  Alert.alert("Saved", `${AI_DOC_LABELS[doc.key]} updated.`);
                } : undefined}
              />
            ))
          )}

          {id && (
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: saving ? colors.primary + "99" : colors.primary, borderRadius: 999, padding: 14, marginTop: 4 }}
              onPress={save}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <><Ionicons name="save-outline" size={18} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>Save All Changes</Text></>
              }
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        /* ── Interview Prep Tab ── */
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: bottomPad + 40, paddingTop: 8 }}>
          {generatingPrep ? (
            /* Generating state */
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 16 }}>
              <ActivityIndicator size="large" color={colors.statusInterview} />
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>Preparing your interview...</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
                Generating questions, suggested answers and tips tailored to this role
              </Text>
            </View>
          ) : interviewPrep ? (
            /* Prep content — parsed into sections */
            <>
              {/* Header bar */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.statusInterview + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="school" size={16} color={colors.statusInterview} />
                  </View>
                  <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>Interview Prep</Text>
                </View>
                <TouchableOpacity
                  onPress={generatePrep}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.statusInterview + "18", borderWidth: 1, borderColor: colors.statusInterview + "44" }}
                >
                  <Ionicons name="refresh-outline" size={13} color={colors.statusInterview} />
                  <Text style={{ color: colors.statusInterview, fontSize: 12, fontWeight: "600" }}>Regenerate</Text>
                </TouchableOpacity>
              </View>

              {/* Sections parsed from the AI output */}
              {parsePrepSections(interviewPrep).map((section) => (
                <View key={section.title} style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: section.accent + "12" }}>
                    <Ionicons name={section.icon as any} size={15} color={section.accent} />
                    <Text style={{ color: section.accent, fontWeight: "700", fontSize: 13, flex: 1 }}>{section.title}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const { Clipboard } = require("react-native");
                        Clipboard.setString(section.content);
                        Alert.alert("Copied", `${section.title} copied to clipboard.`);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 21, padding: 14 }}>
                    {section.content}
                  </Text>
                </View>
              ))}

              {/* Copy all + Save */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    const { Clipboard } = require("react-native");
                    Clipboard.setString(interviewPrep);
                    Alert.alert("Copied", "Full interview prep copied to clipboard.");
                  }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 13, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                >
                  <Ionicons name="copy-outline" size={15} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 13 }}>Copy All</Text>
                </TouchableOpacity>
                {id && (
                  <TouchableOpacity
                    onPress={async () => {
                      await db.saveAiDocument(id, "interview_prep", interviewPrep);
                      Alert.alert("Saved", "Interview prep saved to this application.");
                    }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 13, borderRadius: 999, backgroundColor: colors.statusInterview + "18", borderWidth: 1, borderColor: colors.statusInterview + "44" }}
                  >
                    <Ionicons name="save-outline" size={15} color={colors.statusInterview} />
                    <Text style={{ color: colors.statusInterview, fontWeight: "600", fontSize: 13 }}>Save</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            /* Empty / generate state */
            <>
              {/* Context card */}
              <View style={{ backgroundColor: colors.statusInterview + "12", borderRadius: 16, padding: 20, alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.statusInterview + "30" }}>
                <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: colors.statusInterview + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="school-outline" size={28} color={colors.statusInterview} />
                </View>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>Interview Prep</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                  AI will generate likely interview questions with suggested answers, technical questions to prepare for, and smart questions to ask the interviewer — all tailored to this specific role.
                </Text>
              </View>

              {/* What you'll get */}
              {[
                { icon: "chatbubble-ellipses-outline", title: "Likely Questions", sub: "5 common questions with tailored suggested answers", color: colors.statusInterview },
                { icon: "code-working-outline", title: "Technical Questions", sub: "Role-specific technical or practical questions", color: colors.orange },
                { icon: "help-circle-outline", title: "Questions to Ask Them", sub: "Smart questions that show genuine interest", color: colors.green },
              ].map((item) => (
                <View key={item.title} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: item.color + "18", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{item.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{item.sub}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={generatePrep}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.statusInterview, borderRadius: 999, padding: 16 }}
              >
                <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>Generate Interview Prep</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── My Questions — always shown ── */}
          {!generatingPrep && (
            <View style={{ gap: 12, marginTop: 4 }}>
              {/* Section header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                </View>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>My Questions</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>— type your own, get AI answers</Text>
              </View>

              {/* Existing custom questions */}
              {customQuestions.map((cq) => {
                const isAnswering = answeringId === cq.id;
                return (
                  <View key={cq.id} style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                    {/* Question row */}
                    <View style={{ flexDirection: "row", alignItems: "flex-start", padding: 12, gap: 8 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>Q</Text>
                      </View>
                      <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, fontWeight: "600", lineHeight: 20 }}>{cq.q}</Text>
                      <TouchableOpacity onPress={() => removeCustomQuestion(cq.id)} style={{ padding: 4 }}>
                        <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Answer — shown if exists */}
                    {cq.a ? (
                      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: colors.green + "18", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: colors.green, fontSize: 11, fontWeight: "700" }}>A</Text>
                          </View>
                          <Text style={{ color: colors.green, fontSize: 11, fontWeight: "600" }}>Suggested Answer</Text>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, paddingLeft: 28 }}>{cq.a}</Text>
                      </View>
                    ) : (
                      /* Get AI Answer button */
                      <TouchableOpacity
                        onPress={() => getAiAnswer(cq.id)}
                        disabled={answeringId !== null}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, margin: 10, marginTop: 0, borderRadius: 8, backgroundColor: colors.primary + "12", borderWidth: 1, borderColor: colors.primary + "30" }}
                      >
                        {isAnswering
                          ? <ActivityIndicator size="small" color={colors.primary} />
                          : <Ionicons name="sparkles" size={13} color={colors.primary} />}
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                          {isAnswering ? "Getting AI answer..." : "Get AI Answer"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {/* Add new question input */}
              <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>Add a question you want to prepare for:</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background, borderRadius: 10, padding: 12,
                    color: colors.foreground, fontSize: 13, borderWidth: 1,
                    borderColor: colors.border, minHeight: 60, textAlignVertical: "top",
                  }}
                  placeholder={"e.g. How do you handle pressure from farmers when recommendations don't work immediately?"}
                  placeholderTextColor={colors.textMuted}
                  value={newQuestion}
                  onChangeText={setNewQuestion}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  onPress={addCustomQuestion}
                  disabled={!newQuestion.trim()}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: 12, borderRadius: 999,
                    backgroundColor: newQuestion.trim() ? colors.primary : colors.border,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={16} color={newQuestion.trim() ? colors.primaryForeground : colors.textMuted} />
                  <Text style={{ color: newQuestion.trim() ? colors.primaryForeground : colors.textMuted, fontWeight: "600", fontSize: 13 }}>
                    Add Question
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ─── Auto-Fill Modal ─── */}
      <Modal
        visible={autoFillVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !autoFilling && setAutoFillVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Modal header */}
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16,
            borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <TouchableOpacity
              onPress={() => { if (!autoFilling) { setAutoFillVisible(false); setAutoFillInput(""); setAutoFillError(""); setAutoFillStage(0); } }}
              style={{ padding: 4 }}
              disabled={autoFilling}
            >
              <Ionicons name="close" size={24} color={autoFilling ? colors.textMuted : colors.foreground} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {autoFillStage === 4 ? "Application Ready" : "Apply from Job Posting"}
              </Text>
              <Text style={{ fontSize: 12, color: colors.primary, marginTop: 1 }}>
                {autoFillStage === 4 ? "Review, edit and save" : "AI fills form + writes all documents"}
              </Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>

            {/* ── DONE STATE ── */}
            {autoFillStage === 4 ? (
              <>
                <View style={{
                  backgroundColor: colors.green + "15", borderRadius: 16,
                  padding: 20, alignItems: "center", gap: 12,
                  borderWidth: 1, borderColor: colors.green + "40",
                }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: colors.green + "25",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name="checkmark-circle" size={32} color={colors.green} />
                  </View>
                  <Text style={{ color: colors.green, fontWeight: "700", fontSize: 17 }}>All done!</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                    Your application form is filled and your documents are written. Review everything, make any edits, then save.
                  </Text>
                </View>

                {/* Summary of what was produced */}
                {[
                  { icon: "create-outline", label: "Application form filled", sub: "Company, role, deadline, contact email, notes", color: colors.primary },
                  { icon: "document-text-outline", label: "Cover letter written", sub: "Tailored to the job description", color: colors.primary },
                  { icon: "mail-outline", label: "Application email written", sub: "Ready to copy and send", color: colors.primary },
                  { icon: "person-outline", label: "CV tailoring notes", sub: "Bullet points & keywords for this role", color: colors.primary },
                ].map((item) => (
                  <View key={item.label} style={{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    backgroundColor: colors.card, borderRadius: 12, padding: 12,
                    borderWidth: 1, borderColor: colors.border,
                  }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.color + "20", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>{item.label}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{item.sub}</Text>
                    </View>
                    <Ionicons name="checkmark" size={16} color={colors.green} />
                  </View>
                ))}

                <TouchableOpacity
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    backgroundColor: colors.primary, borderRadius: 999, padding: 16, marginTop: 4,
                  }}
                  onPress={closeAutoFillDone}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.primaryForeground} />
                  <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>Review Documents</Text>
                </TouchableOpacity>
              </>
            ) : autoFilling ? (
              /* ── IN-PROGRESS STATE ── */
              <>
                <View style={{ alignItems: "center", paddingVertical: 24, gap: 20 }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>Working on your application...</Text>
                </View>

                {[
                  { stage: 1, label: "Fetching job page" },
                  { stage: 2, label: "Extracting job details" },
                  { stage: 3, label: "Writing cover letter, email & CV notes" },
                ].map((step) => {
                  const done = autoFillStage > step.stage;
                  const active = autoFillStage === step.stage;
                  return (
                    <View key={step.stage} style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      backgroundColor: colors.card, borderRadius: 12, padding: 14,
                      borderWidth: 1,
                      borderColor: done ? colors.green + "50" : active ? colors.primary + "60" : colors.border,
                    }}>
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: done ? colors.green + "20" : active ? colors.primary + "20" : colors.border + "40",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        {done
                          ? <Ionicons name="checkmark" size={16} color={colors.green} />
                          : active
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>{step.stage}</Text>
                        }
                      </View>
                      <Text style={{
                        color: done ? colors.green : active ? colors.foreground : colors.textMuted,
                        fontWeight: active ? "600" : "400", fontSize: 14, flex: 1,
                      }}>
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </>
            ) : (
              /* ── INPUT STATE ── */
              <>
                {/* Mode toggle */}
                <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border }}>
                  {(["url", "text"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={{
                        flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center",
                        backgroundColor: autoFillMode === m ? colors.primary : "transparent",
                      }}
                      onPress={() => { setAutoFillMode(m); setAutoFillInput(""); setAutoFillError(""); }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons
                          name={m === "url" ? "link-outline" : "document-text-outline"}
                          size={14}
                          color={autoFillMode === m ? colors.primaryForeground : colors.textSecondary}
                        />
                        <Text style={{ color: autoFillMode === m ? colors.primaryForeground : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>
                          {m === "url" ? "Job URL" : "Paste Text"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Input field */}
                {autoFillMode === "url" ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>Job Post URL</Text>
                    <TextInput
                      style={inputStyle(colors)}
                      placeholder="https://www.brightermonday.co.ke/jobs/..."
                      placeholderTextColor={colors.textMuted}
                      value={autoFillInput}
                      onChangeText={(v) => { setAutoFillInput(v); setAutoFillError(""); }}
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>Job Description</Text>
                    <TextInput
                      style={[inputStyle(colors), { minHeight: 180, textAlignVertical: "top" }]}
                      placeholder={"Paste the full job advert here...\n\nInclude title, responsibilities, requirements, deadline and contact details."}
                      placeholderTextColor={colors.textMuted}
                      value={autoFillInput}
                      onChangeText={(v) => { setAutoFillInput(v); setAutoFillError(""); }}
                      multiline
                      numberOfLines={9}
                      textAlignVertical="top"
                    />
                  </View>
                )}

                {/* Error */}
                {autoFillError ? (
                  <View style={{
                    flexDirection: "row", alignItems: "flex-start", gap: 10,
                    backgroundColor: colors.destructive + "18", borderRadius: 12,
                    padding: 12, borderWidth: 1, borderColor: colors.destructive + "44",
                  }}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.destructive, fontSize: 13, flex: 1, lineHeight: 19 }}>{autoFillError}</Text>
                  </View>
                ) : null}

                {/* What AI will produce */}
                <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13, marginBottom: 2 }}>One tap produces:</Text>
                  {[
                    { icon: "create-outline", label: "Form fields filled", sub: "Company, role, deadline, contact email" },
                    { icon: "document-text-outline", label: "Cover letter", sub: "Tailored to this exact job" },
                    { icon: "mail-outline", label: "Application email", sub: "Ready to copy and send" },
                    { icon: "person-outline", label: "CV tailoring notes", sub: "Bullet points & keywords to update your CV" },
                  ].map((item) => (
                    <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={item.icon as any} size={14} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "500" }}>{item.label}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{item.sub}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Submit button */}
                <TouchableOpacity
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    backgroundColor: colors.primary, borderRadius: 999, padding: 16,
                  }}
                  onPress={runAutoFill}
                >
                  <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
                  <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>Build My Application</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function parsePrepSections(raw: string) {
  const sectionDefs = [
    { heading: "LIKELY QUESTIONS", title: "Likely Questions", icon: "chatbubble-ellipses-outline" },
    { heading: "TECHNICAL QUESTIONS TO PREPARE FOR", title: "Technical Questions", icon: "code-working-outline" },
    { heading: "QUESTIONS TO ASK THE INTERVIEWER", title: "Questions to Ask Them", icon: "help-circle-outline" },
  ];
  const accents = ["#6C8EF5", "#F59E0B", "#10B981"];

  return sectionDefs.map((def, i) => {
    const headingPattern = new RegExp(`${def.heading}:?\\s*`, "i");
    const nextHeadings = sectionDefs.slice(i + 1).map((d) => `${d.heading}:?`).join("|");
    const match = nextHeadings
      ? raw.match(new RegExp(`${def.heading}:?\\s*([\\s\\S]*?)(?=${nextHeadings}|$)`, "i"))
      : raw.match(new RegExp(`${def.heading}:?\\s*([\\s\\S]*)$`, "i"));

    const content = match ? match[1].trim() : "";
    return { title: def.title, icon: def.icon, accent: accents[i], content: content || "Not available." };
  });
}

function AiDocCard({ label, content, colors, onShare, onWhatsApp, onEmail, onEdit, onSave }: any) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="document-text" size={16} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>{label}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <>
          <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
            {editing ? (
              <TextInput
                style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, backgroundColor: colors.background, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border, minHeight: 150, textAlignVertical: "top" }}
                value={editValue}
                onChangeText={setEditValue}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }} numberOfLines={expanded ? undefined : 6}>
                {content}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            {editing ? (
              <>
                <ActionBtn icon="close-outline" label="Cancel" color={colors.textSecondary} onPress={() => { setEditing(false); setEditValue(content); }} />
                {onSave && (
                  <ActionBtn icon="save-outline" label="Save" color={colors.green} onPress={async () => { onEdit(editValue); if (onSave) await onSave(); setEditing(false); }} />
                )}
              </>
            ) : (
              <>
                <ActionBtn icon="create-outline" label="Edit" color={colors.textSecondary} onPress={() => setEditing(true)} />
                <ActionBtn icon="copy-outline" label="Copy" color={colors.primary} onPress={() => {
                  const { Clipboard } = require("react-native");
                  Clipboard.setString(content);
                  Alert.alert("Copied!", `${label} copied to clipboard.`);
                }} />
                {onEmail && (
                  <ActionBtn icon="send-outline" label="Email" color={colors.primary} onPress={onEmail} />
                )}
                <ActionBtn icon="share-outline" label="Share" color={colors.primary} onPress={onShare} />
                <ActionBtn icon="logo-whatsapp" label="WhatsApp" color="#25D366" onPress={onWhatsApp} />
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function ActionBtn({ icon, label, color, onPress }: any) {
  return (
    <TouchableOpacity
      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 7, borderRadius: 8, backgroundColor: color + "15" }}
      onPress={onPress}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
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
