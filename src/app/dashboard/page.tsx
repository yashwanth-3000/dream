import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { dashboardJobs, formatRelativeTime } from "@/lib/dashboard-data";

function previewItemsForJob(job: (typeof dashboardJobs)[number]) {
  const urls = Array.isArray(job.files) ? job.files.filter((x) => typeof x === "string" && x.trim()) : [];
  return urls.slice(0, 3).map((url, idx) => ({
    id: idx + 1,
    name: idx === 0 ? "Cover" : idx === 1 ? "Scene" : `Image ${idx + 1}`,
    image: url,
  }));
}

export default function DashboardOverviewPage() {
  const recent = [...dashboardJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <div className="space-y-5 animate-fade-soft">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/dashboard/create"
          className="group rounded-3xl border border-border/60 bg-white/80 dark:border-white/10 dark:bg-[#111111]/95 p-5 shadow-sm transition hover:shadow-md micro-card animate-in-view"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Launch</p>
          <h3 className="mt-2 text-xl font-black text-foreground">New Dream</h3>
          <p className="mt-2 text-sm text-muted-foreground">Create a fresh story or short video from one prompt.</p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Open Create
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          href="/dashboard/stories"
          className="group rounded-3xl border border-border/60 bg-white/80 dark:border-white/10 dark:bg-[#111111]/95 p-5 shadow-sm transition hover:shadow-md micro-card animate-in-view animate-in-view-delay-1"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Library</p>
          <h3 className="mt-2 text-xl font-black text-foreground">Stories</h3>
          <p className="mt-2 text-sm text-muted-foreground">Open, remix, and manage kid-safe story outputs.</p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Open Stories
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          href="/dashboard/videos"
          className="group rounded-3xl border border-border/60 bg-white/80 dark:border-white/10 dark:bg-[#111111]/95 p-5 shadow-sm transition hover:shadow-md micro-card animate-in-view animate-in-view-delay-2"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Studio</p>
          <h3 className="mt-2 text-xl font-black text-foreground">Videos</h3>
          <p className="mt-2 text-sm text-muted-foreground">Review generated scenes and kid-friendly video moments.</p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Open Videos
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          href="/dashboard/characters"
          className="group rounded-3xl border border-border/60 bg-white/80 dark:border-white/10 dark:bg-[#111111]/95 p-5 shadow-sm transition hover:shadow-md micro-card animate-in-view animate-in-view-delay-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vault</p>
          <h3 className="mt-2 text-xl font-black text-foreground">Characters</h3>
          <p className="mt-2 text-sm text-muted-foreground">Reuse saved character styles across new generations.</p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Open Characters
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>
      </section>

      <section className="rounded-3xl border border-border/60 bg-white/80 dark:border-white/10 dark:bg-[#111111]/95 p-4 shadow-sm backdrop-blur md:p-5 animate-in-view animate-in-view-delay-1">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-foreground">Recent Jobs</h3>
          <Link href="/dashboard/jobs" className="text-sm font-semibold text-primary">
            View all
          </Link>
        </div>

        <div className="space-y-2">
          {recent.map((job) => {
            const preview = previewItemsForJob(job);
            const icon =
              job.status === "completed" ? (
                <CheckCircle2 className="size-4 text-sky-700" />
              ) : job.status === "failed" ? (
                <XCircle className="size-4 text-rose-700" />
              ) : (
                <Clock3 className="size-4 text-amber-700" />
              );

            return (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between rounded-2xl border border-border/70 bg-white dark:border-white/10 dark:bg-[#151515] p-3 transition hover:bg-muted/30 micro-card"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted">{icon}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{job.productName}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(job.createdAt)}</p>
                  </div>
                </div>
                <div className="hidden sm:block">{preview.length ? <AnimatedTooltip items={preview} /> : null}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
