export const CONFIG = {
  GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",

  RECRUITER_KEYWORDS: [
    "application",
    "interview",
    "position",
    "vacancy",
    "shortlisted",
    "candidate",
    "recruitment",
    "offer",
    "unfortunately",
    "regret",
    "pleased",
    "congratulations",
    "schedule",
    "next steps",
  ],
};

export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "http://localhost:5000";
}
