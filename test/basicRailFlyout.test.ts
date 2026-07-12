import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  basicFlyoutReducer,
  buildFlyoutShell,
  INITIAL_BASIC_FLYOUT_STATE,
  type BasicFlyoutState,
} from "@/editor/panels/basicRailFlyout";
import { findByTestId, installFakeDom } from "./fakeDom";

describe("basicFlyoutReducer", () => {
  it("같은 패널 토글은 닫고, 다른 패널 토글은 전환한다", () => {
    let s: BasicFlyoutState = INITIAL_BASIC_FLYOUT_STATE;
    s = basicFlyoutReducer(s, { type: "toggle", id: "tiles" });
    expect(s.open).toBe("tiles");
    s = basicFlyoutReducer(s, { type: "toggle", id: "maps" });
    expect(s.open).toBe("maps");
    s = basicFlyoutReducer(s, { type: "toggle", id: "maps" });
    expect(s.open).toBeNull();
  });

  it("바깥 클릭은 핀 없을 때만 닫는다", () => {
    let s = basicFlyoutReducer(INITIAL_BASIC_FLYOUT_STATE, { type: "toggle", id: "tiles" });
    s = basicFlyoutReducer(s, { type: "pin-toggle" });
    expect(basicFlyoutReducer(s, { type: "outside-click" }).open).toBe("tiles");
    s = basicFlyoutReducer(s, { type: "pin-toggle" });
    expect(basicFlyoutReducer(s, { type: "outside-click" }).open).toBeNull();
  });

  it("Escape는 핀 상태와 무관하게 닫고 핀을 푼다", () => {
    let s = basicFlyoutReducer(INITIAL_BASIC_FLYOUT_STATE, { type: "toggle", id: "maps" });
    s = basicFlyoutReducer(s, { type: "pin-toggle" });
    const closed = basicFlyoutReducer(s, { type: "escape" });
    expect(closed.open).toBeNull();
    expect(closed.pinned).toBe(false);
  });

  it("닫힌 상태에서 pin-toggle은 무시한다", () => {
    expect(basicFlyoutReducer(INITIAL_BASIC_FLYOUT_STATE, { type: "pin-toggle" })).toEqual(INITIAL_BASIC_FLYOUT_STATE);
  });
});

describe("buildFlyoutShell", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); });

  it("제목·핀·닫기·본문을 렌더하고 콜백을 배선한다", () => {
    let pinToggles = 0;
    let closes = 0;
    const body = document.createElement("div");
    const shell = buildFlyoutShell({
      title: "타일",
      pinned: false,
      onPinToggle: () => { pinToggles += 1; },
      onClose: () => { closes += 1; },
      body,
    });
    document.body.append(shell);
    expect(findByTestId(document.body as never, "basic-rail-flyout")).toBeTruthy();
    (findByTestId(document.body as never, "basic-flyout-pin") as unknown as HTMLElement).click();
    (findByTestId(document.body as never, "basic-flyout-close") as unknown as HTMLElement).click();
    expect(pinToggles).toBe(1);
    expect(closes).toBe(1);
  });
});
