import { Router } from "express";

const claudeRouter = Router();

claudeRouter.post("/claude", async (req, res) => {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "AI service not configured. Add ANTHROPIC_API_KEY to Replit Secrets." });
    return;
  }

  const { model, system, messages, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 1500,
        system: system || undefined,
        messages,
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Claude API error");
      res.status(response.status).json({ error: data.error?.message || "Claude API error" });
      return;
    }

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Claude proxy error");
    res.status(500).json({ error: "Failed to contact AI service" });
  }
});

export default claudeRouter;
