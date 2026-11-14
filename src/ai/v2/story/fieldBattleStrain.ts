// ai/v2/story/fieldBattleStrain.ts
// 할 일 관문 «[게임 검사 전투 세기]» — 이번 실행에서 새로 둔 필드 전투(닿으면 싸우는 상징 적)를 시작 파티로 재 본다. 프로젝트는 바꾸지 않는다.
// (pathBattleBudget.ts 에서 옮겼다 — 길 위 전투 맞추기와 재료만 같이 쓴다.)
import { simulateBattle } from "@/battle/simulate";
import type { GameMap, Project } from "@/project/types";
import { buildsWholeGame } from "../request/readers";
import { WEAK_FOE_ASK } from "../request/combat";
import { tagged, type Finding } from "../judge/finding";
import { PATH_TROOP_PREFIX, PRE_BOSS_BUDGET, SAMPLES, eventBattles, partyOf, pathBattles, touchFoe } from "./pathBattleBudget";

/** 필드 상징 적 한 판 HP 손실 상한 — 「약한」 요청 35%(Lv1 슬라임 한 마리 ≈30%), 그 밖 50%. 길 위 예산(잡몹 20%)은 이어 싸움을 전제한 끝맺음 맞추기 값이라 경고 문턱으로는 너무 엄하다. */
const WEAK_LOSS = 0.35;
const FIELD_LOSS = 0.5;

/**
 * 이번 실행에서 새로 둔 필드 전투(닿으면 싸우는 상징 적)를 시작 파티로 재 본다 — 할 일 관문 «[게임 검사 전투 세기]».
 * 왜(2026-10-30 omo-fr-o opus 숲길): 「약한 몬스터가 있게」 요청에 시작 저장본의 «숲 말벌 무리»(슬라임 둘+동굴 박쥐 Lv6, 맨몸 승률 93%)를
 * 다른 적 셋과 한 숲에 두었고, 판정자는 앞 전투로 HP 272 가 된 채 그 무리에 져서 패배했다. 숲은 청사진 길 밖이라 fitPathBattlesIn 이 재지 않았다.
 * 재는 것: 무리마다 맨몸 모의(같은 시드·판 수) — 승률 100% 미만, 한 판 HP 손실 > 35%(「약한」 요청)·50%, 한 맵의 상징 적을 이어 싸운 손실 합 > 보스 앞 예산(60%).
 * 숲 말벌 무리는 모의 승률은 24/24 였지만 손실 73% — 이어 싸운 판정자가 졌다.
 * 고치기 안내는 같은 모의로 통과하는 기존 무리(적 HP 합이 작은 순 6개까지)를 이른다. 프로젝트는 바꾸지 않는다(사본·맞춤은 끝맺음 path-battles 몫).
 */
