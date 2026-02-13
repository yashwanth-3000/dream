export type JobStatus = "processing" | "completed" | "failed";

export type JobLog = {
  ts: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  data?: unknown;
};

export type Job = {
  id: string;
  productId: string;
  productName: string;
  status: JobStatus;
  createdAt: string;
  triggeredBy: "Agent" | "User";
  files?: string[];
  videoUrl?: string;
  variants?: string[];
  engine?: string;
};

export const dashboardJobs: Job[] = [
  {
    id: "job_dream_001",
    productId: "story_001",
    productName: "Luna and the Floating Library",
    status: "processing",
    createdAt: "2026-02-11T10:22:00.000Z",
    triggeredBy: "User",
    variants: ["Story", "Video"],
    engine: "Dream Narrative v2",
    files: [
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1491841651911-c44c30c34548?w=700&auto=format&fit=crop&q=70",
    ],
    videoUrl: "https://cdn.coverr.co/videos/coverr-tree-light-1579/1080p.mp4",
  },
  {
    id: "job_dream_002",
    productId: "story_002",
    productName: "Captain Comet Saves Sunflower Town",
    status: "completed",
    createdAt: "2026-02-11T09:58:00.000Z",
    triggeredBy: "Agent",
    variants: ["Story", "Scenes"],
    engine: "Dream Vision 3",
    files: [
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=700&auto=format&fit=crop&q=70",
    ],
    videoUrl: "https://cdn.coverr.co/videos/coverr-clouds-over-hills-1573/1080p.mp4",
  },
  {
    id: "job_dream_003",
    productId: "video_003",
    productName: "The Tiny Dragon Baking Show",
    status: "failed",
    createdAt: "2026-02-11T08:48:00.000Z",
    triggeredBy: "User",
    variants: ["Video"],
    engine: "Dream Motion Lite",
    files: [],
  },
  {
    id: "job_dream_004",
    productId: "video_004",
    productName: "Niko's Jungle Treasure Map",
    status: "completed",
    createdAt: "2026-02-10T19:11:00.000Z",
    triggeredBy: "Agent",
    variants: ["Story", "Video", "Remix"],
    engine: "Dream Vision 3",
    files: [
      "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=700&auto=format&fit=crop&q=70",
    ],
    videoUrl: "https://cdn.coverr.co/videos/coverr-flying-over-forest-1574/1080p.mp4",
  },
  {
    id: "job_dream_005",
    productId: "story_005",
    productName: "Zara and the Moonlight Train",
    status: "processing",
    createdAt: "2026-02-11T10:30:00.000Z",
    triggeredBy: "User",
    variants: ["Story", "Voice"],
    engine: "Dream Narrative v2",
    files: [
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=700&auto=format&fit=crop&q=70",
      "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=700&auto=format&fit=crop&q=70",
    ],
  },
];

export const dashboardJobLogs: Record<string, JobLog[]> = {
  job_dream_001: [
    { ts: "10:22:03", level: "success", message: "Prompt built from kid-safe template." },
    { ts: "10:22:09", level: "info", message: "Scene cards generated (3/4)." },
    { ts: "10:22:16", level: "info", message: "Narration timing pass running." },
  ],
  job_dream_002: [
    { ts: "09:58:10", level: "success", message: "Prompt generated." },
    { ts: "09:58:23", level: "success", message: "Scene images generated (4/4)." },
    { ts: "09:58:42", level: "success", message: "Video clip rendered successfully." },
    { ts: "09:58:50", level: "success", message: "Job completed." },
  ],
  job_dream_003: [
    { ts: "08:48:10", level: "success", message: "Prompt generated." },
    { ts: "08:48:18", level: "warning", message: "Low confidence in scene consistency." },
    { ts: "08:48:21", level: "error", message: "Video render failed. Retrying is recommended." },
  ],
  job_dream_004: [
    { ts: "19:11:04", level: "success", message: "Prompt generated." },
    { ts: "19:11:16", level: "success", message: "Images generated (4/4)." },
    { ts: "19:11:34", level: "success", message: "Video generated." },
  ],
  job_dream_005: [
    { ts: "10:30:03", level: "success", message: "Prompt generated." },
    { ts: "10:30:11", level: "info", message: "Building character style sheet." },
    { ts: "10:30:19", level: "info", message: "Generating first visual frame." },
  ],
};

