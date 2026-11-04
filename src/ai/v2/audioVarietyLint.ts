// 조수 v2 — 전투 음악·효과음 다양성 검사.
// 왜(2026-11-04 폴른 스타): 전투 76개(맵 22개) 중 75개가 같은 곡(보스곡 재의 왕관)이었고, 효과음 하나(inventory-cloth)가
// 아이템·장비·합류·기어 나가기에 26번 쓰였다. 전투곡은 런타임과 같은 resolveBattleBgmResourceId(project/mapMusic.ts)로 푼다.
import type { LintIssue } from "@/project/lint/projectLint";
import { resolveBattleBgmResourceId } from "@/project/mapMusic";
import type { Project } from "@/project/types";

type Cmd = { kind?: unknown; commandId?: unknown; troopId?: unknown; resourceId?: unknown; channel?: unknown; loop?: unknown; fields?: Record<string, unknown>; [key: string]: unknown };

/** 보스전 이름 낱말 — set_game_audio role:boss 와 같다(src/editor/tools/musicAuthoringTools.ts BOSS_NAME). */
const BOSS_NAME = /보스|boss|마왕|魔王|드래곤|dragon|용왕|수문장|두목|우두머리|대장|관장|군주|lord|king|queen|ボス/i;
const USE_OF: Readonly<Record<string, string>> = {
  changeItem: "받기", changeGold: "받기", changeWeapon: "받기", changeArmor: "받기",
  changeEquipment: "장비", changeParty: "합류", transfer: "장소 이동", moveEvent: "움직임", setMoveRoute: "움직임",
  changeTile: "물건 변화", setEventGraphicPattern: "물건 변화", showPicture: "물건 변화",
  changeActorHp: "회복", changeActorMp: "회복", recoverAll: "회복", battleProcessing: "전투",
};

const ROUTE_KEYS = new Set(["moves", "route", "moveRoute", "movement", "conditions", "trigger", "graphic"]);
function eachList(node: unknown, visit: (list: Cmd[]) => void, depth = 0): void {
  if (depth > 24 || !node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    if (node.some((item) => item && typeof item === "object" && "kind" in (item as object))) visit(node as Cmd[]);
    for (const item of node) eachList(item, visit, depth + 1);
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) if (!ROUTE_KEYS.has(key) && value && typeof value === "object") eachList(value, visit, depth + 1);
}

const isBattleBgmCommand = (c: Cmd): boolean => c.kind === "m2Command" && c.commandId === "m2-027-change-system-bgm" && c.fields?.cue === "battle";
const isSe = (c: Cmd): boolean => (c.kind === "playAudio" && (c.channel === "se" || (c.channel === undefined && c.loop === false))) || c.kind === "playSe";

type Battle = { mapId: string; eventId: string; troopId: string; bgm: string | undefined; overridden: boolean };

function useAfter(list: readonly Cmd[], from: number): string | undefined {
  for (const next of list.slice(from)) {
    const use = USE_OF[String(next.kind)];
    if (use) return use;
    if (isSe(next)) return undefined;
  }
  return undefined;
}

function collect(project: Project): { battles: Battle[]; se: Map<string, { calls: number; uses: Set<string> }> } {
  const battles: Battle[] = [];
  const se = new Map<string, { calls: number; uses: Set<string> }>();
  const scan = (owner: unknown, mapId: string, eventId: string): void => eachList(owner, (list) => {
    let cue: string | undefined;
    for (let i = 0; i < list.length; i += 1) {
      const c = list[i]!;
      if (isBattleBgmCommand(c)) cue = c.fields?.operation === "set" ? String(c.fields?.resourceId ?? "").trim() || undefined : undefined;
      if (c.kind === "battleProcessing" && typeof c.troopId === "string") battles.push({ mapId, eventId, troopId: c.troopId, bgm: resolveBattleBgmResourceId(project, project.maps[mapId] ? mapId : undefined, cue), overridden: cue !== undefined });
      if (isSe(c) && typeof c.resourceId === "string" && c.resourceId) {
        const use = useAfter(list, i + 1);
        const row = se.get(c.resourceId) ?? { calls: 0, uses: new Set<string>() };
        row.calls += 1;
        if (use) row.uses.add(use);
        se.set(c.resourceId, row);
      }
    }
  });
  for (const [mapId, map] of Object.entries(project.maps)) for (const event of map.events ?? []) scan(event, mapId, event.id);
  for (const ce of project.commonEvents ?? []) scan(ce, "(공통 이벤트)", ce.id);
  return { battles, se };
}

