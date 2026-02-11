"use client";

import type { WheelEvent } from "react";

import InfiniteGallery from "@/components/ui/3d-gallery-photography";
import { ArrowUp } from "lucide-react";

export default function GalleryDemo() {
  const scrollToTop = () => {
    const container = document.querySelector("main");
    if (container instanceof HTMLElement) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sampleImages = [
    {
      src: "https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Mountain landscape",
    },
    {
      src: "https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Ocean waves",
    },
    {
      src: "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Forest path",
    },
    {
      src: "https://images.pexels.com/photos/1591373/pexels-photo-1591373.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Desert dunes",
    },
    {
      src: "https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "City skyline",
    },
    {
      src: "https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Northern lights",
    },
    {
      src: "https://images.pexels.com/photos/1624496/pexels-photo-1624496.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Waterfall",
    },
    {
      src: "https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Sunset beach",
    },
  ];

  const handleSectionWheelCapture = (event: WheelEvent<HTMLElement>) => {
    if (event.deltaY >= -16) return;

    const container = document.querySelector("main");
    if (!(container instanceof HTMLElement)) return;

    const sectionRect = event.currentTarget.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const sectionTop = sectionRect.top - containerRect.top + container.scrollTop;

    if (container.scrollTop < sectionTop - 4) return;

    event.stopPropagation();
    container.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section
      id="dream-studio-section"
      onWheelCapture={handleSectionWheelCapture}
      className="relative h-screen w-full shrink-0 overflow-hidden"
    >
      <InfiniteGallery
        images={sampleImages}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-screen w-full overflow-hidden"
      />
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center px-3 mix-blend-exclusion text-white">
        <h1 className="font-serif text-4xl tracking-tight md:text-7xl">
          <span className="italic">Dream big.</span> Build magical stories and videos.
        </h1>
      </div>

      <div className="pointer-events-none absolute bottom-10 left-0 right-0 z-10 text-center font-mono text-[11px] font-semibold uppercase text-white mix-blend-exclusion">
        <p>Use mouse wheel, arrow keys, or touch to navigate</p>
        <p className="opacity-60">Auto-play resumes after 3 seconds of inactivity</p>
      </div>

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Go to top"
        className="absolute left-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-md backdrop-blur transition hover:scale-105 hover:bg-white"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </section>
  );
}
