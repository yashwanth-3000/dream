import { notFound } from "next/navigation";

import { StoryBook } from "@/components/dashboard/story-book";
import { getDashboardStoryById, getDashboardStoryPages } from "@/lib/dashboard-data";

export default async function StoryViewerPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const story = getDashboardStoryById(id);
  const pages = getDashboardStoryPages(id);

  if (!story || pages.length === 0) notFound();

  return (
    <StoryBook
      title={story.title}
      ageBand={story.ageBand}
      pages={pages}
      cover={story.cover}
    />
  );
}
