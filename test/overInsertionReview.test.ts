import { describe, expect, it } from "vitest";
import type { ProposedCall } from "@/ai/assistantSession";
import { overInsertionNotice, reviewOverInsertion } from "@/ai/overInsertionReview";
import type { ToolResult } from "@/editor/tools";
import type { ChangeSummary } from "@/project/types";

function diff(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function call(name: string, overrides: Partial<ProposedCall> = {}): ProposedCall {
  const result: ToolResult = { ok: true, summary: name, diff: diff() };
  return { name, args: {}, summary: name, result, destructive: false, ...overrides };
}

describe("reviewOverInsertion", () => {
  it("일반 1건 타일 쓰기는 검토 없이 통과한다", () => {
    const paint = call("paint_tiles", {
      result: { ok: true, summary: "paint", diff: diff({ tilesChanged: 12 }) },
    });
    const review = reviewOverInsertion({ calls: [paint], beforeMapCount: 1, afterMapCount: 1 });
    expect(review.needsReview).toBe(false);
  });

  it("파괴성 호출은 검토를 강제하고 destructive를 올린다", () => {
    const review = reviewOverInsertion({
      calls: [call("remove_event", { destructive: true })],
      beforeMapCount: 1,
      afterMapCount: 1,
    });
    expect(review.needsReview).toBe(true);
    expect(review.destructive).toBe(true);
  });

  it("승인 메타데이터만으로는 검토를 강제하지 않는다", () => {
    const review = reviewOverInsertion({
      calls: [call("propose_tile_vocabulary", { requiresApproval: true, approvalWarning: "재료 합의" })],
      beforeMapCount: 1,
      afterMapCount: 1,
    });
    expect(review.needsReview).toBe(false);
    expect(review.destructive).toBe(false);
  });

  it("이벤트 대량 추가는 검토를 강제한다", () => {
    const review = reviewOverInsertion({
      calls: [call("place_npc", {
        result: { ok: true, summary: "npc", diff: diff({ eventsAdded: 10 }) },
      })],
      beforeMapCount: 1,
      afterMapCount: 1,
    });
    expect(review.needsReview).toBe(true);
    expect(review.destructive).toBe(false);
  });

  it("새 맵 추가와 대량 쓰기는 검토를 강제한다", () => {
    const fresh = reviewOverInsertion({
      calls: [call("create_map")],
      beforeMapCount: 1,
      afterMapCount: 2,
    });
    expect(fresh.needsReview).toBe(true);
    const mass = reviewOverInsertion({
      calls: Array.from({ length: 6 }, (_, i) => call("paint_tiles", {
        result: { ok: true, summary: `p${i}`, diff: diff({ tilesChanged: 10 }) },
      })),
      beforeMapCount: 1,
      afterMapCount: 1,
    });
    expect(mass.needsReview).toBe(true);
  });

  it("공지 페이로드는 파괴 여부에 따라 제목을 바꾼다", () => {
    expect(overInsertionNotice({
      calls: [call("reset_project", { destructive: true })],
      beforeMapCount: 1,
      afterMapCount: 1,
    }).title).toContain("파괴");
  });
});
