import { describe, expect, it } from "vitest";
import { freshBlankProject as createBlankProject, ownTileset } from "./support/blankProject";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { reliefAllowsStep } from "@/project/relief/walk";
import type { GameMap, Project, StructureKitDef } from "@/project/types";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import { askedBuildingKits, askedBuildingMenu, isSeatableBuilding, nearestBuildingKits } from "@/editor/tools/beodeulAskedBuildings";
import { buildingSiteReasons, isBuildingKit } from "@/editor/tools/buildingSite";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { SHARED_OBJECT_TOOLS } from "@/editor/tools/sharedObjectTools";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3/constructionTools";
import { tilesetSurface } from "@/project/tilesetSurface";
import { nearestVillageKind } from "@/editor/tools/beodeulVillageKinds";
import { builderFor } from "@/ai/v2/place/builders";
import { askedVillageBuildings, VILLAGE_CARD } from "@/ai/v2/place/builders/village";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { preCheck } from "@/ai/v2/loop/argGuard";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { readFileSync } from "node:fs";
import { planCommons, straightEarthRuns } from "@/editor/tools/beodeulCommons";
import { readSettlementAreas, settlementGround, settlementRank, standableYard } from "@/editor/tools/beodeulSettlementRank";
import { planTownCore, squareApproaches, squareBox, squareRing, SQUARE_FLOORS } from "@/editor/tools/beodeulTownCore";
import { townWallLayout } from "@/editor/tools/beodeulTownWall";
import { planQuay } from "@/editor/tools/beodeulQuay";
import { emptyWindows, planLandPlots } from "@/editor/tools/beodeulLandUse";
import type { ToolContext } from "@/editor/tools/types";
import { isolateTimers } from "./mergedTeardown";

