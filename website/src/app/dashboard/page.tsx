"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { fetchJobs, getAssetUrl, type Job } from "@/lib/jobs";
import styles from "./dashboard.module.css";

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

function previewItemsForJob(job: Job) {
  return job.assets.slice(0, 3).map((asset, idx) => ({
    id: idx + 1,
    name: idx === 0 ? "Cover" : idx === 1 ? "Scene" : `Image ${idx + 1}`,
    image: getAssetUrl(job.id, asset.filename),
  }));
}

const QUICK_LINKS = [
  {
    href: "/dashboard/test-ui",
    kicker: "Testing",
    title: "Test UI",
    body: "Open both Character API Test and Storybook Test from one place.",
    cta: "Open Test UI",
  },
  {
    href: "/dashboard/stories",
    kicker: "Library",
    title: "Stories",
    body: "Open, remix, and manage kid-safe story outputs.",
    cta: "Open Stories",
  },
  {
    href: "/chat",
    kicker: "Quizzes",
    title: "Parent Quiz Chat",
    body: "Ask chat to create a quiz based on any finished storybook.",
    cta: "Open Chat",
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await fetchJobs({ limit: 5, summary: true });
        if (!active) return;
        setJobs(data);
      } finally {
        if (active) setLoadingJobs(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const recent = useMemo(
    () => [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [jobs]
  );

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
          {loadingJobs && recent.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-[#e9e0d5]" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#c9924e]" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>Fetching recent jobs…</p>
                <p className="text-xs" style={{ color: "#9a7a65" }}>Connecting to the backend — takes a few seconds on first load.</p>
              </div>
            </div>
          )}
          {!loadingJobs && recent.length === 0 && (
            <p className="py-6 text-center text-sm" style={{ color: "#9a7a65" }}>
              No jobs yet — create your first story or character.
            </p>
          )}
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
                    <p className="truncate text-sm font-semibold" style={{ color: "#2b180a" }}>{job.title}</p>
                    <p className="text-xs" style={{ color: "#9a7a65" }}>{formatRelativeTime(job.created_at)}</p>
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
