// test/commandContracts/recallParty.contract.test.ts
// 계약: recallParty (저장한 파티로 조작을 바꾸고, 자리가 다르면 transfer 로 옮긴다).
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { roundtripCommands, runCommandContract } from "./harness";

function seedSets(x: number, y: number) {
  return (session: PlaySessionLike): void => {
    session.partyActorIds = ["actor_hero"];
    (session as PlaySessionLike & { partySets?: unknown }).partySets = {
      b: { actorIds: ["actor_mage"], mapId: session.currentMapId, x, y },
    };
  };
}

describe("recallParty 계약", () => {
  it("정상 효과: 구성원을 바꾸고 다른 자리면 transfer 로 pause 한다", () => {
    const result = runCommandContract([{ kind: "recallParty", partySetId: "b" }], { mutateSession: seedSets(2, 3) });
    expect(result.session.partyActorIds).toEqual(["actor_mage"]);
    expect(result.session.flags.recallPartySuccess).toBe(true);
    expect(result.pauses.map((step) => step.kind)).toEqual(["transfer"]);
  });

  it("같은 자리면 pause 없이 계속한다", () => {
    const result = runCommandContract([{ kind: "recallParty", partySetId: "b" }], {
      mutateSession: (session) => seedSets(session.x, session.y)(session),
    });
    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 묶음은 실패 기억만 남기고 계속한다", () => {
    const result = runCommandContract([{ kind: "recallParty", partySetId: "ghost" }], { mutateSession: seedSets(2, 3) });
    expect(result.session.partyActorIds).toEqual(["actor_hero"]);
    expect(result.session.flags.recallPartySuccess).toBe(false);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성", () => {
    const commands: Command[] = [{ kind: "recallParty", partySetId: "b" }];
    expect(roundtripCommands(commands)).toEqual(commands);
  });
});