export function fieldBattleStrain(before: Project, after: Project, task: string): Finding[] {
  if (after.system.battleParty === "monsters" || after.system.monsterBattleParty === true) return [];
  const party = partyOf(after);
  if (!party) return [];
  // 게임 하나를 짓는 턴(이어 하기 턴도 — 끝맺음 assembly 묶음과 같은 판정)이면 끝맺음 path-battles 가 청사진 길 위 전투를 이미 맞췄다 — 그때만 길 위는 뺀다(장면 요청은 그 단계가 돌지 않는다).
  const onPath = new Set(buildsWholeGame(after, task) ? pathBattles(after).map((b) => `${b.mapId}#${b.troopId}`) : []);
  const weak = WEAK_FOE_ASK.test(task);
  const cache = new Map<string, { win: number; loss: number }>();
  const measure = (troopId: string) => {
    if (!cache.has(troopId)) {
      try {
        const r = simulateBattle({ project: after, troopId, heroLevel: party.level, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true });
        cache.set(troopId, { win: r.winRate, loss: Math.max(0, 1 - r.avgHpRemaining / party.hp) });
      } catch { cache.set(troopId, { win: 1, loss: 0 }); }
    }
    return cache.get(troopId)!;
  };
  const troopName = (id: string) => after.database.troops.find((t) => t.id === id)?.name ?? id;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const perMap: { name: string; ids: string[]; lines: string[] }[] = [];
  const bad = new Set<string>();
  for (const map of Object.values(after.maps)) {
    const prev = before.maps[map.id];
    // 새 이벤트이거나 싸우는 무리가 바뀐 이벤트만(페이지 JSON 비교는 정규화 차이로 시작 저장본 이벤트까지 잡았다).
    const sig = (event: GameMap["events"][number], p: Project) => eventBattles(p, event).map((b) => `${b.troopId}:${b.canEscape}`).join(",");
    const prevEvents = new Map((prev?.events ?? []).map((e) => [e.id, sig(e, before)]));
    const fresh: string[] = [];
    const ids: string[] = [];
    for (const event of map.events ?? []) {
      if (!touchFoe(event) || prevEvents.get(event.id) === sig(event, after)) continue;
      for (const b of eventBattles(after, event)) if (b.canEscape && !onPath.has(`${map.id}#${b.troopId}`)) { fresh.push(b.troopId); if (!ids.includes(event.id)) ids.push(event.id); }
    }
    // 무작위 조우는 combatChecks «[게임 검사 전투 난이도]»가 첫 구역에서 잰다 — 여기서는 보이는 적만.
    if (!fresh.length) continue;
    const name = map.name ?? map.id;
    const problems: string[] = [];
    for (const troopId of new Set(fresh)) {
      const m = measure(troopId);
      if (m.win < 1) { problems.push(`${name}: 「${troopName(troopId)}」(${troopId}) 를 시작 파티(Lv${party.level}) 맨몸으로 모의 ${SAMPLES}판 해 보니 승률 ${pct(m.win)}·HP 손실 ${pct(m.loss)} — 질 수 있는 필드 전투다`); bad.add(troopId); }
      else if (m.loss > (weak ? WEAK_LOSS : FIELD_LOSS)) { problems.push(`${name}: ${weak ? "요청은 «약한 몬스터»인데 " : ""}「${troopName(troopId)}」(${troopId}) 맨몸 한 판에 HP ${pct(m.loss)}가 깎인다(상한 ${pct(weak ? WEAK_LOSS : FIELD_LOSS)})`); bad.add(troopId); }
    }
    const chain = fresh.reduce((sum, id) => sum + measure(id).loss, 0);
    if (fresh.length > 1 && chain > PRE_BOSS_BUDGET) problems.push(`${name}: 이 맵의 필드 적 ${fresh.length}무리를 이어 싸우면 HP 손실 합 ${pct(chain)}(예산 ${pct(PRE_BOSS_BUDGET)}) — 회복 없이 가면 전멸한다`);
    if (problems.length) perMap.push({ name, ids, lines: problems });
  }
  if (!perMap.length) return [];
  const hp = (id: string) => (after.database.troops.find((t) => t.id === id)?.enemyIds ?? []).reduce((s, e) => s + (after.database.enemies.find((x) => x.id === e)?.stats.maxHp ?? 0), 0);
  const easy = after.database.troops.filter((t) => !bad.has(t.id) && !t.id.startsWith(PATH_TROOP_PREFIX)).sort((a, b) => hp(a.id) - hp(b.id)).slice(0, 6)
    .filter((t) => { const m = measure(t.id); return m.win >= 1 && m.loss >= 0.03 && m.loss <= WEAK_LOSS; }).map((t) => `${t.id}(${t.name ?? ""}, 손실 ${pct(measure(t.id).loss)})`);
  const fix = ` 필드 적의 troopId 를 시작 파티가 이기는 무리로 바꾸거나(${easy.length ? `예: ${easy.join(", ")}` : "upsert_troop 으로 적 한두 마리 무리를 만들고 simulate_battle 로 승률 100%·손실 35% 이하 확인"}) 수를 줄인다 — 이야기상 강한 적이면 회복 지점을 앞에 두고 보고에 적는다.`;
  // 맵마다 한 문제(이벤트 id 를 실어 기존 결함 가르기·관문 항목 열쇠가 맵 단위로 선다).
  return perMap.map((m) => tagged("game", "전투 세기", `${m.lines.join(" / ")} (이벤트 ${m.ids.join(", ")}).${fix}`));
}
