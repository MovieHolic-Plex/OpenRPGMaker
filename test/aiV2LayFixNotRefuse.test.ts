// 칸 배치 실내 — 거절은 게임이 깨질 때만(2026-11-16 오너 «에셋을 자유롭게», r6 실모델 «갈매나루»).
// 남은 거절 사유를 하나씩 훑어 «게임이 깨지는 것»(바깥 벽이 열림 · 입구를 못 씀 · 방이 입구에서 닿지 않음 · 어디에도 가까운 것이 없는 낱말)만 남기고,
// 나머지(목록을 잘못 고른 기물 · 벽면에 안 닿은 벽 기물 · 표에 없는 깔개 · 문 하나의 흠 · 단·난간·바닥 구역 · 이름표 · 랜드마크 없음 · 끝이 안 닿은 칸막이 ·
// 문을 막은 기물 · 맞지 않는 고침 줄)는 고쳐 깔고 무엇을 고쳤는지 한 줄씩 알린다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildFromLayout } from "@/ai/v2/place/builders/interiorLayoutBuild";
import { effectiveSpec } from "@/ai/v2/place/interiorCatalog";
import type { ToolContext } from "@/editor/tools/types";
import type { PlaceSpec } from "@/ai/v2/shared/types";

const ts = createBeodeulCityTileset();
const ES = effectiveSpec(ts)!;
const fresh = () => { const project = createBlankProject(); project.tilesets[ts.id] = createBeodeulCityTileset(); const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true }; return createBuildRun(ctx); };
/** 두 방 집(가로 칸막이 + 문 하나) — 버들항 낱말만. */
const house = (patch: Record<string, unknown> = {}) => ({ map: { w: 14, h: 14 }, landmark: { id: "barrel stack", x: 1, y: 11 },
  outer_wall: { material: "log", path: [[0, 0], [13, 0], [13, 13], [0, 13]] }, walls: [{ id: "mid", material: "log", path: [[0, 6], [13, 6]] }],
  doors: [{ wall: "mid", x: 6, y: 6 }], entrance: { x: 6, y: 13 },
  rooms: [{ id: "back", at: [3, 4], floor: "plank", purpose: "store" }, { id: "front", at: [3, 10], floor: "plank", purpose: "shop" }],
  wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }], objects: [{ id: "crate", x: 10, y: 10 }], ...patch });
const lay = (layout: unknown) => buildFromLayout(fresh(), { type: "interior", name: "가게", layout, hints: { newMap: true } } as unknown as PlaceSpec, ES, ts.id, undefined);

