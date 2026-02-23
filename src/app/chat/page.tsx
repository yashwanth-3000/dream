"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Bot, User } from "lucide-react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

import styles from "./chat-page.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface MessageGroup {
  role: "user" | "assistant";
  messages: Message[];
}


const TITLE_WORDS = ["What", "shall", "we", "dream", "up?"];

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

const blockMotion = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
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

/** Group consecutive same-role messages */
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 8);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const addAssistantReply = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "What a wonderful idea! Let me weave a magical story around that — filled with wonder, friendship, and adventure that kids will absolutely love. Give me just a moment to craft something special for you...",
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
      setTimeout(scrollToBottom, 60);
    }, 1400);
  }, [scrollToBottom]);

  const handleSend = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: trimmed, timestamp: new Date() },
    ]);
    setTimeout(scrollToBottom, 60);
    addAssistantReply();
  }, [scrollToBottom, addAssistantReply]);

  const isEmpty = messages.length === 0;
  const groups = groupMessages(messages);

  return (
    <div
      className={styles.page}
      style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
    >
      {/* ── Header ── */}
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={12} />
          Back
        </Link>

        <div className={styles.headerCenter}>
          <div className={styles.headerLogo}>
            <Sparkles size={11} color="#7a3e1a" />
          </div>
          <span className={styles.headerTitle}>Dream AI</span>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.modelBadge}>Story mode</span>
        </div>
      </header>

      {/* ── Body ── */}
      <AnimatePresence mode="wait">

        {isEmpty ? (
          /* ── Empty / landing state ── */
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
            className={styles.emptyRoot}
          >
            {/* Animated heading */}
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

            {/* Subtext */}
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

            {/* Prompt bar + glow */}
            <motion.div
              variants={blockMotion}
              custom={0.40}
              initial="hidden"
              animate="show"
              style={{ position: "relative", width: "100%", maxWidth: "680px" }}
            >
              {/* Glow */}
              <div style={{
                pointerEvents: "none",
                position: "absolute",
                bottom: "-48px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "880px",
                height: "340px",
                borderRadius: "50%",
                background: "radial-gradient(ellipse at top, rgba(228,126,64,0.22) 0%, rgba(244,182,106,0.12) 44%, transparent 68%)",
                filter: "blur(36px)",
                zIndex: 0,
              }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <PromptInputBox onSend={handleSend} isLoading={isLoading} placeholder="Ask Dream AI anything..." />
              </div>
            </motion.div>

          </motion.div>

        ) : (

          /* ── Chat state ── */
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={styles.chatRoot}
          >
            {/* Scrollable message list */}
            <div className={styles.chatScroller} ref={scrollerRef}>
              <div className={styles.chatScrollInner}>

                {/* Session start pill */}
                <div className={styles.sessionDivider}>Story started</div>

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
                      {/* Avatar — shown once per group, aligned to bottom */}
                      {group.role === "assistant" ? (
                        <div className={styles.aiAvatar}>
                          <Sparkles size={13} />
                        </div>
                      ) : (
                        <div className={styles.userAvatar}>
                          <User size={12} />
                        </div>
                      )}

                      {/* Bubble stack */}
                      <div className={`${styles.bubbleStack} ${group.role === "user" ? styles.bubbleStackUser : ""}`}>
                        {/* Sender label */}
                        <div className={`${styles.senderLabel} ${group.role === "user" ? styles.senderLabelUser : ""}`}>
                          {group.role === "assistant" ? "Dream AI" : "You"}
                        </div>

                        {group.messages.map((msg, mi) => {
                          const isFirst = mi === 0;
                          const isLast = mi === group.messages.length - 1;
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

                        {/* Timestamp below last bubble */}
                        <div className={`${styles.bubbleTime} ${group.role === "user" ? styles.bubbleTimeUser : ""}`}>
                          {group.messages[group.messages.length - 1].timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing indicator */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.28, ease: easeOutExpo }}
                      className={styles.messageGroup}
                    >
                      <div className={styles.aiAvatar}>
                        <Sparkles size={13} />
                      </div>
                      <div className={styles.bubbleStack}>
                        <div className={styles.senderLabel}>Dream AI</div>
                        <div className={styles.typingBubble}>
                          <span className={styles.typingDot} />
                          <span className={styles.typingDot} />
                          <span className={styles.typingDot} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={bottomRef} style={{ height: 8 }} />
              </div>
            </div>

            {/* Input footer */}
            <div className={styles.inputFooter}>
              <div className={styles.inputGlow} />
              <div className={styles.inputInner}>
                <PromptInputBox onSend={handleSend} isLoading={isLoading} placeholder="Continue the story..." />
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
