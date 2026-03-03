import type { DashboardCharacter } from "@/lib/dashboard-data";

export type StoredCharacterDrawingReference = {
  url?: string;
  imageData?: string;
  description?: string;
  notes?: string;
};

export type StoredCharacter = DashboardCharacter & {
  createdAt: string;
  description?: string;
  visualNotes?: string;
  source?: "local" | "job";
  jobId?: string;
  referenceDrawings?: StoredCharacterDrawingReference[];
};

export const CUSTOM_CHARACTER_STORAGE_KEY = "dream.custom.characters.v1";
const CUSTOM_CHARACTER_RESET_ONCE_KEY = "dream.custom.characters.reset.once.v20260303";
const CUSTOM_CHARACTER_SYNC_EVENT = "dream.custom.characters.updated";
const EMPTY_CHARACTERS: StoredCharacter[] = [];
let lastRawSnapshot: string | null = null;
let lastParsedSnapshot: StoredCharacter[] = EMPTY_CHARACTERS;

function isValidDrawingReference(value: unknown): value is StoredCharacterDrawingReference {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredCharacterDrawingReference>;
  return (
    (record.url === undefined || typeof record.url === "string") &&
    (record.imageData === undefined || typeof record.imageData === "string") &&
    (record.description === undefined || typeof record.description === "string") &&
    (record.notes === undefined || typeof record.notes === "string")
  );
}

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
    typeof record.createdAt === "string" &&
    (record.description === undefined || typeof record.description === "string") &&
    (record.visualNotes === undefined || typeof record.visualNotes === "string") &&
    (record.source === undefined || record.source === "local" || record.source === "job") &&
    (record.jobId === undefined || typeof record.jobId === "string") &&
    (
      record.referenceDrawings === undefined
      || (Array.isArray(record.referenceDrawings) && record.referenceDrawings.every(isValidDrawingReference))
    )
  );
}

function ensureFreshCharacterStore() {
  if (typeof window === "undefined") return;

  const alreadyReset = window.localStorage.getItem(CUSTOM_CHARACTER_RESET_ONCE_KEY);
  if (alreadyReset) return;

  window.localStorage.setItem(CUSTOM_CHARACTER_STORAGE_KEY, JSON.stringify([]));
  window.localStorage.setItem(CUSTOM_CHARACTER_RESET_ONCE_KEY, "1");
  window.dispatchEvent(new Event(CUSTOM_CHARACTER_SYNC_EVENT));
}

export function readStoredCharacters(): StoredCharacter[] {
  if (typeof window === "undefined") return [];
  ensureFreshCharacterStore();

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
  ensureFreshCharacterStore();
  window.localStorage.setItem(CUSTOM_CHARACTER_STORAGE_KEY, JSON.stringify(characters));
  window.dispatchEvent(new Event(CUSTOM_CHARACTER_SYNC_EVENT));
}

export function appendStoredCharacter(character: StoredCharacter) {
  const existing = readStoredCharacters().filter((entry) => entry.id !== character.id);
  const next = [character, ...existing];
  writeStoredCharacters(next);
  return next;
}

export function removeStoredCharacter(characterId: string) {
  const next = readStoredCharacters().filter((entry) => entry.id !== characterId);
  writeStoredCharacters(next);
  return next;
}

export function removeStoredCharactersByJobId(jobId: string) {
  const next = readStoredCharacters().filter((entry) => entry.jobId !== jobId);
  writeStoredCharacters(next);
  return next;
}

export function clearStoredCharacters() {
  writeStoredCharacters([]);
  return [];
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
  ensureFreshCharacterStore();

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
