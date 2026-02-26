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
    duration: "6 min read",
    status: "Published",
    cover: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&auto=format&fit=crop&q=70",
  },
  {
    id: "story_002",
    title: "Captain Comet Saves Sunflower Town",
    ageBand: "6-9",
    duration: "8 min read",
    status: "Published",
    cover: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&auto=format&fit=crop&q=70",
  },
  {
    id: "story_005",
    title: "Zara and the Moonlight Train",
    ageBand: "4-7",
    duration: "7 min read",
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

export type DashboardCharacter = {
  id: string;
  name: string;
  role: string;
  ageBand: string;
  mood: string;
  avatar: string;
  palette: string[];
};

export const dashboardCharacters: DashboardCharacter[] = [
  {
    id: "char_001",
    name: "Superman",
    role: "Man of Steel",
    ageBand: "5-10",
    mood: "Brave and hopeful",
    avatar: "https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=600&auto=format&fit=crop&q=80",
    palette: ["#0057B8", "#DC143C", "#FFD700"],
  },
  {
    id: "char_002",
    name: "Spider-Man",
    role: "Friendly Neighborhood Hero",
    ageBand: "6-9",
    mood: "Witty and courageous",
    avatar: "https://images.unsplash.com/photo-1521714161819-15534968fc5f?w=600&auto=format&fit=crop&q=80",
    palette: ["#E62429", "#1B3A6B", "#FFFFFF"],
  },
  {
    id: "char_003",
    name: "Batman",
    role: "The Dark Knight",
    ageBand: "5-10",
    mood: "Determined and clever",
    avatar: "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=600&auto=format&fit=crop&q=80",
    palette: ["#1C1C1C", "#FFC107", "#333333"],
  },
  {
    id: "char_004",
    name: "Wonder Woman",
    role: "Warrior Princess",
    ageBand: "5-10",
    mood: "Strong and compassionate",
    avatar: "https://images.unsplash.com/photo-1608889825205-eebdb9fc5806?w=600&auto=format&fit=crop&q=80",
    palette: ["#C41E3A", "#003366", "#FFD700"],
  },
  {
    id: "char_005",
    name: "Elsa",
    role: "Ice Queen",
    ageBand: "4-7",
    mood: "Magical and free",
    avatar: "https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=600&auto=format&fit=crop&q=80",
    palette: ["#89CFF0", "#B6E3F4", "#FFFFFF"],
  },
  {
    id: "char_006",
    name: "Buzz Lightyear",
    role: "Space Ranger",
    ageBand: "4-7",
    mood: "Bold and loyal",
    avatar: "https://images.unsplash.com/photo-1446776709462-d6b525c57bd3?w=600&auto=format&fit=crop&q=80",
    palette: ["#6A5ACD", "#32CD32", "#FFFFFF"],
  },
  {
    id: "char_007",
    name: "Pikachu",
    role: "Electric Partner",
    ageBand: "4-7",
    mood: "Playful and loyal",
    avatar: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    palette: ["#FFD700", "#FF4500", "#3B2F2F"],
  },
  {
    id: "char_008",
    name: "Iron Man",
    role: "Genius Inventor",
    ageBand: "6-9",
    mood: "Smart and fearless",
    avatar: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=600&auto=format&fit=crop&q=80",
    palette: ["#B22222", "#FFD700", "#1C1C1C"],
  },
  {
    id: "char_009",
    name: "Moana",
    role: "Ocean Voyager",
    ageBand: "5-8",
    mood: "Adventurous and kind",
    avatar: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&auto=format&fit=crop&q=80",
    palette: ["#E2725B", "#00CED1", "#228B22"],
  },
  {
    id: "char_010",
    name: "Goku",
    role: "Saiyan Warrior",
    ageBand: "6-9",
    mood: "Energetic and pure-hearted",
    avatar: "https://images.unsplash.com/photo-1601645191163-3fc0d5d64e35?w=600&auto=format&fit=crop&q=80",
    palette: ["#FF6B00", "#1E90FF", "#000000"],
  },
  {
    id: "char_011",
    name: "Rapunzel",
    role: "Tower Dreamer",
    ageBand: "4-7",
    mood: "Curious and creative",
    avatar: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80",
    palette: ["#DA70D6", "#FFD700", "#9370DB"],
  },
  {
    id: "char_012",
    name: "Woody",
    role: "Sheriff & Best Friend",
    ageBand: "4-7",
    mood: "Loyal and caring",
    avatar: "https://images.unsplash.com/photo-1535930749574-1399327ce78f?w=600&auto=format&fit=crop&q=80",
    palette: ["#8B4513", "#FFD700", "#FFFFFF"],
  },
  {
    id: "char_013",
    name: "Black Panther",
    role: "King of Wakanda",
    ageBand: "5-10",
    mood: "Noble and fierce",
    avatar: "https://images.unsplash.com/photo-1562577309-2592ab84b1bc?w=600&auto=format&fit=crop&q=80",
    palette: ["#1C1C1C", "#8B5CF6", "#C0C0C0"],
  },
  {
    id: "char_014",
    name: "The Flash",
    role: "Fastest Man Alive",
    ageBand: "6-9",
    mood: "Quick-witted and heroic",
    avatar: "https://images.unsplash.com/photo-1461696114087-397271a7aedc?w=600&auto=format&fit=crop&q=80",
    palette: ["#DC143C", "#FFD700", "#8B0000"],
  },
  {
    id: "char_015",
    name: "Simba",
    role: "Lion King",
    ageBand: "4-7",
    mood: "Brave and playful",
    avatar: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=600&auto=format&fit=crop&q=80",
    palette: ["#DAA520", "#CD853F", "#8B4513"],
  },
  {
    id: "char_016",
    name: "Captain America",
    role: "Super Soldier",
    ageBand: "5-10",
    mood: "Noble and determined",
    avatar: "https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=600&auto=format&fit=crop&q=80",
    palette: ["#002868", "#BF0A30", "#FFFFFF"],
  },
  {
    id: "char_017",
    name: "Dora",
    role: "Explorer Adventurer",
    ageBand: "4-7",
    mood: "Curious and friendly",
    avatar: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&auto=format&fit=crop&q=80",
    palette: ["#FF69B4", "#8A2BE2", "#FFA500"],
  },
  {
    id: "char_018",
    name: "Thor",
    role: "God of Thunder",
    ageBand: "6-9",
    mood: "Mighty and warm-hearted",
    avatar: "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=600&auto=format&fit=crop&q=80",
    palette: ["#4169E1", "#C0C0C0", "#DC143C"],
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

/*
  NEW spread layout from buildSpreads():
    Spread 0 → cover (left)    | blank          (right)   ← cover-only, no title
    Spread 1 → pages[0] (left) | pages[1]       (right)   ← chapter labels on ODD indices
    Spread 2 → pages[2] (left) | pages[3]       (right)
    Spread 3 → pages[4] (left) | pages[5]       (right)
    Spread 4 → pages[6] (left) | pages[7]       (right)
    Spread 5 → pages[8] (left) | pages[9]       (right)
    Spread 6 → pages[10](left) | null           (right)   ← end page on left, blank right
  11 pages total. Even indices = left (image only). Odd indices = right (chapter + text).
*/
export const dashboardStoryPages: Record<string, StoryPage[]> = {
  /* ── Luna and the Floating Library ─────────────────────────────────
     11 pages: [0,2,4,6,8] left (image) · [1,3,5,7,9] right (text) · [10] end (left)
  ───────────────────────────────────────────────────────────────────── */
  story_001: [
    /* [0] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&auto=format&fit=crop&q=70",
    },
    /* [1] right — Chapter 1 */
    {
      chapter: "Chapter 1 · The Golden Key",
      text: "Luna found a golden key hidden in her grandmother's old jewelry box, tucked beneath silk scarves and faded letters. The moment her fingers touched it, the key hummed — a soft, warm note, like a lullaby she had forgotten long ago.",
    },
    /* [2] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1475274047050-1d0c55b91e0a?w=800&auto=format&fit=crop&q=70",
    },
    /* [3] right — Chapter 2 */
    {
      chapter: "Chapter 2 · Above the Clouds",
      text: "The hum grew louder. The key glowed amber, then gold, then brilliant white, lifting Luna right through the ceiling and into a sky the color of honey and starlight. Above the cotton-candy clouds sat the most magnificent floating library she had ever imagined.",
    },
    /* [4] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&auto=format&fit=crop&q=70",
    },
    /* [5] right — Chapter 2 continues */
    {
      text: "Books flew around Luna like colorful birds. A red one about dragons nuzzled her cheek. A blue one full of ocean tales splashed tiny waves at her feet. At the heart of the library stood an ancient owl with silver spectacles and a coat stitched from book spines.",
    },
    /* [6] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&auto=format&fit=crop&q=70",
    },
    /* [7] right — Chapter 3 */
    {
      chapter: "Chapter 3 · The Story Within",
      text: "Luna opened a glowing book and felt herself pulled gently inside. She walked through kingdoms of candy, sailed paper boats across ink-dark seas, and danced with characters who already knew her name.",
    },
    /* [8] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=800&auto=format&fit=crop&q=70",
    },
    /* [9] right — Chapter 4 */
    {
      chapter: "Chapter 4 · A Story to Keep",
      text: "When she finally emerged, the library gifted her one special book — the one that told her own story, with pages still blank at the end. 'Every child carries a story inside them,' whispered the library. 'Yours is still being written.'",
    },
    /* [10] left — end page */
    {
      isEnd: true,
      text: "And so Luna learned that the best stories aren't found on shelves — they're the ones we live, and the ones we have the courage to share.",
    },
  ],

  /* ── Captain Comet Saves Sunflower Town ─────────────────────────────
     11 pages: [0,2,4,6,8] left (image) · [1,3,5,7,9] right (text) · [10] end (left)
  ───────────────────────────────────────────────────────────────────── */
  story_002: [
    /* [0] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?w=800&auto=format&fit=crop&q=70",
    },
    /* [1] right — Chapter 1 */
    {
      chapter: "Chapter 1 · Morning Blooms",
      text: "In Sunflower Town, every morning began with a dance. The flowers stretched their golden petals, the bees hummed their favorite songs, and the sun rose with a warm proud smile. But one gray morning, the sun didn't come.",
    },
    /* [2] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&auto=format&fit=crop&q=70",
    },
    /* [3] right — Chapter 2 */
    {
      chapter: "Chapter 2 · Into the Darkness",
      text: "Captain Comet pulled on his starlight cape and zoomed past the clouds. Higher and higher he flew, until he found the sun — tangled in a thick net of shadows, struggling, flickering, nearly out.",
    },
    /* [4] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=70",
    },
    /* [5] right — Chapter 2 continues */
    {
      text: "The shadows hissed and curled around him, cold as deep water. But Captain Comet stood firm and reached into his cape — pulling out a beam of pure golden starlight, the last gift from his father, burning steady as a lighthouse.",
    },
    /* [6] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=800&auto=format&fit=crop&q=70",
    },
    /* [7] right — Chapter 3 */
    {
      chapter: "Chapter 3 · The Light Returns",
      text: "With one mighty throw, Captain Comet sent the starlight slicing through the shadow net. The shadows scattered like frightened mice and melted into the dark. The sun burst free, brighter and warmer than ever before.",
    },
    /* [8] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&auto=format&fit=crop&q=70",
    },
    /* [9] right — Chapter 4 */
    {
      chapter: "Chapter 4 · Seeds of Light",
      text: "Captain Comet landed in the town square and reached into his pocket. The sunflower seed his sister had given him now glowed gold. He pressed it into the earth — and by morning a sunflower taller than a house had grown, petals shining like little suns.",
    },
    /* [10] left — end page */
    {
      isEnd: true,
      text: "Captain Comet learned that even the smallest light can chase away the biggest darkness — especially when you're brave enough to shine.",
    },
  ],

  /* ── Zara and the Moonlight Train ───────────────────────────────────
     11 pages: [0,2,4,6,8] left (image) · [1,3,5,7,9] right (text) · [10] end (left)
  ───────────────────────────────────────────────────────────────────── */
  story_005: [
    /* [0] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1474487548417-781cb71495f7?w=800&auto=format&fit=crop&q=70",
    },
    /* [1] right — Chapter 1 */
    {
      chapter: "Chapter 1 · The Midnight Visitor",
      text: "Every night at exactly midnight, a silver train appeared at the edge of Zara's garden. It shimmered like moonlight on water, and its whistle sounded like a lullaby drifting softly across the stars.",
    },
    /* [2] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=70",
    },
    /* [3] right — Chapter 2 */
    {
      chapter: "Chapter 2 · The Riddle Conductor",
      text: "Tonight Zara was brave enough to climb aboard. Inside, the seats were made of the softest clouds and the air smelled like warm cocoa. The conductor — a friendly owl with silver spectacles — asked, 'Where would you like to go?'",
    },
    /* [4] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=70",
    },
    /* [5] right — Chapter 2 continues */
    {
      text: "'Somewhere I have never been,' whispered Zara. The owl smiled. 'Then you are already on the right train.' The Moonlight Train glided through star valleys and over bridges of moonbeams, past sleeping mountains and across a silver sea of mist.",
    },
    /* [6] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&auto=format&fit=crop&q=70",
    },
    /* [7] right — Chapter 3 */
    {
      chapter: "Chapter 3 · The Dream Garden",
      text: "At the last stop, Zara found a garden where dreams grew like flowers. Dreams of flying had butterfly wings. Dreams of adventure were bright red roses. Dreams of kindness glowed like little golden suns, warming everything nearby.",
    },
    /* [8] left — illustration */
    {
      text: "",
      illustration:
        "https://images.unsplash.com/photo-1446776709462-d6b525c57bd3?w=800&auto=format&fit=crop&q=70",
    },
    /* [9] right — Chapter 4 */
    {
      chapter: "Chapter 4 · The Journey Home",
      text: "Zara chose the dream of flying and tucked it gently into her pocket. As dawn painted the sky pink, the train turned for home. 'Same time next night?' asked the owl. Zara grinned. 'I'll be ready.'",
    },
    /* [10] left — end page */
    {
      isEnd: true,
      text: "And every midnight, if you listen closely, you can still hear the Moonlight Train's silver whistle — waiting for the next dreamer brave enough to climb aboard.",
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
