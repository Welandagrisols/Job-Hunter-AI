# JobHunter AI

An AI-powered job application management platform. Helps users capture job postings, track applications, generate tailored CVs and cover letters, and analyse recruiter emails.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 3000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — provisioned automatically by Replit PostgreSQL

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- API: Express 5 (port 3000)
- Mobile: Expo SDK 54 / React Native + Expo Router
- DB: PostgreSQL + Drizzle ORM
- AI (server): Anthropic Claude via Replit AI Integrations (`AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`)
- AI (client): Google Gemini — user supplies their own key in the app's Settings screen
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/job-hunter-ai/src/services/gemini.ts` — client-side Gemini AI service
- `artifacts/job-hunter-ai/app/` — Expo Router screens (tabs + pages)
- `lib/db/src/schema/` — Drizzle table definitions
- `lib/api-spec/` — OpenAPI spec (source of truth for codegen)

## Architecture decisions

- AI calls from mobile client go through the Express API server (Anthropic). Gemini is called directly from the client using the user's own API key stored in AsyncStorage.
- The app has no login/auth flow — it is a personal single-user tool.
- Supabase SDK is listed as a dependency but is not used in the codebase.

## Product

- **Job Capture**: parse job details from text or URLs using AI
- **AI Writer**: generate cover letters, application emails, and interview prep
- **CV Vault**: store and tailor CVs to specific job descriptions
- **Email Intelligence**: classify recruiter emails (interviews, offers, rejections)
- **Kanban Tracker**: track application status across a visual board

## User preferences

- Personal tool built for Wesley Kipkemoi Koech (Agronomist, Nairobi, Kenya)

## Gotchas

- API server must be running for the `/api/claude` and `/api/parse-job` mobile features to work
- Gemini features require the user to add their own free API key in the app Settings screen
- Port 3000 is used for the API server (set via `PORT` env var)
