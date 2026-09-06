import { editorState } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { isActionCombatMap } from "@/project/actionCombat";
import { SEASONS, TIME_PHASES } from "@/project/gameTime";
import { store } from "@/project/store";
import type { EncounterConditions, GameMap, Rect, TroopRecord } from "@/project/types";
import { randomUuid } from "@/util/id";

export const WALK_FREQUENCIES = [
  { label: "드물게", rate: 10 }, { label: "보통", rate: 30 }, { label: "자주", rate: 60 },
] as const;

// Mutable form state; never attached to the project until apply.
export interface WalkEncounterChoice {
  kind: "enemy" | "troop";
  id: string;
  weight: number;
  conditions: Omit<EncounterConditions, "region">;
}
export interface WalkEncounterDraft {
  readonly mapId: string;
  readonly projectKey: string;
  readonly baseline: string;
  readonly originalRegion?: Rect;
  readonly needsLegacyChoice: boolean;
  region: Rect;
  rate: number;
  legacy: "undecided" | "preserve" | "replace";
  choices: WalkEncounterChoice[];
}
export type WalkEncounterResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

let projectEpoch = 0;
let lastConfiguration: { readonly projectKey: string; readonly choices: WalkEncounterChoice[] } | undefined;
store.subscribe((_project, change) => {
  if (change.projectSwitch) { projectEpoch += 1; lastConfiguration = undefined; }
});
function projectKey(): string { return `${JSON.stringify(store.getProjectIdentity())}:${projectEpoch}`; }
function encounterSignature(map: GameMap): string {
  return JSON.stringify([map.width, map.height, map.encounterRate, map.troopIds, map.encounterTable]);
}
export function sameEncounterRegion(a: Rect | undefined, b: Rect | undefined): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
export function walkEncounterRegions(map: GameMap): Rect[] {
  const regions: Rect[] = [];
  for (const entry of map.encounterTable ?? []) {
    const rect = entry.conditions?.region;
    if (rect && !regions.some((other) => sameEncounterRegion(rect, other))) regions.push({ ...rect });
  }
  return regions;
}
export function beginWalkEncounter(mapId: string, region: Rect, edit = false): WalkEncounterDraft {
  const map = store.getCurrent().maps[mapId];
  if (!map) throw new Error("맵을 찾을 수 없습니다.");
  return {
    mapId, projectKey: projectKey(), baseline: encounterSignature(map),
    ...(edit ? { originalRegion: { ...region } } : {}), region: { ...region },
    needsLegacyChoice: !(map.encounterTable?.length) && !!map.troopIds?.length,
    rate: (map.encounterRate ?? 0) > 0 ? map.encounterRate! : 30, legacy: "undecided",
    choices: edit ? (map.encounterTable ?? []).filter((entry) => sameEncounterRegion(entry.conditions?.region, region))
      .map((entry) => {
        const { region: _region, ...conditions } = entry.conditions ?? {};
        return { kind: "troop", id: entry.troopId, weight: entry.weight, conditions: structuredClone(conditions) };
      }) : [],
  };
}
export function reuseLastWalkEncounter(draft: WalkEncounterDraft): boolean {
  if (lastConfiguration?.projectKey !== draft.projectKey) return false;
  draft.choices = structuredClone(lastConfiguration.choices);
  // Rates belong to the destination map, not the copied rectangle.
  return true;
}
export function hasLastWalkEncounter(): boolean { return lastConfiguration?.projectKey === projectKey(); }

