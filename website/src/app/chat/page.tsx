"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Sparkles, User, ChevronLeft, ChevronRight, Clapperboard, Gamepad2, RotateCw } from "lucide-react";
import { PromptInputBox, type PromptSendPayload, type ModeId, type CharacterSelection } from "@/components/ui/ai-prompt-box";
import DreamNavbar from "@/components/ui/dream-navbar";
import { dashboardCharacters, dashboardStories, getDashboardStoryPages } from "@/lib/dashboard-data";
import { StoryBook } from "@/components/dashboard/story-book";
import {
  GAMEPLAY_BACKGROUNDS,
  GAMEPLAY_CATEGORY_OPTIONS,
  VIDEO_MODE_OPTIONS,
  getDefaultGameplayBackgroundId,
  type GameplayCategory,
  type VideoGenerationType,
} from "@/lib/video-generation-options";

import styles from "./chat-page.module.css";

interface ThinkingStep {
  title: string;
  detail: string;
  imageUrls?: string[];
}

interface GameplaySelection {
  category: GameplayCategory;
  backgroundId: string;
  backgroundName: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  basePrompt?: string;
  mode?: ModeId | "normal";
  characterSelection?: CharacterSelection | null;
  videoType?: VideoGenerationType | null;
  gameplaySelection?: GameplaySelection | null;
  thinkingSteps?: ThinkingStep[];
  thinkingDuration?: number;
}

interface MessageGroup {
  role: "user" | "assistant";
  messages: Message[];
}

const TITLE_WORDS = ["What", "shall", "we", "dream", "up?"];

// 5 images — 2:3 portrait, matching the story book's per-page illustration ratio
const DREAM_STAGE_IMAGES = [
  "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1475274047050-1d0c55b91e0a?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=480&h=720&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=480&h=720&auto=format&fit=crop&q=80",
];

const COMMON_THINKING_STEPS: ThinkingStep[] = [
  {
    title: "Reading your idea",
    detail: "Parsing the prompt to understand the core theme, setting, and emotional tone you are looking for in the story.",
  },
  {
    title: "Building the world",
    detail: "Sketching the story's environment — whether an enchanted forest, underwater realm, or sky kingdom — to ground the narrative.",
  },
  {
    title: "Designing the characters",
    detail: "Inventing memorable, kid-friendly heroes, sidekicks, and perhaps a gentle antagonist with relatable motivations.",
  },
  {
    title: "Plotting the adventure",
    detail: "Mapping the narrative arc: a call to adventure, rising tension, a challenge to overcome, and a satisfying resolution.",
  },
  {
    title: "Choosing the language",
    detail: "Selecting vocabulary that is vivid, age-appropriate, and easy to follow while keeping sentences lively and engaging.",
  },
  {
    title: "Weaving in the magic",
    detail: "Adding the unexpected — a talking creature, a hidden door, a glowing artifact — to spark wonder and imagination.",
  },
  {
    title: "Checking the lesson",
    detail: "Ensuring the story carries a gentle, positive message about courage, kindness, or curiosity without being preachy.",
  },
  {
    title: "Polishing the narrative",
    detail: "Reviewing pacing and flow, smoothing transitions, and ensuring every sentence earns its place in the story.",
  },
];

const STORY_IMAGE_STEP: ThinkingStep = {
  title: "Generating scene images",
  detail: "Creating 2:3 portrait illustrations one by one so you can preview the visual style as the story comes together.",
  imageUrls: DREAM_STAGE_IMAGES,
};

const STORY_THINKING_STEPS: ThinkingStep[] = [
  ...COMMON_THINKING_STEPS.slice(0, 3),
  STORY_IMAGE_STEP,
  ...COMMON_THINKING_STEPS.slice(3),
];

const VIDEO_NORMAL_THINKING_STEPS: ThinkingStep[] = [
  {
    title: "Reading your concept",
    detail: "Extracting the core action, mood, and pacing needed for a strong narrative video.",
  },
  {
    title: "Writing shot plan",
    detail: "Converting your idea into a scene-by-scene timeline for smooth visual continuity.",
  },
  {
    title: "Designing visual style",
    detail: "Choosing framing, color mood, and transitions that fit your prompt.",
  },
  {
    title: "Generating keyframes",
    detail: "Building core visual moments that anchor the final motion sequence.",
  },
  {
    title: "Syncing voice and music",
    detail: "Balancing narration cadence and background track to match scene timing.",
  },
  {
    title: "Rendering the final cut",
    detail: "Compositing visuals, effects, and audio into a polished vertical video.",
  },
  {
    title: "Quality review",
    detail: "Checking pacing, transitions, and readability before final delivery.",
  },
];

const VIDEO_GAMEPLAY_THINKING_STEPS: ThinkingStep[] = [
  {
    title: "Reading your concept",
    detail: "Detecting hook, tone, and payoff so the gameplay edit stays engaging from start to finish.",
  },
  {
    title: "Picking gameplay rhythm",
    detail: "Matching your narrative beats to fast gameplay pacing for short-form momentum.",
  },
  {
    title: "Planning hook sequence",
    detail: "Structuring opening seconds, mid-clip escalation, and ending punchline.",
  },
  {
    title: "Generating vertical scenes",
    detail: "Producing stylized scene layers optimized for quick, high-retention viewing.",
  },
  {
    title: "Layering captions and voice",
    detail: "Timing overlays and narration so text remains clear during rapid motion.",
  },
  {
    title: "Mixing gameplay and story",
    detail: "Blending gameplay footage with narrative visuals into one coherent clip.",
  },
  {
    title: "Final render and check",
    detail: "Exporting the gameplay video and validating smooth transitions end-to-end.",
  },
];

const STORY_CHARACTER_OPTIONS = dashboardCharacters;

// Mock story result — used when story mode completes
const MOCK_STORY = dashboardStories[0];
const MOCK_STORY_PAGES = getDashboardStoryPages(MOCK_STORY.id);
const DEFAULT_GAMEPLAY_CATEGORY: GameplayCategory = GAMEPLAY_CATEGORY_OPTIONS[0]?.id ?? "minecraft";
const DEFAULT_GAMEPLAY_BACKGROUND_ID = getDefaultGameplayBackgroundId(DEFAULT_GAMEPLAY_CATEGORY);

