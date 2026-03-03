/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  Plus,
  RotateCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { StoryBook } from "@/components/dashboard/story-book";
import type { StoryPage } from "@/lib/dashboard-data";

import { createJob, type Job } from "@/lib/jobs";
import styles from "../dashboard.module.css";
import chatStyles from "../../chat/chat-page.module.css";

type WorkflowChoice = "" | "reference_enriched" | "prompt_only";
type ApiTarget = "main";
type RequestState = "idle" | "loading" | "success" | "error";
type HealthState = "idle" | "loading" | "ok" | "error";

type WorldReferenceInput = {
  title: string;
  description: string;
  file: File | null;
  previewUrl: string;
};

type DrawingInput = {
  description: string;
  notes: string;
  file: File | null;
  previewUrl: string;
};

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
    label?: string | null;
    left?: { kind?: string; image_url?: string; chapter?: string; text?: string; title?: string };
    right?: { kind?: string; image_url?: string; chapter?: string; text?: string; title?: string; audio_url?: string };
  }>;
  generated_images?: string[];
  scene_prompts?: {
    cover_prompt?: string;
    illustration_prompts?: string[];
    negative_prompt?: string;
  };
  characters?: Array<{ name?: string; brief?: string; generated_images?: string[]; warnings?: string[] }>;
  warnings?: string[];
  replicate_model?: string;
  reference_images_used_count?: number;
  generation_sources?: Record<string, string>;
  reference_image_breakdown?: Record<string, number>;
  scene_reference_counts?: number[];
};

type SpreadSide = {
  kind?: string;
  image_url?: string;
  chapter?: string;
  text?: string;
  title?: string;
  audio_url?: string;
};

type StoryPageCard = {
  pageNumber: number;
  chapter: string;
  text: string;
  imageUrl: string | null;
  prompt: string;
  audioUrl?: string;
};

type LiveLogLevel = "info" | "success" | "error";

type LiveLogEntry = {
  id: number;
  level: LiveLogLevel;
  source: string;
  message: string;
  data?: unknown;
};

type LiveTimelineStep = {
  key: string;
  title: string;
  detail: string;
  stageKey?: string;
  imageUrls: string[];
  data?: unknown;
};

type ParsedProgressEvent = {
  stage: string;
  message: string;
  rendered: string;
  data?: unknown;
};

const EMPTY_WORLD_REFERENCE: WorldReferenceInput = {
  title: "",
  description: "",
  file: null,
  previewUrl: "",
};

const EMPTY_DRAWING: DrawingInput = {
  description: "",
  notes: "",
  file: null,
  previewUrl: "",
};

const DEFAULT_SCENE_IMAGE_COUNT = 11;

function cleanText(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function hasAnyValue(entry: Record<string, string | undefined>) {
  return Object.values(entry).some(Boolean);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read uploaded image."));
    };
    reader.onerror = () => reject(new Error("Failed to read uploaded image."));
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const paddingMatch = base64.match(/=+$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function fileToOptimizedDataUrl(file: File, maxBytes = 650_000): Promise<string> {
  const originalDataUrl = await fileToDataUrl(file);
  const originalBytes = estimateDataUrlBytes(originalDataUrl);
  if (originalBytes <= maxBytes) {
    return originalDataUrl;
  }

  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return originalDataUrl;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode uploaded image for optimization."));
      img.src = objectUrl;
    });

    const maxSide = 1400;
    const baseScale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const baseWidth = Math.max(320, Math.round(image.naturalWidth * baseScale));
    const baseHeight = Math.max(320, Math.round(image.naturalHeight * baseScale));

    let bestDataUrl = originalDataUrl;
    let bestBytes = originalBytes;

    const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46];
    for (let shrinkStep = 0; shrinkStep < 5; shrinkStep += 1) {
      const shrinkFactor = Math.pow(0.86, shrinkStep);
      const targetWidth = Math.max(256, Math.round(baseWidth * shrinkFactor));
      const targetHeight = Math.max(256, Math.round(baseHeight * shrinkFactor));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      if (!context) continue;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      for (const quality of qualities) {
        const candidateDataUrl = canvas.toDataURL("image/jpeg", quality);
        const candidateBytes = estimateDataUrlBytes(candidateDataUrl);

        if (candidateBytes < bestBytes) {
          bestDataUrl = candidateDataUrl;
          bestBytes = candidateBytes;
        }

        if (candidateBytes <= maxBytes) {
          return candidateDataUrl;
        }
      }
    }

    return bestDataUrl;
  } catch {
    return originalDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function unwrapStorybookPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const backendResponse = (payload as { backend_response?: unknown }).backend_response;
  if (backendResponse && typeof backendResponse === "object") {
    return backendResponse;
  }
  return payload;
}

function SpreadSideCard({
  side,
  pageTitle,
  onExpandImage,
}: {
  side?: SpreadSide;
  pageTitle: string;
  onExpandImage?: (imageUrl: string) => void;
}) {
  if (!side) {
    return (
      <div
        className="rounded-xl border p-3 text-xs"
        style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#9a7a65" }}
      >
        {pageTitle}: empty
      </div>
    );
  }

  const hasImage = Boolean(side.image_url);

  return (
    <article className="min-w-0 rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#9a7a65" }}>
        {pageTitle} • {side.kind || "content"}
      </p>

      {side.title ? (
        <p className="mt-2 break-words text-sm font-semibold" style={{ color: "#2b180a" }}>
          {side.title}
        </p>
      ) : null}

      {side.chapter ? (
        <p className="mt-1 break-words text-xs font-semibold" style={{ color: "#7a5a45" }}>
          {side.chapter}
        </p>
      ) : null}

      {side.text ? (
        <p className="mt-1 break-words text-xs leading-5" style={{ color: "#7a5a45" }}>
          {side.text}
        </p>
      ) : null}

      {side.audio_url ? (
        <div className="mt-2 rounded-lg border px-2 py-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
          <p className="mb-1 text-[11px] font-semibold" style={{ color: "#7a5a45" }}>
            MP3 narration
          </p>
          <audio controls preload="none" src={side.audio_url} className="h-8 w-full" />
        </div>
      ) : null}

      {hasImage ? (
        <div className="mt-2 w-full rounded-lg border p-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
          <motion.button
            type="button"
            className="flex w-full aspect-[4/3] cursor-zoom-in items-center justify-center overflow-hidden rounded-md"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => side.image_url && onExpandImage?.(side.image_url)}
          >
            <img src={side.image_url} alt={`${pageTitle} visual`} className="h-full w-full rounded object-contain" />
          </motion.button>
          <a
            href={side.image_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: "#5b2a08" }}
          >
            Open full image <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : null}
    </article>
  );
}

