import { describe, expect, it } from "vitest";
import baseline from "./fixtures/houseTemplates.baseline.json";
import { ALL_HOUSE_KIT_IDS, HOUSE_KITS } from "@/editor/houseKit";
import { HOUSE_TEMPLATES } from "@/editor/tools/village/constants";
import {
  findHouseTemplateDef,
  houseTemplateWingsAt,
  HOUSE_TEMPLATE_DEFS,
  type HouseTemplateDef,
} from "@/project/defaults/houseTemplateCatalog";

// 형태 데이터화 계약 테스트 — 형태가 함수(wingsAt)에서 선언형 데이터(wings)로 옮겨갔다.
// baseline은 리팩터 직전 함수형 카탈로그의 전개 결과 덤프다. 이 파일이 통과하는 동안
// 데이터 정본은 예전 함수와 칸 하나까지 같은 집을 만든다.

type BaselineRow = {
  readonly id: string;
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly stories: number | null;
  readonly lowWall: boolean | null;
  readonly kitId: string | null;
  readonly roofDeck: boolean | null;
  readonly wingsAt: Record<string, readonly { x: number; y: number; w: number; h: number }[]>;
};

const rows = baseline as readonly BaselineRow[];

/** 열마다 이어지는 칸 묶음(열 구간)을 뽑는다 — 시공기가 벽 밴드 높이를 재는 단위. */
function columnIntervals(def: HouseTemplateDef): readonly { x: number; height: number }[] {
  const intervals: { x: number; height: number }[] = [];
  for (let x = 0; x < def.w; x += 1) {
    const covered = new Set<number>();
    for (const wing of def.wings) {
      if (x < wing.x || x >= wing.x + wing.w) continue;
      for (let y = wing.y; y < wing.y + wing.h; y += 1) covered.add(y);
    }
    let run = 0;
    for (let y = 0; y <= def.h; y += 1) {
      if (covered.has(y)) {
        run += 1;
        continue;
      }
      if (run > 0) intervals.push({ x, height: run });
      run = 0;
    }
  }
  return intervals;
}

