export type JobType = "character" | "story" | "video" | "quiz";
export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobAsset {
  id: string;
  job_id: string;
  asset_type: string;
  original_url: string;
  stored_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  title: string;
  user_prompt: string;
  input_payload: Record<string, unknown>;
  result_payload: Record<string, unknown>;
  progress: number;
  current_step: string;
  error_message: string;
  triggered_by: string;
  engine: string;
  assets: JobAsset[];
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: string;
  job_id: string;
  event_type: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const FETCH_JOBS_RETRIES = 3;
const FETCH_JOBS_RETRY_DELAY_MS = 600;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function fetchJobs(params?: {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
  summary?: boolean;
}): Promise<Job[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.summary) qs.set("summary", "1");

  const url = `/api/jobs?${qs.toString()}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_JOBS_RETRIES; attempt++) {
    try {
      if (attempt > 0) await delay(FETCH_JOBS_RETRY_DELAY_MS * attempt);
      const res = await fetch(url, { cache: "no-store" });
      // 4xx = permanent failure (bad request, not found) — don't retry
      if (res.status >= 400 && res.status < 500) return [];
      if (res.ok) return res.json();
      // 5xx / network issue — retry
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  console.error("[fetchJobs] All retries exhausted:", lastError);
  return [];
}

export async function fetchJob(
  id: string,
  options?: { summary?: boolean }
): Promise<Job | null> {
  const qs = options?.summary ? "?summary=1" : "";
  const url = `/api/jobs/${id}${qs}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_JOBS_RETRIES; attempt++) {
    try {
      if (attempt > 0) await delay(FETCH_JOBS_RETRY_DELAY_MS * attempt);
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) return null;
      if (res.status >= 400 && res.status < 500) return null;
      if (res.ok) return res.json();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  console.error("[fetchJob] All retries exhausted:", lastError);
  return null;
}

export async function deleteJob(id: string): Promise<boolean> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  return res.ok;
}

export async function fetchJobEvents(
  id: string,
  after?: string
): Promise<JobEvent[]> {
  const qs = after ? `?after=${encodeURIComponent(after)}` : "";
  const res = await fetch(`/api/jobs/${id}/events${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function createJob(params: {
  type: JobType;
  title?: string;
  user_prompt: string;
  input_payload?: Record<string, unknown>;
  triggered_by?: string;
  engine?: string;
}): Promise<Job> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to create job: ${res.status}`);
  }
  return res.json();
}

export function getAssetUrl(jobId: string, filename: string): string {
  return `/api/assets/${jobId}/${filename}`;
}
