/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, MoreVertical, RefreshCw, Search, BookMarked, BookOpenText, Clock3, XCircle } from "lucide-react";
import { motion } from "framer-motion";

const STORIES_PAGE_SIZE = 7;

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { fetchJobs, getAssetUrl, type Job, type JobStatus } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import styles from "../dashboard.module.css";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

type StoryDisplayStatus = "Completed" | "Processing" | "Failed";

const statusConfig: Record<
  StoryDisplayStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  Completed: {
    label: "Completed",
    icon: BookMarked,
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  Processing: {
    label: "Processing",
    icon: Clock3,
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
  },
  Failed: {
    label: "Failed",
    icon: XCircle,
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
  },
};

function mapStatus(s: JobStatus): StoryDisplayStatus {
  if (s === "completed") return "Completed";
  if (s === "failed") return "Failed";
  return "Processing";
}

function getStoryTitle(job: Job): string {
  const story = job.result_payload?.story as { title?: string } | undefined;
  return story?.title || job.title || "Untitled Story";
}

function getCoverUrl(job: Job): string {
  if (job.assets.length > 0) return getAssetUrl(job.id, job.assets[0].filename);
  const images = job.result_payload?.generated_images as string[] | undefined;
  return images?.[0] || "";
}

function getAgeBand(job: Job): string {
  return (job.input_payload?.age_band as string) || "All";
}

function getPageCount(job: Job): number {
  if (job.result_payload && job.result_payload._summary) return 0;
  const story = job.result_payload?.story as { right_pages?: unknown[] } | undefined;
  return (story?.right_pages?.length ?? 0) + 2; // title + end
}

function getSpreadsCount(job: Job): number {
  if (job.result_payload && job.result_payload._summary) return 0;
  const spreads = job.result_payload?.spreads as unknown[] | undefined;
  return spreads?.length ?? 0;
}

