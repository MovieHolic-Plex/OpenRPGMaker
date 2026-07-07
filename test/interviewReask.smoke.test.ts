// 맵 인터뷰 재질문 버그 스모크(#7): 이미 설정한 타일이 계속 재질문되는 원인을 도구 계층에서 격리한다.
// set_tile_metadata → analyze_map_tile_usage의 described 전이가 도구 계층에서 정상인지 확인.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

type UsageData = { tiles: Array<{ tile: number; described: boolean; knownVia: string | null }>; coverage: { used: number; described: number } };

function analyze(ctx: { project: ReturnType<typeof createBlankProject> }, mapId: string): UsageData {
  const res = runTool(ctx, "analyze_map_tile_usage", { mapId, includeDescribed: true });
  expect(res.ok, JSON.stringify(res.issues)).toBe(true);
  return res.data as UsageData;
}

describe("맵 인터뷰 재질문 스모크(#7)", () => {
  it("set_tile_metadata로 라벨을 확정하면 그 타일은 described=true가 되어 재질문 목록에서 빠진다", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 12, height: 12 }).ok).toBe(true);
    // 내부(테두리 제외)에 임의 타일 200를 깐다.
    expect(runTool(ctx, "paint_tiles", { mapId: "m1", from: { x: 3, y: 3 }, to: { x: 5, y: 5 }, mode: "rect", layer: "lower", tile: 200 }).ok).toBe(true);

    const before = analyze(ctx, "m1");
    const stat72Before = before.tiles.find((t) => t.tile === 200);
    expect(stat72Before, "타일 200가 사용 통계에 있어야 한다").toBeDefined();

    // 사용자 확정으로 라벨 기록.
    const meta = runTool(ctx, "set_tile_metadata", { confirmedByUser: true, entries: [{ tile: 200, label: "장식 타일", description: "테스트용 장식" }] });
    expect(meta.ok, JSON.stringify(meta.issues)).toBe(true);

    const after = analyze(ctx, "m1");
    const stat72After = after.tiles.find((t) => t.tile === 200);
    expect(stat72After?.described, "확정 후 200은 described=true여야 한다").toBe(true);
    expect(stat72After?.knownVia).toBe("user");
    expect(after.coverage.described).toBeGreaterThan(before.coverage.described);
  });

  it("describe되지 않은 타일만 질문 목록에 오른다(includeDescribed=false)", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "create_map", { id: "m1", name: "t", width: 12, height: 12 });
    runTool(ctx, "paint_tiles", { mapId: "m1", from: { x: 3, y: 3 }, to: { x: 4, y: 4 }, mode: "rect", layer: "lower", tile: 200 });
    runTool(ctx, "set_tile_metadata", { confirmedByUser: true, entries: [{ tile: 200, label: "장식 타일" }] });
    const res = runTool(ctx, "analyze_map_tile_usage", { mapId: "m1" }); // includeDescribed 기본 false
    const listed = (res.data as UsageData).tiles;
    expect(listed.some((t) => t.tile === 200), "설명된 200은 질문 목록에서 빠져야 한다").toBe(false);
  });
});
