import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================
// LOCAL STORAGE SERVICE (No Supabase needed!)
// All data stored on device
// ============================================

const KEYS = {
  APPLICATIONS: "jh_applications",
  ALERTS: "jh_alerts",
  CV_VAULT: "jh_cv_vault",
  STATS: "jh_stats",
};

// Helpers
async function getAll<T>(key: string): Promise<T[]> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function saveAll<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ============================================
// JOB APPLICATIONS
// ============================================
export const db = {
  async getApplications(): Promise<JobApplication[]> {
    const apps = await getAll<JobApplication>(KEYS.APPLICATIONS);
    return apps.sort((a, b) =>
      new Date(b.date_applied).getTime() - new Date(a.date_applied).getTime()
    );
  },

  async addApplication(app: Partial<JobApplication>): Promise<JobApplication> {
    const apps = await getAll<JobApplication>(KEYS.APPLICATIONS);
    const newApp: JobApplication = {
      id: generateId(),
      company: app.company || "",
      role: app.role || "",
      date_applied: new Date().toISOString(),
      status: app.status || "applied",
      deadline: app.deadline,
      contact_email: app.contact_email,
      job_url: app.job_url,
      notes: app.notes,
      cover_letter: app.cover_letter,
      application_email: app.application_email,
      location: app.location,
      salary: app.salary,
      requirements: app.requirements || [],
      timeline: [{ date: new Date().toISOString(), event: "Application created", type: "created" }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    apps.push(newApp);
    await saveAll(KEYS.APPLICATIONS, apps);
    return newApp;
  },

  async updateApplication(id: string, updates: Partial<JobApplication>): Promise<JobApplication> {
    const apps = await getAll<JobApplication>(KEYS.APPLICATIONS);
    const idx = apps.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Application not found");

    // Add timeline event if status changed
    if (updates.status && updates.status !== apps[idx].status) {
      const timeline = apps[idx].timeline || [];
      timeline.push({
        date: new Date().toISOString(),
        event: `Status changed to ${updates.status}`,
        type: updates.status,
      });
      updates.timeline = timeline;
    }

    apps[idx] = { ...apps[idx], ...updates, updated_at: new Date().toISOString() };
    await saveAll(KEYS.APPLICATIONS, apps);
    return apps[idx];
  },

  async addTimelineEvent(id: string, event: string, type: string): Promise<void> {
    const apps = await getAll<JobApplication>(KEYS.APPLICATIONS);
    const idx = apps.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const timeline = apps[idx].timeline || [];
    timeline.push({ date: new Date().toISOString(), event, type });
    apps[idx].timeline = timeline;
    apps[idx].updated_at = new Date().toISOString();
    await saveAll(KEYS.APPLICATIONS, apps);
  },

  async deleteApplication(id: string): Promise<void> {
    const apps = await getAll<JobApplication>(KEYS.APPLICATIONS);
    await saveAll(KEYS.APPLICATIONS, apps.filter((a) => a.id !== id));
  },

  // ============================================
  // EMAIL ALERTS
  // ============================================
  async getAlerts(unreadOnly = false): Promise<EmailAlert[]> {
    const alerts = await getAll<EmailAlert>(KEYS.ALERTS);
    const sorted = alerts.sort((a, b) =>
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
    return unreadOnly ? sorted.filter((a) => !a.is_read) : sorted;
  },

  async saveAlert(alert: Partial<EmailAlert>): Promise<EmailAlert> {
    const alerts = await getAll<EmailAlert>(KEYS.ALERTS);
    const existing = alerts.findIndex((a) => a.gmail_message_id === alert.gmail_message_id);
    if (existing >= 0) return alerts[existing];

    const newAlert: EmailAlert = {
      id: generateId(),
      gmail_message_id: alert.gmail_message_id || generateId(),
      from_email: alert.from_email || "",
      subject: alert.subject || "",
      snippet: alert.snippet || "",
      received_at: alert.received_at || new Date().toISOString(),
      classification: alert.classification || "other",
      is_read: false,
      ai_summary: alert.ai_summary,
      suggested_reply: alert.suggested_reply,
    };
    alerts.push(newAlert);
    await saveAll(KEYS.ALERTS, alerts);
    return newAlert;
  },

  async markAlertRead(id: string): Promise<void> {
    const alerts = await getAll<EmailAlert>(KEYS.ALERTS);
    const idx = alerts.findIndex((a) => a.id === id);
    if (idx >= 0) {
      alerts[idx].is_read = true;
      await saveAll(KEYS.ALERTS, alerts);
    }
  },

  // ============================================
  // CV VAULT
  // ============================================
  async getCVVault(): Promise<CVVault> {
    try {
      const data = await AsyncStorage.getItem(KEYS.CV_VAULT);
      return data ? JSON.parse(data) : { cvText: "", lastUpdated: null, versions: [] };
    } catch {
      return { cvText: "", lastUpdated: null, versions: [] };
    }
  },

  async saveCVVault(cvText: string, label?: string): Promise<void> {
    const vault = await this.getCVVault();
    const versions = vault.versions || [];

    // Save current as version before overwriting
    if (vault.cvText) {
      versions.unshift({
        id: generateId(),
        label: vault.label || `Version ${versions.length + 1}`,
        cvText: vault.cvText,
        savedAt: vault.lastUpdated || new Date().toISOString(),
      });
      // Keep only last 5 versions
      versions.splice(5);
    }

    await AsyncStorage.setItem(KEYS.CV_VAULT, JSON.stringify({
      cvText,
      label: label || "My CV",
      lastUpdated: new Date().toISOString(),
      versions,
    }));
  },

  // ============================================
  // STATISTICS
  // ============================================
  async getStats(): Promise<AppStats> {
    const apps = await this.getApplications();
    const now = new Date();

    // Applications per day (last 14 days)
    const dailyCounts: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyCounts[key] = 0;
    }
    apps.forEach((a) => {
      const key = new Date(a.date_applied).toISOString().split("T")[0];
      if (dailyCounts[key] !== undefined) dailyCounts[key]++;
    });

    const total = apps.length;
    const interviews = apps.filter((a) => a.status === "interview").length;
    const offers = apps.filter((a) => a.status === "offer").length;
    const rejected = apps.filter((a) => a.status === "rejected").length;
    const waiting = apps.filter((a) => a.status === "applied" || a.status === "waiting").length;

    const responseRate = total > 0 ? Math.round(((interviews + offers + rejected) / total) * 100) : 0;
    const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;
    const offerRate = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;

    // This week count
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = apps.filter((a) => new Date(a.date_applied) >= weekAgo).length;

    return {
      total, interviews, offers, rejected, waiting,
      responseRate, interviewRate, offerRate, thisWeek,
      dailyCounts,
      statusBreakdown: { applied: waiting, interview: interviews, offer: offers, rejected },
    };
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.APPLICATIONS, KEYS.ALERTS, KEYS.CV_VAULT]);
  },
};

