"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Sparkles, User, ChevronLeft, ChevronRight, ChevronDown, Clapperboard, Gamepad2, RotateCw } from "lucide-react";
import { PromptInputBox, type PromptSendPayload, type ModeId, type CharacterSelection } from "@/components/ui/ai-prompt-box";
import DreamNavbar from "@/components/ui/dream-navbar";
import { type StoryPage } from "@/lib/dashboard-data";
import { StoryBook } from "@/components/dashboard/story-book";
import {
  createJob,
  fetchJob,
  fetchJobs,
  getAssetUrl,
  type Job,
} from "@/lib/jobs";
import {
  GAMEPLAY_BACKGROUNDS,
  GAMEPLAY_CATEGORY_OPTIONS,
  VIDEO_MODE_OPTIONS,
  getDefaultGameplayBackgroundId,
  type GameplayCategory,
  type VideoGenerationType,
} from "@/lib/video-generation-options";

import styles from "./chat-page.module.css";

interface ThinkingStep {
  title: string;
  detail: string;
  stageKey?: string;
  imageUrls?: string[];
  data?: unknown;
}

interface GameplaySelection {
  category: GameplayCategory;
  backgroundId: string;
  backgroundName: string;
}

interface SearchReference {
  title: string;
  url: string;
  author?: string;
  publishedDate?: string;
  snippet?: string;
}

interface StoryCharacterDrawingInput {
  url?: string;
  imageData?: string;
  description?: string;
  notes?: string;
}

interface StoryCharacterOption {
  id: string;
  name: string;
  role: string;
  avatar: string;
  source: "job";
  jobId?: string;
  description?: string;
  referenceDrawings: StoryCharacterDrawingInput[];
}

interface StoryBookMessageData {
  title: string;
  ageBand: string;
  cover: string;
  pages: StoryPage[];
  jobId?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  backendJson?: Record<string, unknown> | null;
  references?: SearchReference[];
  basePrompt?: string;
  mode?: ModeId | "normal";
  characterSelection?: CharacterSelection | null;
  videoType?: VideoGenerationType | null;
  gameplaySelection?: GameplaySelection | null;
  thinkingSteps?: ThinkingStep[];
  thinkingDuration?: number;
  storyBook?: StoryBookMessageData | null;
  storyJobId?: string;
}

interface MessageGroup {
  role: "user" | "assistant";
  messages: Message[];
}

interface ChatBackendResponse {
  answer?: string;
  detail?: string;
  category?: string;
  safety?: string;
  reading_level?: string;
  response_style?: string;
  model?: string;
  mcp_used?: boolean;
  mcp_server?: string | null;
  mcp_output?: unknown;
  [key: string]: unknown;
}

type StorybookResponse = {
  workflow_used?: string;
  story?: {
    title?: string;
    title_page_text?: string;
    end_page_text?: string;
    right_pages?: Array<{ page_number?: number; chapter?: string; text?: string; audio_url?: string }>;
  };
  spreads?: Array<{
    spread_index?: number;
    left?: { image_url?: string; chapter?: string; text?: string; title?: string };
    right?: { image_url?: string; chapter?: string; text?: string; title?: string; audio_url?: string };
  }>;
  characters?: Array<{
    name?: string;
    brief?: string;
    backstory?: {
      name?: string;
      archetype?: string;
      narrative_backstory?: string;
      visual_signifiers?: string[];
      [key: string]: unknown;
    } | null;
    image_prompt?: Record<string, unknown> | null;
    generated_images?: string[];
    warnings?: string[];
  }>;
  generated_images?: string[];
  scene_prompts?: {
    cover_prompt?: string;
    illustration_prompts?: string[];
    negative_prompt?: string;
  };
  saved_character_job_ids?: string[];
  warnings?: string[];
};

const TITLE_WORDS = ["What", "shall", "we", "dream", "up?"];
// 5 images — 2:3 portrait, matching the story book's per-page illustration ratio
const DREAM_STAGE_IMAGES = [
  "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1475274047050-1d0c55b91e0a?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=480&h=720&auto=format&fit=crop&q=80",
];

const COMMON_THINKING_STEPS: ThinkingStep[] = [
  {
    title: "Reading your idea",
    detail: "Parsing the prompt to understand the core theme, setting, and emotional tone you are looking for in the story.",
  },
  {
    title: "Building the world",
    detail: "Sketching the story's environment — whether an enchanted forest, underwater realm, or sky kingdom — to ground the narrative.",
  },
  {
    title: "Designing the characters",
    detail: "Inventing memorable, kid-friendly heroes, sidekicks, and perhaps a gentle antagonist with relatable motivations.",
  },
  {
    title: "Plotting the adventure",
    detail: "Mapping the narrative arc: a call to adventure, rising tension, a challenge to overcome, and a satisfying resolution.",
  },
  {
    title: "Choosing the language",
    detail: "Selecting vocabulary that is vivid, age-appropriate, and easy to follow while keeping sentences lively and engaging.",
  },
  {
    title: "Weaving in the magic",
    detail: "Adding the unexpected — a talking creature, a hidden door, a glowing artifact — to spark wonder and imagination.",
  },
  {
    title: "Checking the lesson",
    detail: "Ensuring the story carries a gentle, positive message about courage, kindness, or curiosity without being preachy.",
  },
  {
    title: "Polishing the narrative",
    detail: "Reviewing pacing and flow, smoothing transitions, and ensuring every sentence earns its place in the story.",
  },
];

const STORY_IMAGE_STEP: ThinkingStep = {
  title: "Generating scene images",
  detail: "Creating 2:3 portrait illustrations one by one so you can preview the visual style as the story comes together.",
  imageUrls: DREAM_STAGE_IMAGES,
};

const STORY_THINKING_STEPS: ThinkingStep[] = [
  ...COMMON_THINKING_STEPS.slice(0, 3),
  STORY_IMAGE_STEP,
  ...COMMON_THINKING_STEPS.slice(3),
];

const VIDEO_NORMAL_THINKING_STEPS: ThinkingStep[] = [
  {
    title: "Reading your concept",
    detail: "Extracting the core action, mood, and pacing needed for a strong narrative video.",
  },
  {
    title: "Writing shot plan",
    detail: "Converting your idea into a scene-by-scene timeline for smooth visual continuity.",
  },
  {
    title: "Designing visual style",
    detail: "Choosing framing, color mood, and transitions that fit your prompt.",
  },
  {
    title: "Generating keyframes",
    detail: "Building core visual moments that anchor the final motion sequence.",
  },
  {
    title: "Syncing voice and music",
    detail: "Balancing narration cadence and background track to match scene timing.",
  },
  {
    title: "Rendering the final cut",
    detail: "Compositing visuals, effects, and audio into a polished vertical video.",
  },
  {
    title: "Quality review",
    detail: "Checking pacing, transitions, and readability before final delivery.",
  },
];

const VIDEO_GAMEPLAY_THINKING_STEPS: ThinkingStep[] = [
  {
    title: "Reading your concept",
    detail: "Detecting hook, tone, and payoff so the gameplay edit stays engaging from start to finish.",
  },
  {
    title: "Picking gameplay rhythm",
    detail: "Matching your narrative beats to fast gameplay pacing for short-form momentum.",
  },
  {
    title: "Planning hook sequence",
    detail: "Structuring opening seconds, mid-clip escalation, and ending punchline.",
  },
  {
    title: "Generating vertical scenes",
    detail: "Producing stylized scene layers optimized for quick, high-retention viewing.",
  },
  {
    title: "Layering captions and voice",
    detail: "Timing overlays and narration so text remains clear during rapid motion.",
  },
  {
    title: "Mixing gameplay and story",
    detail: "Blending gameplay footage with narrative visuals into one coherent clip.",
  },
  {
    title: "Final render and check",
    detail: "Exporting the gameplay video and validating smooth transitions end-to-end.",
  },
];

const CHAT_PENDING_THINKING_STEPS: ThinkingStep[] = [
  {
    title: "Receiving your question",
    detail: "The chat orchestrator accepted your message and prepared context from recent history.",
  },
  {
    title: "Running question reader agent",
    detail: "Classifying question type and required reading level with kid-safe policy checks.",
  },
  {
    title: "Running response agent",
    detail: "Generating a child-friendly answer using the selected response style.",
  },
  {
    title: "Finalizing answer",
    detail: "Validating the final response and returning it to chat.",
  },
];

const DEFAULT_GAMEPLAY_CATEGORY: GameplayCategory = GAMEPLAY_CATEGORY_OPTIONS[0]?.id ?? "minecraft";
const DEFAULT_GAMEPLAY_BACKGROUND_ID = getDefaultGameplayBackgroundId(DEFAULT_GAMEPLAY_CATEGORY);

const easeOutExpo = [0.22, 1, 0.36, 1] as const;
const THINKING_TOTAL_MS = 30000;
const STEP_INITIAL_DELAY_MS = 500;
const IMAGE_REVEAL_INTERVAL_MS = 260;
const AUTO_SCROLL_THRESHOLD_PX = 120;

function getThinkingSteps(mode: ModeId | "normal", videoType: VideoGenerationType | null = null): ThinkingStep[] {
  if (mode === "story") return STORY_THINKING_STEPS;
  if (mode === "video") return videoType === "gameplay" ? VIDEO_GAMEPLAY_THINKING_STEPS : VIDEO_NORMAL_THINKING_STEPS;
  if (mode === "normal" || mode === "search") return CHAT_PENDING_THINKING_STEPS;
  return COMMON_THINKING_STEPS;
}

function toTitleCase(input: string | undefined, fallback: string): string {
  const raw = (input || "").trim();
  if (!raw) return fallback;
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatJsonForDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "");
  } catch {
    return rawUrl;
  }
}

const REFERENCE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatReferenceDate(rawDate?: string): string | null {
  const value = (rawDate || "")
    .replace(/^published\s*date\s*:\s*/i, "")
    .replace(/^date\s*:\s*/i, "")
    .trim();
  if (!value) return null;
  const dateToken = extractDateToken(value) || value;
  const parsed = new Date(dateToken);
  if (Number.isNaN(parsed.getTime())) return value;
  return REFERENCE_DATE_FORMATTER.format(parsed);
}

function referenceLogoUrl(rawUrl: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(rawUrl)}`;
}

function normalizeSnippet(raw: string, maxLen = 220): string {
  const clean = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function extractDateToken(value: string): string | null {
  const clean = value.trim();
  if (!clean) return null;

  const isoMatch = clean.match(/\d{4}-\d{2}-\d{2}(?:T[0-9:.+-]+Z?)?/i);
  if (isoMatch?.[0]) return isoMatch[0];

  const naturalDateMatch = clean.match(
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}\b/i,
  );
  if (naturalDateMatch?.[0]) return naturalDateMatch[0];

  return null;
}

function extractMcpReferences(mcpOutput: unknown): SearchReference[] {
  if (!mcpOutput || typeof mcpOutput !== "object") return [];
  const rawOutput = (mcpOutput as Record<string, unknown>).output;
  if (typeof rawOutput !== "string" || !rawOutput.trim()) return [];

  const text = rawOutput.replace(/\r\n/g, "\n");
  const refs: SearchReference[] = [];
  const seen = new Set<string>();
  const entryRegex = /Title:[^\S\n]*(.+?)\n(?:Author:[^\S\n]*(.*?)\n)?(?:Published Date:[^\S\n]*(.*?)\n)?URL:[^\S\n]*(https?:\/\/\S+)\n(?:Text:[^\S\n]*([\s\S]*?))?(?=\nTitle:\s|$)/g;

  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(text)) !== null) {
    const title = decodeHtmlEntities((match[1] || "").trim());
    let author = decodeHtmlEntities((match[2] || "").trim());
    let publishedDate = (match[3] || "")
      .replace(/^published\s*date\s*:\s*/i, "")
      .replace(/^date\s*:\s*/i, "")
      .trim();
    const url = (match[4] || "").trim();
    const snippetRaw = match[5] || "";
    const snippet = normalizeSnippet(snippetRaw);

    if (!publishedDate && /^(published\s*date|date)\s*:/i.test(author)) {
      publishedDate = author;
      author = "";
    }
    if (!publishedDate) {
      const inferred = extractDateToken(decodeHtmlEntities(snippetRaw));
      if (inferred) publishedDate = inferred;
    }

    if (!title || !url) continue;
    const dedupeKey = url.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    refs.push({
      title,
      url,
      author: author || undefined,
      publishedDate: publishedDate || undefined,
      snippet: snippet || undefined,
    });
    if (refs.length >= 8) break;
  }

  return refs;
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

function isDataUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /^data:/i.test(value.trim());
}

function toAbsoluteClientUrl(value: string | undefined): string {
  const normalized = (value || "").trim();
  if (!normalized) return "";
  if (isHttpUrl(normalized) || isDataUrl(normalized)) return normalized;
  if (typeof window === "undefined") return normalized;
  if (normalized.startsWith("/")) return `${window.location.origin}${normalized}`;
  return `${window.location.origin}/${normalized}`;
}

function compactText(value: string | undefined, maxChars = 240): string {
  const cleaned = (value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxChars - 1))}…`;
}

