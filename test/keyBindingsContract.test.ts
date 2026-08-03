// 런타임 키 계약 회귀 게이트.
//
// 적대적 리뷰(2026-08-03)에서 필드/대사/선택지/커서메뉴/상태메뉴/전투가 각각 다른
// 확인·취소 집합을 들고 있는 게 드러났다. 여기서는 "각 서피스가 정본과 같은 답을
// 낸다"를 표로 고정한다. 서피스 하나가 몰래 자기 판정을 재구현하면 여기가 깨진다.
import { describe, expect, it } from "vitest";

import { isDialogueAdvanceKey } from "@/player/dialogue";
import { RuntimeKeyHoldTracker } from "@/player/input";
import {
  directionForKey,
  isAutoBattleKey,
  isCancelKey,
  isConfirmKey,
  isMenuKey,
  isSkillKey,
  normalizeKey,
} from "@/player/keyBindings";
import { reduceStatusMenuKeyboard, type RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";

const CONFIRM_SAMPLES = ["z", "Z", "Enter", " ", "Space", "Spacebar", "e", "E"] as const;
const CANCEL_SAMPLES = ["x", "X", "Escape", "Esc"] as const;
const NEUTRAL_SAMPLES = ["ArrowUp", "1", "Tab", "F1"] as const;

describe("key bindings — 정본 계약", () => {
  it("결정 키는 Z·Enter·Space(+레거시 E)이고 대소문자를 가리지 않는다", () => {
    for (const key of CONFIRM_SAMPLES) {
      expect(isConfirmKey(key), key).toBe(true);
      expect(isCancelKey(key), key).toBe(false);
    }
  });

  it("취소 키는 X·Esc 이고 대소문자를 가리지 않는다", () => {
    for (const key of CANCEL_SAMPLES) {
      expect(isCancelKey(key), key).toBe(true);
      expect(isConfirmKey(key), key).toBe(false);
    }
  });

  it("결정과 취소는 겹치지 않고, 중립 키는 어느 쪽도 아니다", () => {
    for (const key of NEUTRAL_SAMPLES) {
      expect(isConfirmKey(key), key).toBe(false);
      expect(isCancelKey(key), key).toBe(false);
    }
  });

  it("필드 메뉴 열기는 취소 키와 같다 — 플레이어가 배울 규칙은 하나다", () => {
    for (const key of CANCEL_SAMPLES) expect(isMenuKey(key), key).toBe(true);
    for (const key of CONFIRM_SAMPLES) expect(isMenuKey(key), key).toBe(false);
  });

  it("이동은 방향키와 WASD 를 모두 받는다", () => {
    expect(directionForKey("ArrowUp")).toBe("up");
    expect(directionForKey("W")).toBe("up");
    expect(directionForKey("a")).toBe("left");
    expect(directionForKey("S")).toBe("down");
    expect(directionForKey("d")).toBe("right");
    expect(directionForKey("z")).toBeNull();
  });

  it("자동전투 토글은 이동 키와 겹치지 않는다", () => {
    expect(isAutoBattleKey("f")).toBe(true);
    expect(isAutoBattleKey("F")).toBe(true);
    // A 로 두면 WASD 로 걷던 플레이어가 전투에서 좌측 이동을 누를 때 켜진다.
    expect(isAutoBattleKey("a")).toBe(false);
    expect(directionForKey("f")).toBeNull();
  });

  it("normalizeKey 가 브라우저 편차(Spacebar/Esc/대문자)를 흡수한다", () => {
    expect(normalizeKey("Spacebar")).toBe(" ");
    expect(normalizeKey("Space")).toBe(" ");
    expect(normalizeKey("Esc")).toBe("escape");
    expect(normalizeKey("Z")).toBe("z");
  });
});

describe("key bindings — 서피스별 일치", () => {
  it("대사창은 결정 키에서만 진행하고 취소 키에는 반응하지 않는다", () => {
    for (const key of CONFIRM_SAMPLES) expect(isDialogueAdvanceKey(key), key).toBe(true);
    for (const key of CANCEL_SAMPLES) expect(isDialogueAdvanceKey(key), key).toBe(false);
  });

  it("필드 조사 엣지가 결정 키 전체에서 잡힌다", () => {
    for (const key of CONFIRM_SAMPLES) {
      const tracker = new RuntimeKeyHoldTracker();
      tracker.keyDown(key);
      expect(tracker.consumeActionEdge(), key).toBe(true);
    }
  });

  it("상태 메뉴가 결정/취소 키 전체를 같은 뜻으로 읽는다", () => {
    for (const key of CONFIRM_SAMPLES) {
      const result = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, key as RuntimeMenuKey);
      expect(result.action, key).toBe("enter-function");
    }
    for (const key of CANCEL_SAMPLES) {
      const result = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, key as RuntimeMenuKey);
      expect(result.action, key).toBe("close");
    }
  });

  it("상태 메뉴 커서가 WASD 로도 움직인다", () => {
    const viaArrow = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, "ArrowDown");
    const viaWasd = reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main" }, "s");
    expect(viaWasd.action).toBe("select");
    expect(viaWasd.selectedCommand).toBe(viaArrow.selectedCommand);
  });
});

