/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
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
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { StoryPage } from "@/lib/dashboard-data";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StoryBookProps {
  title: string;
  ageBand: string;
  pages: StoryPage[];
  cover: string;
}

const IMMERSIVE_THEMES = [
  {
    id: "nightfall",
    label: "Nightfall",
    backdrop: "radial-gradient(ellipse 120% 100% at 50% 10%, #1a1428 0%, #0e0e18 45%, #08080f 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(245, 190, 90, 0.05) 0%, transparent 72%)",
    orbs: ["bg-amber-500/[0.07]", "bg-indigo-500/[0.05]", "bg-teal-400/[0.04]", "bg-rose-400/[0.03]"],
    stars: "bg-white/45",
  },
  {
    id: "twilight",
    label: "Twilight",
    backdrop: "radial-gradient(ellipse 120% 100% at 50% 8%, #2a2145 0%, #1a1631 42%, #121022 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 72%)",
    orbs: ["bg-fuchsia-500/[0.08]", "bg-violet-500/[0.08]", "bg-sky-400/[0.05]", "bg-blue-500/[0.04]"],
    stars: "bg-white/35",
  },
  {
    id: "sunset",
    label: "Sunset",
    backdrop: "radial-gradient(ellipse 120% 100% at 50% 8%, #4a2619 0%, #2d1a13 44%, #1e130f 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(251, 146, 60, 0.11) 0%, transparent 72%)",
    orbs: ["bg-orange-400/[0.11]", "bg-amber-300/[0.08]", "bg-rose-400/[0.06]", "bg-yellow-300/[0.05]"],
    stars: "bg-amber-100/40",
  },
  {
    id: "aurora",
    label: "Aurora",
    backdrop: "radial-gradient(ellipse 120% 100% at 50% 8%, #0d2a2c 0%, #0b1f2b 44%, #08131e 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(56, 189, 248, 0.09) 0%, transparent 72%)",
    orbs: ["bg-emerald-400/[0.09]", "bg-cyan-400/[0.08]", "bg-sky-400/[0.06]", "bg-teal-300/[0.05]"],
    stars: "bg-cyan-50/40",
  },
  {
    id: "storybook-day",
    label: "Storybook Day",
    backdrop: "radial-gradient(ellipse 120% 100% at 50% 8%, #efe7d6 0%, #e8deca 44%, #ddd1bc 100%)",
    glow: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(180, 139, 85, 0.14) 0%, transparent 72%)",
    orbs: ["bg-amber-400/[0.12]", "bg-orange-300/[0.10]", "bg-yellow-300/[0.08]", "bg-rose-300/[0.06]"],
    stars: "bg-black/20",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Page content renderer                                              */
/* ------------------------------------------------------------------ */

function PageContent({
  page,
  pageIndex,
  totalPages,
  immersive,
}: {
  page: StoryPage | undefined;
  pageIndex: number;
  totalPages: number;
  immersive?: boolean;
}) {
  if (!page) return null;

  /* ── Title page ─────────────────────────────────────────────────── */
  if (page.isTitle) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-5 md:p-8 text-center">
        {page.illustration && (
          <div
            className={cn(
              "rounded-full overflow-hidden mb-4 md:mb-6 shadow-lg",
              immersive
                ? "w-28 h-28 md:w-40 md:h-40 border-4 border-white/20 shadow-amber-500/10"
                : "w-24 h-24 md:w-36 md:h-36 border-4 border-primary/20"
            )}
          >
            <img src={page.illustration} alt={page.title || ""} className="w-full h-full object-cover" />
          </div>
        )}
        <h2
          className={cn(
            "text-sm md:text-xl font-black leading-tight px-2 text-stone-900"
          )}
        >
          {page.title}
        </h2>
        <p className="mt-1.5 md:mt-2 text-[10px] md:text-sm text-stone-600 italic">{page.text}</p>
        <div className="mt-3 md:mt-5 flex items-center gap-1 text-primary">
          <BookOpenText className="size-3 md:size-4" />
          <span className="text-[9px] md:text-xs font-semibold">Turn the page to begin</span>
        </div>
      </div>
    );
  }

  /* ── End page ───────────────────────────────────────────────────── */
  if (page.isEnd) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-5 md:p-8 text-center">
        <Sparkles className={cn("size-8 md:size-12 mb-3 md:mb-4", immersive ? "text-amber-400/50" : "text-primary/60")} />
        <h3 className="text-base md:text-xl font-black text-stone-900">The End</h3>
        <p className="mt-2 md:mt-3 text-[10px] md:text-sm text-stone-600 leading-relaxed max-w-[220px]">
          {page.text}
        </p>
        {!immersive && (
          <Link
            href="/dashboard/stories"
            className="mt-4 md:mt-6 inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[10px] md:text-xs font-semibold text-foreground transition hover:bg-white/60 micro-btn"
          >
            <ArrowLeft className="size-3" />
            Back to Library
          </Link>
        )}
      </div>
    );
  }

  /* ── Regular story page ─────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full p-3.5 md:p-5">
      {page.chapter && (
        <p
          className={cn(
            "text-[8px] md:text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5 md:mb-2",
            immersive ? "text-amber-600/80" : "text-primary"
          )}
        >
          {page.chapter}
        </p>
      )}
      {page.illustration && (
        <div
          className={cn(
            "w-full rounded-lg md:rounded-xl overflow-hidden mb-2.5 md:mb-3 flex-shrink-0",
            immersive ? "h-24 md:h-36 shadow-md border border-black/5" : "h-20 md:h-32 shadow-sm border border-black/5"
          )}
        >
          <img src={page.illustration} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <p className="text-[10px] md:text-[13px] leading-[1.7] md:leading-[1.85] text-stone-800 font-medium flex-1">
        {page.text}
      </p>
      <p className="mt-auto pt-1.5 text-[8px] md:text-[10px] text-stone-500 text-center tabular-nums">
        {pageIndex + 1} / {totalPages}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ambient background                                                 */
