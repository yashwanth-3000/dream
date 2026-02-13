/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Loader2,
  Play,
  Sparkles,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Category = "KIDS" | "FAMILY" | "BEDTIME";

type GenerationFormState = {
  projectName: string;
  category: Category;
  outputType: "story" | "video";
  prompt: string;
  frontImage: File | null;
  backImage: File | null;
  styles: string[];
};

type StageId = "generate_prompts" | "generate_images" | "generate_video" | "finalize";
type StageStatus = "queued" | "running" | "done" | "failed";

type RuntimeState = Record<
  StageId,
  {
    status: StageStatus;
    startedAt?: number;
    endedAt?: number;
  }
>;

type LogLine = { ts: string; level: "info" | "success" | "warning"; message: string };

const FLOW: { id: StageId; label: string; icon: ReactNode }[] = [
  { id: "generate_prompts", label: "Generate Prompts", icon: <Wand2 className="h-4 w-4" /> },
  { id: "generate_images", label: "Generate Images", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "generate_video", label: "Generate Video", icon: <Video className="h-4 w-4" /> },
  { id: "finalize", label: "Finalize Job", icon: <Check className="h-4 w-4" /> },
];

const SCENE_POOL = [
  "https://images.unsplash.com/photo-1516627420156-8e4536971650?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900&auto=format&fit=crop&q=80",
];

function formatMs(ms: number) {
  const clamped = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Stepper({ currentStep }: { currentStep: 1 | 2 }) {
  const steps = [
    { id: 1, label: "Upload & Configure" },
    { id: 2, label: "Generate" },
  ] as const;

  return (
    <div className="flex items-center space-x-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex flex-1 items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 border-black text-xs font-black",
              currentStep > step.id
                ? "bg-black text-yellow-300"
                : currentStep === step.id
                  ? "bg-yellow-300 text-black"
                  : "bg-white text-black/50"
            )}
          >
            {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
          </div>
          <span
            className={cn(
              "text-xs font-black uppercase tracking-[0.12em]",
              currentStep >= step.id ? "text-black" : "text-black/50"
            )}
          >
            {step.label}
          </span>
          {index < steps.length - 1 ? <div className="h-[2px] flex-1 bg-black" /> : null}
        </div>
      ))}
    </div>
  );
}

