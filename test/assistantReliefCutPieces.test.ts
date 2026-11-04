// test/assistantReliefCutPieces.test.ts
// 조수 빌더(버들항 마을 · 던전 높이 단 · bbox 마을)가 놓는 계단이 모두 절벽을 깎은 통째 조각(rampArt *-steps)에 맞는다.
// 조각이 없는 모양(cutPieceFor null)이면 렌더러가 말없이 옛 돌계단 타일로 물러난다 — 2026-11-04 전에는 빌더 모양 9/9 가 null 이었다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "@/editor/tools/authorBeodeulTown";
import { AUTHOR_DUNGEON_TOOL } from "@/editor/tools/dungeonTools";
import { checkBboxVillage, type BboxVillageLayout } from "@/editor/tools/bboxVillage";
import { reliefAllowsStep, reliefSlopes } from "@/project/relief/walk";
import { reliefRampArt } from "@/project/relief/styles";
import { cutPieceFor } from "@/project/relief/cutPieces";
import type { ReliefData } from "@/project/relief/types";

/** 모든 경사로: 조각 키 · 조각이 있는가 · 아랫 층계참에서 윗 층계참까지 모든 열을 걸어 오르는가. */
function slopesOf(r: ReliefData, style: string | undefined) {
  const pieces = reliefRampArt(style)?.pieces;
  return reliefSlopes(r).map((s) => {
    const code = r.ramps?.[s.y * r.width + s.x] ?? 0, kind = code > 4 ? "stairs" : "ramp";
    const key = `${kind}:${s.dir}:${s.w}x${s.h}:${s.hi - s.lo}`;
    let walk = s.dir === "n" || s.dir === "s";
    for (let a = 0; walk && a < s.w; a += 1) {
      const dy = s.dir === "n" ? -1 : 1, x = s.x + a;
      let y = s.dir === "n" ? s.y + s.h : s.y - 1;
      for (let k = 0; k <= s.h; k += 1, y += dy) if (!reliefAllowsStep(r, x, y, x, y + dy)) { walk = false; break; }
    }
    return { key, at: [s.x, s.y], piece: !!(pieces && cutPieceFor(pieces, kind, s.dir, s.w, s.h, s.hi - s.lo)), walk };
  });
}

