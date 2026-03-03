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
    title: "Read Aloud",
    number: "03",
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
    title: "Read & Reflect",
    timeline: "Anytime",
    copy: "Reuse characters across new stories, turn on read-aloud voice for accessibility and bedtime routines, and revisit finished storybooks anytime.",
  },
];

const faqItems = [
  {
    q: "What is Dream, exactly?",
    a: "Dream is a kid-safe storybook platform. You write a prompt, Dream creates a personalized storybook with consistent characters and read-aloud voice support.",
  },
  {
    q: "Why is Dream storybook-first?",
    a: "Many kids are stuck in high-speed screen routines that fragment attention. Dream resets the pattern with complete stories, active reading, and persistent character worlds so creativity and confidence grow over time.",
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

const heroMarqueeImages = [
  "https://images.unsplash.com/photo-1756312148347-611b60723c7a?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1757865579201-693dd2080c73?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1756786605218-28f7dd95a493?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1757519740947-eef07a74c4ab?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1757263005786-43d955f07fb1?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1757207445614-d1e12b8f753e?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1757269746970-dc477517268f?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1755119902709-a53513bcbedc?w=900&auto=format&fit=crop&q=60",
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
            <AnimatedSubheading text="The storytelling studio for kids." />
            <p className={styles.sectionCopy}>
              Dream is built for storybook-first creation in one place. Families
              and classrooms use it to generate safe narratives, deepen
              creativity, and continue with read-aloud support and reusable characters.
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
                <p>Characters created and reused across stories</p>
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
                  story progression, and read-aloud accessibility
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
                storybooks, characters, and read-aloud narration in one
                conversation. No setup, no steps.
              </p>
              <ul className={styles.modeFeatures}>
                <li>All-in-one conversational AI</li>
                <li>Storybook + read-aloud in chat</li>
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
            <AnimatedSubheading text="We handle prompt to finished storybook for you." />
            <p className={styles.sectionCopy}>
              Move from idea to finished content quickly with controls for age,
              tone, pacing, character consistency, and read-aloud voice.
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
                  Storybooks, character memory, and read-aloud in a single flow
                  built for kids and families.
                </p>
              </div>
              <div className={styles.compareDivider} />
              <ul className={styles.compareList}>
                {[
                  "Child-safe generation defaults",
                  "Read-aloud voice for every story",
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
                read-aloud narration for engagement and active comprehension.
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
