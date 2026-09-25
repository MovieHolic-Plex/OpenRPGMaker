import { describe, expect, it } from "vitest";
import { auditGableHouseForm, GABLE_HOUSE_FORM_SPECS } from "@/editor/gableHouseCompose";
import { ALL_HOUSE_KIT_IDS, wallPostOffsets } from "@/editor/houseKit";

// 2026-09-25 사용자 검토 규칙: 사선 캡 뒤가 비지 않는다 · 보이는 벽 면 ≥3칸 · 3칸 이상 벽 면이면 창 하나 이상.
describe("박공 조합 형태 검사", () => {
  for (const spec of GABLE_HOUSE_FORM_SPECS) {
    it(`${spec.id} 는 모든 킷에서 결함이 없다`, () => {
      for (const kitId of ALL_HOUSE_KIT_IDS) {
        expect(auditGableHouseForm(spec, kitId), `${spec.id} × ${kitId}`).toEqual([]);
      }
    });
  }
});

describe("기둥 열은 벽 가운데에만", () => {
  it("끝 칸·끝 옆 칸에는 기둥이 없다", () => {
    for (let width = 3; width <= 14; width += 1) {
      for (const offset of wallPostOffsets(width, 3)) {
        expect(offset).toBeGreaterThanOrEqual(2);
        expect(offset).toBeLessThanOrEqual(width - 3);
      }
    }
    expect([...wallPostOffsets(10, 3)]).toEqual([3, 6]);
    expect([...wallPostOffsets(5, 3)]).toEqual([]);
  });
});
