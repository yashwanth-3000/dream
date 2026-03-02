/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { createJob, type Job } from "@/lib/jobs";
import styles from "../dashboard.module.css";

type WorkflowChoice = "" | "reference_enriched" | "prompt_only";

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

type WorldReferenceTextField = "title" | "description";
type DrawingTextField = "description" | "notes";

type RequestState = "idle" | "loading" | "success" | "error";
type HealthState = "idle" | "loading" | "ok" | "error";
type RequestAction = "create" | "regenerate";
type ApiTarget = "main" | "backend";
type PromptPack = { positive_prompt: string; negative_prompt?: string };

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

const MIN_RECOMMENDED_PROMPT_LENGTH = 12;

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

function shortText(value: string | undefined, max = 220) {
  if (!value) return "-";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function extractPromptPack(payload: unknown): PromptPack | null {
  if (!payload || typeof payload !== "object") return null;
  const imagePrompt = (payload as { image_prompt?: unknown }).image_prompt;
  if (!imagePrompt || typeof imagePrompt !== "object") return null;

  const positiveValue = (imagePrompt as { positive_prompt?: unknown }).positive_prompt;
  const negativeValue = (imagePrompt as { negative_prompt?: unknown }).negative_prompt;
  const positivePrompt = typeof positiveValue === "string" ? positiveValue.trim() : "";
  if (!positivePrompt) return null;

  const negativePrompt = typeof negativeValue === "string" ? negativeValue : undefined;
  return { positive_prompt: positivePrompt, negative_prompt: negativePrompt };
}

function unwrapWorkflowPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const backendResponse = (payload as { backend_response?: unknown }).backend_response;
  if (backendResponse && typeof backendResponse === "object") {
    return backendResponse;
  }
  return payload;
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

export default function DashboardApiTestPage() {
  const [prompt, setPrompt] = useState("A moon ranger with shattered ceremonial armor and a plasma bow.");
  const [workflowChoice, setWorkflowChoice] = useState<WorkflowChoice>("");
  const [apiTarget, setApiTarget] = useState<ApiTarget>("main");

  const [worldReferences, setWorldReferences] = useState<WorldReferenceInput[]>([
    {
      title: "Temple archives",
      description: "Ancient orbital sanctuaries with cracked silver domes and relic banners.",
      file: null,
      previewUrl: "",
    },
  ]);
  const [drawings, setDrawings] = useState<DrawingInput[]>([EMPTY_DRAWING]);

  const [healthState, setHealthState] = useState<HealthState>("idle");
  const [healthMessage, setHealthMessage] = useState("");
  const [a2aProbeState, setA2AProbeState] = useState<HealthState>("idle");
  const [a2aProbeMessage, setA2AProbeMessage] = useState("");

  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [lastPayload, setLastPayload] = useState<unknown>(null);
  const [responseBody, setResponseBody] = useState<unknown>(null);
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");
  const [requestAction, setRequestAction] = useState<RequestAction | null>(null);
  const [lastImagePrompt, setLastImagePrompt] = useState<PromptPack | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [copiedImageUrl, setCopiedImageUrl] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);

  const responseJson = useMemo(() => JSON.stringify(responseBody, null, 2), [responseBody]);
  const payloadJson = useMemo(() => JSON.stringify(lastPayload, null, 2), [lastPayload]);
  const apiRouteQuery = useMemo(() => `?target=${apiTarget}`, [apiTarget]);

  const orchestratorEnvelope =
    responseBody && typeof responseBody === "object" && responseBody !== null
      ? (responseBody as {
          selected_action?: string;
          selected_by?: string;
          backend_endpoint?: string;
          backend_status_code?: number;
          backend_response?: unknown;
        })
      : null;
  const workflowPayload = useMemo(() => unwrapWorkflowPayload(responseBody), [responseBody]);

  const uploadedWorldCount = useMemo(
    () => worldReferences.filter((entry) => Boolean(entry.file)).length,
    [worldReferences]
  );

  const uploadedDrawingCount = useMemo(
    () => drawings.filter((entry) => Boolean(entry.file)).length,
    [drawings]
  );

  const responseData =
    workflowPayload && typeof workflowPayload === "object" && workflowPayload !== null
      ? (workflowPayload as {
          generated_images?: string[];
          drawing_descriptions?: string[];
          world_reference_descriptions?: string[];
          total_reference_images_sent?: number;
          workflow_used?: string;
          backstory?: { name?: string; archetype?: string; narrative_backstory?: string };
          image_prompt?: { positive_prompt?: string; negative_prompt?: string };
        })
      : null;

  const generatedImages = responseData?.generated_images || [];
  const drawingDescriptions = responseData?.drawing_descriptions || [];
  const worldReferenceDescriptions = responseData?.world_reference_descriptions || [];
  const promptForRegeneration = responseData?.image_prompt?.positive_prompt
    ? {
        positive_prompt: responseData.image_prompt.positive_prompt,
        negative_prompt: responseData.image_prompt.negative_prompt,
      }
    : lastImagePrompt;
  const promptPreviewValue = promptForRegeneration?.positive_prompt || "";

  const promptLength = prompt.trim().length;
  const canSubmit = requestState !== "loading" && promptLength > 0;
  const canRegenerate =
    requestState !== "loading" && Boolean(promptForRegeneration?.positive_prompt.trim());

  const checkBackendHealth = useCallback(async () => {
    setHealthState("loading");
    setHealthMessage("");
    try {
      const response = await fetch(`/api/character-test?target=${apiTarget}`, { method: "GET" });
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

  const probeA2APath = useCallback(async () => {
    setA2AProbeState("loading");
    setA2AProbeMessage("");
    try {
      const response = await fetch("/api/character-test?target=main&check=a2a", { method: "GET" });
      const text = await response.text();
      if (!response.ok) {
        setA2AProbeState("error");
        setA2AProbeMessage(text || "A2A probe failed.");
        return;
      }
      setA2AProbeState("ok");
      setA2AProbeMessage(text || '{"status":"ok"}');
    } catch (error) {
      setA2AProbeState("error");
      setA2AProbeMessage(error instanceof Error ? error.message : "A2A probe failed.");
    }
  }, []);

  function updateWorldReference(index: number, field: WorldReferenceTextField, value: string) {
    setWorldReferences((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function updateDrawing(index: number, field: DrawingTextField, value: string) {
    setDrawings((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
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

  async function copyResponse() {
    if (!responseJson) return;
    try {
      await navigator.clipboard.writeText(responseJson);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1000);
    } catch {
      setCopyState("idle");
    }
  }

  async function copyImageUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedImageUrl(url);
      window.setTimeout(() => {
        setCopiedImageUrl((prev) => (prev === url ? null : prev));
      }, 1200);
    } catch {
      setCopiedImageUrl(null);
    }
  }

  async function buildReferencePayloads() {
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

    return { worldReferencesPayload, drawingsPayload };
  }

  function toPayloadForDisplay(payload: Record<string, unknown>) {
    const worldReferencesPayload = Array.isArray(payload.world_references)
      ? (payload.world_references as Array<{ image_data?: string }>)
      : [];
    const drawingsPayload = Array.isArray(payload.character_drawings)
      ? (payload.character_drawings as Array<{ image_data?: string }>)
      : [];

    return {
      ...payload,
      world_references: worldReferencesPayload.map((entry) => ({
        ...entry,
        image_data: entry.image_data ? `[data-url length=${entry.image_data.length}]` : undefined,
      })),
      character_drawings: drawingsPayload.map((entry) => ({
        ...entry,
        image_data: entry.image_data ? `[data-url length=${entry.image_data.length}]` : undefined,
      })),
    };
  }

  async function parseResponse(response: Response) {
    const text = await response.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  function setErrorFromResponse(status: number, parsed: unknown) {
    const detail =
      parsed && typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? String((parsed as { detail?: unknown }).detail ?? "")
        : "";
    setErrorMessage(
      detail ? `Request failed with status ${status}: ${detail}` : `Request failed with status ${status}.`
    );
  }

  async function buildPayloadForAction(action: RequestAction): Promise<Record<string, unknown>> {
    const { worldReferencesPayload, drawingsPayload } = await buildReferencePayloads();

    if (action === "create") {
      const normalizedPrompt = prompt.trim();
      if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
      }

      const payload: Record<string, unknown> = {
        user_prompt: normalizedPrompt,
        world_references: worldReferencesPayload,
        character_drawings: drawingsPayload,
      };
      if (workflowChoice) {
        payload.force_workflow = workflowChoice;
      }
      if (apiTarget === "main") {
        payload.mode = "create";
      }
      return payload;
    }

    const promptPack = promptForRegeneration;
    if (!promptPack?.positive_prompt.trim()) {
      throw new Error("Generate once first to cache an image prompt, then use regenerate.");
    }

    const payload: Record<string, unknown> = {
      positive_prompt: promptPack.positive_prompt,
      negative_prompt: promptPack.negative_prompt,
      world_references: worldReferencesPayload,
      character_drawings: drawingsPayload,
    };
    if (apiTarget === "main") {
      payload.mode = "regenerate";
    }
    return payload;
  }


  async function submitRequest() {
    setRequestAction("create");
    setRequestState("loading");
    setErrorMessage("");
    setResponseStatus(null);

    try {
      const payload = await buildPayloadForAction("create");
      setLastPayload(toPayloadForDisplay(payload));

      let jobIdParam = "";
      try {
        const job = await createJob({
          type: "character",
          title: prompt.trim().slice(0, 80) || "Character Creation",
          user_prompt: prompt.trim(),
          input_payload: toPayloadForDisplay(payload) as Record<string, unknown>,
          triggered_by: "api-test",
          engine: "a2a-crew-ai-character-maker",
        });
        setCurrentJob(job);
        jobIdParam = `&job_id=${encodeURIComponent(job.id)}`;
      } catch { /* job tracking is best-effort */ }

      const response = await fetch(`/api/character-test${apiRouteQuery}${jobIdParam}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await parseResponse(response);
      setResponseStatus(response.status);
      setResponseBody(parsed);

      if (!response.ok) {
        setRequestState("error");
        setErrorFromResponse(response.status, parsed);
        return;
      }

      const promptPack = extractPromptPack(unwrapWorkflowPayload(parsed));
      if (promptPack) {
        setLastImagePrompt(promptPack);
      }
      setRequestState("success");
    } catch (error) {
      setRequestState("error");
      setErrorMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setRequestAction(null);
    }
  }

  async function regenerateImageOnly() {
    setRequestAction("regenerate");
    setRequestState("loading");
    setErrorMessage("");
    setResponseStatus(null);

    try {
      const payload = await buildPayloadForAction("regenerate");
      setLastPayload(toPayloadForDisplay(payload));

      let jobIdParam = "";
      try {
        const job = await createJob({
          type: "character",
          title: "Image Regeneration",
          user_prompt: String(payload.positive_prompt || ""),
          input_payload: toPayloadForDisplay(payload) as Record<string, unknown>,
          triggered_by: "api-test",
          engine: "a2a-crew-ai-character-maker",
        });
        setCurrentJob(job);
        jobIdParam = `&job_id=${encodeURIComponent(job.id)}`;
      } catch { /* job tracking is best-effort */ }

      const response = await fetch(`/api/character-test${apiRouteQuery}${jobIdParam}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await parseResponse(response);
      setResponseStatus(response.status);
      setResponseBody(parsed);

      if (!response.ok) {
        setRequestState("error");
        setErrorFromResponse(response.status, parsed);
        return;
      }

      const returnedPrompt =
        extractPromptPack(unwrapWorkflowPayload(parsed)) ||
        (payload.positive_prompt
          ? {
              positive_prompt: String(payload.positive_prompt),
              negative_prompt:
                typeof payload.negative_prompt === "string" ? payload.negative_prompt : undefined,
            }
          : null);
      setLastImagePrompt(returnedPrompt);
      setRequestState("success");
    } catch (error) {
      setRequestState("error");
      setErrorMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setRequestAction(null);
    }
  }

  return (
    <section
      className="space-y-4 rounded-3xl p-4 shadow-sm md:p-5"
      style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#9a7a65",
            }}
          >
            Backend QA
          </p>
          <h2 className={`${styles.halant} flex items-center gap-2 text-2xl`}>
            <FlaskConical className="h-6 w-6" />
            Character API Test Lab
          </h2>
          <p className="text-sm" style={{ color: "#9a7a65" }}>
            Upload references, run create once, then regenerate images without rerunning CrewAI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border px-2 py-1 text-xs" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
            <span style={{ color: "#7a5a45" }}>Target</span>
            <select
              value={apiTarget}
              onChange={(event) => setApiTarget(event.target.value as ApiTarget)}
              className="rounded border px-2 py-0.5 text-xs outline-none"
              style={{ borderColor: "#dbc9b7", background: "#fcf6ef", color: "#2b180a" }}
            >
              <option value="main">Main (MAF + A2A)</option>
              <option value="backend">Backend Direct</option>
            </select>
          </label>
          <StatusChip label={apiTarget === "main" ? "Route main -> A2A" : "Route backend direct"} tone={apiTarget === "main" ? "ok" : "neutral"} />
          <StatusChip label={`Prompt ${promptLength} chars`} tone={promptLength === 0 ? "error" : "neutral"} />
          <StatusChip label={`World uploads ${uploadedWorldCount}`} tone="neutral" />
          <StatusChip label={`Drawing uploads ${uploadedDrawingCount}`} tone="neutral" />
          {canRegenerate ? <StatusChip label="Prompt cached for regenerate" tone="ok" /> : null}
          {promptLength > 0 && promptLength < MIN_RECOMMENDED_PROMPT_LENGTH ? (
            <StatusChip label="Short prompt (works, but detail may be low)" tone="running" />
          ) : null}
          <button
            type="button"
            onClick={checkBackendHealth}
            className={`${styles.btnOutline} px-4 py-2 text-xs md:text-sm`}
            disabled={healthState === "loading"}
          >
            {healthState === "loading" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Check Health
          </button>
          {apiTarget === "main" ? (
            <button
              type="button"
              onClick={probeA2APath}
              className={`${styles.btnOutline} px-4 py-2 text-xs md:text-sm`}
              disabled={a2aProbeState === "loading"}
              title="Calls main /api/v1/orchestrate/a2a-health"
            >
              {a2aProbeState === "loading" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Probe A2A Path
            </button>
          ) : null}
          <button
            type="button"
            onClick={submitRequest}
            disabled={!canSubmit}
            className={`${styles.btnInk} px-4 py-2 text-xs md:text-sm disabled:cursor-not-allowed disabled:opacity-60`}
            title={promptLength === 0 ? "Enter a prompt to send request" : "Send request"}
          >
            {requestState === "loading" && requestAction === "create" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Test Request
          </button>
          <button
            type="button"
            onClick={regenerateImageOnly}
            disabled={!canRegenerate}
            className={`${styles.btnOutline} px-4 py-2 text-xs md:text-sm disabled:cursor-not-allowed disabled:opacity-60`}
            title="Regenerate only image using cached prompt and current uploaded references"
          >
            {requestState === "loading" && requestAction === "regenerate" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Regenerate Image Only
          </button>
        </div>
      </div>

      <div
        className="rounded-2xl p-3 text-xs"
        style={{
          border: "1px solid #dbc9b7",
          background: healthState === "error" ? "#fef2f2" : "#fcf6ef",
          color: healthState === "error" ? "#991b1b" : "#2b180a",
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="font-semibold">Health:</span>
          {healthState === "ok" ? <StatusChip label="Connected" tone="ok" /> : null}
          {healthState === "loading" ? <StatusChip label="Checking" tone="running" /> : null}
          {healthState === "error" ? <StatusChip label="Failed" tone="error" /> : null}
          {healthState === "idle" ? <StatusChip label="Not checked" tone="neutral" /> : null}
        </div>
        {healthMessage ? <pre className="mt-2 whitespace-pre-wrap">{healthMessage}</pre> : null}
      </div>

      {apiTarget === "main" ? (
        <div
          className="rounded-2xl p-3 text-xs"
          style={{
            border: "1px solid #dbc9b7",
            background: a2aProbeState === "error" ? "#fef2f2" : "#fcf6ef",
            color: a2aProbeState === "error" ? "#991b1b" : "#2b180a",
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="font-semibold">A2A route probe:</span>
            {a2aProbeState === "ok" ? <StatusChip label="Connected via main -> /a2a" tone="ok" /> : null}
            {a2aProbeState === "loading" ? <StatusChip label="Checking" tone="running" /> : null}
            {a2aProbeState === "error" ? <StatusChip label="Failed" tone="error" /> : null}
            {a2aProbeState === "idle" ? <StatusChip label="Not checked" tone="neutral" /> : null}
          </div>
          {a2aProbeMessage ? <pre className="mt-2 whitespace-pre-wrap">{a2aProbeMessage}</pre> : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
        <div className="space-y-4 rounded-2xl p-4 xl:sticky xl:top-4 self-start" style={{ border: "1px solid #dbc9b7", background: "#fcf6ef" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
              Request Builder
            </h3>
            <StatusChip label="Image generation always ON" tone="ok" />
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
              User prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "#dbc9b7", background: "#fdf8f3", color: "#2b180a" }}
            />
            <p className="text-[11px]" style={{ color: promptLength === 0 ? "#981b1b" : "#9a7a65" }}>
              {promptLength === 0
                ? "Prompt is required."
                : `Recommended: ${MIN_RECOMMENDED_PROMPT_LENGTH}+ characters for stronger backstory and image prompts.`}
            </p>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <div
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "#9fddb0", background: "#edf9ee", color: "#1f6a32" }}
            >
              Generate runs CrewAI + Replicate. Regenerate runs Replicate only using cached image prompt and
              current uploaded references.
            </div>

            <label className="space-y-1">
              <span className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                Force workflow (optional)
              </span>
              <select
                value={workflowChoice}
                onChange={(e) => setWorkflowChoice(e.target.value as WorkflowChoice)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "#dbc9b7", background: "#fdf8f3", color: "#2b180a" }}
              >
                <option value="">Auto</option>
                <option value="reference_enriched">reference_enriched</option>
                <option value="prompt_only">prompt_only</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                World references
              </p>
              <button
                type="button"
                onClick={() => setWorldReferences((prev) => [...prev, { ...EMPTY_WORLD_REFERENCE }])}
                className={`${styles.btnOutline} px-3 py-1 text-xs`}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {worldReferences.map((item, index) => (
              <div key={`world-${index}`} className="space-y-2 rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
                <input
                  value={item.title}
                  onChange={(e) => updateWorldReference(index, "title", e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                  style={{ borderColor: "#dbc9b7" }}
                />
                <textarea
                  value={item.description}
                  onChange={(e) => updateWorldReference(index, "description", e.target.value)}
                  placeholder="Description"
                  rows={2}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                  style={{ borderColor: "#dbc9b7" }}
                />

                <div className="rounded-xl border border-dashed p-2" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
                  <label className="block text-xs font-semibold" style={{ color: "#9a7a65" }}>
                    Upload reference image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onClick={(e) => {
                      (e.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(e) => setWorldReferenceFile(index, e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs"
                  />
                  {item.previewUrl ? (
                    <div className="relative mt-2 overflow-hidden rounded-lg border" style={{ borderColor: "#dbc9b7" }}>
                      <img
                        src={item.previewUrl}
                        alt={`World reference ${index + 1}`}
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setWorldReferenceFile(index, null)}
                        className="absolute right-2 top-2 rounded-full border p-1"
                        style={{ background: "#fdf8f3", borderColor: "#dbc9b7" }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {worldReferences.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeWorldReference(index)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                    style={{ border: "1px solid #dbc9b7", color: "#9a7a65" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                Character drawings
              </p>
              <button
                type="button"
                onClick={() => setDrawings((prev) => [...prev, { ...EMPTY_DRAWING }])}
                className={`${styles.btnOutline} px-3 py-1 text-xs`}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {drawings.map((item, index) => (
              <div key={`drawing-${index}`} className="space-y-2 rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
                <input
                  value={item.notes}
                  onChange={(e) => updateDrawing(index, "notes", e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                  style={{ borderColor: "#dbc9b7" }}
                />
                <textarea
                  value={item.description}
                  onChange={(e) => updateDrawing(index, "description", e.target.value)}
                  placeholder="Manual description fallback (optional)"
                  rows={2}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                  style={{ borderColor: "#dbc9b7" }}
                />

                <div className="rounded-xl border border-dashed p-2" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
                  <label className="block text-xs font-semibold" style={{ color: "#9a7a65" }}>
                    Upload character drawing
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onClick={(e) => {
                      (e.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(e) => setDrawingFile(index, e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs"
                  />
                  {item.previewUrl ? (
                    <div className="relative mt-2 overflow-hidden rounded-lg border" style={{ borderColor: "#dbc9b7" }}>
                      <img
                        src={item.previewUrl}
                        alt={`Character drawing ${index + 1}`}
                        className="h-32 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDrawingFile(index, null)}
                        className="absolute right-2 top-2 rounded-full border p-1"
                        style={{ background: "#fdf8f3", borderColor: "#dbc9b7" }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {drawings.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeDrawing(index)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                    style={{ border: "1px solid #dbc9b7", color: "#9a7a65" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div
            className="sticky bottom-2 z-10 rounded-xl border p-2 backdrop-blur"
            style={{ borderColor: "#dbc9b7", background: "rgb(252 246 239 / 0.92)" }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={submitRequest}
                disabled={!canSubmit}
                className={`${styles.btnInk} w-full justify-center px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {requestState === "loading" && requestAction === "create" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Test Request
              </button>
              <button
                type="button"
                onClick={regenerateImageOnly}
                disabled={!canRegenerate}
                className={`${styles.btnOutline} w-full justify-center px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {requestState === "loading" && requestAction === "regenerate" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Regenerate Image Only
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl p-4" style={{ border: "1px solid #dbc9b7", background: "#fcf6ef" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
              Response
            </h3>
            <button
              type="button"
              onClick={copyResponse}
              className={`${styles.btnOutline} px-3 py-1 text-xs`}
              disabled={!responseJson}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              {copyState === "done" ? "Copied" : "Copy JSON"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border p-2 text-xs" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
              <p className="font-semibold">State</p>
              <div className="mt-1">
                {requestState === "success" ? <StatusChip label="Success" tone="ok" /> : null}
                {requestState === "loading" ? <StatusChip label="Loading" tone="running" /> : null}
                {requestState === "error" ? <StatusChip label="Error" tone="error" /> : null}
                {requestState === "idle" ? <StatusChip label="Idle" tone="neutral" /> : null}
              </div>
            </div>
            <div className="rounded-xl border p-2 text-xs" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
              <p className="font-semibold">HTTP</p>
              <p className="mt-1">{responseStatus ?? "-"}</p>
            </div>
            <div className="rounded-xl border p-2 text-xs" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
              <p className="font-semibold">Source</p>
              <p className="mt-1">{orchestratorEnvelope?.backend_response ? "Main wrapper" : "Direct payload"}</p>
            </div>
            <div className="rounded-xl border p-2 text-xs" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
              <p className="font-semibold">Workflow</p>
              <p className="mt-1">{responseData?.workflow_used || "-"}</p>
            </div>
          </div>

          {currentJob ? (
            <a
              href={`/dashboard/jobs/${currentJob.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
              style={{ borderColor: "#dbc9b7", background: "#fdf8f3", color: "#2b180a" }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Job: <span className="font-mono text-[10px]" style={{ color: "#9a7a65" }}>{currentJob.id.slice(0, 8)}…</span>
            </a>
          ) : null}

          {orchestratorEnvelope?.backend_response ? (
            <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "#dbc9b7", background: "#fdf8f3", color: "#2b180a" }}>
              <p className="font-semibold" style={{ color: "#9a7a65" }}>
                Main orchestration details
              </p>
              <p className="mt-1">
                selected_action: <span className="font-semibold">{orchestratorEnvelope.selected_action || "-"}</span>
              </p>
              <p>
                selected_by: <span className="font-semibold">{orchestratorEnvelope.selected_by || "-"}</span>
              </p>
              <p>
                backend_endpoint:{" "}
                <span className="font-semibold">{orchestratorEnvelope.backend_endpoint || "-"}</span>
              </p>
              <p>
                backend_status_code:{" "}
                <span className="font-semibold">
                  {typeof orchestratorEnvelope.backend_status_code === "number"
                    ? orchestratorEnvelope.backend_status_code
                    : "-"}
                </span>
              </p>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "#f1b0b0", background: "#feefef", color: "#981b1b" }}>
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Request Error
              </div>
              <p className="mt-1">{errorMessage}</p>
            </div>
          ) : null}

          {responseData?.backstory ? (
            <div className="space-y-2">
              <div className="rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
                <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                  Character summary
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "#2b180a" }}>
                  {responseData.backstory?.name || "Unnamed"}
                </p>
                <p className="text-xs" style={{ color: "#7a5a45" }}>
                  Archetype: {responseData.backstory?.archetype || "-"}
                </p>
                <p className="mt-2 text-xs whitespace-pre-wrap" style={{ color: "#2b180a" }}>
                  {shortText(responseData.backstory?.narrative_backstory, 320)}
                </p>
              </div>
            </div>
          ) : null}

          {promptPreviewValue ? (
            <div className="rounded-xl border p-3" style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}>
              <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                Positive image prompt preview
              </p>
              <p className="mt-2 text-xs whitespace-pre-wrap" style={{ color: "#2b180a" }}>
                {shortText(promptPreviewValue, 320)}
              </p>
            </div>
          ) : null}

          {generatedImages.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                  Generated images
                </p>
                <StatusChip
                  label={`${generatedImages.length} image${generatedImages.length === 1 ? "" : "s"}`}
                  tone="ok"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {generatedImages.map((url, index) => (
                  <article
                    key={`${url}-${index}`}
                    className="rounded-xl border p-2"
                    style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveImageUrl(url)}
                      className="block w-full overflow-hidden rounded-lg border text-left"
                      style={{ borderColor: "#dbc9b7" }}
                      title="Open image preview"
                    >
                      <img
                        src={url}
                        alt={`Generated ${index + 1}`}
                        className="h-56 w-full bg-[#f6efe8] object-contain"
                      />
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveImageUrl(url)}
                        className={`${styles.btnOutline} px-2.5 py-1 text-[11px]`}
                      >
                        Preview
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${styles.btnOutline} inline-flex items-center gap-1 px-2.5 py-1 text-[11px]`}
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => copyImageUrl(url)}
                        className={`${styles.btnOutline} px-2.5 py-1 text-[11px]`}
                      >
                        {copiedImageUrl === url ? "Copied URL" : "Copy URL"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : requestState === "success" ? (
            <div
              className="rounded-xl border p-3 text-xs"
              style={{ borderColor: "#f1b0b0", background: "#feefef", color: "#981b1b" }}
            >
              Request succeeded but no generated image URL was returned.
            </div>
          ) : null}

          {drawingDescriptions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                Vision drawing descriptions
              </p>
              <ul className="space-y-2">
                {drawingDescriptions.map((desc, index) => (
                  <li
                    key={`desc-${index}`}
                    className="rounded-xl border p-2 text-xs whitespace-pre-wrap"
                    style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}
                  >
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#7a5a45" }}>
                      <ImageIcon className="h-3 w-3" /> Drawing {index + 1}
                    </div>
                    {desc}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {worldReferenceDescriptions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                Vision world-reference descriptions
              </p>
              <ul className="space-y-2">
                {worldReferenceDescriptions.map((desc, index) => (
                  <li
                    key={`world-desc-${index}`}
                    className="rounded-xl border p-2 text-xs whitespace-pre-wrap"
                    style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}
                  >
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#7a5a45" }}>
                      <CheckCircle2 className="h-3 w-3" /> World Ref {index + 1}
                    </div>
                    {desc}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
              Last payload
            </p>
            <pre
              className="max-h-44 overflow-auto rounded-xl border p-3 text-xs"
              style={{ borderColor: "#dbc9b7", background: "#fdf8f3", color: "#2b180a" }}
            >
              {payloadJson || "{}"}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
              Raw response JSON
            </p>
            <pre
              className="max-h-72 overflow-auto rounded-xl border p-3 text-xs"
              style={{ borderColor: "#dbc9b7", background: "#fdf8f3", color: "#2b180a" }}
            >
              {responseJson || "{}"}
            </pre>
          </div>
        </div>
      </div>

      {activeImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3"
          style={{ background: "rgb(15 10 7 / 0.75)" }}
        >
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setActiveImageUrl(null)}
            className="absolute inset-0"
          />
          <div
            className="relative z-10 w-full max-w-5xl rounded-2xl border p-3 md:p-4"
            style={{ borderColor: "#dbc9b7", background: "#fdf8f3" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: "#9a7a65" }}>
                Generated image preview
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyImageUrl(activeImageUrl)}
                  className={`${styles.btnOutline} px-3 py-1 text-xs`}
                >
                  {copiedImageUrl === activeImageUrl ? "Copied URL" : "Copy URL"}
                </button>
                <a
                  href={activeImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.btnOutline} inline-flex items-center gap-1 px-3 py-1 text-xs`}
                >
                  Open in new tab
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveImageUrl(null)}
                  className={`${styles.btnInk} px-3 py-1 text-xs`}
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              </div>
            </div>
            <div
              className="mt-3 overflow-auto rounded-xl border p-2"
              style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}
            >
              <img
                src={activeImageUrl}
                alt="Generated preview"
                className="max-h-[76vh] w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
