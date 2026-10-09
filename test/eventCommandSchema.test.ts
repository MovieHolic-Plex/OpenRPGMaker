import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/editor/eventCommands/schema/catalog";
import "@/editor/eventCommands/schema/catalogExtended";
import {
  allCommandSchemas,
  commandSchemaFor,
  schemaBranchesOf,
} from "@/editor/eventCommands/schema/defineCommand";
import { visibleFields } from "@/editor/eventCommands/schema/fieldTypes";
import {
  SCHEMA_RENDERED_KINDS,
  renderSchemaCommandBody,
  renderSchemaForm,
  schemaSummary,
  summaryLookup,
} from "@/editor/panels/eventEditor/schemaCommandBody";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

describe("이벤트 명령 스키마", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });

  it("등록된 스키마의 kind 는 모두 COMMAND_KINDS 안에 있다", () => {
    const known = new Set<string>(COMMAND_KINDS);
    const unknown = allCommandSchemas()
      .map((schema) => schema.kind)
      .filter((kind) => !known.has(kind));
    expect(unknown).toEqual([]);
  });

  it("kind 가 중복 등록되지 않는다", () => {
    const kinds = allCommandSchemas().map((schema) => schema.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("모든 스키마가 빈 명령에서도 요약문을 만든다 (던지지 않는다)", () => {
    const lookup = summaryLookup();
    for (const schema of allCommandSchemas()) {
      const summary = schema.summary({ kind: schema.kind }, lookup);
      expect(typeof summary, `${schema.kind} 요약문 타입`).toBe("string");
      expect(summary.length, `${schema.kind} 요약문 비어 있음`).toBeGreaterThan(0);
    }
  });

  it("battleProcessing: branchOnResult 가 분기 3개를 만들고 끄면 없앤다", () => {
    const off = schemaBranchesOf({ kind: "battleProcessing", branchOnResult: false } as never);
    expect(off).toEqual([]);

    const on = schemaBranchesOf({ kind: "battleProcessing", branchOnResult: true } as never);
    expect(on.map((branch) => branch.key)).toEqual(["victoryBranch", "defeatBranch", "escapeBranch"]);
    expect(on.map((branch) => branch.label)).toEqual(["승리", "패배", "도주"]);
  });

  it("battleProcessing: troopSource 가 적 그룹 필드를 배타적으로 교체한다", () => {
    const schema = commandSchemaFor("battleProcessing");
    if (!schema) throw new Error("battleProcessing 스키마 없음");

    const fixed = visibleFields(schema.fields, { troopSource: "fixed" }).map(([key]) => key);
    expect(fixed).toContain("troopId");
    expect(fixed).not.toContain("troopVariableId");

    const variable = visibleFields(schema.fields, { troopSource: "variable" }).map(([key]) => key);
    expect(variable).toContain("troopVariableId");
    expect(variable).not.toContain("troopId");
  });

  it("fork: else 가 있을 때만 두 번째 분기를 만든다", () => {
    const thenOnly = schemaBranchesOf({ kind: "fork", then: [] } as never);
    expect(thenOnly.map((branch) => branch.key)).toEqual(["then"]);

    const both = schemaBranchesOf({ kind: "fork", then: [], else: [] } as never);
    expect(both.map((branch) => branch.key)).toEqual(["then", "else"]);
  });

  it("wait: 변수 참조가 있으면 ms 필드를 숨긴다", () => {
    const schema = commandSchemaFor("wait");
    if (!schema) throw new Error("wait 스키마 없음");

    expect(visibleFields(schema.fields, { ms: 500 }).map(([key]) => key)).toContain("ms");
    expect(visibleFields(schema.fields, { variableId: "var_0001" }).map(([key]) => key)).not.toContain("ms");
  });

  it("operand 필드는 변수 참조를 요약문에서 보존한다", () => {
    const project = store.getCurrent();
    const variableId = project.variables[0]?.id ?? "";
    expect(variableId).not.toBe("");

    const fixed = schemaSummary({ kind: "changeGold", op: "+=", amount: 120 } as Command);
    expect(fixed).toContain("120");

    // 기존 changeGoldBody 는 parseInt 로 변수 참조를 소실시켰다. 스키마 경로는 유지한다.
    const byVariable = schemaSummary({
      kind: "changeGold",
      op: "+=",
      amount: { kind: "var", id: variableId },
    } as Command);
    expect(byVariable).not.toContain("0G");
    expect(byVariable).toContain(project.variables[0]?.name ?? variableId);
  });

  it("setSwitch 요약문이 스위치 이름과 값을 함께 보여준다", () => {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "";
    expect(switchId).not.toBe("");

    expect(schemaSummary({ kind: "setSwitch", switchId, value: true } as Command)).toContain("ON");
    expect(schemaSummary({ kind: "setSwitch", switchId, value: false } as Command)).toContain("OFF");
    expect(schemaSummary({ kind: "setSwitch", switchId, value: "toggle" } as Command)).toContain("반전");
  });

  it("미등재 kind 는 스키마 렌더 경로를 타지 않는다", () => {
    // 스키마가 있어도 SCHEMA_RENDERED_KINDS 에 없으면 기존 폼이 계속 담당한다.
    expect(SCHEMA_RENDERED_KINDS.has("text")).toBe(false);
    expect(renderSchemaCommandBody(ctx(), { kind: "text", body: "안녕" } as Command)).toBeUndefined();
  });

  it("등재 목록에 있는 kind 만 스키마 폼을 렌더한다", () => {
    // 등재는 기존 testid 계약을 승계한 kind 에만 허용된다. 절차 없는 등재를 이 테스트가 막는다.
    for (const schema of allCommandSchemas()) {
      const rendered = renderSchemaCommandBody(ctx(), { kind: schema.kind } as Command);
      if (SCHEMA_RENDERED_KINDS.has(schema.kind)) expect(rendered).toBeDefined();
      else expect(rendered, `${schema.kind} 가 전환 절차 없이 등재됨`).toBeUndefined();
    }
  });

  it("진영 태도 값 스키마는 연산별 범위와 소수 단계를 선언하고 렌더러가 소수를 보존한다", () => {
    const schema = commandSchemaFor("changeFactionStance");
    if (!schema) throw new Error("changeFactionStance 스키마 없음");
    const valueSpec = schema.fields.value;
    if (!valueSpec || valueSpec.type !== "number") throw new Error("changeFactionStance 값 스키마 없음");
    const min = (command: Record<string, unknown>) => typeof valueSpec.min === "function" ? valueSpec.min(command) : valueSpec.min;
    const max = (command: Record<string, unknown>) => typeof valueSpec.max === "function" ? valueSpec.max(command) : valueSpec.max;
    expect([min({ op: "=" }), max({ op: "=" }), valueSpec.step]).toEqual([-2, 2, 0.25]);
    expect([min({ op: "+=" }), max({ op: "+=" })]).toEqual([0, 4]);

    const replaceCommand = vi.fn();
    const command = { kind: "changeFactionStance", a: "guard", b: "player", op: "+=", value: 0.25 } as Command;
    const body = renderSchemaForm(ctx(replaceCommand), command, schema);
    const input = findByTestId(body as never, "change-faction-stance-value-input") as
      | { value: string; dispatchEvent: (event: unknown) => void }
      | undefined;
    expect(input).toBeTruthy();
    if (!input) return;
    input.value = "0.25";
    input.dispatchEvent(new Event("change"));
    const [, next] = replaceCommand.mock.calls[0] as [number[], Record<string, unknown>];
    expect(next.value).toBe(0.25);
  });

  it("스키마 폼은 필드를 컨트롤로 렌더한다", () => {
    const schema = commandSchemaFor("cutsceneControl");
    if (!schema) throw new Error("cutsceneControl 스키마 없음");
    const body = renderSchemaForm(ctx(), { kind: "cutsceneControl", mode: "begin" } as Command, schema);
    expect(findByTestId(body as never, "event-command-cutscene-mode")).toBeTruthy();
  });

  it("필드가 없는 명령은 요약문을 안내문으로 보여준다", () => {
    const schema = commandSchemaFor("checkpointSave");
    if (!schema) throw new Error("checkpointSave 스키마 없음");
    const body = renderSchemaForm(ctx(), { kind: "checkpointSave" } as Command, schema);
    expect(findByTestId(body as never, "schema-no-fields-checkpointSave")).toBeTruthy();
  });

  it("스키마 폼의 enum 변경이 replaceCommand 로 패치된다", () => {
    const replaceCommand = vi.fn();
    const schema = commandSchemaFor("cutsceneControl");
    if (!schema) throw new Error("cutsceneControl 스키마 없음");

    const cmd = { kind: "cutsceneControl", mode: "begin" } as Command;
    const body = renderSchemaForm(ctx(replaceCommand), cmd, schema);
    const select = findByTestId(body as never, "event-command-cutscene-mode") as
      | { value: string; dispatchEvent: (event: unknown) => void }
      | undefined;
    expect(select).toBeTruthy();
    if (!select) return;

    select.value = "end";
    select.dispatchEvent(new Event("change"));

    expect(replaceCommand).toHaveBeenCalledTimes(1);
    const [path, next] = replaceCommand.mock.calls[0] as [number[], Record<string, unknown>];
    expect(path).toEqual([0]);
    expect(next.kind).toBe("cutsceneControl");
    expect(next.mode).toBe("end");
  });

  it("bool 필드 토글이 값을 뒤집는다", () => {
    const replaceCommand = vi.fn();
    const schema = commandSchemaFor("cutsceneControl");
    if (!schema) throw new Error("cutsceneControl 스키마 없음");

    const cmd = { kind: "cutsceneControl", mode: "begin", skippable: false } as Command;
    const body = renderSchemaForm(ctx(replaceCommand), cmd, schema);
    // bool 은 체크박스로 렌더된다 (기존 폼 계약이 HTMLInputElement 를 요구).
    const toggle = findByTestId(body as never, "event-command-cutscene-skippable") as
      | { checked: boolean; dispatchEvent: (event: unknown) => void }
      | undefined;
    expect(toggle).toBeTruthy();
    if (!toggle) return;

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    const [, next] = replaceCommand.mock.calls[0] as [number[], Record<string, unknown>];
    expect(next.skippable).toBe(true);
  });
});