describe("assistant builders lay carved stair pieces", () => {
  it("버들항 마을(코드 지형 언덕·계단식 단): 모든 계단이 조각에 맞고 걸어 오른다", { timeout: 120_000 }, () => {
    let total = 0;
    for (const theme of ["river", "desert"]) for (const landform of ["hill", "terraces"]) for (const seed of [1, 2]) {
      const p = createBlankProject();
      const res = AUTHOR_BEODEUL_TOWN_TOOL.run(p as never, { theme, landform, seed, name: "relief" }) as { data: { mapId: string } };
      const map = p.maps[res.data.mapId]!;
      const sl = slopesOf(map.relief!, map.relief!.style);
      total += sl.length;
      for (const s of sl) expect(s, `${theme}/${landform}/${seed} ${s.key} @${s.at}`).toMatchObject({ piece: true, walk: true });
    }
    expect(total).toBeGreaterThan(0);
  });

  it("던전 높이 단(rooms[].level): 모든 계단이 조각에 맞고 걸어 오른다", { timeout: 60_000 }, () => {
    const designs = [
      { type: "cave", design: { rooms: [{ id: "a", role: "entrance", at: "s", level: 0 }, { id: "b", role: "hall", at: "center", level: 1 }, { id: "c", role: "boss", at: "n", level: 2 }], connections: "linear" } },
      { type: "cave", design: { rooms: [{ id: "a", role: "entrance", at: "w", level: 0 }, { id: "b", role: "hall", at: "center", level: 1 }, { id: "c", role: "treasure", at: "ne", level: 2 }, { id: "d", role: "boss", at: "e", level: 1 }], connections: "branch" } },
      { type: "forest", design: { rooms: [{ id: "a", role: "entrance", at: "s", level: 0 }, { id: "b", role: "camp", at: "e", level: 1 }, { id: "c", role: "boss", at: "n", level: 2 }], connections: "linear" } },
    ];
    let total = 0;
    for (const d of designs) for (const seed of [1, 2]) {
      const p = createBlankProject();
      const res = AUTHOR_DUNGEON_TOOL.run(p as never, { name: "relief", type: d.type, design: d.design, seed, populate: false, gimmick: "none", adapter: "beodeul", genre: "rpg" }) as { data: { mapId?: string; mapIds?: string[] } };
      const map = p.maps[res.data.mapIds?.[0] ?? res.data.mapId!]!;
      if (!map.relief) continue;
      const sl = slopesOf(map.relief, map.relief.style);
      total += sl.length;
      for (const s of sl) expect(s, `${d.type}/${seed} ${s.key} @${s.at}`).toMatchObject({ piece: true, walk: true });
    }
    expect(total).toBeGreaterThan(0);
  });

  it("bbox 마을: 북쪽 오르막은 발치 한 줄, 남쪽 오르막은 단 차 + 2줄만 받고 그 계단이 조각에 맞는다", () => {
    // 20×20: 0~7줄 2단(북쪽 대지) · 8~14줄 0단 · 15~19줄 1단(남쪽 대지, 북향 절벽)
    const W = 20, H = 20, levels = Array.from({ length: W * H }, (_, i) => { const y = Math.floor(i / W); return y <= 7 ? 2 : y >= 15 ? 1 : 0; });
    const T = { W, H, levels, water: new Array<number>(W * H).fill(0) };
    const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
    const layout = (stairs: { x: number; y: number; w: number; h: number; dir: "north" | "south" }[], rects: ReturnType<typeof rect>[]) =>
      ({ name: "t", roads: [{ kind: "main", rects }], stairs, plazas: [], buildings: [], fields: [], fences: [], trees: [], props: [],
        forests: [rect(0, 0, 8, 8), rect(12, 0, 8, 8), rect(0, 15, 8, 5), rect(12, 15, 8, 5), rect(0, 8, 8, 3), rect(12, 8, 8, 3), rect(0, 12, 8, 3), rect(12, 12, 8, 3)] }) as unknown as BboxVillageLayout;
    const stairErrors = (L: BboxVillageLayout) => checkBboxVillage([], L, T as never).errors.filter((e) => /stairs\[/.test(e));
    const good = layout([{ x: 9, y: 8, w: 2, h: 1, dir: "north" }, { x: 9, y: 12, w: 2, h: 3, dir: "south" }], [rect(9, 0, 2, 8), rect(9, 9, 2, 2), rect(0, 11, 20, 1), rect(9, 15, 2, 5)]);
    const checked = checkBboxVillage([], good, T as never);
    expect(checked.errors).toEqual([]);
    const plan = checked.plan!;
    const sl = slopesOf({ width: W, height: H, levels, ramps: plan.ramps }, "grass-steps");
    expect(sl.map((s) => s.key).sort()).toEqual(["stairs:n:2x1:2", "stairs:s:2x3:1"]);
    for (const s of sl) expect(s).toMatchObject({ piece: true, walk: true });
    // 옛 모양(북쪽 단 차 + 1줄 · 폭 1)은 거절한다
    expect(stairErrors(layout([{ x: 9, y: 8, w: 2, h: 3, dir: "north" }], [rect(9, 0, 2, 8), rect(9, 11, 2, 1), rect(0, 11, 20, 1)]))).toHaveLength(1);
    expect(stairErrors(layout([{ x: 9, y: 8, w: 1, h: 1, dir: "north" }], [rect(9, 0, 1, 8), rect(9, 9, 1, 3), rect(0, 11, 20, 1)]))).toHaveLength(1);
  });
});
