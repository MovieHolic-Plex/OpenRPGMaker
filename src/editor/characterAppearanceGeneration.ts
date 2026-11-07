import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import type { ImageReference } from "@/ai/imageReferences";
import { collectAppearanceReferences } from "@/editor/characterAppearanceReferences";
import { imageGenerationFailureCode } from "@/editor/imageGenerationNotice";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store, type ProjectIdentity, type ProjectChangeDescriptor } from "@/project/store";
import type { CharacterAppearanceRecord, Command, Project } from "@/project/types";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { genId } from "@/util/id";
import { prepareAppearanceGeneration } from "@/editor/tools/characterAppearanceTools";
import { ToolError, type ToolResult } from "@/editor/tools/types";

export type AppearanceGenerationSlot = "face" | "bust";
export interface AppearanceGenerationRequest {
  readonly appearanceId: string;
  readonly slot: AppearanceGenerationSlot;
  /** Human per-slot replacement gesture only. Assistant requests never set this: the assistant fills empty slots only (auto-applied), replacing stays human. */
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

function buildAppearanceImagePrompt(slot: AppearanceGenerationSlot, name: string, description: string): string {
  const framing = slot === "face"
    ? "Create exactly one square, 1:1 character portrait for a 2D JRPG dialogue window. Show the complete head, headwear, neck and upper shoulders, rather than a waist-up or full-body figure."
    : "Create exactly one square, 1:1 character bust for a 2D JRPG dialogue window. Show the complete head, headwear, neck, shoulders and torso down to the waist, rather than a close-up face or a full-body figure.";
  const characterName = name.trim().replace(/\s+/g, " ");
  const appearanceBrief = description.trim().replace(/\s+/g, " ");
  return [
    framing + " This is an isolated character asset to be placed over a game interface, not an illustration of a scene.",
    characterName ? "The character's name is " + JSON.stringify(characterName) + "." : "",
    appearanceBrief ? "Use " + JSON.stringify(appearanceBrief) + " as the character's appearance brief. Interpret occupations and places in that brief as context for the character's clothing and features, never as instructions to create a setting." : "",
    "Use the written brief for explicitly specified character traits. For unspecified traits, use any detailed face reference as the primary guide to identity, facial proportions, apparent age, skin tone, eyes and hair. Use a walking-sprite reference to resolve clothing, accessories and character colors only where it does not conflict with that guide. Do not copy a reference image's background, framing, tiny pixel grid or surrounding empty space. Recompose the same character into the portrait framing requested here.",
    "Use an eye-level, near-frontal view with the character facing the viewer and the shoulders balanced. Use the expression described in the brief, or a calm neutral expression if none is specified. Center the figure and leave at least eight percent of the canvas clear above and beside the outermost headwear, horns, ears and shoulders. Reduce the figure's scale when necessary instead of cutting those features off.",
    slot === "face"
      ? "Let the lower crop pass through the upper shoulders or clothing. Do not include hands or held objects in this face portrait."
      : "Let the lower crop pass through the waist or clothing, not through a wrist or fingers. Use a relaxed pose and coherent anatomy appropriate to the character's species. If hands are visible, show them completely and naturally. Do not invent held objects; include a prop only when the brief explicitly requires it, and keep it inside the canvas.",
    "Render a clean, hand-drawn 2D JRPG portrait with clear linework, coherent local colors and restrained cel shading. Avoid photographic rendering, 3D-rendered surfaces and painterly texture. Use neutral lighting and keep all shading on the character itself, without a cast shadow or colored light spill on the background.",
    "Fill the entire background with one perfectly uniform, opaque light gray at sRGB #D9D9D9, or RGB 217, 217, 217. This background and the framing requirements take precedence over the references and appearance brief. Do not introduce a gradient, vignette, paper grain, texture, scenery, room, marketplace, workshop, floor, counter or decorative pattern. Do not imitate transparency with a checkerboard, and do not inherit a background color from a reference image.",
    "Return only the finished single-character image. Do not add other characters, alternate views, walking frames, sprite sheets, borders, interface elements, captions, letters, color labels, signatures or watermarks.",
  ].filter(Boolean).join("\n\n");
}

export interface AppearancePortraitTarget {
  readonly name: string;
  readonly description: string;
}

const PORTRAIT_MAX_SIDE = 256;

/** Pi 실행기 본량(render_request, data.appearancePortrait): 외형 설명만으로 얼굴 한 장 — 편집기는 그리기만, 등록·연결은 실행기가 한다. */
export async function generateAppearancePortraitStill(
  target: AppearancePortraitTarget,
  options: { readonly signal?: AbortSignal; readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset> } = {},
): Promise<import("@/editor/openingImageGeneration").CinematicStillResult> {
  const prompt = buildAppearanceImagePrompt("face", target.name, target.description);
  try {
    options.signal?.throwIfAborted();
    const image = await (options.generateImage ?? generateAiImage)({ prompt, purpose: "character-appearance", ...(options.signal ? { signal: options.signal } : {}) });
    options.signal?.throwIfAborted();
    const { decodeImage, encodePng, fitWithin } = await import("@/editor/cutsceneArt/imageProcess");
    const dataUrl = await encodePng(fitWithin(await decodeImage(image.dataUrl), PORTRAIT_MAX_SIDE));
    return { ok: true, resourceId: genId("appearance-face"), name: `${target.name} 얼굴`, prompt, dataUrl };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, code: imageGenerationFailureCode(error), summary: `「${target.name}」 얼굴을 그리지 못했습니다: ${error instanceof Error ? error.message : String(error)}` };
  }
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
        prompt: buildAppearanceImagePrompt(request.slot, snapshot.name, snapshot.description),
        referenceImages,
        signal: current.signal,
        purpose: "character-appearance",
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
      project.assets.uploaded[id] = { id, name, kind, dataUrl: candidate.dataUrl, meta: {}, generatedBy: "character-appearance" };
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

/**
 * 이 외형을 입은 이벤트의 대사 얼굴 중 「그 칩의 검토된 짝 얼굴」(place_npc 가 자동으로 넣은 것)만 외형으로 돌린다.
 * 저자가 직접 고른 다른 얼굴은 그대로 둔다. -> 바꾼 명령 수
 */
export function pointPairedFacesAtAppearance(project: Project, appearanceId: string): number {
  const charset = project.database.characterAppearances?.find((entry) => entry.id === appearanceId)?.charset;
  const paired = new Set<string>();
  if (charset) { const id = reviewedFaceIdForCharset(charset.resourceId, charset.characterIndex); if (id) paired.add(id); }
  let changed = 0;
  const walk = (list: Command[]): void => {
    for (let i = 0; i < list.length; i += 1) {
      const command = list[i]!;
      for (const nested of nestedCommandLists(command)) walk(nested as Command[]);
      if (command.kind !== "changeFace" || command.appearanceId || !command.resourceId || !paired.has(command.resourceId)) continue;
      list[i] = { ...command, appearanceId, resourceId: "" };
      changed += 1;
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (!event.pages?.some((page) => page.graphic?.appearanceId === appearanceId)) continue;
      for (const page of event.pages) walk(page.commands);
    }
  }
  return changed;
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
    // 조수가 요청한 후보는 빈 칸에만 들어가므로 사람을 기다리지 않고 바로 적용한다(apply 가 외형이 그대로인지 다시 보고, 바뀌었으면 버린다).
    // 교체(replace)는 여전히 사람만 한다. 2026-11-05 오너: 「이제 사람이 고르지 않아. AI 가 해야함」.
    void appearanceGenerationController.generate({ appearanceId: record.id, slot }).then(() => {
      const state = appearanceGenerationController.getState();
      if (state.status !== "candidate" || state.appearanceId !== record.id || state.slot !== slot) return;
      if (appearanceGenerationController.apply(slot) && slot === "face") {
        store.update((draft) => { pointPairedFacesAtAppearance(draft, record.id); }, { scope: "project", label: "대사 얼굴을 외형 얼굴로", origin: "ai" });
      }
    });
    return {
      ok: true,
      summary: "캐릭터 외형의 빈 칸에 그림을 그리는 중입니다. 다 그리면 바로 적용됩니다(되돌리기 가능) — 기다리지 말고 다음 작업을 계속하세요.",
      data: { status: "generating", appearanceId: record.id, slot },
    };
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    return { ok: false, summary: error.message, issues: [{ severity: "error", code: error.code, message: error.message }] };
  }
}
