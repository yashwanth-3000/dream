"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import Image from "next/image";

import { cn } from "@/lib/utils";

interface AnimatedMarqueeHeroProps {
  tagline?: string;
  title: React.ReactNode;
  description: string;
  ctaText: string;
  ctaHref?: string;
  images: string[];
  className?: string;
  scrollToId?: string;
  sectionId?: string;
}

const ActionButton = ({ children, href }: { children: React.ReactNode; href?: string }) =>
  href ? (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="mt-8 inline-block">
      <Link
        href={href}
        className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-lg transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {children}
      </Link>
    </motion.div>
  ) : (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="mt-8 rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-lg transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {children}
    </motion.button>
  );

export const AnimatedMarqueeHero: React.FC<AnimatedMarqueeHeroProps> = ({
  tagline,
  title,
  description,
  ctaText,
  ctaHref,
  images,
  className,
  scrollToId,
  sectionId,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const isAutoScrollingRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const scrollUnlockTimeoutRef = useRef<number | null>(null);

  const FADE_IN_ANIMATION_VARIANTS: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 72, damping: 24 },
    },
  };

  const duplicatedImages = [...images, ...images];

  useEffect(() => {
    if (!scrollToId) return;
    const section = sectionRef.current;
    if (!section) return;
    const SCROLL_LOCK_MS = 720;
    const WHEEL_THRESHOLD = 20;
    const TOUCH_THRESHOLD = 24;

    const getScrollContainer = () => {
      return section.closest("main") as HTMLElement | null;
    };

    const lockScrolling = () => {
      isAutoScrollingRef.current = true;
      if (scrollUnlockTimeoutRef.current !== null) {
        window.clearTimeout(scrollUnlockTimeoutRef.current);
      }
      scrollUnlockTimeoutRef.current = window.setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, SCROLL_LOCK_MS);
    };

    const scrollToNextSection = () => {
      if (isAutoScrollingRef.current) return;
      const target = document.getElementById(scrollToId);
      if (!target) return;

      const container = getScrollContainer();
      if (!container) {
        lockScrolling();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      // Only auto-jump when the hero is the active section.
      if (container.scrollTop > 12) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTop = targetRect.top - containerRect.top + container.scrollTop;

      lockScrolling();
      container.scrollTo({ top: targetTop, behavior: "smooth" });
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY <= WHEEL_THRESHOLD) return;
      if (isAutoScrollingRef.current) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      scrollToNextSection();
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
      const deltaY = touchStartYRef.current - currentY;
      if (deltaY <= TOUCH_THRESHOLD) return;
      event.preventDefault();
      touchStartYRef.current = null;
      scrollToNextSection();
    };

    section.addEventListener("wheel", handleWheel, { passive: false });
    section.addEventListener("touchstart", handleTouchStart, { passive: true });
    section.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      section.removeEventListener("wheel", handleWheel);
      section.removeEventListener("touchstart", handleTouchStart);
      section.removeEventListener("touchmove", handleTouchMove);
      if (scrollUnlockTimeoutRef.current !== null) {
        window.clearTimeout(scrollUnlockTimeoutRef.current);
      }
    };
  }, [scrollToId]);

  return (
    <section
      id={sectionId}
      ref={sectionRef}
      className={cn(
        "relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#fff4df_0%,#fff9ef_45%,#eef6ff_100%)] px-4 text-center dark:bg-[linear-gradient(180deg,#0f131a_0%,#141925_45%,#101827_100%)]",
        className
      )}
    >
      <div className="z-10 flex -translate-y-20 flex-col items-center md:-translate-y-28">
        {tagline?.trim() ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={FADE_IN_ANIMATION_VARIANTS}
            className="mb-4 inline-block rounded-full border border-primary/25 bg-white/80 px-4 py-1.5 text-sm font-medium text-foreground backdrop-blur-sm dark:border-white/12 dark:bg-white/8 dark:text-white/90"
          >
            {tagline}
          </motion.div>
        ) : null}

        <motion.h1
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: 0.14,
              },
            },
          }}
          className="text-5xl font-bold tracking-tighter text-foreground md:text-7xl"
        >
          {typeof title === "string"
            ? title.split(" ").map((word, i) => (
                <motion.span
                  key={i}
                  variants={FADE_IN_ANIMATION_VARIANTS}
                  className="inline-block"
                >
                  {word}&nbsp;
                </motion.span>
              ))
            : title}
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="show"
          variants={FADE_IN_ANIMATION_VARIANTS}
          transition={{ delay: 0.5 }}
          className="mt-6 max-w-xl text-lg text-foreground/80"
        >
          {description}
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={FADE_IN_ANIMATION_VARIANTS}
          transition={{ delay: 0.6 }}
        >
          <ActionButton href={ctaHref}>{ctaText}</ActionButton>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 h-1/3 w-full [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] md:h-2/5">
        <motion.div
          className="flex gap-4"
          animate={{
            x: ["-100%", "0%"],
            transition: {
              ease: "linear",
              duration: 58,
              repeat: Infinity,
            },
          }}
        >
          {duplicatedImages.map((src, index) => (
            <div
              key={index}
              className="relative aspect-[3/4] h-48 shrink-0 md:h-64"
              style={{
                rotate: `${index % 2 === 0 ? -2 : 5}deg`,
              }}
            >
              <Image
                src={src}
                alt={`Showcase image ${index + 1}`}
                fill
                unoptimized
                sizes="(max-width: 768px) 192px, 256px"
                className="h-full w-full rounded-2xl object-cover shadow-md"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
