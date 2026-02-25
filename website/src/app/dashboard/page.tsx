import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { dashboardJobs, formatRelativeTime } from "@/lib/dashboard-data";
import styles from "./dashboard.module.css";

function previewItemsForJob(job: (typeof dashboardJobs)[number]) {
  const urls = Array.isArray(job.files) ? job.files.filter((x) => typeof x === "string" && x.trim()) : [];
  return urls.slice(0, 3).map((url, idx) => ({
    id: idx + 1,
    name: idx === 0 ? "Cover" : idx === 1 ? "Scene" : `Image ${idx + 1}`,
    image: url,
  }));
}

const QUICK_LINKS = [
  {
    href: "/dashboard/create",
    kicker: "Launch",
    title: "New Dream",
    body: "Create a fresh story or short video from one prompt.",
    cta: "Open Create",
  },
  {
    href: "/dashboard/stories",
    kicker: "Library",
    title: "Stories",
    body: "Open, remix, and manage kid-safe story outputs.",
    cta: "Open Stories",
  },
  {
    href: "/dashboard/videos",
    kicker: "Studio",
    title: "Videos",
    body: "Review generated scenes and kid-friendly video moments.",
    cta: "Open Videos",
  },
  {
    href: "/dashboard/characters",
    kicker: "Vault",
    title: "Characters",
    body: "Reuse saved character styles across new generations.",
    cta: "Open Characters",
  },
];

export default function DashboardOverviewPage() {
  const recent = [...dashboardJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* ── Quick-access cards ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className={`group ${styles.quickCard}`}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a7a65" }}>
              {item.kicker}
            </p>
            <h3 className={`${styles.halant} mt-2 text-xl`}>{item.title}</h3>
            <p className="mt-2 text-sm" style={{ color: "#9a7a65" }}>{item.body}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "#8b5e3c" }}>
              {item.cta}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </section>

      {/* ── Recent jobs ── */}
      <section
        className="rounded-3xl p-4 shadow-sm md:p-5"
        style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`${styles.halant} text-lg`}>Recent Jobs</h3>
          <Link href="/dashboard/jobs" className="text-sm font-semibold" style={{ color: "#8b5e3c" }}>
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
              <Link key={job.id} href={`/dashboard/jobs/${job.id}`} className={styles.jobRow}>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-full"
                    style={{ background: "#ede7dd" }}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "#2b180a" }}>{job.productName}</p>
                    <p className="text-xs" style={{ color: "#9a7a65" }}>{formatRelativeTime(job.createdAt)}</p>
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
