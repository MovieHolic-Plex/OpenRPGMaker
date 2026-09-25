// 맵 한 장의 "이게 무슨 맵인가"를 한 번에 모으는 순수 모델.
//
// 왜 별 파일인가: 맵 목록 행은 `width×height · N이벤트 · 문N` 만 보여줬다. 같은 규격으로
// 찍은 집 내부 10장이 **전부 같은 문자열**이 되어 목록이 식별 정보를 0 만큼 담았다(실측,
// sampleAdventure 16맵). 행을 늘리는 대신 선택한 맵의 상세를 옆 칸에 펼치기로 했고,
// 그 상세가 읽는 값들을 DOM 밖에서 계산해 단위테스트한다.
//
// mapLinkStats.ts 와의 역할 분담: 저 파일은 "이동 몇 개"라는 한 축만 센다(행이 매번 쓴다).
// 이 파일은 그 축을 포함해 타일셋·BGM·계층·이벤트 구성·인카운터·진단까지 묶는다 —
// 선택된 한 장에만 쓰이므로 비용이 행 렌더에 곱해지지 않는다.
import { collectMapLinkStats, type MapLinkStats } from "@/project/mapLinkStats";
import { findParentMapId, findTreeNode, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import type { Command, GameEvent, GameMap, MapId, Project } from "@/project/types";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";

/** 이벤트를 역할별로 나눈 수. 합은 `total` 이고 한 이벤트는 한 칸에만 들어간다. */
export interface MapEventBreakdown {
  readonly total: number;
  /** 다른 맵으로 보내는 이벤트 (transfer). */
  readonly door: number;
  /** 상점·여관 (shop / inn). */
  readonly shop: number;
  /** 보물상자 (openChest). */
  readonly chest: number;
  /** 말을 거는 이벤트 (text). */
  readonly npc: number;
  /** 위 어디에도 안 걸린 것 — 스위치 조작, 자동 실행 연출 등. */
  readonly other: number;
}

export type MapDiagnosticSeverity = "warning" | "info";

export interface MapDiagnostic {
  readonly id: string;
  readonly severity: MapDiagnosticSeverity;
  readonly text: string;
}

export interface MapEncounterSummary {
  readonly rate: number;
  readonly troopCount: number;
  readonly tableCount: number;
  readonly actionCombat: boolean;
  /** 조우율이 0 이면 표 nor 그룹이 있어도 안 뜬다 — GameMap.encounterRate 주석의 계약. */
  readonly enabled: boolean;
}

/** 맵 속성 중 켜져 있을 때만 의미가 있는 금지·모드 토글. 꺼진 것은 목록에 넣지 않는다. */
export interface MapOptionFlag {
  readonly id: string;
  readonly label: string;
}

export interface MapInspection {
  readonly mapId: MapId;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** width × height — "100×100" 이 실제로 몇 칸인지 감이 안 오는 문제 때문에 같이 낸다. */
  readonly tileCount: number;
  readonly tilesetName: string | null;
  readonly bgmLabel: string;
  readonly parentName: string | null;
  readonly childCount: number;
  readonly isStart: boolean;
  readonly events: MapEventBreakdown;
  readonly links: MapLinkStats;
  readonly encounter: MapEncounterSummary;
  readonly options: readonly MapOptionFlag[];
  readonly diagnostics: readonly MapDiagnostic[];
}

/**
 * 시작 맵에서 이동(transfer)·연결(mapConnection)만 타고 갈 수 있는 맵 집합.
 *
 * 트리 계층은 세지 않는다 — 부모 자식으로 묶어도 문이 없으면 플레이어는 못 간다
 * (mapList 의 `문0` 툴팁이 이미 같은 말을 한다). 연결은 양방향으로 본다.
 */
export function reachableMapIdsFromStart(project: Project): ReadonlySet<MapId> {
  const edges = new Map<MapId, Set<MapId>>();
  const link = (from: MapId, to: MapId): void => {
    if (from === to) return;
    const bucket = edges.get(from);
    if (bucket) bucket.add(to);
    else edges.set(from, new Set([to]));
  };
  for (const map of Object.values(project.maps)) {
    for (const command of collectCommands(map.events)) {
      if (command.kind === "transfer") link(map.id, command.mapId);
    }
  }
  for (const connection of project.mapConnections ?? []) {
    link(connection.from.mapId, connection.to.mapId);
    link(connection.to.mapId, connection.from.mapId);
  }
  const seen = new Set<MapId>();
  const queue: MapId[] = [project.startMapId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    for (const next of edges.get(current) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

/**
 * 맵 한 장의 상세. 맵이 없으면(분류 폴더 노드거나 지워진 id) null.
 *
 * `reachable` 을 밖에서 받는 이유: 도달성은 프로젝트 전체를 한 번 훑어야 나오는 값이고
 * 여러 맵을 잇달아 검사할 때 같은 계산을 반복할 이유가 없다. 안 주면 여기서 구한다.
 */
export function collectMapInspection(
  project: Project,
  mapId: MapId,
  reachable?: ReadonlySet<MapId>,
): MapInspection | null {
  const map = project.maps[mapId];
  if (!map) return null;
  const node = findTreeNode(project.mapTree, mapId);
  const parentId = findParentMapId(project.mapTree, mapId);
  const parentNode = parentId ? findTreeNode(project.mapTree, parentId) : null;
  const links = collectMapLinkStats(project, mapId);
  const events = breakdownEvents(map.events);
  const encounter = summarizeEncounter(map);
  const tileset = project.tilesets[map.tilesetId];
  const reachableSet = reachable ?? reachableMapIdsFromStart(project);
  return {
    mapId,
    name: map.name || mapId,
    width: map.width,
    height: map.height,
    tileCount: Math.max(0, map.width * map.height),
    tilesetName: tileset?.name ?? null,
    bgmLabel: bgmLabel(map),
    // 트리 루트가 부모여도 그 루트가 실제 맵이면 상위 맵이다 — 이 저장소의 트리는 루트가
    // 마을 맵이고 집 내부들이 그 자식이다. 루트를 건너뛰던 첫 판은 집 내부 10장 전부
    // 「상위 맵: 루트」로 읽혔다(실측). 합성 컨테이너(분류) 루트만 부모로 보지 않는다.
    parentName: parentNode && !(parentId === project.mapTree.mapId && isMapTreeFolder(parentNode))
      ? mapTreeNodeLabel(parentNode, project.maps)
      : null,
    childCount: node?.children.length ?? 0,
    isStart: project.startMapId === mapId,
    events,
    links,
    encounter,
    options: optionFlags(map),
    diagnostics: diagnose({ encounter, events, isStart: project.startMapId === mapId, links, map, reachable: reachableSet, tilesetMissing: tileset === undefined }),
  };
}

/** 한 이벤트를 어느 칸에 넣을지 — 앞에 오는 것이 이긴다. 문이 달린 상점은 문으로 센다. */
export function classifyMapEvent(event: GameEvent): keyof Omit<MapEventBreakdown, "total"> {
  const kinds = new Set<string>();
  for (const command of collectCommands([event])) kinds.add(command.kind);
  if (kinds.has("transfer")) return "door";
  if (kinds.has("shop") || kinds.has("inn")) return "shop";
  if (kinds.has("openChest")) return "chest";
  if (kinds.has("text")) return "npc";
  return "other";
}

function breakdownEvents(events: readonly GameEvent[]): MapEventBreakdown {
  let door = 0;
  let shop = 0;
  let chest = 0;
  let npc = 0;
  let other = 0;
  for (const event of events) {
    const bucket = classifyMapEvent(event);
    if (bucket === "door") door += 1;
    else if (bucket === "shop") shop += 1;
    else if (bucket === "chest") chest += 1;
    else if (bucket === "npc") npc += 1;
    else other += 1;
  }
  return { chest, door, npc, other, shop, total: events.length };
}

function summarizeEncounter(map: GameMap): MapEncounterSummary {
  const rate = map.encounterRate ?? 0;
  const troopCount = map.troopIds?.length ?? 0;
  const tableCount = map.encounterTable?.length ?? 0;
  return {
    actionCombat: map.actionCombat === true,
    enabled: rate > 0 && (troopCount > 0 || tableCount > 0),
    rate,
    tableCount,
    troopCount,
  };
}

/**
 * BGM 한 줄. 어휘는 맵 설정 대화상자(mapProps 의 BGM 탭)와 맞춘다 — 같은 값을 두 곳에서
 * 다르게 부르면 사용자가 서로 다른 설정인 줄 안다.
 *
 * 지정 곡일 때는 리소스 **id** 를 그대로 보여준다. 이 모듈은 프로젝트 데이터만 보므로
 * 번들 카탈로그(281곡)의 표시 이름을 알 수 없고, 모르는 이름을 지어내지 않는다.
 */
function bgmLabel(map: GameMap): string {
  const bgm = map.bgm;
  if (!bgm || bgm.mode === "parent") return "상위 맵/기본";
  if (bgm.mode === "none") return "무음";
  return bgm.resourceId && bgm.resourceId.length > 0 ? bgm.resourceId : "지정 안 됨";
}

function optionFlags(map: GameMap): readonly MapOptionFlag[] {
  const flags: MapOptionFlag[] = [];
  if (map.disableSave === true) flags.push({ id: "no-save", label: "세이브 금지" });
  if (map.disableTeleport === true) flags.push({ id: "no-teleport", label: "이동 금지" });
  if (map.loop) flags.push({ id: "loop", label: map.loop === "horizontal" ? "좌우 반복" : map.loop === "vertical" ? "상하 반복" : "사방 반복" });
  if (map.disableEscape === true) flags.push({ id: "no-escape", label: "도주 금지" });
  if (map.actionCombat === true) flags.push({ id: "action-combat", label: "액션 전투" });
  if ((map.safeZones?.length ?? 0) > 0) flags.push({ id: "safe-zone", label: `안전지대 ${map.safeZones?.length}` });
  if ((map.farmableArea?.length ?? 0) > 0) flags.push({ id: "farmable", label: "경작지" });
  if (map.minimap?.enabled === true) flags.push({ id: "minimap", label: "미니맵" });
  if (map.background !== undefined) flags.push({ id: "background", label: "배경 이미지" });
  return flags;
}

function diagnose(input: {
  readonly encounter: MapEncounterSummary;
  readonly events: MapEventBreakdown;
  readonly isStart: boolean;
  readonly links: MapLinkStats;
  readonly map: GameMap;
  readonly reachable: ReadonlySet<MapId>;
  readonly tilesetMissing: boolean;
}): readonly MapDiagnostic[] {
  const out: MapDiagnostic[] = [];
  if (input.tilesetMissing) {
    out.push({ id: "tileset-missing", severity: "warning", text: "타일셋이 없어 이 맵은 그려지지 않습니다." });
  }
  if (input.links.playLinkCount === 0) {
    out.push({ id: "unlinked", severity: "warning", text: "들어오거나 나가는 이동이 없습니다. 트리 계층만으로는 문이 생기지 않습니다." });
  } else if (!input.isStart && !input.reachable.has(input.map.id)) {
    out.push({ id: "unreachable", severity: "warning", text: "이동을 타고 시작 맵에서 여기까지 올 수 없습니다." });
  }
  if (input.map.encounterRate !== undefined && input.map.encounterRate > 0 && !input.encounter.enabled) {
    out.push({ id: "encounter-empty", severity: "warning", text: "조우율이 있는데 적 그룹과 인카운터 표가 모두 비어 있습니다." });
  }
  if (input.events.total === 0) {
    out.push({ id: "no-events", severity: "info", text: "이벤트가 없습니다. NPC·문·상자를 아직 놓지 않았습니다." });
  }
  return out;
}

/** 페이지가 있으면 모든 페이지, 없으면 event.commands — 분기 안까지 평탄화한다. */
export function collectCommands(events: readonly GameEvent[]): readonly Command[] {
  const out: Command[] = [];
  for (const event of events) {
    if (event.pages?.length) {
      for (const page of event.pages) walkCommands(page.commands, out);
    } else {
      walkCommands(event.commands, out);
    }
  }
  return out;
}

function walkCommands(commands: readonly Command[], out: Command[]): void {
  for (const command of commands) {
    out.push(command);
    if (command.kind === "choices") {
      for (const option of command.options) walkCommands(option.branch, out);
      if (command.cancelBranch) walkCommands(command.cancelBranch, out);
    }
    if (command.kind === "presentItem") for (const branch of presentItemBranchLists(command)) walkCommands(branch, out);
    if (command.kind === "fork") {
      walkCommands(command.then, out);
      if (command.else) walkCommands(command.else, out);
    }
    if (command.kind === "loop") walkCommands(command.body, out);
    if (command.kind === "shop" && command.transactionBranch) walkCommands(command.transactionBranch, out);
  }
}

/** 트리 노드가 맵이 아니라 분류 폴더인가 — 상세 칸이 "고를 게 없다"를 구분하는 데 쓴다. */
export function isFolderNode(project: Project, mapId: MapId): boolean {
  const node = findTreeNode(project.mapTree, mapId);
  return node !== null && isMapTreeFolder(node);
}