export const dashboardStories = [
  {
    id: "story_001",
    title: "Luna and the Floating Library",
    ageBand: "5-8",
    duration: "4 min read",
    status: "Published",
    cover: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&auto=format&fit=crop&q=70",
  },
  {
    id: "story_002",
    title: "Captain Comet Saves Sunflower Town",
    ageBand: "6-9",
    duration: "6 min read",
    status: "Published",
    cover: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&auto=format&fit=crop&q=70",
  },
  {
    id: "story_005",
    title: "Zara and the Moonlight Train",
    ageBand: "4-7",
    duration: "5 min read",
    status: "Draft",
    cover: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&auto=format&fit=crop&q=70",
  },
];

export const dashboardVideos = [
  {
    id: "video_003",
    title: "The Tiny Dragon Baking Show",
    length: "00:42",
    status: "Failed",
    cover: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=1200&auto=format&fit=crop&q=70",
  },
  {
    id: "video_004",
    title: "Niko's Jungle Treasure Map",
    length: "01:08",
    status: "Ready",
    cover: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=70",
  },
];

export const dashboardCharacters = [
  {
    id: "char_001",
    name: "Milo Moonfox",
    role: "Curious Explorer",
    ageBand: "5-8",
    mood: "Brave and kind",
    avatar: "https://images.unsplash.com/photo-1484406566174-9da000fda645?w=1200&auto=format&fit=crop&q=70",
    palette: ["#f97316", "#facc15", "#1d4ed8"],
  },
  {
    id: "char_002",
    name: "Pia Pixel",
    role: "Inventor Friend",
    ageBand: "6-9",
    mood: "Smart and playful",
    avatar: "https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=1200&auto=format&fit=crop&q=70",
    palette: ["#22c55e", "#14b8a6", "#0f172a"],
  },
  {
    id: "char_003",
    name: "Rory Rain",
    role: "Sky Storyteller",
    ageBand: "4-7",
    mood: "Gentle and funny",
    avatar: "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=1200&auto=format&fit=crop&q=70",
    palette: ["#38bdf8", "#6366f1", "#f43f5e"],
  },
  {
    id: "char_004",
    name: "Tara Tinydragon",
    role: "Adventure Chef",
    ageBand: "5-10",
    mood: "Bold and energetic",
    avatar: "https://images.unsplash.com/photo-1516627420156-8e4536971650?w=1200&auto=format&fit=crop&q=70",
    palette: ["#ef4444", "#f59e0b", "#1f2937"],
  },
];

export const dashboardPromptTemplates = [
  {
    id: "tpl_story",
    title: "Text to Story",
    description: "Turn one sentence into a complete kid-safe story with scenes and narration cues.",
    cta: "Start Story",
  },
  {
    id: "tpl_video",
    title: "Text to Video",
    description: "Create short, colorful video moments from your story prompt.",
    cta: "Start Video",
  },
  {
    id: "tpl_remix",
    title: "Story Remix",
    description: "Keep characters and settings, then generate a brand-new ending.",
    cta: "Remix Story",
  },
];

export function getDashboardJobById(id: string) {
  return dashboardJobs.find((job) => job.id === id);
}

export function getDashboardJobLogs(id: string) {
  return dashboardJobLogs[id] ?? [];
}

/* ------------------------------------------------------------------ */
/*  Story pages                                                       */
/* ------------------------------------------------------------------ */

export type StoryPage = {
  illustration?: string;
  title?: string;
  text: string;
  isTitle?: boolean;
  isEnd?: boolean;
  chapter?: string;
};

