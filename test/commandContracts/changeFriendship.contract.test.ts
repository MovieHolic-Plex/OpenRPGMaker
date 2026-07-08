// test/commandContracts/changeFriendship.contract.test.ts
// G1 계약: changeFriendship (Phase 11b NPC 호감도 커맨드).
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract } from "./harness";

describe("changeFriendship 계약", () => {
  it("정상 효과: 명시 npcKey의 호감도를 증감하고 0..1000으로 클램프한다", () => {
    const result = runCommandContract([
      { kind: "changeFriendship", npcKey: "ev_farmer", delta: 1100 },
      { kind: "changeFriendship", npcKey: "ev_farmer", delta: -1200 },
      { kind: "changeFriendship", npcKey: "ev_farmer", delta: 25 },
    ]);

    expect(result.session.friendship).toEqual({ ev_farmer: 25 });
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("self fallback: npcKey 생략 시 현재 이벤트 id를 사용한다", () => {
    const result = runCommandContract([{ kind: "changeFriendship", delta: 40 }]);

    expect(result.session.friendship?.[CONTRACT_EVENT_ID]).toBe(40);
    expect(result.finished).toBe(true);
  });

  it("이벤트 컨텍스트 없음: npcKey도 currentEventId도 없으면 세션을 변경하지 않는다", () => {
    const result = runCommandContract([{ kind: "changeFriendship", delta: 40 }], { currentEventId: null });

    expect(result.session.friendship).toBeUndefined();
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands: Command[] = [{ kind: "changeFriendship", npcKey: "ev_farmer", delta: 80 }];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: changeFriendship 은 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract([{ kind: "changeFriendship", npcKey: "ev_farmer", delta: 1 }]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
