// 결과 분기를 써 놓고 branchOnResult 를 빠뜨리거나 전투 설정을 battleProcessing 칸에 한 번 더 감싼 명령
// — 첫 관장의 승리 분기(배지·엔딩)가 한 번도 돌지 않았다(2026-10-06 qa:game monster-collect r2).
import { describe, expect, it } from "vitest";
import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";

describe("전투 결과 분기 별칭", () => {
  it("분기에 명령이 있으면 branchOnResult:true 를 채운다", () => {
    const command: Record<string, unknown> = { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true, victoryBranch: [{ kind: "setSwitch", switchId: "s", value: true }] };
    expect(canonicalizeCommandFieldAlias(command)).toContain("branchOnResult:true");
    expect(command.branchOnResult).toBe(true);
  });

  it("branchOnResult 를 명시했거나 분기가 비었으면 그대로 둔다", () => {
    const off: Record<string, unknown> = { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true, branchOnResult: false, victoryBranch: [{ kind: "wait", ms: 1 }] };
    canonicalizeCommandFieldAlias(off);
    expect(off.branchOnResult).toBe(false);
    const empty: Record<string, unknown> = { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true, victoryBranch: [] };
    canonicalizeCommandFieldAlias(empty);
    expect(empty.branchOnResult).toBeUndefined();
  });

  it("안에 감싼 battleProcessing 객체는 빠진 값만 옮기고 지운다", () => {
    const command: Record<string, unknown> = { kind: "battleProcessing", canLose: true, battleProcessing: { troopId: "t", canEscape: false, canLose: false } };
    canonicalizeCommandFieldAlias(command);
    expect(command.battleProcessing).toBeUndefined();
    expect(command.troopId).toBe("t");
    expect(command.canEscape).toBe(false);
    expect(command.canLose).toBe(true);
  });
});
