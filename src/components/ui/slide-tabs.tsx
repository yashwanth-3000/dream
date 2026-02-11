"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type CursorPosition = {
  left: number;
  width: number;
  opacity: number;
};

type TabItem = {
  label: string;
  value: string;
};

const DEFAULT_TAB_ITEMS: TabItem[] = [
  { label: "Home", value: "home" },
  { label: "Pricing", value: "pricing" },
  { label: "Features", value: "features" },
  { label: "Docs", value: "docs" },
  { label: "Blog", value: "blog" },
];

type SlideTabsProps = {
  tabs?: TabItem[];
  initialValue?: string;
  onTabChange?: (value: string) => void;
  className?: string;
};

export const SlideTabs = ({
  tabs = DEFAULT_TAB_ITEMS,
  initialValue,
  onTabChange,
  className,
}: SlideTabsProps) => {
  const [position, setPosition] = useState<CursorPosition>({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const [selected, setSelected] = useState(() => {
    if (!initialValue) return 0;
    const index = tabs.findIndex((tab) => tab.value === initialValue);
    return index >= 0 ? index : 0;
  });
  const tabsRef = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const selectedTab = tabsRef.current[selected];
    if (!selectedTab) return;

    const { width } = selectedTab.getBoundingClientRect();
    setPosition({
      left: selectedTab.offsetLeft,
      width,
      opacity: 1,
    });
  }, [selected]);

  const resetToSelected = () => {
    const selectedTab = tabsRef.current[selected];
    if (!selectedTab) return;

    const { width } = selectedTab.getBoundingClientRect();
    setPosition({
      left: selectedTab.offsetLeft,
      width,
      opacity: 1,
    });
  };

  return (
    <ul
      onMouseLeave={resetToSelected}
      className={cn(
        "relative flex w-fit items-end gap-5",
        className
      )}
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab.value}
          ref={(el) => {
            tabsRef.current[i] = el;
          }}
          setPosition={setPosition}
          onClick={() => {
            setSelected(i);
            onTabChange?.(tab.value);
          }}
        >
          {tab.label}
        </Tab>
      ))}

      <Cursor position={position} />
    </ul>
  );
};

type TabProps = {
  children: React.ReactNode;
  setPosition: React.Dispatch<React.SetStateAction<CursorPosition>>;
  onClick: () => void;
};

const Tab = React.forwardRef<HTMLLIElement, TabProps>(
  ({ children, setPosition, onClick }, ref) => {
    const localRef = useRef<HTMLLIElement | null>(null);

    const setRefs = (node: HTMLLIElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <li
        ref={setRefs}
        onClick={onClick}
        onMouseEnter={() => {
          const tabNode = localRef.current;
          if (!tabNode) return;

          const { width } = tabNode.getBoundingClientRect();
          setPosition({
            left: tabNode.offsetLeft,
            width,
            opacity: 1,
          });
        }}
        className="relative z-10 block cursor-pointer py-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70 transition-colors hover:text-foreground md:text-sm"
      >
        {children}
      </li>
    );
  }
);

Tab.displayName = "Tab";

const Cursor = ({ position }: { position: CursorPosition }) => {
  return (
    <motion.li
      animate={{ ...position }}
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.7 }}
      className="absolute bottom-0 z-0 h-[2px] bg-foreground"
    />
  );
};
