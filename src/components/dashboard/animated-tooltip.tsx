/* eslint-disable @next/next/no-img-element */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface AnimatedTooltipProps {
  items: Array<{
    id: number;
    name: string;
    image: string;
  }>;
}

export function AnimatedTooltip({ items }: AnimatedTooltipProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flex -space-x-2">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="relative"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <img
            src={item.image}
            alt={item.name}
            className={cn(
              "size-8 rounded-full border-2 border-white object-cover shadow-sm transition-all duration-200",
              hoveredIndex === idx ? "z-20 scale-110" : "z-10"
            )}
          />
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="absolute -top-11 left-1/2 z-50 -translate-x-1/2"
              >
                <div className="relative whitespace-nowrap rounded-lg border border-border/70 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-md backdrop-blur dark:bg-[#171717]/95 dark:border-white/10">
                  {item.name}
                  <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border/70 bg-white dark:bg-[#171717] dark:border-white/10" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
