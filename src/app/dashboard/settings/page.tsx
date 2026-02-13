"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const settingRows = [
  {
    id: "safe-mode",
    title: "Safe Mode",
    description: "Enforce strict kid-safe storytelling constraints on all outputs.",
    defaultValue: true,
  },
  {
    id: "auto-subtitles",
    title: "Auto Subtitles",
    description: "Generate subtitles for every video scene automatically.",
    defaultValue: true,
  },
  {
    id: "parent-review",
    title: "Parent Review Required",
    description: "Require approval before publishing generated content.",
    defaultValue: false,
  },
];

export default function DashboardSettingsPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(settingRows.map((row) => [row.id, row.defaultValue]))
  );

  return (
    <section className="space-y-4 rounded-3xl border border-border/60 bg-white/80 p-4 shadow-sm backdrop-blur md:p-5 animate-fade-soft dark:border-white/10 dark:bg-[#101010]/95">
      <div className="space-y-1 animate-in-view">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Settings</p>
        <h2 className="text-2xl font-black tracking-tight text-foreground">Workspace Preferences</h2>
        <p className="text-sm text-muted-foreground">Control generation defaults and family-safety behavior for your Dream workspace.</p>
      </div>

      <div className="space-y-3">
        {settingRows.map((row, index) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.06 }}
            className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-white p-4 micro-card dark:border-white/10 dark:bg-[#151515]"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{row.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings[row.id]}
              onClick={() => setSettings((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                settings[row.id] ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 block size-5 rounded-full bg-white dark:!bg-white transition ${
                  settings[row.id] ? "left-6" : "left-1"
                }`}
              />
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
