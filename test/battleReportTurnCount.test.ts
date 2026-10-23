import { describe, expect, it } from "vitest";
import { battleRoundCount } from "@/project/battleReports";
import type { BattleSnapshot } from "@/battle/types";

const snapshot = (fields: Partial<BattleSnapshot>) => fields as BattleSnapshot;

describe("battleRoundCount", () => {
  it("gauge 전투는 파티가 낸 명령 수를 센다", () => {
    expect(battleRoundCount(snapshot({ turn: 1, strictRound: 0, partyCommandRounds: 7 }))).toBe(7);
  });

  it("strict 전투는 완료한 라운드 수를 센다", () => {
    expect(battleRoundCount(snapshot({ turn: 3, strictRound: 3, partyCommandRounds: 4 }))).toBe(3);
  });

  it("명령 수를 남기지 않은 옛 스냅샷은 사이클 수로 되돌아간다", () => {
    expect(battleRoundCount(snapshot({ turn: 2, strictRound: 0 }))).toBe(2);
  });

  it("명령이 하나도 없는 전투도 0턴이 아니라 1턴이다", () => {
    expect(battleRoundCount(snapshot({ turn: 0, strictRound: 0, partyCommandRounds: 0 }))).toBe(1);
  });
});
