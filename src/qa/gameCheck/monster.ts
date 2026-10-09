// 몬스터 수집(포켓몬풍) 장르 검사 — 「끝까지 가나」 다음 질문, 「잡고·키우고·도전하는 게임인가」 를 데이터로 짚는다.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 2026-09-24 도그푸딩 「바람개비 섬의 수호수」에서 찾은 것:
//   - 몬스터볼을 type normalGoods 로 저장 → 전투에서 던지면 실패(포획 불가 게임). 런타임은 PR #1257 에서 고쳤지만
//     다른 필드(occasion)로도 같은 일이 난다 — 여기서 「던질 수 있는 공」 을 실제 판정 함수로 본다.
//   - 도로가 무늬 없는 잔디, 조우가 맵 전 칸에서 났다(풀숲 없음).
//   - 트레이너 battleProcessing 에 troopId 가 없거나 엉뚱한 칸에 들어갔다.
//   - 스타터를 안 받고도 도로로 나갈 수 있다(영웅 혼자 야생과 싸운다).

import { TILE } from "@/project/defaults/constants";
import { itemAllowsBattle } from "@/project/itemUsage";
import { monsterSpeciesForEnemy } from "@/project/monsterCollection";
import type { GameMap, Project } from "@/project/types";
import type { Finding } from "./types";
import { visitAllCommands, type RawCommand } from "./walk";

const GYM = /체육관|관장|도전장|gym/iu;
const ROUTE = /도로|길|필드|숲|초원|route|field/iu;

function isMonsterGame(project: Project): boolean {
  return project.system?.genre === "monster-collect" || project.gameDesignBrief?.presetId === "monster-collect"
    || project.system?.monsterCollection === true;
}

function mapTroops(map: GameMap): string[] {
  return [...new Set([...(map.encounterTable ?? []).map((entry) => entry.troopId), ...(map.troopIds ?? [])])];
}

