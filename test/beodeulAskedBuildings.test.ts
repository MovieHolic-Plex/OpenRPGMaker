// 요청 건물(「광장 곁 대성당」) — 마을 시공기가 청한 건물을 모이는 곳 가장자리에 세우고, 손으로 찍는 건물은 어긋난 터를 거절하지 않고 고쳐 놓는다.
// 왜(2026-11-16 실모델 확인 빌드 r6 «갈매나루»): 요청은 «광장 곁 대성당» 이었는데 make_place 에는 건물을 청할 길이 없었다. 모델은 성당 킷을 손으로 찍다
// 네 번 거절당하고 윗단 숲 위에 세웠다 — 문 앞은 벼랑 아래, 지붕 위에 숲 머리 세 그루. 오너 방향: 있는 에셋이면 깔고, 어긋나면 고쳐 놓고 알리고, 거절은 게임이 깨질 때만.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { reliefAllowsStep } from "@/project/relief/walk";
import type { GameMap, Project, StructureKitDef } from "@/project/types";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import { askedBuildingKits, askedBuildingMenu, isSeatableBuilding, nearestBuildingKits } from "@/editor/tools/beodeulAskedBuildings";
import { buildingSiteReasons, isBuildingKit } from "@/editor/tools/buildingSite";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { SHARED_OBJECT_TOOLS } from "@/editor/tools/sharedObjectTools";
import { nearestVillageKind } from "@/editor/tools/beodeulVillageKinds";
import { builderFor } from "@/ai/v2/place/builders";
import { askedVillageBuildings, VILLAGE_CARD } from "@/ai/v2/place/builders/village";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { preCheck } from "@/ai/v2/loop/argGuard";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";

const kitsOf = (project: Project): StructureKitDef[] => project.tilesets.beodeul_city!.structureKits ?? [];
const ids = (kits: readonly StructureKitDef[]): string[] => kits.map((kit) => kit.id);
const stamp = SHARED_OBJECT_TOOLS.find((tool) => tool.name === "stamp_object")!;
const CATHEDRAL = "kit:beodeul_city/bd-house-cathedral";

/** r6 «갈매나루» 의 make_place 인자 그대로(땅 씨앗 · 자리). */
const R6: PlaceSpec = { type: "village", name: "갈매나루", salt: 242134, hints: { terrainSeed: 73978, theme: "coast", kind: "fishing-cove", width: 38, height: 48,
  layout: { gather: { x: 16, y: 26, plaza: true }, landmark: { x: 16, y: 6 }, work: { x: 15, y: 38 }, houses: [{ x: 7, y: 20, kind: "small" }, { x: 27, y: 24, kind: "medium" }, { x: 27, y: 34, kind: "small" }, { x: 7, y: 32, kind: "medium" }], props: [{ x: 12, y: 31 }, { x: 21, y: 30 }], forests: [{ x: 30, y: 16 }, { x: 31, y: 6 }] } } } as unknown as PlaceSpec;

function build(spec: PlaceSpec, key = "asked-buildings"): { project: Project; map: GameMap; summary: string; warnings: string[] } {
  const project = createBlankProject() as Project;
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: JSON.stringify(["project", key]) };
  const res = builderFor(spec)!.build(createBuildRun(ctx as never), spec) as unknown as { ok: boolean; summary: string; mapIds?: string[]; warnings?: string[] };
  expect(res.ok, res.summary).toBe(true);
  const built = (ctx as { project: Project }).project;
  return { project: built, map: built.maps[res.mapIds![0]!]!, summary: res.summary, warnings: res.warnings ?? [] };
}

/** 시작 칸에서 걸어 닿는 칸(높이 단 걷기 규칙 포함). */
function reached(project: Project, map: GameMap): Uint8Array {
  const W = map.width, H = map.height, seen = new Uint8Array(W * H), queue: number[] = [];
  const s = project.startPos;
  if (project.startMapId === map.id && isPassable(project, map, s.x, s.y)) { seen[s.y * W + s.x] = 1; queue.push(s.y * W + s.x); }
  for (let h = 0; h < queue.length; h += 1) {
    const c = queue[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (seen[n] || !isPassable(project, map, nx, ny) || (map.relief && !reliefAllowsStep(map.relief, x, y, nx, ny))) continue;
      seen[n] = 1; queue.push(n);
    }
  }
  return seen;
}

