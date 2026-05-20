import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { feedService, JobSource } from "@/src/services/feedService";
import { theme } from "@/src/theme";

const CATEGORIES = [
  "Kenya",
  "East Africa",
  "Southern Africa",
  "NGO/International",
  "Development",
  "Agriculture/Research",
  "Other",
];

const BLANK_FORM = {
  name: "",
  rssUrl: "",
  icon: "🌐",
  color: "#00D4FF",
  category: "Other",
  enabled: true,
};

export default function SourceManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [sources, setSources] = useState<JobSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const load = async () => {
    const data = await feedService.getSources();
    setSources(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const toggle = async (id: string, enabled: boolean) => {
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, enabled } : s));
    await feedService.toggleSource(id, enabled);
  };

  const deleteSource = (source: JobSource) => {
    Alert.alert(
      `Remove "${source.name}"?`,
      source.isDefault
        ? "This is a built-in source. You can disable it instead of deleting it, or delete it and use 'Reset to defaults' to bring it back."
        : "This will permanently remove this source.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            await feedService.deleteSource(source.id);
            setSources((prev) => prev.filter((s) => s.id !== source.id));
          },
        },
      ]
    );
  };

  const addSource = async () => {
    if (!form.name.trim()) { Alert.alert("Name required", "Please enter a source name."); return; }
    if (!form.rssUrl.trim()) { Alert.alert("URL required", "Please enter the RSS feed URL."); return; }
    if (!form.rssUrl.startsWith("http")) { Alert.alert("Invalid URL", "URL must start with http:// or https://"); return; }

    setSaving(true);
    try {
      const newSource = await feedService.addSource({
        name: form.name.trim(),
        rssUrl: form.rssUrl.trim(),
        icon: form.icon || "🌐",
        color: form.color || "#00D4FF",
        category: form.category,
        enabled: true,
      });
      setSources((prev) => [...prev, newSource]);
      setForm(BLANK_FORM);
      setShowAddForm(false);
    } catch {
      Alert.alert("Could not add source", "Please check the URL and try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      "Reset to defaults?",
      "This will restore all 28 built-in sources and remove any custom ones you've added. Your toggle preferences will also be reset.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset", style: "destructive",
          onPress: async () => {
            await feedService.resetToDefaults();
            await load();
          },
        },
      ]
    );
  };

  const grouped = CATEGORIES.reduce<Record<string, JobSource[]>>((acc, cat) => {
    const items = sources.filter((s) => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const enabledCount = sources.filter((s) => s.enabled).length;
  const customCount = sources.filter((s) => !s.isDefault).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Feed Sources</Text>
          <Text style={styles.subtitle}>
            {loading ? "Loading..." : `${enabledCount} of ${sources.length} active · ${customCount} custom`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddForm((v) => !v)}
        >
          <Ionicons name={showAddForm ? "close" : "add"} size={22} color={theme.colors.accent.cyan} />
        </TouchableOpacity>
      </View>

      {/* Tip */}
      <View style={styles.tipRow}>
        <Ionicons name="information-circle-outline" size={14} color={theme.colors.text.muted} />
        <Text style={styles.tipText}>
          Toggle sources on/off to control what appears in your Job Feed. Changes take effect on the next refresh.
        </Text>
      </View>

      {/* Add source form */}
      {showAddForm && (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>Add New Source</Text>

          <Text style={styles.fieldLabel}>Source Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. CIMMYT Jobs"
            placeholderTextColor={theme.colors.text.muted}
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          />

          <Text style={styles.fieldLabel}>RSS Feed URL *</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com/feed/"
            placeholderTextColor={theme.colors.text.muted}
            value={form.rssUrl}
            onChangeText={(v) => setForm((f) => ({ ...f, rssUrl: v }))}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catPill, form.category === cat && styles.catPillActive]}
                  onPress={() => setForm((f) => ({ ...f, category: cat }))}
                >
                  <Text style={[styles.catPillText, form.category === cat && styles.catPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.fieldLabel}>Emoji Icon</Text>
          <TextInput
            style={[styles.input, { width: 80 }]}
            placeholder="🌐"
            placeholderTextColor={theme.colors.text.muted}
            value={form.icon}
            onChangeText={(v) => setForm((f) => ({ ...f, icon: v }))}
            maxLength={4}
          />

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowAddForm(false); setForm(BLANK_FORM); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={addSource}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={theme.colors.text.inverse} />
                : <Ionicons name="add-circle-outline" size={16} color={theme.colors.text.inverse} />}
              <Text style={styles.saveBtnText}>{saving ? "Adding..." : "Add Source"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.cyan} size="large" />
        </View>
      ) : (
        <>
          {Object.entries(grouped).map(([category, items]) => (
            <View key={category} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{category}</Text>
                <Text style={styles.groupCount}>
                  {items.filter((s) => s.enabled).length}/{items.length}
                </Text>
              </View>

              <View style={styles.card}>
                {items.map((source, idx) => (
                  <View
                    key={source.id}
                    style={[
                      styles.sourceRow,
                      idx < items.length - 1 && styles.sourceRowBorder,
                    ]}
                  >
                    <View style={[styles.sourceIcon, { backgroundColor: source.color + "22" }]}>
                      <Text style={{ fontSize: 16 }}>{source.icon}</Text>
                    </View>

                    <View style={styles.sourceInfo}>
                      <View style={styles.sourceNameRow}>
                        <Text style={[styles.sourceName, !source.enabled && styles.sourceNameDisabled]}>
                          {source.name}
                        </Text>
                        {!source.isDefault && (
                          <View style={styles.customBadge}>
                            <Text style={styles.customBadgeText}>custom</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.sourceUrl} numberOfLines={1}>
                        {source.rssUrl.replace(/^https?:\/\//, "").slice(0, 50)}
                      </Text>
                    </View>

                    <View style={styles.sourceActions}>
                      <Switch
                        value={source.enabled}
                        onValueChange={(v) => toggle(source.id, v)}
                        trackColor={{ false: theme.colors.bg.elevated, true: theme.colors.accent.cyan + "88" }}
                        thumbColor={source.enabled ? theme.colors.accent.cyan : theme.colors.text.muted}
                        ios_backgroundColor={theme.colors.bg.elevated}
                      />
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => deleteSource(source)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color={theme.colors.accent.red + "99"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Reset */}
          <TouchableOpacity style={styles.resetBtn} onPress={resetToDefaults}>
            <Ionicons name="refresh-outline" size={16} color={theme.colors.accent.orange} />
            <Text style={styles.resetBtnText}>Reset to 28 default sources</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { paddingTop: 60, alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.colors.bg.card,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.text.primary },
  subtitle: { color: theme.colors.text.muted, fontSize: 12, marginTop: 1 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.colors.accent.cyanDim,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "44",
    alignItems: "center", justifyContent: "center",
  },

  tipRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  tipText: { flex: 1, color: theme.colors.text.muted, fontSize: 12, lineHeight: 17 },

  // Add form
  addForm: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.colors.accent.cyan + "44",
  },
  formTitle: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 16, marginBottom: 14 },
  fieldLabel: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 10, padding: 12,
    color: theme.colors.text.primary, fontSize: 14,
    borderWidth: 1, borderColor: theme.colors.bg.border, marginBottom: 12,
  },
  catPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  catPillActive: {
    backgroundColor: theme.colors.accent.cyanDim,
    borderColor: theme.colors.accent.cyan,
  },
  catPillText: { color: theme.colors.text.muted, fontSize: 12 },
  catPillTextActive: { color: theme.colors.accent.cyan, fontWeight: "700" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, padding: 12, borderRadius: 100,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1, borderColor: theme.colors.bg.border,
    alignItems: "center",
  },
  cancelBtnText: { color: theme.colors.text.secondary },
  saveBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 12, borderRadius: 100,
    backgroundColor: theme.colors.accent.cyan,
  },
  saveBtnText: { color: theme.colors.text.inverse, fontWeight: "700" },

  // Groups
  group: { marginHorizontal: 16, marginBottom: 16 },
  groupHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 6,
  },
  groupTitle: {
    color: theme.colors.text.muted, fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1,
  },
  groupCount: { color: theme.colors.text.muted, fontSize: 11 },

  card: {
    backgroundColor: theme.colors.bg.card,
    borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: theme.colors.bg.border,
  },
  sourceRow: {
    flexDirection: "row", alignItems: "center",
    padding: 12, gap: 10,
  },
  sourceRowBorder: {
    borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border,
  },
  sourceIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sourceInfo: { flex: 1, minWidth: 0 },
  sourceNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sourceName: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "500", flexShrink: 1 },
  sourceNameDisabled: { color: theme.colors.text.muted },
  sourceUrl: { color: theme.colors.text.muted, fontSize: 10, marginTop: 1 },
  customBadge: {
    backgroundColor: theme.colors.accent.purpleDim,
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  customBadgeText: { color: theme.colors.accent.purple, fontSize: 9, fontWeight: "700" },

  sourceActions: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.accent.redDim,
    alignItems: "center", justifyContent: "center",
  },

  resetBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: theme.colors.bg.card,
    borderWidth: 1, borderColor: theme.colors.accent.orange + "33",
  },
  resetBtnText: { color: theme.colors.accent.orange, fontWeight: "600", fontSize: 14 },
});
