// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { closeRegionResultCard, countRegionChanges, regionFixInstruction, regionResultSummary, regionTurnTouched, regionWarningsFromEvent, showRegionResultCard, showRegionResultCardOnRegionMap } from "@/editor/regionResultCard";
import { regionPlaceRequest } from "@/ai/regionPlaceIntent";
import { editorState } from "@/editor/editorState";
import type { Project } from "@/project/types";

function project(lower: number[], events: { id: string; x: number; y: number }[] = []): Project {
  return { maps: { m1: { id: "m1", width: 4, height: 3, lowerTiles: lower, upperTiles: new Array(12).fill(0), events } } } as unknown as Project;
}

describe("region result card counts", () => {
  const base = new Array(12).fill(1);

  it("counts only changed cells inside the region", () => {
    const after = base.slice();
    after[0] = 5; // (0,0) inside
    after[5] = 5; // (1,1) inside
    after[11] = 5; // (3,2) outside
    const counts = countRegionChanges(project(base), project(after), "m1", { x: 0, y: 0, width: 2, height: 2 });
    expect(counts).toEqual({ cells: 2, events: 0 });
    expect(regionResultSummary(counts)).toBe("칸 2개 바뀜");
  });

  it("counts added, moved and removed events in the region", () => {
    const before = project(base, [{ id: "a", x: 0, y: 0 }, { id: "b", x: 1, y: 1 }, { id: "far", x: 3, y: 2 }]);
    const after = project(base, [{ id: "a", x: 1, y: 0 }, { id: "c", x: 0, y: 1 }, { id: "far", x: 3, y: 2 }]);
    const counts = countRegionChanges(before, after, "m1", { x: 0, y: 0, width: 2, height: 2 });
    expect(counts).toEqual({ cells: 0, events: 3 });
    expect(regionResultSummary(counts)).toBe("이벤트 3개 바뀜");
  });

  it("names maps the instruction created outside the region (shop interior)", () => {
    const before = project(base);
    const after = project(base.map((tile, i) => (i === 0 ? 9 : tile)));
    (after.maps as Record<string, unknown>).inner = { id: "inner", name: "도구점", width: 2, height: 2, lowerTiles: [0, 0, 0, 0], upperTiles: [0, 0, 0, 0], events: [] };
    const counts = countRegionChanges(before, after, "m1", { x: 0, y: 0, width: 2, height: 2 });
    expect(counts).toEqual({ cells: 1, events: 0, newMaps: ["도구점"] });
    expect(regionResultSummary(counts)).toBe("칸 1개 바뀜 · 새 맵 도구점");
  });

  it("shows the card for the region map even when the turn also made an interior", () => {
    const before = project(base);
    const after = project(base.map((tile, i) => (i === 0 ? 9 : tile)));
    (after.maps as Record<string, unknown>).inner = { id: "inner", name: "집", width: 2, height: 2, lowerTiles: [0, 0, 0, 0], upperTiles: [0, 0, 0, 0], events: [] };
    expect(regionTurnTouched(before, after, "m1", { x: 0, y: 0, width: 2, height: 2 })).toBe(true);
    expect(regionTurnTouched(before, project(base), "m1", { x: 0, y: 0, width: 2, height: 2 })).toBe(false);
    expect(regionTurnTouched(before, after, "gone", { x: 0, y: 0, width: 2, height: 2 })).toBe(false);
  });

  it("goes back to the region map when the turn left the view on the new interior, then shows the card there", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const before = project(base);
    const after = project(base.map((tile, i) => (i === 0 ? 9 : tile)));
    (after.maps as Record<string, unknown>).inner = { id: "inner", name: "도구점", width: 2, height: 2, lowerTiles: [0, 0, 0, 0], upperTiles: [0, 0, 0, 0], events: [] };
    const input = { mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 }, instruction: "여기 상점 만들어 줘", before, after, onUndo: () => {} };
    editorState.set({ currentMapId: "inner" });
    const opened: string[] = [];
    const card = showRegionResultCardOnRegionMap(input, (id) => { opened.push(id); editorState.set({ currentMapId: id }); return true; }, host);
    expect(opened).toEqual(["m1"]);
    expect(card?.querySelector("[data-testid=region-result-count]")?.textContent).toBe("칸 1개 바뀜 · 새 맵 도구점");
    closeRegionResultCard();
    editorState.set({ currentMapId: "inner" });
    expect(showRegionResultCardOnRegionMap(input, () => false, host)).toBeNull();
    host.remove();
  });

  it("says nothing changed when the region is untouched", () => {
    expect(regionResultSummary(countRegionChanges(project(base), project(base), "m1", { x: 0, y: 0, width: 4, height: 3 }))).toBe("이 영역은 그대로");
  });
});

