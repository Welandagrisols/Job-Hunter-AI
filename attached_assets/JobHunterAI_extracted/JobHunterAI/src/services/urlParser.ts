import { aiService } from "./gemini";

// ============================================
// URL JOB PARSER
// Fetches job ad from URL and extracts details
// ============================================

// CORS proxy to fetch external URLs from React Native
const CORS_PROXY = "https://api.allorigins.win/get?url=";

export const urlParser = {
  // Fetch and parse a job URL
  async parseFromUrl(url: string): Promise<ParsedJob> {
    // Validate URL
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    // Detect job board
    const board = detectJobBoard(url);

    // Fetch page content
    const rawText = await fetchPageText(url);

    if (!rawText || rawText.length < 100) {
      throw new Error("Could not fetch job page. Try pasting the job description text directly instead.");
    }

    // Use AI to extract structured data
    const extracted = await aiService.parseJobDetails(rawText.slice(0, 4000));

    return {
      ...extracted,
      sourceUrl: url,
      sourceName: board,
      rawText: rawText.slice(0, 5000),
    };
  },

  // Parse from pasted text directly
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

// Fetch page and extract visible text
async function fetchPageText(url: string): Promise<string> {
  try {
    // Try direct fetch first (works for some APIs)
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
    // Use CORS proxy
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    const data = await response.json();
    return stripHtml(data.contents || "");
  } catch (err) {
    throw new Error("Could not fetch the job page. Please paste the job description text directly.");
  }
}

// Strip HTML tags and clean text
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

// Detect which job board the URL is from
function detectJobBoard(url: string): string {
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("brightermonday.co.ke")) return "BrighterMonday Kenya";
  if (url.includes("myjobmag.co.ke")) return "MyJobMag Kenya";
  if (url.includes("jobwebkenya.com")) return "JobWebKenya";
  if (url.includes("fuzu.com")) return "Fuzu";
  if (url.includes("kenyanjobs.com")) return "KenyanJobs";
  if (url.includes("ngojobs.co.ke")) return "NGO Jobs Kenya";
  if (url.includes("reliefweb.int")) return "ReliefWeb";
  if (url.includes("indeed.com")) return "Indeed";
  if (url.includes("glassdoor.com")) return "Glassdoor";
  if (url.includes("twitter.com") || url.includes("x.com")) return "X/Twitter";
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
