"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Sparkles,
  Briefcase,
  BookOpenText,
  Film,
  Users,
  Settings,
  FlaskConical,
} from "lucide-react";

import { cn } from "@/lib/utils";

const dashboardLinks = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Create", href: "/dashboard/create", icon: Sparkles },
  { label: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
  { label: "Stories", href: "/dashboard/stories", icon: BookOpenText },
  { label: "Videos", href: "/dashboard/videos", icon: Film },
  { label: "Characters", href: "/dashboard/characters", icon: Users },
  { label: "API Test", href: "/dashboard/api-test", icon: FlaskConical },
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
      className="overflow-x-auto cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <nav
        className="inline-flex min-w-max items-center gap-0.5 p-1 select-none rounded-2xl"
        style={{
          background: "rgb(246 240 233 / 0.95)",
          border: "1px solid #dbc9b7",
          boxShadow: "0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.04)",
          backdropFilter: "blur(12px)",
        }}
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
                  "relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition",
                  active ? "text-[#2b180a]" : "text-[#9a7a65] hover:text-[#2b180a]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="dashboard-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "#fdf8f3",
                      border: "1px solid #dbc9b7",
                      boxShadow: "0 1px 4px -1px rgba(0,0,0,0.08)",
                    }}
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
      </nav>
    </div>
  );
}
