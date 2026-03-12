"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Github, Play, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Fragment, useState } from "react";

import DreamNavbar from "@/components/ui/dream-navbar";
import MadeWith from "@/components/ui/made-with";

import styles from "./home-landing.module.css";

const serviceSteps = [
  {
    title: "Choose Mode",
    number: "01",
    body: "Start in normal chat or switch to search, study, story, or quiz. Dream routes each request to the right workflow automatically.",
    image:
      "https://framerusercontent.com/images/rHNMALBdiDG9WKbZg2x6f1Q9As.png?width=684&height=1374",
    cta: "Open chat modes",
  },
  {
    title: "Generate Assets",
    number: "02",
    body: "Story and quiz flows call specialized A2A services for character design, story drafting, page imagery, and optional narration.",
    image:
      "https://framerusercontent.com/images/FlUmh6vXM6MYl8Y9u6yVDUKkSAg.png?width=1492&height=1454",
    cta: "Run generation",
  },
  {
    title: "Track Jobs",
    number: "03",
    body: "Follow progress in real time through streamed events, then open job details and download output assets in the dashboard.",
    image:
      "https://framerusercontent.com/images/xS3VRUcNazVQ09WqJiWUYi39XeI.jpg?width=1200&height=900",
    cta: "View job activity",
  },
];

const processSteps = [
  {
    number: "01",
    title: "Pick a Workflow",
    timeline: "10-30 sec",
    copy: "Use chat mode switching to run normal Q&A, web-grounded search, document study, storybook generation, or quiz generation.",
  },
  {
    number: "02",
    title: "Run the Job",
    timeline: "1-4 mins",
    copy: "The orchestrator creates a tracked job, routes work to specialist services, and streams structured progress updates as outputs are generated.",
  },
  {
    number: "03",
    title: "Review Outputs",
    timeline: "Anytime",
    copy: "Open job pages to inspect events, reuse characters, revisit generated stories, and download image or audio assets when available.",
  },
];

const faqItems = [
  {
    q: "What is Dream, exactly?",
    a: "Dream is a Next.js + FastAPI multi-agent system for chat, storybooks, and quizzes. The website proxies requests to an orchestrator that coordinates specialist A2A services.",
  },
  {
    q: "Which modes are available in chat?",
    a: "Five modes are implemented: normal, search, study, story, and quiz. Story and quiz modes create tracked generation jobs with streamed progress.",
  },
  {
    q: "How are long-running tasks tracked?",
    a: "Jobs are stored in SQLite with status, events, and assets. Progress streams are exposed in chat and through job detail pages for real-time monitoring.",
  },
  {
    q: "Can we reuse existing characters?",
    a: "Yes. Character generation supports create and regenerate paths, and story workflows can reuse a selected character so visuals stay consistent across runs.",
  },
  {
    q: "What does a generated storybook include?",
    a: "The current storybook contract targets 12 spreads total, with a cover and ten illustrated story scenes, plus optional narration outputs when enabled.",
  },
  {
    q: "Is there grounding and safety support?",
    a: "Search and study modes support grounded answers using retrieval integrations, and optional content safety checks are available in the orchestrator pipeline.",
  },
];

const heroMarqueeImages = [
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_1.png",
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_2.png",
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_3.png",
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_4.png",
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_5.png",
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_6.png",
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_7.png",
  "https://raw.githubusercontent.com/yashwanth-3000/svg/refs/heads/main/intro_pic_8.webp",
];

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

const blockMotion = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.74,
      delay,
      ease: easeOutExpo,
    },
  }),
};

const headingLineMotion = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.06,
    },
  },
};

const headingWordMotion = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.62,
      ease: easeOutExpo,
    },
  },
};

const sectionHeadingViewport = {
  once: true,
  amount: 0.2,
  margin: "0px 0px -8% 0px",
} as const;

const withDelay = (delay: number): CSSProperties =>
  ({
    "--reveal-delay": `${delay}ms`,
  }) as CSSProperties;

