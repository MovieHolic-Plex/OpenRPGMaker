// 한국 도시 지구 구성기(modernCityKoreanDistrict) — 지구 종류 여덟, 길 위계, 벽을 맞댄 건물 줄, 필지 쓰임, 종류 고르기.
// 도쿄풍 길(district 없이 부른 compose_modern_city_street)은 이 구성기를 타지 않는다.
import { describe, expect, it } from "vitest";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { MODERN_KR_BUILDER } from "@/ai/v2/place/builders/modernCity";
import { Board } from "@/project/modernCityBoard";
import { koreanGround } from "@/project/modernCityKoreanGround";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { MODERN_CITY_ID, createModernCityTileset } from "@/project/defaults/modernCity";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import { carLaneCells, walkerRoute } from "@/editor/tools/streetWalkersTool";
import { roomPrograms } from "@/editor/handInterior/templates";
import { KR_DISTRICT_KINDS, districtKindByName, pickDistrictKind } from "@/project/modernCityDistrictKinds";
import { composeModernCityStreet, modernCityPaletteFromTileset } from "@/project/modernCityStreetComposer";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";

const W = 60, H = 48;
const ts = createModernCityTileset();
const pal = modernCityPaletteFromTileset(ts);
const group = (id: string) => new Set(ts.tileGroups!.find((g) => g.id === id)?.tileIds ?? []);
const roadTiles = new Set<number>();
ts.tileMeta!.forEach((m, t) => { const tags = (m as { tags?: string[] } | undefined)?.tags ?? []; if (tags.includes("road") && !tags.includes("walk")) roadTiles.add(t); });
const lawnTiles = new Set([...group("mc:lawn"), ...[...group("mc:green")].slice(0, 3)]);

describe("Korean district materials and saved streets", () => {
  it("uses the complete unshaded paving pattern outdoors", () => {
    const board = new Board(8, 8, pal);
    const ground = koreanGround(board, pal);
    for (const [paint, id, period] of [
      [ground.alley, "mc:interior-floor-mci-concrete", 4],
      [ground.yard, "mc:interior-floor-mci-tile-concourse", 2],
    ] as const) {
      const ids = pal.group(id);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        paint(x, y);
        expect(board.lower[board.k(x, y)]).toBe(ids[((y % period) * period + x % period) * 4]);
      }
    }
  });

  it("uses plain parking pavement without adding a car lane or blocking the aisle", () => {
    const { res, project, map } = street(fresh(), "parking", { seed: 7, district: "apt-complex", shops: ["아파트"] });
    expect(res.ok, res.summary).toBe(true);
    const plainParking = pal.kit("mc-parking-two-bays")!.rows[3]!.tiles[0]!;
    const from = { x: 2, y: 18 }, to = { x: 7, y: 18 };
    const parking = map.lowerTiles.flatMap((tile, i) => tile === plainParking ? [i] : []);
    expect(parking).toContain(from.y * map.width + from.x);
    expect(parking).toContain(to.y * map.width + to.x);
    const lanes = carLaneCells(project, map);
    expect(lanes.size).toBeGreaterThan(0);
    expect(parking.every((i) => !lanes.has(i))).toBe(true);
    expect(walkerRoute(project, map, [from, to], 560, lanes)).not.toBeNull();
    expect(map.lowerTiles[15 * map.width + 2]).toBe(plainParking);
    expect(isPassable(project, map, 2, 15)).toBe(false);
  });

  it("uses a named district for a new place and preserves a pre-district street on rebuild", () => {
    const project = createBlankProject();
    const run = () => createBuildRun({ project, currentMapId: project.startMapId });
    const spec = { type: "street" as const, name: "오래된 해솔 아파트 단지", style: "kr-modern", hints: { seed: 3 } };
    const built = MODERN_KR_BUILDER.build(run(), spec);
    expect(built.ok, built.summary).toBe(true);
    expect(built.state).toMatchObject({ district: "apt-complex" });
    const legacy = { builder: MODERN_KR_BUILDER.id, spec, rounds: 1, result: { ...built, state: { seed: 3 } } };
    const rebuilt = MODERN_KR_BUILDER.build(run(), spec, legacy);
    expect(rebuilt.ok, rebuilt.summary).toBe(true);
    expect(rebuilt.calls.find(c => c.tool === "compose_modern_city_street")!.args).not.toHaveProperty("district");
    expect(rebuilt.state).toEqual({ seed: 3 });
  });
});

