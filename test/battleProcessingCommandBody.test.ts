import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { namedVariablesOf } from "@/editor/panels/eventEditor/commandBodyDatabase";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("battleProcessing modern form", () => {
  let restoreDom: (() => void) | undefined;
  let staged: Command;

  const actions: CommandListActions = {
    addCommand: () => undefined,
    insertCommand: () => undefined,
    deleteCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
    replaceCommand: (_path, command) => {
      staged = command;
    },
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
    staged = { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false };
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("노출: 적 그룹/도망/패배/방식/프리셋/경고", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "event-command-battle-processing-form")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-troop-select")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-escape-select")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-lose-select")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-flow-select")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-presets")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-escape-checkbox")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-lose-checkbox")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-warning")?.textContent).toContain("적 그룹");
    expect(findByTestId(body, "battle-processing-intent")?.textContent).toContain("전투");
  });

  it("보스 프리셋: 도망 불가 + 엄격 턴제", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const boss = findByTestId(body, "battle-processing-preset-boss") as unknown as HTMLButtonElement;
    boss.click();
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.canEscape).toBe(false);
    expect(staged.canLose).toBe(false);
    expect(staged.battleFlow).toBe("strict");
  });

  it("필드 프리셋: 도망/패배 허용", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const field = findByTestId(body, "battle-processing-preset-field") as unknown as HTMLButtonElement;
    field.click();
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.canEscape).toBe(true);
    expect(staged.canLose).toBe(true);
    expect(staged.battleFlow).toBeUndefined();
  });

  it("스토리 프리셋: 도망 불가 + 게임오버", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const story = findByTestId(body, "battle-processing-preset-story") as unknown as HTMLButtonElement;
    story.click();
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.canEscape).toBe(false);
    expect(staged.canLose).toBe(false);
    expect(staged.battleFlow).toBeUndefined();
  });

  it("트룹 선택 시 경고가 사라진다", () => {
    const troopId = store.getCurrent().database.troops[0]?.id ?? "";
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const select = findByTestId(body, "battle-processing-troop-select") as unknown as HTMLSelectElement;
    select.value = troopId;
    select.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.troopId).toBe(troopId);
    const warning = findByTestId(body, "battle-processing-warning") as unknown as HTMLElement;
    expect(warning.hidden).toBe(true);
  });

  it("결과 분기 토글이 branchOnResult 를 켠다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const checkbox = findByTestId(body, "battle-processing-branch-on-result") as unknown as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.branchOnResult).toBe(true);
    expect(staged.victoryBranch).toEqual([]);
    expect(staged.defeatBranch).toEqual([]);
    expect(staged.escapeBranch).toEqual([]);
  });

  it("레거시 체크박스로 도망/패배 규칙을 바꿀 수 있다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const escape = findByTestId(body, "battle-processing-escape-checkbox") as unknown as HTMLInputElement;
    const lose = findByTestId(body, "battle-processing-lose-checkbox") as unknown as HTMLInputElement;
    escape.checked = false;
    escape.dispatchEvent(new Event("change"));
    lose.checked = true;
    lose.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.canEscape).toBe(false);
    expect(staged.canLose).toBe(true);
  });

  it("도망 세그먼트 변경이 canEscape 를 반영한다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const select = findByTestId(body, "battle-processing-escape-select") as unknown as HTMLSelectElement;
    select.value = "deny";
    select.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.canEscape).toBe(false);
  });

  it("고정 모드에서는 변수 컨트롤이 DOM 에 없다 (그룹/변수 이중 노출 금지)", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "battle-processing-troop-select")).toBeTruthy();
    expect(findByTestId(body, "battle-processing-troop-variable")).toBeFalsy();
  });

  it("변수 모드는 한 줄로 교체되고 이름 있는 변수만 나열한다", () => {
    const project = store.getCurrent();
    const namedCount = project.variables.filter((entry) => entry.name.trim().length > 0).length;
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const source = findByTestId(body, "battle-processing-troop-source") as unknown as HTMLSelectElement;
    source.value = "variable";
    source.dispatchEvent(new Event("change"));

    const variableRow = findByTestId(body, "battle-processing-troop-variable") as unknown as HTMLElement;
    expect(variableRow).toBeTruthy();
    // 고정 트룹 픽커는 슬롯에서 밀려나간다 — 트룹 소스 컨트롤은 하나다.
    expect(findByTestId(body, "battle-processing-troop-select")).toBeFalsy();

    const options = Array.from(variableRow.querySelectorAll("option")) as unknown as HTMLOptionElement[];
    expect(options.some((option) => (option.textContent ?? "").trim() === "(이름 없음)")).toBe(false);
    // "(변수 선택)" 한 장 + 이름 있는 슬롯만.
    expect(options.length).toBe(namedCount + 1);
    expect(staged.kind).toBe("battleProcessing");
    if (staged.kind !== "battleProcessing") return;
    expect(staged.troopSource).toBe("variable");
  });

  it("변수 모드에서도 트룹 출처 세그먼트와 경고가 유지된다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const source = findByTestId(body, "battle-processing-troop-source") as unknown as HTMLSelectElement;
    source.value = "variable";
    source.dispatchEvent(new Event("change"));
    expect(findByTestId(body, "battle-processing-troop-source")).toBeTruthy();
    const warning = findByTestId(body, "battle-processing-warning") as unknown as HTMLElement;
    // 변수 모드에서는 빈 트룹 경고를 띄우지 않는다.
    expect(warning.hidden).toBe(true);
  });
});

describe("namedVariablesOf", () => {
  it("이름이 빈 슬롯은 거른다", () => {
    const project = createBlankProject();
    project.variables = [
      { id: "v1", name: "적 그룹 번호" },
      { id: "v2", name: "   " },
      { id: "v3", name: "" },
    ] as typeof project.variables;
    expect(namedVariablesOf(project)).toEqual([{ id: "v1", name: "적 그룹 번호" }]);
  });
});
