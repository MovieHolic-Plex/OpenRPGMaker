import type { AuthoringReferenceFixture } from "./referenceFixture";
import {
  clickControl,
  setControlChecked,
  setControlValue,
  setNestedSelectValue,
  type AuthoringCase,
} from "./mutationTypes";

export function dialogueControlCases(
  fixture: AuthoringReferenceFixture
): readonly AuthoringCase[] {
  return [
    {
      mode: "mutation",
      kind: "text",
      expected: { kind: "text", speaker: undefined, body: "행렬 대사" },
      apply: (body) => setControlValue(body, "event-command-text-body", "행렬 대사", "input"),
    },
    {
      mode: "mutation",
      kind: "changeFace",
      expected: {
        kind: "changeFace",
        resourceId: "generated-face-actor1-full",
        faceIndex: 0,
        position: "left",
        flipHorizontally: false,
      },
      apply: (body) => clickControl(body, "event-command-face-full-preset"),
    },
    {
      mode: "mutation",
      kind: "choices",
      expected: {
        kind: "choices",
        prompt: "계속할까요?",
        options: [
          { text: "예", branch: [] },
          { text: "아니오", branch: [] },
        ],
        cancelBehavior: "choice2",
      },
      apply: (body) => setControlValue(body, "event-choice-prompt", "계속할까요?"),
    },
    {
      mode: "mutation",
      kind: "fork",
      expected: {
        kind: "fork",
        condition: { kind: "switch", switchId: fixture.ids.switchId, value: true },
        then: [{ kind: "text", body: "" }],
        else: [],
      },
      apply: (body) => setControlChecked(body, "event-fork-else-enabled", true),
    },
    {
      mode: "mutation",
      kind: "wait",
      expected: { kind: "wait", ms: 1000 },
      apply: (body) => clickControl(body, "event-wait-preset-1000"),
    },
    {
      mode: "mutation",
      kind: "inputWait",
      expected: { kind: "inputWait", variableId: "" },
      apply: (body) => setNestedSelectValue(body, "event-command-input-wait-variable", ""),
    },
    {
      mode: "mutation",
      kind: "inputNumber",
      expected: { kind: "inputNumber", variableId: fixture.ids.variableId, digits: 4 },
      apply: (body) => clickControl(body, "input-number-digit-chip-4"),
    },
    {
      mode: "mutation",
      kind: "label",
      expected: { kind: "label", name: "branch_target" },
      apply: (body) => setControlValue(body, "event-command-label-name", "branch_target"),
    },
    {
      mode: "mutation",
      kind: "gotoLabel",
      expected: { kind: "gotoLabel", name: "branch_target" },
      apply: (body) => setControlValue(body, "event-command-goto-label-name", "branch_target"),
    },
    {
      mode: "mutation",
      kind: "loop",
      expected: { kind: "loop", body: [{ kind: "text", body: "반복 본문" }] },
      apply: (body) => setControlValue(body, "event-loop-body-text-0", "반복 본문"),
    },
    {
      mode: "boundary",
      kind: "breakLoop",
      testId: "break-loop-editor",
      tagName: "DIV",
    },
    {
      mode: "mutation",
      kind: "enterHeroName",
      expected: {
        kind: "enterHeroName",
        actorId: fixture.ids.actorId,
        maxLength: 9,
        showInitialName: true,
      },
      apply: (body) => setControlValue(body, "enter-hero-name-max-length", "9"),
      clearAfterRender: true,
    },
    {
      mode: "mutation",
      kind: "displayTextSettings",
      expected: {
        kind: "displayTextSettings",
        format: "transparent",
        position: "bottom",
        preventObscuringPlayer: true,
        allowEventMovementDuringWait: false,
      },
      apply: (body) => clickControl(body, "event-command-message-format-segment-transparent"),
    },
  ];
}
