/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  ArrowLeft,
  Brush,
  Check,
  Download,
  Eraser,
  ImagePlus,
  Loader2,
  Palette,
  PenTool,
  Redo2,
  RotateCcw,
  Star,
  Trash2,
  Undo2,
  Upload,
  Wand,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { appendStoredCharacter } from "@/lib/custom-characters";
import { dashboardCharacters } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type UploadKind = "drawings" | "references";

type UploadAsset = {
  id: string;
  file: File;
  preview: string;
};

type CharacterDraftState = {
  name: string;
  role: string;
  ageBand: string;
  mood: string;
  description: string;
  visualNotes: string;
  palette: string[];
  drawings: UploadAsset[];
  references: UploadAsset[];
};

type DrawingMode = "draw" | "erase";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_UPLOADS_PER_BUCKET = 8;
const PALETTE_CHOICES = [
  "#f97316",
  "#facc15",
  "#1d4ed8",
  "#22c55e",
  "#14b8a6",
  "#f43f5e",
  "#6366f1",
  "#0f172a",
];
const DEFAULT_PALETTE = PALETTE_CHOICES.slice(0, 3);
const FALLBACK_AVATAR = dashboardCharacters[0]?.avatar ?? "";

const CANVAS_COLORS = [
  "#000000",
  "#f97316",
  "#facc15",
  "#1d4ed8",
  "#22c55e",
  "#14b8a6",
  "#f43f5e",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#0f172a",
  "#ffffff",
];
const BRUSH_SIZES = [2, 4, 8, 14, 22];
const MAX_UNDO_STEPS = 30;

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialDraft(ageBand = "5-8"): CharacterDraftState {
  return {
    name: "",
    role: "",
    ageBand,
    mood: "",
    description: "",
    visualNotes: "",
    palette: [...DEFAULT_PALETTE],
    drawings: [],
    references: [],
  };
}

function revokeAssets(assets: UploadAsset[]) {
  assets.forEach((asset) => URL.revokeObjectURL(asset.preview));
}

function buildAssets(files: FileList | File[] | null) {
  if (!files) return [];
  return Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .map((file) => ({
      id: makeLocalId("asset"),
      file,
      preview: URL.createObjectURL(file),
    }));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read file."));
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

/* ------------------------------------------------------------------ */
/*  Section Step Header                                                */
/* ------------------------------------------------------------------ */

function SectionHeader({
  step,
  title,
  subtitle,
  icon,
}: {
  step: number;
  title: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
          Step {step}
        </p>
        <h3 className="text-base font-bold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drawing Canvas                                                     */
/* ------------------------------------------------------------------ */

function DrawingCanvas({
  onSaveDrawing,
}: {
  onSaveDrawing: (asset: UploadAsset) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);

  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [mode, setMode] = useState<DrawingMode>("draw");
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [hasContent, setHasContent] = useState(false);

  const getCtx = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  const saveUndoState = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => {
      const next = [...prev, data];
      if (next.length > MAX_UNDO_STEPS) next.shift();
      return next;
    });
    setRedoStack([]);
  }, [getCtx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: ReactMouseEvent | TouchEvent | ReactTouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return {
      x: (e as ReactMouseEvent).clientX - rect.left,
      y: (e as ReactMouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;

    saveUndoState();
    isDrawingRef.current = true;

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (mode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = brushColor;
    }
    ctx.lineWidth = brushSize;
  };

  const draw = (e: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasContent(true);
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const ctx = getCtx();
    if (ctx) {
      ctx.closePath();
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const handleUndo = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || undoStack.length === 0) return;

    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setRedoStack((prev) => [...prev, current]);

    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(previous, 0, 0);
  };

  const handleRedo = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || redoStack.length === 0) return;

    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev, current]);

    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(next, 0, 0);
  };

  const handleClear = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    saveUndoState();
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasContent(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const file = dataUrlToFile(dataUrl, `drawing_${Date.now()}.png`);
    const preview = URL.createObjectURL(file);
    onSaveDrawing({
      id: makeLocalId("drawn"),
      file,
      preview,
    });
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mode Toggle */}
        <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-white/80 p-0.5 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              mode === "draw"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <PenTool className="size-3.5" />
            Draw
          </button>
          <button
            type="button"
            onClick={() => setMode("erase")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              mode === "erase"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eraser className="size-3.5" />
            Erase
          </button>
        </div>

        <div className="h-5 w-px bg-border/60 dark:bg-white/10" />

        {/* Brush Sizes */}
        <div className="flex items-center gap-1.5">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setBrushSize(size)}
              className={cn(
                "flex items-center justify-center rounded-lg p-1.5 transition-all",
                brushSize === size
                  ? "bg-foreground/10 ring-1 ring-foreground/20"
                  : "hover:bg-foreground/5"
              )}
              title={`Brush size ${size}`}
            >
              <span
                className="rounded-full bg-foreground"
                style={{
                  width: Math.max(4, Math.min(size, 16)),
                  height: Math.max(4, Math.min(size, 16)),
                }}
              />
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border/60 dark:bg-white/10" />

        {/* Undo / Redo / Clear */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-30"
            title="Undo"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-30"
            title="Redo"
          >
            <Redo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            title="Clear canvas"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {/* Save Drawing button (pushed right) */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasContent}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition",
            hasContent
              ? "bg-primary text-primary-foreground hover:brightness-95"
              : "cursor-not-allowed bg-primary/30 text-primary-foreground/60"
          )}
        >
          <Download className="size-3.5" />
          Save Drawing
        </button>
      </div>

      {/* Color Swatches */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CANVAS_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              setBrushColor(color);
              setMode("draw");
            }}
            className={cn(
              "size-7 rounded-full border-2 transition-all",
              brushColor === color && mode === "draw"
                ? "scale-110 border-foreground shadow-md"
                : "border-border/50 hover:scale-105",
              color === "#ffffff" && "ring-1 ring-border/30"
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative h-[320px] w-full overflow-hidden rounded-2xl border-2 border-border/60 bg-white shadow-inner dark:border-white/10"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "h-full w-full touch-none",
            mode === "erase" ? "cursor-cell" : "cursor-crosshair"
          )}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasContent && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <PenTool className="size-10" strokeWidth={1} />
            <p className="text-sm font-medium">Start drawing your character here</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Asset Upload Panel (improved)                                      */