function collectJobCharacterReferenceDrawings(job: Job): StoryCharacterDrawingInput[] {
  const drawings: StoryCharacterDrawingInput[] = [];
  const seen = new Set<string>();
  const assets = Array.isArray(job.assets) ? job.assets : [];

  for (const asset of assets) {
    const localAssetUrl = toAbsoluteClientUrl(getAssetUrl(job.id, asset.filename));
    if (isHttpUrl(localAssetUrl) && !seen.has(localAssetUrl)) {
      seen.add(localAssetUrl);
      drawings.push({
        url: localAssetUrl,
        description: "Stored character asset from Dream job storage.",
        notes: "Use this as canonical identity lock for face, hairstyle, body proportions, and outfit silhouette.",
      });
    }

    const originalUrl = typeof asset.original_url === "string" ? asset.original_url.trim() : "";
    if (!isHttpUrl(originalUrl) || seen.has(originalUrl)) continue;
    seen.add(originalUrl);
    drawings.push({
      url: originalUrl,
      description: "Canonical character reference image from character vault.",
      notes: "Use this as identity lock for face, hairstyle, body proportions, and outfit silhouette.",
    });
  }

  const generatedImagesRaw =
    job.result_payload && typeof job.result_payload === "object"
      ? (job.result_payload as { generated_images?: unknown }).generated_images
      : [];
  const generatedImages = Array.isArray(generatedImagesRaw) ? generatedImagesRaw : [];
  for (const value of generatedImages) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!isHttpUrl(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    drawings.push({
      url: normalized,
      description: "Generated character reference image from previous job.",
      notes: "Reuse this exact identity for the storybook scenes.",
    });
  }

  return drawings;
}

function jobToStoryCharacterOption(job: Job): StoryCharacterOption | null {
  const backstory =
    job.result_payload && typeof job.result_payload === "object"
      ? (job.result_payload as {
          backstory?: {
            name?: string;
            archetype?: string;
            era?: string;
            origin?: string;
            narrative_backstory?: string;
          };
        }).backstory
      : undefined;

  const drawings = collectJobCharacterReferenceDrawings(job);
  const avatarAsset = job.assets.find((asset) => typeof asset.mime_type === "string" && asset.mime_type.startsWith("image/"));
  const avatarUrl = avatarAsset ? getAssetUrl(job.id, avatarAsset.filename) : drawings[0]?.url ?? "";
  const name = (backstory?.name || job.title || "Unnamed Character").trim();
  if (!name) return null;

  return {
    id: job.id,
    name,
    role: (backstory?.archetype || backstory?.origin || "").trim() || "Story Companion",
    avatar: avatarUrl,
    source: "job",
    jobId: job.id,
    description: compactText(backstory?.narrative_backstory || job.user_prompt || "", 240),
    referenceDrawings: drawings,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Could not read selected image file."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Could not read selected image file."));
    reader.readAsDataURL(file);
  });
}

function extractErrorDetail(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const nested = (detail as { message?: unknown }).message;
    if (typeof nested === "string") return nested;
  }
  return "";
}

function buildInlineCharacterPrompt(params: {
  name: string;
  role: string;
  description: string;
  storyPrompt: string;
}): string {
  const roleLine = params.role ? `Role: ${params.role}.` : "";
  const storyLine = params.storyPrompt
    ? `Story context: ${params.storyPrompt}.`
    : "";
  return (
    `Create a storybook character named ${params.name}. `
    + `${roleLine} `
    + `Description: ${params.description}. `
    + `${storyLine} `
    + "Return a consistent character identity with strong visual signifiers for scene reuse."
  ).trim();
}

function unwrapStorybookPayload(payload: unknown): StorybookResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as { backend_response?: unknown };
  const workflowPayload = envelope.backend_response && typeof envelope.backend_response === "object"
    ? envelope.backend_response
    : payload;
  if (!workflowPayload || typeof workflowPayload !== "object") return null;
  return workflowPayload as StorybookResponse;
}

function buildStoryBookFromResponse(
  workflowPayload: StorybookResponse | null,
  fallbackAgeBand: string,
  jobId?: string,
): StoryBookMessageData | null {
  if (!workflowPayload?.story) return null;
  const story = workflowPayload.story;
  const rightPages = Array.isArray(story.right_pages) ? story.right_pages : [];
  if (!rightPages.length) return null;

  const spreads = Array.isArray(workflowPayload.spreads) ? workflowPayload.spreads : [];
  const generatedImages = Array.isArray(workflowPayload.generated_images) ? workflowPayload.generated_images : [];
  const spreadMap = new Map(
    spreads
      .filter((spread) => typeof spread?.spread_index === "number")
      .map((spread) => [Number(spread.spread_index), spread]),
  );

  const rightPageMap = new Map(
    rightPages
      .filter((page) => typeof page?.page_number === "number")
      .map((page) => [Number(page.page_number), page]),
  );

  const cover =
    generatedImages[0]
    || spreadMap.get(0)?.left?.image_url
    || spreadMap.get(1)?.left?.image_url
    || "";
  if (!cover) return null;

  const pages: StoryPage[] = [];
  const sortedPageNumbers = Array.from(rightPageMap.keys()).sort((a, b) => a - b);
  for (const pageNumber of sortedPageNumbers) {
    const spread = spreadMap.get(pageNumber);
    const illustration = spread?.left?.image_url || generatedImages[pageNumber] || cover;
    pages.push({
      text: "",
      illustration,
    });
    const rightPage = rightPageMap.get(pageNumber);
    pages.push({
      chapter: rightPage?.chapter || `Chapter ${pageNumber}`,
      text: rightPage?.text || "Story text unavailable for this page.",
      audioUrl: rightPage?.audio_url || spread?.right?.audio_url,
    });
  }

  pages.push({
    isEnd: true,
    text: story.end_page_text || "The story ends with hope and a smile.",
  });

  return {
    title: story.title || "Generated Storybook",
    ageBand: fallbackAgeBand || "5-8",
    cover,
    pages,
    jobId,
  };
}

function stageToReadableTitle(stage: string): string {
  const normalized = stage.trim().replace(/[_-]+/g, " ");
  if (!normalized) return "Progress";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildProgressStepKey(stage: string, data: unknown): string {
  const normalizedStage = (stage || "progress").trim() || "progress";
  let key = `progress:${normalizedStage}`;

  if (!data || typeof data !== "object") return key;
  const payload = data as Record<string, unknown>;
  const sceneIndex =
    typeof payload.scene_index === "number"
      ? Number(payload.scene_index)
      : Number.isFinite(Number(payload.scene_index))
        ? Number(payload.scene_index)
        : null;
  const attempt =
    typeof payload.attempt === "number"
      ? Number(payload.attempt)
      : Number.isFinite(Number(payload.attempt))
        ? Number(payload.attempt)
        : null;
  const pageNumber =
    typeof payload.page_number === "number"
      ? Number(payload.page_number)
      : Number.isFinite(Number(payload.page_number))
        ? Number(payload.page_number)
        : null;
  const characterIndex =
    typeof payload.character_index === "number"
      ? Number(payload.character_index)
      : Number.isFinite(Number(payload.character_index))
        ? Number(payload.character_index)
        : null;

  if (sceneIndex !== null) {
    key += `:scene:${sceneIndex}`;
  }
  if (pageNumber !== null) {
    key += `:page:${pageNumber}`;
  }
  if (characterIndex !== null) {
    key += `:character:${characterIndex}`;
  }
  if (attempt !== null) {
    key += `:attempt:${attempt}`;
  }
  return key;
}

function buildChatSuccessThinkingSteps(meta: {
  category?: string;
  safety?: string;
  readingLevel?: string;
  responseStyle?: string;
  model?: string;
  mode: ModeId | "normal";
  mcpUsed?: boolean;
  mcpServer?: string | null;
  mcpOutput?: unknown;
  backendPayload: Record<string, unknown>;
  durationMs: number;
}): ThinkingStep[] {
  const category = toTitleCase(meta.category, "General");
  const safety = toTitleCase(meta.safety, "Safe");
  const readingLevel = (meta.readingLevel || "8-10").trim();
  const responseStyle = toTitleCase(meta.responseStyle, "Explainer");
  const model = (meta.model || "Unknown model").trim();
  const mcpServer = (meta.mcpServer || "").trim();
  const seconds = (meta.durationMs / 1000).toFixed(meta.durationMs < 1000 ? 2 : 1);
  const responsePlanDetail = meta.mode === "search"
    ? meta.mcpUsed
      ? `Search mode active. MCP server used: ${mcpServer || "Exa MCP"}. Style: ${responseStyle}. Model: ${model}.`
      : `Search mode active. MCP unavailable for this run; answered with ${model} using ${responseStyle} style.`
    : `Selected style: ${responseStyle}. Generated with ${model}.`;

  return [
    {
      title: "Receiving your question",
      detail: "The chat orchestrator accepted your message and prepared recent conversation context.",
      data: { step: "request_received", mode: meta.mode },
    },
    {
      title: "Question reader output",
      detail: `Category: ${category} • Safety: ${safety} • Reading level: ${readingLevel}.`,
      data: {
        category: meta.category ?? "general",
        safety: meta.safety ?? "safe",
        reading_level: readingLevel,
      },
    },
    {
      title: "Response plan",
      detail: responsePlanDetail,
      data: {
        response_style: meta.responseStyle ?? "explainer",
        model,
        mcp_used: Boolean(meta.mcpUsed),
        mcp_server: mcpServer || null,
        mcp_output: meta.mcpOutput ?? null,
      },
    },
    {
      title: "Delivered to chat",
      detail: `Backend response completed in ${seconds}s.`,
      data: meta.backendPayload,
    },
  ];
}

function buildChatErrorThinkingSteps(detail: string, durationMs: number): ThinkingStep[] {
  const seconds = (durationMs / 1000).toFixed(durationMs < 1000 ? 2 : 1);
  return [
    {
      title: "Receiving your question",
      detail: "The chat orchestrator accepted your message.",
      data: { step: "request_received" },
    },
    {
      title: "Agent execution failed",
      detail: detail || "The backend returned an unknown chat error.",
      data: { error: detail || "Unknown chat backend error." },
    },
    {
      title: "Returned error response",
      detail: `Request ended after ${seconds}s. You can retry once the backend issue is resolved.`,
      data: { duration_ms: durationMs },
    },
  ];
}

const blockMotion = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: (delay = 0) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.74, delay, ease: easeOutExpo },
  }),
};

const headingLineMotion = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

const headingWordMotion = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.62, ease: easeOutExpo },
  },
};

function groupMessages(messages: Message[]): MessageGroup[] {
  return messages.reduce<MessageGroup[]>((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.role === msg.role) {
      last.messages.push(msg);
    } else {
      acc.push({ role: msg.role, messages: [msg] });
    }
    return acc;
  }, []);
}

function formatStoryPromptWithCharacter(prompt: string, characterSelection: CharacterSelection | null) {
  if (!characterSelection) return prompt;
  return `${prompt}\n\nCharacter: ${characterSelection.name} (${characterSelection.type === "create" ? "new" : "existing"})`;
}

function formatVideoPromptWithType(
  prompt: string,
  videoType: VideoGenerationType | null,
  gameplaySelection: GameplaySelection | null = null,
) {
  if (!videoType) return prompt;
  if (videoType === "gameplay" && gameplaySelection) {
    const categoryLabel = GAMEPLAY_CATEGORY_OPTIONS.find((option) => option.id === gameplaySelection.category)?.label ?? gameplaySelection.category;
    return `${prompt}\n\nVideo Type: Gameplay\nGameplay Style: ${categoryLabel} • ${gameplaySelection.backgroundName}`;
  }
  return `${prompt}\n\nVideo Type: Normal`;
}

function normalizeAssistantMessageForDisplay(input: string): string {
  let text = (input || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Recover line breaks for flattened numbered sections from backend responses.
  text = text.replace(/([.!?])\s+(?=\d+\.\s+)/g, "$1\n");
  text = text.replace(/(:)\s+(?=\d+[\.\)]\s*)/g, "$1\n");
  text = text.replace(/\s+(?=sources?:\s)/gi, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

function renderInlineBoldText(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null = null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      out.push(<React.Fragment key={`txt-${key++}`}>{text.slice(last, match.index)}</React.Fragment>);
    }
    out.push(<strong key={`bold-${key++}`}>{match[1]}</strong>);
    last = pattern.lastIndex;
  }

  if (last < text.length) {
    out.push(<React.Fragment key={`txt-${key++}`}>{text.slice(last)}</React.Fragment>);
  }
  return out;
}

