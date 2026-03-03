/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Check,
  Heart,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { deleteJob, fetchJobs, getAssetUrl, type Job } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import styles from "../dashboard.module.css";

interface CharacterCard {
  id: string;
  name: string;
  role: string;
  mood: string;
  ageBand: string;
  avatar: string;
  description?: string;
  source: "job";
  jobId?: string;
}

function jobToCard(job: Job): CharacterCard {
  const backstory = job.result_payload?.backstory as {
    name?: string;
    archetype?: string;
    era?: string;
    origin?: string;
    narrative_backstory?: string;
    goals?: string[];
    flaws?: string[];
    visual_signifiers?: string[];
  } | undefined;

  const avatar =
    job.assets.length > 0
      ? getAssetUrl(job.id, job.assets[0].filename)
      : (job.result_payload?.image_url as string) || "";

  return {
    id: job.id,
    name: backstory?.name || job.title || "Unnamed Character",
    role: backstory?.archetype || "",
    mood: backstory?.era || backstory?.origin || "",
    ageBand: (job.input_payload?.age_band as string) || "All",
    avatar,
    description: backstory?.narrative_backstory,
    source: "job",
    jobId: job.id,
  };
}

const AGE_TABS = ["All", "4-7", "5-8", "5-10", "6-9"] as const;
const easing = [0.22, 1, 0.36, 1] as const;

