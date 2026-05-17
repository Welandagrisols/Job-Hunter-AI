import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../services/supabase";
import { notificationService } from "../services/notifications";
import { theme } from "../theme";

const STATUS_OPTIONS = ["applied", "interview", "offer", "rejected", "withdrawn", "waiting"];

export default function AddApplicationScreen({ navigation, route }: any) {
  const editing = route?.params?.application;

  const [company, setCompany] = useState(editing?.company || "");
  const [role, setRole] = useState(editing?.role || "");
  const [contactEmail, setContactEmail] = useState(editing?.contact_email || "");
  const [jobUrl, setJobUrl] = useState(editing?.job_url || "");
  const [deadline, setDeadline] = useState(editing?.deadline || "");
  const [status, setStatus] = useState(editing?.status || "applied");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);

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
        deadline: deadline.trim() || null,
        status,
        notes: notes.trim(),
      };

      if (editing) {
        await db.updateApplication(editing.id, payload);
      } else {
        const saved = await db.addApplication(payload);

        // Schedule follow-up reminder
        await notificationService.scheduleFollowUpReminder(
          company, role, saved.id, 7
        );

        // Schedule deadline reminder if provided
        if (deadline) {
          await notificationService.scheduleDeadlineReminder(
            company, role, new Date(deadline)
          );
        }
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{editing ? "Edit Application" : "New Application"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.form}>
        <Field label="Company *" required>
          <TextInput
            style={styles.input}
            placeholder="e.g. Amiran Kenya Ltd"
            placeholderTextColor={theme.colors.text.muted}
            value={company}
            onChangeText={setCompany}
          />
        </Field>

        <Field label="Role / Job Title *">
          <TextInput
            style={styles.input}
            placeholder="e.g. Cereal Agronomist"
            placeholderTextColor={theme.colors.text.muted}
            value={role}
            onChangeText={setRole}
          />
        </Field>

        <Field label="Contact Email">
          <TextInput
            style={styles.input}
            placeholder="recruitment@company.com"
            placeholderTextColor={theme.colors.text.muted}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Job URL">
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor={theme.colors.text.muted}
            value={jobUrl}
            onChangeText={setJobUrl}
            keyboardType="url"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Application Deadline">
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g. 2026-05-31)"
            placeholderTextColor={theme.colors.text.muted}
            value={deadline}
            onChangeText={setDeadline}
          />
        </Field>

        <Field label="Status">
          <View style={styles.statusGrid}>
            {STATUS_OPTIONS.map((s) => {
              const color = (theme.colors.status as any)[s];
              const active = status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusOption,
                    active && { backgroundColor: color + "22", borderColor: color },
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[styles.statusOptionText, active && { color }]}>
                    {(theme.statusLabels as any)[s]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label="Notes">
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Any additional notes..."
            placeholderTextColor={theme.colors.text.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Field>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.bg.primary} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.bg.primary} />
              <Text style={styles.saveBtnText}>{editing ? "Update" : "Save Application"}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Field({ label, children }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  title: { fontSize: theme.font.sizes.xl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  form: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.md },
  field: { gap: theme.spacing.xs },
  label: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  input: {
    backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md,
    padding: theme.spacing.md, color: theme.colors.text.primary, fontSize: theme.font.sizes.md,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  textarea: { minHeight: 100 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  statusOption: {
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.card,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  statusOptionText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent.cyan, borderRadius: theme.radius.full,
    padding: theme.spacing.md, marginTop: theme.spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.bold, fontSize: theme.font.sizes.md },
});
