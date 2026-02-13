"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Sparkles,
  Briefcase,
  BookOpenText,
  Film,
  Users,
  Settings,
  Sun,
  Moon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const dashboardLinks = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Create", href: "/dashboard/create", icon: Sparkles },
  { label: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
  { label: "Stories", href: "/dashboard/stories", icon: BookOpenText },
  { label: "Videos", href: "/dashboard/videos", icon: Film },
  { label: "Characters", href: "/dashboard/characters", icon: Users },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const spring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 35,
  mass: 0.5,
};

export function DashboardNav() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = {
      isDown: true,
      startX: e.clientX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
    };
    setIsDragging(false);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDown) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.clientX - el.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.5;
    el.scrollLeft = dragState.current.scrollLeft - walk;
    if (Math.abs(walk) > 3) setIsDragging(true);
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current.isDown = false;
    // Small delay so the click handler on links can check isDragging
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) e.preventDefault();
    },
    [isDragging]
  );

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <nav
        className={cn(
          "inline-flex min-w-max items-center gap-0.5 p-1 animate-fade-soft select-none",
          // Pop-out glassmorphic tray
          "rounded-2xl border border-border/60",
          "bg-white/90 backdrop-blur-xl",
          "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.10),0_1px_4px_-1px_rgba(0,0,0,0.06)]",
          // Dark theme
          "dark:bg-[#0b0b0b]/95 dark:border-white/[0.10]",
          "dark:shadow-[0_10px_35px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.04)]"
        )}
      >
        {dashboardLinks.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href));
          const Icon = link.icon;

          return (
            <motion.div
              key={link.href}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href={link.href}
                draggable={false}
                onClick={handleLinkClick}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition micro-btn",
                  active
                    ? "text-foreground dark:text-white"
                    : "text-muted-foreground hover:text-foreground dark:text-white/50 dark:hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="dashboard-pill"
                    className={cn(
                      "absolute inset-0 rounded-xl border border-border/60",
                      "bg-white shadow-sm",
                      "dark:bg-[#1a1a1a] dark:border-white/[0.12] dark:shadow-[0_0_10px_-3px_rgba(255,255,255,0.05)]"
                    )}
                    transition={spring}
                  />
                )}
                <Icon className="relative z-10 size-4 shrink-0" />
                <span className="relative z-10 hidden sm:inline">
                  {link.label}
                </span>
              </Link>
            </motion.div>
          );
        })}

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-border/60 dark:bg-white/10" />

        {/* Theme toggle */}
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn(
            "relative flex items-center justify-center rounded-xl p-2 transition micro-btn",
            "text-muted-foreground hover:text-foreground",
            "dark:text-white/50 dark:hover:text-white"
          )}
          aria-label="Toggle theme"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </motion.button>
      </nav>
    </div>
  );
}
