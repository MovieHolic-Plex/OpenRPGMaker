import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { beodeulBayObjects, beodeulObjectPick, beodeulObjectsCuttingWays, beodeulVergeObjects } from "@/editor/tools/beodeulObjectSets";
import { layerTileAt } from "@/project/mapLayers";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "@/project/types";
import catalog from "../tiledata/beodeul-objects/catalog.json";
import { BEODEUL_OBJECTS_BASE, BEODEUL_OBJECTS_KIT_PREFIX, createBeodeulCityTileset, ensureBeodeulCityReferences, ensureBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { buildObjectGenRequest, existingMatches } from "@/editor/tools/objectGenTool";
import { canMove, isPassable } from "@/project/collision";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { BEODEUL_OBJECT_KIT_PREFIX } from "@/assets/beodeulPlaceableObjects";
import kindTable from "../tiledata/beodeul-objects/kinds.json";
import { isCentrepieceKit, squareRefusal, squareSpot, squareZones, townSquares, TOWN_SQUARE_TAG } from "@/editor/tools/beodeulSquareGuard";
import { squareInnerWhole, squareRing } from "@/editor/tools/beodeulTownCore";
import type { ToolContext } from "@/editor/tools/types";
import { createBeodeulStarterMap } from "@/editor/content/beodeulStarterMap";
import { analyzeCityForm, detectKitStamps } from "@/editor/tools/cityForm";
import { isolateTimers } from "./mergedTeardown";

// 버들항 새 종류 기물을 빌더가 놓는다(editor/tools/beodeulObjectSets.ts): 게임 열쇠로 쓰임마다 몇 가지를 고르고(한 게임은 한 벌, 게임이 다르면 다른 벌),
// 강가·포구 마을을 조수 실행으로 지으면 놓인다. 열쇠가 없으면 아무것도 놓지 않는다 — 사람 편집·스크립트는 전과 같다. 문 앞 도달은 그대로다.
describe("beodeulObjectSets", () => {
  isolateTimers();
  const NEWS = (catalog.items as { kit: string; waiver?: string; on?: string; rows: number[][] }[]).filter((item) => item.waiver === "fable-objects100-beodeul-2026-11-14");
  const KEYS = ["ashvale", "moonharbor", "thornkeep", "reedwater"].map((name) => JSON.stringify(["project", `variety-${name}`]));
  // 빈 프로젝트를 한 번만 만들어 사본으로 쓴다(게임마다 새로 만들면 CI 한도를 넘긴다 — kitLook 시험과 같은 까닭)
  const TEMPLATE = JSON.stringify(createBlankProject());
  const fresh = () => JSON.parse(TEMPLATE) as Project;
  function newKitsOn(map: GameMap): string[] {
    const found: string[] = [];
    for (const item of NEWS) {
      const cells = item.rows.flatMap((row, dy) => row.map((tile, dx) => ({ dx, dy, tile })).filter((cell) => cell.tile >= 0));
      for (let y = 0; y + item.rows.length <= map.height; y++) for (let x = 0; x + item.rows[0]!.length <= map.width; x++)
        if (cells.every((cell) => layerTileAt(map, 3, (y + cell.dy) * map.width + x + cell.dx) === cell.tile)) found.push(item.kit);
    }
    return found;
  }
  function village(key: string | undefined, theme: "river" | "coast", seed: number) {
    const ctx = { project: fresh(), ...(key ? { assistantRun: true, lookKey: key } : {}) };
    const result = runTool(ctx, "author_beodeul_town", { theme, form: "plaza", terrain: "flat", seed, id: `v_${theme}_${seed}` } as never);
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { mapId: string; newObjects?: Record<string, number>; doors: { reached: boolean }[]; stampFailed: number };
    return { data, project: ctx.project, map: ctx.project.maps[data.mapId]! };
  }
  describe("버들항 새 종류 기물 — 게임마다 한 벌", () => {
    it("한 쓰임의 물건은 열쇠로 정해진다 — 같은 열쇠는 늘 같은 목록, 열쇠가 다르면 갈린다", () => {
      const pool = NEWS.map((item) => item.kit);
      const picks = KEYS.map((key) => beodeulObjectPick(pool, 5, key, "home"));
      for (const [n, key] of KEYS.entries()) expect(beodeulObjectPick([...pool].reverse(), 5, key, "home")).toEqual(picks[n]); // 후보 순서와 무관
      expect(new Set(picks.map((pick) => pick.join())).size).toBe(KEYS.length);
      // 쓰임이 다르면 같은 게임에서도 다른 목록
      expect(beodeulObjectPick(pool, 5, KEYS[0]!, "plaza")).not.toEqual(picks[0]);
      // 열쇠가 없으면 길섶·숲 끝에 더하는 것이 없다
      expect(beodeulVergeObjects(() => true, undefined)).toEqual([]);
      expect(beodeulBayObjects(() => true, undefined)).toEqual([]);
      expect(beodeulVergeObjects(() => true, KEYS[0]).length).toBe(3);
      expect(beodeulVergeObjects(() => false, KEYS[0])).toEqual([]);
    });

    it("길목에 선 기물만 걷어 낸다 — 걷는 땅을 둘로 가르는 것, 나란히 목을 막은 둘 가운데 뒤의 것", () => {
      // '#' 막힌 칸 · '.' 걷는 칸 · 'o' 기물이 선 칸(막힘)
      const cutting = (rows: string[], objects: { x: number; y: number; w: number; h: number }[]) =>
        beodeulObjectsCuttingWays(rows[0]!.length, rows.length, objects, (x, y) => rows[y]?.[x] === ".", () => true);
      // 한 칸 폭 길 한가운데: 양쪽이 갈린다
      expect(cutting(["#######", "...o...", "#######"], [{ x: 3, y: 1, w: 1, h: 1 }])).toEqual([0]);
      // 트인 풀밭 한가운데: 돌아갈 수 있다
      expect(cutting([".....", ".....", "..o..", ".....", "....."], [{ x: 2, y: 2, w: 1, h: 1 }])).toEqual([]);
      // 두 칸 폭 목을 둘이 나란히 막았다: 하나만 걷으면 열린다 — 뒤의 것만 걷는다(하나씩 걷어 보는 검사로는 못 잡는 경우)
      expect(cutting(["#####", "..o..", "..o..", "#####"], [{ x: 2, y: 1, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 }])).toEqual([1]);
      // 막다른 한 칸(위·아래 끝)을 가두는 것도 걷는다
      expect(cutting(["##.##", "..o..", "..o..", "##.##"], [{ x: 2, y: 1, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 }])).toEqual([0, 1]);
      // 디딜 수 없는 사이(단이 다른 칸)는 원래 따로다 — 그 경계에 선 기물은 길목이 아니다
      expect(beodeulObjectsCuttingWays(5, 1, [{ x: 2, y: 0, w: 1, h: 1 }], (x) => x !== 2, (x, _y, nx) => (x < 2) === (nx < 2) && x !== 2 && nx !== 2)).toEqual([]);
    });

    it("조수 실행(게임 열쇠)으로 지은 강가 마을에는 새 기물이 놓이고, 열쇠가 없으면 하나도 없다 — 문 앞 도달·찍기 실패는 같다", () => {
      const plain = village(undefined, "river", 7);
      expect(plain.data.newObjects).toBeUndefined();
      expect(newKitsOn(plain.map)).toEqual([]);
      const a = village(KEYS[0], "river", 7), again = village(KEYS[0], "river", 7), b = village(KEYS[1], "river", 7);
      const kitsA = newKitsOn(a.map), kitsB = newKitsOn(b.map);
      expect(kitsA.length).toBeGreaterThanOrEqual(10);
      expect(Object.values(a.data.newObjects ?? {}).reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(10);
      // 같은 게임·같은 씨앗은 같은 마을이다
      expect(newKitsOn(again.map)).toEqual(kitsA);
      // 게임이 다르면 놓인 종류가 다르다
      expect([...new Set(kitsB)].sort()).not.toEqual([...new Set(kitsA)].sort());
      for (const built of [a, b]) {
        expect(built.data.doors.filter((door) => !door.reached).length).toBe(plain.data.doors.filter((door) => !door.reached).length);
        expect(built.data.stampFailed).toBe(plain.data.stampFailed);
      }
    }, 240_000);

    it("포구 마을의 물 위 것은 모두 물 칸 위에 있다", () => {
      const built = village(KEYS[2], "coast", 7);
      expect((built.data.newObjects?.water ?? 0) + (built.data.newObjects?.shore ?? 0)).toBeGreaterThan(0);
      const meta = built.project.tilesets[built.map.tilesetId]!.tileMeta ?? [];
      let seen = 0;
      for (const item of NEWS.filter((it) => it.on === "water")) {
        const cells = item.rows.flatMap((row, dy) => row.map((tile, dx) => ({ dx, dy, tile })).filter((cell) => cell.tile >= 0));
        for (let y = 0; y + item.rows.length <= built.map.height; y++) for (let x = 0; x + item.rows[0]!.length <= built.map.width; x++) {
          if (!cells.every((cell) => layerTileAt(built.map, 3, (y + cell.dy) * built.map.width + x + cell.dx) === cell.tile)) continue;
          seen += 1;
          for (const cell of cells) {
            const ground = built.map.lowerTiles[(y + cell.dy) * built.map.width + x + cell.dx]!;
            expect(meta[ground]?.tags?.includes("water"), `${item.kit} (${x + cell.dx},${y + cell.dy})`).toBe(true);
          }
        }
      }
      expect(seen).toBe(built.data.newObjects?.water ?? 0);
    }, 240_000);
  });
});

// 버들항 이야기 기물(bd-obj-*, 시트 꼬리 34,944~): 새 사본·옛 사본이 킷과 참고문서를 갖는지, 칸 표가 선언(막힘·★·바닥 그림)과 같은지,
// 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 종류별 변형(ai.variantOf — 우물·벤치·이정표 등의 다른 그림): 원본 킷과 칸 크기·칸마다 통행·겹침이 같은지, 종류 이름(«우물»)은 여전히 원본을 첫째로 짚는지.
// 새 종류(2026-11-14 — 마을 살림·물가와 물 위·농장·숲 바닥·절벽 바위·유적과 묘지): 변형이 아닌 새 물건. 낱말로 찾아지는지, 물 위 것은 물 칸에만 놓이는지, 징검돌이 물을 건너게 하는지.
// 마을 종류별 기물(2026-11-14 — 마을 종류마다 생업 장면 한 벌과 공통 기물): 새 종류 뒤에 덧붙는다. 킷 태그 kind:<종류 id> 가 kinds.json 과 같은지, 밟는 물 위 것(줄 나룻배·빨래 디딤판·건널 널)과 걸어 지나는 문.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 · 변형은 fable-variety-beodeul-2026-11-12 · 새 종류는 fable-objects100-beodeul-2026-11-14 · 마을 종류별 기물은 fable-objects300-beodeul-2026-11-14 (굽기 scripts/content/beodeul-objects/bake.py).
describe("beodeulObjects", () => {
  isolateTimers();
  const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => kit.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX));
  // 배치 기물 묶음(bd-object:, #4849·#4850)은 종류 낱말(우물·통발…)을 태그로 그대로 달아 existingMatches 의 «태그 선언»(순위 1)으로
  // 이름만 든 원본 킷(순위 2)보다 앞선다. 아래 순서 시험은 원본·변형·이야기 기물 사이의 순서를 본다 — 묶음 행은 건너 첫째를 읽는다.
  const firstBesidesPlaceablePack = (project: Project, ts: TilesetDef, title: string) =>
    existingMatches(project, ts, title).find((row) => !row.id.startsWith(BEODEUL_OBJECT_KIT_PREFIX))?.id;
  type CatalogItem = (typeof catalog.items)[number] & { variantOf?: string; on?: string; kinds?: string[]; growth?: string };
  const ITEMS = catalog.items as CatalogItem[];
  const NEW_WAIVER = "fable-objects100-beodeul-2026-11-14";
  const NEWS = ITEMS.filter((item) => item.waiver === NEW_WAIVER);
  const KIND_WAIVER = "fable-objects300-beodeul-2026-11-14";
  const KINDS = ITEMS.filter((item) => item.waiver === KIND_WAIVER);
  const variantOf = (kit: StructureKitDef | undefined) => (kit?.ai as { variantOf?: string } | undefined)?.variantOf;
  describe("버들항 이야기 기물 꼬리", () => {
    it("새 사본은 목록의 킷(이야기 기물 16종 + 종류별 변형)을 모두 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸·바닥 그림)", () => {
      const ts = createBeodeulCityTileset();
      const kits = own(ts.structureKits);
      expect(kits.map((kit) => kit.id)).toEqual(catalog.items.map((item) => item.kit));
      expect(catalog.base).toBe(BEODEUL_OBJECTS_BASE);
      expect(ITEMS.filter((item) => !item.variantOf && item.waiver !== NEW_WAIVER && item.waiver !== KIND_WAIVER)).toHaveLength(16);
      expect(catalog.count % ts.tilesPerRow).toBe(0);
      for (const item of catalog.items) {
        const kit = kits.find((k) => k.id === item.kit)!;
        expect(kit.learnedFrom).toBe("pack-preset");
        expect(kit.rows.map((row) => row.upperTiles)).toEqual(item.rows);
        expect(kit.ai?.description).toContain("3/4 관문 미통과");
        item.rows.forEach((row, y) => row.forEach((tile, x) => {
          if (tile < 0) return;
          expect(tile).toBeGreaterThanOrEqual(BEODEUL_OBJECTS_BASE);
          expect(tile).toBeLessThan(catalog.count);
          const blocked = item.block.some(([bx, by]) => bx === x && by === y);
          expect(ts.passability[tile]!.up).toBe(!blocked);
          expect(ts.priority[tile]).toBe(blocked || item.place === "decal" ? "lower" : "upper");
        }));
      }
      // 번들 자신의 이식 칸은 시트 끝 뒤에서 시작한다(시트 꼬리가 이식 칸과 겹치지 않는다)
      expect(Math.min(...(ts.tileGrafts ?? []).map((graft) => graft.targetTile))).toBeGreaterThanOrEqual(catalog.count);
      expect((ts.referenceDocuments ?? []).some((category) => category.id === "beodeul-objects")).toBe(true);
    });

    it("킷·참고문서가 빠진 옛 사본은 다시 받고, 저자 킷은 남는다", () => {
      const ts = createBeodeulCityTileset();
      const authored = { ...structuredClone(ts.structureKits![0]!), id: "my-kit" } as StructureKitDef;
      ts.structureKits = [...ts.structureKits!.filter((kit) => !kit.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX)), authored];
      ts.referenceDocuments = (ts.referenceDocuments ?? []).filter((category) => category.id !== "beodeul-objects");
      expect(ensureBeodeulCityTileset(ts)).toBe(true);
      expect(ensureBeodeulCityReferences(ts)).toBe(true);
      expect(own(ts.structureKits)).toHaveLength(catalog.items.length);
      expect(ts.structureKits!.some((kit) => kit.id === "my-kit")).toBe(true);
      expect((ts.referenceDocuments ?? []).some((category) => category.id === "beodeul-objects")).toBe(true);
      expect(ensureBeodeulCityTileset(ts)).toBe(false);
      expect(ensureBeodeulCityReferences(ts)).toBe(false);
    });

    it("게임이 바란 낱말이 그 킷을 첫째로 짚는다 — 한 글자 이름(샘)과 끝 낱말이 지형(판자 길)인 이름도", () => {
      const project = createBlankProject() as Project;
      const mapId = project.startMapId;
      const ts = project.tilesets[project.maps[mapId]!.tilesetId]!;
      const first = (title: string) => existingMatches(project, ts, title)[0]?.id;
      expect(first("샘")).toBe("bd-obj-spring");
      expect(first("봉인 제단")).toBe("bd-obj-seal-altar");
      expect(first("무너진 기둥")).toBe("bd-obj-broken-pillar");
      expect(first("유적 입구")).toBe("bd-obj-ruin-entrance");
      expect(first("게시판")).toBe("bd-obj-notice-board");
      expect(first("쪽지")).toBe("bd-obj-note");
      const ask = (title: string) => () => buildObjectGenRequest(project, { mapId, title, description: `${title} 하나`, objectKind: "floor", need: `${title} 을 놓고 싶다` });
      // 끝 낱말은 «길»(지형)이지만 킷이 그 이름을 태그로 달았다 — 「칸 타일이 없다」가 아니라 그 킷을 이른다
      expect(ask("판자 길")).toThrow(/지형[^]*bd-obj-plank-ew/u);
      // 그런 선언이 없는 지형 이름은 예전처럼 지형으로 돌려보낸다
      expect(ask("자갈 도로")).toThrow(/지형·바닥·벽 칸/u);
      // 봤는데 다른 물건이라고 밝히면(notThese) 그 킷을 건너뛴다
      const others = existingMatches(project, ts, "샘").map((row) => row.id);
      expect(() => buildObjectGenRequest(project, { mapId, title: "샘", description: "돌 샘", objectKind: "floor", need: "샘", notThese: others })).not.toThrow(/이미 있다/u);
    });

    it("변형 킷은 원본 킷과 칸 크기가 같고, 칸마다 통행·겹침이 같다 — 갈아 끼워도 배치·통행이 그대로다", () => {
      const ts = createBeodeulCityTileset();
      const kitById = new Map((ts.structureKits ?? []).map((kit) => [kit.id, kit] as const));
      const variants = ITEMS.filter((item) => item.variantOf);
      expect(variants.length).toBeGreaterThanOrEqual(40);
      const families = new Map<string, number>();
      for (const item of variants) {
        const kit = kitById.get(item.kit)!, base = kitById.get(item.variantOf!)!;
        expect(base, item.variantOf).toBeTruthy();
        expect(variantOf(base)).toBeUndefined(); // 변형의 변형은 없다
        expect(base.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX)).toBe(false); // 원본은 원래 있던 킷이다
        expect(variantOf(kit)).toBe(base.id);
        expect([kit.width, kit.height]).toEqual([base.width, base.height]);
        expect(kit.ai?.role).toBe(base.ai?.role);
        for (let y = 0; y < kit.height; y++) for (let x = 0; x < kit.width; x++) {
          const mine = kit.rows[y]!.upperTiles![x]!, theirs = base.rows[y]!.upperTiles![x]!;
          if (mine < 0) {
            // 변형이 비운 칸: 원본도 비었거나 원본의 그 칸이 걸음 칸(★·○)이어야 한다 — 막힌 칸을 비우면 통행이 달라진다
            expect(theirs < 0 || passageMarkForTile(ts, theirs) !== "x", `${kit.id} (${x},${y})`).toBe(true);
            continue;
          }
          // 원본이 비운 칸에는 그림을 두지 않는다 — 원본이 들어가는 자리면 변형도 들어간다
          expect(theirs >= 0, `${kit.id} (${x},${y})`).toBe(true);
          // 통행 표시(X 막힘 · ★ 사람 위 걸음 칸 · ○ 걸음 칸) — 엔진의 통행과 그리는 순서가 이 표시로 정해진다
          expect(passageMarkForTile(ts, mine), `${kit.id} (${x},${y})`).toBe(passageMarkForTile(ts, theirs));
        }
        // 빈 땅 채우기에 흩어 쓰지 않는다 — 원본이 놓이던 자리에만 온다
        expect(kit.ai?.tags).toContain("주제 소품");
        families.set(base.id, (families.get(base.id) ?? 0) + 1);
      }
      expect(families.size).toBeGreaterThanOrEqual(12);
      for (const count of families.values()) expect(count).toBeLessThanOrEqual(5);
    });

    it("종류 이름은 여전히 원본 킷을 첫째로 짚고, 변형만의 낱말은 그 변형을 짚는다", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
      const first = (title: string) => firstBesidesPlaceablePack(project, ts, title);
      expect(first("우물")).toBe("bd-prop-well_roofed");
      expect(first("벤치")).toBe("bd-prop-bench_wood");
      expect(first("이정표")).toBe("bd-out-signpost");
      expect(first("빨래")).toBe("bd-prop-laundry_rack");
      expect(first("꽃밭")).toBe("bd-prop-flowerbed");
      expect(first("입간판")).toBe("bd-prop-sandwich_board");
      expect(first("펌프")).toBe("bd-obj-well-pump");
      expect(first("돌 벤치")).toBe("bd-obj-bench-stone");
    });

    it("새 종류는 변형이 아닌 새 물건이다 — 덧붙이기 전용 자리, 물 위 것은 «물 위» 태그, 낱말이 그 킷을 첫째로 짚는다", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
      const kitById = new Map((ts.structureKits ?? []).map((kit) => [kit.id, kit] as const));
      expect(NEWS.length).toBeGreaterThanOrEqual(100);
      // 덧붙이기 전용: 새 종류는 목록의 끝에 오고, 그 앞 66종(이야기 기물 16 + 변형 50)의 순서는 그대로다
      expect(ITEMS.slice(0, 66).every((item) => item.waiver !== NEW_WAIVER)).toBe(true);
      expect(ITEMS.slice(66, 66 + NEWS.length).every((item) => item.waiver === NEW_WAIVER)).toBe(true);
      expect(NEWS).toHaveLength(105);
      expect(ITEMS[0]!.rows[0]![0]).toBe(BEODEUL_OBJECTS_BASE);
      expect(ITEMS[65]!.id).toBe("pile-amphorae");
      expect(ITEMS[65]!.rows).toEqual([[35110, 35111], [35112, 35113]]);
      for (const item of NEWS) {
        const kit = kitById.get(item.kit)!;
        expect(variantOf(kit), item.kit).toBeUndefined();
        expect(kit.ai?.tags).toContain("주제 소품");
        expect(kit.ai?.tags?.includes("물 위"), item.kit).toBe(item.on === "water");
        // 한국어 낱말과 영어 낱말이 하나씩은 있다
        expect(item.words.some((word) => /[가-힣]/u.test(word)), item.kit).toBe(true);
        expect(item.words.some((word) => /^[a-z' -]+$/iu.test(word)), item.kit).toBe(true);
      }
      const first = (title: string) => firstBesidesPlaceablePack(project, ts, title);
      expect(first("벌통")).toBe("bd-obj-beehive-skeps");
      expect(first("뗏목")).toBe("bd-obj-raft-log");
      expect(first("부표")).toBe("bd-obj-buoy");
      expect(first("묘비")).toBe("bd-obj-gravestone");
      expect(first("고인돌")).toBe("bd-obj-dolmen");
      expect(first("선바위")).toBe("bd-obj-boulder-tall");
      expect(first("beehive")).toBe("bd-obj-beehive-skeps");
      expect(first("gravestone")).toBe("bd-obj-gravestone");
      // 이미 있던 물건의 이름은 여전히 옛 킷이 먼저 받는다
      expect(first("징검돌")).toBe("bd-pick-deep-forest-path-stones-a");
      expect(first("큰 바위")).toBe("bd-org-rock-boulder-l");
      expect(first("작은 바위")).toBe("bd-org-rock-s");
      expect(first("큰 그루터기")).toBe("bd-org-stump-l");
      expect(first("통발")).toBe("bd-pick-fishing-port-lobster-pots");
    });

    it("물 위 것은 물 칸 위에만 놓이고 물은 막힌 그대로다 — 징검돌만 그 물 칸을 걷게 한다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "", assistantRun: true };
      const mapId = ctx.project.startMapId;
      ctx.currentMapId = mapId;
      const shore = ctx.project.tilesets.beodeul_city!.autotileGroups!.find((group) => group.id === "beodeul_lakeshore_grass")!;
      const water = shore.variantMap!["255"]!;
      {
        const map = ctx.project.maps[mapId]!;
        // 못 6×4: x 2~7, y 6~9 (둘레는 풀)
        for (let y = 6; y <= 9; y++) for (let x = 2; x <= 7; x++) { map.lowerTiles[y * map.width + x] = water; map.upperTiles[y * map.width + x] = -1; }
        for (let y = 4; y <= 11; y++) for (let x = 0; x <= 9; x++) if (!(x >= 2 && x <= 7 && y >= 6 && y <= 9)) map.upperTiles[y * map.width + x] = -1;
      }
      const stamp = (objectId: string, x: number, y: number) => runTool(ctx, "stamp_tileset_object", { mapId, objectId, base: { x, y } });
      const before = JSON.stringify(ctx.project.maps[mapId]);
      // 뭍에 뗏목·징검돌, 물 위에 벌통 — 거절되고 맵이 그대로다
      expect(stamp("bd-obj-raft-log", 2, 12).ok).toBe(false);
      expect(stamp("bd-obj-step-stone-a", 1, 5).ok).toBe(false);
      expect(stamp("bd-obj-beehive-skeps", 2, 8).ok).toBe(false);
      expect(JSON.stringify(ctx.project.maps[mapId])).toBe(before);
      // 물 위 뗏목 2×2: 놓이고, 그 칸은 놓기 전과 같이 막혀 있다
      expect(isPassable(ctx.project, ctx.project.maps[mapId]!, 2, 7)).toBe(false);
      expect(stamp("bd-obj-raft-log", 2, 7).ok).toBe(true);
      for (const [x, y] of [[2, 6], [3, 6], [2, 7], [3, 7]] as const) expect(isPassable(ctx.project, ctx.project.maps[mapId]!, x, y)).toBe(false);
      // 징검돌 넷으로 못을 세로로 건넌다: (6,5) 풀 → (6,6)~(6,9) 돌 → (6,10) 풀
      for (let y = 6; y <= 9; y++) expect(stamp(y % 2 ? "bd-obj-step-stone-b" : "bd-obj-step-stone-a", 6, y).ok).toBe(true);
      const map = ctx.project.maps[mapId]!;
      for (let y = 5; y < 10; y++) expect(canMove(ctx.project, map, 6, y, 6, y + 1), `(6,${y})→(6,${y + 1})`).toBe(true);
      // 돌 옆 물 칸은 여전히 막혀 있다
      expect(isPassable(ctx.project, map, 5, 7)).toBe(false);
      expect(isPassable(ctx.project, map, 7, 7)).toBe(false);
    });

    it("마을 종류별 기물은 새 종류 뒤에 덧붙고, 종류마다 한 벌이 있으며 킷 태그 kind:<종류 id> 가 kinds.json 과 같다", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
      const kitById = new Map((ts.structureKits ?? []).map((kit) => [kit.id, kit] as const));
      expect(KINDS.length).toBeGreaterThanOrEqual(280);
      // 덧붙이기 전용: 앞 171종(이야기 기물 16 + 변형 50 + 새 종류 105)의 자리와 칸 번호는 그대로다
      expect(ITEMS.slice(0, 171).every((item) => item.waiver !== KIND_WAIVER)).toBe(true);
      expect(ITEMS.slice(171).every((item) => item.waiver === KIND_WAIVER)).toBe(true);
      expect(ITEMS[170]!.id).toBe("ruin-fountain");
      expect(ITEMS[170]!.rows).toEqual([[35364, 35365], [35366, 35367]]);
      expect(Math.min(...KINDS.flatMap((item) => item.rows.flat()).filter((tile) => tile >= 0))).toBe(35368);
      const names = kindTable.names as Record<string, string>;
      const table = kindTable.kinds as Record<string, string[]>;
      const kindIds = Object.keys(names).filter((id) => id !== "common");
      expect(kindIds.length).toBeGreaterThanOrEqual(30);
      expect(Object.keys(table).sort()).toEqual(KINDS.map((item) => item.kit).sort());
      for (const item of KINDS) {
        const kit = kitById.get(item.kit)!;
        expect(variantOf(kit), item.kit).toBeUndefined();
        expect(kit.ai?.tags).toContain("주제 소품");
        expect(kit.ai?.tags?.includes("물 위"), item.kit).toBe(item.on === "water");
        expect(item.kinds!.length, item.kit).toBeGreaterThan(0);
        expect(item.kinds!.every((id) => id in names), item.kit).toBe(true);
        expect((kit.ai?.tags ?? []).filter((tag) => tag.startsWith("kind:")).map((tag) => tag.slice(5)), item.kit).toEqual(item.kinds);
        expect(table[item.kit], item.kit).toEqual(item.kinds);
        expect(kit.ai?.repeatability, item.kit).toBe(item.growth ? "repeat" : "fixed");
        expect(item.words.some((word) => /[가-힣]/u.test(word)), item.kit).toBe(true);
        expect(item.words.some((word) => /^[a-z' -]+$/iu.test(word)), item.kit).toBe(true);
      }
      // 종류마다 한 벌(다섯 넘게) — 낱개로는 장면이 되지 않는다
      for (const id of kindIds) expect(KINDS.filter((item) => item.kinds!.includes(id)).length, id).toBeGreaterThanOrEqual(5);
      expect(KINDS.filter((item) => item.kinds!.includes("common")).length).toBeGreaterThanOrEqual(50);
      // 낱말이 그 킷을 첫째로 짚고, 옛 킷이 이름으로 가진 말은 옛 킷이 그대로 받는다
      const first = (title: string) => firstBesidesPlaceablePack(project, ts, title);
      const has = (id: string) => KINDS.some((item) => item.id === id);
      for (const [word, id] of [["담금 구유", "quench-trough"], ["편자 걸이", "horseshoe-rack"], ["소금 가마", "salt-pan"], ["사과 압착기", "cider-press"], ["층 분수", "tiered-fountain"], ["빵집 간판", "sign-bakery"], ["cider press", "cider-press"], ["quench trough", "quench-trough"]] as const) {
        if (has(id)) expect(first(word), word).toBe(`bd-obj-${id}`);
      }
      expect(first("우물")).toBe("bd-prop-well_roofed");
      expect(first("벤치")).toBe("bd-prop-bench_wood");
      expect(first("맷돌")).toBe("bd-pick-riverside-mill-millstones");
      expect(first("포도 압착기")).toBe("bd-pick-vineyard-wine-press");
      expect(first("모루")).toBe("bd-pick-castle-catacombs-anvil-table");
      expect(first("벌통")).toBe("bd-obj-beehive-skeps");
      expect(first("묘비")).toBe("bd-obj-gravestone");
      expect(first("쇠 울타리")).toBe("bd-obj-iron-fence");
    });

    it("밟는 물 위 것(줄 나룻배·건널 널)은 놓인 물 칸을 걷게 하고, 배와 말뚝은 막힌 그대로다 — 걸어 지나는 문은 빈 칸으로 지난다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "", assistantRun: true };
      const mapId = ctx.project.startMapId;
      ctx.currentMapId = mapId;
      const shore = ctx.project.tilesets.beodeul_city!.autotileGroups!.find((group) => group.id === "beodeul_lakeshore_grass")!;
      const water = shore.variantMap!["255"]!;
      {
        const map = ctx.project.maps[mapId]!;
        // 못 8×4: x 1~8, y 6~9 (둘레는 풀)
        for (let y = 6; y <= 9; y++) for (let x = 1; x <= 8; x++) map.lowerTiles[y * map.width + x] = water;
      }
      const has = (id: string) => KINDS.some((item) => item.id === id);
      const stamp = (objectId: string, x: number, y: number) => runTool(ctx, "stamp_tileset_object", { mapId, objectId, base: { x, y } });
      const map = () => ctx.project.maps[mapId]!;
      if (has("gangplank")) {
        // 뭍에는 거절
        const before = JSON.stringify(map());
        expect(stamp("bd-obj-gangplank", 9, 4).ok).toBe(false);
        expect(JSON.stringify(map())).toBe(before);
        // 건널 널 둘(1×2)을 세로로 이어 못을 건넌다: (8,5) 풀 → (8,6)~(8,9) 널 → (8,10) 풀
        expect(stamp("bd-obj-gangplank", 8, 7).ok).toBe(true);
        expect(stamp("bd-obj-gangplank", 8, 9).ok).toBe(true);
        for (let y = 5; y < 10; y++) expect(canMove(ctx.project, map(), 8, y, 8, y + 1), `(8,${y})→(8,${y + 1})`).toBe(true);
        expect(isPassable(ctx.project, map(), 7, 7)).toBe(false);
      }
      if (has("ferry-raft")) {
        // 줄 나룻배 3×2 를 못 윗가에: 뭍 (2,5) 에서 (2,6)·(2,7) 로 올라서고, 그 아래 물 (2,8) 은 막혀 있다
        expect(stamp("bd-obj-ferry-raft", 1, 7).ok).toBe(true);
        expect(canMove(ctx.project, map(), 2, 5, 2, 6)).toBe(true);
        expect(canMove(ctx.project, map(), 2, 6, 2, 7)).toBe(true);
        expect(isPassable(ctx.project, map(), 2, 8)).toBe(false);
      }
      if (has("punt")) {
        // 삿대 배 2×1: 물 위에만 놓이고 그 칸은 막힌 그대로다
        expect(stamp("bd-obj-punt", 4, 12).ok).toBe(false);
        expect(stamp("bd-obj-punt", 5, 9).ok).toBe(true);
        expect(isPassable(ctx.project, map(), 5, 9)).toBe(false);
        expect(isPassable(ctx.project, map(), 6, 9)).toBe(false);
      }
      // 걸어 지나는 문(맨 아래 줄 가운데가 빈 킷): 풀밭에 놓고 그 빈 칸을 아래에서 위로 지난다
      const gates = KINDS.filter((item) => item.rows.at(-1)!.some((tile) => tile < 0));
      // 맵은 20×15 — 못(y 6~9) 위쪽 풀밭 y 1~3 에 나란히 놓는다
      let gx = 2;
      for (const gate of gates) {
        const top = 1, base = top + gate.height - 1;
        expect(gx + gate.width, gate.kit).toBeLessThan(map().width);
        expect(stamp(gate.kit, gx, base).ok, gate.kit).toBe(true);
        gate.rows.at(-1)!.forEach((tile, dx) => {
          if (tile >= 0) { expect(isPassable(ctx.project, map(), gx + dx, base), `${gate.kit} 기둥`).toBe(false); return; }
          for (let y = base + 1; y > top - 1; y--) expect(canMove(ctx.project, map(), gx + dx, y, gx + dx, y - 1), `${gate.kit} (${dx}) ${y}→${y - 1}`).toBe(true);
        });
        gx += gate.width + 2;
      }
    });

    it("실제 놓기 도구로 놓으면 막힌 칸만 막힌다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "", assistantRun: true };
      const mapId = ctx.project.startMapId;
      ctx.currentMapId = mapId;
      const spring = catalog.items.find((item) => item.id === "spring")!;
      const tent = catalog.items.find((item) => item.id === "camp-tent")!;
      expect(runTool(ctx, "stamp_tileset_object", { mapId, objectId: spring.kit, base: { x: 3, y: 4 } }).ok).toBe(true);
      expect(runTool(ctx, "stamp_tileset_object", { mapId, objectId: tent.kit, base: { x: 7, y: 4 } }).ok).toBe(true);
      const map = ctx.project.maps[mapId]!;
      // 샘 2×2 는 네 칸 모두 막힘, 천막 2×2 는 아랫줄만 막히고 윗줄은 사람 위에 그려지는 걸음 칸
      for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4], [7, 4], [8, 4]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(false);
      for (const [x, y] of [[7, 3], [8, 3]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(true);
      expect(map.upperTiles[3 * map.width + 7]).toBe(tent.rows[0]![0]);
    });
  });
});

