// test/commandDiff.test.ts
// before/after 명령 목록 비교 → 유령 행 계산 → 행 단위 제외 적용.
import { describe, expect, it } from "vitest";
import {
  applyCommandDiff,
  countCommandDiff,
  diffCommandLists,
  hasCommandDiffChanges,
} from "@/editor/panels/eventEditor/commandDiff";
import type { Command } from "@/project/types";

function text(body: string): Command {
  return { kind: "text", body } as Command;
}

describe("diffCommandLists", () => {
  it("문구만 달라진 한 줄은 삭제+추가가 아니라 «바뀜» 한 줄이다", () => {
    const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("change");
    expect(rows[0].before).toMatchObject({ body: "상자다" });
    expect(rows[0].after).toMatchObject({ body: "낡은 상자다" });
  });

  it("끝에 붙은 줄은 «새로 생김», 나머지는 «그대로»다", () => {
    const rows = diffCommandLists([text("안녕")], [text("안녕"), text("새 대사")]);
    expect(rows.map((row) => row.status)).toEqual(["keep", "add"]);
    expect(countCommandDiff(rows)).toEqual({ added: 1, removed: 0, changed: 0 });
  });

  it("사라진 줄은 «없어짐»이다", () => {
    const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
    expect(rows.map((row) => row.status)).toEqual(["keep", "remove"]);
    expect(countCommandDiff(rows)).toEqual({ added: 0, removed: 1, changed: 0 });
  });

  it("조건은 그대로인데 안쪽만 바뀌면 fork 는 «그대로»고 자식만 표시된다", () => {
    const before = [{
      kind: "fork",
      condition: { kind: "selfSwitch", key: "A", value: true },
      then: [text("열었다")],
    } as Command];
    const after = [{
      kind: "fork",
      condition: { kind: "selfSwitch", key: "A", value: true },
      then: [text("열었다"), text("비어 있다")],
    } as Command];

    const rows = diffCommandLists(before, after);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("keep");
    const then = rows[0].branches.find((branch) => branch.key === "forkThen")!;
    expect(then.label).toBe("조건이 맞을 때");
    expect(then.rows.map((row) => row.status)).toEqual(["keep", "add"]);
  });

  it("새로 생긴 fork 는 하위 트리 전체가 «새로 생김»이다", () => {
    const after = [{
      kind: "fork",
      condition: { kind: "selfSwitch", key: "A", value: true },
      then: [text("비어 있다")],
      else: [text("회복약을 얻었다")],
    } as Command];
    const rows = diffCommandLists([], after);
    expect(rows[0].status).toBe("add");
    const branches = rows[0].branches.map((branch) => branch.key);
    expect(branches).toEqual(["forkThen", "forkElse"]);
    for (const branch of rows[0].branches) {
      expect(branch.rows.every((row) => row.status === "add")).toBe(true);
    }
    expect(countCommandDiff(rows)).toEqual({ added: 3, removed: 0, changed: 0 });
  });

  it("바뀌는 것이 없으면 hasChanges 는 false 다", () => {
    const rows = diffCommandLists([text("안녕")], [text("안녕")]);
    expect(hasCommandDiffChanges(rows)).toBe(false);
  });
});

describe("applyCommandDiff", () => {
  it("제외가 없으면 after 를 그대로 만든다", () => {
    const before = [text("안녕")];
    const after = [text("안녕"), text("잘 가")];
    const rows = diffCommandLists(before, after);
    expect(applyCommandDiff(rows)).toEqual(after);
  });

  it("추가를 빼면 그 줄만 안 들어간다", () => {
    const rows = diffCommandLists([text("안녕")], [text("안녕"), text("잘 가")]);
    const addRow = rows.find((row) => row.status === "add")!;
    expect(applyCommandDiff(rows, new Set([addRow.id]))).toEqual([text("안녕")]);
  });

  it("삭제를 빼면 원래 줄이 되살아난다", () => {
    const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
    const removeRow = rows.find((row) => row.status === "remove")!;
    expect(applyCommandDiff(rows, new Set([removeRow.id]))).toEqual([text("안녕"), text("잘 가")]);
  });

  it("바뀜을 빼면 원래 값이 남는다", () => {
    const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
    expect(applyCommandDiff(rows, new Set([rows[0].id]))).toEqual([text("상자다")]);
  });

  it("분기 안쪽 추가만 골라 뺄 수 있다", () => {
    const before = [{
      kind: "fork",
      condition: { kind: "selfSwitch", key: "A", value: true },
      then: [text("열었다")],
    } as Command];
    const after = [{
      kind: "fork",
      condition: { kind: "selfSwitch", key: "A", value: true },
      then: [text("열었다"), text("비어 있다")],
    } as Command];

    const rows = diffCommandLists(before, after);
    const inner = rows[0].branches[0].rows.find((row) => row.status === "add")!;
    expect(applyCommandDiff(rows, new Set([inner.id]))).toEqual(before);
    expect(applyCommandDiff(rows)).toEqual(after);
  });

  it("선택지 분기도 슬롯별로 유지된다", () => {
    const before = [{
      kind: "choices",
      prompt: "",
      options: [
        { text: "네", branch: [text("좋아")] },
        { text: "아니오", branch: [] },
      ],
      cancelBehavior: "none",
    } as unknown as Command];
    const after = structuredClone(before) as unknown as {
      options: { text: string; branch: Command[] }[];
    }[];
    after[0].options[1].branch = [text("알겠다")];

    const rows = diffCommandLists(before, after as unknown as Command[]);
    expect(rows[0].status).toBe("keep");
    expect(applyCommandDiff(rows)).toEqual(after);
  });
});
