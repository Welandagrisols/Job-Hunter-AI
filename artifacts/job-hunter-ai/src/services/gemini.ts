import AsyncStorage from "@react-native-async-storage/async-storage";

const GEMINI_KEY_STORAGE = "jh_gemini_api_key";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function getUserProfile(): Promise<string> {
  try {
    // 1. Check editable user profile first
    const profileData = await AsyncStorage.getItem("@jobhunter:user_profile");
    if (profileData) {
      const p = JSON.parse(profileData);
      if (p.name || p.profession) {
        return `Name: ${p.name || "Wesley Kipkemoi Koech"}
Profession: ${p.profession || "Agronomist"}
Location: ${p.location || "Nairobi, Kenya"}
Experience: ${p.yearsExperience || "5+"} years
Current Role: ${p.currentRole || "Agricultural Consultant"}
Key Skills: ${p.keySkills || "Soil fertility, fertilizer optimization, agricultural research"}
Notable Experience: ${p.notableExperience || "IFDC Sudan project"}
Target Roles: ${p.targetRoles || "Agronomist, Field Officer, Research roles in East Africa"}`;
      }
    }
  } catch {}

  try {
    // 2. Fall back to CV vault text
    const data = await AsyncStorage.getItem("@jobhunter:cv_vault");
    if (data) {
      const vault = JSON.parse(data);
      if (vault.cvText && vault.cvText.length > 50) {
        return vault.cvText;
      }
    }
  } catch {}

  // 3. Hardcoded default
  return `Name: Wesley Kipkemoi Koech
Profession: Agronomist & Soil Scientist
Location: Nairobi, Kenya
Experience: 5+ years in soil fertility management, fertilizer optimization, agricultural research, and field training
Current: Runs his own agricultural consultancy company
Skills: Soil fertility management, fertilizer optimization, agricultural research, field training, digital agricultural tools, crop management advisory
Notable: IFDC Sudan project (soil health & fertilizer programs across Sudan)
Industry: Agriculture, Agri-tech, East African agri-development, international NGOs`;
}

async function getApiKey(): Promise<string> {
  const stored = await AsyncStorage.getItem(GEMINI_KEY_STORAGE);
  return stored || "";
}

export async function saveGeminiApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(GEMINI_KEY_STORAGE, key);
}

export async function getGeminiApiKey(): Promise<string> {
  return getApiKey();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let _statusCallback: ((msg: string) => void) | null = null;
let _lastCallTime = 0;
const MIN_CALL_GAP_MS = 2000;

export function setGeminiStatusCallback(cb: ((msg: string) => void) | null) {
  _statusCallback = cb;
}

function notifyStatus(msg: string) {
  _statusCallback?.(msg);
}

async function sleepWithCountdown(totalMs: number, template: (s: number) => string) {
  const step = 1000;
  let remaining = totalMs;
  while (remaining > 0) {
    notifyStatus(template(Math.ceil(remaining / 1000)));
    await sleep(Math.min(step, remaining));
    remaining -= step;
  }
}

async function callGeminiOnce(apiKey: string, prompt: string, maxTokens: number): Promise<Response> {
  return fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
      },
    }),
  });
}

async function callGemini(prompt: string, maxTokens = 800): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Go to Settings to add your free API key.");
  }

  const now = Date.now();
  const gap = now - _lastCallTime;
  if (gap < MIN_CALL_GAP_MS) {
    const wait = MIN_CALL_GAP_MS - gap;
    await sleep(wait);
  }
  _lastCallTime = Date.now();

  const RETRY_DELAYS = [50000, 70000];

  let response = await callGeminiOnce(apiKey, prompt, maxTokens);

  if (response.status === 429) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg: string = errBody.error?.message || "";
    const isQuotaExhausted =
      errMsg.includes("free_tier") ||
      errMsg.includes("limit: 0") ||
      errMsg.toLowerCase().includes("quota exceeded");

    if (isQuotaExhausted) {
      throw new Error(
        "Your Gemini free tier quota is exhausted. Please wait a few minutes and try again, or add a paid API key in Settings for higher limits."
      );
    }

    for (const delay of RETRY_DELAYS) {
      await sleepWithCountdown(delay, (s) => `Rate limited — retrying in ${s}s...`);
      notifyStatus("Retrying...");
      _lastCallTime = Date.now();
      response = await callGeminiOnce(apiKey, prompt, maxTokens);
      if (response.status !== 429) break;
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || "";
    if (msg.includes("API_KEY_INVALID") || response.status === 400) {
      throw new Error("Invalid Gemini API key. Please update it in Settings.");
    }
    if (response.status === 429) {
      throw new Error(
        "Rate limit still active. Please wait a minute before trying again."
      );
    }
    throw new Error(msg || "Gemini API error. Check your API key in Settings.");
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
}

