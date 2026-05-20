import { aiService } from "./gemini";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FEED_CACHE_KEY = "jh_job_feed";
const SEEN_JOBS_KEY = "jh_seen_jobs";
const LAST_FETCH_KEY = "jh_last_fetch";
const SOURCES_KEY = "@jobhunter:feed_sources";
const KEYWORD_FILTERS_KEY = "@jobhunter:keyword_filters";

// Minimum relevance score for a job to appear in the feed at all
const MIN_DISPLAY_SCORE = 15;

// Keywords that strongly indicate this is an agricultural/development job
const WESLEY_KEYWORDS: Array<{ word: string; score: number }> = [
  // Core agronomy — high value
  { word: "agronomist", score: 35 },
  { word: "agronomy", score: 35 },
  { word: "soil scientist", score: 35 },
  { word: "soil science", score: 30 },
  { word: "soil health", score: 30 },
  { word: "soil fertility", score: 30 },
  { word: "fertilizer", score: 25 },
  { word: "fertiliser", score: 25 },
  { word: "crop production", score: 25 },
  { word: "crop management", score: 25 },
  { word: "plant science", score: 25 },
  { word: "plant protection", score: 25 },
  { word: "horticulture", score: 25 },
  { word: "pest management", score: 25 },
  { word: "integrated pest", score: 25 },
  // Agriculture broad
  { word: "agriculture", score: 20 },
  { word: "agricultural", score: 20 },
  { word: "agribusiness", score: 20 },
  { word: "agrovet", score: 20 },
  { word: "value chain", score: 20 },
  { word: "food systems", score: 20 },
  { word: "food security", score: 20 },
  { word: "sustainable agriculture", score: 25 },
  { word: "climate smart", score: 25 },
  { word: "agri-food", score: 20 },
  { word: "irrigation", score: 20 },
  { word: "seeds", score: 15 },
  { word: "inputs", score: 10 },
  { word: "extension officer", score: 25 },
  { word: "field officer", score: 15 },
  { word: "conservation agriculture", score: 25 },
  // Specific orgs (very high value)
  { word: "ifdc", score: 40 },
  { word: "icipe", score: 40 },
  { word: "agra", score: 30 },
  { word: "biovision", score: 35 },
  { word: "ocp africa", score: 35 },
  { word: "cgiar", score: 35 },
  { word: "fao", score: 25 },
  { word: "ilri", score: 35 },
  { word: "cimmyt", score: 35 },
  { word: "iita", score: 35 },
  // Location (moderate — not enough alone)
  { word: "nairobi", score: 10 },
  { word: "kenya", score: 8 },
  { word: "east africa", score: 10 },
  { word: "uganda", score: 5 },
  { word: "tanzania", score: 5 },
  { word: "ethiopia", score: 5 },
  { word: "zambia", score: 5 },
  { word: "malawi", score: 5 },
];

// Keywords that strongly indicate a non-agricultural role — subtract from score
const NEGATIVE_KEYWORDS: Array<{ word: string; penalty: number }> = [
  { word: "truck driver", penalty: 60 },
  { word: "matatu driver", penalty: 60 },
  { word: "bus driver", penalty: 60 },
  { word: "delivery driver", penalty: 60 },
  { word: "lorry driver", penalty: 60 },
  { word: "chauffeur", penalty: 60 },
  { word: "taxi driver", penalty: 60 },
  { word: "tuk tuk", penalty: 50 },
  { word: "security guard", penalty: 60 },
  { word: "watchman", penalty: 60 },
  { word: "auto mechanic", penalty: 60 },
  { word: "panel beater", penalty: 60 },
  { word: "vulcanizer", penalty: 60 },
  { word: "house help", penalty: 60 },
  { word: "housekeeper", penalty: 60 },
  { word: "waiter", penalty: 60 },
  { word: "waitress", penalty: 60 },
  { word: "barista", penalty: 60 },
  { word: "bank teller", penalty: 60 },
  { word: "hair stylist", penalty: 60 },
  { word: "salon", penalty: 40 },
  { word: "plumber", penalty: 50 },
  { word: "electrician", penalty: 50 },
  { word: "carpenter", penalty: 50 },
  { word: "mason", penalty: 50 },
];

