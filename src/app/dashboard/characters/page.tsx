/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Check,
  Heart,
  Plus,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  getStoredCharactersServerSnapshot,
  getStoredCharactersSnapshot,
  subscribeStoredCharacters,
  type StoredCharacter,
} from "@/lib/custom-characters";
import { dashboardCharacters } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

type CharacterRecord = (typeof dashboardCharacters)[number] | StoredCharacter;

const AGE_TABS = ["All", "4-7", "5-8", "5-10", "6-9"] as const;

export default function DashboardCharactersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterRecord | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const easing = [0.22, 1, 0.36, 1] as const;

  const customCharacters = useSyncExternalStore(
    subscribeStoredCharacters,
    getStoredCharactersSnapshot,
    getStoredCharactersServerSnapshot,
  );

  const allCharacters = useMemo<CharacterRecord[]>(
    () => [...customCharacters, ...dashboardCharacters],
    [customCharacters],
  );

  const localCharacterIds = useMemo(
    () => new Set(customCharacters.map((char) => char.id)),
    [customCharacters],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allCharacters.filter((char) => {
      const matchesSearch =
        !q ||
        char.name.toLowerCase().includes(q) ||
        char.role.toLowerCase().includes(q) ||
        char.mood.toLowerCase().includes(q);
      const matchesAge = activeTab === "All" || char.ageBand === activeTab;
      return matchesSearch && matchesAge;
    });
  }, [allCharacters, searchQuery, activeTab]);

  const handleCopyId = async () => {
    if (!selectedCharacter) return;
    await navigator.clipboard.writeText(selectedCharacter.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.4, ease: easing }
        }
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              Characters
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {allCharacters.length} in your vault
            </p>
          </div>

          <Link
            href="/dashboard/characters/new-character"
            className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-95 micro-btn md:text-sm"
          >
            <Plus className="size-4 transition-transform group-hover:rotate-90" />
            New Character
          </Link>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              ref={searchRef}
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 rounded-full border border-border/80 bg-white/80 py-2 pl-9 pr-3 text-xs font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:w-60 focus:border-primary/40 focus:bg-white focus:shadow-sm dark:bg-white/5 dark:focus:bg-white/10 sm:w-52"
            />
          </div>

          <div className="h-5 w-px bg-border/60 dark:bg-white/10" />

          <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-white/60 p-0.5 dark:bg-white/5">
            {AGE_TABS.map((tab) => {
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "relative overflow-hidden rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    isActive
                      ? "text-background"
                      : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="character-age-pill"
                      className="absolute inset-0 rounded-full bg-foreground shadow-sm"
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 430, damping: 34 }
                      }
                    />
                  )}
                  <span className="relative z-10">{tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Session badge ───────────────────────────────────────── */}
        {customCharacters.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.32, ease: easing }
            }
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary"
          >
            <motion.span
              animate={
                prefersReducedMotion ? undefined : { scale: [1, 1.08, 1], rotate: [0, -8, 0] }
              }
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}
            >
              <Sparkles className="size-3" />
            </motion.span>
            {customCharacters.length} created this session
          </motion.div>
        )}

        {/* ── Character Grid ──────────────────────────────────────── */}
        <div className="mt-6">
          <motion.div
            layout
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((char, index) => {
                const isLocal = localCharacterIds.has(char.id);
                const isHovered = hoveredId === char.id;

                return (
                  <motion.div
                    key={char.id}
                    layout
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
                    whileHover={
                      prefersReducedMotion
                        ? undefined
                        : {
                            y: -6,
                            scale: 1.015,
                            transition: { type: "spring", stiffness: 380, damping: 28 },
                          }
                    }
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.3, delay: index * 0.04, ease: easing }
                    }
                    className="group relative cursor-pointer"
                    onMouseEnter={() => setHoveredId(char.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedCharacter(char)}
                  >
                    <div
                      className={cn(
                        "relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted/40 shadow-sm transition-all duration-300",
                        isHovered
                          ? "shadow-xl shadow-black/15 ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                          : "hover:shadow-lg",
                      )}
                    >
                      <img
                        src={char.avatar}
                        alt={char.name}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
                      />

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <motion.div
                        aria-hidden="true"
                        initial={false}
                        animate={
                          prefersReducedMotion
                            ? { opacity: 0 }
                            : {
                                opacity: isHovered ? 1 : 0,
                                x: isHovered ? 0 : -8,
                              }
                        }
                        transition={{ duration: 0.24, ease: easing }}
                        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-white/30 mix-blend-screen"
                      />

                      {/* New badge */}
                      {isLocal && (
                        <motion.span
                          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.86, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={
                            prefersReducedMotion
                              ? { duration: 0 }
                              : { duration: 0.24, ease: easing, delay: 0.05 }
                          }
                          className="absolute left-2.5 top-2.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm"
                        >
                          New
                        </motion.span>
                      )}

                      {/* Hover heart */}
                      <motion.button
                        type="button"
                        initial={false}
                        animate={
                          prefersReducedMotion
                            ? { opacity: isHovered ? 1 : 0 }
                            : {
                                opacity: isHovered ? 1 : 0,
                                scale: isHovered ? 1 : 0.82,
                                y: isHovered ? 0 : -4,
                              }
                        }
                        whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: easing }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition hover:bg-primary hover:text-primary-foreground",
                          !isHovered && "pointer-events-none",
                        )}
                        aria-label="Favorite"
                      >
                        <Heart className="size-3.5" />
                      </motion.button>

                      {/* Bottom info */}
                      <motion.div
                        className="absolute inset-x-0 bottom-0 p-3"
                        initial={false}
                        animate={prefersReducedMotion ? { y: 0 } : { y: isHovered ? -2 : 0 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: easing }}
                      >
                        <p className="truncate text-sm font-bold leading-tight text-white drop-shadow-sm">
                          {char.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-white/70">
                          {char.role}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                            {char.ageBand}
                          </span>
                          <div className="flex gap-0.5">
                            {char.palette.map((color) => (
                              <span
                                key={color}
                                className="size-2.5 rounded-full ring-1 ring-white/30"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Empty state ─────────────────────────────────────────── */}
        {filtered.length === 0 && (
          <div className="mt-10 flex flex-col items-center py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted/60">
              <User className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              No characters found
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Detail Modal (portalled to body) ──────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedCharacter && (
              <motion.div
                key="character-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
                onClick={() => setSelectedCharacter(null)}
              >
                <motion.div
                  key="character-modal"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.3, ease: easing }
                  }
                  className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-[#111111]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Hero banner */}
                  <div className="relative h-52 overflow-hidden sm:h-60">
                    <img
                      src={selectedCharacter.avatar}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-[#111111] dark:via-[#111111]/30" />

                    <motion.button
                      type="button"
                      onClick={() => setSelectedCharacter(null)}
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                      className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition hover:bg-black/50"
                    >
                      <X className="size-4" />
                    </motion.button>
                  </div>

                  {/* Body */}
                  <motion.div
                    className="relative -mt-12 px-6 pb-6"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.28, delay: 0.05, ease: easing }
                    }
                  >
                    {/* Avatar + name */}
                    <div className="flex items-end gap-4">
                      <div className="size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white shadow-lg dark:border-[#111111]">
                        <img
                          src={selectedCharacter.avatar}
                          alt={selectedCharacter.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 pb-1">
                        <h2 className="truncate text-lg font-black tracking-tight text-foreground">
                          {selectedCharacter.name}
                        </h2>
                        <p className="text-sm font-semibold text-primary">
                          {selectedCharacter.role}
                        </p>
                      </div>
                    </div>

                    {/* Meta pills */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground dark:bg-white/[0.06]">
                        Ages {selectedCharacter.ageBand}
                      </span>
                      <span className="rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground dark:bg-white/[0.06]">
                        {selectedCharacter.mood}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 dark:bg-white/[0.06]">
                        {selectedCharacter.palette.map((color) => (
                          <span
                            key={color}
                            className="size-3.5 rounded-full ring-1 ring-black/10"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                    </div>

                    {"description" in selectedCharacter &&
                      selectedCharacter.description && (
                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                          {selectedCharacter.description}
                        </p>
                      )}

                    {/* Actions */}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <motion.button
                        type="button"
                        whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 micro-btn"
                      >
                        <Sparkles className="size-4" />
                        Use in Story
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted micro-btn dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <Heart className="size-4" />
                        Favorite
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleCopyId}
                        whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted micro-btn dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        {copiedId ? (
                          <Check className="size-4 text-green-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                        {copiedId ? "Copied!" : "Copy ID"}
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