/**
 * 빈 보도 맵을 하나 넣고 도구로 거리를 짓는다. 실행기는 넘겨받은 project 를 고치지 않고 ctx.project 를 지은 것으로 바꾼다 —
 * 그래서 지은 뒤의 프로젝트·맵은 돌려받은 것으로 읽는다(넘긴 project 의 맵은 빈 보도 그대로다).
 * 지은 맵에 위층 칸이 하나도 없으면 여기서 떨어진다: 뒤 단언들이 빈 맵을 재는 일이 없게.
 */
function street(project: Project, id: string, args: Record<string, unknown>) {
  const walk = [...group("mc:sidewalk")][0]!;
  const blank = { id, name: id, width: W, height: H, tilesetId: MODERN_CITY_ID, tileSize: 16, lowerTiles: new Array(W * H).fill(walk), upperTiles: new Array(W * H).fill(-1), events: [] } as never;
  const ctx: ToolContext = { project: { ...project, maps: { ...project.maps, [id]: blank } }, currentMapId: id, assistantRun: true };
  const res = runTool(ctx, "compose_modern_city_street", { mapId: id, ...args });
  const map = ctx.project.maps[id]!;
  if (res.ok) expect(map.upperTiles.some((t) => t >= 0), `${id}: 지은 맵을 읽어야 한다`).toBe(true);
  return { res, project: ctx.project, map };
}
/** from 에서 엔진 통행(isPassable)으로 네 방향을 이어 닿는 칸. blocked 의 칸은 걷지 않는다. */
function flood(project: Project, map: Project["maps"][string], from: { x: number; y: number }, blocked: ReadonlySet<number> = new Set()): Uint8Array {
  const seen = new Uint8Array(W * H); const q = [from.y * W + from.x]; seen[q[0]!] = 1;
  while (q.length) { const i = q.pop()!, x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (!seen[j] && !blocked.has(j) && isPassable(project, map, X, Y)) { seen[j] = 1; q.push(j); } } }
  return seen;
}
function fresh(): Project { return createBlankProject() as Project; }