describe("요청 건물 — 낱말에서 킷으로", () => {
  it("킷 id · id 의 토막 · 이름 낱말로 찾는다(별칭 표 없음) — 문 앞을 잡을 수 있는 건물만", () => {
    const kits = kitsOf(createBlankProject() as Project);
    expect(ids(askedBuildingKits(kits, "cathedral"))).toEqual(["bd-house-cathedral"]);
    expect(ids(askedBuildingKits(kits, "bd-house-cathedral"))).toEqual(["bd-house-cathedral"]);
    // 모델이 list_spatial_designs 에서 본 그대로 적어도 된다
    expect(ids(askedBuildingKits(kits, CATHEDRAL))).toEqual(["bd-house-cathedral"]);
    expect(ids(askedBuildingKits(kits, "market-hall"))).toEqual(["bd-house-mk-market-hall"]);
    expect(ids(askedBuildingKits(kits, "town-hall"))).toEqual(["bd-house-mk-town-hall"]);
    // 한글 이름 낱말 · 꾸밈말이 붙은 낱말(대성당 ← 성당)
    expect(ids(askedBuildingKits(kits, "성당"))).toContain("bd-house-cathedral");
    expect(ids(askedBuildingKits(kits, "대성당"))).toContain("bd-house-cathedral");
    expect(askedBuildingKits(kits, "여관").length).toBeGreaterThan(0);
    for (const kit of askedBuildingKits(kits, "여관")) expect(kit.name).toContain("여관");
    // 찾은 것은 모두 문이 하나이고 그 문이 그림 맨 아랫줄에 있다
    for (const word of ["cathedral", "inn", "성당", "여관", "market-hall"]) for (const kit of askedBuildingKits(kits, word)) expect(isSeatableBuilding(kit), `${word} ${kit.id}`).toBe(true);
    // 요청의 특징 낱말(features)은 id 그대로 · id 의 끝 토막일 때만 건물로 읽는다 — «port» 가 등대를 세우지 않는다
    expect(askedBuildingKits(kits, "port", 2)).toEqual([]);
    expect(askedBuildingKits(kits, "plaza", 2)).toEqual([]);
    expect(ids(askedBuildingKits(kits, "market-hall", 2))).toEqual(["bd-house-mk-market-hall"]);
  });

  it("그대로 맞는 건물이 없으면 가장 가까운 건물을 준다 — 오타 · 다른 건물 이름을 거쳐. 아주 먼 이름은 빈 목록", () => {
    const kits = kitsOf(createBlankProject() as Project);
    expect(nearestBuildingKits(kits, "cathedral")).toMatchObject({ near: false });
    const typo = nearestBuildingKits(kits, "cathedrel");
    expect(typo.near).toBe(true);
    expect(ids(typo.kits)).toEqual(["bd-house-cathedral"]);
    // «church» 라는 id·이름의 건물은 문 앞을 잡을 수 없는 거리 블록뿐이다 — 그 이름의 낱말(성당)을 가진 건물로 간다
    const church = nearestBuildingKits(kits, "church");
    expect(church.near).toBe(true);
    expect(church.kits.length).toBeGreaterThan(0);
    for (const kit of church.kits) { expect(isSeatableBuilding(kit)).toBe(true); expect(kit.name).toMatch(/성당|교회|예배당/u); }
    // 소품 이름을 거쳐 건물을 고르지 않는다(«dock» 이 부두 소품을 거쳐 바위 굴을 세웠다)
    expect(nearestBuildingKits(kits, "zeppelin dock")).toEqual({ kits: [], near: false });
    // 목록 한 줄: 큰 건물부터, 문 앞을 잡을 수 있는 것만
    const menu = askedBuildingMenu(kits, 12);
    expect(menu).toContain("bd-house-cathedral (");
    expect(menu.split(" · ").length).toBeLessThanOrEqual(12 * 2);
  });

  it("빌더: hints.buildings · layout 의 kit · features 의 킷 낱말을 모으고, 가까운 건물도 없는 이름만 «모른다» 로 돌린다", () => {
    const project = createBlankProject() as Project;
    const spec = (more: Partial<PlaceSpec>): PlaceSpec => ({ type: "village", name: "마을", ...more } as PlaceSpec);
    expect(askedVillageBuildings(project, spec({ hints: { buildings: ["cathedral", "inn"] } as never }))).toEqual({ buildings: ["cathedral", "inn"], unknown: [] });
    expect(askedVillageBuildings(project, spec({ hints: { buildings: "cathedral" } as never })).buildings).toEqual(["cathedral"]);
    expect(askedVillageBuildings(project, spec({ features: ["plaza", "market-hall", "port"] })).buildings).toEqual(["market-hall"]);
    expect(askedVillageBuildings(project, spec({ hints: { buildings: ["church", "zeppelin dock"] } as never }))).toEqual({ buildings: ["church"], unknown: ["zeppelin dock"] });
    // 늘 실리는 마을 카드에는 한 문장만(전체 목록·청하는 법은 땅 그림 답에 실린다) — 지시문 상한(test/aiV2PromptBudget.test.ts)
    expect(VILLAGE_CARD).toContain("Asked buildings (cathedral, inn…): hints.buildings [kit id or word].");
    expect(VILLAGE_CARD).not.toMatch(/cannot be requested/);
    // 모르는 마을 종류는 가장 가까운 종류로(없으면 undefined — 게임이 고른다)
    expect(nearestVillageKind("대장간")?.id).toBe("smithy-village");
    expect(nearestVillageKind("zzz")).toBeUndefined();
  });
});