export const DEFAULT_JOB_SOURCES: JobSource[] = [
  {
    id: "brightermonday",
    name: "BrighterMonday Kenya",
    icon: "🇰🇪",
    color: "#FF6B35",
    rssUrl: "https://www.brightermonday.co.ke/jobs/agriculture-agribusiness/rss",
    rssUrlGeneral: "https://www.brightermonday.co.ke/jobs/rss",
    category: "Kenya",
    enabled: true,
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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
    isDefault: true,
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

// ReliefWeb has a proper JSON API — far more reliable than their RSS endpoint
async function fetchReliefWebAPI(searchQuery: string, sourceName: string): Promise<RawJob[]> {
  try {
    const url =
      `https://api.reliefweb.int/v1/jobs?appname=jobhunterai` +
      `&query[value]=${encodeURIComponent(searchQuery)}` +
      `&limit=20` +
      `&fields[include][]=title` +
      `&fields[include][]=url` +
      `&fields[include][]=date` +
      `&fields[include][]=body` +
      `&fields[include][]=source` +
      `&sort[]=date:desc`;
    const r = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 12000);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((item: any) => ({
      id: `rw_${item.id}`,
      title: item.fields?.title || "",
      url: item.fields?.url || `https://reliefweb.int/node/${item.id}`,
      description: cleanHtml(item.fields?.body || "").slice(0, 500),
      publishedAt: new Date(item.fields?.date?.created || Date.now()).toISOString(),
      source: sourceName,
      relevanceScore: 0,
      relevanceReason: "",
      isNew: true,
    }));
  } catch {
    return [];
  }
}

async function fetchRSS(source: JobSource): Promise<RawJob[]> {
  const urls = [source.rssUrl, source.rssUrlGeneral].filter((u, i, a) => u && a.indexOf(u) === i) as string[];

  for (const rssUrl of urls) {
    // Route reliefweb.int RSS URLs to their proper JSON API instead
    const rwMatch = rssUrl.match(/reliefweb\.int\/jobs\/rss\.xml\?search=([^&]+)/);
    if (rwMatch) {
      const query = decodeURIComponent(rwMatch[1].replace(/\+/g, " "));
      const items = await fetchReliefWebAPI(query, source.name);
      if (items.length > 0) return items;
      continue;
    }

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

    try {
      const r = await fetchWithTimeout(`${PROXY2}${encodeURIComponent(rssUrl)}`);
      if (r.ok) {
        const data = await r.json();
        if (data.status === "ok" && data.items?.length > 0) {
          return mapRss2JsonItems(data.items, source.name);
        }
      }
    } catch {}

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

    // Positive scoring — weighted by specificity
    for (const { word, score: pts } of WESLEY_KEYWORDS) {
      if (text.includes(word)) {
        score += pts;
        matches.push(word);
      }
    }

    // Negative scoring — penalise clearly unrelated roles
    for (const { word, penalty } of NEGATIVE_KEYWORDS) {
      if (text.includes(word)) {
        score -= penalty;
      }
    }

    const finalScore = Math.max(0, Math.min(score, 100));
    return { ...job, relevanceScore: finalScore, relevanceReason: matches.slice(0, 3).join(", ") };
  });

  // Only send borderline jobs to AI for refinement — skip clearly irrelevant ones
  const highScore = prescored.filter((j) => j.relevanceScore >= 60);
  const needsAI = prescored.filter((j) => j.relevanceScore >= MIN_DISPLAY_SCORE && j.relevanceScore < 60);
  const tooLow = prescored.filter((j) => j.relevanceScore < MIN_DISPLAY_SCORE);

  if (needsAI.length > 0) {
    try {
      const batch = needsAI.slice(0, 6);
      const jobList = batch.map((j, i) => `${i + 1}. ${j.title}: ${j.description.slice(0, 100)}`).join("\n");
      const result = await aiService.scoreJobRelevance(jobList);

      if (result && Array.isArray(result)) {
        result.forEach((r: any, i: number) => {
          if (batch[i]) {
            batch[i].relevanceScore = r.score ?? batch[i].relevanceScore;
            batch[i].relevanceReason = r.reason || batch[i].relevanceReason;
          }
        });
      }
    } catch {}
  }

  // Return all scored jobs — MIN_DISPLAY_SCORE gate is applied in fetchAllFeeds
  return [...highScore, ...needsAI, ...tooLow].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export const feedService = {
  // ── SOURCE MANAGEMENT ──────────────────────────────────────────────────────

  async getSources(): Promise<JobSource[]> {
    try {
      const raw = await AsyncStorage.getItem(SOURCES_KEY);
      if (raw) {
        const stored: JobSource[] = JSON.parse(raw);
        // Merge: add any new default sources that aren't in storage yet
        const storedIds = new Set(stored.map((s) => s.id));
        const newDefaults = DEFAULT_JOB_SOURCES.filter((s) => !storedIds.has(s.id));
        if (newDefaults.length > 0) {
          const merged = [...stored, ...newDefaults];
          await AsyncStorage.setItem(SOURCES_KEY, JSON.stringify(merged));
          return merged;
        }
        return stored;
      }
      // First run — seed with defaults
      await AsyncStorage.setItem(SOURCES_KEY, JSON.stringify(DEFAULT_JOB_SOURCES));
      return DEFAULT_JOB_SOURCES;
    } catch {
      return DEFAULT_JOB_SOURCES;
    }
  },

  async saveSources(sources: JobSource[]): Promise<void> {
    await AsyncStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
  },

  async toggleSource(id: string, enabled: boolean): Promise<void> {
    const sources = await this.getSources();
    const updated = sources.map((s) => s.id === id ? { ...s, enabled } : s);
    await this.saveSources(updated);
  },

  async addSource(source: Omit<JobSource, "id" | "isDefault">): Promise<JobSource> {
    const sources = await this.getSources();
    const newSource: JobSource = {
      ...source,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      isDefault: false,
    };
    await this.saveSources([...sources, newSource]);
    return newSource;
  },

  async deleteSource(id: string): Promise<void> {
    const sources = await this.getSources();
    await this.saveSources(sources.filter((s) => s.id !== id));
  },

  async resetToDefaults(): Promise<void> {
    await AsyncStorage.setItem(SOURCES_KEY, JSON.stringify(DEFAULT_JOB_SOURCES));
  },

  // ── KEYWORD FILTERS ────────────────────────────────────────────────────────

  async getKeywordFilters(): Promise<KeywordFilters> {
    try {
      const raw = await AsyncStorage.getItem(KEYWORD_FILTERS_KEY);
      return raw ? JSON.parse(raw) : { highlights: [], blocks: [] };
    } catch {
      return { highlights: [], blocks: [] };
    }
  },

  async saveKeywordFilters(filters: KeywordFilters): Promise<void> {
    await AsyncStorage.setItem(KEYWORD_FILTERS_KEY, JSON.stringify(filters));
  },

  async addKeyword(word: string, type: "highlight" | "block"): Promise<KeywordFilters> {
    const filters = await this.getKeywordFilters();
    const key = type === "highlight" ? "highlights" : "blocks";
    const clean = word.trim().toLowerCase();
    if (!filters[key].includes(clean)) {
      filters[key] = [...filters[key], clean];
      await this.saveKeywordFilters(filters);
    }
    return filters;
  },

  async removeKeyword(word: string, type: "highlight" | "block"): Promise<KeywordFilters> {
    const filters = await this.getKeywordFilters();
    const key = type === "highlight" ? "highlights" : "blocks";
    filters[key] = filters[key].filter((w) => w !== word.toLowerCase());
    await this.saveKeywordFilters(filters);
    return filters;
  },

  // ── FEED FETCHING ──────────────────────────────────────────────────────────

  async fetchAllFeeds(onProgress?: (source: string, count: number) => void): Promise<FeedJob[]> {
    const allSources = await this.getSources();
    const enabledSources = allSources.filter((s) => s.enabled);
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

    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const unique = allJobs.filter((job) => {
      if (seenUrls.has(job.url)) return false;
      seenUrls.add(job.url);
      const t = normalizeTitle(job.title);
      if (t.length > 20 && seenTitles.has(t)) return false;
      if (t.length > 20) seenTitles.add(t);
      return true;
    });

    const withNewFlag = unique.map((job) => ({
      ...job,
      isNew: !seenIds.has(job.id),
    }));

    const scored = await scoreRelevance(withNewFlag);

    // Only show jobs that passed the minimum relevance threshold
    const relevant = scored.filter((j) => j.relevanceScore >= MIN_DISPLAY_SCORE);

    const feedJobs: FeedJob[] = relevant.map((job) => {
      const source = allSources.find((s) => s.name === job.source);
      return {
        ...job,
        sourceColor: source?.color || "#666",
        sourceIcon: source?.icon || "💼",
        sourceCategory: source?.category || "Other",
      };
    });

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

export interface KeywordFilters {
  highlights: string[];
  blocks: string[];
}

export interface JobSource {
  id: string;
  name: string;
  icon: string;
  color: string;
  rssUrl: string;
  rssUrlGeneral?: string;
  category: string;
  enabled: boolean;
  isDefault?: boolean;
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

// Keep backward-compat export for any legacy references
export const JOB_SOURCES = DEFAULT_JOB_SOURCES;
