"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Zap,
  Share2,
  Target,
  Layers,
  X,
  Lightbulb,
  Volume2,
  VolumeX,
  Play,
  Send,
} from "lucide-react";
import DreamNavbar from "@/components/ui/dream-navbar";
import styles from "./study-reels.module.css";

// ── Types ──────────────────────────────────────────────────────────────────

type PanelId = "explain" | "mindmap" | "quiz" | "deepdive" | null;
type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type ChatMsg = { role: "user" | "ai"; text: string; id: number };

type Reel = {
  id: string;
  subject: string;
  subjectColor: string;
  topic: string;
  title: string;
  summary: string;
  explanation: string;
  funFact: string;
  relatedTopics: string[];
  difficulty: Difficulty;
  learnerCount: string;
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  videoUrl: string;
  posterUrl: string;
  gradient: string;
  deepDives: { label: string; title: string; meta: string }[];
};

// ── Panel config ────────────────────────────────────────────────────────────

const PANEL_CONFIG: Record<
  NonNullable<PanelId>,
  { label: string; icon: React.ReactNode; color: string; glow: string }
> = {
  explain:  { label: "Explain",    icon: <BookOpen size={18} strokeWidth={1.8} />, color: "#60a5fa", glow: "rgba(96,165,250,0.18)"  },
  mindmap:  { label: "Related",    icon: <Share2   size={18} strokeWidth={1.8} />, color: "#34d399", glow: "rgba(52,211,153,0.18)"  },
  quiz:     { label: "Quiz Me",    icon: <Target   size={18} strokeWidth={1.8} />, color: "#fbbf24", glow: "rgba(251,191,36,0.18)"  },
  deepdive: { label: "Deep Dive",  icon: <Layers   size={18} strokeWidth={1.8} />, color: "#c084fc", glow: "rgba(192,132,252,0.18)" },
};

const PANEL_IDS = ["explain", "mindmap", "quiz", "deepdive"] as NonNullable<PanelId>[];

// ── Reel data ───────────────────────────────────────────────────────────────

