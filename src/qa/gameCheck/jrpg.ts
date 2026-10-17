// 턴제 JRPG 장르 검사 — 「끝까지 갈 수 있나」 다음 질문, 「해 볼 만한가」 를 데이터로 짚는다.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고/참고이고, 없는 인카운터 적 그룹만 막힘이다.
// 2026-09-24 도그푸딩 「잿불 광산의 세 사람」에서 찾은 것:
//   - 무기점·방어구점이 골드만 깎고 아무것도 주지 않는 선택지였다(장비 상점 계약 불일치).
//   - 파티원 셋의 능력치가 전부 같았다(배우 기본 곡선 514/45/59 — 직업 곡선은 직업 변경 때만 쓰인다).
//   - 잡몹은 파티에게 피해를 못 주고, 보스는 11타 만에 파티 HP 8% 만 깎고 쓰러졌다.

import { actorBattlers } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import type { Project } from "@/project/types";
import type { Finding } from "./types";
import { visitAllCommands, type RawCommand } from "./walk";
import { companionJoins } from "./progression";

/** 보스를 만날 즈음의 넉넉한 레벨(3층 던전을 한 번 돌고 온 파티). 자동 플레이의 보스 패배 오판 검사도 이 레벨로 재다. */
export const BOSS_CHECK_LEVEL = 10;
/** 잡몹 전멸 검사 레벨 — 첫 던전 중반. */
const WIPE_CHECK_LEVEL = 5;
const DUNGEON_NAME = /던전|동굴|광산|갱도|층|탑|유적|지하|dungeon|cave|mine|floor/iu;
/** 선택지 분기에서 「대가(골드)」 를 받고 돌려주는 것으로 인정하는 명령. */
const GRANTS = new Set(["changeItem", "changeEquipment", "shop", "inn", "recoverAll", "changeParty", "changeActorParameter", "changeParameter", "learnSkill", "changeSkill", "transfer", "setSwitch", "setSelfSwitch", "changeVariable", "setVariable", "battleProcessing", "giveMonster", "changeExp", "changeLevel"]);

function commandsIn(list: unknown): RawCommand[] {
  return Array.isArray(list) ? list.filter((entry): entry is RawCommand => entry !== null && typeof entry === "object") : [];
}

/** 파티에 들어오는 모든 배우(시작 + 합류). */
export function partyRoster(project: Project): string[] {
  const ids = new Set(project.session?.partyActorIds ?? []);
  for (const join of companionJoins(project)) if (typeof join.command.actorId === "string") ids.add(join.command.actorId);
  return [...ids].filter((id) => project.database.actors.some((actor) => actor.id === id));
}

/** 장비가 거의 건드리지 않는 체력·마력으로 「같은 몸」 인지 본다(공·방은 무기·갑옷이 갈라 놓는다). */
function statKey(battler: { maxHp: number; maxMp: number }): string {
  return [battler.maxHp, battler.maxMp].join("/");
}

/** 파티 안 최대 능력치 편차(최대값 대비)가 이보다 작으면 역할 구분 없는 파티다. */
const FLAT_ROLE_SPREAD = 0.15;

