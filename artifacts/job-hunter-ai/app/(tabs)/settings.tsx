import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch, Linking, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gmailService } from "@/src/services/gmail";
import { useColors } from "@/hooks/useColors";
import { CONFIG } from "@/src/config";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [gmailConnected, setGmailConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadStatus = useCallback(async () => {
    const gmail = await gmailService.isSignedIn();
    setGmailConnected(gmail);
  }, []);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  const connectGmail = async () => {
    if (!CONFIG.GOOGLE_CLIENT_ID) {
      Alert.alert(
        "Setup Required",
        "Add your Google Client ID as EXPO_PUBLIC_GOOGLE_CLIENT_ID in the Secrets tab, then restart the app.\n\nSee the setup guide below.",
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
      Alert.alert("Failed", "Could not connect to Gmail. Please check your Google Client ID.");
    }
    setConnecting(false);
  };

  const disconnectGmail = () => {
    Alert.alert(
      "Disconnect Gmail",
      "This will stop email monitoring. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect", style: "destructive",
          onPress: async () => {
            await gmailService.signOut();
            setGmailConnected(false);
          },
        },
      ]
    );
  };

  const checkNow = async () => {
    if (!gmailConnected) {
      Alert.alert("Not Connected", "Please connect Gmail first.");
      return;
    }
    setChecking(true);
    const { gmailService: gs } = await import("@/src/services/gmail");
    const count = await gs.checkForNewEmails();
    setChecking(false);
    Alert.alert(
      count > 0 ? "New Emails Found!" : "All caught up!",
      count > 0 ? `${count} new recruiter email${count > 1 ? "s" : ""} found.` : "No new recruiter emails."
    );
  };

  const anthropicConfigured = !!process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || false;
  const googleConfigured = !!CONFIG.GOOGLE_CLIENT_ID;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 50 : 40 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: topPad + 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>Settings</Text>
      </View>

      <SectionHeader title="Setup Status" colors={colors} />
      <View style={{ marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 20 }}>
        <StatusRow
          label="Anthropic API Key (AI Writing)"
          configured={true}
          note="Managed by server — check Replit Secrets"
          colors={colors}
          last={false}
        />
        <StatusRow
          label="Gmail OAuth"
          configured={googleConfigured}
          note={googleConfigured ? "Client ID configured" : "Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to Secrets"}
          colors={colors}
          last={false}
        />
        <StatusRow
          label="Gmail Connected"
          configured={gmailConnected}
          note={gmailConnected ? "Connected and ready" : "Not connected"}
          colors={colors}
          last={true}
        />
      </View>

      <SectionHeader title="Gmail Integration" colors={colors} />
      <View style={{ marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 20 }}>
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
          <>
            <Text style={{ color: colors.textSecondary, fontSize: 13, padding: 14, lineHeight: 20 }}>
              Connect your Gmail to automatically detect recruiter emails and classify them with AI.
            </Text>
            <View style={{ padding: 14, paddingTop: 0 }}>
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
          </>
        )}
      </View>

      <SectionHeader title="Setup Guide" colors={colors} />
      <View style={{ marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 20 }}>
        <GuideRow
          icon="key-outline"
          label="Get Anthropic API Key"
          sub="Add as ANTHROPIC_API_KEY in Replit Secrets"
          onPress={() => Linking.openURL("https://console.anthropic.com")}
          colors={colors}
          last={false}
        />
        <GuideRow
          icon="logo-google"
          label="Google Cloud Console"
          sub="Enable Gmail API & create OAuth credentials"
          onPress={() => Linking.openURL("https://console.cloud.google.com")}
          colors={colors}
          last={false}
        />
        <GuideRow
          icon="server-outline"
          label="Supabase (optional cloud DB)"
          sub="Add SUPABASE_URL & SUPABASE_ANON_KEY in Secrets"
          onPress={() => Linking.openURL("https://supabase.com")}
          colors={colors}
          last={true}
        />
      </View>

      <View style={{ alignItems: "center", padding: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>JobHunter AI v1.0.0</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Built for Wesley Kipkemoi Koech</Text>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginHorizontal: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
      {title}
    </Text>
  );
}

function StatusRow({ label, configured, note, colors, last }: {
  label: string; configured: boolean; note: string;
  colors: ReturnType<typeof useColors>; last: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Ionicons
        name={configured ? "checkmark-circle" : "alert-circle"}
        size={16}
        color={configured ? colors.green : colors.orange}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>{label}</Text>
        <Text style={{ color: configured ? colors.textMuted : colors.orange, fontSize: 12, marginTop: 2 }}>{note}</Text>
      </View>
    </View>
  );
}

function GuideRow({ icon, label, sub, onPress, colors, last }: {
  icon: string; label: string; sub: string; onPress: () => void;
  colors: ReturnType<typeof useColors>; last: boolean;
}) {
  return (
    <TouchableOpacity
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={16} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 14 }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{sub}</Text>
      </View>
      <Ionicons name="open-outline" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}
