import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_PROFILE = `
Name: Wesley Kipkemoi Koech
Profession: Agronomist & Soil Scientist
Location: Nairobi, Kenya
Experience: 5+ years in soil fertility management, fertilizer optimization, agricultural research, and field training
Current: Runs his own agricultural consultancy company
Skills: Soil fertility management & analysis, Fertilizer optimization & recommendations, Agricultural research & data analysis, Field training & farmer extension, Digital agricultural tools, Agrovet management systems, Crop management advisory
Industry: Agriculture, Agri-tech, East African agri-development
`;

async function getUserProfile(): Promise<string> {
  try {
    const data = await AsyncStorage.getItem("@jobhunter:cv_vault");
    if (data) {
      const vault = JSON.parse(data);
      if (vault.cvText && vault.cvText.length > 50) return vault.cvText;
    }
    const profileData = await AsyncStorage.getItem("@jobhunter:user_profile");
    if (profileData) {
      const p = JSON.parse(profileData);
      if (p.name || p.profession) {
        return `Name: ${p.name || "Wesley Kipkemoi Koech"}
Profession: ${p.profession || "Agronomist & Soil Scientist"}
Location: ${p.location || "Nairobi, Kenya"}
Experience: ${p.yearsExperience || "5+"} years
Key Skills: ${p.keySkills || "Soil fertility, fertilizer optimization, agricultural research"}
Target Roles: ${p.targetRoles || "Agronomist, Field Officer, Research roles in East Africa"}`;
      }
    }
  } catch {}
  return DEFAULT_PROFILE;
}

async function callGemini(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = await AsyncStorage.getItem("jh_gemini_api_key").catch(() => null);
  if (!apiKey) {
    throw new Error("Gemini API key not set. Go to More → Settings → API Keys to add your Gemini key.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || "Gemini API error";
    if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
      throw new Error("Invalid Gemini API key. Please check Settings → API Keys.");
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content returned. Please try again.");
  return text;
}

export const aiService = {
  async generateApplicationEmail(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`You are a professional job application writer for the following candidate:

${profile}

Write a job application email for:
Company: ${company}
Job Title: ${jobTitle}
Job Description: ${jobDescription}

Instructions: Write a direct, confident email (3-4 short paragraphs). End with a professional sign-off. Include placeholder [Phone] and [Email] in the signature. Write only the email body — no subject line.`);
  },

  async generateCoverLetter(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`You are a professional cover letter writer for the following candidate:

${profile}

Write a cover letter for:
Company: ${company}
Role: ${jobTitle}
Job Description: ${jobDescription}

Instructions: One page max (4 paragraphs), formal letter format with date and address headers. Tailored, compelling, and specific to this role. Sound confident and genuine.`, 1500);
  },

  async tailorCVPoints(jobDescription: string): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`You are a CV optimization expert. Given the following candidate profile and job description, generate tailored CV content.

Candidate profile:
${profile}

Job Description:
${jobDescription}

Output exactly in this format:
PROFESSIONAL SUMMARY:
[2-3 sentence tailored summary]

KEY ACHIEVEMENTS TO HIGHLIGHT:
• [bullet]
• [bullet]
• [bullet]

SKILLS TO EMPHASIZE:
[comma-separated list relevant to this role]`);
  },

  async generateInterviewPrep(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`You are an interview coach preparing the following candidate:

${profile}

Prepare for:
Company: ${company}
Role: ${jobTitle}
Job Description: ${jobDescription}

Format your response exactly like this:
LIKELY QUESTIONS:
1. [question] → SUGGESTED ANSWER: [brief tailored answer]
2. [question] → SUGGESTED ANSWER: [brief tailored answer]
3. [question] → SUGGESTED ANSWER: [brief tailored answer]
4. [question] → SUGGESTED ANSWER: [brief tailored answer]
5. [question] → SUGGESTED ANSWER: [brief tailored answer]

TECHNICAL QUESTIONS TO PREPARE FOR:
• [question]
• [question]
• [question]

QUESTIONS TO ASK THE INTERVIEWER:
• [smart question]
• [smart question]
• [smart question]`, 2000);
  },

  async generateFollowUp(company: string, role: string, daysSinceApplied: number): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`You are a professional email writer for the following candidate:

${profile}

Write a follow-up email:
Company: ${company}
Role: ${role}
Days since application: ${daysSinceApplied}

Instructions: Short (3-4 sentences), polite but confident. Reference the specific role. Reaffirm interest. Ask for a status update. Write only the email body.`);
  },

  async analyzeKeywords(jobDescription: string): Promise<{
    score: number;
    total: number;
    percentage: number;
    matched: string[];
    missing: string[];
    recommendation: string;
  }> {
    const profile = await getUserProfile();
    const result = await callGemini(`You are a resume keyword matcher. Compare the candidate profile against the job description and return ONLY valid JSON with no markdown, no explanation, no code fences.

Candidate profile:
${profile}

Job Description:
${jobDescription}

Extract the 10-15 most important keywords/skills from the job description, check which ones the candidate has.

Return this JSON and nothing else:
{
  "matched": ["keyword1", "keyword2"],
  "missing": ["keyword3", "keyword4"],
  "recommendation": "2-3 sentence advice on how to strengthen the application"
}`, 800);

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const total = (parsed.matched?.length || 0) + (parsed.missing?.length || 0);
      const score = parsed.matched?.length || 0;
      return {
        score,
        total,
        percentage: total > 0 ? Math.round((score / total) * 100) : 0,
        matched: parsed.matched || [],
        missing: parsed.missing || [],
        recommendation: parsed.recommendation || "",
      };
    } catch {
      throw new Error("Could not parse keyword analysis. Please try again.");
    }
  },

  async answerApplicationQuestion(question: string, company: string, role: string): Promise<string> {
    const profile = await getUserProfile();
    return callGemini(`You are an expert job application coach for the following candidate:

${profile}

Answer this application question for a ${role} role at ${company}:

"${question}"

Instructions: Answer in first person as the candidate. Be specific, reference their real experience. Keep the answer 150-250 words unless the question demands more. Sound confident and natural. Write the answer directly — no preamble or question restated.`);
  },

  async classifyEmail(subject: string, body: string, company: string): Promise<{
    classification: string;
    summary: string;
    suggestedReply: string;
    urgency: "high" | "medium" | "low";
  }> {
    const result = await callGemini(`You are an email classifier for job applications. Analyze the recruiter email and return ONLY valid JSON with no markdown, no code fences, no explanation.

Classifications:
- interview_invite: They want to schedule an interview
- offer: Job offer extended
- rejection: Application unsuccessful
- assessment: Technical test or assignment sent
- follow_up: They need more info
- other: General communication

Email from ${company}:
Subject: ${subject}
Body: ${body}

Return this JSON and nothing else:
{
  "classification": "interview_invite|offer|rejection|assessment|follow_up|other",
  "summary": "1-2 sentence plain English summary",
  "suggestedReply": "A professional reply the candidate should send",
  "urgency": "high|medium|low"
}`, 600);

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        classification: "other",
        summary: result.slice(0, 200),
        suggestedReply: "Thank you for your email. I will review and respond shortly.",
        urgency: "medium",
      };
    }
  },
};
