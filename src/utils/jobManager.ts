import { VisualizerConfig } from "@/store/editorState";

export interface RenderJob {
  id: string;
  progress: number; // 0 to 100
  status: "idle" | "rendering" | "completed" | "failed";
  error: string | null;
  videoUrl: string | null;
  fileName: string | null;
}

// In-memory store for render jobs
const jobs: Record<string, RenderJob> = {};

export function createJob(id: string, fileName: string): RenderJob {
  const job: RenderJob = {
    id,
    progress: 0,
    status: "idle",
    error: null,
    videoUrl: null,
    fileName,
  };
  jobs[id] = job;
  return job;
}

export function getJob(id: string): RenderJob | undefined {
  return jobs[id];
}

export function updateJob(id: string, updates: Partial<RenderJob>) {
  if (jobs[id]) {
    jobs[id] = { ...jobs[id], ...updates };
  }
}

export function deleteJob(id: string) {
  delete jobs[id];
}
