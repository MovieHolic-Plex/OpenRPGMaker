// 버들항 이야기 기물(bd-obj-*, 시트 꼬리 34,944~): 새 사본·옛 사본이 킷과 참고문서를 갖는지, 칸 표가 선언(막힘·★·바닥 그림)과 같은지,
// 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 종류별 변형(ai.variantOf — 우물·벤치·이정표 등의 다른 그림): 원본 킷과 칸 크기·칸마다 통행·겹침이 같은지, 종류 이름(«우물»)은 여전히 원본을 첫째로 짚는지.
// 새 종류(2026-11-14 — 마을 살림·물가와 물 위·농장·숲 바닥·절벽 바위·유적과 묘지): 변형이 아닌 새 물건. 낱말로 찾아지는지, 물 위 것은 물 칸에만 놓이는지, 징검돌이 물을 건너게 하는지.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 · 변형은 fable-variety-beodeul-2026-11-12 · 새 종류는 fable-objects100-beodeul-2026-11-14 (굽기 scripts/content/beodeul-objects/bake.py).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  BEODEUL_OBJECTS_BASE, BEODEUL_OBJECTS_KIT_PREFIX, createBeodeulCityTileset, ensureBeodeulCityReferences, ensureBeodeulCityTileset,
} from "@/project/defaults/beodeulCity";
import { buildObjectGenRequest, existingMatches } from "@/editor/tools/objectGenTool";
import { canMove, isPassable } from "@/project/collision";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { runTool } from "@/editor/tools";
import type { Project, StructureKitDef } from "@/project/types";
import catalog from "../tiledata/beodeul-objects/catalog.json";

const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => kit.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX));
type CatalogItem = (typeof catalog.items)[number] & { variantOf?: string; on?: string };
const ITEMS = catalog.items as CatalogItem[];
const NEW_WAIVER = "fable-objects100-beodeul-2026-11-14";
const NEWS = ITEMS.filter((item) => item.waiver === NEW_WAIVER);
const variantOf = (kit: StructureKitDef | undefined) => (kit?.ai as { variantOf?: string } | undefined)?.variantOf;

describe("버들항 이야기 기물 꼬리", () => {
  it("새 사본은 목록의 킷(이야기 기물 16종 + 종류별 변형)을 모두 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸·바닥 그림)", () => {
    const ts = createBeodeulCityTileset();
    const kits = own(ts.structureKits);
    expect(kits.map((kit) => kit.id)).toEqual(catalog.items.map((item) => item.kit));
    expect(catalog.base).toBe(BEODEUL_OBJECTS_BASE);
    expect(ITEMS.filter((item) => !item.variantOf && item.waiver !== NEW_WAIVER)).toHaveLength(16);
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
    expect(ask("판자 길")).toThrow(/이미 있다[^]*bd-obj-plank-ew/u);
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
    const first = (title: string) => existingMatches(project, ts, title)[0]?.id;
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
    expect(ITEMS.slice(66).every((item) => item.waiver === NEW_WAIVER)).toBe(true);
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
    const first = (title: string) => existingMatches(project, ts, title)[0]?.id;
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
