import { aiService } from "./gemini";

const CORS_PROXY = "https://api.allorigins.win/get?url=";
const FETCH_TIMEOUT_MS = 12000;

export const urlParser = {
  async parseFromUrl(url: string): Promise<ParsedJob> {
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const board = detectJobBoard(url);
    const rawText = await fetchPageText(url);

    if (!rawText || rawText.length < 100) {
      throw new Error("Could not fetch the job page. Try switching to 'Paste Text' and pasting the job description directly.");
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

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (response.ok) {
      const html = await response.text();
      return stripHtml(html);
    }
  } catch {
    // Direct fetch failed (CORS or network), try proxy
  }

  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const response = await fetchWithTimeout(proxyUrl);
    const data = await response.json();
    return stripHtml(data.contents || "");
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("The request timed out. The job site may be slow. Try pasting the job text directly.");
    }
    throw new Error("Could not fetch the job page. Please paste the job description text directly instead.");
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
