/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, MoreVertical, Search, CheckCircle2, XCircle, PlayCircle, Clapperboard, Timer } from "lucide-react";
import { motion } from "framer-motion";

import { dashboardVideos } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/* ── status config ─────────────────────────────────────────────── */

type VideoStatus = "Ready" | "Failed";

const statusConfig: Record<
  VideoStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  Ready: {
    label: "Ready",
    icon: CheckCircle2,
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
  },
  Failed: {
    label: "Failed",
    icon: XCircle,
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
  },
};

/* ── page ───────────────────────────────────────────────────────── */

export default function DashboardVideosPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | VideoStatus>("all");
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
    return dashboardVideos.filter((video) => {
      const matchesSearch =
        !q ||
        video.title.toLowerCase().includes(q) ||
        video.id.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || video.status === selectedStatus;
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
        <h2 className="text-2xl font-black tracking-tight text-foreground">All Videos</h2>
        <p className="text-sm text-muted-foreground">Generated text-to-video outputs for your recent story jobs.</p>
      </div>

      {/* ── Search & Filter ────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search video title or id..."
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
              {(["all", "Ready", "Failed"] as const).map((s) => (
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
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Video</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filtered.map((video) => {
                const StatusIcon = statusConfig[video.status as VideoStatus]?.icon ?? Clapperboard;
                const badgeClass =
                  statusConfig[video.status as VideoStatus]?.badgeClass ??
                  "bg-muted text-muted-foreground border-border";

                return (
                  <motion.tr
                    key={video.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="transition hover:bg-muted/30"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={video.cover}
                            alt={video.title}
                            className="h-10 w-16 rounded-lg object-cover shadow-sm"
                          />
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                            <PlayCircle className="size-4 text-white/90" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{video.title}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{video.id}</p>
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
                        {video.status}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Timer className="size-3.5" />
                        {video.length}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="relative inline-flex items-center gap-2" data-row-menu>
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition micro-btn",
                            video.status === "Ready"
                              ? "bg-primary text-primary-foreground hover:brightness-95"
                              : "border border-border bg-white dark:bg-[#141414] text-muted-foreground cursor-not-allowed opacity-50"
                          )}
                          disabled={video.status === "Failed"}
                        >
                          <PlayCircle className="size-3.5" />
                          Play
                        </button>
                        <button
                          type="button"
                          onClick={() => setRowMenuOpen((v) => (v === video.id ? "" : video.id))}
                          className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-white dark:bg-[#141414] text-foreground transition hover:bg-muted micro-btn"
                          aria-label="More actions"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {rowMenuOpen === video.id && (
                          <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-border bg-white dark:bg-[#141414] shadow-lg">
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                              onClick={() => setRowMenuOpen("")}
                            >
                              Edit Scene
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                              onClick={async () => {
                                await navigator.clipboard.writeText(video.id);
                                setRowMenuOpen("");
                              }}
                            >
                              Copy Video ID
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
        {filtered.map((video) => {
          const StatusIcon = statusConfig[video.status as VideoStatus]?.icon ?? Clapperboard;
          const badgeClass =
            statusConfig[video.status as VideoStatus]?.badgeClass ??
            "bg-muted text-muted-foreground border-border";

          return (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26 }}
              className="rounded-2xl border border-border/70 bg-white dark:bg-[#141414] p-4 shadow-sm micro-card"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={video.cover}
                        alt={video.title}
                        className="h-10 w-16 rounded-lg object-cover shadow-sm"
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                        <PlayCircle className="size-4 text-white/90" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground">{video.title}</h3>
                      <p className="font-mono text-[11px] text-muted-foreground">{video.id}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition micro-btn",
                      video.status === "Ready"
                        ? "bg-primary text-primary-foreground hover:brightness-95"
                        : "border border-border bg-white dark:bg-[#141414] text-muted-foreground cursor-not-allowed opacity-50"
                    )}
                    disabled={video.status === "Failed"}
                  >
                    <PlayCircle className="size-3.5" />
                    Play
                  </button>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                    badgeClass
                  )}
                >
                  <StatusIcon className="size-3.5" />
                  {video.status}
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-foreground">
                      <Timer className="size-3.5" />
                      {video.length}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Empty state ────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No videos found for the current filters.
        </div>
      )}
    </motion.section>
  );
}
