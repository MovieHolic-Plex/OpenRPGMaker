// 스튜디오 감독 보드 데이터 빌더 — 열린 프로젝트(ProjectData)만 읽는다.
//
// 비트·인물·변수·엔딩·조우·파티·오프닝 컷 전부를 store 의 실제 프로젝트에서 계산한다.
// 장르별 예시 문구·고정 그림 경로를 두지 않는다: 프로젝트에 없는 것은 「없음」으로 보이고,
// 그 빈자리가 곧 결함 배지가 된다.

import { guessMapRole } from "@/ai/mapPlacementContext";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { listMapPlanningItems } from "@/editor/mapPlanningActions";
import { collectMapLinkGraph, type MapLinkNode } from "@/project/mapLinkStats";
import { promoteFaceToFullPortrait } from "@/player/dialogue";
import type { CinematicScene } from "@/project/cinematicSettings";
import type { Command, Condition, GameEvent, GameMap, LightingState, MapId, Project } from "@/project/types";

export type StudioDirectorGenre = "monster-taming" | "classic-jrpg" | "romance";
export type StudioDirectorTab = "flow" | "system" | "cinema";

export const GENRE_META: Readonly<Record<StudioDirectorGenre, {
  readonly label: string;
  readonly shortLabel: string;
  readonly systemTabLabel: string;
  readonly subtitle: string;
}>> = {
  "monster-taming": {
    label: "몬스터 수집",
    shortLabel: "몬스터 수집",
    systemTabLabel: "2. 몬스터 · 서식지 · 파티",
    subtitle: "시작 맵부터 이동 연결 순서로 맵을 펼치고, 실제 출현 테이블·지급 몬스터·트레이너 전투를 점검합니다.",
  },
  "classic-jrpg": {
    label: "정통 JRPG",
    shortLabel: "정통 JRPG",
    systemTabLabel: "2. 파티 · 적 · 엔딩",
    subtitle: "시작 맵부터 이동 연결 순서로 맵을 펼치고, 실제 파티 합류·전투·엔딩 트리거를 점검합니다.",
  },
  romance: {
    label: "연애 · 미연시",
    shortLabel: "연애 · 미연시",
    systemTabLabel: "2. 인물 · 호감도 · 엔딩",
    subtitle: "시작 맵부터 이동 연결 순서로 맵을 펼치고, 실제 호감도 변경·선택지·엔딩 도달 조건을 점검합니다.",
  },
};

/** 장르 판정은 저작자가 남긴 명시 신호만 쓴다. 기본 DB 에 깔린 몬스터 종 10개는 신호가 아니다. */
export function detectDirectorGenre(project: Project): StudioDirectorGenre {
  const s = project.system;
  const declared = [project.gameDesignBrief?.presetId, s.genre, s.genreLock?.preset]
    .filter((v) => typeof v === "string" && v.length > 0)
    .join(" ")
    .toLowerCase();
  if (/romance|dating|visual-novel|연애|미연시/.test(declared) || s.socialLoop || project.meta.oprnVnExtras || project.meta.oprnVnLook) {
    return "romance";
  }
  if (
    /monster|pokemon|creature|taming|몬스터/.test(declared)
    || s.monsterCampaign || s.monsterCollection === true || s.monsterBattleParty === true || s.battleModel === "gen1"
  ) {
    return "monster-taming";
  }
  return "classic-jrpg";
}

// ── 명령 순회 ─────────────────────────────────────────────────────────────

/** 중첩 명령(분기·선택지·루프·전투 결과 등)을 필드 이름에 묶이지 않고 모두 방문한다. */
export function walkCommands(commands: readonly Command[], visit: (command: Command) => void): void {
  const nested = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      if ("kind" in item && typeof item.kind === "string") {
        // 명령 배열 안의 kind 객체는 Command 유니언의 한 갈래다(저장 스키마가 보장).
        const child = item as Command;
        walkCommands([child], visit);
      } else {
        for (const inner of Object.values(item)) nested(inner);
      }
    }
  };
  for (const command of commands) {
    visit(command);
    for (const value of Object.values(command)) nested(value);
  }
}

function eventCommands(event: GameEvent, visit: (command: Command) => void): void {
  for (const page of event.pages ?? []) walkCommands(page.commands ?? [], visit);
}

