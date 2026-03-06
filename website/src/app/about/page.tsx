"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const TECH_STACK = [
  {
    title: "Frontend shell",
    body:
      "Dream ships as a Next.js 16 App Router application. Public pages, chat, and the dashboard all live in the same React 19 codebase, while server route handlers proxy browser requests into the backend.",
    bullets: [
      "Next.js 16, React 19, TypeScript",
      "Public pages plus /dashboard workflows",
      "Server-side /api/* proxy routes",
    ],
  },
  {
    title: "Main orchestrator",
    body:
      "A FastAPI service on port 8010 acts as the single backend entrypoint. It owns request routing, job creation, progress events, asset download, and the agent layer used for chat and creation decisions.",
    bullets: [
      "QuestionReaderAgent and ResponderAgent",
      "MAFRoutingAgent for character orchestration",
      "SQLite-backed jobs, events, and assets",
    ],
  },
  {
    title: "Generation services",
    body:
      "Heavy AI work is split into independent A2A services. Character generation uses CrewAI for multi-step narrative building, and storybook generation uses MAF agents plus parallel A2A character calls.",
    bullets: [
      "Character Maker on :8000 via A2A",
      "Story Book Maker on :8020 via A2A",
      "Parallel branches for writing and visuals",
    ],
  },
  {
    title: "Retrieval and model providers",
    body:
      "Dream combines multiple external systems instead of depending on a single model endpoint. That lets the app separate grounding, text generation, and image rendering by workload.",
    bullets: [
      "Exa MCP for fresh web grounding",
      "Azure AI Search for uploaded study material",
      "OpenAI/Azure OpenAI plus Replicate rendering",
    ],
  },
];

const PROTOCOLS = [
  "Browser -> Next.js route navigation",
  "Website -> orchestrator over REST + NDJSON",
  "Orchestrator -> backends over A2A JSON-RPC",
  "Orchestrator -> browser over SSE",
  "Search grounding through MCP",
  "Jobs persisted in SQLite and local assets",
];

const REQUEST_FLOWS = [
  {
    n: "01",
    t: "Chat requests stay synchronous until grounding is needed.",
    b:
      "POST /api/chat reaches the main orchestrator, where QuestionReaderAgent classifies the request and ResponderAgent drafts the answer. Search mode can pull evidence from Exa MCP, while study mode retrieves citations from Azure AI Search before the final response is returned to the website.",
  },
  {
    n: "02",
    t: "Character generation becomes a tracked job with agent routing.",
    b:
      "The website first creates a job record, then forwards the user prompt into the orchestrator. MAFRoutingAgent decides whether to run the full character pipeline or an image-only regeneration path, then the Character Maker service executes the CrewAI workflow and hands image rendering off to Replicate.",
  },
  {
    n: "03",
    t: "Storybook generation fans out into parallel branches.",
    b:
      "The Story Book Maker creates a blueprint, writes story pages, and requests character generation in parallel over A2A. Once text and character outputs converge, it builds scene prompts, renders images, and streams progress events back through the orchestrator so the dashboard can update live instead of waiting for a single blocking response.",
  },
];

const CTA_WORDS = ["Every", "great", "story", "starts", "with", "one", "idea."];
const DEFAULT_DIAGRAM_SIZE: { w: number; h: number } = { w: 3223.609375, h: 1348.3609375 };
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

type Point = { x: number; y: number };

