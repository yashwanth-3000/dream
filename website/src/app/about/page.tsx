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

const fadeNoBlur = (delay = 0) => ({
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1, y: 0,
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
    <motion.h2
      className={styles.chapterTitle}
      variants={wordLine}
      initial="hidden"
      whileInView="show"
      viewport={vp}
    >
      {children.split(" ").map((w, i) => (
        <motion.span key={i} className={styles.chapterWord} variants={wordDrop}>
          {w}
        </motion.span>
      ))}
    </motion.h2>
  );
}

const TITLE = ["Building", "the", "most", "magical", "storytelling", "AI"];

const STATS = [
  { n: "6",    l: "Microsoft & Azure services"  },
  { n: "3",    l: "Specialized A2A agents"       },
  { n: "11",   l: "AI illustrations per story"  },
  { n: "38",   l: "Countries"                    },
];

const MICROSOFT_STACK = [
  {
    tag: "Core Agent Runtime",
    name: "Microsoft Agent Framework",
    desc: "Dream's orchestrator is a native MAF application. Every request routes through MAF's agent lifecycle: QuestionReaderAgent classifies intent, MAFRoutingAgent selects the generation pipeline, and ResponderAgent composes the final reply. Framework-native orchestration, not handwritten glue.",
    detail: "MAFKidsChatOrchestrator · MAFRoutingAgent · QuestionReaderAgent · ResponderAgent",
  },
  {
    tag: "Inter-Agent Communication",
    name: "Agent-to-Agent Protocol",
    desc: "Character generation and storybook creation each run as independent A2A services on separate ports. The orchestrator dispatches JSON-RPC tasks and streams results, a clean contract that makes every service independently deployable and replaceable without touching orchestration logic.",
    detail: "Character Maker :8000 · Story Book Maker :8020 · JSON-RPC over HTTP",
  },
  {
    tag: "Semantic Retrieval",
    name: "Azure AI Search",
    desc: "Study mode is powered by an Azure AI Search hybrid index built from a child's uploaded worksheet. When a follow-up question arrives, the ResponderAgent retrieves semantically matched passages and surfaces citations inline, grounded answers, never hallucinations.",
    detail: "Hybrid vector + keyword · Citation extraction · Study-mode RAG",
  },
  {
    tag: "Language Generation",
    name: "Azure OpenAI",
    desc: "Story text, character biographies, scene image prompts, quiz questions, and chat replies all flow through Azure OpenAI with structured outputs. Agents use tool-calling to coordinate with external services, the language model is a reasoning engine, not a monolith.",
    detail: "GPT-4o · Structured outputs · Agent tool-use coordination",
  },
  {
    tag: "Age-Layer Safety",
    name: "Azure Content Safety",
    desc: "Every user input and every generated output passes through Azure Content Safety before being processed or displayed. This is an architectural gate, not a UI filter, not a post-processing step. Children's safety is enforced at the infrastructure level with configurable severity thresholds.",
    detail: "Input scan · Output scan · Configurable severity threshold · provider: azure_content_safety",
  },
  {
    tag: "Live Tool Integration",
    name: "Model Context Protocol",
    desc: "Exa's live web search and Azure AI Search are both wired as MCP tools. When a child asks about a real place or recent event, the agent issues a standard MCP tool call, the same protocol interface for every external capability, regardless of provider or transport.",
    detail: "Exa MCP · Azure Search MCP · Standard tool call interface",
  },
];

