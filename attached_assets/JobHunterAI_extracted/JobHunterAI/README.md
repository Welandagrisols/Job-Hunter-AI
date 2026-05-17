# JobHunter AI 🎯
**Your personal AI-powered job application manager**
Built for Wesley Kipkemoi Koech | Nairobi, Kenya

---

## What This App Does

- 📧 **Automatic Gmail monitoring** — detects recruiter emails 24/7
- 🔔 **Push notifications** — instant alerts for interview invites & offers
- 🤖 **AI writing** — application emails, cover letters, CV tailoring, interview prep
- 📋 **Job tracker** — track every application with status, deadlines, notes
- 💡 **Smart replies** — AI suggests how to reply to every recruiter email

---

## Quick Setup (5 Steps)

### Step 1 — Install Dependencies
```bash
cd JobHunterAI
npm install
```

### Step 2 — Get Your Anthropic API Key
1. Go to https://console.anthropic.com
2. Create an API key
3. Copy it

### Step 3 — Set Up Supabase (Free Database)
1. Go to https://supabase.com → Create free project
2. Go to SQL Editor → paste and run the SQL from `src/services/supabase.ts` (the `SUPABASE_SCHEMA` variable)
3. Go to Settings → API → copy URL and anon key

### Step 4 — Set Up Gmail API (Google Cloud)
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "JobHunterAI")
3. Enable the Gmail API:
   - APIs & Services → Enable APIs → search "Gmail API" → Enable
4. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: **Android**
   - Package name: `com.wesleykipkemoi.jobhunterai`
   - SHA-1: run `expo credentials:manager` to get your SHA-1
5. Copy the Client ID

### Step 5 — Add Your Keys to Config
Open `src/config.ts` and fill in:

```typescript
ANTHROPIC_API_KEY: "sk-ant-...",        // From Step 2
SUPABASE_URL: "https://xxx.supabase.co", // From Step 3
SUPABASE_ANON_KEY: "eyJ...",             // From Step 3
GOOGLE_CLIENT_ID: "xxx.apps.googleusercontent.com", // From Step 4
```

---

## Running the App

```bash
# Start development server
npx expo start

# Scan QR code with Expo Go app on your phone
# OR press 'a' for Android emulator
```

## Building the APK

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build APK (free preview build)
eas build --platform android --profile preview
```

---

## App Structure

```
JobHunterAI/
├── App.tsx                    # Entry point
├── src/
│   ├── config.ts              # ⚠️ YOUR API KEYS GO HERE
│   ├── theme.ts               # Colors, fonts, spacing
│   ├── navigation/
│   │   └── index.tsx          # Tab + Stack navigation
│   ├── screens/
│   │   ├── DashboardScreen.tsx      # Home/overview
│   │   ├── ApplicationsScreen.tsx   # Job tracker list
│   │   ├── AddApplicationScreen.tsx # Add/edit application
│   │   ├── AIWriterScreen.tsx       # AI writing tools
│   │   ├── AlertsScreen.tsx         # Email alerts
│   │   └── SettingsScreen.tsx       # Gmail setup & settings
│   └── services/
│       ├── claude.ts          # Claude AI (all writing)
│       ├── gmail.ts           # Gmail OAuth + monitoring
│       ├── supabase.ts        # Database (jobs + alerts)
│       ├── notifications.ts   # Push notifications
│       └── background.ts      # Background email checking
```

---

## How Email Monitoring Works

1. You connect Gmail via OAuth (Settings screen) — **no password needed**
2. App registers a background task that runs every ~15 minutes
3. Each check: fetches recent Gmail messages, filters for recruiter-related keywords
4. New emails: Claude AI classifies them (interview? offer? rejection?) and suggests a reply
5. Push notification sent instantly to your phone
6. Alert stored in Supabase so you never lose it

**Keywords monitored:** application, interview, shortlisted, candidate, recruitment, offer, unfortunately, regret, pleased, congratulations, schedule, next steps + sender patterns (hr@, recruit@, talent@, careers@)

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Gmail OAuth fails | Make sure GOOGLE_CLIENT_ID is correct and Gmail API is enabled |
| AI not working | Check ANTHROPIC_API_KEY in config.ts |
| Database errors | Run the SQL schema in Supabase SQL editor |
| Background check not working | Android may restrict background tasks — check battery optimization settings |

---

## Tech Stack
- **Expo React Native** (cross-platform)
- **Claude Sonnet 4** (AI writing)
- **Gmail API** (email monitoring)
- **Supabase** (PostgreSQL database)
- **Expo Notifications** (push alerts)
- **Expo Background Fetch** (background monitoring)
- **Expo Auth Session** (OAuth)
- **Expo Secure Store** (token storage)
