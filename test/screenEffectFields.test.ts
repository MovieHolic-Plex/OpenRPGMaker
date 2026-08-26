/**
 * 계약: **`화면 효과` 편집 폼과 목록 요약이 런타임과 같은 언어로 말한다.**
 *
 * 회귀 배경(적대적 QA `.omo/evidence/screen-fx-2/qa-before.md`):
 *  - D3: 색 값이 `input[type=text]` 단독이라 스와치/피커가 0개였고, `#xyz` 도 조용히 통과했다.
 *        런타임 `parseTintColor` 는 그 값을 흰색 45% 워시로 떨어뜨린다 — 에디터는 아무 말도 없었다.
 *  - D7: `시간(ms)` 에 min/max 가 없어 `-500`/`99999` 가 유효로 통과했다.
 *        런타임 `clampMs` 는 50~5000ms 로 자른다.
 *  - D8: 목록 요약이 `화면 효과: effect: fadeIn, durationMs: 300` 처럼 내부 키를 노출했다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const SCREEN_EFFECT_ID = "m2-202-screen-effect";

const noopActions: CommandListActions = {
  addCommand: () => {},
  insertCommand: () => {},
  replaceCommand: () => {},
  deleteCommand: () => {},
  moveCommand: () => {},
  moveCommandTo: () => {},
};

function screenEffect(fields: Record<string, unknown>): Command {
  return { kind: "m2Command", commandId: SCREEN_EFFECT_ID, fields } as unknown as Command;
}

function bodyOf(fields: Record<string, unknown>, actions: CommandListActions = noopActions): FakeElement {
  return renderWithFakeDom(() =>
    renderCommandBody({ path: [], actions, lockKind: true }, screenEffect(fields))
  );
}

describe("screen effect authoring — color field, duration range, list summary", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("value field offers a native color picker and preset swatches (D3)", () => {
    const body = bodyOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
    const color = findByTestId(body, "m2-command-value-color");
    expect(color?.type).toBe("color");
    expect(color?.value).toBe("#39ff14");
    for (const preset of ["red", "green", "blue", "yellow", "purple", "white", "black"]) {
      expect(findByTestId(body, `m2-command-value-swatch-${preset}`)).toBeTruthy();
    }
  });

  it("preset swatch writes the color into the command (D3)", () => {
    let staged: Command | null = null;
    const body = bodyOf(
      { effect: "tint", value: "", durationMs: 300 },
      { ...noopActions, replaceCommand: (_path, command) => (staged = command) }
    );
    findByTestId(body, "m2-command-value-swatch-green")?.click();
    const applied = staged as Command | null;
    expect(applied?.kind).toBe("m2Command");
    if (applied?.kind !== "m2Command") return;
    expect(applied.fields.value).toBe("green");
  });

  it("invalid typed color marks the field aria-invalid with a short reason (D3)", () => {
    const body = bodyOf({ effect: "tint", value: "", durationMs: 300 });
    const text = findByTestId(body, "m2-command-value-input");
    expect(text).toBeTruthy();
    if (!text) return;
    text.value = "#xyz";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    expect(text.getAttribute("aria-invalid")).toBe("true");
    expect(findByTestId(body, "m2-command-value-error")?.textContent).toContain("#rrggbb");

    text.value = "green";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    expect(text.getAttribute("aria-invalid")).toBe("false");
  });

  it("durationMs input carries the runtime clamp range (D7)", () => {
    const body = bodyOf({ effect: "flash", value: "white", durationMs: 300 });
    const duration = findByTestId(body, "m2-command-durationMs-input");
    expect(duration?.min).toBe("50");
    expect(duration?.max).toBe("5000");
    expect(duration?.getAttribute("step")).toBe("100");

    if (!duration) return;
    duration.value = "99999";
    duration.dispatchEvent(new Event("input", { bubbles: true }));
    expect(duration.getAttribute("aria-invalid")).toBe("true");
    expect(findByTestId(body, "m2-command-durationMs-note")?.textContent).toContain("5000");
  });

  it("list summary uses catalog labels instead of raw field keys (D8)", () => {
    expect(commandSummary(screenEffect({ effect: "fadeIn", durationMs: 300 }))).toContain("페이드 인");
    expect(commandSummary(screenEffect({ effect: "fadeIn", durationMs: 300 }))).not.toContain("effect:");
    const tint = commandSummary(screenEffect({ effect: "tint", value: "#39ff14", durationMs: 1200 }));
    expect(tint).toContain("색조");
    expect(tint).toContain("#39ff14");
    expect(tint).toContain("1200ms");
    expect(tint).not.toContain("durationMs");
  });
});
