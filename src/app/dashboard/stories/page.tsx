/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, MoreVertical, Search, BookMarked, FileText, BookOpenText } from "lucide-react";
import { motion } from "framer-motion";

import { AnimatedTooltip } from "@/components/dashboard/animated-tooltip";
import { dashboardStories, dashboardStoryPages } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";
import styles from "../dashboard.module.css";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

type StoryStatus = "Published" | "Draft";

const statusConfig: Record<
  StoryStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  Published: {
    label: "Published",
    icon: BookMarked,
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  Draft: {
    label: "Draft",
    icon: FileText,
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
  },
};

function previewItemsForStory(storyId: string) {
  const pages = dashboardStoryPages[storyId] ?? [];
  return pages
    .filter((p) => p.illustration)
    .slice(0, 3)
    .map((p, idx) => ({
      id: idx + 1,
      name: p.isTitle ? "Cover" : p.chapter ?? `Page ${idx + 1}`,
      image: p.illustration!,
    }));
}

function getPageCount(storyId: string) {
  return dashboardStoryPages[storyId]?.length ?? 0;
}

function getChapterCount(storyId: string) {
  const pages = dashboardStoryPages[storyId] ?? [];
  return pages.filter((p) => p.chapter).length;
}

export default function DashboardStoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | StoryStatus>("all");
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
    return dashboardStories.filter((story) => {
      const matchesSearch =
        !q ||
        story.title.toLowerCase().includes(q) ||
        story.id.toLowerCase().includes(q) ||
        story.ageBand.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || story.status === selectedStatus;
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
        <h2 className={`${styles.halant} text-2xl`}>All Stories</h2>
        <p className="text-sm" style={{ color: "#9a7a65" }}>Browse, filter, and open your saved story adventures.</p>
      </div>

      {/* ── Search & Filter ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "#9a7a65" }} />
          <input
            placeholder="Search story title or id..."
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
              {(["all", "Published", "Draft"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(s);
                    setFilterOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium transition"
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
                {["Story", "Status", "Scenes", "Details", "Actions"].map((h, i) => (
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
            <tbody>
              {filtered.map((story) => {
                const StatusIcon = statusConfig[story.status as StoryStatus]?.icon ?? BookOpenText;
                const badgeClass = statusConfig[story.status as StoryStatus]?.badgeClass ?? "bg-muted text-muted-foreground border-border";
                const preview = previewItemsForStory(story.id);

                return (
                  <motion.tr
                    key={story.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="transition"
                    style={{ borderTop: "1px solid #e9e0d5" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(240 232 220 / 0.4)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <img src={story.cover} alt={story.title} className="size-10 rounded-lg object-cover shadow-sm" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>{story.title}</p>
                          <p className="font-mono text-[11px]" style={{ color: "#9a7a65" }}>{story.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass)}>
                        <StatusIcon className="size-3.5" />
                        {story.status}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {preview.length ? <AnimatedTooltip items={preview} /> : <span className="text-xs" style={{ color: "#9a7a65" }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5 text-sm" style={{ color: "#9a7a65" }}>
                        <p>{getPageCount(story.id)} pages · {getChapterCount(story.id)} chapters</p>
                        <p className="text-[11px]">Ages {story.ageBand} · {story.duration}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="relative inline-flex items-center gap-2" data-row-menu>
                        <Link
                          href={`/dashboard/stories/${story.id}`}
                          className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition"
                          style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#ede7dd")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRowMenuOpen((v) => (v === story.id ? "" : story.id))}
                          className="inline-flex size-8 items-center justify-center rounded-full transition"
                          style={{ background: "#fcf6ef", border: "1px solid #dbc9b7", color: "#2b180a" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#ede7dd")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fcf6ef")}
                          aria-label="More actions"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {rowMenuOpen === story.id && (
                          <div
                            className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl shadow-lg"
                            style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
                          >
                            <Link
                              href={`/dashboard/stories/${story.id}`}
                              className="block px-3 py-2 text-left text-sm font-medium transition"
                              style={{ color: "#2b180a" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0e8dc")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              onClick={() => setRowMenuOpen("")}
                            >
                              Read Story
                            </Link>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm font-medium transition"
                              style={{ color: "#2b180a" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0e8dc")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              onClick={async () => {
                                await navigator.clipboard.writeText(story.id);
                                setRowMenuOpen("");
                              }}
                            >
                              Copy Story ID
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
        {filtered.map((story) => {
          const StatusIcon = statusConfig[story.status as StoryStatus]?.icon ?? BookOpenText;
          const badgeClass = statusConfig[story.status as StoryStatus]?.badgeClass ?? "bg-muted text-muted-foreground border-border";
          const preview = previewItemsForStory(story.id);

          return (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26 }}
              className="rounded-2xl p-4 shadow-sm"
              style={{ border: "1px solid #dbc9b7", background: "#fcf6ef" }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={story.cover} alt={story.title} className="size-10 rounded-lg object-cover shadow-sm" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold" style={{ color: "#2b180a" }}>{story.title}</h3>
                      <p className="font-mono text-[11px]" style={{ color: "#9a7a65" }}>{story.id}</p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/stories/${story.id}`}
                    className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#fdf8f3", border: "1px solid #dbc9b7", color: "#2b180a" }}
                  >
                    Open
                  </Link>
                </div>
                <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass)}>
                  <StatusIcon className="size-3.5" />
                  {story.status}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Details</p>
                    <p className="mt-1 font-medium" style={{ color: "#2b180a" }}>{getPageCount(story.id)} pages · {getChapterCount(story.id)} ch.</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Age / Duration</p>
                    <p className="mt-1 font-medium" style={{ color: "#2b180a" }}>Ages {story.ageBand} · {story.duration}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9a7a65" }}>Scenes</p>
                  {preview.length ? <AnimatedTooltip items={preview} /> : <p className="text-xs" style={{ color: "#9a7a65" }}>—</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center text-sm"
          style={{ border: "2px dashed #dbc9b7", color: "#9a7a65" }}
        >
          No stories found for the current filters.
        </div>
      )}
    </motion.section>
  );
}