export const aiService = {
  async autoFillApplication(jobText: string): Promise<{
    company: string;
    role: string;
    deadline: string;
    contactEmail: string;
    location: string;
    salary: string;
    requirements: string[];
    jobDescription: string;
    notes: string;
  }> {
    const result = await callGemini(`
Extract all job application details from the text below. Return ONLY valid JSON, no markdown, no commentary.

JOB TEXT:
${jobText.slice(0, 5000)}

Return this exact JSON structure (use empty string if not found):
{
  "company": "company or organisation name",
  "role": "exact job title",
  "deadline": "application deadline date e.g. 2026-08-31 or empty string",
  "contactEmail": "email to send application to, or empty string",
  "location": "city/country or remote",
  "salary": "salary range or empty string",
  "requirements": ["key requirement 1", "key requirement 2", "key requirement 3"],
  "jobDescription": "concise 2-3 sentence summary of the role responsibilities",
  "notes": "any important notes like interview process details, benefits, or instructions"
}`, 500);

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        company: "", role: "", deadline: "", contactEmail: "",
        location: "", salary: "", requirements: [], jobDescription: "", notes: "",
      };
    }
  },

  async parseJobDetails(rawText: string): Promise<{
    company: string;
    role: string;
    deadline: string;
    contactEmail: string;
    location: string;
    salary: string;
    requirements: string[];
    responsibilities: string[];
  }> {
    const result = await callGemini(`
Extract job details from this job advertisement and return ONLY valid JSON, no markdown:

${rawText}

Return this exact JSON structure:
{
  "company": "company name or empty string",
  "role": "job title or empty string",
  "deadline": "deadline date or empty string",
  "contactEmail": "email address or empty string",
  "location": "location or empty string",
  "salary": "salary info or empty string",
  "requirements": ["requirement 1", "requirement 2"],
  "responsibilities": ["responsibility 1", "responsibility 2"]
}`, 400);

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        company: "", role: "", deadline: "",
        contactEmail: "", location: "", salary: "",
        requirements: [], responsibilities: [],
      };
    }
  },

  async generateApplicationEmail(
    jobTitle: string,
    company: string,
    jobDescription: string,
    tone: "formal" | "confident" | "friendly" = "confident"
  ): Promise<string> {
    const profile = await getUserProfile();
    const toneGuide = {
      formal: "formal and professional, traditional business language",
      confident: "confident and direct, identity-forward, no fluff",
      friendly: "warm and personable while remaining professional",
    };

    return callGemini(`
You are writing a job application email for the candidate described below.

Candidate profile:
${profile}

Job Details:
Company: ${company}
Role: ${jobTitle}
Description: ${jobDescription}

Tone: ${toneGuide[tone]}

Write a complete application email body (not subject line).
- 3-4 short paragraphs max
- Show domain expertise clearly
- End with professional sign-off
- Include [Phone] and [Email] placeholders in signature
- Do not use generic phrases like "I am writing to express my interest"
`, 400);
  },

  async generateCoverLetter(
    jobTitle: string,
    company: string,
    jobDescription: string,
    tone: "formal" | "confident" | "friendly" = "confident",
    length: "short" | "standard" | "full" = "standard"
  ): Promise<string> {
    const profile = await getUserProfile();
    const lengthGuide = {
      short: "2 paragraphs, maximum 150 words",
      standard: "3-4 paragraphs, maximum 300 words",
      full: "4-5 paragraphs, maximum 500 words, full formal letter format with date and address",
    };
    const tokenLimit = length === "short" ? 250 : length === "standard" ? 450 : 700;

    return callGemini(`
Write a cover letter for the candidate described below.

Candidate profile:
${profile}

Job Details:
Company: ${company}
Role: ${jobTitle}
Description: ${jobDescription}

Tone: ${tone}
Length: ${lengthGuide[length]}

Structure:
- Opening: specific reason this role + company excites the candidate
- Body: relevant experience proof points matching the JD
- Closing: confident call to action
`, tokenLimit);
  },

  async tailorCVPoints(jobDescription: string, cvText?: string): Promise<string> {
    const profile = cvText || await getUserProfile();

    return callGemini(`
Given this job description, generate tailored CV content.

Candidate profile / CV:
${profile}

Job Description:
${jobDescription}

Output format:
PROFESSIONAL SUMMARY:
[2-3 sentence tailored summary matching the role]

KEY ACHIEVEMENTS TO HIGHLIGHT:
• [specific achievement]
• [specific achievement]
• [specific achievement]
• [specific achievement]
• [specific achievement]

SKILLS TO EMPHASIZE:
[comma-separated list matching job requirements]

KEYWORDS MISSING FROM YOUR CV:
[keywords in the JD that should be added]
`, 600);
  },

  async scoreCVMatch(jobDescription: string, cvText: string): Promise<{
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    suggestions: string[];
  }> {
    const profileToUse = (cvText && cvText.length > 50) ? cvText : await getUserProfile();
    const result = await callGemini(`
Analyze how well this CV matches the job description. Return ONLY valid JSON, no markdown.

JOB DESCRIPTION:
${jobDescription}

CV CONTENT:
${profileToUse}

Return this exact JSON:
{
  "score": 75,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword3", "keyword4"],
  "suggestions": ["suggestion1", "suggestion2"]
}`, 300);

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return { score: 0, matchedKeywords: [], missingKeywords: [], suggestions: [] };
    }
  },

  async generateInterviewPrep(
    jobTitle: string,
    company: string,
    jobDescription: string
  ): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`
Generate interview preparation for a candidate applying for ${jobTitle} at ${company}.

Candidate profile:
${profile}

Job Description: ${jobDescription}

Format:
LIKELY QUESTIONS & SUGGESTED ANSWERS:
1. [question]
   → ANSWER: [candidate-specific answer using their real experience]

2. [question]
   → ANSWER: [answer]

3. [question]
   → ANSWER: [answer]

TECHNICAL QUESTIONS TO PREPARE FOR:
• [question]
• [question]

SMART QUESTIONS TO ASK THE INTERVIEWER:
• [question that shows domain knowledge]
• [question about the role/team]
`, 900);
  },

  async answerApplicationQuestion(
    question: string,
    company: string,
    role: string
  ): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`
Answer this job application form question for the candidate described below.

Candidate profile:
${profile}

Company: ${company}
Role: ${role}
Question: ${question}

Write a concise, specific answer (2-4 sentences) personalized to the candidate's actual experience.
Do not use generic answers.
`, 200);
  },

  async generateFollowUp(
    company: string,
    role: string,
    daysSinceApplied: number
  ): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`
Write a short follow-up email for the candidate described below.

Candidate profile:
${profile}

Company: ${company}
Role: ${role}
Days since application: ${daysSinceApplied}

Rules:
- Maximum 4 sentences
- Polite but confident
- Reference the specific role
- Ask for application status
- Professional sign-off with [Phone] and [Email] placeholders
`, 200);
  },

  async classifyEmail(subject: string, body: string, company: string): Promise<{
    classification: string;
    summary: string;
    suggestedReply: string;
    urgency: "high" | "medium" | "low";
  }> {
    const profile = await getUserProfile();
    const result = await callGemini(`
Classify this recruiter email. Return ONLY valid JSON, no markdown.

Company: ${company}
Subject: ${subject}
Body: ${body}

Candidate profile (for suggested reply context):
${profile}

Classifications:
- interview_invite: They want to schedule an interview
- offer: Job offer extended
- rejection: Application unsuccessful
- assessment: Technical test sent
- follow_up: They need more info
- other: General communication

Return this exact JSON:
{
  "classification": "interview_invite",
  "summary": "1-2 sentence plain English summary",
  "suggestedReply": "A professional reply the candidate should send",
  "urgency": "high"
}`, 350);

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        classification: "other",
        summary: "New recruiter email received.",
        suggestedReply: "Thank you for your email. I will review and respond shortly.",
        urgency: "medium",
      };
    }
  },

  async scoreJobRelevance(jobList: string): Promise<{ score: number; reason: string }[]> {
    const profile = await getUserProfile();
    const result = await callGemini(`
Score these job listings for relevance to the candidate below.

Candidate profile:
${profile}

Score each job 0-100 for relevance. Return ONLY valid JSON array, no markdown.

Jobs:
${jobList}

Return array matching job count exactly:
[{"score": 85, "reason": "Direct match for candidate's field and location"}, ...]`, 400);

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return [];
    }
  },
};