export default function AboutPage() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [diagramZoom, setDiagramZoom] = useState(1);
  const [diagramPan, setDiagramPan] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingDiagram, setIsDraggingDiagram] = useState(false);
  const [diagramSize, setDiagramSize] = useState(DEFAULT_DIAGRAM_SIZE);

  const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

  const clampPan = (nextPan: Point, zoomLevel: number, size = diagramSize): Point => {
    const viewport = viewportRef.current;
    if (!viewport) return nextPan;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const baseWidth = viewportWidth;
    const baseHeight = (viewportWidth * size.h) / size.w;
    const scaledWidth = baseWidth * zoomLevel;
    const scaledHeight = baseHeight * zoomLevel;

    const clampedX =
      scaledWidth <= viewportWidth
        ? (viewportWidth - scaledWidth) / 2
        : Math.min(0, Math.max(viewportWidth - scaledWidth, nextPan.x));
    const clampedY =
      scaledHeight <= viewportHeight
        ? (viewportHeight - scaledHeight) / 2
        : Math.min(0, Math.max(viewportHeight - scaledHeight, nextPan.y));

    return { x: clampedX, y: clampedY };
  };

  const zoomAt = (rawZoom: number, anchor?: Point) => {
    const viewport = viewportRef.current;
    const nextZoom = clampZoom(rawZoom);

    if (!viewport || nextZoom === diagramZoom) {
      setDiagramZoom(nextZoom);
      return;
    }

    const point = anchor ?? {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    };
    const contentX = (point.x - diagramPan.x) / diagramZoom;
    const contentY = (point.y - diagramPan.y) / diagramZoom;
    const nextPanRaw = {
      x: point.x - contentX * nextZoom,
      y: point.y - contentY * nextZoom,
    };

    setDiagramZoom(nextZoom);
    setDiagramPan(clampPan(nextPanRaw, nextZoom));
  };

  const resetDiagram = () => {
    const fitZoom = 1;
    setDiagramZoom(fitZoom);
    setDiagramPan(clampPan({ x: 0, y: 0 }, fitZoom));
  };

  const centerDiagram = () => {
    setDiagramPan(clampPan(diagramPan, diagramZoom));
  };

  const handleDiagramWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const anchor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    zoomAt(diagramZoom + delta, anchor);
  };

  const handleDiagramPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setIsDraggingDiagram(true);
  };

  const handleDiagramPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    dragStateRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };

    setDiagramPan((currentPan) => clampPan({ x: currentPan.x + dx, y: currentPan.y + dy }, diagramZoom));
  };

  const stopDiagramDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    setIsDraggingDiagram(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    const syncPan = () => {
      setDiagramPan((currentPan) => clampPan(currentPan, diagramZoom));
    };

    syncPan();
    window.addEventListener("resize", syncPan);
    return () => window.removeEventListener("resize", syncPan);
  }, [diagramZoom, diagramSize]);

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

        {/* ── Architecture ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          How it works
        </motion.p>

        <AnimWord>A protocol-first architecture built for long-running AI workflows.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            Dream is not a single prompt box wired straight into one model. The app is split
            into a user-facing Next.js layer, a FastAPI orchestrator, specialized A2A
            backends, and separate retrieval and rendering providers. That separation keeps
            the browser simple while the orchestration layer handles routing, safety, job
            state, and downstream agent execution.
          </p>
          <p>
            Short operations like chat can finish in one request-response cycle. Long-running
            operations like character and story creation are treated as jobs: the orchestrator
            persists progress, streams events back to the UI over SSE, and downloads finished
            assets so the dashboard can display stable local results instead of depending on
            temporary provider URLs.
          </p>
        </motion.div>

        <motion.div
          className={styles.techGrid}
          variants={fade(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          {TECH_STACK.map((section, i) => (
            <motion.div
              key={section.title}
              className={styles.techCard}
              variants={fade(i * 0.05)}
              initial="hidden"
              whileInView="show"
              viewport={vp}
            >
              <p className={styles.techCardTitle}>{section.title}</p>
              <p className={styles.techCardBody}>{section.body}</p>
              <ul className={styles.techCardList}>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className={styles.protocolStrip}
          variants={fade(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          {PROTOCOLS.map((protocol, i) => (
            <motion.span
              key={protocol}
              className={styles.protocolPill}
              variants={fade(i * 0.04)}
              initial="hidden"
              whileInView="show"
              viewport={vp}
            >
              {protocol}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          className={styles.archSection}
          variants={fade(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          <div className={styles.diagramToolbar}>
            <div className={styles.diagramToolbarMeta}>
              <p className={styles.diagramToolbarLabel}>Diagram Viewer</p>
              <p className={styles.diagramHint}>Scroll to zoom. Drag to pan.</p>
            </div>
            <div className={styles.diagramToolbarActions}>
              <button type="button" className={styles.zoomButton} onClick={() => zoomAt(diagramZoom - ZOOM_STEP)}>-</button>
              <input
                type="range"
                min={MIN_ZOOM * 100}
                max={MAX_ZOOM * 100}
                step={5}
                value={Math.round(diagramZoom * 100)}
                className={styles.zoomSlider}
                onChange={(event) => zoomAt(Number(event.target.value) / 100)}
                aria-label="Diagram zoom"
              />
              <button type="button" className={styles.zoomButton} onClick={() => zoomAt(diagramZoom + ZOOM_STEP)}>+</button>
              <button type="button" className={styles.zoomButton} onClick={centerDiagram}>Center</button>
              <button type="button" className={styles.zoomButton} onClick={resetDiagram}>Fit</button>
              <span className={styles.zoomReadout}>{Math.round(diagramZoom * 100)}%</span>
            </div>
          </div>
          <div
            ref={viewportRef}
            className={`${styles.diagramFrame} ${isDraggingDiagram ? styles.diagramFrameDragging : ""}`}
            onWheel={handleDiagramWheel}
            onPointerDown={handleDiagramPointerDown}
            onPointerMove={handleDiagramPointerMove}
            onPointerUp={stopDiagramDrag}
            onPointerCancel={stopDiagramDrag}
          >
            <img
              src="/main-str.svg"
              alt="Dream architecture diagram"
              className={styles.diagramImage}
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                  setDiagramSize({ w: image.naturalWidth, h: image.naturalHeight });
                }
              }}
              style={{
                transform: `translate(${diagramPan.x}px, ${diagramPan.y}px) scale(${diagramZoom})`,
              }}
            />
          </div>
          <p className={styles.diagramCaption}>
            The browser only talks to the Next.js application. From there, Dream centralizes
            orchestration in FastAPI, fans out into A2A services for specialized generation
            work, and streams job progress back into the dashboard while assets are persisted
            locally.
          </p>
        </motion.div>

        <motion.div
          className={styles.flowList}
          variants={fade(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          {REQUEST_FLOWS.map((flow, i) => (
            <motion.div
              key={flow.n}
              className={styles.flowStep}
              variants={fade(i * 0.05)}
              initial="hidden"
              whileInView="show"
              viewport={vp}
            >
              <p className={styles.flowStepNum}>{flow.n}</p>
              <div>
                <p className={styles.flowStepTitle}>{flow.t}</p>
                <p className={styles.flowStepBody}>{flow.b}</p>
              </div>
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
