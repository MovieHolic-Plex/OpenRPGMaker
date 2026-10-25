// J7: HP 0 인 파티원은 필드 메뉴(파티 개요·회복약 대상)에서 「정상」이 아니라 「전투불능」으로 보인다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { actorFieldStateNames, KNOCKED_OUT_STATE_NAME } from "@/player/actorFieldStates";
import { createPlayerStatusMenuSnapshot } from "@/player/playerStatusMenuModel";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";

function knockedOutParty() {
  const project = createBlankProject();
  const session = startSession(project);
  const actorId = session.partyActorIds[0]!;
  session.actorVitals[actorId] = { ...session.actorVitals[actorId]!, hp: 0 };
  return { project, session, actorId };
}

describe("필드 메뉴의 전투불능 표시", () => {
  it("HP 0 이면 상태 이름 맨 앞에 전투불능을 붙인다", () => {
    const { project, session, actorId } = knockedOutParty();
    expect(actorFieldStateNames(project, session, actorId)).toEqual([KNOCKED_OUT_STATE_NAME]);
    session.actorVitals[actorId] = { ...session.actorVitals[actorId]!, hp: 1 };
    expect(actorFieldStateNames(project, session, actorId)).toEqual([]);
  });

  it("파티 개요 행의 상태가 정상이 아니다", () => {
    const { project, session, actorId } = knockedOutParty();
    const row = createPlayerStatusMenuSnapshot(project, session).partyRows.find((entry) => entry.actorId === actorId)!;
    expect(row.stateNames).toContain(KNOCKED_OUT_STATE_NAME);
    expect(row.condition).toBe(KNOCKED_OUT_STATE_NAME);
  });

  it("회복약 대상 카드도 전투불능을 보인다", () => {
    const { project, session, actorId } = knockedOutParty();
    const potion = project.database.items.find((item) => item.id === "item_potion")!;
    session.inventory[potion.id] = 2;
    const detail = createStatusMenuDetail({ project, session, selectedCommand: "items", targetItemId: potion.id, slots: [], waitModeEnabled: true } as Parameters<typeof createStatusMenuDetail>[0]);
    const entry = detail.entries.find((candidate) => candidate.vitals && candidate.label === project.database.actors.find((actor) => actor.id === actorId)!.name)!;
    expect(entry.vitals?.stateNames).toContain(KNOCKED_OUT_STATE_NAME);
  });
});
