export type JobType = "character" | "story" | "video";
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

  const res = await fetch(`/api/jobs?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
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
