import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { CONFIG } from "../config";
import { aiService } from "./claude";
import { db } from "./supabase";
import { notificationService } from "./notifications";

WebBrowser.maybeCompleteAuthSession();

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const STORE_KEY = "gmail_tokens";

export const gmailService = {
  // Sign in with Google OAuth
  async signIn(): Promise<boolean> {
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: "jobhunterai" });

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
      });

      const result = await request.promptAsync(discovery);

      if (result.type === "success" && result.params.code) {
        // Exchange code for tokens
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
    } catch (error) {
      console.error("Gmail sign in error:", error);
      return false;
    }
  },

  // Get stored tokens
  async getTokens(): Promise<{ access_token: string; refresh_token?: string } | null> {
    try {
      const stored = await SecureStore.getItemAsync(STORE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  // Check if signed in
  async isSignedIn(): Promise<boolean> {
    const tokens = await this.getTokens();
    return !!tokens?.access_token;
  },

  // Sign out
  async signOut(): Promise<void> {
    await SecureStore.deleteItemAsync(STORE_KEY);
  },

  // Refresh access token if expired
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
      const updated = { ...tokens, access_token: newTokens.access_token };
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(updated));
      return newTokens.access_token;
    }
    return null;
  },

  // Fetch emails from Gmail
  async fetchRecentEmails(maxResults = 20): Promise<any[]> {
    const tokens = await this.getTokens();
    if (!tokens) throw new Error("Not signed in to Gmail");

    // Build query to find recruiter-related emails
    const query = CONFIG.RECRUITER_KEYWORDS
      .slice(0, 5)
      .map((k) => k)
      .join(" OR ");

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;

    let response = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    // Try refreshing token if 401
    if (response.status === 401) {
      const newToken = await this.refreshToken();
      if (!newToken) throw new Error("Token refresh failed. Please sign in again.");
      response = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
    }

    const data = await response.json();
    if (!data.messages) return [];

    // Fetch details for each message
    const messages = await Promise.all(
      data.messages.slice(0, 10).map((msg: { id: string }) =>
        this.fetchEmailDetail(msg.id, tokens.access_token)
      )
    );

    return messages.filter(Boolean);
  },

  // Get full email detail
  async fetchEmailDetail(messageId: string, accessToken: string): Promise<any> {
    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return await response.json();
    } catch {
      return null;
    }
  },

  // Parse Gmail message into readable format
  parseEmail(message: any): ParsedEmail | null {
    try {
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      const subject = getHeader("Subject");
      const from = getHeader("From");
      const date = getHeader("Date");

      // Extract body
      let body = "";
      const parts = message.payload?.parts || [message.payload];
      for (const part of parts) {
        if (part?.mimeType === "text/plain" && part?.body?.data) {
          body = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          break;
        }
      }

      // Use snippet if no body
      if (!body) body = message.snippet || "";

      // Check if recruiter-related
      const isRecruiter = CONFIG.RECRUITER_KEYWORDS.some(
        (kw) =>
          subject.toLowerCase().includes(kw) ||
          body.toLowerCase().includes(kw) ||
          from.toLowerCase().includes("recruit") ||
          from.toLowerCase().includes("hr") ||
          from.toLowerCase().includes("talent") ||
          from.toLowerCase().includes("careers")
      );

      if (!isRecruiter) return null;

      return {
        id: message.id,
        subject,
        from,
        date: new Date(date).toISOString(),
        body: body.slice(0, 2000), // Limit for AI processing
        snippet: message.snippet,
      };
    } catch {
      return null;
    }
  },

  // Main monitoring function - call this on interval
  async checkForNewEmails(): Promise<number> {
    try {
      const rawEmails = await this.fetchRecentEmails(20);
      let newCount = 0;

      for (const raw of rawEmails) {
        const parsed = this.parseEmail(raw);
        if (!parsed) continue;

        // Check if already processed
        const existing = await db.getAlerts(false);
        const alreadyExists = existing?.some((a) => a.gmail_message_id === parsed.id);
        if (alreadyExists) continue;

        // Use AI to classify
        const aiResult = await aiService.classifyEmail(
          parsed.subject,
          parsed.body,
          parsed.from
        );

        // Save to database
        await db.saveAlert({
          gmail_message_id: parsed.id,
          from_email: parsed.from,
          subject: parsed.subject,
          snippet: parsed.snippet,
          received_at: parsed.date,
          classification: aiResult.classification as any,
          is_read: false,
          ai_summary: aiResult.summary,
          suggested_reply: aiResult.suggestedReply,
        });

        // Send push notification
        await notificationService.sendEmailAlert(
          parsed.from,
          parsed.subject,
          aiResult.classification,
          aiResult.urgency
        );

        newCount++;
      }

      return newCount;
    } catch (error) {
      console.error("Email check error:", error);
      return 0;
    }
  },
};

export interface ParsedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  snippet: string;
}
