// test/commandContracts/storeParty.contract.test.ts
// 계약: storeParty (지금 파티의 구성원·선 자리를 이름으로 저장).
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { roundtripCommands, runCommandContract } from "./harness";

const seedParty = (session: PlaySessionLike): void => {
  session.partyActorIds = ["actor_hero", "actor_mage"];
  session.x = 4;
  session.y = 6;
};

describe("storeParty 계약", () => {
  it("정상 효과: 구성원과 위치를 저장한다", () => {
    const result = runCommandContract([{ kind: "storeParty", partySetId: "north" }], { mutateSession: seedParty });
    const session = result.session as PlaySessionLike & { partySets?: Record<string, unknown> };
    expect(session.partySets?.north).toEqual({ actorIds: ["actor_hero", "actor_mage"], mapId: session.currentMapId, x: 4, y: 6 });
    expect(result.finished).toBe(true);
  });

  // #4832: 저장 실패(빈 이름)는 flags.storePartySuccess=false 를 남기고 현재 이벤트 실행을 끝낸다.
  it("빈 이름은 저장하지 않고 실패를 기록한 뒤 이벤트를 끝낸다", () => {
    const result = runCommandContract([{ kind: "storeParty", partySetId: "  " }], { mutateSession: seedParty });
    expect((result.session as { partySets?: unknown }).partySets).toBeUndefined();
    expect(result.session.flags.storePartySuccess).toBe(false);
    expect(result.finished).toBe(false);
  });

  it("왕복 동일성", () => {
    const commands: Command[] = [{ kind: "storeParty", partySetId: "north" }];
    expect(roundtripCommands(commands)).toEqual(commands);
  });

  it("pause 의미론: non-blocking", () => {
    expect(runCommandContract([{ kind: "storeParty", partySetId: "a" }], { mutateSession: seedParty }).pauses).toEqual([]);
  });
});
