// eventEditor/commandBodyM2Coordinate.ts — 「좌표로 이동」(M2 Pathfind Move) 전용 리치 폼.
//
// 왜 새 폼인가 (OPRN-OUT-013): 이 명령의 X·Y 는 제네릭 number 입력 두 칸이었고, 대상은
// 자유 입력 텍스트 상자 하나였다. 그래서 (1) 이미 존재하는 스튜디오 변수를 좌표로 쓸 방법이
// 아예 없었고, (2) 대상 NPC 를 고르려면 내부 id 를 손으로 붙여넣어야 했고, (3) 좌표가
// 런타임에 무효일 때 어떻게 할지 저작자가 말할 자리가 없었다.
//
// 무엇을 **재사용**하는가 — 이 목록을 어기면 두 번째 엔진이 생긴다:
//   · 대상 픽커: `createMoveRouteTargetPicker` + `project/eventTargetCatalog` (OPRN-OUT-012 계약)
//   · 변수 픽커: `databasePicker("variable", …)` = 표준 레코드 픽커 패널
//   · 좌표 소스/실패/대체 정책의 저장 형태와 판정: `project/eventCommands/coordinateDestination`
//   · 경로 계획·보행: 런타임 `playScenePathfinding` (여기서는 아무것도 계산하지 않는다)
import { store } from "@/project/store";
import {
  coordinateAxisSpec,
  coordinateFailurePolicy,
  coordinateFallbackPolicy,
  COORDINATE_FAILURE_LABELS,
  movementResultCode,
  movementResultSwitchId,
  movementResultVariableId,
  resolveCoordinateAxis,
  type CoordinateAxis,
} from "@/project/eventCommands/coordinateDestination";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { databasePicker } from "./conditionForm";
import { createMoveRouteTargetPicker, currentMapEventTargetCatalog } from "./moveRouteTargetPicker";
import { segmentedSelect, type SegmentOption } from "./recordPicker";
import { replaceFields } from "./commandBodyM2Page3";
import type { CommandEditContext } from "./types";

type M2Command = Extract<Command, { kind: "m2Command" }>;

/** 저장되는 `target` 문자열의 세 갈래. 정본 형태는 moveRouteTarget/eventTargetCatalog 와 같다. */
type TargetKind = "player" | "this-event" | "event";

const TARGET_SEGMENTS = [
  { value: "player", key: "player", label: "주인공" },
  { value: "this-event", key: "this-event", label: "이 이벤트" },
  { value: "event", key: "event", label: "특정 이벤트" },
] as const satisfies readonly SegmentOption<TargetKind>[];

const SOURCE_SEGMENTS = [
  { value: "fixed", key: "fixed", label: "숫자" },
  { value: "variable", key: "variable", label: "변수" },
] as const satisfies readonly SegmentOption<"fixed" | "variable">[];

const FAILURE_SEGMENTS = [
  { value: "continue", key: "continue", label: "계속 진행" },
  { value: "stop", key: "stop", label: "이벤트 중단" },
] as const satisfies readonly SegmentOption<"continue" | "stop">[];

const FALLBACK_SEGMENTS = [
  { value: "none", key: "none", label: "없음" },
  { value: "nearest", key: "nearest", label: "가까운 칸" },
] as const satisfies readonly SegmentOption<"none" | "nearest">[];

/** 해당 명령이 아니면 undefined → 기존 제네릭 M2 폼이 그대로 처리한다. */
export function renderCoordinateMoveCommandBody(
  context: CommandEditContext,
  cmd: M2Command
): HTMLElement | undefined {
  const entry = m2CommandById(cmd.commandId);
  if (entry?.title !== "Pathfind Move") return undefined;
  return coordinateMoveBody(context, cmd);
}

function coordinateMoveBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = el("div", {
    class: "rich-command-form page3-command-body actor-m2-command-body coordinate-move-command-body",
    dataset: { testid: "coordinate-move-command-body" },
  });

  const storedTarget = String(cmd.fields.target ?? "this-event");
  let targetKind = targetKindOf(storedTarget);
  // 특정 이벤트일 때만 의미가 있는 원시 id. 다른 종류로 바꿔도 값을 지우지 않는다 —
  // 되돌렸을 때 사용자가 고른 이벤트가 살아 있어야 한다.
  let targetEventId = targetKind === "event" ? storedTarget : "";

  const axisState: Record<CoordinateAxis, { source: "fixed" | "variable"; fixedValue: number; variableId: string }> = {
    x: mutableAxis(cmd, "x"),
    y: mutableAxis(cmd, "y"),
  };

  let onFailure = coordinateFailurePolicy(cmd.fields);
  let fallback = coordinateFallbackPolicy(cmd.fields);
  let resultVariableId = movementResultVariableId(cmd.fields);
  let resultSwitchId = movementResultSwitchId(cmd.fields);

  const preview = el("div", { class: "actor-m2-preview", dataset: { testid: "coordinate-move-preview" } });

  const target = segmentedSelect({
    options: TARGET_SEGMENTS,
    value: targetKind,
    testid: "coordinate-move-target",
    ariaLabel: "누구를 움직이나",
  });
  const targetInput = el("input", {
    attrs: {
      type: "text",
      placeholder: "이름 또는 ID 검색",
      autocomplete: "off",
      role: "combobox",
      "aria-expanded": "false",
    },
    value: targetEventId,
    dataset: { testid: "coordinate-move-event-id-input" },
  }) as HTMLInputElement;
  const targetStatus = el("span", {
    class: "move-route-target-name",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "coordinate-move-event-name" },
  });
  // 이동 경로 설정과 **같은** 픽커·같은 카탈로그다. 목록을 여기서 새로 만들지 않는다.
  const targetPicker = createMoveRouteTargetPicker({
    input: targetInput,
    status: targetStatus,
    isEventTarget: () => target.select.value === "event",
    onSelect: (eventId) => {
      targetEventId = eventId;
      if (target.select.value !== "event") {
        target.select.value = "event";
        target.select.dispatchEvent(new Event("change"));
        return;
      }
      commit();
    },
  });

  const speedInput = el("input", {
    attrs: { type: "number", min: "1", max: "8", step: "1" },
    value: String(clampSpeed(Number(cmd.fields.speed ?? 4))),
    dataset: { testid: "coordinate-move-speed-input" },
  }) as HTMLInputElement;
  const waitCheckbox = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "coordinate-move-wait-checkbox" },
  }) as HTMLInputElement;
  waitCheckbox.checked = cmd.fields.wait === undefined ? true : cmd.fields.wait !== false;

  const failure = segmentedSelect({
    options: FAILURE_SEGMENTS,
    value: onFailure,
    testid: "coordinate-move-failure",
    ariaLabel: "실패하면",
  });
  const fallbackControl = segmentedSelect({
    options: FALLBACK_SEGMENTS,
    value: fallback,
    testid: "coordinate-move-fallback",
    ariaLabel: "대체 목적지",
  });
  const resultVariable = databasePicker(
    "variable",
    resultVariableId,
    (id) => {
      resultVariableId = id;
      commit();
    },
    "coordinate-move-result-variable"
  );
  const resultSwitch = databasePicker(
    "switch",
    resultSwitchId,
    (id) => {
      resultSwitchId = id;
      commit();
    },
    "coordinate-move-result-switch"
  );

  const axisControls = (axis: CoordinateAxis) => {
    const state = axisState[axis];
    const source = segmentedSelect({
      options: SOURCE_SEGMENTS,
      value: state.source,
      testid: `coordinate-move-${axis}-source`,
      ariaLabel: `${axis.toUpperCase()} 좌표의 값 출처`,
    });
    const numberInput = el("input", {
      attrs: { type: "number", min: "0", step: "1" },
      value: String(state.fixedValue),
      dataset: { testid: `coordinate-move-${axis}-input` },
    }) as HTMLInputElement;
    const variable = databasePicker(
      "variable",
      state.variableId,
      (id) => {
        state.variableId = id;
        commit();
      },
      `coordinate-move-${axis}-variable`
    );
    const numberField = fieldBlock(`${axis.toUpperCase()} 칸 번호`, numberInput, `coordinate-move-${axis}-number-field`);
    const variableField = fieldBlock(`${axis.toUpperCase()} 좌표 변수`, variable, `coordinate-move-${axis}-variable-field`);
    const syncVisibility = () => {
      const useVariable = source.select.value === "variable";
      numberField.hidden = useVariable;
      variableField.hidden = !useVariable;
    };
    source.select.addEventListener("change", () => {
      state.source = source.select.value === "variable" ? "variable" : "fixed";
      syncVisibility();
      commit();
    });
    for (const event of ["change", "input"] as const) {
      numberInput.addEventListener(event, () => {
        state.fixedValue = Math.trunc(Number(numberInput.value) || 0);
        commit();
      });
    }
    syncVisibility();
    return {
      sourceField: fieldBlock(`${axis.toUpperCase()} 값은`, source.root, `coordinate-move-${axis}-source-field`),
      numberField,
      variableField,
    };
  };

  const xControls = axisControls("x");
  const yControls = axisControls("y");

  function resolvedTarget(): string {
    if (target.select.value === "player") return PLAYER_MOVE_TARGET;
    if (target.select.value === "this-event") return "this-event";
    return targetInput.value.trim();
  }

  function commit(): void {
    targetKind = targetKindOf(target.select.value === "event" ? targetInput.value.trim() || "event" : target.select.value);
    onFailure = failure.select.value === "stop" ? "stop" : "continue";
    fallback = fallbackControl.select.value === "nearest" ? "nearest" : "none";
    replaceFields(context, cmd, {
      target: resolvedTarget(),
      xSource: axisState.x.source,
      x: axisState.x.fixedValue,
      xVariableId: axisState.x.variableId,
      ySource: axisState.y.source,
      y: axisState.y.fixedValue,
      yVariableId: axisState.y.variableId,
      speed: clampSpeed(Number(speedInput.value) || 4),
      wait: waitCheckbox.checked,
      onFailure,
      fallback,
      resultVariableId,
      resultSwitchId,
    });
    renderPreview();
  }

  function axisPhrase(axis: CoordinateAxis): string {
    const state = axisState[axis];
    if (state.source === "fixed") return `${axis.toUpperCase()} ${state.fixedValue}`;
    if (!state.variableId) return `${axis.toUpperCase()} 변수 (미선택)`;
    return `${axis.toUpperCase()} 변수 «${variableLabel(state.variableId)}»`;
  }

  function renderPreview(): void {
    const who = target.select.value === "player" ? "주인공"
      : target.select.value === "this-event" ? "이 이벤트"
        : targetEventLabel(targetInput.value.trim());
    const children: HTMLElement[] = [
      line(`${who} → ${axisPhrase("x")} , ${axisPhrase("y")}`),
      line(`속도 ${clampSpeed(Number(speedInput.value) || 4)} · ${waitCheckbox.checked ? "도착까지 대기" : "대기 없음"}`),
      line(onFailure === "stop" ? "실패하면 이벤트를 중단합니다." : "실패해도 다음 명령으로 진행합니다."),
    ];
    if (fallback === "nearest") {
      children.push(note("맵 밖 좌표는 가장 가까운 통행 가능한 칸으로 대체합니다."));
    } else {
      children.push(note("맵 밖·막힘·경로 없음은 대체하지 않고 실패로 보고합니다. (0,0) 으로 떨어지지 않습니다."));
    }
    for (const axis of ["x", "y"] as const) {
      const state = axisState[axis];
      if (state.source === "variable" && !state.variableId) {
        children.push(warning(`${axis.toUpperCase()} 좌표를 「변수」로 골랐지만 변수를 정하지 않았습니다.`));
        continue;
      }
      if (state.source !== "fixed") continue;
      const resolved = resolveCoordinateAxis(coordinateAxisSpec({ [`${axis}Source`]: "fixed", [axis]: state.fixedValue }, axis), () => undefined);
      if (!resolved.ok) {
        children.push(warning(`${axis.toUpperCase()} 좌표 — ${COORDINATE_FAILURE_LABELS[resolved.reason]}.`));
      }
    }
    if (resultVariableId) {
      children.push(note(
        `결과 변수 «${variableLabel(resultVariableId)}» — 도착 ${movementResultCode("arrived")} / ` +
        `좌표 값 오류 ${movementResultCode("invalidInput")} / 대상 없음 ${movementResultCode("missingTarget")} / ` +
        `맵 밖 ${movementResultCode("outOfBounds")} / 막힘 ${movementResultCode("blocked")} / ` +
        `경로 없음 ${movementResultCode("unreachable")} / 중단 ${movementResultCode("interrupted")}`
      ));
    } else {
      children.push(note("결과 변수를 정하면 실패 종류까지 조건 분기로 구분할 수 있습니다. 병렬 이벤트끼리 결과가 섞이지 않습니다."));
    }
    preview.replaceChildren(...children);
  }

  target.select.addEventListener("change", () => {
    if (target.select.value === "event" && !targetInput.value.trim() && targetEventId) {
      targetInput.value = targetEventId;
    }
    syncTargetVisibility();
    targetPicker.sync();
    commit();
  });
  targetInput.addEventListener("change", () => {
    targetEventId = targetInput.value.trim();
    commit();
  });
  for (const event of ["change", "input"] as const) {
    speedInput.addEventListener(event, commit);
  }
  waitCheckbox.addEventListener("change", commit);
  failure.select.addEventListener("change", commit);
  fallbackControl.select.addEventListener("change", commit);

  const targetEventField = fieldBlock(
    "어느 이벤트",
    el("span", {
      class: "move-route-target-row",
      children: [targetInput, targetPicker.openButton, targetStatus, targetPicker.dropdown],
    }),
    "coordinate-move-event-field"
  );
  function syncTargetVisibility(): void {
    targetEventField.hidden = target.select.value !== "event";
  }
  syncTargetVisibility();

  renderPreview();
  wrap.append(
    intentCard(
      "좌표로 이동",
      "주인공·이 이벤트·고른 이벤트를 특정 칸으로 걸어가게 합니다. X·Y 는 숫자 또는 스튜디오 변수에서 읽습니다.",
      "coordinate-move-intent"
    ),
    layout(
      [
        fieldBlock("누구를", target.root, "coordinate-move-target-field"),
        targetEventField,
        xControls.sourceField,
        xControls.numberField,
        xControls.variableField,
        yControls.sourceField,
        yControls.numberField,
        yControls.variableField,
        fieldBlock("속도(1–8)", speedInput, "coordinate-move-speed-field"),
        fieldBlock("도착까지 대기", waitCheckbox, "coordinate-move-wait-field"),
        fieldBlock("실패하면", failure.root, "coordinate-move-failure-field"),
        fieldBlock("대체 목적지", fallbackControl.root, "coordinate-move-fallback-field"),
        fieldBlock("결과 변수", resultVariable, "coordinate-move-result-variable-field"),
        fieldBlock("도착 스위치", resultSwitch, "coordinate-move-result-switch-field"),
      ],
      preview
    )
  );
  return wrap;
}