export function portraitUrl(project: Project, resourceId: string | undefined, full = true): string | null {
  if (!resourceId) return null;
  const id = full ? promoteFaceToFullPortrait({ resourceId, position: "left", flipHorizontally: false })?.resourceId ?? resourceId : resourceId;
  return resolveAssetResourceUrl(id, { project }) ?? resolveAssetResourceUrl(resourceId, { project });
}

function eventFaceId(event: GameEvent): string | undefined {
  let found: string | undefined;
  eventCommands(event, (c) => {
    if (!found && c.kind === "changeFace" && c.resourceId) found = c.resourceId;
  });
  return found;
}

function eventLabel(event: GameEvent): string {
  return event.name?.trim() || event.id;
}

// ── 비트(맵) ──────────────────────────────────────────────────────────────

export type LightingPresetId = "day" | "sunset" | "night" | "fog";
export const LIGHTING_PRESETS: Readonly<Record<LightingPresetId, { readonly label: string; readonly lighting: LightingState | null }>> = {
  day: { label: "낮", lighting: null },
  sunset: { label: "노을", lighting: { ambient: 0.32, color: "#ff7a2f", sources: [] } },
  night: { label: "밤", lighting: { ambient: 0.62, color: "#0a1640", sources: [] } },
  fog: { label: "안개", lighting: { ambient: 0.35, color: "#c9d3dc", sources: [] } },
};

export function lightingPresetOf(lighting: LightingState | undefined): LightingPresetId | "custom" {
  if (!lighting || lighting.ambient <= 0) return "day";
  for (const id of ["sunset", "night", "fog"] as const) {
    const preset = LIGHTING_PRESETS[id].lighting;
    if (preset && preset.ambient === lighting.ambient && preset.color === lighting.color) return id;
  }
  return "custom";
}

export interface BeatEvent {
  readonly eventId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly kind: "npc" | "door" | "battle" | "ending" | "story";
  readonly firstLine: string | null;
  readonly portraitUrl: string | null;
}

export interface BeatLine {
  readonly eventId: string;
  readonly speaker: string;
  readonly text: string;
  readonly portraitUrl: string | null;
}

export interface BeatDefect {
  readonly badge: string;
  readonly detail: string;
  readonly aiPrompt: string;
}

export interface DirectorBeat {
  readonly id: string;
  readonly stepLabel: string;
  readonly mapId: MapId;
  readonly title: string;
  readonly mapMeta: string;
  readonly roleLabel: string;
  readonly isStart: boolean;
  readonly reachable: boolean;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly events: readonly BeatEvent[];
  readonly lines: readonly BeatLine[];
  readonly exits: readonly string[];
  readonly encounterCount: number;
  readonly encounterRate: number;
  readonly bgmResourceId: string | null;
  readonly lightingPreset: LightingPresetId | "custom";
  readonly lighting: LightingState | null;
  readonly planningNotes: readonly string[];
  readonly defects: readonly BeatDefect[];
}

const ROLE_LABEL: Record<string, string> = { town: "마을", dungeon: "던전", field: "필드", interior: "실내", unknown: "미분류" };

function mapEncounterCount(map: GameMap): number {
  const ids = new Set<string>();
  for (const e of map.encounterTable ?? []) ids.add(e.troopId);
  if (!map.encounterTable?.length) for (const t of map.troopIds ?? []) ids.add(t);
  for (const s of map.fieldSpawns ?? []) ids.add(s.troopId);
  return ids.size;
}

/** 시작 맵에서 이동 연결을 따라 BFS 한 순서, 도달 못 한 맵은 뒤에 붙인다. */
function orderMaps(project: Project, nodes: readonly MapLinkNode[]): GameMap[] {
  const byId = new Map(nodes.map((n) => [n.mapId, n]));
  const order: MapId[] = [];
  const seen = new Set<MapId>();
  const start = project.maps[project.startMapId] ? project.startMapId : Object.keys(project.maps)[0];
  const queue: MapId[] = start ? [start] : [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id) || !project.maps[id]) continue;
    seen.add(id);
    order.push(id);
    for (const edge of byId.get(id)?.outgoing ?? []) if (!seen.has(edge.to)) queue.push(edge.to);
  }
  for (const id of Object.keys(project.maps)) if (!seen.has(id)) order.push(id);
  return order.map((id) => project.maps[id]!).filter(Boolean);
}