function StatusChip({ label, tone }: { label: string; tone: "neutral" | "ok" | "error" | "running" }) {
  const toneStyles: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: "#f8efe5", fg: "#7a5a45", border: "#dbc9b7" },
    ok: { bg: "#edf9ee", fg: "#1f6a32", border: "#9fddb0" },
    error: { bg: "#feefef", fg: "#981b1b", border: "#f1b0b0" },
    running: { bg: "#fff7e9", fg: "#8a5a00", border: "#edd9a7" },
  };

  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: toneStyles[tone].bg,
        color: toneStyles[tone].fg,
        borderColor: toneStyles[tone].border,
      }}
    >
      {label}
    </span>
  );
}

function formatStageTitle(stage: string) {
  const normalized = stage.trim().replace(/[_-]+/g, " ");
  if (!normalized) return "Progress";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildProgressTimelineKey(stage: string, data: unknown): string {
  const normalizedStage = (stage || "progress").trim() || "progress";
  let key = normalizedStage;
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

  if (sceneIndex !== null) {
    key += `:scene:${sceneIndex}`;
  }
  if (attempt !== null) {
    key += `:attempt:${attempt}`;
  }
  return key;
}

function formatJsonForDisplay(value: unknown): string {
  const tryParseStringifiedJson = (text: string): unknown => {
    const trimmed = text.trim();
    if (!trimmed) return text;
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return text;
      }
    }
    return text;
  };

  const normalize = (input: unknown): unknown => {
    if (typeof input === "string") {
      const maybeParsed = tryParseStringifiedJson(input);
      if (maybeParsed !== input) {
        return normalize(maybeParsed);
      }
      const unescaped = input
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"');
      return unescaped;
    }
    if (Array.isArray(input)) {
      return input.map((entry) => normalize(entry));
    }
    if (input && typeof input === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
        out[key] = normalize(val);
      }
      return out;
    }
    return input;
  };

  try {
    return JSON.stringify(normalize(value), null, 2);
  } catch {
    return String(value);
  }
}

