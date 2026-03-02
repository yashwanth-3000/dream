"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Github, Play, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import DreamNavbar from "@/components/ui/dream-navbar";
import MadeWith from "@/components/ui/made-with";

import styles from "./home-landing.module.css";

const serviceSteps = [
  {
    title: "Prompt",
    number: "01",
    body: "Type one idea, one character, or one mood. Dream turns it into a child-safe creative starting point in seconds.",
    image:
      "https://framerusercontent.com/images/rHNMALBdiDG9WKbZg2x6f1Q9As.png?width=684&height=1374",
    cta: "Start a prompt",
  },
  {
    title: "Story",
    number: "02",
    body: "Generate a full age-appropriate story arc with tone controls, reading level controls, and consistent character memory.",
    image:
      "https://framerusercontent.com/images/FlUmh6vXM6MYl8Y9u6yVDUKkSAg.png?width=1492&height=1454",
    cta: "Generate story",
  },
  {
    title: "Quiz",
    number: "03",
    body: "After reading, parents can ask chat to \"create a quiz based on this storybook\" and get age-appropriate questions instantly.",
    image:
      "https://framerusercontent.com/images/3jSoIlDJyMfLx6JTWfHwuwwhjSw.png?scale-down-to=2048&width=2144&height=730",
    cta: "Create quiz",
  },
  {
    title: "Read Aloud",
    number: "04",
    body: "Attach text-to-voice narration to read every story out loud for accessibility, early readers, and bedtime routines.",
    image:
      "https://framerusercontent.com/images/xS3VRUcNazVQ09WqJiWUYi39XeI.jpg?width=1200&height=900",
    cta: "Play narration",
  },
];

const processSteps = [
  {
    number: "01",
    title: "Describe the Idea",
    timeline: "1 min",
    copy: "Kids or parents type a simple prompt like 'a brave fox astronaut' and choose tone, age range, and story length.",
  },
  {
    number: "02",
    title: "Generate Storybook",
    timeline: "2-3 mins",
    copy: "Dream writes a complete kid-safe storybook with matching visuals, clear pacing, and optional lesson-focused structure.",
  },
  {
    number: "03",
    title: "Read, Reflect, Quiz",
    timeline: "Anytime",
    copy: "Reuse characters, ask chat for a quiz based on the storybook, and turn on read-aloud voice for reflection and comprehension.",
  },
];

const faqItems = [
  {
    q: "What is Dream, exactly?",
    a: "Dream is a kid-safe storybook platform. You write a prompt, Dream creates a personalized storybook, and parents can ask chat to generate quizzes from it.",
  },
  {
    q: "Why is Dream storybook-first?",
    a: "Many kids are stuck in high-speed screen routines that fragment attention. Dream resets the pattern with complete stories, active reading, and parent-led quiz reflection so creativity and confidence grow over time.",
  },
  {
    q: "Can parents create quizzes from a finished storybook?",
    a: "Yes. In chat, simply type: \"Create a quiz based on this storybook.\" Dream generates age-appropriate questions with answer checks.",
  },
  {
    q: "Do you support read-aloud accessibility?",
    a: "Yes. Dream includes attached text-to-voice narration so stories can be read out loud for accessibility and emerging readers.",
  },
  {
    q: "Is Dream safe for children?",
    a: "Yes. Dream uses kid-focused moderation and age-aware generation rules to keep outputs appropriate for family and classroom use.",
  },
  {
    q: "Can we reuse the same characters over time?",
    a: "Yes. Dream keeps character memory so children can continue their favorite worlds instead of starting from scratch each time.",
  },
  {
    q: "Does Dream work for classrooms too?",
    a: "Yes. Teachers use Dream for reading practice, creative writing prompts, and collaborative storytelling activities.",
  },
];

const team = [
  {
    name: "Marcus Chen",
    role: "Story Systems Lead",
    image:
      "https://framerusercontent.com/images/pT0JmsN2TRfIHy3pQc3lhNMabs0.png?width=1024&height=2000",
  },
  {
    name: "Amira Hassan",
    role: "Child Safety Specialist",
    image:
      "https://framerusercontent.com/images/E4puL2ldoiQmc8Q9Ju4gW6uxg.png?width=1024&height=2000",
  },
  {
    name: "David Park",
    role: "Storybook Experience Engineer",
    image:
      "https://framerusercontent.com/images/RoOV7tIiyQQk02qpHtIeMdUpMA.png?width=1024&height=2000",
  },
  {
    name: "Elena Martinez",
    role: "Learning Experience",
    image:
      "https://framerusercontent.com/images/Nj8ejHUjmUrxbMwRLUCsHAtarxA.png?width=1024&height=2000",
  },
];

