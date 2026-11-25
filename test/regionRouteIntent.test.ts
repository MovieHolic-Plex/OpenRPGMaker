import { describe, expect, it } from "vitest";
import { oppositeRouteLabel, resolveInteriorIntent, resolveRegionRoute } from "@/editor/regionTask/regionRouteIntent";
import { formatSelectionTerrain, selectionTerrain } from "@/editor/selectionTerrainSummary";
import { SELECTION_PLACE_PRESETS } from "@/editor/selectionActionChips";
import type { GameMap } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

// test/regionRouteIntent.test.ts
// 문장 → 실행 경로 라우팅 계약. 스펙 §5.1.
// 이 라우터가 모드 스위치를 대체하므로, "무엇이 어디로 가는가" 는 테스트로 고정한다.
describe("regionRouteIntent", () => {
  isolateTimers();
  describe("resolveRegionRoute", () => {
    it("빈 입력은 다듬기 — 버튼 하나가 「다듬기」와 「실행」을 겸한다", () => {
      expect(resolveRegionRoute("").kind).toBe("polish");
      expect(resolveRegionRoute("   ").kind).toBe("polish");
    });

    it("다듬기 어휘는 그대로 다듬기로 간다", () => {
      expect(resolveRegionRoute("주변과 어울리게 해줘").kind).toBe("polish");
    });

    it("생성기 키워드는 생성기로 — AI 를 부르지 않는다", () => {
      const route = resolveRegionRoute("울창한 숲에 오솔길 하나");
      expect(route.kind).toBe("operator");
      if (route.kind !== "operator") return;
      expect(route.operatorId).toBe("forest");
      // 문장의 "울창"·"오솔길" 이 파라미터로 옮겨져야 한다(그냥 기본값이면 문장이 버려진 것).
      expect(route.params.density).toBeGreaterThan(0.8);
      expect(route.params.path).toBe(true);
      expect(route.note).toBeTruthy();
    });

    it("집이 주인공인 문장은 마을 생성기", () => {
      const route = resolveRegionRoute("집 다섯 채가 광장을 둘러싼 마을");
      expect(route.kind).toBe("operator");
      if (route.kind !== "operator") return;
      expect(route.operatorId).toBe("village");
      expect(route.params.houses).toBe(5);
      expect(route.params.layout).toBe("plaza");
    });

    it("실내 낱말이 있으면 실내 초안으로 — 생성기보다 먼저 본다", () => {
      const route = resolveRegionRoute("여관 실내를 방으로 나눠줘");
      expect(route.kind).toBe("interior");
      if (route.kind !== "interior") return;
      expect(route.presetId).toBe("inn");
    });

    it("「여관이 있는 마을」은 실내가 아니다 — 안/속을 말해야 실내다", () => {
      const route = resolveRegionRoute("여관이 있는 마을");
      expect(route.kind).toBe("operator");
      if (route.kind !== "operator") return;
      expect(route.operatorId).toBe("village");
    });

    it("키워드로 확실하지 않으면 조수에게 넘긴다 — 추측하지 않는다", () => {
      const route = resolveRegionRoute("여기에 뭔가 재미있는 걸 놔줘");
      expect(route.kind).toBe("assistant");
    });

    it("모든 경로가 왜 그리 갔는지를 말한다 — 오라우팅을 사용자가 읽을 수 있어야 한다", () => {
      for (const text of ["", "주변과 어울리게", "울창한 숲", "실내 방 배치", "알 수 없는 소원"]) {
        expect(resolveRegionRoute(text).why).toBeTruthy();
      }
    });
  });
  describe("resolveInteriorIntent", () => {
    it("실내 신호가 없으면 null", () => {
      expect(resolveInteriorIntent("숲으로 채워줘")).toBeNull();
    });

    it("프리셋 낱말이 없으면 중립값(주거)으로 두고 무엇으로 읽었는지 남긴다", () => {
      const intent = resolveInteriorIntent("실내로 만들어줘");
      expect(intent).not.toBeNull();
      expect(intent!.presetId).toBe("home");
      expect(intent!.modifier).toBe("");
      expect(intent!.note).toContain("주거");
    });

    it("분위기 낱말을 겹쳐 읽는다", () => {
      const intent = resolveInteriorIntent("호화로운 대저택 내부");
      expect(intent!.presetId).toBe("manor");
      expect(intent!.modifier).toBe("luxury");
      expect(intent!.note).toContain("luxury");
    });
  });
  describe("oppositeRouteLabel", () => {
    it("조수로 갔으면 생성기로, 아니면 AI 로 되돌린다", () => {
      expect(oppositeRouteLabel("assistant")).toBe("생성기로 다시");
      expect(oppositeRouteLabel("operator")).toBe("AI로 다시");
      expect(oppositeRouteLabel("interior")).toBe("AI로 다시");
      expect(oppositeRouteLabel("polish")).toBe("AI로 다시");
    });
  });
});

describe("selectionTerrainSummary", () => {
  isolateTimers();
  function plateau(): GameMap {
    const width = 10, height = 8, n = width * height;
    const levels = new Array<number>(n).fill(0), ramps = new Array<number>(n).fill(0), waterDepth = new Array<number>(n).fill(0);
    for (let y = 2; y < 6; y++) for (let x = 2; x < 7; x++) levels[y * width + x] = 2;
    ramps[6 * width + 4] = 1;
    waterDepth[7 * width + 0] = 1;
    return { id: "m", name: "m", width, height, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [],
      relief: { width, height, levels, ramps }, terrainDesign: { waterDepth, lockedCells: [2 * width + 2] } };
  }
  describe("선택 지형 꼬리말", () => {
    it("사각형 안의 높이 분포·경사로·물·잠금을 센다", () => {
      const t = selectionTerrain(plateau(), { x: 0, y: 2, width: 6, height: 6 });
      expect(Object.fromEntries(t.levels)).toEqual({ 0: 20, 2: 16 });
      expect([t.ramps, t.water, t.locked]).toEqual([1, 1, 1]);
      expect(formatSelectionTerrain(plateau(), { x: 0, y: 2, width: 6, height: 6 })).toContain("높이·경사로·물은 바꾸지 말 것");
    });

    it("「마을」「숲」 칩 문장은 기존 생성기 경로로 간다", () => {
      const byId = Object.fromEntries(SELECTION_PLACE_PRESETS.map((p) => [p.id, p.instruction!]));
      expect(resolveRegionRoute(byId.village!).kind).toBe("operator");
      expect(resolveRegionRoute(byId.forest!).kind).toBe("operator");
    });
  });
});