function renderAssistantMessageContent(content: string): React.ReactNode {
  const normalized = normalizeAssistantMessageForDisplay(content);
  if (!normalized) return "";

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ordered" | "unordered" | null = null;
  let key = 0;

  const flushList = () => {
    if (!listItems.length || !listType) return;
    if (listType === "ordered") {
      blocks.push(
        <ol key={`ol-${key++}`} className={styles.chatMarkdownOrderedList}>
          {listItems.map((item, index) => (
            <li key={`li-${key++}-${index}`}>{renderInlineBoldText(item)}</li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`ul-${key++}`} className={styles.chatMarkdownUnorderedList}>
          {listItems.map((item, index) => (
            <li key={`li-${key++}-${index}`}>{renderInlineBoldText(item)}</li>
          ))}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const orderedMatch = line.match(/^\d+[\.\)]\s*(.+)$/);
    if (orderedMatch) {
      if (listType && listType !== "ordered") flushList();
      listType = "ordered";
      listItems.push(orderedMatch[1].trim());
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      if (listType && listType !== "unordered") flushList();
      listType = "unordered";
      listItems.push(unorderedMatch[1].trim());
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${key++}`} className={styles.chatMarkdownParagraph}>
        {renderInlineBoldText(line)}
      </p>
    );
  }

  flushList();
  return <div className={styles.chatMarkdownContent}>{blocks}</div>;
}

function getStoryCharacterStep(selection: CharacterSelection | null): ThinkingStep {
  return {
    title: "Choosing character style",
    detail: selection?.type === "existing"
      ? `Selected ${selection.name} as the lead character before story generation.`
      : "Selected no fixed character and used AI creativity before story generation.",
  };
}

function getVideoTypeStep(videoType: VideoGenerationType | null, gameplaySelection: GameplaySelection | null): ThinkingStep {
  if (videoType === "gameplay" && gameplaySelection) {
    const categoryLabel = GAMEPLAY_CATEGORY_OPTIONS.find((option) => option.id === gameplaySelection.category)?.label ?? gameplaySelection.category;
    return {
      title: "Choosing video format",
      detail: `Selected gameplay video mode with ${categoryLabel} • ${gameplaySelection.backgroundName}.`,
    };
  }
  return {
    title: "Choosing video format",
    detail: "Selected normal narrative video mode before generation.",
  };
}

export default function ChatPage() {
  const [queryMode, setQueryMode] = useState("");
  const [queryCharacterId, setQueryCharacterId] = useState("");
  const hasAppliedQueryCharacterRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwaitingBackendReply, setIsAwaitingBackendReply] = useState(false);
  const [isAwaitingStoryReply, setIsAwaitingStoryReply] = useState(false);
  const [isClosingLogs, setIsClosingLogs] = useState(false);
  const [isThinkingStreamActive, setIsThinkingStreamActive] = useState(false);
  const [hasActiveStoryCharacterChoice, setHasActiveStoryCharacterChoice] = useState(false);
  const [hasActiveVideoTypeChoice, setHasActiveVideoTypeChoice] = useState(false);
  const [composerMode, setComposerMode] = useState<ModeId | null>(null);
  const [activeRunMode, setActiveRunMode] = useState<ModeId | "normal">("normal");
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<ThinkingStep[]>(COMMON_THINKING_STEPS);
  const [activeStoryMessageId, setActiveStoryMessageId] = useState<string | null>(null);
  const [activeVideoMessageId, setActiveVideoMessageId] = useState<string | null>(null);
  const [activeStoryCharacterSelection, setActiveStoryCharacterSelection] = useState<CharacterSelection | null>(null);
  const [activeStoryCharacterId, setActiveStoryCharacterId] = useState<string>("");
  const [activeVideoType, setActiveVideoType] = useState<VideoGenerationType | null>(null);
  const [activeGameplaySelection, setActiveGameplaySelection] = useState<GameplaySelection | null>(null);
  const [pendingStoryCharacterId, setPendingStoryCharacterId] = useState<string>("");
  const [pendingUseAiStoryCharacter, setPendingUseAiStoryCharacter] = useState(false);
  const [pendingVideoType, setPendingVideoType] = useState<VideoGenerationType | null>(null);
  const [pendingGameplayCategory, setPendingGameplayCategory] = useState<GameplayCategory>(DEFAULT_GAMEPLAY_CATEGORY);
  const [pendingGameplayBackgroundId, setPendingGameplayBackgroundId] = useState(DEFAULT_GAMEPLAY_BACKGROUND_ID);
  const [jobStoryCharacters, setJobStoryCharacters] = useState<StoryCharacterOption[]>([]);
  const [isLoadingStoryCharacters, setIsLoadingStoryCharacters] = useState(false);
  const [queryStoryCharacterOption, setQueryStoryCharacterOption] = useState<StoryCharacterOption | null>(null);
  const [isLoadingQueryStoryCharacter, setIsLoadingQueryStoryCharacter] = useState(false);
  const [isInlineCharacterCreatorOpen, setIsInlineCharacterCreatorOpen] = useState(false);
  const [isCreatingInlineCharacter, setIsCreatingInlineCharacter] = useState(false);
  const [inlineCharacterName, setInlineCharacterName] = useState("");
  const [inlineCharacterRole, setInlineCharacterRole] = useState("");
  const [inlineCharacterDescription, setInlineCharacterDescription] = useState("");
  const [inlineCharacterImageData, setInlineCharacterImageData] = useState("");
  const [inlineCharacterImageName, setInlineCharacterImageName] = useState("");
  const [inlineCharacterError, setInlineCharacterError] = useState("");
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [visibleImageCount, setVisibleImageCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [openJsonByKey, setOpenJsonByKey] = useState<Record<string, boolean>>({});
  const [expandedReferencesByMessage, setExpandedReferencesByMessage] = useState<Record<string, boolean>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const characterCarouselRef = useRef<HTMLDivElement>(null);
  const thinkingStartRef = useRef<number>(0);
  const activeStoryCharacterSelectionRef = useRef<CharacterSelection | null>(null);
  const activeVideoTypeRef = useRef<VideoGenerationType | null>(null);
  const activeGameplaySelectionRef = useRef<GameplaySelection | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setQueryMode((params.get("mode") || "").toLowerCase());
    setQueryCharacterId((params.get("characterId") || "").trim());
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth", force = false) => {
    if (!force && !shouldAutoScroll) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      requestAnimationFrame(() => {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      });
    });
  }, [shouldAutoScroll]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const handleScroll = () => {
      const distanceFromBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      setShouldAutoScroll(distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX);
    };
    handleScroll();
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  const toggleThinking = useCallback((id: string) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleJsonPanel = useCallback((key: string) => {
    setOpenJsonByKey((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const toggleExpandedReferencesForMessage = useCallback((messageId: string) => {
    setExpandedReferencesByMessage((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  }, []);

  const stepIntervalMs = React.useMemo(() => {
    const count = Math.max(activeThinkingSteps.length, 1);
    const bufferedWindow = THINKING_TOTAL_MS - STEP_INITIAL_DELAY_MS - 3000;
    return Math.max(1400, Math.floor(bufferedWindow / count));
  }, [activeThinkingSteps.length]);

  const storyCharacterOptions = useMemo(() => {
    const merged = new Map<string, StoryCharacterOption>();
    for (const option of jobStoryCharacters) {
      if (!option?.id) continue;
      if (!merged.has(option.id)) merged.set(option.id, option);
    }
    if (queryStoryCharacterOption?.id && !merged.has(queryStoryCharacterOption.id)) {
      merged.set(queryStoryCharacterOption.id, queryStoryCharacterOption);
    }
    return Array.from(merged.values());
  }, [jobStoryCharacters, queryStoryCharacterOption]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingStoryCharacters(true);
    void fetchJobs({ type: "character", limit: 100 })
      .then((jobs) => {
        if (cancelled) return;
        const mapped = jobs
          .map(jobToStoryCharacterOption)
          .filter((entry): entry is StoryCharacterOption => entry !== null);
        setJobStoryCharacters(mapped);
      })
      .catch(() => {
        if (cancelled) return;
        setJobStoryCharacters([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingStoryCharacters(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!queryCharacterId) {
      setQueryStoryCharacterOption(null);
      setIsLoadingQueryStoryCharacter(false);
      return;
    }

    let cancelled = false;
    setIsLoadingQueryStoryCharacter(true);
    void fetchJob(queryCharacterId)
      .then((job) => {
        if (cancelled) return;
        if (!job || job.type !== "character") {
          setQueryStoryCharacterOption(null);
          return;
        }
        const option = jobToStoryCharacterOption(job);
        setQueryStoryCharacterOption(option);
      })
      .catch(() => {
        if (cancelled) return;
        setQueryStoryCharacterOption(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingQueryStoryCharacter(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryCharacterId]);

  useEffect(() => {
    if (queryMode !== "story") return;
    setComposerMode((current) => (current === "story" ? current : "story"));
  }, [queryMode]);

  useEffect(() => {
    if (!queryCharacterId || hasAppliedQueryCharacterRef.current) return;
    if (!storyCharacterOptions.some((option) => option.id === queryCharacterId)) return;
    hasAppliedQueryCharacterRef.current = true;
    setPendingUseAiStoryCharacter(false);
    setPendingStoryCharacterId(queryCharacterId);
  }, [queryCharacterId, storyCharacterOptions]);

  useEffect(() => {
    if (!isThinkingStreamActive && !hasActiveStoryCharacterChoice) return;
    setIsInlineCharacterCreatorOpen(false);
  }, [isThinkingStreamActive, hasActiveStoryCharacterChoice]);

  const activeStoryCharacter = React.useMemo(
    () => storyCharacterOptions.find((char) => char.id === activeStoryCharacterId) ?? null,
    [activeStoryCharacterId, storyCharacterOptions],
  );

  const pendingStoryCharacter = React.useMemo(
    () => storyCharacterOptions.find((char) => char.id === pendingStoryCharacterId) ?? null,
    [pendingStoryCharacterId, storyCharacterOptions],
  );

  const pendingVideoTypeOption = React.useMemo(
    () => VIDEO_MODE_OPTIONS.find((option) => option.value === pendingVideoType) ?? null,
    [pendingVideoType],
  );

  const pendingGameplayBackgroundOptions = React.useMemo(
    () => GAMEPLAY_BACKGROUNDS[pendingGameplayCategory],
    [pendingGameplayCategory],
  );

  const pendingGameplayBackground = React.useMemo(() => {
    return pendingGameplayBackgroundOptions.find((item) => item.id === pendingGameplayBackgroundId)
      ?? pendingGameplayBackgroundOptions[0]
      ?? null;
  }, [pendingGameplayBackgroundOptions, pendingGameplayBackgroundId]);

  const hasPendingStoryChoice = pendingUseAiStoryCharacter || Boolean(pendingStoryCharacterId);

  const applyActiveStoryCharacterSelection = useCallback((selection: CharacterSelection | null, targetMessageId?: string) => {
    const messageId = targetMessageId ?? activeStoryMessageId;
    activeStoryCharacterSelectionRef.current = selection;
    setActiveStoryCharacterSelection(selection);
    if (!messageId) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || msg.role !== "user") return msg;
        const basePrompt = msg.basePrompt ?? msg.content;
        return {
          ...msg,
          basePrompt,
          characterSelection: selection,
          content: formatStoryPromptWithCharacter(basePrompt, selection),
        };
      }),
    );
  }, [activeStoryMessageId]);

  const applyActiveVideoTypeSelection = useCallback((
    selection: VideoGenerationType | null,
    gameplaySelection: GameplaySelection | null,
    targetMessageId?: string,
  ) => {
    const messageId = targetMessageId ?? activeVideoMessageId;
    activeVideoTypeRef.current = selection;
    activeGameplaySelectionRef.current = gameplaySelection;
    setActiveVideoType(selection);
    setActiveGameplaySelection(gameplaySelection);
    if (selection) {
      const videoSteps = getThinkingSteps("video", selection).map((step) => ({
        ...step,
        imageUrls: step.imageUrls ? [...step.imageUrls] : undefined,
      }));
      setActiveThinkingSteps(videoSteps);
    }
    if (!messageId) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || msg.role !== "user") return msg;
        const basePrompt = msg.basePrompt ?? msg.content;
        return {
          ...msg,
          basePrompt,
          videoType: selection,
          gameplaySelection,
          content: formatVideoPromptWithType(basePrompt, selection, gameplaySelection),
        };
      }),
    );
  }, [activeVideoMessageId]);

  const startThinkingStream = useCallback(() => {
    if (!isLoading || isThinkingStreamActive) return;
    thinkingStartRef.current = Date.now();
    setElapsedSeconds(0);
    setIsThinkingStreamActive(true);
    setShouldAutoScroll(true);
    setTimeout(() => scrollToBottom("smooth", true), 40);
  }, [isLoading, isThinkingStreamActive, scrollToBottom]);

  const handleSelectStoryCharacter = useCallback((characterId: string) => {
    setActiveStoryCharacterId(characterId);
    const selected = storyCharacterOptions.find((char) => char.id === characterId);
    if (!selected) return;
    applyActiveStoryCharacterSelection({
      type: "existing",
      id: selected.id,
      source: selected.source,
      jobId: selected.jobId,
      name: selected.name,
      avatar: selected.avatar,
      description: selected.description,
      referenceImageUrls: selected.referenceDrawings
        .map((drawing) => drawing.url?.trim() || drawing.imageData?.trim() || "")
        .filter((value) => Boolean(value)),
    });
    setHasActiveStoryCharacterChoice(true);
    startThinkingStream();
  }, [applyActiveStoryCharacterSelection, startThinkingStream, storyCharacterOptions]);

  const handleUseAiStoryCharacter = useCallback(() => {
    setActiveStoryCharacterId("");
    applyActiveStoryCharacterSelection(null);
    setHasActiveStoryCharacterChoice(true);
    startThinkingStream();
  }, [applyActiveStoryCharacterSelection, startThinkingStream]);

  const handlePickPendingStoryCharacter = useCallback((characterId: string) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingUseAiStoryCharacter(false);
    setPendingStoryCharacterId((previous) => (previous === characterId ? "" : characterId));
  }, [isThinkingStreamActive, isClosingLogs]);

  const handlePickPendingAiChoice = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingStoryCharacterId("");
    setPendingUseAiStoryCharacter((previous) => !previous);
  }, [isThinkingStreamActive, isClosingLogs]);

  const scrollCharacterCarousel = useCallback((dir: 1 | -1) => {
    const el = characterCarouselRef.current;
    if (!el) return;
    // scroll 3 cards at a time (80px card + 7px gap)
    el.scrollBy({ left: dir * (80 * 3 + 7 * 2), behavior: "smooth" });
  }, []);

  const handlePickPendingVideoType = useCallback((selection: VideoGenerationType) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingVideoType(selection);
    if (selection === "normal") return;
    const firstBackgroundId = getDefaultGameplayBackgroundId(pendingGameplayCategory);
    if (!pendingGameplayBackgroundId || !GAMEPLAY_BACKGROUNDS[pendingGameplayCategory].some((clip) => clip.id === pendingGameplayBackgroundId)) {
      setPendingGameplayBackgroundId(firstBackgroundId);
    }
  }, [isThinkingStreamActive, isClosingLogs, pendingGameplayCategory, pendingGameplayBackgroundId]);

  const handlePickPendingGameplayCategory = useCallback((category: GameplayCategory) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingGameplayCategory(category);
    setPendingGameplayBackgroundId(getDefaultGameplayBackgroundId(category));
  }, [isThinkingStreamActive, isClosingLogs]);

  const handlePickPendingGameplayBackground = useCallback((backgroundId: string) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingGameplayBackgroundId(backgroundId);
  }, [isThinkingStreamActive, isClosingLogs]);

  const handleConfirmVideoTypeChoice = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs || !pendingVideoType) return;
    if (pendingVideoType === "gameplay") {
      const selectedBackground =
        GAMEPLAY_BACKGROUNDS[pendingGameplayCategory].find((item) => item.id === pendingGameplayBackgroundId)
        ?? GAMEPLAY_BACKGROUNDS[pendingGameplayCategory][0];
      if (!selectedBackground) return;
      applyActiveVideoTypeSelection(
        pendingVideoType,
        {
          category: pendingGameplayCategory,
          backgroundId: selectedBackground.id,
          backgroundName: selectedBackground.name,
        },
      );
    } else {
      applyActiveVideoTypeSelection(pendingVideoType, null);
    }
    setHasActiveVideoTypeChoice(true);
    startThinkingStream();
  }, [
    isThinkingStreamActive,
    isClosingLogs,
    pendingVideoType,
    pendingGameplayCategory,
    pendingGameplayBackgroundId,
    applyActiveVideoTypeSelection,
    startThinkingStream,
  ]);

  // Stream steps + elapsed counter while loading
  useEffect(() => {
    if (!isLoading || !isThinkingStreamActive) return;
    if (activeRunMode === "story" && isAwaitingStoryReply) return;

    const imageTimers: ReturnType<typeof setTimeout>[] = [];
    const stepTimers = activeThinkingSteps.map((step, i) =>
      setTimeout(() => {
        setVisibleSteps(i + 1);
        if (step.imageUrls?.length) {
          setVisibleImageCount(0);
          step.imageUrls.forEach((_, imageIndex) => {
            imageTimers.push(
              setTimeout(() => {
                setVisibleImageCount(imageIndex + 1);
              }, IMAGE_REVEAL_INTERVAL_MS * (imageIndex + 1))
            );
          });
        }
      }, i * stepIntervalMs + STEP_INITIAL_DELAY_MS)
    );

    const ticker = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

    return () => {
      stepTimers.forEach(clearTimeout);
      imageTimers.forEach(clearTimeout);
      clearInterval(ticker);
    };
  }, [isLoading, isThinkingStreamActive, activeThinkingSteps, stepIntervalMs, activeRunMode, isAwaitingStoryReply]);

  // Keep the live thinking stream pinned to bottom while steps/images are added.
  useEffect(() => {
    if (!isLoading || !isThinkingStreamActive || !shouldAutoScroll) return;
    scrollToBottom("auto");
  }, [isLoading, isThinkingStreamActive, visibleSteps, visibleImageCount, shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    if (!isLoading || !isThinkingStreamActive) return;
    if ((activeRunMode === "normal" || activeRunMode === "search") && isAwaitingBackendReply) return;
    if (activeRunMode === "story" && isAwaitingStoryReply) return;
    const imageStageTotal = activeThinkingSteps.find((step) => step.imageUrls?.length)?.imageUrls?.length ?? 0;
    const closeDelayMs = 240;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const finishTimer = setTimeout(() => {
      const duration = Math.round((Date.now() - thinkingStartRef.current) / 1000);
      setVisibleSteps(activeThinkingSteps.length);
      setVisibleImageCount(imageStageTotal);
      setElapsedSeconds(duration);
      setIsClosingLogs(true);

      closeTimer = setTimeout(() => {
        const finalCharacterSelection =
          activeRunMode === "story" ? activeStoryCharacterSelectionRef.current : null;
        const finalVideoType =
          activeRunMode === "video" ? activeVideoTypeRef.current : null;
        const finalGameplaySelection =
          activeRunMode === "video" ? activeGameplaySelectionRef.current : null;
        const finalThinkingSteps = activeRunMode === "story"
          ? [getStoryCharacterStep(finalCharacterSelection), ...activeThinkingSteps]
          : activeRunMode === "video"
            ? [getVideoTypeStep(finalVideoType, finalGameplaySelection), ...activeThinkingSteps]
            : activeThinkingSteps;
        const assistantContent = activeRunMode === "story"
          ? "What a wonderful idea! Let me weave a magical story around that — filled with wonder, friendship, and adventure that kids will absolutely love. Give me just a moment to craft something special for you..."
          : activeRunMode === "video"
            ? finalVideoType === "gameplay"
              ? "Great concept. I am shaping it into a high-energy gameplay-style video flow with tight pacing and strong visual hooks."
              : "Great concept. I am shaping it into a polished narrative video with clear scene progression and balanced audio pacing."
            : "Great prompt. I am preparing a focused response with clear structure and polished wording.";
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: assistantContent,
            timestamp: new Date(),
            mode: activeRunMode,
            characterSelection: finalCharacterSelection,
            videoType: finalVideoType,
            gameplaySelection: finalGameplaySelection,
            thinkingSteps: finalThinkingSteps,
            thinkingDuration: duration,
          },
        ]);
        setActiveStoryMessageId(null);
        setActiveVideoMessageId(null);
        setActiveStoryCharacterSelection(null);
        setActiveStoryCharacterId("");
        setActiveVideoType(null);
        setActiveGameplaySelection(null);
        setPendingStoryCharacterId("");
        setPendingUseAiStoryCharacter(false);
        setPendingVideoType(null);
        setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
        setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
        setHasActiveStoryCharacterChoice(false);
        setHasActiveVideoTypeChoice(false);
        setIsAwaitingBackendReply(false);
        setIsAwaitingStoryReply(false);
        activeStoryCharacterSelectionRef.current = null;
        activeVideoTypeRef.current = null;
        activeGameplaySelectionRef.current = null;
        setIsClosingLogs(false);
        setIsThinkingStreamActive(false);
        setIsLoading(false);
        setTimeout(() => scrollToBottom("smooth", true), 60);
      }, closeDelayMs);
    }, THINKING_TOTAL_MS);

    return () => {
      clearTimeout(finishTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [isLoading, isThinkingStreamActive, activeThinkingSteps, activeRunMode, isAwaitingBackendReply, isAwaitingStoryReply, scrollToBottom]);

  const addAssistantReply = useCallback((mode: ModeId | "normal", startImmediately: boolean) => {
    const stepsForRun = getThinkingSteps(mode).map((step) => ({
      ...step,
      imageUrls: step.imageUrls ? [...step.imageUrls] : undefined,
    }));

    setActiveRunMode(mode);
    setActiveThinkingSteps(stepsForRun);
    setShouldAutoScroll(true);
    setVisibleSteps(0);
    setVisibleImageCount(0);
    setElapsedSeconds(0);
    setIsClosingLogs(false);
    setIsLoading(true);
    if (startImmediately) {
      thinkingStartRef.current = Date.now();
      setIsThinkingStreamActive(true);
    } else {
      setIsThinkingStreamActive(false);
    }
  }, []);

  const finalizeBackendAssistantReply = useCallback((
    assistantContent: string,
    mode: ModeId | "normal",
    overrideThinkingSteps?: ThinkingStep[],
    backendJson?: Record<string, unknown> | null,
    references?: SearchReference[],
    storyBook?: StoryBookMessageData | null,
    storyJobId?: string,
  ) => {
    const duration = Math.max(1, Math.round((Date.now() - thinkingStartRef.current) / 1000));
    const sourceSteps = (overrideThinkingSteps && overrideThinkingSteps.length > 0)
      ? overrideThinkingSteps
      : getThinkingSteps(mode);
    const finalThinkingSteps = sourceSteps.map((step) => ({
      ...step,
      imageUrls: step.imageUrls ? [...step.imageUrls] : undefined,
    }));
    const finalImageCount = finalThinkingSteps.find((step) => step.imageUrls?.length)?.imageUrls?.length ?? 0;

    setVisibleSteps(finalThinkingSteps.length);
    setVisibleImageCount(finalImageCount);
    setElapsedSeconds(duration);
    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        backendJson: backendJson ?? null,
        references: references ?? [],
        mode,
        storyBook: storyBook ?? null,
        storyJobId,
        thinkingSteps: finalThinkingSteps,
        thinkingDuration: duration,
      },
    ]);
    setActiveStoryMessageId(null);
    setActiveVideoMessageId(null);
    setActiveStoryCharacterSelection(null);
    setActiveStoryCharacterId("");
    setActiveVideoType(null);
    setActiveGameplaySelection(null);
    setPendingStoryCharacterId("");
    setPendingUseAiStoryCharacter(false);
    setPendingVideoType(null);
    setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
    setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
    setHasActiveStoryCharacterChoice(false);
    setHasActiveVideoTypeChoice(false);
    setIsAwaitingBackendReply(false);
    setIsAwaitingStoryReply(false);
    activeStoryCharacterSelectionRef.current = null;
    activeVideoTypeRef.current = null;
    activeGameplaySelectionRef.current = null;
    setIsClosingLogs(false);
    setIsThinkingStreamActive(false);
    setIsLoading(false);
    setTimeout(() => scrollToBottom("smooth", true), 60);
  }, [scrollToBottom]);

  const requestBackendAssistantReply = useCallback(async (
    mode: ModeId | "normal",
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ) => {
    const requestStartedAt = Date.now();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          mode: mode === "search" ? "search" : "normal",
        }),
        cache: "no-store",
      });

      const rawText = await response.text();
      let parsed: ChatBackendResponse = {};
      try {
        parsed = JSON.parse(rawText) as ChatBackendResponse;
      } catch {
        parsed = {};
      }

      if (!response.ok) {
        const detail = typeof parsed.detail === "string" && parsed.detail.trim()
          ? parsed.detail.trim()
          : `chat request failed (${response.status})`;
        const error = new Error(detail) as Error & {
          backendPayload?: Record<string, unknown>;
        };
        const errorPayload = (parsed && typeof parsed === "object")
          ? ({ ...(parsed as Record<string, unknown>) } as Record<string, unknown>)
          : {};
        errorPayload.status = response.status;
        if (!errorPayload.detail) {
          errorPayload.detail = detail;
        }
        error.backendPayload = errorPayload;
        throw error;
      }

      const answer = typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : "";

      if (!answer) {
        throw new Error("Empty answer from chat backend.");
      }

      const successPayload = (parsed && typeof parsed === "object")
        ? ({ ...(parsed as Record<string, unknown>) } as Record<string, unknown>)
        : ({ answer } as Record<string, unknown>);
      const references = extractMcpReferences(parsed.mcp_output);

      const successSteps = buildChatSuccessThinkingSteps({
        category: parsed.category,
        safety: parsed.safety,
        readingLevel: parsed.reading_level,
        responseStyle: parsed.response_style,
        model: parsed.model,
        mode,
        mcpUsed: parsed.mcp_used,
        mcpServer: parsed.mcp_server,
        mcpOutput: parsed.mcp_output,
        backendPayload: successPayload,
        durationMs: Math.max(1, Date.now() - requestStartedAt),
      });

      finalizeBackendAssistantReply(answer, mode, successSteps, successPayload, references);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown chat backend error.";
      const errorSteps = buildChatErrorThinkingSteps(
        detail,
        Math.max(1, Date.now() - requestStartedAt),
      );
      const errorPayload = (
        error instanceof Error
        && "backendPayload" in error
        && typeof (error as Error & { backendPayload?: unknown }).backendPayload === "object"
      )
        ? (
          (error as Error & { backendPayload?: Record<string, unknown> }).backendPayload
          ?? { detail }
        )
        : { detail };
      finalizeBackendAssistantReply(detail, mode, errorSteps, errorPayload, []);
    }
  }, [finalizeBackendAssistantReply]);

  const requestStorybookAssistantReply = useCallback(async (
    storyPrompt: string,
    selection: CharacterSelection | null,
    selectedOption: StoryCharacterOption | null,
    preludeSteps: ThinkingStep[] = [],
  ) => {
    const requestStartedAt = Date.now();
    const timelineOrder: string[] = [];
    const timelineMap = new Map<string, ThinkingStep>();

    const syncTimeline = () => {
      const steps = timelineOrder
        .map((key) => timelineMap.get(key))
        .filter((step): step is ThinkingStep => Boolean(step));
      if (!steps.length) return;
      setActiveThinkingSteps(steps);
      setVisibleSteps(steps.length);
      const imageCount = steps.reduce((sum, step) => sum + (step.imageUrls?.length ?? 0), 0);
      setVisibleImageCount(imageCount);
      setElapsedSeconds(Math.max(1, Math.round((Date.now() - requestStartedAt) / 1000)));
    };

    const upsertTimelineStep = (
      key: string,
      title: string,
      detail: string,
      data?: unknown,
      imageUrl?: string,
      stageKey?: string,
    ) => {
      const existing = timelineMap.get(key);
      const nextImages = imageUrl
        ? Array.from(new Set([...(existing?.imageUrls ?? []), imageUrl]))
        : (existing?.imageUrls ?? []);
      timelineMap.set(key, {
        title,
        detail,
        stageKey: stageKey ?? existing?.stageKey,
        data: data ?? existing?.data,
        imageUrls: nextImages.length ? nextImages : undefined,
      });
      if (!timelineOrder.includes(key)) {
        timelineOrder.push(key);
      }
      syncTimeline();
    };

    if (preludeSteps.length) {
      preludeSteps.forEach((step, index) => {
        const key = `prelude:${index}`;
        timelineMap.set(key, {
          title: step.title,
          detail: step.detail,
          stageKey: step.stageKey,
          data: step.data,
          imageUrls: step.imageUrls ? [...step.imageUrls] : undefined,
        });
        timelineOrder.push(key);
      });
      syncTimeline();
    }

    upsertTimelineStep(
      "story_character_choice",
      "Choosing character style",
      selection?.type === "existing" && selectedOption
        ? `Reusing existing character: ${selectedOption.name}.`
        : "Using AI-created character path for this story.",
      {
        selection_type: selection?.type ?? "create",
        character_id: selectedOption?.id ?? null,
        character_name: selectedOption?.name ?? null,
      },
    );

    setIsAwaitingStoryReply(true);

    const requestPayload: Record<string, unknown> = {
      user_prompt: storyPrompt.trim(),
      world_references: [],
      character_drawings: [],
      max_characters: 2,
    };

    if (selection?.type === "existing" && selectedOption) {
      const canonicalDrawings: Array<Record<string, string>> = [];
      for (const drawing of selectedOption.referenceDrawings) {
        const description = drawing.description || `Canonical reference for ${selectedOption.name}.`;
        const notes = drawing.notes || "Preserve identity consistency in every scene.";
        if (drawing.imageData && drawing.imageData.trim()) {
          canonicalDrawings.push({
            description,
            notes,
            image_data: drawing.imageData.trim(),
          });
          continue;
        }
        if (drawing.url && drawing.url.trim()) {
          canonicalDrawings.push({
            description,
            notes,
            url: drawing.url.trim(),
          });
        }
      }
      const avatarFallback = toAbsoluteClientUrl(selectedOption.avatar || "");
      if (!canonicalDrawings.length && avatarFallback) {
        if (isDataUrl(avatarFallback)) {
          canonicalDrawings.push({
            description: `Canonical fallback reference for ${selectedOption.name}.`,
            notes: "Preserve this exact identity in all storybook pages.",
            image_data: avatarFallback,
          });
        } else {
          canonicalDrawings.push({
            description: `Canonical fallback reference for ${selectedOption.name}.`,
            notes: "Preserve this exact identity in all storybook pages.",
            url: avatarFallback,
          });
        }
      }

      requestPayload.character_drawings = canonicalDrawings;
      requestPayload.reuse_existing_character = true;
      requestPayload.reuse_character_name = selectedOption.name;
      requestPayload.max_characters = 1;
      requestPayload.force_workflow = "reference_enriched";
      requestPayload.user_prompt = `${storyPrompt.trim()}\n\nUse the existing character "${selectedOption.name}" as the lead and keep identity strictly consistent across all pages.`;
    }

    let jobId: string | undefined;

    try {
      try {
        const createdJob = await createJob({
          type: "story",
          title: storyPrompt.trim().slice(0, 80) || "Storybook Generation",
          user_prompt: storyPrompt.trim(),
          input_payload: requestPayload as Record<string, unknown>,
          triggered_by: "chat-story-mode",
          engine: "a2a-maf-story-book-maker",
        });
        jobId = createdJob.id;
        upsertTimelineStep(
          "job_created",
          "Job tracking",
          `Created story job ${createdJob.id}.`,
          { job_id: createdJob.id },
        );
      } catch (jobError) {
        upsertTimelineStep(
          "job_created",
          "Job tracking",
          `Job creation skipped: ${jobError instanceof Error ? jobError.message : "unknown error"}`,
          { warning: "job_creation_failed" },
        );
      }

      const jobQuery = jobId ? `&job_id=${encodeURIComponent(jobId)}` : "";
      const response = await fetch(`/api/storybook-test?target=main&stream=1${jobQuery}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/x-ndjson")) {
        const rawText = await response.text();
        let parsed: unknown = null;
        if (rawText.trim()) {
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = { raw: rawText };
          }
        }
        if (!response.ok) {
          const detail =
            parsed && typeof parsed === "object" && parsed !== null && "detail" in parsed
              ? String((parsed as { detail?: unknown }).detail || "")
              : `Story request failed (${response.status}).`;
          throw new Error(detail || `Story request failed (${response.status}).`);
        }

        const fallbackEnvelope = {
          backend_endpoint: "",
          backend_status_code: response.status,
          backend_response: parsed,
        } as Record<string, unknown>;
        const fallbackWorkflow = unwrapStorybookPayload(fallbackEnvelope);
        const fallbackBook = buildStoryBookFromResponse(fallbackWorkflow, "5-8", jobId);
        finalizeBackendAssistantReply(
          fallbackBook ? `Storybook ready: ${fallbackBook.title}.` : "Storybook generated.",
          "story",
          timelineOrder.map((key) => timelineMap.get(key)).filter((step): step is ThinkingStep => Boolean(step)),
          fallbackEnvelope,
          [],
          fallbackBook,
          jobId,
        );
        return;
      }

      if (!response.body) {
        throw new Error("Stream was requested, but backend returned an empty body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalEnvelope: Record<string, unknown> | null = null;
      let streamError: string | null = null;

      const consumeLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let event: unknown;
        try {
          event = JSON.parse(trimmed);
        } catch {
          upsertTimelineStep(
            `stream_parse_${timelineOrder.length}`,
            "Stream parse warning",
            "Received a stream line that could not be parsed as JSON.",
            { raw_line: trimmed },
          );
          return;
        }

        if (!event || typeof event !== "object") return;
        const eventObj = event as Record<string, unknown>;
        const eventType = String(eventObj.type || "").toLowerCase().trim();

        if (eventType === "progress") {
          const stage = String(eventObj.stage || "progress");
          const message = String(eventObj.message || "Progress update received.");
          const data = eventObj.data;
          const imageUrl =
            data && typeof data === "object" && data !== null && "image_url" in data
              ? String((data as { image_url?: unknown }).image_url || "")
              : "";
          const timelineKey = buildProgressStepKey(stage, data);
          upsertTimelineStep(
            timelineKey,
            stageToReadableTitle(stage),
            message,
            data,
            imageUrl || undefined,
            stage,
          );
          return;
        }

        if (eventType === "status") {
          const state = String(eventObj.state || "").trim();
          const message = String(eventObj.message || "Status update received.");
          const title = state ? `A2A status: ${state}` : "A2A status";
          const key = state ? `status:${state}` : `status:${timelineOrder.length}`;
          upsertTimelineStep(key, title, message, eventObj);
          return;
        }

        if (eventType === "update") {
          const message = String(eventObj.message || "Backend update received.");
          upsertTimelineStep(
            `update:${timelineOrder.length}`,
            "Backend update",
            message,
            eventObj,
          );
          return;
        }

        if (eventType === "error") {
          streamError =
            String(eventObj.detail || eventObj.message || "Story stream failed with an unknown error.");
          upsertTimelineStep("stream_error", "Stream error", streamError, eventObj);
          return;
        }

        if (eventType === "final") {
          finalEnvelope = {
            backend_endpoint: eventObj.backend_endpoint || eventObj.endpoint || "",
            backend_status_code: eventObj.backend_status_code || eventObj.status_code || 200,
            backend_response: eventObj.backend_response || eventObj.payload || null,
          };
          upsertTimelineStep(
            "final_response",
            "Final response",
            "Storybook payload received from backend.",
            finalEnvelope,
          );
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) consumeLine(line);
      }

      buffer += decoder.decode();
      if (buffer.trim()) consumeLine(buffer);

      if (streamError) {
        throw new Error(streamError);
      }

      if (!finalEnvelope) {
        throw new Error("Story stream ended before final payload was received.");
      }

      let storyJobId = jobId;
      if (jobId) {
        try {
          const refreshedJob = await fetchJob(jobId);
          if (refreshedJob?.id) storyJobId = refreshedJob.id;
        } catch {
          // Best effort only.
        }
      }

      const workflowPayload = unwrapStorybookPayload(finalEnvelope);
      if (selection?.type !== "existing") {
        const savedCharacterIds = Array.isArray(workflowPayload?.saved_character_job_ids)
          ? workflowPayload.saved_character_job_ids.filter(
              (value): value is string => typeof value === "string" && value.trim().length > 0,
            )
          : [];
        if (savedCharacterIds.length) {
          upsertTimelineStep(
            "story_characters_saved",
            "Story characters saved",
            `Saved ${savedCharacterIds.length} story-generated character(s) to Azure character storage.`,
            {
              saved_character_ids: savedCharacterIds,
              source_job_id: storyJobId || null,
            },
            undefined,
            "story_characters_saved",
          );
        }
      }
      const storyBook = buildStoryBookFromResponse(workflowPayload, "5-8", storyJobId);
      finalizeBackendAssistantReply(
        storyBook ? `Storybook ready: ${storyBook.title}.` : "Storybook generated.",
        "story",
        timelineOrder.map((key) => timelineMap.get(key)).filter((step): step is ThinkingStep => Boolean(step)),
        finalEnvelope,
        [],
        storyBook,
        storyJobId,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Storybook generation failed.";
      upsertTimelineStep("story_error", "Story generation failed", detail, {
        detail,
        job_id: jobId || null,
      });
      finalizeBackendAssistantReply(
        detail,
        "story",
        timelineOrder.map((key) => timelineMap.get(key)).filter((step): step is ThinkingStep => Boolean(step)),
        {
          detail,
          job_id: jobId || null,
          duration_ms: Math.max(1, Date.now() - requestStartedAt),
        },
        [],
        null,
        jobId,
      );
    }
  }, [finalizeBackendAssistantReply]);

  const handleToggleInlineCharacterCreator = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setInlineCharacterError("");
    setIsInlineCharacterCreatorOpen((prev) => !prev);
  }, [isThinkingStreamActive, isClosingLogs]);

  const handleCreateCharacterInlineAndContinue = useCallback(async () => {
    if (isThinkingStreamActive || isClosingLogs || isCreatingInlineCharacter) return;

    const name = inlineCharacterName.trim();
    const description = inlineCharacterDescription.trim();
    const role = inlineCharacterRole.trim();
    const resolvedDescription = description || `${name} is a kid-safe story character with clear visual identity.`;
    if (!name) {
      setInlineCharacterError("Add character name to continue.");
      return;
    }

    const storyUserMessage = messages.find(
      (message) => message.id === activeStoryMessageId && message.role === "user",
    );
    const storyPrompt = (storyUserMessage?.basePrompt || storyUserMessage?.content || "").trim();
    const inlineCreationPrelude: ThinkingStep[] = [];
    const appendInlineCreationStep = (
      title: string,
      detail: string,
      data?: Record<string, unknown>,
      stageKey?: string,
    ) => {
      inlineCreationPrelude.push({
        title,
        detail,
        data,
        stageKey,
      });
    };

    setIsCreatingInlineCharacter(true);
    setInlineCharacterError("");
    appendInlineCreationStep(
      "Character request prepared",
      "Validated inline character fields and assembled CrewAI A2A payload.",
      {
        character_name: name,
        has_uploaded_reference: Boolean(inlineCharacterImageData),
      },
      "character_request_prepared",
    );

    try {
      const inputReferences: Array<{ image_data: string; description: string; notes: string }> = [];
      if (inlineCharacterImageData) {
        inputReferences.push({
          image_data: inlineCharacterImageData,
          description: `User uploaded canonical reference for ${name}.`,
          notes: "Preserve this identity exactly across generated character assets and story scenes.",
        });
      }

      const requestPayload = {
        user_prompt: buildInlineCharacterPrompt({
          name,
          role,
          description: resolvedDescription,
          storyPrompt,
        }),
        world_references: [],
        character_drawings: inputReferences,
      };

      const job = await createJob({
        type: "character",
        title: name,
        user_prompt: requestPayload.user_prompt,
        input_payload: {
          name,
          role,
          source: "chat-inline-creator",
          has_uploaded_reference: Boolean(inlineCharacterImageData),
          description: resolvedDescription,
        },
        triggered_by: "chat-inline-character-creator",
        engine: "a2a-crew-ai-character-maker",
      });
      const jobIdParam = `&job_id=${encodeURIComponent(job.id)}`;
      appendInlineCreationStep(
        "Character job created",
        `Tracking character generation under job ${job.id}.`,
        {
          job_id: job.id,
          engine: "a2a-crew-ai-character-maker",
        },
        "character_job_created",
      );

      appendInlineCreationStep(
        "Character generation dispatch",
        "Sending create request to main orchestrator -> CrewAI A2A character backend.",
        {
          target: "main-maf-chat",
          backend: "a2a-crew-ai-character-maker",
        },
        "character_generation_dispatch",
      );
      const response = await fetch(`/api/character-test?target=main${jobIdParam}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const responseText = await response.text();
      const parsedResponse: unknown = responseText.trim()
        ? (() => {
            try {
              return JSON.parse(responseText) as unknown;
            } catch {
              return { raw: responseText };
            }
          })()
        : null;

      if (!response.ok) {
        const detail = extractErrorDetail(parsedResponse);
        appendInlineCreationStep(
          "Character generation failed",
          detail || `Character backend returned status ${response.status}.`,
          {
            status_code: response.status,
            detail: detail || null,
          },
          "character_generation_failed",
        );
        throw new Error(
          detail
            ? `Character generation failed: ${detail}`
            : `Character generation failed with status ${response.status}.`,
        );
      }

      appendInlineCreationStep(
        "Character generation complete",
        "CrewAI A2A character backend returned canonical character output.",
        undefined,
        "character_generation_complete",
      );

      const resolvedJob = await fetchJob(job.id);
      if (!resolvedJob || resolvedJob.type !== "character") {
        throw new Error("Character was generated but could not be loaded from Azure storage.");
      }

      const selectedOption = jobToStoryCharacterOption(resolvedJob);
      if (!selectedOption) {
        throw new Error("Character was generated but could not be loaded into chat selection.");
      }

      appendInlineCreationStep(
        "Character saved to storage",
        `Saved ${name} to Azure character storage under job ${resolvedJob.id}.`,
        {
          character_job_id: resolvedJob.id,
          reference_count: selectedOption.referenceDrawings.length,
        },
        "character_saved_to_azure",
      );

      const selectedSelection: CharacterSelection = {
        type: "existing",
        id: selectedOption.id,
        source: selectedOption.source,
        jobId: selectedOption.jobId,
        name: selectedOption.name,
        avatar: selectedOption.avatar,
        description: selectedOption.description,
        referenceImageUrls: selectedOption.referenceDrawings
          .map((drawing) => drawing.url?.trim() || drawing.imageData?.trim() || "")
          .filter((value) => Boolean(value)),
      };

      setPendingUseAiStoryCharacter(false);
      setPendingStoryCharacterId(selectedOption.id);
      setActiveStoryCharacterId(selectedOption.id);
      applyActiveStoryCharacterSelection(selectedSelection);
      setHasActiveStoryCharacterChoice(true);
      setIsInlineCharacterCreatorOpen(false);
      setInlineCharacterName("");
      setInlineCharacterRole("");
      setInlineCharacterDescription("");
      setInlineCharacterImageData("");
      setInlineCharacterImageName("");
      setInlineCharacterError("");
      startThinkingStream();

      if (storyPrompt) {
        void requestStorybookAssistantReply(
          storyPrompt,
          selectedSelection,
          selectedOption,
          inlineCreationPrelude,
        );
      }
    } catch (error) {
      setInlineCharacterError(
        error instanceof Error ? error.message : "Could not create character in chat.",
      );
    } finally {
      setIsCreatingInlineCharacter(false);
    }
  }, [
    isThinkingStreamActive,
    isClosingLogs,
    isCreatingInlineCharacter,
    inlineCharacterName,
    inlineCharacterDescription,
    inlineCharacterRole,
    inlineCharacterImageData,
    messages,
    activeStoryMessageId,
    applyActiveStoryCharacterSelection,
    startThinkingStream,
    requestStorybookAssistantReply,
  ]);

  const handleInlineCharacterImageChange = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setInlineCharacterError("Please upload an image file for character reference.");
      return;
    }
    try {
      const imageData = await fileToDataUrl(file);
      setInlineCharacterImageData(imageData);
      setInlineCharacterImageName(file.name);
      setInlineCharacterError("");
    } catch (error) {
      setInlineCharacterError(error instanceof Error ? error.message : "Could not read selected image.");
    } finally {
      event.currentTarget.value = "";
    }
  }, []);

  const handleRemoveInlineCharacterImage = useCallback(() => {
    setInlineCharacterImageData("");
    setInlineCharacterImageName("");
    setInlineCharacterError("");
  }, []);

  const handleConfirmStoryCharacterChoice = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs) return;
    const storyUserMessage = messages.find(
      (message) => message.id === activeStoryMessageId && message.role === "user",
    );
    const storyPrompt = (storyUserMessage?.basePrompt || storyUserMessage?.content || "").trim();
    if (!storyPrompt) return;

    if (pendingUseAiStoryCharacter) {
      handleUseAiStoryCharacter();
      void requestStorybookAssistantReply(storyPrompt, null, null);
      return;
    }
    if (pendingStoryCharacterId) {
      const selectedOption = storyCharacterOptions.find((character) => character.id === pendingStoryCharacterId) ?? null;
      handleSelectStoryCharacter(pendingStoryCharacterId);
      const selectedSelection: CharacterSelection | null = selectedOption
        ? {
            type: "existing",
            id: selectedOption.id,
            source: selectedOption.source,
            jobId: selectedOption.jobId,
            name: selectedOption.name,
            avatar: selectedOption.avatar,
            description: selectedOption.description,
            referenceImageUrls: selectedOption.referenceDrawings
              .map((drawing) => drawing.url?.trim() || drawing.imageData?.trim() || "")
              .filter((value) => Boolean(value)),
          }
        : null;
      void requestStorybookAssistantReply(storyPrompt, selectedSelection, selectedOption);
    }
  }, [
    isThinkingStreamActive,
    isClosingLogs,
    messages,
    activeStoryMessageId,
    pendingUseAiStoryCharacter,
    pendingStoryCharacterId,
    storyCharacterOptions,
    handleUseAiStoryCharacter,
    handleSelectStoryCharacter,
    requestStorybookAssistantReply,
  ]);

  const handleSend = useCallback((payload: PromptSendPayload) => {
    const trimmed = payload.message.trim();
    if (!trimmed) return;

    const mode = payload.mode ?? "normal";
    const shouldUseBackendChat = mode !== "story" && mode !== "video";
    const initialCharacterSelection = mode === "story" ? null : payload.characterSelection ?? null;
    const initialVideoType: VideoGenerationType | null = null;
    const initialGameplaySelection: GameplaySelection | null = null;
    const shouldStartImmediately = mode !== "story" && mode !== "video";
    const userContent = mode === "story"
      ? formatStoryPromptWithCharacter(trimmed, initialCharacterSelection)
      : mode === "video"
        ? formatVideoPromptWithType(trimmed, initialVideoType, initialGameplaySelection)
        : trimmed;
    const userMessageId = Date.now().toString();

    const backendHistory = shouldUseBackendChat
      ? [
        ...messages
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .map((msg) => ({ role: msg.role, content: msg.content })),
        { role: "user" as const, content: userContent },
      ].slice(-12)
      : [];

    setShouldAutoScroll(true);
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: userContent,
        basePrompt: trimmed,
        timestamp: new Date(),
        mode,
        characterSelection: initialCharacterSelection,
        videoType: initialVideoType,
        gameplaySelection: initialGameplaySelection,
      },
    ]);
    setIsAwaitingBackendReply(false);
    setIsAwaitingStoryReply(false);

    if (mode === "story") {
      setActiveStoryMessageId(userMessageId);
      setActiveVideoMessageId(null);
      setActiveStoryCharacterId("");
      setActiveStoryCharacterSelection(null);
      setActiveVideoType(null);
      setActiveGameplaySelection(null);
      setPendingStoryCharacterId("");
      setPendingUseAiStoryCharacter(false);
      setPendingVideoType(null);
      setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
      setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
      setHasActiveStoryCharacterChoice(false);
      setHasActiveVideoTypeChoice(false);
      setIsAwaitingStoryReply(false);
      activeStoryCharacterSelectionRef.current = null;
      activeVideoTypeRef.current = null;
      activeGameplaySelectionRef.current = null;
    } else if (mode === "video") {
      setActiveStoryMessageId(null);
      setActiveVideoMessageId(userMessageId);
      setActiveStoryCharacterSelection(null);
      setActiveStoryCharacterId("");
      setActiveVideoType(null);
      setActiveGameplaySelection(null);
      setPendingStoryCharacterId("");
      setPendingUseAiStoryCharacter(false);
      setPendingVideoType(null);
      setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
      setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
      setHasActiveStoryCharacterChoice(false);
      setHasActiveVideoTypeChoice(false);
      setIsAwaitingStoryReply(false);
      activeStoryCharacterSelectionRef.current = null;
      activeVideoTypeRef.current = null;
      activeGameplaySelectionRef.current = null;
    } else {
      setActiveStoryMessageId(null);
      setActiveVideoMessageId(null);
      setActiveStoryCharacterSelection(null);
      setActiveStoryCharacterId("");
      setActiveVideoType(null);
      setActiveGameplaySelection(null);
      setPendingStoryCharacterId("");
      setPendingUseAiStoryCharacter(false);
      setPendingVideoType(null);
      setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
      setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
      setHasActiveStoryCharacterChoice(false);
      setHasActiveVideoTypeChoice(false);
      setIsAwaitingStoryReply(false);
      activeStoryCharacterSelectionRef.current = null;
      activeVideoTypeRef.current = null;
      activeGameplaySelectionRef.current = null;
    }

    setTimeout(() => scrollToBottom("smooth", true), 60);

    if (shouldUseBackendChat) {
      addAssistantReply(mode, true);
      setIsAwaitingBackendReply(true);
      void requestBackendAssistantReply(mode, trimmed, backendHistory);
      return;
    }

    addAssistantReply(mode, shouldStartImmediately);
  }, [messages, scrollToBottom, addAssistantReply, requestBackendAssistantReply]);

  const isEmpty = messages.length === 0;
  const groups = groupMessages(messages);
  const isStoryProcessLocked =
    isCreatingInlineCharacter
    || isAwaitingStoryReply
    || (isThinkingStreamActive && activeRunMode === "story")
    || isClosingLogs;
  const activeInFlightStageLabel = useMemo(() => {
    if (!isThinkingStreamActive) return "";
    const latestStep = activeThinkingSteps[activeThinkingSteps.length - 1];
    if (!latestStep) return "in_progress";
    const rawStage = (latestStep.stageKey || "").trim();
    if (rawStage) return rawStage;
    const fallbackTitle = (latestStep.title || "").trim().replace(/\s+/g, "_").toLowerCase();
    return fallbackTitle || "in_progress";
  }, [isThinkingStreamActive, activeThinkingSteps]);

  return (
    <div
      className={styles.page}
      style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
    >
      {isEmpty && <DreamNavbar />}
      {!isEmpty && (
        <Link href="/" className={styles.chatBackBtn}>
          <ArrowLeft size={12} />
          Back
        </Link>
      )}

      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
            className={styles.emptyRoot}
          >
            <motion.h1
              className={styles.heroTitle}
              variants={headingLineMotion}
              initial="hidden"
              animate="show"
              style={{ marginBottom: "14px" }}
            >
              {TITLE_WORDS.map((word, i) => (
                <motion.span
                  key={i}
                  className={styles.headingWord}
                  variants={headingWordMotion}
                  style={i >= 3 ? {
                    background: "linear-gradient(90deg, #e07843 0%, #c9a035 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  } : undefined}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              className={styles.heroCopy}
              variants={blockMotion}
              custom={0.30}
              initial="hidden"
              animate="show"
              style={{ marginBottom: "34px" }}
            >
              Ask any question and Dream Buddy gives kid-safe answers, stories, and quiz help.
            </motion.p>

            <motion.div
              variants={blockMotion}
              custom={0.40}
              initial="hidden"
              animate="show"
              style={{ position: "relative", width: "100%", maxWidth: "680px" }}
            >
              <div style={{
                pointerEvents: "none", position: "absolute", bottom: "-48px", left: "50%",
                transform: "translateX(-50%)", width: "880px", height: "340px", borderRadius: "50%",
                background: "radial-gradient(ellipse at top, rgba(228,126,64,0.22) 0%, rgba(244,182,106,0.12) 44%, transparent 68%)",
                filter: "blur(36px)", zIndex: 0,
              }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <PromptInputBox
                  onSend={handleSend}
                  isLoading={isLoading}
                  placeholder="Ask Dream AI anything..."
                  mode={composerMode}
                  onModeChange={setComposerMode}
                />
              </div>
            </motion.div>
          </motion.div>

        ) : (

          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={styles.chatRoot}
          >
            {isStoryProcessLocked && <div className={styles.storyInteractionLock} />}
            <div className={styles.chatScroller} ref={scrollerRef}>
              <div className={styles.chatScrollInner}>

                {/* Message groups */}
                <AnimatePresence initial={false}>
                  {groups.map((group, gi) => (
                    <motion.div
                      key={`group-${gi}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, ease: easeOutExpo }}
                      className={`${styles.messageGroup} ${group.role === "user" ? styles.messageGroupUser : ""}`}
                    >
                      {group.role === "assistant" ? (
                        <div className={styles.aiAvatar}><Sparkles size={13} /></div>
                      ) : (
                        <div className={styles.userAvatar}><User size={12} /></div>
                      )}

                      <div className={`${styles.bubbleStack} ${group.role === "user" ? styles.bubbleStackUser : ""} ${group.role === "assistant" && group.messages.some(m => m.mode === "story") ? styles.bubbleStackStory : ""}`}>
                        {group.role === "user" && (
                          <div className={`${styles.senderLabel} ${styles.senderLabelUser}`}>You</div>
                        )}

                        {/* Thought summary — collapsed "Dreamed for Xs" above response */}
                        {group.role === "assistant" && group.messages[0].thinkingSteps && (
                          <div className={styles.thoughtSummaryWrap}>
                            <button
                              className={styles.thoughtSummary}
                              onClick={() => toggleThinking(group.messages[0].id)}
                            >
                              Dreamed for {group.messages[0].thinkingDuration}s
                              <ChevronRight
                                size={11}
                                className={expandedThinking.has(group.messages[0].id) ? styles.chevronOpen : styles.chevronClosed}
                              />
                            </button>

                            <AnimatePresence>
                              {expandedThinking.has(group.messages[0].id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: easeOutExpo }}
                                  style={{ overflow: "hidden" }}
                                >
                                  <div className={styles.thoughtLogPanel}>
                                    <p className={styles.thoughtLogTitle}>Logs</p>
                                    {group.messages[0].thinkingSteps.map((step, si) => {
                                      const isLast = si === group.messages[0].thinkingSteps!.length - 1;
                                      return (
                                        <div key={si} className={styles.thoughtLogStep}>
                                          <div className={styles.thoughtLogBulletCol}>
                                            <span className={styles.thoughtLogBullet} />
                                            {!isLast && <span className={styles.thoughtLogLine} />}
                                          </div>
                                          <div className={styles.thoughtLogStepContent}>
                                            <div className={styles.thoughtLogStepHead}>
                                              <div className={styles.thoughtLogStepHeadMain}>
                                                <p className={styles.thoughtLogStepTitle}>{step.title}</p>
                                                <p className={styles.thoughtLogStepDetail}>{step.detail}</p>
                                              </div>
                                              {step.data !== undefined ? (
                                                <button
                                                  type="button"
                                                  className={styles.jsonToggleBtn}
                                                  onClick={() => toggleJsonPanel(`${group.messages[0].id}:step:${si}`)}
                                                >
                                                  JSON
                                                  <motion.span
                                                    animate={{ rotate: openJsonByKey[`${group.messages[0].id}:step:${si}`] ? 180 : 0 }}
                                                    transition={{ duration: 0.22, ease: "easeInOut" }}
                                                    className={styles.jsonToggleChevron}
                                                  >
                                                    <ChevronDown size={11} />
                                                  </motion.span>
                                                </button>
                                              ) : null}
                                            </div>
                                            <AnimatePresence initial={false}>
                                              {step.data !== undefined && openJsonByKey[`${group.messages[0].id}:step:${si}`] ? (
                                                <motion.div
                                                  key={`${group.messages[0].id}-step-json-${si}`}
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: "auto", opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                                  style={{ overflow: "hidden" }}
                                                >
                                                  <pre className={styles.jsonOutputPre}>
                                                    {formatJsonForDisplay(step.data)}
                                                  </pre>
                                                </motion.div>
                                              ) : null}
                                            </AnimatePresence>
                                            {step.imageUrls?.length ? (
                                              <div className={styles.thoughtLogImageGrid}>
                                                {step.imageUrls.map((imageUrl, imageIndex) => (
                                                  <div key={`${si}-${imageIndex}`} className={styles.thoughtLogImageCard}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={imageUrl} alt={`Generated visual ${imageIndex + 1}`} loading="lazy" />
                                                    <span className={styles.thoughtLogImageIndex}>{imageIndex + 1}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Bubbles */}
                        {group.messages.map((msg, mi) => {
                          const isFirst = mi === 0;
                          const isLast = mi === group.messages.length - 1;

                          // Story mode: embed the generated story book + action row
                          if (msg.role === "assistant" && msg.mode === "story" && msg.storyBook) {
                            return (
                              <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.52, ease: easeOutExpo }}
                                className={styles.storyResult}
                              >
                                {/* Full embedded story book */}
                                <div className={styles.storyResultBook}>
                                  <StoryBook
                                    title={msg.storyBook.title}
                                    ageBand={msg.storyBook.ageBand}
                                    pages={msg.storyBook.pages}
                                    cover={msg.storyBook.cover}
                                  />
                                </div>

                                {/* Extra actions */}
                                <div className={styles.storyResultActions}>
                                  <button
                                    type="button"
                                    className={styles.storyResultRegenerateBtn}
                                    onClick={() => {
                                      setComposerMode("story");
                                      setShouldAutoScroll(true);
                                      scrollToBottom("smooth", true);
                                    }}
                                  >
                                    <RotateCw size={12} strokeWidth={2.5} className={styles.storyResultRegenerateIcon} />
                                    Regenerate
                                  </button>
                                  {msg.storyJobId ? (
                                    <Link href={`/dashboard/jobs/${msg.storyJobId}`} className={styles.storyResultActionBtn}>
                                      Open detailed logs
                                    </Link>
                                  ) : (
                                    <button type="button" className={styles.storyResultActionBtn}>
                                      Share
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            );
                          }

                          return (
                            <div
                              key={msg.id}
                              className={`${styles.bubble} ${
                                msg.role === "assistant"
                                  ? `${styles.bubbleAi} ${isFirst ? styles.bubbleAiFirst : ""} ${isLast ? styles.bubbleAiLast : ""}`
                                  : `${styles.bubbleUser} ${isFirst ? styles.bubbleUserFirst : ""} ${isLast ? styles.bubbleUserLast : ""}`
                              }`}
                            >
                              <div>
                                {msg.role === "assistant"
                                  ? renderAssistantMessageContent(msg.content)
                                  : msg.content}
                              </div>
                              {msg.role === "assistant" && (msg.references?.length ?? 0) > 0 ? (
                                <div className={styles.referenceSection}>
                                  {/* Header — click to toggle full list */}
                                  <button
                                    type="button"
                                    className={styles.referenceHeaderRow}
                                    onClick={() => toggleExpandedReferencesForMessage(msg.id)}
                                  >
                                    <span className={styles.referenceHeaderLabel}>Sources</span>
                                    <div className={styles.referenceHeaderRight}>
                                      <span className={styles.referenceHeaderCount}>{msg.references?.length}</span>
                                      <span className={styles.referenceHeaderViewAll}>
                                        {expandedReferencesByMessage[msg.id] ? "hide" : "view all"}
                                      </span>
                                      <ChevronDown
                                        size={10}
                                        className={styles.referenceHeaderChevron}
                                        style={{ transform: expandedReferencesByMessage[msg.id] ? "rotate(180deg)" : "rotate(0)" }}
                                      />
                                    </div>
                                  </button>

                                  {/* Source strip — plain text links with · separators */}
                                  <div className={styles.referenceStrip}>
                                    {msg.references?.map((ref, index) => (
                                      <React.Fragment key={`${msg.id}-pill-${index}`}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <a
                                          href={ref.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={styles.referenceStripPill}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <span className={styles.referenceStripPillLogo}>
                                            <img
                                              src={referenceLogoUrl(ref.url)}
                                              alt=""
                                              className={styles.referenceStripPillLogoImg}
                                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                                            />
                                            <span className={styles.referenceStripPillFallback}>
                                              {extractHostname(ref.url).slice(0, 1).toUpperCase()}
                                            </span>
                                          </span>
                                          <span className={styles.referenceStripPillText}>{extractHostname(ref.url)}</span>
                                        </a>
                                        {index < (msg.references?.length ?? 0) - 1 && (
                                          <span className={styles.referenceStripSep}>·</span>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </div>

                                  {/* Expanded 2-column card grid */}
                                  <AnimatePresence initial={false}>
                                    {expandedReferencesByMessage[msg.id] && (
                                      <motion.div
                                        key={`refs-${msg.id}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: "easeOut" }}
                                        style={{ overflow: "hidden" }}
                                      >
                                        <div className={styles.referenceList}>
                                          {msg.references?.map((ref, index) => (
                                            <a
                                              key={`${msg.id}-ref-${index}`}
                                              href={ref.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className={styles.referenceCard}
                                            >
                                              {/* favicon */}
                                              <span className={styles.referenceLogo}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                  src={referenceLogoUrl(ref.url)}
                                                  alt=""
                                                  className={styles.referenceLogoImg}
                                                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                                                />
                                                <span className={styles.referenceLogoFallback}>
                                                  {extractHostname(ref.url).slice(0, 1).toUpperCase()}
                                                </span>
                                              </span>
                                              {/* single-line text: title · domain */}
                                              <span className={styles.referenceInline}>
                                                <span className={styles.referenceTitle}>{ref.title}</span>
                                                <span className={styles.referenceMeta}>
                                                  · {[formatReferenceDate(ref.publishedDate), extractHostname(ref.url)].filter(Boolean).join(" · ")}
                                                </span>
                                              </span>
                                            </a>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        <div className={`${styles.bubbleTime} ${group.role === "user" ? styles.bubbleTimeUser : ""}`}>
                          {group.messages[group.messages.length - 1].timestamp.toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Live dreaming panel */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: easeOutExpo }}
                      style={{ transformOrigin: "top center" }}
                      className={`${styles.dreamingCard} ${isClosingLogs ? styles.dreamingCardClosing : ""}`}
                    >
                      {/* Card header */}
                      <div className={styles.dreamingCardHeader}>
                        <motion.div
                          className={styles.dreamingCardAvatar}
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Sparkles size={11} />
                        </motion.div>
                        <span className={styles.dreamingCardTitle}>Processing</span>
                        <span className={styles.dreamingCardTimer}>
                          {(activeRunMode === "story" || activeRunMode === "video") && !isThinkingStreamActive
                            ? "waiting"
                            : `${elapsedSeconds}s`}
                        </span>
                      </div>

                      {/* Step list */}
                      <div className={styles.dreamingCardBody}>
                        {activeRunMode === "story" && (
                          <div className={styles.dreamingStep}>
                            <div className={styles.dreamingBulletCol}>
                              <span className={styles.dreamingBullet} />
                              <span className={styles.dreamingLine} />
                            </div>
                            <div className={styles.dreamingStepContent}>
                              <p className={styles.dreamingStepTitle}>Choosing character style</p>
                              <p className={styles.dreamingStepDetail}>
                                {hasActiveStoryCharacterChoice
                                  ? "Character locked. Continuing with story generation."
                                  : "Choose a character card, then continue. Thinking starts after confirmation."}
                              </p>
                              <div className={styles.dreamingCarouselWrapper}>
                                <button
                                  type="button"
                                  onClick={() => scrollCharacterCarousel(-1)}
                                  className={styles.dreamingCarouselArrow}
                                  aria-label="Scroll left"
                                  tabIndex={-1}
                                  disabled={isStoryProcessLocked}
                                >
                                  <ChevronLeft size={12} strokeWidth={2.5} />
                                </button>
                                <div className={styles.dreamingCharacterCarousel} ref={characterCarouselRef}>
                                {/* "Let AI Decide" card */}
                                {(() => {
                                  const aiActive = isThinkingStreamActive
                                    ? activeStoryCharacterSelection === null && hasActiveStoryCharacterChoice
                                    : pendingUseAiStoryCharacter;
                                  return (
                                    <button
                                      type="button"
                                      onClick={handlePickPendingAiChoice}
                                      className={`${styles.dreamingCharacterCard} ${styles.dreamingAiCard} ${
                                        aiActive ? styles.dreamingCharacterCardActive : ""
                                      }`}
                                      data-active={aiActive || undefined}
                                      aria-pressed={pendingUseAiStoryCharacter}
                                      disabled={isStoryProcessLocked}
                                    >
                                      <div className={styles.dreamingAiCardInner}>
                                        <Sparkles size={15} />
                                        <span>AI</span>
                                        <span>Picks</span>
                                      </div>
                                      {aiActive && (
                                        <span className={styles.dreamingCharacterCardCheck}>✓</span>
                                      )}
                                    </button>
                                  );
                                })()}

                                {storyCharacterOptions.map((char) => {
                                  const active = isThinkingStreamActive
                                    ? activeStoryCharacterSelection?.type === "existing" &&
                                      activeStoryCharacterId === char.id
                                    : pendingStoryCharacterId === char.id;
                                  return (
                                    <button
                                      key={char.id}
                                      type="button"
                                      onClick={() => handlePickPendingStoryCharacter(char.id)}
                                      className={`${styles.dreamingCharacterCard} ${
                                        active ? styles.dreamingCharacterCardActive : ""
                                      }`}
                                      data-active={active || undefined}
                                      aria-pressed={active}
                                      disabled={isStoryProcessLocked}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={char.avatar} alt={char.name} loading="lazy" />
                                      {active && (
                                        <span className={styles.dreamingCharacterCardCheck}>✓</span>
                                      )}
                                      <span className={styles.dreamingCharacterCardMeta}>
                                        <span className={styles.dreamingCharacterCardName}>{char.name}</span>
                                        <span className={styles.dreamingCharacterCardRole}>{char.role}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                                {!isLoadingStoryCharacters && !isLoadingQueryStoryCharacter && storyCharacterOptions.length === 0 && (
                                  <div className={styles.dreamingCharacterEmpty}>
                                    No saved characters yet. Create one to reuse it here.
                                  </div>
                                )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => scrollCharacterCarousel(1)}
                                  className={styles.dreamingCarouselArrow}
                                  aria-label="Scroll right"
                                  tabIndex={-1}
                                  disabled={isStoryProcessLocked}
                                >
                                  <ChevronRight size={12} strokeWidth={2.5} />
                                </button>
                              </div>
                              <div className={styles.dreamingCharacterActions}>
                                <button
                                  type="button"
                                  onClick={handleConfirmStoryCharacterChoice}
                                  className={styles.dreamingCharacterPrimaryButton}
                                  disabled={!hasPendingStoryChoice || isStoryProcessLocked}
                                >
                                  {pendingUseAiStoryCharacter
                                    ? "Continue with AI"
                                    : pendingStoryCharacter
                                      ? `Continue with ${pendingStoryCharacter.name}`
                                      : "Pick a character to continue"}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleToggleInlineCharacterCreator}
                                  className={styles.dreamingCharacterSecondaryButton}
                                  disabled={isStoryProcessLocked}
                                >
                                  {isInlineCharacterCreatorOpen ? "Close creator" : "+ Create in chat"}
                                </button>
                                <Link
                                  href="/dashboard/characters/new-character"
                                  className={styles.dreamingCharacterSecondaryButton}
                                  onClick={(event) => {
                                    if (!isStoryProcessLocked) return;
                                    event.preventDefault();
                                  }}
                                >
                                  Open full creator
                                </Link>
                              </div>
                              {isInlineCharacterCreatorOpen && (
                                <div className={styles.inlineCharacterCreatorPanel}>
                                  <p className={styles.inlineCharacterCreatorTitle}>
                                    Create a new character and continue in one go
                                  </p>
                                  <div className={styles.inlineCharacterCreatorGrid}>
                                    <input
                                      type="text"
                                      value={inlineCharacterName}
                                      onChange={(event) => setInlineCharacterName(event.target.value)}
                                      placeholder="Character name"
                                      className={styles.inlineCharacterCreatorInput}
                                      disabled={isStoryProcessLocked}
                                    />
                                    <input
                                      type="text"
                                      value={inlineCharacterRole}
                                      onChange={(event) => setInlineCharacterRole(event.target.value)}
                                      placeholder="Role (optional)"
                                      className={styles.inlineCharacterCreatorInput}
                                      disabled={isStoryProcessLocked}
                                    />
                                    <textarea
                                      value={inlineCharacterDescription}
                                      onChange={(event) => setInlineCharacterDescription(event.target.value)}
                                      placeholder="Describe the character appearance, personality, and style."
                                      className={styles.inlineCharacterCreatorTextarea}
                                      disabled={isStoryProcessLocked}
                                      rows={3}
                                    />
                                    <div className={styles.inlineCharacterCreatorUploadRow}>
                                      <label className={styles.inlineCharacterCreatorUploadLabel}>
                                        Upload character image
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={handleInlineCharacterImageChange}
                                          className={styles.inlineCharacterCreatorUploadInput}
                                          disabled={isStoryProcessLocked}
                                        />
                                      </label>
                                      {inlineCharacterImageData ? (
                                        <div className={styles.inlineCharacterCreatorPreviewWrap}>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={inlineCharacterImageData}
                                            alt={inlineCharacterImageName || "Uploaded character reference"}
                                            className={styles.inlineCharacterCreatorPreviewImage}
                                          />
                                          <span className={styles.inlineCharacterCreatorPreviewName}>
                                            {inlineCharacterImageName || "Reference image selected"}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={handleRemoveInlineCharacterImage}
                                            className={styles.inlineCharacterCreatorRemoveUpload}
                                            disabled={isStoryProcessLocked}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className={styles.inlineCharacterCreatorActions}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsInlineCharacterCreatorOpen(false);
                                        setInlineCharacterImageData("");
                                        setInlineCharacterImageName("");
                                        setInlineCharacterError("");
                                      }}
                                      className={styles.inlineCharacterCreatorCancel}
                                      disabled={isStoryProcessLocked}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCreateCharacterInlineAndContinue}
                                      className={styles.inlineCharacterCreatorConfirm}
                                      disabled={isStoryProcessLocked}
                                    >
                                      {isCreatingInlineCharacter ? "Creating character..." : "Create & Continue"}
                                    </button>
                                  </div>
                                  {inlineCharacterError && (
                                    <p className={styles.inlineCharacterCreatorError}>{inlineCharacterError}</p>
                                  )}
                                </div>
                              )}
                              <p className={styles.dreamingCharacterStatus}>
                                {!hasActiveStoryCharacterChoice
                                  ? pendingUseAiStoryCharacter
                                    ? "AI creativity selected — tap Continue."
                                    : pendingStoryCharacter
                                      ? `${pendingStoryCharacter.name} selected — tap Continue.`
                                      : (isLoadingStoryCharacters || isLoadingQueryStoryCharacter)
                                        ? "Loading your saved characters..."
                                        : storyCharacterOptions.length === 0
                                          ? "No saved characters yet. Create one or let AI decide."
                                          : "Scroll to pick a character, or let AI decide."
                                  : activeStoryCharacterSelection?.type === "existing" && activeStoryCharacter
                                    ? `${activeStoryCharacter.name} locked in.`
                                    : "AI creativity locked in."}
                              </p>
                            </div>
                          </div>
                        )}

                        {activeRunMode === "video" && (
                          <div className={styles.dreamingStep}>
                            <div className={styles.dreamingBulletCol}>
                              <span className={styles.dreamingBullet} />
                              <span className={styles.dreamingLine} />
                            </div>
                            <div className={styles.dreamingStepContent}>
                              <p className={styles.dreamingStepTitle}>Choosing video format</p>
                              <p className={styles.dreamingStepDetail}>
                                {hasActiveVideoTypeChoice
                                  ? "Video format locked. Continuing with rendering."
                                  : "Choose Normal or Gameplay, then continue. Thinking starts after confirmation."}
                              </p>
                              <div className={styles.dreamingVideoTypeGrid}>
                                {VIDEO_MODE_OPTIONS.map((option) => {
                                  const active = isThinkingStreamActive
                                    ? activeVideoType === option.value
                                    : pendingVideoType === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => handlePickPendingVideoType(option.value)}
                                      className={`${styles.dreamingVideoTypeCard} ${
                                        active ? styles.dreamingVideoTypeCardActive : ""
                                      }`}
                                      aria-pressed={active}
                                      disabled={isThinkingStreamActive || isClosingLogs}
                                    >
                                      <span className={styles.dreamingVideoTypeIcon}>
                                        {option.value === "gameplay" ? <Gamepad2 size={13} /> : <Clapperboard size={13} />}
                                      </span>
                                      <span className={styles.dreamingVideoTypeLabel}>{option.label}</span>
                                      <span className={styles.dreamingVideoTypeDetail}>{option.description}</span>
                                      <span className={styles.dreamingVideoTypeHelper}>
                                        {option.value === "gameplay" ? "Gameplay stack" : "Narrative stack"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              {(isThinkingStreamActive ? activeVideoType === "gameplay" : pendingVideoType === "gameplay") && (
                                <div className={styles.dreamingGameplayPicker}>
                                  <p className={styles.dreamingGameplayHeading}>Gameplay style</p>
                                  <div className={styles.dreamingGameplayCategoryRow}>
                                    {GAMEPLAY_CATEGORY_OPTIONS.map((category) => {
                                      const activeCategory = (isThinkingStreamActive
                                        ? activeGameplaySelection?.category
                                        : pendingGameplayCategory) === category.id;
                                      return (
                                        <button
                                          key={category.id}
                                          type="button"
                                          onClick={() => handlePickPendingGameplayCategory(category.id)}
                                          className={`${styles.dreamingGameplayCategoryPill} ${
                                            activeCategory ? styles.dreamingGameplayCategoryPillActive : ""
                                          }`}
                                          disabled={isThinkingStreamActive || isClosingLogs}
                                        >
                                          {category.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className={styles.dreamingGameplayGrid}>
                                    {GAMEPLAY_BACKGROUNDS[
                                      (isThinkingStreamActive ? activeGameplaySelection?.category : pendingGameplayCategory)
                                      ?? DEFAULT_GAMEPLAY_CATEGORY
                                    ].map((clip) => {
                                      const activeBackground = (isThinkingStreamActive
                                        ? activeGameplaySelection?.backgroundId
                                        : pendingGameplayBackgroundId) === clip.id;
                                      return (
                                        <button
                                          key={clip.id}
                                          type="button"
                                          title={clip.name}
                                          onClick={() => handlePickPendingGameplayBackground(clip.id)}
                                          className={`${styles.dreamingGameplayThumb} ${
                                            activeBackground ? styles.dreamingGameplayThumbActive : ""
                                          }`}
                                          disabled={isThinkingStreamActive || isClosingLogs}
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={clip.thumb} alt={clip.name} loading="lazy" />
                                          <span className={styles.dreamingGameplayThumbLabel}>{clip.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <p className={styles.dreamingGameplayHint}>
                                    Selected gameplay background:{" "}
                                    {(isThinkingStreamActive
                                      ? activeGameplaySelection?.backgroundName
                                      : pendingGameplayBackground?.name) ?? "Choose one"}
                                  </p>
                                </div>
                              )}
                              <div className={styles.dreamingCharacterActions}>
                                <button
                                  type="button"
                                  onClick={handleConfirmVideoTypeChoice}
                                  className={styles.dreamingCharacterPrimaryButton}
                                  disabled={!pendingVideoType || isThinkingStreamActive || isClosingLogs}
                                >
                                  {pendingVideoType === "gameplay" && pendingGameplayBackground
                                    ? `Continue with Gameplay • ${pendingGameplayBackground.name}`
                                    : pendingVideoTypeOption
                                      ? `Continue with ${pendingVideoTypeOption.label}`
                                    : "Select video format to continue"}
                                </button>
                              </div>
                              <p className={styles.dreamingCharacterStatus}>
                                {!hasActiveVideoTypeChoice
                                  ? pendingVideoTypeOption
                                    ? pendingVideoType === "gameplay" && pendingGameplayBackground
                                      ? `Ready with Gameplay • ${pendingGameplayBackground.name}. Tap continue.`
                                      : `Ready with ${pendingVideoTypeOption.label}. Tap continue.`
                                    : "Waiting for your video format selection."
                                  : activeVideoType === "gameplay"
                                    ? `Selected gameplay video mode${activeGameplaySelection ? ` (${activeGameplaySelection.backgroundName}).` : "."}`
                                    : "Selected normal video mode."}
                              </p>
                            </div>
                          </div>
                        )}

                        <AnimatePresence initial={false}>
                          {activeThinkingSteps.slice(0, visibleSteps).map((step, i) => {
                            const isLastVisible = i === visibleSteps - 1;
                            const hasMore = visibleSteps < activeThinkingSteps.length;
                            const showLine = !isLastVisible || hasMore;
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.32, ease: easeOutExpo }}
                                className={styles.dreamingStep}
                              >
                                <div className={styles.dreamingBulletCol}>
                                  <span className={styles.dreamingBullet} />
                                  {showLine && <span className={styles.dreamingLine} />}
                                </div>
                                <div className={styles.dreamingStepContent}>
                                  <p className={styles.dreamingStepTitle}>{step.title}</p>
                                  <p className={styles.dreamingStepDetail}>{step.detail}</p>
                                  {step.imageUrls?.length ? (
                                    <div className={styles.dreamingStepVisuals}>
                                      <div className={styles.dreamingImageGrid}>
                                        {step.imageUrls.slice(0, visibleImageCount).map((imageUrl, imageIndex) => (
                                          <motion.div
                                            key={`${i}-${imageIndex}`}
                                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.22, ease: easeOutExpo }}
                                            className={styles.dreamingImageCard}
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={imageUrl} alt={`Generated visual ${imageIndex + 1}`} loading="lazy" />
                                            <span className={styles.dreamingImageIndex}>{imageIndex + 1}</span>
                                          </motion.div>
                                        ))}
                                      </div>
                                      {!isClosingLogs && visibleImageCount < step.imageUrls.length && (
                                        <p className={styles.dreamingImageProgress}>
                                          Rendering visuals {visibleImageCount}/{step.imageUrls.length}
                                        </p>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {/* Spinner aligned under bullets */}
                        {!isClosingLogs && isThinkingStreamActive && (
                          <div className={styles.dreamingSpinnerRow}>
                            <div className={styles.dreamingSpinnerIndent}>
                              <span className={styles.dreamingSpinner} />
                            </div>
                            {visibleSteps >= activeThinkingSteps.length && (
                              <span className={styles.dreamingFinalizingText}>
                                {activeInFlightStageLabel || "in_progress"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={bottomRef} style={{ height: isLoading ? 72 : 12 }} />
              </div>
            </div>

            {/* Input footer */}
            <div className={styles.inputFooter}>
              <div className={styles.inputGlow} />
              <div className={styles.inputInner}>
                <PromptInputBox
                  onSend={handleSend}
                  isLoading={isLoading}
                  placeholder="Ask another question..."
                  mode={composerMode}
                  onModeChange={setComposerMode}
                />
                <p className={styles.inputDisclaimer}>
                  Dream AI stories are fictional and made for kids.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
