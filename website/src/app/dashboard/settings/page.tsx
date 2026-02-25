"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import styles from "../dashboard.module.css";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

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
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOutExpo }}
      className="space-y-4 rounded-3xl p-4 shadow-sm md:p-5"
      style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
    >
      <div className="space-y-1">
        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a7a65" }}>
          Settings
        </p>
        <h2 className={`${styles.halant} text-2xl`}>Workspace Preferences</h2>
        <p className="text-sm" style={{ color: "#9a7a65" }}>
          Control generation defaults and family-safety behavior for your Dream workspace.
        </p>
      </div>

      <div className="space-y-3">
        {settingRows.map((row, index) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.06, ease: easeOutExpo }}
            className="flex items-start justify-between gap-4 rounded-2xl p-4"
            style={{ border: "1px solid #dbc9b7", background: "#fcf6ef" }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "#2b180a" }}>{row.title}</p>
              <p className="mt-1 text-sm" style={{ color: "#9a7a65" }}>{row.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings[row.id]}
              onClick={() => setSettings((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
              className="relative h-7 w-12 shrink-0 rounded-full transition"
              style={{ background: settings[row.id] ? "#2b180a" : "#dbc9b7" }}
            >
              <span
                className="absolute top-1 block size-5 rounded-full bg-white transition-all"
                style={{ left: settings[row.id] ? "1.5rem" : "0.25rem" }}
              />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
