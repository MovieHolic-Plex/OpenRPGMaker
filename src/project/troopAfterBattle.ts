// 적 그룹 「전투 뒤」 이벤트 — TroopRecord.afterBattle 의 정규화와 순회.
//
// 전투 이벤트 페이지(battleEventPages)는 전투 **안**에서, 이 명령 목록은 결과 화면이 닫힌 뒤
// **필드**에서 돈다. 그래서 명령 문맥은 맵 이벤트("map")와 같다 — 대사·스위치·장소 이동·상점이
// 모두 된다. 러너는 player/troopAfterBattleRunner.ts.
//
// 명령 목록을 훑는 곳(참조 검사·이름 바꾸기·삭제 정리)은 전투 이벤트 페이지를 훑은 바로 옆에서
// troopAfterBattleLists 를 같이 훑는다 — 목록을 따로 들고 다니지 않게 한 함수로 모은다.
import type { Command } from "@/project/types";
import type { TroopAfterBattle, TroopAfterBattleOutcome, TroopRecord } from "@/project/types/database";

export const TROOP_AFTER_BATTLE_OUTCOMES: readonly TroopAfterBattleOutcome[] = ["victory", "defeat", "escape"];

export const TROOP_AFTER_BATTLE_LABELS: Readonly<Record<TroopAfterBattleOutcome, string>> = {
  victory: "이겼을 때",
  defeat: "졌을 때",
  escape: "도망쳤을 때",
};

/** 빈 목록·모르는 키는 버린다. 남는 게 없으면 undefined — 레코드에 키를 만들지 않는다. */
export function normalizeTroopAfterBattle(value: unknown): TroopAfterBattle | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const next: TroopAfterBattle = {};
  for (const outcome of TROOP_AFTER_BATTLE_OUTCOMES) {
    const commands = source[outcome];
    if (Array.isArray(commands) && commands.length > 0) next[outcome] = commands as Command[];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** 저작된 목록만(빈 결과 제외). 순회기가 page.commands 옆에서 같이 돈다. */
export function troopAfterBattleLists(troop: Pick<TroopRecord, "afterBattle">): { readonly outcome: TroopAfterBattleOutcome; readonly commands: Command[] }[] {
  const afterBattle = troop.afterBattle;
  if (!afterBattle) return [];
  return TROOP_AFTER_BATTLE_OUTCOMES.flatMap((outcome) => {
    const commands = afterBattle[outcome];
    return commands && commands.length > 0 ? [{ outcome, commands }] : [];
  });
}

/** 명령 목록을 제자리에서 바꾸는 정리기(맵 삭제·끊긴 참조 제거)용. 빈 목록이 되면 그 결과 키를 지운다. */
export function mapTroopAfterBattleLists(troop: TroopRecord, transform: (commands: Command[]) => Command[]): void {
  if (!troop.afterBattle) return;
  for (const outcome of TROOP_AFTER_BATTLE_OUTCOMES) {
    const commands = troop.afterBattle[outcome];
    if (commands) troop.afterBattle[outcome] = transform(commands);
  }
  const normalized = normalizeTroopAfterBattle(troop.afterBattle);
  if (normalized) troop.afterBattle = normalized;
  else delete troop.afterBattle;
}

export function troopAfterBattleCommands(troop: Pick<TroopRecord, "afterBattle"> | undefined, outcome: TroopAfterBattleOutcome): readonly Command[] {
  return troop?.afterBattle?.[outcome] ?? [];
}
