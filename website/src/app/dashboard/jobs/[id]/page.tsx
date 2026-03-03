/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  ImageIcon,
  AlertTriangle,
  Loader2,
  RefreshCw,
  BookOpenText,
  UserRound,
  Video,
  Sparkles,
  X,
} from "lucide-react";

import {
  fetchJob,
  fetchJobEvents,
  getAssetUrl,
  type Job,
  type JobEvent,
  type JobStatus,
  type JobType,
} from "@/lib/jobs";
import type { StoryPage } from "@/lib/dashboard-data";
import { StoryBook } from "@/components/dashboard/story-book";
import { cn } from "@/lib/utils";
import styles from "../../dashboard.module.css";
import chatStyles from "../../../chat/chat-page.module.css";

// ── Design tokens ──────────────────────────────────────────────
const cardStyle = { background: "#fdf8f3", border: "1px solid #dbc9b7" };
const deepCardStyle = {
  background: "#fffaf4",
  borderColor: "#dbc9b7",
} as const;

const statusConfig: Record<
  JobStatus,
  { label: string; icon: typeof Clock3; className: string }
> = {
  queued: {
    label: "Queued",
    icon: Clock3,
    className: "bg-blue-100 text-blue-900 border-blue-300",
  },
  processing: {
    label: "Processing",
    icon: Clock3,
    className: "bg-amber-100 text-amber-900 border-amber-300",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-sky-100 text-sky-900 border-sky-300",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "bg-rose-100 text-rose-900 border-rose-300",
  },
};

const modeConfig: Record<
  JobType,
  { label: string; icon: typeof BookOpenText }
> = {
  story: { label: "Storybook Mode", icon: BookOpenText },
  video: { label: "Legacy Video Mode", icon: Video },
  character: { label: "Character Mode", icon: UserRound },
};