describe("칸 배치 실내 — 고쳐 깔고 알린다", () => {
  it.each([
    ["벽붙이를 objects 에 — wall_items 로 옮기고 가장 가까운 벽면 자리로", { objects: [{ id: "crate", x: 10, y: 10 }, { id: "stairs down", x: 4, y: 10 }] }, /^fixed — "stairs down" at \(4,10\) did not touch a wall face; laid at \(\d+,\d+\) on wall "mid"/u],
    ["바닥 기물을 wall_items 에 — objects 로", { wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }, { id: "crate", wall: "outer", x: 9, y: 4 }] }, /^fixed — "crate" at \(9,4\) is a floor piece: laid from objects instead of wall_items\.$/u],
    ["표에 사각 깔개가 없다 — 가장 가까운 깔개 기물을 그 사각형에", { carpets: [{ id: "rug red", x: 3, y: 9, w: 3, h: 2 }] }, /^swapped carpet "rug red" → "red rug" laid in its rect/u],
    ["모르는 벽의 문 — 그 문만 빼고", { doors: [{ wall: "mid", x: 6, y: 6 }, { wall: "nope", x: 3, y: 6 }] }, /^left out — door \(3,6\): unknown wall "nope"/u],
    ["문짝이 아닌 문짝 — 열린 문으로", { doors: [{ wall: "mid", x: 6, y: 6, piece: "crate" }] }, /^fixed — door \(6,6\): "crate" is not a door piece, laid as an open doorway/u],
    ["모르는 단", { daises: [{ id: "golden dais", x: 3, y: 9, w: 2, h: 2 }] }, /^left out — unknown dais id "golden dais"/u],
    ["모르는 난간", { rails: [{ id: "golden rail", path: [[2, 9], [5, 9]] }] }, /^left out — unknown rail id "golden rail"/u],
    ["바닥 없는 바닥 구역", { floor_zones: [{ floor: "plank", x: 0, y: 0, w: 1, h: 1 }] }, /^left out — floor_zone plank at \(0,0\) 1x1 covers no floor cell/u],
    ["벽 위의 방 이름표", { rooms: [{ id: "back", at: [3, 4], floor: "plank" }, { id: "front", at: [3, 10], floor: "plank" }, { id: "ghost", at: [0, 0], floor: "plank" }] }, /^left out — room label "ghost"/u],
    ["이름표 없는 방 — 이웃 바닥으로 방을 만든다", { rooms: [{ id: "front", at: [3, 10], floor: "plank" }] }, /^fixed — enclosed space \(1,1\)\.\.\(12,5\) \(60 cells\) had no room label; laid as room "space_\d+"/u],
    ["한 공간에 이름표 둘 — 한 방으로", { rooms: [{ id: "back", at: [3, 4], floor: "plank" }, { id: "front", at: [3, 10], floor: "plank" }, { id: "front2", at: [9, 10], floor: "plank" }] }, /^fixed — rooms "front" and "front2" are one connected space/u],
    ["끝이 안 닿은 칸막이 — 선 벽으로", { walls: [{ id: "mid", material: "log", path: [[0, 6], [13, 6]] }, { id: "stubby", material: "log", path: [[9, 7], [9, 10]] }] }, /^fixed — wall "stubby" end \(9,10\) does not touch another wall; laid as a freestanding wall/u],
    ["같은 벽 id 둘 · 두께 3", { walls: [{ id: "mid", material: "log", path: [[0, 6], [13, 6]], thickness: 3 }, { id: "mid", material: "log", path: [[9, 7], [9, 12]] }] }, /^fixed — wall id "mid" is used twice; the second is laid as "mid_\d+"/u],
  ] as const)("%s", (_name, patch, line) => {
    const r = lay(house(patch));
    expect(r.ok, r.summary).toBe(true);
    expect(r.summary).not.toMatch(/laid your layout exactly/u);
    expect(r.warnings.some((w) => line.test(w)), r.warnings.join("\n")).toBe(true);
  });

  it("랜드마크가 없어도 깐다 — 다음에 적으라고 알린다", () => {
    const r = lay(house({ landmark: undefined }));
    expect(r.ok, r.summary).toBe(true);
    expect(r.warnings.some((w) => w.startsWith("no landmark — "))).toBe(true);
  });

  it("문을 막은 기물은 빼고 깔고(그 문이 다시 닿는다) 무엇을 뺐는지 적는다", () => {
    const r = lay(house({ objects: [{ id: "crate", x: 6, y: 9 }, { id: "crate", x: 5, y: 9 }, { id: "crate", x: 7, y: 9 }] }));
    expect(r.ok, r.summary).toBe(true);
    expect(r.summary).toMatch(/laid \d+ of your \d+ pieces — left out/u);
  });

  it("게임이 깨지는 것만 거절한다 — 방 사이 문이 없음 · 바깥 벽이 열림 · 입구가 바닥 줄에 없음", () => {
    for (const patch of [{ doors: [] }, { outer_wall: { material: "log", path: [[0, 0], [13, 0], [13, 13]] } }, { entrance: { x: 6, y: 5 } }]) {
      const r = lay(house(patch));
      expect(r.ok, JSON.stringify(patch)).toBe(false);
      expect(r.summary).toMatch(/^Rejected: the interior layout for "가게"/u);
    }
  });

  it("어디에도 가까운 것이 없는 낱말 하나는 거절하지 않는다 — 그 조각만 빼고 깔고 무엇을 뺐는지 적는다(2026-11-17 r8 «table:fish+fishr»)", () => {
    const r = lay(house({ objects: [{ id: "golden unicorn", x: 10, y: 10 }] }));
    expect(r.ok, r.summary).toBe(true);
    expect(r.summary).toMatch(/left out \(each with its reason in warnings\): "golden unicorn"/u);
  });

  it("r6 「대성당」 두 번째 거절(벽붙이 계단을 objects 에 · 표에 없는 사각 깔개)이 이제 거절 없이 깔리고, 계단은 가장 가까운 빈 벽면에 선다", () => {
    const cathedral = { map: { w: 24, h: 20 }, landmark: { id: "altar", x: 7, y: 4 }, outer_wall: { material: "stone", path: [[0, 0], [23, 0], [23, 19], [0, 19]] },
      walls: [{ id: "w_sac", material: "stone", thickness: 1, path: [[17, 0], [17, 19]] }], doors: [{ wall: "w_sac", x: 17, y: 16, piece: null }], entrance: { x: 8, y: 19 },
      rooms: [{ id: "nave", at: [8, 10], floor: "grey", role: "main" }, { id: "sacristy", at: [20, 10], floor: "plank", role: "side" }],
      wall_items: [{ id: "stained window", wall: "outer", x: 3, y: 1 }, { id: "organ", wall: "outer", x: 1, y: 3 }, { id: "scroll shelf", wall: "outer", x: 19, y: 3 }],
      objects: [{ id: "altar", x: 7, y: 4 }, { id: "pew", x: 2, y: 9, repeat: { count: 4, dx: 0, dy: 2 } }, { id: "stairs down", x: 19, y: 6 }, { id: "writing desk", x: 19, y: 10 }],
      carpets: [{ id: "rug red", x: 7, y: 7, w: 3, h: 11 }] };
    const r = lay(cathedral);
    expect(r.ok, r.summary).toBe(true);
    expect(r.warnings).toContain('fixed — "stairs down" at (19,6) is a wall piece: laid from wall_items instead of objects.');
    expect(r.warnings.some((w) => /^fixed — "stairs down" at \(19,6\) did not touch a wall face; laid at \(\d+,\d+\) on wall "(outer|w_sac)"/u.test(w))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('swapped carpet "rug red" → "red rug'))).toBe(true);
  });
});
