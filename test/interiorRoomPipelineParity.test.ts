// interiorRoomPipelineParity.test.ts
// 실내 방 파이프라인 특성화 핀(characterization pin) — 데모 플랜 7개의 lower/upper 타일 배열이
// 커밋된 베이스라인 픽스처와 완전히 같아야 한다. 카탈로그 리팩터가 생성 결과를 바꾸지 않는다는 증거.
import { describe, expect, it } from "vitest";

import baseline from "./fixtures/interiorRoomDemoRooms.baseline.json";

import { INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline } from "@/editor/interiorRoomPipeline";

type BaselineRoom = {
  readonly index: number;
  readonly theme: string;
  readonly name: string;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
  readonly eventCount: number;
};

const rooms = baseline.rooms as readonly BaselineRoom[];

describe("runInteriorRoomPipeline 베이스라인 패리티", () => {
  it("베이스라인이 데모 플랜 전체를 담고 있다", () => {
    expect(rooms.length).toBe(INTERIOR_ROOM_DEMO_PLANS.length);
  });

  for (const fixture of rooms) {
    it(`#${fixture.index} ${fixture.theme} — ${fixture.name} 타일 배열이 베이스라인과 동일`, () => {
      const plan = INTERIOR_ROOM_DEMO_PLANS[fixture.index]!;
      expect(plan.name).toBe(fixture.name);
      expect(plan.seed).toBe(fixture.seed);
      const { map } = runInteriorRoomPipeline(plan);
      expect(map.width).toBe(fixture.width);
      expect(map.height).toBe(fixture.height);
      expect(map.events.length).toBe(fixture.eventCount);
      expect(map.lowerTiles).toEqual(fixture.lowerTiles);
      expect(map.upperTiles).toEqual(fixture.upperTiles);
    });
  }
});
