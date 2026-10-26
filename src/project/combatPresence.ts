// project/combatPresence.ts
/**
 * 이 게임에 전투가 있나 / 돈을 쓰나 — ESC 메뉴의 전투 수치(직업·Lv·HP·MP·EX)·돈 칸과 주인공 시작 장비를 장르·전투 설정으로 정한다.
 *
 * 왜(2026-10-26 판정 J88, 검은 장미 저택 j86): 전투가 없는 공포 게임의 ESC 메뉴 첫 화면에 「서윤 전사 · Lv 1」 HP 514/514·MP·EX 「다음 678」
 * 과 「돈 0G」 가 떴다. 연애 게임만 관계 개요로 바꿔 숨겼고, 이야기·공포 게임은 JRPG 파티 개요 그대로였다.
 *
 * 전투가 있다 = 액션 전투·몬스터 파티를 켰거나, 어느 맵에 인카운트·필드 몬스터가 있거나, 어느 이벤트·공용 이벤트가 전투를 연다.
 * 돈을 쓴다 = 전투가 있거나(보상), 어느 이벤트가 상점·여관을 열거나 돈을 바꾸거나, 시작 돈이 있다.
 * 캐시하지 않는다 — 조수 도구는 프로젝트를 제자리에서 고치므로 객체 단위 캐시는 전투를 넣은 뒤에도 「전투 없음」을 돌려준다.
 */
import type { Project } from "./types";

const COMBAT_KINDS = /"kind":"(?:battleProcessing|tacticsBattle|spawnFieldEnemy)"/u;
const MONEY_KINDS = /"kind":"(?:shop|inn|changeGold)"/u;

type Presence = { combat: boolean; money: boolean };

function measure(project: Project): Presence {
  const system = project.system as unknown as Record<string, unknown>;
  let combat = (project.system.actionCombat as { enabled?: boolean } | undefined)?.enabled === true
    || system.battleParty === "monsters" || system.monsterBattleParty === true;
  let money = false;
  const scan = (value: unknown) => {
    if (combat && money) return;
    const text = JSON.stringify(value ?? null);
    if (!combat && COMBAT_KINDS.test(text)) combat = true;
    if (!money && MONEY_KINDS.test(text)) money = true;
  };
  for (const map of Object.values(project.maps)) {
    if (!combat && (((map.encounterRate ?? 0) > 0 && ((map.troopIds?.length ?? 0) > 0 || (map.encounterTable?.length ?? 0) > 0)) || (map.fieldSpawns?.length ?? 0) > 0)) combat = true;
    scan(map.events);
  }
  scan(project.commonEvents);
  const startGold = (project.session as { gold?: number } | undefined)?.gold ?? 0;
  return { combat, money: money || combat || startGold > 0 };
}

function presence(project: Project): Presence { return measure(project); }

/** 이 게임에 전투가 있다(턴제·전술·액션·몬스터 파티·인카운트·필드 몬스터). */
export function gameHasCombat(project: Project): boolean { return presence(project).combat; }

/** 이 게임에서 돈이 뜻이 있다(전투 보상·상점·여관·돈 바꾸기·시작 돈). */
export function gameUsesMoney(project: Project): boolean { return presence(project).money; }
