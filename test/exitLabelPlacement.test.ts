import { describe, expect, it } from "vitest";
import { doorPixelRect, placeExitLabel, type ExitLabelPlacementInput } from "@/player/exitLabelPlacement";

// 16px 칸, 20×10 맵. 편의점 문(2칸 폭, 문 그림 2줄) = 칸 (1,2)–(2,3), 이동 칸은 문 앞 줄 (1,4)–(2,4).
const SIZE = 16;
const konbiniDoor = doorPixelRect({ x: 1, y: 2, w: 2, h: 2 }, SIZE);
const base = (over: Partial<ExitLabelPlacementInput> = {}): ExitLabelPlacementInput => ({
  anchorX: 2 * SIZE,
  aboveY: 4 * SIZE - 2,
  belowY: 5 * SIZE + 2,
  width: 120,
  height: 14,
  mapW: 20 * SIZE,
  mapH: 10 * SIZE,
  heroTileX: 5,
  heroTileY: 7,
  tileSize: SIZE,
  ...over,
});
const covers = (p: { x: number; y: number }, w: number, h: number, d: { left: number; top: number; right: number; bottom: number }) =>
  p.x < d.right && p.x + w > d.left && p.y - h < d.bottom && p.y > d.top;

describe("exit label placement", () => {
  it("without door definitions keeps the old place (above the exit, pushed inside the map)", () => {
    const old = placeExitLabel(base());
    expect(old).toEqual({ x: 1, y: 62, alpha: 1 });
    expect(placeExitLabel(base({ doors: [] }))).toEqual(old);
    // 글자와 겹치지 않는 문은 자리를 바꾸지 않는다.
    expect(placeExitLabel(base({ doors: [doorPixelRect({ x: 15, y: 2, w: 1, h: 2 }, SIZE)] }))).toEqual(old);
  });

  it("keeps the hero rules when there is no door: below when the hero comes from above, beside when a bottom-row door has no room", () => {
    expect(placeExitLabel(base({ heroTileX: 1, heroTileY: 2 }))).toEqual({ x: 1, y: 96, alpha: 1 });
    // 맨 아랫줄 문: 아래 자리가 없고 위에서 다가온 주인공이 글자 밑에 선다 → 주인공 오른쪽.
    const bottomRow = placeExitLabel(base({ anchorX: 5 * SIZE, aboveY: 9 * SIZE - 2, belowY: 10 * SIZE + 2, heroTileX: 5, heroTileY: 8 }));
    expect(bottomRow).toEqual({ x: 6 * SIZE + 2, y: 9 * SIZE - 2, alpha: 1 });
  });

  it("moves off the door art — below the door when the hero is elsewhere", () => {
    const place = placeExitLabel(base({ doors: [konbiniDoor] }));
    expect(covers(place, 120, 14, konbiniDoor)).toBe(false);
    expect(place).toEqual({ x: 1, y: 96, alpha: 1 });
  });

  it("steps beside the door when the hero stands below it", () => {
    const place = placeExitLabel(base({ doors: [konbiniDoor], heroTileX: 1, heroTileY: 5 }));
    expect(covers(place, 120, 14, konbiniDoor)).toBe(false);
    expect(place).toEqual({ x: konbiniDoor.right + 2, y: konbiniDoor.bottom, alpha: 1 });
  });

  it("covers the art cells above the doorway too (a 1×2 door whose exit is the door tile itself)", () => {
    const door = doorPixelRect({ x: 8, y: 3, w: 1, h: 2 }, SIZE);
    // 이동 칸 = 문 아래 칸 (8,4). 예전 자리(칸 위)는 문 윗칸 그림 위다.
    const input = base({ anchorX: 8.5 * SIZE, aboveY: 4 * SIZE - 2, belowY: 5 * SIZE + 2, width: 60, heroTileX: 14, heroTileY: 8, doors: [door] });
    const place = placeExitLabel(input);
    expect(covers(place, 60, 14, door)).toBe(false);
    expect(place.y - 14).toBeGreaterThanOrEqual(door.bottom);
  });

  it("fades instead of covering the hero when only hero-covering spots avoid the door", () => {
    // 좁은 맵, 맨 윗줄의 맵 폭 문(옆·위 자리가 없음), 주인공은 문 바로 아래: 문을 피하는 자리는 주인공 위뿐.
    const door = doorPixelRect({ x: 0, y: 0, w: 5, h: 2 }, SIZE);
    const place = placeExitLabel(base({ anchorX: 2.5 * SIZE, aboveY: 2 * SIZE - 2, belowY: 3 * SIZE + 2, width: 70, mapW: 5 * SIZE, mapH: 5 * SIZE, heroTileX: 2, heroTileY: 3, doors: [door] }));
    expect(place).toEqual({ x: 5, y: 64, alpha: 0.35 });
    expect(covers(place, 70, 14, door)).toBe(false);
    expect(place.alpha).toBe(0.35);
  });
});
