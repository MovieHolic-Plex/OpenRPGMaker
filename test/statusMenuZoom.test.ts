// S6 club-festival: 고해상도 프로젝트에서 ESC 메뉴가 320×240 판 그대로 그려져 글자가 눌렸다 — 정수배로 키운다.
import { describe, expect, it } from "vitest";
import { statusMenuZoom } from "@/player/playerStatusMenu";

describe("상태 메뉴 배율", () => {
  it("기본 320×240·480×320 은 그대로", () => {
    expect(statusMenuZoom({ width: 320, height: 240 })).toBe(1);
    expect(statusMenuZoom({ width: 480, height: 320 })).toBe(1);
  });
  it("고해상도는 정수배", () => {
    expect(statusMenuZoom({ width: 640, height: 480 })).toBe(2);
    expect(statusMenuZoom({ width: 1024, height: 768 })).toBe(3);
    expect(statusMenuZoom({ width: 1920, height: 1080 })).toBe(4);
  });
});
