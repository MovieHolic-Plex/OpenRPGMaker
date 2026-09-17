/** @vitest-environment happy-dom */
// test/coordinateMoveCommandBody.test.ts — OPRN-OUT-013 저작 표면.
//
// 「좌표로 이동」 폼이 (1) 대상 세 종류를 정본 문자열로 커밋하고, (2) X·Y 를 각각 숫자/변수로
// 전환하며 표준 변수 픽커를 쓰고, (3) 실패 정책·대체 목적지·결과 기록처를 저작하게 하고,
// (4) 옛 고정 좌표 명령을 열어도 값과 저장 형태가 변하지 않는지를 실제 DOM 으로 잰다.
import { beforeEach, describe, expect, it } from "vitest";
import { renderCoordinateMoveCommandBody } from "@/editor/panels/eventEditor/commandBodyM2Coordinate";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { movementResultCode } from "@/project/eventCommands/coordinateDestination";
import { store } from "@/project/store";
import type { Command, M2CommandFields, Project } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";

const PATHFIND_ID = "m2-205-pathfind-move";
type M2Command = Extract<Command, { kind: "m2Command" }>;

function projectWithRecords(): Project {
  const project = createBlankProject();
  project.variables = [
    ...project.variables,
    { id: "var_x", name: "목표 X" },
    { id: "var_y", name: "목표 Y" },
    { id: "var_result", name: "이동 결과" },
  ];
  project.switches = [...project.switches, { id: "sw_arrived", name: "도착" }];
  const map = project.maps[project.startMapId]!;
  map.events = [
    { id: "ev_guard", x: 3, y: 4, trigger: { kind: "action" }, commands: [] },
  ];
  return project;
}

function harness(fields: M2CommandFields) {
  const initial: M2Command = { kind: "m2Command", commandId: PATHFIND_ID, fields };
  let current: M2Command = initial;
  const replaced: M2Command[] = [];
  const context = {
    path: [0],
    lockKind: true,
    getCurrentCommand: () => current,
    actions: {
      replaceCommand: (_path: readonly number[], command: Command) => {
        current = command as M2Command;
        replaced.push(current);
      },
      addCommand: () => {},
      removeCommand: () => {},
      moveCommand: () => {},
    },
  } as unknown as CommandEditContext;
  const root = renderCoordinateMoveCommandBody(context, initial);
  expect(root, "좌표 이동 전용 폼이 렌더되지 않았다").toBeTruthy();
  document.body.replaceChildren(root!);
  return { root: root!, replaced, latest: () => replaced.at(-1) };
}

const q = <T extends Element = HTMLElement>(root: ParentNode, testid: string): T | null =>
  root.querySelector<T>(`[data-testid="${testid}"]`);

function setSelect(root: ParentNode, testid: string, value: string): void {
  const select = q<HTMLSelectElement>(root, testid);
  expect(select, testid).not.toBeNull();
  select!.value = value;
  select!.dispatchEvent(new Event("change"));
}

function setInput(root: ParentNode, testid: string, value: string): void {
  const input = q<HTMLInputElement>(root, testid);
  expect(input, testid).not.toBeNull();
  input!.value = value;
  input!.dispatchEvent(new Event("change"));
}