function currentDraftError(draft: WalkEncounterDraft): string | undefined {
  const project = store.getCurrent();
  const map = project.maps[draft.mapId];
  if (draft.projectKey !== projectKey() || (editorState.get().currentMapId ?? project.startMapId) !== draft.mapId || !map)
    return "맵이 바뀌었습니다. 닫고 현재 맵에서 다시 열어 주세요.";
  if (!canEditMap(draft.mapId)) return mapEditLockNotice(draft.mapId);
  if (draft.baseline !== encounterSignature(map)) return "출현 설정이 바뀌었습니다. 닫고 다시 열어 주세요. 입력은 적용되지 않았습니다.";
  return undefined;
}
function choicesError(draft: WalkEncounterDraft): string | undefined {
  const project = store.getCurrent();
  if (!draft.choices.length) return "만날 적을 하나 이상 골라 주세요.";
  for (const choice of draft.choices) {
    const records = choice.kind === "enemy" ? project.database.enemies : project.database.troops;
    if (!records.some((record) => record.id === choice.id)) return "선택한 적 또는 적 그룹이 없어졌습니다. 다시 골라 주세요.";
    if (!Number.isInteger(choice.weight) || choice.weight < 1 || choice.weight > 999) return "상대 비중은 1~999의 정수로 입력해 주세요.";
    const c = choice.conditions;
    if (c.switchId && !project.switches.some((record) => record.id === c.switchId)) return "조건 스위치를 다시 골라 주세요.";
    if (c.variableId && !project.variables.some((record) => record.id === c.variableId)) return "조건 변수를 다시 골라 주세요.";
    if ((c.variableId || c.atLeast !== undefined) && !Number.isFinite(c.atLeast)) return "변수 기준값을 숫자로 입력해 주세요.";
    for (const level of [c.minPartyLevel, c.maxPartyLevel]) {
      if (level !== undefined && (!Number.isInteger(level) || level < 1)) return "파티 레벨은 1 이상의 정수로 입력해 주세요.";
    }
    if (c.minPartyLevel !== undefined && c.maxPartyLevel !== undefined && c.minPartyLevel > c.maxPartyLevel)
      return "파티 최소 레벨은 최대 레벨보다 클 수 없습니다.";
    if (c.timePhase && !TIME_PHASES.includes(c.timePhase)) return "시간대를 다시 골라 주세요.";
    if (c.season && !SEASONS.includes(c.season)) return "계절을 다시 골라 주세요.";
  }
  return undefined;
}
export function isSimpleWalkTroop(troop: TroopRecord, enemyId: string): boolean {
  return troop.enemyIds.length === 1 && troop.enemyIds[0] === enemyId && troop.autoAlign
    && (!troop.members || (troop.members.length === 1 && troop.members[0]?.enemyId === enemyId && !troop.members[0].hidden))
    && !troop.trainerBattle && !troop.uncapturable && !troop.battleFlow && !troop.activeSlots
    && !troop.previewBackgroundResourceId && troop.battleEventPages.length === 0;
}

export function applyWalkEncounter(draft: WalkEncounterDraft, operation: "save" | "delete" = "save"): WalkEncounterResult {
  const stale = currentDraftError(draft);
  if (stale) return { ok: false, error: stale };
  const project = store.getCurrent();
  const map = project.maps[draft.mapId]!;
  if (operation === "delete" && !draft.originalRegion) return { ok: false, error: "삭제할 범위가 없습니다." };
  if (operation === "save") {
    if (isActionCombatMap(project, map)) return { ok: false, error: "실시간 전투 맵에서는 걷기 전투를 사용할 수 없습니다. 맵 전투 방식을 먼저 바꿔 주세요." };
    const r = draft.region;
    if (![r.x, r.y, r.w, r.h].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > map.width || r.y + r.h > map.height)
      return { ok: false, error: "맵 안의 사각형을 선택해 주세요." };
    if (!sameEncounterRegion(draft.originalRegion, r) && walkEncounterRegions(map).some((other) => sameEncounterRegion(other, r)))
      return { ok: false, error: "같은 범위에 설정이 있습니다. 목록에서 기존 설정을 편집해 주세요." };
    if (!Number.isFinite(draft.rate) || draft.rate <= 0 || draft.rate > 100) return { ok: false, error: "맵 출현 빈도는 0보다 크고 100 이하여야 합니다." };
    if (draft.needsLegacyChoice && draft.legacy === "undecided") return { ok: false, error: "기존 맵 전체 출현을 유지할지 골라 주세요." };
    const error = choicesError(draft);
    if (error) return { ok: false, error };
  }

  const label = `걸을 때 적 만나기 ${operation === "delete" ? "삭제" : draft.originalRegion ? "편집" : "추가"}`;
  recordProjectSnapshot(label, draft.mapId);
  store.update((next) => {
    const target = next.maps[draft.mapId]!;
    const entries = (target.encounterTable ?? []).filter((entry) => !sameEncounterRegion(entry.conditions?.region, draft.originalRegion));
    if (operation === "save") {
      if (draft.needsLegacyChoice && draft.legacy === "preserve") {
        entries.push(...(target.troopIds ?? []).map((troopId) => ({ troopId, weight: 1 })));
      } else if (draft.needsLegacyChoice && draft.legacy === "replace") {
        target.troopIds = [];
      }
      for (const choice of draft.choices) {
        let troopId = choice.id;
        if (choice.kind === "enemy") {
          let troop = next.database.troops.find((candidate) => isSimpleWalkTroop(candidate, choice.id));
          if (!troop) {
            troop = { id: `troop_walk_${randomUuid()}`, name: `${next.database.enemies.find((enemy) => enemy.id === choice.id)!.name} (걷기)`,
              enemyIds: [choice.id], autoAlign: true, battleEventPages: [] };
            next.database.troops.push(troop);
          }
          troopId = troop.id;
        }
        entries.push({ troopId, weight: choice.weight, conditions: { ...structuredClone(choice.conditions), region: { ...draft.region } } });
      }
      target.encounterRate = draft.rate;
    }
    if (entries.length) target.encounterTable = entries;
    else delete target.encounterTable;
  }, { scope: "project", label });
  if (operation === "save") lastConfiguration = { projectKey: draft.projectKey, choices: structuredClone(draft.choices) };
  return { ok: true };
}
