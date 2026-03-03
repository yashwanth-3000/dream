import Link from "next/link";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import styles from "./dashboard.module.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.dashRoot} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto w-full max-w-7xl space-y-4">

        {/* ── Header ── */}
        <header
          className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between"
          style={{ borderBottom: "1px solid #dbc9b7" }}
        >
          <div className="space-y-1">
            <p style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#9a7a65",
            }}>
              Dream Studio
            </p>
            <h1 className={`${styles.halant} text-2xl md:text-3xl`}>
              Creator Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className={`${styles.btnOutline} px-4 py-2 text-xs md:text-sm`}
            >
              Back Home
            </Link>
            <Link
              href="/chat"
              className={`${styles.btnInk} px-4 py-2 text-xs md:text-sm`}
            >
              Open Chat
            </Link>
          </div>
        </header>

        {/* ── Nav ── */}
        <div>
          <DashboardNav />
        </div>

        {/* ── Page content ── */}
        <div>{children}</div>

      </div>
    </div>
  );
}