// 요청 건물(「광장 곁 대성당」) — 마을 시공기가 청한 건물을 모이는 곳 가장자리에 세우고, 손으로 찍는 건물은 어긋난 터를 거절하지 않고 고쳐 놓는다.
// 왜(2026-11-16 실모델 확인 빌드 r6 «갈매나루»): 요청은 «광장 곁 대성당» 이었는데 make_place 에는 건물을 청할 길이 없었다. 모델은 성당 킷을 손으로 찍다
// 네 번 거절당하고 윗단 숲 위에 세웠다 — 문 앞은 벼랑 아래, 지붕 위에 숲 머리 세 그루. 오너 방향: 있는 에셋이면 깔고, 어긋나면 고쳐 놓고 알리고, 거절은 게임이 깨질 때만.
describe("beodeulAskedBuildings", () => {
  isolateTimers();
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
      // r6 의 모델은 특징 낱말을 hints 안에 적었다(hints.features ["plaza","harbour"]) — 거기 적힌 킷 낱말도 받는다
      expect(askedVillageBuildings(project, spec({ hints: { features: ["plaza", "harbour", "cathedral"] } as never })).buildings).toEqual(["cathedral"]);
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
      // 큰 건물은 단을 같이 적는다(그 문 뒤 실내를 make_place hints.door 로 지으면 그 단의 방 구성 — test/aiV2HouseDoorCard.test.ts)
      const m = /«cathedral» stands as bd-house-cathedral \([^)]*\) xlarge, door front \((\d+),(\d+)\)/u.exec(summary);
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
      // 결함 5: 집 문 목록이 킷 id 뿐이라 어느 문이 어느 건물인지 못 읽었다(어물전이 화물 창고 문에 달렸다) — 문마다 건물 이름(쓰임)을 같이 싣는다
      expect(plain.summary).toMatch(/house-rv-r2-06\(\d+,\d+\) «회벽 화물 창고»/u);
      expect(plain.summary).toMatch(/house-h111_1\(\d+,\d+\) «생선 가게 가게집»/u);
      for (const m of plain.summary.slice(plain.summary.indexOf("집 문 앞 칸")).matchAll(/house-[\w-]+\(\d+,\d+\)( «[^»]+»)?/gu)) expect(m[1], m[0]).toBeTruthy();
    }, 180_000);

    it("가까운 건물도 없는 이름은 거절하지 않는다 — 마을은 서고, 무엇을 청할 수 있는지 알린다", () => {
      const { summary, warnings } = build({ type: "village", name: "들 마을", salt: 12, hints: { theme: "river", buildings: ["zeppelin dock"] } } as unknown as PlaceSpec);
      const text = `${summary} ${warnings.join(" ")}`;
      expect(text).toMatch(/hints\.buildings "zeppelin dock": no building kit of this village chipset is close/);
      expect(text).toContain("bd-house-cathedral (");
    }, 180_000);
  });
  describe("make_place — 담 두른 마을도 종류와 건물 청하는 법을 한 번 본다(짓는 것을 미루지 않는다)", () => {
    const makePlace = (task: string) => {
      const p = createBlankProject() as Project;
      const env = { ctx: { project: p, currentMapId: p.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project: p, projectKey: "golden-key" },
        emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as never;
      const tool = createV2Tools(env, new V2Session()).find((t) => t.name === "make_place")!;
      const call = async (spec: Record<string, unknown>) => {
        const res = await tool.execute("t", { spec }) as { content: { type: string; text?: string }[] };
        return JSON.parse(res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")) as { ok?: boolean; notFailure?: boolean; summary?: string; warnings?: string[]; mapIds?: string[] };
      };
      return { call, project: () => (env as { ctx: { project: Project } }).ctx.project };
    };

    it("땅 그림 답이 없는 성벽 강가 마을: 첫 호출에 바로 짓고, 종류 목록과 건물 청하는 법은 결과 글 끝에 한 번 싣는다", async () => {
      const { call, project } = makePlace("성벽을 두른 강가 읍 하나 만들어 줘");
      const first = await call({ type: "village", name: "성읍", theme: "river", features: ["walls"], hints: { walls: true } });
      expect(first.ok, first.summary).toBe(true);
      expect(first.summary).toMatch(/성읍: .*성벽/u);
      const notes = (first.warnings ?? []).join(" ");
      expect(notes).toContain("smithy-village (");
      expect(notes).toMatch(/hints\.buildings/);
      expect(project().maps[first.mapIds![0]!]?.name).toBe("성읍");
      // 같은 이름을 다시 지어도(다른 맵) 목록을 되풀이하지 않는다
      const again = await call({ type: "village", name: "성읍", theme: "river", features: ["walls"], hints: { walls: true } });
      expect((again.warnings ?? []).join(" ")).not.toContain("smithy-village (");
    }, 180_000);

    it("명세 은행 lay-main-castle: 녹화된 «성벽 왕궁» 호출(종류·건물 없음, 스키마 칸을 0·빈 값으로 다 채움) 한 번으로 왕궁 맵이 선다 — «빈 맵» 으로 남지 않는다", async () => {
      // 2026-11-16 은행: 첫 호출을 «Not built yet» 으로 돌려보냈더니 모델(녹화)은 다시 부르지 않고 다음 할 일로 넘어가 맵이 «빈 맵» 으로 남았다.
      const { call, project } = makePlace("성벽으로 둘러싸인 왕궁 맵을 만들어 줘. 성문으로 들어가서 궁전까지 길이 이어지게 해 줘.");
      const zero = { x: 0, y: 0 };
      const res = await call({ type: "village", name: "왕궁", style: "fantasy", theme: "river", size: "large", features: ["walls", "plaza"], exits: ["south"], salt: 519010,
        zones: [{ kind: "palace", purpose: "성문에서 길을 따라 도달하는 왕궁", anchors: ["궁전"] }],
        hints: { variant: 0, dressing: 0, houseCount: 3, roofs: "", water: "none", woods: "", form: "", terrain: "", landform: "flat", settle: "low", tiers: 1, high: "north", forestType: "", walls: true, wallGate: "S", width: 0, height: 0, terrainSeed: 0,
          layout: { gather: { ...zero, plaza: true }, landmark: zero, anchor: zero, work: zero, houses: [], fields: [], orchards: [], pastures: [], forests: [], props: [], exits: ["south"] } } });
      expect(res.ok, res.summary).toBe(true);
      expect(res.summary).not.toMatch(/^Not built yet/);
      expect(res.summary).toMatch(/왕궁: .*성벽/u);
      const map = project().maps[res.mapIds![0]!]!;
      expect(map.name).toBe("왕궁");
      expect((map.structurePlacements ?? []).length).toBeGreaterThan(0);
    }, 180_000);

    it("성 · 성채 · 궁처럼 마을 종류가 아닌 낱말은 종류를 버리고(게임이 고른다) 짓는다 — 목록은 한 번만", async () => {
      for (const kind of ["castle", "성채", "궁"]) {
        const { call } = makePlace("성벽 왕궁 만들어 줘");
        const res = await call({ type: "village", name: "왕성", theme: "river", features: ["walls"], salt: 519010, hints: { walls: true, kind } });
        expect(res.ok, `${kind}: ${res.summary}`).toBe(true);
        const notes = (res.warnings ?? []).join(" ");
        expect(notes, kind).toMatch(new RegExp(`hints\\.kind "${kind}" is not a village kind — the game picks one that fits the land`, "u"));
        expect(notes.split("smithy-village (").length - 1, kind).toBe(1);
      }
    }, 240_000);
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
      // 이동 칸은 문 칸에 선다(r6 은 벼랑 아래 (28,13) 이었다): 결과의 입구 아래 칸으로 실내를 이으면 트리거가 그 입구 칸이다
      const ctx = { project, currentMapId: map.id, assistantRun: true };
      const parts = runTool(ctx, "list_hand_interior_parts", {}).data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
      const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
      expect(runTool(ctx, "build_hand_interior_room", { tileset: "atlas_biome_interior", mapId: "chapel_in", name: "예배당", plan: ["########", "#......#", "#......#", "#......#", "###.####"], floor: pick(parts.floors?.[0]), wall: pick(parts.walls?.[0]) }).ok).toBe(true);
      const door = out.data.entrances[0]!;
      const pair = runTool(ctx, "create_transfer_pair", { a: { mapId: map.id, x: door.x, y: door.y + 1 }, b: { mapId: "chapel_in", x: 3, y: 4 } });
      expect(pair.ok, pair.summary).toBe(true);
      expect(pair.summary).toContain(`갈매나루(${door.x},${door.y})`);
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

    it("빈 풀밭 맵: 문 앞을 나무가 에워싸면 옮기지 않고 나무를 통째로 걷어 길 타일을 깐다 — 발자국에 걸친 나무도 반 토막을 남기지 않는다", () => {
      const project = createBlankProject() as Project, map = project.maps[project.startMapId]!, W = map.width;
      map.events = [];
      project.startPos = { ...project.startPos, x: 1, y: map.height - 2 };
      // 맵 아래쪽에 길 한 줄(그 칩셋의 길 재료) — 문 앞에서 네 칸 아래
      const lay = tilesetSurface(project.tilesets[map.tilesetId]).lay;
      const roadY = map.height - 3;
      CONSTRUCTION_TOOLS_V3.find((tool) => tool.name === "fill_region")!.run(project, { mapId: map.id, material: lay[0]!.material, rect: { x: 0, y: roadY, w: W, h: 1 }, _exactCells: true });
      const onRoad = (x: number, y: number): boolean => lay.some((l) => l.tiles.has(map.lowerTiles[y * W + x]!));
      expect(onRoad(8, roadY)).toBe(true);
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
      // 연 길에 길 타일을 깔고 가까운 길까지 잇는다: 문 앞 줄부터 길 바로 윗줄까지
      expect(out.data.site.paved).toBeGreaterThan(0);
      expect((out.warnings ?? []).join(" ")).toMatch(/Door way opened and paved: \d+ road cell/u);
      for (let y = fy; y < roadY; y += 1) expect(onRoad(doorX, y), `(${doorX},${y}) 길 타일`).toBe(true);
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
});

// 버들항 정착지의 급과 바닥(editor/tools/beodeulSettlementRank.ts · beodeulCommons.ts): 바닥은 정착지의 급을 따른다.
// 광장도 성벽도 청하지 않은 풀밭 마을은 돌 포장이 없고(길·마당이 한 몸으로 이어진 흙), 문 앞은 모두 흙이며, 집·문 도달은 그대로다.
// 포구는 잔교가 설 물가를 곧게 편 돌 둑을 낸다(beodeulQuay.ts — 뭍을 넓히는 쪽으로만 메운다).
// 읍(성벽 · 청한 광장)은 중심부가 돌바닥이고(beodeulTownCore.ts) 풀은 화단으로만 남으며, 광장은 길 포석 테를 두른 네모다.
describe("beodeulSettlementGround", () => {
  isolateTimers();
  const TS = "beodeul_city";
  function town(args: Record<string, unknown>): { project: Project; map: GameMap; data: Record<string, unknown> } {
    const project = createBlankProject() as Project;
    const ctx = { project, currentMapId: project.startMapId } as ToolContext;
    const res = runTool(ctx, "author_beodeul_town", { theme: "river", seed: 7, ...args });
    expect(res.ok, res.summary).toBe(true);
    const data = res.data as Record<string, unknown>;
    return { project: ctx.project, map: ctx.project.maps[data.mapId as string]!, data };
  }
  const tagCount = (project: Project, map: GameMap, tag: string): number => {
    const meta = project.tilesets[TS]!.tileMeta ?? [];
    let n = 0;
    for (const t of map.lowerTiles) if (((meta[t]?.tags ?? []) as readonly string[]).includes(tag)) n += 1;
    return n;
  };
  describe("정착지의 급 — 사실에서만 정한다", () => {
    const base = { walls: false, plaza: false, scatter: false, houseLimit: Infinity, waterfront: false, grass: true };
    it("성벽이나 청한 광장이 있으면 읍, 흩어진 농가·집 셋 이하는 작은 마을, 그 밖은 마을", () => {
      expect(settlementRank({ ...base, walls: true })).toBe("town");
      expect(settlementRank({ ...base, plaza: true })).toBe("town");
      expect(settlementRank({ ...base, scatter: true })).toBe("hamlet");
      expect(settlementRank({ ...base, houseLimit: 3 })).toBe("hamlet");
      expect(settlementRank({ ...base, houseLimit: 4 })).toBe("village");
      expect(settlementRank(base)).toBe("village");
    });
    it("풀밭 마을만 바닥이 급을 따른다 — 사막·설원·늪은 제 바닥 표본 그대로", () => {
      expect(settlementGround(base)).toMatchObject({ rank: "village", earthRoads: true, commons: true, pavedCore: false });
      expect(settlementGround({ ...base, plaza: true })).toMatchObject({ rank: "town", earthRoads: false, commons: false, pavedCore: true });
      expect(settlementGround({ ...base, grass: false })).toMatchObject({ earthRoads: false, commons: false, pavedCore: false, quay: false });
      expect(settlementGround({ ...base, waterfront: true }).quay).toBe(true);
    });
  });
  describe("흙 몸(planCommons) — 길 뼈대 둘레에 모양으로 자란다", () => {
    // 평지 30×24, 가운데 가로 길 한 줄(y 12, x 0~29)과 문 앞 하나
    const W = 30, H = 24;
    const cells = Array.from({ length: W }, (_, x) => 12 * W + x);
    const road = new Set(cells);
    const plan = (extra: Partial<Parameters<typeof planCommons>[0]> = {}) => planCommons({
      W, H, seed: 5, g: { x: 15, y: 14 }, free: (c) => !road.has(c), road: (c) => road.has(c), prop: () => false, level: () => 0,
      doors: [{ x: 8, y: 9 }], houses: 4, ...extra,
    });
    it("같은 입력이면 같은 흙이고, 길 칸은 흙으로 바꿀 칸에 들지 않는다", () => {
      const a = plan(), b = plan();
      expect(a.earth).toEqual(b.earth);
      expect(a.earth.some((c) => road.has(c))).toBe(false);
      expect(a.earth.length).toBeGreaterThan(60);
      expect(a.yard).toBeGreaterThan(20);
    });
    it("길 줄을 주면 곧은 구간이 굽이친다 — 흙이 떠난 길 칸을 돌려주되 흙 몸은 끊기지 않는다", () => {
      const p = plan({ paths: [{ cells, width: 1 }], freeRoad: () => true });
      expect(p.bare.length).toBeGreaterThan(0);
      const earth = new Set([...p.earth, ...cells.filter((c) => !p.bare.includes(c))]);
      // 길의 두 끝(맵 가장자리)은 흙으로 남고 서로 이어져 있다
      expect(earth.has(cells[0]!) && earth.has(cells[W - 1]!)).toBe(true);
      const seen = new Set([cells[0]!]); const q = [cells[0]!];
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W;
        for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < W * H && Math.abs((n % W) - x) <= 1 && earth.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } }
      expect(seen.has(cells[W - 1]!)).toBe(true);
      // 자로 그은 한 칸 줄이 아니다
      expect(straightEarthRuns(W, H, (c) => earth.has(c)).cells).toBeLessThan(straightEarthRuns(W, H, (c) => road.has(c)).cells);
    });
    it("맵 가장자리 두 줄에는 흙을 새로 내지 않는다 — 가장자리에 닿는 것은 뼈대 길뿐이다(출구 없는 길 끝·넓어진 출구가 생기지 않는다)", () => {
      const rim = (c: number) => { const x = c % W, y = (c - x) / W; return x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2; };
      for (const p of [plan(), plan({ paths: [{ cells, width: 1 }], freeRoad: () => true })]) {
        expect(p.earth.length).toBeGreaterThan(60);
        expect(p.earth.filter(rim)).toEqual([]);
        // 길의 두 끝은 흙으로 남는다
        expect(p.bare.includes(cells[0]!) || p.bare.includes(cells[W - 1]!)).toBe(false);
      }
    });
  });
  describe("사람이 서도 되는 흙 마당(standableYard)", () => {
    // 13×7: 흙 5×5(x 1~5, y 1~5)와 떨어진 포석 4×5(x 8~11, y 1~5) — 둘 다 길로 센다
    const W = 13, H = 7;
    const lowerTiles = new Array<number>(W * H).fill(0);
    for (let y = 1; y <= 5; y += 1) { for (let x = 1; x <= 5; x += 1) lowerTiles[y * W + x] = 1; for (let x = 8; x <= 11; x += 1) lowerTiles[y * W + x] = 2; }
    const map = { width: W, height: H, lowerTiles } as unknown as GameMap;
    const tileset = { tileMeta: [{ tags: ["grass"] }, { tags: ["sand"] }, { tags: ["road"] }] } as unknown as Project["tilesets"][string];
    const roads = new Set<number>(); lowerTiles.forEach((t, c) => { if (t) roads.add(c); });
    it("둘레 여덟 칸이 모두 길인 흙 칸만 — 흙의 가장자리 줄과 포석 거리는 들지 않는다", () => {
      const yard = [...standableYard(map, tileset, roads)].sort((a, b) => a - b);
      expect(yard).toEqual([2, 3, 4].flatMap((y) => [2, 3, 4].map((x) => y * W + x)));
    });
    it("길로 세지 않는 흙(사막의 모래 바닥)은 마당이 아니다", () => {
      expect(standableYard(map, tileset, new Set([...roads].filter((c) => c !== 3 * W + 3))).size).toBe(0);
      expect(standableYard(map, tileset, new Set()).size).toBe(0);
    });
  });
  describe("시골 마을의 바닥 — 돌 포장 없이 흙", () => {
    it("광장을 청하지 않은 강가 마을: 포석·판석 칸이 없고, 문 앞은 모두 흙이며, 흙 마당이 선다", () => {
      const { project, map, data } = town({});
      expect(data.rank).toBe("village");
      expect(tagCount(project, map, "road")).toBe(0);
      // 판석 꼬리표 칸은 집 킷이 제 문턱에 구워 둔 몇 칸뿐이다(시공기가 깐 광장·어귀 판석은 없다)
      expect(tagCount(project, map, "plaza")).toBeLessThan(8);
      const areas = readSettlementAreas(map, project.tilesets[TS]);
      expect(areas.earth.length).toBeGreaterThan(map.width * map.height * 0.12);
      expect(areas.yard.length).toBeGreaterThan(30);
      expect(areas.earthEdge.length).toBeGreaterThan(40);
      expect(areas.street.length).toBe(0);
      expect(areas.court.length).toBeLessThan(8);
      const earth = new Set(areas.earth);
      const doors = data.doors as { x: number; y: number; reached: boolean }[];
      expect(doors.length).toBeGreaterThan(3);
      for (const d of doors) expect(earth.has(d.y * map.width + d.x), `문 앞 (${d.x},${d.y})`).toBe(true);
      // 문 도달은 기준선과 같다(이 씨앗은 모두 닿는다)
      expect(doors.filter((d) => !d.reached).length).toBe(0);
    }, 240_000);

    it("광장을 청한 마을은 읍이다 — 흙 몸을 깔지 않고 포석 길과 판석 광장이 선다", () => {
      const { project, map, data } = town({ form: "plaza" });
      expect(data.rank).toBe("town");
      expect(tagCount(project, map, "road")).toBeGreaterThan(40);
      expect(tagCount(project, map, "plaza")).toBeGreaterThan(20);
    }, 240_000);

    it("사막 마을은 그대로다(제 바닥 표본) — 급은 적히지만 흙 몸을 깔지 않는다", () => {
      const { project, map } = town({ theme: "desert", seed: 17 });
      expect(readSettlementAreas(map, project.tilesets[TS]).earth.length).toBe(0);
    }, 240_000);
  });
  describe("조수가 고른 밭 자리 — 흙 몸이 차지하지 않는다", () => {
    it("흩어진 농가에 밭 자리를 주면 그 자리에 밭이 선다(2026-11-15 명세 은행 lay-main-farm: 흙 몸이 먼저 앉아 밭 1 → 0)", () => {
      const { data } = town({ seed: 44061, form: "scatter", water: "none", houseCount: 3, terrainSeed: 88097,
        layout: { gather: { x: 25, y: 24, plaza: false }, landmark: { x: 10, y: 5 }, anchor: { x: 26, y: 16 }, work: { x: 39, y: 17 },
          houses: [{ x: 8, y: 17, kind: "small" }, { x: 10, y: 30, kind: "medium" }, { x: 39, y: 30, kind: "large" }],
          fields: [{ x: 18, y: 18 }, { x: 20, y: 32 }], pastures: [{ x: 37, y: 24 }], props: [{ x: 25, y: 28 }], exits: ["south"] } });
      expect(data.rank).toBe("hamlet");
      expect(data.fields as number).toBeGreaterThanOrEqual(1);
      expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
    }, 240_000);
  });
  describe("읍의 광장 — 테를 두른 네모", () => {
    const W = 30, H = 20;
    const road = new Set(Array.from({ length: W }, (_, x) => 10 * W + x));
    it("바깥 한 줄이 테, 안이 광장 돌 · 변 가운데에서 길까지 곧은 들목 · 안 돌 목록에 강자갈이 없다", () => {
      const cells: number[] = []; for (let y = 4; y <= 8; y += 1) for (let x = 5; x <= 11; x += 1) cells.push(y * W + x);
      const box = squareBox(W, cells)!;
      expect(box).toEqual({ x0: 5, y0: 4, x1: 11, y1: 8 });
      const { ring, inner } = squareRing(W, H, cells);
      expect(ring.length).toBe(20);
      expect(inner.length).toBe(15);
      const approach = squareApproaches(W, H, box, (c) => !road.has(c), (c) => road.has(c));
      expect(approach.map((c) => `${c % W},${Math.floor(c / W)}`).sort()).toEqual(["7,9", "8,9", "9,9"]);
      expect(SQUARE_FLOORS.length).toBeGreaterThanOrEqual(2);
      expect(SQUARE_FLOORS.some((f) => /cobble|자갈/.test(`${f.id}${f.label}${f.kit ?? ""}`))).toBe(false);
    });

    it("광장을 청한 마을: 네 모서리는 길 포석 테, 안은 모두 광장 돌, 우물 하나, 문은 모두 닿는다", () => {
      const { project, map, data } = town({ form: "plaza" });
      const meta = project.tilesets[TS]!.tileMeta ?? [];
      const tags = (c: number) => (meta[map.lowerTiles[c]!]?.tags ?? []) as readonly string[];
      const sq = data.square as { x0: number; y0: number; x1: number; y1: number; floor: string };
      expect(SQUARE_FLOORS.map((f) => f.id)).toContain(sq.floor);
      expect(sq.x1 - sq.x0).toBeGreaterThanOrEqual(6);
      expect(sq.y1 - sq.y0).toBeGreaterThanOrEqual(6);
      for (const [x, y] of [[sq.x0, sq.y0], [sq.x1, sq.y0], [sq.x0, sq.y1], [sq.x1, sq.y1]] as const) expect(tags(y * map.width + x), `테 모서리 (${x},${y})`).toContain("road");
      for (let y = sq.y0 + 1; y < sq.y1; y += 1) for (let x = sq.x0 + 1; x < sq.x1; x += 1) expect(tags(y * map.width + x), `광장 안 (${x},${y})`).toContain("plaza");
      expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
      expect((map.structurePlacements ?? []).filter((p) => /well/.test(p.kitId)).length).toBe(1);
    }, 240_000);
  });
  describe("읍의 포장 중심부(planTownCore)", () => {
    const W = 30, H = 20;
    const road = new Set(Array.from({ length: W }, (_, x) => 10 * W + x));
    const building = new Set<number>(); for (let y = 3; y < 7; y += 1) for (let x = 4; x < 10; x += 1) building.add(y * W + x);
    const plan = planTownCore({ W, H, seed: 5, inside: (c) => { const x = c % W, y = Math.floor(c / W); return x > 0 && y > 0 && x < W - 1 && y < H - 1; },
      open: (c) => !road.has(c) && !building.has(c), road: (c) => road.has(c), building: (c) => building.has(c), doors: [{ x: 6, y: 7 }] });
    it("안뜰은 중심부의 빈 칸을 덮고, 화단은 둘레 한 칸이 모두 안뜰인 네모이며 풀 몫은 다섯에 하나를 넘지 않는다", () => {
      const court = new Set(plan.court);
      expect(plan.court.some((c) => road.has(c) || building.has(c))).toBe(false);
      expect(plan.beds.length).toBeGreaterThan(2);
      let green = 0;
      for (const b of plan.beds) {
        green += b.w * b.h;
        for (let j = -1; j <= b.h; j += 1) for (let i = -1; i <= b.w; i += 1) {
          const c = (b.y + j) * W + b.x + i, inBed = i >= 0 && j >= 0 && i < b.w && j < b.h;
          expect(court.has(c), `화단 (${b.x},${b.y}) 의 (${i},${j})`).toBe(!inBed);
        }
      }
      expect(green / (plan.court.length + green)).toBeLessThan(0.2);
      // 문 앞 길목(문 앞 칸에서 길까지)에는 화단·화분이 없다
      for (let dy = 0; dy <= 2; dy += 1) expect(court.has((7 + dy) * W + 6)).toBe(true);
      expect(plan.planters.some((p) => p.x >= 5 && p.x <= 7 && p.y >= 7 && p.y <= 10)).toBe(false);
    });

    it("성벽 읍: 성벽 안 풀 몫이 넷에 하나 아래, 밭이 없고, 안뜰 판석이 길보다 넓다 · 문은 모두 닿는다", () => {
      const { project, map, data } = town({ walls: true, form: "plaza", seed: 17 });
      expect(data.rank).toBe("town");
      expect(data.fields).toBe(0);
      const meta = project.tilesets[TS]!.tileMeta ?? [];
      const tags = (c: number) => (meta[map.lowerTiles[c]!]?.tags ?? []) as readonly string[];
      const L = townWallLayout(map.width, map.height, 17);
      let inside = 0, green = 0;
      for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (!L.inBand(x, y)) { inside += 1; if (tags(y * map.width + x).includes("grass")) green += 1; }
      expect(green / inside).toBeLessThan(0.25);
      const areas = readSettlementAreas(map, project.tilesets[TS]);
      expect(areas.court.length).toBeGreaterThan(800);
      expect(areas.street.length).toBeGreaterThan(200);
      expect(areas.court.length).toBeGreaterThan(areas.street.length);
      expect(areas.earth.length).toBe(0);
      expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
      expect((map.structurePlacements ?? []).filter((p) => /well/.test(p.kitId)).length).toBe(1);
    }, 240_000);
  });
  describe("포구의 돌 둑(planQuay)", () => {
    // 물가: y 0~5 뭍, 6~ 바다. 열 8·9 는 물가가 한 줄 들어가 있고(y 5 가 바다) 열 14 는 한 줄 나와 있다(y 6 이 뭍)
    const W = 24, H = 12;
    const sea = (c: number) => { const x = c % W, y = Math.floor(c / W); return y >= 6 ? !(x === 14 && y === 6) : (y === 5 && (x === 8 || x === 9)); };
    it("들어간 물가는 메워 앞줄을 곧게 펴고, 바다로 나온 뭍 앞에서 끝난다 — 물을 새로 파지 않는다", () => {
      const plan = planQuay({ W, H, near: { x: 12, y: 3 }, sea, land: (c) => !sea(c), level: () => 0 })!;
      expect(plan.front).toEqual({ x0: 2, x1: 13, y: 5 });
      expect(plan.fill.map((c) => `${c % W},${Math.floor(c / W)}`).sort()).toEqual(["8,5", "9,5"]);
      // 메우는 칸은 모두 바다였고, 포장하는 칸은 모두 뭍이었다
      expect(plan.fill.every((c) => sea(c))).toBe(true);
      expect(plan.cells.every((c) => !sea(c))).toBe(true);
      // 앞줄 바로 아래는 모두 바다다(곧은 둑)
      for (let x = plan.front.x0; x <= plan.front.x1; x += 1) expect(sea((plan.front.y + 1) * W + x), `둑 앞 (${x})`).toBe(true);
      expect(plan.links.length).toBeGreaterThan(0);
    });
    it("바다가 없으면 둑도 없다", () => {
      expect(planQuay({ W, H, near: { x: 12, y: 3 }, sea: () => false, land: () => true, level: () => 0 })).toBeNull();
    });

    it("포구 마을: 물에 닿는 판석 둑이 서고, 잔교가 둑에서 뻗고, 문은 모두 닿는다", () => {
      const { project, map, data } = town({ theme: "coast", seed: 23, houseCount: 4 });
      const quay = data.quay as { x0: number; y0: number; x1: number; y1: number; cells: number };
      expect(quay.x1 - quay.x0 + 1).toBeGreaterThanOrEqual(7);
      expect(quay.cells).toBeGreaterThanOrEqual(14);
      const areas = readSettlementAreas(map, project.tilesets[TS]);
      expect(areas.quay.length).toBeGreaterThanOrEqual(5);
      // 잔교(널 부두)의 뭍 끝이 둑 네모 안이다
      const pier = /잔교\((\d+),(\d+)\)/.exec((data.coastWork as string[]).join(" "))!;
      expect(Number(pier[1])).toBeGreaterThanOrEqual(quay.x0);
      expect(Number(pier[1])).toBeLessThanOrEqual(quay.x1);
      expect(Number(pier[2])).toBeLessThanOrEqual(quay.y1);
      expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
    }, 240_000);
  });
  describe("빈 땅의 쓰임(planLandPlots) — 볼 것 없는 화면에 울타리 두른 밭", () => {
    // 40×30 맵, 왼쪽 위에 건물 하나(2~7, 2~5)뿐
    const W = 40, H = 30;
    const used = new Set<number>(); for (let y = 2; y < 6; y += 1) for (let x = 2; x < 8; x += 1) used.add(y * W + x);
    const inp = { W, H, seed: 3, used: (c: number) => used.has(c), free: (c: number) => !used.has(c) };
    it("건물이 걸리지 않는 창이 빈 창이고, 첫 밭 자리는 빈 창을 가장 많이 채운다", () => {
      const empty = emptyWindows(inp);
      expect(empty.length).toBe(16);
      expect(empty.some((e) => e.x === 0 && e.y === 0)).toBe(false); // 건물이 든 창
      const plots = planLandPlots(inp);
      expect(plots.length).toBeGreaterThan(0);
      expect(plots[0]!.windows).toBe(16);
      for (let i = 1; i < plots.length; i += 1) expect(plots[i]!.windows).toBeLessThanOrEqual(plots[i - 1]!.windows);
      // 밭(울타리 포함)을 깔면 빈 창이 없어진다
      const p = plots[0]!; const after = new Set(used);
      for (let j = -1; j <= p.h; j += 1) for (let i = -1; i <= p.w; i += 1) after.add((p.y + j) * W + p.x + i);
      expect(emptyWindows({ ...inp, used: (c) => after.has(c) }).length).toBe(0);
    });
    it("빈 창이 없거나 빈 땅이 없으면 자리도 없다", () => {
      expect(planLandPlots({ ...inp, used: () => true })).toEqual([]);
      expect(planLandPlots({ ...inp, free: () => false })).toEqual([]);
    });

    it("넓은 시골 마을: 빈 땅에 밭이 더 서고, 울타리 문은 모두 길에서 닿는다 · 읍에는 서지 않는다", () => {
      const { data } = town({ seed: 8, width: 64, height: 56, houseCount: 4 });
      expect(data.rank).toBe("village");
      expect(data.landPlots as number).toBeGreaterThanOrEqual(3);
      const gates = data.fenceGates as { reached: boolean }[];
      expect(gates.length).toBeGreaterThanOrEqual(data.landPlots as number);
      expect(gates.filter((g) => !g.reached).length).toBe(0);
      expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
      expect(town({ walls: true, form: "plaza", seed: 17 }).data.landPlots).toBeUndefined();
    }, 480_000);
  });
  describe("자갈 재질은 어느 급에도 쓰지 않는다(오너 «강자갈 마당은 너무 어색하군» · «광장이 이렇게 깔끔해야 맞지»)", () => {
    type Surface = { road?: string; roadEdge?: string; plaza?: string; track?: string | null; en: string };
    const spec = JSON.parse(readFileSync("tiledata/beodeul-looks/spec.json", "utf8")) as { surfaces: Record<string, Surface> };
    it("굽는 명세: 어느 겉모습도 광장에 강자갈을, 거리에 맨흙·자갈을, 흙길(정착지의 흙 몸)에 자갈을 쓰지 않는다", () => {
      expect(Object.keys(spec.surfaces).length).toBeGreaterThanOrEqual(6);
      for (const [id, surface] of Object.entries(spec.surfaces)) {
        expect([undefined, null, "road-dirt"], id).toContain(surface.track);
        expect(surface.plaza, id).not.toBe("plaza-cobble");
        expect(["road-dirt", "road-gravel"], id).not.toContain(surface.road);
        // 읍의 광장 테는 길 재질로 깐다 — 길이 포장이어야 광장과 거리가 한 몸이다(턱 있는 포석)
        expect(surface.roadEdge, id).toBe("kerb");
        expect(surface.en, id).not.toMatch(/cobble|gravel|dirt road/);
      }
    });
    it("맨흙·마른 풀 겉모습의 포구 읍: 광장 테와 안이 모두 깔리고(테는 길 포석 · 안은 광장 돌), 둑은 광장 판석 그대로다", () => {
      const PLAZA_TILE = 1509; // «버들항 광장 판석» 몸통 — 겉모습이 이 칸의 그림을 그 게임의 광장 재질로 바꾼다
      for (const look of ["steppe", "frontier"]) {
        const project = createBlankProject() as Project;
        (ownTileset(project, TS) as unknown as { look: unknown }).look = { textureKey: "tex_beodeul_looks", surface: look };
        const ctx = { project, currentMapId: project.startMapId } as ToolContext;
        const res = runTool(ctx, "author_beodeul_town", { theme: "coast", seed: 23, houseCount: 4, form: "plaza" });
        expect(res.ok, res.summary).toBe(true);
        const data = res.data as { mapId: string; rank: string; square: { x0: number; y0: number; x1: number; y1: number }; quay?: { x0: number; y0: number; x1: number; y1: number }; doors: { reached: boolean }[] };
        const map = ctx.project.maps[data.mapId]!;
        expect(data.rank, look).toBe("town");
        expect(data.doors.filter((d) => !d.reached).length, look).toBe(0);
        const meta = ctx.project.tilesets[TS]!.tileMeta ?? [];
        const tags = (x: number, y: number) => (meta[map.lowerTiles[y * map.width + x]!]?.tags ?? []) as readonly string[];
        const sq = data.square;
        for (const [x, y] of [[sq.x0, sq.y0], [sq.x1, sq.y0], [sq.x0, sq.y1], [sq.x1, sq.y1]] as const) expect(tags(x, y), `${look} 테 (${x},${y})`).toContain("road");
        for (let y = sq.y0 + 1; y < sq.y1; y += 1) for (let x = sq.x0 + 1; x < sq.x1; x += 1) expect(tags(x, y), `${look} 안 (${x},${y})`).toContain("plaza");
        if (data.quay) {
          let plazaTiles = 0;
          for (let y = data.quay.y0; y <= data.quay.y1; y += 1) for (let x = data.quay.x0; x <= data.quay.x1; x += 1) if (map.lowerTiles[y * map.width + x] === PLAZA_TILE) plazaTiles += 1;
          expect(plazaTiles, look).toBeGreaterThan(15);
        }
      }
    }, 480_000);
  });
});