const easeOutExpo = [0.22, 1, 0.36, 1] as const;
const THINKING_TOTAL_MS = 30000;
const STEP_INITIAL_DELAY_MS = 500;
const IMAGE_REVEAL_INTERVAL_MS = 260;
const AUTO_SCROLL_THRESHOLD_PX = 120;

function getThinkingSteps(mode: ModeId | "normal", videoType: VideoGenerationType | null = null): ThinkingStep[] {
  if (mode === "story") return STORY_THINKING_STEPS;
  if (mode === "video") return videoType === "gameplay" ? VIDEO_GAMEPLAY_THINKING_STEPS : VIDEO_NORMAL_THINKING_STEPS;
  return COMMON_THINKING_STEPS;
}

const blockMotion = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: (delay = 0) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.74, delay, ease: easeOutExpo },
  }),
};

const headingLineMotion = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

const headingWordMotion = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.62, ease: easeOutExpo },
  },
};

function groupMessages(messages: Message[]): MessageGroup[] {
  return messages.reduce<MessageGroup[]>((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.role === msg.role) {
      last.messages.push(msg);
    } else {
      acc.push({ role: msg.role, messages: [msg] });
    }
    return acc;
  }, []);
}

function formatStoryPromptWithCharacter(prompt: string, characterSelection: CharacterSelection | null) {
  if (!characterSelection) return prompt;
  return `${prompt}\n\nCharacter: ${characterSelection.name} (${characterSelection.type === "create" ? "new" : "existing"})`;
}

function formatVideoPromptWithType(
  prompt: string,
  videoType: VideoGenerationType | null,
  gameplaySelection: GameplaySelection | null = null,
) {
  if (!videoType) return prompt;
  if (videoType === "gameplay" && gameplaySelection) {
    const categoryLabel = GAMEPLAY_CATEGORY_OPTIONS.find((option) => option.id === gameplaySelection.category)?.label ?? gameplaySelection.category;
    return `${prompt}\n\nVideo Type: Gameplay\nGameplay Style: ${categoryLabel} • ${gameplaySelection.backgroundName}`;
  }
  return `${prompt}\n\nVideo Type: Normal`;
}

function getStoryCharacterStep(selection: CharacterSelection | null): ThinkingStep {
  return {
    title: "Choosing character style",
    detail: selection?.type === "existing"
      ? `Selected ${selection.name} as the lead character before story generation.`
      : "Selected no fixed character and used AI creativity before story generation.",
  };
}

