import { aiService } from "./gemini";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FEED_CACHE_KEY = "jh_job_feed";
const SEEN_JOBS_KEY = "jh_seen_jobs";
const LAST_FETCH_KEY = "jh_last_fetch";

const WESLEY_KEYWORDS = [
  "agronomist", "agronomy", "soil", "fertilizer", "fertiliser",
  "agriculture", "agricultural", "crop", "farm", "horticulture",
  "field officer", "extension", "research", "soil scientist",
  "agrovet", "seeds", "inputs", "value chain", "food systems",
  "training", "coordinator", "kenya", "east africa", "nairobi",
];

export const JOB_SOURCES: JobSource[] = [
  {
    id: "brightermonday",
    name: "BrighterMonday Kenya",
    icon: "🇰🇪",
    color: "#FF6B35",
    rssUrl: "https://www.brightermonday.co.ke/jobs/agriculture-agribusiness/rss",
    rssUrlGeneral: "https://www.brightermonday.co.ke/jobs/rss",
    category: "Kenya",
    enabled: true,
  },
  {
    id: "myjobmag",
    name: "MyJobMag Kenya",
    icon: "🌍",
    color: "#00A86B",
    rssUrl: "https://www.myjobmag.co.ke/jobs-in/agriculture/feed",
    rssUrlGeneral: "https://www.myjobmag.co.ke/feed",
    category: "Kenya",
    enabled: true,
  },
  {
    id: "fuzu",
    name: "Fuzu",
    icon: "🚀",
    color: "#6C63FF",
    rssUrl: "https://www.fuzu.com/kenya/jobs/agriculture/feed",
    rssUrlGeneral: "https://www.fuzu.com/kenya/jobs/feed",
    category: "East Africa",
    enabled: true,
  },
  {
    id: "reliefweb",
    name: "ReliefWeb",
    icon: "🌐",
    color: "#0072BC",
    rssUrl: "https://reliefweb.int/jobs/rss.xml?search=agriculture+kenya",
    rssUrlGeneral: "https://reliefweb.int/jobs/rss.xml?search=agronomist",
    category: "NGO/International",
    enabled: true,
  },
  {
    id: "ngojobs",
    name: "NGO Jobs Kenya",
    icon: "🤝",
    color: "#E63946",
    rssUrl: "https://ngojobskenya.com/feed/",
    rssUrlGeneral: "https://ngojobskenya.com/feed/",
    category: "NGO/International",
    enabled: true,
  },
  {
    id: "jobwebkenya",
    name: "JobWeb Kenya",
    icon: "💼",
    color: "#457B9D",
    rssUrl: "https://jobwebkenya.com/feed/",
    rssUrlGeneral: "https://jobwebkenya.com/feed/",
    category: "Kenya",
    enabled: true,
  },
  {
    id: "devex",
    name: "Devex",
    icon: "🌱",
    color: "#2A9D8F",
    rssUrl: "https://www.devex.com/jobs/rss?q=agronomist+kenya",
    rssUrlGeneral: "https://www.devex.com/jobs/rss?q=agriculture+east+africa",
    category: "Development",
    enabled: true,
  },
  {
    id: "indeed_ke",
    name: "Indeed Kenya",
    icon: "🔍",
    color: "#003A9B",
    rssUrl: "https://ke.indeed.com/rss?q=agronomist&l=Kenya",
    rssUrlGeneral: "https://ke.indeed.com/rss?q=agriculture&l=Kenya",
    category: "Kenya",
    enabled: true,
  },
  {
    id: "careerpointkenya",
    name: "Career Point Kenya",
    icon: "📌",
    color: "#F4A261",
    rssUrl: "https://careerpointkenya.co.ke/feed/",
    rssUrlGeneral: "https://careerpointkenya.co.ke/feed/",
    category: "Kenya",
    enabled: true,
  },
  {
    id: "unjobs_agri",
    name: "UN Jobs – Agriculture",
    icon: "🌾",
    color: "#009EDB",
    rssUrl: "https://unjobs.org/themes/agriculture.rss",
    rssUrlGeneral: "https://unjobs.org/themes/food-security.rss",
    category: "NGO/International",
    enabled: true,
  },
  {
    id: "kazikwanza",
    name: "Kazi Kenya",
    icon: "🏷️",
    color: "#E9C46A",
    rssUrl: "https://kazikwanza.co.ke/feed/",
    rssUrlGeneral: "https://kazikwanza.co.ke/feed/",
    category: "Kenya",
    enabled: true,
  },
  {
    id: "ilri",
    name: "ILRI Careers",
    icon: "🔬",
    color: "#264653",
    rssUrl: "https://www.ilri.org/jobs/rss",
    rssUrlGeneral: "https://www.ilri.org/jobs/rss",
    category: "Agriculture/Research",
    enabled: true,
  },
  {
    id: "jobsinkenya",
    name: "Jobs in Kenya",
    icon: "🇰🇪",
    color: "#2DC653",
    rssUrl: "https://www.jobsinkenya.co.ke/feed/",
    rssUrlGeneral: "https://www.jobsinkenya.co.ke/feed/",
    category: "Kenya",
    enabled: true,
  },
];

