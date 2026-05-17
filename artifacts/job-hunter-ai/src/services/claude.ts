import { getApiBase } from "../config";

const WESLEY_PROFILE = `
Name: Wesley Kipkemoi Koech
Profession: Agronomist & Soil Scientist
Location: Nairobi, Kenya
Experience: 5+ years in soil fertility management, fertilizer optimization, agricultural research, and field training
Current: Runs his own agricultural consultancy company
Skills: Soil fertility management & analysis, Fertilizer optimization & recommendations, Agricultural research & data analysis, Field training & farmer extension, Digital agricultural tools, Agrovet management systems, Crop management advisory
Industry: Agriculture, Agri-tech, East African agri-development
`;

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch(`${getApiBase()}/api/claude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "AI service error. Check your Anthropic API key in settings.");
  }

  const data = await response.json();
  return data.content[0].text;
}

export const aiService = {
  async generateApplicationEmail(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    return callClaude(
      `You are a professional job application writer. Write concise, confident emails for Wesley Kipkemoi Koech, an agronomist based in Nairobi, Kenya.\n\nWesley's profile:\n${WESLEY_PROFILE}\n\nWrite emails that are direct and confident (3-4 short paragraphs). End with a professional sign-off. Include placeholder [Phone] and [Email] in signature.`,
      `Write a job application email:\nCompany: ${company}\nJob Title: ${jobTitle}\nJob Description: ${jobDescription}\n\nWrite the full email body (not subject line).`
    );
  },

  async generateCoverLetter(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    return callClaude(
      `You are a professional cover letter writer. Write compelling, tailored cover letters for Wesley Kipkemoi Koech.\n\nWesley's profile:\n${WESLEY_PROFILE}\n\nCover letters: one page max (4 paragraphs), formal letter format with date and address headers.`,
      `Write a cover letter for:\nCompany: ${company}\nRole: ${jobTitle}\nJob Description: ${jobDescription}`
    );
  },

  async tailorCVPoints(jobDescription: string): Promise<string> {
    return callClaude(
      `You are a CV optimization expert. Given a job description, generate tailored CV bullet points for Wesley Kipkemoi Koech.\n\nWesley's profile:\n${WESLEY_PROFILE}\n\nOutput format:\nPROFESSIONAL SUMMARY:\n[2-3 sentence tailored summary]\n\nKEY ACHIEVEMENTS TO HIGHLIGHT:\n• [bullet]\n\nSKILLS TO EMPHASIZE:\n[comma-separated list]`,
      `Tailor Wesley's CV for this job description:\n${jobDescription}`
    );
  },

  async generateInterviewPrep(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    return callClaude(
      `You are an interview coach specializing in agricultural sector roles in Kenya and East Africa. Generate interview preparation for Wesley Kipkemoi Koech.\n\nWesley's profile:\n${WESLEY_PROFILE}\n\nFormat:\nLIKELY QUESTIONS:\n1. [question] → SUGGESTED ANSWER: [brief answer]\n\nTECHNICAL QUESTIONS TO PREPARE FOR:\n• [question]\n\nQUESTIONS TO ASK THE INTERVIEWER:\n• [smart question]`,
      `Prepare interview questions and answers for:\nCompany: ${company}\nRole: ${jobTitle}\nJob Description: ${jobDescription}`
    );
  },

  async generateFollowUp(company: string, role: string, daysSinceApplied: number): Promise<string> {
    return callClaude(
      `You are a professional email writer. Write polite, confident follow-up emails for Wesley Kipkemoi Koech.\n\nWesley's profile:\n${WESLEY_PROFILE}\n\nKeep follow-ups: short (3-4 sentences), polite but confident, reference the specific role, reaffirm interest, ask for status update.`,
      `Write a follow-up email for:\nCompany: ${company}\nRole: ${role}\nDays since application: ${daysSinceApplied}\n\nWrite just the email body.`
    );
  },

  async classifyEmail(subject: string, body: string, company: string): Promise<{
    classification: string;
    summary: string;
    suggestedReply: string;
    urgency: "high" | "medium" | "low";
  }> {
    const result = await callClaude(
      `You are an email classifier for job applications. Analyze recruiter emails and return ONLY valid JSON, no markdown, no explanation.\n\nClassifications:\n- interview_invite: They want to schedule an interview\n- offer: Job offer extended\n- rejection: Application unsuccessful\n- assessment: Technical test or assignment sent\n- follow_up: They need more info\n- other: General communication`,
      `Classify this recruiter email for a job application at ${company}:\n\nSubject: ${subject}\nBody: ${body}\n\nReturn JSON only:\n{\n  "classification": "interview_invite|offer|rejection|assessment|follow_up|other",\n  "summary": "1-2 sentence plain English summary",\n  "suggestedReply": "A professional reply Wesley should send",\n  "urgency": "high|medium|low"\n}`
    );

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
