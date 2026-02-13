/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, MoreVertical, Search, Sparkles, Palette, Users } from "lucide-react";
import { motion } from "framer-motion";

import { dashboardCharacters } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/* ── unique age bands for filter ───────────────────────────────── */

const ageBands = Array.from(new Set(dashboardCharacters.map((c) => c.ageBand))).sort();

/* ── page ───────────────────────────────────────────────────────── */

export default function DashboardCharactersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgeBand, setSelectedAgeBand] = useState<string>("all");
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
    return dashboardCharacters.filter((char) => {
      const matchesSearch =
        !q ||
        char.name.toLowerCase().includes(q) ||
        char.role.toLowerCase().includes(q) ||
        char.id.toLowerCase().includes(q) ||
        char.mood.toLowerCase().includes(q);
      const matchesAge = selectedAgeBand === "all" || char.ageBand === selectedAgeBand;
      return matchesSearch && matchesAge;
    });
  }, [searchQuery, selectedAgeBand]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 rounded-3xl border border-border/60 bg-white dark:bg-[#141414]/80 p-4 shadow-sm backdrop-blur md:p-5 dark:border-white/10 dark:bg-[#101010]/95"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h2 className="text-2xl font-black tracking-tight text-foreground">All Characters</h2>
        <p className="text-sm text-muted-foreground">Reusable kid characters and style palettes for faster story generation.</p>
      </div>

      {/* ── Search & Filter ────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search name, role, or mood..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-border bg-white dark:bg-[#141414] py-2.5 pl-10 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-primary/50"
          />
        </div>

        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white dark:bg-[#141414] px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted micro-btn"
          >
            <Filter className="size-4" />
            Filter
            <ChevronDown className="size-4" />
          </button>
          {filterOpen && (
            <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-white dark:bg-[#141414] shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setSelectedAgeBand("all");
                  setFilterOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm font-medium transition hover:bg-muted",
                  selectedAgeBand === "all" ? "bg-primary/10 text-primary" : "text-foreground"
                )}
              >
                All Ages
              </button>
              {ageBands.map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => {
                    setSelectedAgeBand(band);
                    setFilterOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm font-medium transition hover:bg-muted",
                    selectedAgeBand === band ? "bg-primary/10 text-primary" : "text-foreground"
                  )}
                >
                  Ages {band}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop Table ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="hidden overflow-hidden rounded-2xl border border-border/70 bg-white dark:bg-[#141414] lg:block"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Character</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Details</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Palette</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filtered.map((char) => (
                <motion.tr
                  key={char.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24 }}
                  className="transition hover:bg-muted/30"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={char.avatar}
                        alt={char.name}
                        className="size-10 rounded-full object-cover shadow-sm"
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{char.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{char.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Users className="size-3.5" />
                      {char.role}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      <p>Ages {char.ageBand}</p>
                      <p className="text-[11px]">{char.mood}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {char.palette.map((color) => (
                        <span
                          key={color}
                          className="size-5 rounded-full border border-border/60 transition-transform duration-200 hover:scale-110"
                          style={{ backgroundColor: color }}
                          aria-label={color}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="relative inline-flex items-center gap-2" data-row-menu>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted micro-btn"
                      >
                        <Sparkles className="size-3.5" />
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => setRowMenuOpen((v) => (v === char.id ? "" : char.id))}
                        className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-white dark:bg-[#141414] text-foreground transition hover:bg-muted micro-btn"
                        aria-label="More actions"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                      {rowMenuOpen === char.id && (
                        <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-border bg-white dark:bg-[#141414] shadow-lg">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                            onClick={() => setRowMenuOpen("")}
                          >
                            Edit Character
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                            onClick={async () => {
                              await navigator.clipboard.writeText(char.id);
                              setRowMenuOpen("");
                            }}
                          >
                            Copy Character ID
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Mobile Cards ───────────────────────────────────────── */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((char) => (
          <motion.div
            key={char.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26 }}
            className="rounded-2xl border border-border/70 bg-white dark:bg-[#141414] p-4 shadow-sm micro-card"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={char.avatar}
                    alt={char.name}
                    className="size-10 rounded-full object-cover shadow-sm"
                  />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{char.name}</h3>
                    <p className="font-mono text-[11px] text-muted-foreground">{char.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground micro-btn"
                >
                  <Sparkles className="size-3.5" />
                  Use
                </button>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
                <Users className="size-3.5" />
                {char.role}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Age Band</p>
                  <p className="mt-1 font-medium text-foreground">Ages {char.ageBand}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mood</p>
                  <p className="mt-1 font-medium text-foreground">{char.mood}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Palette className="size-3.5" />
                  Palette
                </p>
                <div className="flex items-center gap-2">
                  {char.palette.map((color) => (
                    <span
                      key={color}
                      className="size-5 rounded-full border border-border/60 transition-transform duration-200 hover:scale-110"
                      style={{ backgroundColor: color }}
                      aria-label={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Empty state ────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No characters found for the current filters.
        </div>
      )}
    </motion.section>
  );
}