// 읍 광장의 놓기 규칙(editor/tools/beodeulSquareGuard.ts): 가운데 기물은 하나, 소품은 가장자리 줄에, 가운데와 테 줄은 비우고, 기물끼리 겹치지 않는다.
// 2026-11-15 실모델 확인 판 r5 «갈매기 포구»: 시공기가 놓은 원주·우물·좌판 위에 조수가 우물·돌 수조·좌판을 더 찍어 작은 광장에 물 기물 셋이 겹쳐 섰다.
describe("beodeulSquareGuard", () => {
  isolateTimers();
  const TS = "beodeul_city";
  const WELL = { id: "well", ai: { tags: ["prop", "water"] }, rows: [{ tiles: [-1], upperTiles: [900] }] };
  const STALL = { id: "stall", ai: { tags: ["prop", "market"] }, rows: [{ tiles: [-1], upperTiles: [901] }] };
  const RIVER = { id: "river", ai: { tags: ["water"] }, rows: [{ tiles: [5], upperTiles: [902] }] };
  const TILESET = { structureKits: [WELL, STALL, RIVER] } as never;
  const FOOT = [{ dx: 0, dy: 0, foot: true }];
  /** 20×14 맵 가운데에 15×7 광장(테 포함) 하나. */
  function squareMap(tagged = true): GameMap {
    const W = 20, H = 14;
    return { id: "m", width: W, height: H, lowerTiles: new Array(W * H).fill(1), upperTiles: new Array(W * H).fill(-1), events: [],
      locations: tagged ? [{ id: "loc1", name: "광장", x: 2, y: 3, w: 15, h: 7, tags: [TOWN_SQUARE_TAG] }] : [] } as unknown as GameMap;
  }
  const put = (map: GameMap, x: number, y: number, tile: number) => { map.upperTiles[y * map.width + x] = tile; };
  describe("광장의 자리 — 테 · 안 · 가운데", () => {
    it("테 한 줄 안쪽이 돌바닥이고, 거기서 두 칸 들어간 네모가 가운데다 · 작은 광장은 가운데가 없다", () => {
      const z = squareZones({ x0: 2, y0: 3, x1: 16, y1: 9 });
      expect(z.inner).toEqual({ x0: 3, y0: 4, x1: 15, y1: 8 });
      expect(z.centre).toEqual({ x0: 5, y0: 6, x1: 13, y1: 6 });
      expect(squareZones({ x0: 0, y0: 0, x1: 5, y1: 4 }).centre).toBeNull();
    });
    it("맵에 적힌 광장 표시(town-square)만 읽는다 — 표시 없는 옛 맵은 규칙이 없다", () => {
      expect(townSquares(squareMap())).toHaveLength(1);
      expect(townSquares(squareMap(false))).toHaveLength(0);
      expect(squareRefusal(squareMap(false), TILESET, WELL, { x: 9, y: 6 }, FOOT, "well")).toBeUndefined();
    });
    it("가운데 기물 급은 킷 꼬리표로 안다 — 우물·분수·석상·원주, 제 바닥을 가져오는 물 지형 조각은 아니다", () => {
      expect(isCentrepieceKit(WELL)).toBe(true);
      expect(isCentrepieceKit({ id: "f", ai: { tags: ["tall", "plaza fountain"] } })).toBe(true);
      expect(isCentrepieceKit({ id: "s", ai: { tags: ["사자 석상"] } })).toBe(true);
      expect(isCentrepieceKit({ id: "c", ai: { tags: ["prop", "monument"] } })).toBe(true);
      expect(isCentrepieceKit(STALL)).toBe(false);
      expect(isCentrepieceKit({ id: "d", ai: { tags: ["dwelling"] } })).toBe(false);
      expect(isCentrepieceKit(RIVER)).toBe(false);
    });
  });
  describe("광장 규칙(squareRefusal)", () => {
    it("빈 광장에는 가운데 기물이 안쪽 어디든 선다 — 테 줄만 안 된다", () => {
      const map = squareMap();
      expect(squareRefusal(map, TILESET, WELL, { x: 9, y: 6 }, FOOT, "well")).toBeUndefined();
      expect(squareRefusal(map, TILESET, WELL, { x: 2, y: 6 }, FOOT, "well")?.code).toBe("square-open");
    });
    it("가운데 기물이 이미 있으면 둘째는 거절한다 — 가운데 자리에 선 것이든, 가장자리 줄의 우물이든", () => {
      const centre = squareMap(); put(centre, 9, 6, 777);
      expect(squareRefusal(centre, TILESET, WELL, { x: 12, y: 5 }, FOOT, "well")?.code).toBe("square-centrepiece");
      const edge = squareMap(); put(edge, 4, 8, 900);
      expect(squareRefusal(edge, TILESET, WELL, { x: 9, y: 6 }, FOOT, "well")?.code).toBe("square-centrepiece");
      // 광장 밖은 규칙이 없다
      expect(squareRefusal(centre, TILESET, WELL, { x: 18, y: 1 }, FOOT, "well")).toBeUndefined();
    });
    it("그 밖의 소품은 가장자리 줄에만 — 가운데 자리 · 가운데 곁 · 테 줄은 거절", () => {
      const map = squareMap();
      expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 6 }, FOOT, "stall")?.code).toBe("square-open"); // 가운데 자리
      expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 5 }, FOOT, "stall")?.code).toBe("square-open"); // 가장자리 줄에 닿지 않는다
      expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 3 }, FOOT, "stall")?.code).toBe("square-open"); // 테 줄
      expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 8 }, FOOT, "stall")).toBeUndefined(); // 남쪽 안줄
      expect(squareRefusal(map, TILESET, STALL, { x: 3, y: 6 }, FOOT, "stall")).toBeUndefined(); // 서쪽 안줄
      // 깊이 두 칸 좌판: 발이 안줄과 그 윗줄에 선다
      expect(squareRefusal(map, TILESET, STALL, { x: 6, y: 7 }, [{ dx: 0, dy: 0, foot: true }, { dx: 0, dy: 1, foot: true }], "stall")).toBeUndefined();
    });
    it("기물끼리 겹치지 않는다 — replace 는 밑의 것을 지우므로 겹침이 아니고, 덮이는 가운데 기물은 세지 않는다", () => {
      const map = squareMap(); put(map, 9, 8, 901); put(map, 9, 6, 900);
      expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 8 }, FOOT, "stall")?.code).toBe("square-overlap");
      expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 8 }, FOOT, "stall", { replace: true })).toBeUndefined();
      expect(squareRefusal(map, TILESET, WELL, { x: 9, y: 6 }, FOOT, "well", { replace: true })).toBeUndefined();
      expect(squareRefusal(map, TILESET, WELL, { x: 10, y: 6 }, FOOT, "well", { replace: true })?.code).toBe("square-centrepiece");
    });
    it("가까운 자리(squareSpot): 소품은 가장자리 줄로, 둘째 가운데 기물은 광장 밖으로", () => {
      const map = squareMap(); put(map, 9, 6, 900);
      const stall = squareSpot(map, TILESET, STALL, { x: 9, y: 5 }, FOOT, "stall", { free: () => true });
      expect(stall?.code).toBe("square-open");
      expect(stall?.free).toEqual({ x: 8, y: 4 });
      const well = squareSpot(map, TILESET, WELL, { x: 12, y: 5 }, FOOT, "well", { free: () => true });
      expect(well?.code).toBe("square-centrepiece");
      const f = well!.free!;
      expect(f.x < 2 || f.x > 16 || f.y < 3 || f.y > 9).toBe(true);
      // 광장 밖에 이미 선 우물 곁(두 칸 안)은 건너뛴다 — 물 기물 둘이 나란히 붙어 서지 않는다
      put(map, f.x, f.y, 900);
      const next = squareSpot(map, TILESET, WELL, { x: 12, y: 5 }, FOOT, "well", { free: () => true })!.free!;
      expect(Math.max(Math.abs(next.x - f.x), Math.abs(next.y - f.y))).toBeGreaterThan(2);
      expect(next.x < 2 || next.x > 16 || next.y < 3 || next.y > 9).toBe(true);
      // 다른 놓기 규칙이 모두 막으면 자리를 내지 않는다
      expect(squareSpot(map, TILESET, STALL, { x: 9, y: 5 }, FOOT, "stall", { free: () => false })?.free).toBeUndefined();
    });
  });
  describe("시공기와 찍기 도구", () => {
    const built = (() => {
      let cache: { ctx: ToolContext; mapId: string } | undefined;
      return () => {
        if (cache) return cache;
        const project = createBlankProject() as Project;
        const ctx = { project, currentMapId: project.startMapId } as ToolContext;
        const res = runTool(ctx, "author_beodeul_town", { theme: "river", seed: 7, form: "plaza" });
        expect(res.ok, res.summary).toBe(true);
        cache = { ctx, mapId: (res.data as { mapId: string }).mapId };
        return cache;
      };
    })();
    const upper = (map: GameMap, x: number, y: number) => (map.upperTiles[y * map.width + x] ?? -1) >= 0 || (map.upperOverlayTiles?.[y * map.width + x] ?? -1) >= 0;

    it("읍의 광장: 시공기가 광장을 맵에 적고, 광장에 걸친 물 기물·기념물은 하나뿐이며, 문은 모두 닿는다", () => {
      const { ctx, mapId } = built();
      const map = ctx.project.maps[mapId]!;
      const squares = townSquares(map);
      expect(squares).toHaveLength(1);
      const { box } = squares[0]!;
      const kits = ctx.project.tilesets[TS]!.structureKits ?? [];
      const pieces = (map.structurePlacements ?? []).filter((p) => p.x <= box.x1 && p.x + p.w > box.x0 && p.y <= box.y1 && p.y + p.h > box.y0)
        .filter((p) => isCentrepieceKit(kits.find((k) => k.id === p.kitId)));
      expect(pieces).toHaveLength(1);
    }, 240_000);

    it("stamp_object: 둘째 우물은 거절(한 줄 까닭과 광장 밖 가까운 자리), 가운데의 상자는 거절, nearest 는 가장자리 줄로 옮긴다", () => {
      const { ctx, mapId } = built();
      const map = () => ctx.project.maps[mapId]!;
      const z = townSquares(map())[0]!;
      const cy = Math.round((z.box.y0 + z.box.y1) / 2);
      // 가운데 줄에서 위층 그림이 없는 칸
      let free = -1;
      for (let x = z.centre!.x0; x <= z.centre!.x1 && free < 0; x += 1) if (!upper(map(), x, cy) && !upper(map(), x + 1, cy) && !upper(map(), x, cy + 1) && !upper(map(), x + 1, cy + 1)) free = x;
      expect(free).toBeGreaterThanOrEqual(0);
      const well = runTool(ctx, "stamp_object", { objectId: `kit:${TS}/bd-obj-well-windlass`, mapId, x: free, y: cy });
      expect(well.ok).toBe(false);
      expect(well.summary).toContain("already has its centrepiece");
      const crate = runTool(ctx, "stamp_object", { objectId: `kit:${TS}/bd-prop-crate_apple`, mapId, x: free, y: cy });
      expect(crate.ok).toBe(false);
      expect(crate.summary).toContain("kept open for walking");
      const moved = runTool(ctx, "stamp_object", { objectId: `kit:${TS}/bd-prop-crate_apple`, mapId, x: free, y: cy, onOverlap: "nearest" });
      expect(moved.ok, moved.summary).toBe(true);
      const at = (moved.data as { rect: { x: number; y: number } }).rect;
      const onEdge = at.x === z.inner.x0 || at.x === z.inner.x1 || at.y === z.inner.y0 || at.y === z.inner.y1;
      const outside = at.x < z.box.x0 || at.x > z.box.x1 || at.y < z.box.y0 || at.y > z.box.y1;
      expect(onEdge || outside).toBe(true);
      // 가운데 줄은 그대로 비어 있다
      expect(upper(map(), free, cy)).toBe(false);
    }, 240_000);
  });
  // 2026-11-15 명세 은행 lay-base-harbor «항구 마을»: 물가에 깎여 계단 꼴이 된 포구 광장을 테와 안으로 나눠 깔자 조각난 안마다 연석이 둘러졌다.
  describe("광장의 안이 한 덩이일 때만 테와 안을 나눠 깐다", () => {
    const W = 20;
    const cells = (rects: [number, number, number, number][]): number[] => rects.flatMap(([x0, y0, x1, y1]) => {
      const out: number[] = [];
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) out.push(y * W + x);
      return out;
    });
    it("네모 광장의 안은 한 덩이다", () => {
      const { ring, inner } = squareRing(W, 20, cells([[3, 3, 9, 8]]));
      expect(inner.length).toBe(5 * 4);
      expect(ring.length).toBe(7 * 6 - 5 * 4);
      expect(squareInnerWhole(W, inner)).toBe(true);
    });
    it("계단 꼴로 깎여 안이 둘로 갈라진 광장은 한 덩이가 아니다", () => {
      // 두 네모가 모서리 한 줄로만 이어진 꼴 — 안은 왼쪽 덩이와 오른쪽 덩이로 갈라진다
      const { inner } = squareRing(W, 20, [...new Set(cells([[2, 2, 6, 6], [6, 6, 11, 10]]))]);
      expect(inner.length).toBeGreaterThanOrEqual(6);
      expect(squareInnerWhole(W, inner)).toBe(false);
    });
    it("안이 여섯 칸이 안 되는 광장도 나누지 않는다", () => {
      const { inner } = squareRing(W, 20, cells([[3, 3, 6, 6]]));
      expect(inner.length).toBe(4);
      expect(squareInnerWhole(W, inner)).toBe(false);
    });
  });
});