const PROXY2 = "https://api.rss2json.com/v1/api.json?rss_url=";
const PROXY = "https://api.allorigins.win/get?url=";

function parseRSSItems(xmlText: string, sourceName: string): RawJob[] {
  const items: RawJob[] = [];

  try {
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);

    for (const match of itemMatches) {
      const item = match[1];

      const getTag = (tag: string): string => {
        const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, "i"))
          || item.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
        return m ? m[1].trim() : "";
      };

      const title = getTag("title");
      const link = getTag("link") || getTag("guid");
      const description = getTag("description");
      const pubDate = getTag("pubDate") || getTag("dc:date") || new Date().toISOString();

      if (title && link) {
        items.push({
          id: btoa(link).slice(0, 20),
          title,
          url: link,
          description: description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
          publishedAt: new Date(pubDate).toISOString(),
          source: sourceName,
          relevanceScore: 0,
          relevanceReason: "",
          isNew: true,
        });
      }
    }
  } catch (err) {
    console.error("RSS parse error:", err);
  }

  return items.slice(0, 15);
}

async function fetchRSS(source: JobSource): Promise<RawJob[]> {
  const urls = [source.rssUrl, source.rssUrlGeneral].filter(Boolean);

  for (const rssUrl of urls) {
    try {
      const rss2jsonUrl = `${PROXY2}${encodeURIComponent(rssUrl)}`;
      const r1 = await fetch(rss2jsonUrl, { signal: AbortSignal.timeout(8000) });
      if (r1.ok) {
        const data = await r1.json();
        if (data.status === "ok" && data.items?.length > 0) {
          return data.items.map((item: any) => ({
            id: btoa(item.link || item.guid || item.title).slice(0, 20),
            title: item.title || "",
            url: item.link || item.guid || "",
            description: (item.description || item.content || "").replace(/<[^>]+>/g, " ").trim().slice(0, 500),
            publishedAt: new Date(item.pubDate || Date.now()).toISOString(),
            source: source.name,
            relevanceScore: 0,
            relevanceReason: "",
            isNew: true,
          })).slice(0, 15);
        }
      }

      const proxyUrl = `${PROXY}${encodeURIComponent(rssUrl)}`;
      const r2 = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (r2.ok) {
        const data = await r2.json();
        const items = parseRSSItems(data.contents || "", source.name);
        if (items.length > 0) return items;
      }
    } catch (err) {
      console.warn(`Failed to fetch ${source.name}:`, err);
    }
  }

  return [];
}