/* ------------------------------------------------------------------ */

function AmbientBackground({ themeIndex }: { themeIndex: number }) {
  const theme = IMMERSIVE_THEMES[themeIndex % IMMERSIVE_THEMES.length];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Large warm orb — top-left */}
      <div className={cn("absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[140px] ambient-orb-1", theme.orbs[0])} />
      {/* Cool indigo orb — bottom-right */}
      <div className={cn("absolute -bottom-[18%] -right-[12%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full blur-[120px] ambient-orb-2", theme.orbs[1])} />
      {/* Subtle teal accent — center-right */}
      <div className={cn("absolute top-[25%] right-[5%] w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] rounded-full blur-[100px] ambient-orb-3", theme.orbs[2])} />
      {/* Faint rose — top-right */}
      <div className={cn("absolute -top-[5%] right-[20%] w-[20vw] h-[20vw] max-w-[280px] max-h-[280px] rounded-full blur-[80px] ambient-orb-2", theme.orbs[3])} />

      {/* Scattered ambient stars */}
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
/*  StoryBook                                                          */
/* ------------------------------------------------------------------ */

export function StoryBook({ title, ageBand, pages, cover }: StoryBookProps) {
  const [flippedCount, setFlippedCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingLeaf, setAnimatingLeaf] = useState<number | null>(null);
  const [isImmersive, setIsImmersive] = useState(false);
  const [immersiveThemeIndex, setImmersiveThemeIndex] = useState(0);

  const totalLeaves = Math.ceil(pages.length / 2);
  const canGoBack = flippedCount > 0 && !isAnimating;
  const canGoForward = flippedCount < totalLeaves && !isAnimating;

  /* ── Flip helpers ───────────────────────────────────────────────── */

  const flipForward = useCallback(() => {
    if (isAnimating || flippedCount >= totalLeaves) return;
    setIsAnimating(true);
    setAnimatingLeaf(flippedCount);
    setFlippedCount((prev) => prev + 1);
    setTimeout(() => {
      setIsAnimating(false);
      setAnimatingLeaf(null);
    }, 700);
  }, [isAnimating, flippedCount, totalLeaves]);

  const flipBackward = useCallback(() => {
    if (isAnimating || flippedCount <= 0) return;
    setIsAnimating(true);
    setAnimatingLeaf(flippedCount - 1);
    setFlippedCount((prev) => prev - 1);
    setTimeout(() => {
      setIsAnimating(false);
      setAnimatingLeaf(null);
    }, 700);
  }, [isAnimating, flippedCount]);

  /* ── Immersive toggle ─────────────────────────────────────────── */

  const enterImmersive = useCallback(() => {
    setIsImmersive(true);
  }, []);

  const exitImmersive = useCallback(() => {
    setIsImmersive(false);
  }, []);

  // Lock body scroll in immersive mode
  useEffect(() => {
    if (isImmersive) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isImmersive]);

  const canUsePortal = typeof document !== "undefined";
  const immersiveTheme = IMMERSIVE_THEMES[immersiveThemeIndex % IMMERSIVE_THEMES.length];

  /* ── Keyboard ───────────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture keystrokes from inputs
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

  /* ── Z-index logic ──────────────────────────────────────────────── */

  const isFlipped = (i: number) => i < flippedCount;

  const getZIndex = (i: number) => {
    if (i === animatingLeaf) return totalLeaves * 3;
    if (isFlipped(i)) return i + 1;
    return totalLeaves * 2 - i;
  };

  /* ── Book renderer ──────────────────────────────────────────────── */

  const renderBook = (maxW: number, immersive: boolean) => (
    <div
      className={cn("relative w-full mx-auto", immersive && "max-h-[68vh]")}
      style={{
        perspective: "2400px",
        maxWidth: maxW,
        aspectRatio: "7 / 5",
      }}
    >
      {/* Book shadow */}
      <div
        className={cn(
          "absolute -bottom-3 left-1/2 -translate-x-1/2 w-[88%] rounded-[100%] pointer-events-none",
          immersive ? "h-10 bg-black/30 blur-2xl" : "h-6 bg-black/[0.07] blur-xl"
        )}
      />

      {/* ── Left page base ──────────────────────────────────────── */}
      <div
        className={cn(
          "absolute left-0 top-0 w-1/2 h-full rounded-l-2xl overflow-hidden",
          immersive ? "border-y border-l border-white/[0.08]" : "border-y border-l border-border/30"
        )}
        style={{
          background: immersive
            ? "linear-gradient(135deg, #f2ead8 0%, #f9f2e3 50%, #f5edd8 100%)"
            : "linear-gradient(135deg, #f0e9dc 0%, #f7f1e5 50%, #f4eddf 100%)",
          boxShadow: immersive
            ? "inset -8px 0 20px -8px rgba(0,0,0,0.12)"
            : "inset -6px 0 14px -6px rgba(0,0,0,0.07)",
        }}
      >
        {flippedCount === 0 && (
          <div className="flex flex-col items-center justify-center h-full select-none">
            <div
              className={cn(
                "rounded-xl overflow-hidden shadow-md mb-3",
                immersive
                  ? "w-24 h-24 md:w-32 md:h-32 border-2 border-white/20"
                  : "w-20 h-20 md:w-28 md:h-28 border-2 border-primary/10"
              )}
            >
              <img src={cover} alt="" className="w-full h-full object-cover" />
            </div>
            <BookOpen className={cn("size-5 md:size-6 mb-1", immersive ? "text-amber-600/30" : "text-primary/25")} />
            <p className="text-[9px] md:text-[11px] text-stone-500 italic font-medium">Open the cover</p>
          </div>
        )}
      </div>

      {/* ── Right page base ─────────────────────────────────────── */}
      <div
        className={cn(
          "absolute right-0 top-0 w-1/2 h-full rounded-r-2xl overflow-hidden",
          immersive ? "border-y border-r border-white/[0.08]" : "border-y border-r border-border/30"
        )}
        style={{
          background: immersive
            ? "linear-gradient(225deg, #f2ead8 0%, #fdf6e8 50%, #f8f1df 100%)"
            : "linear-gradient(225deg, #f0e9dc 0%, #faf5ec 50%, #f6f0e4 100%)",
          boxShadow: immersive
            ? "inset 8px 0 20px -8px rgba(0,0,0,0.08)"
            : "inset 6px 0 14px -6px rgba(0,0,0,0.05)",
        }}
      >
        {flippedCount === totalLeaves && (
          <div className="flex flex-col items-center justify-center h-full select-none">
            <Sparkles className={cn("size-5 md:size-6 mb-1", immersive ? "text-amber-500/30" : "text-primary/25")} />
            <p className="text-[9px] md:text-[11px] text-stone-500 italic font-medium">Story complete</p>
          </div>
        )}
      </div>

      {/* ── Spine ───────────────────────────────────────────────── */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-5 h-full z-[200] pointer-events-none"
        style={{
          background: immersive
            ? "linear-gradient(to right, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 25%, transparent 50%, rgba(0,0,0,0.03) 75%, rgba(0,0,0,0.08) 100%)"
            : "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 25%, transparent 50%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.05) 100%)",
        }}
      />

      {/* ── Leaves ──────────────────────────────────────────────── */}
      {Array.from({ length: totalLeaves }, (_, leafIndex) => {
        const flipped = isFlipped(leafIndex);
        const zIndex = getZIndex(leafIndex);
        const frontPageIdx = leafIndex * 2;
        const backPageIdx = leafIndex * 2 + 1;
        const isCurrentlyAnimating = leafIndex === animatingLeaf;

        return (
          <div
            key={leafIndex}
            className="absolute right-0 top-0 w-1/2 h-full"
            style={{
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              transform: `rotateY(${flipped ? -180 : 0}deg)`,
              transition: isCurrentlyAnimating
                ? "transform 0.7s cubic-bezier(0.645, 0.045, 0.355, 1)"
                : "none",
              zIndex,
            }}
          >
            {/* Front face (right page) */}
            <div
              className={cn(
                "absolute inset-0 rounded-r-2xl overflow-hidden",
                immersive ? "border-y border-r border-white/[0.08]" : "border-y border-r border-border/30"
              )}
              style={{
                backfaceVisibility: "hidden",
                background: immersive
                  ? "linear-gradient(225deg, #f2ead8 0%, #fdf6e8 50%, #f8f1df 100%)"
                  : "linear-gradient(225deg, #f0e9dc 0%, #faf5ec 50%, #f6f0e4 100%)",
                boxShadow: "inset 2px 0 8px -2px rgba(0,0,0,0.04)",
              }}
            >
              <PageContent page={pages[frontPageIdx]} pageIndex={frontPageIdx} totalPages={pages.length} immersive={immersive} />
            </div>

            {/* Back face (left page) */}
            <div
              className={cn(
                "absolute inset-0 rounded-l-2xl overflow-hidden",
                immersive ? "border-y border-l border-white/[0.08]" : "border-y border-l border-border/30"
              )}
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: immersive
                  ? "linear-gradient(135deg, #f2ead8 0%, #f9f2e3 50%, #f5edd8 100%)"
                  : "linear-gradient(135deg, #f0e9dc 0%, #f7f1e5 50%, #f4eddf 100%)",
                boxShadow: "inset -2px 0 8px -2px rgba(0,0,0,0.06)",
              }}
            >
              {backPageIdx < pages.length && (
                <PageContent page={pages[backPageIdx]} pageIndex={backPageIdx} totalPages={pages.length} immersive={immersive} />
              )}
            </div>

            {/* Page turn sheen for a cleaner premium flip effect */}
            {isCurrentlyAnimating && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="page-sheen-sweep absolute inset-y-0 left-[-20%] w-[45%] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </div>
            )}
          </div>
        );
      })}

      {/* ── Click zones ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={flipBackward}
        disabled={!canGoBack}
        className="absolute left-0 top-0 w-1/2 h-full z-[300] opacity-0 disabled:cursor-default cursor-pointer"
        aria-label="Previous page"
      />
      <button
        type="button"
        onClick={flipForward}
        disabled={!canGoForward}
        className="absolute right-0 top-0 w-1/2 h-full z-[300] opacity-0 disabled:cursor-default cursor-pointer"
        aria-label="Next page"
      />
    </div>
  );

  /* ── Progress dots ──────────────────────────────────────────────── */

  const renderDots = (immersive: boolean) => (
    <div className="flex items-center gap-1 px-2">
      {Array.from({ length: totalLeaves + 1 }, (_, i) => (
        <motion.div
          key={i}
          animate={
            immersive
              ? {
                  width: i === flippedCount ? 10 : 6,
                  height: i === flippedCount ? 10 : 6,
                  opacity: i === flippedCount ? 1 : i < flippedCount ? 0.55 : 0.2,
                }
              : {
                  width: i === flippedCount ? 10 : 6,
                  height: i === flippedCount ? 10 : 6,
                  opacity: i === flippedCount ? 1 : i < flippedCount ? 0.45 : 0.8,
                }
          }
          transition={{ type: "spring", stiffness: 250, damping: 20, mass: 0.45 }}
          className={cn(
            "rounded-full transition-all duration-300",
            immersive
              ? i === flippedCount
                ? "size-2.5 bg-white shadow-sm shadow-white/30"
                : i < flippedCount
                  ? "size-1.5 bg-white/40"
                  : "size-1.5 bg-white/15"
              : i === flippedCount
                ? "size-2.5 bg-primary shadow-sm shadow-primary/30"
                : i < flippedCount
                  ? "size-1.5 bg-primary/30"
                  : "size-1.5 bg-border"
          )}
        />
      ))}
    </div>
  );

  /* ── Render ─────────────────────────────────────────────────────── */

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
              {/* Always-opaque guard layer to prevent showing underlying app */}
              <div className="absolute inset-0 bg-[#050509]" />

              {/* ── Backdrop (cross-fade per theme) ───────────────── */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={immersiveTheme.id}
                  className="absolute inset-0 bg-[#08080f]"
                  style={{
                    backgroundImage: immersiveTheme.backdrop,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeInOut" }}
                />
              </AnimatePresence>

              <AmbientBackground themeIndex={immersiveThemeIndex} />

              {/* ── Content layer ─────────────────────────────────── */}
              <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-2">
                {/* Theme switch button */}
                <motion.button
                  type="button"
                  onClick={() => setImmersiveThemeIndex((prev) => (prev + 1) % IMMERSIVE_THEMES.length)}
                  whileHover={{ y: -1.5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3.5 py-2 text-[11px] font-semibold text-white/85 backdrop-blur-2xl transition-all hover:bg-black/65 hover:text-white md:left-6 md:top-6"
                >
                  <Palette className="size-3.5" />
                  <span className="hidden sm:inline">{immersiveTheme.label}</span>
                </motion.button>

                {/* Close button */}
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
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                >
                  {/* Warm ambient glow behind the book */}
                  <div
                    className="absolute inset-0 -inset-x-8 pointer-events-none"
                    style={{
                      backgroundImage: immersiveTheme.glow,
                    }}
                  />
                  <div
                    className="immersive-book-float"
                    style={{
                      filter:
                        "drop-shadow(0 4px 80px rgba(200, 160, 80, 0.06)) drop-shadow(0 20px 40px rgba(0,0,0,0.4))",
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
                  transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="hidden max-w-[180px] truncate text-[11px] font-medium text-white/70 lg:block">{title}</p>
                  <div className="hidden h-4 w-px bg-white/15 lg:block" />

                  <motion.button
                    type="button"
                    onClick={flipBackward}
                    disabled={!canGoBack}
                    whileHover={canGoBack ? { y: -1, scale: 1.02 } : undefined}
                    whileTap={canGoBack ? { scale: 0.98 } : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
                      canGoBack ? "text-white/85 hover:bg-white/[0.12] hover:text-white" : "cursor-not-allowed text-white/30"
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
                    whileHover={canGoForward ? { y: -1, scale: 1.02 } : undefined}
                    whileTap={canGoForward ? { scale: 0.98 } : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
                      canGoForward ? "text-white/85 hover:bg-white/[0.12] hover:text-white" : "cursor-not-allowed text-white/30"
                    )}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="size-3.5" />
                  </motion.button>

                  <div className="hidden h-4 w-px bg-white/15 lg:block" />
                  <p className="hidden items-center gap-1.5 text-[10px] font-medium text-white/55 lg:flex">Press ESC to close</p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <>
      {/* ════════════════════════════════════════════════════════════ */}
      {/*  IMMERSIVE MODE                                             */}
      {/* ════════════════════════════════════════════════════════════ */}
      {immersivePortal}

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  NORMAL MODE                                                */}
      {/* ════════════════════════════════════════════════════════════ */}
      {!isImmersive && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5 rounded-3xl border border-border/60 bg-white/80 p-4 shadow-sm backdrop-blur md:p-6 dark:border-white/10 dark:bg-[#101010]/95"
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Link
                href="/dashboard/stories"
                className="group inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground mb-1"
              >
                <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
                Back to Stories
              </Link>
              <h2 className="text-lg md:text-2xl font-black tracking-tight text-foreground">{title}</h2>
              <p className="text-xs md:text-sm text-muted-foreground">
                Age {ageBand} &middot; {pages.length} pages
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                <BookOpen className="size-3.5" />
                Press F for immersive
              </div>
              <motion.button
                type="button"
                onClick={enterImmersive}
                whileHover={{ y: -1.5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted micro-btn dark:bg-[#151515] dark:border-white/10"
                title="Enter immersive reading mode"
              >
                <Maximize2 className="size-3.5" />
                <span className="hidden sm:inline">Immersive</span>
              </motion.button>
            </div>
          </div>

          {/* ── Book ────────────────────────────────────────────── */}
          <div className="flex justify-center py-2 md:py-6">{renderBook(720, false)}</div>

          {/* ── Navigation bar ──────────────────────────────────── */}
          <div className="flex items-center justify-center gap-3">
            <motion.button
              type="button"
              onClick={flipBackward}
              disabled={!canGoBack}
              whileHover={canGoBack ? { y: -1.5, scale: 1.02 } : undefined}
              whileTap={canGoBack ? { scale: 0.98 } : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border bg-white px-3.5 py-2 text-xs font-semibold transition micro-btn dark:bg-[#151515] dark:border-white/10",
                canGoBack ? "hover:bg-muted text-foreground" : "opacity-35 cursor-not-allowed text-muted-foreground"
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
                "inline-flex items-center gap-1 rounded-full border border-border bg-white px-3.5 py-2 text-xs font-semibold transition micro-btn dark:bg-[#151515] dark:border-white/10",
                canGoForward ? "hover:bg-muted text-foreground" : "opacity-35 cursor-not-allowed text-muted-foreground"
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