function UploadCard({
  label,
  required,
  file,
  onFileSelect,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onFileSelect: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative cursor-pointer rounded-2xl border-2 border-black p-4 transition",
        file ? "bg-white" : "border-dashed bg-amber-50 hover:bg-amber-100"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
      />

      {file ? (
        <button
          type="button"
          aria-label="Remove file"
          onClick={(event) => {
            event.stopPropagation();
            onFileSelect(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="absolute right-2 top-2 rounded-full border border-black bg-white p-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-black bg-white">
          <Upload className="h-4.5 w-4.5" />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-black">
          {label}
          {required ? " *" : ""}
        </p>
        {preview ? (
          <div className="overflow-hidden rounded-xl border border-black">
            <img src={preview} alt={label} className="h-28 w-full object-cover" />
          </div>
        ) : (
          <p className="text-xs font-semibold text-black/60">Click to upload</p>
        )}
      </div>
    </div>
  );
}

function stageDuration(runtime: RuntimeState, id: StageId) {
  const st = runtime[id];
  if (!st.startedAt || !st.endedAt) return null;
  return Math.max(0, st.endedAt - st.startedAt);
}

function buildInitialRuntime(): RuntimeState {
  return {
    generate_prompts: { status: "queued" },
    generate_images: { status: "queued" },
    generate_video: { status: "queued" },
    finalize: { status: "queued" },
  };
}

export default function DashboardCreatePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<GenerationFormState>({
    projectName: "",
    category: "KIDS",
    outputType: "video",
    prompt: "",
    frontImage: null,
    backImage: null,
    styles: ["Fantasy"],
  });

  const [runtime, setRuntime] = useState<RuntimeState>(() => buildInitialRuntime());
  const [currentId, setCurrentId] = useState<StageId>("generate_prompts");
  const [openMap, setOpenMap] = useState<Record<StageId, boolean>>({
    generate_prompts: true,
    generate_images: false,
    generate_video: false,
    finalize: false,
  });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [videoReady, setVideoReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [complete, setComplete] = useState(false);
  const timersRef = useRef<number[]>([]);

  const isStep1Valid = Boolean(form.projectName.trim() && form.prompt.trim());

  const addLog = (level: LogLine["level"], message: string) => {
    setLogs((prev) => [...prev, { ts: formatClock(Date.now()), level, message }]);
  };

  const resetPipeline = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setRuntime(buildInitialRuntime());
    setCurrentId("generate_prompts");
    setOpenMap({ generate_prompts: true, generate_images: false, generate_video: false, finalize: false });
    setLogs([]);
    setGeneratedImages([]);
    setVideoReady(false);
    setFailed(false);
    setComplete(false);
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const markRunning = (id: StageId) => {
    setCurrentId(id);
    setRuntime((prev) => ({
      ...prev,
      [id]: {
        status: "running",
        startedAt: prev[id].startedAt ?? Date.now(),
      },
    }));
    setOpenMap((prev) => ({ ...prev, [id]: true }));
  };

  const markDone = (id: StageId) => {
    setRuntime((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: "done",
        endedAt: Date.now(),
      },
    }));
  };

  const startGeneration = () => {
    if (!isStep1Valid) return;
    resetPipeline();
    setCurrentStep(2);

    markRunning("generate_prompts");
    addLog("info", "Building kid-safe prompt variations.");

    timersRef.current.push(
      window.setTimeout(() => {
        markDone("generate_prompts");
        addLog("success", "Prompt pack ready.");

        markRunning("generate_images");
        addLog("info", "Generating storyboard frames.");

        [0, 1, 2, 3].forEach((idx) => {
          timersRef.current.push(
            window.setTimeout(() => {
              setGeneratedImages((prev) => [...prev, SCENE_POOL[idx % SCENE_POOL.length]]);
              addLog("info", `Scene frame ${idx + 1}/4 ready.`);
            }, 900 + idx * 700)
          );
        });

        timersRef.current.push(
          window.setTimeout(() => {
            markDone("generate_images");
            addLog("success", "All scene frames generated.");

            markRunning("generate_video");
            addLog("info", "Rendering short animated preview.");

            timersRef.current.push(
              window.setTimeout(() => {
                setVideoReady(true);
                markDone("generate_video");
                addLog("success", "Video preview generated.");

                markRunning("finalize");
                addLog("info", "Saving job and preparing dashboard view.");

                timersRef.current.push(
                  window.setTimeout(() => {
                    markDone("finalize");
                    addLog("success", "Generation complete.");
                    setComplete(true);
                    setCurrentId("finalize");
                  }, 1200)
                );
              }, 2200)
            );
          }, 4200)
        );
      }, 1400)
    );
  };

  const toggleStyle = (value: string) => {
    setForm((prev) => {
      const exists = prev.styles.includes(value);
      if (exists && prev.styles.length === 1) return prev;
      return {
        ...prev,
        styles: exists ? prev.styles.filter((s) => s !== value) : [...prev.styles, value],
      };
    });
  };

  const overallCompleted = FLOW.filter((s) => runtime[s.id].status === "done").length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 rounded-3xl border border-border/60 bg-white/80 p-4 shadow-sm backdrop-blur md:p-5 dark:border-white/10 dark:bg-[#101010]/95">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">New Generation</h2>
          <p className="text-sm text-muted-foreground">Create new story/video jobs for Dream and track progress live.</p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted micro-btn"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="rounded-2xl border border-black/80 bg-yellow-200/60 p-3">
        <Stepper currentStep={currentStep} />
      </div>

      <AnimatePresence mode="wait">
        {currentStep === 1 ? (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-black/70">Project Name</label>
                <input
                  value={form.projectName}
                  onChange={(event) => setForm((prev) => ({ ...prev, projectName: event.target.value }))}
                  placeholder="Moonlight dragon adventure"
                  className="w-full rounded-xl border border-black bg-white px-3 py-2.5 text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-black/70">Output Type</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "story", label: "Story" },
                    { value: "video", label: "Story + Video" },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, outputType: item.value }))}
                      className={cn(
                        "rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.08em] micro-btn",
                        form.outputType === item.value
                          ? "border-black bg-yellow-300 text-black"
                          : "border-black/60 bg-white text-black/80 hover:bg-pink-100"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-black/70">Prompt</label>
              <textarea
                rows={5}
                value={form.prompt}
                onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
                placeholder="A brave kid and a tiny dragon build a flying library for bedtime stories..."
                className="w-full rounded-xl border border-black bg-white px-3 py-3 text-sm outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <UploadCard
                label="Character Reference"
                required
                file={form.frontImage}
                onFileSelect={(file) => setForm((prev) => ({ ...prev, frontImage: file }))}
              />
              <UploadCard
                label="World Reference"
                file={form.backImage}
                onFileSelect={(file) => setForm((prev) => ({ ...prev, backImage: file }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-black/70">Style Tags</label>
              <div className="flex flex-wrap gap-2">
                {["Fantasy", "Cartoon", "Soft Colors", "Storybook", "Adventure"].map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.08em] micro-btn",
                      form.styles.includes(style)
                        ? "border-black bg-yellow-300 text-black"
                        : "border-black/60 bg-white text-black/80 hover:bg-pink-100"
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-black/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-black/60">Generation Profile</p>
                <p className="text-lg font-black text-black">
                  {form.outputType === "video" ? "Story + Video" : "Story Only"}
                </p>
                <p className="text-xs font-semibold text-black/60">{form.styles.length} style tags selected.</p>
              </div>
              <button
                type="button"
                onClick={startGeneration}
                disabled={!isStep1Valid}
                className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-black uppercase tracking-[0.1em] text-yellow-300 transition disabled:cursor-not-allowed disabled:opacity-45 micro-btn"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-4 lg:grid-cols-[300px_1fr]"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-black bg-yellow-100 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em]">Queue</p>
              </div>

              <div className="space-y-2">
                {FLOW.map((stage) => {
                  const st = runtime[stage.id].status;
                  const active = stage.id === currentId;
                  const tone =
                    st === "done"
                      ? "bg-emerald-100"
                      : st === "running"
                        ? "bg-yellow-200"
                        : st === "failed"
                          ? "bg-rose-100"
                          : "bg-white";
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setOpenMap((prev) => ({ ...prev, [stage.id]: !prev[stage.id] }))}
                      className={cn(
                        "w-full rounded-xl border-2 border-black p-3 text-left transition micro-card",
                        tone,
                        active ? "ring-2 ring-black/20" : "hover:bg-pink-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-white">
                          {st === "done" ? <CheckCircle2 className="h-4.5 w-4.5" /> : st === "running" ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : stage.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-black uppercase tracking-[0.1em]">{stage.label}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-black/60">
                            {st}
                            {stageDuration(runtime, stage.id) ? ` · ${formatMs(stageDuration(runtime, stage.id) as number)}` : ""}
                          </p>
                        </div>
                        {openMap[stage.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border-2 border-black bg-white p-3 micro-card">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-black/60">Overall</p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400"
                    initial={{ width: "0%" }}
                    animate={{ width: `${(overallCompleted / FLOW.length) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-black text-black">
                  {overallCompleted}/{FLOW.length} complete
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {failed ? (
                <div className="rounded-2xl border-2 border-rose-500 bg-rose-100 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.1em]">Generation failed</p>
                      <p className="mt-1 text-sm text-black/70">Try again with a shorter prompt or fewer style tags.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {FLOW.map((stage) => {
                if (!openMap[stage.id]) return null;
                const st = runtime[stage.id].status;
                return (
                  <div key={stage.id} className="rounded-2xl border border-black/70 bg-white p-4 micro-card">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.12em]">{stage.label}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/60">{st}</p>
                    </div>

                    {stage.id === "generate_prompts" ? (
                      <div className="space-y-2">
                        {logs
                          .filter((line) => line.message.toLowerCase().includes("prompt"))
                          .slice(-3)
                          .map((line) => (
                            <div key={`${line.ts}-${line.message}`} className="rounded-lg border border-black/70 bg-black p-2 text-xs font-mono text-green-300">
                              [{line.ts}] {line.message}
                            </div>
                          ))}
                        {!logs.some((line) => line.message.toLowerCase().includes("prompt")) ? (
                          <p className="text-xs font-semibold text-black/60">Waiting to start...</p>
                        ) : null}
                      </div>
                    ) : null}

                    {stage.id === "generate_images" ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[0, 1, 2, 3].map((idx) => {
                          const url = generatedImages[idx];
                          return (
                            <div key={`scene-${idx}`} className="aspect-[3/4] overflow-hidden rounded-lg border border-black/70 bg-amber-50">
                              {url ? <img src={url} alt={`Scene ${idx + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {stage.id === "generate_video" ? (
                      <div className="overflow-hidden rounded-xl border border-black/70 bg-black">
                        <div className="aspect-video">
                          {videoReady ? (
                            <video className="h-full w-full object-cover" controls autoPlay muted loop playsInline src="https://cdn.coverr.co/videos/coverr-flying-over-forest-1574/1080p.mp4" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-yellow-300">
                              <div className="text-center">
                                <Play className="mx-auto h-6 w-6" />
                                <p className="mt-2 text-xs font-black uppercase tracking-[0.1em]">Rendering preview...</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {stage.id === "finalize" ? (
                      <div className="rounded-xl border border-black/70 bg-emerald-50 p-3">
                        <p className="text-sm font-semibold text-black">Saving job in dashboard and preparing links.</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="rounded-2xl border border-black/70 bg-white p-4 micro-card">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs font-black uppercase tracking-[0.1em]">Live Logs</p>
                </div>
                <div className="max-h-44 space-y-2 overflow-auto">
                  {logs.length === 0 ? (
                    <p className="text-xs font-semibold text-black/60">No logs yet.</p>
                  ) : (
                    logs.slice(-12).map((line) => (
                      <div key={`${line.ts}-${line.message}`} className="rounded-lg border border-black/20 bg-muted/40 px-2 py-1.5 text-xs">
                        <span className="font-mono text-black/60">{line.ts}</span>{" "}
                        <span className="font-semibold">{line.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => setCurrentStep(1)} className="rounded-full border border-black px-4 py-2 text-xs font-black uppercase tracking-[0.08em] hover:bg-muted micro-btn">
                  Back
                </button>
                <button
                  type="button"
                  onClick={startGeneration}
                  disabled={!isStep1Valid}
                  className="rounded-full bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-yellow-300 disabled:opacity-40 micro-btn"
                >
                  Retry
                </button>
                {complete ? (
                  <Link href="/dashboard/jobs" className="rounded-full border border-black bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] micro-btn">
                    Open Jobs
                  </Link>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