// 실제 시작 마을(editor/content/beodeulStarterMap.ts — 「예제로 시작」·「작은 마을 추가하기」의 첫 맵)이 짓는 것:
// 집이 있고, 집마다 문 앞 칸까지 시작 칸에서 걸어갈 수 있고, 길이 한 덩어리다.
//
// 칸 번호를 적지 않는다(옛 시작 마을 시험들은 합본 마을 칸 번호를 적었다가 칩셋이 바뀌자 통째로 낡았다). 모두 짓는 쪽이 스스로 적어 둔 것에서 읽는다:
//  - 집과 문: 맵에 찍힌 블록 킷(detectKitStamps)의 입구 조각(parts kind:"entrance"). 문 앞 칸은 입구 조각 바로 아래 칸 —
//    도시 형태 점검이 문 앞을 세는 셈과 같다(cityForm.ts doorFronts: p.y + part.dy + part.h).
//  - 길: 도시 형태 점검(analyzeCityForm — check_city_form 이 돌려주는 것)의 길 그래프.
//  - 걷기: check_reachability 도구와 통행 판정(isPassable).
// beodeulStarterMap.test.ts 는 도구 실행기를 가짜로 바꿔 «짓는 문맥» 만 본다 — 이 파일은 진짜 도구로 지은 맵을 본다.
describe("beodeulStarterVillage", () => {
  isolateTimers();
  interface House {
    readonly block: string;
    readonly door: { readonly x: number; readonly y: number };
    readonly front: { readonly x: number; readonly y: number };
  }
  interface Village {
    readonly project: Project;
    readonly map: GameMap;
    readonly startPos: { readonly x: number; readonly y: number };
    readonly blocks: ReturnType<typeof detectKitStamps>;
    readonly houses: readonly House[];
  }
  let built: Village | undefined;
  /** 한 번만 짓는다 — 빈 프로젝트와 마을 짓기가 이 파일 시간의 거의 전부다(첫 경우의 시간에 실린다). */
  function village(): Village {
    if (built) return built;
    const blank = createBlankProject();
    const starter = createBeodeulStarterMap(blank);
    if (!starter) throw new Error("시작 마을을 짓지 못했다 — 기본 칩셋(버들항)이 빈 프로젝트에 없다");
    const { map, startPos } = starter;
    // 시작 마을이 첫 맵인 프로젝트(편집기가 「예제로 시작」에서 만드는 모양) — 점검 도구가 읽는다.
    const project = { ...blank, maps: { [map.id]: map }, mapTree: { mapId: map.id, children: [] }, startMapId: map.id, startPos: { ...blank.startPos, ...startPos } } as Project;
    const tileset = project.tilesets[map.tilesetId]!;
    const blocks = detectKitStamps(map, tileset);
    const houses = blocks.flatMap((block) => (tileset.structureKits?.find((kit) => kit.id === block.kitId)?.parts ?? [])
      .filter((part) => part.kind === "entrance")
      .map((part): House => ({
        block: block.kitId,
        door: { x: block.x + part.dx, y: block.y + part.dy },
        front: { x: block.x + part.dx, y: block.y + part.dy + part.h },
      })));
    built = { project, map, startPos, blocks, houses };
    return built;
  }
  describe("beodeul starter village (the real first map)", () => {
    it("has houses: the builder's blocks are on the map and declare at least one house door", () => {
      const { map, blocks, houses, project } = village();
      // 내용 파일은 집 수를 적지 않는다 — 버들항 블록 격자를 청할 뿐이다. 그래서 바닥은 «블록이 찍혀 있고, 그 블록들이 적어 둔 집 문이 하나 이상» 이다.
      expect(blocks.length).toBeGreaterThan(0);
      expect(analyzeCityForm(project, map).blocks.count).toBe(blocks.length);
      expect(houses.length).toBeGreaterThan(0);
      // 문은 건물 칸이고(걸어 들어갈 수 없다) 문마다 맵 안에 문 앞 칸이 있다.
      for (const house of houses) {
        expect(isPassable(project, map, house.door.x, house.door.y), `${house.block} door (${house.door.x},${house.door.y})`).toBe(false);
        expect(house.front.y, `${house.block} door front`).toBeLessThan(map.height);
      }
      // 같은 문 앞 칸을 두 집이 나눠 쓰지 않는다.
      expect(new Set(houses.map((house) => `${house.front.x},${house.front.y}`)).size).toBe(houses.length);
    });

    it("lets the player walk from the start position to the front of every house door", () => {
      const { project, map, startPos, houses } = village();
      expect(isPassable(project, map, startPos.x, startPos.y)).toBe(true);
      const blockedFronts = houses.filter((house) => !isPassable(project, map, house.front.x, house.front.y));
      expect(blockedFronts).toEqual([]);
      const ctx = { project };
      const reach = runTool(ctx, "check_reachability", { mapId: map.id, from: startPos, targets: houses.map((house) => house.front) });
      expect(reach.ok, reach.summary).toBe(true);
      expect(reach.data).toMatchObject({ reachable: true, unreachable: [] });
    });

    it("has one connected road network, and the start row runs as walkable road to the east edge", () => {
      const { project, map, startPos } = village();
      const form = analyzeCityForm(project, map);
      expect(form.lines.count).toBeGreaterThan(0);
      expect(form.graph.components).toBe(1);
      expect(form.graph.isolated).toEqual([]);
      // 첫 구간 뼈대(playableSegment)가 (맵 가로-1, 시작 y) 에 다음 맵 문을 단다 — 내용 파일이 시작 줄 길을 동쪽 끝까지 잇는 까닭이다.
      const blockedOnStartRow: number[] = [];
      for (let x = startPos.x; x < map.width; x += 1) if (!isPassable(project, map, x, startPos.y)) blockedOnStartRow.push(x);
      expect(blockedOnStartRow).toEqual([]);
      const ctx = { project };
      const east = runTool(ctx, "check_reachability", { mapId: map.id, from: startPos, targets: [{ x: map.width - 1, y: startPos.y }] });
      expect(east.data).toMatchObject({ reachable: true, unreachable: [] });
    });
  });
});
