// 버들항 집 안 — 크기 단(중형·대형·초대형 공간): 구성 표 · 평면 풀기 · 방 사이 문 · 크기 자동 깔것 · 문이 달린 집 킷의 tier 태그 배선.
import { describe, expect, it } from "vitest";
import { BEODEUL_INTERIOR_SPEC as S, BEODEUL_INTERIOR_TILESET_ID as TID, buildHandInteriorLayers } from "@/editor/handInterior/builder";
import { roomTemplates } from "@/editor/handInterior/templates";
import { withComposedRooms } from "@/editor/handInterior/rooms";
import { kitInteriorKinds, placeTierMap, tierProgramFor, tierTableOf, tierTemplatePicker, TierPlanError } from "@/editor/handInterior/tierPlan";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildTier, tierProgramOf } from "@/ai/v2/place/builders/interiorTier";
import { interiorBuilder } from "@/ai/v2/place/builders/interior";
import { interiorCatalogCard } from "@/ai/v2/prompt/placeSpecs";
import { kitEntranceCount, kitServesBuilding, kitTier, kitTierByFootprint, type BuildingNeed } from "@/project/kitTier";
import { BEODEUL_KIT_INTERIOR } from "@/project/defaults/beodeulKitUse";
import { canMove, isPassable } from "@/project/collision";
import { WORLDS, worldPlaceSpec } from "@/ai/v2/place/world";
import { VILLAGE_BUILDER } from "@/ai/v2/place/builders/village";
import type { ToolContext } from "@/editor/tools/types";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import { chipsetCatalog, effectiveSpec } from "@/ai/v2/place/interiorCatalog";
import { checkLayout, rejectionText } from "@/ai/v2/place/interiorLayout";
import { buildFromLayout } from "@/ai/v2/place/builders/interiorLayoutBuild";
import { nearIds } from "@/ai/v2/place/unknownWords";
import { tableParts } from "@/ai/v2/place/roomParts";
import { findPieces } from "@/ai/v2/place/interiorCatalog";
import { formatV2VerbFailure } from "@/ai/v2/loop/failureText";
import { LAYOUT_REJECTION_MAX } from "@/ai/v2/place/unknownWords";
import { kitLabel } from "@/ai/v2/place/doorHouse";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";

