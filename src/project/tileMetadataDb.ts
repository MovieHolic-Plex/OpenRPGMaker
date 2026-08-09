import { loadProjectFromSupabase, recordSupabaseAiAnalysisRun, saveProjectToSupabase } from "./supabaseProjectSync";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";


type AiActivityRecorder = (input: unknown) => Promise<unknown> | void;
let aiActivityRecorder: AiActivityRecorder | null = null;

/** 부트가 AI 활동 로거를 주입한다. 미설정이면 로깅을 건너뛴다. */
export function setAiActivityRecorder(recorder: AiActivityRecorder | null): void {
  aiActivityRecorder = recorder;
}

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
  // 타일셋 분석도 통합 AI 활동 로그에 남긴다 (로컬 + 가능 시 activity 테이블).
  if (aiActivityRecorder) {
    void Promise.resolve(
      aiActivityRecorder({
        channel: "tileset-analysis",
        instruction: `tileset analysis ${input.tilesetId} (${input.selectedTiles.length} tiles)`,
        mapId: undefined,
        result: { ok: true, proposedCalls: 0 },
        toolCalls: [
          {
            name: "tileset_ai_analysis",
            args: { tilesetId: input.tilesetId, selectedTiles: input.selectedTiles },
            ok: true,
            summary: `selected ${input.selectedTiles.length}`,
          },
        ],
        audit: [],
        uiEvents: [{ promptContext: input.promptContext, result: input.result }],
      })
    ).catch(() => {
      /* ignore */
    });
  }
}
