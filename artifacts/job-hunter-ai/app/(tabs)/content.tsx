import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Share, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useColors } from "@/hooks/useColors";

type Studio = "linkedin" | "blog";

type LinkedInMode =
  | "post" | "headline" | "about"
  | "connection" | "achievement" | "comment" | "recommendation";

type BlogMode =
  | "full_article" | "outline" | "caption"
  | "newsletter" | "case_study" | "tips";

const LINKEDIN_MODES: { key: LinkedInMode; label: string; icon: string; description: string }[] = [
  { key: "post", label: "Post", icon: "create-outline", description: "Thought leadership post (150-300 words + hashtags)" },
  { key: "headline", label: "Headline", icon: "person-outline", description: "5 alternative profile headlines" },
  { key: "about", label: "About", icon: "document-text-outline", description: "Full About section (300-500 words)" },
  { key: "connection", label: "Connect", icon: "people-outline", description: "Personalized connection request" },
  { key: "achievement", label: "Win", icon: "trophy-outline", description: "Celebrate a milestone or achievement" },
  { key: "comment", label: "Comment", icon: "chatbubble-outline", description: "Smart reply to an industry post" },
  { key: "recommendation", label: "Recommend", icon: "star-outline", description: "Request a recommendation" },
];

const BLOG_MODES: { key: BlogMode; label: string; icon: string; description: string }[] = [
  { key: "full_article", label: "Article", icon: "newspaper-outline", description: "Complete publication-ready blog post" },
  { key: "outline", label: "Outline", icon: "list-outline", description: "Structured content plan with SEO keywords" },
  { key: "caption", label: "Caption", icon: "image-outline", description: "Social media captions for sharing" },
  { key: "newsletter", label: "Newsletter", icon: "mail-outline", description: "Email newsletter section" },
  { key: "case_study", label: "Case Study", icon: "analytics-outline", description: "Field experience story" },
  { key: "tips", label: "Tips", icon: "bulb-outline", description: "Actionable tips article" },
];

const TONES = ["Professional", "Conversational", "Inspirational", "Educational"] as const;
const LENGTHS = ["Short (500 words)", "Medium (1000 words)", "Long (1500+ words)"] as const;

const LINKEDIN_SUGGESTIONS = [
  "Soil health & crop productivity in Kenya",
  "Why soil testing matters before planting",
  "Fertilizer optimization for smallholder farmers",
  "Digital tools transforming East African agriculture",
  "Lessons from the field: common soil mistakes",
  "Food security and sustainable farming",
  "Agri-tech adoption challenges in Kenya",
  "Career journey: from field to consultancy",
];

const BLOG_SUGGESTIONS = [
  "Complete guide to soil fertility management in Kenya",
  "How to read a soil test report",
  "Top 5 fertilizer mistakes Kenyan farmers make",
  "Nutrition-sensitive agriculture in East Africa",
  "Climate-smart agriculture practices for Kenya",
  "From soil scientist to agri-consultant: my story",
  "Building a sustainable farm input business",
  "Digital record keeping for modern farmers",
];

async function getApiKey(): Promise<string> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  const key = await AsyncStorage.getItem("jh_gemini_api_key").catch(() => null);
  if (!key) throw new Error("Gemini API key not set. Go to Settings → API Keys to add it.");
  return key;
}

async function getProfile(): Promise<string> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const profileData = await AsyncStorage.getItem("@jobhunter:user_profile");
    if (profileData) {
      const p = JSON.parse(profileData);
      if (p.name || p.profession) {
        return `Name: ${p.name || "Wesley Kipkemoi Koech"}
Profession: ${p.profession || "Agronomist & Soil Scientist"}
Location: ${p.location || "Nairobi, Kenya"}
Experience: ${p.yearsExperience || "5+"} years
Key Skills: ${p.keySkills || "Soil fertility, fertilizer optimization, agricultural research"}
Target Roles: ${p.targetRoles || "Agronomist, Field Officer, Research roles in East Africa"}`;
      }
    }
    const cvData = await AsyncStorage.getItem("@jobhunter:cv_vault");
    if (cvData) {
      const vault = JSON.parse(cvData);
      if (vault.cvText?.length > 50) return vault.cvText.slice(0, 1000);
    }
  } catch {}
  return `Name: Wesley Kipkemoi Koech
Profession: Agronomist & Soil Scientist
Location: Nairobi, Kenya
Experience: 5+ years in soil fertility management, fertilizer optimization, agricultural research
Skills: Soil analysis, fertilizer recommendations, field training, agri-tech, crop management`;
}

