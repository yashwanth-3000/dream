"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import DreamNavbar from "@/components/ui/dream-navbar";
import styles from "./about.module.css";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

const fade = (delay = 0) => ({
  hidden: { opacity: 0, y: 18, filter: "blur(5px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.7, delay, ease: easeOutExpo },
  },
});

const wordLine = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const wordDrop = {
  hidden: { opacity: 0, y: 20, filter: "blur(7px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.58, ease: easeOutExpo },
  },
};

const vp = { once: true, amount: 0.2 } as const;

function AnimWord({ children }: { children: string }) {
  return (
    <motion.h2 className={styles.chapterTitle} variants={wordLine} initial="hidden" whileInView="show" viewport={vp}>
      {children.split(" ").map((w, i) => (
        <motion.span key={i} className={styles.chapterWord} variants={wordDrop}>{w}</motion.span>
      ))}
    </motion.h2>
  );
}

const TITLE = ["Building", "the", "most", "magical", "storytelling", "AI"];

const STATS = [
  { n: "50k+",  l: "Stories created"    },
  { n: "4,200", l: "Active families"    },
  { n: "99.9%", l: "Kid-safe accuracy"  },
  { n: "38",    l: "Countries"          },
];

const VALUES = [
  { n: "01", t: "Radical child-safety",       b: "Every output passes through age-aware filters before it reaches a screen. No exceptions, no overrides — children's safety is non-negotiable." },
  { n: "02", t: "Delight over utility",       b: "A tool that kids love to use is a tool that actually works. We optimize for joy first — everything else follows." },
  { n: "03", t: "Imagination as infrastructure", b: "Stories are how children process the world. We treat story generation as critical infrastructure, not entertainment." },
  { n: "04", t: "Transparent AI",             b: "Parents and teachers deserve to understand what the model does and doesn't do. We publish our safety approach openly." },
  { n: "05", t: "Continuous collaboration",   b: "The best product decisions come from families and classrooms. We embed user research into every sprint." },
  { n: "06", t: "Long-term thinking",         b: "Children grow up. The habits, characters, and worlds they build with Dream should grow with them across years — not be erased on logout." },
];

const TEAM = [
  { name: "Marcus Chen",    role: "Story Systems Lead"       },
  { name: "Amira Hassan",   role: "Child Safety Specialist"  },
  { name: "David Park",     role: "Storybook Experience Engineer" },
  { name: "Elena Martinez", role: "Learning Experience"      },
];

