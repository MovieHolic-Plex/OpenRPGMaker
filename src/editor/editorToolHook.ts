// editor/editorToolHook.ts
// 헤드리스(Playwright) 에디터 조작 훅 — 플레이어의 __oprnInput 훅과 같은 계열.
// window.__oprnEditorTool(name, args)로 에디터 툴을 직접 실행한다.
// 쓰기 툴 성공 시 undo 스냅샷을 남기고 store에 반영하므로 Ctrl+Z 복구가 가능하다.

import { editorState } from "@/editor/editorState";
import {
  stampFootprintHouseKit,
  stampRectHouseKit,
  type FootprintHousePlan,
  type RectHousePlan,
  type RectHouseStampResult,
} from "@/editor/houseKit";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  applyBuildPalettePrimitive,
  ensureBuildPaletteTileGroups,
  type BuildPaletteApplyOptions,
  type BuildPalettePrimitive,
  type BuildPaletteResult,
  type BuildPaletteSelection,
} from "@/editor/panels/buildPaletteCore";
import { openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { runRegionTask, type RegionTaskMode, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { POLISH_INSTRUCTION } from "@/editor/regionTask/suggestedCommands";
import { commitChangeset, getTool, runTool } from "@/editor/tools";
import type { ToolResult } from "@/editor/tools";
import { passableCellCount } from "@/editor/tools/mapHelpers";
import {
  store,
  type ProjectE2ESnapshot,
  type ProjectFlushResult,
  type ReloadFromRemoteResult,
} from "@/project/store";
import { serialize } from "@/project/io";
import { supabaseProjectConfigDraft } from "@/project/supabaseProjectConfig";
import type { GameEvent, MapId, Project } from "@/project/types";
import { sha256HexText } from "@/util/sha256";

type RegionWrite = { readonly layer: "lower" | "upper"; readonly x: number; readonly y: number; readonly tile: number };

export type ProjectE2EDeniedResult = {
  readonly kind: "denied";
  readonly reason: "capability-required" | "target-mismatch" | "project-id-mismatch" | "payload-mismatch";
};

export type ProjectE2ERemoteProof = {
  readonly capability: string;
  readonly expectedCanonicalPayload: string;
  readonly expectedProjectId: string;
  readonly expectedTargetUrl: string;
};

export type ProjectE2EAuthorizedResult<T> = {
  readonly evidence: ProjectE2ESnapshot;
  readonly kind: "authorized";
  readonly result: T;
};

export type ProjectE2EInitializeStoreResult = { readonly projectId: string | null };
export type ProjectE2EReloadStoreResult = ReloadFromRemoteResult;

export type ProjectE2EInitializeResult = ProjectE2EDeniedResult | ProjectE2EAuthorizedResult<ProjectE2EInitializeStoreResult>;
export type ProjectE2EReloadResult = ProjectE2EDeniedResult | ProjectE2EAuthorizedResult<ProjectE2EReloadStoreResult>;

export type ProjectE2EBridge = Readonly<{
  flush: () => Promise<ProjectFlushResult>;
  currentProject: () => ProjectE2ESnapshot;
  initializeRemoteFixture: (
    input: { readonly blankProject: Project; readonly projectId: string; readonly title: string },
    proof: ProjectE2ERemoteProof,
  ) => Promise<ProjectE2EInitializeResult>;
  reloadRemote: (proof: ProjectE2ERemoteProof) => Promise<ProjectE2EReloadResult>;
}>;

type ProjectE2EBootstrap = {
  readonly capability: string;
  readonly credentialDigest: string;
  readonly projectId: string;
  readonly targetUrl: string;
};

// The dev server injects this Symbol-keyed, one-run envelope before app startup.
// It is consumed and deleted on install; capability and credential proof stay closure-private.
const PROJECT_E2E_BOOTSTRAP = Symbol.for("oprn:project-e2e.bootstrap");
const MIN_PROJECT_E2E_CAPABILITY_LENGTH = 32;
let projectE2EBootstrap: ProjectE2EBootstrap | null = null;

// 헤드리스 영역 작업 검증용. Phaser 캔버스 입력/LLM 없이 실제 store에 clip/적용을 재현한다.
type RegionTaskHarness = {
  currentMapId: () => MapId;
  setSelection: (selection: { mapId: MapId; x: number; y: number; width: number; height: number } | null) => void;
  readCell: (mapId: MapId, layer: "lower" | "upper", x: number, y: number) => number | null;
  /** 영역 안에서 아직 걸어 들어갈 수 있는 칸 수 — "아예 통행불가능하게" 를 실측할 유일한 창구. */
  passableCount: (mapId: MapId, area: { x: number; y: number; w: number; h: number }) => number | null;
  runMock: (mapId: MapId, region: RegionRect, writes: readonly RegionWrite[]) => Promise<RegionTaskResult>;
  /** writes 를 주면 모달이 그 결과로 자동 실행되어 제안 검토 UI 까지 렌더된다.
   *  mode:"polish" 는 다듬기 경로 — 승인 화면의 여백 프레임·어울림 지표가 이 값에서만 나온다. */
  openModal: (
    mapId: MapId,
    region: RegionRect,
    writes?: readonly RegionWrite[],
    events?: readonly GameEvent[],
    mode?: RegionTaskMode,
  ) => void;
};

type EditorToolHookWindow = Window & {
  __oprnEditorTool?: (name: string, args: Record<string, unknown>) => ToolResult;
  __oprnRegionTaskHarness?: RegionTaskHarness;
  // 헤드리스 건축 팔레트 — UI 드래그 없이 프리미티브/프리셋 시공을 재현(스냅샷+store 반영+자동저장 동일).
  __oprnBuildPalette?: (
    selection: BuildPaletteSelection,
    primitive: BuildPalettePrimitive,
    options?: BuildPaletteApplyOptions
  ) => BuildPaletteResult;
  // 하네싱 집 키트 시공 — 기준 집 문법(houseKit) 그대로. 커밋 게이트(신규 오류만 차단) 포함.
  __oprnHouseKit?: (mapId: MapId, plan: RectHousePlan) => RectHouseStampResult;
  // 임의 평면(ㄱ/ㄴ/ㄷ/ㅁ/O …) — 날개 사각형 합집합을 하네싱 국소 규칙으로 전개.
  __oprnFootprintHouse?: (mapId: MapId, plan: FootprintHousePlan) => RectHouseStampResult;
  __oprnProjectE2E?: ProjectE2EBridge;
  [PROJECT_E2E_BOOTSTRAP]?: unknown;
};

const MAP_ONLY_WRITE_TOOLS = new Set([
  "paint_tiles",
  "paint_road",
  "stamp_structure",
  "build_house",
  "build_house_kit",
  "build_house_lots",
  "build_village",
  "clear_region",
  "set_map_properties",
  "place_npc",
  "upsert_event",
  "move_event",
  "remove_event",
]);

function recordToolSnapshot(name: string, args: Record<string, unknown>): void {
  const mapId = typeof args.mapId === "string" ? args.mapId : null;
  if (mapId && MAP_ONLY_WRITE_TOOLS.has(name)) {
    recordProjectSnapshot(undefined, mapId, { kind: "map" });
    return;
  }
  recordProjectSnapshot();
}

export function installEditorToolHook(): void {
  if (typeof window === "undefined") return;
  const w = window as EditorToolHookWindow;
  if (import.meta.env.DEV) installProjectE2EBridge(w);
  w.__oprnEditorTool = (name, args) => {
    const ctx = { project: store.getCurrent() };
    const result = runTool(ctx, name, args, { dryRun: false });
    const tool = getTool(name);
    if (result.ok && tool?.mode === "write") {
      recordToolSnapshot(name, args);
      store.replace(ctx.project); // runTool이 성공 시 ctx.project를 커밋된 draft로 교체한다.
    }
    return result;
  };

  w.__oprnBuildPalette = (selection, primitive, options = {}) =>
    applyBuildPalettePrimitive(selection, primitive, options);

  w.__oprnHouseKit = (mapId, plan) => {
    const current = store.getCurrent();
    if (!current.maps[mapId]) return { ok: false, reason: `맵을 찾을 수 없습니다: ${mapId}` };
    const draft = structuredClone(current);
    // 키트 벽 세트가 문/창 배치의 "승인된 벽 어휘" 검사를 통과하도록 프리셋/승인 상태를 보장.
    const tileset = draft.tilesets[draft.maps[mapId].tilesetId];
    if (tileset) ensureBuildPaletteTileGroups(tileset);
    const result = stampRectHouseKit(draft.maps[mapId], plan);
    if (!result.ok) return result;
    const commit = commitChangeset(draft, current);
    if (!commit.ok) {
      const issue = commit.issues.find((entry) => entry.severity === "error");
      return { ok: false, reason: issue?.message ?? "무결성 오류" };
    }
    recordProjectSnapshot(`집 키트: ${plan.kitId}`, mapId, { kind: "map" });
    store.replace(draft);
    return result;
  };

  w.__oprnFootprintHouse = (mapId, plan) => {
    const current = store.getCurrent();
    if (!current.maps[mapId]) return { ok: false, reason: `맵을 찾을 수 없습니다: ${mapId}` };
    const draft = structuredClone(current);
    const tileset = draft.tilesets[draft.maps[mapId].tilesetId];
    if (tileset) ensureBuildPaletteTileGroups(tileset);
    const result = stampFootprintHouseKit(draft.maps[mapId], plan);
    if (!result.ok) return result;
    const commit = commitChangeset(draft, current);
    if (!commit.ok) {
      const issue = commit.issues.find((entry) => entry.severity === "error");
      return { ok: false, reason: issue?.message ?? "무결성 오류" };
    }
    recordProjectSnapshot(`평면 집 키트: ${plan.kitId}`, mapId, { kind: "map" });
    store.replace(draft);
    return result;
  };

  w.__oprnRegionTaskHarness = {
    currentMapId: () => editorState.get().currentMapId ?? store.getCurrent().startMapId,
    setSelection: (selection) => editorState.set({ selection: selection ?? null }),
    readCell: (mapId, layer, x, y) => {
      const map = store.getCurrent().maps[mapId];
      if (!map) return null;
      const index = y * map.width + x;
      const value = layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index];
      return value ?? null;
    },
    passableCount: (mapId, area) => {
      const project = store.getCurrent();
      const map = project.maps[mapId];
      if (!map) return null;
      return passableCellCount(project, map, area);
    },
    // 결정적 세션(주어진 writes를 proposed로 산출)을 주입해 승인 게이트까지 재현한다 —
    // 적용하려면 반환된 result.pending.apply() 또는 window.__oprnRegionTaskPending.apply()를 호출.
    runMock: (mapId, region, writes) => runMockRegionTask(mapId, region, writes, "headless mock"),
    // 모달을 통째로 목업 실행에 물린다 — 제안 검토 UI(before/after, 변경 칸 하이라이트,
    // 적용/다시 만들기/버리기)는 실제 LLM 없이 이 경로로만 e2e 검증할 수 있다.
    openModal: (mapId, region: Parameters<typeof openRegionTaskModal>[0]["region"], writes, events, mode) => {
      // 타입 브리지는 projectId 기반 RegionTaskCtx로 변환하기 전 προσω μεταβατικό — strict 정밀화는 별도 PR
      openRegionTaskModal({
        mapId: mapId as string as never,
        region: region as never,
        ...(mode ? { mode } : {}),
        ...(writes
          ? {
              initialInstruction: mode === "polish"
                ? POLISH_INSTRUCTION
                : "여기에 둥근 호수를 만들어줘",
              autoRun: true,
              run: ({ instruction }: { instruction: string }) => runMockRegionTask(mapId as string as never, region as never, writes, instruction, events, mode),
            }
          : {}),
      });
    },
  };
}

export function cleanupProjectE2EBridge(): void {
  if (!import.meta.env.DEV) return;
  projectE2EBootstrap = null;
  if (typeof window === "undefined") return;
  const w = window as EditorToolHookWindow;
  delete w.__oprnProjectE2E;
  delete w[PROJECT_E2E_BOOTSTRAP];
}

function installProjectE2EBridge(w: EditorToolHookWindow): void {
  if (!import.meta.env.DEV) return;
  if (typeof navigator === "undefined" || navigator.webdriver !== true) {
    cleanupProjectE2EBridge();
    return;
  }
  if (w.__oprnProjectE2E) return;

  projectE2EBootstrap = consumeProjectE2EBootstrap(w);
  const methods = {
    flush: () => store.flush(),
    currentProject: () => store.getE2ESnapshot(),
    initializeRemoteFixture: async (input, proof) => {
      const bootstrap = await authorizeRemoteProjectCall(proof, input.blankProject, input.projectId);
      if ("kind" in bootstrap) return bootstrap;
      const result = await store.loadNewRemoteProjectForE2E(input.blankProject, {
        expectedAnonKeyDigest: bootstrap.credentialDigest,
        expectedCurrentProjectId: proof.expectedProjectId,
        expectedProjectId: input.projectId,
        expectedTargetUrl: normalizeTargetUrl(proof.expectedTargetUrl),
        title: input.title,
      });
      if ("kind" in result) return frozenDenial("target-mismatch");
      return frozenAuthorizedResult(result);
    },
    reloadRemote: async (proof) => {
      const bootstrap = await authorizeRemoteProjectCall(proof);
      if ("kind" in bootstrap) return bootstrap;
      const result = await store.reloadFromRemoteForE2E({
        expectedAnonKeyDigest: bootstrap.credentialDigest,
        expectedProjectId: proof.expectedProjectId,
        expectedTargetUrl: normalizeTargetUrl(proof.expectedTargetUrl),
      });
      if (result.kind === "target-mismatch") return frozenDenial("target-mismatch");
      return frozenAuthorizedResult(result);
    },
  } satisfies ProjectE2EBridge;
  w.__oprnProjectE2E = Object.freeze(methods);
}

function consumeProjectE2EBootstrap(w: EditorToolHookWindow): ProjectE2EBootstrap | null {
  const candidate = w[PROJECT_E2E_BOOTSTRAP];
  delete w[PROJECT_E2E_BOOTSTRAP];
  if (!isRecord(candidate)) return null;
  if (
    typeof candidate.capability !== "string"
    || candidate.capability.length < MIN_PROJECT_E2E_CAPABILITY_LENGTH
    || typeof candidate.credentialDigest !== "string"
    || !/^[a-f0-9]{64}$/.test(candidate.credentialDigest)
    || typeof candidate.projectId !== "string"
    || candidate.projectId.length === 0
    || typeof candidate.targetUrl !== "string"
    || candidate.targetUrl.length === 0
  ) {
    return null;
  }
  return Object.freeze({
    capability: candidate.capability,
    credentialDigest: candidate.credentialDigest,
    projectId: candidate.projectId,
    targetUrl: normalizeTargetUrl(candidate.targetUrl),
  });
}

async function authorizeRemoteProjectCall(
  proof: ProjectE2ERemoteProof,
  expectedProject?: Project,
  requestedProjectId?: string,
): Promise<ProjectE2EDeniedResult | ProjectE2EBootstrap> {
  const bootstrap = projectE2EBootstrap;
  if (!bootstrap || !constantTimeEqual(proof.capability, bootstrap.capability)) {
    return frozenDenial("capability-required");
  }
  if (requestedProjectId !== undefined && requestedProjectId !== bootstrap.projectId) {
    return frozenDenial("project-id-mismatch");
  }
  const snapshot = store.getE2ESnapshot();
  const expectedUrl = normalizeTargetUrl(proof.expectedTargetUrl);
  const effectiveConfig = supabaseProjectConfigDraft();
  const effectiveCredentialDigest = await sha256HexText(effectiveConfig.anonKey.trim());
  if (
    expectedUrl !== bootstrap.targetUrl
    || snapshot.effectiveTarget.url !== bootstrap.targetUrl
    || !constantTimeEqual(effectiveCredentialDigest, bootstrap.credentialDigest)
  ) {
    return frozenDenial("target-mismatch");
  }
  if (
    proof.expectedProjectId !== bootstrap.projectId
    || snapshot.effectiveTarget.projectId !== bootstrap.projectId
  ) {
    return frozenDenial("project-id-mismatch");
  }
  const canonicalPayload = expectedProject ? serialize(expectedProject) : snapshot.canonicalPayload;
  const [actualDigest, expectedDigest] = await Promise.all([
    sha256HexText(canonicalPayload),
    sha256HexText(proof.expectedCanonicalPayload),
  ]);
  if (!constantTimeEqual(actualDigest, expectedDigest)) return frozenDenial("payload-mismatch");
  return bootstrap;
}

function frozenAuthorizedResult<T>(result: T): ProjectE2EAuthorizedResult<T> {
  return deepFreeze({ kind: "authorized", result, evidence: store.getE2ESnapshot() });
}

function frozenDenial(reason: ProjectE2EDeniedResult["reason"]): ProjectE2EDeniedResult {
  return Object.freeze({ kind: "denied", reason });
}

function normalizeTargetUrl(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** runMock/openModal 공용 — 주어진 writes 를 proposed 로 산출하는 결정적 세션.
 *  events 를 주면 그 맵의 이벤트 목록에 덧붙인다 — 변경 목록(NPC·상자 줄) e2e 검증용. */
function runMockRegionTask(
  mapId: MapId,
  region: RegionRect,
  writes: readonly RegionWrite[],
  instruction: string,
  events?: readonly GameEvent[],
  mode?: RegionTaskMode,
): Promise<RegionTaskResult> {
  return runRegionTask(
        { mapId, region, instruction, ...(mode ? { mode } : {}) },
        {
          getProject: () => store.getCurrent(),
          applyProject: (project, label, snapshotMapId) => {
            recordProjectSnapshot(label, snapshotMapId, { kind: "map" });
            store.replace(project);
          },
          createSession: (project) => ({
            // 실제 세션은 tool_call 이벤트로 고스트 프리뷰 업데이터를 흘려보내지만,
            // 목업은 툴콜 스트림이 없으므로 여기서 직접 하나 흘려 캔버스 고스트/인라인
            // 승인 툴바가 실제 세션과 동일하게 렌더되도록 재현한다(writes 자체는 getProposedProject가 반영).
            sendUserMessage: async (_text, onEvent) => {
              if (writes.length > 0) {
                onEvent?.({ type: "tool_call", name: "paint_tiles", args: { mapId }, result: { ok: true, summary: "mock" } });
              }
              return { assistantText: "mock", proposedCalls: [], stoppedReason: "final" };
            },
            getProposedProject: () => {
              const next = structuredClone(project);
              const map = next.maps[mapId];
              if (map) {
                for (const write of writes) {
                  const index = write.y * map.width + write.x;
                  if (index < 0 || index >= map.lowerTiles.length) continue;
                  if (write.layer === "upper") map.upperTiles[index] = write.tile;
                  else map.lowerTiles[index] = write.tile;
                }
                if (events && events.length > 0) {
                  map.events = [...(map.events ?? []), ...structuredClone(events as GameEvent[])];
                }
              }
              return next;
            },
          }),
        },
      );
}
