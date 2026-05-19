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
  "soil health", "soil fertility", "sustainable agriculture",
  "climate smart", "agri-food", "food security", "nutrition",
  "agribusiness", "irrigation", "plant", "pest", "conservation",
  "ifdc", "icipe", "agra", "biovision", "ocp", "cgiar",
  "sudan", "uganda", "tanzania", "ethiopia", "zambia", "malawi",
  "southern africa", "west africa", "africa",
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
  {
    id: "icipe",
    name: "ICIPE Careers",
    icon: "🔬",
    color: "#388E3C",
    rssUrl: "https://www.icipe.org/opportunities/vacancies/feed/",
    rssUrlGeneral: "https://www.icipe.org/feed/",
    category: "Agriculture/Research",
    enabled: true,
  },
  {
    id: "ifdc",
    name: "IFDC Jobs",
    icon: "🌿",
    color: "#8BC34A",
    rssUrl: "https://www.ifdc.org/feed/",
    rssUrlGeneral: "https://reliefweb.int/jobs/rss.xml?search=ifdc+africa",
    category: "Agriculture/Research",
    enabled: true,
  },
  {
    id: "agra",
    name: "AGRA",
    icon: "🌻",
    color: "#FF9800",
    rssUrl: "https://agra.org/feed/",
    rssUrlGeneral: "https://reliefweb.int/jobs/rss.xml?search=agra+agriculture+africa",
    category: "Agriculture/Research",
    enabled: true,
  },
  {
    id: "biovision",
    name: "Biovision Africa Trust",
    icon: "🌱",
    color: "#43A047",
    rssUrl: "https://www.biovisiontrust.org/feed/",
    rssUrlGeneral: "https://reliefweb.int/jobs/rss.xml?search=biovision+kenya",
    category: "Agriculture/Research",
    enabled: true,
  },
  {
    id: "fao",
    name: "FAO Careers",
    icon: "🌾",
    color: "#1565C0",
    rssUrl: "https://reliefweb.int/jobs/rss.xml?search=fao+agronomist+africa",
    rssUrlGeneral: "https://reliefweb.int/jobs/rss.xml?search=fao+agriculture+east+africa",
    category: "NGO/International",
    enabled: true,
  },
  {
    id: "unep",
    name: "UNEP Jobs",
    icon: "🌍",
    color: "#1B5E20",
    rssUrl: "https://unjobs.org/organisations/unep.rss",
    rssUrlGeneral: "https://reliefweb.int/jobs/rss.xml?search=unep+environment+nairobi",
    category: "NGO/International",
    enabled: true,
  },
  {
    id: "ocp",
    name: "OCP Africa",
    icon: "⚗️",
    color: "#E65100",
    rssUrl: "https://reliefweb.int/jobs/rss.xml?search=ocp+africa+fertilizer",
    rssUrlGeneral: "https://www.devex.com/jobs/rss?q=ocp+africa",
    category: "Agriculture/Research",
    enabled: true,
  },
  {
    id: "cgiar",
    name: "CGIAR Jobs",
    icon: "🏛️",
    color: "#0277BD",
    rssUrl: "https://reliefweb.int/jobs/rss.xml?search=cgiar+agriculture",
    rssUrlGeneral: "https://www.devex.com/jobs/rss?q=cgiar+east+africa",
    category: "Agriculture/Research",
    enabled: true,
  },
  {
    id: "brightermonday_ug",
    name: "BrighterMonday Uganda",
    icon: "🇺🇬",
    color: "#BF360C",
    rssUrl: "https://www.brightermonday.co.ug/jobs/agriculture-agribusiness/rss",
    rssUrlGeneral: "https://www.brightermonday.co.ug/jobs/rss",
    category: "East Africa",
    enabled: true,
  },
  {
    id: "brightermonday_tz",
    name: "BrighterMonday Tanzania",
    icon: "🇹🇿",
    color: "#006400",
    rssUrl: "https://www.brightermonday.co.tz/jobs/agriculture-agribusiness/rss",
    rssUrlGeneral: "https://www.brightermonday.co.tz/jobs/rss",
    category: "East Africa",
    enabled: true,
  },
  {
    id: "ethiojobs",
    name: "EthioJobs",
    icon: "🇪🇹",
    color: "#009688",
    rssUrl: "https://www.ethiojobs.net/rss/",
    rssUrlGeneral: "https://www.ethiojobs.net/rss/agriculture/",
    category: "East Africa",
    enabled: true,
  },
  {
    id: "myjobmag_ug",
    name: "MyJobMag Uganda",
    icon: "🇺🇬",
    color: "#00897B",
    rssUrl: "https://www.myjobmag.co.ug/jobs-in/agriculture/feed",
    rssUrlGeneral: "https://www.myjobmag.co.ug/feed",
    category: "East Africa",
    enabled: true,
  },
  {
    id: "jobnetafrica",
    name: "Jobnet Africa",
    icon: "🌍",
    color: "#6A1B9A",
    rssUrl: "https://www.jobnetafrica.com/feed/",
    rssUrlGeneral: "https://www.jobnetafrica.com/feed/",
    category: "Southern Africa",
    enabled: true,
  },
  {
    id: "go3zambia",
    name: "Jobs Zambia",
    icon: "🇿🇲",
    color: "#795548",
    rssUrl: "https://jobs.go3.co.zm/feed/",
    rssUrlGeneral: "https://jobs.go3.co.zm/feed/",
    category: "Southern Africa",
    enabled: true,
  },
  {
    id: "jobsmw",
    name: "Jobs Malawi",
    icon: "🇲🇼",
    color: "#880E4F",
    rssUrl: "https://www.jobsmw.com/feed/",
    rssUrlGeneral: "https://www.jobsmw.com/feed/",
    category: "Southern Africa",
    enabled: true,
  },
];