async function callGemini(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = await getApiKey();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Gemini API error. Check your API key in Settings.");
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";
}

async function generateLinkedInContent(mode: LinkedInMode, topic: string, context: string, tone: string, profile: string): Promise<string> {
  const modeGuides: Record<LinkedInMode, string> = {
    post: "Write a LinkedIn post (150-300 words). Short paragraphs. End with a question or CTA. Add 3-5 hashtags at the end.",
    headline: "Write 5 alternative LinkedIn headlines (max 220 chars each). Numbered list. Keyword-rich and punchy.",
    about: "Write a LinkedIn About section (300-500 words). First person. Start with a hook. Cover expertise, impact, what you offer. End with CTA.",
    connection: "Write 3 short connection request messages (max 300 chars). Personalized, not generic. Numbered options.",
    achievement: "Write a LinkedIn achievement post (100-200 words). Professional but warm. Include impact and lessons learned.",
    comment: "Write 3 thoughtful LinkedIn comment options (2-3 sentences each). Add value, don't just agree. Numbered options.",
    recommendation: "Write a recommendation request message to send a colleague (100-150 words). Professional, specific about what to highlight.",
  };

  return callGemini(`You are writing LinkedIn content for an agronomist named Wesley Kipkemoi Koech based in Nairobi, Kenya.

Profile:
${profile}

Task: ${modeGuides[mode]}
Topic: ${topic}
Tone: ${tone}
${context ? `Additional context: ${context}` : ""}

Write content that sounds authentically like Wesley — knowledgeable, grounded in East African field experience, relatable to agricultural professionals.`);
}

async function generateBlogContent(mode: BlogMode, topic: string, context: string, tone: string, length: string, audience: string, profile: string): Promise<string> {
  const modeGuides: Record<BlogMode, string> = {
    full_article: `Write a complete blog article. Include: engaging title, introduction, subheadings, practical Kenya/East Africa examples, conclusion with takeaways. Length: ${length}.`,
    outline: "Create a detailed outline: title, hook, 5-7 main sections with subpoints, conclusion approach, 3 SEO keywords.",
    caption: "Write 3 social media caption options (50-100 words each) for sharing this topic. Include hashtags. Numbered.",
    newsletter: "Write an email newsletter section (200-300 words). Conversational. Include a subject line at the top.",
    case_study: "Write a field experience case study (400-600 words): situation, approach, results, lessons learned.",
    tips: "Write a tips article with 7-10 actionable tips. Each tip gets a bold heading and 2-3 sentence explanation. Practical for Kenyan farmers.",
  };

  return callGemini(`You are writing blog content for Wesley Kipkemoi Koech, an agronomist and soil scientist in Nairobi, Kenya.

Profile:
${profile}

Task: ${modeGuides[mode]}
Topic: ${topic}
Tone: ${tone}
Target audience: ${audience}
${context ? `Key points to include: ${context}` : ""}

Write content that draws on East African agricultural context, uses practical Kenya examples, positions Wesley as a credible expert, and is engaging and immediately publishable.`, 2000);
}

