"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";

import { SlideTabs } from "@/components/ui/slide-tabs";

export default function DreamNavbar() {
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
      <nav className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between py-1">
        <div className="flex items-center gap-2 text-foreground">
          <span className="inline-block size-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold tracking-wide md:text-base">Dream</span>
        </div>

        <SlideTabs
          tabs={navTabs}
          initialValue="home-section"
          onTabChange={scrollToSection}
          className="mx-2"
        />

        <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/80 transition-colors hover:text-foreground md:text-sm">
          <Sparkles className="size-3.5 md:size-4" />
          Start
        </button>
      </nav>
    </header>
  );
}