export function checkJrpg(project: Project): Finding[] {
  if (project.system?.genre !== "adventure-jrpg" && project.gameDesignBrief?.presetId !== "adventure-jrpg") return [];
  const findings: Finding[] = [];
  const roster = partyRoster(project);
  const skills = new Map(project.database.skills.map((skill) => [skill.id, skill]));

  // 1) 파티 — 역할이 다른가(능력치·기술).
  let battlers: ReturnType<typeof actorBattlers> = [];
  try {
    battlers = roster.length ? actorBattlers(project, { partyActorIds: roster, levels: Object.fromEntries(roster.map((id) => [id, 1])) }) : [];
  } catch (error) {
    findings.push({ severity: "warning", code: "jrpg-party-battlers", message: `파티 전투원을 만들 수 없습니다: ${error instanceof Error ? error.message : String(error)}` });
  }
  if (battlers.length >= 2) {
    const keys = new Set(battlers.map(statKey));
    // 같은 몸이 셋 이상이면 한 명만 다른 이름(탈것 배우 등 합류 명령이 있는 비-인물)이 섞여도 막는다 — jrpg-loop-3 ff2: 「actor_airship」 합류가
    // 로스터에 끼어 카일·가렌·엘레나(전부 HP514·MP43)가 이 검사를 통과했다.
    const groups = new Map<string, typeof battlers>();
    for (const battler of battlers) groups.set(statKey(battler), [...(groups.get(statKey(battler)) ?? []), battler]);
    const sameBody = [...groups.values()].sort((a, b) => b.length - a.length)[0]!;
    if (keys.size === 1 || sameBody.length >= 3) {
      const b = sameBody[0]!;
      findings.push({
        severity: "warning", code: "jrpg-party-identical-stats",
        message: `파티원 ${sameBody.map((x) => x.name).join("·")} 의 Lv1 체력·마력이 전부 같습니다(HP ${b.maxHp}·MP ${b.maxMp}·공 ${b.attackPower}·방 ${b.defense}·마 ${b.mind}·민 ${b.agility}) — 전투에서 역할 차이가 기술 목록뿐입니다. 런타임은 배우의 parameterCurves 를 쓰고, 직업(class) 곡선은 직업 변경 때만 씁니다.`,
      });
    }
    // 같지는 않아도 역할이 갈리지 않은 파티(한두 칸만 살짝 고친 것) — 여섯 능력치 모두 파티 안 편차가 작으면 평평한 파티다.
    if (keys.size > 1 && battlers.length >= 3) {
      const stats: Array<(b: (typeof battlers)[number]) => number> = [(b) => b.maxHp, (b) => b.maxMp, (b) => b.attackPower, (b) => b.defense, (b) => b.mind, (b) => b.agility];
      const spreads = stats.map((get) => { const values = battlers.map(get); const max = Math.max(...values); return max > 0 ? (max - Math.min(...values)) / max : 0; });
      if (Math.max(...spreads) < FLAT_ROLE_SPREAD) {
        findings.push({
          severity: "warning", code: "jrpg-party-flat-roles",
          message: `파티원 ${battlers.map((x) => x.name).join("·")} 의 Lv1 여섯 능력치 편차가 모두 ${Math.round(FLAT_ROLE_SPREAD * 100)}% 미만입니다 — 역할(전사·마법사·도적)이 능력치로 갈리지 않습니다. upsert_actor.parameterCurves 로 전사는 체력·방어, 마법사는 마력·MP, 도적은 민첩을 높이세요.`,
        });
      }
    }
  }
  for (const battler of battlers) {
    const usable = battler.skillIds
      .map((id) => skills.get(id))
      .filter((skill) => skill && skill.id !== "skill_attack" && (skill.mpCost?.flat ?? 0) <= battler.maxMp);
    if (usable.length === 0) {
      findings.push({ severity: "warning", code: "jrpg-member-no-skill", message: `${battler.name} 은 Lv1 에 쓸 수 있는 기술(일반 공격 외, MP ${battler.maxMp} 이하)이 없습니다.` });
    }
  }

  // 2) 상점 — 골드만 깎고 아무것도 주지 않는 선택지, 장비를 파는 상점이 있는지.
  let sellsEquipment = false;
  const equipmentIds = new Set(project.database.equipment.map((record) => record.id));
  visitAllCommands(project, ({ command, where }) => {
    if (command.kind === "shop") {
      const ids = [...(Array.isArray(command.itemIds) ? command.itemIds : []), ...commandsIn(command.stock).map((entry) => entry.itemId)];
      if (ids.some((id) => typeof id === "string" && equipmentIds.has(id))) sellsEquipment = true;
    }
    if (command.kind !== "choices") return;
    commandsIn(command.options).forEach((option, index) => {
      const branch = commandsIn(option.branch);
      const pays = branch.some((entry) => entry.kind === "changeGold" && entry.op === "-=");
      const flat: RawCommand[] = [];
      const collect = (list: RawCommand[]) => { for (const entry of list) { flat.push(entry); for (const key of ["then", "else", "branch"]) collect(commandsIn(entry[key])); } };
      collect(branch);
      if (pays && !flat.some((entry) => GRANTS.has(String(entry.kind)))) {
        findings.push({
          severity: "warning", code: "jrpg-paid-choice-grants-nothing",
          message: `선택지 「${String(option.text ?? option.label ?? index)}」 는 골드를 깎지만 아이템·장비·회복 등 아무것도 주지 않습니다(글로만 「구매했다」).`,
          where: { ...where, path: `${where.path}.options[${index}]` },
        });
      }
    });
  });
  const briefText = JSON.stringify(project.gameDesignBrief ?? {});
  if (/무기|방어구|장비|weapon|armor/iu.test(briefText) && !sellsEquipment) {
    findings.push({ severity: "warning", code: "jrpg-no-equipment-shop", message: "기획에 무기·방어구 상점이 있는데 장비를 진열한 shop 명령이 하나도 없습니다." });
  }

  // 3) 던전 인카운터 — 던전 층 맵에 무작위 전투가 있는지, 적 그룹이 실제로 있는지.
  const troops = new Map(project.database.troops.map((troop) => [troop.id, troop]));
  const encounterTroops = new Set<string>();
  for (const map of Object.values(project.maps)) {
    const entries = [...(map.encounterTable ?? []).map((entry) => entry.troopId), ...(map.troopIds ?? [])];
    for (const troopId of entries) {
      if (!troops.has(troopId)) findings.push({ severity: "blocker", code: "jrpg-encounter-missing-troop", message: `${map.name}(${map.id}) 인카운터가 없는 적 그룹 \`${troopId}\` 을 부릅니다.`, where: { mapId: map.id, mapName: map.name } });
      else encounterTroops.add(troopId);
    }
    if (DUNGEON_NAME.test(map.name) && !/집|내부|여관|상점/u.test(map.name) && ((map.encounterRate ?? 0) <= 0 || entries.length === 0)) {
      findings.push({ severity: "info", code: "jrpg-dungeon-no-encounters", message: `던전 맵 ${map.name}(${map.id}) 에 무작위 인카운터가 없습니다(encounterRate ${map.encounterRate ?? 0}, 적 그룹 ${entries.length}개).`, where: { mapId: map.id, mapName: map.name } });
    }
  }

  // 4) 전투 위협 — 잡몹은 피해를 주는지, 보스는 위협적인지(시작 파티 전원 합류·Lv1 모의전, seed 고정).
  const bossTroops = new Set<string>();
  visitAllCommands(project, ({ command }) => {
    if (command.kind === "battleProcessing" && typeof command.troopId === "string" && !encounterTroops.has(command.troopId)) bossTroops.add(command.troopId);
  });
  if (roster.length > 0) {
    const simulate = (troopId: string, heroLevel = 1) => {
      try { return simulateBattle({ project, troopId, heroLevel, partyActorIds: roster, n: 3, seed: 1 }); } catch { return undefined; }
    };
    const partyHp = battlers.reduce((sum, battler) => sum + battler.maxHp, 0);
    const harmless: string[] = [];
    for (const troopId of encounterTroops) {
      const result = simulate(troopId);
      if (result && result.winRate === 1 && partyHp > 0 && result.avgHpRemaining >= partyHp) harmless.push(troops.get(troopId)?.name ?? troopId);
    }
    // 반대쪽 — 합류가 끝난 파티가 Lv5 에도 잡몹 한 무리에 전멸한다면 층을 지나갈 수 없다(기본 DB 적을 그대로 끌어다 쓴 경우).
    const wipes: string[] = [];
    for (const troopId of encounterTroops) {
      const result = simulate(troopId, WIPE_CHECK_LEVEL);
      if (result && result.winRate === 0) wipes.push(troops.get(troopId)?.name ?? troopId);
    }
    if (wipes.length > 0) {
      findings.push({ severity: "warning", code: "jrpg-encounters-wipe-party", message: `인카운터 적 그룹 ${wipes.length}/${encounterTroops.size}개에 Lv${WIPE_CHECK_LEVEL} 파티(${roster.length}명, 합류 전원)가 모의전 3판 모두 전멸합니다: ${wipes.slice(0, 6).join(", ")} — 기본 DB 적(다른 척도)을 그대로 쓰지 않았는지, 적 능력치를 파티 척도에 맞췄는지 확인하세요.` });
    }
    if (harmless.length > 0) {
      findings.push({ severity: "warning", code: "jrpg-encounters-harmless", message: `인카운터 적 그룹 ${harmless.length}/${encounterTroops.size}개가 Lv1 파티(${roster.length}명)에게 피해를 한 번도 주지 못합니다: ${harmless.slice(0, 6).join(", ")} — 회복·아이템을 쓸 이유가 없습니다.` });
    }
    for (const troopId of bossTroops) {
      const result = simulate(troopId);
      if (!result || partyHp <= 0) continue;
      const strong = simulate(troopId, BOSS_CHECK_LEVEL);
      if (strong && strong.winRate === 0) {
        findings.push({
          severity: "warning", code: "jrpg-boss-unwinnable",
          message: `보스 적 그룹 ${troops.get(troopId)?.name ?? troopId}(${troopId}) 은 Lv${BOSS_CHECK_LEVEL} 파티 ${roster.length}명(합류 전원)이 모의전 3판 모두 평균 ${strong.avgTurns.toFixed(1)}타 만에 전멸합니다 — 레벨을 올려도 이길 수 없는 보스입니다.`,
        });
      }
      const lost = 1 - result.avgHpRemaining / partyHp;
      if (result.winRate === 1 && lost < 0.25) {
        findings.push({
          severity: "warning", code: "jrpg-boss-not-threatening",
          message: `보스 적 그룹 ${troops.get(troopId)?.name ?? troopId}(${troopId}) 은 Lv1 파티 ${roster.length}명 모의전 3판 모두 평균 ${result.avgTurns.toFixed(1)}타 만에 지고 파티 HP 를 ${(lost * 100).toFixed(0)}% 만 깎습니다 — 회복·MP 관리 없이 이깁니다.`,
        });
      }
    }
  }
  return findings;
}
