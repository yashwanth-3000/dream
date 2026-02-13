/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, MoreVertical, Search, BookMarked, FileText, BookOpenText } from "lucide-react";
import { motion } from "framer-motion";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { dashboardStories, dashboardStoryPages } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/* ── status config ─────────────────────────────────────────────── */

type StoryStatus = "Published" | "Draft";

const statusConfig: Record<
  StoryStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  Published: {
    label: "Published",
    icon: BookMarked,
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  Draft: {
    label: "Draft",
    icon: FileText,
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
  },
};

/* ── helpers ────────────────────────────────────────────────────── */

function previewItemsForStory(storyId: string) {
  const pages = dashboardStoryPages[storyId] ?? [];
  return pages
    .filter((p) => p.illustration)
    .slice(0, 3)
    .map((p, idx) => ({
      id: idx + 1,
      name: p.isTitle ? "Cover" : p.chapter ?? `Page ${idx + 1}`,
      image: p.illustration!,
    }));
}

function getPageCount(storyId: string) {
  return dashboardStoryPages[storyId]?.length ?? 0;
}

function getChapterCount(storyId: string) {
  const pages = dashboardStoryPages[storyId] ?? [];
  return pages.filter((p) => p.chapter).length;
}

/* ── page ───────────────────────────────────────────────────────── */

export default function DashboardStoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | StoryStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState("");
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onWindowClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!filterRef.current?.contains(target)) setFilterOpen(false);

      const inRowMenu = (event.target as HTMLElement | null)?.closest("[data-row-menu]");
      if (!inRowMenu) setRowMenuOpen("");
    };

    window.addEventListener("mousedown", onWindowClick);
    return () => window.removeEventListener("mousedown", onWindowClick);
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dashboardStories.filter((story) => {
      const matchesSearch =
        !q ||
        story.title.toLowerCase().includes(q) ||
        story.id.toLowerCase().includes(q) ||
        story.ageBand.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || story.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 rounded-3xl border border-border/60 bg-white dark:bg-[#141414]/80 p-4 shadow-sm backdrop-blur md:p-5 dark:border-white/10 dark:bg-[#101010]/95"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h2 className="text-2xl font-black tracking-tight text-foreground">All Stories</h2>
        <p className="text-sm text-muted-foreground">Browse, filter, and open your saved story adventures.</p>
      </div>

      {/* ── Search & Filter ────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search story title or id..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-border bg-white dark:bg-[#141414] py-2.5 pl-10 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-primary/50"
          />
        </div>

        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white dark:bg-[#141414] px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted micro-btn"
          >
            <Filter className="size-4" />
            Filter
            <ChevronDown className="size-4" />
          </button>
          {filterOpen && (
            <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-white dark:bg-[#141414] shadow-lg">
              {(["all", "Published", "Draft"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(s);
                    setFilterOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm font-medium transition hover:bg-muted",
                    selectedStatus === s ? "bg-primary/10 text-primary" : "text-foreground"
                  )}
                >
                  {s === "all" ? "All Status" : statusConfig[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop Table ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="hidden overflow-hidden rounded-2xl border border-border/70 bg-white dark:bg-[#141414] lg:block"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Story</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scenes</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Details</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filtered.map((story) => {
                const StatusIcon = statusConfig[story.status as StoryStatus]?.icon ?? BookOpenText;
                const badgeClass =
                  statusConfig[story.status as StoryStatus]?.badgeClass ??
                  "bg-muted text-muted-foreground border-border";
                const preview = previewItemsForStory(story.id);

                return (
                  <motion.tr
                    key={story.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="transition hover:bg-muted/30"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={story.cover}
                          alt={story.title}
                          className="size-10 rounded-lg object-cover shadow-sm"
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{story.title}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{story.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          badgeClass
                        )}
                      >
                        <StatusIcon className="size-3.5" />
                        {story.status}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {preview.length ? <AnimatedTooltip items={preview} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5 text-sm text-muted-foreground">
                        <p>{getPageCount(story.id)} pages · {getChapterCount(story.id)} chapters</p>
                        <p className="text-[11px]">Ages {story.ageBand} · {story.duration}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="relative inline-flex items-center gap-2" data-row-menu>
                        <Link
                          href={`/dashboard/stories/${story.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-border bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted micro-btn"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRowMenuOpen((v) => (v === story.id ? "" : story.id))}
                          className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-white dark:bg-[#141414] text-foreground transition hover:bg-muted micro-btn"
                          aria-label="More actions"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {rowMenuOpen === story.id && (
                          <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-border bg-white dark:bg-[#141414] shadow-lg">
                            <Link
                              href={`/dashboard/stories/${story.id}`}
                              className="block px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                              onClick={() => setRowMenuOpen("")}
                            >
                              Read Story
                            </Link>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                              onClick={async () => {
                                await navigator.clipboard.writeText(story.id);
                                setRowMenuOpen("");
                              }}
                            >
                              Copy Story ID
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Mobile Cards ───────────────────────────────────────── */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((story) => {
          const StatusIcon = statusConfig[story.status as StoryStatus]?.icon ?? BookOpenText;
          const badgeClass =
            statusConfig[story.status as StoryStatus]?.badgeClass ??
            "bg-muted text-muted-foreground border-border";
          const preview = previewItemsForStory(story.id);

          return (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26 }}
              className="rounded-2xl border border-border/70 bg-white dark:bg-[#141414] p-4 shadow-sm micro-card"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={story.cover}
                      alt={story.title}
                      className="size-10 rounded-lg object-cover shadow-sm"
                    />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground">{story.title}</h3>
                      <p className="font-mono text-[11px] text-muted-foreground">{story.id}</p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/stories/${story.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground micro-btn"
                  >
                    Open
                  </Link>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                    badgeClass
                  )}
                >
                  <StatusIcon className="size-3.5" />
                  {story.status}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
                    <p className="mt-1 font-medium text-foreground">{getPageCount(story.id)} pages · {getChapterCount(story.id)} ch.</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Age / Duration</p>
                    <p className="mt-1 font-medium text-foreground">Ages {story.ageBand} · {story.duration}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scenes</p>
                  {preview.length ? <AnimatedTooltip items={preview} /> : <p className="text-xs text-muted-foreground">—</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Empty state ────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No stories found for the current filters.
        </div>
      )}
    </motion.section>
  );
}
