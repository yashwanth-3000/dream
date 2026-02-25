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
  Clock3,
  Image as ImageIcon,
  Loader2,
  Mic2,
  Music2,
  Pause,
  Play,
  PlayCircle,
  Sparkles,
  Upload,
  Video,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  GAMEPLAY_BACKGROUNDS as BRAIN_ROT_BACKGROUNDS,
  GAMEPLAY_CATEGORY_OPTIONS as BRAIN_ROT_CATEGORY_OPTIONS,
  VIDEO_MODE_OPTIONS as VIDEO_TYPE_OPTIONS,
  type GameplayCategory,
  type VideoGenerationType,
} from "@/lib/video-generation-options";

type Category = "KIDS" | "FAMILY" | "BEDTIME";
type OutputType = "story" | "video";
type VideoType = VideoGenerationType;
type BrainRotCategory = GameplayCategory;

type GenerationFormState = {
  projectName: string;
  category: Category;
  outputType: OutputType;
  videoType: VideoType;
  prompt: string;
  frontImage: File | null;
  backImage: File | null;
  styles: string[];
  brainRotCategory: BrainRotCategory;
  brainRotBackgroundId: string;
  selectedVoiceId: string;
  selectedMusicId: string;
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

type VoiceOption = {
  id: string;
  name: string;
  provider: string;
  accentClass: string;
  sampleUrl?: string;
};

type MusicOption = {
  id: string;
  name: string;
  tags: string;
  sampleUrl?: string;
};

const FLOW: { id: StageId; label: string; icon: ReactNode }[] = [
  { id: "generate_prompts", label: "Prompt Processing", icon: <Wand2 className="h-4 w-4" /> },
  { id: "generate_images", label: "Image Generation", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "generate_video", label: "Video Synthesis", icon: <Video className="h-4 w-4" /> },
  { id: "finalize", label: "Finalize Output", icon: <Check className="h-4 w-4" /> },
];

const SCENE_POOL = [
  "https://images.unsplash.com/photo-1516627420156-8e4536971650?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900&auto=format&fit=crop&q=80",
];

const CATEGORY_OPTIONS: { value: Category; label: string; description: string }[] = [
  { value: "KIDS", label: "Kids", description: "Age 4–7" },
  { value: "FAMILY", label: "Family", description: "All ages" },
  { value: "BEDTIME", label: "Bedtime", description: "Calm pacing" },
];

const STYLE_OPTIONS = [
  "Cinematic",
  "Storybook",
  "Cartoon",
  "4K Realistic",
  "Anime",
  "Playground",
  "Line Art",
  "Neon",
];

const VOICE_OPTIONS: VoiceOption[] = [
  { id: "alloy", name: "Alloy", provider: "OpenAI Voice", accentClass: "from-[#ffb36b] to-[#fb7185]", sampleUrl: "https://cdn.openai.com/API/docs/audio/alloy.wav" },
  { id: "echo", name: "Echo", provider: "OpenAI Voice", accentClass: "from-[#9ae66e] to-[#facc15]", sampleUrl: "https://cdn.openai.com/API/docs/audio/echo.wav" },
  { id: "fable", name: "Fable", provider: "OpenAI Voice", accentClass: "from-[#f43f5e] to-[#60a5fa]", sampleUrl: "https://cdn.openai.com/API/docs/audio/fable.wav" },
  { id: "onyx", name: "Onyx", provider: "OpenAI Voice", accentClass: "from-[#86efac] to-[#818cf8]", sampleUrl: "https://cdn.openai.com/API/docs/audio/onyx.wav" },
];

const MUSIC_OPTIONS: MusicOption[] = [
  { id: "else_paris", name: "Else - Paris", tags: "Suspense, Epic", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "fur_elise", name: "Fur Elise", tags: "Classical, Piano", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "prelude_minor", name: "Prelude in E minor", tags: "Piano, Classical", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "eureka", name: "Eureka", tags: "Violin, Epic", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { id: "tension_air", name: "Tension in the Air", tags: "Serious, Dark", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { id: "winter", name: "Winter", tags: "Classical, Epic", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  { id: "bladerunner_2049", name: "Bladerunner 2049", tags: "Futuristic, Popular", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
  { id: "snowfall", name: "Snowfall", tags: "Calm, Viral", sampleUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
];

const DEFAULT_BRAIN_ROT_PREVIEW = "https://cdn.coverr.co/videos/coverr-flying-over-forest-1574/1080p.mp4";

const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  queued: "Queued",
  running: "Running…",
  done: "Complete",
  failed: "Failed",
};

const ease = [0.22, 1, 0.36, 1] as const;

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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

function Stepper({ currentStep }: { currentStep: 1 | 2 }) {
  const steps = [
    { id: 1, label: "Configure" },
    { id: 2, label: "Generate" },
  ] as const;

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => {
        const isComplete = currentStep > step.id;
        const isActive = currentStep === step.id;

        return (
          <div key={step.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                isComplete
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isActive
                    ? "border-2 border-primary/50 bg-primary/10 text-primary"
                    : "border border-border/70 bg-muted/30 text-muted-foreground"
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : step.id}
            </div>
            <p
              className={cn(
                "text-xs font-semibold",
                isActive || isComplete ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </p>
            {index < steps.length - 1 && (
              <div className="h-px flex-1 bg-border/60" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadCard({
  label,
  hint,
  file,
  onFileSelect,
}: {
  label: string;
  hint: string;
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
        "group relative cursor-pointer overflow-hidden rounded-2xl border p-3 transition-all duration-200",
        file
          ? "border-border/70 bg-muted/10"
          : "border-dashed border-border/60 bg-muted/10 hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
      />

      {file && (
        <button
          type="button"
          aria-label="Remove file"
          onClick={(e) => {
            e.stopPropagation();
            onFileSelect(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="space-y-2.5">
        <div className="flex size-8 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground">
          <Upload className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        {preview ? (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <img src={preview} alt={label} className="h-24 w-full object-cover" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 bg-background/40 py-3 text-center">
            <p className="text-[11px] text-muted-foreground/70">Click to upload</p>
          </div>
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

function StageStatusBadge({ status }: { status: StageStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        status === "done" && "border-green-200 bg-green-50 text-green-700 dark:border-green-800/60 dark:bg-green-900/20 dark:text-green-400",
        status === "running" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-400",
        status === "failed" && "border-red-200 bg-red-50 text-red-600 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-400",
        status === "queued" && "border-border/60 bg-muted/40 text-muted-foreground",
      )}
    >
      {status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {status === "done" && <CheckCircle2 className="h-2.5 w-2.5" />}
      {STAGE_STATUS_LABEL[status]}
    </span>
  );
}

function WaveformBars({ playing }: { playing: boolean }) {
  return (
    <span className="inline-flex items-end gap-px">
      {[6, 10, 8, 12, 9].map((h, i) => (
        <motion.span
          key={i}
          className="inline-block w-[2px] rounded-full bg-current"
          animate={playing ? { height: [h * 0.4, h, h * 0.55, h * 0.9, h * 0.65] } : { height: 3 }}
          transition={playing ? { repeat: Infinity, duration: 0.5 + i * 0.08, ease: "easeInOut", delay: i * 0.06 } : { duration: 0.25 }}
          style={{ height: 3 }}
        />
      ))}
    </span>
  );
}

export default function DashboardCreatePage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<GenerationFormState>({
    projectName: "",
    category: "KIDS",
    outputType: "video",
    videoType: "normal",
    prompt: "",
    frontImage: null,
    backImage: null,
    styles: ["Cinematic"],
    brainRotCategory: "minecraft",
    brainRotBackgroundId: "mc_1",
    selectedVoiceId: "echo",
    selectedMusicId: "bladerunner_2049",
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
  const stagePanelRefs = useRef<Partial<Record<StageId, HTMLDivElement | null>>>({});
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const backgroundOptions = useMemo(
    () => BRAIN_ROT_BACKGROUNDS[form.brainRotCategory],
    [form.brainRotCategory],
  );

  const activeFlow = useMemo(
    () => (form.outputType === "story" ? FLOW.filter((s) => s.id !== "generate_video") : FLOW),
    [form.outputType],
  );

  const hasVoiceAndMusicSetup =
    form.outputType !== "video" || Boolean(form.selectedVoiceId && form.selectedMusicId);

  const hasBrainRotBackgroundSetup =
    form.outputType !== "video" || form.videoType !== "gameplay" || Boolean(form.brainRotBackgroundId);

  const isStep1Valid = Boolean(
    form.projectName.trim() &&
      form.prompt.trim() &&
      hasVoiceAndMusicSetup &&
      hasBrainRotBackgroundSetup,
  );

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
    return () => { timersRef.current.forEach((id) => window.clearTimeout(id)); };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (currentStep !== 2) return;
    const el = stagePanelRefs.current[currentId];
    if (!el) return;
    // small delay so AnimatePresence has time to open the panel first
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [currentId, currentStep]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onEnded = () => { setPlayingId(null); setAudioProgress(0); };
    const onTimeUpdate = () => { setAudioProgress(audio.currentTime / (audio.duration || 1)); };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  const togglePlay = (id: string, src: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.src = src;
      audio.currentTime = 0;
      setAudioProgress(0);
      audio.play().catch(() => {});
      setPlayingId(id);
    }
  };

  const markRunning = (id: StageId) => {
    setCurrentId(id);
    setRuntime((prev) => ({ ...prev, [id]: { status: "running", startedAt: prev[id].startedAt ?? Date.now() } }));
    setOpenMap({ generate_prompts: false, generate_images: false, generate_video: false, finalize: false, [id]: true });
  };

  const markDone = (id: StageId) => {
    setRuntime((prev) => ({ ...prev, [id]: { ...prev[id], status: "done", endedAt: Date.now() } }));
  };

  const runFinalize = () => {
    markRunning("finalize");
    addLog("info", "Saving job and preparing dashboard view.");
    timersRef.current.push(
      window.setTimeout(() => {
        markDone("finalize");
        addLog("success", "Generation complete.");
        setComplete(true);
        setCurrentId("finalize");
      }, 1200),
    );
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
            }, 900 + idx * 700),
          );
        });

        timersRef.current.push(
          window.setTimeout(() => {
            markDone("generate_images");
            addLog("success", "All scene frames generated.");

            if (form.outputType === "story") {
              addLog("info", "Story-only output selected. Skipping video synthesis.");
              runFinalize();
              return;
            }

            markRunning("generate_video");
            addLog("info", form.videoType === "gameplay"
              ? "Compositing background clip, voice, captions, and music."
              : "Rendering narrative video from prompt and selected style."
            );

            timersRef.current.push(
              window.setTimeout(() => {
                setVideoReady(true);
                markDone("generate_video");
                addLog("success", "Video preview generated.");
                runFinalize();
              }, 2200),
            );
          }, 4200),
        );
      }, 1400),
    );
  };

  const toggleStyle = (value: string) => {
    setForm((prev) => {
      const exists = prev.styles.includes(value);
      if (exists && prev.styles.length === 1) return prev;
      return { ...prev, styles: exists ? prev.styles.filter((s) => s !== value) : [...prev.styles, value] };
    });
  };

  const overallCompleted = activeFlow.filter((s) => runtime[s.id].status === "done").length;
  const overallProgress = (overallCompleted / activeFlow.length) * 100;
  const voiceIsPlaying = playingId !== null && VOICE_OPTIONS.some((v) => v.id === playingId);
  const musicIsPlaying = playingId !== null && MUSIC_OPTIONS.some((m) => m.id === playingId);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 rounded-3xl border border-border/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#101010]/95 md:p-6">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Creation Studio</p>
          <h2 className="mt-0.5 text-2xl font-black tracking-tight text-foreground md:text-3xl">Create New Dream</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your output, choose options, and launch a generation pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted dark:bg-[#1a1a1a] dark:hover:bg-[#222] micro-btn"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>

      {/* ── Stepper ── */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 dark:border-white/8 dark:bg-white/[0.03]">
        <Stepper currentStep={currentStep} />
      </div>

      {/* ── Steps ── */}
      <AnimatePresence mode="wait">

        {/* ════════════════ STEP 1: CONFIGURE ════════════════ */}
        {currentStep === 1 ? (
          <motion.div
            key="step-configure"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease }}
            className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]"
          >
            {/* ── Left column ── */}
            <div className="space-y-4">

              {/* ① Basics */}
              <div className="rounded-2xl border border-border bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]">
                <div className="flex items-center gap-3 border-b border-border px-5 py-4 dark:border-white/8">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
                  <p className="text-sm font-semibold text-foreground">Output &amp; Format</p>
                </div>
                <div className="space-y-5 p-5">

                  {/* Output type — large visual cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { value: "story", label: "Story", desc: "Illustrated scenes & narration", icon: <ImageIcon className="h-5 w-5" /> },
                        { value: "video", label: "Video", desc: "Full video with voice & music", icon: <Video className="h-5 w-5" /> },
                      ] as const
                    ).map((item) => {
                      const sel = form.outputType === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, outputType: item.value }))}
                          className={cn(
                            "group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-200 micro-btn",
                            sel
                              ? "border-primary/50 bg-primary text-primary-foreground shadow-md"
                              : "border-border bg-muted/30 hover:border-primary/30 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/6",
                          )}
                        >
                          {sel && (
                            <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-white/25">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </span>
                          )}
                          <span className={cn(
                            "flex size-10 items-center justify-center rounded-xl transition-colors",
                            sel ? "bg-white/20" : "bg-primary/10 text-primary dark:bg-primary/15",
                          )}>
                            {item.icon}
                          </span>
                          <div>
                            <p className="text-base font-bold">{item.label}</p>
                            <p className={cn("mt-0.5 text-xs leading-relaxed", sel ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              {item.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Video format */}
                  {form.outputType === "video" && (
                    <div className="space-y-2">
                      <SectionLabel>Video Format</SectionLabel>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {VIDEO_TYPE_OPTIONS.map((opt) => {
                          const sel = form.videoType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm((p) => ({ ...p, videoType: opt.value }))}
                              className={cn(
                                "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200 micro-btn",
                                sel
                                  ? "border-primary/40 bg-primary/10 ring-2 ring-primary/20 dark:bg-primary/15"
                                  : "border-border bg-muted/30 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/6",
                              )}
                            >
                              <span className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                                sel ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground dark:bg-white/8",
                              )}>
                                {opt.value === "normal" ? <Video className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                                  {sel && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                                </div>
                                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{opt.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Project Name — full width with icon */}
                  <div className="space-y-1.5">
                    <SectionLabel>Project Name</SectionLabel>
                    <div className="relative">
                      <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                      <input
                        value={form.projectName}
                        onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
                        placeholder="Moonlight dragon adventure"
                        className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-10 pr-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/8"
                      />
                    </div>
                  </div>

                  {/* Audience */}
                  <div className="space-y-1.5">
                    <SectionLabel>Audience</SectionLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {CATEGORY_OPTIONS.map((opt) => {
                        const sel = form.category === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, category: opt.value }))}
                            className={cn(
                              "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-all duration-200 micro-btn",
                              sel
                                ? "border-primary/40 bg-primary/15 ring-2 ring-primary/20 dark:bg-primary/20"
                                : "border-border bg-muted/30 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/6",
                            )}
                          >
                            <p className="text-xs font-bold text-foreground">{opt.label}</p>
                            <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ② Prompt */}
              <div className="rounded-2xl border border-border bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]">
                <div className="flex items-center gap-3 border-b border-border px-5 py-4 dark:border-white/8">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
                  <p className="text-sm font-semibold text-foreground">Your Prompt</p>
                </div>
                <div className="p-5">
                  <textarea
                    rows={4}
                    value={form.prompt}
                    onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
                    placeholder="Describe your story or video idea in detail…"
                    className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/8"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {form.outputType === "video" && form.videoType === "gameplay"
                        ? "Use punchy hooks and short lines for gameplay pacing."
                        : "Be specific — more detail means more consistent outputs."}
                    </p>
                    <span className={cn(
                      "text-xs tabular-nums transition-colors",
                      form.prompt.trim().length > 0 ? "text-foreground/60" : "text-muted-foreground/40"
                    )}>
                      {form.prompt.trim().length} chars
                    </span>
                  </div>
                </div>
              </div>

              {/* ③ Story: reference assets + style */}
              {form.outputType === "story" && (
                <>
                  <div className="rounded-2xl border border-border bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]">
                    <div className="flex items-center gap-3 border-b border-border px-5 py-4 dark:border-white/8">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span>
                      <p className="text-sm font-semibold text-foreground">Reference Assets</p>
                      <span className="ml-auto text-xs text-muted-foreground">Optional</span>
                    </div>
                    <div className="p-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <UploadCard
                          label="Character Reference"
                          hint="Helps style and facial consistency"
                          file={form.frontImage}
                          onFileSelect={(file) => setForm((p) => ({ ...p, frontImage: file }))}
                        />
                        <UploadCard
                          label="World Reference"
                          hint="Sets color palette and environment"
                          file={form.backImage}
                          onFileSelect={(p) => setForm((prev) => ({ ...prev, backImage: p }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]">
                    <div className="flex items-center gap-3 border-b border-border px-5 py-4 dark:border-white/8">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">4</span>
                      <p className="text-sm font-semibold text-foreground">Visual Style</p>
                    </div>
                    <div className="p-5">
                      <div className="flex flex-wrap gap-2">
                        {STYLE_OPTIONS.map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => toggleStyle(style)}
                            className={cn(
                              "rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 micro-btn",
                              form.styles.includes(style)
                                ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-muted/40 text-foreground hover:bg-muted/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                            )}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ③ Video: Style OR Background */}
              {form.outputType === "video" && (
                <div className="rounded-2xl border border-border bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]">
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4 dark:border-white/8">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span>
                    <p className="text-sm font-semibold text-foreground">
                      {form.videoType === "gameplay" ? "Background Clip" : "Video Style"}
                    </p>
                  </div>
                  <div className="p-5">

                    {form.videoType === "normal" ? (
                      <div>
                        <SectionLabel>Generation Style</SectionLabel>
                        <p className="mt-0.5 text-xs text-muted-foreground">Choose a visual preset for your scenes.</p>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {STYLE_OPTIONS.map((style, idx) => {
                            const active = form.styles.includes(style);
                            const preview = SCENE_POOL[idx % SCENE_POOL.length];
                            return (
                              <button
                                key={style}
                                type="button"
                                onClick={() => toggleStyle(style)}
                                className={cn(
                                  "group relative overflow-hidden rounded-xl border transition-all duration-200",
                                  active
                                    ? "border-primary/50 ring-2 ring-primary/30"
                                    : "border-border hover:border-primary/30 dark:border-white/10",
                                )}
                              >
                                <img src={preview} alt={style} className="h-20 w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                {active && (
                                  <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary shadow-md">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                )}
                                <span className="absolute bottom-1.5 left-2 text-[11px] font-semibold text-white">{style}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Compact category pills + label on same row */}
                        <div className="flex items-center gap-3">
                          <SectionLabel>Gameplay Style</SectionLabel>
                          <div className="inline-flex gap-0.5 rounded-full border border-border bg-muted/30 p-0.5 dark:border-white/10 dark:bg-white/5">
                            {BRAIN_ROT_CATEGORY_OPTIONS.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setForm((p) => ({
                                  ...p,
                                  brainRotCategory: cat.id,
                                  brainRotBackgroundId: BRAIN_ROT_BACKGROUNDS[cat.id][0]?.id ?? p.brainRotBackgroundId,
                                }))}
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150",
                                  form.brainRotCategory === cat.id
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Tiny 6-up thumbnail row */}
                        <div className="grid grid-cols-6 gap-1.5">
                          {backgroundOptions.map((clip) => {
                            const active = form.brainRotBackgroundId === clip.id;
                            return (
                              <button
                                key={clip.id}
                                type="button"
                                title={clip.name}
                                onClick={() => setForm((p) => ({ ...p, brainRotBackgroundId: clip.id }))}
                                className={cn(
                                  "group relative overflow-hidden rounded-lg border transition-all duration-200",
                                  active
                                    ? "border-primary/60 ring-2 ring-primary/30"
                                    : "border-border hover:border-primary/40 dark:border-white/10",
                                )}
                              >
                                <img
                                  src={clip.thumb}
                                  alt={clip.name}
                                  className="aspect-[9/16] w-full object-cover transition-transform duration-300 group-hover:scale-[1.1]"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                {active && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="flex size-4 items-center justify-center rounded-full bg-primary shadow">
                                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                    </span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ④ Voice & Music — combined card */}
              {form.outputType === "video" && (
                <div className="rounded-2xl border border-border bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]">

                  {/* Card header */}
                  <div className="flex items-center gap-3 border-b border-border px-5 py-3.5 dark:border-white/8">
                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                    >
                      4
                    </motion.span>

                    <div className="flex items-center gap-1.5">
                      {/* Mic — pulses + ripple ring when voice plays */}
                      <motion.div
                        className={cn("relative", voiceIsPlaying ? "text-primary" : "text-muted-foreground")}
                        animate={voiceIsPlaying ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                        transition={voiceIsPlaying
                          ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
                          : { duration: 0.25 }}
                      >
                        <Mic2 className="h-3.5 w-3.5" />
                        {voiceIsPlaying && (
                          <motion.span
                            className="absolute inset-0 rounded-full bg-primary/30"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 3, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1.1, ease: "easeOut" }}
                          />
                        )}
                      </motion.div>

                      {/* Animated "+" — gentle idle breathe */}
                      <motion.span
                        className="select-none text-[9px] text-muted-foreground/40"
                        animate={{ opacity: [0.3, 0.7, 0.3], y: [0, -1, 0] }}
                        transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
                      >
                        +
                      </motion.span>

                      {/* Music2 — pulses + ripple ring when music plays */}
                      <motion.div
                        className={cn("relative", musicIsPlaying ? "text-primary" : "text-muted-foreground")}
                        animate={musicIsPlaying ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                        transition={musicIsPlaying
                          ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
                          : { duration: 0.25 }}
                      >
                        <Music2 className="h-3.5 w-3.5" />
                        {musicIsPlaying && (
                          <motion.span
                            className="absolute inset-0 rounded-full bg-primary/30"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 3, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1.1, ease: "easeOut" }}
                          />
                        )}
                      </motion.div>
                    </div>

                    <motion.p
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15, duration: 0.35, ease }}
                      className="text-sm font-semibold text-foreground"
                    >
                      Voice &amp; Music
                    </motion.p>
                  </div>

                  {/* Voice sub-section */}
                  <div className="px-4 pt-3 pb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Voice</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                    {VOICE_OPTIONS.map((voice) => {
                      const active = form.selectedVoiceId === voice.id;
                      const isPlaying = playingId === voice.id;
                      return (
                        <div
                          key={voice.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setForm((p) => ({ ...p, selectedVoiceId: voice.id }))}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setForm((p) => ({ ...p, selectedVoiceId: voice.id })); }}
                          className={cn(
                            "relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-2 transition-all duration-200",
                            active
                              ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20 dark:bg-primary/15"
                              : "border-border/70 bg-muted/10 hover:bg-muted/30 dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/5",
                          )}
                        >
                          <div className={cn("relative size-6 shrink-0 rounded-md bg-gradient-to-br", voice.accentClass)}>
                            {active && (
                              <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-primary ring-1 ring-white dark:ring-[#141414]">
                                <Check className="h-1.5 w-1.5 text-primary-foreground" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="truncate text-xs font-semibold text-foreground">{voice.name}</p>
                              {isPlaying && <WaveformBars playing />}
                            </div>
                          </div>
                          {voice.sampleUrl && (
                            <button
                              type="button"
                              aria-label={isPlaying ? "Pause" : "Play sample"}
                              onClick={(e) => { e.stopPropagation(); togglePlay(voice.id, voice.sampleUrl!); }}
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border transition-all",
                                isPlaying
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border/70 bg-background text-muted-foreground hover:border-primary/50 hover:text-primary dark:border-white/12 dark:bg-white/5",
                              )}
                            >
                              {isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 translate-x-px" />}
                            </button>
                          )}
                          {isPlaying && (
                            <div
                              className="absolute inset-x-0 bottom-0 h-0.5 cursor-pointer bg-muted/60"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * (audioRef.current.duration || 0);
                              }}
                            >
                              <motion.div className="h-full bg-primary" animate={{ width: `${audioProgress * 100}%` }} transition={{ duration: 0.1 }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="mx-4 border-t border-border/60 dark:border-white/8" />

                  {/* Music sub-section */}
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Music</p>
                  </div>
                  <div className="space-y-1.5 px-3 pb-3">
                    {MUSIC_OPTIONS.map((track) => {
                      const active = form.selectedMusicId === track.id;
                      const isPlaying = playingId === track.id;
                      return (
                        <div
                          key={track.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setForm((p) => ({ ...p, selectedMusicId: track.id }))}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setForm((p) => ({ ...p, selectedMusicId: track.id })); }}
                          className={cn(
                            "relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-2 transition-all duration-200",
                            active
                              ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20 dark:bg-primary/15"
                              : "border-border/70 bg-muted/10 hover:bg-muted/30 dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/5",
                          )}
                        >
                          <button
                            type="button"
                            aria-label={isPlaying ? "Pause" : "Play preview"}
                            onClick={(e) => { e.stopPropagation(); if (track.sampleUrl) togglePlay(track.id, track.sampleUrl); }}
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border transition-all",
                              isPlaying
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/70 bg-background text-muted-foreground hover:border-primary/50 hover:text-primary dark:border-white/12 dark:bg-white/5",
                            )}
                          >
                            {isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 translate-x-px" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-medium text-foreground">{track.name}</p>
                              {isPlaying && <WaveformBars playing />}
                            </div>
                            {isPlaying ? (
                              <div
                                className="mt-1 h-0.5 w-full cursor-pointer overflow-hidden rounded-full bg-muted/60"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * (audioRef.current.duration || 0);
                                }}
                              >
                                <motion.div className="h-full bg-primary" animate={{ width: `${audioProgress * 100}%` }} transition={{ duration: 0.1 }} />
                              </div>
                            ) : (
                              <p className="truncate text-[10px] text-muted-foreground">{track.tags}</p>
                            )}
                          </div>
                          {active && (
                            <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-primary ring-1 ring-white dark:ring-[#141414]">
                              <Check className="h-1.5 w-1.5 text-primary-foreground" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>

            {/* ── Right column: sticky sidebar ── */}
            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

              {/* Preview */}
              <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-sm dark:border-white/10">
                {form.outputType === "video" ? (
                  <video
                    className="aspect-[9/16] w-full object-cover"
                    controls
                    muted
                    loop
                    playsInline
                    src={DEFAULT_BRAIN_ROT_PREVIEW}
                  />
                ) : (
                  <div className="relative aspect-[9/16]">
                    <img src={SCENE_POOL[0]} alt="Story preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <p className="absolute bottom-3 left-3 text-xs font-semibold uppercase tracking-widest text-white/80">
                      Story Preview
                    </p>
                  </div>
                )}
              </div>

              {/* Checklist + generate */}
              <div className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#141414]">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Checklist</p>
                <div className="mt-3 space-y-2.5">
                  {[
                    { label: "Project name", ok: Boolean(form.projectName.trim()) },
                    { label: "Prompt written", ok: Boolean(form.prompt.trim()) },
                    ...(form.outputType === "video"
                      ? [
                          { label: "Voice selected", ok: Boolean(form.selectedVoiceId) },
                          { label: "Music selected", ok: Boolean(form.selectedMusicId) },
                        ]
                      : []),
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                        ok
                          ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          : "border border-border bg-muted/40 text-transparent dark:border-white/10 dark:bg-white/5"
                      )}>
                        <Check className="h-3 w-3" />
                      </span>
                      <span className={cn(
                        "text-xs transition-colors duration-300",
                        ok ? "font-medium text-foreground" : "text-muted-foreground/60"
                      )}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative mt-5">
                  {/* glow behind the button */}
                  <div className={cn(
                    "absolute inset-0 rounded-full bg-primary blur-lg transition-opacity duration-300",
                    isStep1Valid ? "opacity-30" : "opacity-0"
                  )} />
                  <button
                    type="button"
                    onClick={startGeneration}
                    disabled={!isStep1Valid}
                    className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 micro-btn"
                  >
                    <Sparkles className="h-4 w-4" />
                    {form.outputType === "story" ? "Generate Story" : "Generate Video"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (

          /* ════════════════ STEP 2: GENERATE ════════════════ */
          <motion.div
            key="step-generate"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease }}
            className="grid gap-5 md:grid-cols-[260px_1fr]"
          >
            {/* ── Sidebar: pipeline queue ── */}
            <aside className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-white p-4 dark:border-white/8 dark:bg-[#141414]">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Pipeline Queue
                </p>
                <div className="space-y-2">
                  {activeFlow.map((stage) => {
                    const st = runtime[stage.id].status;
                    const active = stage.id === currentId;

                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => {
                          setCurrentId(stage.id);
                          setOpenMap((p) => ({ ...p, [stage.id]: true }));
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                          active
                            ? "border-primary/30 bg-primary/8 ring-1 ring-primary/20"
                            : "border-border/50 bg-muted/10 hover:bg-muted/20",
                        )}
                      >
                        <div className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border",
                          st === "done" ? "border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-900/20"
                            : st === "running" ? "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20"
                            : st === "failed" ? "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20"
                            : "border-border/50 bg-background",
                        )}>
                          {st === "done" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          ) : st === "running" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                          ) : st === "failed" ? (
                            <X className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <span className="text-muted-foreground">{stage.icon}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{stage.label}</p>
                          <div className="mt-0.5 flex items-center justify-between gap-1">
                            <StageStatusBadge status={st} />
                            {stageDuration(runtime, stage.id) != null && (
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {formatMs(stageDuration(runtime, stage.id) as number)}
                              </span>
                            )}
                          </div>
                        </div>
                        {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary/60" />}
                      </button>
                    );
                  })}
                </div>

                {/* Overall progress */}
                <div className="mt-4 rounded-xl border border-border/50 bg-muted/10 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-muted-foreground">Overall Progress</span>
                    <span className="tabular-nums text-foreground/60">
                      {overallCompleted}/{activeFlow.length}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: "0%" }}
                      animate={{ width: `${overallProgress}%` }}
                      transition={{ duration: 0.4, ease }}
                    />
                  </div>
                </div>

                {/* Live logs */}
                <div className="mt-3 rounded-xl border border-border/50 bg-muted/10 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Clock3 className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Live Logs</p>
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {logs.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/50">No logs yet…</p>
                    ) : (
                      logs.slice(-15).map((line) => (
                        <div
                          key={`${line.ts}-${line.message}`}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5",
                            line.level === "success"
                              ? "border-green-200/60 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10"
                              : "border-border/40 bg-background/60",
                          )}
                        >
                          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">{line.ts}</span>
                          <p className={cn(
                            "mt-0.5 text-[11px] leading-snug",
                            line.level === "success" ? "text-green-700 dark:text-green-400" : "text-foreground/70",
                          )}>
                            {line.message}
                          </p>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            </aside>

            {/* ── Main: stage panels + logs ── */}
            <div className="space-y-3">

              {/* Error banner */}
              {failed && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-900/15"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Generation Failed</p>
                    <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/70">
                      Try again with a shorter prompt or fewer style tags.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Stage accordion panels */}
              {activeFlow.map((stage) => {
                const st = runtime[stage.id].status;
                const isOpen = Boolean(openMap[stage.id]);
                const isActive = stage.id === currentId;

                return (
                  <div
                    key={stage.id}
                    ref={(el) => { stagePanelRefs.current[stage.id] = el; }}
                    className={cn(
                      "overflow-hidden rounded-2xl border transition-all duration-200",
                      isActive
                        ? "border-primary/30 shadow-sm"
                        : "border-border/60",
                      st === "done" ? "dark:border-green-800/30"
                        : st === "running" ? "dark:border-amber-800/30"
                        : st === "failed" ? "dark:border-red-800/30"
                        : "",
                    )}
                  >
                    {/* Stage header */}
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentId(stage.id);
                        setOpenMap((p) => ({ ...p, [stage.id]: !p[stage.id] }));
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                        isActive
                          ? "bg-primary/5"
                          : "bg-white dark:bg-[#141414] hover:bg-muted/20",
                      )}
                    >
                      <div className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-xl border",
                        st === "done" ? "border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-900/20"
                          : st === "running" ? "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20"
                          : st === "failed" ? "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20"
                          : "border-border/60 bg-muted/20",
                      )}>
                        {st === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : st === "running" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                        ) : st === "failed" ? (
                          <X className="h-4 w-4 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">{stage.icon}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <StageStatusBadge status={st} />
                          {stageDuration(runtime, stage.id) != null && (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {formatMs(stageDuration(runtime, stage.id) as number)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background transition hover:bg-muted">
                        {isOpen
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </div>
                    </button>

                    {/* Stage body */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease }}
                          className="overflow-hidden border-t border-border/50 bg-white dark:bg-[#141414]"
                        >
                          <div className="p-4">
                            {stage.id === "generate_prompts" && (
                              <div className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Prompt Logs</p>
                                <div className="space-y-1.5">
                                  {logs.filter((l) => l.message.toLowerCase().includes("prompt")).slice(-5).length === 0 ? (
                                    <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                                      Waiting to start…
                                    </div>
                                  ) : (
                                    logs.filter((l) => l.message.toLowerCase().includes("prompt")).slice(-5).map((line) => (
                                      <div key={`${line.ts}-${line.message}`} className="flex gap-2 rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{line.ts}</span>
                                        <span className="text-xs text-foreground/80">{line.message}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                            {stage.id === "generate_images" && (
                              <div className="space-y-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Scene Frames</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {[0, 1, 2, 3].map((idx) => {
                                    const url = generatedImages[idx];
                                    return (
                                      <div
                                        key={`scene-${idx}`}
                                        className="relative aspect-[9/16] overflow-hidden rounded-xl border border-border/60 bg-muted/30"
                                      >
                                        {url ? (
                                          <>
                                            <img src={url} alt={`Scene ${idx + 1}`} className="h-full w-full object-cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                          </>
                                        ) : (
                                          <div className="flex h-full items-center justify-center">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                                          </div>
                                        )}
                                        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                                          #{idx + 1}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {stage.id === "generate_video" && (
                              <div className="space-y-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Video Output</p>
                                <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-2xl border border-border/60 bg-black">
                                  {videoReady ? (
                                    <video
                                      className="aspect-[9/16] w-full object-cover"
                                      controls
                                      autoPlay
                                      muted
                                      loop
                                      playsInline
                                      src={DEFAULT_BRAIN_ROT_PREVIEW}
                                    />
                                  ) : (
                                    <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2 text-white/50">
                                      <PlayCircle className="h-7 w-7" />
                                      <p className="text-[11px] font-semibold uppercase tracking-wider">Rendering…</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {stage.id === "finalize" && (
                              <div className="rounded-xl border border-green-200/60 bg-green-50/60 p-3 dark:border-green-800/30 dark:bg-green-900/10">
                                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Finalizing Job</p>
                                <p className="mt-0.5 text-xs text-green-600/80 dark:text-green-400/70">
                                  Saving job and preparing preview links.
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted dark:bg-[#1a1a1a] dark:hover:bg-[#222] micro-btn"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Configure
                </button>
                <button
                  type="button"
                  onClick={startGeneration}
                  disabled={!isStep1Valid}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40 dark:bg-[#1a1a1a] dark:hover:bg-[#222] micro-btn"
                >
                  <Loader2 className="h-3.5 w-3.5" />
                  Retry
                </button>
                {complete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease }}
                  >
                    <Link
                      href="/dashboard/jobs"
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 micro-btn"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Open in Jobs
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
