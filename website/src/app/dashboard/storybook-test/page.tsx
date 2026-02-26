/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import { StoryBook } from "@/components/dashboard/story-book";
import type { StoryPage } from "@/lib/dashboard-data";

import styles from "../dashboard.module.css";

type WorkflowChoice = "" | "reference_enriched" | "prompt_only";
type ApiTarget = "main" | "backend";
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
    right_pages?: Array<{ page_number?: number; chapter?: string; text?: string }>;
  };
  spreads?: Array<{
    spread_index?: number;
    label?: string | null;
    left?: { kind?: string; image_url?: string; chapter?: string; text?: string; title?: string };
    right?: { kind?: string; image_url?: string; chapter?: string; text?: string; title?: string };
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
};

type StoryPageCard = {
  pageNumber: number;
  chapter: string;
  text: string;
  imageUrl: string | null;
  prompt: string;
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

function unwrapStorybookPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const backendResponse = (payload as { backend_response?: unknown }).backend_response;
  if (backendResponse && typeof backendResponse === "object") {
    return backendResponse;
  }
  return payload;
}

function SpreadSideCard({ side, pageTitle }: { side?: SpreadSide; pageTitle: string }) {
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

      {hasImage ? (
        <div className="mt-2 w-full rounded-lg border p-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
          <div className="flex w-full aspect-[4/3] items-center justify-center overflow-hidden rounded-md">
            <img src={side.image_url} alt={`${pageTitle} visual`} className="h-full w-full rounded object-contain" />
          </div>
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

export default function DashboardStorybookTestPage() {
  const [apiTarget, setApiTarget] = useState<ApiTarget>("main");
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
        const pageNumber = Math.max(1, Math.min(5, Number(page.page_number ?? 1)));
        const spread = spreadMap.get(pageNumber);
        return {
          pageNumber,
          chapter: page.chapter || `Chapter ${pageNumber}`,
          text: page.text || "",
          imageUrl: spread?.left?.image_url || null,
          prompt: scenePrompts[pageNumber - 1] || "",
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
    for (let pageNumber = 1; pageNumber <= 5; pageNumber += 1) {
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
          image_data: entry.file ? await fileToDataUrl(entry.file) : undefined,
        }))
      )
    ).filter(hasAnyValue);

    const drawingsPayload = (
      await Promise.all(
        drawings.map(async (entry) => ({
          description: cleanText(entry.description),
          notes: cleanText(entry.notes),
          image_data: entry.file ? await fileToDataUrl(entry.file) : undefined,
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

  async function sendRequest() {
    if (!canSubmit) return;

    setRequestState("loading");
    setErrorMessage("");
    setResponseStatus(null);

    try {
      const payload = await buildPayload();
      setLastPayload(toPayloadForDisplay(payload));

      const response = await fetch(`/api/storybook-test?target=${apiTarget}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let parsed: unknown = null;
      if (text.trim()) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }
      }

      setResponseStatus(response.status);
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
        setRequestState("error");
        return;
      }

      setRequestState("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Request failed.");
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
            onClick={() => setApiTarget("main")}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: "#dbc9b7",
              background: apiTarget === "main" ? "#f0e8dc" : "#fffaf4",
              color: "#2b180a",
            }}
          >
            Main (8010)
          </button>
          <button
            type="button"
            onClick={() => setApiTarget("backend")}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: "#dbc9b7",
              background: apiTarget === "backend" ? "#f0e8dc" : "#fffaf4",
              color: "#2b180a",
            }}
          >
            Storybook (8020)
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
          <StatusChip
            label={apiTarget === "main" ? "Main -> Storybook via A2A" : "Storybook backend direct"}
            tone="neutral"
          />
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
                        <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-md">
                          <img src={entry.previewUrl} alt="world reference preview" className="max-h-56 max-w-full object-contain" />
                        </div>
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
                        <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-md">
                          <img src={entry.previewUrl} alt="character drawing preview" className="max-h-56 max-w-full object-contain" />
                        </div>
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
            Send Request
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
                {storyPages.map((page) => (
                  <article
                    key={`story-page-${page.pageNumber}`}
                    className="min-w-0 rounded-xl border p-3"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip label={`Page ${page.pageNumber} of 5`} tone="neutral" />
                      <StatusChip label={page.chapter || "chapter"} tone="neutral" />
                    </div>
                    <p className="mt-2 break-words text-xs leading-5" style={{ color: "#7a5a45" }}>
                      {page.text || "No story text generated for this page."}
                    </p>
                    {page.prompt ? (
                      <p className="mt-2 break-words rounded-lg border px-2 py-1 text-[11px]" style={{ borderColor: "#dbc9b7", color: "#9a7a65" }}>
                        Prompt used: {page.prompt}
                      </p>
                    ) : null}
                    {page.imageUrl ? (
                      <div className="mt-2 w-full rounded-lg border p-2" style={{ borderColor: "#dbc9b7", background: "#f7efe4" }}>
                        <div className="flex w-full items-center justify-center overflow-hidden rounded-md">
                          <img
                            src={page.imageUrl}
                            alt={`Page ${page.pageNumber} illustration`}
                            className="max-h-[320px] w-auto max-w-full rounded object-contain"
                          />
                        </div>
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
                  </article>
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
                  <article
                    key={`img-${index}`}
                    className="min-w-0 rounded-xl border p-2"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
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
                      <div className="flex w-full aspect-[4/3] items-center justify-center overflow-hidden rounded-md">
                        <img src={url} alt={`scene ${index + 1}`} className="h-full w-full rounded object-contain" />
                      </div>
                    </div>
                  </article>
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
                  <article key={`char-${index}`} className="min-w-0 rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}>
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
                            <div className="flex w-full aspect-[3/4] items-center justify-center overflow-hidden rounded-md">
                              <img
                                src={imageUrl}
                                alt={`${character.name || "character"} image ${imageIndex + 1}`}
                                className="h-full w-full rounded object-contain"
                              />
                            </div>
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
                  </article>
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
                  <article
                    key={`spread-${index}`}
                    className="rounded-xl border p-3"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                  >
                    <p className="break-words text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#7a5a45" }}>
                      Spread {spread.spread_index ?? index}
                      {spread.label ? ` · ${spread.label}` : ""}
                    </p>
                    <p className="mt-1 break-words text-[11px]" style={{ color: "#9a7a65" }}>
                      Left: {spread.left?.kind || "n/a"} | Right: {spread.right?.kind || "n/a"}
                    </p>
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      <SpreadSideCard side={spread.left} pageTitle="Left page" />
                      <SpreadSideCard side={spread.right} pageTitle="Right page" />
                    </div>
                  </article>
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

      {exactBookPreview ? (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#9a7a65" }}>
            Exact Book UI Preview
          </p>
          <p className="text-xs" style={{ color: "#9a7a65" }}>
            Same component as the real story reader (`/dashboard/stories/[id]`), rendered with this test response.
          </p>
          <StoryBook
            title={exactBookPreview.title}
            ageBand={exactBookPreview.ageBand}
            pages={exactBookPreview.pages}
            cover={exactBookPreview.cover}
          />
        </div>
      ) : null}
    </section>
  );
}