function AnimatedSubheading({ text }: { text: string }) {
  return (
    <motion.h2
      className={styles.sectionTitle}
      initial="hidden"
      whileInView="show"
      viewport={sectionHeadingViewport}
      variants={headingLineMotion}
    >
      {text.split(" ").map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          {index > 0 && " "}
          <motion.span
            className={styles.sectionWord}
            variants={headingWordMotion}
          >
            {word}
          </motion.span>
        </Fragment>
      ))}
    </motion.h2>
  );
}

export default function HomeLanding() {
  const [activeService, setActiveService] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  const duplicatedMarqueeImages = [...heroMarqueeImages, ...heroMarqueeImages];

  return (
    <div className={styles.page}>
      <DreamNavbar />

      <main className={styles.main}>
        <section className={styles.heroOuter} id="home-section">
          <div className={styles.heroInner}>
          <motion.div
            className={styles.heroText}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            custom={0.02}
            style={withDelay(0)}
          >
            <motion.h1
              className={styles.heroTitle}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.72, margin: "0px 0px -10% 0px" }}
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.085,
                    delayChildren: 0.12,
                  },
                },
              }}
            >
              {"From imagination to finished storybooks.".split(" ").map((word, index) => (
                <motion.span
                  key={`${word}-${index}`}
                  variants={{
                    hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
                    show: {
                      opacity: 1,
                      y: 0,
                      filter: "blur(0px)",
                      transition: {
                        duration: 0.72,
                        ease: easeOutExpo,
                      },
                    },
                  }}
                  className={styles.heroWord}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            <p className={styles.heroCopy}>
              Dream turns one text prompt into a kid-safe storybook with reusable
              characters and read-aloud voice support. Each session becomes a
              meaningful family ritual where kids build original characters,
              think through story choices, and strengthen focus through active
              reading.
            </p>

            <div className={styles.heroActions}>
              <a href="/chat" className={styles.ctaDark}>
                Create with Dream
              </a>
              <button className={styles.ctaSoft} type="button">
                Watch product demo
                <ChevronRight size={16} />
              </button>
            </div>

          </motion.div>
          </div>

          <div className={styles.heroMarquee} aria-hidden>
            <motion.div
              className={styles.heroMarqueeTrack}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ ease: "linear", duration: 36, repeat: Infinity }}
            >
              {duplicatedMarqueeImages.map((src, idx) => (
                <div
                  key={idx}
                  className={styles.heroMarqueeCard}
                  style={{ transform: `rotate(${idx % 2 === 0 ? "-2deg" : "5deg"})` }}
                >
                  <img src={src} alt="" loading="lazy" className={styles.heroMarqueeImg} />
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className={styles.section} id="what-dream-is">
          <motion.div
            className={styles.introBlock}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            custom={0.02}
          >
            <p className={styles.sectionKicker}>What Dream is</p>
            <AnimatedSubheading text="An orchestrated storytelling platform." />
            <p className={styles.sectionCopy}>
              Dream combines a Next.js interface, API proxy routes, and a
              FastAPI orchestrator that coordinates character, storybook, and
              quiz services through the A2A protocol.
            </p>
          </motion.div>

          <motion.div
            className={styles.metricsArea}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.32 }}
            custom={0.09}
          >
            <div className={styles.metricGrid}>
              <article className={styles.metricCard}>
                <h3>5 Modes</h3>
                <p>Normal, Search, Study, Story, and Quiz in one chat UX</p>
              </article>
              <article className={styles.metricCard}>
                <h3>3 Services</h3>
                <p>Character, Storybook, and Quiz backends connected via A2A</p>
              </article>
              <article className={styles.metricCard}>
                <h3>Live Jobs</h3>
                <p>Streaming updates through NDJSON and SSE event channels</p>
              </article>
            </div>

            <article className={styles.hiringCard}>
              <div>
                <p className={styles.hiringTitle}>Built for real imagination loops</p>
                <p className={styles.hiringOpen}>Chat + Dashboard + Orchestrator</p>
                <p className={styles.hiringCopy}>
                  One request path handles routing, safety, retrieval, job
                  tracking, and asset delivery without manual glue code.
                </p>
              </div>
              <a href="/chat" className={styles.ctaDarkSmall}>
                Try Dream now
              </a>
            </article>
          </motion.div>
        </section>

        {/* ── Two ways to create ── */}
        <section className={styles.section}>
          <motion.div
            className={styles.introBlock}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            custom={0.02}
          >
            <p className={styles.sectionKicker}>Two ways to create</p>
            <AnimatedSubheading text="Chat freely, or build step by step." />
            <p className={styles.sectionCopy}>
              Use chat for fast generation and mode switching, then move to
              dashboard pages for job history, assets, and deeper inspection.
            </p>
          </motion.div>

          <div className={styles.modesGrid}>
            {/* Chat card — primary */}
            <motion.article
              className={styles.modeCardDark}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              whileHover={{ y: -6, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } }}
              viewport={{ once: true, amount: 0.3 }}
              custom={0.07}
            >
              <div className={styles.modeBadge}>Recommended for most</div>
              <div className={styles.modeIconWrap}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className={styles.modeTitle}>Chat with Dream</h3>
              <p className={styles.modeDesc}>
                Describe intent in plain language and change modes inline.
                Dream manages routing, streaming, and final payload assembly
                while you stay in one conversation.
              </p>
              <ul className={styles.modeFeatures}>
                <li>Mode-aware routing in one interface</li>
                <li>Live progress during story and quiz jobs</li>
                <li>Best for quick iteration and first runs</li>
              </ul>
              <a href="/chat" className={styles.modeCta}>
                Start chatting <ArrowUpRight size={14} />
              </a>
            </motion.article>

            {/* Studio card — secondary */}
            <motion.article
              className={styles.modeCardWarm}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              whileHover={{ y: -6, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } }}
              viewport={{ once: true, amount: 0.3 }}
              custom={0.13}
            >
              <div className={styles.modeBadgeWarm}>For specific workflows</div>
              <div className={styles.modeIconWrapWarm}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
              <h3 className={styles.modeTitleWarm}>Dream Studio</h3>
              <p className={styles.modeDescWarm}>
                Use dedicated pages to inspect generated artifacts, replay jobs,
                test endpoints, and manage reusable characters and stories.
              </p>
              <ul className={styles.modeFeaturesWarm}>
                <li>Jobs dashboard with event timelines</li>
                <li>Character and story libraries</li>
                <li>Best for operators and repeat workflows</li>
              </ul>
              <a href="/dashboard" className={styles.modeCtaWarm}>
                Open Studio <ArrowUpRight size={14} />
              </a>
            </motion.article>
          </div>
        </section>

        <section className={styles.section} id="dream-studio-section">
          <motion.div
            className={styles.introBlock}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            custom={0.02}
          >
            <p className={styles.sectionKicker}>Dream Studio</p>
            <AnimatedSubheading text="Orchestration from prompt to assets." />
            <p className={styles.sectionCopy}>
              Requests are routed to specialized agents, then merged into
              structured outputs with job metadata, assets, and stream logs.
            </p>
          </motion.div>

          <motion.div
            className={styles.studioCard}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            custom={0.09}
          >
            {/* ── Left: vertical step list ── */}
            <div className={styles.studioSteps}>
              {serviceSteps.map((item, idx) => {
                const active = idx === activeService;
                return (
                  <button
                    key={item.title}
                    type="button"
                    className={`${styles.studioStep} ${active ? styles.studioStepActive : ""}`}
                    onMouseEnter={() => setActiveService(idx)}
                    onClick={() => setActiveService(idx)}
                  >
                    <span className={styles.studioNum}>{item.number}</span>
                    <div className={styles.studioStepInner}>
                      <span className={styles.studioStepName}>{item.title}</span>
                      <AnimatePresence initial={false}>
                        {active && (
                          <motion.div
                            key="body"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.36, ease: easeOutExpo }}
                            style={{ overflow: "hidden" }}
                          >
                            <p className={styles.studioBody}>{item.body}</p>
                            <a href="/chat" className={styles.studioLink}>
                              {item.cta} <ArrowUpRight size={12} />
                            </a>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Right: image poster ── */}
            <div className={styles.studioPosterWrap}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={serviceSteps[activeService].title}
                  className={styles.studioPoster}
                  style={{ "--service-poster": `url(${serviceSteps[activeService].image})` } as CSSProperties}
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.48, ease: easeOutExpo }}
                >
                  <div className={styles.posterGlow} />
                  <div className={styles.studioChip}>
                    <span className={styles.studioChipNum}>{serviceSteps[activeService].number}</span>
                    <span>{serviceSteps[activeService].title}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </section>

        <section className={styles.section} id="how-we-work">
          <motion.div
            className={styles.introBlock}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            custom={0.02}
          >
            <p className={styles.sectionKicker}>How Dream works</p>
            <AnimatedSubheading text="From prompt to streamed results." />
            <p className={styles.sectionCopy}>
              The same path powers chat, dashboard views, and long-running
              generation with observability built in.
            </p>
            <div className={styles.heroActions}>
              <a href="/chat" className={styles.ctaDark}>
                Open chat
              </a>
              <button className={styles.ctaSoft} type="button">
                Explore workflow
                <Play size={16} />
              </button>
            </div>
          </motion.div>

          <div className={styles.processGrid}>
            {processSteps.map((step, index) => (
              <motion.article
                key={step.number}
                className={styles.processCard}
                variants={blockMotion}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.35 }}
                custom={0.08 + index * 0.08}
              >
                <p className={styles.processNumber}>{step.number}</p>
                <div>
                  <div className={styles.processTitleRow}>
                    <p className={styles.processTitle}>{step.title}</p>
                    <p className={styles.processTimeline}>{step.timeline}</p>
                  </div>
                  <p>{step.copy}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <motion.div
            className={styles.introBlock}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            custom={0.02}
          >
            <p className={styles.sectionKicker}>Why Dream</p>
            <AnimatedSubheading text="Built as a connected system." />
            <p className={styles.sectionCopy}>
              Dream focuses on durable workflows: routed requests, streamed job
              state, reusable assets, and clear failure visibility.
            </p>
          </motion.div>

          <div className={styles.compareGrid}>
            {/* ── Generic tools (dark) ── */}
            <motion.article
              className={`${styles.compareCard} ${styles.compareDark}`}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              custom={0.08}
            >
              <div className={styles.compareTop}>
                <span className={styles.compareBadgeDark}>Generic tools</span>
                <h3 className={styles.compareTitle}>One-off outputs with weak traceability.</h3>
                <p className={styles.compareDesc}>
                  Prompt-only tools usually miss durable state, routing rules,
                  and reliable progress tracking.
                </p>
              </div>
              <div className={styles.compareDivider} />
              <ul className={styles.compareList}>
                {[
                  "No durable job history",
                  "No service-level orchestration",
                  "Hard to inspect failures or retries",
                  "Limited character continuity controls",
                ].map((item) => (
                  <li key={item} className={styles.compareItem}>
                    <span className={styles.iconBad}><X size={10} strokeWidth={3} /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.article>

            {/* ── Dream (warm) ── */}
            <motion.article
              className={`${styles.compareCard} ${styles.compareWarm}`}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              custom={0.14}
            >
              <div className={styles.compareTop}>
                <span className={styles.compareBadgeWarm}>Dream</span>
                <h3 className={styles.compareTitle}>Orchestrated, observable, and reusable.</h3>
                <p className={styles.compareDesc}>
                  A single system joins chat UX, orchestrator logic, and
                  specialist services with persistent run data.
                </p>
              </div>
              <div className={styles.compareDivider} />
              <ul className={styles.compareList}>
                {[
                  "Mode-aware routing with fallback logic",
                  "Character create + regenerate paths",
                  "Persistent jobs, events, and asset files",
                  "Live status in chat and dashboard",
                ].map((item) => (
                  <li key={item} className={styles.compareItem}>
                    <span className={styles.iconGood}><Check size={10} strokeWidth={3} /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.caseGrid}>
            <motion.article
              className={styles.caseCopy}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              custom={0.03}
            >
              <p className={styles.sectionKicker}>Dream in production</p>
              <AnimatedSubheading text="One orchestrator coordinating specialists." />
              <p className={styles.sectionCopy}>
                A story request can trigger blueprint generation, character
                creation or reuse, scene prompt writing, image rendering, and
                optional narration while emitting structured progress events.
              </p>
              <div className={styles.caseStats}>
                <div>
                  <h3>12</h3>
                  <p>Storybook spreads per run (cover + scenes)</p>
                </div>
                <div>
                  <h3>2 Streams</h3>
                  <p>NDJSON in chat and SSE in job detail pages</p>
                </div>
              </div>
            </motion.article>

            <motion.div
              className={styles.caseVisual}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              custom={0.13}
              aria-hidden
            >
              <div className={styles.bloomTall} />
            </motion.div>
          </div>
        </section>

        <section className={styles.section} id="faq">
          <motion.div
            className={styles.introBlock}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            custom={0.02}
          >
            <p className={styles.sectionKicker}>FAQ</p>
            <AnimatedSubheading text="Your questions answered." />
            <p className={styles.sectionCopy}>
              Common questions about modes, job flow, safety, and system design.
            </p>
          </motion.div>

          <div className={styles.faqList}>
            {faqItems.map((item, index) => {
              const open = openFaq === index;
              return (
                <motion.article
                  key={item.q}
                  className={`${styles.faqItem} ${open ? styles.faqItemOpen : ""}`}
                  variants={blockMotion}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.35 }}
                  custom={0.05 + index * 0.045}
                  layout
                  layoutRoot
                >
                  <motion.button
                    type="button"
                    className={styles.faqButton}
                    onClick={() => setOpenFaq(open ? -1 : index)}
                    aria-expanded={open}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.18, ease: easeOutExpo }}
                  >
                    <span>{item.q}</span>
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.38, ease: easeOutExpo }}
                      style={{ display: "flex", flexShrink: 0 }}
                    >
                      <ChevronDown size={16} />
                    </motion.span>
                  </motion.button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="panel"
                        initial={{ height: 0, opacity: 0, y: -6 }}
                        animate={{ height: "auto", opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -4 }}
                        transition={{ duration: 0.42, ease: easeOutExpo }}
                        style={{ overflow: "hidden" }}
                      >
                        <p className={styles.faqAnswer}>{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        {/* ── Brand row ── */}
        <div className={styles.footerTop}>
          <div className={styles.footerBrandBlock}>
            <h2 className={`${styles.footerBrand} ${styles.displayFont}`}>Dream</h2>
            <p className={styles.footerTagline}>
              Agent-orchestrated<br />story generation.
            </p>
            <a
              href="https://github.com/yashwanth-3000/Dream"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerGithub}
            >
              <Github size={13} />
              yashwanth-3000/Dream
            </a>
          </div>
          <div className={styles.footerFlower} aria-hidden />
        </div>

        {/* ── Link columns ── */}
        <div className={styles.footerCols}>
          {/* Navigate */}
          <div>
            <p className={styles.colTitle}>Navigate</p>
            <a href="#home-section" className={styles.footerLink}>Home</a>
            <a href="#dream-studio-section" className={styles.footerLink}>Studio</a>
            <a href="#how-we-work" className={styles.footerLink}>How It Works</a>
            <a href="#faq" className={styles.footerLink}>FAQ</a>
          </div>

          {/* Product — real dashboard links */}
          <div>
            <p className={styles.colTitle}>Product</p>
            <Link href="/chat" className={styles.footerLink}>AI Chat</Link>
            <Link href="/dashboard/test-ui" className={styles.footerLink}>Test UI</Link>
            <Link href="/dashboard/stories" className={styles.footerLink}>Story Library</Link>
            <Link href="/dashboard/characters" className={styles.footerLink}>Character Vault</Link>
            <Link href="/dashboard/jobs" className={styles.footerLink}>Generation Jobs</Link>
          </div>

          {/* Company */}
          <div>
            <p className={styles.colTitle}>Company</p>
            <Link href="/about" className={styles.footerLink}>About Dream</Link>
            <a
              href="https://github.com/yashwanth-3000/Dream"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              GitHub
            </a>
            <a href="mailto:hello@dream.ai" className={styles.footerLink}>Contact</a>
            <Link href="/dashboard" className={styles.footerLink}>Dashboard</Link>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className={styles.footerBottom}>
          <p>© 2026 Dream AI · All rights reserved.</p>
          <MadeWith />
        </div>
      </footer>
    </div>
  );
}