export const dashboardStoryPages: Record<string, StoryPage[]> = {
  /* ── Luna and the Floating Library ───────────────────────────────── */
  story_001: [
    {
      isTitle: true,
      title: "Luna and the Floating Library",
      text: "A Dream Studio Story",
      illustration:
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 1 · The Golden Key",
      text: "Luna found a golden key hidden in her grandmother's old jewelry box, tucked beneath silk scarves and faded letters. The moment her fingers touched it, the key hummed — a soft, warm note, like a lullaby she had forgotten long ago.",
      illustration:
        "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "The hum grew louder. The key glowed amber, then white, then lifted Luna right through the ceiling, through the clouds, into a sky she had never seen — a sky the color of honey and starlight.",
      illustration:
        "https://images.unsplash.com/photo-1475274047050-1d0c55b91e0a?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 2 · Above the Clouds",
      text: "Above the cotton-candy clouds sat the most magnificent library Luna had ever imagined. It floated on nothing at all, its towers made of stacked books, its windows glowing with the light of a thousand stories waiting to be read.",
      illustration:
        "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "Books flew around Luna like colorful birds. A red one about dragons nuzzled her cheek. A blue one full of ocean tales splashed tiny waves at her feet. 'Choose me!' they whispered. 'Read me!'",
      illustration:
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 3 · The Story Within",
      text: "Luna opened a glowing book and felt herself pulled gently inside. She walked through kingdoms of candy, sailed paper boats across ink-dark seas, and danced with characters who already knew her name.",
      illustration:
        "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "When she finally emerged, the library gifted her one special book — the one that told her own story. 'Every child carries a story inside them,' whispered the library. 'This one is yours.'",
      illustration:
        "https://images.unsplash.com/photo-1491841651911-c44c30c34548?w=800&auto=format&fit=crop&q=70",
    },
    {
      isEnd: true,
      text: "And so Luna learned that the best stories aren't found on shelves — they're the ones we live, and the ones we share.",
    },
  ],

  /* ── Captain Comet Saves Sunflower Town ──────────────────────────── */
  story_002: [
    {
      isTitle: true,
      title: "Captain Comet Saves Sunflower Town",
      text: "A Dream Studio Adventure",
      illustration:
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 1 · Morning Blooms",
      text: "In Sunflower Town, every morning began with a dance. The flowers would stretch their golden petals, the bees would hum their favorite songs, and the sun would rise with a warm, proud smile that made everything glow.",
      illustration:
        "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "But one gray morning, the sun didn't come. The flowers drooped. The bees fell silent. Captain Comet — the bravest kid in town — looked up at the empty sky and knew something was very, very wrong.",
      illustration:
        "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 2 · Into the Darkness",
      text: "Captain Comet zoomed past the clouds, his starlight cape blazing behind him. Higher and higher he flew, until he found the sun — tangled in a thick net of shadows, struggling to break free.",
      illustration:
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "The shadows hissed and curled around him, trying to pull him in. But Captain Comet wasn't afraid. He reached deep into his cape and pulled out a beam of pure, golden starlight — the last gift from his father.",
      illustration:
        "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 3 · The Light Returns",
      text: "With one mighty throw, Captain Comet sent the starlight slicing through the net. The shadows screamed, scattered like frightened mice, and melted into the darkness where they belonged.",
      illustration:
        "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "The sun burst free, brighter and warmer than ever before. Down in Sunflower Town, the flowers stood tall, the bees sang, and everyone cheered for the hero who brought back the light.",
      illustration:
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=70",
    },
    {
      isEnd: true,
      text: "Captain Comet learned that even the smallest light can chase away the biggest darkness — especially when you're brave enough to shine.",
    },
  ],

  /* ── Zara and the Moonlight Train ────────────────────────────────── */
  story_005: [
    {
      isTitle: true,
      title: "Zara and the Moonlight Train",
      text: "A Dream Studio Story",
      illustration:
        "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 1 · The Midnight Visitor",
      text: "Every night at exactly midnight, a silver train appeared at the edge of Zara's garden. It shimmered like moonlight on water, and its whistle sounded like a lullaby drifting across the stars.",
      illustration:
        "https://images.unsplash.com/photo-1474487548417-781cb71495f7?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "Tonight, Zara was brave enough to climb aboard. Inside, the seats were made of the softest clouds, the windows showed constellations she had never learned in school, and the air smelled like warm cocoa.",
      illustration:
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 2 · The Riddle Conductor",
      text: "The conductor was a friendly owl with spectacles perched on his beak. 'Where would you like to go?' he asked. 'Somewhere I've never been,' whispered Zara. The owl smiled. 'Then you're already on the right train.'",
      illustration:
        "https://images.unsplash.com/photo-1484406566174-9da000fda645?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "The train glided through valleys of sparkling stars and over bridges made of moonbeams. It passed sleeping mountains and sailed across a sea of silver mist that tickled Zara's fingers through the open window.",
      illustration:
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=70",
    },
    {
      chapter: "Chapter 3 · The Dream Garden",
      text: "At the last stop, Zara found a garden where dreams grew like flowers. Dreams of flying had butterfly wings. Dreams of adventure were bright red roses. Dreams of kindness glowed like little golden suns.",
      illustration:
        "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&auto=format&fit=crop&q=70",
    },
    {
      text: "Zara picked one dream — the dream of flying — and tucked it gently into her pocket. When the train brought her home, the dream stayed with her, warm and safe. She knew it would come true one day.",
      illustration:
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=70",
    },
    {
      isEnd: true,
      text: "And every midnight, if you listen closely, you can still hear the Moonlight Train's whistle — waiting for the next dreamer brave enough to climb aboard.",
    },
  ],
};

export function getDashboardStoryById(id: string) {
  return dashboardStories.find((s) => s.id === id);
}

export function getDashboardStoryPages(id: string) {
  return dashboardStoryPages[id] ?? [];
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${Math.max(diffMins, 1)}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