const heroScrollerImages = [
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531265726475-52ad60219627?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1000&auto=format&fit=crop&q=80",
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
  once: false,
  amount: 0.9,
  margin: "0px 0px -26% 0px",
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
        <motion.span
          key={`${word}-${index}`}
          className={styles.sectionWord}
          variants={headingWordMotion}
        >
          {word}
        </motion.span>
      ))}
    </motion.h2>
  );
}

export default function HomeLanding() {
  const [activeService, setActiveService] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  const colA = useMemo(
    () => [
      heroScrollerImages[0],
      heroScrollerImages[3],
      heroScrollerImages[6],
      heroScrollerImages[1],
      heroScrollerImages[4],
      heroScrollerImages[7],
    ],
    [],
  );
  const colB = useMemo(
    () => [
      heroScrollerImages[2],
      heroScrollerImages[5],
      heroScrollerImages[8],
      heroScrollerImages[0],
      heroScrollerImages[3],
      heroScrollerImages[6],
    ],
    [],
  );
  const colC = useMemo(
    () => [
      heroScrollerImages[7],
      heroScrollerImages[4],
      heroScrollerImages[1],
      heroScrollerImages[8],
      heroScrollerImages[5],
      heroScrollerImages[2],
    ],
    [],
  );
  const colD = useMemo(
    () => [
      heroScrollerImages[5],
      heroScrollerImages[1],
      heroScrollerImages[8],
      heroScrollerImages[4],
      heroScrollerImages[0],
      heroScrollerImages[7],
    ],
    [],
  );

  return (
    <div className={styles.page}>
      <DreamNavbar />

      <main className={styles.main}>
        <section className={styles.hero} id="home-section">
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
              characters, parent-ready quizzes, and read-aloud voice support.
              Each session becomes a meaningful family ritual where kids build
              original characters, think through story choices, and strengthen
              focus through active reading.
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

          <motion.div
            className={styles.heroVisual}
            aria-hidden
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            custom={0.11}
          >
            <div className={styles.heroGlow} />

            <div className={styles.scrollerColumns}>
              {/* Col A — portrait, scrollUp 34s, no offset */}
              <div className={`${styles.scrollerColumn} ${styles.scrollUp}`}>
                {[...colA, ...colA].map((image, idx) => (
                  <article className={styles.scrollerCard} key={`a-${idx}`}>
                    <img src={image} alt="Dream generated scene" loading="lazy" />
                  </article>
                ))}
              </div>

              {/* Col B — square, scrollDown 28s, offset 64px */}
              <div className={`${styles.scrollerColumn} ${styles.scrollDown}`} style={{ paddingTop: 64 }}>
                {[...colB, ...colB].map((image, idx) => (
                  <article className={`${styles.scrollerCard} ${styles.scrollerCardSq}`} key={`b-${idx}`}>
                    <img src={image} alt="Dream generated scene" loading="lazy" />
                  </article>
                ))}
              </div>

              {/* Col C — portrait, scrollUpSlow 48s, offset 32px */}
              <div className={`${styles.scrollerColumn} ${styles.scrollUpSlow}`} style={{ paddingTop: 32 }}>
                {[...colC, ...colC].map((image, idx) => (
                  <article className={styles.scrollerCard} key={`c-${idx}`}>
                    <img src={image} alt="Dream generated scene" loading="lazy" />
                  </article>
                ))}
              </div>

              {/* Col D — square, scrollDownSlow 42s, offset 96px */}
              <div className={`${styles.scrollerColumn} ${styles.scrollDownSlow}`} style={{ paddingTop: 96 }}>
                {[...colD, ...colD].map((image, idx) => (
                  <article className={`${styles.scrollerCard} ${styles.scrollerCardSq}`} key={`d-${idx}`}>
                    <img src={image} alt="Dream generated scene" loading="lazy" />
                  </article>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Tech stack strip ── */}
        <div className={styles.techStrip}>
          <span className={styles.techLabel}>Built on</span>
          <span className={styles.techDivider} />
          <div className={styles.avatarRow}>
            <span className={styles.logoChip} title="Microsoft">
              <svg viewBox="0 0 21 21" width="14" height="14"><path fill="#f25022" d="M0 0h10v10H0z"/><path fill="#00a4ef" d="M11 0h10v10H11z"/><path fill="#7fba00" d="M0 11h10v10H0z"/><path fill="#ffb900" d="M11 11h10v10H11z"/></svg>
            </span>
            <span className={styles.logoChip} title="Azure AI Foundry">
              <svg viewBox="0 0 96 96" width="15" height="15"><defs><linearGradient id="s-az-a" x1="-1032.17" x2="-1059.21" y1="145.31" y2="65.43" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#114a8b"/><stop offset="1" stopColor="#0669bc"/></linearGradient><linearGradient id="s-az-c" x1="-1027.16" x2="-997.48" y1="147.64" y2="68.56" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#3ccbf4"/><stop offset="1" stopColor="#2892df"/></linearGradient></defs><path fill="url(#s-az-a)" d="M33.34 6.54h26.04l-27.03 80.1a4.15 4.15 0 0 1-3.94 2.81H8.15a4.14 4.14 0 0 1-3.93-5.47L29.4 9.38a4.15 4.15 0 0 1 3.94-2.83z"/><path fill="#0078d4" d="M71.17 60.26H29.88a1.91 1.91 0 0 0-1.3 3.31l26.53 24.76a4.17 4.17 0 0 0 2.85 1.13h23.38z"/><path fill="url(#s-az-c)" d="M66.6 9.36a4.14 4.14 0 0 0-3.93-2.82H33.65a4.15 4.15 0 0 1 3.93 2.82l25.18 74.62a4.15 4.15 0 0 1-3.93 5.48h29.02a4.15 4.15 0 0 0 3.93-5.48z"/></svg>
            </span>
            <span className={styles.logoChip} title="A2A Protocol">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            </span>
            <span className={styles.logoChip} title="CrewAI">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#FF5A50"><path d="M12.482.18C7.161 1.319 1.478 9.069 1.426 15.372c-.051 5.527 3.1 8.68 8.68 8.627 6.716-.05 14.259-6.87 12.09-10.9-.672-1.292-1.396-1.344-2.687-.207-1.602 1.395-1.654.31-.207-2.893 1.757-3.98 1.705-5.322-.31-7.544C17.03.388 14.962-.388 12.482.181Zm5.322 2.068c2.273 2.015 2.376 4.236.465 8.42-1.395 3.1-2.17 3.515-3.824 1.86-1.24-1.24-1.343-3.46-.258-6.044 1.137-2.635.982-3.1-.568-1.653-3.72 3.358-6.458 9.765-5.424 12.503.464 1.189.825 1.395 2.737 1.395 2.79 0 6.303-1.705 7.957-3.926 1.756-2.274 2.79-2.274 2.79-.052 0 3.875-6.459 8.627-11.625 8.627-6.251 0-9.351-4.752-7.491-11.47.878-2.995 4.443-7.904 7.077-9.66 3.255-2.17 5.684-2.17 8.164 0z"/></svg>
            </span>
            <span className={styles.logoChip} title="Vercel">
              <svg viewBox="0 0 256 222" width="14" height="12"><path fill="#000" d="m128 0 128 221.705H0z"/></svg>
            </span>
            <span className={styles.logoChip} title="Railway">
              <svg viewBox="0 0 1024 1024" width="14" height="14" fill="#000"><path d="M4.8 438.2A520.7 520.7 0 000 489.7h777.8c-2.7-5.3-6.4-10-10-14.7-133-171.8-204.5-157-306.9-161.3-34-1.4-57.2-2-193-2-72.7 0-151.7.2-228.6.4A621 621 0 0015 386.3h398.6v51.9H4.8zm779.1 103.5H.4c.8 13.8 2.1 27.5 4 41h723.4c32.2 0 50.3-18.3 56.1-41zM45 724.3s120 294.5 466.5 299.7c207 0 385-123 465.9-299.7H45z"/><path d="M511.5 0A512.2 512.2 0 0065.3 260.6l202.7-.2c158.4 0 164.2.6 195.2 2l19.1.6c66.7 2.3 148.7 9.4 213.2 58.2 35 26.5 85.6 85 115.7 126.5 27.9 38.5 35.9 82.8 17 125.2-17.5 39-55 62.2-100.4 62.2H16.7s4.2 18 10.6 37.8h970.6a510.4 510.4 0 0026.1-160.7A512.4 512.4 0 00511.5 0z"/></svg>
            </span>
          </div>
        </div>

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
            <AnimatedSubheading text="The storytelling studio for kids." />
            <p className={styles.sectionCopy}>
              Dream is built for storybook-first creation in one place. Families
              and classrooms use it to generate safe narratives, deepen
              creativity, and continue with quizzes and read-aloud support.
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
                <h3>120k+</h3>
                <p>Stories generated with Dream</p>
              </article>
              <article className={styles.metricCard}>
                <h3>48k+</h3>
                <p>Quizzes generated from finished storybooks</p>
              </article>
              <article className={styles.metricCard}>
                <h3>4.9/5</h3>
                <p>Average family satisfaction rating</p>
              </article>
            </div>

            <article className={styles.hiringCard}>
              <div>
                <p className={styles.hiringTitle}>Built for real imagination loops</p>
                <p className={styles.hiringOpen}>Families + classrooms + creators</p>
                <p className={styles.hiringCopy}>
                  Dream combines safe generation, consistent character memory,
                  story progression, quiz support, and read-aloud accessibility
                  in one workflow.
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
              Dream works however you prefer — a single conversation that does
              everything, or dedicated dashboards for granular control.
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
                Just describe what you want in plain language. Dream handles
                storybooks, characters, and parent quiz generation in one
                conversation. No setup, no steps.
              </p>
              <ul className={styles.modeFeatures}>
                <li>All-in-one conversational AI</li>
                <li>Storybook + quiz flow in chat</li>
                <li>Best for families &amp; first sessions</li>
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
                Take full control with dedicated dashboards. Manage your
                character vault, browse the story library, and tune read-aloud
                accessibility settings.
              </p>
              <ul className={styles.modeFeaturesWarm}>
                <li>Character vault &amp; memory</li>
                <li>Storybook library</li>
                <li>Best for classrooms &amp; creators</li>
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
            <AnimatedSubheading text="We handle prompt to storybook to quiz for you." />
            <p className={styles.sectionCopy}>
              Move from idea to finished content quickly with controls for age,
              tone, pacing, character consistency, quiz difficulty, and
              read-aloud voice.
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

        <section className={`${styles.section} ${styles.compactTop}`}>
          <motion.article
            className={styles.quoteCard}
            variants={blockMotion}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            custom={0.03}
          >
            <p className={styles.quoteBody}>
              &ldquo;My daughter writes one prompt, and Dream gives us a full
              bedtime adventure plus a quick quiz and read-aloud playback. We
              use it every night now.&rdquo;
            </p>
            <div>
              <p className={styles.quoteName}>Sarah Chen</p>
              <p className={styles.quoteRole}>Parent and early-learning mentor</p>
            </div>
          </motion.article>
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
            <AnimatedSubheading text="From prompt to playable story world." />
            <p className={styles.sectionCopy}>
              Three smooth steps designed for children and parents with no
              complicated setup.
            </p>
            <div className={styles.heroActions}>
              <a href="/chat" className={styles.ctaDark}>
                Start free
              </a>
              <button className={styles.ctaSoft} type="button">
                Watch walkthrough
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
            <AnimatedSubheading text="Not just another generic AI tool." />
            <p className={styles.sectionCopy}>
              Dream is tuned for child-safe storytelling and repeatable character
              worlds, not random one-off outputs.
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
                <h3 className={styles.compareTitle}>Fragmented, inconsistent, and frustrating.</h3>
                <p className={styles.compareDesc}>
                  Separate tools, no safety layer, and no memory — every session starts from scratch.
                </p>
              </div>
              <div className={styles.compareDivider} />
              <ul className={styles.compareList}>
                {[
                  "Unstable story continuity",
                  "No kid-focused safety layer",
                  "Fast-feed content over deep reading",
                  "Hard to reuse characters",
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
                <h3 className={styles.compareTitle}>One studio, safe by default.</h3>
                <p className={styles.compareDesc}>
                  Storybooks, quizzes, and character memory in a single flow
                  built for kids and families.
                </p>
              </div>
              <div className={styles.compareDivider} />
              <ul className={styles.compareList}>
                {[
                  "Child-safe generation defaults",
                  "Parent quiz generation in chat",
                  "Persistent character memory",
                  "Read-aloud voice accessibility",
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
              <p className={styles.sectionKicker}>Dream in practice</p>
              <AnimatedSubheading text="A class turned prompts into literacy wins." />
              <p className={styles.sectionCopy}>
                A second-grade teacher used Dream weekly for reading circles.
                Students created characters, generated chapters, then used
                read-aloud narration and chat quizzes for recap and retention.
              </p>
              <div className={styles.caseStats}>
                <div>
                  <h3>40%</h3>
                  <p>Higher voluntary reading time</p>
                </div>
                <div>
                  <h3>3x</h3>
                  <p>More student story submissions</p>
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
              Everything parents and educators ask before launching with Dream.
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
              Storybook-first AI<br />for kids.
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
            <Link href="/dashboard/create" className={styles.footerLink}>Create Storybook</Link>
            <Link href="/dashboard/stories" className={styles.footerLink}>Story Library</Link>
            <Link href="/chat" className={styles.footerLink}>Quiz in Chat</Link>
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