const STORY_STEPS = [
  {
    title: "Reading your idea",
    detail: 'Prompt: "a story on cricket", MAFKidsChatOrchestrator classified as creative_story_request with character_reuse: true.',
  },
  {
    title: "Checking safety",
    detail: "AzureContentSafetyGuard scanned the input. Result: passed · 0 violations detected.",
  },
  {
    title: "Selecting the pipeline",
    detail: 'MAFRoutingAgent chose workflow: "reference_enriched", existing character Yash loaded with face, hairstyle, and outfit locked for consistency.',
  },
  {
    title: "Building the world",
    detail: 'StoryBlueprintAgent drafted "Yash and the Magical Cricket Bat", a 10-chapter arc with courage and friendship as the central theme.',
  },
  {
    title: "Writing the chapters",
    detail: "StoryWriterAgent wrote all 10 chapters in parallel branches. Each chapter reaches ≥520 characters for age-appropriate depth.",
  },
  {
    title: "Generating scene images",
    detail: "ScenePromptAgent composed 11 image directives (cover + 10 chapters). Replicate rendered 11 illustrations → scene_image_000–010.webp stored locally.",
  },
  {
    title: "Synthesizing narration",
    detail: "OpenAI TTS synthesized 10 audio tracks for chapter narration → scene_image_012–021.mp3 stored locally.",
  },
  {
    title: "Final safety check",
    detail: "AzureContentSafetyGuard scanned the complete output. Result: passed → SSE: job_done · elapsed: 2m 16s.",
  },
];

const TECH_STACK = [
  {
    title: "Next.js Application Shell",
    body: "The browser never speaks directly to any AI service. A Next.js 16 App Router layer intercepts every request: server route handlers at /api/* proxy into the MAF orchestrator, keeping agent endpoints and credentials completely out of client code.",
    bullets: [
      "Next.js 16, React 19, TypeScript, Tailwind CSS v4",
      "SSE stream consumer for live job progress updates",
      "Dashboard renders from locally persisted assets, no temporary URLs",
    ],
  },
  {
    title: "MAF Orchestration Layer",
    body: "The FastAPI service on port 8010 is the MAF orchestrator, the single entrypoint for all AI work. It owns routing decisions, job lifecycle, SSE event emission, and the binding between web requests and downstream A2A agents.",
    bullets: [
      "MAFRoutingAgent: explicit pipeline selection per request",
      "SQLite-backed job queue with persistent SSE event log",
      "Asset downloader: finished files stored locally on completion",
    ],
  },
  {
    title: "A2A Generation Services",
    body: "Heavy generation runs as independent A2A microservices. Each communicates over JSON-RPC, operates without shared memory, and can be scaled or replaced without touching the orchestration core, a boundary that enables real separation of concerns.",
    bullets: [
      "Character Maker :8000, CrewAI multi-step narrative + Replicate render",
      "Story Book Maker :8020, parallel text, image, and TTS workflow",
      "Minimum 520 chars/chapter enforced for age-appropriate narrative depth",
    ],
  },
  {
    title: "Azure Intelligence Layer",
    body: "Three Azure-powered systems handle intelligence at scale: Azure OpenAI for all language work, Azure AI Search for semantic document retrieval in study mode, and Exa via MCP for live web evidence. Each handles exactly the workload it does best.",
    bullets: [
      "Azure OpenAI: stories, prompts, chat, character descriptions",
      "Azure AI Search: hybrid vector index for uploaded study material",
      "Exa MCP: live web grounding via standard MCP tool call",
    ],
  },
];

const PROTOCOLS = [
  "Browser → Next.js App Router",
  "App → Orchestrator REST + NDJSON",
  "Orchestrator → A2A JSON-RPC",
  "MAF Agents → Azure OpenAI",
  "Study mode → Azure AI Search",
  "Safety gate → Azure Content Safety",
  "Grounding → Exa via MCP",
  "Images → Replicate API",
  "TTS → OpenAI Audio API",
  "Job events → Browser via SSE",
];