// 빠른 적용(fast-apply, 2026-11-25): 영역 지시는 짓고 바로 돌려주고, 검사가 본 것은 카드의 경고 한 줄 + 「고치기」 칩으로 남는다.
describe("region result card warnings", () => {
  const base = new Array(12).fill(1);
  const status = { type: "execution_status", name: "v2.fast.warnings", ok: false, summary: "", data: { warnings: [
    { key: "a", text: "도구점: 가게에 찻상이 있다", detail: "[게임 검사 방 쓰임] 도구점: 가게에 찻상이 있다 — tile_erase 로 걷어 낸다" },
    { key: "b", text: "문 앞 칸이 막혔다", detail: "문 앞 칸이 막혔다" },
  ], total: 2 } };

  it("reads the fast-apply warnings from a (nested) run event and ignores other events", () => {
    expect(regionWarningsFromEvent({ type: "agent_event", event: status })?.map((w) => w.text)).toEqual(["도구점: 가게에 찻상이 있다", "문 앞 칸이 막혔다"]);
    expect(regionWarningsFromEvent({ ...status, name: "v2.advisor" })).toBeNull();
    expect(regionWarningsFromEvent({ type: "tool_end", name: "build_region_place" })).toBeNull();
  });

  it("shows one warning line and a fix chip that hands the warnings to the assistant", () => {
    const host = document.createElement("div");
    document.body.append(host);
    editorState.set({ currentMapId: "m1" });
    const warnings = regionWarningsFromEvent(status)!;
    let fixed: readonly { text: string; detail: string }[] = [];
    const card = showRegionResultCard({ mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 }, instruction: "여기 상점 만들어 줘", before: project(base), after: project(base.map((t, i) => (i === 0 ? 9 : t))),
      onUndo: () => {}, warnings, onFix: (w) => { fixed = w; } }, host)!;
    expect(card.querySelector("[data-testid=region-result-warnings]")?.textContent).toContain("⚠ 도구점: 가게에 찻상이 있다 외 1건");
    (card.querySelector("[data-testid=region-result-fix]") as HTMLButtonElement).click();
    expect(fixed).toEqual(warnings);
    expect(host.querySelector("[data-testid=region-result-card]")).toBeNull();
    // 고치기 지시는 경고 글에 「도구점」 같은 장소 낱말이 있어도 장소를 다시 짓는 지시로 읽히지 않는다.
    const fix = regionFixInstruction([...warnings, { text: "상점 하나 더 추가", detail: "상점 하나 더 추가" }]);
    expect(fix).toContain("tile_erase");
    expect(regionPlaceRequest(fix)).toBeNull();
    expect(regionPlaceRequest("여기 상점 만들어 줘")).toBe("shop");
    host.remove();
  });

  it("draws no warning line when the check found nothing", () => {
    const host = document.createElement("div");
    document.body.append(host);
    editorState.set({ currentMapId: "m1" });
    const card = showRegionResultCard({ mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 }, instruction: "여기 여관", before: project(base), after: project(base),
      onUndo: () => {}, warnings: [], onFix: () => {} }, host)!;
    expect(card.querySelector("[data-testid=region-result-warnings]")).toBeNull();
    closeRegionResultCard();
    host.remove();
  });
});