export function buildBeats(project: Project, genre: StudioDirectorGenre): DirectorBeat[] {
  const nodes = collectMapLinkGraph(project);
  const nodeById = new Map(nodes.map((n) => [n.mapId, n]));
  const maps = orderMaps(project, nodes);
  const multiMap = maps.length > 1;
  const lastIndex = maps.length - 1;
  let projectHasEndingTrigger = false;
  let projectHasBattle = false;
  for (const map of maps) for (const ev of map.events) eventCommands(ev, (c) => {
    if (c.kind === "triggerEnding") projectHasEndingTrigger = true;
    if (c.kind === "battleProcessing") projectHasBattle = true;
  });

  return maps.map((map, index): DirectorBeat => {
    const node = nodeById.get(map.id);
    const isStart = map.id === project.startMapId;
    const reachable = isStart || Boolean(node?.reachableFromStart);
    const role = guessMapRole(project, map).role;
    const events: BeatEvent[] = [];
    const lines: BeatLine[] = [];
    const danglingDoors: string[] = [];
    for (const ev of map.events) {
      let firstLine: string | null = null;
      let speaker: string | null = null;
      let doorTarget: string | null = null;
      let kind: BeatEvent["kind"] = ev.pages?.some((p) => p.graphic?.sprite?.id || p.graphic?.appearanceId) ? "npc" : "story";
      const face = eventFaceId(ev);
      const portrait = portraitUrl(project, face, false);
      eventCommands(ev, (c) => {
        if (c.kind === "text" && c.body.trim()) {
          if (!firstLine) firstLine = c.body.trim();
          if (!speaker && c.speaker?.trim()) speaker = c.speaker.trim();
          if (lines.length < 40) lines.push({ eventId: ev.id, speaker: c.speaker?.trim() || eventLabel(ev), text: c.body.trim(), portraitUrl: portrait });
        } else if (c.kind === "transfer") {
          if (kind === "story") kind = "door";
          if (!doorTarget) doorTarget = project.maps[c.mapId]?.name || c.mapId;
          if (!project.maps[c.mapId]) danglingDoors.push(eventLabel(ev));
        } else if (c.kind === "battleProcessing") {
          kind = "battle";
        } else if (c.kind === "triggerEnding") {
          kind = "ending";
        }
      });
      // 생성 프로젝트의 이벤트 이름은 대개 내부 ID 라서, 화자·이동 목적지가 있으면 그쪽이 사람이 읽는 이름이다.
      // kind 는 콜백 안에서 바뀌므로 TS 의 좁히기를 풀어 다시 읽는다.
      const finalKind = kind as BeatEvent["kind"];
      const label = speaker ?? (finalKind === "door" && doorTarget ? `→ ${doorTarget}` : eventLabel(ev));
      events.push({ eventId: ev.id, name: label, x: ev.x, y: ev.y, kind, firstLine, portraitUrl: portrait });
    }
    const KIND_ORDER: Record<BeatEvent["kind"], number> = { ending: 0, battle: 1, npc: 2, story: 3, door: 4 };
    events.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || Number(Boolean(b.firstLine)) - Number(Boolean(a.firstLine)));
    const exits = [...new Set((node?.outgoing ?? []).map((e) => project.maps[e.to]?.name || e.to))];
    const encounterCount = mapEncounterCount(map);
    const name = map.name || map.id;
    const defects: BeatDefect[] = [];
    if (!reachable) {
      defects.push({
        badge: "도달 불가 맵",
        detail: `시작 맵 ${project.maps[project.startMapId]?.name ?? project.startMapId}에서 이동 이벤트를 따라가도 「${name}」에 닿지 않습니다.`,
        aiPrompt: `「${name}」이 시작 맵에서 도달 불가입니다. 이야기 흐름상 알맞은 이전 맵에 이 맵으로 가는 문/이동 이벤트를 만들어 연결해 줘.`,
      });
    }
    if (danglingDoors.length > 0) {
      defects.push({
        badge: `미연결 문 ${danglingDoors.length}`,
        detail: `없는 맵으로 이동하는 이벤트: ${danglingDoors.slice(0, 3).join(", ")}`,
        aiPrompt: `「${name}」의 이동 이벤트 ${danglingDoors.join(", ")}가 존재하지 않는 맵을 가리킵니다. 올바른 목적지로 다시 연결해 줘.`,
      });
    } else if (multiMap && exits.length === 0 && (node?.incoming.length ?? 0) === 0) {
      defects.push({
        badge: "미연결 문",
        detail: `「${name}」에는 들어오는 문도 나가는 문도 없습니다.`,
        aiPrompt: `「${name}」에 다른 맵과 이어지는 출입구(이동 이벤트)를 양방향으로 만들어 줘.`,
      });
    }
    if (genre === "monster-taming" && (role === "field" || role === "dungeon" || /길|숲|풀|route|forest|cave|동굴/i.test(name)) && encounterCount === 0) {
      defects.push({
        badge: "야생 출현 0종",
        detail: `「${name}」은 ${ROLE_LABEL[role] ?? role} 맵인데 출현 테이블·필드 스폰이 비어 있어 야생 몬스터를 만날 수 없습니다.`,
        aiPrompt: `「${name}」에 이 지역 분위기에 맞는 야생 몬스터 출현 테이블을 3~4종, 레벨 범위와 함께 구성해 줘.`,
      });
    }
    const npcCount = events.filter((e) => e.kind === "npc").length;
    if (npcCount > 0 && lines.length === 0) {
      defects.push({
        badge: "대사 0줄",
        detail: `인물 이벤트 ${npcCount}개가 있지만 말을 거는 대사가 하나도 없습니다.`,
        aiPrompt: `「${name}」의 인물 이벤트에 성격과 지역 맥락이 드러나는 대사를 2~3줄씩 써 줘.`,
      });
    }
    if (index === lastIndex && multiMap) {
      if (genre === "romance" && !projectHasEndingTrigger) {
        defects.push({
          badge: "엔딩 트리거 누락",
          detail: "프로젝트 어디에도 엔딩을 실행하는 이벤트(triggerEnding)가 없어 엔딩에 도달할 수 없습니다.",
          aiPrompt: `마지막 장면 「${name}」에 호감도 조건에 따라 엔딩을 실행하는 이벤트를 만들어 줘.`,
        });
      } else if (genre !== "romance" && !projectHasBattle && !projectHasEndingTrigger) {
        defects.push({
          badge: "보스/출구 누락",
          detail: "보스 전투도 엔딩 트리거도 없는 프로젝트라 이야기의 끝이 없습니다.",
          aiPrompt: `이동 순서상 마지막 맵 「${name}」에 클라이맥스 보스 전투와 엔딩 트리거를 배치해 줘.`,
        });
      }
    }
    const bgm = map.bgm?.mode === "custom" ? map.bgm.resourceId ?? null : null;
    return {
      id: `beat-${map.id}`,
      stepLabel: `장면 ${index}${isStart ? " · 시작" : ""}`,
      mapId: map.id,
      title: name,
      mapMeta: `${map.width}×${map.height} · 이벤트 ${map.events.length} · 대사 ${lines.length}줄`,
      roleLabel: ROLE_LABEL[role] ?? role,
      isStart,
      reachable,
      mapWidth: map.width,
      mapHeight: map.height,
      events,
      lines,
      exits,
      encounterCount,
      encounterRate: map.encounterRate ?? 0,
      bgmResourceId: bgm,
      lightingPreset: lightingPresetOf(map.defaultLighting),
      lighting: map.defaultLighting ?? null,
      planningNotes: listMapPlanningItems(map.id).filter((i) => i.status === "active").map((i) => i.text),
      defects,
    };
  });
}

