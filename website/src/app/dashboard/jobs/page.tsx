"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Clock,
  Clock3,
  Filter,
  MoreVertical,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  BookOpenText,
  Clapperboard,
  UserRound,
  Brain,
} from "lucide-react";
import { motion } from "framer-motion";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { fetchJobs, getAssetUrl, type Job, type JobType, type JobStatus } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import styles from "../dashboard.module.css";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

const statusConfig: Record<
  JobStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  queued: {
    label: "Queued",
    icon: Clock,
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
  },
  processing: {
    label: "Processing",
    icon: Clock3,
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
  },
};

const modeConfig: Record<
  JobType,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  story: {
    label: "Storybook Mode",
    icon: BookOpenText,
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  video: {
    label: "Legacy Video Mode",
    icon: Clapperboard,
    badgeClass: "bg-violet-100 text-violet-900 border-violet-300",
  },
  character: {
    label: "Character Mode",
    icon: UserRound,
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
  },
  quiz: {
    label: "Quiz Mode",
    icon: Brain,
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
  },
};

function previewItemsForJob(job: Job) {
  const labelsByType: Record<JobType, string[]> = {
    story: ["Cover", "Scene", "Image"],
    video: ["Thumbnail", "Frame", "Frame"],
    character: ["Portrait", "Style", "Turnaround"],
    quiz: ["Question", "Option", "Hint"],
  };
  const labels = labelsByType[job.type];
  return job.assets.slice(0, 3).map((asset, idx) => ({
    id: idx + 1,
    name: idx === 0 ? labels[0] : idx === 1 ? labels[1] : `${labels[2]} ${idx + 1}`,
    image: getAssetUrl(job.id, asset.filename),
  }));
}

export default function DashboardJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | JobStatus>("all");
  const [selectedMode, setSelectedMode] = useState<"all" | JobType>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs({ limit: 100, summary: true });
      setJobs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadJobs();
    } finally {
      setRefreshing(false);
    }
  }, [loadJobs]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

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
      const matchesSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || job.status === selectedStatus;
      const matchesMode = selectedMode === "all" || job.type === selectedMode;
      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [jobs, searchQuery, selectedStatus, selectedMode]);

  if (loading) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeOutExpo }}
        className="space-y-4 rounded-3xl p-4 shadow-sm md:p-5"
        style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
      >
        <div className="space-y-1">
          <div className="h-7 w-32 animate-pulse rounded-lg" style={{ background: "#e9e0d5" }} />
          <div className="h-4 w-64 animate-pulse rounded-lg" style={{ background: "#e9e0d5" }} />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-full" style={{ background: "#e9e0d5" }} />
          ))}
        </div>
        <div className="h-10 w-full animate-pulse rounded-full" style={{ background: "#e9e0d5" }} />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-2xl" style={{ background: "#e9e0d5" }} />
          ))}
        </div>
      </motion.section>
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
          <h2 className={`${styles.halant} text-2xl`}>All Jobs</h2>
          <p className="text-sm" style={{ color: "#9a7a65" }}>Track status, assets, and links for every generation job.</p>
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

      {/* ── Mode Tabs ── */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { value: "all", label: "All Modes" },
          { value: "story", label: modeConfig.story.label },
          { value: "video", label: modeConfig.video.label },
          { value: "character", label: modeConfig.character.label },
          { value: "quiz", label: modeConfig.quiz.label },
        ] as const).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSelectedMode(tab.value)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
            style={{
              background: selectedMode === tab.value ? "#2b180a" : "#fcf6ef",
              color: selectedMode === tab.value ? "#f5e6d5" : "#2b180a",
              borderColor: selectedMode === tab.value ? "#2b180a" : "#dbc9b7",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Search & Filter ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "#9a7a65" }} />
          <input
            placeholder="Search product name or job id..."
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
              {(["all", "queued", "processing", "completed", "failed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(s);
                    setFilterOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm font-medium transition",
                    selectedStatus === s ? "font-semibold" : ""
                  )}
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
                {["Product", "Status", "Mode", "Assets", "Actions"].map((h, i) => (
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
            <tbody style={{ borderTop: "none" }}>
              {filtered.map((job) => {
                const StatusIcon = statusConfig[job.status].icon;
                const ModeIcon = modeConfig[job.type].icon;
                const preview = previewItemsForJob(job);
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
                      <div className="space-y-1">
                        <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>{job.title}</p>
                        <p className="font-mono text-[11px]" style={{ color: "#9a7a65" }}>{job.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusConfig[job.status].badgeClass)}>
                        <StatusIcon className="size-3.5" />
                        {statusConfig[job.status].label}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", modeConfig[job.type].badgeClass)}>
                        <ModeIcon className="size-3.5" />
                        {modeConfig[job.type].label}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {preview.length ? <AnimatedTooltip items={preview} /> : <span className="text-xs" style={{ color: "#9a7a65" }}>—</span>}
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
                              View Details
                            </Link>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm font-medium transition"
                              style={{ color: "#2b180a" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0e8dc")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              onClick={async () => {
                                await navigator.clipboard.writeText(job.id);
                                setRowMenuOpen("");
                              }}
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
          const StatusIcon = statusConfig[job.status].icon;
          const ModeIcon = modeConfig[job.type].icon;
          const preview = previewItemsForJob(job);
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
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>{job.title}</h3>
                    <p className="font-mono text-[11px]" style={{ color: "#9a7a65" }}>{job.id}</p>
                  </div>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#fdf8f3", border: "1px solid #dbc9b7", color: "#2b180a" }}
                  >
                    View
                  </Link>
                </div>
                <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusConfig[job.status].badgeClass)}>
                  <StatusIcon className="size-3.5" />
                  {statusConfig[job.status].label}
                </div>
                <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", modeConfig[job.type].badgeClass)}>
                  <ModeIcon className="size-3.5" />
                  {modeConfig[job.type].label}
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Assets</p>
                  {preview.length ? <AnimatedTooltip items={preview} /> : <p className="text-xs" style={{ color: "#9a7a65" }}>—</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {jobs.length === 0 && (
        <div
          className="rounded-2xl border-dashed p-12 text-center text-sm"
          style={{ border: "2px dashed #dbc9b7", color: "#9a7a65" }}
        >
          No jobs yet. Create your first storybook, character, video, or quiz to get started.
        </div>
      )}

      {jobs.length > 0 && filtered.length === 0 && (
        <div
          className="rounded-2xl border-dashed p-12 text-center text-sm"
          style={{ border: "2px dashed #dbc9b7", color: "#9a7a65" }}
        >
          No jobs found for the current filters.
        </div>
      )}
    </motion.section>
  );
}