function getVideoTypeStep(videoType: VideoGenerationType | null, gameplaySelection: GameplaySelection | null): ThinkingStep {
  if (videoType === "gameplay" && gameplaySelection) {
    const categoryLabel = GAMEPLAY_CATEGORY_OPTIONS.find((option) => option.id === gameplaySelection.category)?.label ?? gameplaySelection.category;
    return {
      title: "Choosing video format",
      detail: `Selected gameplay video mode with ${categoryLabel} • ${gameplaySelection.backgroundName}.`,
    };
  }
  return {
    title: "Choosing video format",
    detail: "Selected normal narrative video mode before generation.",
  };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosingLogs, setIsClosingLogs] = useState(false);
  const [isThinkingStreamActive, setIsThinkingStreamActive] = useState(false);
  const [hasActiveStoryCharacterChoice, setHasActiveStoryCharacterChoice] = useState(false);
  const [hasActiveVideoTypeChoice, setHasActiveVideoTypeChoice] = useState(false);
  const [composerMode, setComposerMode] = useState<ModeId | null>(null);
  const [activeRunMode, setActiveRunMode] = useState<ModeId | "normal">("normal");
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<ThinkingStep[]>(COMMON_THINKING_STEPS);
  const [activeStoryMessageId, setActiveStoryMessageId] = useState<string | null>(null);
  const [activeVideoMessageId, setActiveVideoMessageId] = useState<string | null>(null);
  const [activeStoryCharacterSelection, setActiveStoryCharacterSelection] = useState<CharacterSelection | null>(null);
  const [activeStoryCharacterId, setActiveStoryCharacterId] = useState<string>("");
  const [activeVideoType, setActiveVideoType] = useState<VideoGenerationType | null>(null);
  const [activeGameplaySelection, setActiveGameplaySelection] = useState<GameplaySelection | null>(null);
  const [pendingStoryCharacterId, setPendingStoryCharacterId] = useState<string>("");
  const [pendingUseAiStoryCharacter, setPendingUseAiStoryCharacter] = useState(false);
  const [pendingVideoType, setPendingVideoType] = useState<VideoGenerationType | null>(null);
  const [pendingGameplayCategory, setPendingGameplayCategory] = useState<GameplayCategory>(DEFAULT_GAMEPLAY_CATEGORY);
  const [pendingGameplayBackgroundId, setPendingGameplayBackgroundId] = useState(DEFAULT_GAMEPLAY_BACKGROUND_ID);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [visibleImageCount, setVisibleImageCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const characterCarouselRef = useRef<HTMLDivElement>(null);
  const thinkingStartRef = useRef<number>(0);
  const activeStoryCharacterSelectionRef = useRef<CharacterSelection | null>(null);
  const activeVideoTypeRef = useRef<VideoGenerationType | null>(null);
  const activeGameplaySelectionRef = useRef<GameplaySelection | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth", force = false) => {
    if (!force && !shouldAutoScroll) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      requestAnimationFrame(() => {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      });
    });
  }, [shouldAutoScroll]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const handleScroll = () => {
      const distanceFromBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      setShouldAutoScroll(distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX);
    };
    handleScroll();
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  const toggleThinking = useCallback((id: string) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const stepIntervalMs = React.useMemo(() => {
    const count = Math.max(activeThinkingSteps.length, 1);
    const bufferedWindow = THINKING_TOTAL_MS - STEP_INITIAL_DELAY_MS - 3000;
    return Math.max(1400, Math.floor(bufferedWindow / count));
  }, [activeThinkingSteps.length]);

  const activeStoryCharacter = React.useMemo(
    () => STORY_CHARACTER_OPTIONS.find((char) => char.id === activeStoryCharacterId) ?? null,
    [activeStoryCharacterId],
  );

  const pendingStoryCharacter = React.useMemo(
    () => STORY_CHARACTER_OPTIONS.find((char) => char.id === pendingStoryCharacterId) ?? null,
    [pendingStoryCharacterId],
  );

  const pendingVideoTypeOption = React.useMemo(
    () => VIDEO_MODE_OPTIONS.find((option) => option.value === pendingVideoType) ?? null,
    [pendingVideoType],
  );

  const pendingGameplayBackgroundOptions = React.useMemo(
    () => GAMEPLAY_BACKGROUNDS[pendingGameplayCategory],
    [pendingGameplayCategory],
  );

  const pendingGameplayBackground = React.useMemo(() => {
    return pendingGameplayBackgroundOptions.find((item) => item.id === pendingGameplayBackgroundId)
      ?? pendingGameplayBackgroundOptions[0]
      ?? null;
  }, [pendingGameplayBackgroundOptions, pendingGameplayBackgroundId]);

  const hasPendingStoryChoice = pendingUseAiStoryCharacter || Boolean(pendingStoryCharacterId);

  const applyActiveStoryCharacterSelection = useCallback((selection: CharacterSelection | null, targetMessageId?: string) => {
    const messageId = targetMessageId ?? activeStoryMessageId;
    activeStoryCharacterSelectionRef.current = selection;
    setActiveStoryCharacterSelection(selection);
    if (!messageId) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || msg.role !== "user") return msg;
        const basePrompt = msg.basePrompt ?? msg.content;
        return {
          ...msg,
          basePrompt,
          characterSelection: selection,
          content: formatStoryPromptWithCharacter(basePrompt, selection),
        };
      }),
    );
  }, [activeStoryMessageId]);

  const applyActiveVideoTypeSelection = useCallback((
    selection: VideoGenerationType | null,
    gameplaySelection: GameplaySelection | null,
    targetMessageId?: string,
  ) => {
    const messageId = targetMessageId ?? activeVideoMessageId;
    activeVideoTypeRef.current = selection;
    activeGameplaySelectionRef.current = gameplaySelection;
    setActiveVideoType(selection);
    setActiveGameplaySelection(gameplaySelection);
    if (selection) {
      const videoSteps = getThinkingSteps("video", selection).map((step) => ({
        ...step,
        imageUrls: step.imageUrls ? [...step.imageUrls] : undefined,
      }));
      setActiveThinkingSteps(videoSteps);
    }
    if (!messageId) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || msg.role !== "user") return msg;
        const basePrompt = msg.basePrompt ?? msg.content;
        return {
          ...msg,
          basePrompt,
          videoType: selection,
          gameplaySelection,
          content: formatVideoPromptWithType(basePrompt, selection, gameplaySelection),
        };
      }),
    );
  }, [activeVideoMessageId]);

  const startThinkingStream = useCallback(() => {
    if (!isLoading || isThinkingStreamActive) return;
    thinkingStartRef.current = Date.now();
    setElapsedSeconds(0);
    setIsThinkingStreamActive(true);
    setShouldAutoScroll(true);
    setTimeout(() => scrollToBottom("smooth", true), 40);
  }, [isLoading, isThinkingStreamActive, scrollToBottom]);

  const handleSelectStoryCharacter = useCallback((characterId: string) => {
    setActiveStoryCharacterId(characterId);
    const selected = STORY_CHARACTER_OPTIONS.find((char) => char.id === characterId);
    if (!selected) return;
    applyActiveStoryCharacterSelection({ type: "existing", name: selected.name });
    setHasActiveStoryCharacterChoice(true);
    startThinkingStream();
  }, [applyActiveStoryCharacterSelection, startThinkingStream]);

  const handleUseAiStoryCharacter = useCallback(() => {
    setActiveStoryCharacterId("");
    applyActiveStoryCharacterSelection(null);
    setHasActiveStoryCharacterChoice(true);
    startThinkingStream();
  }, [applyActiveStoryCharacterSelection, startThinkingStream]);

  const handlePickPendingStoryCharacter = useCallback((characterId: string) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingUseAiStoryCharacter(false);
    setPendingStoryCharacterId((previous) => (previous === characterId ? "" : characterId));
  }, [isThinkingStreamActive, isClosingLogs]);

  const handlePickPendingAiChoice = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingStoryCharacterId("");
    setPendingUseAiStoryCharacter((previous) => !previous);
  }, [isThinkingStreamActive, isClosingLogs]);

  const handleClearPendingStoryChoice = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingStoryCharacterId("");
    setPendingUseAiStoryCharacter(false);
  }, [isThinkingStreamActive, isClosingLogs]);

  const scrollCharacterCarousel = useCallback((dir: 1 | -1) => {
    const el = characterCarouselRef.current;
    if (!el) return;
    // scroll 3 cards at a time (80px card + 7px gap)
    el.scrollBy({ left: dir * (80 * 3 + 7 * 2), behavior: "smooth" });
  }, []);

  const handleConfirmStoryCharacterChoice = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs) return;
    if (pendingUseAiStoryCharacter) {
      handleUseAiStoryCharacter();
      return;
    }
    if (pendingStoryCharacterId) {
      handleSelectStoryCharacter(pendingStoryCharacterId);
    }
  }, [
    isThinkingStreamActive,
    isClosingLogs,
    pendingUseAiStoryCharacter,
    pendingStoryCharacterId,
    handleUseAiStoryCharacter,
    handleSelectStoryCharacter,
  ]);

  const handlePickPendingVideoType = useCallback((selection: VideoGenerationType) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingVideoType(selection);
    if (selection === "normal") return;
    const firstBackgroundId = getDefaultGameplayBackgroundId(pendingGameplayCategory);
    if (!pendingGameplayBackgroundId || !GAMEPLAY_BACKGROUNDS[pendingGameplayCategory].some((clip) => clip.id === pendingGameplayBackgroundId)) {
      setPendingGameplayBackgroundId(firstBackgroundId);
    }
  }, [isThinkingStreamActive, isClosingLogs, pendingGameplayCategory, pendingGameplayBackgroundId]);

  const handlePickPendingGameplayCategory = useCallback((category: GameplayCategory) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingGameplayCategory(category);
    setPendingGameplayBackgroundId(getDefaultGameplayBackgroundId(category));
  }, [isThinkingStreamActive, isClosingLogs]);

  const handlePickPendingGameplayBackground = useCallback((backgroundId: string) => {
    if (isThinkingStreamActive || isClosingLogs) return;
    setPendingGameplayBackgroundId(backgroundId);
  }, [isThinkingStreamActive, isClosingLogs]);

  const handleConfirmVideoTypeChoice = useCallback(() => {
    if (isThinkingStreamActive || isClosingLogs || !pendingVideoType) return;
    if (pendingVideoType === "gameplay") {
      const selectedBackground =
        GAMEPLAY_BACKGROUNDS[pendingGameplayCategory].find((item) => item.id === pendingGameplayBackgroundId)
        ?? GAMEPLAY_BACKGROUNDS[pendingGameplayCategory][0];
      if (!selectedBackground) return;
      applyActiveVideoTypeSelection(
        pendingVideoType,
        {
          category: pendingGameplayCategory,
          backgroundId: selectedBackground.id,
          backgroundName: selectedBackground.name,
        },
      );
    } else {
      applyActiveVideoTypeSelection(pendingVideoType, null);
    }
    setHasActiveVideoTypeChoice(true);
    startThinkingStream();
  }, [
    isThinkingStreamActive,
    isClosingLogs,
    pendingVideoType,
    pendingGameplayCategory,
    pendingGameplayBackgroundId,
    applyActiveVideoTypeSelection,
    startThinkingStream,
  ]);

  // Stream steps + elapsed counter while loading
  useEffect(() => {
    if (!isLoading || !isThinkingStreamActive) return;

    const imageTimers: ReturnType<typeof setTimeout>[] = [];
    const stepTimers = activeThinkingSteps.map((step, i) =>
      setTimeout(() => {
        setVisibleSteps(i + 1);
        if (step.imageUrls?.length) {
          setVisibleImageCount(0);
          step.imageUrls.forEach((_, imageIndex) => {
            imageTimers.push(
              setTimeout(() => {
                setVisibleImageCount(imageIndex + 1);
              }, IMAGE_REVEAL_INTERVAL_MS * (imageIndex + 1))
            );
          });
        }
      }, i * stepIntervalMs + STEP_INITIAL_DELAY_MS)
    );

    const ticker = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

    return () => {
      stepTimers.forEach(clearTimeout);
      imageTimers.forEach(clearTimeout);
      clearInterval(ticker);
    };
  }, [isLoading, isThinkingStreamActive, activeThinkingSteps, stepIntervalMs]);

  // Keep the live thinking stream pinned to bottom while steps/images are added.
  useEffect(() => {
    if (!isLoading || !isThinkingStreamActive || !shouldAutoScroll) return;
    scrollToBottom("auto");
  }, [isLoading, isThinkingStreamActive, visibleSteps, visibleImageCount, shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    if (!isLoading || !isThinkingStreamActive) return;
    const imageStageTotal = activeThinkingSteps.find((step) => step.imageUrls?.length)?.imageUrls?.length ?? 0;
    const closeDelayMs = 240;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const finishTimer = setTimeout(() => {
      const duration = Math.round((Date.now() - thinkingStartRef.current) / 1000);
      setVisibleSteps(activeThinkingSteps.length);
      setVisibleImageCount(imageStageTotal);
      setElapsedSeconds(duration);
      setIsClosingLogs(true);

      closeTimer = setTimeout(() => {
        const finalCharacterSelection =
          activeRunMode === "story" ? activeStoryCharacterSelectionRef.current : null;
        const finalVideoType =
          activeRunMode === "video" ? activeVideoTypeRef.current : null;
        const finalGameplaySelection =
          activeRunMode === "video" ? activeGameplaySelectionRef.current : null;
        const finalThinkingSteps = activeRunMode === "story"
          ? [getStoryCharacterStep(finalCharacterSelection), ...activeThinkingSteps]
          : activeRunMode === "video"
            ? [getVideoTypeStep(finalVideoType, finalGameplaySelection), ...activeThinkingSteps]
            : activeThinkingSteps;
        const assistantContent = activeRunMode === "story"
          ? "What a wonderful idea! Let me weave a magical story around that — filled with wonder, friendship, and adventure that kids will absolutely love. Give me just a moment to craft something special for you..."
          : activeRunMode === "video"
            ? finalVideoType === "gameplay"
              ? "Great concept. I am shaping it into a high-energy gameplay-style video flow with tight pacing and strong visual hooks."
              : "Great concept. I am shaping it into a polished narrative video with clear scene progression and balanced audio pacing."
            : "Great prompt. I am preparing a focused response with clear structure and polished wording.";
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: assistantContent,
            timestamp: new Date(),
            mode: activeRunMode,
            characterSelection: finalCharacterSelection,
            videoType: finalVideoType,
            gameplaySelection: finalGameplaySelection,
            thinkingSteps: finalThinkingSteps,
            thinkingDuration: duration,
          },
        ]);
        setActiveStoryMessageId(null);
        setActiveVideoMessageId(null);
        setActiveStoryCharacterSelection(null);
        setActiveStoryCharacterId("");
        setActiveVideoType(null);
        setActiveGameplaySelection(null);
        setPendingStoryCharacterId("");
        setPendingUseAiStoryCharacter(false);
        setPendingVideoType(null);
        setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
        setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
        setHasActiveStoryCharacterChoice(false);
        setHasActiveVideoTypeChoice(false);
        activeStoryCharacterSelectionRef.current = null;
        activeVideoTypeRef.current = null;
        activeGameplaySelectionRef.current = null;
        setIsClosingLogs(false);
        setIsThinkingStreamActive(false);
        setIsLoading(false);
        setTimeout(() => scrollToBottom("smooth", true), 60);
      }, closeDelayMs);
    }, THINKING_TOTAL_MS);

    return () => {
      clearTimeout(finishTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [isLoading, isThinkingStreamActive, activeThinkingSteps, activeRunMode, scrollToBottom]);

  const addAssistantReply = useCallback((mode: ModeId | "normal", startImmediately: boolean) => {
    const stepsForRun = getThinkingSteps(mode).map((step) => ({
      ...step,
      imageUrls: step.imageUrls ? [...step.imageUrls] : undefined,
    }));

    setActiveRunMode(mode);
    setActiveThinkingSteps(stepsForRun);
    setShouldAutoScroll(true);
    setVisibleSteps(0);
    setVisibleImageCount(0);
    setElapsedSeconds(0);
    setIsClosingLogs(false);
    setIsLoading(true);
    if (startImmediately) {
      thinkingStartRef.current = Date.now();
      setIsThinkingStreamActive(true);
    } else {
      setIsThinkingStreamActive(false);
    }
  }, []);

  const handleSend = useCallback((payload: PromptSendPayload) => {
    const trimmed = payload.message.trim();
    if (!trimmed) return;
    const mode = payload.mode ?? "normal";
    const initialCharacterSelection = mode === "story" ? null : payload.characterSelection ?? null;
    const initialVideoType: VideoGenerationType | null = null;
    const initialGameplaySelection: GameplaySelection | null = null;
    const shouldStartImmediately = mode !== "story" && mode !== "video";
    const userContent = mode === "story"
      ? formatStoryPromptWithCharacter(trimmed, initialCharacterSelection)
      : mode === "video"
        ? formatVideoPromptWithType(trimmed, initialVideoType, initialGameplaySelection)
      : trimmed;
    const userMessageId = Date.now().toString();

    setShouldAutoScroll(true);
    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: userContent,
        basePrompt: trimmed,
        timestamp: new Date(),
        mode,
        characterSelection: initialCharacterSelection,
        videoType: initialVideoType,
        gameplaySelection: initialGameplaySelection,
      },
    ]);
    if (mode === "story") {
      setActiveStoryMessageId(userMessageId);
      setActiveVideoMessageId(null);
      setActiveStoryCharacterId("");
      setActiveStoryCharacterSelection(null);
      setActiveVideoType(null);
      setActiveGameplaySelection(null);
      setPendingStoryCharacterId("");
      setPendingUseAiStoryCharacter(false);
      setPendingVideoType(null);
      setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
      setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
      setHasActiveStoryCharacterChoice(false);
      setHasActiveVideoTypeChoice(false);
      activeStoryCharacterSelectionRef.current = null;
      activeVideoTypeRef.current = null;
      activeGameplaySelectionRef.current = null;
    } else if (mode === "video") {
      setActiveStoryMessageId(null);
      setActiveVideoMessageId(userMessageId);
      setActiveStoryCharacterSelection(null);
      setActiveStoryCharacterId("");
      setActiveVideoType(null);
      setActiveGameplaySelection(null);
      setPendingStoryCharacterId("");
      setPendingUseAiStoryCharacter(false);
      setPendingVideoType(null);
      setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
      setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
      setHasActiveStoryCharacterChoice(false);
      setHasActiveVideoTypeChoice(false);
      activeStoryCharacterSelectionRef.current = null;
      activeVideoTypeRef.current = null;
      activeGameplaySelectionRef.current = null;
    } else {
      setActiveStoryMessageId(null);
      setActiveVideoMessageId(null);
      setActiveStoryCharacterSelection(null);
      setActiveStoryCharacterId("");
      setActiveVideoType(null);
      setActiveGameplaySelection(null);
      setPendingStoryCharacterId("");
      setPendingUseAiStoryCharacter(false);
      setPendingVideoType(null);
      setPendingGameplayCategory(DEFAULT_GAMEPLAY_CATEGORY);
      setPendingGameplayBackgroundId(DEFAULT_GAMEPLAY_BACKGROUND_ID);
      setHasActiveStoryCharacterChoice(false);
      setHasActiveVideoTypeChoice(false);
      activeStoryCharacterSelectionRef.current = null;
      activeVideoTypeRef.current = null;
      activeGameplaySelectionRef.current = null;
    }
    setTimeout(() => scrollToBottom("smooth", true), 60);
    addAssistantReply(mode, shouldStartImmediately);
  }, [scrollToBottom, addAssistantReply]);

  const isEmpty = messages.length === 0;
  const groups = groupMessages(messages);

  return (
    <div
      className={styles.page}
      style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
    >
      {isEmpty && <DreamNavbar />}
      {!isEmpty && (
        <Link href="/" className={styles.chatBackBtn}>
          <ArrowLeft size={12} />
          Back
        </Link>
      )}

      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
            className={styles.emptyRoot}
          >
            <motion.h1
              className={styles.heroTitle}
              variants={headingLineMotion}
              initial="hidden"
              animate="show"
              style={{ marginBottom: "14px" }}
            >
              {TITLE_WORDS.map((word, i) => (
                <motion.span
                  key={i}
                  className={styles.headingWord}
                  variants={headingWordMotion}
                  style={i >= 3 ? {
                    background: "linear-gradient(90deg, #e07843 0%, #c9a035 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  } : undefined}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              className={styles.heroCopy}
              variants={blockMotion}
              custom={0.30}
              initial="hidden"
              animate="show"
              style={{ marginBottom: "34px" }}
            >
              Type an idea and Dream AI turns it into a magical story for kids.
            </motion.p>

            <motion.div
              variants={blockMotion}
              custom={0.40}
              initial="hidden"
              animate="show"
              style={{ position: "relative", width: "100%", maxWidth: "680px" }}
            >
              <div style={{
                pointerEvents: "none", position: "absolute", bottom: "-48px", left: "50%",
                transform: "translateX(-50%)", width: "880px", height: "340px", borderRadius: "50%",
                background: "radial-gradient(ellipse at top, rgba(228,126,64,0.22) 0%, rgba(244,182,106,0.12) 44%, transparent 68%)",
                filter: "blur(36px)", zIndex: 0,
              }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <PromptInputBox
                  onSend={handleSend}
                  isLoading={isLoading}
                  placeholder="Ask Dream AI anything..."
                  mode={composerMode}
                  onModeChange={setComposerMode}
                />
              </div>
            </motion.div>
          </motion.div>

        ) : (

          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={styles.chatRoot}
          >
            <div className={styles.chatScroller} ref={scrollerRef}>
              <div className={styles.chatScrollInner}>

                {/* Message groups */}
                <AnimatePresence initial={false}>
                  {groups.map((group, gi) => (
                    <motion.div
                      key={`group-${gi}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, ease: easeOutExpo }}
                      className={`${styles.messageGroup} ${group.role === "user" ? styles.messageGroupUser : ""}`}
                    >
                      {group.role === "assistant" ? (
                        <div className={styles.aiAvatar}><Sparkles size={13} /></div>
                      ) : (
                        <div className={styles.userAvatar}><User size={12} /></div>
                      )}

                      <div className={`${styles.bubbleStack} ${group.role === "user" ? styles.bubbleStackUser : ""} ${group.role === "assistant" && group.messages.some(m => m.mode === "story") ? styles.bubbleStackStory : ""}`}>
                        {group.role === "user" && (
                          <div className={`${styles.senderLabel} ${styles.senderLabelUser}`}>You</div>
                        )}

                        {/* Thought summary — collapsed "Dreamed for Xs" above response */}
                        {group.role === "assistant" && group.messages[0].thinkingSteps && (
                          <div className={styles.thoughtSummaryWrap}>
                            <button
                              className={styles.thoughtSummary}
                              onClick={() => toggleThinking(group.messages[0].id)}
                            >
                              Dreamed for {group.messages[0].thinkingDuration}s
                              <ChevronRight
                                size={11}
                                className={expandedThinking.has(group.messages[0].id) ? styles.chevronOpen : styles.chevronClosed}
                              />
                            </button>

                            <AnimatePresence>
                              {expandedThinking.has(group.messages[0].id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: easeOutExpo }}
                                  style={{ overflow: "hidden" }}
                                >
                                  <div className={styles.thoughtLogPanel}>
                                    <p className={styles.thoughtLogTitle}>Dreaming</p>
                                    {group.messages[0].thinkingSteps.map((step, si) => {
                                      const isLast = si === group.messages[0].thinkingSteps!.length - 1;
                                      return (
                                        <div key={si} className={styles.thoughtLogStep}>
                                          <div className={styles.thoughtLogBulletCol}>
                                            <span className={styles.thoughtLogBullet} />
                                            {!isLast && <span className={styles.thoughtLogLine} />}
                                          </div>
                                          <div className={styles.thoughtLogStepContent}>
                                            <p className={styles.thoughtLogStepTitle}>{step.title}</p>
                                            <p className={styles.thoughtLogStepDetail}>{step.detail}</p>
                                            {step.imageUrls?.length ? (
                                              <div className={styles.thoughtLogImageGrid}>
                                                {step.imageUrls.map((imageUrl, imageIndex) => (
                                                  <div key={`${si}-${imageIndex}`} className={styles.thoughtLogImageCard}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={imageUrl} alt={`Generated visual ${imageIndex + 1}`} loading="lazy" />
                                                    <span className={styles.thoughtLogImageIndex}>{imageIndex + 1}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Bubbles */}
                        {group.messages.map((msg, mi) => {
                          const isFirst = mi === 0;
                          const isLast = mi === group.messages.length - 1;

                          // Story mode: embed the full story book + action row
                          if (msg.role === "assistant" && msg.mode === "story") {
                            return (
                              <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.52, ease: easeOutExpo }}
                                className={styles.storyResult}
                              >
                                {/* Full embedded story book */}
                                <div className={styles.storyResultBook}>
                                  <StoryBook
                                    title={MOCK_STORY.title}
                                    ageBand={MOCK_STORY.ageBand}
                                    pages={MOCK_STORY_PAGES}
                                    cover={MOCK_STORY.cover}
                                  />
                                </div>

                                {/* Extra actions */}
                                <div className={styles.storyResultActions}>
                                  <button type="button" className={styles.storyResultRegenerateBtn}>
                                    <RotateCw size={12} strokeWidth={2.5} className={styles.storyResultRegenerateIcon} />
                                    Regenerate
                                  </button>
                                  <button type="button" className={styles.storyResultActionBtn}>
                                    Share
                                  </button>
                                </div>
                              </motion.div>
                            );
                          }

                          return (
                            <div
                              key={msg.id}
                              className={`${styles.bubble} ${
                                msg.role === "assistant"
                                  ? `${styles.bubbleAi} ${isFirst ? styles.bubbleAiFirst : ""} ${isLast ? styles.bubbleAiLast : ""}`
                                  : `${styles.bubbleUser} ${isFirst ? styles.bubbleUserFirst : ""} ${isLast ? styles.bubbleUserLast : ""}`
                              }`}
                            >
                              {msg.content}
                            </div>
                          );
                        })}

                        <div className={`${styles.bubbleTime} ${group.role === "user" ? styles.bubbleTimeUser : ""}`}>
                          {group.messages[group.messages.length - 1].timestamp.toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Live dreaming panel */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: easeOutExpo }}
                      style={{ transformOrigin: "top center" }}
                      className={`${styles.dreamingCard} ${isClosingLogs ? styles.dreamingCardClosing : ""}`}
                    >
                      {/* Card header */}
                      <div className={styles.dreamingCardHeader}>
                        <motion.div
                          className={styles.dreamingCardAvatar}
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Sparkles size={11} />
                        </motion.div>
                        <span className={styles.dreamingCardTitle}>Dreaming</span>
                        <span className={styles.dreamingCardTimer}>
                          {(activeRunMode === "story" || activeRunMode === "video") && !isThinkingStreamActive
                            ? "waiting"
                            : `${elapsedSeconds}s`}
                        </span>
                      </div>

                      {/* Step list */}
                      <div className={styles.dreamingCardBody}>
                        {activeRunMode === "story" && (
                          <div className={styles.dreamingStep}>
                            <div className={styles.dreamingBulletCol}>
                              <span className={styles.dreamingBullet} />
                              <span className={styles.dreamingLine} />
                            </div>
                            <div className={styles.dreamingStepContent}>
                              <p className={styles.dreamingStepTitle}>Choosing character style</p>
                              <p className={styles.dreamingStepDetail}>
                                {hasActiveStoryCharacterChoice
                                  ? "Character locked. Continuing with story generation."
                                  : "Choose a character card, then continue. Thinking starts after confirmation."}
                              </p>
                              <div className={styles.dreamingCarouselWrapper}>
                                <button
                                  type="button"
                                  onClick={() => scrollCharacterCarousel(-1)}
                                  className={styles.dreamingCarouselArrow}
                                  aria-label="Scroll left"
                                  tabIndex={-1}
                                  disabled={isThinkingStreamActive || isClosingLogs}
                                >
                                  <ChevronLeft size={12} strokeWidth={2.5} />
                                </button>
                                <div className={styles.dreamingCharacterCarousel} ref={characterCarouselRef}>
                                {/* "Let AI Decide" card */}
                                {(() => {
                                  const aiActive = isThinkingStreamActive
                                    ? activeStoryCharacterSelection === null && hasActiveStoryCharacterChoice
                                    : pendingUseAiStoryCharacter;
                                  return (
                                    <button
                                      type="button"
                                      onClick={handlePickPendingAiChoice}
                                      className={`${styles.dreamingCharacterCard} ${styles.dreamingAiCard} ${
                                        aiActive ? styles.dreamingCharacterCardActive : ""
                                      }`}
                                      data-active={aiActive || undefined}
                                      aria-pressed={pendingUseAiStoryCharacter}
                                      disabled={isThinkingStreamActive || isClosingLogs}
                                    >
                                      <div className={styles.dreamingAiCardInner}>
                                        <Sparkles size={15} />
                                        <span>AI</span>
                                        <span>Picks</span>
                                      </div>
                                      {aiActive && (
                                        <span className={styles.dreamingCharacterCardCheck}>✓</span>
                                      )}
                                    </button>
                                  );
                                })()}

                                {STORY_CHARACTER_OPTIONS.map((char) => {
                                  const active = isThinkingStreamActive
                                    ? activeStoryCharacterSelection?.type === "existing" &&
                                      activeStoryCharacterId === char.id
                                    : pendingStoryCharacterId === char.id;
                                  return (
                                    <button
                                      key={char.id}
                                      type="button"
                                      onClick={() => handlePickPendingStoryCharacter(char.id)}
                                      className={`${styles.dreamingCharacterCard} ${
                                        active ? styles.dreamingCharacterCardActive : ""
                                      }`}
                                      data-active={active || undefined}
                                      aria-pressed={active}
                                      disabled={isThinkingStreamActive || isClosingLogs}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={char.avatar} alt={char.name} loading="lazy" />
                                      {active && (
                                        <span className={styles.dreamingCharacterCardCheck}>✓</span>
                                      )}
                                      <span className={styles.dreamingCharacterCardMeta}>
                                        <span className={styles.dreamingCharacterCardName}>{char.name}</span>
                                        <span className={styles.dreamingCharacterCardRole}>{char.role}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => scrollCharacterCarousel(1)}
                                  className={styles.dreamingCarouselArrow}
                                  aria-label="Scroll right"
                                  tabIndex={-1}
                                  disabled={isThinkingStreamActive || isClosingLogs}
                                >
                                  <ChevronRight size={12} strokeWidth={2.5} />
                                </button>
                              </div>
                              <div className={styles.dreamingCharacterActions}>
                                <button
                                  type="button"
                                  onClick={handleConfirmStoryCharacterChoice}
                                  className={styles.dreamingCharacterPrimaryButton}
                                  disabled={!hasPendingStoryChoice || isThinkingStreamActive || isClosingLogs}
                                >
                                  {pendingUseAiStoryCharacter
                                    ? "Continue with AI"
                                    : pendingStoryCharacter
                                      ? `Continue with ${pendingStoryCharacter.name}`
                                      : "Pick a character to continue"}
                                </button>
                                <Link
                                  href="/dashboard/characters/new-character"
                                  className={styles.dreamingCharacterSecondaryButton}
                                >
                                  + Create character
                                </Link>
                              </div>
                              <p className={styles.dreamingCharacterStatus}>
                                {!hasActiveStoryCharacterChoice
                                  ? pendingUseAiStoryCharacter
                                    ? "AI creativity selected — tap Continue."
                                    : pendingStoryCharacter
                                      ? `${pendingStoryCharacter.name} selected — tap Continue.`
                                      : "Scroll to pick a character, or let AI decide."
                                  : activeStoryCharacterSelection?.type === "existing" && activeStoryCharacter
                                    ? `${activeStoryCharacter.name} locked in.`
                                    : "AI creativity locked in."}
                              </p>
                            </div>
                          </div>
                        )}

                        {activeRunMode === "video" && (
                          <div className={styles.dreamingStep}>
                            <div className={styles.dreamingBulletCol}>
                              <span className={styles.dreamingBullet} />
                              <span className={styles.dreamingLine} />
                            </div>
                            <div className={styles.dreamingStepContent}>
                              <p className={styles.dreamingStepTitle}>Choosing video format</p>
                              <p className={styles.dreamingStepDetail}>
                                {hasActiveVideoTypeChoice
                                  ? "Video format locked. Continuing with rendering."
                                  : "Choose Normal or Gameplay, then continue. Thinking starts after confirmation."}
                              </p>
                              <div className={styles.dreamingVideoTypeGrid}>
                                {VIDEO_MODE_OPTIONS.map((option) => {
                                  const active = isThinkingStreamActive
                                    ? activeVideoType === option.value
                                    : pendingVideoType === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => handlePickPendingVideoType(option.value)}
                                      className={`${styles.dreamingVideoTypeCard} ${
                                        active ? styles.dreamingVideoTypeCardActive : ""
                                      }`}
                                      aria-pressed={active}
                                      disabled={isThinkingStreamActive || isClosingLogs}
                                    >
                                      <span className={styles.dreamingVideoTypeIcon}>
                                        {option.value === "gameplay" ? <Gamepad2 size={13} /> : <Clapperboard size={13} />}
                                      </span>
                                      <span className={styles.dreamingVideoTypeLabel}>{option.label}</span>
                                      <span className={styles.dreamingVideoTypeDetail}>{option.description}</span>
                                      <span className={styles.dreamingVideoTypeHelper}>
                                        {option.value === "gameplay" ? "Gameplay stack" : "Narrative stack"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              {(isThinkingStreamActive ? activeVideoType === "gameplay" : pendingVideoType === "gameplay") && (
                                <div className={styles.dreamingGameplayPicker}>
                                  <p className={styles.dreamingGameplayHeading}>Gameplay style</p>
                                  <div className={styles.dreamingGameplayCategoryRow}>
                                    {GAMEPLAY_CATEGORY_OPTIONS.map((category) => {
                                      const activeCategory = (isThinkingStreamActive
                                        ? activeGameplaySelection?.category
                                        : pendingGameplayCategory) === category.id;
                                      return (
                                        <button
                                          key={category.id}
                                          type="button"
                                          onClick={() => handlePickPendingGameplayCategory(category.id)}
                                          className={`${styles.dreamingGameplayCategoryPill} ${
                                            activeCategory ? styles.dreamingGameplayCategoryPillActive : ""
                                          }`}
                                          disabled={isThinkingStreamActive || isClosingLogs}
                                        >
                                          {category.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className={styles.dreamingGameplayGrid}>
                                    {GAMEPLAY_BACKGROUNDS[
                                      (isThinkingStreamActive ? activeGameplaySelection?.category : pendingGameplayCategory)
                                      ?? DEFAULT_GAMEPLAY_CATEGORY
                                    ].map((clip) => {
                                      const activeBackground = (isThinkingStreamActive
                                        ? activeGameplaySelection?.backgroundId
                                        : pendingGameplayBackgroundId) === clip.id;
                                      return (
                                        <button
                                          key={clip.id}
                                          type="button"
                                          title={clip.name}
                                          onClick={() => handlePickPendingGameplayBackground(clip.id)}
                                          className={`${styles.dreamingGameplayThumb} ${
                                            activeBackground ? styles.dreamingGameplayThumbActive : ""
                                          }`}
                                          disabled={isThinkingStreamActive || isClosingLogs}
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={clip.thumb} alt={clip.name} loading="lazy" />
                                          <span className={styles.dreamingGameplayThumbLabel}>{clip.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <p className={styles.dreamingGameplayHint}>
                                    Selected gameplay background:{" "}
                                    {(isThinkingStreamActive
                                      ? activeGameplaySelection?.backgroundName
                                      : pendingGameplayBackground?.name) ?? "Choose one"}
                                  </p>
                                </div>
                              )}
                              <div className={styles.dreamingCharacterActions}>
                                <button
                                  type="button"
                                  onClick={handleConfirmVideoTypeChoice}
                                  className={styles.dreamingCharacterPrimaryButton}
                                  disabled={!pendingVideoType || isThinkingStreamActive || isClosingLogs}
                                >
                                  {pendingVideoType === "gameplay" && pendingGameplayBackground
                                    ? `Continue with Gameplay • ${pendingGameplayBackground.name}`
                                    : pendingVideoTypeOption
                                      ? `Continue with ${pendingVideoTypeOption.label}`
                                    : "Select video format to continue"}
                                </button>
                              </div>
                              <p className={styles.dreamingCharacterStatus}>
                                {!hasActiveVideoTypeChoice
                                  ? pendingVideoTypeOption
                                    ? pendingVideoType === "gameplay" && pendingGameplayBackground
                                      ? `Ready with Gameplay • ${pendingGameplayBackground.name}. Tap continue.`
                                      : `Ready with ${pendingVideoTypeOption.label}. Tap continue.`
                                    : "Waiting for your video format selection."
                                  : activeVideoType === "gameplay"
                                    ? `Selected gameplay video mode${activeGameplaySelection ? ` (${activeGameplaySelection.backgroundName}).` : "."}`
                                    : "Selected normal video mode."}
                              </p>
                            </div>
                          </div>
                        )}

                        <AnimatePresence initial={false}>
                          {activeThinkingSteps.slice(0, visibleSteps).map((step, i) => {
                            const isLastVisible = i === visibleSteps - 1;
                            const hasMore = visibleSteps < activeThinkingSteps.length;
                            const showLine = !isLastVisible || hasMore;
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.32, ease: easeOutExpo }}
                                className={styles.dreamingStep}
                              >
                                <div className={styles.dreamingBulletCol}>
                                  <span className={styles.dreamingBullet} />
                                  {showLine && <span className={styles.dreamingLine} />}
                                </div>
                                <div className={styles.dreamingStepContent}>
                                  <p className={styles.dreamingStepTitle}>{step.title}</p>
                                  <p className={styles.dreamingStepDetail}>{step.detail}</p>
                                  {step.imageUrls?.length ? (
                                    <div className={styles.dreamingStepVisuals}>
                                      <div className={styles.dreamingImageGrid}>
                                        {step.imageUrls.slice(0, visibleImageCount).map((imageUrl, imageIndex) => (
                                          <motion.div
                                            key={`${i}-${imageIndex}`}
                                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.22, ease: easeOutExpo }}
                                            className={styles.dreamingImageCard}
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={imageUrl} alt={`Generated visual ${imageIndex + 1}`} loading="lazy" />
                                            <span className={styles.dreamingImageIndex}>{imageIndex + 1}</span>
                                          </motion.div>
                                        ))}
                                      </div>
                                      {!isClosingLogs && visibleImageCount < step.imageUrls.length && (
                                        <p className={styles.dreamingImageProgress}>
                                          Rendering visuals {visibleImageCount}/{step.imageUrls.length}
                                        </p>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {/* Spinner aligned under bullets */}
                        {!isClosingLogs && isThinkingStreamActive && (
                          <div className={styles.dreamingSpinnerRow}>
                            <div className={styles.dreamingSpinnerIndent}>
                              <span className={styles.dreamingSpinner} />
                            </div>
                            {visibleSteps >= activeThinkingSteps.length && (
                              <span className={styles.dreamingFinalizingText}>
                                {activeRunMode === "story"
                                  ? "Finalizing the story..."
                                  : activeRunMode === "video"
                                    ? "Finalizing the video..."
                                    : "Finalizing the response..."}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={bottomRef} style={{ height: isLoading ? 72 : 12 }} />
              </div>
            </div>

            {/* Input footer */}
            <div className={styles.inputFooter}>
              <div className={styles.inputGlow} />
              <div className={styles.inputInner}>
                <PromptInputBox
                  onSend={handleSend}
                  isLoading={isLoading}
                  placeholder="Continue the story..."
                  mode={composerMode}
                  onModeChange={setComposerMode}
                />
                <p className={styles.inputDisclaimer}>
                  Dream AI stories are fictional and made for kids.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
