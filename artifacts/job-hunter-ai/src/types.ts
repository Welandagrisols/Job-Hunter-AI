export type { JobApplication, EmailAlert } from "./services/storage";

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