function looksLikeBoss(project: Project, troopId: string): boolean {
  const troop = project.database.troops.find((t) => t.id === troopId);
  if (!troop) return false;
  if (BOSS_NAME.test(troop.name)) return true;
  const enemyIds = troop.members?.map((m) => m.enemyId) ?? troop.enemyIds;
  return enemyIds.some((id) => project.database.enemies.find((e) => e.id === id)?.collapseEffect === "bossSink");
}

// 임계값: 폴른 스타 기준선(전투 76개 중 75개가 한 곡, cloth 가 받기·장비·합류·움직임)은 잡고,
// 상자 도우미처럼 한두 가지 일에 반복된 소리는 놓아준다.
const MIN_BATTLE_MAPS = 3;
const UNIFORM_SHARE = 0.8;
const SE_MIN_CALLS = 10;
const SE_MIN_USES = 4;

export function lintAudioVariety(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  const { battles, se } = collect(project);
  // 일반 전투 = 그 전투 직전에 전투곡을 바꾸지 않은 것(role:boss 가 쓰는 m2-027 덮어쓰기가 없는 것). 덮어쓴 전투(보스·이름 있는 적수)를
  // 넣으면 보스곡이 「일반 곡」으로 세어져 진짜 보스가 오탐되고, 보스가 많으면 한 곡뿐인 일반 전투가 비율 아래로 숨는다(폴른 스타 r2 판정).
  const plain = battles.filter((b) => !b.overridden);
  const maps = new Set(plain.map((b) => b.mapId));
  const perCue = new Map<string, number>();
  for (const b of plain) perCue.set(b.bgm ?? "", (perCue.get(b.bgm ?? "") ?? 0) + 1);
  const [top, topCount] = [...perCue].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (maps.size >= MIN_BATTLE_MAPS && topCount >= plain.length * UNIFORM_SHARE) {
    const only = top || "(전투곡 없음)";
    issues.push({
      severity: "warning", code: "audio-battle-bgm-uniform",
      message: `일반 전투 ${plain.length}개(맵 ${maps.size}개) 중 ${topCount}개가 같은 전투곡 ${only} 을 튼다 — 지역(맵)마다 일반 전투곡을 따로 걸고(set_game_audio role:map-battle mapIds), 보스전은 보스곡(role:boss troopIds)으로. 곡은 recommend_bgm scene:battle / boss 로 고른다.`,
    });
  }
  const normal = new Set(plain.map((b) => b.bgm ?? ""));
  const reported = new Set<string>();
  for (const b of battles) {
    if (reported.has(b.troopId) || !looksLikeBoss(project, b.troopId) || !normal.has(b.bgm ?? "")) continue;
    reported.add(b.troopId);
    const name = project.database.troops.find((t) => t.id === b.troopId)?.name ?? b.troopId;
    issues.push({
      severity: "warning", code: "audio-boss-uses-default", mapId: b.mapId, eventId: b.eventId,
      message: `보스 「${name}」(${b.troopId}) 전투가 일반 전투와 같은 곡 ${b.bgm ?? "(없음)"} 을 튼다 — set_game_audio role:boss troopIds:["${b.troopId}"] 로 보스곡을 건다.`,
    });
  }
  for (const [resourceId, row] of se) {
    if (row.calls < SE_MIN_CALLS || row.uses.size < SE_MIN_USES) continue;
    issues.push({
      severity: "warning", code: "audio-se-overused",
      message: `효과음 ${resourceId} 하나가 ${row.calls}번, 서로 다른 일 ${row.uses.size}가지(${[...row.uses].join("·")}) 뒤에 쓰였다 — 받기·장비·합류·이동마다 그 일에 맞는 소리를 get_audio_resource/카탈로그 설명으로 고른다.`,
    });
  }
  return issues;
}
