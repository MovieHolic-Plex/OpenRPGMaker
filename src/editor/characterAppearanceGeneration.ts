import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import type { ImageReference } from "@/ai/imageReferences";
import { collectAppearanceReferences } from "@/editor/characterAppearanceReferences";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store, type ProjectIdentity, type ProjectChangeDescriptor } from "@/project/store";
import type { CharacterAppearanceRecord, Project } from "@/project/types";
import { genId } from "@/util/id";
import { prepareAppearanceGeneration } from "@/editor/tools/characterAppearanceTools";
import { ToolError, type ToolResult } from "@/editor/tools/types";

export type AppearanceGenerationSlot = "face" | "bust";
export interface AppearanceGenerationRequest {
  readonly appearanceId: string;
  readonly slot: AppearanceGenerationSlot;
  /** Human per-slot replacement gesture only. Assistant requests never set this. */
  readonly replace?: boolean;
}
export interface AppearanceGenerationCandidate {
  readonly dataUrl: string;
  readonly mimeType: string;
  readonly presentation: AppearanceGenerationSlot;
}
export interface AppearanceGenerationState {
  readonly status: "idle" | "generating" | "candidate" | "error";
  readonly appearanceId?: string;
  readonly slot?: AppearanceGenerationSlot;
  readonly candidate?: AppearanceGenerationCandidate;
  readonly error?: string;
}
export interface AppearanceGenerationDeps {
  readonly getProject: () => Project;
  readonly getIdentity: () => ProjectIdentity;
  readonly update: (mutator: (project: Project) => void, change: ProjectChangeDescriptor) => void;
  readonly recordSnapshot: (label: string) => void;
  readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset>;
  readonly references?: (project: Project, record: CharacterAppearanceRecord, signal: AbortSignal) => Promise<readonly ImageReference[]>;
}

