// test/commandContracts/presentItem.contract.test.ts
// G1 계약: presentItem (아이템 제시 — 증거 들이밀기).
//
// 실측 메모:
// - 재개 값은 고른 itemId 문자열. 목록에 없던 id·문자열이 아닌 값은 닫음(cancelBranch)이다.
// - 후보가 하나도 없어도 pause 는 1회 난다(items: []). UI 가 prompt 를 보이고 닫힘으로 재개한다.
// - 존재하지 않는 itemId 참조는 deserialize 의 참조 검증이 막는다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

const evidence: Extract<Command, { kind: "presentItem" }> = {
  kind: "presentItem",
  prompt: "증거를 제시하라",
  itemIds: ["item_knife", "item_letter"],
  options: [{ itemId: "item_knife", branch: [{ kind: "setSwitch", switchId: "sw_right", value: true }] }],
  otherwiseBranch: [{ kind: "setSwitch", switchId: "sw_wrong", value: true }],
  cancelBranch: [{ kind: "setSwitch", switchId: "sw_cancel", value: true }],
  consume: true,
};

function registerEvidence(project: Project): void {
  for (const id of ["item_knife", "item_letter"]) {
    project.database.items.push({ ...structuredClone(project.database.items[0]!), id, name: id });
  }
  project.switches.push({ id: "sw_right", name: "right" }, { id: "sw_wrong", name: "wrong" }, { id: "sw_cancel", name: "cancel" });
}

const holdBoth = { mutateSession: (session: { inventory: Record<string, number> }) => { session.inventory.item_knife = 1; session.inventory.item_letter = 1; } };

describe("presentItem 계약", () => {
  it("정상 효과: 맞는 아이템 → 그 branch, consume 으로 1개 소모", () => {
    const result = runCommandContract([evidence], { ...holdBoth, answers: ["item_knife"] });
    expect(result.pauses).toEqual([expect.objectContaining({
      kind: "presentItem",
      prompt: "증거를 제시하라",
      items: [{ itemId: "item_knife", count: 1 }, { itemId: "item_letter", count: 1 }],
    })]);
    expect(result.session.switches).toEqual({ sw_right: true });
    expect(result.session.inventory.item_knife ?? 0).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("틀린 아이템 → otherwiseBranch, 소모 없음", () => {
    const result = runCommandContract([evidence], { ...holdBoth, answers: ["item_letter"] });
    expect(result.session.switches).toEqual({ sw_wrong: true });
    expect(result.session.inventory.item_letter).toBe(1);
    expect(result.finished).toBe(true);
  });

  it("경계: 후보를 하나도 안 가졌으면 빈 목록 pause 후 cancelBranch", () => {
    const result = runCommandContract([evidence], { answers: [undefined] });
    expect(result.pauses).toEqual([expect.objectContaining({ kind: "presentItem", items: [] })]);
    expect(result.session.switches).toEqual({ sw_cancel: true });
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후에도 명령과 결과가 같다", () => {
    const commands: Command[] = [evidence];
    const original = runCommandContract(commands, { ...holdBoth, answers: ["item_knife"] });
    const restoredCommands = roundtripCommands(commands, registerEvidence);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { ...holdBoth, answers: ["item_knife"] });
    expect(restored.session).toEqual(original.session);
    expect(restored.pauses).toEqual(original.pauses);
  });

  it("참조 무결성: 없는 itemId 는 deserialize 가 거부한다", () => {
    expect(() => roundtripCommands([{ ...evidence, options: [{ itemId: "item_missing", branch: [] }] }], registerEvidence))
      .toThrow(/presentItem.*item_missing/);
  });
});
