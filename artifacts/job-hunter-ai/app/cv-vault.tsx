import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { db, CVVault } from "@/src/services/storage";
import { theme } from "@/src/theme";
import { format } from "date-fns";

export default function CVVaultScreen() {
  const router = useRouter();
  const [vault, setVault] = useState<CVVault | null>(null);
  const [editing, setEditing] = useState(false);
  const [cvText, setCvText] = useState("");
  const [label, setLabel] = useState("My CV");
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const load = async () => {
    const data = await db.getCVVault();
    setVault(data);
    if (data.cvText) {
      setCvText(data.cvText);
      setLabel(data.label || "My CV");
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const save = async () => {
    if (!cvText.trim()) {
      Alert.alert("Empty CV", "Please paste your CV text first");
      return;
    }
    setSaving(true);
    await db.saveCVVault(cvText.trim(), label);
    await load();
    setEditing(false);
    setSaving(false);
    Alert.alert("Saved!", "Your CV has been saved to the vault. All AI features will now use your real CV.");
  };

  const restoreVersion = (vCvText: string, vLabel: string) => {
    Alert.alert(
      "Restore Version",
      `Restore "${vLabel}"? This will replace your current CV.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            await db.saveCVVault(vCvText, vLabel);
            await load();
            setShowVersions(false);
          },
        },
      ]
    );
  };

  const hasCV = vault?.cvText && vault.cvText.length > 0;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>CV Vault</Text>
        {hasCV && !editing && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="pencil-outline" size={18} color={theme.colors.accent.cyan} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status card */}
      <View style={[styles.statusCard, { borderColor: hasCV ? theme.colors.accent.green + "44" : theme.colors.accent.orange + "44" }]}>
        <Ionicons
          name={hasCV ? "checkmark-circle" : "alert-circle"}
          size={24}
          color={hasCV ? theme.colors.accent.green : theme.colors.accent.orange}
        />
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>
            {hasCV ? "CV Loaded ✓" : "No CV saved yet"}
          </Text>
          <Text style={styles.statusSubtitle}>
            {hasCV
              ? `Last updated: ${format(new Date(vault!.lastUpdated!), "MMM d, yyyy")}`
              : "Paste your CV to make AI writing more accurate"}
          </Text>
        </View>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="bulb-outline" size={16} color={theme.colors.accent.cyan} />
        <Text style={styles.infoText}>
          Once saved, all AI features (cover letters, emails, CV tailoring) will use your actual experience instead of a generic profile.
        </Text>
      </View>

      {/* CV Editor */}
      {(!hasCV || editing) && (
        <View style={styles.editorContainer}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CV Label</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. My CV 2026"
              placeholderTextColor={theme.colors.text.muted}
              value={label}
              onChangeText={setLabel}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Paste Your CV Text</Text>
            <Text style={styles.sublabel}>Copy all text from your CV document and paste here</Text>
            <TextInput
              style={[styles.input, styles.cvTextarea]}
              placeholder={`Paste your full CV text here...

Example:
Wesley Kipkemoi Koech
Agronomist & Soil Scientist | Nairobi, Kenya

EXPERIENCE
Agricultural Consultant | 2020-Present
- Soil fertility management...

EDUCATION
BSc Agriculture | University of...

SKILLS
Soil analysis, Fertilizer recommendations...`}
              placeholderTextColor={theme.colors.text.muted}
              value={cvText}
              onChangeText={setCvText}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{cvText.length} characters</Text>
          </View>

          <View style={styles.btnRow}>
            {editing && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setEditing(false); setCvText(vault?.cvText || ""); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled, editing && { flex: 1 }]}
              onPress={save}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={theme.colors.bg.primary} size="small" />
                : <><Ionicons name="save-outline" size={18} color={theme.colors.bg.primary} /><Text style={styles.saveBtnText}>Save to Vault</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* CV Preview */}
      {hasCV && !editing && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Current CV — {vault!.label}</Text>
          <Text style={styles.previewText} numberOfLines={20}>
            {vault!.cvText}
          </Text>
          <View style={styles.previewFooter}>
            <Text style={styles.previewMeta}>{vault!.cvText.length} characters</Text>
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.updateText}>Update CV</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Previous versions */}
      {vault?.versions && vault.versions.length > 0 && (
        <View style={styles.versionsContainer}>
          <TouchableOpacity
            style={styles.versionsHeader}
            onPress={() => setShowVersions(!showVersions)}
          >
            <Text style={styles.versionsTitle}>Previous Versions ({vault.versions.length})</Text>
            <Ionicons
              name={showVersions ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>

          {showVersions && vault.versions.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={styles.versionCard}
              onPress={() => restoreVersion(v.cvText, v.label)}
            >
              <View>
                <Text style={styles.versionLabel}>{v.label}</Text>
                <Text style={styles.versionDate}>
                  {format(new Date(v.savedAt), "MMM d, yyyy")} · {v.cvText.length} chars
                </Text>
              </View>
              <Text style={styles.restoreText}>Restore</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.bg.card, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: theme.spacing.sm, backgroundColor: theme.colors.accent.cyanDim, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.accent.cyan + "44" },
  editBtnText: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  statusCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1 },
  statusInfo: { flex: 1 },
  statusTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, fontSize: theme.font.sizes.md },
  statusSubtitle: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, marginTop: 2 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.accent.cyanDim, borderRadius: theme.radius.md, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.accent.cyan + "33" },
  infoText: { flex: 1, color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm, lineHeight: 18 },
  editorContainer: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.md },
  field: { gap: theme.spacing.xs },
  fieldLabel: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  sublabel: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs },
  input: { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.md, padding: theme.spacing.md, color: theme.colors.text.primary, fontSize: theme.font.sizes.md, borderWidth: 1, borderColor: theme.colors.bg.border },
  cvTextarea: { minHeight: 300, textAlignVertical: "top", fontFamily: "monospace", fontSize: theme.font.sizes.sm },
  charCount: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, textAlign: "right" },
  btnRow: { flexDirection: "row", gap: theme.spacing.sm },
  cancelBtn: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.full, backgroundColor: theme.colors.bg.card, borderWidth: 1, borderColor: theme.colors.bg.border },
  cancelBtnText: { color: theme.colors.text.secondary, fontWeight: theme.font.weights.medium },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, backgroundColor: theme.colors.accent.cyan, borderRadius: theme.radius.full, padding: theme.spacing.md },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.bold, fontSize: theme.font.sizes.md },
  previewContainer: { marginHorizontal: theme.spacing.md, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.bg.border, marginBottom: theme.spacing.md },
  previewTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.semibold, marginBottom: theme.spacing.sm },
  previewText: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, lineHeight: 20, fontFamily: "monospace" },
  previewFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.bg.border },
  previewMeta: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs },
  updateText: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  versionsContainer: { marginHorizontal: theme.spacing.md, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.bg.border, overflow: "hidden", marginBottom: theme.spacing.md },
  versionsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md },
  versionsTitle: { color: theme.colors.text.primary, fontWeight: theme.font.weights.medium },
  versionCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.bg.border },
  versionLabel: { color: theme.colors.text.primary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.medium },
  versionDate: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 2 },
  restoreText: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm },
});
