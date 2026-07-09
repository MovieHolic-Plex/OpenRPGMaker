// test/commandContracts/promoteActor.contract.test.ts
// G1 계약: promoteActor (Phase 8a 승급 커맨드).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

function ids(): { actorId: string; fromClassId: string; toClassId: string } {
  const project = createBlankProject();
  const actorId = project.database.actors[0]?.id;
  const fromClassId = project.database.actors[0]?.classId;
  const toClassId = project.database.classes.find((record) => record.id !== fromClassId)?.id;
  if (!actorId || !fromClassId || !toClassId) throw new Error("blank project 에 actor/class 2종이 있어야 한다");
  return { actorId, fromClassId, toClassId };
}

function addPromotion(project: Project, itemRequired = false): void {
  const { fromClassId, toClassId } = ids();
  const klass = project.database.classes.find((record) => record.id === fromClassId);
  if (!klass) throw new Error("missing source class");
  klass.promotions = [{ toClassId, requires: itemRequired ? { itemId: "item_contract_badge" } : { level: 1 } }];
  if (itemRequired) project.database.items.push({ ...project.database.items[0], id: "item_contract_badge", name: "계약 증표" });
}

function command(): Command {
  const { actorId, toClassId } = ids();
  return {
    kind: "promoteActor",
    actorId,
    toClassId,
    successBranch: [{ kind: "setFlag", flag: "promote_success", value: true }],
    failureBranch: [{ kind: "setFlag", flag: "promote_failure", value: true }],
  };
}

describe("promoteActor 계약", () => {
  it("정상 효과: 조건을 만족하면 성공 분기를 실행하고 classOverrides를 기록한다", () => {
    const { actorId, toClassId } = ids();
    const result = runCommandContract([command()], { mutateProject: (project) => addPromotion(project) });

    expect(result.session.classOverrides?.[actorId]).toBe(toClassId);
    expect(result.session.flags.promote_success).toBe(true);
    expect(result.session.flags.promote_failure).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("조건 미충족: 실패 분기를 실행하고 직업을 바꾸지 않는다", () => {
    const { actorId } = ids();
    const result = runCommandContract([command()], { mutateProject: (project) => addPromotion(project, true) });

    expect(result.session.classOverrides?.[actorId]).toBeUndefined();
    expect(result.session.flags.promote_failure).toBe(true);
    expect(result.session.flags.promote_success).toBeUndefined();
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands = [command()];
    const original = runCommandContract(commands, { mutateProject: (project) => addPromotion(project) });
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { mutateProject: (project) => addPromotion(project) });

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: promoteActor 는 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract([command()], { mutateProject: (project) => addPromotion(project) });

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
