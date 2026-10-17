// 경험치 분배 expSplitAlive — 쓰러진 참전자 제외·총량 나누기, 꺼져 있으면 기존 전액. 도망 불가 안내 문장.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { describe, expect, it } from "vitest";
import { monsterExpPlan } from "@/battle/rewardPolicy";
import { emeraldNoEscapeLine } from "@/player/emeraldBattleNarration";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

describe("monsterExpPlan", () => {
  const alive = new Set(["a", "b"]);

  it("is a no-op while expSplitAlive is off (every participant gets the full amount, fainted too)", () => {
    expect(monsterExpPlan(undefined, 90, ["a", "b", "c"], alive)).toEqual({ exp: 90, participantIds: ["a", "b", "c"] });
    expect(monsterExpPlan({ expShare: true }, 90, undefined, alive)).toEqual({ exp: 90, participantIds: undefined });
  });

  it("splits among the participants that are still standing and drops the fainted one", () => {
    expect(monsterExpPlan({ expSplitAlive: true }, 90, ["a", "b", "c"], alive)).toEqual({ exp: 45, participantIds: ["a", "b"] });
  });

  it("gives at least 1 exp each while there is any exp, and nothing when nobody is standing", () => {
    expect(monsterExpPlan({ expSplitAlive: true }, 1, ["a", "b"], alive).exp).toBe(1);
    expect(monsterExpPlan({ expSplitAlive: true }, 90, ["c"], alive)).toEqual({ exp: 0, participantIds: [] });
    expect(monsterExpPlan({ expSplitAlive: true }, 0, ["a"], alive).exp).toBe(0);
  });
});

describe("emeraldNoEscapeLine", () => {
  it("says the trainer line only for trainer troops", () => {
    expect(emeraldNoEscapeLine({ troopId: "no_such_troop" })).toBe("도망칠 수 없다!");
  });
});

describe("rewardPolicy save bytes", () => {
  it("keeps expSplitAlive out of the saved policy unless it is on", () => {
    // Break: a new optional field must not appear for projects that never opted in.
    const off = normalizeSystemRecords({ startActorIds: [], rewardPolicy: { participationOnly: true } });
    expect(off.rewardPolicy).toEqual({ participationOnly: true, levelGapPenalty: false });
    const on = normalizeSystemRecords({ startActorIds: [], rewardPolicy: { expSplitAlive: true } });
    expect(on.rewardPolicy?.expSplitAlive).toBe(true);
  });
});