describe("요청 건물 — 마을 시공기가 세운다", () => {
  it("r6 의 자리 그대로 + buildings:['cathedral']: 성당이 한 단 위에 서고, 문 앞이 시작에서 걸어 닿고, 광장 곁이다", () => {
    const { project, map, summary } = build({ ...R6, hints: { ...(R6.hints as object), buildings: ["cathedral"] } } as unknown as PlaceSpec);
    const m = /«cathedral» stands as bd-house-cathedral \([^)]*\), door front \((\d+),(\d+)\)/u.exec(summary);
    expect(m, summary).not.toBeNull();
    const front = { x: Number(m![1]), y: Number(m![2]) };
    const placed = (map.structurePlacements ?? []).find((p) => p.kitId === "bd-house-cathedral");
    expect(placed, "성당이 완성된 집으로 기록된다(다시 찍어도 덮이지 않는다)").toBeDefined();
    // 한 단 위
    if (map.relief) { const levels = new Set<number>(); for (let j = 0; j < placed!.h; j += 1) for (let i = 0; i < placed!.w; i += 1) levels.add(map.relief.levels[(placed!.y + j) * map.width + placed!.x + i]!); expect([...levels]).toHaveLength(1); }
    // 문 앞이 걸어 닿는다
    expect(reached(project, map)[front.y * map.width + front.x]).toBe(1);
    // 광장 곁: 건물 상자가 모이는 곳(16,26) 둘레 광장에서 다섯 칸 안
    const gap = Math.max(0, placed!.x - 20, 12 - (placed!.x + placed!.w - 1)) + Math.max(0, placed!.y - 29, 23 - (placed!.y + placed!.h - 1));
    expect(gap, `성당 (${placed!.x},${placed!.y})`).toBeLessThanOrEqual(5);
    // 건물을 청하지 않은 같은 마을에는 성당이 없다(청했을 때만 선다)
    const plain = build(R6);
    expect((plain.map.structurePlacements ?? []).some((p) => p.kitId === "bd-house-cathedral")).toBe(false);
    expect(plain.summary).not.toMatch(/asked buildings/);
  }, 180_000);

  it("가까운 건물도 없는 이름은 거절하지 않는다 — 마을은 서고, 무엇을 청할 수 있는지 알린다", () => {
    const { summary, warnings } = build({ type: "village", name: "들 마을", salt: 12, hints: { theme: "river", buildings: ["zeppelin dock"] } } as unknown as PlaceSpec);
    const text = `${summary} ${warnings.join(" ")}`;
    expect(text).toMatch(/hints\.buildings "zeppelin dock": no building kit of this village chipset is close/);
    expect(text).toContain("bd-house-cathedral (");
  }, 180_000);
});

