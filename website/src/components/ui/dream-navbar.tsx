"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github } from "lucide-react";

const NAV_LINKS = [
  { label: "Chat", href: "/chat" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "About", href: "/about" },
] as const;

export default function DreamNavbar() {
  const pathname = usePathname();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 px-4">
      <nav
        id="dream-nav"
        className="pointer-events-auto mx-auto flex w-full max-w-[640px] items-center justify-between rounded-[28px] border border-white/20 px-4 py-2 shadow-[0_18px_36px_-22px_rgba(22,18,14,0.72)] backdrop-blur-md"
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
