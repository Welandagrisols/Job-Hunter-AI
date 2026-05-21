import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { db, UserProfile, DEFAULT_USER_PROFILE } from "@/src/services/storage";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    db.getUserProfile().then(setProfile);
  }, []));

  const update = (field: keyof UserProfile, value: string) => {
    setSaved(false);
    setProfile((p) => ({ ...p, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await db.saveUserProfile(profile);
      setSaved(true);
      Alert.alert("Saved!", "Your profile is now used by all AI features to personalise cover letters, interview prep, and more.");
    } catch {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 50 }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.foreground }}>My Profile</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Used by AI for personalised cover letters & interview prep</Text>
        </View>
      </View>

      {/* Info banner */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 16, marginBottom: 20, backgroundColor: colors.primary + "18", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.primary + "33" }}>
        <Ionicons name="sparkles-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, color: colors.primary, fontSize: 13, lineHeight: 19 }}>
          Every AI-generated cover letter, email, and interview answer uses these details. Keep this up to date for the best output.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16 }}>

        <Field
          label="Full Name"
          value={profile.name}
          onChange={(v) => update("name", v)}
          placeholder="e.g. Wesley Kipkemoi Koech"
          colors={colors}
        />

        <Field
          label="Profession / Job Title"
          value={profile.profession}
          onChange={(v) => update("profession", v)}
          placeholder="e.g. Agronomist & Soil Scientist"
          colors={colors}
        />

        <Field
          label="Location"
          value={profile.location}
          onChange={(v) => update("location", v)}
          placeholder="e.g. Nairobi, Kenya"
          colors={colors}
        />

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Years of Experience"
              value={profile.yearsExperience}
              onChange={(v) => update("yearsExperience", v)}
              placeholder="e.g. 5+"
              colors={colors}
              keyboardType="default"
            />
          </View>
          <View style={{ flex: 2 }}>
            <Field
              label="Current / Most Recent Role"
              value={profile.currentRole}
              onChange={(v) => update("currentRole", v)}
              placeholder="e.g. Agricultural Consultant"
              colors={colors}
            />
          </View>
        </View>

        <MultiField
          label="Key Skills"
          value={profile.keySkills}
          onChange={(v) => update("keySkills", v)}
          placeholder="e.g. Soil fertility management, fertilizer optimization, crop advisory, field training, agricultural research..."
          hint="Separate skills with commas. Be specific — these go directly into your cover letters."
          colors={colors}
          lines={4}
        />

        <MultiField
          label="Notable Experience / Achievements"
          value={profile.notableExperience}
          onChange={(v) => update("notableExperience", v)}
          placeholder="e.g. Led soil health and fertilizer optimization program under IFDC Sudan project. Managed 3 field trials across 4 counties in Kenya..."
          hint="Specific projects, organisations, and results. The AI uses these as proof points in cover letters."
          colors={colors}
          lines={5}
        />

        <MultiField
          label="Target Roles & Sectors"
          value={profile.targetRoles}
          onChange={(v) => update("targetRoles", v)}
          placeholder="e.g. Agronomist, Field Officer, Research Officer, Agri-development roles at NGOs and international organisations in East Africa..."
          hint="What kind of jobs are you going for? Used to tune the AI's tone and emphasis."
          colors={colors}
          lines={3}
        />

        {profile.updatedAt && (
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
            Last updated {new Date(profile.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
          </Text>
        )}

        <TouchableOpacity
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            backgroundColor: saved ? colors.green : colors.primary,
            borderRadius: 999, padding: 16, marginTop: 4,
            opacity: saving ? 0.7 : 1,
          }}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={20} color={colors.primaryForeground} />
          )}
          <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 16 }}>
            {saving ? "Saving..." : saved ? "Profile Saved!" : "Save Profile"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, colors, keyboardType = "default" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; colors: any; keyboardType?: any;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
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

function MultiField({ label, value, onChange, placeholder, hint, colors, lines = 4 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; hint: string; colors: any; lines?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      {hint ? <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}>{hint}</Text> : null}
      <TextInput
        style={{
          backgroundColor: colors.card, borderRadius: 12, padding: 14,
          color: colors.foreground, fontSize: 14, lineHeight: 22,
          minHeight: lines * 26, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top",
        }}
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
