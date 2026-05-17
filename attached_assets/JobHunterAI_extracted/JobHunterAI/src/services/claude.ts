import { CONFIG } from "../config";

const CLAUDE_API = "https://api.anthropic.com/v1/messages";

// Wesley's profile — pre-loaded so AI knows who he is
const WESLEY_PROFILE = `
Name: Wesley Kipkemoi Koech
Profession: Agronomist & Soil Scientist
Location: Nairobi, Kenya
Experience: 5+ years in soil fertility management, fertilizer optimization, agricultural research, and field training
Education: BSc in Agriculture (assumed from experience)
Current: Runs his own agricultural consultancy company
Skills: 
- Soil fertility management & analysis
- Fertilizer optimization & recommendations  
- Agricultural research & data analysis
- Field training & farmer extension
- Digital agricultural tools (AI-assisted)
- Agrovet management systems
- Crop management advisory
Industry: Agriculture, Agri-tech, East African agri-development
`;

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch(CLAUDE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CONFIG.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Claude API error");
  }

  const data = await response.json();
  return data.content[0].text;
}

export const aiService = {
  // Generate application email
  async generateApplicationEmail(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    const system = `You are a professional job application writer. You write concise, confident, identity-forward application emails for Wesley Kipkemoi Koech, an agronomist based in Nairobi, Kenya. 

Wesley's profile:
${WESLEY_PROFILE}

Write emails that are:
- Direct and confident (no fluff)
- 3-4 short paragraphs max
- Show domain expertise clearly
- End with a professional sign-off
- Include placeholder [Phone] and [Email] in signature`;

    return callClaude(
      system,
      `Write a job application email for this role:
Company: ${company}
Job Title: ${jobTitle}
Job Description: ${jobDescription}

Write the full email body (not subject line).`
    );
  },

  // Generate cover letter
  async generateCoverLetter(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    const system = `You are a professional cover letter writer. Write compelling, tailored cover letters for Wesley Kipkemoi Koech.

Wesley's profile:
${WESLEY_PROFILE}

Cover letters should be:
- One page max (4 paragraphs)
- Opening: why this role + company excites him
- Body 1: relevant experience proof points
- Body 2: specific value he brings
- Closing: confident call to action
- Formal letter format with date and address headers`;

    return callClaude(
      system,
      `Write a cover letter for:
Company: ${company}
Role: ${jobTitle}
Job Description: ${jobDescription}`
    );
  },

  // Tailor CV bullet points to job
  async tailorCVPoints(jobDescription: string): Promise<string> {
    const system = `You are a CV optimization expert. Given a job description, generate tailored CV bullet points and a professional summary for Wesley Kipkemoi Koech that match the role's requirements.

Wesley's profile:
${WESLEY_PROFILE}

Output format:
PROFESSIONAL SUMMARY:
[2-3 sentence tailored summary]

KEY ACHIEVEMENTS TO HIGHLIGHT:
• [bullet]
• [bullet]
• [bullet]
• [bullet]
• [bullet]

SKILLS TO EMPHASIZE:
[comma-separated list matching job requirements]`;

    return callClaude(
      system,
      `Tailor Wesley's CV for this job description:
${jobDescription}`
    );
  },

  // Generate interview prep questions
  async generateInterviewPrep(jobTitle: string, company: string, jobDescription: string): Promise<string> {
    const system = `You are an interview coach specializing in agricultural sector roles in Kenya and East Africa. Generate interview preparation for Wesley Kipkemoi Koech.

Wesley's profile:
${WESLEY_PROFILE}

Format:
LIKELY QUESTIONS:
1. [question] → SUGGESTED ANSWER: [brief Wesley-specific answer]
2. ...

TECHNICAL QUESTIONS TO PREPARE FOR:
• [question]

QUESTIONS TO ASK THE INTERVIEWER:
• [smart question]`;

    return callClaude(
      system,
      `Prepare interview questions and answers for:
Company: ${company}
Role: ${jobTitle}
Job Description: ${jobDescription}`
    );
  },

  // Classify and summarize recruiter email
  async classifyEmail(subject: string, body: string, company: string): Promise<{
    classification: string;
    summary: string;
    suggestedReply: string;
    urgency: "high" | "medium" | "low";
  }> {
    const system = `You are an email classifier for job applications. Analyze recruiter emails and return ONLY valid JSON, no markdown, no explanation.

Classifications:
- interview_invite: They want to schedule an interview
- offer: Job offer extended
- rejection: Application unsuccessful  
- assessment: Technical test or assignment sent
- follow_up: They need more info / follow-up required
- other: General communication`;

    const result = await callClaude(
      system,
      `Classify this recruiter email for a job application at ${company}:

Subject: ${subject}
Body: ${body}

Return JSON only:
{
  "classification": "interview_invite|offer|rejection|assessment|follow_up|other",
  "summary": "1-2 sentence plain English summary",
  "suggestedReply": "A professional reply Wesley should send",
  "urgency": "high|medium|low"
}`
    );

    try {
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        classification: "other",
        summary: result,
        suggestedReply: "Thank you for your email. I will review and respond shortly.",
        urgency: "medium",
      };
    }
  },

  // Follow-up email generator
  async generateFollowUp(company: string, role: string, daysSinceApplied: number): Promise<string> {
    const system = `You are a professional email writer. Write polite, confident follow-up emails for Wesley Kipkemoi Koech for job applications.

Wesley's profile:
${WESLEY_PROFILE}

Keep follow-ups:
- Short (3-4 sentences)
- Polite but confident
- Reference the specific role
- Reaffirm interest
- Ask for status update`;

    return callClaude(
      system,
      `Write a follow-up email for:
Company: ${company}
Role: ${role}
Days since application: ${daysSinceApplied}

Write just the email body.`
    );
  },
};