describe("좌표로 이동 — 저작 폼", () => {
  beforeEach(() => {
    store.replace(projectWithRecords());
  });

  it("카탈로그가 좌표 소스·실패 정책·대체·결과 필드를 선언한다", () => {
    const entry = m2CommandById(PATHFIND_ID)!;
    const keys = entry.fields.map((field) => field.key);
    expect(keys).toEqual(expect.arrayContaining([
      "target", "xSource", "x", "xVariableId", "ySource", "y", "yVariableId",
      "speed", "wait", "onFailure", "fallback", "resultVariableId", "resultSwitchId",
    ]));
    // 기본값은 옛 고정 좌표 동작과 같아야 한다.
    const byKey = new Map(entry.fields.map((field) => [field.key, field.defaultValue]));
    expect(byKey.get("xSource")).toBe("fixed");
    expect(byKey.get("ySource")).toBe("fixed");
    expect(byKey.get("onFailure")).toBe("continue");
    expect(byKey.get("fallback")).toBe("none");
  });

  it("옛 고정 좌표 명령을 열면 숫자 칸이 보이고 변수 칸은 숨는다", () => {
    const { root } = harness({ target: "this-event", x: 6, y: 4, speed: 4, wait: true });
    expect(q<HTMLSelectElement>(root, "coordinate-move-x-source")?.value).toBe("fixed");
    expect(q<HTMLInputElement>(root, "coordinate-move-x-input")?.value).toBe("6");
    expect(q<HTMLInputElement>(root, "coordinate-move-y-input")?.value).toBe("4");
    expect((q(root, "coordinate-move-x-variable-field") as HTMLElement).hidden).toBe(true);
    expect((q(root, "coordinate-move-x-number-field") as HTMLElement).hidden).toBe(false);
    // 대상이 「특정 이벤트」가 아니면 이벤트 검색 줄도 숨는다.
    expect((q(root, "coordinate-move-event-field") as HTMLElement).hidden).toBe(true);
  });

  it("폼을 열기만 해도 저장값이 바뀌지 않는다 — 옛 프로젝트를 여는 것이 편집이 되면 안 된다", () => {
    const { replaced } = harness({ target: "this-event", x: 6, y: 4, speed: 4, wait: true });
    expect(replaced).toEqual([]);
  });

  it.each([
    ["player", PLAYER_MOVE_TARGET],
    ["this-event", "this-event"],
  ])("대상 %s 를 정본 문자열로 커밋한다", (segment, stored) => {
    const { root, latest } = harness({ target: "this-event", x: 1, y: 1 });
    setSelect(root, "coordinate-move-target", segment);
    expect(latest()?.fields.target).toBe(stored);
  });

  it("「특정 이벤트」를 고르면 이 맵의 이벤트 목록에서 골라 id 가 커밋된다 (원시 id 입력 불필요)", () => {
    const { root, latest } = harness({ target: "this-event", x: 1, y: 1 });
    setSelect(root, "coordinate-move-target", "event");
    expect((q(root, "coordinate-move-event-field") as HTMLElement).hidden).toBe(false);
    // 이동 경로 설정과 같은 픽커다 — 목록 버튼과 옵션 testid 가 그 계약을 그대로 쓴다.
    q<HTMLButtonElement>(root, "move-route-event-picker-open")!.click();
    const option = q<HTMLButtonElement>(root, "move-route-event-option-ev_guard");
    expect(option, "이 맵의 이벤트가 목록에 없다").not.toBeNull();
    option!.click();
    expect(latest()?.fields.target).toBe("ev_guard");
  });

  it("X 를 변수로 바꾸면 표준 변수 픽커가 나타나고 숫자 칸이 숨는다", () => {
    const { root, latest } = harness({ target: "player", x: 6, y: 4 });
    setSelect(root, "coordinate-move-x-source", "variable");
    expect((q(root, "coordinate-move-x-variable-field") as HTMLElement).hidden).toBe(false);
    expect((q(root, "coordinate-move-x-number-field") as HTMLElement).hidden).toBe(true);
    expect(latest()?.fields.xSource).toBe("variable");
    // 표준 레코드 픽커의 숨은 select 를 통해 고른다 (e2e selectOption 과 같은 경로).
    const select = q(root, "coordinate-move-x-variable")!.querySelector("select")!;
    select.value = "var_x";
    select.dispatchEvent(new Event("change"));
    expect(latest()?.fields.xVariableId).toBe("var_x");
    // 고정 X 값은 지워지지 않는다 — 숫자로 되돌리면 원래 값이 살아 있어야 한다.
    expect(latest()?.fields.x).toBe(6);
  });

  it("X 는 변수, Y 는 숫자처럼 축마다 다르게 저작할 수 있다", () => {
    const { root, latest } = harness({ target: "player", x: 0, y: 0 });
    setSelect(root, "coordinate-move-x-source", "variable");
    const xSelect = q(root, "coordinate-move-x-variable")!.querySelector("select")!;
    xSelect.value = "var_x";
    xSelect.dispatchEvent(new Event("change"));
    setInput(root, "coordinate-move-y-input", "9");
    expect(latest()?.fields).toMatchObject({
      xSource: "variable", xVariableId: "var_x", ySource: "fixed", y: 9,
    });
  });

  it("실패 정책·대체 목적지·결과 기록처를 저작한다", () => {
    const { root, latest } = harness({ target: "player", x: 2, y: 2 });
    setSelect(root, "coordinate-move-failure", "stop");
    setSelect(root, "coordinate-move-fallback", "nearest");
    const variable = q(root, "coordinate-move-result-variable")!.querySelector("select")!;
    variable.value = "var_result";
    variable.dispatchEvent(new Event("change"));
    const sw = q(root, "coordinate-move-result-switch")!.querySelector("select")!;
    sw.value = "sw_arrived";
    sw.dispatchEvent(new Event("change"));
    expect(latest()?.fields).toMatchObject({
      onFailure: "stop", fallback: "nearest",
      resultVariableId: "var_result", resultSwitchId: "sw_arrived",
    });
  });

  it("속도는 1–8 로 묶이고 대기는 체크박스가 소유한다", () => {
    const { root, latest } = harness({ target: "player", x: 2, y: 2, speed: 4, wait: true });
    setInput(root, "coordinate-move-speed-input", "99");
    expect(latest()?.fields.speed).toBe(8);
    setInput(root, "coordinate-move-speed-input", "-3");
    expect(latest()?.fields.speed).toBe(1);
    expect(q(root, "coordinate-move-speed-input")?.getAttribute("max")).toBe("8");
    expect(root.textContent).toContain("속도(1–8)");
    const wait = q<HTMLInputElement>(root, "coordinate-move-wait-checkbox")!;
    wait.checked = false;
    wait.dispatchEvent(new Event("change"));
    expect(latest()?.fields.wait).toBe(false);
  });

  it("미리보기가 목적지·정책·결과 코드 표를 말한다 (색만으로 상태를 구분하지 않는다)", () => {
    const { root } = harness({
      target: "player", xSource: "variable", xVariableId: "var_x", y: 4,
      resultVariableId: "var_result", onFailure: "stop",
    });
    const preview = q(root, "coordinate-move-preview")!;
    expect(preview.textContent).toContain("주인공");
    expect(preview.textContent).toContain("목표 X");
    expect(preview.textContent).toContain("이벤트를 중단");
    expect(preview.textContent).toContain(`도착 ${movementResultCode("arrived")}`);
    expect(preview.textContent).toContain(`막힘 ${movementResultCode("blocked")}`);
  });

  it("변수를 골랐지만 정하지 않으면 미리보기가 경고한다", () => {
    const { root } = harness({ target: "player", xSource: "variable", xVariableId: "", y: 4 });
    expect(q(root, "coordinate-move-preview-warning")?.textContent).toContain("X");
  });

  it("대체를 끄면 미리보기가 (0,0) 으로 떨어지지 않는다고 명시한다", () => {
    const { root } = harness({ target: "player", x: 2, y: 2, fallback: "none" });
    expect(q(root, "coordinate-move-preview")?.textContent).toContain("(0,0)");
  });
});

