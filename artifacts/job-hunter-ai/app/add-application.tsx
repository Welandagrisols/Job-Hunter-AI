import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "@/src/services/storage";
import { useColors } from "@/hooks/useColors";
import { JobApplication, STATUS_LABELS } from "@/src/types";

const STATUS_OPTIONS: JobApplication["status"][] = ["applied", "interview", "offer", "rejected", "withdrawn", "waiting"];

export default function AddApplicationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<JobApplication["status"]>("applied");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
      db.getApplicationById(id).then((app) => {
        if (app) {
          setCompany(app.company);
          setRole(app.role);
          setContactEmail(app.contact_email || "");
          setJobUrl(app.job_url || "");
          setDeadline(app.deadline || "");
          setStatus(app.status);
          setNotes(app.notes || "");
        }
        setLoading(false);
      });
    }
  }, [id]);

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

  const save = async () => {
    if (!company.trim() || !role.trim()) {
      Alert.alert("Required", "Please enter company name and role");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company: company.trim(),
        role: role.trim(),
        contact_email: contactEmail.trim(),
        job_url: jobUrl.trim(),
        deadline: deadline.trim() || undefined,
        status,
        notes: notes.trim(),
      };

      if (id) {
        await db.updateApplication(id, payload);
      } else {
        await db.addApplication({
          ...payload,
          date_applied: new Date().toISOString(),
        } as any);
      }
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: bottomPad + 40 }}
      >
        <Field label="Company *" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            placeholder="e.g. Amiran Kenya Ltd"
            placeholderTextColor={colors.textMuted}
            value={company}
            onChangeText={setCompany}
          />
        </Field>

        <Field label="Role / Job Title *" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            placeholder="e.g. Cereal Agronomist"
            placeholderTextColor={colors.textMuted}
            value={role}
            onChangeText={setRole}
          />
        </Field>

        <Field label="Contact Email" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            placeholder="recruitment@company.com"
            placeholderTextColor={colors.textMuted}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Job URL" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            placeholder="https://..."
            placeholderTextColor={colors.textMuted}
            value={jobUrl}
            onChangeText={setJobUrl}
            keyboardType="url"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Application Deadline" colors={colors}>
          <TextInput
            style={inputStyle(colors)}
            placeholder="YYYY-MM-DD (e.g. 2026-08-31)"
            placeholderTextColor={colors.textMuted}
            value={deadline}
            onChangeText={setDeadline}
          />
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

        <Field label="Notes" colors={colors}>
          <TextInput
            style={[inputStyle(colors), { minHeight: 100, textAlignVertical: "top" }]}
            placeholder="Any additional notes..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Field>

        <TouchableOpacity
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            backgroundColor: saving ? colors.primary + "99" : colors.primary,
            borderRadius: 999, padding: 16, marginTop: 4,
          }}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.primaryForeground} />
            : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>
                  {id ? "Update" : "Save Application"}
                </Text>
              </>
            )}
        </TouchableOpacity>
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