const PROXY2 = "https://api.rss2json.com/v1/api.json?rss_url=";
const PROXY = "https://api.allorigins.win/get?url=";
const PER_REQUEST_TIMEOUT = 8000;
const OVERALL_FEED_TIMEOUT = 40000;

function fetchWithTimeout(url: string, options: RequestInit = {}, ms = PER_REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function cleanHtml(str: string): string {
  return str.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function parseRSSItems(xmlText: string, sourceName: string): RawJob[] {
  const items: RawJob[] = [];

  try {
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);

    for (const match of itemMatches) {
      const item = match[1];

      const getTag = (tag: string): string => {
        const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))
          || item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
        return m ? m[1].trim() : "";
      };

      const title = getTag("title");
      const link = getTag("link") || getTag("guid");

      // Try richer content sources in priority order
      const rawDesc =
        getTag("content:encoded") ||
        getTag("description") ||
        getTag("summary") ||
        getTag("dc:description") ||
        "";

      const pubDate = getTag("pubDate") || getTag("dc:date") || new Date().toISOString();

      if (title && link) {
        const description = cleanHtml(rawDesc).slice(0, 600);
        items.push({
          id: btoa(encodeURIComponent(link)).slice(0, 20),
          title: cleanHtml(title),
          url: link,
          description,
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

function mapRss2JsonItems(items: any[], sourceName: string): RawJob[] {
  return items.map((item: any) => ({
    id: btoa(item.link || item.guid || item.title).slice(0, 20),
    title: item.title || "",
    url: item.link || item.guid || "",
    description: (item.description || item.content || "").replace(/<[^>]+>/g, " ").trim().slice(0, 500),
    publishedAt: new Date(item.pubDate || Date.now()).toISOString(),
    source: sourceName,
    relevanceScore: 0,
    relevanceReason: "",
    isNew: true,
  })).slice(0, 15);
}

async function fetchRSS(source: JobSource): Promise<RawJob[]> {
  const urls = [source.rssUrl, source.rssUrlGeneral].filter((u, i, a) => u && a.indexOf(u) === i) as string[];

  for (const rssUrl of urls) {
    // 1. Try direct fetch first — works in native APK without any proxy
    try {
      const r = await fetchWithTimeout(rssUrl, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      });
      if (r.ok) {
        const text = await r.text();
        if (text.includes("<item>")) {
          const items = parseRSSItems(text, source.name);
          if (items.length > 0) return items;
        }
      }
    } catch {}

    // 2. Fall back to rss2json proxy (web / Expo Go)
    try {
      const r = await fetchWithTimeout(`${PROXY2}${encodeURIComponent(rssUrl)}`);
      if (r.ok) {
        const data = await r.json();
        if (data.status === "ok" && data.items?.length > 0) {
          return mapRss2JsonItems(data.items, source.name);
        }
      }
    } catch {}

    // 3. Last resort: allorigins proxy
    try {
      const r = await fetchWithTimeout(`${PROXY}${encodeURIComponent(rssUrl)}`);
      if (r.ok) {
        const data = await r.json();
        const items = parseRSSItems(data.contents || "", source.name);
        if (items.length > 0) return items;
      }
    } catch {}
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

  if (needsAI.length > 0) {
    try {
      const batch = needsAI.slice(0, 6);
      const jobList = batch.map((j, i) => `${i + 1}. ${j.title}: ${j.description.slice(0, 100)}`).join("\n");
      const result = await aiService.scoreJobRelevance(jobList);

      if (result && Array.isArray(result)) {
        result.forEach((r: any, i: number) => {
          if (batch[i]) {
            batch[i].relevanceScore = r.score || batch[i].relevanceScore;
            batch[i].relevanceReason = r.reason || batch[i].relevanceReason;
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

    const overallTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Feed fetch timed out")), OVERALL_FEED_TIMEOUT)
    );

    const fetchAll = Promise.allSettled(
      enabledSources.map(async (source) => {
        const jobs = await fetchRSS(source);
        onProgress?.(source.name, jobs.length);
        return { source, jobs };
      })
    );

    let results: PromiseSettledResult<{ source: JobSource; jobs: RawJob[] }>[];
    try {
      results = await Promise.race([fetchAll, overallTimeout]) as typeof results;
    } catch {
      results = [];
    }

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        allJobs.push(...result.value.jobs);
      }
    });

    // Deduplicate: first by exact URL, then by normalised title (same job from multiple boards)
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const unique = allJobs.filter((job) => {
      if (seenUrls.has(job.url)) return false;
      seenUrls.add(job.url);
      const t = normalizeTitle(job.title);
      // Only title-dedup when title is long enough to be specific (>20 chars)
      if (t.length > 20 && seenTitles.has(t)) return false;
      if (t.length > 20) seenTitles.add(t);
      return true;
    });

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

    // Only overwrite the cache if we got real results — never wipe old jobs with an empty fetch
    if (feedJobs.length > 0) {
      await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(feedJobs));
      await AsyncStorage.setItem(LAST_FETCH_KEY, new Date().toISOString());
    }

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
