// ============================================
// FILL IN YOUR API KEYS HERE BEFORE RUNNING
// ============================================

export const CONFIG = {
  // FREE - Get from: https://aistudio.google.com
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",

  // OPTIONAL - Get from: https://console.anthropic.com
  ANTHROPIC_API_KEY: "YOUR_ANTHROPIC_API_KEY",

  // Get from: https://supabase.com (free tier works)
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",

  // Get from: https://console.cloud.google.com
  // Enable Gmail API → Create OAuth 2.0 credentials → Android app
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",

  // How often to check Gmail (in minutes)
  EMAIL_CHECK_INTERVAL: 5,

  // Keywords to detect recruiter emails
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