const REELS: Reel[] = [
  {
    id: "quantum-entanglement",
    subject: "Physics",
    subjectColor: "#a78bfa",
    topic: "Quantum Mechanics",
    title: "Quantum Entanglement: Spooky Action at a Distance",
    summary: "Two particles share a connection so deep that measuring one instantly affects the other — no matter how far apart they are.",
    explanation:
      "Quantum entanglement occurs when two particles become linked so that the quantum state of one cannot be described independently of the other, even across vast distances. When you measure the spin of one entangled particle and find it 'up', you instantly know the other is 'down'.\n\nEinstein called this 'spooky action at a distance' — it seemed to violate his principle that nothing can travel faster than light. However, while the correlation is instant, no usable information is transmitted — the outcome is random until measured.\n\nThis phenomenon now underpins quantum computing and quantum cryptography, enabling theoretically unbreakable encryption.",
    funFact: "Scientists demonstrated entanglement over 1,200 km using China's Micius satellite — the longest quantum link ever created.",
    relatedTopics: ["Superposition", "Wave Function Collapse", "Quantum Computing", "Bell's Theorem", "Schrödinger's Cat", "Quantum Cryptography"],
    difficulty: "Advanced",
    learnerCount: "18.2k",
    quiz: {
      question: "What did Einstein famously call quantum entanglement?",
      options: ["Spooky action at a distance", "The God Particle effect", "Quantum tunneling paradox", "Wave-particle duality"],
      correctIndex: 0,
      explanation: "Einstein used 'spooky action at a distance' to express his discomfort — he believed it implied quantum mechanics was incomplete.",
    },
    videoUrl: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
    posterUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80",
    gradient: "radial-gradient(ellipse at 30% 20%, #4c1d95 0%, #1e1b4b 55%, #080604 100%)",
    deepDives: [
      { label: "History",     title: "The EPR Paradox & Einstein's Objections",   meta: "1935 · 5 min" },
      { label: "Application", title: "How Quantum Cryptography Uses Entanglement", meta: "Technology · 4 min" },
      { label: "Experiment",  title: "Bell Test Experiments Explained",            meta: "Lab · 6 min" },
    ],
  },
  {
    id: "fibonacci",
    subject: "Mathematics",
    subjectColor: "#fbbf24",
    topic: "Number Theory",
    title: "The Fibonacci Sequence Hides Everywhere",
    summary: "0, 1, 1, 2, 3, 5, 8, 13... This pattern appears in sunflower seeds, galaxy spirals, and stock market charts.",
    explanation:
      "The Fibonacci sequence is formed by adding the two preceding numbers. Each number is roughly 1.618× the previous — the Golden Ratio (φ).\n\nNature uses Fibonacci numbers for the most efficient packing arrangements. A sunflower has 34 spirals clockwise and 55 counter-clockwise — consecutive Fibonacci numbers — minimizing gaps and maximizing seeds per unit area.\n\nThe Golden Ratio appears in the Parthenon, Renaissance paintings, nautilus shells, and the spiral arms of the Milky Way. It's the universe's preferred aesthetic.",
    funFact: "The ratio of your forearm to your hand — and your hand to your fingers — approximates the golden ratio φ ≈ 1.618.",
    relatedTopics: ["Golden Ratio", "Pascal's Triangle", "Fractals", "Prime Numbers", "Phi in Architecture", "Spiral Galaxies"],
    difficulty: "Beginner",
    learnerCount: "31.7k",
    quiz: {
      question: "What is the 10th Fibonacci number (starting from 0)?",
      options: ["34", "55", "21", "89"],
      correctIndex: 0,
      explanation: "0, 1, 1, 2, 3, 5, 8, 13, 21, 34 — the 10th number is 34.",
    },
    videoUrl: "https://videos.pexels.com/video-files/3129957/3129957-uhd_2560_1440_30fps.mp4",
    posterUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600&auto=format&fit=crop&q=80",
    gradient: "radial-gradient(ellipse at 70% 30%, #78350f 0%, #451a03 55%, #080604 100%)",
    deepDives: [
      { label: "Nature", title: "Why Plants Grow in Fibonacci Spirals",            meta: "Biology · 4 min" },
      { label: "Art",    title: "The Golden Ratio in Renaissance Masterpieces",    meta: "Art History · 5 min" },
      { label: "Math",   title: "Binet's Formula: Any Fibonacci Number Instantly", meta: "Advanced · 7 min" },
    ],
  },
  {
    id: "crispr",
    subject: "Biology",
    subjectColor: "#34d399",
    topic: "Genetic Engineering",
    title: "CRISPR: Molecular Scissors Rewriting Life",
    summary: "Scientists borrowed a bacterial immune system and turned it into a precise cut-and-paste tool for editing any genome on Earth.",
    explanation:
      "CRISPR-Cas9 works like GPS-guided scissors at the molecular level. A guide RNA matches a target DNA section, and the Cas9 protein follows it and cuts both strands at exactly that location.\n\nOnce cut, cells attempt to repair the break. Scientists exploit this by either disabling a gene or inserting a new DNA template during repair — essentially rewriting the genetic code.\n\nDiscovered in bacteria that use it to defend against viruses, Jennifer Doudna and Emmanuelle Charpentier won the 2020 Nobel Prize for adapting it into a gene-editing tool. It's now treating sickle cell disease, cancers, and inherited blindness.",
    funFact: "In 2023, the FDA approved Casgevy — the first CRISPR therapy — to treat sickle cell disease. A single treatment may be curative.",
    relatedTopics: ["DNA Structure", "Gene Therapy", "mRNA Vaccines", "Stem Cells", "Epigenetics", "Synthetic Biology"],
    difficulty: "Intermediate",
    learnerCount: "24.9k",
    quiz: {
      question: "What does the 'Cas9' in CRISPR-Cas9 refer to?",
      options: ["A protein that cuts DNA", "A type of guide RNA", "A bacterial chromosome", "A repair mechanism"],
      correctIndex: 0,
      explanation: "Cas9 is the enzyme that acts as the molecular scissors, cutting both DNA strands at the guide RNA-specified location.",
    },
    videoUrl: "https://videos.pexels.com/video-files/3129977/3129977-uhd_2560_1440_30fps.mp4",
    posterUrl: "https://images.unsplash.com/photo-1614935151651-0bea6508db6b?w=600&auto=format&fit=crop&q=80",
    gradient: "radial-gradient(ellipse at 20% 60%, #064e3b 0%, #022c22 55%, #080604 100%)",
    deepDives: [
      { label: "Discovery", title: "How Bacteria Gave Us Gene Editing",       meta: "History · 4 min" },
      { label: "Medicine",  title: "First CRISPR Cures: From Lab to Patient", meta: "Clinical · 6 min" },
      { label: "Ethics",    title: "Designer Babies & CRISPR's Moral Limits", meta: "Ethics · 5 min" },
    ],
  },
  {
    id: "silk-road",
    subject: "History",
    subjectColor: "#f87171",
    topic: "Ancient Trade",
    title: "The Silk Road Shaped All of Civilization",
    summary: "A 4,000-mile web of routes linking China to Rome didn't just trade silk — it exchanged religions, plagues, and philosophies.",
    explanation:
      "The Silk Road wasn't a single road — it was a shifting network of trade routes spanning Central Asia, active from roughly 130 BCE to 1450 CE. Chinese silk was so prized in Rome that the Senate repeatedly banned it, yet merchants always found ways.\n\nMore than goods traveled these routes. Buddhism spread from India to China. Islam reached Southeast Asia via Muslim traders. The Black Death of 1347 likely traveled from Central Asia to Europe through Silk Road corridors.\n\nPaper, gunpowder, and the compass — all Chinese inventions — reached the Islamic world and then Europe via these routes, directly triggering the Renaissance.",
    funFact: "Silk was so valuable in ancient Rome that it was literally worth its weight in gold. Roman senators wore silk togas to signal extreme wealth.",
    relatedTopics: ["Mongol Empire", "Marco Polo", "Tang Dynasty", "Byzantine Trade", "Black Death", "Maritime Spice Routes"],
    difficulty: "Beginner",
    learnerCount: "15.3k",
    quiz: {
      question: "Which did NOT travel from China to Europe via the Silk Road?",
      options: ["The printing press", "Gunpowder", "Paper", "The compass"],
      correctIndex: 0,
      explanation: "Gutenberg invented the printing press in Europe (~1440). Paper, gunpowder, and the compass are the great Chinese inventions that reached Europe via the Silk Road.",
    },
    videoUrl: "https://videos.pexels.com/video-files/2169880/2169880-uhd_2560_1440_30fps.mp4",
    posterUrl: "https://images.unsplash.com/photo-1518899190867-5c0b7d50e4cf?w=600&auto=format&fit=crop&q=80",
    gradient: "radial-gradient(ellipse at 80% 20%, #7f1d1d 0%, #450a0a 55%, #080604 100%)",
    deepDives: [
      { label: "Culture", title: "How Buddhism Traveled Along Trade Routes",      meta: "Religion · 5 min" },
      { label: "Disease", title: "The Black Death's Journey from Central Asia",   meta: "Pandemic · 4 min" },
      { label: "Modern",  title: "China's Belt & Road: The 21st Century Silk Rd", meta: "Geopolitics · 6 min" },
    ],
  },
  {
    id: "neural-networks",
    subject: "Computer Science",
    subjectColor: "#60a5fa",
    topic: "Artificial Intelligence",
    title: "Neural Networks: Teaching Computers to Think",
    summary: "By mimicking billions of neurons, we taught machines to recognize faces, translate languages, and generate art.",
    explanation:
      "An artificial neural network is a series of mathematical 'neurons' in layers. Each neuron receives inputs, applies a weight, sums them, and passes the result through an activation function to decide whether to 'fire'.\n\nDuring training, the network sees thousands of examples. When it makes a wrong prediction, the error is propagated backward (backpropagation), adjusting weights to reduce future mistakes. After millions of iterations, patterns emerge.\n\nModern deep learning stacks many layers — early ones detect edges, later ones recognize faces or objects. Scaled to billions of parameters, the same architecture becomes GPT-4, predicting the next word using identical fundamental principles.",
    funFact: "GPT-4 has an estimated 1.8 trillion parameters — roughly as many as the synapses in 18 human brains combined.",
    relatedTopics: ["Backpropagation", "Transformer Architecture", "Convolutional Networks", "Reinforcement Learning", "LLMs", "Computer Vision"],
    difficulty: "Intermediate",
    learnerCount: "42.8k",
    quiz: {
      question: "What process adjusts neural network weights during training?",
      options: ["Backpropagation", "Forward propagation", "Gradient boosting", "Transfer learning"],
      correctIndex: 0,
      explanation: "Backpropagation computes how much each weight contributed to the error, then updates weights using the chain rule of calculus.",
    },
    videoUrl: "https://videos.pexels.com/video-files/3130284/3130284-uhd_2560_1440_30fps.mp4",
    posterUrl: "https://images.unsplash.com/photo-1555255707-c07966088b7b?w=600&auto=format&fit=crop&q=80",
    gradient: "radial-gradient(ellipse at 50% 10%, #0c4a6e 0%, #082f49 55%, #080604 100%)",
    deepDives: [
      { label: "History", title: "From Perceptron (1958) to ChatGPT: 65 Years", meta: "Timeline · 6 min" },
      { label: "Math",    title: "Backpropagation Explained with Calculus",      meta: "Advanced · 8 min" },
      { label: "Future",  title: "Will Transformers Be Replaced? What's Next",   meta: "Research · 5 min" },
    ],
  },
  {
    id: "black-holes",
    subject: "Astronomy",
    subjectColor: "#c084fc",
    topic: "Astrophysics",
    title: "Black Holes: Where Physics Breaks Down",
    summary: "At the center of a black hole our best equations output 'infinity' — admitting we have no idea what's actually happening.",
    explanation:
      "A black hole forms when matter is compressed into a point so dense that its escape velocity exceeds the speed of light. The boundary where light can no longer escape is the event horizon — a point of no return.\n\nAt the center lies a singularity, where density becomes infinite and spacetime curvature is infinite. General Relativity breaks down here — one of the biggest unsolved problems in physics.\n\nHawking radiation (1974) suggests black holes slowly evaporate by emitting thermal radiation due to quantum effects near the event horizon. A stellar black hole would take 10⁶⁷ years to fully evaporate — longer than the age of the universe.",
    funFact: "The first real photograph of a black hole (M87*, 2019) required a planet-sized telescope — eight synchronized radio dishes across four continents.",
    relatedTopics: ["General Relativity", "Event Horizon", "Hawking Radiation", "Neutron Stars", "Gravitational Waves", "Wormholes"],
    difficulty: "Advanced",
    learnerCount: "28.1k",
    quiz: {
      question: "What is the boundary around a black hole beyond which nothing can escape?",
      options: ["Event horizon", "Photon sphere", "Accretion disk", "Singularity"],
      correctIndex: 0,
      explanation: "The event horizon is the mathematical boundary where escape velocity equals the speed of light. It's not a physical surface.",
    },
    videoUrl: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
    posterUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&auto=format&fit=crop&q=80",
    gradient: "radial-gradient(ellipse at 60% 40%, #2e1065 0%, #1a0533 55%, #080604 100%)",
    deepDives: [
      { label: "Discovery", title: "The First Black Hole Photo: Behind the Science", meta: "EHT · 5 min" },
      { label: "Theory",    title: "Hawking Radiation & the Information Paradox",    meta: "Quantum · 7 min" },
      { label: "Types",     title: "Stellar, Supermassive & Primordial Black Holes", meta: "Overview · 4 min" },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateAIResponse(reel: Reel, question: string): string {
  const q = question.toLowerCase();
  const paras = reel.explanation.split("\n\n").filter(Boolean);
  for (const topic of reel.relatedTopics) {
    if (q.includes(topic.toLowerCase())) {
      return `Great question about ${topic}! ${paras[0]}`;
    }
  }
  if (q.includes("why"))    return paras[Math.min(1, paras.length - 1)];
  if (q.includes("how"))    return paras[0];
  if (q.includes("example") || q.includes("real")) return `Here's a real-world example: ${reel.funFact}`;
  if (q.includes("fact")   || q.includes("interesting")) return reel.funFact;
  return paras[Math.floor(Math.random() * paras.length)] ?? reel.funFact;
}

// ── Panel content components (no headers — panel card handles those) ──────

function ExplainContent({ reel }: { reel: Reel }) {
  return (
    <>
      <p className={styles.explanationText}>{reel.explanation}</p>
      <div className={styles.funFactBox}>
        <Lightbulb size={14} color="#e8943d" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className={styles.funFactLabel}>Fun Fact</p>
          <p className={styles.funFactText}>{reel.funFact}</p>
        </div>
      </div>
    </>
  );
}

function MindMapContent({ reel }: { reel: Reel }) {
  return (
    <>
      <p className={styles.mindMapCenterLabel}>{"Connected to \""}{reel.topic}{"\""}</p>
      <div className={styles.mindMapGrid}>
        <motion.div
          className={styles.mindMapNode}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          style={{ background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.32)", color: "#34d399", fontWeight: 700 }}
        >
          {reel.topic}
        </motion.div>
        {reel.relatedTopics.map((topic, i) => (
          <motion.div
            key={topic}
            className={styles.mindMapNode}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.04 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            {topic}
          </motion.div>
        ))}
      </div>
    </>
  );
}

function QuizContent({ reel }: { reel: Reel }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showXP,   setShowXP]   = useState(false);
  const answered  = selected !== null;
  const isCorrect = answered && selected === reel.quiz.correctIndex;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
    if (i === reel.quiz.correctIndex) {
      setShowXP(true);
      setTimeout(() => setShowXP(false), 1400);
    }
  };

  return (
    <>
      <p className={styles.quizQuestion}>{reel.quiz.question}</p>
      <div className={styles.quizOptions}>
        {reel.quiz.options.map((opt, i) => {
          let cls = styles.quizOption;
          if (answered) {
            if (i === reel.quiz.correctIndex) cls += ` ${styles.quizOptionCorrect}`;
            else if (i === selected)          cls += ` ${styles.quizOptionWrong}`;
          }
          return (
            <motion.button
              key={i}
              className={cls}
              disabled={answered}
              onClick={() => handleSelect(i)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: i * 0.065 }}
            >
              <span style={{ marginRight: 7, opacity: 0.45, fontWeight: 700 }}>{String.fromCharCode(65 + i)}.</span>
              {opt}
            </motion.button>
          );
        })}
        <AnimatePresence>
          {showXP && (
            <motion.div className={styles.xpFloat} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -44 }} exit={{ opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut" }}>
              +50 XP ✨
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {answered && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <p className={`${styles.quizFeedback} ${isCorrect ? styles.quizFeedbackCorrect : styles.quizFeedbackWrong}`}>
              {isCorrect ? "✓ Correct! " : "✗ Not quite. "}{reel.quiz.explanation}
            </p>
            {!isCorrect && <button className={styles.quizRetry} onClick={() => setSelected(null)}>Try Again</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DeepDiveContent({ reel }: { reel: Reel }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([{
    role: "ai",
    text: `Ask me anything about "${reel.title}" — or tap a topic below.`,
    id: 0,
  }]);
  const [input,  setInput]  = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing]);

  const send = useCallback((text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || typing) return;
    setInput("");
    const uid = Date.now();
    setMsgs((p) => [...p, { role: "user", text: userText, id: uid }]);
    setTyping(true);
    window.setTimeout(() => {
      setMsgs((p) => [...p, { role: "ai", text: generateAIResponse(reel, userText), id: Date.now() }]);
      setTyping(false);
    }, 900 + Math.floor(Math.random() * 700));
  }, [input, typing, reel]);

  const hasUserMsg = msgs.some((m) => m.role === "user");

  return (
    <div className={styles.chatPanelWrap}>
      {/* Messages */}
      <div className={styles.chatMessages} ref={scrollRef}>
        <AnimatePresence initial={false}>
          {msgs.map((msg) => (
            <motion.div
              key={msg.id}
              className={`${styles.chatBubble} ${msg.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAI}`}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <motion.div className={`${styles.chatBubble} ${styles.chatBubbleAI}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
            <div className={styles.typingDots}><span /><span /><span /></div>
          </motion.div>
        )}
        {!hasUserMsg && !typing && (
          <motion.div className={styles.chatSuggestions} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.15 }}>
            {reel.deepDives.map((dive, i) => (
              <button key={i} className={styles.chatSuggestionChip} onClick={() => send(dive.title)}>
                {dive.title}
              </button>
            ))}
          </motion.div>
        )}
      </div>
      {/* Input */}
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          placeholder="Ask anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          autoComplete="off"
        />
        <button className={styles.chatSendBtn} onClick={() => send()} disabled={!input.trim() || typing} aria-label="Send">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Single reel item ────────────────────────────────────────────────────────

function ReelItem({
  reel, index, total, globalMuted, onToggleMute, savedIds, onSave,
}: {
  reel: Reel; index: number; total: number;
  globalMuted: boolean; onToggleMute: () => void;
  savedIds: Set<string>; onSave: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const [playing,     setPlaying]     = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const isSaved = savedIds.has(reel.id);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return;
        if (entry.isIntersecting) {
          videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
        } else {
          videoRef.current.pause();
          setPlaying(false);
          setActivePanel(null);
        }
      },
      { threshold: 0.65 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = globalMuted;
  }, [globalMuted]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const togglePanel = (id: NonNullable<PanelId>) =>
    setActivePanel((prev) => (prev === id ? null : id));

  return (
    <div className={`${styles.reel} ${activePanel ? styles.reelPanelOpen : ""}`.trim()} ref={wrapRef}>

      <div className={styles.reelMain}>
        {/* ── 9:16 Video — title only ──────────────────────────────── */}
        <div className={styles.videoWrap}>
          <div className={styles.videoBg} style={{ background: reel.gradient }} />
          <video ref={videoRef} className={styles.video} src={reel.videoUrl} poster={reel.posterUrl} loop muted={globalMuted} playsInline preload="metadata" />
          <div className={styles.videoVignetteTop} />
          <div className={styles.videoVignette} />
          <div className={styles.progressBar} style={{ width: `${((index + 1) / total) * 100}%` }} />

          {/* Subject pill */}
          <motion.div
            className={styles.subjectPill}
            style={{ background: `${reel.subjectColor}22`, color: reel.subjectColor, borderColor: `${reel.subjectColor}40` }}
            initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {reel.subject}
          </motion.div>

          {/* Mute */}
          <button className={styles.muteBtn} onClick={onToggleMute} aria-label={globalMuted ? "Unmute" : "Mute"}>
            {globalMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          {/* Tap to pause */}
          <button className={styles.videoTapTarget} onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} />

          {/* Pause indicator */}
          <AnimatePresence>
            {!playing && (
              <motion.div className={styles.pauseIndicator} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.18 }}>
                <div className={styles.pauseIndicatorInner}><Play size={18} color="#fff" fill="#fff" /></div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Title overlay */}
          <motion.div className={styles.videoTitleOverlay} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false }} transition={{ duration: 0.38, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
            <p className={styles.reelTopicLabel}>{reel.topic}</p>
            <h2 className={styles.reelTitle} style={{ fontFamily: "var(--font-halant)" }}>{reel.title}</h2>
          </motion.div>
        </div>

        {/* ── Circles column — outside the video ──────────────────── */}
        <motion.div
          className={styles.circlesCol}
          initial={{ opacity: 0, x: 14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          {/* Sounds Interesting */}
          <button
            className={`${styles.circleBtn} ${isSaved ? styles.circleBtnSaved : ""}`}
            onClick={() => onSave(reel.id)}
            aria-label="Sounds Interesting"
          >
            <div
              className={styles.circleBtnIcon}
              style={isSaved ? { background: "rgba(232,148,61,0.18)", borderColor: "rgba(232,148,61,0.36)" } : {}}
            >
              <motion.div
                animate={isSaved ? { rotate: [0, -18, 14, -7, 0], scale: [1, 1.22, 0.9, 1.06, 1] } : { rotate: 0, scale: 1 }}
                transition={{ duration: 0.42 }}
              >
                <Zap size={18} fill={isSaved ? "#e8943d" : "none"} color={isSaved ? "#e8943d" : "rgba(246,239,232,0.62)"} strokeWidth={1.8} />
              </motion.div>
            </div>
            <span className={styles.circleBtnLabel} style={{ color: isSaved ? "#e8943d" : undefined }}>
              {isSaved ? "Saved!" : "Interesting"}
            </span>
          </button>

          {/* Panel circles */}
          {PANEL_IDS.map((id) => {
            const cfg = PANEL_CONFIG[id];
            const isActive = activePanel === id;
            return (
              <button
                key={id}
                className={`${styles.circleBtn} ${isActive ? styles.circleBtnActive : ""}`}
                onClick={() => togglePanel(id)}
                aria-label={cfg.label}
                style={isActive ? {
                  background: `${cfg.color}14`,
                  borderColor: `${cfg.color}38`,
                  boxShadow: `0 0 22px ${cfg.glow}, 0 2px 14px rgba(0,0,0,0.48)`,
                } : {}}
              >
                <motion.div
                  className={styles.circleBtnIcon}
                  animate={{
                    background: isActive ? cfg.glow : "rgba(246,239,232,0.05)",
                    borderColor: isActive ? `${cfg.color}45` : "rgba(246,239,232,0.08)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    animate={{ color: isActive ? cfg.color : "rgba(246,239,232,0.62)" }}
                    transition={{ duration: 0.18 }}
                  >
                    {cfg.icon}
                  </motion.div>
                </motion.div>
                <motion.span
                  className={styles.circleBtnLabel}
                  animate={{ color: isActive ? cfg.color : "rgba(196,181,168,0.48)" }}
                  transition={{ duration: 0.18 }}
                >
                  {cfg.label}
                </motion.span>
              </button>
            );
          })}
        </motion.div>
      </div>

      {/* ── Panel card — slides in to the right of circles ──────── */}
      {activePanel && (
        <div className={styles.panelSlot}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className={styles.panelCard}
              key={activePanel}
              initial={{ opacity: 0, x: -16, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -12, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Panel header */}
              <div
                className={styles.panelCardHeader}
                style={{ background: `linear-gradient(135deg, ${PANEL_CONFIG[activePanel].color}10 0%, transparent 55%)` }}
              >
                <div className={styles.panelCardTitleRow}>
                  {activePanel === "deepdive" && <div className={styles.chatAvatarDot} />}
                  <div>
                    <p className={styles.panelCardTitle} style={{ color: PANEL_CONFIG[activePanel].color }}>
                      {PANEL_CONFIG[activePanel].icon}
                      {PANEL_CONFIG[activePanel].label}
                      {activePanel === "deepdive" && <span className={styles.aiTag}>AI</span>}
                    </p>
                    {activePanel === "deepdive" && (
                      <p className={styles.panelCardSub}>{reel.topic}</p>
                    )}
                  </div>
                </div>
                <button className={styles.panelCardClose} onClick={() => setActivePanel(null)} aria-label="Close">
                  <X size={13} />
                </button>
              </div>

              {/* Panel body */}
              <div className={styles.panelCardBody}>
                {activePanel === "explain"  && <ExplainContent  reel={reel} />}
                {activePanel === "mindmap"  && <MindMapContent  reel={reel} />}
                {activePanel === "quiz"     && <QuizContent     reel={reel} />}
                {activePanel === "deepdive" && <DeepDiveContent reel={reel} />}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function StudyReelsPage() {
  const [savedIds,       setSavedIds]       = useState<Set<string>>(new Set());
  const [globalMuted,    setGlobalMuted]    = useState(true);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const toastTimeout = useRef<number | null>(null);

  const handleSave = useCallback((id: string) => {
    const wasAlreadySaved = savedIds.has(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (!wasAlreadySaved) {
      setShowSavedToast(true);
      if (toastTimeout.current) window.clearTimeout(toastTimeout.current);
      toastTimeout.current = window.setTimeout(() => setShowSavedToast(false), 1800);
    }
  }, [savedIds]);

  return (
    <>
      <DreamNavbar collapsed collapsedAlign="right" />
      <main className={styles.page}>
        <div className={styles.feed} role="feed" aria-label="Study Reels">
          {REELS.map((reel, i) => (
            <ReelItem
              key={reel.id}
              reel={reel}
              index={i}
              total={REELS.length}
              globalMuted={globalMuted}
              onToggleMute={() => setGlobalMuted((m) => !m)}
              savedIds={savedIds}
              onSave={handleSave}
            />
          ))}
        </div>

        <AnimatePresence>
          {showSavedToast && (
            <motion.div
              className={styles.savedFeedback}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={styles.savedFeedbackInner}>⚡ Saved to Interesting!</div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