function previewItemsForStory(job: Job) {
  return job.assets.slice(0, 3).map((asset, idx) => ({
    id: idx + 1,
    name: idx === 0 ? "Cover" : `Scene ${idx}`,
    image: getAssetUrl(job.id, asset.filename),
  }));
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${Math.max(diffMins, 1)}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardStoriesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | StoryDisplayStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(async (nextPage: number) => {
    try {
      setPageLoading(true);
      const data = await fetchJobs({
        type: "story",
        limit: STORIES_PAGE_SIZE,
        offset: nextPage * STORIES_PAGE_SIZE,
        summary: true,
      });
      if (nextPage > 0 && data.length === 0) {
        setHasMore(false);
        return;
      }
      setJobs(data);
      setHasMore(data.length === STORIES_PAGE_SIZE);
      setPageIndex(nextPage);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadPage(pageIndex); } finally { setRefreshing(false); }
  }, [loadPage, pageIndex]);

  const handlePrev = useCallback(async () => {
    if (pageLoading || pageIndex === 0) return;
    await loadPage(pageIndex - 1);
  }, [loadPage, pageIndex, pageLoading]);

  const handleNext = useCallback(async () => {
    if (pageLoading || !hasMore) return;
    await loadPage(pageIndex + 1);
  }, [hasMore, loadPage, pageIndex, pageLoading]);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

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
    return jobs.filter((job) => {
      const title = getStoryTitle(job).toLowerCase();
      const matchesSearch = !q || title.includes(q) || job.id.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || mapStatus(job.status) === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, selectedStatus]);

  if (loading) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-3xl p-8 text-center"
        style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
      >
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-[#e9e0d5]" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#c9924e]" />
          <BookOpenText className="size-5" style={{ color: "#c9924e" }} />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold" style={{ color: "#2b180a" }}>Loading your stories…</p>
          <p className="max-w-xs text-sm leading-relaxed" style={{ color: "#9a7a65" }}>
            Waking up the backend and fetching your storybook adventures. The first load takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOutExpo }}
      className="space-y-4 rounded-3xl p-4 shadow-sm md:p-5"
      style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className={`${styles.halant} text-2xl`}>All Stories</h2>
          <p className="text-sm" style={{ color: "#9a7a65" }}>Browse, filter, and open your generated story adventures.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition"
          style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
          onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.background = "#ede7dd"; }}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "#9a7a65" }} />
          <input
            placeholder="Search story title or id..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition"
            style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
          />
        </div>

        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition"
            style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ede7dd")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
          >
            <Filter className="size-4" />
            Filter
            <ChevronDown className="size-4" />
          </button>
          {filterOpen && (
            <div
              className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl shadow-lg"
              style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
            >
              {(["all", "Completed", "Processing", "Failed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSelectedStatus(s); setFilterOpen(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium transition"
                  style={{
                    color: selectedStatus === s ? "#8b5e3c" : "#2b180a",
                    background: selectedStatus === s ? "#f0e8dc" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (selectedStatus !== s) e.currentTarget.style.background = "#f0e8dc"; }}
                  onMouseLeave={(e) => { if (selectedStatus !== s) e.currentTarget.style.background = "transparent"; }}
                >
                  {s === "all" ? "All Status" : statusConfig[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="hidden overflow-hidden rounded-2xl lg:block"
        style={{ border: "1px solid #dbc9b7", background: "#fdf8f3" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: "1px solid #dbc9b7", background: "rgb(240 232 220 / 0.5)" }}>
              <tr>
                {["Story", "Status", "Scenes", "Details", "Actions"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide ${i === 4 ? "text-right" : "text-left"}`}
                    style={{ color: "#9a7a65" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const displayStatus = mapStatus(job.status);
                const StatusIcon = statusConfig[displayStatus]?.icon ?? BookOpenText;
                const badgeClass = statusConfig[displayStatus]?.badgeClass ?? "bg-muted text-muted-foreground border-border";
                const preview = previewItemsForStory(job);
                const cover = getCoverUrl(job);
                const title = getStoryTitle(job);

                return (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="transition"
                    style={{ borderTop: "1px solid #e9e0d5" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(240 232 220 / 0.4)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {cover ? (
                          <img src={cover} alt={title} className="size-10 rounded-lg object-cover shadow-sm" />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-lg" style={{ background: "#ede7dd" }}>
                            <BookOpenText className="size-4" style={{ color: "#9a7a65" }} />
                          </div>
                        )}
                        <div className="space-y-1">
                          <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>{title}</p>
                          <p className="font-mono text-[11px]" style={{ color: "#9a7a65" }}>{job.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass)}>
                        <StatusIcon className="size-3.5" />
                        {displayStatus}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {preview.length ? <AnimatedTooltip items={preview} /> : <span className="text-xs" style={{ color: "#9a7a65" }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5 text-sm" style={{ color: "#9a7a65" }}>
                        <p>
                          {getPageCount(job) > 0 ? `${getPageCount(job)} pages` : "Pages —"} ·{" "}
                          {getSpreadsCount(job) > 0 ? `${getSpreadsCount(job)} spreads` : "Spreads —"}
                        </p>
                        <p className="text-[11px]">Ages {getAgeBand(job)} · {formatRelativeTime(job.created_at)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="relative inline-flex items-center gap-2" data-row-menu>
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition"
                          style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#ede7dd")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRowMenuOpen((v) => (v === job.id ? "" : job.id))}
                          className="inline-flex size-8 items-center justify-center rounded-full transition"
                          style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#ede7dd")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
                          aria-label="More actions"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {rowMenuOpen === job.id && (
                          <div
                            className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl shadow-lg"
                            style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
                          >
                            <Link
                              href={`/dashboard/jobs/${job.id}`}
                              className="block px-3 py-2 text-left text-sm font-medium transition"
                              style={{ color: "#2b180a" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0e8dc")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              onClick={() => setRowMenuOpen("")}
                            >
                              View Job
                            </Link>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm font-medium transition"
                              style={{ color: "#2b180a" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0e8dc")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              onClick={async () => { await navigator.clipboard.writeText(job.id); setRowMenuOpen(""); }}
                            >
                              Copy Job ID
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

      {/* ── Mobile Cards ── */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((job) => {
          const displayStatus = mapStatus(job.status);
          const StatusIcon = statusConfig[displayStatus]?.icon ?? BookOpenText;
          const badgeClass = statusConfig[displayStatus]?.badgeClass ?? "bg-muted text-muted-foreground border-border";
          const preview = previewItemsForStory(job);
          const cover = getCoverUrl(job);
          const title = getStoryTitle(job);

          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26 }}
              className="rounded-2xl p-4 shadow-sm"
              style={{ border: "1px solid #dbc9b7", background: "#fcf6ef" }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {cover ? (
                      <img src={cover} alt={title} className="size-10 rounded-lg object-cover shadow-sm" />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-lg" style={{ background: "#ede7dd" }}>
                        <BookOpenText className="size-4" style={{ color: "#9a7a65" }} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>{title}</h3>
                      <p className="font-mono text-[11px]" style={{ color: "#9a7a65" }}>{job.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#fdf8f3", border: "1px solid #dbc9b7", color: "#2b180a" }}
                  >
                    Open
                  </Link>
                </div>
                <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass)}>
                  <StatusIcon className="size-3.5" />
                  {displayStatus}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Details</p>
                    <p className="mt-1 font-medium" style={{ color: "#2b180a" }}>
                      {getPageCount(job) > 0 ? `${getPageCount(job)} pages` : "Pages —"} ·{" "}
                      {getSpreadsCount(job) > 0 ? `${getSpreadsCount(job)} spreads` : "Spreads —"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Created</p>
                    <p className="mt-1 font-medium" style={{ color: "#2b180a" }}>{formatRelativeTime(job.created_at)}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Scenes</p>
                  {preview.length ? <AnimatedTooltip items={preview} /> : <p className="text-xs" style={{ color: "#9a7a65" }}>—</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {jobs.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{ border: "2px dashed #dbc9b7", color: "#9a7a65" }}
        >
          No story jobs yet. Generate a story from the Storybook Test page.
        </div>
      )}

      {jobs.length > 0 && filtered.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{ border: "2px dashed #dbc9b7", color: "#9a7a65" }}
        >
          No stories found for the current filters.
        </div>
      )}

      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={handlePrev}
            disabled={pageIndex === 0 || pageLoading}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
            onMouseEnter={(e) => { if (pageIndex !== 0 && !pageLoading) e.currentTarget.style.background = "#ede7dd"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
          >
            Previous
          </button>
          <p className="text-sm font-medium" style={{ color: "#9a7a65" }}>
            Page {pageIndex + 1}
          </p>
          <button
            type="button"
            onClick={handleNext}
            disabled={pageLoading || !hasMore}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
            onMouseEnter={(e) => { if (!pageLoading && hasMore) e.currentTarget.style.background = "#ede7dd"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
          >
            {pageLoading ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </motion.section>
  );
}
