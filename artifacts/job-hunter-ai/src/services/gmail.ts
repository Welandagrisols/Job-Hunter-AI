import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";
import { CONFIG } from "../config";
import { aiService } from "./claude";
import { db } from "./storage";
import { EmailAlert } from "../types";

WebBrowser.maybeCompleteAuthSession();

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];
const STORE_KEY = "gmail_tokens";

export const gmailService = {
  async signIn(): Promise<boolean> {
    try {
      if (!CONFIG.GOOGLE_CLIENT_ID) return false;

      const redirectUri = AuthSession.makeRedirectUri({ scheme: "jobhunterai" });
      Alert.alert("Debug — copy this URI", redirectUri);
      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
      };

      const request = new AuthSession.AuthRequest({
        clientId: CONFIG.GOOGLE_CLIENT_ID,
        scopes: GMAIL_SCOPES,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: { prompt: "select_account" },
      });

      const result = await request.promptAsync(discovery);
      if (result.type === "success" && result.params.code) {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: result.params.code,
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code_verifier: request.codeVerifier || "",
          }).toString(),
        });
        const tokens = await tokenResponse.json();
        if (tokens.access_token) {
          await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(tokens));
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  },

  async getTokens(): Promise<{ access_token: string; refresh_token?: string } | null> {
    try {
      const stored = await SecureStore.getItemAsync(STORE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  async isSignedIn(): Promise<boolean> {
    const tokens = await this.getTokens();
    return !!tokens?.access_token;
  },

  async signOut(): Promise<void> {
    await SecureStore.deleteItemAsync(STORE_KEY);
  },

  async refreshToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    if (!tokens?.refresh_token) return null;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: tokens.refresh_token,
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        grant_type: "refresh_token",
      }).toString(),
    });
    const newTokens = await response.json();
    if (newTokens.access_token) {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ ...tokens, ...newTokens }));
      return newTokens.access_token;
    }
    return null;
  },

  async checkForNewEmails(): Promise<number> {
    try {
      const tokens = await this.getTokens();
      if (!tokens) return 0;

      const query = CONFIG.RECRUITER_KEYWORDS.slice(0, 5).join(" OR ");
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`;

      let resp = await fetch(listUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (resp.status === 401) {
        const newToken = await this.refreshToken();
        if (!newToken) return 0;
        resp = await fetch(listUrl, { headers: { Authorization: `Bearer ${newToken}` } });
      }

      const data = await resp.json();
      if (!data.messages) return 0;

      const currentToken = (await this.getTokens())?.access_token || "";
      let newCount = 0;
      const existingAlerts = await db.getAlerts(false);

      for (const msg of data.messages.slice(0, 10)) {
        if (existingAlerts.some((a) => a.gmail_message_id === msg.id)) continue;

        const detail = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${currentToken}` } }
        ).then((r) => r.json()).catch(() => null);

        if (!detail) continue;

        const headers = detail.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        const subject = getHeader("Subject");
        const from = getHeader("From");
        const date = getHeader("Date");

        let body = "";
        const parts = detail.payload?.parts || [detail.payload];
        for (const part of parts) {
          if (part?.mimeType === "text/plain" && part?.body?.data) {
            body = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
            break;
          }
        }
        if (!body) body = detail.snippet || "";

        const isRecruiter = CONFIG.RECRUITER_KEYWORDS.some(
          (kw) =>
            subject.toLowerCase().includes(kw) ||
            body.toLowerCase().includes(kw) ||
            from.toLowerCase().includes("recruit") ||
            from.toLowerCase().includes("hr") ||
            from.toLowerCase().includes("talent") ||
            from.toLowerCase().includes("careers")
        );
        if (!isRecruiter) continue;

        const aiResult = await aiService.classifyEmail(subject, body.slice(0, 2000), from);
        await db.saveAlert({
          gmail_message_id: msg.id,
          from_email: from,
          subject,
          snippet: detail.snippet || "",
          received_at: new Date(date).toISOString(),
          classification: aiResult.classification as EmailAlert["classification"],
          is_read: false,
          ai_summary: aiResult.summary,
          suggested_reply: aiResult.suggestedReply,
        });
        newCount++;
      }
      return newCount;
    } catch {
      return 0;
    }
  },
};
