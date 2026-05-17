import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Linking, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gmailService } from "@/src/services/gmail";
import { useColors } from "@/hooks/useColors";
import { CONFIG } from "@/src/config";
import { getGeminiApiKey, saveGeminiApiKey } from "@/src/services/gemini";
import { db } from "@/src/services/storage";
import { backgroundService } from "@/src/services/background";
import { notificationService } from "@/src/services/notifications";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [gmailConnected, setGmailConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [showGeminiInput, setShowGeminiInput] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);

  const loadStatus = useCallback(async () => {
    const [gmail, savedKey, bgEnabled] = await Promise.all([
      gmailService.isSignedIn(),
      getGeminiApiKey(),
      backgroundService.isRegistered(),
    ]);
    setGmailConnected(gmail);
    if (savedKey) setGeminiKey(savedKey);
    setBackgroundEnabled(bgEnabled);
  }, []);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  const connectGmail = async () => {
    if (!CONFIG.GOOGLE_CLIENT_ID) {
      Alert.alert(
        "Setup Required",
        "Add your Google Client ID as EXPO_PUBLIC_GOOGLE_CLIENT_ID in the Secrets tab, then restart the app.",
        [{ text: "OK" }]
      );
      return;
    }
    setConnecting(true);
    const success = await gmailService.signIn();
    if (success) {
      setGmailConnected(true);
      Alert.alert("Connected!", "Gmail connected. You can now check for recruiter emails.");
    } else {
      Alert.alert("Failed", "Could not connect to Gmail. Check your Google Client ID.");
    }
    setConnecting(false);
  };

  const disconnectGmail = () => {
    Alert.alert("Disconnect Gmail", "This will stop email monitoring. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect", style: "destructive",
        onPress: async () => { await gmailService.signOut(); setGmailConnected(false); },
      },
    ]);
  };

  const checkNow = async () => {
    if (!gmailConnected) { Alert.alert("Not Connected", "Please connect Gmail first."); return; }
    setChecking(true);
    const count = await gmailService.checkForNewEmails();
    setChecking(false);
    Alert.alert(
      count > 0 ? "New Emails Found!" : "All caught up!",
      count > 0 ? `${count} new recruiter email${count > 1 ? "s" : ""} found.` : "No new recruiter emails."
    );
  };

  const saveApiKey = async () => {
    if (!geminiKey.trim()) { Alert.alert("Empty key", "Please enter your Gemini API key"); return; }
    setSavingKey(true);
    await saveGeminiApiKey(geminiKey.trim());
    setSavingKey(false);
    setShowGeminiInput(false);
    Alert.alert("Saved!", "Gemini API key saved. All AI features are now active.");
  };

  const toggleBackground = async () => {
    if (backgroundEnabled) {
      await backgroundService.unregister();
      setBackgroundEnabled(false);
    } else {
      const hasPerms = await notificationService.requestPermissions();
      if (!hasPerms) {
        Alert.alert("Permission Required", "Please allow notifications to enable background monitoring.");
        return;
      }
      const success = await backgroundService.register();
      setBackgroundEnabled(success);
      if (success) {
        Alert.alert("Enabled!", "Background email monitoring is now active.");
      } else {
        Alert.alert("Failed", "Could not enable background monitoring. This feature requires a physical device.");
      }
    }
  };

  const clearData = () => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your applications, alerts, and CV vault. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything", style: "destructive",
          onPress: async () => { await db.clearAll(); Alert.alert("Cleared", "All data has been deleted."); },
        },
      ]
    );
  };

  const geminiConfigured = geminiKey.length > 10;
  const googleConfigured = !!CONFIG.GOOGLE_CLIENT_ID;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 50 : 40 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>Settings</Text>
      </View>

      {/* Setup status */}
      <SectionLabel title="Setup Status" colors={colors} />
      <Card colors={colors}>
        <StatusRow label="Gemini API (AI Writing)" configured={geminiConfigured} note={geminiConfigured ? "API key saved ✓" : "Required for all AI features"} colors={colors} last={false} />
        <StatusRow label="Gmail OAuth Client" configured={googleConfigured} note={googleConfigured ? "Client ID configured" : "Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to Secrets"} colors={colors} last={false} />
        <StatusRow label="Gmail Connected" configured={gmailConnected} note={gmailConnected ? "Connected and monitoring" : "Not connected"} colors={colors} last={true} />
      </Card>

      {/* Gemini AI */}
      <SectionLabel title="AI Engine (Gemini)" colors={colors} />
      <Card colors={colors}>
        <View style={{ padding: 14 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
            Gemini 2.0 Flash is free to use. Get your free API key from Google AI Studio.
          </Text>
          {!showGeminiInput ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 999, padding: 12 }}
                onPress={() => setShowGeminiInput(true)}
              >
                <Ionicons name="key-outline" size={16} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>
                  {geminiConfigured ? "Update API Key" : "Add Gemini API Key"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 8 }}
                onPress={() => Linking.openURL("https://aistudio.google.com/app/apikey")}
              >
                <Ionicons name="open-outline" size={13} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13 }}>Get free API key from Google AI Studio</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TextInput
                style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border, fontFamily: "monospace" }}
                placeholder="AIza..."
                placeholderTextColor={colors.textMuted}
                value={geminiKey}
                onChangeText={setGeminiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={true}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 12, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
                  onPress={() => setShowGeminiInput(false)}
                >
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 999, backgroundColor: colors.primary, opacity: savingKey ? 0.6 : 1 }}
                  onPress={saveApiKey}
                  disabled={savingKey}
                >
                  {savingKey
                    ? <ActivityIndicator color={colors.primaryForeground} size="small" />
                    : <><Ionicons name="save-outline" size={16} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>Save Key</Text></>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Card>

      {/* Gmail */}
      <SectionLabel title="Gmail Integration" colors={colors} />
      <Card colors={colors}>
        {gmailConnected ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                <Text style={{ color: colors.foreground, fontWeight: "500" }}>Gmail Connected</Text>
              </View>
              <TouchableOpacity onPress={disconnectGmail}>
                <Text style={{ color: colors.destructive, fontSize: 13 }}>Disconnect</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, opacity: checking ? 0.6 : 1 }}
              onPress={checkNow}
              disabled={checking}
            >
              {checking
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <Ionicons name="refresh" size={16} color={colors.primary} />}
              <Text style={{ color: colors.primary, fontWeight: "500" }}>Check Emails Now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ padding: 14, gap: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Connect Gmail to automatically detect and classify recruiter emails with AI.
            </Text>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 999, padding: 14, opacity: connecting ? 0.6 : 1 }}
              onPress={connectGmail}
              disabled={connecting}
            >
              {connecting
                ? <ActivityIndicator color={colors.primaryForeground} size="small" />
                : <Ionicons name="logo-google" size={18} color={colors.primaryForeground} />}
              <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>Connect Gmail</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* Background monitoring */}
      <SectionLabel title="Background Monitoring" colors={colors} />
      <Card colors={colors}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "500" }}>Background Email Check</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Checks every 15 minutes (device only)</Text>
          </View>
          <TouchableOpacity
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
              backgroundColor: backgroundEnabled ? colors.green + "22" : colors.card,
              borderWidth: 1, borderColor: backgroundEnabled ? colors.green + "55" : colors.border,
            }}
            onPress={toggleBackground}
          >
            <Text style={{ color: backgroundEnabled ? colors.green : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>
              {backgroundEnabled ? "ON" : "OFF"}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Data */}
      <SectionLabel title="Data" colors={colors} />
      <Card colors={colors}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
          onPress={clearData}
        >
          <Ionicons name="trash-outline" size={16} color={colors.destructive} />
          <Text style={{ color: colors.destructive, fontSize: 14 }}>Clear All Data</Text>
        </TouchableOpacity>
      </Card>

      {/* About */}
      <View style={{ alignItems: "center", padding: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>JobHunter AI v2.0.0</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Built for Wesley Kipkemoi Koech</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>AI powered by Google Gemini 2.0 Flash</Text>
      </View>
    </ScrollView>
  );
}

function SectionLabel({ title, colors }: { title: string; colors: any }) {
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginHorizontal: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
      {title}
    </Text>
  );
}

function Card({ children, colors }: { children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 20 }}>
      {children}
    </View>
  );
}

function StatusRow({ label, configured, note, colors, last }: {
  label: string; configured: boolean; note: string; colors: any; last: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Ionicons name={configured ? "checkmark-circle" : "alert-circle"} size={16} color={configured ? colors.green : colors.orange} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>{label}</Text>
        <Text style={{ color: configured ? colors.textMuted : colors.orange, fontSize: 12, marginTop: 2 }}>{note}</Text>
      </View>
    </View>
  );
}
