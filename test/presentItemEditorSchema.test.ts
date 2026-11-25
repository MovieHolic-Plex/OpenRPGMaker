// presentItem(아이템 제시) 의 에디터 표면: 명령 목록 이름·스키마 폼·분기 표시.
// 새 편집기를 만들지 않고 스키마 폼에 정답 아이템 목록 위젯 하나만 더했다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/editor/eventCommands/schema/catalog";
import "@/editor/eventCommands/schema/catalogExtended";
import { commandSchemaFor } from "@/editor/eventCommands/schema/defineCommand";
import { renderSchemaCommandBody, schemaSummary } from "@/editor/panels/eventEditor/schemaCommandBody";
import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { newCommand } from "@/editor/eventActions";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand,
      deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
    },
  };
}

const evidence: Extract<Command, { kind: "presentItem" }> = {
  kind: "presentItem",
  prompt: "증거를 보여라",
  options: [
    { itemId: "knife", branch: [{ kind: "text", body: "그 칼은!" }] },
    { itemId: "letter", branch: [] },
  ],
  otherwiseBranch: [{ kind: "text", body: "상관없어요" }],
  cancelBranch: [],
};

describe("presentItem 에디터", () => {
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });

  it("명령 목록 이름과 새 명령 기본값", () => {
    expect(commandKindLabel("presentItem")).toBe("아이템 제시");
    expect(newCommand("presentItem")).toMatchObject({ kind: "presentItem", options: [] });
  });

  it("요약문은 prompt 와 정답 수를 보인다", () => {
    expect(schemaSummary(evidence)).toBe("“증거를 보여라” · 정답 2개");
  });

  it("분기: 정답마다 하나 + 틀림 + 닫음, 경로로 되찾을 수 있다", () => {
    const branches = eventCommandBranches(evidence);
    expect(branches.map((branch) => branch.kind)).toEqual(["presentOption", "presentOption", "presentOtherwise", "presentCancel"]);
    // 배열이 없는 분기는 드롭 목표로 뜨지 않는다(eventCommandBranches 의 include 규칙).
    expect(eventCommandBranches({ ...evidence, cancelBranch: undefined }).map((branch) => branch.kind)).not.toContain("presentCancel");
    const commands: Command[] = [structuredClone(evidence)];
    for (const branch of branches) {
      expect(resolveCommandListAtPath(commands, [0, branch.branchIndex, 0], { missingBranches: "create" })).toEqual(branch.commands);
    }
  });

  it("스키마 폼: 정답 추가는 첫 아이템으로 빈 분기를 붙이고, 삭제는 나머지 분기를 지킨다", () => {
    const schema = commandSchemaFor("presentItem");
    expect(schema).toBeDefined();
    const firstItemId = store.getCurrent().database.items[0]!.id;

    const add = vi.fn();
    const body = renderSchemaCommandBody(ctx(add), evidence);
    expect(body).toBeDefined();
    findByTestId(body as never, "present-item-options-add")!.click();
    const [, added] = add.mock.calls[0] as [number[], Extract<Command, { kind: "presentItem" }>];
    expect(added.options).toEqual([...evidence.options, { itemId: firstItemId, branch: [] }]);
    expect(added.otherwiseBranch).toEqual(evidence.otherwiseBranch);

    const remove = vi.fn();
    const again = renderSchemaCommandBody(ctx(remove), evidence);
    findByTestId(again as never, "present-item-options-remove-1")!.click();
    const [, removed] = remove.mock.calls[0] as [number[], Extract<Command, { kind: "presentItem" }>];
    expect(removed.options).toEqual([evidence.options[0]]);
  });
});