/** One detached DB-owned candidate. Only apply() is allowed to mutate the project. */
export function createCharacterAppearanceGenerationController(deps: AppearanceGenerationDeps) {
  let state: AppearanceGenerationState = { status: "idle" };
  let abort: AbortController | undefined;
  let target: { readonly identity: string; readonly record: string; readonly appearanceId: string } | undefined;
  const listeners = new Set<(state: AppearanceGenerationState) => void>();
  function publish(next: AppearanceGenerationState): void {
    state = next;
    for (const listener of listeners) listener(state);
  }
  function cancel(): void {
    abort?.abort();
    abort = undefined;
    target = undefined;
    publish({ status: "idle" });
  }
  function isCurrent(): boolean {
    if (!target) return false;
    const record = deps.getProject().database.characterAppearances?.find((entry) => entry.id === target?.appearanceId);
    return JSON.stringify(deps.getIdentity()) === target.identity && JSON.stringify(record) === target.record;
  }
  async function generate(request: AppearanceGenerationRequest): Promise<void> {
    cancel();
    const record = deps.getProject().database.characterAppearances?.find((entry) => entry.id === request.appearanceId);
    if (!record) {
      publish({ ...request, status: "error", error: "외형을 찾을 수 없습니다." });
      return;
    }
    if (record[request.slot] && !request.replace) {
      publish({ ...request, status: "error", error: "이미 그림이 있습니다. 해당 칸의 교체 버튼을 사용하세요." });
      return;
    }
    const current = new AbortController();
    abort = current;
    const snapshot = structuredClone(record);
    target = { identity: JSON.stringify(deps.getIdentity()), record: JSON.stringify(record), appearanceId: record.id };
    publish({ ...request, status: "generating" });
    try {
      const referenceImages = await (deps.references ?? collectAppearanceReferences)(deps.getProject(), snapshot, current.signal);
      if (abort !== current) return;
      if (!isCurrent()) { cancel(); return; }
      const image = await (deps.generateImage ?? generateAiImage)({
        prompt: `${request.slot === "face" ? "Single square face portrait, head and shoulders" : "Single waist-up character bust"}, 2D JRPG art, no text, no sheet, no walking sprites. Preserve the character identity and palette of any reference images. ${snapshot.name}. ${snapshot.description}`,
        referenceImages,
        signal: current.signal,
      });
      if (abort !== current) return;
      if (!isCurrent()) { cancel(); return; }
      if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image.dataUrl)) {
        throw new ImageGenerationError("생성된 그림 데이터가 올바르지 않습니다.");
      }
      publish({
        ...request,
        status: "candidate",
        candidate: { dataUrl: image.dataUrl, mimeType: image.mimeType, presentation: request.slot },
      });
    } catch (error) {
      if (abort !== current) return;
      target = undefined;
      publish({ ...request, status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }
  function apply(slot?: AppearanceGenerationSlot): boolean {
    const { candidate, appearanceId } = state;
    const targetSlot = state.slot;
    if (state.status !== "candidate" || !candidate || !appearanceId || !targetSlot || (slot && slot !== targetSlot)) return false;
    if (!isCurrent()) {
      cancel();
      publish({ status: "error", appearanceId, slot: targetSlot, error: "외형이 변경되었습니다. 다시 생성하세요." });
      return false;
    }
    const record = deps.getProject().database.characterAppearances?.find((entry) => entry.id === appearanceId);
    if (!record) return false;
    let id = genId(`appearance-${targetSlot}`);
    while (deps.getProject().assets.uploaded[id] || deps.getProject().resourceProfiles.some((entry) => entry.assetId === id)) {
      id = genId(`appearance-${targetSlot}`);
    }
    const kind = targetSlot === "face" ? "faceset" : "picture";
    const name = `${record.name} ${targetSlot === "face" ? "얼굴" : "상반신"}`;
    // Consume before the synchronous store emission, so reentrant Apply cannot duplicate.
    state = { status: "idle" };
    target = undefined;
    abort = undefined;
    deps.recordSnapshot("캐릭터 외형 AI 그림 적용");
    deps.update((project) => {
      const currentRecord = project.database.characterAppearances?.find((entry) => entry.id === appearanceId);
      if (!currentRecord) throw new ImageGenerationError("외형을 찾을 수 없습니다.");
      project.assets.uploaded[id] = { id, name, kind, dataUrl: candidate.dataUrl, meta: {} };
      project.resourceProfiles.push({ assetId: id, name, kind });
      currentRecord[targetSlot] = { resourceId: id };
    }, { scope: "database", collection: "characterAppearances", label: "캐릭터 외형 AI 그림 적용", origin: "ai" });
    publish(state);
    return true;
  }
  return {
    getState: () => state,
    subscribe(listener: (state: AppearanceGenerationState) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    generate,
    apply,
    cancel,
  };
}

export const appearanceGenerationController = createCharacterAppearanceGenerationController({
  getProject: () => store.getCurrent(),
  getIdentity: () => store.getProjectIdentity(),
  update: (mutator, change) => store.update(mutator, change),
  recordSnapshot: recordProjectSnapshot,
});
store.subscribe((_project, change) => {
  if (change.projectSwitch) appearanceGenerationController.cancel();
});

let openAppearanceUI: ((appearanceId: string) => void | Promise<void>) | undefined;
export function registerAppearanceGenerationUI(open: (appearanceId: string) => void | Promise<void>): () => void {
  openAppearanceUI = open;
  return () => { if (openAppearanceUI === open) openAppearanceUI = undefined; };
}

/** Session-only handoff: no image bytes enter the model transcript or tool draft. */
export interface AppearanceGenerationHandoff {
  readonly status: "generating" | "ui-required";
  readonly appearanceId: string;
  readonly slot: AppearanceGenerationSlot;
}

export async function startAppearanceGenerationFromAssistant(
  project: Project,
  args: Record<string, unknown>,
  sessionIdentity: ProjectIdentity,
  signal?: AbortSignal,
): Promise<ToolResult & { readonly data?: AppearanceGenerationHandoff }> {
  try {
    const { record, slot } = prepareAppearanceGeneration(project, args);
    const open = openAppearanceUI;
    if (!open) {
      return {
        ok: true,
        summary: "요청은 준비됐지만 편집기 UI가 필요합니다. 아직 생성·적용되지 않았습니다.",
        data: { status: "ui-required", appearanceId: record.id, slot },
      };
    }
    const expectedRecord = JSON.stringify(record);
    const checkCurrent = () => {
      const live = store.getCurrent().database.characterAppearances?.find((entry) => entry.id === record.id);
      if (JSON.stringify(store.getProjectIdentity()) !== JSON.stringify(sessionIdentity) || JSON.stringify(live) !== expectedRecord) {
        throw new ToolError("현재 DB 외형과 요청이 다릅니다. 최신 외형을 확인하세요.", { code: "appearance-stale" });
      }
      const state = appearanceGenerationController.getState();
      if (state.status === "generating" || state.status === "candidate") {
        throw new ToolError("검토 중인 외형 후보가 있습니다. 먼저 적용하거나 취소하세요.", { code: "appearance-busy" });
      }
    };
    checkCurrent();
    signal?.throwIfAborted();
    await open(record.id);
    signal?.throwIfAborted();
    checkCurrent();
    void appearanceGenerationController.generate({ appearanceId: record.id, slot });
    return {
      ok: true,
      summary: "캐릭터 외형 DB에서 그림 후보 생성을 시작했습니다. 완료 후 미리보기를 확인하고 직접 적용하세요. 아직 저장되지 않았습니다.",
      data: { status: "generating", appearanceId: record.id, slot },
    };
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    return { ok: false, summary: error.message, issues: [{ severity: "error", code: error.code, message: error.message }] };
  }
}