export function checkMonster(project: Project, briefText?: string): Finding[] {
  if (!isMonsterGame(project)) return [];
  const findings: Finding[] = [];
  const db = project.database;
  const species = db.monsterSpecies ?? [];
  const system = project.system;

  // 1) 시스템 — 포획 게이트와 몬스터 파티 전투.
  if (system.monsterCollection !== true) {
    findings.push({ severity: "blocker", code: "monster-collection-off", message: "system.monsterCollection 이 꺼져 있어 전투에 「포획」이 뜨지 않습니다(configure_monster_system enabled:true)." });
  }
  if (system.monsterBattleParty !== true && system.battleParty !== "monsters") {
    findings.push({ severity: "warning", code: "monster-battle-party-off", message: "몬스터 파티 전투가 꺼져 있어 잡은 몬스터가 아니라 영웅이 싸웁니다(configure_monster_system battleParty:true)." });
  }

  // 2) 몬스터를 얻는 길 — giveMonster(스타터) 와 던질 수 있는 공.
  const gives: { command: RawCommand; where: Finding["where"] }[] = [];
  const shopItems = new Set<string>();
  const grantedItems = new Set<string>(Object.keys(project.session?.inventory ?? {}).filter((id) => (project.session?.inventory?.[id] ?? 0) > 0));
  const battles: { command: RawCommand; where: Finding["where"]; eventName?: string; mapName?: string }[] = [];
  visitAllCommands(project, ({ command, where }) => {
    if (command.kind === "giveMonster") gives.push({ command, where });
    if (command.kind === "shop") for (const id of Array.isArray(command.itemIds) ? command.itemIds : []) if (typeof id === "string") shopItems.add(id);
    if (command.kind === "shop" && Array.isArray(command.stock)) for (const entry of command.stock) if (entry && typeof entry === "object" && typeof (entry as { itemId?: unknown }).itemId === "string") shopItems.add((entry as { itemId: string }).itemId);
    if (command.kind === "changeItem" && typeof command.itemId === "string" && command.op !== "-=") grantedItems.add(command.itemId);
    if (command.kind === "battleProcessing") battles.push({ command, where, eventName: where.eventName, mapName: where.mapName });
  });
  if (gives.length === 0) {
    findings.push({ severity: "blocker", code: "monster-no-give", message: "giveMonster 가 어디에도 없습니다 — 첫 파트너를 받을 길이 없습니다(give_starter_monsters)." });
  }
  for (const give of gives) {
    if (!species.some((record) => record.id === give.command.speciesId)) {
      findings.push({ severity: "blocker", code: "monster-give-unknown-species", message: `giveMonster 의 speciesId 「${String(give.command.speciesId ?? "")}」 가 도감에 없습니다.`, ...(give.where ? { where: give.where } : {}) });
    }
  }
  const balls = db.items.filter((item) => item.captureProfile);
  const throwable = balls.filter((item) => itemAllowsBattle(item));
  if (balls.length === 0) {
    findings.push({ severity: "blocker", code: "monster-no-capture-item", message: "captureProfile 이 있는 포획 도구(몬스터볼)가 없습니다 — 야생을 잡을 수 없습니다." });
  } else if (throwable.length === 0) {
    findings.push({ severity: "blocker", code: "monster-capture-item-unusable", message: `포획 도구 ${balls.map((item) => item.name).join("·")} 가 전투에서 쓸 수 없는 설정입니다(occasion ${balls.map((item) => item.occasion).join("/")}).` });
  } else if (!throwable.some((item) => shopItems.has(item.id) || grantedItems.has(item.id))) {
    findings.push({ severity: "warning", code: "monster-capture-item-unobtainable", message: `포획 도구 ${throwable.map((item) => item.name).join("·")} 를 시작 소지품·상점·지급 어디서도 얻을 수 없습니다.` });
  }

  // 3) 야생 — 조우 맵, 잡을 수 있는 종, 풀숲 한정 여부.
  const troops = new Map(db.troops.map((troop) => [troop.id, troop]));
  const enemies = new Map(db.enemies.map((enemy) => [enemy.id, enemy]));
  const wildMaps = Object.values(project.maps).filter((map) => (map.encounterRate ?? 0) > 0 && mapTroops(map).length > 0);
  if (wildMaps.length === 0) {
    findings.push({ severity: "blocker", code: "monster-no-wild-encounters", message: "야생 조우가 있는 맵이 없습니다(encounterRate>0 + encounterTable) — 포획할 대상이 없습니다." });
  }
  const wildSpecies = new Set<string>();
  for (const map of wildMaps) {
    for (const troopId of mapTroops(map)) {
      const troop = troops.get(troopId);
      if (!troop) continue;
      for (const member of troop.members ?? []) {
        const record = monsterSpeciesForEnemy(project, enemies.get(member.enemyId));
        if (record) wildSpecies.add(record.id);
        else findings.push({ severity: "warning", code: "monster-wild-not-species", message: `${map.name} 의 야생 무리 ${troop.name ?? troopId} 의 적 ${enemies.get(member.enemyId)?.name ?? member.enemyId} 가 도감 종과 이어지지 않아 잡을 수 없습니다(upsert_enemy speciesId).`, where: { mapId: map.id, mapName: map.name } });
      }
    }
    const everywhere = (map.encounterTable ?? []).some((entry) => !entry.conditions?.locationId && !entry.conditions?.region);
    if (everywhere && ROUTE.test(map.name)) {
      findings.push({ severity: "info", code: "monster-encounters-everywhere", message: `${map.name} 의 조우가 맵 전 칸에서 납니다 — 포켓몬풍 도로는 풀숲에서만 나온다(author_wild_route).`, where: { mapId: map.id, mapName: map.name } });
    }
  }
  if (wildMaps.length > 0 && wildSpecies.size === 0) {
    findings.push({ severity: "blocker", code: "monster-no-catchable-wild", message: "야생 조우는 있지만 잡을 수 있는(도감 종과 이어진) 야생이 하나도 없습니다." });
  }

  // 4) 도감 — 기술 성장·진화·그림.
  for (const record of species) {
    if (!record.graphic?.monsterResourceId) findings.push({ severity: "warning", code: "monster-species-no-graphic", message: `도감 종 ${record.name} 에 전투 그림(graphic.monsterResourceId)이 없습니다.` });
  }
  const used = new Set([...wildSpecies, ...gives.map((give) => String(give.command.speciesId ?? ""))]);
  const growing = species.filter((record) => used.has(record.id) && (record.skillsByLevel ?? []).some((entry) => entry.level > 1));
  if (used.size > 0 && growing.length === 0) {
    findings.push({ severity: "warning", code: "monster-no-level-skills", message: "스타터·야생 어느 종도 레벨업으로 새 기술을 배우지 않습니다(skillsByLevel level>1)." });
  }
  if (/진화/u.test(briefText ?? "") && !species.some((record) => used.has(record.id) && (record.evolutions ?? []).length > 0)) {
    findings.push({ severity: "warning", code: "monster-no-evolution", message: "기획에 진화가 있는데 스타터·야생 종에 진화가 없습니다." });
  }
  const chart = system.typeChart?.types;
  if (chart?.length) {
    const unknownTypes = [...new Set(species.filter((record) => used.has(record.id)).flatMap((record) => record.types ?? []).filter((type) => !chart.includes(type)))];
    if (unknownTypes.length) findings.push({ severity: "warning", code: "monster-type-not-in-chart", message: `타입 상성표에 없는 타입: ${unknownTypes.join(", ")} — 상성이 전부 1배로 계산됩니다.` });
  }

  // 5) 트레이너·관장 — 몬스터로 싸우는가, 관장전이 있는가.
  for (const battle of battles) {
    const troop = typeof battle.command.troopId === "string" ? troops.get(battle.command.troopId) : undefined;
    if (!troop) continue;
    const members = troop.members ?? [];
    if (members.length && members.every((member) => !monsterSpeciesForEnemy(project, enemies.get(member.enemyId)))) {
      findings.push({ severity: "warning", code: "monster-trainer-not-species", message: `${battle.eventName ?? "전투"} 의 무리 ${troop.name ?? troop.id} 가 도감 종 몬스터가 아닙니다(트레이너 몬스터는 upsert_enemy speciesId).`, ...(battle.where ? { where: battle.where } : {}) });
    }
  }
  if (GYM.test(briefText ?? "") && !battles.some((battle) => GYM.test(`${battle.eventName ?? ""} ${battle.mapName ?? ""}`))) {
    findings.push({ severity: "warning", code: "monster-no-gym-battle", message: "기획에 체육관·관장이 있는데 관장/체육관 이름의 전투(battleProcessing)가 없습니다." });
  }
  // 6) 체육관 맵이 create_map 빈 판 그대로인가 — 도그푸딩 2회 연속 잔디밭 체육관.
  for (const map of Object.values(project.maps)) {
    if (!GYM.test(map.name ?? "")) continue;
    const lower = new Set(map.lowerTiles ?? []);
    const upperUsed = (map.upperTiles ?? []).some((tile) => tile !== TILE.EMPTY && tile !== 0);
    if (lower.size <= 1 && !upperUsed) {
      findings.push({ severity: "warning", code: "monster-gym-map-bare", message: `체육관 맵 ${map.name} 이 한 가지 바닥 타일뿐인 빈 판입니다(벽·장식 없음) — build_hand_interior_room 등으로 시공하세요.`, where: { mapId: map.id, mapName: map.name } });
    }
  }
  return findings;
}
