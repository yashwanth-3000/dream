export type VideoGenerationType = "normal" | "gameplay";

export type GameplayCategory = "minecraft" | "gta" | "subway";

export type GameplayCategoryOption = {
  id: GameplayCategory;
  label: string;
  emoji: string;
  description: string;
};

export type GameplayBackgroundClip = {
  id: string;
  name: string;
  thumb: string;
};

export const VIDEO_MODE_OPTIONS: {
  value: VideoGenerationType;
  label: string;
  description: string;
}[] = [
  {
    value: "normal",
    label: "Normal Video",
    description: "Narrative video based on your prompt and style.",
  },
  {
    value: "gameplay",
    label: "Gameplay Video",
    description: "Short-form high-energy format with gameplay background.",
  },
];

export const GAMEPLAY_CATEGORY_OPTIONS: GameplayCategoryOption[] = [
  { id: "minecraft", label: "Minecraft", emoji: "⛏️", description: "Block world" },
  { id: "gta", label: "GTA", emoji: "🚗", description: "City chaos" },
  { id: "subway", label: "Subway", emoji: "🏃", description: "Endless runner" },
];

export const GAMEPLAY_BACKGROUNDS: Record<GameplayCategory, GameplayBackgroundClip[]> = {
  minecraft: [
    { id: "mc_1", name: "Lava Path", thumb: "https://images.unsplash.com/photo-1579370318443-8da816457adf?w=600&auto=format&fit=crop&q=80" },
    { id: "mc_2", name: "Temple Hall", thumb: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=600&auto=format&fit=crop&q=80" },
    { id: "mc_3", name: "Sky Bridge", thumb: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80" },
    { id: "mc_4", name: "Night Build", thumb: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80" },
    { id: "mc_5", name: "Cliff Tower", thumb: "https://images.unsplash.com/photo-1580327344181-c1163234e5a0?w=600&auto=format&fit=crop&q=80" },
    { id: "mc_6", name: "Portal Run", thumb: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80" },
  ],
  gta: [
    { id: "gta_1", name: "City Night", thumb: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&auto=format&fit=crop&q=80" },
    { id: "gta_2", name: "Neon Street", thumb: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80" },
    { id: "gta_3", name: "Freeway POV", thumb: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&auto=format&fit=crop&q=80" },
    { id: "gta_4", name: "Downtown", thumb: "https://images.unsplash.com/photo-1465447142348-e9952c393450?w=600&auto=format&fit=crop&q=80" },
    { id: "gta_5", name: "Rain Drift", thumb: "https://images.unsplash.com/photo-1494526585095-c41746248156?w=600&auto=format&fit=crop&q=80" },
    { id: "gta_6", name: "Airport Run", thumb: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=600&auto=format&fit=crop&q=80" },
  ],
  subway: [
    { id: "subway_1", name: "Tunnel Boost", thumb: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&auto=format&fit=crop&q=80" },
    { id: "subway_2", name: "Urban Track", thumb: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80" },
    { id: "subway_3", name: "Rush Hour", thumb: "https://images.unsplash.com/photo-1470123808288-1e59739f8bf8?w=600&auto=format&fit=crop&q=80" },
    { id: "subway_4", name: "Graffiti Rail", thumb: "https://images.unsplash.com/photo-1494522358652-f30e61a60313?w=600&auto=format&fit=crop&q=80" },
    { id: "subway_5", name: "Golden Hour", thumb: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=600&auto=format&fit=crop&q=80" },
    { id: "subway_6", name: "Late Night", thumb: "https://images.unsplash.com/photo-1468436385273-8abca6dfd8d3?w=600&auto=format&fit=crop&q=80" },
  ],
};

export function getDefaultGameplayBackgroundId(category: GameplayCategory): string {
  return GAMEPLAY_BACKGROUNDS[category][0]?.id ?? "";
}

