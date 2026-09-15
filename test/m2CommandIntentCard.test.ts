import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

/**
 * 제네릭 M2 폼(구 "기타 명령 껍데기")에 붙인 설명카드의 계약.
 *
 * 판정 축은 `m2-command-intent-card` 클래스 하나다 — 전용 폼(화면 연출·이벤트 지우기)이
 * 먼저 쓰던 마커가 제각각이라, 새 카드를 얹으면서 같은 클래스로 모았다.
 * 각 카드의 둘째 문장은 **부정문**이어야 한다. 그게 이 카드를 붙이는 이유이고,
 * 첫 문장만 있으면 한국어 머리글과 같은 말을 두 번 하는 것이다.
 */
const CASES: readonly { readonly commandId: string; readonly testid: string; readonly not: string }[] = [
  { commandId: "m2-026-change-vehicle-graphic", testid: "m2-change-vehicle-graphic-intent", not: "아닙니다" },
  { commandId: "m2-030-change-screen-transition", testid: "m2-change-screen-transition-intent", not: "않습니다" },
  { commandId: "m2-066-play-movie", testid: "m2-play-movie-intent", not: "아닙니다" },
  { commandId: "m2-078-open-menu-screen", testid: "m2-open-menu-screen-intent", not: "아닙니다" },
  { commandId: "m2-201-camera-control", testid: "m2-camera-control-intent", not: "않습니다" },
  { commandId: "m2-207-region-trigger", testid: "m2-region-trigger-intent", not: "합니다" },
  { commandId: "m2-212-cutscene-control", testid: "m2-cutscene-control-intent", not: "정합니다" },
];

describe("M2 제네릭 폼 설명카드", () => {
  let restoreDom: (() => void) | undefined;

  const actions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };

  const bodyOf = (commandId: string): FakeElement =>
    renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, { kind: "m2Command", commandId, fields: {} })
    );

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  for (const c of CASES) {
    it(`${c.commandId} 은 설명카드를 단다`, () => {
      // 카탈로그가 살아 있어야 제목 분기가 성립한다 — id 가 갈리면 여기서 먼저 깨진다.
      expect(m2CommandById(c.commandId)).toBeTruthy();
      const card = findByTestId(bodyOf(c.commandId), c.testid);
      expect(card).toBeTruthy();
      expect(card?.className ?? "").toContain("m2-command-intent-card");
      expect(card?.textContent ?? "").toContain(c.not);
    });
  }

  it("전용 폼이 먼저 쓰던 카드도 같은 클래스로 판정된다", () => {
    const screenEffect = findByTestId(bodyOf("m2-202-screen-effect"), "m2-screen-effect-intent");
    expect(screenEffect?.className ?? "").toContain("m2-command-intent-card");
    const eraseEvent = findByTestId(bodyOf("m2-086-erase-event"), "m2-command-intent-card");
    expect(eraseEvent?.className ?? "").toContain("m2-command-intent-card");
  });
});
