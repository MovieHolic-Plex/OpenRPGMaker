// 모델이 손본 적·무리가 실제 싸움에 쓰이게 한다 — 길 맞춤 사본(troop_path_* · enemy_path_*)이 있는 원본을 고치면 그 사본을 걷고 싸움을 원본으로 되돌린다.
//
// 왜(2026-11-16 r6a 포구 마을, 플레이 결함 P5): 모델이 마지막 보스 enemy_v2_boss_dragon_blue 를 HP 700 · 새 기술로 고치고 troop_v2_boss_dragon_blue 를
// 모의전했는데, 보스 이벤트는 끝맺음이 먼저 만들어 둔 길 사본 troop_path_v2_boss_dragon_blue(HP 406)와 싸웠다 — 사본은 한 번 만들면 원본을 다시 읽지 않는다.
// 도구는 «수정» 이라고만 답해 모델은 쓰이지 않는 기록을 고치고 재고 있었다. 마지막 보스가 문지기(HP 580)보다 약하게 나갔다.
// 하는 일: 원본 적·무리를 고친 호출 뒤에 그 사본을 지우고 이벤트·조우표의 사본 id 를 원본으로 되돌린다 — 끝맺음의 길 전투 맞추기(path-battles)가
// 고친 원본에서 사본을 다시 만들어 맞춘다(내리기만). 모의전만 한 호출에는 어느 무리가 실제로 싸우는지 알린다. 돌려주는 글은 모델이 읽는다(영어).
import type { Project } from "@/project/types";
import { PATH_TROOP_PREFIX } from "./pathBattleBudget";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** 그 무리와 싸우는 맵 이벤트가 있는가. */
const fought = (project: Project, troopId: string): boolean => Object.values(project.maps).some((m) => JSON.stringify(m.events ?? []).includes(`"troopId":${JSON.stringify(troopId)}`));
const sourceOf = (project: Project, copyId: string): string | undefined => { const tail = copyId.slice(PATH_TROOP_PREFIX.length); return [`troop_${tail}`, tail].find((id) => project.database.troops.some((t) => t.id === id)); };
const membersOf = (troop: Project["database"]["troops"][number]): string[] => [...(troop.enemyIds ?? []), ...(troop.members ?? []).map((m) => m.enemyId)];

/**
 * 도구 호출 하나 뒤에 부른다(upsert_enemy · tune_enemy · upsert_troop · simulate_battle). 바꾼 프로젝트와 모델에게 줄 한 줄 — 할 일이 없으면 undefined.
 */
export function settleFoughtCopy(project: Project, tool: string, params: unknown): { project: Project; note: string } | undefined {
  const p = obj(params) ?? {};
  if (tool === "simulate_battle") {
    const troopId = str(p.troopId);
    if (!troopId || troopId.startsWith(PATH_TROOP_PREFIX)) return undefined;
    const copy = `${PATH_TROOP_PREFIX}${troopId.replace(/^troop_/u, "")}`;
    const troop = project.database.troops.find((t) => t.id === copy);
    if (!troop || !fought(project, copy) || fought(project, troopId)) return undefined;
    const lead = project.database.enemies.find((e) => e.id === membersOf(troop)[0]);
    return { project, note: `[Fought copy] Map events fight ${copy}, the copy fitted to the starting party${lead ? ` (enemy ${lead.id}, HP ${lead.stats?.maxHp ?? "?"})` : ""}, not ${troopId}. Simulate ${copy} to measure the real fight.` };
  }
  const enemyId = str(p.enemyId) ?? str(obj(p.enemy)?.id) ?? (tool === "upsert_enemy" ? str(p.id) : undefined);
  const troopId = str(obj(p.troop)?.id) ?? (tool === "upsert_troop" ? str(p.id) : undefined);
  const stale = project.database.troops.filter((t) => {
    if (!t.id.startsWith(PATH_TROOP_PREFIX)) return false;
    const tail = t.id.slice(PATH_TROOP_PREFIX.length);
    if (troopId && !troopId.startsWith(PATH_TROOP_PREFIX)) return troopId === `troop_${tail}` || troopId === tail;
    return !!enemyId && !enemyId.startsWith("enemy_path_") && membersOf(t).includes(`enemy_path_${tail}_${enemyId.replace(/^enemy_/u, "")}`);
  }).flatMap((t) => { const source = sourceOf(project, t.id); return source ? [{ copy: t.id, source, enemies: membersOf(t).filter((id) => id.startsWith(`enemy_path_${t.id.slice(PATH_TROOP_PREFIX.length)}_`)) }] : []; });
  if (!stale.length) return undefined;
  let maps = JSON.stringify(project.maps);
  for (const s of stale) maps = maps.split(JSON.stringify(s.copy)).join(JSON.stringify(s.source));
  const gone = new Set(stale.map((s) => s.copy)), goneEnemies = new Set(stale.flatMap((s) => s.enemies));
  const next = { ...project, maps: JSON.parse(maps) as Project["maps"], database: { ...project.database, troops: project.database.troops.filter((t) => !gone.has(t.id)), enemies: project.database.enemies.filter((e) => !goneEnemies.has(e.id)) } } as Project;
  return { project: next, note: `[Fought copy] ${stale.map((s) => `${s.copy} was the fitted copy the map fought; it is dropped and the fight uses ${s.source} again, with this edit`).join("; ")}. The finishing pass fits it once more to the starting party (it only lowers what makes the fight unwinnable or too long).` };
}