function mutableAxis(cmd: M2Command, axis: CoordinateAxis): {
  source: "fixed" | "variable";
  fixedValue: number;
  variableId: string;
} {
  const spec = coordinateAxisSpec(cmd.fields, axis);
  return { source: spec.source, fixedValue: spec.fixedValue, variableId: spec.variableId };
}

function targetKindOf(stored: string): TargetKind {
  if (stored === PLAYER_MOVE_TARGET || stored === "player") return "player";
  if (!stored || stored === "this-event" || stored === "this") return "this-event";
  return "event";
}

function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.max(1, Math.min(8, Math.trunc(value)));
}

function targetEventLabel(eventId: string): string {
  if (!eventId) return "이벤트 (미선택)";
  const entry = currentMapEventTargetCatalog().entries.find((candidate) => candidate.id === eventId);
  return entry ? `«${entry.label}»` : `«${eventId}» (없음)`;
}

function variableLabel(variableId: string): string {
  if (!variableId) return "(미선택)";
  const project = store.getCurrent();
  const record = project.variables.find((entry) => entry.id === variableId);
  return record?.name?.trim() || variableId;
}

function intentCard(title: string, body: string, testId: string): HTMLElement {
  return el("div", {
    class: "party-member-intent",
    dataset: { testid: testId },
    children: [
      el("div", { class: "party-member-intent-title", text: title }),
      el("p", { class: "party-member-intent-body", text: body }),
    ],
  });
}

function fieldBlock(label: string, control: HTMLElement, testId?: string): HTMLElement {
  return el("div", {
    class: "actor-m2-field change-parameters-field",
    dataset: testId ? { testid: testId } : undefined,
    children: [
      el("div", { class: "actor-m2-field-label change-parameters-field-label", text: label }),
      control,
    ],
  });
}

function layout(mainChildren: readonly HTMLElement[], preview: HTMLElement): HTMLElement {
  return el("div", {
    class: "actor-m2-layout",
    children: [el("div", { class: "actor-m2-main", children: [...mainChildren] }), preview],
  });
}

function line(text: string): HTMLElement {
  return el("p", { class: "actor-m2-preview-line", text });
}

function note(text: string): HTMLElement {
  return el("p", { class: "actor-m2-preview-note", text });
}

/** 실패 진단은 note 와 시각적으로 구별돼야 한다 — 색만이 아니라 낱말로도 경고라고 말한다. */
function warning(text: string): HTMLElement {
  return el("p", {
    class: "actor-m2-preview-note coordinate-move-preview-warning",
    text: `주의: ${text}`,
    dataset: { testid: "coordinate-move-preview-warning" },
  });
}
