/**
 * presentItem — 「NPC 에게 증거를 들이민다」 명령.
 *
 * 추리 게임 도그푸딩에서 choices + 아이템 소지 조건으로 흉내만 내던 동작을 엔진 명령으로
 * 만들었다. 인터프리터는 소지한 후보만 목록에 올리고, 고른 itemId 로 재개되면
 * 맞는 option → 그 branch, 후보지만 틀린 것 → otherwiseBranch, 닫음·후보 없음 → cancelBranch.
 */
import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function mkSession(inventory: Record<string, number>): PlaySessionLike {
  return {
    flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: { ...inventory },
    partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
    currentMapId: "m1", x: 0, y: 0, audio: {}, pictures: {},
  } as unknown as PlaySessionLike;
}

const say = (body: string): Command => ({ kind: "text", body });

function presentCommand(overrides: Partial<Extract<Command, { kind: "presentItem" }>> = {}): Command {
  return {
    kind: "presentItem",
    prompt: "무엇을 보여줄까?",
    options: [{ itemId: "knife", branch: [say("그 칼은…!")] }],
    otherwiseBranch: [say("그게 무슨 상관이죠?")],
    cancelBranch: [say("할 말 없으면 가세요.")],
    ...overrides,
  };
}

/** 첫 정지에서 목록을 보고, value 로 재개한 뒤 이어지는 대사를 모은다. */
function run(command: Command, inventory: Record<string, number>, value: string | undefined) {
  const session = mkSession(inventory);
  const interp = createInterpreter([command, say("끝")], session);
  const first = interp.start();
  const bodies: string[] = [];
  let step = first.kind === "presentItem" ? interp.resume(value) : first;
  while (step.kind === "text") {
    bodies.push(step.body);
    step = interp.resume(undefined);
  }
  return { first, bodies, session, last: step };
}

describe("presentItem 인터프리터", () => {
  it("소지한 후보만 목록에 올리고 prompt 를 함께 낸다", () => {
    const { first } = run(presentCommand({ itemIds: ["knife", "letter", "ring"] }), { knife: 1, ring: 2, potion: 5 }, undefined);
    expect(first).toMatchObject({
      kind: "presentItem",
      prompt: "무엇을 보여줄까?",
      items: [{ itemId: "knife", count: 1 }, { itemId: "ring", count: 2 }],
    });
  });

  it("itemIds 를 생략하면 소지품 전체가 후보다", () => {
    const { first } = run(presentCommand(), { knife: 1, potion: 3, empty: 0 }, undefined);
    expect(first.kind === "presentItem" && first.items.map((item) => item.itemId)).toEqual(["knife", "potion"]);
  });

  it("맞는 아이템을 내면 그 option 의 branch 를 실행하고 뒤로 이어간다", () => {
    const { bodies, session } = run(presentCommand(), { knife: 1, potion: 1 }, "knife");
    expect(bodies).toEqual(["그 칼은…!", "끝"]);
    expect(session.inventory.knife).toBe(1);
  });

  it("후보지만 틀린 아이템을 내면 otherwiseBranch", () => {
    const { bodies } = run(presentCommand(), { knife: 1, potion: 1 }, "potion");
    expect(bodies).toEqual(["그게 무슨 상관이죠?", "끝"]);
  });

  it("닫으면 cancelBranch", () => {
    const { bodies } = run(presentCommand(), { knife: 1 }, undefined);
    expect(bodies).toEqual(["할 말 없으면 가세요.", "끝"]);
  });

  it("소지하지 않았거나 후보가 아닌 아이템 id 로 재개하면 취소로 본다", () => {
    expect(run(presentCommand(), { potion: 1 }, "knife").bodies).toEqual(["할 말 없으면 가세요.", "끝"]);
    expect(run(presentCommand({ itemIds: ["knife"] }), { knife: 1, potion: 1 }, "potion").bodies)
      .toEqual(["할 말 없으면 가세요.", "끝"]);
  });

  it("보여줄 후보가 없으면 빈 목록으로 멈추고, 닫으면 cancelBranch", () => {
    const { first, bodies } = run(presentCommand({ itemIds: ["knife"] }), { potion: 1 }, undefined);
    expect(first).toMatchObject({ kind: "presentItem", items: [] });
    expect(bodies).toEqual(["할 말 없으면 가세요.", "끝"]);
  });

  it("consume 이면 맞는 아이템만 1개 소모한다", () => {
    expect(run(presentCommand({ consume: true }), { knife: 2 }, "knife").session.inventory.knife).toBe(1);
    expect(run(presentCommand({ consume: true }), { knife: 1, potion: 1 }, "potion").session.inventory.potion).toBe(1);
  });

  it("분기를 비워도 다음 명령으로 넘어간다", () => {
    const { bodies } = run({ kind: "presentItem", options: [{ itemId: "knife", branch: [] }] }, { knife: 1, potion: 1 }, "potion");
    expect(bodies).toEqual(["끝"]);
  });
});
