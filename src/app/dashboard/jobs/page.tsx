"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock3, Filter, MoreVertical, Search, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { dashboardJobs, formatRelativeTime, type JobStatus } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  JobStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
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

function previewItemsForJob(job: (typeof dashboardJobs)[number]) {
  const urls = Array.isArray(job.files) ? job.files.filter((x) => typeof x === "string" && x.trim()) : [];
  return urls.slice(0, 3).map((url, idx) => ({
    id: idx + 1,
    name: idx === 0 ? "Cover" : idx === 1 ? "Scene" : `Image ${idx + 1}`,
    image: url,
  }));
}

export default function DashboardJobsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | JobStatus>("all");
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
    return dashboardJobs.filter((job) => {
      const matchesSearch =
        !q ||
        job.productName.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || job.status === selectedStatus;
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
      <div className="space-y-1">
        <h2 className="text-2xl font-black tracking-tight text-foreground">All Jobs</h2>
        <p className="text-sm text-muted-foreground">Track status, assets, and links for every generation job.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search product name or job id..."
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
              {(["all", "processing", "completed", "failed"] as const).map((s) => (
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
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assets</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filtered.map((job) => {
                const StatusIcon = statusConfig[job.status].icon;
                const preview = previewItemsForJob(job);
                return (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="transition hover:bg-muted/30"
                  >
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{job.productName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{job.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          statusConfig[job.status].badgeClass
                        )}
                      >
                        <StatusIcon className="size-3.5" />
                        {statusConfig[job.status].label}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {preview.length ? <AnimatedTooltip items={preview} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{formatRelativeTime(job.createdAt)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="relative inline-flex items-center gap-2" data-row-menu>
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-border bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted micro-btn"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRowMenuOpen((v) => (v === job.id ? "" : job.id))}
                          className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-white dark:bg-[#141414] text-foreground transition hover:bg-muted micro-btn"
                          aria-label="More actions"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {rowMenuOpen === job.id && (
                          <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-border bg-white dark:bg-[#141414] shadow-lg">
                            <Link
                              href={`/dashboard/jobs/${job.id}`}
                              className="block px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                              onClick={() => setRowMenuOpen("")}
                            >
                              View Details
                            </Link>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
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

      <div className="space-y-3 lg:hidden">
        {filtered.map((job) => {
          const StatusIcon = statusConfig[job.status].icon;
          const preview = previewItemsForJob(job);
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26 }}
              className="rounded-2xl border border-border/70 bg-white dark:bg-[#141414] p-4 shadow-sm micro-card"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{job.productName}</h3>
                    <p className="font-mono text-[11px] text-muted-foreground">{job.id}</p>
                  </div>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground micro-btn"
                  >
                    View
                  </Link>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                    statusConfig[job.status].badgeClass
                  )}
                >
                  <StatusIcon className="size-3.5" />
                  {statusConfig[job.status].label}
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 font-medium text-foreground">{formatRelativeTime(job.createdAt)}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assets</p>
                  {preview.length ? <AnimatedTooltip items={preview} /> : <p className="text-xs text-muted-foreground">—</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No jobs found for the current filters.
        </div>
      )}
    </motion.section>
  );
}
