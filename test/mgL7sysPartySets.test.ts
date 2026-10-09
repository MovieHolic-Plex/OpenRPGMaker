import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { PREVIOUS_PARTY_SET_ID, recallPartySet, storePartySet } from "@/project/partySets";
import { startSession, type PlaySession } from "@/project/session";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import type { Command, Project } from "@/project/types";

function partyProject(): Project {
  return createBlankProject();
}

/** 명령을 끝까지 돌리고 pause 된 스텝 종류를 순서대로 돌려준다(transfer 는 호스트 대신 좌표를 반영한다). */
function run(commands: Command[], project: Project, session: PlaySession): StepResult[] {
  const steps: StepResult[] = [];
  const interpreter = createInterpreter(commands, session, project, { continueAfterTransfer: true });
  let step = interpreter.start();
  while (step.kind !== "done") {
    steps.push(step);
    if (step.kind === "transfer") {
      session.currentMapId = step.mapId;
      session.x = step.x;
      session.y = step.y;
    }
    step = interpreter.resume();
  }
  return steps;
}

describe("multiple parties (#22)", () => {
  it("storeParty saves members and position under a name", () => {
    const project = partyProject();
    const session = startSession(project, 1);
    session.partyActorIds = ["actor_hero", "actor_mage"];
    session.x = 3;
    session.y = 4;
    run([{ kind: "storeParty", partySetId: "north" }], project, session);
    expect(session.partySets?.north).toEqual({ actorIds: ["actor_hero", "actor_mage"], mapId: project.startMapId, x: 3, y: 4 });
    expect(session.activePartySetId).toBe("north");
  });

  it("recallParty swaps members, auto-stores the leaving party and transfers to the recalled position", () => {
    const project = partyProject();
    const session = startSession(project, 1);
    session.partyActorIds = ["actor_hero"];
    session.x = 2;
    session.y = 2;
    storePartySet(session, "a");
    session.partySets = { ...session.partySets, b: { actorIds: ["actor_scout", "actor_cleric"], mapId: project.startMapId, x: 7, y: 5 } };
    // 파티 a 가 걸어간 뒤 b 로 바꾼다.
    session.x = 9;
    session.y = 1;
    const steps = run([{ kind: "recallParty", partySetId: "b" }], project, session);
    expect(steps.map((step) => step.kind)).toEqual(["transfer"]);
    expect(session.flags.recallPartySuccess).toBe(true);
    expect(session.partyActorIds).toEqual(["actor_scout", "actor_cleric"]);
    expect({ x: session.x, y: session.y }).toEqual({ x: 7, y: 5 });
    expect(session.activePartySetId).toBe("b");
    // 떠난 파티 a 는 떠난 자리(9,1)로 저장된다 — 되부르면 거기서 이어간다.
    expect(session.partySets?.a).toEqual({ actorIds: ["actor_hero"], mapId: project.startMapId, x: 9, y: 1 });
    expect(session.actorVitals.actor_scout).toBeDefined();
  });

  it("recallParty on an unknown set fails without touching the party", () => {
    const project = partyProject();
    const session = startSession(project, 1);
    const before = [...session.partyActorIds];
    const steps = run([{ kind: "recallParty", partySetId: "ghost" }], project, session);
    expect(steps).toEqual([]);
    expect(session.flags.recallPartySuccess).toBe(false);
    expect(session.partyActorIds).toEqual(before);
  });

  it("stores the leaving party under the fallback id when no set was active and drops deleted actors", () => {
    const project = partyProject();
    const session = startSession(project, 1);
    session.partySets = { b: { actorIds: ["actor_mage", "actor_deleted"], mapId: project.startMapId, x: session.x, y: session.y } };
    const result = recallPartySet(project, session, "b");
    expect(result.ok && result.moved).toBe(false);
    expect(session.partyActorIds).toEqual(["actor_mage"]);
    expect(session.partySets?.[PREVIOUS_PARTY_SET_ID]?.actorIds).toEqual(["actor_hero"]);
  });

  it("persists party sets through save/load and the commands through project serialize", () => {
    const project = partyProject();
    project.maps[project.startMapId]!.events.push({
      id: "ev_switch_party", x: 1, y: 1, trigger: { kind: "action" },
      commands: [{ kind: "storeParty", partySetId: "a" }, { kind: "recallParty", partySetId: "b" }],
    });
    const reloaded = deserialize(serialize(project));
    expect(reloaded.maps[project.startMapId]!.events.find((event) => event.id === "ev_switch_party")!.commands)
      .toEqual([{ kind: "storeParty", partySetId: "a" }, { kind: "recallParty", partySetId: "b" }]);

    const session = startSession(project, 1);
    storePartySet(session, "a");
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.partySets).toEqual(session.partySets);
    expect(restored.activePartySetId).toBe("a");
  });
});
