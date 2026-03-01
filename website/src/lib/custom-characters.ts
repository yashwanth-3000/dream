import type { DashboardCharacter } from "@/lib/dashboard-data";

export type StoredCharacter = DashboardCharacter & {
  createdAt: string;
  description?: string;
  visualNotes?: string;
};

export const CUSTOM_CHARACTER_STORAGE_KEY = "dream.custom.characters.v1";
const CUSTOM_CHARACTER_SYNC_EVENT = "dream.custom.characters.updated";
const EMPTY_CHARACTERS: StoredCharacter[] = [];
let lastRawSnapshot: string | null = null;
let lastParsedSnapshot: StoredCharacter[] = EMPTY_CHARACTERS;

function isValidCharacter(value: unknown): value is StoredCharacter {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredCharacter>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.role === "string" &&
    typeof record.ageBand === "string" &&
    typeof record.mood === "string" &&
    typeof record.avatar === "string" &&
    typeof record.createdAt === "string"
  );
}

export function readStoredCharacters(): StoredCharacter[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(CUSTOM_CHARACTER_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCharacter);
  } catch {
    return [];
  }
}

export function writeStoredCharacters(characters: StoredCharacter[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_CHARACTER_STORAGE_KEY, JSON.stringify(characters));
  window.dispatchEvent(new Event(CUSTOM_CHARACTER_SYNC_EVENT));
}

export function appendStoredCharacter(character: StoredCharacter) {
  const existing = readStoredCharacters().filter((entry) => entry.id !== character.id);
  const next = [character, ...existing];
  writeStoredCharacters(next);
  return next;
}

export function subscribeStoredCharacters(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== CUSTOM_CHARACTER_STORAGE_KEY) return;
    onStoreChange();
  };

  const onCustomSync = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOM_CHARACTER_SYNC_EVENT, onCustomSync);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOM_CHARACTER_SYNC_EVENT, onCustomSync);
  };
}

export function getStoredCharactersSnapshot() {
  if (typeof window === "undefined") return EMPTY_CHARACTERS;

  const raw = window.localStorage.getItem(CUSTOM_CHARACTER_STORAGE_KEY);
  if (raw === lastRawSnapshot) return lastParsedSnapshot;

  lastRawSnapshot = raw;

  if (!raw) {
    lastParsedSnapshot = EMPTY_CHARACTERS;
    return lastParsedSnapshot;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      lastParsedSnapshot = EMPTY_CHARACTERS;
      return lastParsedSnapshot;
    }
    lastParsedSnapshot = parsed.filter(isValidCharacter);
    return lastParsedSnapshot;
  } catch {
    lastParsedSnapshot = EMPTY_CHARACTERS;
    return lastParsedSnapshot;
  }
}

export function getStoredCharactersServerSnapshot(): StoredCharacter[] {
  return EMPTY_CHARACTERS;
}
