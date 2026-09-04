import { describe, expect, it } from "vitest";
import {
  expandRect,
  HOUSE_MARGIN,
  rectsOverlap,
  type Plaza,
  type Rect,
} from "@/editor/tools/village/constants";
import { sketchSiteFootprint, sketchHouseSites } from "@/editor/tools/village/sketch";

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

  it("목표 채수를 채우고 8x7 footprint로 광장·가장자리 금지선을 지킨다", () => {
    // Given: 50x50 구역과 중앙 광장
    // When: seed 7로 8채분을 스케치한다
    const sites = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 7, targetHouses: TARGET });
    // Then: 8개 이상, 8x7 footprint가 확장 광장 밖·마진 안쪽이다
    expect(sites.length).toBeGreaterThanOrEqual(TARGET);
    const expanded = expandRect(PLAZA.rect, HOUSE_MARGIN + 2);
    for (const site of sites) {
      const box = sketchSiteFootprint(site);
      expect(rectsOverlap(box, expanded)).toBe(false);
      expect(box.x).toBeGreaterThanOrEqual(AREA.x + HOUSE_MARGIN);
      expect(box.y).toBeGreaterThanOrEqual(AREA.y + HOUSE_MARGIN);
      expect(box.x + box.w).toBeLessThanOrEqual(AREA.x + AREA.w - HOUSE_MARGIN);
      expect(box.y + box.h).toBeLessThanOrEqual(AREA.y + AREA.h - HOUSE_MARGIN);
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

  it("사이트끼리 8x7+마진 AABB가 겹치지 않는다", () => {
    // Given: seed 7 스케치 결과
    // When: 모든 쌍의 8x7 footprint를 잰다
    const sites = sketchHouseSites({ area: AREA, plaza: PLAZA, seed: 7, targetHouses: TARGET });
    // Then: 마진 확정한 AABB끼리 겹치지 않는다
    expect(sites.length).toBeGreaterThanOrEqual(TARGET);
    for (let i = 0; i < sites.length; i += 1) {
      for (let j = i + 1; j < sites.length; j += 1) {
        const a = expandRect(sketchSiteFootprint(sites[i]!), HOUSE_MARGIN);
        const b = expandRect(sketchSiteFootprint(sites[j]!), HOUSE_MARGIN);
        expect(rectsOverlap(a, b), `site ${i} vs ${j}`).toBe(false);
      }
    }
  });

  it("대로 밴드에 8x7 footprint가 닿지 않는다", () => {
    // Given: 동서대로 행 30·남북대로 열 32
    // When: 대로를 넘겨 스케치한다
    const sites = sketchHouseSites({
      area: AREA,
      plaza: PLAZA,
      seed: 7,
      targetHouses: TARGET,
      boulevard: { ewRow: 30, nsCol: 32 },
    });
    // Then: 8x7 footprint가 어느 대로 밴드와도 겹치지 않는다
    expect(sites.length).toBeGreaterThanOrEqual(TARGET);
    for (const site of sites) {
      const box = sketchSiteFootprint(site);
      const hitsEw = box.y <= 31 && box.y + box.h - 1 >= 29;
      const hitsNs = box.x <= 33 && box.x + box.w - 1 >= 31;
      expect(hitsEw || hitsNs).toBe(false);
    }
  });
});
