import Link from "next/link";
import { Sparkles } from "lucide-react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[linear-gradient(180deg,#fff5e2_0%,#fffaf1_42%,#edf6ff_100%)] dark:bg-[linear-gradient(180deg,#060606_0%,#0a0a0a_45%,#0d0d0d_100%)] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <header className="animate-in-view flex flex-col gap-4 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Dream Studio</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">Creator Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 dark:bg-[#121212] dark:border-white/10 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white dark:hover:bg-[#1a1a1a] md:text-sm micro-btn"
            >
              Back Home
            </Link>
            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-95 md:text-sm micro-btn"
            >
              <Sparkles className="size-4" />
              New Job
            </Link>
          </div>
        </header>

        <div className="animate-in-view animate-in-view-delay-1">
          <DashboardNav />
        </div>
        <div className="dashboard-page animate-in-view animate-in-view-delay-2">{children}</div>
      </div>
    </div>
  );
}
