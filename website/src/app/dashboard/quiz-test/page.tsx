"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  RotateCw,
  Send,
  Sparkles,
} from "lucide-react";

import { createJob, type Job } from "@/lib/jobs";
import styles from "../dashboard.module.css";
import chatStyles from "../../chat/chat-page.module.css";

type ApiTarget = "main";
type RequestState = "idle" | "loading" | "success" | "error";
type HealthState = "idle" | "loading" | "ok" | "error";
type Difficulty = "" | "easy" | "medium" | "hard";

type QuizQuestion = {
  question_number?: number;
  question?: string;
  options?: string[];
  correct_option_index?: number;
  hints?: string[];
  correct_explanation?: string;
  learning_goal?: string;
};

type QuizResponse = {
  workflow_used?: string;
  quiz?: {
    quiz_title?: string;
    instructions?: string;
    questions?: QuizQuestion[];
  };
  warnings?: string[];
  generation_sources?: Record<string, string>;
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
  data?: unknown;
};

type ParsedProgressEvent = {
  stage: string;
  message: string;
  rendered: string;
  data?: unknown;
};

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
  const questionNumber =
    typeof payload.question_number === "number"
      ? Number(payload.question_number)
      : Number.isFinite(Number(payload.question_number))
        ? Number(payload.question_number)
        : null;

  if (questionNumber !== null) {
    key += `:q:${questionNumber}`;
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
  const eventData = eventObj.data !== undefined ? eventObj.data : embedded.data;

  return {
    stage,
    message,
    rendered: `[${stage.replace(/_/g, " ")}] ${message}`,
    data: eventData,
  };
}