export default function ContentStudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [studio, setStudio] = useState<Studio>("linkedin");
  const [linkedInMode, setLinkedInMode] = useState<LinkedInMode>("post");
  const [blogMode, setBlogMode] = useState<BlogMode>("full_article");
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState<string>("Professional");
  const [length, setLength] = useState<string>("Medium (1000 words)");
  const [audience, setAudience] = useState("Farmers and agricultural professionals in Kenya");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 8, paddingHorizontal: 16, paddingBottom: 12 },
    title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
    subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    studioToggle: {
      flexDirection: "row", marginHorizontal: 16, marginBottom: 16,
      backgroundColor: colors.card, borderRadius: 100, padding: 4,
      borderWidth: 1, borderColor: colors.border,
    },
    studioBtn: {
      flex: 1, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 100,
    },
    studioBtnActive: { backgroundColor: colors.primary },
    studioBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
    studioBtnTextActive: { color: colors.primaryForeground },
    modeContainer: { paddingHorizontal: 16, gap: 8 },
    modeChip: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
    modeChipTextActive: { color: colors.primaryForeground },
    modeInfo: {
      flexDirection: "row", alignItems: "center", gap: 8,
      marginHorizontal: 16, marginBottom: 16, padding: 10,
      backgroundColor: colors.primary + "15", borderRadius: 10,
      borderWidth: 1, borderColor: colors.primary + "33",
    },
    modeDesc: { color: colors.primary, fontSize: 13, flex: 1 },
    form: { paddingHorizontal: 16, gap: 14 },
    field: { gap: 6 },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    sublabel: { color: colors.textMuted, fontSize: 11 },
    input: {
      backgroundColor: colors.card, borderRadius: 12,
      padding: 14, color: colors.foreground, fontSize: 15,
      borderWidth: 1, borderColor: colors.border,
    },
    textarea: { minHeight: 90, textAlignVertical: "top" },
    suggestChip: {
      paddingHorizontal: 12, paddingVertical: 8,
      backgroundColor: colors.elevated, borderRadius: 100,
      borderWidth: 1, borderColor: colors.border, maxWidth: 220,
    },
    suggestText: { color: colors.textSecondary, fontSize: 12 },
    optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    optionChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    optionChipActive: { backgroundColor: colors.primary + "22", borderColor: colors.primary },
    optionText: { color: colors.textSecondary, fontSize: 13 },
    optionTextActive: { color: colors.primary, fontWeight: "600" },
    generateBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, backgroundColor: colors.primary, borderRadius: 100, padding: 16, marginTop: 4,
    },
    generateBtnDisabled: { opacity: 0.6 },
    generateBtnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 15 },
    resultCard: {
      margin: 16, backgroundColor: colors.card,
      borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    resultHeader: {
      flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", marginBottom: 4,
    },
    resultTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    resultTitle: { color: colors.foreground, fontWeight: "600", fontSize: 15 },
    wordCount: { color: colors.textMuted, fontSize: 11, marginBottom: 12 },
    editHint: { color: colors.textMuted, fontSize: 11, marginBottom: 8, fontStyle: "italic" },
    resultInput: {
      color: colors.textSecondary, fontSize: 14, lineHeight: 22,
      textAlignVertical: "top", minHeight: 200,
    },
    actionRow: { flexDirection: "row", gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    actionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      paddingVertical: 10, backgroundColor: colors.elevated,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    actionBtnPrimary: { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50" },
    actionBtnText: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
    actionBtnTextPrimary: { color: colors.primary, fontSize: 13, fontWeight: "600" },
    regenBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, marginTop: 12,
    },
    regenText: { color: colors.textMuted, fontSize: 13 },
    plannerCard: {
      marginHorizontal: 16, marginBottom: 16,
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.primary + "33",
    },
    plannerTitle: { color: colors.foreground, fontWeight: "700", marginBottom: 4, fontSize: 15 },
    plannerSubtitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
    plannerRow: { flexDirection: "row", justifyContent: "space-between" },
    plannerDay: { alignItems: "center", gap: 4 },
    plannerDayLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
    plannerDot: { width: 8, height: 8, borderRadius: 4 },
    plannerDayType: { color: colors.textMuted, fontSize: 9 },
  });

  const generate = async () => {
    if (!topic.trim()) {
      Alert.alert("Topic required", "Please enter a topic or tap a suggestion");
      return;
    }
    setLoading(true);
    setResult("");
    setCopied(false);
    try {
      const profile = await getProfile();
      let output = "";
      if (studio === "linkedin") {
        output = await generateLinkedInContent(linkedInMode, topic, context, tone, profile);
      } else {
        output = await generateBlogContent(blogMode, topic, context, tone, length, audience, profile);
      }
      setResult(output);
    } catch (err: any) {
      Alert.alert("Generation failed", err.message || "Please check your Gemini API key in Settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: result, title: studio === "linkedin" ? "LinkedIn Content" : "Blog Article" });
    } catch {}
  };

  const currentMode = studio === "linkedin"
    ? LINKEDIN_MODES.find(m => m.key === linkedInMode)
    : BLOG_MODES.find(m => m.key === blogMode);

  const suggestions = studio === "linkedin" ? LINKEDIN_SUGGESTIONS : BLOG_SUGGESTIONS;

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 50 }}>

      <View style={s.header}>
        <Text style={s.title}>Content Studio</Text>
        <Text style={s.subtitle}>Build your professional brand with AI</Text>
      </View>

      {/* LinkedIn / Blog toggle */}
      <View style={s.studioToggle}>
        <TouchableOpacity
          style={[s.studioBtn, studio === "linkedin" && s.studioBtnActive]}
          onPress={() => { setStudio("linkedin"); setResult(""); }}
        >
          <Ionicons name="logo-linkedin" size={18} color={studio === "linkedin" ? colors.primaryForeground : colors.textSecondary} />
          <Text style={[s.studioBtnText, studio === "linkedin" && s.studioBtnTextActive]}>LinkedIn</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.studioBtn, studio === "blog" && s.studioBtnActive]}
          onPress={() => { setStudio("blog"); setResult(""); }}
        >
          <Ionicons name="newspaper-outline" size={18} color={studio === "blog" ? colors.primaryForeground : colors.textSecondary} />
          <Text style={[s.studioBtnText, studio === "blog" && s.studioBtnTextActive]}>Blog</Text>
        </TouchableOpacity>
      </View>

      {/* Mode chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={s.modeContainer}>
        {(studio === "linkedin" ? LINKEDIN_MODES : BLOG_MODES).map((m) => {
          const isActive = studio === "linkedin" ? linkedInMode === m.key : blogMode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[s.modeChip, isActive && s.modeChipActive]}
              onPress={() => {
                if (studio === "linkedin") setLinkedInMode(m.key as LinkedInMode);
                else setBlogMode(m.key as BlogMode);
                setResult("");
              }}
            >
              <Ionicons name={m.icon as any} size={13} color={isActive ? colors.primaryForeground : colors.textSecondary} />
              <Text style={[s.modeChipText, isActive && s.modeChipTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Mode description */}
      {currentMode && (
        <View style={s.modeInfo}>
          <Ionicons name={currentMode.icon as any} size={15} color={colors.primary} />
          <Text style={s.modeDesc}>{currentMode.description}</Text>
        </View>
      )}

      <View style={s.form}>
        {/* Topic */}
        <View style={s.field}>
          <Text style={s.label}>Topic *</Text>
          <TextInput
            style={[s.input, s.textarea]}
            placeholder={studio === "linkedin" ? "e.g. Why soil testing matters before planting season" : "e.g. Complete guide to soil fertility management in Kenya"}
            placeholderTextColor={colors.textMuted}
            value={topic}
            onChangeText={setTopic}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Suggestions */}
        <View style={s.field}>
          <Text style={s.label}>💡 Tap a suggestion</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {suggestions.map((sg) => (
                <TouchableOpacity key={sg} style={s.suggestChip} onPress={() => setTopic(sg)}>
                  <Text style={s.suggestText} numberOfLines={2}>{sg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Context */}
        <View style={s.field}>
          <Text style={s.label}>Additional Context (optional)</Text>
          <Text style={s.sublabel}>Specific points, data, or field experience to include</Text>
          <TextInput
            style={[s.input, s.textarea]}
            placeholder="e.g. Based on my fieldwork in Nakuru County where I observed..."
            placeholderTextColor={colors.textMuted}
            value={context}
            onChangeText={setContext}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Tone */}
        <View style={s.field}>
          <Text style={s.label}>Tone</Text>
          <View style={s.optionRow}>
            {TONES.map((t) => (
              <TouchableOpacity key={t} style={[s.optionChip, tone === t && s.optionChipActive]} onPress={() => setTone(t)}>
                <Text style={[s.optionText, tone === t && s.optionTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Blog-only options */}
        {studio === "blog" && (
          <>
            <View style={s.field}>
              <Text style={s.label}>Length</Text>
              <View style={s.optionRow}>
                {LENGTHS.map((l) => (
                  <TouchableOpacity key={l} style={[s.optionChip, length === l && s.optionChipActive]} onPress={() => setLength(l)}>
                    <Text style={[s.optionText, length === l && s.optionTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Target Audience</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Smallholder farmers in Kenya"
                placeholderTextColor={colors.textMuted}
                value={audience}
                onChangeText={setAudience}
              />
            </View>
          </>
        )}

        {/* Generate button */}
        <TouchableOpacity style={[s.generateBtn, loading && s.generateBtnDisabled]} onPress={generate} disabled={loading}>
          {loading ? (
            <>
              <ActivityIndicator color={colors.primaryForeground} size="small" />
              <Text style={s.generateBtnText}>Writing content...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
              <Text style={s.generateBtnText}>
                Generate {studio === "linkedin" ? "LinkedIn" : "Blog"} Content
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Result — editable */}
      {result ? (
        <View style={s.resultCard}>
          <View style={s.resultHeader}>
            <View style={s.resultTitleRow}>
              <Ionicons
                name={studio === "linkedin" ? "logo-linkedin" : "newspaper-outline"}
                size={18}
                color={studio === "linkedin" ? "#0A66C2" : colors.green}
              />
              <Text style={s.resultTitle}>
                {studio === "linkedin" ? "LinkedIn Content" : "Blog Content"}
              </Text>
            </View>
            <Text style={s.wordCount}>{result.split(" ").length} words</Text>
          </View>

          <Text style={s.editHint}>Tap to edit — change words, adjust your tone, make it yours</Text>

          <TextInput
            style={s.resultInput}
            value={result}
            onChangeText={setResult}
            multiline
            textAlignVertical="top"
            autoCorrect
            spellCheck
          />

          <View style={s.actionRow}>
            <TouchableOpacity style={[s.actionBtn, copied && { borderColor: colors.green }]} onPress={handleCopy}>
              <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={16} color={copied ? colors.green : colors.foreground} />
              <Text style={[s.actionBtnText, copied && { color: colors.green }]}>{copied ? "Copied!" : "Copy"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={16} color={colors.foreground} />
              <Text style={s.actionBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.regenBtn} onPress={generate}>
            <Ionicons name="refresh" size={14} color={colors.textMuted} />
            <Text style={s.regenText}>Regenerate from scratch</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Weekly Planner */}
      <View style={s.plannerCard}>
        <Text style={s.plannerTitle}>📅 Weekly Content Target</Text>
        <Text style={s.plannerSubtitle}>5 LinkedIn posts + 5 blog articles per week</Text>
        <View style={s.plannerRow}>
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
            <View key={day} style={s.plannerDay}>
              <Text style={s.plannerDayLabel}>{day}</Text>
              <View style={[s.plannerDot, { backgroundColor: "#0A66C2" }]} />
              <Text style={s.plannerDayType}>LI</Text>
              <View style={[s.plannerDot, { backgroundColor: colors.green }]} />
              <Text style={s.plannerDayType}>Blog</Text>
            </View>
          ))}
        </View>
      </View>

    </ScrollView>
  );
}
