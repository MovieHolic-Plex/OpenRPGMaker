// 영역 지정 AI 작업 오케스트레이션. 기존 AssistantSession을 그대로 재사용하되,
// 메시지에 표준 [컨텍스트] 선택 영역 footer를 붙여(스펙 게이트 구간 격리 활성화)
// 지시를 보내고, 제안을 clipMapCellsToRegion으로 사각형에 하드-클립한 뒤,
// 스냅샷 1개 + store.replace로 적용한다(undo 1개).
//
// store/세션 싱글턴 의존을 deps로 분리해 단위 테스트가 가능하다.
// 개발 편의: 감사 로그·하네스·UI 이벤트 스트림을 RegionTaskLogExport 로 묶어 export 한다.
import {
  AssistantSession,
  type AuditEntry,
  type HarnessSnapshot,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import { recordAiActivityFromRegionLog } from "@/ai/activityLog";
import { configForLiteModel, loadAiConfig } from "@/ai/llmClient";
import { clearAgentGhostPreview, createThrottledAgentGhostPreviewUpdater } from "@/editor/agentGhostPreview";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { ensureBuildPalettePresets, BUILD_PALETTE_PRESETS } from "@/editor/panels/buildPaletteCore";
import { getTool } from "@/editor/tools";
import { store } from "@/project/store";
import { applyVocabSoftConfirmApprovals, extractVocabSoftConfirm } from "@/project/tileVocabulary";
import type { MapId, Project, TilesetDef } from "@/project/types";
import {
  formatLayoutValidationSummary,
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";
import { clipMapCellsToRegion, inRegion, type RegionRect } from "./clipToRegion";

export interface RegionTaskSessionLike {
  sendUserMessage(text: string, onEvent?: (event: SessionEvent) => void): Promise<TurnResult>;
  getProposedProject(): Project;
  getAuditEntries?(): readonly AuditEntry[];
  getHarnessSnapshot?(): HarnessSnapshot;
  exportAudit?(): string;
}

export interface RegionTaskDeps {
  getProject(): Project;
  applyProject(project: Project, label: string, mapId: MapId): void;
  createSession(project: Project, mapId: MapId): RegionTaskSessionLike;
}

export interface RegionTaskOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly instruction: string;
  readonly onEvent?: (event: SessionEvent) => void;
}

export interface RegionTaskUiEvent {
  readonly at: string;
  readonly type: SessionEvent["type"] | "result";
  readonly text: string;
  readonly toolName?: string;
  readonly toolOk?: boolean;
  readonly toolArgs?: Record<string, unknown>;
  readonly toolSummary?: string;
}

/** 영역 작업 한 턴의 개발용 export 페이로드. */
export interface RegionTaskLogExport {
  readonly kind: "region-task-log";
  readonly exportedAt: string;
  readonly mapId: MapId;
  readonly mapName: string;
  readonly region: RegionRect;
  readonly instruction: string;
  readonly composedMessage: string;
  readonly result: {
    readonly ok: boolean;
    readonly applied: boolean;
    readonly changedCells: number;
    readonly changedEvents: number;
    readonly clippedCells: number;
    readonly proposedCalls: number;
    readonly assistantText: string;
    readonly error?: string;
    readonly stoppedReason?: TurnResult["stoppedReason"];
  };
  readonly toolCalls: readonly {
    readonly name: string;
    readonly args: Record<string, unknown>;
    readonly summary: string;
    readonly softConfirm?: unknown;
  }[];
  readonly uiEvents: readonly RegionTaskUiEvent[];
  readonly audit: readonly AuditEntry[];
  readonly harness: HarnessSnapshot | null;
}

export interface RegionTaskResult {
  readonly ok: boolean;
  readonly applied: boolean;
  readonly changedCells: number; // 영역 안에서 실제 바뀐 셀 수.
  readonly changedEvents: number; // 영역 안 이벤트(NPC 등) 변경 수.
  readonly clippedCells: number; // 영역 밖에서 되돌린(막은) 셀 수.
  readonly proposedCalls: number;
  readonly assistantText: string;
  readonly error?: string;
  /** 배치 후 검증 실패 메시지(적용 거부 시). */
  readonly validationSummary?: string;
  /** 개발용 구조화 로그 — UI export / window.__rpgzzuRegionTaskLog */
  readonly log?: RegionTaskLogExport;
}

export function describeRegionTaskResult(result: RegionTaskResult): string {
  if (!result.ok) return `오류: ${result.error ?? "알 수 없는 오류"}`;
  if (!result.applied) {
    return result.changedCells === 0 && result.changedEvents === 0
      ? "이 영역에서 바뀐 것이 없습니다."
      : "적용할 변경이 없습니다.";
  }
  const parts: string[] = [];
  if (result.changedCells > 0) parts.push(`${result.changedCells}칸 타일`);
  if (result.changedEvents > 0) parts.push(`이벤트 ${result.changedEvents}건`);
  const clipped = result.clippedCells > 0 ? ` · 영역 밖 ${result.clippedCells}칸 차단` : "";
  return `완료 — ${parts.join(" · ") || "변경 적용"}${clipped}`;
}

const defaultDeps: RegionTaskDeps = {
  getProject: () => store.getCurrent(),
  applyProject: (project, label, mapId) => {
    recordProjectSnapshot(label, mapId, { kind: "map" });
    store.replace(project);
  },
  createSession: (project, mapId) => new AssistantSession(project, {
    config: configForLiteModel(loadAiConfig()),
    contextOptions: { currentMapId: mapId },
  }),
};

export function buildRegionTaskLogExport(input: {
  readonly mapId: MapId;
  readonly mapName: string;
  readonly region: RegionRect;
  readonly instruction: string;
  readonly composedMessage: string;
  readonly result: Omit<RegionTaskResult, "log">;
  readonly turn?: TurnResult;
  readonly uiEvents: readonly RegionTaskUiEvent[];
  readonly session?: RegionTaskSessionLike;
}): RegionTaskLogExport {
  const audit = input.session?.getAuditEntries?.() ?? [];
  const harness = input.session?.getHarnessSnapshot?.() ?? null;
  const toolCalls = (input.turn?.proposedCalls ?? []).map((call) => ({
    name: call.name,
    args: call.args,
    summary: call.summary,
    ...(extractVocabSoftConfirm(call.result.data)
      ? { softConfirm: extractVocabSoftConfirm(call.result.data) }
      : {}),
  }));
  return {
    kind: "region-task-log",
    exportedAt: new Date().toISOString(),
    mapId: input.mapId,
    mapName: input.mapName,
    region: input.region,
    instruction: input.instruction,
    composedMessage: input.composedMessage,
    result: {
      ok: input.result.ok,
      applied: input.result.applied,
      changedCells: input.result.changedCells,
      changedEvents: input.result.changedEvents,
      clippedCells: input.result.clippedCells,
      proposedCalls: input.result.proposedCalls,
      assistantText: input.result.assistantText,
      ...(input.result.error ? { error: input.result.error } : {}),
      ...(input.turn ? { stoppedReason: input.turn.stoppedReason } : {}),
    },
    toolCalls,
    uiEvents: input.uiEvents,
    audit: [...audit],
    harness,
  };
}

export function serializeRegionTaskLog(log: RegionTaskLogExport): string {
  return JSON.stringify(log, null, 2);
}

/** 마지막 영역 작업 로그 — 콘솔/헤드리스 디버깅용. */
export function publishRegionTaskLog(log: RegionTaskLogExport | undefined): void {
  if (typeof window === "undefined" || !log) return;
  window.__rpgzzuRegionTaskLog = log;
  window.__rpgzzuLastRegionTaskLog = () => log;
}

function pushUiEvent(events: RegionTaskUiEvent[], event: SessionEvent): void {
  const at = new Date().toISOString();
  if (event.type === "status") {
    events.push({ at, type: "status", text: event.text });
    return;
  }
  if (event.type === "assistant_message") {
    events.push({ at, type: "assistant_message", text: event.content });
    return;
  }
  if (event.type === "tool_call") {
    events.push({
      at,
      type: "tool_call",
      text: event.result.summary || event.name,
      toolName: event.name,
      toolOk: event.result.ok,
      toolArgs: event.args,
      toolSummary: event.result.summary,
    });
    return;
  }
  if (event.type === "phase") {
    events.push({ at, type: "phase", text: `phase:${event.value}` });
  }
}

/** Combined Town 하네스 프리셋(나무/길/물 등)을 origin:user 로 승인해 place_props가 바로 쓰이게 한다. */
export function ensureRegionPlacementHarness(tileset: TilesetDef): void {
  ensureBuildPalettePresets(tileset);
}

/** 영역 메시지에 넣을 소품/지형 그룹 id 힌트(존재하면 soft-confirm 으로 바로 place_props 가능). */
export function formatApprovedPropVocabHint(tileset: TilesetDef | undefined): string {
  if (!tileset) return "- 소품 어휘: (타일셋 없음) harness-combined-town-conifer-tree 등 그룹 id 사용";
  const preferred = [
    BUILD_PALETTE_PRESETS.tree,
    BUILD_PALETTE_PRESETS.prop,
    BUILD_PALETTE_PRESETS.path,
    BUILD_PALETTE_PRESETS.water,
  ];
  const groups = tileset.tileGroups ?? [];
  const preferredFound = preferred
    .map((id) => groups.find((group) => group.id === id))
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
  const propish = groups.filter((group) =>
    group.role === "prop" || group.role === "terrain" || group.role === "water" || group.role === "fence"
    || /tree|prop|bush|flower|fence|path|water|road/i.test(group.id)
  );
  const ordered = [
    ...preferredFound,
    ...propish.filter((group) => !preferred.includes(group.id)),
  ];
  const unique = [...new Map(ordered.map((group) => [group.id, group])).values()].slice(0, 8);
  if (unique.length === 0) {
    return `- 소품 어휘: tile_query로 그룹 id를 찾아 place_props 호출 (없는 id만 실패, 미합의도 맵 목업 확인)`;
  }
  const list = unique.map((group) => `${group.id}(${group.name}/${group.role})`).join(", ");
  return `- 소품·지형 그룹 id(place_props/fill_region — 바로 호출, 미합의는 목업 확인): ${list}`;
}

// aiChatPanel.contextFooter와 동일한 [컨텍스트] 라인 포맷(buildSpec.ts의 정규식이 파싱).
// 이 라인이 있어야 세션이 선택 영역을 이번 턴의 암묵적 명세로 인식한다.
// 도메인 키워드(타일/npc)를 넣어 place_props·build_house_kit·place_npc 가 노출되게 한다.
export function buildRegionTaskMessage(
  instruction: string,
  mapName: string,
  mapId: MapId,
  region: RegionRect,
  tileset?: TilesetDef,
): string {
  const footer = `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (${region.x},${region.y}) ${region.width}×${region.height}`;
  const toolGuide = [
    "영역 작업 도구 규칙:",
    "- 집/건물: build_house_kit (벽 타일로 직사각 채우기 금지)",
    "- 나무/바위/꽃 산포: place_props + 아래 그룹 id (정식 id만, 예 harness-combined-town-conifer-tree). 같은 place_props는 1회",
    formatApprovedPropVocabHint(tileset),
    "- 지면/수역/바닥 면: fill_region — 호수=물 그룹(harness-combined-town-lake-water-autotile) + 원형·둥근은 shape=circle(필수). rect만 쓰면 네모. 타원=ellipse",
    "- 길/도로: paint_road { mapId, style:\"dirt\"|\"sand\", points:[{x,y},...] } — 흙길 오토타일 성형. 영역 안 동선·호수 둘레 산책로에 사용",
    "- 나무/소품: place_props — 물·호수 칸 위 금지. area는 호수 바깥 육지(통행 가능)만. 호수 채운 뒤 주변에 나무를 깔 것",
    "- 주민/NPC: place_npc 또는 make_villager — graphic 생략 시 villager 기본. 물 위 NPC 금지",
    "- 영역 작업은 즉시 적용된다. propose_tile_vocabulary 댄스는 하지 말 것",
    "- 영역 밖 타일·이벤트는 절대 수정하지 말 것",
  ].join("\n");
  // intent 스코핑용 키워드 — "맵" 단독 과활성은 피하고 타일/이벤트/소품 쓰기 도메인을 우선한다.
  const domainSeed = "(영역 작업: 타일 지형 나무 소품 집 npc 이벤트 주민)";
  return `${instruction.trim()}\n\n${domainSeed}\n${toolGuide}\n\n이 작업은 아래 선택 영역 안에서만 수행하라.\n${footer}`;
}

// 영역 안에서 base 대비 lower/upper가 바뀐 셀 수(적용 여부 판단·요약용).
export function countInRegionChangedCells(base: Project, next: Project, mapId: MapId, region: RegionRect): number {
  const baseMap = base.maps[mapId];
  const nextMap = next.maps[mapId];
  if (!baseMap || !nextMap) return 0;
  if (baseMap.width !== nextMap.width || baseMap.height !== nextMap.height) return 0;
  const { width, height } = baseMap;
  let changed = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inRegion(x, y, region)) continue;
      const i = y * width + x;
      if (nextMap.lowerTiles[i] !== baseMap.lowerTiles[i] || nextMap.upperTiles[i] !== baseMap.upperTiles[i]) changed += 1;
    }
  }
  return changed;
}