function unwrapQuizPayload(payload: unknown): unknown {
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

export default function DashboardQuizTestPage() {
  const apiTarget: ApiTarget = "main";

  const [prompt, setPrompt] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("");
  const [questionCount, setQuestionCount] = useState(5);

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
  const [openTimelineJsonByKey, setOpenTimelineJsonByKey] = useState<Record<string, boolean>>({});
  const [openLogJsonById, setOpenLogJsonById] = useState<Record<number, boolean>>({});
  const [currentJob, setCurrentJob] = useState<Job | null>(null);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [wrongAttempts, setWrongAttempts] = useState<Record<number, number>>({});
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<
    Record<number, { state: "correct" | "wrong"; message: string }>
  >({});

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

  const workflowPayload = useMemo(() => unwrapQuizPayload(responseBody), [responseBody]);
  const responseData =
    workflowPayload && typeof workflowPayload === "object" && workflowPayload !== null
      ? (workflowPayload as QuizResponse)
      : null;

  const quizQuestions = useMemo(() => responseData?.quiz?.questions ?? [], [responseData?.quiz?.questions]);
  const warnings = useMemo(() => responseData?.warnings ?? [], [responseData?.warnings]);
  const generationSources = useMemo(() => responseData?.generation_sources ?? {}, [responseData?.generation_sources]);

  const correctCount = useMemo(() => {
    return quizQuestions.reduce((count, question, index) => {
      const qNo = Number(question.question_number ?? index + 1);
      const selected = selectedAnswers[qNo];
      if (selected === undefined) return count;
      return selected === Number(question.correct_option_index ?? -1) ? count + 1 : count;
    }, 0);
  }, [quizQuestions, selectedAnswers]);

  const canSubmit = requestState !== "loading" && prompt.trim().length > 0;
  const hasActiveRun = requestState !== "idle" || liveLogs.length > 0;

  const activeLoadingStageKey = useMemo(() => {
    const latest = liveTimelineSteps[liveTimelineSteps.length - 1];
    if (!latest) return "in_progress";
    const raw = (latest.stageKey || latest.key || "").trim();
    return raw || "in_progress";
  }, [liveTimelineSteps]);

  const checkHealth = useCallback(async () => {
    setHealthState("loading");
    setHealthMessage("");
    try {
      const response = await fetch(`/api/quiz-test?target=${apiTarget}`, { method: "GET" });
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

  function pushLiveLog(level: LiveLogLevel, source: string, message: string, data?: unknown) {
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

  function upsertTimelineStep(
    key: string,
    title: string,
    detail: string,
    data?: unknown,
    stageKey?: string
  ) {
    setLiveTimelineSteps((prev) => {
      const existingIndex = prev.findIndex((step) => step.key === key);
      if (existingIndex < 0) {
        return [...prev, { key, title, detail, stageKey, data }];
      }

      const next = [...prev];
      const current = next[existingIndex];
      next[existingIndex] = {
        ...current,
        title,
        detail,
        stageKey: stageKey ?? current.stageKey,
        data: data ?? current.data,
      };
      return next;
    });
  }

  function pushTimelineProgress(progressEvent: ParsedProgressEvent) {
    const stage = progressEvent.stage || "progress";
    const message = progressEvent.message || "Progress update received.";
    const timelineKey = buildProgressTimelineKey(stage, progressEvent.data);
    upsertTimelineStep(
      timelineKey,
      formatStageTitle(stage),
      message,
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

    const backendResponse = "backend_response" in event ? event.backend_response : event.payload;

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
    setOpenTimelineJsonByKey({});
    setOpenLogJsonById({});
    setSelectedAnswers({});
    setWrongAttempts({});
    setFeedbackByQuestion({});

    try {
      const payload: Record<string, unknown> = {
        user_prompt: prompt.trim(),
        question_count: Math.max(1, Math.min(questionCount, 10)),
      };
      if (storyTitle.trim()) payload.story_title = storyTitle.trim();
      if (storyText.trim()) payload.story_text = storyText.trim();
      if (ageBand.trim()) payload.age_band = ageBand.trim();
      if (difficulty) payload.difficulty = difficulty;

      setLastPayload(payload);
      pushLiveLog("info", "ui", "Request payload prepared. Opening stream...");

      let jobIdParam = "";
      try {
        const job = await createJob({
          type: "quiz",
          title: prompt.trim().slice(0, 80) || "Quiz Generation",
          user_prompt: prompt.trim(),
          input_payload: payload,
          triggered_by: "quiz-test",
          engine: "a2a-maf-quiz-maker",
        });
        setCurrentJob(job);
        jobIdParam = `&job_id=${encodeURIComponent(job.id)}`;
        pushLiveLog("info", "ui", `Job created: ${job.id}`);
      } catch {
        setCurrentJob(null);
      }

      const response = await fetch(`/api/quiz-test?target=${apiTarget}&stream=1${jobIdParam}`, {
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
            typeof eventObj.message === "string" ? eventObj.message : `Update received (${eventType}).`;
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
      setRequestState("error");
    }
  }

  function chooseOption(question: QuizQuestion, optionIndex: number, fallbackIndex: number) {
    const qNo = Number(question.question_number ?? fallbackIndex + 1);
    const correctIndex = Number(question.correct_option_index ?? -1);

    setSelectedAnswers((prev) => ({ ...prev, [qNo]: optionIndex }));

    if (optionIndex === correctIndex) {
      const explanation =
        (question.correct_explanation || "").trim() ||
        "Correct. This option best matches the key clue in the question.";
      setFeedbackByQuestion((prev) => ({
        ...prev,
        [qNo]: {
          state: "correct",
          message: explanation,
        },
      }));
      return;
    }

    const nextAttempt = (wrongAttempts[qNo] ?? 0) + 1;
    setWrongAttempts((prev) => ({ ...prev, [qNo]: nextAttempt }));

    const hints = Array.isArray(question.hints) ? question.hints : [];
    const hintIndex = Math.max(0, Math.min(nextAttempt - 1, Math.max(0, hints.length - 1)));
    const hint = hints[hintIndex] || "Try again. Focus on the main clue in the question.";

    setFeedbackByQuestion((prev) => ({
      ...prev,
      [qNo]: {
        state: "wrong",
        message: hint,
      },
    }));
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
          <Brain className="size-6" /> Quiz API Test
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
          <StatusChip label="Main -> Quiz via A2A" tone="ok" />
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
                <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Quiz prompt</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="mt-1 h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  placeholder="Create a children quiz about kindness and teamwork"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Story title (optional)</label>
                  <input
                    value={storyTitle}
                    onChange={(event) => setStoryTitle(event.target.value)}
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

              <div>
                <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Story text (optional)</label>
                <textarea
                  value={storyText}
                  onChange={(event) => setStoryText(event.target.value)}
                  className="mt-1 h-28 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  placeholder="Paste story text here if you want story-based quiz generation"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  >
                    <option value="">Auto</option>
                    <option value="easy">easy</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#9a7a65" }}>Question count</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={questionCount}
                    onChange={(event) => setQuestionCount(Number(event.target.value || 5))}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "#dbc9b7", background: "#fffaf4", color: "#2b180a" }}
                  />
                </div>
              </div>
            </div>
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
                        <div className={`${chatStyles.bubble} ${chatStyles.bubbleAi}`}>
                          Quiz response ready. Scroll down to test question options with hints and explanations.
                        </div>
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
                    {orchestratorEnvelope.backend_endpoint.includes("/a2a") ? "yes (MAF quiz backend)" : "no"}
                  </strong>
                </p>
              </div>
            ) : null}
          </div>

          {responseData?.quiz ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                Quiz
              </h3>
              <p className="mt-2 text-sm font-semibold" style={{ color: "#2b180a" }}>
                {responseData.quiz.quiz_title || "Untitled Quiz"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "#9a7a65" }}>
                {responseData.quiz.instructions || "No instructions provided."}
              </p>
              <div className="mt-2">
                <StatusChip label={`Score: ${correctCount}/${quizQuestions.length || 0}`} tone={correctCount > 0 ? "ok" : "neutral"} />
              </div>
            </div>
          ) : null}

          {quizQuestions.length > 0 ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#dbc9b7", background: "#fcf6ef" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>
                Quiz Runner
              </h3>
              <p className="mt-1 text-xs" style={{ color: "#9a7a65" }}>
                Select an option. Wrong answer shows hint, correct answer shows explanation.
              </p>

              <div className="mt-3 space-y-3">
                {quizQuestions.map((question, index) => {
                  const qNo = Number(question.question_number ?? index + 1);
                  const selected = selectedAnswers[qNo];
                  const feedback = feedbackByQuestion[qNo];
                  const correctIndex = Number(question.correct_option_index ?? -1);
                  const options = Array.isArray(question.options) ? question.options : [];

                  return (
                    <motion.article
                      key={`quiz-question-${qNo}`}
                      className="rounded-xl border p-3"
                      style={{ borderColor: "#dbc9b7", background: "#fffaf4" }}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.25 }}
                      transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.15) }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip label={`Question ${qNo}`} tone="neutral" />
                        {question.learning_goal ? <StatusChip label={question.learning_goal} tone="neutral" /> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "#2b180a" }}>
                        {question.question || "Question text unavailable"}
                      </p>

                      <div className="mt-3 grid gap-2">
                        {options.map((option, optionIndex) => {
                          const isSelected = selected === optionIndex;
                          const isCorrect = optionIndex === correctIndex;
                          const showCorrect = feedback?.state === "correct" && isCorrect;
                          const showWrong = feedback?.state === "wrong" && isSelected;

                          return (
                            <button
                              key={`q-${qNo}-opt-${optionIndex}`}
                              type="button"
                              className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition"
                              style={{
                                borderColor: showCorrect
                                  ? "#9fddb0"
                                  : showWrong
                                    ? "#f1b0b0"
                                    : isSelected
                                      ? "#dbc9b7"
                                      : "#dbc9b7",
                                background: showCorrect
                                  ? "#edf9ee"
                                  : showWrong
                                    ? "#feefef"
                                    : isSelected
                                      ? "#f7efe4"
                                      : "#fffaf4",
                                color: showCorrect
                                  ? "#1f6a32"
                                  : showWrong
                                    ? "#981b1b"
                                    : "#2b180a",
                              }}
                              onClick={() => chooseOption(question, optionIndex, index)}
                            >
                              <span className="mr-2 font-semibold" style={{ color: "#7a5a45" }}>
                                {String.fromCharCode(65 + optionIndex)}.
                              </span>
                              {option}
                            </button>
                          );
                        })}
                      </div>

                      {feedback ? (
                        <div
                          className="mt-3 rounded-lg border px-3 py-2 text-xs"
                          style={{
                            borderColor: feedback.state === "correct" ? "#9fddb0" : "#edd9a7",
                            background: feedback.state === "correct" ? "#edf9ee" : "#fff7e9",
                            color: feedback.state === "correct" ? "#1f6a32" : "#8a5a00",
                          }}
                        >
                          <p className="font-semibold">
                            {feedback.state === "correct" ? "Correct explanation" : "Hint"}
                          </p>
                          <p className="mt-1">{feedback.message}</p>
                        </div>
                      ) : null}
                    </motion.article>
                  );
                })}
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
    </section>
  );
}
