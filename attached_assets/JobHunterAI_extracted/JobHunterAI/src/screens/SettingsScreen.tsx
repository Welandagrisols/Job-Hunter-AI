import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { gmailService } from "../services/gmail";
import { backgroundService } from "../services/background";
import { notificationService } from "../services/notifications";
import { theme } from "../theme";
import { CONFIG } from "../config";

export default function SettingsScreen() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadStatus = async () => {
    const [gmail, bg, notifPerm] = await Promise.all([
      gmailService.isSignedIn(),
      backgroundService.isRegistered(),
      notificationService.requestPermissions(),
    ]);
    setGmailConnected(gmail);
    setBackgroundEnabled(bg);
    setNotificationsEnabled(notifPerm);
  };

  useFocusEffect(useCallback(() => { loadStatus(); }, []));

  const connectGmail = async () => {
    if (CONFIG.GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
      Alert.alert(
        "Setup Required",
        "You need to add your Google Client ID to src/config.ts before connecting Gmail.\n\nSee the README for setup instructions.",
        [{ text: "OK" }]
      );
      return;
    }

    setConnecting(true);
    const success = await gmailService.signIn();
    if (success) {
      setGmailConnected(true);
      // Enable background monitoring automatically
      await backgroundService.register();
      setBackgroundEnabled(true);
      Alert.alert("Connected!", "Gmail connected. Email monitoring is now active.");
    } else {
      Alert.alert("Failed", "Could not connect to Gmail. Please try again.");
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
            await backgroundService.unregister();
            setGmailConnected(false);
            setBackgroundEnabled(false);
          },
        },
      ]
    );
  };

  const toggleBackground = async (value: boolean) => {
    if (!gmailConnected) {
      Alert.alert("Connect Gmail first", "You need to connect Gmail before enabling background monitoring.");
      return;
    }
    if (value) {
      await backgroundService.register();
    } else {
      await backgroundService.unregister();
    }
    setBackgroundEnabled(value);
  };

  const checkNow = async () => {
    if (!gmailConnected) {
      Alert.alert("Not Connected", "Please connect Gmail first.");
      return;
    }
    setChecking(true);
    const count = await gmailService.checkForNewEmails();
    setChecking(false);
    Alert.alert(
      count > 0 ? "New Emails Found!" : "All caught up!",
      count > 0 ? `${count} new recruiter email${count > 1 ? "s" : ""} found.` : "No new recruiter emails."
    );
  };

  const apiConfigured = CONFIG.ANTHROPIC_API_KEY !== "YOUR_ANTHROPIC_API_KEY";
  const supabaseConfigured = CONFIG.SUPABASE_URL !== "YOUR_SUPABASE_URL";

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Setup Status */}
      <Section title="Setup Status">
        <StatusRow
          label="Claude AI (Writing)"
          configured={apiConfigured}
          note={apiConfigured ? "Connected" : "Add ANTHROPIC_API_KEY to config.ts"}
        />
        <StatusRow
          label="Supabase Database"
          configured={supabaseConfigured}
          note={supabaseConfigured ? "Connected" : "Add SUPABASE_URL to config.ts"}
        />
        <StatusRow
          label="Gmail"
          configured={gmailConnected}
          note={gmailConnected ? "Connected & monitoring" : "Not connected"}
        />
      </Section>

      {/* Gmail */}
      <Section title="Gmail Integration">
        {gmailConnected ? (
          <>
            <View style={styles.connectedRow}>
              <View style={styles.connectedInfo}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent.green} />
                <Text style={styles.connectedText}>Gmail Connected</Text>
              </View>
              <TouchableOpacity onPress={disconnectGmail}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>

            <SettingRow
              label="Background Monitoring"
              description={`Check every ~15 min (interval: ${CONFIG.EMAIL_CHECK_INTERVAL}min set)`}
              value={backgroundEnabled}
              onToggle={toggleBackground}
            />

            <TouchableOpacity
              style={[styles.actionBtn, checking && { opacity: 0.6 }]}
              onPress={checkNow}
              disabled={checking}
            >
              {checking
                ? <ActivityIndicator color={theme.colors.accent.cyan} size="small" />
                : <Ionicons name="refresh" size={18} color={theme.colors.accent.cyan} />
              }
              <Text style={styles.actionBtnText}>Check Now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.description}>
              Connect your Gmail to automatically detect recruiter emails and get instant notifications.
            </Text>
            <TouchableOpacity
              style={[styles.connectBtn, connecting && { opacity: 0.6 }]}
              onPress={connectGmail}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator color={theme.colors.bg.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={theme.colors.bg.primary} />
                  <Text style={styles.connectBtnText}>Connect Gmail</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <View style={styles.connectedRow}>
          <View style={styles.connectedInfo}>
            <Ionicons
              name={notificationsEnabled ? "notifications" : "notifications-off"}
              size={20}
              color={notificationsEnabled ? theme.colors.accent.green : theme.colors.text.muted}
            />
            <Text style={styles.connectedText}>
              {notificationsEnabled ? "Push Notifications Enabled" : "Notifications Disabled"}
            </Text>
          </View>
          {!notificationsEnabled && (
            <TouchableOpacity onPress={() => Linking.openSettings()}>
              <Text style={styles.actionText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>
      </Section>

      {/* Setup Guide */}
      <Section title="Setup Guide">
        <TouchableOpacity
          style={styles.guideBtn}
          onPress={() => Linking.openURL("https://console.anthropic.com")}
        >
          <Ionicons name="key-outline" size={18} color={theme.colors.accent.cyan} />
          <Text style={styles.guideBtnText}>Get Anthropic API Key</Text>
          <Ionicons name="open-outline" size={14} color={theme.colors.text.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.guideBtn}
          onPress={() => Linking.openURL("https://supabase.com")}
        >
          <Ionicons name="server-outline" size={18} color={theme.colors.accent.cyan} />
          <Text style={styles.guideBtnText}>Set up Supabase (Free)</Text>
          <Ionicons name="open-outline" size={14} color={theme.colors.text.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.guideBtn}
          onPress={() => Linking.openURL("https://console.cloud.google.com")}
        >
          <Ionicons name="logo-google" size={18} color={theme.colors.accent.cyan} />
          <Text style={styles.guideBtnText}>Google Cloud Console (Gmail API)</Text>
          <Ionicons name="open-outline" size={14} color={theme.colors.text.muted} />
        </TouchableOpacity>
      </Section>

      {/* App info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>JobHunter AI v1.0.0</Text>
        <Text style={styles.appInfoText}>Built for Wesley Kipkemoi Koech</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function StatusRow({ label, configured, note }: any) {
  return (
    <View style={styles.statusRow}>
      <Ionicons
        name={configured ? "checkmark-circle" : "alert-circle"}
        size={18}
        color={configured ? theme.colors.accent.green : theme.colors.accent.orange}
      />
      <View style={styles.statusInfo}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={[styles.statusNote, { color: configured ? theme.colors.text.muted : theme.colors.accent.orange }]}>
          {note}
        </Text>
      </View>
    </View>
  );
}

function SettingRow({ label, description, value, onToggle }: any) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.bg.border, true: theme.colors.accent.cyan + "66" }}
        thumbColor={value ? theme.colors.accent.cyan : theme.colors.text.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  header: { paddingHorizontal: theme.spacing.md, paddingTop: 60, paddingBottom: theme.spacing.md },
  title: { fontSize: theme.font.sizes.xxxl, fontWeight: theme.font.weights.bold, color: theme.colors.text.primary },
  section: { marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, fontWeight: theme.font.weights.semibold, marginBottom: theme.spacing.sm, textTransform: "uppercase", letterSpacing: 1 },
  sectionContent: { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.bg.border, overflow: "hidden" },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border },
  statusInfo: { flex: 1 },
  statusLabel: { color: theme.colors.text.primary, fontWeight: theme.font.weights.medium },
  statusNote: { fontSize: theme.font.sizes.xs, marginTop: 2 },
  connectedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border },
  connectedInfo: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  connectedText: { color: theme.colors.text.primary, fontWeight: theme.font.weights.medium },
  disconnectText: { color: theme.colors.accent.red, fontSize: theme.font.sizes.sm },
  actionText: { color: theme.colors.accent.cyan, fontSize: theme.font.sizes.sm },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border },
  settingInfo: { flex: 1 },
  settingLabel: { color: theme.colors.text.primary, fontWeight: theme.font.weights.medium },
  settingDescription: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginTop: 2 },
  description: { color: theme.colors.text.secondary, fontSize: theme.font.sizes.sm, padding: theme.spacing.md, lineHeight: 20 },
  connectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent.cyan, margin: theme.spacing.md, borderRadius: theme.radius.full, padding: theme.spacing.md,
  },
  connectBtnText: { color: theme.colors.bg.primary, fontWeight: theme.font.weights.bold },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm,
    margin: theme.spacing.md, padding: theme.spacing.md,
  },
  actionBtnText: { color: theme.colors.accent.cyan, fontWeight: theme.font.weights.medium },
  guideBtn: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.bg.border },
  guideBtnText: { flex: 1, color: theme.colors.text.primary, fontSize: theme.font.sizes.sm },
  appInfo: { alignItems: "center", padding: theme.spacing.md },
  appInfoText: { color: theme.colors.text.muted, fontSize: theme.font.sizes.xs, marginBottom: 4 },
});