const VALUES = [
  {
    n: "01",
    t: "Safety at the infrastructure layer",
    b: "Azure Content Safety scans every input and every output. Not a UI filter. Not a disclaimer. An architectural gate that runs before any agent processes a message and before any response reaches a child's screen.",
  },
  {
    n: "02",
    t: "Agents with intention, not monoliths",
    b: "Dream doesn't use a single prompt-to-output pipeline. Every agent has a defined role and a defined decision boundary. Routing, writing, retrieval, and rendering are separated by design, because purpose-built agents outperform everything-in-one models on the tasks that matter.",
  },
  {
    n: "03",
    t: "Imagination as critical infrastructure",
    b: "Stories are how children build mental models of the world. Dream treats AI-powered storytelling with the same engineering rigor as systems that process financial transactions, because the stakes for a child's cognitive development are just as real.",
  },
  {
    n: "04",
    t: "Transparent AI",
    b: "Study mode surfaces citations so children and parents can trace where every fact came from. The agent architecture is documented. The safety layer is configurable and inspectable. We don't hide the model layer behind marketing language.",
  },
];

const REQUEST_FLOWS = [
  {
    n: "01",
    t: "Chat stays synchronous until an agent decides to search.",
    b: "POST /api/chat reaches MAFKidsChatOrchestrator. QuestionReaderAgent classifies intent in a single pass: casual conversation, creative request, or study-mode Q&A. In study mode, the ResponderAgent calls Azure AI Search, retrieves semantically matched passages, and embeds citations in the reply. In search mode, it issues a tool call over MCP to Exa for live web evidence. Azure Content Safety gates both the incoming message and the outgoing response before anything reaches the UI.",
  },
  {
    n: "02",
    t: "Character creation becomes a tracked MAF job with explicit pipeline routing.",
    b: "The frontend creates a job record, then the orchestrator's MAFRoutingAgent inspects the payload and makes an explicit decision: full character creation (prompt → CrewAI multi-step narrative workflow → Replicate image render) or image-only regeneration (positive/negative prompt → Replicate direct render). Either path emits real-time progress events over SSE, no polling, no client-side timeouts, no lost state.",
  },
  {
    n: "03",
    t: "Storybook generation fans out across A2A agents in parallel.",
    b: "Story Book Maker receives the job and runs its internal agent sequence: StoryBlueprintAgent builds a 10-chapter structure, StoryWriterAgent writes each chapter at ≥520 characters for age-appropriate depth, and parallel A2A calls to Character Maker supply character reference imagery. ScenePromptAgent composes per-spread image directives before Replicate renders 11 illustrations and OpenAI TTS synthesizes chapter narration. Finished assets are downloaded and stored locally, no dependency on ephemeral provider URLs that expire.",
  },
];

const CTA_WORDS = ["Every", "great", "story", "starts", "with", "one", "idea."];
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.1;
const DIAGRAM_NATIVE_WIDTH = 3223.609375;
const DIAGRAM_NATIVE_HEIGHT = 1060;
const KEYBOARD_ZOOM_FACTOR = 1.12;

type Point = { x: number; y: number };
type DiagramDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
};

