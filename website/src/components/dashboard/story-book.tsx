/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ArrowLeft,
  BookOpenText,
  Sparkles,
  Maximize2,
  Palette,
  X,
  Download,
  Loader2,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { StoryPage } from "@/lib/dashboard-data";

/* ------------------------------------------------------------------ */
/*  Props / data model                                                 */
/* ------------------------------------------------------------------ */

interface StoryBookProps {
  title: string;
  ageBand: string;
  pages: StoryPage[];
  cover: string;
}

/** One "opening" of the book: what you see on left + right simultaneously. */
interface BookSpread {
  leftPage: StoryPage | null; // null = cover
  leftImage: string;
  rightPage: StoryPage | null; // null = end-of-book placeholder
  rightPageIndex: number;
}

function buildSpreads(pages: StoryPage[], cover: string): BookSpread[] {
  const out: BookSpread[] = [];

  // Spread 0: cover only — right side is always blank
  out.push({
    leftPage: null,
    leftImage: cover,
    rightPage: null,
    rightPageIndex: -1,
  });

  // Content spreads: even indices → left (image), odd indices → right (text)
  for (let k = 0; k < Math.ceil(pages.length / 2); k++) {
    const li = k * 2;
    const ri = k * 2 + 1;
    out.push({
      leftPage: li < pages.length ? pages[li] : null,
      leftImage:
        li < pages.length && pages[li].illustration
          ? pages[li].illustration!
          : cover,
      rightPage: ri < pages.length ? pages[ri] : null,
      rightPageIndex: ri,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Immersive themes                                                   */
/* ------------------------------------------------------------------ */

const IMMERSIVE_THEMES = [
  {
    id: "nightfall",
    label: "Nightfall",
    backdrop:
      "radial-gradient(ellipse 120% 100% at 50% 10%, #1a1428 0%, #0e0e18 45%, #08080f 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(245,190,90,0.05) 0%, transparent 72%)",
    orbs: [
      "bg-amber-500/[0.07]",
      "bg-indigo-500/[0.05]",
      "bg-teal-400/[0.04]",
      "bg-rose-400/[0.03]",
    ],
    stars: "bg-white/45",
  },
  {
    id: "twilight",
    label: "Twilight",
    backdrop:
      "radial-gradient(ellipse 120% 100% at 50% 8%, #2a2145 0%, #1a1631 42%, #121022 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 72%)",
    orbs: [
      "bg-fuchsia-500/[0.08]",
      "bg-violet-500/[0.08]",
      "bg-sky-400/[0.05]",
      "bg-blue-500/[0.04]",
    ],
    stars: "bg-white/35",
  },
  {
    id: "sunset",
    label: "Sunset",
    backdrop:
      "radial-gradient(ellipse 120% 100% at 50% 8%, #4a2619 0%, #2d1a13 44%, #1e130f 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(251,146,60,0.11) 0%, transparent 72%)",
    orbs: [
      "bg-orange-400/[0.11]",
      "bg-amber-300/[0.08]",
      "bg-rose-400/[0.06]",
      "bg-yellow-300/[0.05]",
    ],
    stars: "bg-amber-100/40",
  },
  {
    id: "aurora",
    label: "Aurora",
    backdrop:
      "radial-gradient(ellipse 120% 100% at 50% 8%, #0d2a2c 0%, #0b1f2b 44%, #08131e 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(56,189,248,0.09) 0%, transparent 72%)",
    orbs: [
      "bg-emerald-400/[0.09]",
      "bg-cyan-400/[0.08]",
      "bg-sky-400/[0.06]",
      "bg-teal-300/[0.05]",
    ],
    stars: "bg-cyan-50/40",
  },
  {
    id: "storybook-day",
    label: "Storybook Day",
    backdrop:
      "radial-gradient(ellipse 120% 100% at 50% 8%, #efe7d6 0%, #e8deca 44%, #ddd1bc 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(180,139,85,0.14) 0%, transparent 72%)",
    orbs: [
      "bg-amber-400/[0.12]",
      "bg-orange-300/[0.10]",
      "bg-yellow-300/[0.08]",
      "bg-rose-300/[0.06]",
    ],
    stars: "bg-black/20",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Left-page panel                                                    */
/* ------------------------------------------------------------------ */

const PAGE_BG_LEFT =
  "linear-gradient(135deg, #f0e9dc 0%, #f7f1e5 50%, #f4eddf 100%)";
const PAGE_BG_RIGHT =
  "linear-gradient(225deg, #f0e9dc 0%, #faf5ec 50%, #f6f0e4 100%)";
const PAGE_BG_LEFT_IM =
  "linear-gradient(135deg, #f2ead8 0%, #f9f2e3 50%, #f5edd8 100%)";
const PAGE_BG_RIGHT_IM =
  "linear-gradient(225deg, #f2ead8 0%, #fdf6e8 50%, #f8f1df 100%)";

function sanitizeRightPageText(text: string): string {
  let normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;

  const boilerplate = [
    "Small actions and expressions make the emotions easy for kids to follow.",
    "The characters learn one practical lesson and use it immediately in the next moment.",
  ];
  for (const phrase of boilerplate) {
    normalized = normalized.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  }

  normalized = normalized.replace(/\bIn\s+Chapter\s+\d+\s*,\s*/gi, "");
  normalized = normalized.replace(/\.\s*\./g, ". ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(trimmed);
  }

  let merged = deduped.join(" ").trim();
  if (merged && !/[.!?]$/.test(merged)) merged += ".";
  return merged;
}

function LeftPanel({
  spread,
  cover,
  immersive,
  hideCoverHint,
}: {
  spread: BookSpread;
  cover: string;
  immersive?: boolean;
  hideCoverHint?: boolean; // hide "Open the cover" when inside the flip leaf
}) {
  const { leftPage, leftImage } = spread;

  /* Cover (null leftPage) */
  if (leftPage === null) {
    return (
      <div className="relative w-full h-full">
        <img
          src={cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "translateZ(0)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/15 to-transparent pointer-events-none" />
        {!hideCoverHint && (
          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center">
            <BookOpen
              className={cn(
                "size-4 md:size-5 mb-1",
                immersive ? "text-white/40" : "text-white/50"
              )}
            />
            <p className="text-[9px] md:text-[11px] text-white/60 italic font-medium">
              Open the cover
            </p>
          </div>
        )}
      </div>
    );
  }

  /* End page */
  if (leftPage.isEnd) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full p-5 md:p-7 text-center select-none"
        style={{
          background: immersive
            ? "linear-gradient(135deg, #1a1010 0%, #2a1a0e 100%)"
            : "linear-gradient(135deg, #f0e4d0 0%, #e8d5bb 100%)",
        }}
      >
        <Sparkles
          className={cn(
            "size-8 md:size-10 mb-3",
            immersive ? "text-amber-400/40" : "text-amber-600/35"
          )}
        />
        <h3 className="text-sm md:text-base font-black text-stone-900 mb-2">
          The End
        </h3>
        <p className="text-[9px] md:text-[11px] leading-relaxed text-stone-600 max-w-[150px]">
          {leftPage.text}
        </p>
        {!hideCoverHint && !immersive && (
          <Link
            href="/dashboard/stories"
            className="mt-3 inline-flex items-center gap-1 rounded-full border border-stone-300 px-2.5 py-1 text-[9px] font-semibold text-stone-700 transition hover:bg-stone-100"
          >
            <ArrowLeft className="size-2.5" />
            Library
          </Link>
        )}
      </div>
    );
  }

  /* Regular: full-bleed illustration */
  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={leftImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "translateZ(0)" }}
      />
      {/* spine-side shadow for depth */}
      <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/14 to-transparent pointer-events-none" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Right-page panel                                                   */
/* ------------------------------------------------------------------ */

function RightPanel({
  spread,
  spreadIndex,
  totalSpreads,
  immersive,
}: {
  spread: BookSpread;
  spreadIndex: number;
  totalSpreads: number;
  immersive?: boolean;
}) {
  const { rightPage } = spread;
  // Spread 0 = cover/title, last spread has no right page.
  // Content spreads are 1 … totalSpreads-2 → label them "Page 1", "Page 2", …
  const pageLabel = spreadIndex > 0 ? `Page ${spreadIndex} of ${totalSpreads - 2}` : null;
  const cleanedRightPageText = sanitizeRightPageText(rightPage?.text || "");

  /* Blank page (cover right-half or end right-half) */
  if (rightPage === null) {
    return <div className="w-full h-full" />;
  }

  /* Title page */
  if (rightPage.isTitle) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-5 md:p-8 text-center">
        <h2 className="text-sm md:text-xl font-black leading-tight px-2 text-stone-900">
          {rightPage.title}
        </h2>
        <p className="mt-1.5 md:mt-2 text-[10px] md:text-sm text-stone-600 italic">
          {rightPage.text}
        </p>
        <div className="mt-3 md:mt-5 flex items-center gap-1 text-primary">
          <BookOpenText className="size-3 md:size-4" />
          <span className="text-[9px] md:text-xs font-semibold">
            Turn the page to begin
          </span>
        </div>
      </div>
    );
  }

  /* End page on right side (if it lands here) */
  if (rightPage.isEnd) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-5 md:p-8 text-center">
        <h3 className="text-base md:text-xl font-black text-stone-900">
          The End
        </h3>
        <p className="mt-2 md:mt-3 text-[10px] md:text-sm text-stone-600 leading-relaxed max-w-[220px]">
          {rightPage.text}
        </p>
        {!immersive && (
          <Link
            href="/dashboard/stories"
            className="mt-4 md:mt-6 inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[10px] md:text-xs font-semibold text-foreground transition hover:bg-stone-100 micro-btn"
          >
            <ArrowLeft className="size-3" />
            Back to Library
          </Link>
        )}
      </div>
    );
  }

  /* Regular page — text only */
  return (
    <motion.div
      key={spreadIndex}
      className="flex h-full min-h-0 flex-col p-4 md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, delay: 0.06, ease: "easeOut" }}
    >
      {rightPage.chapter && (
        <p
          className={cn(
            "text-[8px] md:text-[10px] font-bold uppercase tracking-[0.14em] mb-2 md:mb-3",
            immersive ? "text-amber-600/80" : "text-primary"
          )}
        >
          {rightPage.chapter}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        <p className="whitespace-pre-wrap text-[11px] md:text-[14px] leading-[1.8] md:leading-[1.95] text-stone-800 font-medium">
          {cleanedRightPageText}
        </p>
        {rightPage.audioUrl ? (
          <div className="rounded-lg border border-stone-300/70 bg-stone-50/80 px-2.5 py-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-600">
              Listen To This Page
            </p>
            <audio
              controls
              preload="none"
              src={rightPage.audioUrl}
              className="h-8 w-full"
            />
          </div>
        ) : null}
      </div>
      {pageLabel && (
        <p className="mt-2 pt-1 text-[8px] md:text-[10px] text-stone-400 text-center tabular-nums">
          {pageLabel}
        </p>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ambient stars (immersive)                                          */
/* ------------------------------------------------------------------ */

function AmbientBackground({ themeIndex }: { themeIndex: number }) {
  const theme = IMMERSIVE_THEMES[themeIndex % IMMERSIVE_THEMES.length];
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden
    >
      <div
        className={cn(
          "absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[140px] ambient-orb-1",
          theme.orbs[0]
        )}
      />
      <div
        className={cn(
          "absolute -bottom-[18%] -right-[12%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full blur-[120px] ambient-orb-2",
          theme.orbs[1]
        )}
      />
      <div
        className={cn(
          "absolute top-[25%] right-[5%] w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] rounded-full blur-[100px] ambient-orb-3",
          theme.orbs[2]
        )}
      />
      <div
        className={cn(
          "absolute -top-[5%] right-[20%] w-[20vw] h-[20vw] max-w-[280px] max-h-[280px] rounded-full blur-[80px] ambient-orb-2",
          theme.orbs[3]
        )}
      />
      {[
        { top: "12%", left: "18%", delay: "0s", size: 2 },
        { top: "28%", left: "72%", delay: "1.2s", size: 1.5 },
        { top: "65%", left: "85%", delay: "2.4s", size: 2 },
        { top: "78%", left: "12%", delay: "0.8s", size: 1.5 },
        { top: "45%", left: "92%", delay: "3.1s", size: 1 },
        { top: "8%", left: "55%", delay: "1.8s", size: 1 },
        { top: "88%", left: "45%", delay: "0.4s", size: 1.5 },
        { top: "35%", left: "8%", delay: "2.8s", size: 2 },
      ].map((star, i) => (
        <div
          key={i}
          className={cn("absolute rounded-full ambient-star", theme.stars)}
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animation constants                                                */
/* ------------------------------------------------------------------ */

const FLIP_DURATION = 0.68; // seconds (CSS/framer)
const FLIP_EASE: [number, number, number, number] = [
  0.645, 0.045, 0.355, 1.0,
]; // easeInOutCubic
const FLIP_MS = FLIP_DURATION * 1000 + 30; // ms for setTimeout (+30 buffer)

/* ------------------------------------------------------------------ */
/*  StoryBook                                                          */
/* ------------------------------------------------------------------ */

export function StoryBook({ title, ageBand, pages, cover }: StoryBookProps) {
  /* ── Spread data ────────────────────────────────────────────────── */
  const spreads = useMemo(() => buildSpreads(pages, cover), [pages, cover]);
  const totalSpreads = spreads.length;

  /* ── State ──────────────────────────────────────────────────────── */
  /**
   * `spread`      – canonical current spread (updates after animation)
   * `leftDisplay` – which spread the left base panel shows
   *                 (lags behind `spread` during forward flips so the
   *                 old left image stays until the leaf finishes flipping)
   * `flipAnim`    – non-null only during the 700ms animation
   */
  const [spread, setSpread] = useState(0);
  const [leftDisplay, setLeftDisplay] = useState(0);
  const [flipAnim, setFlipAnim] = useState<{
    from: number;
    to: number;
    dir: 1 | -1;
  } | null>(null);
  const [isImmersive, setIsImmersive] = useState(false);
  const [immersiveThemeIndex, setImmersiveThemeIndex] = useState(0);

  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  /* Hover tilt springs (only wired up in normal mode) */
  const tiltX = useSpring(useMotionValue(0), { stiffness: 130, damping: 22, mass: 0.7 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 130, damping: 22, mass: 0.7 });

  /* Scale spring — dips briefly on page turn for a tactile feel */
  const bookScaleRaw = useMotionValue(1);
  const bookScale = useSpring(bookScaleRaw, { stiffness: 320, damping: 26, mass: 0.6 });

  const canGoBack = spread > 0 && !flipAnim;
  const canGoForward = spread < totalSpreads - 1 && !flipAnim;

  /* ── Cleanup timer on unmount ───────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (animTimer.current) clearTimeout(animTimer.current);
    };
  }, []);

  /* ── Navigate ───────────────────────────────────────────────────── */
  const navigate = useCallback(
    (dir: 1 | -1) => {
      const from = spread;
      const to = spread + dir;
      if (to < 0 || to >= totalSpreads || flipAnim) return;

      if (animTimer.current) clearTimeout(animTimer.current);

      /* Snap book tilt to neutral before the flip starts */
      tiltX.set(0);
      tiltY.set(0);

      /* Brief scale dip for tactile page-turn feel */
      bookScaleRaw.set(0.97);
      setTimeout(() => bookScaleRaw.set(1), 120);

      if (dir === -1) {
        // Backward: update left base IMMEDIATELY so destination left
        // image is ready when the leaf un-covers the left side.
        setLeftDisplay(to);
      }
      // Forward: leftDisplay stays at `from` until animation ends
      // (prevents the new image from popping in before the leaf rotates over)

      setFlipAnim({ from, to, dir });

      animTimer.current = setTimeout(() => {
        setSpread(to);
        if (dir === 1) setLeftDisplay(to); // now safe to show new left image
        setFlipAnim(null);
        animTimer.current = null;
      }, FLIP_MS);
    },
    [bookScaleRaw, flipAnim, spread, tiltX, tiltY, totalSpreads]
  );

  const flipForward = useCallback(() => navigate(1), [navigate]);
  const flipBackward = useCallback(() => navigate(-1), [navigate]);

  /* ── Immersive ──────────────────────────────────────────────────── */
  const enterImmersive = useCallback(() => setIsImmersive(true), []);
  const exitImmersive = useCallback(() => setIsImmersive(false), []);

  useEffect(() => {
    document.body.style.overflow = isImmersive ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isImmersive]);

  const canUsePortal = typeof document !== "undefined";
  const immersiveTheme =
    IMMERSIVE_THEMES[immersiveThemeIndex % IMMERSIVE_THEMES.length];

  /* ── Keyboard ───────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") flipForward();
      if (e.key === "ArrowLeft") flipBackward();
      if ((e.key === "f" || e.key === "F") && !isImmersive) enterImmersive();
      if (e.key === "Escape" && isImmersive) exitImmersive();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipForward, flipBackward, isImmersive, enterImmersive, exitImmersive]);

  /* ── Hover tilt (normal mode only) ─────────────────────────────── */
  const handleTiltMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (flipAnim) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5; // –0.5…0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      tiltY.set(nx * 9);  // max ±4.5° left/right
      tiltX.set(-ny * 5); // max ±2.5° up/down
    },
    [flipAnim, tiltX, tiltY]
  );

  const handleTiltLeave = useCallback(() => {
    tiltX.set(0);
    tiltY.set(0);
  }, [tiltX, tiltY]);

  /* ── PDF Download ────────────────────────────────────────────────── */
  const handleDownload = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      // 4:3 spread so each half is exactly 2:3 portrait (matches the on-screen book)
      const H = 210;
      const W = H * (4 / 3); // = 280mm  → left half 140×210, right half 140×210
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });

      /** Fetch an image URL and return a base64 data-URL (null on failure). */
      const fetchDataURL = async (src: string): Promise<string | null> => {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null as unknown as string);
            reader.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      };

      for (let i = 0; i < spreads.length; i++) {
        const s = spreads[i];
        if (i > 0) doc.addPage();

        /* ── Warm backgrounds ─────────────────────────────────────── */
        // Left page: warm ochre parchment
        doc.setFillColor(237, 226, 208);
        doc.rect(0, 0, W / 2, H, "F");
        // Right page: cool cream
        doc.setFillColor(253, 248, 240);
        doc.rect(W / 2, 0, W / 2, H, "F");
        // Subtle warm vignette on right page edges
        doc.setFillColor(248, 241, 230);
        doc.rect(W / 2, 0, W / 2, 6, "F");
        doc.rect(W / 2, H - 6, W / 2, 6, "F");

        /* ── Left: full-bleed illustration ───────────────────────── */
        const dataURL = await fetchDataURL(s.leftImage || cover);
        if (dataURL) {
          const fmt = dataURL.startsWith("data:image/png") ? "PNG" : "JPEG";
          try {
            doc.addImage(dataURL, fmt, 0, 0, W / 2, H, undefined, "MEDIUM");
          } catch { /* ignore */ }
        }

        /* ── Spine line ───────────────────────────────────────────── */
        doc.setDrawColor(195, 170, 135);
        doc.setLineWidth(0.3);
        doc.line(W / 2, 0, W / 2, H);

        /* ── Decorative border rules (right page only) ────────────── */
        doc.setDrawColor(210, 182, 148);
        doc.setLineWidth(0.35);
        doc.line(W / 2 + 8, 9, W - 9, 9);       // top rule
        doc.line(W / 2 + 8, H - 9, W - 9, H - 9); // bottom rule

        /* ── Right: text content ──────────────────────────────────── */
        const rp = s.rightPage;
        const PX = W / 2 + 12;  // text X
        const maxTW = W / 2 - 22; // max text width
        let TY = 22;

        if (rp === null) {
          /* End-of-book */
          doc.setFont("helvetica", "italic");
          doc.setFontSize(11);
          doc.setTextColor(140, 110, 80);
          doc.text("~ Story Complete ~", W * 3 / 4, H / 2, { align: "center" });
        } else if (rp.isTitle) {
          /* Title spread */
          doc.setFont("helvetica", "bold");
          doc.setFontSize(21);
          doc.setTextColor(43, 24, 10);
          const tLines = doc.splitTextToSize((rp as { title?: string }).title || title, maxTW);
          doc.text(tLines, W * 3 / 4, H / 2 - 14, { align: "center" });

          /* Decorative center rule */
          const ruleW = 28;
          doc.setDrawColor(195, 160, 110);
          doc.setLineWidth(0.4);
          doc.line(W * 3 / 4 - ruleW / 2, H / 2 - 6, W * 3 / 4 + ruleW / 2, H / 2 - 6);

          if (rp.text) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9.5);
            doc.setTextColor(120, 90, 65);
            const subLines = doc.splitTextToSize(rp.text, maxTW - 10);
            doc.text(subLines, W * 3 / 4, H / 2 + 4, {
              align: "center",
              lineHeightFactor: 1.65,
            });
          }
        } else if (rp.isEnd) {
          /* End page */
          doc.setFont("helvetica", "bold");
          doc.setFontSize(22);
          doc.setTextColor(43, 24, 10);
          doc.text("The End", W * 3 / 4, H / 2 - 8, { align: "center" });
          if (rp.text) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(110, 80, 60);
            doc.text(doc.splitTextToSize(rp.text, maxTW - 15), W * 3 / 4, H / 2 + 6, {
              align: "center",
              lineHeightFactor: 1.65,
            });
          }
        } else {
          /* Regular story page */
          if (rp.chapter) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(175, 115, 45);
            doc.text(rp.chapter.toUpperCase(), PX, TY);
            TY += 4.5;
            doc.setDrawColor(210, 175, 130);
            doc.setLineWidth(0.3);
            doc.line(PX, TY, PX + 26, TY);
            TY += 8;
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(43, 24, 10);
          const lines = doc.splitTextToSize(rp.text, maxTW);
          doc.text(lines, PX, TY, { lineHeightFactor: 1.8 });
        }

        /* ── Footer ───────────────────────────────────────────────── */
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(175, 148, 115);
        doc.text(String(i + 1), W * 3 / 4, H - 4, { align: "center" });

        /* DREAM watermark */
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(195, 168, 132);
        doc.text("DREAM", W - 8, H - 4, { align: "right" });

        /* Story title in footer */
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(190, 162, 128);
        const titleTrunc = title.length > 30 ? title.slice(0, 28) + "…" : title;
        doc.text(titleTrunc, PX, H - 4);
      }

      const filename = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-dream.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("[Dream] PDF export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [spreads, cover, title, isExporting]);

  /* ── Derived display values ─────────────────────────────────────── */
  // Right-base display logic:
  //  • Forward flip  (leaf starts on RIGHT, moves to LEFT):
  //      Show the DESTINATION spread immediately — it gets revealed
  //      from beneath as the leaf sweeps away to the left. ✓
  //  • Backward flip (leaf starts on LEFT, moves to RIGHT):
  //      Keep showing the SOURCE spread — the right side is fully
  //      open during the whole animation; switching immediately would
  //      cause a visible text jump. The switch to destination happens
  //      at the very end, exactly when the leaf covers the right side.
  const rightDisplayIdx = flipAnim
    ? flipAnim.dir === 1
      ? flipAnim.to   // forward  → show destination
      : flipAnim.from // backward → keep source until leaf covers right
    : spread;

  /* ── Progress dots ──────────────────────────────────────────────── */
  const renderDots = (immersive: boolean) => (
    <div className="flex items-center gap-1 px-2">
      {Array.from({ length: totalSpreads }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === spread ? 10 : 6,
            height: i === spread ? 10 : 6,
            opacity: i === spread ? 1 : i < spread ? (immersive ? 0.55 : 0.45) : immersive ? 0.2 : 0.8,
          }}
          transition={{ type: "spring", stiffness: 250, damping: 20, mass: 0.45 }}
          className={cn(
            "rounded-full",
            immersive
              ? i === spread
                ? "bg-white shadow-sm shadow-white/30"
                : i < spread
                  ? "bg-white/40"
                  : "bg-white/15"
              : i === spread
                ? "bg-primary shadow-sm shadow-primary/30"
                : i < spread
                  ? "bg-primary/30"
                  : "bg-border"
          )}
        />
      ))}
    </div>
  );

  /* ================================================================ */
  /*  Book renderer                                                    */
  /* ================================================================ */

  const renderBook = (maxW: number, immersive: boolean) => {
    const bgLeft = immersive ? PAGE_BG_LEFT_IM : PAGE_BG_LEFT;
    const bgRight = immersive ? PAGE_BG_RIGHT_IM : PAGE_BG_RIGHT;
    const borderLeft = immersive
      ? "border-y border-l border-white/[0.08]"
      : "border-y border-l border-border/30";
    const borderRight = immersive
      ? "border-y border-r border-white/[0.08]"
      : "border-y border-r border-border/30";

    // Which spread's left content to show in the flip leaf's faces
    const flipFrontIdx = flipAnim ? (flipAnim.dir === 1 ? flipAnim.from : flipAnim.to) : 0;
    const flipFront = flipAnim ? spreads[flipFrontIdx] : null;
    const flipBack = flipAnim
      ? spreads[flipAnim.dir === 1 ? flipAnim.to : flipAnim.from]
      : null;

    // Single-page mode: cover (spread 0) and end spread have no right page.
    // While a flip is in progress we always use two-page layout so the leaf
    // has room to animate; the snap to full-width happens after the flip ends.
    const isLeftFull = spreads[leftDisplay].rightPage === null && !flipAnim;

    return (
      <motion.div
        className={cn("relative w-full mx-auto select-none", immersive && "max-h-[68vh]")}
        animate={{ maxWidth: isLeftFull ? maxW / 2 : maxW }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        style={{
          perspective: "2200px",
          aspectRatio: isLeftFull ? "2 / 3" : "4 / 3",
          transition: "aspect-ratio 0.48s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* ── Book shadow (grows + brightens while page is turning) ── */}
        <motion.div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-[100%] pointer-events-none"
          animate={{
            width: flipAnim ? "93%" : "88%",
            opacity: immersive
              ? (flipAnim ? 0.42 : 0.28)
              : (flipAnim ? 0.14 : 0.07),
          }}
          transition={{ duration: 0.38, ease: "easeInOut" }}
          style={{
            height: immersive ? 44 : 22,
            background: "black",
            filter: immersive ? "blur(30px)" : "blur(18px)",
          }}
        />

        {/* ── Left page base ──────────────────────────────────────── */}
        <div
          className={cn(
            "absolute left-0 top-0 h-full overflow-hidden",
            isLeftFull ? "rounded-2xl w-full" : "rounded-l-2xl w-1/2",
            borderLeft
          )}
          style={{
            background: bgLeft,
            boxShadow: immersive
              ? "inset -8px 0 20px -8px rgba(0,0,0,0.12)"
              : "inset -6px 0 14px -6px rgba(0,0,0,0.07)",
          }}
        >
          <LeftPanel
            spread={spreads[leftDisplay]}
            cover={cover}
            immersive={immersive}
          />
        </div>

        {/* ── Right page base (hidden in single-page mode) ──────────── */}
        <AnimatePresence initial={false}>
          {!isLeftFull && (
            <motion.div
              key="right-page"
              className={cn(
                "absolute right-0 top-0 w-1/2 h-full rounded-r-2xl overflow-hidden",
                borderRight
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              style={{
                background: bgRight,
                boxShadow: immersive
                  ? "inset 8px 0 20px -8px rgba(0,0,0,0.08)"
                  : "inset 6px 0 14px -6px rgba(0,0,0,0.05)",
              }}
            >
              <RightPanel
                spread={spreads[rightDisplayIdx]}
                spreadIndex={rightDisplayIdx}
                totalSpreads={totalSpreads}
                immersive={immersive}
              />
              {/* Corner page-turn hint: pulses when there's a next page */}
              {!immersive && !flipAnim && canGoForward && (
                <motion.div
                  className="absolute bottom-2.5 right-2.5 z-[50] pointer-events-none"
                  animate={{ opacity: [0.28, 0.72, 0.28], x: [0, 2.5, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronRight className="size-3 text-primary/60" />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stacked page edges + spine (two-page mode only) ───────── */}
        <AnimatePresence initial={false}>
          {!isLeftFull && (
            <motion.div
              key="spine-and-edges"
              className="absolute inset-0 pointer-events-none"
              style={{ overflow: "visible" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div
                className="absolute top-[4%] bottom-[4%] z-[180] rounded-r-xl overflow-hidden"
                style={{
                  right: -3,
                  width: 5,
                  background:
                    "repeating-linear-gradient(to bottom, #ddd0bc 0px, #ddd0bc 1px, #f0e6d4 1px, #f0e6d4 2.5px)",
                  opacity: 0.5,
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 top-0 w-5 h-full z-[200]"
                style={{
                  background: immersive
                    ? "linear-gradient(to right,rgba(0,0,0,0.08)0%,rgba(0,0,0,0.03)25%,transparent 50%,rgba(0,0,0,0.03)75%,rgba(0,0,0,0.08)100%)"
                    : "linear-gradient(to right,rgba(0,0,0,0.05)0%,rgba(0,0,0,0.02)25%,transparent 50%,rgba(0,0,0,0.02)75%,rgba(0,0,0,0.05)100%)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Single animated flip leaf ────────────────────────────── */}
        {/* Only exists for the ~700ms of the animation.
            NO AnimatePresence wrapper — without an `exit` prop AP would
            animate the leaf back to `initial` on unmount, visually
            reversing the flip. Plain conditional rendering lets React
            unmount it instantly at its final rotation. */}
        {flipAnim && flipFront && flipBack && (
          <motion.div
            key="flip-leaf"
            className="absolute top-0 h-full"
            style={{
              left: "50%",
              width: "50%",
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              zIndex: 300,
              willChange: "transform",
            }}
            initial={{ rotateY: flipAnim.dir === 1 ? 0 : -180 }}
            animate={{ rotateY: flipAnim.dir === 1 ? -180 : 0 }}
            transition={{ duration: FLIP_DURATION, ease: FLIP_EASE }}
          >
            {/* Front face (right side at 0°) */}
            <div
              className={cn(
                "absolute inset-0 rounded-r-2xl overflow-hidden",
                borderRight
              )}
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background: bgRight,
                boxShadow: "inset 2px 0 8px -2px rgba(0,0,0,0.04)",
              }}
            >
              {/* Forward: outgoing right text | Backward: arriving right text */}
              <RightPanel
                spread={flipFront}
                spreadIndex={flipFrontIdx}
                totalSpreads={totalSpreads}
                immersive={immersive}
              />
            </div>

            {/* Back face (left side at -180°) */}
            <div
              className={cn(
                "absolute inset-0 rounded-l-2xl overflow-hidden",
                borderLeft
              )}
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: bgLeft,
                boxShadow: "inset -2px 0 8px -2px rgba(0,0,0,0.06)",
              }}
            >
              {/* Forward: arriving left image | Backward: outgoing left image */}
              <LeftPanel
                spread={flipBack}
                cover={cover}
                immersive={immersive}
                hideCoverHint
              />
            </div>

            {/* Gloss sheen sweep */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-r-2xl">
              <div className="page-sheen-sweep absolute inset-y-0 left-[-20%] w-[45%] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            </div>
          </motion.div>
        )}

        {/* ── Click zones ─────────────────────────────────────────── */}
        <button
          type="button"
          onClick={flipBackward}
          disabled={!canGoBack}
          className="absolute left-0 top-0 h-full w-[20%] md:w-[14%] max-w-[110px] z-[250] opacity-0 disabled:cursor-default cursor-pointer"
          aria-label="Previous page"
        />
        <button
          type="button"
          onClick={flipForward}
          disabled={!canGoForward}
          className="absolute right-0 top-0 h-full w-[20%] md:w-[14%] max-w-[110px] z-[250] opacity-0 disabled:cursor-default cursor-pointer"
          aria-label="Next page"
        />
      </motion.div>
    );
  };

  /* ================================================================ */
  /*  Immersive portal                                                 */
  /* ================================================================ */

  const immersivePortal = canUsePortal
    ? createPortal(
        <AnimatePresence mode="wait">
          {isImmersive && (
            <motion.div
              key="immersive-reader"
              className="fixed inset-0 z-[2147483647] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Immersive story reader"
              style={{ isolation: "isolate" }}
              initial={{ scale: 1.012 }}
              animate={{ scale: 1 }}
              exit={{ scale: 1.006 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="absolute inset-0 bg-[#050509]" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={immersiveTheme.id}
                  className="absolute inset-0"
                  style={{ backgroundImage: immersiveTheme.backdrop }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeInOut" }}
                />
              </AnimatePresence>

              <AmbientBackground themeIndex={immersiveThemeIndex} />

              <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-2">
                {/* Theme picker */}
                <motion.button
                  type="button"
                  onClick={() =>
                    setImmersiveThemeIndex(
                      (p) => (p + 1) % IMMERSIVE_THEMES.length
                    )
                  }
                  whileHover={{ y: -1.5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3.5 py-2 text-[11px] font-semibold text-white/85 backdrop-blur-2xl transition-all hover:bg-black/65 hover:text-white md:left-6 md:top-6"
                >
                  <Palette className="size-3.5" />
                  <span className="hidden sm:inline">{immersiveTheme.label}</span>
                </motion.button>

                {/* Close */}
                <motion.button
                  type="button"
                  onClick={exitImmersive}
                  whileHover={{ y: -1.5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3.5 py-2 text-[11px] font-semibold text-white/85 backdrop-blur-2xl transition-all hover:bg-black/65 hover:text-white md:right-6 md:top-6"
                >
                  <X className="size-3.5" />
                  <span className="hidden sm:inline">Close</span>
                </motion.button>

                {/* Book */}
                <motion.div
                  className="relative max-h-[72vh] w-full flex-shrink-0 px-4 md:px-8"
                  style={{ maxWidth: 940 }}
                  initial={{ opacity: 0, y: 22, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.05,
                  }}
                >
                  <div
                    className="absolute inset-0 -inset-x-8 pointer-events-none"
                    style={{ backgroundImage: immersiveTheme.glow }}
                  />
                  <div
                    style={{
                      filter:
                        "drop-shadow(0 4px 80px rgba(200,160,80,0.06)) drop-shadow(0 20px 40px rgba(0,0,0,0.4))",
                    }}
                  >
                    {renderBook(880, true)}
                  </div>
                </motion.div>

                {/* Glass control bar */}
                <motion.div
                  className="mt-5 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-2 backdrop-blur-2xl shadow-2xl shadow-black/30 md:mt-7 md:gap-4 md:px-5 md:py-2.5"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.45,
                    delay: 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <p className="hidden max-w-[180px] truncate text-[11px] font-medium text-white/70 lg:block">
                    {title}
                  </p>
                  <div className="hidden h-4 w-px bg-white/15 lg:block" />

                  <motion.button
                    type="button"
                    onClick={flipBackward}
                    disabled={!canGoBack}
                    whileHover={canGoBack ? { y: -1, scale: 1.02 } : undefined}
                    whileTap={canGoBack ? { scale: 0.98 } : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
                      canGoBack
                        ? "text-white/85 hover:bg-white/[0.12] hover:text-white"
                        : "cursor-not-allowed text-white/30"
                    )}
                  >
                    <ChevronLeft className="size-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </motion.button>

                  {renderDots(true)}

                  <motion.button
                    type="button"
                    onClick={flipForward}
                    disabled={!canGoForward}
                    whileHover={
                      canGoForward ? { y: -1, scale: 1.02 } : undefined
                    }
                    whileTap={canGoForward ? { scale: 0.98 } : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
                      canGoForward
                        ? "text-white/85 hover:bg-white/[0.12] hover:text-white"
                        : "cursor-not-allowed text-white/30"
                    )}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="size-3.5" />
                  </motion.button>

                  <div className="hidden h-4 w-px bg-white/15 lg:block" />
                  <p className="hidden items-center gap-1.5 text-[10px] font-medium text-white/55 lg:flex">
                    Press ESC to close
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  /* ================================================================ */
  /*  Normal mode                                                      */
  /* ================================================================ */

  return (
    <>
      {immersivePortal}

      {!isImmersive && (
        <motion.section
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5 rounded-3xl border border-border bg-card p-4 shadow-sm md:p-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Link
                href="/dashboard/stories"
                className="group inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground mb-2"
              >
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back to Stories
              </Link>
              <h2 className="text-lg md:text-2xl font-black tracking-tight text-foreground leading-tight">
                {title}
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground pt-0.5">
                Age {ageBand} &middot; {pages.length} pages
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                <BookOpen className="size-3.5" />
                Press F for immersive
              </div>
              <motion.button
                type="button"
                onClick={handleDownload}
                disabled={isExporting}
                whileHover={!isExporting ? { y: -1.5, scale: 1.02 } : undefined}
                whileTap={!isExporting ? { scale: 0.98 } : undefined}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-semibold text-foreground transition-all hover:border-emerald-400/50 hover:bg-emerald-50 hover:text-emerald-700 micro-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isExporting ? "Exporting…" : "Download"}
                </span>
              </motion.button>
              <motion.button
                type="button"
                onClick={enterImmersive}
                whileHover={{ y: -1.5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary micro-btn"
              >
                <Maximize2 className="size-3.5" />
                <span className="hidden sm:inline">Immersive</span>
              </motion.button>
            </div>
          </div>

          {/* Book — 3D hover tilt wrapper */}
          <div className="flex justify-center py-1 md:py-4">
            <motion.div
              className="w-full"
              onMouseMove={handleTiltMove}
              onMouseLeave={handleTiltLeave}
              style={{
                perspective: "1400px",
                rotateX: tiltX,
                rotateY: tiltY,
                scale: bookScale,
              }}
            >
              {renderBook(760, false)}
            </motion.div>
          </div>

          {/* Nav */}
          <div className="flex items-center justify-center gap-3">
            <motion.button
              type="button"
              onClick={flipBackward}
              disabled={!canGoBack}
              whileHover={canGoBack ? { y: -1.5, scale: 1.02 } : undefined}
              whileTap={canGoBack ? { scale: 0.98 } : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all micro-btn",
                canGoBack
                  ? "border-border bg-muted text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  : "border-border/40 bg-transparent text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Previous</span>
            </motion.button>

            {renderDots(false)}

            <motion.button
              type="button"
              onClick={flipForward}
              disabled={!canGoForward}
              whileHover={canGoForward ? { y: -1.5, scale: 1.02 } : undefined}
              whileTap={canGoForward ? { scale: 0.98 } : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all micro-btn",
                canGoForward
                  ? "border-border bg-muted text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  : "border-border/40 bg-transparent text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-3.5" />
            </motion.button>
          </div>
        </motion.section>
      )}
    </>
  );
}
