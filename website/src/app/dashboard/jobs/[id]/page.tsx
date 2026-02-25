/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, FileText, Video } from "lucide-react";
import { notFound } from "next/navigation";

import { formatRelativeTime, getDashboardJobById, getDashboardJobLogs } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";
import styles from "../../dashboard.module.css";

type PageProps = {
  params: Promise<{ id: string }>;
};

const statusConfig = {
  processing: { label: "Processing", icon: Clock3, className: "bg-amber-100 text-amber-900 border-amber-300" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-sky-100 text-sky-900 border-sky-300" },
  failed: { label: "Failed", icon: AlertCircle, className: "bg-rose-100 text-rose-900 border-rose-300" },
} as const;

const cardStyle = { background: "#fdf8f3", border: "1px solid #dbc9b7" };
const innerCardStyle = { background: "#fcf6ef", border: "1px solid #dbc9b7" };

export default async function DashboardJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = getDashboardJobById(id);
  if (!job) notFound();

  const logs = getDashboardJobLogs(id);
  const files = Array.isArray(job.files) ? job.files.filter(Boolean) : [];
  const StatusIcon = statusConfig[job.status].icon;

  return (
    <section className="space-y-4">
      {/* ── Title row ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className={`${styles.halant} text-2xl md:text-3xl`}>{job.productName}</h2>
          <p className="font-mono text-xs" style={{ color: "#9a7a65" }}>{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", statusConfig[job.status].className)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig[job.status].label}
          </div>
          <Link
            href="/dashboard/jobs"
            className={`inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold ${styles.btnOutlineHover}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Video preview */}
          <article className="overflow-hidden rounded-2xl" style={cardStyle}>
            <header className="px-4 py-3" style={{ borderBottom: "1px solid #dbc9b7" }}>
              <h3 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: "#2b180a" }}>AI Media Preview</h3>
              <p className="text-xs" style={{ color: "#9a7a65" }}>Video output for this generation job.</p>
            </header>
            <div className="aspect-video" style={{ background: "#ede7dd" }}>
              {job.videoUrl ? (
                <video src={job.videoUrl} className="h-full w-full object-cover" controls autoPlay muted loop playsInline />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold" style={{ color: "#9a7a65" }}>Video pending...</div>
              )}
            </div>
          </article>

          {/* Generated outputs */}
          <article className="rounded-2xl p-4" style={cardStyle}>
            <div className="mb-3 flex items-center gap-2" style={{ color: "#2b180a" }}>
              <FileText className="h-4 w-4" />
              <h3 className="text-sm font-black uppercase tracking-[0.1em]">Generated Outputs</h3>
            </div>
            {files.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {files.map((src, idx) => (
                  <div key={src} className="overflow-hidden rounded-lg" style={{ border: "1px solid #dbc9b7" }}>
                    <img src={src} alt={`Generated asset ${idx + 1}`} className="h-32 w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#9a7a65" }}>No generated images yet.</p>
            )}
          </article>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          {/* Generation summary */}
          <article className="rounded-2xl p-4" style={cardStyle}>
            <h3 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: "#2b180a" }}>Generation Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt style={{ color: "#9a7a65" }}>Created</dt>
                <dd className="font-semibold" style={{ color: "#2b180a" }}>{formatRelativeTime(job.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt style={{ color: "#9a7a65" }}>Triggered By</dt>
                <dd className="font-semibold" style={{ color: "#2b180a" }}>{job.triggeredBy}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt style={{ color: "#9a7a65" }}>Engine</dt>
                <dd className="font-semibold" style={{ color: "#2b180a" }}>{job.engine ?? "Dream Core"}</dd>
              </div>
            </dl>
          </article>

          {/* Job specs */}
          <article className="rounded-2xl p-4" style={cardStyle}>
            <h3 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: "#2b180a" }}>Job Specs</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt style={{ color: "#9a7a65" }}>Input Files</dt>
                <dd className="font-semibold" style={{ color: "#2b180a" }}>{files.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt style={{ color: "#9a7a65" }}>Variants</dt>
                <dd className="font-semibold" style={{ color: "#2b180a" }}>{job.variants?.join(", ") || "Default"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt style={{ color: "#9a7a65" }}>Mode</dt>
                <dd className="inline-flex items-center gap-1 font-semibold" style={{ color: "#2b180a" }}>
                  <Video className="h-3.5 w-3.5" />
                  Story + Video
                </dd>
              </div>
            </dl>
          </article>

          {/* Live logs */}
          <article className="rounded-2xl p-4" style={cardStyle}>
            <h3 className="text-sm font-black uppercase tracking-[0.1em]" style={{ color: "#2b180a" }}>Live Logs</h3>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto">
              {logs.length === 0 ? (
                <p className="text-sm" style={{ color: "#9a7a65" }}>No logs yet.</p>
              ) : (
                logs.map((line) => (
                  <div key={`${line.ts}-${line.message}`} className="rounded-lg px-2.5 py-2" style={innerCardStyle}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono" style={{ color: "#9a7a65" }}>{line.ts}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ background: "#fdf8f3", color: "#2b180a" }}
                      >
                        {line.level}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold" style={{ color: "#2b180a" }}>{line.message}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