export default function AboutPage() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DiagramDragState | null>(null);
  const zoomRef = useRef(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsEmbedded(new URLSearchParams(window.location.search).get("embedded") === "1");
  }, []);
  const fitZoomRef = useRef(MIN_ZOOM);
  const [diagramZoom, setDiagramZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(MIN_ZOOM);
  const [isDraggingDiagram, setIsDraggingDiagram] = useState(false);

  const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(fitZoomRef.current, zoom));
  const diagramFrameHeight = Math.min(620, Math.round(DIAGRAM_NATIVE_HEIGHT * diagramZoom));

  useEffect(() => {
    zoomRef.current = diagramZoom;
  }, [diagramZoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const fit = Math.min(MAX_ZOOM, viewport.clientWidth / DIAGRAM_NATIVE_WIDTH);
    fitZoomRef.current = fit;
    setFitZoom(fit);
    setDiagramZoom(fit);
    requestAnimationFrame(() => {
      const v = viewportRef.current;
      if (!v) return;
      v.scrollLeft = 0;
      v.scrollTop = 0;
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onResize = () => {
      const fit = Math.min(MAX_ZOOM, viewport.clientWidth / DIAGRAM_NATIVE_WIDTH);
      fitZoomRef.current = fit;
      setFitZoom(fit);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const zoomAt = (rawZoom: number, anchor?: Point) => {
    const viewport = viewportRef.current;
    const nextZoom = clampZoom(rawZoom);
    const currentZoom = zoomRef.current;
    if (!viewport || nextZoom === currentZoom) {
      setDiagramZoom(nextZoom);
      return;
    }
    const point = anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const ratio = nextZoom / currentZoom;
    const nextScrollLeft = (viewport.scrollLeft + point.x) * ratio - point.x;
    const nextScrollTop = (viewport.scrollTop + point.y) * ratio - point.y;
    zoomRef.current = nextZoom;
    setDiagramZoom(nextZoom);
    requestAnimationFrame(() => {
      const v = viewportRef.current;
      if (!v) return;
      v.scrollLeft = nextScrollLeft;
      v.scrollTop = nextScrollTop;
    });
  };

  const fitDiagram = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const fit = Math.min(MAX_ZOOM, viewport.clientWidth / DIAGRAM_NATIVE_WIDTH);
    fitZoomRef.current = fit;
    setFitZoom(fit);
    setDiagramZoom(fit);
    requestAnimationFrame(() => {
      const v = viewportRef.current;
      if (!v) return;
      v.scrollLeft = 0;
      v.scrollTop = 0;
    });
  };

  const centerDiagram = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
  };

  const handleDiagramWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const intensity = event.deltaMode === 1 ? 0.05 : 0.0025;
    const scaleFactor = Math.exp(-event.deltaY * intensity);
    zoomAt(zoomRef.current * scaleFactor, anchor);
  };

  const handleDiagramKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomAt(zoomRef.current * KEYBOARD_ZOOM_FACTOR); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomAt(zoomRef.current / KEYBOARD_ZOOM_FACTOR); return; }
    if (event.key === "0") { event.preventDefault(); zoomAt(1); }
  };

  const handleDiagramPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" && event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
    };
    setIsDraggingDiagram(true);
  };

  const handleDiagramPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const viewport = viewportRef.current;
    if (!dragState || !viewport || dragState.pointerId !== event.pointerId) return;
    viewport.scrollLeft = dragState.startScrollLeft - (event.clientX - dragState.startX);
    viewport.scrollTop = dragState.startScrollTop - (event.clientY - dragState.startY);
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

  return (
    <div className={styles.page}>
      {!isEmbedded && <DreamNavbar />}

      <article className={styles.article} style={isEmbedded ? { paddingTop: 28 } : undefined}>

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
          <motion.span variants={wordDrop} className={`${styles.titleWord} ${styles.titleAccent}`}>
            for children.
          </motion.span>
        </motion.h1>

        <motion.p
          className={styles.lead}
          variants={fade(0.38)} initial="hidden" animate="show"
        >
          Dream is a multi-agent AI platform built on Microsoft Agent Framework, Azure OpenAI,
          and the Agent-to-Agent protocol. Born from one obsession: give every child a story
          that feels written just for them, at scale, safely, and without compromise.
        </motion.p>

        {/* ── Our story ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Our story
        </motion.p>

        <AnimWord>Started from a single bedtime story.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            Dream started in a small apartment when a parent of two ran out of ideas for bedtime
            stories. The kids wanted something new every night: new characters, new worlds, new
            stakes. Writing from scratch wasn't sustainable. So they built a tool.
          </p>
          <p>
            At first it was just a prompt template and a language model call. But the kids loved
            it so much they started asking for it by name, <em>"can we do Dream tonight?"</em>
            and that was the moment it became something more. The question shifted from
            <em> "can AI generate a story?"</em> to <em>"can AI make a child's imagination feel limitless?"</em>
          </p>
          <p>
            Building that answer required more than one model call. It required an architecture
            that could write, illustrate, narrate, teach, and safeguard, simultaneously,
            reliably, and at the pace a child's curiosity demands.
          </p>
        </motion.div>

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

        {/* ── Architecture ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          The infrastructure
        </motion.p>

        <AnimWord>Built on Microsoft's agent stack, end to end.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            Dream is not a single prompt box wired to one model. It is a multi-agent system
            where each layer has a clearly defined role: Microsoft Agent Framework handles
            orchestration, A2A services isolate heavy generation work, Azure AI Search grounds
            answers in real documents, Azure Content Safety enforces age-appropriate output at
            the infrastructure level, and MCP turns external capabilities into standardized
            agent tools.
          </p>
          <p>
            Short operations: chat, quiz generation, study Q&A, resolve in a single
            request-response cycle with optional tool calls. Long operations: character
            creation, full storybook generation, are treated as jobs: the orchestrator persists
            progress, fans out to A2A services, and streams events back to the UI over SSE so
            the dashboard always reflects live state.
          </p>
        </motion.div>

        {/* ── Microsoft Stack cards ── */}
        <motion.div
          className={styles.msGrid}
          variants={fadeNoBlur(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          {MICROSOFT_STACK.map((item, i) => (
            <motion.div
              key={item.name}
              className={styles.msCard}
              variants={fadeNoBlur(i * 0.05)}
              initial="hidden"
              whileInView="show"
              viewport={vp}
            >
              <p className={styles.msCardTag}>{item.tag}</p>
              <p className={styles.msCardName}>{item.name}</p>
              <p className={styles.msCardDesc}>{item.desc}</p>
              <p className={styles.msCardDetail}>{item.detail}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Agent Trace ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Under the hood
        </motion.p>

        <AnimWord>What happens when a child says "make me a story."</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.04)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            The log below is the actual execution path for a real story,
            generated from the prompt <em>"a story on cricket"</em> with an existing character
            reference. Eight agent steps. Two minutes and sixteen seconds. One complete storybook.
          </p>
        </motion.div>

        <motion.div
          className={styles.logCard}
          variants={fadeNoBlur(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          <div className={styles.logCardHeader}>
            <p className={styles.logCardTitle}>Logs</p>
            <p className={styles.logCardMeta}>Yash and the Magical Cricket Bat · job_id: 36465f9a · elapsed: 2m 16s · status: completed</p>
          </div>
          <div className={styles.logPanel}>
            {STORY_STEPS.map((step, i) => {
              const isLast = i === STORY_STEPS.length - 1;
              return (
                <motion.div
                  key={i}
                  className={styles.logStep}
                  variants={fadeNoBlur(i * 0.05)}
                  initial="hidden"
                  whileInView="show"
                  viewport={vp}
                >
                  <div className={styles.logBulletCol}>
                    <span className={styles.logBullet} />
                    {!isLast && <span className={styles.logLine} />}
                  </div>
                  <div className={styles.logStepContent}>
                    <p className={styles.logStepTitle}>{step.title}</p>
                    <p className={styles.logStepDetail}>{step.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Tech cards + protocols ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          Architecture layers
        </motion.p>

        <AnimWord>A protocol-first design built for long-running AI workflows.</AnimWord>

        <motion.div className={styles.prose} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
          <p>
            The separation between browser, orchestrator, A2A services, and Azure providers is
            not organizational convenience, it is the core architectural guarantee that lets
            Dream evolve any one layer without breaking the others. The browser only talks to
            Next.js. Next.js only talks to FastAPI. FastAPI only talks to A2A services and
            Azure endpoints. Nothing crosses a layer boundary except through a defined protocol.
          </p>
        </motion.div>

        <motion.div
          className={styles.techGrid}
          variants={fadeNoBlur(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          {TECH_STACK.map((section, i) => (
            <motion.div
              key={section.title}
              className={styles.techCard}
              variants={fadeNoBlur(i * 0.05)}
              initial="hidden"
              whileInView="show"
              viewport={vp}
            >
              <p className={styles.techCardTitle}>{section.title}</p>
              <p className={styles.techCardBody}>{section.body}</p>
              <ul className={styles.techCardList}>
                {section.bullets.map(b => <li key={b}>{b}</li>)}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Diagram ── */}
        <motion.div
          className={styles.archSection}
          variants={fadeNoBlur(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          <div className={styles.diagramToolbar}>
            <div className={styles.diagramToolbarMeta}>
              <p className={styles.diagramToolbarLabel}>Architecture Diagram</p>
              <p className={styles.diagramHint}>Drag to pan · Scroll to browse · Ctrl/Cmd + scroll or +/- to zoom</p>
            </div>
            <div className={styles.diagramToolbarActions}>
              <button type="button" className={styles.zoomButton} onClick={() => zoomAt(diagramZoom - ZOOM_STEP)}>−</button>
              <input
                type="range"
                min={Math.round(fitZoom * 100)}
                max={MAX_ZOOM * 100}
                step={5}
                value={Math.round(diagramZoom * 100)}
                className={styles.zoomSlider}
                onChange={e => zoomAt(Number(e.target.value) / 100)}
                aria-label="Diagram zoom"
              />
              <button type="button" className={styles.zoomButton} onClick={() => zoomAt(diagramZoom + ZOOM_STEP)}>+</button>
              <button type="button" className={styles.zoomButton} onClick={() => zoomAt(1)}>100%</button>
              <button type="button" className={styles.zoomButton} onClick={centerDiagram}>Center</button>
              <button type="button" className={styles.zoomButton} onClick={fitDiagram}>Fit</button>
              <span className={styles.zoomReadout}>{Math.round(diagramZoom * 100)}%</span>
            </div>
          </div>
          <div
            ref={viewportRef}
            className={`${styles.diagramFrame} ${isDraggingDiagram ? styles.diagramFrameDragging : ""}`}
            style={{ height: `${diagramFrameHeight}px` }}
            tabIndex={0}
            onWheel={handleDiagramWheel}
            onKeyDown={handleDiagramKeyDown}
            onPointerDown={handleDiagramPointerDown}
            onPointerMove={handleDiagramPointerMove}
            onPointerUp={stopDiagramDrag}
            onPointerCancel={stopDiagramDrag}
          >
            <img
              src="/final.svg"
              alt="Dream architecture diagram"
              className={styles.diagramImage}
              draggable={false}
              style={{ width: `${DIAGRAM_NATIVE_WIDTH * diagramZoom}px` }}
            />
          </div>
          <p className={styles.diagramCaption}>
            The browser communicates exclusively with the Next.js application layer. From there,
            the MAF orchestrator routes to A2A services for generation, calls Azure endpoints for
            language and retrieval, and streams job progress back through SSE while assets are
            persisted locally for stable dashboard rendering.
          </p>
        </motion.div>

        {/* ── Request flows ── */}
        <motion.div
          className={styles.flowList}
          variants={fadeNoBlur(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={vp}
        >
          {REQUEST_FLOWS.map((flow, i) => (
            <motion.div
              key={flow.n}
              className={styles.flowStep}
              variants={fadeNoBlur(i * 0.05)}
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

        {/* ── Values ── */}
        <motion.hr className={styles.divider} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp} />

        <motion.p className={styles.chapterKicker} variants={fade(0)} initial="hidden" whileInView="show" viewport={vp}>
          What we stand for
        </motion.p>

        <AnimWord>Four principles we never negotiate on.</AnimWord>

        <motion.div className={styles.valuesList} variants={fade(0.06)} initial="hidden" whileInView="show" viewport={vp}>
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

        <motion.div
          className={styles.pullQuote}
          variants={fade(0.08)} initial="hidden" whileInView="show" viewport={vp}
        >
          <motion.p
            className={styles.pullQuoteText}
            variants={wordLine} initial="hidden" whileInView="show" viewport={vp}
          >
            {"A child who reads will be an adult who thinks. We built Dream to start that chain earlier.".split(" ").map((w, i) => (
              <motion.span key={i} variants={wordDrop}>{w} </motion.span>
            ))}
          </motion.p>
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
            Type anything: a character, a place, a feeling, and Dream builds a world
            around it in seconds. Eleven illustrations. Ten chapters. One narrated storybook.
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
