"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, ChevronRight, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import DreamNavbar from "@/components/ui/dream-navbar";

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
    title: "Video",
    number: "03",
    body: "Transform each chapter into short animated scenes so kids can both read and watch their stories in one flow.",
    image:
      "https://framerusercontent.com/images/3jSoIlDJyMfLx6JTWfHwuwwhjSw.png?scale-down-to=2048&width=2144&height=730",
    cta: "Create video",
  },
  {
    title: "Replay",
    number: "04",
    body: "Save favorite worlds, revisit characters, and continue the same universe over bedtime sessions and classroom activities.",
    image:
      "https://framerusercontent.com/images/xS3VRUcNazVQ09WqJiWUYi39XeI.jpg?width=1200&height=900",
    cta: "Open library",
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
    title: "Generate Story + Video",
    timeline: "2-3 mins",
    copy: "Dream writes the narrative, creates matching visuals, and assembles short animated scenes with read-aloud pacing.",
  },
  {
    number: "03",
    title: "Save, Share, Replay",
    timeline: "Anytime",
    copy: "Reuse characters, export episodes, and keep building the same world so every session feels connected and magical.",
  },
];

const faqItems = [
  {
    q: "What is Dream, exactly?",
    a: "Dream is a kid-safe text-to-story and text-to-video platform. You write a prompt and Dream creates story chapters and short animated scenes from it.",
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
    role: "Animation Engineer",
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
            <div className={styles.avatarTag}>
              <div className={styles.avatarRow}>
                <span>MH</span>
                <span>JP</span>
                <span>AK</span>
                <span>TR</span>
                <span>AL</span>
              </div>
              <p>Loved by 1000+ families and educators</p>
            </div>

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
              {"From imagination to story and video.".split(" ").map((word, index) => (
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
              Dream turns one text prompt into a kid-safe story and short animated
              video. Create magical worlds, keep character memory, and bring
              bedtime ideas to life in minutes.
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
              Dream is built for text-to-story and text-to-video creation in one
              place. Families and classrooms use it to generate safe narratives,
              scenes, and replayable worlds from a single prompt.
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
                <h3>32k+</h3>
                <p>Short videos created from prompts</p>
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
                  story progression, and instant visual output in one workflow.
                </p>
              </div>
              <a href="/chat" className={styles.ctaDarkSmall}>
                Try Dream now
              </a>
            </article>
          </motion.div>
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
            <AnimatedSubheading text="We handle prompt to story to video for you." />
            <p className={styles.sectionCopy}>
              Move from idea to finished content quickly with controls for age,
              tone, pacing, character consistency, and visual continuity.
            </p>
          </motion.div>

          <div className={styles.servicesWrap}>
            <motion.div
              className={styles.serviceTabs}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              custom={0.07}
            >
              {serviceSteps.map((item, idx) => (
                <button
                  key={item.title}
                  type="button"
                  className={`${styles.serviceTab} ${
                    idx === activeService ? styles.serviceTabActive : ""
                  }`}
                  onMouseEnter={() => setActiveService(idx)}
                  onFocus={() => setActiveService(idx)}
                  onClick={() => setActiveService(idx)}
                >
                  <span>{item.title}</span>
                  <em>{item.number}</em>
                </button>
              ))}
            </motion.div>

            <motion.article
              className={styles.servicePanel}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              custom={0.14}
            >
              <div
                className={styles.servicePoster}
                style={
                  {
                    "--service-poster": `url(${serviceSteps[activeService].image})`,
                  } as CSSProperties
                }
                aria-hidden
              >
                <div className={styles.posterGlow} />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={serviceSteps[activeService].title}
                  className={styles.servicePanelText}
                  initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
                  transition={{ duration: 0.52, ease: easeOutExpo }}
                >
                  <p className={styles.servicePanelLabel}>
                    {serviceSteps[activeService].title}
                  </p>
                  <p>{serviceSteps[activeService].body}</p>
                  <a href="/chat" className={styles.inlineLink}>
                    {serviceSteps[activeService].cta} <ArrowUpRight size={16} />
                  </a>
                </motion.div>
              </AnimatePresence>
            </motion.article>
          </div>
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
              bedtime adventure plus a short video recap. We use it every night
              now.&rdquo;
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
            <motion.article
              className={`${styles.compareCard} ${styles.compareDark}`}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              custom={0.08}
            >
              <ul>
                <li>Unstable story continuity</li>
                <li>No kid-focused safety layer</li>
                <li>Separate tools for text and video</li>
                <li>Hard to reuse characters</li>
              </ul>
              <h3>Generic tools</h3>
              <p>
                Fragmented workflow, inconsistent quality, and no reliable story
                progression for repeat use.
              </p>
            </motion.article>

            <motion.article
              className={`${styles.compareCard} ${styles.compareWarm}`}
              variants={blockMotion}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              custom={0.14}
            >
              <ul>
                <li>Child-safe generation defaults</li>
                <li>Text-to-story + text-to-video together</li>
                <li>Persistent character memory</li>
                <li>Fast creation for parents and teachers</li>
              </ul>
              <h3>Dream</h3>
              <p>
                One streamlined studio that turns imagination into safe, reusable
                story worlds.
              </p>
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
                Students created characters, generated chapters, then watched short
                video episodes for recap and retention.
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
                  className={styles.faqItem}
                  variants={blockMotion}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.35 }}
                  custom={0.05 + index * 0.045}
                >
                  <button
                    type="button"
                    className={styles.faqButton}
                    onClick={() => setOpenFaq(open ? -1 : index)}
                    aria-expanded={open}
                  >
                    <span>{item.q}</span>
                    <ChevronDown size={16} className={open ? styles.chevOpen : undefined} />
                  </button>

                  <div className={`${styles.faqPanel} ${open ? styles.faqPanelOpen : ""}`}>
                    <p>{item.a}</p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <h2 className={`${styles.footerBrand} ${styles.displayFont}`}>Dream</h2>
            <p>Text-to-story and text-to-video magic for kids.</p>
          </div>
          <div className={styles.footerFlower} aria-hidden />
        </div>

        <div className={styles.footerCols}>
          <div>
            <p className={styles.colTitle}>Navigate</p>
            <a href="#home-section">Home</a>
            <a href="#dream-studio-section">Studio</a>
            <a href="#how-we-work">How It Works</a>
            <a href="#faq">FAQ</a>
          </div>
          <div>
            <p className={styles.colTitle}>Product</p>
            <a href="/chat">Create Story</a>
            <a href="/dashboard/create">Create Video</a>
            <a href="#dream-studio-section">Character Memory</a>
            <a href="#">Safety</a>
          </div>
          <div>
            <p className={styles.colTitle}>Company</p>
            <a href="#">About</a>
            <a href="#">Team</a>
            <a href="mailto:hello@dream.ai">Contact</a>
            <a href="#">Careers</a>
          </div>
          <div>
            <p className={styles.colTitle}>Legal</p>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Cookie Policy</a>
            <a href="#">Accessibility</a>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>© 2026 Dream. All rights reserved.</p>
          <a href="#">Created by Dream Studio</a>
        </div>
      </footer>
    </div>
  );
}
