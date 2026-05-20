import { Router } from "express";

const parseJobRouter = Router();

parseJobRouter.post("/parse-job", async (req, res) => {
  const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] || process.env["ANTHROPIC_API_KEY"];
  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] || "https://api.anthropic.com";

  if (!apiKey) {
    res.status(503).json({ error: "AI service not configured." });
    return;
  }

  const { url, text } = req.body;

  if (!url && !text) {
    res.status(400).json({ error: "Provide either a url or text" });
    return;
  }

  let content = text || "";

  if (url && !text) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JobHunterBot/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    } catch {
      res.status(400).json({ error: "Could not fetch that URL. Try pasting the job text instead." });
      return;
    }
  }

  try {
    const response = await fetch(`${baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1000,
        system: "You are a job advertisement parser. Extract structured information from job postings and return ONLY valid JSON with no markdown or explanation.",
        messages: [
          {
            role: "user",
            content: `Extract job details from this content and return JSON only:\n\n${content}\n\nReturn this exact JSON structure:\n{\n  "company": "company name or empty string",\n  "role": "job title or empty string",\n  "location": "city/country or empty string",\n  "deadline": "application deadline in YYYY-MM-DD format or empty string",\n  "contact_email": "contact or application email or empty string",\n  "salary": "salary range if mentioned or empty string",\n  "job_description": "concise 2-3 sentence summary of the role",\n  "requirements": "key requirements as bullet points"\n}`,
          },
        ],
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "AI parsing error" });
      return;
    }

    const rawText = data.content[0].text;
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch {
    res.status(500).json({ error: "Failed to parse job advertisement. Please try pasting the text instead." });
  }
});

export default parseJobRouter;
