import { aiService } from "./gemini";

const CORS_PROXY = "https://api.allorigins.win/get?url=";

export const urlParser = {
  async parseFromUrl(url: string): Promise<ParsedJob> {
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const board = detectJobBoard(url);
    const rawText = await fetchPageText(url);

    if (!rawText || rawText.length < 100) {
      throw new Error("Could not fetch job page. Try pasting the job description text directly instead.");
    }

    const extracted = await aiService.parseJobDetails(rawText.slice(0, 4000));

    return {
      ...extracted,
      sourceUrl: url,
      sourceName: board,
      rawText: rawText.slice(0, 5000),
    };
  },

  async parseFromText(text: string): Promise<ParsedJob> {
    const extracted = await aiService.parseJobDetails(text);
    return {
      ...extracted,
      sourceUrl: "",
      sourceName: "Pasted text",
      rawText: text,
    };
  },
};

async function fetchPageText(url: string): Promise<string> {
  try {
    const directResponse = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (directResponse.ok) {
      const html = await directResponse.text();
      return stripHtml(html);
    }
  } catch {
    // Direct fetch failed, try proxy
  }

  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    const data = await response.json();
    return stripHtml(data.contents || "");
  } catch {
    throw new Error("Could not fetch the job page. Please paste the job description text directly.");
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

function detectJobBoard(url: string): string {
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("brightermonday.co.ke")) return "BrighterMonday Kenya";
  if (url.includes("myjobmag.co.ke")) return "MyJobMag Kenya";
  if (url.includes("jobwebkenya.com")) return "JobWebKenya";
  if (url.includes("fuzu.com")) return "Fuzu";
  if (url.includes("ngojobs.co.ke")) return "NGO Jobs Kenya";
  if (url.includes("reliefweb.int")) return "ReliefWeb";
  if (url.includes("indeed.com")) return "Indeed";
  if (url.includes("glassdoor.com")) return "Glassdoor";
  return "Job Board";
}

export interface ParsedJob {
  company: string;
  role: string;
  deadline: string;
  contactEmail: string;
  location: string;
  salary: string;
  requirements: string[];
  responsibilities: string[];
  sourceUrl: string;
  sourceName: string;
  rawText: string;
}
