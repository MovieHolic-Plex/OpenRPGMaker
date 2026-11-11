// 몬스터 원정의 필수 전투를 스타터가 이길 수 있게 맞춘다(fitRequiredBattlesToStarters) — 길 순서대로 걸으며 레벨·체력·선물을 고친다.
import { typeChartMultiplierForTypes } from "@/battle/typeChart";
import { withJosa } from "@/util/josa";
import { monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import type { EnemyRecord, Project } from "@/project/types";
import { HP_EASY, HP_RAISE_CAP, starterLevel, troopExp, relevel } from "./monsterCampaign";
import { FIT_WIN_RATE, guardFitBudget } from "./monsterFitBudget";
import { starterChoices, mapHasHeal, walkRequired, campaignStages, catchableUpTo, campaignGifts, StarterOutcome, starterOutcome, giftAnchors } from "./monsterCampaignGifts";

/**
 * 필수 전투를 고를 수 있는 스타터 셋 각각이(경험치 나누기가 켜졌으면 잡을 수 있는 동료와 함께) 이길 수 있게 맞춘다. 순수 함수, 결정적·멱등.
 * 끝맺음에서 equipMonsterCampaign(경험치 나누기·체육관 회복 지점)과 관문·길 곡선 뒤에 돈다.
 *
 * 왜(2026-10-29 standin monster 「새싹 몬스터 모험」 런타임 세 스타터 판): 물 스타터는 풀 관장 Lv7 을 Lv10 에서도 0%, 풀 스타터는 1번길 트레이너를
 * Lv8 에서 33%, 비행 보스를 25% 이겼다. 레벨만 깎으면 관원 Lv2·보스 Lv5 — 긴장감이 없다. 그래서 깎기는 마지막 수단이다.
 *
 * 필수 전투 = 원정 맵의 이벤트 전투 중 도망칠 수 없고(canEscape ≠ true) 고르기 가지 안이 아닌 것(재대결·전설 조우·조우표 제외).
 * 순서 = 단계(관문 i: 그 관문 앞 길 → 관문 맵 관원 → 관문). 도착 레벨 = 스타터 레벨 + 앞 단계 필수 전투 경험치(그 종 곡선).
 * 같은 (단계, 순번) 묶음은 회복 없이 잇달아 싸운다고 보고 남은 HP 를 잇는다 — 맵에 회복 지점이 있으면(체육관 안내원) 판마다 회복한다.
 * 스타터마다 starterOutcome 이 80% 를 못 넘기면 순서대로:
 *  ① 관문이면 그 관문 단계까지의 길 하나(가장 늦은 단계, 같으면 가장 높은 야생 레벨)의 풀숲에 상성을 메울 종을 더한다 — 그 종의 적 레코드가 이미
 *     있고(그림) 잡을 수 있고, 잡히는 레벨에서 아는 피해 기술이 관문 몬스터에게 ×2 인 종. 길 야생 레벨 범위로, 가중치 3.
 *  ② 막힌 스타터가 나중에 배울 ×2 피해 기술 하나를 스타터 레벨로 당긴다(이미 그런 기술을 알면 안 함).
 *  ③ 트룹 적을 한 레벨씩 내린다 — 가장 약한 스타터 도착 레벨 −1 아래로는 안 내린다(모델 레벨 아래로는 가도 된다).
 *  ④ 그래도 못 이기는 관문 아닌 트룹은 몬스터를 길 풀숲 종으로 바꾸고 원래 레벨 쪽으로 다시 올린다.
 * 다른 트룹과 함께 쓰는 적 레코드는 이 트룹 전용 사본으로 떼고 바꾼다. 경험치 보상은 relevel 이 레벨 비로 줄인다.
 */
export function fitRequiredBattlesToStarters(project: Project): string[] {
  guardFitBudget(project, true); // 예산은 이 단계에서만 — 곡선·길 맞춤은 싸서 항상 끝까지 돈다.
  try { return runRequiredBattles(project, true).out; }
  finally { guardFitBudget(project, false); }
}

/** 필수 전투 한 판의 모의전 결과(스타터마다) — 끝맺음 기록·QA 표 대조용. 프로젝트를 바꾸지 않는다. */
interface RequiredBattleRow { readonly troopId: string; readonly name: string; readonly stage: number; readonly rank: number; readonly heal: boolean; readonly outcomes: readonly StarterOutcome[] }

function runRequiredBattles(project: Project, adjust: boolean): { out: string[]; rows: RequiredBattleRow[] } {
  const rows: RequiredBattleRow[] = [];
  const campaign = project.system.monsterCampaign;
  const starter = starterLevel(project);
  if (!campaign || starter === undefined) return { out: [], rows };
  const choices = starterChoices(project).filter((id) => monsterSpeciesById(project, id));
  if (!choices.length) return { out: [], rows };
  const { gates, routeIds, stageOfRoute } = campaignStages(project);
  const campaignMaps = new Set(campaign.locations.map((entry) => entry.mapId));
  const routeSet = new Set(routeIds);
  const required: { stage: number; rank: number; troopId: string; mapId: string }[] = [];
  const seen = new Set<string>();
  for (const map of Object.values(project.maps)) {
    if (campaignMaps.size && !campaignMaps.has(map.id) && !gates.some((gate) => gate.mapIds.has(map.id))) continue;
    for (const event of map.events ?? []) walkRequired(event.pages, (cmd) => {
      if (cmd.kind !== "battleProcessing" || typeof cmd.troopId !== "string" || cmd.canEscape === true || seen.has(cmd.troopId)) return;
      if ((map.encounterTable ?? []).some((entry) => entry.troopId === cmd.troopId)) return;
      seen.add(cmd.troopId);
      const gate = gates.findIndex((entry) => entry.troopIds.includes(cmd.troopId as string));
      if (gate >= 0) { required.push({ stage: gate, rank: 2, troopId: cmd.troopId, mapId: map.id }); return; }
      const home = gates.findIndex((entry) => entry.mapIds.has(map.id));
      if (home >= 0) { required.push({ stage: home, rank: 1, troopId: cmd.troopId, mapId: map.id }); return; }
      required.push({ stage: routeSet.has(map.id) ? stageOfRoute(map.id) : 0, rank: 0, troopId: cmd.troopId, mapId: map.id });
    });
  }
  required.sort((a, b) => a.stage - b.stage || a.rank - b.rank);
  const out: string[] = [];
  let gained = 0;
  let pending = 0; // 같은 묶음 안의 앞 트룹 경험치는 아직 안 얹는다(길 트레이너끼리 순서는 모른다).
  let group = "";
  const carry = new Map<string, number>();
  const enemyOf = (id: string) => project.database.enemies.find((item) => item.id === id);
  for (const entry of required) {
    const key = `${entry.stage}:${entry.rank}`;
    if (key !== group) { gained += pending; pending = 0; group = key; carry.clear(); }
    const troop = project.database.troops.find((item) => item.id === entry.troopId);
    if (!troop) continue;
    const healHere = mapHasHeal(project.maps[entry.mapId]);
    let outcomes: StarterOutcome[] = [];
    const evaluate = (): StarterOutcome => {
      outcomes = choices.map((speciesId) => starterOutcome(project, troop.id, speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(speciesId)));
      return outcomes.reduce((low, item) => (item.rate < low.rate ? item : low));
    };
    let low = evaluate();
    const notes: string[] = [];
    const defendersOf = (troopId: string) => (project.database.troops.find((item) => item.id === troopId)?.enemyIds ?? []).map((id) => enemyOf(id)?.speciesId).filter((id): id is string => !!id).map((id) => monsterSpeciesById(project, id)?.types ?? []);
    const hitsVs = (troopId: string) => (skillId: string) => {
      const skill = project.database.skills.find((item) => item.id === skillId);
      const defenders = defendersOf(troopId);
      return !!skill && skill.effect.kind === "damage" && skill.scope !== "ally" && (skill.power ?? 0) > 0
        && defenders.some((types) => typeChartMultiplierForTypes(project, skill.elementId, [], types) >= 2)
        && defenders.every((types) => typeChartMultiplierForTypes(project, skill.elementId, [], types) > 0);
    };
    const hits = hitsVs(troop.id);
    // 이 단계의 관문 트룹(관장·보스) — 선물 동료는 이 단계 내내 같이 다니므로 가장 센 관문 기준으로 고른다.
    const gateTroopId = gates[entry.stage]?.troopIds.find((id) => project.database.troops.some((item) => item.id === id));
    // ① 선물 동료: 혼자 못 이기는 스타터가 있으면 이 단계 앞 원정 목표를 켜는 순간 동료 하나를 이벤트로 준다(모두가 받는다).
    //    후보 = 그림이 있는 적 레코드가 있는 잡을 수 있는 종(스타터 제외) 가운데 그 레벨에서 이 상대에게 ×2 피해 기술을 아는 종, id 순 앞 8개.
    //    선물 레벨 = 가장 약한 스타터 도착 레벨 −2. 막힌 스타터들의 가장 낮은 승률이 가장 높은 종.
    if (adjust && low.rate < FIT_WIN_RATE && !campaignGifts(project).some((gift) => gift.stage === entry.stage)) {
      const anchors = giftAnchors(project, entry.stage);
      const giftLevel = Math.max(2, Math.min(...outcomes.map((item) => item.level)) - 2);
      if (anchors.length) {
        const blocked = outcomes.filter((item) => item.rate < FIT_WIN_RATE);
        // 후보 기술은 관문 트룹 상대 ×2(관문이 없으면 이 트룹). 점수 = min(막힌 스타터들의 이 판 승률, 모든 스타터의 관문 승률).
        const hitsGate = hitsVs(gateTroopId ?? troop.id);
        const candidates = [...new Set(project.database.enemies.filter((enemy) => enemy.speciesId && (enemy as { monsterResourceId?: string }).monsterResourceId).map((enemy) => enemy.speciesId!))]
          .filter((id) => !choices.includes(id) && (monsterSpeciesById(project, id)?.captureRate ?? 0) > 0)
          .filter((id) => monsterSkillIdsAtLevel(monsterSpeciesById(project, id)!, giftLevel).some(hitsGate)).sort().slice(0, 8);
        let best: { speciesId: string; rate: number } | undefined;
        for (const candidate of candidates) {
          const gift = { speciesId: candidate, level: giftLevel };
          const here = Math.min(...blocked.map((item) => starterOutcome(project, troop.id, item.speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(item.speciesId), gift).rate));
          const atGate = gateTroopId && gateTroopId !== troop.id ? Math.min(...choices.map((speciesId) => starterOutcome(project, gateTroopId, speciesId, starter, gained, entry.stage, undefined, gift).rate)) : 1;
          const rate = Math.min(here, atGate);
          if (!best || rate > best.rate) best = { speciesId: candidate, rate };
        }
        if (best && best.rate > low.rate) {
          const name = monsterSpeciesById(project, best.speciesId)?.name ?? best.speciesId;
          // 같은 목록에 둘 이상이면 뒤에서부터 끼워 앞 자리 번호가 밀리지 않게.
          for (const anchor of [...anchors].sort((x, y) => y.index - x.index)) anchor.list.splice(anchor.index + 1, 0,
            { kind: "text", body: `${withJosa(name, "이/가")} 동료가 되었다!` },
            { kind: "giveMonster", speciesId: best.speciesId, level: giftLevel, nickname: name });
          notes.push(`선물 동료 ${name} Lv${giftLevel}(「${anchors[0]!.switchId}」 켤 때 ${anchors.length}곳)`);
          low = evaluate();
        }
      }
    }
    // ② 막힌 스타터에게 ×2 기술 하나를 스타터 레벨로.
    if (adjust && low.rate < FIT_WIN_RATE) {
      for (const outcome of outcomes) {
        if (outcome.rate >= FIT_WIN_RATE) continue;
        const record = project.database.monsterSpecies?.find((item) => item.id === outcome.speciesId);
        if (!record?.skillsByLevel) continue;
        const known = monsterSkillIdsAtLevel(record, outcome.level);
        if (known.some(hits)) continue;
        const pick = record.skillsByLevel.filter((item) => item.level > outcome.level && hits(item.skillId))
          .sort((a, b) => a.level - b.level || (project.database.skills.find((s) => s.id === a.skillId)?.power ?? 0) - (project.database.skills.find((s) => s.id === b.skillId)?.power ?? 0))[0];
        if (!pick) continue;
        const from = pick.level;
        (pick as { level: number }).level = Math.min(from, starter);
        notes.push(`${record.name ?? record.id} 「${project.database.skills.find((s) => s.id === pick.skillId)?.name ?? pick.skillId}」 Lv${from}→Lv${pick.level}`);
      }
      low = evaluate();
    }
    const before = troop.enemyIds.map((id) => enemyOf(id)?.level ?? 0);
    const swaps: string[] = [];
    // 다른 트룹과 함께 쓰는 적 레코드는 이 트룹 전용 사본으로 뗀다(올리기·내리기가 다른 전투를 건드리지 않게).
    const ownEnemies = (): void => {
      troop.enemyIds = troop.enemyIds.map((enemyId) => {
        const enemy = enemyOf(enemyId);
        if (!enemy?.speciesId || typeof enemy.level !== "number") return enemyId;
        if (!project.database.troops.some((other) => other.id !== troop.id && other.enemyIds.includes(enemyId))) return enemyId;
        const copyId = `${enemyId}__${troop.id}`;
        if (!enemyOf(copyId)) project.database.enemies.push({ ...structuredClone(enemy), id: copyId } as EnemyRecord);
        return copyId;
      });
    };
    if (adjust && low.rate < FIT_WIN_RATE) {
      // ③ 깎기 — 가장 약한 스타터 도착 레벨 −1 이 바닥.
      const floor = Math.max(1, Math.min(...outcomes.map((item) => item.level)) - 1);
      ownEnemies();
      while (low.rate < FIT_WIN_RATE) {
        const lowerable = troop.enemyIds.map(enemyOf).filter((enemy): enemy is EnemyRecord => !!enemy?.speciesId && typeof enemy.level === "number" && enemy.level > floor);
        if (!lowerable.length) break;
        for (const enemy of lowerable) relevel(project, enemy, enemy.level! - 1);
        low = evaluate();
      }
      // ④ 관문 아닌 트룹은 몬스터를 길 풀숲 종으로.
      if (low.rate < FIT_WIN_RATE && entry.rank !== 2) {
        const pool = new Set(catchableUpTo(project, entry.stage).keys());
        const donors = new Map<string, EnemyRecord>();
        for (const enemy of project.database.enemies) if (enemy.speciesId && pool.has(enemy.speciesId) && (enemy as { monsterResourceId?: string }).monsterResourceId && !donors.has(enemy.speciesId)) donors.set(enemy.speciesId, enemy);
        for (const enemyId of [...troop.enemyIds]) {
          if (low.rate >= FIT_WIN_RATE) break;
          const enemy = enemyOf(enemyId);
          if (!enemy?.speciesId || typeof enemy.level !== "number") continue;
          const own = monsterSpeciesById(project, enemy.speciesId)?.types ?? [];
          const original = structuredClone(enemy);
          const index = project.database.enemies.findIndex((item) => item.id === enemyId);
          let best: { speciesId: string; rate: number; record: EnemyRecord } | undefined;
          const candidates = [...donors.keys()].filter((id) => id !== enemy.speciesId).sort((a, b) => {
            const sa = (monsterSpeciesById(project, a)?.types ?? []).some((t) => own.includes(t)) ? 0 : 1;
            const sb = (monsterSpeciesById(project, b)?.types ?? []).some((t) => own.includes(t)) ? 0 : 1;
            return sa - sb || (a < b ? -1 : a > b ? 1 : 0);
          });
          for (const speciesId of candidates) {
            const oldName = monsterSpeciesById(project, original.speciesId!)?.name;
            const swapped = { ...structuredClone(original), speciesId, monsterResourceId: (donors.get(speciesId) as { monsterResourceId?: string }).monsterResourceId, level: undefined, skillIds: [], actions: [], name: original.name === oldName ? monsterSpeciesById(project, speciesId)?.name ?? original.name : original.name } as EnemyRecord;
            project.database.enemies[index] = swapped;
            // level 을 비워 두고 옮긴다 — 같은 레벨이면 speciesEnemyAtLevel 이 아무것도 안 해 바꾼 종이 옛 종의 능력치·기술을 그대로 들고 있었다.
            relevel(project, swapped, original.level!);
            const trial = evaluate();
            if (!best || trial.rate > best.rate) best = { speciesId, rate: trial.rate, record: structuredClone(enemyOf(enemyId)!) };
            project.database.enemies[index] = original;
          }
          if (best && best.rate > low.rate) {
            project.database.enemies[index] = best.record;
            swaps.push(`${monsterSpeciesById(project, original.speciesId!)?.name ?? original.speciesId}→${monsterSpeciesById(project, best.speciesId)?.name ?? best.speciesId}`);
          }
          low = evaluate();
        }
      }
    }
    // ⑤ 너무 쉬운 판: 어느 스타터든 평균 남은 HP 가 HP_EASY 를 넘고 가장 약한 스타터가 띠 안(80%·HP_MARGIN)이면 상대를 한 레벨씩 올린다.
    //    가장 약한 스타터가 띠 밖으로 나가는 레벨이면 한 단계 되돌리고 멈춘다. 원래 레벨 + HP_RAISE_CAP 까지.
    const easiest = (): number => Math.max(...outcomes.map((item) => item.hpFrac));
    const raiseWhileEasy = (): void => {
      if (low.rate < FIT_WIN_RATE || easiest() <= HP_EASY) return;
      ownEnemies();
      const start = new Map(troop.enemyIds.map((id) => [id, enemyOf(id)?.level ?? 0]));
      for (let step = 0; step < HP_RAISE_CAP; step += 1) {
        const raisable = troop.enemyIds.map(enemyOf).filter((enemy): enemy is EnemyRecord => !!enemy?.speciesId && typeof enemy.level === "number" && enemy.level < (start.get(enemy.id) ?? 0) + HP_RAISE_CAP);
        if (!raisable.length) break;
        const saved = raisable.map((enemy) => structuredClone(enemy));
        for (const enemy of raisable) relevel(project, enemy, enemy.level! + 1);
        let trial: StarterOutcome;
        try { trial = evaluate(); }
        catch (error) { for (const record of saved) project.database.enemies[project.database.enemies.findIndex((item) => item.id === record.id)] = record; throw error; } // 예외로 빠져도 올리던 레벨을 되돌린다.
        if (trial.rate < FIT_WIN_RATE) {
          for (const record of saved) project.database.enemies[project.database.enemies.findIndex((item) => item.id === record.id)] = record;
          low = evaluate();
          break;
        }
        low = trial;
        if (easiest() <= HP_EASY) break;
      }
    };
    if (adjust) raiseWhileEasy();
    // ⑥ 관문 아닌 트룹의 종 다시 고르기 — 두 경우:
    //    (가) 같은 맵(같은 길·같은 체육관)의 앞 필수 트룹이 이미 쓴 종이거나 트룹 안에서 겹치는 종 → 아직 안 쓴 종으로 바꾼다.
    //        왜(2026-10-29 감독): 쉬움 줄이기가 1번길 트레이너 셋을 모두 피오르 Lv6 으로, 체육관 관원·관장을 모두 토리프로 두었다.
    //    (나) 그래도 너무 쉬운 판(어느 스타터든 남은 HP > HP_EASY) — 스타터끼리 상성 차이가 커 레벨로는 못 좁힌 판
    //        (1번길 트레이너가 불꽃 스타터에 95%, 물에 91~93%).
    //    후보 = 그림이 있는 적 레코드가 있는 종 가운데 스타터·선물·최종형과 전설(포획률 < 0.4)·같은 맵 앞 트룹과 이 트룹의 다른 칸이 쓴 종을 뺀 것.
    //    차례: 체육관(관문 맵)은 관문 몬스터와 타입을 나누는 종 → 이 단계까지 잡을 수 있는 길 풀숲 종 → 첫 단계 종(포획률 ≥ 0.7).
    //    앞 차례에서 띠 안(모든 스타터 80%·HP_MARGIN, 가장 쉬운 스타터 ≤ HP_EASY)인 종이 있으면 그중 가장 쉬운 스타터의 남은 HP 가 가장 낮은 종,
    //    없으면 띠 아래쪽만 지키는 종 가운데 가장 낮은 종. 레벨은 바꾸기 전 그 칸 레벨. 그다음 ⑤ 를 다시 돈다.
    //    「앞 트룹」만 보므로 두 번째 끝맺음에서 앞 트룹이 뒤 트룹 때문에 바뀌지 않는다(멱등).
    //    관문(관장·보스·챔피언)은 그 구성이 앞 관문과 똑같을 때만(보스·챔피언이 둘 다 피오르 한 마리) 같은 규칙으로 바꾼다 — 앞 관문들이 쓴 종을 피한다.
    const speciesOfTroop = (id: string): string[] => (project.database.troops.find((item) => item.id === id)?.enemyIds ?? []).map((enemyId) => enemyOf(enemyId)?.speciesId).filter((sid): sid is string => !!sid);
    const earlierGates = required.slice(0, required.indexOf(entry)).filter((other) => other.rank === 2 && other.troopId !== troop.id);
    const sameAsEarlierGate = entry.rank === 2 && earlierGates.some((other) => speciesOfTroop(other.troopId).sort().join() === speciesOfTroop(troop.id).sort().join());
    if (adjust && (entry.rank !== 2 || sameAsEarlierGate)) {
      const sameMapBefore = entry.rank === 2 ? earlierGates : required.slice(0, required.indexOf(entry)).filter((other) => other.mapId === entry.mapId && other.troopId !== troop.id);
      // 체육관 관원은 관장 종도 피한다(관장은 관문이라 바꾸지 않는다 — 관원이 관장과 같은 종이면 관원 쪽을 바꾼다).
      const gateOnMap = entry.rank === 1 && gateTroopId ? [gateTroopId] : [];
      const usedBefore = new Set([...sameMapBefore.map((other) => other.troopId), ...gateOnMap].flatMap((id) => project.database.troops.find((item) => item.id === id)?.enemyIds ?? []).map((id) => enemyOf(id)?.speciesId).filter((id): id is string => !!id));
      const gifts = new Set(campaignGifts(project).map((gift) => gift.speciesId));
      const art = new Map<string, string>();
      for (const enemy of project.database.enemies) {
        const resource = (enemy as { monsterResourceId?: string }).monsterResourceId;
        if (enemy.speciesId && resource && !art.has(enemy.speciesId)) art.set(enemy.speciesId, resource);
      }
      const catchable = new Set(catchableUpTo(project, entry.stage).keys());
      const gateTypes = new Set(entry.rank === 1 && gateTroopId ? defendersOf(gateTroopId).flat() : []);
      const tierOf = (speciesId: string): number => {
        const species = monsterSpeciesById(project, speciesId);
        if (gateTypes.size && (species?.types ?? []).some((type) => gateTypes.has(type))) return 0;
        if (catchable.has(speciesId)) return 1;
        return (species?.captureRate ?? 0) >= 0.7 ? 2 : 3;
      };
      // 상성 치우침(모의전 없이): 스타터마다 쉬움 = 「가장 좋은 내 기술의 상대 타입 배율 ÷ 상대 가장 좋은 기술의 내 타입 배율」,
      // 치우침 = 가장 쉬운 스타터 ÷ 가장 어려운 스타터. 1 에 가까운(모든 스타터에게 고른) 종부터 모의전한다 — 띠는 양쪽 끝을 다 봐야 해서.
      const bestMultiplier = (skillIds: readonly string[], types: readonly string[]): number => Math.max(0.5, ...skillIds.map((id) => project.database.skills.find((skill) => skill.id === id))
        .filter((skill) => !!skill && skill.effect.kind === "damage" && skill.scope !== "ally" && (skill.power ?? 0) > 0)
        .map((skill) => typeChartMultiplierForTypes(project, skill!.elementId, [], types)));
      const matchupLean = (speciesId: string, level: number): number => {
        const foe = monsterSpeciesById(project, speciesId);
        if (!foe) return Infinity;
        const foeMoves = monsterSkillIdsAtLevel(foe, level);
        const ease = outcomes.map((outcome) => {
          const mine = monsterSpeciesById(project, outcome.speciesId);
          if (!mine) return 1;
          return bestMultiplier(monsterSkillIdsAtLevel(mine, outcome.level), foe.types ?? []) / bestMultiplier(foeMoves, mine.types ?? []);
        });
        return Math.max(...ease) / Math.min(...ease);
      };
      // 후보 시험: 지금 가장 어려운 스타터부터 재고, 띠 아래쪽(80%·HP_MARGIN)을 못 지키는 스타터가 나오면 나머지는 재지 않는다.
      const trialBand = (): { easy: number } | null => {
        const order = [...outcomes].sort((a, b) => a.hpFrac - b.hpFrac || a.rate - b.rate).map((item) => item.speciesId);
        let easy = 0;
        for (const speciesId of order) {
          const outcome = starterOutcome(project, troop.id, speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(speciesId));
          if (outcome.rate < FIT_WIN_RATE) return null;
          easy = Math.max(easy, outcome.hpFrac);
        }
        return { easy };
      };
      ownEnemies();
      for (const [slot, enemyId] of [...troop.enemyIds].entries()) {
        const enemy = enemyOf(enemyId);
        if (!enemy?.speciesId || typeof enemy.level !== "number") continue;
        const inTroop = new Set(troop.enemyIds.filter((_, other) => other < slot).map((id) => enemyOf(id)?.speciesId).filter((id): id is string => !!id));
        const duplicate = usedBefore.has(enemy.speciesId) || inTroop.has(enemy.speciesId);
        if (!duplicate && (entry.rank === 2 || low.rate < FIT_WIN_RATE || easiest() <= HP_EASY)) continue;
        const original = structuredClone(enemy);
        const index = project.database.enemies.findIndex((item) => item.id === enemyId);
        const current = { rate: low.rate, easy: easiest() };
        const candidates = [...art.keys()].filter((id) => id !== original.speciesId && !choices.includes(id) && !gifts.has(id) && !usedBefore.has(id) && !inTroop.has(id)
          // 포획률 < 0.4 = 마지막 진화형·전설 — 관원 Lv8 에 벨데로드(최종형)가 나왔다. 중간형까지만.
          && (monsterSpeciesById(project, id)?.captureRate ?? 0) >= 0.4 && tierOf(id) < 3)
          .map((id) => ({ id, tier: tierOf(id), lean: matchupLean(id, original.level!) }))
          .sort((a, b) => a.tier - b.tier || a.lean - b.lean || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          // 칸마다 모의전 비용을 묶는다(차례마다 앞 2종, 모두 6종까지) — 다 보면 끝맺음이 3분 → 12분, 10종이면 9분이 됐다. 치우침 순이라 앞쪽이 띠에 가장 가깝다.
          // 앞 5종만 보던 판은 체육관 차례(풀 종)만 보고 물 스타터에게 모두 띠 밖이라 관원 셋이 다시 관장과 같은 토리프로 남았다.
          .filter((item, at, all) => all.slice(0, at).filter((other) => other.tier === item.tier).length < 2).slice(0, 6).map((item) => item.id);
        let best: { speciesId: string; tier: number; easy: number; record: EnemyRecord } | undefined;
        const better = (tier: number, easy: number): boolean => {
          if (!best) return true;
          const inBand = easy <= HP_EASY, bestIn = best.easy <= HP_EASY;
          if (inBand !== bestIn) return inBand;
          if (inBand && tier !== best.tier) return tier < best.tier;
          return easy < best.easy;
        };
        for (const speciesId of candidates) {
          // 띠 안 후보를 찾으면 멈춘다 — 후보는 차례 → 상성 치우침(matchupLean) 순이라 처음 들어온 것이 그 차례에서 가장 고른 종에 가깝다.
          // 차례 안을 모두 모의전하던 판은 ⑥ 하나에 약 110초를 썼다(2026-10-29).
          if (best && best.easy <= HP_EASY) break;
          const oldName = monsterSpeciesById(project, original.speciesId!)?.name;
          const swapped = { ...structuredClone(original), speciesId, monsterResourceId: art.get(speciesId), level: undefined, skillIds: [], actions: [], name: original.name === oldName ? monsterSpeciesById(project, speciesId)?.name ?? original.name : original.name } as EnemyRecord;
          project.database.enemies[index] = swapped;
          relevel(project, swapped, original.level!);
          const trial = trialBand();
          if (trial && better(tierOf(speciesId), trial.easy)) best = { speciesId, tier: tierOf(speciesId), easy: trial.easy, record: structuredClone(enemyOf(enemyId)!) };
          project.database.enemies[index] = original;
        }
        // 겹침은 띠 아래쪽만 지키면 바꾼다. 쉬움만 문제면 0.05 이상 나아질 때만.
        if (best && (duplicate || (current.rate >= FIT_WIN_RATE && best.easy < current.easy - 0.05))) {
          project.database.enemies[index] = best.record;
          swaps.push(`${monsterSpeciesById(project, original.speciesId!)?.name ?? original.speciesId}→${monsterSpeciesById(project, best.speciesId)?.name ?? best.speciesId}(${duplicate ? "겹침 피하기" : "쉬움 줄이기"})`);
        }
        low = evaluate();
      }
      raiseWhileEasy();
    }
    // ⑦ 기술 가르치기 — 그래도 가장 쉬운 스타터가 HP_EASY 를 넘는 판(관원이 불꽃 스타터에 82~83%, 조련사가 물에 87%, 챔피언이 풀에 85%):
    //    상대 몬스터 하나에 「가장 쉬운 스타터에게 ×2 이상이고, 남은 HP 가 0.5 아래인 스타터에게는 ×1 이하」인 피해 기술 하나를 가르친다
    //    (어느 종이든 배우는 기술만, 위력 낮은 순 앞 4개). 레벨로는 약한 스타터까지 같이 세지고, 이 기술은 쉬운 스타터만 아프게 한다.
    //    띠 안(모든 스타터 80%·HP_MARGIN, 가장 쉬운 ≤ HP_EASY)이 되는 첫 기술, 없으면 0.03 이상 나아지는 가장 좋은 기술. 기술이 넷이면 위력이 가장 낮은 것과 바꾼다.
    if (adjust && low.rate >= FIT_WIN_RATE && easiest() > HP_EASY) {
      ownEnemies();
      const easyOne = outcomes.reduce((top, item) => (item.hpFrac > top.hpFrac ? item : top));
      const typesOf = (speciesId: string) => monsterSpeciesById(project, speciesId)?.types ?? [];
      const struggling = outcomes.filter((item) => item.hpFrac < 0.5);
      const learnable = new Set((project.database.monsterSpecies ?? []).flatMap((species) => (species.skillsByLevel ?? []).map((item) => item.skillId)));
      const pool = project.database.skills.filter((skill) => learnable.has(skill.id) && skill.effect.kind === "damage" && skill.scope !== "ally" && (skill.power ?? 0) > 0
        && typeChartMultiplierForTypes(project, skill.elementId, [], typesOf(easyOne.speciesId)) >= 2
        && struggling.every((item) => typeChartMultiplierForTypes(project, skill.elementId, [], typesOf(item.speciesId)) <= 1))
        .sort((a, b) => (a.power ?? 0) - (b.power ?? 0) || (a.id < b.id ? -1 : 1)).slice(0, 4);
      const power = (id: string) => project.database.skills.find((skill) => skill.id === id)?.power ?? 0;
      const trial = (): number | null => {
        const order = [...outcomes].sort((a, b) => a.hpFrac - b.hpFrac).map((item) => item.speciesId);
        let easy = 0;
        for (const speciesId of order) {
          const outcome = starterOutcome(project, troop.id, speciesId, starter, gained, entry.stage, healHere ? undefined : carry.get(speciesId));
          if (outcome.rate < FIT_WIN_RATE) return null;
          easy = Math.max(easy, outcome.hpFrac);
        }
        return easy;
      };
      const current = easiest();
      let best: { easy: number; enemyId: string; record: EnemyRecord; skillId: string } | undefined;
      search: for (const enemyId of troop.enemyIds) {
        const enemy = enemyOf(enemyId);
        if (!enemy?.speciesId) continue;
        const index = project.database.enemies.findIndex((item) => item.id === enemyId);
        for (const skill of pool) {
          if ((enemy.skillIds ?? []).includes(skill.id)) continue;
          const skills = [...(enemy.skillIds ?? [])];
          if (skills.length >= 4) skills.splice(skills.indexOf([...skills].sort((a, b) => power(a) - power(b))[0]!), 1);
          const taught = { ...structuredClone(enemy), skillIds: [...skills, skill.id], actions: [...(enemy.actions ?? []).filter((action) => !action.skillId || skills.includes(action.skillId)),
            { skillId: skill.id, priority: 6, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }] } as EnemyRecord;
          project.database.enemies[index] = taught;
          const easy = trial();
          project.database.enemies[index] = enemy;
          if (easy !== null && (!best || easy < best.easy)) best = { easy, enemyId, record: taught, skillId: skill.id };
          if (best && best.easy <= HP_EASY) break search;
        }
      }
      if (best && (best.easy <= HP_EASY || best.easy < current - 0.03)) {
        project.database.enemies[project.database.enemies.findIndex((item) => item.id === best!.enemyId)] = best.record;
        notes.push(`${enemyOf(best.enemyId)?.name ?? best.enemyId} 기술 「${project.database.skills.find((skill) => skill.id === best!.skillId)?.name ?? best.skillId}」 가르침`);
      }
      low = evaluate();
    }
    const after = troop.enemyIds.map((id) => enemyOf(id)?.level ?? 0);
    if (notes.length || swaps.length || after.join() !== before.join()) {
      const who = monsterSpeciesById(project, low.speciesId)?.name ?? low.speciesId;
      const levels = after.join() !== before.join() ? ` Lv${before.join("·")}→Lv${after.join("·")}` : "";
      out.push(`필수 전투 「${troop.name || troop.id}」${levels}${notes.length ? ` · ${notes.join(", ")}` : ""}${swaps.length ? ` · 몬스터 ${swaps.join(", ")}` : ""} — 가장 약한 스타터 ${who} 도착 Lv${low.level} 승률 ${Math.round(low.rate * 100)}%${low.rate < FIT_WIN_RATE ? ", 미달" : ""}`);
    }
    rows.push({ troopId: troop.id, name: troop.name || troop.id, stage: entry.stage, rank: entry.rank, heal: healHere, outcomes });
    for (const outcome of outcomes) carry.set(outcome.speciesId, outcome.hpLeft);
    pending += troopExp(project, troop.id);
  }
  return { out, rows };
}
