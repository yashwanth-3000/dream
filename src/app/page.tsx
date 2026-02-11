import AnimatedHeroDemo from "@/components/ui/demo";
import DreamNavbar from "@/components/ui/dream-navbar";
import GalleryDemo from "@/components/ui/gallery-demo";

export default function Home() {
  return (
    <>
      <DreamNavbar />
      <main className="h-screen overflow-x-hidden overflow-y-auto scroll-smooth">
        <AnimatedHeroDemo />
        <GalleryDemo />
      </main>
    </>
  );
}
