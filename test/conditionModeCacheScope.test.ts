// @vitest-environment happy-dom
// test/conditionModeCacheScope.test.ts
//
// conditionModeCache 가 모듈 전역 kind 키였다 — fork A에서 switch sw_0001 저작 후
// fork B에서 같은 종류로 전환하면 A의 switchId 가 B에 복원됐다.
// 캐시 키에 편집 호스트(맵·이벤트·페이지·경로)를 포함한 회귀 계약이다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { installFakeDom } from "./fakeDom";
import type { Condition } from "@/project/types";

describe("condition mode cache scope", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
  });

  function switchTo(form: HTMLElement, kind: Condition["kind"]): void {
    const mode = form.querySelector('[data-testid="event-condition-mode"]') as HTMLSelectElement | null;
    if (!mode) throw new Error("missing mode select");
    mode.value = kind;
    mode.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("does not leak one fork's switch into another fork's form", () => {
    const seen: Condition[] = [];
    const onChange = (next: Condition): void => {
      seen.push(next);
    };

    // fork A: switch sw_AAA 저작 후 variable 로 전환(캐시에 sw_AAA 저장).
    editorState.set({ selectedEventId: "ev_A" });
    const formA = conditionForm({ kind: "switch", switchId: "sw_AAA", value: true }, onChange, [0]);
    document.body.append(formA);
    switchTo(formA, "variable");

    // fork B: 다른 이벤트·경로. switch 로 전환해도 A의 값이 복원되면 안 된다.
    seen.length = 0;
    editorState.set({ selectedEventId: "ev_B" });
    const formB = conditionForm({ kind: "variable", variableId: "var_x", op: ">=", value: 0 }, onChange, [3]);
    document.body.append(formB);
    switchTo(formB, "switch");

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ kind: "switch", switchId: "", value: true });
  });
});
