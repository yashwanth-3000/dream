"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock3, Filter, MoreVertical, Search, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { dashboardJobs, formatRelativeTime, type JobStatus } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";
import styles from "../dashboard.module.css";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

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
      transition={{ duration: 0.45, ease: easeOutExpo }}
      className="space-y-4 rounded-3xl p-4 shadow-sm md:p-5"
      style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
    >
      <div className="space-y-1">
        <h2 className={`${styles.halant} text-2xl`}>All Jobs</h2>
        <p className="text-sm" style={{ color: "#9a7a65" }}>Track status, assets, and links for every generation job.</p>
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
              {(["all", "processing", "completed", "failed"] as const).map((s) => (
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
                {["Product", "Status", "Assets", "Created", "Actions"].map((h, i) => (
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
                        <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>{job.productName}</p>
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
                      {preview.length ? <AnimatedTooltip items={preview} /> : <span className="text-xs" style={{ color: "#9a7a65" }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm" style={{ color: "#9a7a65" }}>{formatRelativeTime(job.createdAt)}</td>
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
                    <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>{job.productName}</h3>
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
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Created</p>
                  <p className="mt-1 font-medium" style={{ color: "#2b180a" }}>{formatRelativeTime(job.createdAt)}</p>
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

      {filtered.length === 0 && (
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