// ── Helpers ────────────────────────────────────────────────────
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shortText(text: string | undefined | null, max = 320): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function imageLabelForJobType(type: JobType, idx: number): string {
  if (type === "story") return idx === 0 ? "Cover" : `Scene ${idx}`;
  return `Image ${idx + 1}`;
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const maybePath = new URL(url).pathname;
    const name = maybePath.split("/").filter(Boolean).pop();
    return name || fallback;
  } catch {
    const name = url.split("/").filter(Boolean).pop();
    return name || fallback;
  }
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "ok" | "error" | "running";
}) {
  const toneStyles: Record<
    typeof tone,
    { bg: string; fg: string; border: string }
  > = {
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

// ── Framer presets ─────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
};

// ── Component ──────────────────────────────────────────────────
export default function DashboardJobDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copyJsonState, setCopyJsonState] = useState<"idle" | "done">("idle");
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [showResultJson, setShowResultJson] = useState(false);
  const [showInputJson, setShowInputJson] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showScenePrompts, setShowScenePrompts] = useState(false);
  const [showDrawingDescs, setShowDrawingDescs] = useState(false);
  const [expandedCharIds, setExpandedCharIds] = useState<Set<number>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  // Close expanded image on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedImageUrl(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [jobData, eventsData] = await Promise.all([
        fetchJob(id),
        fetchJobEvents(id),
      ]);
      if (!jobData) {
        setError("Job not found");
        return;
      }
      setJob(jobData);
      setEvents(eventsData);
    } catch {
      setError("Failed to load job data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadData(); } finally { setRefreshing(false); }
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // SSE stream for real-time updates (only for active jobs)
  useEffect(() => {
    if (!id || !job) return;
    const isActive = job.status === "queued" || job.status === "processing";
    if (!isActive) return;

    const es = new EventSource(`/api/jobs/${id}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event_type === "done") {
          es.close();
          loadData();
          return;
        }
        setEvents((prev) => {
          if (data.id && prev.some((ev) => ev.id === data.id)) return prev;
          return [...prev, data as JobEvent];
        });
        loadData();
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [id, job?.status, loadData]);

  // ── Derived data ────────────────────────────────────────────
  const resultPayload = useMemo(
    () => (job?.result_payload ?? {}) as Record<string, unknown>,
    [job?.result_payload]
  );
  const inputPayload = useMemo(
    () => (job?.input_payload ?? {}) as Record<string, unknown>,
    [job?.input_payload]
  );
  const resultJson = useMemo(
    () => JSON.stringify(resultPayload, null, 2),
    [resultPayload]
  );
  const inputJson = useMemo(
    () => JSON.stringify(inputPayload, null, 2),
    [inputPayload]
  );

  // Character-specific data
  const backstory = resultPayload.backstory as
    | {
        name?: string;
        archetype?: string;
        era?: string;
        origin?: string;
        goals?: string[];
        flaws?: string[];
        narrative_backstory?: string;
        visual_signifiers?: string[];
      }
    | undefined;
  const imagePrompt = resultPayload.image_prompt as
    | {
        positive_prompt?: string;
        negative_prompt?: string;
        composition_guidance?: string;
        color_palette?: string[];
        lighting?: string;
      }
    | undefined;

  // Story-specific data
  type RightPage = string | { page_number?: number; chapter?: string; text?: string; audio_url?: string };
  const story = resultPayload.story as
    | {
        title?: string;
        title_page_text?: string;
        right_pages?: RightPage[];
        end_page_text?: string;
      }
    | undefined;
  const characters = (resultPayload.characters ?? []) as Array<{
    name?: string;
    brief?: string;
    backstory?: Record<string, unknown>;
    image_prompt?: Record<string, unknown>;
    generated_images?: string[];
    warnings?: string[];
  }>;
  const scenePrompts = resultPayload.scene_prompts as
    | {
        cover_prompt?: string;
        illustration_prompts?: string[];
        negative_prompt?: string;
      }
    | undefined;
  const spreads = (resultPayload.spreads ?? []) as Array<{
    spread_index?: number;
    left?: { kind?: string; image_url?: string; title?: string; chapter?: string; text?: string };
    right?: { kind?: string; image_url?: string; title?: string; chapter?: string; text?: string; audio_url?: string };
  }>;

  // Common data
  const generatedImages = (resultPayload.generated_images ?? []) as string[];
  const drawingDescriptions = (resultPayload.drawing_descriptions ?? []) as string[];
  const worldRefDescriptions = (resultPayload.world_reference_descriptions ?? []) as string[];
  const workflowUsed = resultPayload.workflow_used as string | undefined;
  const replicateModel = resultPayload.replicate_model as string | undefined;

  // All displayable images (from assets or result URLs)
  const imageAssets = job?.assets.filter((a) => a.mime_type?.startsWith("image/")) ?? [];
  const displayImages = useMemo(() => {
    if (!job) return [];
    if (imageAssets.length > 0) {
      return imageAssets.map((asset, idx) => ({
        id: asset.id,
        label: imageLabelForJobType(job.type, idx),
        url: getAssetUrl(job.id, asset.filename),
        filename: asset.filename,
      }));
    }
    return generatedImages.map((url, idx) => ({
      id: `${idx}-${url}`,
      label: imageLabelForJobType(job.type, idx),
      url,
      filename: filenameFromUrl(url, `generated_image_${idx + 1}`),
    }));
  }, [generatedImages, imageAssets, job]);
  const hasDisplayImages = displayImages.length > 0;
  // When backstory is present, the image is shown in the unified Character Profile card
  const isCharacterHeroImage = job?.type === "character" && displayImages.length === 1 && !backstory;

  // Build storybook preview if applicable
  const bookPreview = useMemo(() => {
    if (job?.type !== "story" || !story?.title) return null;

    const rightPages = Array.isArray(story.right_pages) ? story.right_pages : [];
    if (rightPages.length === 0) return null;

    // Build a spread lookup by spread_index for accurate image/chapter resolution
    const spreadMap = new Map(
      spreads
        .filter((s) => typeof s.spread_index === "number")
        .map((s) => [Number(s.spread_index), s])
    );

    // Build a right-page lookup by page_number (works for numbered-page responses)
    const rightPageMap = new Map(
      rightPages
        .filter(
          (p): p is { page_number: number; chapter?: string; text?: string; audio_url?: string } =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as Record<string, unknown>).page_number === "number"
        )
        .map((p) => [Number(p.page_number), p])
    );

    // Cover: prefer imageAssets, then generatedImages, then spread[0]
    const coverUrl =
      (imageAssets[0] ? getAssetUrl(job.id, imageAssets[0].filename) : null) ||
      generatedImages[0] ||
      spreadMap.get(0)?.left?.image_url ||
      "";

    const pages: StoryPage[] = [];

    for (let i = 0; i < rightPages.length; i++) {
      const pageNumber = i + 1;
      const spread = spreadMap.get(pageNumber);
      const entry = rightPages[i];
      const illustrationAsset = imageAssets[pageNumber];

      // Illustration: asset > spread URL > generatedImages > cover fallback
      const illustration =
        (illustrationAsset ? getAssetUrl(job.id, illustrationAsset.filename) : null) ||
        spread?.left?.image_url ||
        generatedImages[pageNumber] ||
        coverUrl;

      // LEFT page: illustration only (even index in pages array)
      pages.push({ text: "", illustration });

      // RIGHT page: text only (odd index in pages array)
      const rightPage = rightPageMap.get(pageNumber);
      const pageText =
        rightPage?.text ??
        (typeof entry === "string" ? entry : ((entry as { text?: string })?.text ?? ""));
      const pageChapter =
        rightPage?.chapter ??
        (typeof entry === "object" ? (entry as { chapter?: string })?.chapter : undefined) ??
        spread?.right?.chapter;
      const pageAudioUrl =
        rightPage?.audio_url ??
        (typeof entry === "object" ? (entry as { audio_url?: string })?.audio_url : undefined) ??
        spread?.right?.audio_url;
      pages.push({ chapter: pageChapter, text: pageText, audioUrl: pageAudioUrl });
    }

    if (story.end_page_text) {
      pages.push({ text: story.end_page_text, isEnd: true });
    }

    return { title: story.title, cover: coverUrl, pages };
  }, [job, story, spreads, generatedImages, imageAssets]);

  const isTerminal = job?.status === "completed" || job?.status === "failed";
  const hasResult = Object.keys(resultPayload).length > 0;

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* fallback: ignore */ }
  }

  function toggleLogExpand(id: string) {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderGenerationSummary(custom = 2) {
    if (!job) return null;
    return (
      <motion.article variants={fadeUp} initial="hidden" animate="visible" custom={custom} className="rounded-2xl p-4" style={cardStyle}>
        <button
          type="button"
          onClick={() => setShowSummary((p) => !p)}
          className="flex w-full items-center justify-between text-sm font-black uppercase tracking-[0.1em]"
          style={{ color: "#2b180a" }}
        >
          <span>Generation Summary</span>
          <ChevronDown
            className="h-4 w-4 transition-transform"
            style={{ transform: showSummary ? "rotate(180deg)" : "rotate(0)" }}
          />
        </button>
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt style={{ color: "#9a7a65" }}>Created</dt>
                  <dd className="font-semibold" style={{ color: "#2b180a" }}>{formatRelativeTime(job.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt style={{ color: "#9a7a65" }}>Updated</dt>
                  <dd className="font-semibold" style={{ color: "#2b180a" }}>{formatRelativeTime(job.updated_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt style={{ color: "#9a7a65" }}>Triggered By</dt>
                  <dd className="font-semibold" style={{ color: "#2b180a" }}>{job.triggered_by || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt style={{ color: "#9a7a65" }}>Engine</dt>
                  <dd className="font-semibold" style={{ color: "#2b180a" }}>{job.engine || "Dream Core"}</dd>
                </div>
                {workflowUsed && (
                  <div className="flex justify-between gap-2">
                    <dt style={{ color: "#9a7a65" }}>Workflow</dt>
                    <dd className="font-semibold" style={{ color: "#2b180a" }}>{workflowUsed}</dd>
                  </div>
                )}
                {replicateModel && (
                  <div className="flex justify-between gap-2">
                    <dt style={{ color: "#9a7a65" }}>Model</dt>
                    <dd className="font-mono text-xs font-semibold" style={{ color: "#2b180a" }}>{replicateModel}</dd>
                  </div>
                )}
              </dl>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    );
  }

  function renderChatLogs() {
    if (!job) return null;
    const totalSeconds = Math.round(
      (new Date(job.updated_at).getTime() - new Date(job.created_at).getTime()) / 1000
    );
    return (
      <motion.article variants={fadeUp} initial="hidden" animate="visible" custom={7} className="rounded-2xl p-4" style={cardStyle}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setTimelineExpanded((p) => !p)}
            className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em]"
            style={{ color: "#2b180a" }}
          >
            <span>{isTerminal ? `Generation Logs · ${totalSeconds}s` : "Generation Logs"}</span>
            <ChevronDown
              className="h-4 w-4 transition-transform"
              style={{ transform: timelineExpanded ? "rotate(180deg)" : "rotate(0)" }}
            />
          </button>
          {!isTerminal && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {timelineExpanded && (
            <motion.div
              key="log-open"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-3" style={{ paddingLeft: "2px" }}>
                  {events.length === 0 ? (
                    <p className={chatStyles.thoughtLogStepDetail}>No logs yet.</p>
                  ) : (
                    <AnimatePresence initial={false}>
                      {events.map((ev, index) => {
                        const isLastStep = index === events.length - 1;
                        const hasMetadata = ev.metadata && Object.keys(ev.metadata).length > 0;
                        const isExpanded = expandedLogIds.has(ev.id);
                        const bulletColor =
                          ev.level === "success"
                            ? "#22c55e"
                            : ev.level === "error"
                              ? "#ef4444"
                              : ev.level === "warning"
                                ? "#f59e0b"
                                : "#c9a882";
                        // Extract image URL: artifact events store locally via filename; progress events may carry image_url
                        const isImageFile = (name: unknown): name is string =>
                          typeof name === "string" && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name);
                        const artifactFilename =
                          ev.event_type === "artifact" && isImageFile(ev.metadata?.filename)
                            ? (ev.metadata.filename as string)
                            : null;
                        const progressImageUrl =
                          typeof ev.metadata?.image_url === "string" ? ev.metadata.image_url : null;
                        const resolvedUrl = artifactFilename
                          ? getAssetUrl(job.id, artifactFilename)
                          : progressImageUrl;
                        const imageUrls: string[] = resolvedUrl ? [resolvedUrl] : [];

                        return (
                          <motion.div
                            key={ev.id || index}
                            className={chatStyles.thoughtLogStep}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            layout="position"
                            transition={{
                              duration: 0.24,
                              delay: Math.min(index * 0.02, 0.15),
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            <div className={chatStyles.thoughtLogBulletCol}>
                              <motion.span
                                className={chatStyles.thoughtLogBullet}
                                style={{ background: bulletColor }}
                                initial={{ scale: 0.75, opacity: 0.5 }}
                                animate={
                                  isLastStep && !isTerminal
                                    ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }
                                    : { scale: 1, opacity: 1 }
                                }
                                transition={
                                  isLastStep && !isTerminal
                                    ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                                    : { duration: 0.2 }
                                }
                              />
                              {!isLastStep && <span className={chatStyles.thoughtLogLine} />}
                            </div>
                            <div className={chatStyles.thoughtLogStepContent}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className={chatStyles.thoughtLogStepTitle}>
                                    {ev.event_type !== "progress" ? `[${ev.event_type}] ` : ""}
                                    {ev.message}
                                  </p>
                                  <p className={chatStyles.thoughtLogStepDetail}>
                                    {formatRelativeTime(ev.created_at)}
                                    {ev.level !== "info" && ` · ${ev.level}`}
                                  </p>
                                </div>
                                {hasMetadata && (
                                  <button
                                    type="button"
                                    onClick={() => toggleLogExpand(ev.id)}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold"
                                    style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#7a5a45" }}
                                  >
                                    JSON
                                    <ChevronDown
                                      size={11}
                                      className="transition-transform"
                                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}
                                    />
                                  </button>
                                )}
                              </div>
                              {imageUrls.length > 0 && (
                                <div className={chatStyles.thoughtLogImageGrid}>
                                  {imageUrls.map((imgUrl, imgIdx) => (
                                    <motion.button
                                      type="button"
                                      key={`${ev.id}-img-${imgIdx}`}
                                      className={chatStyles.thoughtLogImageCard}
                                      initial={{ opacity: 0, scale: 0.9 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.24 }}
                                      onClick={() => setExpandedImageUrl(imgUrl)}
                                    >
                                      <img src={imgUrl} alt={`Generated visual ${imgIdx + 1}`} loading="lazy" />
                                      <span className={chatStyles.thoughtLogImageIndex}>{imgIdx + 1}</span>
                                    </motion.button>
                                  ))}
                                </div>
                              )}
                              <AnimatePresence>
                                {hasMetadata && isExpanded && (
                                  <motion.pre
                                    key={`json-${ev.id}`}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22 }}
                                    className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded border p-2 font-mono text-[10px] leading-4"
                                    style={{ background: "#f9f1e7", borderColor: "#dbc9b7", color: "#7a5a45" }}
                                  >
                                    {JSON.stringify(ev.metadata, null, 2)}
                                  </motion.pre>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}

                  {!isTerminal && (
                    <motion.div
                      className={chatStyles.dreamingSpinnerRow}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className={chatStyles.dreamingSpinnerIndent}>
                        <span className={chatStyles.dreamingSpinner} />
                      </span>
                      <motion.span
                        className={chatStyles.dreamingFinalizingText}
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {job.current_step || "Processing…"}
                      </motion.span>
                    </motion.div>
                  )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    );
  }

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#9a7a65" }} />
          <p className="text-sm font-semibold" style={{ color: "#9a7a65" }}>
            Loading job details…
          </p>
        </motion.div>
      </section>
    );
  }

  if (error || !job) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <AlertCircle className="h-10 w-10 text-rose-400" />
          <p className="text-lg font-semibold" style={{ color: "#2b180a" }}>
            {error ?? "Job not found"}
          </p>
          <Link
            href="/dashboard/jobs"
            className={`inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold ${styles.btnOutlineHover}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Jobs
          </Link>
        </motion.div>
      </section>
    );
  }

  const StatusIcon = statusConfig[job.status].icon;

  return (
    <section className="space-y-4">
      {/* ── Title row ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div className="space-y-1">
          <h2 className={`${styles.halant} text-2xl md:text-3xl`}>{job.title}</h2>
          <p className="font-mono text-xs" style={{ color: "#9a7a65" }}>
            {job.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
              statusConfig[job.status].className
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig[job.status].label}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className={`inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold ${styles.btnOutlineHover}`}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <Link
            href="/dashboard/jobs"
            className={`inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold ${styles.btnOutlineHover}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </motion.div>

      {/* ── Status chips bar ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0.5}
        className="flex flex-wrap items-center gap-2"
      >
        <StatusChip
          label={`Status: ${statusConfig[job.status].label}`}
          tone={
            job.status === "completed"
              ? "ok"
              : job.status === "failed"
                ? "error"
                : job.status === "processing"
                  ? "running"
                  : "neutral"
          }
        />
        <StatusChip label={modeConfig[job.type].label} tone="neutral" />
        {workflowUsed && <StatusChip label={`Workflow: ${workflowUsed}`} tone="neutral" />}
        {replicateModel && <StatusChip label={`Model: ${replicateModel}`} tone="neutral" />}
        {imageAssets.length > 0 && (
          <StatusChip
            label={`${imageAssets.length} asset${imageAssets.length !== 1 ? "s" : ""}`}
            tone="ok"
          />
        )}
        {job.engine && <StatusChip label={`Engine: ${job.engine}`} tone="neutral" />}
      </motion.div>

      {/* ── Progress bar (non-terminal) ── */}
      {!isTerminal && job.progress != null && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="overflow-hidden rounded-2xl p-4"
          style={cardStyle}
        >
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span style={{ color: "#2b180a" }}>
              {job.current_step || "Processing…"}
            </span>
            <span style={{ color: "#9a7a65" }}>{Math.round(job.progress)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "#ede7dd" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "#c9924e" }}
              initial={{ width: 0 }}
              animate={{ width: `${job.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      {/* ── Error banner ── */}
      <AnimatePresence>
        {job.status === "failed" && job.error_message && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="flex items-start gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" />
            <div>
              <p className="text-sm font-bold text-rose-900">Job Failed</p>
              <p className="mt-1 text-sm text-rose-700">{job.error_message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-4">
        {/* ── Left column (results) ── */}
        <div className="space-y-4">
          {/* Storybook preview */}
          {bookPreview && (
            <motion.article
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              className="overflow-hidden rounded-2xl"
              style={cardStyle}
            >
              <header className="px-4 py-3" style={{ borderBottom: "1px solid #dbc9b7" }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: "#c9924e" }} />
                  <h3 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: "#2b180a" }}>
                    Storybook Preview
                  </h3>
                </div>
              </header>
              <div className="p-4">
                <StoryBook
                  title={bookPreview.title}
                  ageBand=""
                  pages={bookPreview.pages}
                  cover={bookPreview.cover}
                />
              </div>
            </motion.article>
          )}

          {/* ── Generated Images Grid ── */}
          <motion.article
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2.2}
            className="rounded-2xl p-4"
            style={cardStyle}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: "#2b180a" }}>
                <ImageIcon className="h-4 w-4" />
                <h3 className="text-sm font-black uppercase tracking-[0.1em]">Generated Images</h3>
              </div>
              {hasDisplayImages && (
                <StatusChip
                  label={`${displayImages.length} image${displayImages.length !== 1 ? "s" : ""}`}
                  tone="ok"
                />
              )}
            </div>

            {hasDisplayImages ? (
              isCharacterHeroImage ? (
                <div className="rounded-xl border p-3" style={deepCardStyle}>
                  <div className="flex flex-col gap-4 lg:flex-row">
                    <motion.button
                      type="button"
                      onClick={() => setExpandedImageUrl(displayImages[0].url)}
                      className="mx-auto w-full max-w-[280px] cursor-zoom-in overflow-hidden rounded-lg border p-1 lg:mx-0 lg:w-[280px]"
                      style={{ background: "#f7efe4", borderColor: "#dbc9b7" }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <img
                        src={displayImages[0].url}
                        alt={displayImages[0].filename}
                        className="aspect-[4/5] w-full rounded object-cover"
                      />
                    </motion.button>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                          {displayImages[0].label}
                        </p>
                        <a
                          href={displayImages[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold"
                          style={{ color: "#5b2a08" }}
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="truncate text-xs font-mono" style={{ color: "#9a7a65" }}>
                        {displayImages[0].filename}
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: "#7a5a45" }}>
                        Character output is ready. Use Open for full-size view or Copy to share the image URL.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(displayImages[0].url);
                          setCopiedUrl(displayImages[0].url);
                          setTimeout(() => setCopiedUrl(null), 1500);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{ borderColor: "#dbc9b7", color: "#7a5a45" }}
                      >
                        <Copy className="h-3 w-3" />
                        {copiedUrl === displayImages[0].url ? "Copied" : "Copy URL"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "grid gap-2",
                    job.type === "character"
                      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                      : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
                  )}
                >
                  {displayImages.map((image) => (
                    <div key={image.id} className="rounded-xl border p-2" style={deepCardStyle}>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[10px] font-semibold" style={{ color: "#7a5a45" }}>
                          {image.label}
                        </p>
                        <a
                          href={image.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
                          style={{ color: "#5b2a08" }}
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <motion.button
                        type="button"
                        onClick={() => setExpandedImageUrl(image.url)}
                        className="w-full cursor-zoom-in overflow-hidden rounded-lg border p-1"
                        style={{ background: "#f7efe4", borderColor: "#dbc9b7" }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <img src={image.url} alt={image.filename} className="aspect-[2/3] w-full rounded object-cover" />
                      </motion.button>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="truncate text-[10px] font-mono" style={{ color: "#9a7a65" }}>
                          {image.filename}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(image.url);
                            setCopiedUrl(image.url);
                            setTimeout(() => setCopiedUrl(null), 1500);
                          }}
                          className="flex-shrink-0 text-[10px] font-semibold"
                          style={{ color: "#7a5a45" }}
                        >
                          {copiedUrl === image.url ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm" style={{ color: "#9a7a65" }}>
                {isTerminal ? "No images were generated for this job." : "Images will appear here as they are generated…"}
              </p>
            )}
          </motion.article>

          {/* ── Chat-style logs (right after images) ── */}
          {renderChatLogs()}

          {/* ── Character Profile (unified image + backstory + image prompt) ── */}
          {backstory && (
            <motion.article
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              className="rounded-2xl p-4"
              style={cardStyle}
            >
              <div className="mb-3 flex items-center gap-2" style={{ color: "#2b180a" }}>
                <UserRound className="h-4 w-4" />
                <h3 className="text-sm font-black uppercase tracking-[0.1em]">Character Profile</h3>
              </div>
              <div className="flex overflow-hidden rounded-xl border" style={deepCardStyle}>
                {/* Image — proper 2:3 */}
                {displayImages.length > 0 && (
                  <motion.button
                    type="button"
                    onClick={() => setExpandedImageUrl(displayImages[0].url)}
                    className="w-44 flex-shrink-0 cursor-zoom-in"
                    style={{ borderRight: "1px solid #dbc9b7" }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <img
                      src={displayImages[0].url}
                      alt={backstory.name ?? "Character"}
                      className="aspect-[2/3] w-full object-cover"
                    />
                  </motion.button>
                )}

                {/* Description */}
                <div className="min-w-0 flex-1 space-y-2 p-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                      {backstory.name || "Unnamed Character"}
                    </p>
                    {(backstory.archetype || backstory.era || backstory.origin) && (
                      <p className="mt-0.5 text-[11px]" style={{ color: "#9a7a65" }}>
                        {[backstory.archetype, backstory.era, backstory.origin].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  {backstory.goals && backstory.goals.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Goals</p>
                      <div className="flex flex-wrap gap-1">
                        {backstory.goals.map((g, i) => (
                          <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ ...deepCardStyle, color: "#2b180a" }}>{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {backstory.flaws && backstory.flaws.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Flaws</p>
                      <div className="flex flex-wrap gap-1">
                        {backstory.flaws.map((f, i) => (
                          <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ ...deepCardStyle, color: "#2b180a" }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {backstory.visual_signifiers && backstory.visual_signifiers.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Visual Signifiers</p>
                      <div className="flex flex-wrap gap-1">
                        {backstory.visual_signifiers.map((v, i) => (
                          <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ ...deepCardStyle, color: "#7a5a45" }}>{v}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show more toggle for verbose narrative + image prompt details */}
                  {(backstory.narrative_backstory || imagePrompt?.positive_prompt) && (
                    <button
                      type="button"
                      onClick={() => setExpandedCharIds(prev => {
                        const next = new Set(prev);
                        next.has(-1) ? next.delete(-1) : next.add(-1);
                        return next;
                      })}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: "#9a7a65" }}
                    >
                      {expandedCharIds.has(-1) ? "Show less" : "Show more"}
                      <ChevronDown
                        className="h-3 w-3 transition-transform"
                        style={{ transform: expandedCharIds.has(-1) ? "rotate(180deg)" : "rotate(0)" }}
                      />
                    </button>
                  )}

                  <AnimatePresence>
                    {expandedCharIds.has(-1) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden space-y-2"
                      >
                        {backstory.narrative_backstory && (
                          <div>
                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Narrative</p>
                            <p className="text-[11px] leading-5" style={{ color: "#2b180a" }}>{backstory.narrative_backstory}</p>
                          </div>
                        )}
                        {imagePrompt?.positive_prompt && (
                          <div>
                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#22c55e" }}>Image Prompt</p>
                            <p className="text-[11px] leading-5" style={{ color: "#2b180a" }}>{imagePrompt.positive_prompt}</p>
                          </div>
                        )}
                        {imagePrompt?.negative_prompt && (
                          <div>
                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#ef4444" }}>Negative Prompt</p>
                            <p className="text-[11px] leading-5" style={{ color: "#2b180a" }}>{imagePrompt.negative_prompt}</p>
                          </div>
                        )}
                        {imagePrompt?.composition_guidance && (
                          <div>
                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Composition</p>
                            <p className="text-[11px] leading-5" style={{ color: "#2b180a" }}>{imagePrompt.composition_guidance}</p>
                          </div>
                        )}
                        {imagePrompt?.color_palette && imagePrompt.color_palette.length > 0 && (
                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Color Palette</p>
                            <div className="flex flex-wrap gap-1">
                              {imagePrompt.color_palette.map((c, i) => (
                                <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ ...deepCardStyle, color: "#7a5a45" }}>{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.article>
          )}

          {/* ── Story Characters ── */}
          {characters.length > 0 && (
            <motion.article
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
              className="rounded-2xl p-4"
              style={cardStyle}
            >
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.1em]" style={{ color: "#2b180a" }}>
                Characters ({characters.length})
              </h3>
              <div className="space-y-3">
                {characters.map((char, idx) => {
                  const bs = char.backstory;
                  const archetype = bs?.archetype as string | undefined;
                  const era = bs?.era as string | undefined;
                  const origin = bs?.origin as string | undefined;
                  const meta = [archetype, era, origin].filter(Boolean).join(" · ");
                  const goals = bs?.goals as string[] | undefined;
                  const flaws = bs?.flaws as string[] | undefined;
                  const vs = bs?.visual_signifiers as string[] | undefined;
                  const narrative = bs?.narrative_backstory as string | undefined;
                  const imagePrompt = char.image_prompt?.positive_prompt as string | undefined;
                  const isExpanded = expandedCharIds.has(idx);
                  const toggleExpand = () => setExpandedCharIds(prev => {
                    const next = new Set(prev);
                    next.has(idx) ? next.delete(idx) : next.add(idx);
                    return next;
                  });

                  return (
                  <div key={idx} className="flex overflow-hidden rounded-xl border" style={deepCardStyle}>
                    {/* Image — proper 2:3 */}
                    {char.generated_images && char.generated_images.length > 0 && (
                      <motion.button
                        type="button"
                        onClick={() => setExpandedImageUrl(char.generated_images![0])}
                        className="w-44 flex-shrink-0 cursor-zoom-in"
                        style={{ borderRight: "1px solid #dbc9b7" }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <img
                          src={char.generated_images[0]}
                          alt={char.name ?? `Character ${idx + 1}`}
                          className="aspect-[2/3] w-full object-cover"
                        />
                      </motion.button>
                    )}

                    {/* Description */}
                    <div className="min-w-0 flex-1 space-y-2 p-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                          {char.name || `Character ${idx + 1}`}
                        </p>
                        {meta && <p className="mt-0.5 text-[11px]" style={{ color: "#9a7a65" }}>{meta}</p>}
                      </div>

                      {char.brief && (
                        <p className="text-[11px] leading-5" style={{ color: "#7a5a45" }}>{char.brief}</p>
                      )}

                      {/* Compact chips row */}
                      {goals && goals.length > 0 && (
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Goals</p>
                          <div className="flex flex-wrap gap-1">
                            {goals.map((g, i) => <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ ...deepCardStyle, color: "#2b180a" }}>{g}</span>)}
                          </div>
                        </div>
                      )}

                      {flaws && flaws.length > 0 && (
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Flaws</p>
                          <div className="flex flex-wrap gap-1">
                            {flaws.map((f, i) => <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ ...deepCardStyle, color: "#2b180a" }}>{f}</span>)}
                          </div>
                        </div>
                      )}

                      {vs && vs.length > 0 && (
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Visual Signifiers</p>
                          <div className="flex flex-wrap gap-1">
                            {vs.map((v, i) => <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ ...deepCardStyle, color: "#7a5a45" }}>{v}</span>)}
                          </div>
                        </div>
                      )}

                      {/* Expand toggle for verbose fields */}
                      {(narrative || imagePrompt) && (
                        <button
                          type="button"
                          onClick={toggleExpand}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold"
                          style={{ color: "#9a7a65" }}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                          <ChevronDown
                            className="h-3 w-3 transition-transform"
                            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}
                          />
                        </button>
                      )}

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden space-y-2"
                          >
                            {narrative && (
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Narrative</p>
                                <p className="text-[11px] leading-5" style={{ color: "#2b180a" }}>{narrative}</p>
                              </div>
                            )}
                            {imagePrompt && (
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#22c55e" }}>Image Prompt</p>
                                <p className="text-[11px] leading-5" style={{ color: "#2b180a" }}>{imagePrompt}</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {char.warnings && char.warnings.length > 0 && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
                          <ul className="list-disc pl-4 text-[10px] text-amber-800">
                            {char.warnings.map((w, wi) => <li key={wi}>{w}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </motion.article>
          )}

          {/* ── Scene Prompts ── */}
          {scenePrompts && (
            <motion.article
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3.5}
              className="rounded-2xl p-4"
              style={cardStyle}
            >
              <button
                type="button"
                onClick={() => setShowScenePrompts((p) => !p)}
                className="flex w-full items-center justify-between text-sm font-black uppercase tracking-[0.1em]"
                style={{ color: "#2b180a" }}
              >
                <span>Scene Prompts</span>
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showScenePrompts ? "rotate(180deg)" : "rotate(0)" }}
                />
              </button>
              <AnimatePresence>
                {showScenePrompts && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {scenePrompts.cover_prompt && (
                        <div className="rounded-xl border p-3" style={deepCardStyle}>
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Cover</p>
                          <p className="text-xs" style={{ color: "#2b180a" }}>{scenePrompts.cover_prompt}</p>
                        </div>
                      )}
                      {scenePrompts.illustration_prompts?.map((prompt, i) => (
                        <div key={i} className="rounded-xl border p-3" style={deepCardStyle}>
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "#9a7a65" }}>
                            Scene {i + 1}
                          </p>
                          <p className="text-xs" style={{ color: "#2b180a" }}>{prompt}</p>
                        </div>
                      ))}
                      {scenePrompts.negative_prompt && (
                        <div className="rounded-xl border p-3" style={deepCardStyle}>
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "#ef4444" }}>Negative</p>
                          <p className="text-xs" style={{ color: "#2b180a" }}>{scenePrompts.negative_prompt}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          )}

          {/* ── Story text / Spreads ── */}
          {story && !bookPreview && (
            <motion.article
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={4.5}
              className="rounded-2xl p-4"
              style={cardStyle}
            >
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.1em]" style={{ color: "#2b180a" }}>
                Story
              </h3>
              {story.title && <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>{story.title}</p>}
              {story.title_page_text && <p className="mt-1 text-xs" style={{ color: "#9a7a65" }}>{story.title_page_text}</p>}
              {story.right_pages && story.right_pages.map((entry, i) => {
                const pageText = typeof entry === "string" ? entry : (entry.text ?? "");
                const pageChapter = typeof entry === "string" ? undefined : entry.chapter;
                return (
                  <div key={i} className="mt-3 rounded-xl border p-3" style={deepCardStyle}>
                    <p className="mb-1 text-xs font-bold" style={{ color: "#9a7a65" }}>
                      {pageChapter ? `${pageChapter} — Page ${i + 1}` : `Page ${i + 1}`}
                    </p>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "#2b180a" }}>{pageText}</p>
                  </div>
                );
              })}
              {story.end_page_text && (
                <div className="mt-3 rounded-xl border p-3" style={deepCardStyle}>
                  <p className="mb-1 text-xs font-bold" style={{ color: "#9a7a65" }}>The End</p>
                  <p className="text-xs" style={{ color: "#2b180a" }}>{story.end_page_text}</p>
                </div>
              )}
            </motion.article>
          )}

          {/* ── Drawing & World Ref Descriptions ── */}
          {drawingDescriptions.length > 0 && (
            <motion.article variants={fadeUp} initial="hidden" animate="visible" custom={5} className="rounded-2xl p-4" style={cardStyle}>
              <button
                type="button"
                onClick={() => setShowDrawingDescs((p) => !p)}
                className="flex w-full items-center justify-between text-sm font-black uppercase tracking-[0.1em]"
                style={{ color: "#2b180a" }}
              >
                <span>Vision Drawing Descriptions</span>
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showDrawingDescs ? "rotate(180deg)" : "rotate(0)" }}
                />
              </button>
              <AnimatePresence>
                {showDrawingDescs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {drawingDescriptions.map((desc, i) => (
                        <div key={i} className="rounded-xl border p-3" style={deepCardStyle}>
                          <div className="mb-1 flex items-center gap-1.5">
                            <ImageIcon className="h-3 w-3" style={{ color: "#7a5a45" }} />
                            <p className="text-[11px] font-semibold" style={{ color: "#7a5a45" }}>Drawing {i + 1}</p>
                          </div>
                          <p className="whitespace-pre-wrap text-xs" style={{ color: "#2b180a" }}>{desc}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          )}

          {worldRefDescriptions.length > 0 && (
            <motion.article variants={fadeUp} initial="hidden" animate="visible" custom={5} className="rounded-2xl p-4" style={cardStyle}>
              <button
                type="button"
                onClick={() => setShowDrawingDescs((p) => !p)}
                className="flex w-full items-center justify-between text-sm font-black uppercase tracking-[0.1em]"
                style={{ color: "#2b180a" }}
              >
                <span>World Reference Descriptions</span>
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showDrawingDescs ? "rotate(180deg)" : "rotate(0)" }}
                />
              </button>
              <AnimatePresence>
                {showDrawingDescs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {worldRefDescriptions.map((desc, i) => (
                        <div key={i} className="rounded-xl border p-3" style={deepCardStyle}>
                          <div className="mb-1 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3" style={{ color: "#7a5a45" }} />
                            <p className="text-[11px] font-semibold" style={{ color: "#7a5a45" }}>World Ref {i + 1}</p>
                          </div>
                          <p className="whitespace-pre-wrap text-xs" style={{ color: "#2b180a" }}>{desc}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          )}

          {/* ── Input / Result JSON panels ── */}
          {Object.keys(inputPayload).length > 0 && (
            <motion.article variants={fadeUp} initial="hidden" animate="visible" custom={6} className="rounded-2xl p-4" style={cardStyle}>
              <button
                type="button"
                onClick={() => setShowInputJson((p) => !p)}
                className="flex w-full items-center justify-between text-sm font-black uppercase tracking-[0.1em]"
                style={{ color: "#2b180a" }}
              >
                <span>Input Payload</span>
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showInputJson ? "rotate(180deg)" : "rotate(0)" }}
                />
              </button>
              <AnimatePresence>
                {showInputJson && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-3 text-[11px]"
                      style={{ ...deepCardStyle, color: "#7a5a45" }}
                    >
                      {inputJson}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          )}

          {hasResult && (
            <motion.article variants={fadeUp} initial="hidden" animate="visible" custom={6.5} className="rounded-2xl p-4" style={cardStyle}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowResultJson((p) => !p)}
                  className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em]"
                  style={{ color: "#2b180a" }}
                >
                  <span>Raw Result JSON</span>
                  <ChevronDown
                    className="h-4 w-4 transition-transform"
                    style={{ transform: showResultJson ? "rotate(180deg)" : "rotate(0)" }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(resultJson);
                    setCopyJsonState("done");
                    setTimeout(() => setCopyJsonState("idle"), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: "#dbc9b7", color: "#7a5a45" }}
                >
                  <Copy className="h-3 w-3" />
                  {copyJsonState === "done" ? "Copied" : "Copy JSON"}
                </button>
              </div>
              <AnimatePresence>
                {showResultJson && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-3 text-[11px]"
                      style={{ ...deepCardStyle, color: "#7a5a45" }}
                    >
                      {resultJson}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          )}

          {/* Generation summary */}
          {renderGenerationSummary(7)}
        </div>
      </div>

      {/* ── Image expand modal ── */}
      <AnimatePresence>
        {expandedImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            style={{ background: "rgb(15 10 7 / 0.75)" }}
            onClick={() => setExpandedImageUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-h-[92vh] max-w-[92vw] overflow-hidden rounded-2xl border p-3"
              style={{ background: "#fffaf4", borderColor: "#dbc9b7" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold" style={{ color: "#2b180a" }}>
                  Generated image preview
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(expandedImageUrl);
                      setCopiedUrl(expandedImageUrl);
                      setTimeout(() => setCopiedUrl(null), 1500);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: "#dbc9b7", color: "#7a5a45" }}
                  >
                    <Copy className="h-3 w-3" />
                    {copiedUrl === expandedImageUrl ? "Copied" : "Copy URL"}
                  </button>
                  <a
                    href={expandedImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: "#dbc9b7", color: "#7a5a45" }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => setExpandedImageUrl(null)}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: "#dbc9b7", color: "#7a5a45" }}
                  >
                    <X className="h-3 w-3" />
                    Close
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border" style={{ borderColor: "#dbc9b7" }}>
                <img
                  src={expandedImageUrl}
                  alt="Expanded preview"
                  className="max-h-[82vh] max-w-[88vw] rounded object-contain"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
