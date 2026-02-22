"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { ArrowRight, Moon, Sparkles, Sun } from "lucide-react";

import { SlideTabs } from "@/components/ui/slide-tabs";

export default function DreamNavbar() {
  const { resolvedTheme, setTheme } = useTheme();

  const navTabs = useMemo(
    () => [
      { label: "Home", value: "home-section" },
      { label: "Studio", value: "dream-studio-section" },
    ],
    []
  );

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;

    const container = document.querySelector("main");
    if (!(container instanceof HTMLElement)) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = targetRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 px-4">
      <nav className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 shadow-[0_14px_34px_-24px_rgba(23,29,37,0.35)] backdrop-blur-md dark:border-white/12 dark:bg-black/55 dark:shadow-[0_20px_42px_-28px_rgba(0,0,0,0.92)] md:px-5">
        <div className="flex shrink-0 items-center gap-2 text-slate-900 dark:text-slate-100">
          <span className="text-sm font-semibold tracking-wide md:text-base">
            Dream
          </span>
        </div>

        <SlideTabs
          tabs={navTabs}
          initialValue="home-section"
          onTabChange={scrollToSection}
          className="mx-2 hidden sm:flex"
        />

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/12 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
            aria-label="Toggle dark mode"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </button>

          <Link
            href="/dashboard/create"
            className="group relative inline-flex shrink-0 items-center overflow-hidden rounded-full bg-primary px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_14px_24px_-16px_rgba(161,73,41,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_34px_-16px_rgba(161,73,41,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:px-4 md:text-xs"
          >
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              <span className="sm:hidden">Create</span>
              <span className="hidden sm:inline">Create Story</span>
              <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 group-hover:translate-x-full"
            />
          </Link>
        </div>
      </nav>
    </header>
  );
}
