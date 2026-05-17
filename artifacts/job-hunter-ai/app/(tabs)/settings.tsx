import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Linking,
  Platform, Clipboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gmailService, getOAuthRedirectUri } from "@/src/services/gmail";
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
  const [showGmailSetup, setShowGmailSetup] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadStatus = useCallback(async () => {
    const [gmail, savedKey, bgEnabled] = await Promise.all([
      gmailService.isSignedIn(),
      getGeminiApiKey(),
      backgroundService.isRegistered(),
    ]);
    setGmailConnected(gmail);
    if (savedKey) setGeminiKey(savedKey);
    setBackgroundEnabled(bgEnabled);
    setRedirectUri(getOAuthRedirectUri());
  }, []);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  const connectGmail = async () => {
    if (!CONFIG.GOOGLE_CLIENT_ID) {
      Alert.alert(
        "Setup Required",
        "Add your Google Web Client ID as EXPO_PUBLIC_GOOGLE_CLIENT_ID in Secrets, then restart the app.",
      );
      return;
    }
    setConnecting(true);
    const success = await gmailService.signIn();
    if (success) {
      setGmailConnected(true);
      Alert.alert("Connected!", "Gmail connected. You can now check for recruiter emails.");
    } else {
      Alert.alert(
        "Could Not Connect",
        "The sign-in was cancelled or failed. Make sure your redirect URI is registered in Google Cloud Console (tap 'Gmail Setup Guide' below).",
      );
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

  const testApiKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const key = await getGeminiApiKey();
      if (!key) {
        setTestResult({ ok: false, message: "No API key found. Please add your key first." });
        return;
      }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Reply with only the word: OK" }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        }
      );
      if (response.ok) {
        setTestResult({ ok: true, message: "Connected! Your Gemini API key is valid. All AI features are active." });
      } else {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || `Error ${response.status}`;
        if (response.status === 429 || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
          setTestResult({ ok: true, message: "Key is valid! You've hit the free rate limit — this resets automatically in a few seconds. All AI features will work normally." });
        } else if (response.status === 400 || msg.includes("API_KEY_INVALID")) {
          setTestResult({ ok: false, message: "Invalid API key. Please check it and try again." });
        } else if (response.status === 403) {
          setTestResult({ ok: false, message: "Key rejected. Make sure the Gemini API is enabled in Google AI Studio." });
        } else {
          setTestResult({ ok: false, message: msg || "Test failed. Please try again." });
        }
      }
    } catch {
      setTestResult({ ok: false, message: "Could not reach Gemini. Check your internet connection." });
    } finally {
      setTestingKey(false);
    }
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
      if (!success) {
        Alert.alert("Not Available", "Background monitoring requires a native build, not Expo Go.");
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
  const expoUsername = process.env.EXPO_PUBLIC_EXPO_USERNAME || "";

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
        <StatusRow label="Gmail Client ID" configured={googleConfigured} note={googleConfigured ? "Client ID configured ✓" : "See Gmail Setup Guide below"} colors={colors} last={false} />
        <StatusRow label="Gmail Connected" configured={gmailConnected} note={gmailConnected ? "Connected and monitoring ✓" : "Tap Connect Gmail below"} colors={colors} last={true} />
      </Card>

      {/* Gemini AI */}
      <SectionLabel title="AI Engine (Gemini)" colors={colors} />
      <Card colors={colors}>
        <View style={{ padding: 14 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
            Gemini 2.0 Flash is free. Get your API key from Google AI Studio — takes 2 minutes.
          </Text>
          {!showGeminiInput ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: geminiConfigured ? colors.green : colors.primary, borderRadius: 999, padding: 12 }}
                onPress={() => setShowGeminiInput(true)}
              >
                <Ionicons name="key-outline" size={16} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>
                  {geminiConfigured ? "Update Gemini API Key" : "Add Gemini API Key"}
                </Text>
              </TouchableOpacity>
              {geminiConfigured && (
                <>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, padding: 12, borderWidth: 1, borderColor: colors.border, opacity: testingKey ? 0.6 : 1 }}
                    onPress={testApiKey}
                    disabled={testingKey}
                  >
                    {testingKey
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />}
                    <Text style={{ color: colors.primary, fontWeight: "600" }}>
                      {testingKey ? "Testing..." : "Test Connection"}
                    </Text>
                  </TouchableOpacity>
                  {testResult && (
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, padding: 12, backgroundColor: testResult.ok ? colors.green + "18" : "#ff000018", borderWidth: 1, borderColor: testResult.ok ? colors.green + "55" : "#ff000055" }}>
                      <Ionicons name={testResult.ok ? "checkmark-circle" : "close-circle"} size={18} color={testResult.ok ? colors.green : colors.destructive} style={{ marginTop: 1 }} />
                      <Text style={{ flex: 1, color: testResult.ok ? colors.green : colors.destructive, fontSize: 13, lineHeight: 20, fontWeight: "600" }}>
                        {testResult.message}
                      </Text>
                    </View>
                  )}
                </>
              )}
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 8 }}
                onPress={() => Linking.openURL("https://aistudio.google.com/app/apikey")}
              >
                <Ionicons name="open-outline" size={13} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13 }}>Get free API key at aistudio.google.com</Text>
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

      {/* Gmail Setup Guide */}
      <SectionLabel title="Gmail Integration" colors={colors} />

      <TouchableOpacity
        style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}
        onPress={() => setShowGmailSetup(!showGmailSetup)}
        activeOpacity={0.8}
      >
        <Ionicons name="construct-outline" size={18} color={colors.primary} />
        <Text style={{ flex: 1, color: colors.foreground, fontWeight: "600" }}>Gmail Setup Guide</Text>
        <Ionicons name={showGmailSetup ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {showGmailSetup && (
        <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>One-time Google Cloud Setup</Text>

          <SetupStep num="1" colors={colors} title="Open Google Cloud Console">
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Go to{" "}
              <Text style={{ color: colors.primary }} onPress={() => Linking.openURL("https://console.cloud.google.com/apis/credentials")}>
                console.cloud.google.com/apis/credentials
              </Text>
            </Text>
          </SetupStep>

          <SetupStep num="2" colors={colors} title="Create a Web Client ID">
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Tap <Text style={{ color: colors.foreground, fontWeight: "600" }}>Create Credentials → OAuth Client ID</Text>{"\n"}
              Choose <Text style={{ color: colors.foreground, fontWeight: "600" }}>Web application</Text> as the type (not Android this time).
            </Text>
          </SetupStep>

          <SetupStep num="3" colors={colors} title="Add this exact Redirect URI">
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Under "Authorized redirect URIs", add:
            </Text>
            <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "monospace" }} selectable>
                {expoUsername
                  ? `https://auth.expo.io/@${expoUsername}/job-hunter-ai`
                  : redirectUri || "Loading..."}
              </Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}
              onPress={() => {
                const uri = expoUsername
                  ? `https://auth.expo.io/@${expoUsername}/job-hunter-ai`
                  : redirectUri;
                Clipboard.setString(uri);
                Alert.alert("Copied!", "Redirect URI copied to clipboard.");
              }}
            >
              <Ionicons name="copy-outline" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13 }}>Copy redirect URI</Text>
            </TouchableOpacity>
          </SetupStep>

          <SetupStep num="4" colors={colors} title="Add 2 secrets in Replit">
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              In Replit's Secrets tab, add:{"\n"}
              <Text style={{ color: colors.foreground, fontFamily: "monospace", fontSize: 12 }}>EXPO_PUBLIC_GOOGLE_CLIENT_ID</Text>
              {" "}← the Web Client ID{"\n"}
              <Text style={{ color: colors.foreground, fontFamily: "monospace", fontSize: 12 }}>EXPO_PUBLIC_GOOGLE_CLIENT_SECRET</Text>
              {" "}← the Client Secret{"\n"}
              <Text style={{ color: colors.foreground, fontFamily: "monospace", fontSize: 12 }}>EXPO_PUBLIC_EXPO_USERNAME</Text>
              {" "}← your Expo Go username
            </Text>
          </SetupStep>

          <SetupStep num="5" colors={colors} title="Enable the Gmail API">
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              In Google Cloud Console, go to{" "}
              <Text style={{ color: colors.primary }} onPress={() => Linking.openURL("https://console.cloud.google.com/apis/library/gmail.googleapis.com")}>
                APIs & Services → Library
              </Text>
              {" "}and enable the <Text style={{ color: colors.foreground, fontWeight: "600" }}>Gmail API</Text>.
            </Text>
          </SetupStep>

          <SetupStep num="6" colors={colors} title="Restart the app, then Connect">
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              After adding the secrets, reload your Expo Go app (shake phone → Reload), then tap <Text style={{ color: colors.foreground, fontWeight: "600" }}>Connect Gmail</Text> below.
            </Text>
          </SetupStep>

          {!expoUsername && (
            <View style={{ backgroundColor: "#2a1f0e", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.orange + "55" }}>
              <Text style={{ color: colors.orange, fontSize: 12, fontWeight: "600" }}>Your Expo username</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                Open Expo Go → tap your profile icon → your username is shown there. Add it as{" "}
                <Text style={{ fontFamily: "monospace" }}>EXPO_PUBLIC_EXPO_USERNAME</Text> in Replit Secrets, then reload the app.
              </Text>
            </View>
          )}
        </View>
      )}

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
              {!googleConfigured && "\n\nComplete the setup guide above first."}
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: googleConfigured ? colors.primary : colors.card,
                borderRadius: 999, padding: 14, opacity: connecting ? 0.6 : 1,
                borderWidth: googleConfigured ? 0 : 1, borderColor: colors.border,
              }}
              onPress={connectGmail}
              disabled={connecting}
            >
              {connecting
                ? <ActivityIndicator color={googleConfigured ? colors.primaryForeground : colors.textSecondary} size="small" />
                : <Ionicons name="logo-google" size={18} color={googleConfigured ? colors.primaryForeground : colors.textMuted} />}
              <Text style={{ color: googleConfigured ? colors.primaryForeground : colors.textMuted, fontWeight: "700" }}>
                Connect Gmail
              </Text>
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
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Requires native build (not Expo Go)</Text>
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

      <View style={{ alignItems: "center", padding: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>JobHunter AI v2.0.0</Text>
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

function SetupStep({ num, title, children, colors }: { num: string; title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary + "22", borderWidth: 1, borderColor: colors.primary + "55", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{num}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>{title}</Text>
        {children}
      </View>
    </View>
  );
}