/* ------------------------------------------------------------------ */

function AssetUploadPanel({
  title,
  hint,
  icon,
  assets,
  onAddAssets,
  onRemoveAsset,
}: {
  title: string;
  hint: string;
  icon: ReactNode;
  assets: UploadAsset[];
  onAddAssets: (assets: UploadAsset[]) => void;
  onRemoveAsset: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAddAssets(buildAssets(event.target.files));
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragActive(false);
    onAddAssets(buildAssets(event.dataTransfer.files));
  };

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          "w-full rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-all",
          dragActive
            ? "border-primary bg-primary/10 shadow-inner"
            : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-4" />
          </div>
          <p className="text-xs font-semibold text-foreground">
            Drop images or click to upload
          </p>
          <p className="text-[11px] text-muted-foreground">
            PNG / JPG / WEBP &bull; up to {MAX_UPLOADS_PER_BUCKET} files
          </p>
        </div>
      </button>

      <AnimatePresence>
        {assets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 grid grid-cols-4 gap-2"
          >
            {assets.map((asset) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 shadow-sm"
              >
                <img
                  src={asset.preview}
                  alt="Character asset"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveAsset(asset.id)}
                  className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
                  aria-label="Remove upload"
                >
                  <X className="size-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Live Character Preview                                             */
/* ------------------------------------------------------------------ */

function LivePreviewCard({ draft }: { draft: CharacterDraftState }) {
  const avatar = draft.drawings[0]?.preview || draft.references[0]?.preview;

  return (
    <div
      className="sticky top-6 space-y-3 rounded-2xl border border-border/60 bg-gradient-to-b from-primary/[0.04] to-transparent p-4 shadow-sm dark:border-white/10 dark:from-white/[0.02]"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
        Live Preview
      </p>

      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted/40 shadow-inner">
        {avatar ? (
          <img
            src={avatar}
            alt="Character preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <Brush className="size-8" strokeWidth={1.5} />
            <p className="text-xs font-medium">Upload or draw to preview</p>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="truncate text-sm font-bold leading-tight text-white drop-shadow-sm">
            {draft.name || "Character Name"}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-white/70">
            {draft.role || "Role"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              {draft.ageBand || "5-8"}
            </span>
            <div className="flex gap-0.5">
              {draft.palette.map((color) => (
                <span
                  key={color}
                  className="size-2.5 rounded-full ring-1 ring-white/30"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {draft.mood && (
        <div className="rounded-xl bg-muted/40 px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Mood
          </p>
          <p className="mt-0.5 text-xs font-medium text-foreground">
            {draft.mood}
          </p>
        </div>
      )}

      {draft.description && (
        <div className="rounded-xl bg-muted/40 px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Prompt
          </p>
          <p className="mt-0.5 line-clamp-4 text-xs leading-relaxed text-foreground">
            {draft.description}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

type DrawingTab = "upload" | "draw";

export default function DashboardNewCharacterPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<CharacterDraftState>(() => buildInitialDraft());
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawingTab, setDrawingTab] = useState<DrawingTab>("upload");
  const [showSuccess, setShowSuccess] = useState(false);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const draftStore = draftRef;
    return () => {
      revokeAssets(draftStore.current.drawings);
      revokeAssets(draftStore.current.references);
    };
  }, []);

  const canSubmit = Boolean(
    !isSubmitting &&
      draft.name.trim().length > 1 &&
      draft.description.trim().length > 10 &&
      draft.drawings.length > 0
  );

  const handleAddAssets = (kind: UploadKind, assets: UploadAsset[]) => {
    if (!assets.length) return;

    setDraft((prev) => {
      const merged = [...prev[kind], ...assets];
      if (merged.length <= MAX_UPLOADS_PER_BUCKET) {
        return { ...prev, [kind]: merged };
      }

      const kept = merged.slice(0, MAX_UPLOADS_PER_BUCKET);
      const overflow = merged.slice(MAX_UPLOADS_PER_BUCKET);
      revokeAssets(overflow);
      return { ...prev, [kind]: kept };
    });

    setFormError("");
  };

  const handleRemoveAsset = (kind: UploadKind, id: string) => {
    setDraft((prev) => {
      const bucket = prev[kind];
      const target = bucket.find((asset) => asset.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return { ...prev, [kind]: bucket.filter((asset) => asset.id !== id) };
    });
  };

  const handlePaletteToggle = (color: string) => {
    setDraft((prev) => {
      const exists = prev.palette.includes(color);
      if (exists) {
        if (prev.palette.length === 1) return prev;
        return { ...prev, palette: prev.palette.filter((entry) => entry !== color) };
      }

      if (prev.palette.length < 3) {
        return { ...prev, palette: [...prev.palette, color] };
      }
      return { ...prev, palette: [...prev.palette.slice(1), color] };
    });
  };

  const handleClear = () => {
    setDraft((prev) => {
      const nextAgeBand = prev.ageBand || "5-8";
      revokeAssets(prev.drawings);
      revokeAssets(prev.references);
      return buildInitialDraft(nextAgeBand);
    });
    setFormError("");
  };

  const handleSaveDrawing = (asset: UploadAsset) => {
    handleAddAssets("drawings", [asset]);
    setDrawingTab("upload");
  };

  const handleCreateCharacter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = draft.name.trim();
    const description = draft.description.trim();

    if (!name || !description || draft.drawings.length === 0) {
      setFormError(
        "Add character name, description, and at least one drawing to create a character."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError("");

      const avatarSource =
        draft.drawings[0]?.file ?? draft.references[0]?.file ?? null;
      const avatar = avatarSource
        ? await fileToDataUrl(avatarSource)
        : FALLBACK_AVATAR;

      appendStoredCharacter({
        id: makeLocalId("char_user"),
        name,
        role: draft.role.trim() || "Story Companion",
        ageBand: draft.ageBand || "5-8",
        mood: draft.mood.trim() || "Curious and kind",
        avatar,
        palette: draft.palette.length ? draft.palette : [...DEFAULT_PALETTE],
        description,
        visualNotes: draft.visualNotes.trim(),
        createdAt: new Date().toISOString(),
      });

      revokeAssets(draft.drawings);
      revokeAssets(draft.references);

      setShowSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/characters");
        router.refresh();
      }, 800);
    } catch {
      setFormError("Could not save character. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/20">
                <Check className="size-8 text-primary" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-bold text-foreground">Character Created!</p>
              <p className="text-sm text-muted-foreground">
                Redirecting to characters...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
      >
        {/* ── Page Header ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10">
                <Wand className="size-4 text-primary" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Character Builder
              </p>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              Create New Character
            </h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              Bring your character to life — describe their personality, draw or
              upload artwork, and customize their look.
            </p>
          </div>

          <Link
            href="/dashboard/characters"
            className="group inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Characters
          </Link>
        </div>

        {/* ── Main Content ──────────────────────────────────────────── */}
        <form
          className="grid gap-6 xl:grid-cols-[1fr_280px]"
          onSubmit={handleCreateCharacter}
        >
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* ── Step 1: Identity ──────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111111]/80"
            >
              <SectionHeader
                step={1}
                title="Character Identity"
                subtitle="Name your character and define their core traits."
                icon={<Star className="size-4" />}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Character Name *
                  </label>
                  <input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Milo Moonfox"
                    className="w-full rounded-xl border border-border/70 bg-white px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:bg-[#0a0a0a]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Role
                  </label>
                  <input
                    value={draft.role}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, role: e.target.value }))
                    }
                    placeholder="Curious Explorer"
                    className="w-full rounded-xl border border-border/70 bg-white px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:bg-[#0a0a0a]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Age Band
                  </label>
                  <select
                    value={draft.ageBand}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, ageBand: e.target.value }))
                    }
                    className="w-full rounded-xl border border-border/70 bg-white px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:bg-[#0a0a0a]"
                  >
                    {["4-7", "5-8", "6-9", "5-10", "8-12"].map((band) => (
                      <option key={band} value={band}>
                        Ages {band}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Mood
                  </label>
                  <input
                    value={draft.mood}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, mood: e.target.value }))
                    }
                    placeholder="Brave and kind"
                    className="w-full rounded-xl border border-border/70 bg-white px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:bg-[#0a0a0a]"
                  />
                </div>
              </div>
            </motion.div>

            {/* ── Step 2: Description ───────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111111]/80"
            >
              <SectionHeader
                step={2}
                title="Description & Style"
                subtitle="Describe how your character looks and feels."
                icon={<Brush className="size-4" />}
              />

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Character Prompt *
                  </label>
                  <textarea
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Describe your character's personality, look, clothes, and signature details..."
                    rows={4}
                    className="w-full resize-none rounded-xl border border-border/70 bg-white px-3.5 py-2.5 text-sm font-medium leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:bg-[#0a0a0a]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Visual Direction{" "}
                    <span className="normal-case tracking-normal text-muted-foreground/60">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={draft.visualNotes}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        visualNotes: e.target.value,
                      }))
                    }
                    placeholder="Example: soft watercolor style, rounded shapes, warm sunset palette..."
                    rows={2}
                    className="w-full resize-none rounded-xl border border-border/70 bg-white px-3.5 py-2.5 text-sm font-medium leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:bg-[#0a0a0a]"
                  />
                </div>

                {/* Palette */}
                <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/20 p-3.5 dark:bg-white/[0.02]">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Palette className="size-3.5" />
                    Color Palette (Pick up to 3)
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {PALETTE_CHOICES.map((color) => {
                      const selected = draft.palette.includes(color);
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handlePaletteToggle(color)}
                          className={cn(
                            "size-9 rounded-full border-2 transition-all",
                            selected
                              ? "scale-110 border-foreground shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                              : "border-border/50 hover:scale-105 hover:border-foreground/30"
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Palette color ${color}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Step 3: Artwork ───────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111111]/80"
            >
              <SectionHeader
                step={3}
                title="Character Artwork"
                subtitle="Draw or upload images of your character."
                icon={<PenTool className="size-4" />}
              />

              {/* Drawing Tab Switcher */}
              <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 dark:bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() => setDrawingTab("upload")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                    drawingTab === "upload"
                      ? "bg-white text-foreground shadow-sm dark:bg-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Upload className="size-4" />
                  Upload Images
                  {draft.drawings.length > 0 && (
                    <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {draft.drawings.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawingTab("draw")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                    drawingTab === "draw"
                      ? "bg-white text-foreground shadow-sm dark:bg-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <PenTool className="size-4" />
                  Draw Now
                </button>
              </div>

              <AnimatePresence mode="wait">
                {drawingTab === "upload" ? (
                  <motion.div
                    key="upload-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <AssetUploadPanel
                      title="Character Drawings *"
                      hint="Upload your sketches or hand drawings."
                      icon={<Brush className="size-3.5" />}
                      assets={draft.drawings}
                      onAddAssets={(assets) => handleAddAssets("drawings", assets)}
                      onRemoveAsset={(id) => handleRemoveAsset("drawings", id)}
                    />

                    <AssetUploadPanel
                      title="Reference Images"
                      hint="Add style references for face, outfit, or vibe."
                      icon={<ImagePlus className="size-3.5" />}
                      assets={draft.references}
                      onAddAssets={(assets) =>
                        handleAddAssets("references", assets)
                      }
                      onRemoveAsset={(id) =>
                        handleRemoveAsset("references", id)
                      }
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="draw-tab"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DrawingCanvas onSaveDrawing={handleSaveDrawing} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Draw your character, then click{" "}
                      <span className="font-semibold text-primary">Save Drawing</span>{" "}
                      to add it to your uploads.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── Error ─────────────────────────────────────────────── */}
            <AnimatePresence>
              {formError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                >
                  {formError}
                </motion.p>
              )}
            </AnimatePresence>

            {/* ── Actions ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/80 px-5 py-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111111]/80">
              <p className="text-xs text-muted-foreground">
                {draft.drawings.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-green-500" />
                    <span>
                      {draft.drawings.length} drawing{draft.drawings.length > 1 ? "s" : ""} added
                    </span>
                  </span>
                ) : (
                  "Upload or draw at least one image to create your character."
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <RotateCcw className="size-3.5" />
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition-all",
                    canSubmit
                      ? "bg-primary text-primary-foreground hover:brightness-95 active:scale-[0.98]"
                      : "cursor-not-allowed bg-primary/30 text-primary-foreground/60"
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand className="size-4" />
                  )}
                  {isSubmitting ? "Creating..." : "Create Character"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Live Preview (desktop only) */}
          <div className="hidden xl:block">
            <LivePreviewCard draft={draft} />
          </div>
        </form>
      </motion.div>
    </>
  );
}