describe("make_place — 담 두른 마을도 종류와 건물 청하는 법을 한 번 본다", () => {
  it("땅 그림 답이 없는 성벽 강가 마을: 종류도 건물도 안 적은 첫 호출은 짓지 않고 둘을 알려 주고, 같은 호출을 다시 보내면 짓는다", async () => {
    const p = createBlankProject() as Project;
    const task = "성벽을 두른 강가 읍 하나 만들어 줘";
    const env = { ctx: { project: p, currentMapId: p.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project: p, projectKey: "golden-key" },
      emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as never;
    const tool = createV2Tools(env, new V2Session()).find((t) => t.name === "make_place")!;
    const call = async (spec: Record<string, unknown>) => {
      const res = await tool.execute("t", { spec }) as { content: { type: string; text?: string }[] };
      return JSON.parse(res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")) as { ok?: boolean; notFailure?: boolean; summary?: string; villageKinds?: string; buildings?: string; mapIds?: string[] };
    };
    const mapsOf = () => Object.keys((env as { ctx: { project: Project } }).ctx.project.maps).length;
    const before = mapsOf();
    const spec = { type: "village", name: "성읍", theme: "river", features: ["walls"], hints: { walls: true } };
    const first = await call(spec);
    expect(first.ok).toBe(false);
    expect(first.notFailure).toBe(true);
    expect(first.summary).toMatch(/^Not built yet \(not a failure\)/);
    expect(first.villageKinds).toContain("smithy-village (");
    expect(first.buildings).toMatch(/hints\.buildings/);
    expect(mapsOf()).toBe(before);
    // 같은 호출을 그대로 다시 보내면 짓는다(되풀이해 돌려보내지 않는다)
    const second = await call(spec);
    expect(second.summary).not.toMatch(/^Not built yet/);
    expect(second.ok, second.summary).toBe(true);
    expect(second.summary).toMatch(/성읍: .*성벽/u);
  }, 180_000);
});

describe("손으로 찍는 건물 — 어긋난 터는 고쳐 놓고 알린다", () => {
  type Stamped = { data: { rect: { x: number; y: number; width: number; height: number }; entrances: { x: number; y: number }[]; site: { x: number; y: number; moved: boolean; cleared: number; opened: number; paved: number } }; warnings?: string[] };
  /** 조수의 호출 그대로: 도구 앞 검사 → stamp_object. */
  const assistantStamp = (project: Project, raw: Record<string, unknown>): Stamped => {
    const pre = preCheck("stamp_object", stamp.parameters, raw, project);
    expect(pre.kind, JSON.stringify(raw)).toBe("ok");
    const args = (pre as { args: Record<string, unknown> }).args;
    expect(args.site, "건물 킷에는 앞 검사가 site:'fix' 를 붙인다").toBe("fix");
    return stamp.run(project, args) as unknown as Stamped;
  };
  const drawn = (kit: StructureKitDef, i: number, j: number): boolean => (kit.rows[j]!.upperTiles?.[i] ?? -1) >= 0 || (kit.rows[j]!.tiles[i] ?? -1) >= 0;
  /** 선 건물이 지키는 것: 한 단 위 · 문 앞이 문과 같은 단이고 시작에서 걸어 닿음 · 발자국 4층에 남은 것 없음(지붕 위 나무) · 완성된 집의 칸을 덮지 않음. */
  const expectSound = (project: Project, map: GameMap, kit: StructureKitDef, out: Stamped, owned: ReadonlySet<number>): void => {
    const { rect, entrances } = out.data, W = map.width;
    const levels = new Set<number>();
    for (let j = 0; j < kit.height; j += 1) for (let i = 0; i < kit.width; i += 1) if (drawn(kit, i, j)) {
      const c = (rect.y + j) * W + rect.x + i;
      levels.add(map.relief?.levels[c] ?? 0);
      expect(map.upperOverlayTiles?.[c] ?? -1, `(${rect.x + i},${rect.y + j}) 의 4층`).toBe(-1);
      expect(owned.has(c), `(${rect.x + i},${rect.y + j}) 는 완성된 집의 칸`).toBe(false);
    }
    expect([...levels]).toHaveLength(1);
    expect(entrances.length).toBeGreaterThan(0);
    const door = entrances[0]!, front = (door.y + 1) * W + door.x;
    expect(map.relief?.levels[front] ?? 0).toBe(map.relief?.levels[door.y * W + door.x] ?? 0);
    expect(reached(project, map)[front], `문 앞 (${door.x},${door.y + 1})`).toBe(1);
  };
  /** 찍기 전의 완성된 집 칸(보호 칸). */
  const ownedOf = (map: GameMap): Set<number> => new Set(protectedHouseCells(map).map((c) => c.y * map.width + c.x));
  const layersOf = (map: GameMap): string => JSON.stringify([map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles]);
  const RIVER = { type: "village", name: "버들 마을", salt: 250118, hints: { theme: "river" } } as unknown as PlaceSpec;

  it("r6 의 맵: 12×13 성당은 설 자리가 없다 — 네 번 엇갈려 거절하지 않고 한 번에 까닭과 다음 할 일을 말한다. 예배당(11×9)은 옮겨 세운다", () => {
    const base = build(R6);
    const cathedral = kitsOf(base.project).find((k) => k.id === "bd-house-cathedral")!;
    expect(isBuildingKit(cathedral)).toBe(true);
    // r6 의 호출(001.15 · 001.18 · 001.39) — 전에는 «집을 덮는다» 로 옮긴 자리가 벼랑 줄에 걸쳐 높이 규칙이 거절하고, 높이 규칙의 «대안» 은 다시 집을 덮었다
    const stampFor = { name: cathedral.name ?? cathedral.id, objectId: CATHEDRAL, source: base.project.tilesets.beodeul_city!, kit: cathedral,
      pattern: { width: cathedral.width, height: cathedral.height, lower: cathedral.rows.flatMap((row) => [...row.tiles]), upper: cathedral.rows.flatMap((row) => [...(row.upperTiles ?? new Array(cathedral.width).fill(-1))]) } };
    const reasons = buildingSiteReasons(base.project, base.map, stampFor);
    expect(reasons.fits ?? 0, JSON.stringify(reasons)).toBe(0);
    for (const [x, y, onOverlap] of [[20, 11, "replace"], [16, 13, "replace"], [22, 0, "replace"]] as const) {
      const project = structuredClone(base.project), map = project.maps[base.map.id]!;
      const before = layersOf(map);
      const pre = preCheck("stamp_object", stamp.parameters, { objectId: CATHEDRAL, mapId: map.id, x, y, onOverlap }, project) as { kind: string; args: Record<string, unknown> };
      expect(pre.kind).toBe("ok");
      // 앞 검사는 더 옮기지 않는다(옮긴 자리가 벼랑에 걸쳤다) — 터는 도구가 한 번에 본다
      expect([pre.args.x, pre.args.y, pre.args.site]).toEqual([x, y, "fix"]);
      let thrown: unknown;
      try { stamp.run(project, pre.args); } catch (error) { thrown = error; }
      expect(thrown, `(${x},${y})`).toBeInstanceOf(Error);
      const message = (thrown as Error).message;
      expect(message).toMatch(new RegExp(`^Nothing was stamped: .* cannot stand at \\(${x},${y}\\) — .* — and no other spot on this map holds it`, "u"));
      expect(message).toMatch(/Do not retry other coordinates\. Use a smaller building .* hints\.buildings/u);
      expect((thrown as { code?: string; details?: { code?: string } }).code ?? (thrown as { details?: { code?: string } }).details?.code).toBe("building-site");
      expect(layersOf(map), "거절하면 맵은 그대로다").toBe(before);
    }
    // 같은 자리에 예배당: 설 자리가 있다 — 옮겨 세우고 무엇을 왜 옮겼는지 적는다
    const project = structuredClone(base.project), map = project.maps[base.map.id]!;
    const houses = ownedOf(map);
    const chapel = kitsOf(project).find((k) => k.id === "bd-house-mk-chapel")!;
    const out = assistantStamp(project, { objectId: "kit:beodeul_city/bd-house-mk-chapel", mapId: map.id, x: 20, y: 11 });
    expect(out.data.site.moved).toBe(true);
    expect((out.warnings ?? []).join(" ")).toMatch(new RegExp(`Building moved: .* was asked at \\(20,11\\) but there its? .*\\. It stands at \\(${out.data.rect.x},${out.data.rect.y}\\) instead`, "u"));
    expectSound(project, map, chapel, out, houses);
  }, 240_000);

  it("완성된 집 위 · 벼랑에 걸친 자리 · 물 위: 거절하지 않고 가장 가까운 맞는 자리로 옮긴다", () => {
    const base = build(RIVER);
    const W = base.map.width, H = base.map.height, ts = base.project.tilesets.beodeul_city!;
    const wet = (i: number): boolean => (ts.tileMeta?.[base.map.lowerTiles[i]!]?.tags ?? []).includes("water");
    /** 그 크기 창 가운데 점수가 가장 높은 왼쪽 위 칸. */
    const window = (kit: StructureKitDef, score: (cells: number[]) => number): { x: number; y: number } => {
      let best = -Infinity, at = { x: 0, y: 0 };
      for (let y = 0; y + kit.height < H; y += 1) for (let x = 0; x + kit.width <= W; x += 1) {
        const cells: number[] = []; for (let j = 0; j < kit.height; j += 1) for (let i = 0; i < kit.width; i += 1) cells.push((y + j) * W + x + i);
        const n = score(cells); if (n > best) { best = n; at = { x, y }; }
      }
      return at;
    };
    const kitOf = (id: string): StructureKitDef => kitsOf(base.project).find((k) => k.id === id)!;
    const cases: { id: string; at: { x: number; y: number }; why: RegExp }[] = [];
    const house = (base.map.structurePlacements ?? [])[0]!;
    cases.push({ id: "bd-house-mk-market-hall", at: { x: house.x, y: house.y }, why: /it covers a completed house/ });
    cases.push({ id: "bd-house-inn", at: window(kitOf("bd-house-inn"), (cells) => cells.filter(wet).length), why: /a building does not stand on water|it covers a completed house|it cuts the road/ });
    cases.push({ id: "bd-house-mk-chapel", why: /not on one height level|it covers a completed house/,
      at: window(kitOf("bd-house-mk-chapel"), (cells) => { const n = new Map<number, number>(); for (const c of cells) { const l = base.map.relief?.levels[c] ?? 0; n.set(l, (n.get(l) ?? 0) + 1); } return n.size === 2 ? Math.min(...n.values()) : -1; }) });
    for (const c of cases) {
      const project = structuredClone(base.project), map = project.maps[base.map.id]!;
      const houses = ownedOf(map);
      const out = assistantStamp(project, { objectId: `kit:beodeul_city/${c.id}`, mapId: map.id, x: c.at.x, y: c.at.y });
      expect(out.data.site.moved, c.id).toBe(true);
      const text = (out.warnings ?? []).join(" ");
      expect(text, c.id).toMatch(new RegExp(`Building moved: .* was asked at \\(${c.at.x},${c.at.y}\\) but there `, "u"));
      expect(text, c.id).toMatch(c.why);
      expectSound(project, map, kitOf(c.id), out, houses);
    }
  }, 240_000);

  it("빈 풀밭 맵: 문 앞을 나무가 에워싸면 옮기지 않고 나무를 통째로 걷어 길을 낸다 — 발자국에 걸친 나무도 반 토막을 남기지 않는다", () => {
    const project = createBlankProject() as Project, map = project.maps[project.startMapId]!, W = map.width;
    map.events = [];
    project.startPos = { ...project.startPos, x: 1, y: map.height - 2 };
    const house = kitsOf(project).find((k) => k.id === "bd-house-h109_0")!, tree = kitsOf(project).find((k) => k.id === "bd-tree-f4f319")!;
    expect(isBuildingKit(house)).toBe(true);
    expect([tree.width, tree.height]).toEqual([2, 2]);
    const X = 6, Y = 2, fy = Y + house.height; // 발자국 (6..10, 2..7) · 문 앞 줄 8
    const plant = (x0: number, y0: number): void => { for (let j = 0; j < 2; j += 1) for (let i = 0; i < 2; i += 1) map.upperTiles[(y0 + j) * W + x0 + i] = tree.rows[j]!.upperTiles![i]!; };
    // 문 앞 줄을 에워싼다: 남쪽에 나무 셋(밑동이 줄 9), 서쪽 끝 (4,8) · (5,7) 과 동쪽 끝 (11,8) 을 밑동으로 막는다 — 수관 칸이 걸을 수 있든 없든 문 앞 줄은 갇힌다
    for (const x of [X - 1, X + 1, X + 3]) plant(x, fy);
    plant(X - 3, fy - 1); plant(X - 2, fy - 2); plant(X + house.width, fy - 1);
    // 발자국 맨 윗줄에 아랫줄만 걸친 나무(윗줄은 발자국 밖)
    let top = 0; while (top < house.height && !Array.from({ length: house.width }, (_, i) => drawn(house, i, top)).some(Boolean)) top += 1;
    const col = Array.from({ length: house.width - 1 }, (_, i) => i).find((i) => drawn(house, i, top) && drawn(house, i + 1, top))!;
    plant(X + col, Y + top - 1);
    const doorX = X + house.parts!.find((part) => part.kind === "entrance")!.dx;
    expect(reached(project, map)[fy * W + doorX], "지금은 문 앞에 닿지 못한다").toBe(0);
    const out = assistantStamp(project, { objectId: "kit:beodeul_city/bd-house-h109_0", mapId: map.id, x: X, y: Y });
    // 청한 자리 그대로 섰다 — 나무는 터를 물릴 까닭이 아니다
    expect(out.data.site).toMatchObject({ x: X, y: Y, moved: false });
    expect(out.data.site.opened).toBeGreaterThan(0);
    expect((out.warnings ?? []).join(" ")).toMatch(/Site cleared for .* removed whole/u);
    expect((out.warnings ?? []).join(" ")).toMatch(/Door way opened/u);
    expectSound(project, map, house, out, new Set());
    // 발자국에 걸친 나무는 통째로 사라졌다(발자국 밖 윗줄에 수관만 남지 않는다)
    for (let i = 0; i < 2; i += 1) expect(map.upperTiles[(Y + top - 1) * W + X + col + i], "걸친 나무의 윗줄").toBe(-1);
  }, 120_000);

  it("시공기·다른 도구가 부르는 찍기는 그대로다 — site 를 주지 않으면 옮기지도 치우지도 않고 전처럼 거절한다", () => {
    const { project, map } = build(R6);
    // 앞 검사가 옮겨 보냈던 자리 (21,8): 두 단에 걸친다 — site 없이(또는 exact) 부르면 높이 규칙이 거절한다
    const before = layersOf(map);
    for (const more of [{}, { site: "exact" }]) {
      expect(() => stamp.run(project, { objectId: CATHEDRAL, mapId: map.id, x: 21, y: 8, ...more })).toThrow(/높이 규칙/u);
      expect(layersOf(map)).toBe(before);
    }
    // 작은 입구 소품(굴 입구)은 건물 터 고치기의 대상이 아니다 — 제 자리에 맞춰 찍는 것들
    const cave = kitsOf(project).find((k) => k.id === "bd-obj-cave-mouth");
    expect(cave, "굴 입구 킷").toBeDefined();
    expect(isBuildingKit(cave)).toBe(false);
    const preCave = preCheck("stamp_object", stamp.parameters, { objectId: "kit:beodeul_city/bd-obj-cave-mouth", mapId: map.id, x: 3, y: 3 }, project) as { kind: string; args: Record<string, unknown> };
    expect(preCave.kind).toBe("ok");
    expect(preCave.args.site).toBeUndefined();
  }, 180_000);
});
