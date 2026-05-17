import AsyncStorage from "@react-native-async-storage/async-storage";
import { JobApplication, EmailAlert } from "../types";

const APPS_KEY = "@jobhunter:applications";
const ALERTS_KEY = "@jobhunter:alerts";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export const db = {
  async getApplications(): Promise<JobApplication[]> {
    const raw = await AsyncStorage.getItem(APPS_KEY);
    const apps: JobApplication[] = raw ? JSON.parse(raw) : [];
    return apps.sort(
      (a, b) => new Date(b.date_applied).getTime() - new Date(a.date_applied).getTime()
    );
  },

  async addApplication(app: Omit<JobApplication, "id" | "created_at" | "updated_at">): Promise<JobApplication> {
    const apps = await this.getApplications();
    const now = new Date().toISOString();
    const newApp: JobApplication = {
      ...app,
      id: generateId(),
      date_applied: app.date_applied || now,
      created_at: now,
      updated_at: now,
    };
    apps.unshift(newApp);
    await AsyncStorage.setItem(APPS_KEY, JSON.stringify(apps));
    return newApp;
  },

  async updateApplication(id: string, updates: Partial<JobApplication>): Promise<JobApplication> {
    const apps = await this.getApplications();
    const idx = apps.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Application not found");
    apps[idx] = { ...apps[idx], ...updates, updated_at: new Date().toISOString() };
    await AsyncStorage.setItem(APPS_KEY, JSON.stringify(apps));
    return apps[idx];
  },

  async getApplicationById(id: string): Promise<JobApplication | null> {
    const apps = await this.getApplications();
    return apps.find((a) => a.id === id) ?? null;
  },

  async deleteApplication(id: string): Promise<void> {
    const apps = await this.getApplications();
    await AsyncStorage.setItem(APPS_KEY, JSON.stringify(apps.filter((a) => a.id !== id)));
  },

  async getAlerts(unreadOnly = false): Promise<EmailAlert[]> {
    const raw = await AsyncStorage.getItem(ALERTS_KEY);
    const alerts: EmailAlert[] = raw ? JSON.parse(raw) : [];
    const sorted = alerts.sort(
      (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
    return unreadOnly ? sorted.filter((a) => !a.is_read) : sorted;
  },

  async saveAlert(alert: Omit<EmailAlert, "id"> & { id?: string }): Promise<EmailAlert> {
    const alerts = await this.getAlerts();
    const existing = alerts.findIndex((a) => a.gmail_message_id === alert.gmail_message_id);
    const now = new Date().toISOString();
    if (existing >= 0) {
      alerts[existing] = { ...alerts[existing], ...alert };
      await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
      return alerts[existing];
    }
    const newAlert: EmailAlert = { ...alert, id: generateId() } as EmailAlert;
    alerts.unshift(newAlert);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    return newAlert;
  },

  async markAlertRead(id: string): Promise<void> {
    const alerts = await this.getAlerts();
    const idx = alerts.findIndex((a) => a.id === id);
    if (idx >= 0) {
      alerts[idx].is_read = true;
      await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    }
  },
};
