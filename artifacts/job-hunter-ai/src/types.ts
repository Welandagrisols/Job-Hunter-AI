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

export const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  waiting: "Waiting",
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  interview_invite: "Interview Invite",
  offer: "Job Offer",
  rejection: "Rejection",
  assessment: "Assessment",
  follow_up: "Follow Up",
  other: "Recruiter Email",
};