export default function DashboardCharactersPage() {
  const router = useRouter();
  const [jobCharacters, setJobCharacters] = useState<CharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterCard | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const loadCharacters = useCallback(async () => {
    try {
      const data = await fetchJobs({ type: "character" });
      setJobCharacters(data.map(jobToCard));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadCharacters(); } finally { setRefreshing(false); }
  }, [loadCharacters]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  useEffect(() => {
    setDeleteError("");
  }, [selectedCharacter?.id]);

  const allCharacters = useMemo<CharacterCard[]>(
    () => jobCharacters,
    [jobCharacters],
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

  const handleDeleteCharacter = useCallback(async () => {
    if (!selectedCharacter) return;

    const confirmed = window.confirm(
      `Delete "${selectedCharacter.name}" from dashboard, database, and stored assets?`
    );
    if (!confirmed) return;

    setDeleteError("");
    setDeletingCharacterId(selectedCharacter.id);
    try {
      if (!selectedCharacter.jobId) {
        throw new Error("Missing character job id.");
      }
      const deleted = await deleteJob(selectedCharacter.jobId);
      if (!deleted) {
        throw new Error("Could not delete character job from backend.");
      }
      setJobCharacters((prev) => prev.filter((entry) => entry.id !== selectedCharacter.jobId));
      setSelectedCharacter(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Character deletion failed."
      );
    } finally {
      setDeletingCharacterId(null);
    }
  }, [selectedCharacter]);

  const handleUseCharacterInStory = useCallback(() => {
    if (!selectedCharacter) return;
    if (!selectedCharacter.jobId) return;

    const params = new URLSearchParams({
      mode: "story",
      characterId: selectedCharacter.jobId,
    });
    setSelectedCharacter(null);
    router.push(`/chat?${params.toString()}`);
  }, [router, selectedCharacter]);

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
        {/* ── Header ── */}
        <div className="flex items-end justify-between">
          <div>
            <h2 className={`${styles.halant} text-2xl`}>Characters</h2>
            <p className="mt-0.5 text-sm" style={{ color: "#9a7a65" }}>
              {allCharacters.length} in your vault
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-sm transition md:text-sm"
              style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
              onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.background = "#ede7dd"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </button>
            <Link
              href="/dashboard/characters/new-character"
              className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition md:text-sm"
              style={{ background: "#2b180a", color: "#f5e6d5" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Plus className="size-4 transition-transform group-hover:rotate-90" />
              New Character
            </Link>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2" style={{ color: "#9a7a65" }} />
            <input
              ref={searchRef}
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 rounded-full py-2 pl-9 pr-3 text-xs font-medium outline-none transition-all focus:w-60 focus:shadow-sm sm:w-52"
              style={{ background: "#fdf8f3", border: "1px solid #dbc9b7", color: "#2b180a" }}
            />
          </div>

          <div className="h-5 w-px" style={{ background: "#dbc9b7" }} />

          <div
            className="flex items-center gap-0.5 rounded-full p-0.5"
            style={{ border: "1px solid #dbc9b7", background: "rgb(253 248 243 / 0.6)" }}
          >
            {AGE_TABS.map((tab) => {
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="relative overflow-hidden rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                  style={{ color: isActive ? "#fdf8f3" : "#9a7a65" }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="character-age-pill"
                      className="absolute inset-0 rounded-full"
                      style={{ background: "#2b180a" }}
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

        {/* ── Loading ── */}
        {loading && (
          <div className="mt-12 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#dbc9b7] border-t-[#c9924e]" />
          </div>
        )}

        {/* ── Character Grid ── */}
        {!loading && (
          <div className="mt-6">
            <motion.div
              layout
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((char, index) => {
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
                          "relative aspect-[3/4] overflow-hidden rounded-2xl shadow-sm transition-all duration-300",
                          isHovered
                            ? "shadow-xl ring-2 ring-[#c9924e]/50 ring-offset-2"
                            : "hover:shadow-lg",
                        )}
                        style={{ background: "#ede7dd" }}
                      >
                        {char.avatar ? (
                          <img
                            src={char.avatar}
                            alt={char.name}
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <User className="size-12" style={{ color: "#9a7a65" }} />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <motion.div
                          aria-hidden="true"
                          initial={false}
                          animate={
                            prefersReducedMotion
                              ? { opacity: 0 }
                              : { opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -8 }
                          }
                          transition={{ duration: 0.24, ease: easing }}
                          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#c9924e]/30 via-transparent to-white/30 mix-blend-screen"
                        />

                        {char.source === "job" && (
                          <motion.span
                            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.86, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm"
                            style={{ background: "#065f46", color: "#d1fae5" }}
                          >
                            Job
                          </motion.span>
                        )}

                        <motion.button
                          type="button"
                          initial={false}
                          animate={
                            prefersReducedMotion
                              ? { opacity: isHovered ? 1 : 0 }
                              : { opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.82, y: isHovered ? 0 : -4 }
                          }
                          whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: easing }}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full text-white backdrop-blur-md transition",
                            !isHovered && "pointer-events-none",
                          )}
                          style={{ background: "rgba(0,0,0,0.3)" }}
                          aria-label="Favorite"
                        >
                          <Heart className="size-3.5" />
                        </motion.button>

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
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && (
          <div className="mt-10 flex flex-col items-center py-16 text-center">
            <div
              className="mb-3 flex size-12 items-center justify-center rounded-full"
              style={{ background: "#ede7dd" }}
            >
              <User className="size-5" style={{ color: "#9a7a65" }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#9a7a65" }}>No characters found</p>
            <p className="mt-1 text-xs" style={{ color: "#c4a88e" }}>
              {allCharacters.length === 0
                ? "Generate a character from the API Test page."
                : "Try adjusting your search or filters"}
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Detail Modal ── */}
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
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
                onClick={() => setSelectedCharacter(null)}
              >
                <motion.div
                  key="character-modal"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: easing }}
                  className="relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-2xl"
                  style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Hero banner */}
                  <div className="relative h-52 shrink-0 overflow-hidden sm:h-60">
                    {selectedCharacter.avatar ? (
                      <img
                        src={selectedCharacter.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ background: "#ede7dd" }}>
                        <User className="size-16" style={{ color: "#9a7a65" }} />
                      </div>
                    )}
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, #fdf8f3 0%, rgba(253,248,243,0.3) 40%, transparent 100%)" }}
                    />

                    <motion.button
                      type="button"
                      onClick={() => setSelectedCharacter(null)}
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                      className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-white backdrop-blur-md transition"
                      style={{ background: "rgba(0,0,0,0.3)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.3)")}
                    >
                      <X className="size-4" />
                    </motion.button>
                  </div>

                  {/* Body */}
                  <motion.div
                    className="relative -mt-12 flex min-h-0 flex-1 flex-col px-6 pb-6"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.28, delay: 0.05, ease: easing }}
                  >
                    <div className="flex items-end gap-4">
                      <div
                        className="size-20 shrink-0 overflow-hidden rounded-2xl shadow-lg"
                        style={{ border: "4px solid #fdf8f3" }}
                      >
                        {selectedCharacter.avatar ? (
                          <img src={selectedCharacter.avatar} alt={selectedCharacter.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center" style={{ background: "#ede7dd" }}>
                            <User className="size-8" style={{ color: "#9a7a65" }} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 pb-1">
                        <h2 className="truncate text-lg font-black tracking-tight" style={{ color: "#2b180a" }}>
                          {selectedCharacter.name}
                        </h2>
                        <p className="text-sm font-semibold" style={{ color: "#8b5e3c" }}>
                          {selectedCharacter.role}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className="rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ border: "1px solid #dbc9b7", background: "#f0e8dc", color: "#2b180a" }}
                      >
                        {`Ages ${selectedCharacter.ageBand}`}
                      </span>
                      {selectedCharacter.mood && (
                        <span
                          className="max-w-full truncate rounded-full px-3 py-1.5 text-xs font-medium"
                          style={{ border: "1px solid #dbc9b7", background: "#f0e8dc", color: "#2b180a" }}
                          title={selectedCharacter.mood}
                        >
                          {selectedCharacter.mood}
                        </span>
                      )}
                    </div>

                    {selectedCharacter.description && (
                      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                        <p className="text-sm leading-relaxed" style={{ color: "#6f5a4a" }}>
                          {selectedCharacter.description}
                        </p>
                      </div>
                    )}

                    {!selectedCharacter.description && <div className="mt-4" />}

                    <div className="mt-5 flex shrink-0 flex-wrap gap-2 border-t pt-4" style={{ borderColor: "#dbc9b7" }}>
                      {selectedCharacter.jobId && (
                        <Link
                          href={`/dashboard/jobs/${selectedCharacter.jobId}`}
                          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition"
                          style={{ background: "#2b180a", color: "#f5e6d5" }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                        >
                          View Job
                        </Link>
                      )}
                      <motion.button
                        type="button"
                        onClick={handleUseCharacterInStory}
                        whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition"
                        style={{
                          background: selectedCharacter.jobId ? "#fdf8f3" : "#2b180a",
                          color: selectedCharacter.jobId ? "#2b180a" : "#f5e6d5",
                          border: selectedCharacter.jobId ? "1px solid #dbc9b7" : "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        <Sparkles className="size-4" />
                        Use in Story
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition"
                        style={{ background: "#fdf8f3", border: "1px solid #dbc9b7", color: "#2b180a" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#ede7dd")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fdf8f3")}
                      >
                        <Heart className="size-4" />
                        Favorite
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleCopyId}
                        whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition"
                        style={{ background: "#fdf8f3", border: "1px solid #dbc9b7", color: "#2b180a" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#ede7dd")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fdf8f3")}
                      >
                        {copiedId ? (
                          <Check className="size-4 text-green-600" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                        {copiedId ? "Copied!" : "Copy ID"}
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleDeleteCharacter}
                        disabled={deletingCharacterId === selectedCharacter.id}
                        whileHover={prefersReducedMotion ? undefined : { y: -1.5 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ background: "#fff1ef", border: "1px solid #f0b4ad", color: "#8f2f24" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe7e3")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff1ef")}
                      >
                        <Trash2 className="size-4" />
                        {deletingCharacterId === selectedCharacter.id ? "Deleting..." : "Delete"}
                      </motion.button>
                    </div>
                    {deleteError && (
                      <p className="mt-2 text-xs font-semibold" style={{ color: "#a23b2f" }}>
                        {deleteError}
                      </p>
                    )}
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
