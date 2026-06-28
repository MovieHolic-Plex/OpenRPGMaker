import { loadProjectFromSupabase, recordSupabaseAiAnalysisRun, saveProjectToSupabase } from "./supabaseProjectSync";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";

type StoredProject = {
  readonly found: boolean;
  readonly project: Project | null;
};

type AiAnalysisRunInput = {
  readonly promptContext: unknown;
  readonly result: unknown;
  readonly selectedTiles: readonly number[];
  readonly tilesetId: string;
};

export async function loadProjectFromCanonicalStore(): Promise<StoredProject> {
  return loadProjectFromSupabaseCanonicalStore();
}

export async function saveProjectToCanonicalStore(project: Project): Promise<void> {
  await saveProjectToSupabaseCanonicalStore(project);
}

export async function clearCanonicalProjectStore(): Promise<void> {
  await clearSupabaseCanonicalProjectStore();
}

export async function loadProjectFromSupabaseCanonicalStore(): Promise<StoredProject> {
  const project = await loadProjectFromSupabase();
  return { found: project !== null, project };
}

export async function saveProjectToSupabaseCanonicalStore(project: Project): Promise<void> {
  await saveProjectToSupabase(projectWithoutEventDrafts(project));
}

export async function clearSupabaseCanonicalProjectStore(): Promise<void> {
  await Promise.resolve();
}

export async function recordAiAnalysisRun(input: AiAnalysisRunInput): Promise<void> {
  await recordSupabaseAiAnalysisRun(input);
}
