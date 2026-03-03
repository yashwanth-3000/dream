const DEFAULT_MAIN_API_BASE_URL =
  "https://dream-orchestrator.greenplant-2d9bb135.eastus.azurecontainerapps.io";
const DEFAULT_CHARACTER_API_BASE_URL =
  "https://dream-character-a2a.greenplant-2d9bb135.eastus.azurecontainerapps.io";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveBaseUrl(envValue: string | undefined, fallback: string): string {
  const explicit = (envValue || "").trim();
  if (explicit) return normalizeBaseUrl(explicit);
  return normalizeBaseUrl(fallback);
}

export function getMainApiBaseUrl(): string {
  return resolveBaseUrl(process.env.MAIN_API_BASE_URL, DEFAULT_MAIN_API_BASE_URL);
}

export function getCharacterApiBaseUrl(): string {
  return resolveBaseUrl(
    process.env.BACKEND_API_BASE_URL,
    DEFAULT_CHARACTER_API_BASE_URL
  );
}