export default function DashboardStorybookTestPage() {
  const apiTarget: ApiTarget = "main";
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [maxCharacters, setMaxCharacters] = useState(2);
  const [workflowChoice, setWorkflowChoice] = useState<WorkflowChoice>("");

  const [worldReferences, setWorldReferences] = useState<WorldReferenceInput[]>([]);
  const [drawings, setDrawings] = useState<DrawingInput[]>([{ ...EMPTY_DRAWING }]);

  const [healthState, setHealthState] = useState<HealthState>("idle");
  const [healthMessage, setHealthMessage] = useState("");

  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [lastPayload, setLastPayload] = useState<unknown>(null);
  const [responseBody, setResponseBody] = useState<unknown>(null);
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");
  const [liveLogs, setLiveLogs] = useState<LiveLogEntry[]>([]);
  const [liveTimelineSteps, setLiveTimelineSteps] = useState<LiveTimelineStep[]>([]);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [dreamedForSeconds, setDreamedForSeconds] = useState(0);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [openTimelineJsonByKey, setOpenTimelineJsonByKey] = useState<Record<string, boolean>>({});
  const [openLogJsonById, setOpenLogJsonById] = useState<Record<number, boolean>>({});
  const [currentJob, setCurrentJob] = useState<Job | null>(null);

  const payloadJson = useMemo(() => JSON.stringify(lastPayload, null, 2), [lastPayload]);
  const responseJson = useMemo(() => JSON.stringify(responseBody, null, 2), [responseBody]);

  const orchestratorEnvelope =
    responseBody && typeof responseBody === "object" && responseBody !== null
      ? (responseBody as {
          backend_endpoint?: string;
          backend_status_code?: number;
          backend_response?: unknown;
        })
      : null;

  const workflowPayload = useMemo(() => unwrapStorybookPayload(responseBody), [responseBody]);

  const responseData =
    workflowPayload && typeof workflowPayload === "object" && workflowPayload !== null
      ? (workflowPayload as StorybookResponse)
      : null;

  const generatedImages = useMemo(() => responseData?.generated_images ?? [], [responseData?.generated_images]);
  const spreads = useMemo(() => responseData?.spreads ?? [], [responseData?.spreads]);
  const characters = useMemo(() => responseData?.characters ?? [], [responseData?.characters]);
  const warnings = useMemo(() => responseData?.warnings ?? [], [responseData?.warnings]);
  const generationSources = useMemo(
    () => responseData?.generation_sources ?? {},
    [responseData?.generation_sources]
  );
  const referenceBreakdown = useMemo(
    () => responseData?.reference_image_breakdown ?? {},
    [responseData?.reference_image_breakdown]
  );
  const sceneReferenceCounts = useMemo(
    () => responseData?.scene_reference_counts ?? [],
    [responseData?.scene_reference_counts]
  );
  const scenePrompts = useMemo(
    () => responseData?.scene_prompts?.illustration_prompts ?? [],
    [responseData?.scene_prompts?.illustration_prompts]
  );

  const storyPages = useMemo<StoryPageCard[]>(() => {
    const pages = responseData?.story?.right_pages ?? [];
    if (!pages.length) return [];

    const spreadMap = new Map(
      spreads
        .filter((spread) => typeof spread.spread_index === "number")
        .map((spread) => [spread.spread_index as number, spread])
    );

    return pages
      .filter((page) => typeof page.page_number === "number")
      .sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0))
      .map((page) => {
        const pageNumber = Math.max(1, Number(page.page_number ?? 1));
        const spread = spreadMap.get(pageNumber);
        return {
          pageNumber,
          chapter: page.chapter || `Chapter ${pageNumber}`,
          text: page.text || "",
          imageUrl: spread?.left?.image_url || null,
          prompt: scenePrompts[pageNumber - 1] || "",
          audioUrl: page.audio_url || spread?.right?.audio_url,
        };
      });
  }, [responseData?.story?.right_pages, scenePrompts, spreads]);

  const exactBookPreview = useMemo<{
    title: string;
    ageBand: string;
    cover: string;
    pages: StoryPage[];
  } | null>(() => {
    const story = responseData?.story;
    if (!story) return null;

    const rightPages = Array.isArray(story.right_pages) ? story.right_pages : [];
    const rightPageMap = new Map(
      rightPages
        .filter((page) => typeof page.page_number === "number")
        .map((page) => [Number(page.page_number), page])
    );

    const spreadMap = new Map(
      spreads
        .filter((spread) => typeof spread.spread_index === "number")
        .map((spread) => [Number(spread.spread_index), spread])
    );

    const coverImage =
      generatedImages[0] ||
      spreadMap.get(0)?.left?.image_url ||
      spreadMap.get(1)?.left?.image_url ||
      "";
    if (!coverImage) return null;

    const pages: StoryPage[] = [];
    const pageNumbers = Array.from(rightPageMap.keys()).sort((a, b) => a - b);
    for (const pageNumber of pageNumbers) {
      const spread = spreadMap.get(pageNumber);
      const leftImage = spread?.left?.image_url || generatedImages[pageNumber] || "";
      pages.push({
        text: "",
        illustration: leftImage || coverImage,
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
      ageBand: ageBand.trim() || "5-8",
      cover: coverImage,
      pages,
    };
  }, [ageBand, generatedImages, responseData?.story, spreads]);

  const canSubmit = requestState !== "loading" && prompt.trim().length > 0;

  const hasActiveRun = requestState !== "idle" || liveLogs.length > 0;
  const activeLoadingStageKey = useMemo(() => {
    const latest = liveTimelineSteps[liveTimelineSteps.length - 1];
    if (!latest) return "in_progress";
    const raw = (latest.stageKey || latest.key || "").trim();
    return raw || "in_progress";
  }, [liveTimelineSteps]);

  useEffect(() => {
    if (!expandedImageUrl) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedImageUrl(null);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedImageUrl]);

  const checkHealth = useCallback(async () => {
    setHealthState("loading");
    setHealthMessage("");

    try {
      const response = await fetch(`/api/storybook-test?target=${apiTarget}`, { method: "GET" });
      const text = await response.text();
      if (!response.ok) {
        setHealthState("error");
        setHealthMessage(text || "Health check failed.");
        return;
      }
      setHealthState("ok");
      setHealthMessage(text || '{"status":"ok"}');
    } catch (error) {
      setHealthState("error");
      setHealthMessage(error instanceof Error ? error.message : "Health check failed.");
    }
  }, [apiTarget]);

  function addWorldReference() {
    setWorldReferences((prev) => [...prev, { ...EMPTY_WORLD_REFERENCE }]);
  }

  function addDrawing() {
    setDrawings((prev) => [...prev, { ...EMPTY_DRAWING }]);
  }

  function setWorldReferenceFile(index: number, file: File | null) {
    setWorldReferences((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (!file) return { ...item, file: null, previewUrl: "" };
        return { ...item, file, previewUrl: URL.createObjectURL(file) };
      })
    );
  }

  function setDrawingFile(index: number, file: File | null) {
    setDrawings((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (!file) return { ...item, file: null, previewUrl: "" };
        return { ...item, file, previewUrl: URL.createObjectURL(file) };
      })
    );
  }

  function removeWorldReference(index: number) {
    setWorldReferences((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function removeDrawing(index: number) {
    setDrawings((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function buildPayload() {
    const worldReferencesPayload = (
      await Promise.all(
        worldReferences.map(async (entry) => ({
          title: cleanText(entry.title),
          description: cleanText(entry.description),
          image_data: entry.file ? await fileToOptimizedDataUrl(entry.file) : undefined,
        }))
      )
    ).filter(hasAnyValue);

    const drawingsPayload = (
      await Promise.all(
        drawings.map(async (entry) => ({
          description: cleanText(entry.description),
          notes: cleanText(entry.notes),
          image_data: entry.file ? await fileToOptimizedDataUrl(entry.file) : undefined,
        }))
      )
    ).filter(hasAnyValue);

    const payload: Record<string, unknown> = {
      user_prompt: prompt.trim(),
      world_references: worldReferencesPayload,
      character_drawings: drawingsPayload,
      max_characters: Math.max(1, Math.min(maxCharacters, 2)),
    };

    if (tone.trim()) payload.tone = tone.trim();
    if (ageBand.trim()) payload.age_band = ageBand.trim();
    if (workflowChoice) payload.force_workflow = workflowChoice;

    return payload;
  }

  function toPayloadForDisplay(payload: Record<string, unknown>) {
    const world = Array.isArray(payload.world_references)
      ? (payload.world_references as Array<{ image_data?: string }>)
      : [];
    const drawingsData = Array.isArray(payload.character_drawings)
      ? (payload.character_drawings as Array<{ image_data?: string }>)
      : [];

    return {
      ...payload,
      world_references: world.map((entry) => ({
        ...entry,
        image_data: entry.image_data ? `[data-url length=${entry.image_data.length}]` : undefined,
      })),
      character_drawings: drawingsData.map((entry) => ({
        ...entry,
        image_data: entry.image_data ? `[data-url length=${entry.image_data.length}]` : undefined,
      })),
    };
  }

  function pushLiveLog(
    level: LiveLogLevel,
    source: string,
    message: string,
    data?: unknown
  ) {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLiveLogs((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        level,
        source,
        message: trimmed,
        data,
      },
    ]);
  }

  function parseEmbeddedProgressData(message: string) {
    const marker = "| data=";
    const markerIndex = message.indexOf(marker);
    if (markerIndex < 0) {
      return { cleanMessage: message.trim(), data: undefined as unknown };
    }

    const cleanMessage = message.slice(0, markerIndex).trim();
    const rawData = message.slice(markerIndex + marker.length).trim();
    if (!rawData) {
      return { cleanMessage, data: undefined as unknown };
    }

    try {
      return { cleanMessage, data: JSON.parse(rawData) as unknown };
    } catch {
      return { cleanMessage, data: rawData as unknown };
    }
  }

  function normalizeProgressEvent(eventObj: Record<string, unknown>): ParsedProgressEvent {
    const stageRaw = typeof eventObj.stage === "string" ? eventObj.stage.trim() : "";
    const stage = stageRaw || "progress";
    const rawMessage =
      typeof eventObj.message === "string" && eventObj.message.trim()
        ? eventObj.message.trim()
        : "Progress update received.";
    const embedded = parseEmbeddedProgressData(rawMessage);
    const message = embedded.cleanMessage || "Progress update received.";
    const eventData =
      eventObj.data !== undefined
        ? eventObj.data
        : embedded.data;

    return {
      stage,
      message,
      rendered: `[${stage.replace(/_/g, " ")}] ${message}`,
      data: eventData,
    };
  }

  function upsertTimelineStep(
    key: string,
    title: string,
    detail: string,
    imageUrl?: string,
    data?: unknown,
    stageKey?: string
  ) {
    setLiveTimelineSteps((prev) => {
      const existingIndex = prev.findIndex((step) => step.key === key);
      if (existingIndex < 0) {
        return [
          ...prev,
          {
            key,
            title,
            detail,
            stageKey,
            imageUrls: imageUrl ? [imageUrl] : [],
            data,
          },
        ];
      }

      const next = [...prev];
      const current = next[existingIndex];
      const nextImageUrls =
        imageUrl && !current.imageUrls.includes(imageUrl)
          ? [...current.imageUrls, imageUrl]
          : current.imageUrls;

      next[existingIndex] = {
        ...current,
        title,
        detail,
        stageKey: stageKey ?? current.stageKey,
        imageUrls: nextImageUrls,
        data: data ?? current.data,
      };
      return next;
    });
  }

  function pushTimelineProgress(progressEvent: ParsedProgressEvent) {
    const stage = progressEvent.stage || "progress";
    const message = progressEvent.message || "Progress update received.";
    const data =
      typeof progressEvent.data === "object" && progressEvent.data !== null
        ? (progressEvent.data as Record<string, unknown>)
        : null;

    if (stage === "scene_image_generated") {
      const imageUrl = typeof data?.image_url === "string" ? data.image_url : "";
      const sceneIndex = typeof data?.scene_index === "number" ? Number(data.scene_index) : null;
      const sceneType = typeof data?.scene_type === "string" ? data.scene_type : "";

      setLiveTimelineSteps((prev) => {
        const key = "scene_image_generation";
        const index = prev.findIndex((step) => step.key === key);

        const makeImageItem = () => ({
          scene_index: sceneIndex,
          scene_type: sceneType || (sceneIndex === 0 ? "cover" : "page"),
          image_url: imageUrl,
        });

        if (index < 0) {
          const images = imageUrl ? [makeImageItem()] : [];
          return [
            ...prev,
            {
              key,
              title: "Scene image generation",
              stageKey: stage,
              detail: imageUrl
                ? `${images.length}/${DEFAULT_SCENE_IMAGE_COUNT} images generated. ${message}`
                : message,
              imageUrls: imageUrl ? [imageUrl] : [],
              data: {
                generated_count: images.length,
                total_expected: DEFAULT_SCENE_IMAGE_COUNT,
                images,
              },
            },
          ];
        }

        const next = [...prev];
        const current = next[index];
        const currentData =
          current.data && typeof current.data === "object"
            ? (current.data as Record<string, unknown>)
            : {};
        const totalExpected =
          typeof currentData.total_expected === "number"
            ? Number(currentData.total_expected)
            : DEFAULT_SCENE_IMAGE_COUNT;
        const existingItemsRaw = Array.isArray(currentData.images) ? currentData.images : [];
        const existingItems = existingItemsRaw.filter(
          (item): item is { scene_index: number | null; scene_type: string; image_url: string } =>
            Boolean(item) && typeof item === "object" && typeof (item as { image_url?: unknown }).image_url === "string"
        );

        const exists = imageUrl
          ? existingItems.some((item) => item.image_url === imageUrl)
          : false;
        const nextItems =
          imageUrl && !exists
            ? [...existingItems, makeImageItem()]
            : existingItems;

        const nextImageUrls =
          imageUrl && !current.imageUrls.includes(imageUrl)
            ? [...current.imageUrls, imageUrl]
            : current.imageUrls;

        next[index] = {
          ...current,
          title: "Scene image generation",
          stageKey: stage,
          detail: `${nextItems.length}/${totalExpected} images generated. ${message}`,
          imageUrls: nextImageUrls,
          data: {
            generated_count: nextItems.length,
            total_expected: totalExpected,
            latest_scene_index: sceneIndex,
            latest_message: message,
            images: nextItems,
          },
        };
        return next;
      });
      return;
    }

    if (stage === "character_generation_complete") {
      const name = typeof data?.name === "string" ? data.name.trim() : "";
      const key = name ? `character_generation_complete:${name}` : "character_generation_complete";
      const title = name ? `Character ready: ${name}` : formatStageTitle(stage);
      const generatedImages = Array.isArray(data?.generated_images)
        ? data.generated_images.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];

      upsertTimelineStep(key, title, message, generatedImages[0], data ?? undefined, stage);
      for (const imageUrl of generatedImages.slice(1)) {
        upsertTimelineStep(key, title, message, imageUrl, undefined, stage);
      }
      return;
    }

    if (stage === "character_branch_complete") {
      const characters = Array.isArray(data?.characters)
        ? data.characters
        : [];
      if (characters.length > 0) {
        for (const character of characters) {
          if (!character || typeof character !== "object") continue;
          const characterObj = character as Record<string, unknown>;
          const name = typeof characterObj.name === "string" ? characterObj.name.trim() : "Character";
          const brief = typeof characterObj.brief === "string" ? characterObj.brief : "";
          const images = Array.isArray(characterObj.generated_images)
            ? characterObj.generated_images.filter(
                (value): value is string => typeof value === "string" && value.trim().length > 0
              )
            : [];
          const key = `character_generation_complete:${name}`;
          const title = `Character ready: ${name}`;
          const detail = brief || message;
          const dataPayload = {
            name,
            brief,
            generated_images: images,
          };
          upsertTimelineStep(key, title, detail, images[0], dataPayload, stage);
          for (const imageUrl of images.slice(1)) {
            upsertTimelineStep(key, title, detail, imageUrl, undefined, stage);
          }
        }
      }
      return;
    }

    const timelineKey = buildProgressTimelineKey(stage, data ?? undefined);
    upsertTimelineStep(
      timelineKey,
      formatStageTitle(stage),
      message,
      undefined,
      progressEvent.data,
      stage
    );
  }

  function pushTimelineStatus(eventObj: Record<string, unknown>) {
    const state = typeof eventObj.state === "string" ? eventObj.state.trim().toLowerCase() : "";
    const message =
      typeof eventObj.message === "string" && eventObj.message.trim()
        ? eventObj.message.trim()
        : "Status update received.";
    const key = state ? `status:${state}` : "status:update";
    const title = state ? `A2A status: ${state}` : "A2A status update";
    upsertTimelineStep(key, title, message);
  }

  function toggleTimelineJson(key: string) {
    setOpenTimelineJsonByKey((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function toggleLogJson(id: number) {
    setOpenLogJsonById((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function normalizeFinalEnvelope(event: Record<string, unknown>) {
    const backendEndpoint =
      typeof event.backend_endpoint === "string"
        ? event.backend_endpoint
        : typeof event.endpoint === "string"
          ? event.endpoint
          : "";

    const statusValue = event.backend_status_code ?? event.status_code;
    const backendStatusCode =
      typeof statusValue === "number"
        ? statusValue
        : Number.isFinite(Number(statusValue))
          ? Number(statusValue)
          : 200;

    const backendResponse =
      "backend_response" in event ? event.backend_response : event.payload;

    return {
      backend_endpoint: backendEndpoint,
      backend_status_code: backendStatusCode,
      backend_response: backendResponse ?? null,
    };
  }

  async function sendRequest() {
    if (!canSubmit) return;

    const runStartedAtMs = Date.now();
    const syncElapsed = (endAtMs = Date.now()) => {
      const elapsedMs = Math.max(0, endAtMs - runStartedAtMs);
      setDreamedForSeconds(Math.max(1, Math.round(elapsedMs / 1000)));
    };

    setRequestState("loading");
    setErrorMessage("");
    setResponseStatus(null);
    setResponseBody(null);
    setCopyState("idle");
    setLiveLogs([]);
    setLiveTimelineSteps([]);
    setTimelineExpanded(true);
    setDreamedForSeconds(0);
    setExpandedImageUrl(null);
    setOpenTimelineJsonByKey({});
    setOpenLogJsonById({});

    try {
      const payload = await buildPayload();
      setLastPayload(toPayloadForDisplay(payload));
      pushLiveLog("info", "ui", "Request payload prepared. Opening stream...");

      let jobIdParam = "";
      try {
        const job = await createJob({
          type: "story",
          title: prompt.trim().slice(0, 80) || "Storybook Creation",
          user_prompt: prompt.trim(),
          input_payload: toPayloadForDisplay(payload) as Record<string, unknown>,
          triggered_by: "storybook-test",
          engine: "a2a-maf-story-book-maker",
        });
        setCurrentJob(job);
        jobIdParam = `&job_id=${encodeURIComponent(job.id)}`;
        pushLiveLog("info", "ui", `Job created: ${job.id}`);
      } catch { /* job tracking is best-effort */ }

      const response = await fetch(`/api/storybook-test?target=${apiTarget}&stream=1${jobIdParam}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      setResponseStatus(response.status);

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/x-ndjson")) {
        const text = await response.text();
        let parsed: unknown = null;
        if (text.trim()) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = { raw: text };
          }
        }
        setResponseBody(parsed);

        if (!response.ok) {
          const detail =
            parsed && typeof parsed === "object" && parsed !== null && "detail" in parsed
              ? String((parsed as { detail?: unknown }).detail ?? "")
              : "";
          setErrorMessage(
            detail
              ? `Request failed with status ${response.status}: ${detail}`
              : `Request failed with status ${response.status}.`
          );
          syncElapsed();
          setRequestState("error");
          return;
        }

        pushLiveLog("success", "ui", "Request completed (non-stream fallback).");
        upsertTimelineStep("final_response", "Final response", "Final response received from backend.");
        syncElapsed();
        setRequestState("success");
        return;
      }

      if (!response.body) {
        setErrorMessage("Stream was requested, but no response body was returned.");
        syncElapsed();
        setRequestState("error");
        return;
      }

      pushLiveLog("info", "ui", "Stream connected. Waiting for backend updates...");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalEnvelope: unknown = null;
      let streamError: string | null = null;

      const consumeLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let event: unknown;
        try {
          event = JSON.parse(trimmed);
        } catch {
          pushLiveLog("error", "ui", `Could not parse stream line: ${trimmed}`);
          return;
        }

        if (!event || typeof event !== "object") return;
        const eventObj = event as Record<string, unknown>;
        const eventType = String(eventObj.type ?? "").toLowerCase();
        const source = typeof eventObj.source === "string" ? eventObj.source : "backend";
        syncElapsed();

        if (eventType === "progress") {
          const normalizedProgress = normalizeProgressEvent(eventObj);
          pushLiveLog("info", source, normalizedProgress.rendered, normalizedProgress.data);
          pushTimelineProgress(normalizedProgress);
          return;
        }

        if (eventType === "status") {
          const state = typeof eventObj.state === "string" ? eventObj.state.trim() : "";
          const message =
            typeof eventObj.message === "string" && eventObj.message.trim()
              ? eventObj.message.trim()
              : "Status update received.";
          const rendered = state ? `[${state}] ${message}` : message;
          pushLiveLog("info", source, rendered);
          pushTimelineStatus(eventObj);
          return;
        }

        if (eventType === "update") {
          const message =
            typeof eventObj.message === "string"
              ? eventObj.message
              : `Update received (${eventType}).`;
          pushLiveLog("info", source, message);
          return;
        }

        if (eventType === "final") {
          finalEnvelope = normalizeFinalEnvelope(eventObj);
          setResponseBody(finalEnvelope);
          pushLiveLog("success", source, "Final response received from backend.");
          upsertTimelineStep("final_response", "Final response", "Final response received from backend.");
          syncElapsed();
          return;
        }

        if (eventType === "error") {
          streamError =
            typeof eventObj.detail === "string"
              ? eventObj.detail
              : typeof eventObj.message === "string"
                ? eventObj.message
                : "Stream failed with an unknown error.";
          pushLiveLog("error", source, streamError);
          upsertTimelineStep("stream_error", "Stream error", streamError);
          syncElapsed();
          return;
        }

        pushLiveLog("info", source, `Event: ${trimmed}`);
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
        setErrorMessage(streamError);
        syncElapsed();
        setRequestState("error");
        return;
      }

      if (!finalEnvelope) {
        setErrorMessage("Stream ended before a final backend response was received.");
        syncElapsed();
        setRequestState("error");
        return;
      }

      syncElapsed();
      setRequestState("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Request failed.");
      syncElapsed();
      setRequestState("error");
    }
  }

  async function copyResponse() {
    if (!responseJson) return;
    try {
      await navigator.clipboard.writeText(responseJson);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("idle");
    }
  }

  return (
    <section
      className="space-y-5 rounded-3xl p-4 shadow-sm md:p-6"
      style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
    >
      <header className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "#9a7a65" }}>
          Backend QA
        </p>
        <h2 className={`${styles.halant} flex items-center gap-2 text-3xl`}>
          <BookOpenText className="size-6" /> Storybook API Test
        </h2>
      </header>

      <div className="rounded-2xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
        <div className="flex flex-wrap items-center gap-2">
          <strong style={{ color: "#2b180a" }}>Target</strong>
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: "#dbc9b7",
              background: "#f0e8dc",
              color: "#2b180a",
            }}
          >
            Main (8010) via A2A
          </button>
          <button
            type="button"
            onClick={checkHealth}
            className="ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
          >
            {healthState === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
            Health
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusChip
            label={`Health: ${healthState}`}
            tone={
              healthState === "ok"
                ? "ok"
                : healthState === "error"
                  ? "error"
                  : healthState === "loading"
                    ? "running"
                    : "neutral"
            }
          />
          <StatusChip label="Main -> Storybook via A2A" tone="ok" />
        </div>
        {healthMessage ? (
          <pre
            className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded-xl border p-2 text-[11px]"
            style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#7a5a45" }}
          >
            {healthMessage}
          </pre>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
            <h3 className="text-base font-semibold" style={{ color: "#2b180a" }}>
              Request
            </h3>

            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>User prompt</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="mt-1 h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Tone</label>
                  <input
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Age band</label>
                  <input
                    value={ageBand}
                    onChange={(event) => setAgeBand(event.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Max characters</label>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={maxCharacters}
                    onChange={(event) => setMaxCharacters(Number(event.target.value || 2))}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Force workflow</label>
                  <select
                    value={workflowChoice}
                    onChange={(event) => setWorkflowChoice(event.target.value as WorkflowChoice)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  >
                    <option value="">Auto</option>
                    <option value="reference_enriched">reference_enriched</option>
                    <option value="prompt_only">prompt_only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: "#2b180a" }}>World references</h3>
              <button
                type="button"
                onClick={addWorldReference}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>

            {worldReferences.length === 0 ? (
              <p className="mt-3 text-xs" style={{ color: "#9a7a65" }}>No world references added.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {worldReferences.map((entry, index) => (
                  <div key={`world-${index}`} className="rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        value={entry.title}
                        onChange={(event) =>
                          setWorldReferences((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, title: event.target.value } : item))
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: "#dbc9b7" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeWorldReference(index)}
                        className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: "#dbc9b7", color: "#9a7a65" }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={entry.description}
                      onChange={(event) =>
                        setWorldReferences((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, description: event.target.value } : item))
                        )
                      }
                      className="mt-2 h-20 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "#dbc9b7" }}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 block w-full text-xs"
                      onClick={(event) => {
                        (event.currentTarget as HTMLInputElement).value = "";
                      }}
                      onChange={(event) => setWorldReferenceFile(index, event.target.files?.[0] ?? null)}
                    />
                    {entry.previewUrl ? (
                      <div className="mt-2 rounded-lg border p-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
                        <motion.button
                          type="button"
                          className="flex min-h-40 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-md"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setExpandedImageUrl(entry.previewUrl)}
                        >
                          <img src={entry.previewUrl} alt="world reference preview" className="max-h-56 max-w-full object-contain" />
                        </motion.button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: "#2b180a" }}>Character drawings</h3>
              <button
                type="button"
                onClick={addDrawing}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>

            {drawings.length === 0 ? (
              <p className="mt-3 text-xs" style={{ color: "#9a7a65" }}>No character drawings added.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {drawings.map((entry, index) => (
                  <div key={`drawing-${index}`} className="rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        value={entry.notes}
                        onChange={(event) =>
                          setDrawings((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, notes: event.target.value } : item))
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: "#dbc9b7" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeDrawing(index)}
                        className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: "#dbc9b7", color: "#9a7a65" }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={entry.description}
                      onChange={(event) =>
                        setDrawings((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, description: event.target.value } : item))
                        )
                      }
                      className="mt-2 h-20 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "#dbc9b7" }}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 block w-full text-xs"
                      onClick={(event) => {
                        (event.currentTarget as HTMLInputElement).value = "";
                      }}
                      onChange={(event) => setDrawingFile(index, event.target.files?.[0] ?? null)}
                    />
                    {entry.previewUrl ? (
                      <div className="mt-2 rounded-lg border p-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
                        <motion.button
                          type="button"
                          className="flex min-h-40 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-md"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setExpandedImageUrl(entry.previewUrl)}
                        >
                          <img src={entry.previewUrl} alt="character drawing preview" className="max-h-56 max-w-full object-contain" />
                        </motion.button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={sendRequest}
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
            style={{
              background: canSubmit ? "#2b180a" : "#7a5a45",
              color: "#fffaf4",
              opacity: canSubmit ? 1 : 0.65,
            }}
          >
            {requestState === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send Request (Live)
          </button>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: "#2b180a" }}>Response</h3>
              <button
                type="button"
                onClick={copyResponse}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
              >
                <Copy className="size-3.5" /> {copyState === "done" ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip
                label={`State: ${requestState}`}
                tone={
                  requestState === "success"
                    ? "ok"
                    : requestState === "error"
                      ? "error"
                      : requestState === "loading"
                        ? "running"
                        : "neutral"
                }
              />
              <StatusChip label={`HTTP ${responseStatus ?? "n/a"}`} tone={responseStatus === 200 ? "ok" : "neutral"} />
              {responseData?.workflow_used ? <StatusChip label={`Workflow: ${responseData.workflow_used}`} tone="neutral" /> : null}
              {responseData?.replicate_model ? <StatusChip label={`Model: ${responseData.replicate_model}`} tone="neutral" /> : null}
              {responseData?.reference_images_used_count !== undefined ? (
                <StatusChip label={`Refs sent: ${responseData.reference_images_used_count}`} tone="neutral" />
              ) : null}
              {sceneReferenceCounts.length > 0 ? (
                <StatusChip
                  label={`Per-scene refs: ${sceneReferenceCounts.join("/")}`}
                  tone="neutral"
                />
              ) : null}
              {currentJob ? (
                <a
                  href={`/dashboard/jobs/${currentJob.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                  style={{ borderColor: "#dbc9b7", background: "#fdf8f3", color: "#2b180a" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Job: <span className="font-mono text-[10px]" style={{ color: "#9a7a65" }}>{currentJob.id.slice(0, 8)}…</span>
                </a>
              ) : null}
            </div>

            {hasActiveRun ? (
              <motion.div
                className="mt-3 rounded-xl border p-3"
                style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className={chatStyles.messageGroup}>
                  <div className={chatStyles.aiAvatar}>
                    <Sparkles size={13} />
                  </div>

                  <div className={`${chatStyles.bubbleStack} ${chatStyles.bubbleStackStory}`}>
                    <div className={chatStyles.thoughtSummaryWrap}>
                      <button
                        type="button"
                        className={chatStyles.thoughtSummary}
                        onClick={() => setTimelineExpanded((previous) => !previous)}
                      >
                        Dreamed for {dreamedForSeconds}s
                        <ChevronRight
                          size={11}
                          className={timelineExpanded ? chatStyles.chevronOpen : chatStyles.chevronClosed}
                        />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {timelineExpanded ? (
                        <motion.div
                          key="timeline-open"
                          className={chatStyles.thoughtLogPanel}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className={chatStyles.thoughtLogTitle}>Dreaming</p>

                          {liveTimelineSteps.length === 0 ? (
                            <p className={chatStyles.thoughtLogStepDetail}>Waiting for first backend step...</p>
                          ) : (
                            <AnimatePresence initial={false}>
                              {liveTimelineSteps.map((step, index) => {
                                const isLastStep = index === liveTimelineSteps.length - 1;
                                return (
                                  <motion.div
                                    key={step.key}
                                    className={chatStyles.thoughtLogStep}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    layout="position"
                                    transition={{
                                      duration: 0.24,
                                      delay: Math.min(index * 0.035, 0.2),
                                      ease: [0.22, 1, 0.36, 1],
                                    }}
                                  >
                                    <div className={chatStyles.thoughtLogBulletCol}>
                                      <motion.span
                                        className={chatStyles.thoughtLogBullet}
                                        initial={{ scale: 0.75, opacity: 0.5 }}
                                        animate={
                                          isLastStep && requestState === "loading"
                                            ? {
                                                scale: [1, 1.5, 1],
                                                opacity: [1, 0.6, 1],
                                                backgroundColor: ["#c97d42", "#e8943d", "#c97d42"],
                                              }
                                            : { scale: 1, opacity: 1 }
                                        }
                                        transition={
                                          isLastStep && requestState === "loading"
                                            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                                            : { duration: 0.2 }
                                        }
                                      />
                                      {!isLastStep ? <span className={chatStyles.thoughtLogLine} /> : null}
                                    </div>
                                    <div className={chatStyles.thoughtLogStepContent}>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p className={chatStyles.thoughtLogStepTitle}>{step.title}</p>
                                          <p className={chatStyles.thoughtLogStepDetail}>{step.detail}</p>
                                        </div>
                                        {step.data !== undefined ? (
                                          <button
                                            type="button"
                                            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold"
                                            style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#7a5a45" }}
                                            onClick={() => toggleTimelineJson(step.key)}
                                          >
                                            JSON
                                            <motion.span
                                              animate={{ rotate: openTimelineJsonByKey[step.key] ? 180 : 0 }}
                                              transition={{ duration: 0.22, ease: "easeInOut" }}
                                              style={{ display: "inline-flex", transformOrigin: "center" }}
                                            >
                                              <ChevronDown size={11} />
                                            </motion.span>
                                          </button>
                                        ) : null}
                                      </div>
                                      <AnimatePresence initial={false}>
                                        {step.data !== undefined && openTimelineJsonByKey[step.key] && (
                                          <motion.div
                                            key={`json-tl-${step.key}`}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                            style={{ overflow: "hidden" }}
                                          >
                                            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded border bg-[#f9f1e7] p-2 font-mono text-[10px] leading-4" style={{ borderColor: "#dbc9b7" }}>
                                              {formatJsonForDisplay(step.data)}
                                            </pre>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>

                                      {step.imageUrls.length > 0 ? (
                                        <div className={chatStyles.thoughtLogImageGrid}>
                                          {step.imageUrls.map((imageUrl, imageIndex) => (
                                            <motion.button
                                              type="button"
                                              key={`${step.key}-img-${imageIndex}`}
                                              className={chatStyles.thoughtLogImageCard}
                                              initial={{ opacity: 0, scale: 0.9 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              transition={{ duration: 0.24 }}
                                              onClick={() => setExpandedImageUrl(imageUrl)}
                                            >
                                              <img src={imageUrl} alt={`Generated visual ${imageIndex + 1}`} loading="lazy" />
                                              <span className={chatStyles.thoughtLogImageIndex}>{imageIndex + 1}</span>
                                            </motion.button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          )}

                          {requestState === "loading" ? (
                            <motion.div
                              className={chatStyles.dreamingSpinnerRow}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <span className={chatStyles.dreamingSpinnerIndent}>
                                <span className={chatStyles.dreamingSpinner} />
                              </span>
                              <motion.span
                                className={chatStyles.dreamingFinalizingText}
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              >
                                {activeLoadingStageKey}
                              </motion.span>
                            </motion.div>
                          ) : null}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {(requestState === "success" || requestState === "loading") ? (
                      <div className={chatStyles.storyResult}>
                        {exactBookPreview ? (
                          <div className={chatStyles.storyResultBook}>
                            <StoryBook
                              title={exactBookPreview.title}
                              ageBand={exactBookPreview.ageBand}
                              pages={exactBookPreview.pages}
                              cover={exactBookPreview.cover}
                            />
                          </div>
                        ) : (
                          <div className={`${chatStyles.bubble} ${chatStyles.bubbleAi}`}>
                            Storybook preview will appear here as soon as the final response is ready.
                          </div>
                        )}

                        <div className={chatStyles.storyResultActions}>
                          <button type="button" className={chatStyles.storyResultRegenerateBtn} onClick={sendRequest} disabled={!canSubmit}>
                            <RotateCw size={12} strokeWidth={2.5} className={chatStyles.storyResultRegenerateIcon} />
                            Regenerate
                          </button>
                          <button type="button" className={chatStyles.storyResultActionBtn} onClick={copyResponse}>
                            {copyState === "done" ? "Copied" : "Copy JSON"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}

            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}>
              <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                Live backend logs
              </p>
              {liveLogs.length === 0 ? (
                <p className="mt-2 text-[11px]" style={{ color: "#9a7a65" }}>
                  No events yet. Submit a request to see step-by-step backend updates.
                </p>
              ) : (
                <div
                  className="mt-2 max-h-56 overflow-auto rounded-lg border p-2"
                  style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}
                >
                  <ul className="space-y-1">
                    {liveLogs.map((log, index) => (
                      <motion.li
                        key={log.id}
                        className="break-words rounded px-2 py-1 text-[11px]"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.18,
                          delay: Math.min(index * 0.01, 0.12),
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        style={{
                          background:
                            log.level === "error"
                              ? "#feefef"
                              : log.level === "success"
                                ? "#edf9ee"
                                : "#f8efe5",
                          color:
                            log.level === "error"
                              ? "#981b1b"
                              : log.level === "success"
                                ? "#1f6a32"
                                : "#7a5a45",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 break-words">
                            <strong>[{log.source}]</strong> {log.message}
                          </p>
                          {log.data !== undefined ? (
                            <button
                              type="button"
                              className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold"
                              style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                              onClick={() => toggleLogJson(log.id)}
                            >
                              JSON
                              <motion.span
                                animate={{ rotate: openLogJsonById[log.id] ? 180 : 0 }}
                                transition={{ duration: 0.22, ease: "easeInOut" }}
                                style={{ display: "inline-flex", transformOrigin: "center" }}
                              >
                                <ChevronDown size={11} />
                              </motion.span>
                            </button>
                          ) : null}
                        </div>
                        <AnimatePresence initial={false}>
                          {log.data !== undefined && openLogJsonById[log.id] && (
                            <motion.div
                              key={`json-log-${log.id}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded border bg-[#f9f1e7] p-2 font-mono text-[10px] leading-4" style={{ borderColor: "#dbc9b7" }}>
                                {formatJsonForDisplay(log.data)}
                              </pre>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {Object.keys(generationSources).length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                  Generation path
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(generationSources).map(([key, value]) => (
                    <StatusChip
                      key={key}
                      label={`${key}: ${value}`}
                      tone={String(value).includes("fallback") ? "error" : "ok"}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {Object.keys(referenceBreakdown).length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                  Reference forwarding
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(referenceBreakdown).map(([key, value]) => (
                    <StatusChip key={key} label={`${key}: ${value}`} tone="neutral" />
                  ))}
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: "#f1b0b0", background: "#feefef", color: "#981b1b" }}>
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="size-3.5" /> Error
                </div>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            {requestState === "success" ? (
              <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: "#9fddb0", background: "#edf9ee", color: "#1f6a32" }}>
                <div className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="size-3.5" /> Success
                </div>
              </div>
            ) : null}

            {orchestratorEnvelope?.backend_endpoint ? (
              <div className="mt-2 space-y-1 text-[11px]" style={{ color: "#9a7a65" }}>
                <p>
                  Endpoint: <code className="break-all">{orchestratorEnvelope.backend_endpoint}</code>
                </p>
                <p>
                  A2A active:{" "}
                  <strong style={{ color: "#2b180a" }}>
                    {orchestratorEnvelope.backend_endpoint.includes("/a2a") ? "yes (MAF storybook backend)" : "no"}
                  </strong>
                </p>
              </div>
            ) : null}
          </div>

          {responseData?.story ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                Story
              </h3>
              <p className="mt-2 text-sm font-semibold" style={{ color: "#2b180a" }}>{responseData.story.title || "Untitled"}</p>
              <p className="mt-1 text-xs" style={{ color: "#9a7a65" }}>{responseData.story.title_page_text || "No title page text"}</p>
              <p className="mt-2 text-xs" style={{ color: "#9a7a65" }}>{responseData.story.end_page_text || "No end page text"}</p>
            </div>
          ) : null}

          {storyPages.length > 0 ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                Story Pages (Text + Image Pairing)
              </h3>
              <p className="mt-1 text-xs" style={{ color: "#9a7a65" }}>
                Each card below maps one right-page story entry to its left-page generated illustration.
              </p>
              <div className="mt-3 space-y-3">
                {storyPages.map((page, index) => (
                  <motion.article
                    key={`story-page-${page.pageNumber}`}
                    className="min-w-0 rounded-xl border p-3"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.15) }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip label={`Page ${page.pageNumber} of ${storyPages.length}`} tone="neutral" />
                      <StatusChip label={page.chapter || "chapter"} tone="neutral" />
                    </div>
                    <p className="mt-2 break-words text-xs leading-5" style={{ color: "#7a5a45" }}>
                      {page.text || "No story text generated for this page."}
                    </p>
                    {page.audioUrl ? (
                      <div className="mt-2 rounded-lg border px-2 py-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
                        <p className="mb-1 text-[11px] font-semibold" style={{ color: "#7a5a45" }}>
                          MP3 narration
                        </p>
                        <audio controls preload="none" src={page.audioUrl} className="h-8 w-full" />
                      </div>
                    ) : null}
                    {page.prompt ? (
                      <p className="mt-2 break-words rounded-lg border px-2 py-1 text-[11px]" style={{ borderColor: "#dbc9b7", color: "#9a7a65" }}>
                        Prompt used: {page.prompt}
                      </p>
                    ) : null}
                    {page.imageUrl ? (
                      <div className="mt-2 w-full rounded-lg border p-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
                        <motion.button
                          type="button"
                          className="flex w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-md"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setExpandedImageUrl(page.imageUrl)}
                        >
                          <img
                            src={page.imageUrl}
                            alt={`Page ${page.pageNumber} illustration`}
                            className="max-h-[320px] w-auto max-w-full rounded object-contain"
                          />
                        </motion.button>
                        <a
                          href={page.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                          style={{ color: "#5b2a08" }}
                        >
                          Open page image <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs" style={{ color: "#9a7a65" }}>
                        No image URL found for this page.
                      </p>
                    )}
                  </motion.article>
                ))}
              </div>
            </div>
          ) : null}

          {generatedImages.length > 0 ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                Generated Images ({generatedImages.length})
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {generatedImages.map((url, index) => (
                  <motion.article
                    key={`img-${index}`}
                    className="min-w-0 rounded-xl border p-2"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.15) }}
                  >
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-semibold" style={{ color: "#7a5a45" }}>
                        Scene {index + 1}
                      </p>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color: "#5b2a08" }}
                      >
                        Open <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                    <div className="mt-2 w-full rounded-lg border p-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
                      <motion.button
                        type="button"
                        className="flex w-full aspect-[4/3] cursor-zoom-in items-center justify-center overflow-hidden rounded-md"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setExpandedImageUrl(url)}
                      >
                        <img src={url} alt={`scene ${index + 1}`} className="h-full w-full rounded object-contain" />
                      </motion.button>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          ) : null}

          {characters.length > 0 ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                Characters ({characters.length})
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {characters.map((character, index) => (
                  <motion.article
                    key={`char-${index}`}
                    className="min-w-0 rounded-xl border p-3"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.15) }}
                  >
                    <p className="text-xs font-semibold" style={{ color: "#2b180a" }}>
                      {character.name || `Character ${index + 1}`}
                    </p>
                    <p className="mt-1 break-words text-[11px] leading-5" style={{ color: "#9a7a65" }}>
                      {character.brief || "No brief"}
                    </p>
                    {character.generated_images && character.generated_images.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {character.generated_images.map((imageUrl, imageIndex) => (
                          <div
                            key={`char-${index}-img-${imageIndex}`}
                            className="w-full rounded-lg border p-2"
                            style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-[11px] font-semibold" style={{ color: "#7a5a45" }}>
                                Image {imageIndex + 1}
                              </p>
                            </div>
                            <motion.button
                              type="button"
                              className="flex w-full aspect-[3/4] cursor-zoom-in items-center justify-center overflow-hidden rounded-md"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => setExpandedImageUrl(imageUrl)}
                            >
                              <img
                                src={imageUrl}
                                alt={`${character.name || "character"} image ${imageIndex + 1}`}
                                className="h-full w-full rounded object-contain"
                              />
                            </motion.button>
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold"
                              style={{ color: "#5b2a08" }}
                            >
                              Open character image <ExternalLink className="size-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </motion.article>
                ))}
              </div>
            </div>
          ) : null}

          {spreads.length > 0 ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                Spread Contract ({spreads.length})
              </h3>
              <div className="mt-3 space-y-3">
                {spreads.map((spread, index) => (
                  <motion.article
                    key={`spread-${index}`}
                    className="rounded-xl border p-3"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.15) }}
                  >
                    <p className="break-words text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#7a5a45" }}>
                      Spread {spread.spread_index ?? index}
                      {spread.label ? ` · ${spread.label}` : ""}
                    </p>
                    <p className="mt-1 break-words text-[11px]" style={{ color: "#9a7a65" }}>
                      Left: {spread.left?.kind || "n/a"} | Right: {spread.right?.kind || "n/a"}
                    </p>
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      <SpreadSideCard side={spread.left} pageTitle="Left page" onExpandImage={setExpandedImageUrl} />
                      <SpreadSideCard side={spread.right} pageTitle="Right page" onExpandImage={setExpandedImageUrl} />
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>Warnings</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs break-words" style={{ color: "#9a7a65" }}>
                {warnings.map((warning, index) => (
                  <li key={`warn-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
            <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>Last payload</h3>
            <pre
              className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-2 text-[11px]"
              style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#7a5a45" }}
            >
              {payloadJson || "null"}
            </pre>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
            <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>Raw response</h3>
            <pre
              className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-2 text-[11px]"
              style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#7a5a45" }}
            >
              {responseJson || "null"}
            </pre>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expandedImageUrl ? (
          <motion.div
            key="image-modal"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImageUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="max-h-[92vh] max-w-[92vw] overflow-hidden rounded-2xl border bg-[#fffaf4] p-2"
              style={{ borderColor: "#dbc9b7" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-end">
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: "#dbc9b7", background: "#fcf6ef", color: "#2b180a" }}
                  onClick={() => setExpandedImageUrl(null)}
                >
                  Close
                </button>
              </div>
              <img
                src={expandedImageUrl}
                alt="Expanded generated visual"
                className="max-h-[82vh] max-w-[88vw] rounded object-contain"
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </section>
  );
}