const table = tierTableOf(TID)!;
const tpls = roomTemplates(TID);
const programs = Object.entries(table.programs);
const fresh = () => {
  const project = createBlankProject(); const ts = createBeodeulCityTileset(); project.tilesets[ts.id] = ts;
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  return { run: createBuildRun(ctx), ts };
};
const roomsOf = (run: ReturnType<typeof fresh>["run"], mapId: string) => (run.ctx.project.maps[mapId]?.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room"));

describe("크기 단 구성 표", () => {
  it("중형 14 구성 × 평면 두 벌 — 한 구성의 두 평면은 방이 붙는 자리가 다르다", () => {
    const medium = programs.filter(([, p]) => p.tier === "medium");
    expect(medium.length).toBeGreaterThanOrEqual(14);
    for (const [id, p] of medium) {
      expect(p.shapes.length, id).toBeGreaterThanOrEqual(2);
      const sig = p.shapes.map((m) => m.rooms.map((r) => `${r.kind}@${r.at ?? ""}`).sort().join(","));
      expect(new Set(sig).size, id).toBe(p.shapes.length);
      for (const m of p.shapes) { expect(m.rooms.length, m.id).toBeGreaterThanOrEqual(2); expect(m.exit, m.id).toBeTruthy(); }
    }
  });
  it("대형 8 구성 × 평면 두 벌, 초대형 4 구성은 맵 3장 이상", () => {
    const large = programs.filter(([, p]) => p.tier === "large"), xl = programs.filter(([, p]) => p.tier === "xlarge");
    expect(large.length).toBeGreaterThanOrEqual(8); expect(xl.length).toBeGreaterThanOrEqual(4);
    for (const [id, p] of large) { expect(p.shapes.length, id).toBeGreaterThanOrEqual(2); for (const m of p.shapes) expect(m.rooms.length, m.id).toBeGreaterThanOrEqual(4); }
    expect(large.some(([, p]) => p.shapes.some((m) => m.rooms.some((r) => r.kind === "t_court")))).toBe(true);      // 안뜰 둘레
    expect(large.some(([, p]) => p.shapes.some((m) => m.rooms.some((r) => r.kind === "t_corridor")))).toBe(true);   // 복도 등뼈
    expect(large.some(([, p]) => (p.maps?.length ?? 0) > 0)).toBe(true);                                             // 층이 다른 것
    for (const [id, p] of xl) { expect(1 + (p.maps?.length ?? 0), id).toBeGreaterThanOrEqual(3); expect(p.links?.length ?? 0, id).toBeGreaterThanOrEqual(2); expect(p.shapes[0]!.rooms.length, id).toBeGreaterThanOrEqual(10); }
  });
  it("큰 홀 견본마다 다른 것 하나가 있다 — 기둥·식탁의 되풀이만으로 차지 않는다", () => {
    const feature: Record<string, string> = { "tavhall-a": "stage", "tavhall-b": "great hearth", "ghall-b": "guild board", "hall-l": "grand stairs", "council-a": "council bench", "nave-a": "pulpit", "sanct-a": "organ",
      "throne-a": "throne", "library-l": "reading table", "customs-a": "customs desk", "whall-a": "hoist", "refectory-a": "pulpit", "kitchen-l": "great hearth" };
    for (const [id, part] of Object.entries(feature)) expect(tpls.find((t) => t.id === `authored-bd-${id}`)?.items.some((i) => i.id === part), id).toBe(true);
    // 알현실의 양옆 벽은 서로 다르다(같은 창·깃발 줄의 좌우 대칭이 아니다)
    const throne = tpls.find((t) => t.id === "authored-bd-throne-a")!;
    const wall = throne.items.filter((i) => i.y === 0 && i.t === "o"), mid = (throne.w - 1) / 2;
    const side = (left: boolean) => wall.filter((i) => (left ? i.x < mid - 4 : i.x > mid + 4)).map((i) => i.id).sort().join(",");
    expect(side(true)).not.toBe(side(false));
  });
  it("한 단 안의 평면 꼴이 한 가지가 아니다 — 옆으로 붙는 것·뒤로 붙는 것·복도에 꿴 것이 다 있다", () => {
    const shapes = programs.filter(([, p]) => p.tier === "medium").flatMap(([, p]) => p.shapes);
    const sides = (m: (typeof shapes)[number]) => new Set(m.rooms.map((r) => r.at?.[0]).filter(Boolean));
    expect(shapes.some((m) => [...sides(m)].every((s) => s === "E" || s === "W"))).toBe(true);        // 한 줄
    expect(shapes.some((m) => [...sides(m)].every((s) => s === "N"))).toBe(true);                      // 뒤로 긴 채
    expect(shapes.some((m) => sides(m).has("N") && (sides(m).has("E") || sides(m).has("W")))).toBe(true);   // ㄱ자
    expect(shapes.some((m) => m.rooms.some((r) => r.kind === "t_corridor"))).toBe(true);               // 복도형
    expect(programs.some(([, p]) => p.tier === "medium" && (p.maps?.length ?? 0) > 0)).toBe(true);      // 다른 층
  });
  it("모든 평면이 게임 열쇠 여럿에서 사각형으로 풀리고 바깥문 방이 맨 아래다", () => {
    for (const [id, p] of programs) for (const m of [...p.shapes, ...(p.maps ?? [])]) for (let k = 0; k < 8; k++) for (const main of p.serves) {
      const got = placeTierMap(m, tierTemplatePicker(tpls, main, `k${k}|${m.id}`), table.doors);
      expect(got.rooms.length, `${id}/${m.id}`).toBe(m.rooms.length);
      const bottom = Math.max(...got.rooms.map((r) => r.y1));
      if (m.exit) expect(got.rooms.find((r) => r.id === m.exit)!.y1, `${id}/${m.id}`).toBe(bottom);
      else expect(got.exit.width).toBe(0);
      for (const a of got.rooms) for (const b of got.rooms) if (a.id < b.id) expect(a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1, `${m.id} ${a.id}×${b.id}`).toBe(false);
    }
  });
  it("이 단에만 쓰는 견본(t_)은 방 종류 표·예제 표에 없다 — 한 방짜리 고르기와 모델이 읽는 방 목록이 그대로다", () => {
    const tierOnly = tpls.filter((t) => t.kind.startsWith("t_"));
    expect(tierOnly.length).toBeGreaterThan(0);
    for (const t of tierOnly) { expect(S.rooms?.kinds[t.kind]).toBeUndefined(); expect(JSON.stringify(S.rooms?.examples ?? [])).not.toContain(t.map); }
  });
  it("평면이 잘못 적히면 이유를 말하며 던진다", () => {
    const pick = tierTemplatePicker(tpls, "living", "x");
    expect(() => placeTierMap({ id: "bad", ko: "", exit: "a", rooms: [{ id: "a", kind: "living" }, { id: "b", kind: "kitchen", at: "S:a:start" }] }, pick)).toThrow(TierPlanError);
    expect(() => placeTierMap({ id: "bad2", ko: "", rooms: [{ id: "a", kind: "없는 종류" }] }, pick)).toThrow(/견본이 없다/u);
  });
});

describe("방 사이 문과 크기 자동 깔것", () => {
  it("문 조각: 가로 칸막이 문은 틈 칸 + 아래 벽면 두 줄, 옆문은 벽면 두 줄 + 통로 칸 — 맨 아래 칸만 바닥 층", () => {
    for (const id of ["door oak", "door arch"]) { const o = S.objects[id]!; expect(o.kind).toBe("door"); expect(o.cells.map((c) => [c[1], c[3]])).toEqual([[0, 3], [1, 3], [2, 2]]); }
    for (const id of ["sidedoor oak", "sidedoor iron", "sidedoor log"]) { const o = S.objects[id]!; expect(o.kind).toBe("sidedoor"); expect(o.cells.map((c) => [c[1], c[3]])).toEqual([[-2, 3], [-1, 3], [0, 2]]); }
    const ts = createBeodeulCityTileset();
    for (const id of ["door oak", "sidedoor iron"]) for (const c of S.objects[id]!.cells) expect(Object.values(ts.passability[c[2]!]!).every(Boolean), id).toBe(true);
  });
  it("방 둘을 이으면 틈에 문이 달리고, 돌 벽 방에는 돌 문이 달린다", () => {
    const c = withComposedRooms({ floor: "dplank", wall: "plaster", rooms: [{ id: "a", x0: 1, y0: 1, x1: 7, y1: 7 }, { id: "b", x0: 9, y0: 1, x1: 15, y1: 7 }, { id: "c", x0: 1, y0: 9, x1: 7, y1: 15 }],
      connect: [{ a: "a", b: "b" }, { a: "a", b: "c", door: "door arch" }], exit: { room: "c" } } as never, S);
    expect(c.composed!.doors.map((d) => d.id).sort()).toEqual(["door arch", "sidedoor oak"]);
    const L = buildHandInteriorLayers(c.input, createBeodeulCityTileset(), S);
    expect(L.issues.filter((i) => i.severity === "error")).toEqual([]); expect(L.unreachedFloor).toEqual([]);
    const got = placeTierMap({ id: "x", ko: "", exit: "g", rooms: [{ id: "g", kind: "guard_room" }, { id: "j", kind: "jail", at: "E:g:end" }] },
      tierTemplatePicker(tpls.map((t) => ({ ...t, wall: "grey" })), "guard_room", "k"), table.doors);
    expect(got.connect[0]!.door).toBe("sidedoor iron");
    // 옆 칸막이의 끝머리는 그 벽의 재질 — 통나무 벽이면 통나무 마구리
    const logs = placeTierMap({ id: "x", ko: "", exit: "g", rooms: [{ id: "g", kind: "guard_room" }, { id: "j", kind: "jail", at: "E:g:end" }] },
      tierTemplatePicker(tpls.map((t) => ({ ...t, wall: "log" })), "guard_room", "k"), table.doors);
    expect(logs.connect[0]!.door).toBe("sidedoor log");
  });
  it("옆문은 트인 문목이다 — 엔진의 충돌 판정으로 통로 칸을 좌우로 건너고, 그 위 끝머리 두 칸으로는 못 들어간다", () => {
    const a = fresh();
    const r = buildTier(a.run, { type: "interior", name: "가게" } as never, { tilesetId: a.ts.id, roomSpec: S, outside: { tileset: a.ts.id, tier: "medium", style: "halftimber" }, mainKind: "shop", named: true, varietyKey: "열쇠0|가게", mapId: undefined, force: { program: "m-shop", shape: 0 } } as never, [])!;
    expect(r.ok, r.summary).toBe(true);
    const P = a.run.ctx.project, m = P.maps[r.mapIds[0]!]!; const rooms = roomsOf(a.run, m.id) as unknown as { x: number; y: number; w: number; h: number }[];
    const inRoom = (x: number, y: number) => rooms.some((q) => x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h);
    const gaps: [number, number][] = [];
    for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) if (!inRoom(x, y) && isPassable(P, m, x, y) && inRoom(x - 1, y) && inRoom(x + 1, y)) gaps.push([x, y]);
    expect(gaps.length).toBeGreaterThan(0);
    for (const [x, y] of gaps) {
      expect(canMove(P, m, x - 1, y, x, y) && canMove(P, m, x, y, x + 1, y), `좌→우 ${x},${y}`).toBe(true);
      expect(canMove(P, m, x + 1, y, x, y) && canMove(P, m, x, y, x - 1, y), `우→좌 ${x},${y}`).toBe(true);
      expect(canMove(P, m, x, y, x, y - 1), `끝머리 ${x},${y - 1}`).toBe(false);
      expect(isPassable(P, m, x, y - 2)).toBe(false);
    }
  }, 60_000);
  it("돌 단·양탄자는 어떤 크기로도 깔린다(한 칸 폭·한 줄 포함)", () => {
    for (const id of ["dais stone", "dais red", "dais blue"]) expect(Object.keys(S.daises[id]!.pieces)).toHaveLength(32);
    const plan = ["#########", ...Array.from({ length: 8 }, () => "#.......#"), "####.####"];
    const L = buildHandInteriorLayers({ plan, floor: "dplank", wall: "plaster", daises: [{ id: "dais red", x: 1, y: 3, w: 7, h: 1 }, { id: "dais stone", x: 2, y: 5, w: 5, h: 3 }, { id: "dais blue", x: 4, y: 4, w: 1, h: 1 }],
      objects: [{ id: "throne", x: 3, y: 6 }] }, createBeodeulCityTileset(), S);
    expect(L.issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("크기 단 짓기", () => {
  it("중형 구성마다 두 평면이 모두 지어진다 — 방 수 그대로, 닿지 못하는 바닥 없음, 딸린 맵은 계단으로 이어진다", () => {
    for (const [id, p] of programs.filter(([, q]) => q.tier === "medium")) for (let s = 0; s < p.shapes.length; s++) {
      const { run, ts } = fresh(); const notes: string[] = [];
      const r = buildTier(run, { type: "interior", name: p.ko } as PlaceSpec, { tilesetId: ts.id, roomSpec: S, outside: { tileset: ts.id, tier: p.tier, style: s ? "log" : "halftimber" }, mainKind: p.serves[0]!, named: true,
        varietyKey: `시험|${id}`, mapId: undefined, force: { program: id, shape: s } }, notes);
      expect(r?.ok, `${id}/${s}: ${notes.join(" / ")}`).toBe(true);
      expect(r!.missingArt, `${id}/${s}`).toEqual([]);
      expect(r!.mapIds).toHaveLength(1 + (p.maps?.length ?? 0));
      expect(roomsOf(run, r!.mapIds[0]!)).toHaveLength(p.shapes[s]!.rooms.length);
      for (const extra of r!.mapIds.slice(1)) expect(JSON.stringify(run.ctx.project.maps[extra]!.events ?? [])).toContain(r!.mapIds[0]!);
    }
  }, 240_000);
  it("같은 구성도 게임 열쇠가 다르면 방 벌이 다르다", () => {
    const sig = (key: string) => {
      const { run, ts } = fresh();
      const r = buildTier(run, { type: "interior", name: "여관" } as PlaceSpec, { tilesetId: ts.id, roomSpec: S, outside: { tileset: ts.id, tier: "medium" }, mainKind: "tavern", named: true, varietyKey: key, mapId: undefined, force: { program: "m-inn", shape: 0 } }, []);
      return run.ctx.project.maps[r!.mapIds[0]!]!.upperTiles.join(",");
    };
    expect(new Set(["갑", "을", "병", "정"].map(sig)).size).toBeGreaterThan(1);
  }, 120_000);
});

describe("대형·초대형 짓기", () => {
  const go = (id: string, s: number) => {
    const p = table.programs[id]!; const { run, ts } = fresh(); const notes: string[] = [];
    const r = buildTier(run, { type: "interior", name: p.ko } as PlaceSpec, { tilesetId: ts.id, roomSpec: S, outside: { tileset: ts.id, tier: p.tier, style: "violetslate" }, mainKind: p.serves[0]!, named: true,
      varietyKey: `시험|${id}`, mapId: undefined, force: { program: id, shape: s } }, notes);
    expect(r?.ok, `${id}/${s}: ${notes.join(" / ")}`).toBe(true); expect(r!.missingArt, `${id}/${s}`).toEqual([]);
    expect(r!.mapIds).toHaveLength(1 + (p.maps?.length ?? 0));
    return { r: r!, run, p };
  };
  it("대형 구성마다 두 평면이 지어지고 딸린 층은 계단으로 오간다", () => {
    for (const [id, p] of programs.filter(([, q]) => q.tier === "large")) for (let s = 0; s < p.shapes.length; s++) {
      const { r, run } = go(id, s);
      expect(roomsOf(run, r.mapIds[0]!)).toHaveLength(p.shapes[s]!.rooms.length);
      for (const extra of r.mapIds.slice(1)) { expect(JSON.stringify(run.ctx.project.maps[extra]!.events ?? [])).toContain(r.mapIds[0]!); expect(JSON.stringify(run.ctx.project.maps[r.mapIds[0]!]!.events ?? [])).toContain(extra); }
    }
  }, 300_000);
  it("초대형 넷: 본채가 44×32칸을 넘고 맵 3장 이상이 본채와 서로 이어진다", () => {
    for (const [id] of programs.filter(([, q]) => q.tier === "xlarge")) {
      const { r, run } = go(id, 0);
      const main = run.ctx.project.maps[r.mapIds[0]!]!;
      expect(main.width, id).toBeGreaterThanOrEqual(44); expect(main.height, id).toBeGreaterThanOrEqual(32);
      expect(r.mapIds.length, id).toBeGreaterThanOrEqual(3);
      for (const extra of r.mapIds.slice(1)) { expect(JSON.stringify(run.ctx.project.maps[extra]!.events ?? [])).toContain(r.mapIds[0]!); expect(JSON.stringify(main.events ?? [])).toContain(extra); }
    }
  }, 300_000);
});

describe("단은 문이 달린 집 킷이 정한다", () => {
  const { run, ts } = fresh();
  const kit = (id: string) => ts.structureKits!.find((k) => k.id === id)!;
  const ask = (kitId: string | undefined, mainKind: string, named: boolean) => {
    const tags = kitId ? kit(kitId).ai?.tags ?? [] : [];
    const tag = (h: string) => tags.find((t) => t.startsWith(h))?.slice(h.length);
    return tierProgramOf(run.ctx.project, { tilesetId: ts.id, outside: kitId ? { tileset: ts.id, kit: kitId, tier: tag("tier:"), cat: tag("cat:") } : { tileset: ts.id }, mainKind, named, varietyKey: "k" })?.id;
  };
  it("킷 태그 interior: 를 방 종류로 읽는다", () => {
    expect(kitInteriorKinds(table, kit("bd-bld-ref-tavern-b").ai!.tags!)).toEqual(["tavern"]);
    expect(kitInteriorKinds(table, kit("bd-bld-ref-plankfarm-a").ai!.tags!)).toEqual(["living", "kitchen", "bedroom"]);
    expect(kitInteriorKinds(table, kit("bd-bld-ref-stall-blue").ai!.tags!)).toEqual([]);
  });
  it("중형 킷 → 중형 구성, 소형 킷·킷 없는 집 → 한 방짜리", () => {
    expect(ask("bd-bld-ref-tavern-b", "living", false)).toBe("m-inn");           // 이름이 방 종류를 못 가리키면 킷의 interior 태그
    expect(ask("bd-bld-ref-plankfarm-a", "general_store", true)).toBe("m-shop"); // 이름이 가리키는 종류가 먼저, 단은 킷의 것
    expect(ask("bd-bld-ref-plankfarm-a", "living", true)).toBe("m-farm");
    expect(ask("bd-bld-ref-rootcellar-a", "cellar", true)).toBeUndefined();      // tier:small
    expect(ask(undefined, "tavern", true)).toBeUndefined();
    expect(tierProgramFor(table, "medium", ["없는 종류"], "k")).toBeUndefined();
  });
  it("문 달린 킷 224개가 모두 단을 갖는다 — 참고 건물은 적힌 태그, 나머지는 킷 자료(문 하나에 딸린 넓이)로 센 것", () => {
    const doorKits = ts.structureKits!.filter((k) => kitEntranceCount(k) > 0);
    expect(doorKits.length).toBeGreaterThanOrEqual(224);
    const count: Record<string, number> = {};
    for (const k of doorKits) {
      const tag = k.ai?.tags?.find((t) => t.startsWith("tier:"))?.slice(5);
      expect(tag, k.id).toBeTruthy();
      if (!k.id.startsWith("bd-bld-ref-")) expect(tag, k.id).toBe(kitTierByFootprint(k));   // 다른 굽기가 킷을 다시 만들었으면 kit-tiers.mts 를 다시 돌린다
      count[tag!] = (count[tag!] ?? 0) + 1;
    }
    // 작은 것이 많고 큰 것이 적다
    expect(count.small!).toBeGreaterThan(count.medium!); expect(count.medium!).toBeGreaterThan(count.large!); expect(count.xlarge!).toBeGreaterThanOrEqual(10);
    // 금: 40 · 72 · 150칸
    const kitOf = (w: number, h: number, doors = 1) => ({ width: w, height: h, parts: Array.from({ length: doors }, () => ({ kind: "entrance" })) }) as never;
    expect([kitTierByFootprint(kitOf(6, 6)), kitTierByFootprint(kitOf(5, 8)), kitTierByFootprint(kitOf(9, 8)), kitTierByFootprint(kitOf(12, 13)), kitTierByFootprint(kitOf(19, 8, 4)), kitTierByFootprint(kitOf(3, 3, 0))])
      .toEqual(["small", "medium", "large", "xlarge", "small", undefined]);
    // 태그 없는 옛 사본의 킷도 같은 단
    const old = { ...kit("bd-house-inn"), ai: { ...kit("bd-house-inn").ai, tags: ["버들항", "house"] } };
    expect(kitTier(old as never)).toBe("medium");
  });
  it("그 단에 그 종류의 구성이 없으면 한 단씩 내려간다 — 한 방짜리로 바로 떨어지지 않는다", () => {
    expect(tierProgramFor(table, "xlarge", ["living"], "k")?.id).toBe("l-manor");
    expect(tierProgramFor(table, "xlarge", ["lighthouse"], "k")?.id).toBe("m-tower");
    expect(tierProgramFor(table, "xlarge", ["chapel"], "k")?.id).toBe("x-cathedral");
    expect(tierProgramFor(table, "large", ["fisher"], "k")?.id).toBe("m-fisher");
    expect(tierProgramFor(table, "small", ["tavern"], "k")).toBeUndefined();
  });
  it("킷 쓰임 표: 이름 붙은 건물은 안의 방 종류를 태그로 갖고, 청한 건물에 맞는 킷을 태그로 찾는다", () => {
    expect(kitInteriorKinds(table, kit("bd-house-cathedral").ai!.tags!)).toEqual(["chapel"]);
    expect(kitInteriorKinds(table, kit("bd-house-mk-town-hall").ai!.tags!)).toEqual(["waiting_room", "study"]);
    for (const id of Object.keys(BEODEUL_KIT_INTERIOR)) expect(ts.structureKits!.some((k) => k.id === id), id).toBe(true);
    const fits = (need: BuildingNeed) => ts.structureKits!.filter((k) => kitEntranceCount(k) > 0 && kitServesBuilding(k, need)).map((k) => k.id);
    const kindOf = (id: string) => WORLDS.find((w) => w.id === "beodeul")!.kinds.find((k) => k.id === id)!;
    expect(fits(kindOf("inn").building!)).toEqual(expect.arrayContaining(["bd-house-inn", "bd-house-mk-inn", "bd-bld-ref-tavern-a", "bd-bld-ref-tavern-b"]));
    expect(fits(kindOf("hall").building!)).toEqual(expect.arrayContaining(["bd-bld-ref-guildhall-a", "bd-house-mk-town-hall", "bd-house-mk-great-hall"]));
    expect(fits(kindOf("church").building!)).toEqual(expect.arrayContaining(["bd-house-cathedral", "bd-house-mk-chapel"]));
    expect(fits(kindOf("castle").building!)).toEqual(["bd-bld-ref-gatehall-a", "bd-bld-ref-keep-a"]);
    expect(fits(kindOf("church").building!)).toContain("bd-bld-ref-cathedral-a");
    // 살림집 킷은 어느 주문에도 맞지 않는다(쓰임이 적히지 않았다)
    for (const need of ["inn", "hall", "church", "castle"].map((id) => kindOf(id).building!)) expect(kitServesBuilding(kit("bd-house-h101_0"), need)).toBe(false);
    // 성 본채 구성은 성읍 갈래 킷에만, 갈래가 다른 초대형 회관은 대형 조합 회관으로
    expect(tierProgramFor(table, "xlarge", ["great_hall"], "k", "castle")?.id).toBe("x-castle");
    expect(tierProgramFor(table, "xlarge", ["great_hall"], "k", "town")?.id).toBe("l-guild");
    expect(tierProgramFor(table, "large", ["study"], "k")?.id).toBe("l-townhall");
  });
  it("이야기가 청한 큰 건물은 마을 바깥에 선다 — 여관·회관·성당·성마다 그 쓰임·단의 킷이 문 목록에 있다", () => {
    const world = WORLDS.find((w) => w.id === "beodeul")!;
    const village = world.kinds.find((k) => k.id === "village")!;
    for (const kind of ["inn", "hall", "church", "castle"]) {
      const need = world.kinds.find((k) => k.id === kind)!.building!;
      const a = fresh();
      const base = worldPlaceSpec(world, village, "시험 마을");
      const r = VILLAGE_BUILDER.build(a.run, { ...base, size: need.tiers.includes("medium") ? "medium" : "large", salt: 11, hints: { ...(base.hints ?? {}), buildingNeeds: [need] } } as unknown as PlaceSpec);
      expect(r.ok, r.summary).toBe(true);
      const doors = ((r.state as { doors?: { kit?: string }[] } | undefined)?.doors ?? []).map((d) => a.ts.structureKits!.find((k) => k.id === d.kit));
      expect(doors.some((k) => !!k && kitServesBuilding(k, need)), `${kind}: ${doors.map((k) => k?.id).join(" ")}`).toBe(true);
    }
  }, 300_000);
  it("같은 명세·같은 salt 로 마을을 스무 번 지으면 스무 번 같은 마을이다 — 청한 건물의 문 자리까지", () => {
    const world = WORLDS.find((w) => w.id === "beodeul")!;
    const base = worldPlaceSpec(world, world.kinds.find((k) => k.id === "village")!, "시험 마을");
    const need = world.kinds.find((k) => k.id === "inn")!.building!;
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const a = fresh();
      const r = VILLAGE_BUILDER.build(a.run, { ...base, size: "medium", salt: 11, hints: { ...(base.hints ?? {}), buildingNeeds: [need] } } as unknown as PlaceSpec);
      expect(r.ok, r.summary).toBe(true);
      const m = a.run.ctx.project.maps[r.mapIds[0]!]!;
      seen.add(JSON.stringify([(r.state as { doors?: unknown }).doors, m.width, m.height, [...m.lowerTiles], [...m.upperTiles]]));
    }
    expect(seen.size).toBe(1);
  }, 900_000);
  it("크기 단 때문에 모델의 배치를 거절하지 않는다 — 방이 모자라도 그대로 깔고, 겉의 단과 그 단의 구성을 받는 법을 적는다", () => {
    const one = { map: { w: 9, h: 8 }, entrance: { x: 4, y: 7 }, landmark: { id: "chest", x: 3, y: 4 }, regions: [{ id: "r", x: 1, y: 1, w: 7, h: 6, floor: "dplank", wall: "plaster" }] };
    // 모델이 고른 큰 문(asked) · 코드가 골라 준 큰 문 · size 를 크게 적은 장소 — 어느 것도 단을 이유로 거절하지 않는다
    for (const extra of [{ exterior: { kit: "bd-bld-ref-tavern-b", asked: true } }, { exterior: { kit: "bd-bld-ref-tavern-b" } }, { size: "large", exterior: { kit: "bd-bld-ref-tavern-b" } }] as const) {
      const a = fresh();
      const spec = { type: "interior", name: "물레방아 여관", mapId: "map_inn", layout: one, ...extra, exterior: { tileset: a.ts.id, ...extra.exterior } } as unknown as PlaceSpec;
      const laid = interiorBuilder.build(a.run, spec);
      expect(laid.ok, laid.summary).toBe(true);
      expect(roomsOf(a.run, laid.mapIds[0]!).length).toBeLessThanOrEqual(1);
      expect(laid.warnings.join(" ")).toMatch(/outside is medium \(bd-bld-ref-tavern-b\) — medium buildings have 2 or more rooms; the inside is laid as you designed it, 1 room/u);
      expect(laid.warnings.join(" ")).toContain("again without layout");
    }
    // 작은 집의 한 방 배치에는 단 이야기가 붙지 않는다
    const b = fresh();
    const small = interiorBuilder.build(b.run, { type: "interior", name: "움집", mapId: "map_inn", layout: one, exterior: { tileset: b.ts.id, kit: "bd-bld-ref-rootcellar-a" } } as unknown as PlaceSpec);
    expect(small.ok, small.summary).toBe(true);
    expect(small.warnings.join(" ")).not.toMatch(/buildings have/u);
  }, 120_000);
  it("실내 빌더: 중형 킷의 문으로 들어가는 여관은 방 넷, 킷을 모르는 여관은 전처럼 한 방", () => {
    const a = fresh();
    const big = interiorBuilder.build(a.run, { type: "interior", name: "물레방아 여관", mapId: "map_inn", exterior: { tileset: a.ts.id, kit: "bd-bld-ref-tavern-b" } } as PlaceSpec);
    expect(big.ok, big.summary).toBe(true);
    expect(roomsOf(a.run, big.mapIds[0]!)).toHaveLength(4);
    expect(a.run.ctx.project.maps[big.mapIds[0]!]!.tilesetId).toBe(a.ts.id);
    const b = fresh();
    const small = interiorBuilder.build(b.run, { type: "interior", name: "물레방아 여관", mapId: "map_inn", exterior: { tileset: b.ts.id } } as PlaceSpec);
    expect(small.ok, small.summary).toBe(true);
    expect(roomsOf(b.run, small.mapIds[0]!)).toHaveLength(1);
  }, 120_000);
  it("다시 지어도 같은 구성·같은 맵이다", () => {
    const a = fresh();
    const spec = { type: "interior", name: "물레방아 여관", mapId: "map_inn", exterior: { tileset: a.ts.id, kit: "bd-bld-ref-tavern-b" } } as PlaceSpec;
    const one = interiorBuilder.build(a.run, spec);
    const two = interiorBuilder.build(a.run, spec, { spec, result: one, rounds: 1 } as never);
    expect(two.ok).toBe(true); expect(two.mapIds).toEqual(one.mapIds);
    expect((two.state as { tier: { program: string; shape: number } }).tier).toEqual((one.state as { tier: { program: string; shape: number } }).tier);
  }, 120_000);
  it("모델이 읽는 실내 목록 카드에 크기 단 전용 견본·구성 이름이 실리지 않는다", () => {
    const a = fresh(); const m = a.run.ctx.project.maps[a.run.ctx.project.startMapId]!; m.tilesetId = a.ts.id; m.upperTiles[0] = 1;
    const card = interiorCatalogCard(a.run.ctx.project, m.id);
    expect(card).not.toMatch(/t_corridor|t_stair|m-inn|corr-a/u);
  });
});

// 2026-11-15 r6 묶음 은행: room_parts 만 v5 표로 답했고, 카드는 빈 갈래에 거절될 예를 달았고, 거절 글은 낱말을 단계로·자리마다 내어 900자에서 잘렸다.
describe("버들항 표로 읽는다 — room_parts · 목록 카드 · 없는 낱말 · 거절 글", () => {
  const ts = createBeodeulCityTileset();
  const ES = effectiveSpec(ts)!;
  const ids = Object.keys(ES.objects);
  const mill = (wall: string, floor: string) => ({ map: { w: 14, h: 12 }, landmark: { id: "barrel stack", x: 1, y: 8 }, outer_wall: { material: wall, path: [[0, 0], [13, 0], [13, 11], [0, 11]] }, entrance: { x: 6, y: 11 },
    rooms: [{ id: "mill", at: [6, 5], floor, purpose: "mill" }], wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }],
    objects: [{ id: "chair N", x: 3, y: 5, repeat: { count: 2, dx: 1, dy: 0 } }, { id: "chair N", x: 3, y: 7 }, { id: "chair N", x: 4, y: 7 }, { id: "piano", x: 9, y: 3 }, { id: "crate", x: 9, y: 6 }, { id: "stool", x: 4, y: 8 }] });

  it("목록 카드는 표에 없는 갈래(크기 탁자 · 사각 깔개)의 줄과 예를 내지 않는다 — v5 카드는 그대로다", () => {
    const card = chipsetCatalog(ts, "inn")!;
    expect(card).not.toMatch(/^sized tables/mu);
    expect(card).not.toMatch(/^carpets \(/mu);
    expect(card).not.toContain("dining 3x2");
    expect(card).toMatch(/^daises \(/mu);
    expect(card).toMatch(/^not in this chipset: sized tables \(ids with WxH\), rect carpets/mu);
    const project = createBlankProject();
    const v5 = chipsetCatalog(project.tilesets[HAND_INTERIOR_TILESET_ID], "inn")!;
    expect(v5).toMatch(/^sized tables \(any WxH in the id, e\.g\. "dining 3x2"/mu);
    expect(v5).toMatch(/^carpets \(any rect, walkable\): \S/mu);
    expect(v5).not.toContain("not in this chipset");
  });

  it("가까운 id 는 표에서 낱말 겹침으로 셈한다(짝 목록 없음) — 가까운 것이 없으면 비어 있다", () => {
    expect(nearIds("chair N", ids)).toEqual(["chair"]);
    expect(nearIds("keg rack", ids)).toContain("ale kegs rack");
    expect(nearIds("broom and bucket", ids)).toEqual(["broom and pail"]);
    expect(nearIds("dining 2x1", ids)).toEqual(["dining table"]);
    expect(nearIds("roundtable", ids)[0]).toBe("round table");
    expect(nearIds("logdark", Object.keys(ES.walls))).toEqual(["log"]);
    for (const none of ["piano", "potted fern", "stove", "hanging pans"]) expect(nearIds(none, ids), none).toEqual([]);
    expect(nearIds("boards", Object.keys(ES.floors))).toEqual([]);
    expect(nearIds("sack", ids)).toContain("grain sack");
    expect(nearIds("fireplace", ids)).toEqual(["great fireplace", "brick fireplace"]);
    expect(nearIds("bar stool", ids)).toEqual(["stool"]);
    expect(nearIds("desk 2x1", ids)).toContain("writing desk");
  });

  it("틀린 권유는 내지 않는다 — 흔한 낱말 하나(wall · board)나 꾸밈말만 겹친 것은 가깝지 않다", () => {
    // wall torch 의 wall 은 꾸밈말이다(횃불 자리에 무기 벽을 권하지 않는다). gear wall 은 갈래 낱말 wall 하나만 겹친다.
    for (const word of ["wall torch", "gear wall", "dart board", "menu board", "water jar", "book pile", "farm tool rack", "ledger stand"]) expect(nearIds(word, ids), word).toEqual([]);
    const check = checkLayout({ ...mill("log", "plank"), objects: [{ id: "wall torch", x: 3, y: 5 }, { id: "gear wall", x: 5, y: 5 }] }, ES, ts);
    expect(check.errors).toHaveLength(1);
    expect(check.errors[0]).toMatch(/no near id in this table[^.]*"wall torch", "gear wall"/iu);
    expect(check.errors[0]).not.toContain("→");
  });

  it("검사(checkLayout)는 없는 벽 · 바닥 · 기물을 한 번에 알리고 같은 낱말은 묶는다 — 바꿔 까는 것은 짓는 쪽(buildFromLayout)이다", () => {
    const check = checkLayout(mill("logdark", "boards"), ES, ts);
    expect(check.errors).toHaveLength(3);
    expect(check.input).toBeUndefined();
    expect(check.errors[0]).toContain('"logdark" (outer_wall) → log');
    expect(check.errors[0]).toContain("plaster, rubble, log, stablew, stone, grey, slumw, hobbitw");
    expect(check.errors[1]).toContain('"boards" (room mill)');
    expect(check.errors[2]).toContain('"chair N" ×4 → chair');
    expect(check.errors[2]).toMatch(/No near id in this table[^"]*"piano"/u);
    expect(check.badObjects.size).toBe(4);
    const text = rejectionText("방앗간", check, {}, 2);
    expect(text.startsWith('Rejected: the interior layout for "방앗간"')).toBe(true);
    expect(text.length).toBeLessThan(900);
    expect(text).not.toContain("You sent");
  });

  it("없는 이름은 가장 가까운 것으로 바꿔 깔고 한 줄씩 알린다 — 가까운 것이 없는 낱말만 거절하고, 고치기를 다 쓰면 그것도 빼고 깐다", () => {
    const { run } = fresh();
    const layout = { ...mill("logdark", "plank"), objects: [{ id: "chair N", x: 3, y: 5, repeat: { count: 2, dx: 1, dy: 0 } }, { id: "bar stool", x: 9, y: 7 }, { id: "crate", x: 9, y: 9 }] };
    const built = buildFromLayout(run, { type: "interior", name: "방앗간", layout, hints: { newMap: true } } as unknown as PlaceSpec, ES, ts.id, undefined);
    expect(built.ok, built.summary).toBe(true);
    expect(built.summary).toContain("3 ids swapped");
    expect(built.warnings).toContain('swapped wall "logdark" → "log" (not in this chipset\'s table — its nearest id)');
    expect(built.warnings).toContain('swapped piece "chair N" ×2 → "chair" (not in this chipset\'s table — its nearest id)');
    expect(built.warnings).toContain('swapped piece "bar stool" → "stool" (not in this chipset\'s table — its nearest id)');
    // 가까운 것이 없는 낱말(piano): 거절하지 않는다 — 그 조각만 빼고 깔고 무엇을 뺐는지와 빈 바닥 비율을 적는다(2026-11-17 r8: «table:fish+fishr» 하나로 고침 전체가 거절됐다)
    const { run: run2 } = fresh();
    const none = { type: "interior", name: "방앗간", layout: mill("log", "plank"), hints: { newMap: true } } as unknown as PlaceSpec;
    const no = buildFromLayout(run2, none, ES, ts.id, undefined);
    expect(no.ok, no.summary).toBe(true);
    expect(no.summary).toMatch(/laid 7 of your 8 pieces — left out \(each with its reason in warnings\): "piano"; bare floor \d+%/u);
    // «바탕:변형» 이름은 바탕 낱말로 바꿔 깐다 — r8 어물전의 «table:fish+fishr»
    const { run: run3 } = fresh();
    const fish = buildFromLayout(run3, { ...none, layout: { ...mill("log", "plank"), objects: [{ id: "table:fish+fishr", x: 3, y: 7 }, { id: "crate", x: 9, y: 9 }] } } as unknown as PlaceSpec, ES, ts.id, undefined);
    expect(fish.ok, fish.summary).toBe(true);
    expect(fish.warnings.find((w) => w.startsWith('swapped piece "table:fish+fishr" → '))).toMatch(/→ "[^"]*table"/u);
  });

  it("거절은 게임이 깨질 때만 — 기물 하나의 문제(겹침 · 바닥 아닌 칸)는 그 기물만 빼고 깔고 까닭을 적는다, 닫히지 않은 벽은 거절한다", () => {
    const { run } = fresh();
    const layout = { ...mill("log", "plank"), objects: [{ id: "crate", x: 9, y: 9 }, { id: "barrel", x: 9, y: 9 }, { id: "stool", x: 0, y: 0 }, { id: "chest", x: 4, y: 8 }] };
    const built = buildFromLayout(run, { type: "interior", name: "방앗간", layout, hints: { newMap: true } } as unknown as PlaceSpec, ES, ts.id, undefined);
    expect(built.ok, built.summary).toBe(true);
    expect(built.summary).toMatch(/laid 3 of your 6 pieces — left out/u);
    expect(built.warnings.some((w) => w.startsWith("left out — two pieces overlap on this cell"))).toBe(true);
    expect(built.warnings.some((w) => w.startsWith("left out — ") && w.includes('"stool"@(0,0)'))).toBe(true);
    const { run: run2 } = fresh();
    const open = { ...mill("log", "plank"), objects: [], outer_wall: { material: "log", path: [[0, 0], [13, 0], [13, 11]] } };
    expect(buildFromLayout(run2, { type: "interior", name: "방앗간", layout: open, hints: { newMap: true } } as unknown as PlaceSpec, ES, ts.id, undefined).ok).toBe(false);
  });

  it("버들항 게임에서는 v5 조각 이름으로 쓴 방도 버들항 표로 깔고 바꾼 것을 한 줄씩 알린다 — 버들항 낱말로 쓴 방은 그대로", () => {
    const town = () => { const f = fresh(); const m = f.run.ctx.project.maps[f.run.ctx.project.startMapId]!; m.tilesetId = f.ts.id; m.upperTiles[0] = 1; return f; };
    const v5 = { map: { w: 12, h: 10 }, landmark: { id: "counter 4x1", x: 3, y: 5 }, outer_wall: { material: "logdark", path: [[0, 0], [11, 0], [11, 9], [0, 9]] }, entrance: { x: 5, y: 9 },
      rooms: [{ id: "hall", at: [5, 7], floor: "boards", purpose: "tavern" }], wall_items: [{ id: "keg rack", wall: "outer", x: 1, y: 3 }],
      objects: [{ id: "roundtable", x: 2, y: 7 }, { id: "chair E", x: 1, y: 7 }, { id: "bar stool", x: 6, y: 7 }, { id: "barrel", x: 9, y: 7 }] };
    const a = town();
    const laid = interiorBuilder.build(a.run, { type: "interior", name: "선술집", layout: v5, hints: { newMap: true } } as unknown as PlaceSpec);
    expect(laid.ok, laid.summary).toBe(true);
    expect(a.run.ctx.project.maps[laid.mapIds[0]!]!.tilesetId).toBe(a.ts.id);
    expect(laid.warnings.join(" ")).toContain(`laid with this game's interior chipset ${a.ts.id}`);
    expect(laid.warnings).toContain('swapped piece "bar stool" → "stool" (not in this chipset\'s table — its nearest id)');
    const b = town();
    const own = { ...mill("log", "plank"), wall_items: [{ id: "ale kegs rack", wall: "outer", x: 8, y: 3 }], objects: [{ id: "bar counter", x: 3, y: 6 }, { id: "stool", x: 4, y: 8 }, { id: "crate", x: 9, y: 9 }] };
    const home = interiorBuilder.build(b.run, { type: "interior", name: "방앗간", layout: own, hints: { newMap: true } } as unknown as PlaceSpec);
    expect(home.ok, home.summary).toBe(true);
    expect(b.run.ctx.project.maps[home.mapIds[0]!]!.tilesetId).toBe(b.ts.id);
  });

  it("room_parts 는 장소가 지어질 표로 답한다 — v5 낱말(logdark · boards)이 섞이지 않는다", () => {
    const parts = tableParts(ts, ES, "선술집 tavern");
    const text = JSON.stringify(parts);
    expect(parts.tileset).toBe(ts.id);
    expect(parts.floors).toEqual(Object.keys(ES.floors));
    expect(parts.walls).toEqual(Object.keys(ES.walls));
    expect(text).not.toContain("logdark");
    expect(text).not.toContain("boards");
    expect(text).toContain("ale kegs rack");
    for (const line of parts.items as string[]) expect(ES.objects[line.split(" | ")[0]!], line).toBeTruthy();
    expect(String(parts.how)).toContain("spec.layout");
  });
});

// 2026-11-16 r6 실모델(포구 마을 «갈매나루»): find_pieces 가 없는 갈래에 287개 전부를 답했고, 거절 글 한 건이 900자에서 끊겼다.
describe("r6 실모델에서 본 것 — find_pieces 의 없는 갈래 · 잘리지 않는 거절 글 · 문 목록의 건물 이름", () => {
  const ts = createBeodeulCityTileset();
  const ES = effectiveSpec(ts)!;

  it("find_pieces: 표에 없는 갈래는 전부를 돌려주지 않고 갈래 목록 · 가까운 갈래 · 그 낱말이 든 기물만 낸다", () => {
    const all = Object.keys(ES.objects).length;
    const r = findPieces(ES, "fish");
    expect(r.unknownCategory?.asked).toBe("fish");
    expect(r.unknownCategory?.near).toContain("fisher");
    expect(r.total).toBeLessThan(all / 4);
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.categories.some((c) => c.startsWith("fisher ("))).toBe(true);
    // 아무것도 안 걸리는 갈래 낱말: 기물 0개 + 갈래 목록
    const none = findPieces(ES, "spaceship");
    expect(none.lines).toEqual([]); expect(none.total).toBe(0); expect(none.categories.length).toBeGreaterThan(5);
    // 있는 갈래와 빈 갈래는 전과 같다
    expect(findPieces(ES, "fisher").unknownCategory).toBeUndefined();
    expect(findPieces(ES, "").total).toBe(all);
  });

  it("칸 배치 거절 글은 동사 거절 틀에서 잘리지 않는다 — 넘치면 만드는 쪽이 줄인다(가까운 id 는 그대로, 가까운 것 없는 낱말과 뒤 문제는 개수로)", () => {
    const problems = ['pieces not in this chipset\'s table (→ its nearest ids): "altar E" → altar; "baptismal font" → font; "holy water font" → font; "desk 3x2" → writing desk / clerk desk; "chair S" → chair; "bench 2" → bench / workbench; "tall stained window" ×4 → stained window; "pipe organ" → organ. No near id in this table (leave out, or pick another piece from the card): "candelabra" ×3, "column marble" ×3, "votive stand", "potted fern", "reredos", "choir stall", "bookshelf 3w".',
      'floors not in this chipset\'s table: "marble" (room nave). The table\'s floors: dplank, plank, flag, ovenf, earth, parquet, grey.',
      '"stairs down" at (19,5) is a wall piece — move it to "wall_items" with the "wall" it belongs to.',
      'carpet "rug red": this chipset has no rect carpets — drop "carpets" and place a rug piece in "objects" (red rug).'];
    const check = { errors: problems, warnings: [], badObjects: new Set<number>(), objects: [] };
    const text = rejectionText("대성당", check, {}, 2);
    expect(text.length).toBeGreaterThan(900);   // r6 에서 끊긴 길이
    const read = formatV2VerbFailure("make_place", { name: "대성당" }, JSON.stringify({ ok: false, summary: text }));
    expect(read).toContain('move it to "wall_items" with the "wall" it belongs to.');
    expect(read).toContain("(red rug).");
    // 상한을 넘는 거절: 가까운 id 줄은 남고, 가까운 것 없는 낱말은 앞 셋 + 개수, 뒤 문제는 개수로 — 문장 가운데서 끊기지 않는다
    const many = [problems[0]!, ...Array.from({ length: 40 }, (_, i) => `"bench" at (${i},${i + 3}) stands on a wall-face row — floor pieces go on floor cells (row y >= wall row + 3).`.replace("bench", `bench ${i}`))];
    const long = rejectionText("대성당", { ...check, errors: many }, {}, 2);
    expect(long.length).toBeLessThanOrEqual(LAYOUT_REJECTION_MAX);
    expect(long).toContain('"altar E" → altar');
    expect(long).toMatch(/"candelabra" ×3, "column marble" ×3, "votive stand" and 4 more\./u);
    expect(long).toMatch(/- and \d+ more problems not shown here — fix the ones above and send again to get the rest\.$/u);
    expect(formatV2VerbFailure("make_place", { name: "대성당" }, JSON.stringify({ ok: false, summary: long }))).toContain("send again to get the rest.");
  });

  it("문 목록에 싣는 건물 이름은 킷 이름에서 칩셋 머리와 크기 꼬리를 뗀 것이다", () => {
    const kit = (id: string) => ts.structureKits!.find((k) => k.id === id);
    expect(kitLabel(kit("bd-house-cathedral"))).toBe("첨탑 성당");
    expect(kitLabel(kit("bd-house-rv-r2-06"))).toBe("회벽 화물 창고");
    expect(kitLabel(kit("bd-house-h111_1"))).toBe("생선 가게 가게집");
    expect(kitLabel(kit("bd-bld-ref-cathedral-a"))).toBe("마을 대성당");
  });
});