describe("key bindings — 눌림 상태 위생", () => {
  it("OS 키 리피트는 엣지를 만들지 않는다(스킬 연사 방지)", () => {
    const tracker = new RuntimeKeyHoldTracker();
    tracker.keyDown("q");
    expect(tracker.consumeSkillEdge()).toBe(true);
    tracker.keyDown("q", true);
    tracker.keyDown("q", true);
    expect(tracker.consumeSkillEdge()).toBe(false);
    tracker.keyUp("q");
    tracker.keyDown("q");
    expect(tracker.consumeSkillEdge()).toBe(true);
    expect(isSkillKey("Q")).toBe(true);
  });

  it("누른 채로 키가 유지되면 조사 엣지는 한 번만 잡힌다", () => {
    const tracker = new RuntimeKeyHoldTracker();
    tracker.keyDown("z");
    expect(tracker.consumeActionEdge()).toBe(true);
    tracker.keyDown("z");
    expect(tracker.consumeActionEdge()).toBe(false);
  });

  it("releaseAll 이 방향·대시·대기 엣지를 전부 턴다(포커스 이탈 복구)", () => {
    const tracker = new RuntimeKeyHoldTracker();
    tracker.keyDown("ArrowRight");
    tracker.keyDown("Shift");
    tracker.keyDown("z");
    expect(tracker.heldDirections()).toEqual(["right"]);
    expect(tracker.isDashing()).toBe(true);

    tracker.releaseAll();

    expect(tracker.heldDirections()).toEqual([]);
    expect(tracker.isDashing()).toBe(false);
    expect(tracker.consumeActionEdge()).toBe(false);
    expect(tracker.consumeAttackEdge()).toBe(false);
    expect(tracker.consumeSkillEdge()).toBe(false);
  });

  it("액션 전투 맵에서는 결정 키가 조사와 공격 엣지를 함께 세운다", () => {
    for (const key of ["z", " ", "Enter"] as const) {
      const tracker = new RuntimeKeyHoldTracker();
      tracker.setAttackMode(true);
      tracker.keyDown(key);
      expect(tracker.consumeActionEdge(), key).toBe(true);
      expect(tracker.consumeAttackEdge(), key).toBe(true);
    }
  });

  it("액션 전투가 아닌 맵에서는 공격 엣지가 서지 않는다", () => {
    const tracker = new RuntimeKeyHoldTracker();
    tracker.keyDown(" ");
    expect(tracker.consumeActionEdge()).toBe(true);
    expect(tracker.consumeAttackEdge()).toBe(false);
  });
});
