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
import {
  activityToolCallsFromAudit,
  type ConstructionActivityDisposition,
} from "@/editor/construction/constructionActivity";
import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";
import {
  clearAgentGhostPreview,
  createThrottledAgentGhostPreviewUpdater,
  setAgentGhostPreviewHidden,
} from "@/editor/agentGhostPreview";
import { getInlineProposalActions, setInlineProposalActions, type InlineProposalActions } from "@/editor/proposalInlineApproval";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import { ensureBuildPalettePresets, BUILD_PALETTE_PRESETS } from "@/editor/panels/buildPaletteCore";
import { getTool } from "@/editor/tools";
import { store } from "@/project/store";
import { extractVocabSoftConfirm } from "@/project/tileVocabulary";
import { isBagGroupId, isBagMaterialQuery } from "@/project/materialPolicy";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { MapId, Project, TilesetDef } from "@/project/types";
import {
  formatLayoutValidationSummary,
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";
import { clipMapCellsToRegion, inRegion, type RegionRect } from "./clipToRegion";
import { regionIntentGuideLines, routeRegionIntent } from "./regionIntentRouter";
import { getPendingRegionApply, setPendingRegionApply, type PendingRegionApply } from "./pendingRegionApply";
import { dispatchRegionTaskStatus } from "./regionTaskStatus";

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
  /** 기본 "approval": 적용 전 승인 게이트. "immediate"는 레거시 즉시 적용. */
  readonly gate?: "approval" | "immediate";
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
    readonly ok: boolean;
    readonly summary: string;
    readonly softConfirm?: unknown;
    readonly construction?: ConstructionAuditRecord;
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
  /** 새로 추가된 맵 수(실내 파이프라인·create_map). 영역 셀 0이어도 적용 가치가 있다. */
  readonly mapsAdded?: number;
  readonly clippedCells: number; // 영역 밖에서 되돌린(막은) 셀 수.
  readonly proposedCalls: number;
  readonly assistantText: string;
  readonly error?: string;
  /** 배치 후 검증 실패 메시지(적용 거부 시). */
  readonly validationSummary?: string;
  /** 개발용 구조화 로그 — UI export / window.__rpgzzuRegionTaskLog */
  readonly log?: RegionTaskLogExport;
  /** 승인 게이트(gate: "approval") 성공 시 반환 — 적용/버리기 전까지 유효. */
  readonly pending?: PendingRegionApply;
}

function hasRegionTaskChanges(result: Pick<RegionTaskResult, "changedCells" | "changedEvents" | "mapsAdded">): boolean {
  return result.changedCells > 0 || result.changedEvents > 0 || (result.mapsAdded ?? 0) > 0;
}

function formatRegionTaskChangeParts(result: Pick<RegionTaskResult, "changedCells" | "changedEvents" | "mapsAdded">): string[] {
  const parts: string[] = [];
  if (result.changedCells > 0) parts.push(`${result.changedCells}칸 타일`);
  if (result.changedEvents > 0) parts.push(`이벤트 ${result.changedEvents}건`);
  if ((result.mapsAdded ?? 0) > 0) parts.push(`맵 ${result.mapsAdded}개 추가`);
  return parts;
}

export function describeRegionTaskResult(result: RegionTaskResult): string {
  if (!result.ok) return `오류: ${result.error ?? "알 수 없는 오류"}`;
  if (result.pending && !result.pending.settled) {
    return `제안 준비 — ${formatRegionTaskChangeParts(result).join(" · ") || "변경"} · 적용 여부를 선택하세요`;
  }
  if (!result.applied) {
    return hasRegionTaskChanges(result)
      ? "적용할 변경이 없습니다."
      : "이 영역에서 바뀐 것이 없습니다.";
  }
  const parts = formatRegionTaskChangeParts(result);
  const clipped = result.clippedCells > 0 ? ` · 영역 밖 ${result.clippedCells}칸 차단` : "";
  return `완료 — ${parts.join(" · ") || "변경 적용"}${clipped}`;
}

/** proposed에 생기고 base에 없는 맵 수. */
export function countAddedMaps(base: Project, proposed: Project): number {
  let added = 0;
  for (const id of Object.keys(proposed.maps)) {
    if (!base.maps[id]) added += 1;
  }
  return added;
}

