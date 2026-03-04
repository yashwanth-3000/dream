"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, FlaskConical } from "lucide-react";

import styles from "../dashboard.module.css";

const TEST_LINKS = [
  {
    href: "/dashboard/api-test",
    title: "Character API Test",
    body: "Run character-generation checks and inspect orchestrator output.",
    cta: "Open Character Test",
    icon: FlaskConical,
  },
  {
    href: "/dashboard/storybook-test",
    title: "Storybook Test",
    body: "Run storybook pipeline tests with stream logs and page previews.",
    cta: "Open Storybook Test",
    icon: BookOpenText,
  },
  {
    href: "/dashboard/quiz-test",
    title: "Quiz Test",
    body: "Run quiz-generation tests with live A2A logs, hints, and answer explanation checks.",
    cta: "Open Quiz Test",
    icon: Brain,
  },
] as const;

export default function DashboardTestUiPage() {
  return (
    <section
      className="space-y-4 rounded-3xl p-4 shadow-sm md:p-5"
      style={{ background: "#fdf8f3", border: "1px solid #dbc9b7" }}
    >
      <div className="space-y-1">
        <h2 className={`${styles.halant} text-2xl`}>Test UI</h2>
        <p className="text-sm" style={{ color: "#9a7a65" }}>
          Choose the test workspace for character, storybook, or quiz APIs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEST_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`group ${styles.quickCard}`}>
              <span
                className="inline-flex size-9 items-center justify-center rounded-xl"
                style={{ background: "#f0e8dc", color: "#8b5e3c" }}
              >
                <Icon className="size-4" />
              </span>
              <h3 className={`${styles.halant} mt-3 text-xl`}>{item.title}</h3>
              <p className="mt-2 text-sm" style={{ color: "#9a7a65" }}>{item.body}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "#8b5e3c" }}>
                {item.cta}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
