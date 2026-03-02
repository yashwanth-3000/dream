"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Chat", href: "/chat" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "About", href: "/about" },
] as const;

type DreamNavbarProps = {
  collapsed?: boolean;
  collapsedAlign?: "center" | "right";
};

export default function DreamNavbar({ collapsed = false, collapsedAlign = "center" }: DreamNavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsedRight = collapsedAlign === "right";

  if (collapsed) {
    return (
      <header className={collapsedRight ? "pointer-events-none fixed right-4 top-4 z-50" : "pointer-events-none fixed inset-x-0 top-4 z-50 px-4"}>
        <div className={collapsedRight ? "relative flex flex-col items-end" : "flex flex-col items-center"}>
          {collapsedRight ? (
            <button
              id="dream-nav"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[rgb(103_99_97_/_0.92)] text-[#f2e7dc] shadow-[0_18px_36px_-22px_rgba(22,18,14,0.72)] backdrop-blur-md transition-colors hover:bg-[rgb(103_99_97_/_0.98)]"
              aria-label={menuOpen ? "Collapse navigation menu" : "Expand navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="dream-nav-collapsed-menu"
            >
              {menuOpen ? <X size={14} /> : <Menu size={14} />}
            </button>
          ) : (
            <nav
              id="dream-nav"
              className="pointer-events-auto flex w-[300px] max-w-[calc(100vw-2rem)] items-center justify-between rounded-[28px] border border-white/20 px-4 py-2 shadow-[0_18px_36px_-22px_rgba(22,18,14,0.72)] backdrop-blur-md"
              style={{ backgroundColor: "rgb(103 99 97 / 0.92)" }}
            >
              <Link
                href="/"
                className="text-[18px] text-[#f6efe8] transition-opacity duration-200 hover:opacity-80"
                style={{ fontFamily: "var(--font-halant)", fontWeight: 400, letterSpacing: "-0.04em" }}
              >
                Dream
              </Link>

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 p-2 text-[#f2e7dc] transition-colors hover:bg-white/10"
                aria-label={menuOpen ? "Collapse navigation menu" : "Expand navigation menu"}
                aria-expanded={menuOpen}
                aria-controls="dream-nav-collapsed-menu"
              >
                {menuOpen ? <X size={14} /> : <Menu size={14} />}
              </button>
            </nav>
          )}

          {menuOpen && (
            <div
              id="dream-nav-collapsed-menu"
              className={collapsedRight
                ? "pointer-events-auto absolute right-0 top-[calc(100%+8px)] flex w-[220px] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl border border-white/20 p-2 shadow-[0_18px_36px_-22px_rgba(22,18,14,0.72)] backdrop-blur-md"
                : "pointer-events-auto mt-2 flex w-[300px] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl border border-white/20 p-2 shadow-[0_18px_36px_-22px_rgba(22,18,14,0.72)] backdrop-blur-md"}
              style={{ backgroundColor: "rgb(103 99 97 / 0.95)" }}
            >
              {collapsedRight && (
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-[16px] text-[#f6efe8] transition-all duration-200 hover:bg-white/10"
                  style={{ fontFamily: "var(--font-halant)", fontWeight: 400, letterSpacing: "-0.03em" }}
                >
                  Dream
                </Link>
              )}
              {NAV_LINKS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-200 ${
                      active
                        ? "bg-white/18 text-[#f6efe8]"
                        : "text-[#c4b5a8] hover:bg-white/10 hover:text-[#f2e7dc]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <a
                href="https://github.com/yashwanth-3000/Dream"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="mt-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c4b5a8] transition-all duration-200 hover:bg-white/10 hover:text-[#f2e7dc]"
                aria-label="GitHub"
              >
                <Github size={12} />
                GitHub
              </a>
            </div>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 px-4">
      <nav
        id="dream-nav"
        className="pointer-events-auto mx-auto flex w-full max-w-[780px] items-center justify-between rounded-[28px] border border-white/20 px-4 py-2 shadow-[0_18px_36px_-22px_rgba(22,18,14,0.72)] backdrop-blur-md"
        style={{ backgroundColor: "rgb(103 99 97 / 0.92)" }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="text-[18px] text-[#f6efe8] transition-opacity duration-200 hover:opacity-80"
          style={{ fontFamily: "var(--font-halant)", fontWeight: 400, letterSpacing: "-0.04em" }}
        >
          Dream
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 ${
                  active
                    ? "bg-white/18 text-[#f6efe8]"
                    : "text-[#c4b5a8] hover:text-[#f2e7dc]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Divider */}
          <span className="mx-1 h-3.5 w-px bg-white/20" />

          {/* GitHub */}
          <a
            href="https://github.com/yashwanth-3000/Dream"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-full p-1.5 text-[#c4b5a8] transition-all duration-200 hover:text-[#f2e7dc]"
            aria-label="GitHub"
          >
            <Github size={14} />
          </a>
        </div>
      </nav>
    </header>
  );
}