/** 영역 안 이벤트(NPC 등) 추가·삭제·이동·이름 변경 수. */
export function countInRegionChangedEvents(base: Project, next: Project, mapId: MapId, region: RegionRect): number {
  const baseMap = base.maps[mapId];
  const nextMap = next.maps[mapId];
  if (!baseMap || !nextMap) return 0;
  const baseInside = (baseMap.events ?? []).filter((event) => inRegion(event.x, event.y, region));
  const nextInside = (nextMap.events ?? []).filter((event) => inRegion(event.x, event.y, region));
  const baseById = new Map(baseInside.map((event) => [event.id, event]));
  const nextById = new Map(nextInside.map((event) => [event.id, event]));
  let changed = 0;
  for (const [id, event] of nextById) {
    const prev = baseById.get(id);
    if (!prev) {
      changed += 1;
      continue;
    }
    const prevName = prev.pages?.[0]?.name;
    const nextName = event.pages?.[0]?.name;
    if (prev.x !== event.x || prev.y !== event.y || prevName !== nextName) changed += 1;
  }
  for (const id of baseById.keys()) {
    if (!nextById.has(id)) changed += 1;
  }
  return changed;
}

export async function runRegionTask(
  opts: RegionTaskOptions,
  deps: RegionTaskDeps = defaultDeps,
): Promise<RegionTaskResult> {
  const emptyBase = {
    ok: false,
    applied: false,
    changedCells: 0,
    changedEvents: 0,
    clippedCells: 0,
    proposedCalls: 0,
    assistantText: "",
  };
  const instruction = opts.instruction.trim();
  if (!instruction) return { ...emptyBase, error: "지시 내용이 비어 있습니다." };

  const base = deps.getProject();
  const map = base.maps[opts.mapId];
  if (!map) return { ...emptyBase, error: "맵을 찾을 수 없습니다." };

  // 영역 AI 세션용 작업본: 건축 팔레트와 동일 하네스로 나무/소품 그룹을 승인 상태로 연다.
  // (제로 부트스트랩 본선은 유지 — 여기만 region/build-palette 큐레이션 경로)
  const working = structuredClone(base);
  const workingMap = working.maps[opts.mapId];
  const workingTileset = workingMap ? working.tilesets[workingMap.tilesetId] : undefined;
  if (workingTileset) ensureRegionPlacementHarness(workingTileset);

  const session = deps.createSession(working, opts.mapId);
  const message = buildRegionTaskMessage(instruction, map.name, opts.mapId, opts.region, workingTileset);
  const uiEvents: RegionTaskUiEvent[] = [];
  const ghostPreviewUpdater = createThrottledAgentGhostPreviewUpdater({
    getBaseProject: () => base,
    getDraftProject: () => session.getProposedProject(),
    isWriteTool: (toolName) => getTool(toolName)?.mode === "write",
  });
  const onEvent = (event: SessionEvent): void => {
    pushUiEvent(uiEvents, event);
    opts.onEvent?.(event);
    ghostPreviewUpdater.handleToolCall(event);
  };

  const attachLog = (result: Omit<RegionTaskResult, "log">, turn?: TurnResult): RegionTaskResult => {
    const log = buildRegionTaskLogExport({
      mapId: opts.mapId,
      mapName: map.name,
      region: opts.region,
      instruction,
      composedMessage: message,
      result,
      turn,
      uiEvents,
      session,
    });
    publishRegionTaskLog(log);
    // 진단용: 영역 AI 실행마다 로컬+DB 활동 로그 (실패해도 작업 결과는 유지).
    const cfg = loadAiConfig();
    void recordAiActivityFromRegionLog(log, {
      model: cfg.model,
      liteModel: cfg.liteModel,
    }).catch(() => {
      /* ignore persistence failures */
    });
    return { ...result, log };
  };

  let turn: TurnResult;
  try {
    turn = await session.sendUserMessage(message, onEvent);
  } catch (cause) {
    ghostPreviewUpdater.cancel();
    clearAgentGhostPreview();
    const error = cause instanceof Error ? cause.message : String(cause);
    return attachLog({ ...emptyBase, error });
  }
  if (turn.stoppedReason === "error" || turn.stoppedReason === "aborted") {
    ghostPreviewUpdater.cancel();
    clearAgentGhostPreview();
  } else {
    ghostPreviewUpdater.flush();
  }
  clearAgentGhostPreview();

  if (turn.stoppedReason === "aborted") {
    return attachLog({
      ...emptyBase,
      proposedCalls: turn.proposedCalls.length,
      assistantText: turn.assistantText,
      error: turn.error ?? "사용자가 중단했습니다.",
    }, turn);
  }

  if (turn.stoppedReason === "error") {
    return attachLog({
      ...emptyBase,
      proposedCalls: turn.proposedCalls.length,
      assistantText: turn.assistantText,
      error: turn.error ?? "AI 처리 오류",
    }, turn);
  }

  const proposed = session.getProposedProject();
  // 영역 AI는 채팅 soft-confirm UI 없이 즉시 적용 — soft 재료도 이 시점에 합의 처리.
  const softs = turn.proposedCalls
    .map((call) => extractVocabSoftConfirm(call.result.data))
    .filter((soft): soft is NonNullable<typeof soft> => soft !== null);
  if (softs.length > 0) applyVocabSoftConfirmApprovals(proposed, softs);
  const { project: clipped, clippedCells } = clipMapCellsToRegion(base, proposed, opts.mapId, opts.region);
  const changedCells = countInRegionChangedCells(base, clipped, opts.mapId, opts.region);
  const changedEvents = countInRegionChangedEvents(base, clipped, opts.mapId, opts.region);

  // 타일만 보면 NPC-only 제안이 버려진다 — 이벤트 변경도 적용 조건에 포함.
  if (changedCells === 0 && changedEvents === 0) {
    return attachLog({
      ok: true,
      applied: false,
      changedCells: 0,
      changedEvents: 0,
      clippedCells,
      proposedCalls: turn.proposedCalls.length,
      assistantText: turn.assistantText,
    }, turn);
  }

  // 배치 후 검증: 물 위 나무, 나무 짝 깨짐, 지시 대비 나무 누락 등 → 적용 거부
  const toolNames = turn.proposedCalls.map((call) => call.name);
  const layoutIssues = validateLayoutPlacement(clipped, {
    mapId: opts.mapId,
    region: {
      x: opts.region.x,
      y: opts.region.y,
      width: opts.region.width,
      height: opts.region.height,
    },
    instruction,
    toolNames,
  });
  const blocking = layoutValidationBlocking(layoutIssues);
  if (blocking.length > 0) {
    const validationSummary = formatLayoutValidationSummary(layoutIssues);
    return attachLog({
      ok: false,
      applied: false,
      changedCells,
      changedEvents,
      clippedCells,
      proposedCalls: turn.proposedCalls.length,
      assistantText: turn.assistantText,
      error: validationSummary,
      validationSummary,
    }, turn);
  }

  deps.applyProject(clipped, `영역 작업: ${instruction.slice(0, 40)}`, opts.mapId);
  return attachLog({
    ok: true,
    applied: true,
    changedCells,
    changedEvents,
    clippedCells,
    proposedCalls: turn.proposedCalls.length,
    assistantText: turn.assistantText,
  }, turn);
}