async function scoreRelevance(jobs: RawJob[]): Promise<RawJob[]> {
  if (jobs.length === 0) return [];

  const prescored = jobs.map((job) => {
    const text = `${job.title} ${job.description}`.toLowerCase();
    let score = 0;
    const matches: string[] = [];

    WESLEY_KEYWORDS.forEach((kw) => {
      if (text.includes(kw)) {
        score += kw.length > 6 ? 20 : 10;
        matches.push(kw);
      }
    });

    return { ...job, relevanceScore: Math.min(score, 100), relevanceReason: matches.slice(0, 3).join(", ") };
  });

  const needsAI = prescored.filter((j) => j.relevanceScore >= 10 && j.relevanceScore < 60);
  const highScore = prescored.filter((j) => j.relevanceScore >= 60);
  const lowScore = prescored.filter((j) => j.relevanceScore < 10);

  if (needsAI.length > 0 && needsAI.length <= 10) {
    try {
      const jobList = needsAI.map((j, i) => `${i + 1}. ${j.title}: ${j.description.slice(0, 150)}`).join("\n");
      const result = await aiService.scoreJobRelevance(jobList);

      if (result && Array.isArray(result)) {
        result.forEach((r: any, i: number) => {
          if (needsAI[i]) {
            needsAI[i].relevanceScore = r.score || needsAI[i].relevanceScore;
            needsAI[i].relevanceReason = r.reason || needsAI[i].relevanceReason;
          }
        });
      }
    } catch {
      // Use keyword scores if AI fails
    }
  }

  return [...highScore, ...needsAI, ...lowScore].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export const feedService = {
  async fetchAllFeeds(onProgress?: (source: string, count: number) => void): Promise<FeedJob[]> {
    const enabledSources = JOB_SOURCES.filter((s) => s.enabled);
    const seenIds = await this.getSeenJobIds();
    const allJobs: RawJob[] = [];

    const results = await Promise.allSettled(
      enabledSources.map(async (source) => {
        const jobs = await fetchRSS(source);
        onProgress?.(source.name, jobs.length);
        return { source, jobs };
      })
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        allJobs.push(...result.value.jobs);
      }
    });

    const unique = allJobs.filter((job, idx, arr) =>
      arr.findIndex((j) => j.url === job.url) === idx
    );

    const withNewFlag = unique.map((job) => ({
      ...job,
      isNew: !seenIds.has(job.id),
    }));

    const scored = await scoreRelevance(withNewFlag);

    const feedJobs: FeedJob[] = scored.map((job) => {
      const source = JOB_SOURCES.find((s) => s.name === job.source);
      return {
        ...job,
        sourceColor: source?.color || "#666",
        sourceIcon: source?.icon || "💼",
        sourceCategory: source?.category || "Other",
      };
    });

    await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(feedJobs));
    await AsyncStorage.setItem(LAST_FETCH_KEY, new Date().toISOString());

    return feedJobs;
  },

  async getCachedFeed(): Promise<FeedJob[]> {
    try {
      const data = await AsyncStorage.getItem(FEED_CACHE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async getLastFetchTime(): Promise<Date | null> {
    try {
      const data = await AsyncStorage.getItem(LAST_FETCH_KEY);
      return data ? new Date(data) : null;
    } catch {
      return null;
    }
  },

  async markAsSeen(jobIds: string[]): Promise<void> {
    const seen = await this.getSeenJobIds();
    jobIds.forEach((id) => seen.add(id));
    await AsyncStorage.setItem(SEEN_JOBS_KEY, JSON.stringify([...seen]));
  },

  async getSeenJobIds(): Promise<Set<string>> {
    try {
      const data = await AsyncStorage.getItem(SEEN_JOBS_KEY);
      return new Set(data ? JSON.parse(data) : []);
    } catch {
      return new Set();
    }
  },

  async clearCache(): Promise<void> {
    await AsyncStorage.multiRemove([FEED_CACHE_KEY, LAST_FETCH_KEY]);
  },
};

export interface JobSource {
  id: string;
  name: string;
  icon: string;
  color: string;
  rssUrl: string;
  rssUrlGeneral?: string;
  category: string;
  enabled: boolean;
}

export interface RawJob {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: string;
  relevanceScore: number;
  relevanceReason: string;
  isNew: boolean;
}

export interface FeedJob extends RawJob {
  sourceColor: string;
  sourceIcon: string;
  sourceCategory: string;
}
