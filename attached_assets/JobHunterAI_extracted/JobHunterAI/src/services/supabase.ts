import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../config";

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ============================================
// RUN THIS SQL IN YOUR SUPABASE SQL EDITOR
// ============================================
export const SUPABASE_SCHEMA = `
-- Job Applications Table
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  date_applied TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deadline DATE,
  status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'interview', 'offer', 'rejected', 'withdrawn', 'waiting')),
  contact_email TEXT,
  job_url TEXT,
  notes TEXT,
  cv_version TEXT,
  cover_letter TEXT,
  application_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Alerts Table
CREATE TABLE IF NOT EXISTS email_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT UNIQUE,
  application_id UUID REFERENCES job_applications(id),
  from_email TEXT,
  subject TEXT,
  snippet TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  classification TEXT CHECK (classification IN ('interview_invite', 'rejection', 'offer', 'follow_up', 'assessment', 'other')),
  is_read BOOLEAN DEFAULT false,
  ai_summary TEXT,
  suggested_reply TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_alerts ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since this is single-user personal app)
CREATE POLICY "Allow all" ON job_applications FOR ALL USING (true);
CREATE POLICY "Allow all" ON email_alerts FOR ALL USING (true);
`;

// Database helpers
export const db = {
  // Job Applications
  async getApplications() {
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("date_applied", { ascending: false });
    if (error) throw error;
    return data;
  },

  async addApplication(app: Partial<JobApplication>) {
    const { data, error } = await supabase
      .from("job_applications")
      .insert(app)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateApplication(id: string, updates: Partial<JobApplication>) {
    const { data, error } = await supabase
      .from("job_applications")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteApplication(id: string) {
    const { error } = await supabase
      .from("job_applications")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // Email Alerts
  async getAlerts(unreadOnly = false) {
    let query = supabase
      .from("email_alerts")
      .select("*, job_applications(company, role)")
      .order("received_at", { ascending: false });
    if (unreadOnly) query = query.eq("is_read", false);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async saveAlert(alert: Partial<EmailAlert>) {
    const { data, error } = await supabase
      .from("email_alerts")
      .upsert(alert, { onConflict: "gmail_message_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markAlertRead(id: string) {
    const { error } = await supabase
      .from("email_alerts")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw error;
  },
};

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  date_applied: string;
  deadline?: string;
  status: "applied" | "interview" | "offer" | "rejected" | "withdrawn" | "waiting";
  contact_email?: string;
  job_url?: string;
  notes?: string;
  cv_version?: string;
  cover_letter?: string;
  application_email?: string;
  created_at: string;
  updated_at: string;
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