describe("좌표로 이동 — 저작 시점 진단", () => {
  /** 이 명령 하나만 단 페이지 이벤트를 검사하고 이슈 코드만 돌린다. */
  function issuesFor(fields: M2CommandFields): readonly string[] {
    const project = projectWithRecords();
    store.replace(project);
    const mapId = project.startMapId;
    const event = {
      id: "probe", x: 1, y: 1, trigger: { kind: "action" as const }, commands: [],
      pages: [{
        id: "page-1", name: "검사", conditions: [], graphic: {},
        trigger: { kind: "action" as const }, priority: "below" as const,
        movement: { type: "fixed" as const, speed: 3, frequency: 3 },
        commands: [{ kind: "m2Command" as const, commandId: PATHFIND_ID, fields }],
      }],
    };
    project.maps[mapId]!.events = [...project.maps[mapId]!.events, event];
    return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
  }

  it("고정 좌표가 맵 범위를 벗어나면 지금 잡는다", () => {
    expect(issuesFor({ target: "player", xSource: "fixed", x: 9999, ySource: "fixed", y: 0 }))
      .toContain("map.position.out-of-bounds");
  });

  it.each([
    ["소수", 2.5],
    ["음수", -1],
  ])("고정 좌표가 %s 면 런타임과 같은 이유로 반려한다", (_label, value) => {
    expect(issuesFor({ target: "player", xSource: "fixed", x: value, ySource: "fixed", y: 0 }))
      .toContain("m2.coordinate.fixed.invalid");
  });

  it("변수를 골랐는데 정하지 않으면 저작 시점에 잡는다", () => {
    expect(issuesFor({ target: "player", xSource: "variable", xVariableId: "", ySource: "fixed", y: 0 }))
      .toContain("m2.coordinate.variable.unselected");
  });

  it("없는 변수를 가리키면 참조 오류다", () => {
    expect(issuesFor({ target: "player", xSource: "variable", xVariableId: "var_missing", ySource: "fixed", y: 0 }))
      .toContain("reference.variable.missing");
  });

  it("한 축이라도 변수면 지도 범위를 단정하지 않는다 — 런타임 전에는 알 수 없다", () => {
    const codes = issuesFor({ target: "player", xSource: "variable", xVariableId: "var_x", ySource: "fixed", y: 0 });
    expect(codes).not.toContain("map.position.out-of-bounds");
    expect(codes).not.toContain("m2.coordinate.variable.unselected");
  });

  it("옛 고정 좌표 명령(새 키 없음)은 아무 진단도 새로 만들지 않는다", () => {
    expect(issuesFor({ target: "this-event", x: 3, y: 3, speed: 4, wait: true })).toEqual([]);
  });

  it("결과 기록처를 비워 두는 것은 정상이다 (기본이 안전)", () => {
    expect(issuesFor({ target: "player", x: 2, y: 2, resultVariableId: "", resultSwitchId: "" })).toEqual([]);
  });

  it("결과 기록처가 없는 레코드를 가리키면 잡는다", () => {
    expect(issuesFor({ target: "player", x: 2, y: 2, resultVariableId: "var_gone" }))
      .toContain("reference.variable.missing");
    expect(issuesFor({ target: "player", x: 2, y: 2, resultSwitchId: "sw_gone" }))
      .toContain("reference.switch.missing");
  });
});
