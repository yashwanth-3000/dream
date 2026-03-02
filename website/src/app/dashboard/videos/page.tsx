/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, MoreVertical, RefreshCw, Search, CheckCircle2, XCircle, PlayCircle, Clapperboard, Clock3 } from "lucide-react";
import { motion } from "framer-motion";

import { fetchJobs, getAssetUrl, type Job, type JobStatus } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import styles from "../dashboard.module.css";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

type VideoDisplayStatus = "Ready" | "Processing" | "Failed";

const statusConfig: Record<
  VideoDisplayStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  Ready: {
    label: "Ready",
    icon: CheckCircle2,
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
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

function mapStatus(s: JobStatus): VideoDisplayStatus {
  if (s === "completed") return "Ready";
  if (s === "failed") return "Failed";
  return "Processing";
}

function getCoverUrl(job: Job): string {
  if (job.assets.length > 0) return getAssetUrl(job.id, job.assets[0].filename);
  const images = job.result_payload?.generated_images as string[] | undefined;
  return images?.[0] || "";
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

export default function DashboardVideosPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | VideoDisplayStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      const data = await fetchJobs({ type: "video" });
      setJobs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadVideos(); } finally { setRefreshing(false); }
  }, [loadVideos]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

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
      const matchesSearch = !q || job.title.toLowerCase().includes(q) || job.id.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || mapStatus(job.status) === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, selectedStatus]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#dbc9b7] border-t-[#c9924e]" />
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
          <h2 className={`${styles.halant} text-2xl`}>Legacy Videos</h2>
          <p className="text-sm" style={{ color: "#9a7a65" }}>Archived video outputs from earlier experiments.</p>
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
            placeholder="Search legacy video title or id..."
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
              {(["all", "Ready", "Processing", "Failed"] as const).map((s) => (
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
                {["Video", "Status", "Created", "Actions"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide ${i === 3 ? "text-right" : "text-left"}`}
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
                const StatusIcon = statusConfig[displayStatus]?.icon ?? Clapperboard;
                const badgeClass = statusConfig[displayStatus]?.badgeClass ?? "bg-muted text-muted-foreground border-border";
                const cover = getCoverUrl(job);

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
                        <div className="relative">
                          {cover ? (
                            <>
                              <img src={cover} alt={job.title} className="h-10 w-16 rounded-lg object-cover shadow-sm" />
                              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                                <PlayCircle className="size-4 text-white/90" />
                              </div>
                            </>
                          ) : (
                            <div className="flex h-10 w-16 items-center justify-center rounded-lg" style={{ background: "#ede7dd" }}>
                              <Clapperboard className="size-4" style={{ color: "#9a7a65" }} />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>{job.title}</p>
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
                      <span className="text-sm" style={{ color: "#9a7a65" }}>{formatRelativeTime(job.created_at)}</span>
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
                          View
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
          const StatusIcon = statusConfig[displayStatus]?.icon ?? Clapperboard;
          const badgeClass = statusConfig[displayStatus]?.badgeClass ?? "bg-muted text-muted-foreground border-border";
          const cover = getCoverUrl(job);

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
                    <div className="relative">
                      {cover ? (
                        <>
                          <img src={cover} alt={job.title} className="h-10 w-16 rounded-lg object-cover shadow-sm" />
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                            <PlayCircle className="size-4 text-white/90" />
                          </div>
                        </>
                      ) : (
                        <div className="flex h-10 w-16 items-center justify-center rounded-lg" style={{ background: "#ede7dd" }}>
                          <Clapperboard className="size-4" style={{ color: "#9a7a65" }} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>{job.title}</h3>
                      <p className="font-mono text-[11px]" style={{ color: "#9a7a65" }}>{job.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#fdf8f3", border: "1px solid #dbc9b7", color: "#2b180a" }}
                  >
                    View
                  </Link>
                </div>
                <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass)}>
                  <StatusIcon className="size-3.5" />
                  {displayStatus}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Created</p>
                  <p className="mt-1 font-medium" style={{ color: "#2b180a" }}>{formatRelativeTime(job.created_at)}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{ border: "2px dashed #dbc9b7", color: "#9a7a65" }}
        >
          {jobs.length === 0
            ? "No legacy video jobs found."
            : "No legacy videos found for the current filters."}
        </div>
      )}
    </motion.section>
  );
}
