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
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import type { EventPage, GameEvent } from "@/project/types";
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

/**
 * 3라운드 회귀:
 *  - D6: 화면 효과 모달이 `날씨 설정` 모달(의도 카드·프리셋 칩)에 비해 헐벗었다.
 *  - D9: fadeIn/fadeOut 은 `값` 을 읽지 않는데 입력이 그대로 보였다.
 *        (flash/tint/weather 는 런타임 applyScreenEffect 가 값을 읽으므로 남긴다.)
 */
describe("screen effect authoring — intent card, duration presets, value visibility", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  function effectSelect(body: FakeElement): FakeElement {
    const select = findByTestId(body, "m2-command-effect-option-select");
    if (!select) throw new Error("효과 select 가 없다");
    return select;
  }

  it("intent card explains the selected effect in one line, with the duration (D6)", () => {
    const body = bodyOf({ effect: "flash", value: "white", durationMs: 800 });
    const card = findByTestId(body, "m2-screen-effect-intent");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("번쩍");
    expect(card?.textContent).toContain("800ms");
  });

  it("intent card follows the effect select (D6)", () => {
    const body = bodyOf({ effect: "flash", value: "white", durationMs: 800 });
    const select = effectSelect(body);
    select.value = "fadeOut";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const card = findByTestId(body, "m2-screen-effect-intent");
    expect(card?.textContent).toContain("어두워");
    expect(card?.textContent).not.toContain("번쩍");
  });

  it("duration preset chips write 300/800/1600ms into the number input (D6)", () => {
    let staged: Command | null = null;
    const body = bodyOf(
      { effect: "fadeOut", value: "", durationMs: 300 },
      { ...noopActions, replaceCommand: (_path, command) => (staged = command) }
    );
    const chips = [
      { testid: "m2-screen-effect-duration-fast", label: "빠른", ms: 300 },
      { testid: "m2-screen-effect-duration-normal", label: "보통", ms: 800 },
      { testid: "m2-screen-effect-duration-slow", label: "느린", ms: 1600 },
    ];
    for (const chip of chips) {
      const button = findByTestId(body, chip.testid);
      expect(button, chip.testid).toBeTruthy();
      expect(button?.textContent).toContain(chip.label);
      button?.click();
      expect(findByTestId(body, "m2-command-durationMs-input")?.value).toBe(String(chip.ms));
      const applied = staged as Command | null;
      expect(applied?.kind).toBe("m2Command");
      if (applied?.kind !== "m2Command") return;
      expect(applied.fields.durationMs).toBe(chip.ms);
      expect(findByTestId(body, "m2-screen-effect-intent")?.textContent).toContain(`${chip.ms}ms`);
    }
  });

  it("hides the 값 row for effects the runtime ignores and toggles it live (D9)", () => {
    const hiddenFor = (effect: string): boolean => {
      const row = findByTestId(bodyOf({ effect, value: "", durationMs: 300 }), "m2-screen-effect-value-field");
      if (!row) throw new Error("값 행이 없다");
      return row.hidden;
    };
    expect(hiddenFor("fadeIn")).toBe(true);
    expect(hiddenFor("fadeOut")).toBe(true);
    expect(hiddenFor("tint")).toBe(false);
    expect(hiddenFor("flash")).toBe(false);
    expect(hiddenFor("weather")).toBe(false);

    const body = bodyOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
    const select = effectSelect(body);
    select.value = "fadeIn";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(findByTestId(body, "m2-screen-effect-value-field")?.hidden).toBe(true);
    select.value = "tint";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(findByTestId(body, "m2-screen-effect-value-field")?.hidden).toBe(false);
  });
});

/**
 * D9(3라운드): 모든 화면 효과 행에 `이 명령은 실제 게임에서 일부 효과만 실행됩니다` 라는
 * 뭉뚱그린 경고가 붙었다. fadeIn/fadeOut/flash/tint/weather 는 applyScreenEffect 가
 * 실제 렌더 경로에 얹으므로 그 문장은 거짓이고, 렌더러가 없는 값(blur)에만 참이다.
 */
describe("screen effect authoring — runtime warning text (D9)", () => {
  const VAGUE = "이 명령은 실제 게임에서 일부 효과만 실행됩니다.";

  function validate(fields: Record<string, unknown>) {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const page = {
      id: "page-1",
      name: "화면 효과 페이지",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [screenEffect(fields)],
    } as unknown as EventPage;
    const event = { id: "event-fx", x: 3, y: 3, trigger: page.trigger, commands: [], pages: [page] } as unknown as GameEvent;
    project.maps[mapId].events = [event];
    return validateEventDraftBody(project, mapId, event);
  }

  it("drops the vague partial-runtime warning for effects the runtime renders", () => {
    for (const effect of ["fadeIn", "fadeOut", "flash", "tint", "weather"]) {
      const messages = validate({ effect, value: "", durationMs: 300 }).issues.map((issue) => issue.message);
      expect(messages, effect).not.toContain(VAGUE);
      expect(messages.join(" | "), effect).not.toContain("일부 효과만");
    }
  });

  it("names the unrenderable effect instead of hand-waving", () => {
    const issues = validate({ effect: "blur", value: "", durationMs: 300 }).issues;
    const warning = issues.find((issue) => issue.code === "runtime.screenEffect.unsupported");
    expect(warning?.severity).toBe("warning");
    expect(warning?.commandPath).toEqual([0]);
    expect(warning?.message).toContain("blur");
    expect(issues.map((issue) => issue.message)).not.toContain(VAGUE);
  });
});