// ============================================
// TYPES
// ============================================
export interface JobApplication {
  id: string;
  company: string;
  role: string;
  date_applied: string;
  status: "applied" | "interview" | "offer" | "rejected" | "withdrawn" | "waiting";
  deadline?: string;
  contact_email?: string;
  job_url?: string;
  notes?: string;
  cover_letter?: string;
  application_email?: string;
  location?: string;
  salary?: string;
  requirements?: string[];
  timeline?: TimelineEvent[];
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  date: string;
  event: string;
  type: string;
}

export interface EmailAlert {
  id: string;
  gmail_message_id: string;
  application_id?: string;
  from_email: string;
  subject: string;
  snippet: string;
  received_at: string;
  classification: "interview_invite" | "rejection" | "offer" | "follow_up" | "assessment" | "other";
  is_read: boolean;
  ai_summary?: string;
  suggested_reply?: string;
}

export interface CVVault {
  cvText: string;
  label?: string;
  lastUpdated: string | null;
  versions: CVVersion[];
}

export interface CVVersion {
  id: string;
  label: string;
  cvText: string;
  savedAt: string;
}

export interface AppStats {
  total: number;
  interviews: number;
  offers: number;
  rejected: number;
  waiting: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  thisWeek: number;
  dailyCounts: Record<string, number>;
  statusBreakdown: Record<string, number>;
}