describe("한국 도시 지구 구성기", () => {
  it("지구 종류는 여덟 이상이고 이름·한국어 이름으로 찾는다", () => {
    expect(KR_DISTRICT_KINDS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(KR_DISTRICT_KINDS.map((k) => k.id)).size).toBe(KR_DISTRICT_KINDS.length);
    expect(districtKindByName("상가 골목")?.id).toBe("sangga-alley");
    expect(districtKindByName("villa-town")?.ko).toBe("빌라촌");
    expect(districtKindByName("없는 지구")).toBeUndefined();
  });

  it.each(KR_DISTRICT_KINDS.map((k) => k.id))("%s: 60×48 에서 건물 20채 이상 · 차도 22%% 이하 · 잔디 6%% 이하 · 대로는 많아야 하나 · 모든 문에 닿는다", (kind) => {
    for (const seed of [1, 2, 3]) {
      const r = composeModernCityStreet({ width: W, height: H, seed, district: { korean: true, kind } }, pal);
      expect(r.district?.id).toBe(kind);
      expect(r.buildings.length).toBeGreaterThanOrEqual(20);
      const road = r.lower.filter((t) => roadTiles.has(t)).length / (W * H), lawn = r.lower.filter((t) => lawnTiles.has(t)).length / (W * H);
      expect(road).toBeLessThanOrEqual(0.22);
      expect(lawn).toBeLessThanOrEqual(0.06);
      // 대로 = 두 방향 길(동쪽행·서쪽행 노선이 같이 있는 띠). 많아야 하나.
      const twoWay = new Set(r.transit.routes.filter((x) => /^traffic-ew\d+-left$/.test(x.id)).map((x) => x.id));
      expect(twoWay.size).toBeLessThanOrEqual(1);
      // 건물마다 실내 구성(program)이 있고 실내 빌더가 받는다
      const programs = roomPrograms(MODERN_CITY_ID);
      const maps = new Set(Object.values(programs).flatMap((list) => list.map((p) => p.map)));
      for (const b of r.buildings) expect(b.program && (programs[b.program] || maps.has(b.program)), `${b.kit} program ${b.program}`).toBeTruthy();
      // 한 줄(같은 문 줄)에 같은 키트가 없다
      expect(new Set(r.buildings.map((b) => b.kit)).size).toBe(r.buildings.length);
    }
  });

  it("도구로 지으면 엔진 통행으로 시작 칸에서 모든 문 접근칸에 닿고, 결과가 지구 종류를 말한다", () => {
    let project = fresh();
    for (const kind of KR_DISTRICT_KINDS) {
      const id = `m-${kind.id}`;
      const built = street(project, id, { seed: 4, district: kind.id });
      const res = built.res, map = built.map; project = built.project;
      expect(res.ok, `${kind.id}: ${res.summary}`).toBe(true);
      expect(res.summary).toContain(`district ${kind.id}`);
      const data = res.data as { start: { x: number; y: number }; district: { id: string }; buildings: { doors: { x: number; y: number }[]; access: { x: number; y: number }[] }[] };
      expect(data.district.id).toBe(kind.id);
      expect(data.buildings.length, kind.id).toBeGreaterThanOrEqual(20);
      // 문 칸은 건물 벽(막힘 — 들어가는 일은 접근칸의 이벤트가 한다), 접근칸은 걸을 수 있는 칸이다.
      // 시작 칸은 걸을 수 있고, 거기서 걸어서 모든 건물의 모든 접근칸에 닿는다.
      expect(isPassable(project, map, data.start.x, data.start.y), `${kind.id} 시작 칸`).toBe(true);
      const seen = flood(project, map, data.start);
      for (const b of data.buildings) {
        expect(b.doors.length && b.access.length, kind.id).toBeTruthy();
        for (const d of b.doors) expect(isPassable(project, map, d.x, d.y), `${kind.id} 문 (${d.x},${d.y})`).toBe(false);
        for (const a of b.access) expect(seen[a.y * W + a.x], `${kind.id} 접근칸 (${a.x},${a.y})`).toBe(1);
      }
    }
    }, 60_000); // 도구를 여덟 번 부른다(한 번에 1초 안팎)

  it.each(KR_DISTRICT_KINDS.map((k) => k.id))("%s: 행인은 보도·골목·횡단보도만 걸어 모든 문 사이를 오간다(차선으로 갈린 섬이 없다)", (kind) => {
    for (const seed of [1, 2, 3]) {
      const { res, project, map } = street(fresh(), "s", { seed, district: kind });
      expect(res.ok, res.summary).toBe(true);
      const lanes = carLaneCells(project, map);
      expect(lanes.size, `${kind} s${seed} 차선 칸`).toBeGreaterThan(0);
      const doors = (res.data as { buildings: { access: { x: number; y: number }[] }[] }).buildings.map((d) => d.access[0]!);
      // 걸을 수 있고 차선이 아닌 칸을 네 방향으로 이은 덩이 — 문 접근칸이 모두 첫 문과 같은 덩이에 있어야 한다.
      const seen = flood(project, map, doors[0]!, lanes);
      for (const d of doors) expect(seen[d.y * W + d.x], `${kind} s${seed} 문 (${d.x},${d.y})`).toBe(1);
      // 행인 도구의 길 찾기로도 이어진다(첫 문 → 마지막 문).
      expect(walkerRoute(project, map, [doors[0]!, doors[doors.length - 1]!], 560, lanes), `${kind} s${seed}`).not.toBeNull();
    }
  });

  it("한 게임의 거리 세 장은 세 종류다(auto) — 열쇠가 같으면 같은 순서, 다르면 다른 순서", () => {
    const facts = { width: W, height: H, shops: 2 };
    const firsts = new Set<string>();
    for (const key of ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"]) {
      const used: string[] = [];
      for (let n = 0; n < 3; n++) used.push(pickDistrictKind(key, n, facts, undefined, used).id);
      expect(new Set(used).size).toBe(3);
      expect(pickDistrictKind(key, 9, facts).id).toBe(used[0]);
      firsts.add(used[0]!);
    }
    expect(firsts.size).toBeGreaterThanOrEqual(4);
    // 이름을 주면 그 종류
    expect(pickDistrictKind("alpha", 0, facts, "재래시장").id).toBe("market");
    // 도구: 같은 프로젝트의 둘째·셋째 거리는 앞에서 쓴 종류를 피한다 — 앞 거리가 맵에 남긴 표(kr-district:<종류>)를 읽어서.
    // 씨를 셋 다 같게 준다: 씨가 달라서 우연히 갈리는 것이 아니라 앞 맵의 표 때문에 갈려야 한다.
    let project = fresh(); const seen: string[] = [];
    for (const n of [1, 2, 3]) {
      const built = street(project, `auto-${n}`, { seed: 7, district: "auto" }); project = built.project;
      expect(built.res.ok, built.res.summary).toBe(true);
      const id = (built.res.data as { district: { id: string } }).district.id; seen.push(id);
      expect((built.map.locations ?? []).some((l) => (l.tags ?? []).includes(`kr-district:${id}`)), `auto-${n} 표`).toBe(true);
    }
    expect(new Set(seen).size).toBe(3);
    // 표가 없는 새 프로젝트에서 같은 씨로 지으면 첫 거리와 같은 종류다(위에서 갈린 것은 표 덕이다).
    expect((street(fresh(), "auto-again", { seed: 7, district: "auto" }).res.data as { district: { id: string } }).district.id).toBe(seen[0]);
  });

  it("district 없이 부르면 옛 도쿄풍 길 그대로다(결과에 지구 종류가 없다)", () => {
    const r = composeModernCityStreet({ width: W, height: H, seed: 1, district: { korean: true } }, pal);
    expect(r.district).toBeUndefined();
    expect(r.roads.horizontal.length).toBeGreaterThanOrEqual(2);
  });

  it("바란 가게는 한국 지구에도 선다", () => {
    for (const kind of ["sangga-alley", "villa-town", "market"]) {
      const r = composeModernCityStreet({ width: W, height: H, seed: 2, shops: ["conv", "cafe", "bank", "hospital"], district: { korean: true, kind } }, pal);
      const kinds = r.buildings.map((b) => b.kind);
      for (const want of ["conv", "cafe", "bank", "hospital"]) expect(kinds.some((k) => k === want || k.startsWith(`kr-${want}`) || (want === "hospital" && k === "kr-clinic")), `${kind}: ${want} in ${kinds.join(",")}`).toBe(true);
    }
  });

  it("랜드마크와 지하철 출구 수를 주면 그 건물이 buildings[0] 이고 출구가 번호대로 선다", () => {
    for (const kind of ["blvd-office", "station-front", "sangga-alley"]) {
      const r = composeModernCityStreet({ width: W, height: H, seed: 5, shops: ["conv", "cafe"], district: { korean: true, kind, landmark: "tower10", subwayExits: 2 } }, pal);
      expect(r.buildings[0]?.kind).toBe("tower10");
      expect(r.subwayExits.map((e) => e.n)).toEqual([1, 2]);
    }
  });

  // 한국 건물(mc-bld-kr-*)과 한국 거리 기물·바닥 그림(mc-prop-kr-<목록>)은 뒤 PR 들이 굽는다 — 그 키트가 없는 시트에서는 지금 있는 것으로 물러선다.
  it("아직 굽지 않은 키트는 건너뛴다: 지금 시트로 지은 맵의 건물·기물·바닥 칸은 모두 시트에 있는 것이다", () => {
    const ids = new Set(ts.structureKits!.map((k) => k.id));
    for (const kind of KR_DISTRICT_KINDS) for (const seed of [1, 2]) {
      const r = composeModernCityStreet({ width: W, height: H, seed, district: { korean: true, kind: kind.id } }, pal);
      for (const d of r.buildings) expect(ids.has(d.kit), `${kind.id} s${seed} 건물 ${d.kit}`).toBe(true);
      for (const p of r.props) expect(ids.has(p.kit), `${kind.id} s${seed} 기물 ${p.kit}`).toBe(true);
      for (const t of [...r.lower, ...r.upper, ...r.upper2]) expect(t < ts.count, `${kind.id} s${seed} 칸 ${t}`).toBe(true);
      expect(r.lower.every((t) => t >= 0)).toBe(true);
    }
  });
  it("소품·차·표지 키트가 하나도 없는 시트에서도 여덟 종류가 선다(건물 키트와 땅 칸만으로)", () => {
    const bare = createModernCityTileset();
    (bare as { structureKits: unknown[] }).structureKits = bare.structureKits!.filter((k) => k.id.startsWith("mc-bld-"));
    const barePal = modernCityPaletteFromTileset(bare);
    for (const kind of KR_DISTRICT_KINDS) for (const seed of [1, 2, 3]) {
      const r = composeModernCityStreet({ width: W, height: H, seed, district: { korean: true, kind: kind.id } }, barePal);
      expect(r.buildings.length, `${kind.id} s${seed}`).toBeGreaterThanOrEqual(18);
      expect(r.props.every((p) => p.kit.startsWith("mc-bld-")), `${kind.id} s${seed}`).toBe(true);
    }
  });

  // 한국 건물 키트(mc-bld-kr-*)는 다른 일꾼이 굽는다 — 여기서는 있는 키트를 그 이름·태그로 베껴 급·제자리·옥상 규칙만 잰다.
  describe("한국 건물 키트가 시트에 있을 때", () => {
    const ts2 = createModernCityTileset();
    const kits = ts2.structureKits as unknown as { id: string; name: string; width: number; height: number; ai?: Record<string, unknown> }[];
    const first = (type: string) => kits.find((k) => new RegExp(`^mc-bld-${type}-[A-C]`).test(k.id))!;
    // tags 는 준 그대로 붙인다(나라 표시를 여기서 덧붙이지 않는다) — 다른 나라 키트의 대역이 country:kr 을 달면 안 된다.
    const clone = (from: { id: string }, id: string, tags: string[], extra: Record<string, unknown> = {}) => { const k = kits.find((x) => x.id === from.id)!; kits.push({ ...k, id, name: id, ai: { ...(k.ai ?? {}), tags, ...extra } }); };
    for (const [type, kr, tier, prog] of [["conv", "conv", "small", "mc_konbini"], ["low3", "sangga3", "medium", "mc_restaurant"], ["dept", "dept", "xlarge", "mc_clothing"], ["school", "ktx", "xlarge", "mc_school_building"], ["office-wide", "univ", "xlarge", "mc_school_building"], ["tower10", "tower", "landmark", "mc_office"]] as const)
      clone(first(type), `mc-bld-kr-${kr}`, ["country:kr", `tier:${tier}`, `program:${prog}`]);
    const bakery = first("bakery");
    clone(bakery, "mc-bld-kr-laundry", ["country:kr", "tier:small", "program:mc_bakery_cafe", "roof:empty"], { roofFace: { dx: 0, dy: 1, w: bakery.width, h: 1, empty: true } });
    clone(kits.find((k) => k.id === "mc-prop-planter-a")!, "mc-roof-kr-garden", ["country:kr"]);
    // 다른 나라 키트의 대역: 한국 키트와 같은 급·같은 실내 구성인데 나라만 서양이다 — 나라 표시 하나로 걸러져야 한다.
    clone(first("shop"), "mc-bld-shop-A-west", ["country:west", "tier:small", "program:mc_konbini"]);
    const pal2 = modernCityPaletteFromTileset(ts2);
    const BIG = new Set(["kr-dept", "kr-ktx", "kr-univ", "kr-tower"]);

    it.each(KR_DISTRICT_KINDS.map((k) => k.id))("%s: 초대형·랜드마크는 한 맵에 많아야 하나, 다른 나라 키트는 서지 않는다", (kind) => {
      for (const seed of [1, 2, 3]) {
        const r = composeModernCityStreet({ width: W, height: H, seed, district: { korean: true, kind } }, pal2);
        expect(r.buildings.filter((d) => BIG.has(d.kind)).length, `${kind} s${seed}`).toBeLessThanOrEqual(1);
        expect(r.buildings.some((d) => d.kit.startsWith("mc-bld-kr-")), `${kind} s${seed}`).toBe(true);
        expect(r.buildings.some((d) => d.kit === "mc-bld-shop-A-west"), `${kind} s${seed} 건물`).toBe(false);
        expect(r.props.some((p) => p.kit === "mc-bld-shop-A-west"), `${kind} s${seed} 풍경`).toBe(false);
      }
    });
    it("역 앞에는 역사가, 대학가에는 대학 본관이 제자리에 선다", () => {
      for (const seed of [1, 2, 3]) {
        expect(composeModernCityStreet({ width: W, height: H, seed, district: { korean: true, kind: "station-front" } }, pal2).buildings.some((d) => d.kind === "kr-ktx")).toBe(true);
        expect(composeModernCityStreet({ width: W, height: H, seed, district: { korean: true, kind: "campus-town" } }, pal2).buildings.some((d) => d.kind === "kr-univ")).toBe(true);
      }
    });
    it("옥상 기물은 빈 지붕 면 안에만 얹힌다", () => {
      let roofs = 0;
      for (const kind of ["sangga-alley", "villa-town", "market"]) for (const seed of [1, 2, 3]) {
        const r = composeModernCityStreet({ width: W, height: H, seed, district: { korean: true, kind } }, pal2);
        const face = r.buildings.filter((d) => d.kit === "mc-bld-kr-laundry").map((d) => ({ x0: d.rect.x, x1: d.rect.x + d.rect.w - 1, y: d.rect.y + 1 }));
        for (const p of r.props.filter((q) => q.kit.startsWith("mc-roof-kr-"))) { roofs++; expect(face.some((f) => p.y === f.y && p.x >= f.x0 && p.x <= f.x1), `${kind} s${seed} (${p.x},${p.y})`).toBe(true); }
      }
      expect(roofs).toBeGreaterThan(0);
    });
  });
});