const CTA_WORDS = ["Every", "great", "story", "starts", "with", "one", "idea."];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <DreamNavbar />

      <article className={styles.article}>

        {/* ── Opening ── */}
        <motion.span
          className={styles.openKicker}
          variants={fade(0)} initial="hidden" animate="show"
        >
          About Dream
        </motion.span>

        <motion.h1
          className={styles.mainTitle}
          variants={wordLine} initial="hidden" animate="show"
        >
          {TITLE.map((w, i) => (
            <motion.span key={i} className={styles.titleWord} variants={wordDrop}>{w}</motion.span>
          ))}
          <br />
          <motion.span
            variants={wordDrop}
            className={`${styles.titleWord} ${styles.titleAccent}`}
          >
            for children.
          </motion.span>
        </motion.h1>

        <motion.p
          className={styles.lead}
          variants={fade(0.38)} initial="hidden" animate="show"
        >
          Dream was founded in 2024 with one obsession: give every child a story that feels
          like it was written just for them. We combine frontier language models with
          kid-first safety design to make that possible at scale.
        </motion.p>

        {/* ── Our story ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Our story
        </motion.p>

        <AnimWord>Started from a single bedtime story.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            Dream started in a small apartment in 2024 when our founder — a parent of two —
            ran out of ideas for bedtime stories. The kids wanted something new every single
            night: new characters, new worlds, new stakes. Writing fresh stories from scratch
            wasn't sustainable.
          </p>
          <p>
            So they built a tool. At first it was just a prompt template and a language model
            call. But the kids loved it so much they started asking for it by name —
            <em> "can we do Dream tonight?"</em> — and that was the moment it became a company.
          </p>
          <p>
            Today Dream is used by over 4,200 families and hundreds of classrooms across 38
            countries. The stories are different every time. The wonder never gets old.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          className={styles.statStrip}
          variants={fade(0.1)} initial="hidden" whileInView="show" viewport={vp}
        >
          {STATS.map(s => (
            <div key={s.l} className={styles.statCell}>
              <p className={styles.statNumber}>{s.n}</p>
              <p className={styles.statLabel}>{s.l}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Mission ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Our mission
        </motion.p>

        <AnimWord>We believe imagination is a right, not a privilege.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            Every day, millions of children go to bed without a story — not because there
            aren't enough books, but because personalized storytelling requires time most
            families don't have. Dream changes that.
          </p>
          <p>
            We don't build features — we build moments of delight. Every word, every
            interaction is crafted to keep children leaning in with wide eyes. Safety isn't
            a feature, it's the foundation. Kid-safe moderation is baked into the model
            layer, not bolted on top.
          </p>
        </motion.div>

        <motion.div
          className={styles.pullQuote}
          variants={fade(0.08)} initial="hidden" whileInView="show" viewport={vp}
        >
          <motion.p
            className={styles.pullQuoteText}
            variants={wordLine} initial="hidden" whileInView="show" viewport={vp}
          >
            {`A child who reads will be an adult who thinks. We built Dream to start that chain earlier.`.split(" ").map((w, i) => (
              <motion.span key={i} variants={wordDrop}>{w} </motion.span>
            ))}
          </motion.p>
          <p className={styles.pullQuoteAttr}>Marcus Chen · Story Systems Lead</p>
        </motion.div>

        {/* ── Values ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          What we stand for
        </motion.p>

        <AnimWord>Six principles we never negotiate on.</AnimWord>

        <motion.div
          className={styles.valuesList}
          variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}
        >
          {VALUES.map((v, i) => (
            <motion.div
              key={v.n}
              className={styles.valueRow}
              variants={fade(i * 0.06)}
              initial="hidden"
              whileInView="show"
              viewport={vp}
            >
              <p className={styles.valueNum}>{v.n}</p>
              <div className={styles.valueContent}>
                <p className={styles.valueTitle}>{v.t}</p>
                <p className={styles.valueBody}>{v.b}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Team ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          The team
        </motion.p>

        <AnimWord>Built by people who love great stories.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.04)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            We're a small team of engineers, storytellers, educators, and parents united by the
            belief that technology should unlock more creativity — not replace it.
          </p>
        </motion.div>

        <motion.div
          className={styles.teamList}
          variants={fade(0.08)} initial="hidden" whileInView="show" viewport={vp}
        >
          {TEAM.map((m, i) => (
            <motion.div
              key={m.name}
              className={styles.teamRow}
              variants={fade(i * 0.06)}
              initial="hidden"
              whileInView="show"
              viewport={vp}
            >
              <p className={styles.teamName}>{m.name}</p>
              <p className={styles.teamRole}>{m.role}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          className={styles.ctaBanner}
          variants={fade(0.04)} initial="hidden" whileInView="show" viewport={vp}
        >
          <p className={styles.ctaBannerKicker}>Come dream with us</p>
          <motion.h2
            className={styles.ctaBannerTitle}
            variants={wordLine} initial="hidden" whileInView="show" viewport={vp}
          >
            {CTA_WORDS.map((w, i) => (
              <motion.span key={i} variants={wordDrop}>{w} </motion.span>
            ))}
          </motion.h2>
          <p className={styles.ctaBannerBody}>
            Type anything — a character, a place, a feeling — and Dream AI builds
            a world around it in seconds.
          </p>
          <div className={styles.ctaBannerActions}>
            <Link href="/chat" className={styles.ctaPrimary}>
              <Sparkles size={13} />
              Start for free
            </Link>
            <Link href="/" className={styles.ctaSecondary}>
              Back to home
            </Link>
          </div>
        </motion.div>

      </article>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <p>© 2024 Dream AI. All rights reserved.</p>
        <div className={styles.footerLinks}>
          <Link href="/">Home</Link>
          <Link href="/chat">Chat</Link>
          <Link href="/about">About</Link>
        </div>
      </footer>
    </div>
  );
}
