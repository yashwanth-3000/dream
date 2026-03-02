"use client";

import { AnimatedMarqueeHero } from "@/components/ui/hero-3";

const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=900&auto=format&fit=crop&q=60",
];

const AnimatedHeroDemo = () => {
  return (
    <AnimatedMarqueeHero
      title={
        <>
          Turn Dream Characters
          <br />
          into Real Story Worlds
        </>
      }
      description="Type one idea and Dream builds kid-safe storybook adventures, parent quiz prompts, and read-aloud moments your child can revisit anytime."
      ctaText="Create with Dream"
      ctaHref="/chat"
      images={DEMO_IMAGES}
      className="shrink-0"
      sectionId="home-section"
      scrollToId="dream-studio-section"
    />
  );
};

export default AnimatedHeroDemo;