describe("집 형태 카탈로그 데이터화", () => {
  it("기준선과 id·순서·치수가 같다", () => {
    expect(HOUSE_TEMPLATE_DEFS.map((def) => def.id)).toEqual(rows.map((row) => row.id));
    for (const [index, row] of rows.entries()) {
      const def = HOUSE_TEMPLATE_DEFS[index] as HouseTemplateDef;
      expect({ name: def.name, w: def.w, h: def.h }, def.id).toEqual({ name: row.name, w: row.w, h: row.h });
      expect(def.stories ?? null, `${def.id} stories`).toBe(row.stories);
      expect(def.lowWall ?? null, `${def.id} lowWall`).toBe(row.lowWall);
      expect(def.kitId ?? null, `${def.id} kitId`).toBe(row.kitId);
      expect(def.roofDeck ?? null, `${def.id} roofDeck`).toBe(row.roofDeck);
    }
  });

  it("모든 원점에서 예전 함수형 전개와 날개가 정확히 같다", () => {
    for (const row of rows) {
      const def = findHouseTemplateDef(row.id) as HouseTemplateDef;
      expect(def, row.id).toBeDefined();
      for (const [origin, expected] of Object.entries(row.wingsAt)) {
        const [x, y] = origin.split(",").map(Number) as [number, number];
        expect(houseTemplateWingsAt(def, x, y), `${row.id} @${origin}`).toEqual(expected);
      }
    }
  });

  it("HOUSE_TEMPLATES의 wingsAt은 데이터 전개의 래퍼다", () => {
    expect(HOUSE_TEMPLATES.length).toBe(HOUSE_TEMPLATE_DEFS.length);
    for (const template of HOUSE_TEMPLATES) {
      const def = findHouseTemplateDef(template.id) as HouseTemplateDef;
      expect(template.wings, template.id).toEqual(def.wings);
      expect(template.wingsAt(0, 0), template.id).toEqual(def.wings);
      expect(template.wingsAt(6, 9), template.id).toEqual(houseTemplateWingsAt(def, 6, 9));
    }
  });

  it("형태 데이터가 JSON 왕복을 그대로 통과한다 (DB 저장 전제)", () => {
    const round = JSON.parse(JSON.stringify(HOUSE_TEMPLATE_DEFS)) as readonly HouseTemplateDef[];
    expect(round).toEqual(HOUSE_TEMPLATE_DEFS);
    // 재료 킷도 같은 전제를 만족해야 형태+재료를 한 레코드로 저장할 수 있다.
    expect(JSON.parse(JSON.stringify(HOUSE_KITS))).toEqual(HOUSE_KITS);
  });

  it("카탈로그 규칙을 지킨다 — 폭 상한·날개 경계·킷 id·층 구간 최소 높이", () => {
    const wallBand = (def: HouseTemplateDef): number => (def.lowWall ? 2 : 2 + (2 * (def.stories ?? 1) - 1));
    for (const def of HOUSE_TEMPLATE_DEFS) {
      expect(def.w, `${def.id} 폭 상한`).toBeLessThanOrEqual(8);
      expect(def.wings.length, `${def.id} 날개 없음`).toBeGreaterThan(0);
      if (def.kitId) expect(ALL_HOUSE_KIT_IDS, `${def.id} 킷 id`).toContain(def.kitId);
      for (const wing of def.wings) {
        expect(wing.x >= 0 && wing.y >= 0, `${def.id} 날개 음수 좌표`).toBe(true);
        expect(wing.x + wing.w, `${def.id} 날개 폭 초과`).toBeLessThanOrEqual(def.w);
        expect(wing.y + wing.h, `${def.id} 날개 높이 초과`).toBeLessThanOrEqual(def.h);
      }
      // 열 구간(한 열에서 이어지는 칸 묶음) 높이 >= 벽 밴드 + 2 — 지붕 최소 2행.
      // t-porch처럼 날개가 세로로 붙는 형태는 합집합으로 봐야 하고,
      // estate-*처럼 마당으로 끊긴 형태는 묶음마다 따로 성립해야 한다.
      for (const interval of columnIntervals(def)) {
        // 계단식 2층은 열마다 층수가 다르다 — 그 열을 덮는 날개의 층수로 최소 높이를 잰다.
        const wing = def.wings.find((entry) => interval.x >= entry.x && interval.x < entry.x + entry.w);
        const stories = wing?.stories ?? def.stories ?? 1;
        const band = def.lowWall ? 2 : 2 + (2 * stories - 1);
        expect(interval.height, `${def.id} x=${interval.x} 열 구간 높이`).toBeGreaterThanOrEqual(band + 2);
      }
      // bbox는 날개 합집합과 정확히 일치해야 한다 — 울타리·문 판정이 bbox를 믿는다.
      expect(Math.max(...def.wings.map((wing) => wing.x + wing.w)), `${def.id} bbox 폭`).toBe(def.w);
      expect(Math.max(...def.wings.map((wing) => wing.y + wing.h)), `${def.id} bbox 높이`).toBe(def.h);
    }
  });

  it("계단식 2층(tier-*)은 날개마다 층수를 적고 전개가 그대로 남는다", () => {
    const tiers = HOUSE_TEMPLATE_DEFS.filter((def) => def.id.startsWith("tier-"));
    expect(tiers.length).toBeGreaterThanOrEqual(4);
    for (const def of tiers) {
      // 층수를 선언한 날개가 하나 이상, 그리고 그 값이 2층이다(위층이 드러나는 실루엣의 근거).
      const declared = def.wings.filter((wing) => wing.stories !== undefined);
      expect(declared.length, def.id).toBeGreaterThan(0);
      expect(declared.some((wing) => wing.stories === 2), `${def.id} 2층 날개`).toBe(true);
      // 열마다 자기 층수의 최소 높이(벽 밴드 + 지붕 2)를 넘겨야 시공이 성립한다.
      for (const interval of columnIntervals(def)) {
        const wingStories = def.wings.find((wing) =>
          interval.x >= wing.x && interval.x < wing.x + wing.w)?.stories ?? def.stories ?? 1;
        expect(interval.height, `${def.id} x=${interval.x} 열 구간`).toBeGreaterThanOrEqual(2 + (2 * wingStories - 1) + 2);
      }
    }
  });
});
