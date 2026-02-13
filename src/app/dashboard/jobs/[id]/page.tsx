/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, FileText, Video } from "lucide-react";
import { notFound } from "next/navigation";

import { formatRelativeTime, getDashboardJobById, getDashboardJobLogs } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

const statusConfig = {
  processing: { label: "Processing", icon: Clock3, className: "bg-amber-100 text-amber-900 border-amber-300" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-sky-100 text-sky-900 border-sky-300" },
  failed: { label: "Failed", icon: AlertCircle, className: "bg-rose-100 text-rose-900 border-rose-300" },
} as const;

export default async function DashboardJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = getDashboardJobById(id);
  if (!job) notFound();

  const logs = getDashboardJobLogs(id);
  const files = Array.isArray(job.files) ? job.files.filter(Boolean) : [];
  const StatusIcon = statusConfig[job.status].icon;

  return (
    <section className="space-y-4 animate-fade-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between animate-in-view">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">{job.productName}</h2>
          <p className="font-mono text-xs text-muted-foreground">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
              statusConfig[job.status].className
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig[job.status].label}
          </div>
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-4 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted micro-btn dark:bg-[#151515] dark:border-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <article className="overflow-hidden rounded-2xl border border-border/70 bg-white micro-card animate-in-view animate-in-view-delay-1 dark:bg-[#141414] dark:border-white/10">
            <header className="border-b border-border/70 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-[0.1em] text-foreground">AI Media Preview</h3>
              <p className="text-xs text-muted-foreground">Video output for this generation job.</p>
            </header>
            <div className="aspect-video bg-muted">
              {job.videoUrl ? (
                <video src={job.videoUrl} className="h-full w-full object-cover" controls autoPlay muted loop playsInline />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">Video pending...</div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-border/70 bg-white p-4 micro-card animate-in-view animate-in-view-delay-2 dark:bg-[#141414] dark:border-white/10">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <h3 className="text-sm font-black uppercase tracking-[0.1em] text-foreground">Generated Outputs</h3>
            </div>
            {files.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {files.map((src, idx) => (
                  <div key={src} className="overflow-hidden rounded-lg border border-border/70">
                    <img src={src} alt={`Generated asset ${idx + 1}`} className="h-32 w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No generated images yet.</p>
            )}
          </article>
        </div>

        <div className="space-y-4">
          <article className="rounded-2xl border border-border/70 bg-white p-4 micro-card animate-in-view animate-in-view-delay-1 dark:bg-[#141414] dark:border-white/10">
            <h3 className="text-sm font-black uppercase tracking-[0.1em] text-foreground">Generation Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-semibold text-foreground">{formatRelativeTime(job.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Triggered By</dt>
                <dd className="font-semibold text-foreground">{job.triggeredBy}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Engine</dt>
                <dd className="font-semibold text-foreground">{job.engine ?? "Dream Core"}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl border border-border/70 bg-white p-4 micro-card animate-in-view animate-in-view-delay-2 dark:bg-[#141414] dark:border-white/10">
            <h3 className="text-sm font-black uppercase tracking-[0.1em] text-foreground">Job Specs</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Input Files</dt>
                <dd className="font-semibold text-foreground">{files.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Variants</dt>
                <dd className="font-semibold text-foreground">{job.variants?.join(", ") || "Default"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <Video className="h-3.5 w-3.5" />
                  Story + Video
                </dd>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl border border-border/70 bg-white p-4 micro-card animate-in-view animate-in-view-delay-3 dark:bg-[#141414] dark:border-white/10">
            <h3 className="text-sm font-black uppercase tracking-[0.1em] text-foreground">Live Logs</h3>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs yet.</p>
              ) : (
                logs.map((line) => (
                  <div key={`${line.ts}-${line.message}`} className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">{line.ts}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase dark:bg-[#1b1b1b]">{line.level}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">{line.message}</p>
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
