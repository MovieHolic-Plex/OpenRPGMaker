// 2026-09-24 추격 호러 도그푸딩: 실내 칩셋의 패턴 없는 벽으로 build_wall 을 8번 반복했다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";

describe("build_wall 패턴 없는 벽 재료", () => {
  it("쓸 수 있는 경로(build_hand_interior_room)를 짚고 같은 재료 재시도를 막는다", () => {
    const ctx = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
    const mapId = ctx.project.startMapId;
    // 새 프로젝트의 시작 맵은 버들항 칸 번호로 칠해져 있다 — 실내 칩셋으로 바꾸면 시작 칸이 막혀 커밋이 거부된다.
    // 실내 칩셋의 통행 가능한 칸으로 비워 두고 바꾼다.
    const map = ctx.project.maps[mapId]!;
    const passable = ctx.project.tilesets.easyrpg_chipset_interior!.passability.findIndex((p) => p.up && p.down && p.left && p.right);
    map.lowerTiles = map.lowerTiles.map(() => passable);
    map.upperTiles = map.upperTiles.map(() => -1);
    const set = runTool(ctx, "set_map_properties", { mapId, tilesetId: "easyrpg_chipset_interior" });
    expect(set.ok, set.summary).toBe(true);
    const result = runTool(ctx, "build_wall", { mapId, rect: { x: 0, y: 0, w: 20, h: 2 }, material: "크림 회벽" });
    expect(result.ok).toBe(false);
    const text = [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" ");
    // place_concept 은 제거됐고, 실내 방 안내는 손 도트 실내 도구로 바뀌었다.
    expect(text).toContain("build_hand_interior_room");
    expect(text).toContain("같은 재료로 다시 부르지 마세요");
    expect(text).not.toContain("T1b 위저드");
  });
});