const defaultDeps: RegionTaskDeps = {
  getProject: () => store.getCurrent(),
  applyProject: (project, label, mapId) => {
    recordProjectSnapshot(label, mapId, { kind: "map" });
    store.replace(project);
  },
  createSession: (project, mapId) => new AssistantSession(project, {
    config: configForLiteModel(loadAiConfig()),
    contextOptions: {
      currentMapId: mapId,
      getViewport: () => {
        const snap = getEditorMapViewport();
        return snap?.mapId === mapId ? snap : null;
      },
    },
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
  const hasChanges = hasRegionTaskChanges(input.result);
  const disposition: ConstructionActivityDisposition = input.result.applied
    ? "applied"
    : hasChanges
      ? "pending"
      : "no-change";
  const auditedCalls = activityToolCallsFromAudit(audit, disposition);
  const proposedCalls = input.turn?.proposedCalls ?? [];
  const toolCalls = auditedCalls.length > 0
    ? auditedCalls.map((call) => {
        const proposal = proposedCalls.find((candidate) => candidate.name === call.name);
        const softConfirm = extractVocabSoftConfirm(proposal?.result.data);
        return {
          ...call,
          ...(softConfirm === null ? {} : { softConfirm }),
        };
      })
    : proposedCalls.map((call) => ({
        name: call.name,
        args: call.args,
        ok: call.result.ok,
        summary: call.summary,
        ...(extractVocabSoftConfirm(call.result.data) === null
          ? {}
          : { softConfirm: extractVocabSoftConfirm(call.result.data) }),
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

/** 장식 박스 전용 그룹 참조(엔진 내부). 시공 public contract 는 material 라벨만. */
export const REGION_PROP_VOCAB = {
  woodBox: `${COMBINED_TOWN_HARNESS_PREFIX}wood-box`,
  fruitBox: `${COMBINED_TOWN_HARNESS_PREFIX}fruit-box`,
} as const;

/** 영역 메시지에 넣을 소품/지형 그룹 id 힌트(존재하면 soft-confirm 으로 바로 place_props 가능). */
export function formatApprovedPropVocabHint(tileset: TilesetDef | undefined): string {
  return formatMaterialLabelHint(tileset);
}

export function formatMaterialLabelHint(tileset: TilesetDef | undefined): string {
  if (!tileset) {
    return `- 소품 재료: (타일셋 없음) tile_query ask:"labels" — 예: "침엽수", "나무 상자", "과일박스" (가방·그룹 id 금지)`;
  }
  // 구체 소품 우선. 마을 소품(small-props) 가방은 시공 material 후보에서 제외.
  const preferred = [
    BUILD_PALETTE_PRESETS.tree,
    REGION_PROP_VOCAB.woodBox,
    REGION_PROP_VOCAB.fruitBox,
    BUILD_PALETTE_PRESETS.path,
    BUILD_PALETTE_PRESETS.water,
  ];
  const groups = tileset.tileGroups ?? [];
  const preferredFound = preferred
    .map((id) => groups.find((group) => group.id === id))
    .filter((group): group is NonNullable<typeof group> => Boolean(group) && !isBagGroupId(group.id));
  const propish = groups.filter((group) => {
    if (isBagGroupId(group.id) || isBagMaterialQuery(group.name)) return false;
    return (
      group.role === "prop" || group.role === "terrain" || group.role === "water" || group.role === "fence"
      || /tree|bush|flower|fence|path|water|road|box/i.test(group.id)
    );
  });
  const ordered = [
    ...preferredFound,
    ...propish.filter((group) => !preferred.includes(group.id)),
  ];
  const unique = [...new Map(ordered.map((group) => [group.id, group])).values()].slice(0, 10);
  if (unique.length === 0) {
    return `- 소품 재료: tile_query ask:"labels" 로 라벨/설명을 찾아 place_props material 에 넣기 (가방·그룹 id 금지)`;
  }
  const list = unique.map((group) => `${group.name}(${group.role})`).join(", ");
  return `- 소품·지형 material 라벨 예(place_props/fill_region — 가방·그룹 id 금지, 미합의는 목업 확인): ${list}`;
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
  const categories = routeRegionIntent(instruction);
  const intentGuides = regionIntentGuideLines(categories);
  const wantsInterior = categories.includes("interior");
  const toolGuide = [
    "영역 작업 도구 규칙:",
    wantsInterior
      ? "- 실내/방: start_interior_room_session 또는 run_interior_room_pipeline (새 mapId). 야외 build_house_kit 금지. create_map만 하고 끝내지 말 것"
      : "- 집/건물(야외 외장): build_house_kit (벽 타일로 직사각 채우기 금지). 실내·방 맵 요청에는 build_house_kit 금지 → 실내 세션 툴",
    "- 나무/바위/꽃 산포: place_props + material(타일 라벨/설명, 예 \"침엽수\"·\"꽃\"). 그룹 id·vocabId 금지. 같은 place_props는 1회",
    formatMaterialLabelHint(tileset),
    // 툴콜링 사고: "박스 2개" → small-props 가방. 구체 라벨만 허용.
    `- 장식 박스/나무상자/나무박스: place_props { material: \"나무 상자\", count:N }. 과일박스= material:\"과일박스\". 마을 소품/small-props 가방·place_chest로 대체 금지`,
    "- 보물상자(열면 아이템/골드·개봉 기억): place_chest 만. 보관/창고 상자(넣고 빼기): place_storage_chest. '박스'/'나무상자' 장식은 place_props — place_chest 금지",
    "- 지면/수역/바닥 면: fill_region { material:\"물\" 또는 \"잔디\" } + 원형·둥근은 shape=circle(필수). 그룹 id 금지. rect만 쓰면 네모. 타원=ellipse",
    "- 길/도로: paint_road { mapId, style:\"dirt\"|\"sand\", points:[{x,y},...] } — 흙길 오토타일 성형. 영역 안 동선·호수 둘레 산책로에 사용",
    "- 나무/소품: place_props — 물·호수 칸 위 금지. area는 호수 바깥 육지(통행 가능)만. 호수 채운 뒤 주변에 나무를 깔 것",
    "- 주민/NPC: place_npc 또는 make_villager — graphic 생략 시 villager 기본. 물 위 NPC 금지. 상점 NPC는 make_villager({shop}) 1회 또는 place_npc 1회(같은 역할 중복 금지)",
    `- tile_query ask:\"labels\" 는 mapId:\"${mapId}\" 를 넣어 현재 맵 타일셋 라벨만 조회(기본값=야외 타일셋 — 실내 맵에서 가로 탁자 등 오조회 주의)`,
    ...intentGuides,
    "- 지원하지 않는 요청 부분은 시도하지 말고, 마지막 응답에 '못 한 것: …' 한 줄로 명시하라",
    // "적용" 표기 금지: assistantToolMode.INTENT_KEYWORDS.battle.strong의 단음절 "적"과
    // 부분일치로 충돌해(2026-07-10 라이브 실측 수정) 이 고정 문구가 매 턴 battle+database
    // 도메인을 허위로 열고 노출 상한(40)을 잠식해 mirror_region 등 map/quest 도구를 밀어냈다.
    "- 결과는 사용자 승인 후에만 반영된다. propose_tile_vocabulary 댄스는 하지 말 것",
    wantsInterior
      ? "- 실내 요청: 새 맵 시공은 선택 영역 밖이어도 허용한다. 현재 맵 타일은 불필요하면 건드리지 말 것"
      : "- 영역 밖 타일·이벤트는 절대 수정하지 말 것",
  ].join("\n");
  // intent 스코핑용 키워드 — "맵" 단독 과활성은 피하고 타일/이벤트/소품 쓰기 도메인을 우선한다.
  // map/quest 등 다른 도메인 도구의 노출은 여기서 시드를 보태 여는 게 아니라, footer의
  // "현재 맵" 문구·가이드 문구 자체의 키워드(예: quest-trigger의 "퀘스트")로 이미 자연히
  // 열리고, 상한(40) 슬라이스에 밀리는 핵심 도구는 toolRegistry.PINNED_TOOLS_BY_DOMAIN이
  // 보장한다(2026-07-10 라이브 실측 수정 — 카테고리별 도메인 시드 병합은 A/B 실측상 효과가
  // 없는 죽은 복잡도로 판정돼 제거했다).
  const domainSeed = wantsInterior
    ? "(영역 작업: 타일 실내 방 맵 인테리어 집 npc 이벤트)"
    : "(영역 작업: 타일 지형 나무 소품 집 npc 이벤트 주민)";
  const scopeLine = wantsInterior
    ? "이 작업은 실내/새 맵 시공이다. 선택 영역은 참고용이며 새 맵 전체를 시공하라."
    : "이 작업은 아래 선택 영역 안에서만 수행하라.";
  return `${instruction.trim()}\n\n${domainSeed}\n${toolGuide}\n\n${scopeLine}\n${footer}`;
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
    mapsAdded: 0,
    clippedCells: 0,
    proposedCalls: 0,
    assistantText: "",
  };
  const instruction = opts.instruction.trim();
  if (!instruction) return { ...emptyBase, error: "지시 내용이 비어 있습니다." };

  const base = deps.getProject();
  const map = base.maps[opts.mapId];
  if (!map) return { ...emptyBase, error: "맵을 찾을 수 없습니다." };

  // 이전 pending의 onSettle(전역 고스트 정리)이 이번 실행의 프리뷰를 지우지 않도록 선-해소.
  getPendingRegionApply()?.discard();

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
  // 영역 경로에서는 soft 재료를 origin:user 로 자동 승격하지 않는다.
  // (채팅 카드의 [맵 적용 + 재료 합의]만 영구 합의 스탬프)
  // 실내/새 맵: clip은 현재 맵 영역 밖 타일만 되돌리고 다른 맵은 통과(clipToRegion 계약).
  // 다만 셀 0 + 맵 추가만 있으면 예전엔 통째로 폐기했다 → mapsAdded를 적용 조건에 포함한다.
  const { project: clipped, clippedCells } = clipMapCellsToRegion(base, proposed, opts.mapId, opts.region);
  const changedCells = countInRegionChangedCells(base, clipped, opts.mapId, opts.region);
  const changedEvents = countInRegionChangedEvents(base, clipped, opts.mapId, opts.region);
  const mapsAdded = countAddedMaps(base, clipped);

  // 타일만 보면 NPC-only·새 맵 only 제안이 버려진다 — 이벤트·맵 추가도 적용 조건에 포함.
  if (!hasRegionTaskChanges({ changedCells, changedEvents, mapsAdded })) {
    clearAgentGhostPreview();
    return attachLog({
      ok: true,
      applied: false,
      changedCells: 0,
      changedEvents: 0,
      mapsAdded: 0,
      clippedCells,
      proposedCalls: turn.proposedCalls.length,
      assistantText: turn.assistantText,
    }, turn);
  }

  // 배치 후 검증: 물 위 나무, 나무 짝 깨짐, 지시 대비 나무 누락 등 → 적용 거부
  // 새 맵만 추가된 경우(현재 맵 영역 무변경)에는 영역 레이아웃 검증을 건너뛴다.
  const toolNames = turn.proposedCalls.map((call) => call.name);
  if (changedCells > 0 || changedEvents > 0) {
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
      clearAgentGhostPreview();
      const validationSummary = formatLayoutValidationSummary(layoutIssues);
      return attachLog({
        ok: false,
        applied: false,
        changedCells,
        changedEvents,
        mapsAdded,
        clippedCells,
        proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText,
        error: validationSummary,
        validationSummary,
      }, turn);
    }
  }

  const gate = opts.gate ?? "approval";
  const label = `영역 작업: ${instruction.slice(0, 40)}`;
  if (gate === "immediate") {
    clearAgentGhostPreview();
    deps.applyProject(clipped, label, opts.mapId);
    return attachLog({
      ok: true,
      applied: true,
      changedCells,
      changedEvents,
      mapsAdded,
      clippedCells,
      proposedCalls: turn.proposedCalls.length,
      assistantText: turn.assistantText,
    }, turn);
  }

  // 승인 게이트: 적용하지 않고 pending 등록 + 고스트 유지 + 캔버스 인라인 툴바 배선.
  // regionInlineActions는 아래 setInlineProposalActions 호출 뒤에 값이 채워지지만,
  // onSettle 클로저는 호출 시점(apply/discard 이후)에야 실행되므로 참조만 잡아두면 된다.
  let regionInlineActions: InlineProposalActions | null = null;
  const pending = setPendingRegionApply({
    baseProject: base,
    clippedProject: clipped,
    mapId: opts.mapId,
    region: opts.region,
    changedCells,
    changedEvents,
    instruction,
    onApply: () => deps.applyProject(clipped, label, opts.mapId),
    // no-op: 아직 store에 아무 것도 반영하지 않았으므로(pending은 clipped를 들고만 있음) 되돌릴 것이 없다.
    onDiscard: () => {},
    onSettle: () => {
      // CAS: 이 pending이 등록한 actions가 여전히 전역 슬롯이면(다른 등록자가 덮어쓰지 않았으면)만 지운다.
      if (getInlineProposalActions() === regionInlineActions) setInlineProposalActions(null);
      setAgentGhostPreviewHidden(false);
      clearAgentGhostPreview();
      // apply/discard 어느 경로(모달 버튼·캔버스 인라인 툴바·닫기·새 작업의 자동 discard)로
      // settle 되든 배지/실행 상태를 여기서 한 번에 해제 — 개별 UI가 각자 해제하면 구멍이 생긴다.
      dispatchRegionTaskStatus({ mapId: opts.mapId, region: opts.region, running: false });
    },
  });
  regionInlineActions = {
    accept: () => pending.apply(),
    reject: () => pending.discard(),
    holdOrigin: {
      label: "원본 보기",
      start: () => setAgentGhostPreviewHidden(true),
      end: () => setAgentGhostPreviewHidden(false),
    },
  };
  setInlineProposalActions(regionInlineActions);
  const gated = attachLog({
    ok: true,
    applied: false,
    changedCells,
    changedEvents,
    mapsAdded,
    clippedCells,
    proposedCalls: turn.proposedCalls.length,
    assistantText: turn.assistantText,
  }, turn);
  return { ...gated, pending };
}