// ── 장르 핵심 보드 ───────────────────────────────────────────────────────

export interface EventRef {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly label: string;
}

export interface CastCard {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly imageUrl: string | null;
  readonly imageKind: "portrait" | "battler";
  readonly facts: readonly string[];
  readonly event: EventRef | null;
  readonly warn: string | null;
}

export interface EndingRow {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  /** 편집 가능한 첫 수치 조건(호감도·변수). 없으면 null. */
  readonly threshold: { readonly index: number; readonly label: string; readonly value: number } | null;
  readonly conditionText: string;
  readonly reachable: boolean;
  readonly reason: string;
  readonly sources: readonly EventRef[];
}

export interface FlagRow {
  readonly id: string;
  readonly name: string;
  readonly kind: "switch" | "variable" | "friendship";
  readonly writers: readonly EventRef[];
  readonly readers: number;
  readonly warn: string | null;
}

export interface SystemBoard {
  readonly castTitle: string;
  readonly cast: readonly CastCard[];
  readonly endings: readonly EndingRow[];
  readonly flags: readonly FlagRow[];
  readonly stats: readonly { readonly label: string; readonly value: string; readonly warn?: boolean }[];
}

interface CommandIndex {
  readonly friendshipWriters: Map<string, EventRef[]>;
  readonly friendshipMax: Map<string, number>;
  readonly switchWriters: Map<string, EventRef[]>;
  readonly variableWriters: Map<string, EventRef[]>;
  readonly switchReaders: Map<string, number>;
  readonly variableReaders: Map<string, number>;
  readonly endingTriggers: Map<string, EventRef[]>;
  readonly anyEndingTrigger: EventRef[];
  choices: number;
  readonly battles: Map<string, EventRef[]>;
  readonly givenMonsters: Map<string, { level: number; ref: EventRef }>;
  readonly partyJoins: Map<string, EventRef[]>;
  readonly npcByKey: Map<string, { ref: EventRef; faceId?: string; lines: number }>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function indexCommands(project: Project): CommandIndex {
  const idx: CommandIndex = {
    friendshipWriters: new Map(), friendshipMax: new Map(), switchWriters: new Map(), variableWriters: new Map(),
    switchReaders: new Map(), variableReaders: new Map(), endingTriggers: new Map(), anyEndingTrigger: [],
    choices: 0, battles: new Map(), givenMonsters: new Map(), partyJoins: new Map(), npcByKey: new Map(),
  };
  for (const map of Object.values(project.maps)) {
    for (const ev of map.events) {
      const ref: EventRef = { mapId: map.id, eventId: ev.id, label: `${map.name || map.id} · ${eventLabel(ev)}` };
      let lines = 0;
      for (const page of ev.pages ?? []) {
        for (const cond of page.conditions ?? []) countConditionReads(cond, idx);
      }
      eventCommands(ev, (c) => {
        switch (c.kind) {
          case "text": lines += 1; break;
          case "choices": idx.choices += 1; break;
          case "changeFriendship": {
            const key = c.npcKey || ev.characterId || ev.id;
            push(idx.friendshipWriters, key, ref);
            if (c.delta > 0) idx.friendshipMax.set(key, (idx.friendshipMax.get(key) ?? 0) + c.delta);
            break;
          }
          case "setSwitch": push(idx.switchWriters, c.switchId, ref); break;
          case "setVariable": push(idx.variableWriters, c.variableId, ref); break;
          case "triggerEnding":
            if (c.endingId) push(idx.endingTriggers, c.endingId, ref);
            else idx.anyEndingTrigger.push(ref);
            break;
          case "battleProcessing": if (c.troopId) push(idx.battles, c.troopId, ref); break;
          case "giveMonster": if (!idx.givenMonsters.has(c.speciesId)) idx.givenMonsters.set(c.speciesId, { level: c.level, ref }); break;
          case "changeParty": if (c.action === "add") push(idx.partyJoins, c.actorId, ref); break;
          case "fork": countConditionReads(c.condition, idx); break;
          default: break;
        }
      });
      const key = ev.characterId || ev.id;
      if (!idx.npcByKey.has(key)) idx.npcByKey.set(key, { ref, faceId: eventFaceId(ev), lines });
    }
  }
  return idx;
}

function countConditionReads(cond: Condition, idx: CommandIndex): void {
  if (cond.kind === "switch") idx.switchReaders.set(cond.switchId, (idx.switchReaders.get(cond.switchId) ?? 0) + 1);
  else if (cond.kind === "variable") idx.variableReaders.set(cond.variableId, (idx.variableReaders.get(cond.variableId) ?? 0) + 1);
  else if (cond.kind === "all" || cond.kind === "any") for (const inner of cond.conditions) countConditionReads(inner, idx);
  else if (cond.kind === "not") countConditionReads(cond.condition, idx);
}

function npcDisplayName(project: Project, key: string, idx: CommandIndex): string {
  const character = project.characters?.[key]?.displayName;
  if (character) return character;
  const npc = idx.npcByKey.get(key);
  return npc ? npc.ref.label.split(" · ").slice(1).join(" · ") : key;
}

function buildEndingRows(project: Project, idx: CommandIndex): EndingRow[] {
  return (project.endings ?? []).map((ending): EndingRow => {
    const triggers = [...(idx.endingTriggers.get(ending.id) ?? []), ...idx.anyEndingTrigger];
    let threshold: EndingRow["threshold"] = null;
    const parts: string[] = [];
    let reachable = triggers.length > 0;
    let reason = triggers.length > 0 ? `엔딩 실행 이벤트 ${triggers.length}곳` : "이 엔딩을 실행하는 이벤트(triggerEnding)가 없음";
    const sources: EventRef[] = [...triggers];
    ending.conditions.forEach((cond, index) => {
      if (cond.kind === "friendshipAtLeast") {
        const key = cond.npcKey ?? "*";
        const who = key === "*" ? "누구든" : npcDisplayName(project, key, idx);
        parts.push(`${who} 호감도 ≥ ${cond.value}`);
        if (!threshold) threshold = { index, label: `${who} 호감도`, value: cond.value };
        const max = key === "*" ? Math.max(0, ...idx.friendshipMax.values()) : idx.friendshipMax.get(key) ?? 0;
        sources.push(...(key === "*" ? [...idx.friendshipWriters.values()].flat() : idx.friendshipWriters.get(key) ?? []).slice(0, 3));
        if (max < cond.value) {
          reachable = false;
          reason = `${who} 호감도는 모든 선택지를 더해도 최대 +${max} — 조건 ${cond.value}에 못 미침`;
        }
      } else if (cond.kind === "variable") {
        const name = project.variables.find((v) => v.id === cond.variableId)?.name || cond.variableId;
        parts.push(`${name} ${cond.op} ${cond.value}`);
        if (!threshold) threshold = { index, label: name, value: cond.value };
        const writers = idx.variableWriters.get(cond.variableId) ?? [];
        sources.push(...writers.slice(0, 3));
        if (writers.length === 0) { reachable = false; reason = `변수 「${name}」를 바꾸는 이벤트가 없음`; }
      } else if (cond.kind === "switch") {
        const name = project.switches.find((s) => s.id === cond.switchId)?.name || cond.switchId;
        parts.push(`${name} = ${cond.value ? "ON" : "OFF"}`);
        const writers = idx.switchWriters.get(cond.switchId) ?? [];
        sources.push(...writers.slice(0, 3));
        if (cond.value && writers.length === 0) { reachable = false; reason = `스위치 「${name}」를 켜는 이벤트가 없음`; }
      } else {
        parts.push(cond.kind);
      }
    });
    return {
      id: ending.id,
      name: ending.name || ending.id,
      priority: ending.priority,
      threshold,
      conditionText: parts.length > 0 ? parts.join(" · ") : "조건 없음 (기본 엔딩)",
      reachable,
      reason,
      sources,
    };
  });
}

function buildFlagRows(project: Project, idx: CommandIndex): FlagRow[] {
  const rows: FlagRow[] = [];
  for (const [key, writers] of idx.friendshipWriters) {
    rows.push({ id: `f:${key}`, name: `${npcDisplayName(project, key, idx)} 호감도`, kind: "friendship", writers, readers: 0, warn: null });
  }
  const named = <T extends { id: string; name: string }>(list: readonly T[], id: string) => list.find((v) => v.id === id)?.name || id;
  for (const [id, writers] of idx.variableWriters) {
    const readers = idx.variableReaders.get(id) ?? 0;
    rows.push({ id: `v:${id}`, name: named(project.variables, id), kind: "variable", writers, readers, warn: null });
  }
  for (const [id, writers] of idx.switchWriters) {
    const readers = idx.switchReaders.get(id) ?? 0;
    rows.push({ id: `s:${id}`, name: named(project.switches, id), kind: "switch", writers, readers, warn: readers === 0 ? "켜기만 하고 읽는 조건 없음" : null });
  }
  for (const [id, readers] of idx.switchReaders) {
    if (!idx.switchWriters.has(id)) rows.push({ id: `s:${id}`, name: named(project.switches, id), kind: "switch", writers: [], readers, warn: "조건에서 읽지만 켜는 이벤트 없음" });
  }
  for (const [id, readers] of idx.variableReaders) {
    if (!idx.variableWriters.has(id)) rows.push({ id: `v:${id}`, name: named(project.variables, id), kind: "variable", writers: [], readers, warn: "조건에서 읽지만 바꾸는 이벤트 없음" });
  }
  return rows.sort((a, b) => Number(Boolean(b.warn)) - Number(Boolean(a.warn)));
}

function actorPortrait(project: Project, actorId: string): string | null {
  const actor = project.database.actors.find((a) => a.id === actorId);
  if (!actor) return null;
  const app = actor.appearanceId ? project.database.characterAppearances?.find((a) => a.id === actor.appearanceId) : undefined;
  const id = app?.full?.resourceId ?? app?.bust?.resourceId ?? app?.face?.resourceId ?? actor.faceResourceId;
  return portraitUrl(project, id, true);
}

function speciesImage(project: Project, speciesId: string): string | null {
  const sp = project.database.monsterSpecies?.find((s) => s.id === speciesId);
  return resolveAssetResourceUrl(sp?.graphic.monsterResourceId, { project });
}

export function buildSystemBoard(project: Project, genre: StudioDirectorGenre): SystemBoard {
  const idx = indexCommands(project);
  const endings = buildEndingRows(project, idx);
  const flags = buildFlagRows(project, idx);
  const cast: CastCard[] = [];
  const db = project.database;
  let castTitle = "";

  if (genre === "romance") {
    castTitle = "공략 인물 · 실제 초상과 호감도 경로";
    const keys = new Set<string>([...idx.friendshipWriters.keys()]);
    for (const ending of project.endings ?? []) for (const c of ending.conditions) if (c.kind === "friendshipAtLeast" && c.npcKey && c.npcKey !== "*") keys.add(c.npcKey);
    for (const key of keys) {
      const npc = idx.npcByKey.get(key);
      const writers = idx.friendshipWriters.get(key) ?? [];
      const max = idx.friendshipMax.get(key) ?? 0;
      const myEndings = endings.filter((e) => (project.endings ?? []).find((x) => x.id === e.id)?.conditions.some((c) => c.kind === "friendshipAtLeast" && c.npcKey === key));
      const need = Math.max(0, ...myEndings.map((e) => e.threshold?.value ?? 0));
      cast.push({
        id: key,
        name: npcDisplayName(project, key, idx),
        role: npc ? npc.ref.label.split(" · ")[0] ?? "" : "배치 안 됨",
        imageUrl: portraitUrl(project, npc?.faceId, true),
        imageKind: "portrait",
        facts: [`호감 변경 ${writers.length}곳 · 최대 +${max}`, `대사 ${npc?.lines ?? 0}줄`, myEndings.length ? `개별 엔딩 ${myEndings.length} (≥${need})` : "개별 엔딩 없음"],
        event: npc?.ref ?? null,
        warn: !npc ? "맵에 배치된 이벤트 없음" : writers.length === 0 ? "호감도를 올리는 선택지 없음" : need > max ? `엔딩 조건 ${need} > 최대 ${max}` : null,
      });
    }
  } else if (genre === "monster-taming") {
    castTitle = "지급 · 출현 몬스터 (실제 종 데이터)";
    for (const [speciesId, given] of idx.givenMonsters) {
      const sp = db.monsterSpecies?.find((s) => s.id === speciesId);
      cast.push({
        id: `give-${speciesId}`, name: sp?.name ?? speciesId, role: `지급 Lv.${given.level}`,
        imageUrl: speciesImage(project, speciesId), imageKind: "battler",
        facts: [sp?.types?.join("/") || "타입 없음", `진화 ${sp?.evolutions?.length ?? 0}단계`, `포획률 ${sp?.captureRate ?? "-"}`],
        event: given.ref, warn: sp ? null : "종 데이터 없음",
      });
    }
    const wild = new Map<string, { maps: Set<string>; level: string }>();
    for (const map of Object.values(project.maps)) {
      for (const entry of map.encounterTable ?? []) {
        const troop = db.troops.find((t) => t.id === entry.troopId);
        for (const enemyId of troop?.enemyIds ?? []) {
          const sid = db.enemies.find((e) => e.id === enemyId)?.speciesId;
          if (!sid) continue;
          const row = wild.get(sid) ?? { maps: new Set<string>(), level: "" };
          row.maps.add(map.name || map.id);
          if (entry.levelMin) row.level = `Lv.${entry.levelMin}${entry.levelMax && entry.levelMax !== entry.levelMin ? `~${entry.levelMax}` : ""}`;
          wild.set(sid, row);
        }
      }
    }
    for (const [sid, row] of [...wild].slice(0, 12)) {
      const sp = db.monsterSpecies?.find((s) => s.id === sid);
      cast.push({
        id: `wild-${sid}`, name: sp?.name ?? sid, role: `야생 ${row.level}`.trim(),
        imageUrl: speciesImage(project, sid), imageKind: "battler",
        facts: [[...row.maps].slice(0, 2).join(", "), sp?.types?.join("/") || "타입 없음"],
        event: null, warn: sp?.graphic.monsterResourceId ? null : "전투 그림 없음",
      });
    }
  } else {
    castTitle = "파티 · 합류 동료 · 전투 상대 (실제 DB)";
    const partyIds = new Set<string>([...(project.system.startActorIds ?? []), ...idx.partyJoins.keys()]);
    for (const actorId of partyIds) {
      const actor = db.actors.find((a) => a.id === actorId);
      const joins = idx.partyJoins.get(actorId) ?? [];
      const initial = project.system.startActorIds?.includes(actorId);
      cast.push({
        id: actorId, name: actor?.name ?? actorId, role: initial ? "초기 파티" : "합류 동료",
        imageUrl: actorPortrait(project, actorId), imageKind: "portrait",
        facts: [`Lv.${actor?.initialLevel ?? "-"} · ${db.classes.find((c) => c.id === actor?.classId)?.name ?? "직업 없음"}`, initial ? "시작부터 동행" : `합류 이벤트 ${joins.length}곳`],
        event: joins[0] ?? null,
        warn: !actor ? "액터 레코드 없음" : !initial && joins.length === 0 ? "합류 이벤트 없음" : null,
      });
    }
    for (const [troopId, refs] of [...idx.battles].slice(0, 8)) {
      const troop = db.troops.find((t) => t.id === troopId);
      const enemy = db.enemies.find((e) => e.id === troop?.enemyIds[0]);
      cast.push({
        id: `troop-${troopId}`, name: troop?.name ?? troopId, role: "이벤트 전투",
        imageUrl: resolveAssetResourceUrl(enemy?.monsterResourceId, { project }), imageKind: "battler",
        facts: [`적 ${troop?.enemyIds.length ?? 0}체 · HP ${enemy?.stats.maxHp ?? "-"}`, refs[0]?.label ?? ""],
        event: refs[0] ?? null, warn: troop ? null : "적 그룹 없음",
      });
    }
  }

  const unreachable = endings.filter((e) => !e.reachable).length;
  const stats = [
    { label: "맵", value: String(Object.keys(project.maps).length) },
    { label: "선택지", value: String(idx.choices) },
    { label: "엔딩", value: `${endings.length - unreachable}/${endings.length} 도달 가능`, warn: unreachable > 0 },
    { label: "플래그 경고", value: String(flags.filter((f) => f.warn).length), warn: flags.some((f) => f.warn) },
  ];
  return { castTitle, cast, endings, flags, stats };
}

// ── 오프닝 ───────────────────────────────────────────────────────────────

export interface OpeningShot {
  readonly sceneId: string;
  readonly index: number;
  readonly kind: CinematicScene["kind"];
  readonly narration: string;
  readonly durationMs: number;
  readonly imageUrl: string | null;
  readonly scene: CinematicScene;
}

export interface OpeningSummary {
  readonly enabled: boolean;
  readonly totalMs: number;
  readonly musicResourceId: string | null;
  readonly shots: readonly OpeningShot[];
}

export function buildOpening(project: Project): OpeningSummary {
  const seq = project.system.opening;
  const shots = (seq?.scenes ?? []).map((scene, index): OpeningShot => ({
    sceneId: scene.id,
    index,
    kind: scene.kind,
    narration: scene.narration ?? "",
    durationMs: scene.durationMs,
    imageUrl: scene.kind === "image" ? resolveAssetResourceUrl(scene.resourceId, { project }) : null,
    scene,
  }));
  return {
    enabled: Boolean(seq?.enabled),
    totalMs: shots.reduce((sum, s) => sum + s.durationMs, 0),
    musicResourceId: seq?.musicResourceId ?? null,
    shots,
  };
}
