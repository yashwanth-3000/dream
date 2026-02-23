"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
          className="text-[13px] font-semibold tracking-[-0.02em] text-[#f6efe8] transition-opacity duration-200 hover:opacity-80"
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
        </div>
      </nav>
    </header>
  );
}
