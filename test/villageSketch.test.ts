import { describe, expect, it } from "vitest";
import {
  expandRect,
  HOUSE_MARGIN,
  pointInRect,
  type Plaza,
  type Rect,
} from "@/editor/tools/village/constants";
import { SKETCH_MIN_GAP, sketchHouseSites } from "@/editor/tools/village/sketch";

const AREA: Rect = { x: 0, y: 0, w: 50, h: 50 };
const PLAZA: Plaza = { rect: { x: 21, y: 22, w: 8, h: 6 }, centerRow: 25, centerX: 25 };
const TARGET = 8;

describe("village sketch pre-pass", () => {
  it("같은 seed는 같은 사이트를, 다른 seed는 다른 사이트를 낸다", () => {
    // Given: 고정된 구역·광장·목표 채수
    // When: 같은 seed로 두 번, 다른 seed로 한 번 스케치한다
    const first = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 7, targetHouses: TARGET });
    const second = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 7, targetHouses: TARGET });
    const other = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 1, targetHouses: TARGET });
    // Then: 같은 seed는 동일, 다른 seed는 다르게 나온다
    expect(second).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it("목표 채수를 채우고 광장·가장자리 금지선을 지킨다", () => {
    // Given: 50x50 구역과 중앙 광장
    // When: seed 7로 8채분을 스케치한다
    const sites = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 7, targetHouses: TARGET });
    // Then: 8개 이상, 확장 광장 밖, 가장자리 마진 안쪽이다
    expect(sites.length).toBeGreaterThanOrEqual(TARGET);
    const expanded = expandRect(PLAZA.rect, HOUSE_MARGIN + 2);
    for (const site of sites) {
      expect(pointInRect(site, expanded)).toBe(false);
      expect(site.x).toBeGreaterThanOrEqual(AREA.x + HOUSE_MARGIN);
      expect(site.x).toBeLessThanOrEqual(AREA.x + AREA.w - 1 - HOUSE_MARGIN);
      expect(site.y).toBeGreaterThanOrEqual(AREA.y + HOUSE_MARGIN);
      expect(site.y).toBeLessThanOrEqual(AREA.y + AREA.h - 1 - HOUSE_MARGIN);
    }
  });

  it("격자 열·행을 공유하지 않는다 — x·y가 흩어진다", () => {
    // Given: seed 7 스케치 결과
    // When: x·y 좌표 분포를 센다
    const sites = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 7, targetHouses: TARGET });
    // Then: 고유 x·y가 6개 이상이고 같은 x를 4개 이상 공유하지 않는다
    expect(new Set(sites.map((site) => site.x)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(sites.map((site) => site.y)).size).toBeGreaterThanOrEqual(6);
    const perX = new Map<number, number>();
    for (const site of sites) perX.set(site.x, (perX.get(site.x) ?? 0) + 1);
    for (const count of perX.values()) expect(count).toBeLessThanOrEqual(2);
  });

  it("사이트끼리 8폭 집+마진이 겹치지 않게 떨어진다", () => {
    // Given: seed 7 스케치 결과
    // When: 모든 쌍의 거리를 잰다
    const sites = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 7, targetHouses: TARGET });
    // Then: 중심 간격이 SKETCH_MIN_GAP 이상이다
    expect(sites.length).toBeGreaterThanOrEqual(TARGET);
    for (let i = 0; i < sites.length; i += 1) {
      for (let j = i + 1; j < sites.length; j += 1) {
        const dx = sites[i]!.x - sites[j]!.x;
        const dy = sites[i]!.y - sites[j]!.y;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(SKETCH_MIN_GAP);
      }
    }
  });

  it("대로 밴드 1칸 이내에는 사이트를 두지 않는다", () => {
    // Given: 동서대로 행 30·남북대로 열 32
    // When: 대로를 넘겨 스케치한다
    const sites = sketchHouseSites({
      area: AREA,
      plaza: PLAZA,
      seed: 7,
      targetHouses: TARGET,
      boulevard: { ewRow: 30, nsCol: 32 },
    });
    // Then: 대로 중심 1칸 이내에 사이트가 없다
    expect(sites.length).toBeGreaterThanOrEqual(TARGET);
    for (const site of sites) {
      expect(Math.abs(site.y - 30) <= 1).toBe(false);
      expect(Math.abs(site.x - 32) <= 1).toBe(false);
    }
  });
});
