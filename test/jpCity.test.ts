import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { buildPiIntentNote } from "@/ai/piAgent/executionRoute";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { JP_CITY_EXPOSED_TOOLS, jpCityTargetFor, formatJpCityNote } from "@/ai/jpCityPolicy";
import { TASK_RECIPES, buildTaskRecipes } from "@/ai/toolCapabilityIndex";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { getTool } from "@/editor/tools/toolRegistry";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { declaredIntent, fixedDeclarer } from "./intentFixture";
import type { ToolContext } from "@/editor/tools/types";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { JP_CITY_ID, createJpCityTileset } from "@/project/defaults/jpCity";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import type { Project, StructureKitDef } from "@/project/types";
import spec from "../tiledata/jp-city/objects/spec.json";
import ask from "../tiledata/jp-city/objects/ask.json";
import { planJpCityStreet, runJpStreetPlan, shopsFromText, streetStyleFromText } from "@/project/jpCityStreetComposer";
import { isolateTimers } from "./mergedTeardown";

// 일본 도시(jp_city) 조수 연결 — 조수가 칩셋·건물 조립 도구·참고문서 길을 «볼 수 있는가». 배경: src/ai/jpCityPolicy.ts 머리 주석.
// 순수 라우팅·지시문·도구 오류 문장만 본다(모델 호출 없음). 이 파일은 2026-10-04 작성 시 실행하지 않았다 — 같은 단언을 bun 스크립트로 확인했다.
describe("jpCityAssistantWiring", () => {
  isolateTimers();
  const START = "map_blank_start";
  function projectWithJpMap() {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: START, approvedTilesetFamilies: ["oprn-jp"] };
    const made = runTool(ctx, "create_map", { name: "상가 거리", width: 40, height: 30, tilesetId: "jp_city", id: "jpmap" });
    expect(made.ok).toBe(true);
    return ctx;
  }
  describe("jp_city 대상 판정", () => {
    const project = createBlankProject();
    const create = declaredIntent({ mode: "create", space: "outdoor" });

    it("일본 상가 거리·칩셋 이름을 말한 생성 요청은 새 맵 대상이다", () => {
      expect(jpCityTargetFor(project, create, "일본 상가 거리 맵 만들어 줘", START, false)).toEqual({});
      expect(jpCityTargetFor(project, create, "jp_city 로 맵 하나", START, false)).toEqual({});
    });
    it("무관한 요청·실내·질문·NPC 는 대상이 아니다", () => {
      expect(jpCityTargetFor(project, create, "성 하나 만들어줘", START, false)).toBeNull();
      expect(jpCityTargetFor(project, declaredIntent({ mode: "create", space: "interior" }), "일본 이자카야 실내", START, false)).toBeNull();
      expect(jpCityTargetFor(project, declaredIntent({ mode: "question", space: "outdoor" }), "일본 상가 거리가 뭐야", START, false)).toBeNull();
      expect(jpCityTargetFor(project, declaredIntent({ mode: "create", space: "none" }), "일본 편의점 점원 NPC", START, false)).toBeNull();
    });
    it("대상 맵이 jp_city 이면 문구와 무관하게 그 맵이다", () => {
      const { project: p } = projectWithJpMap();
      expect(jpCityTargetFor(p, declaredIntent({ mode: "modify", space: "outdoor" }), "여기 편의점 하나 지어줘", "jpmap", false)).toEqual({ mapId: "jpmap", lived: false });
    });
  });
  describe("지시문", () => {
    it("모든 시스템 프롬프트에 jp_city 길 한 줄이 있고, jp_city 맵이 범위에 있으면 상세 순서가 더 붙는다", () => {
      const ctx = projectWithJpMap();
      // 다른 번들 칩셋 줄(실내·sengoku_edo·modern_campus)도 「jp_city 는 따로」라며 이름을 부른다 — jp_city 자신의 줄만 센다.
      const plainAll = buildPiAgentSystemPrompt(ctx.project, [START]);
      const scopedAll = buildPiAgentSystemPrompt(ctx.project, ["jpmap"]);
      expect(plainAll.filter((line) => line.includes("번들 칩셋 jp_city"))).toHaveLength(1);
      const detail = scopedAll.filter((line) => line.includes("jp_city") && !plainAll.includes(line));
      expect(detail).toHaveLength(1);
      expect(detail.join("\n")).toContain("layer \"2\"");
      expect(detail.join("\n")).toContain("build_jp_city_building");
    });
    it("의도 노트는 PAW 게이트 낱말(현대·모던·modern)을 쓰지 않는다 — 노트는 task 에 실려 게이트를 켠다", () => {
      const note = formatJpCityNote({}, null) + formatJpCityNote({ mapId: "jpmap", lived: false }, { id: "jpmap", width: 40, height: 30 })
        + formatJpCityNote({ mapId: "jpmap", lived: true }, null);
      expect(note).not.toMatch(/현대|모던|modern|contemporary/iu);
    });
    it("buildPiIntentNote 는 jp_city 대상이면 숲마을 노트를 jp_city 노트로 바꾼다", () => {
      const project = createBlankProject();
      const intent = declaredIntent({ mode: "create", space: "outdoor", tools: ["author_village"] });
      const note = buildPiIntentNote({ project, intent, targetMap: null, selection: null, jpCity: {}, requestText: "일본 상가 거리" })!;
      expect(note).toContain("jp_city");
      expect(note).not.toContain("[마을 시공]");
    });
    it("태스크 레시피에 jp-city 가 있고 이름이 전부 실제 도구다", () => {
      const recipe = TASK_RECIPES.find((entry) => entry.id === "jp-city")!;
      expect(recipe).toBeDefined();
      expect(recipe.write).toContain("build_jp_city_building");
      for (const name of [...recipe.read, ...recipe.verify]) expect(getTool(name)?.mode, name).toBe("read");
      for (const name of recipe.write) expect(getTool(name)?.mode, name).toBe("write");
      expect(buildTaskRecipes()).toContain("jp-city:");
    });
  });
  describe("도구 노출", () => {
    it("jp_city 요청·맵이면 첫 요청부터 조립 도구·참고문서·도로 키트 도구가 보인다(author_village 선언이어도)", async () => {
      const ctx = projectWithJpMap();
      const turn = await classifyPlainPiTurn({
        project: ctx.project, text: "일본 상가 거리 맵 만들어 줘", currentMapId: START, selection: null, hasActivePlan: false,
        autonomy: resolveAutonomy("balanced"), declarer: () => fixedDeclarer({ mode: "create", space: "outdoor", tools: ["author_village"] }), piTeam: false,
      });
      for (const name of JP_CITY_EXPOSED_TOOLS) expect(turn.initialToolNames, name).toContain(name);
      expect(turn.intentNote).toContain("[일본 거리 시공 — jp_city]");
      expect(turn.intentNote).not.toContain("[마을 시공 — 버들항]");
    });
    it("조립 도구와 부품 조회 도구는 짝으로 승격된다", () => {
      const names = capabilityEscalatedToolNames("일본 상가 건물 짓기", new Set());
      if (names.includes("build_jp_city_building")) expect(names).toContain("list_jp_city_building_parts");
      if (names.includes("list_jp_city_building_parts")) expect(names).toContain("build_jp_city_building");
    });
  });
  describe("build_jp_city_building 오류는 다음 행동을 알려 준다", () => {
    const build = (ctx: ToolContext, over: Record<string, unknown> = {}) => runTool(ctx, "build_jp_city_building", {
      mapId: "jpmap", x: 4, y: 12, w: 6, floors: 3, floorKind: "pairs", wall: "shiro", ground: "gr.konbini.0", roof: "roof.ac.tank", door: { type: "auto", col: 2 }, ...over,
    });
    it("문 앞이 걸을 수 없는 jp_city 맵의 문 앞 막힘은 fill_region 인자를 돌려주고, 그대로 깔면 지어진다", () => {
      const ctx = projectWithJpMap();
      // 새 jp_city 맵은 이제 걸을 수 있는 바닥으로 깔린다 — 문 앞(5,13)~(8,15)을 물(849)로 막아 같은 막힘을 만든다.
      const jpmap = ctx.project.maps.jpmap!;
      const water = 849;
      expect(ctx.project.tilesets.jp_city!.tileMeta?.[water]?.label).toBe("물");
      for (let y = 13; y < 16; y++) for (let x = 5; x < 9; x++) jpmap.lowerTiles[y * jpmap.width + x] = water;
      const failed = build(ctx);
      expect(failed.ok).toBe(false);
      const message = failed.issues?.[0]?.message ?? "";
      expect(message).toContain("DOOR_BLOCKED");
      expect(message).toContain("fill_region(");
      expect(message).toContain("referencePurpose:\"jp-start\"");
      const filled = runTool(ctx, "fill_region", { mapId: "jpmap", rect: { x: 5, y: 13, w: 4, h: 3 }, material: "보도 연석", referencePurpose: "jp-start" });
      expect(filled.ok).toBe(true);
      expect(build(ctx).ok).toBe(true);
    });
    it("모르는 부품 id 는 조회 도구를, 좁은 폭은 최소 폭을 알려 준다", () => {
      const ctx = projectWithJpMap();
      const message = build(ctx, { w: 2, ground: "gr.nope" }).issues?.[0]?.message ?? "";
      expect(message).toContain("list_jp_city_building_parts");
      expect(message).toContain("최소 3");
    });
    it("jp_city 가 아닌 맵에서는 create_map 길을 알려 준다", () => {
      const ctx: ToolContext = { project: createBlankProject(), currentMapId: START };
      const message = runTool(ctx, "build_jp_city_building", { mapId: START, x: 4, y: 12, w: 6, ground: "gr.konbini.0" }).issues?.[0]?.message ?? "";
      expect(message).toContain("create_map");
      expect(message).toContain("ask_tileset_change");
    });
    it("에디터 층 한계로 거부되는 예제 셋은 stamp_object 레시피 키트를 알려 준다", () => {
      const hit = runTool({ project: createBlankProject() }, "list_jp_city_building_parts", { example: "machiya_izakaya" });
      expect(hit.summary).toContain("kit:jp_city/jp-recipe-machiya-izakaya");
    });
  });
  describe("새 맵 길", () => {
    it("다른 계열 맵을 보는 중이면 create_map 이 계열 변경으로 거부하고 ask_tileset_change 를 가리킨다", () => {
      // 빈 시작 맵은 그림체 선택이 아니다(toolRunner.isBlankCanvasMap) — 한 칸 칠해 사용자가 깐 버들항 맵으로 만든다.
      const project = createBlankProject();
      project.maps[START]!.lowerTiles[0] = (project.maps[START]!.lowerTiles[0] ?? 0) + 1;
      const ctx: ToolContext = { project, currentMapId: START };
      const refused = runTool(ctx, "create_map", { name: "상가", width: 30, height: 20, tilesetId: "jp_city" });
      expect(refused.ok).toBe(false);
      expect(refused.issues?.[0]?.code).toBe("tileset-family-change");
      expect(refused.issues?.[0]?.message).toContain("ask_tileset_change");
    });
  });
  describe("참고문서 쪽은 읽은 증거로 인정되게 잘리지 않는다", () => {
    it("12,000자를 넘는 jp-dict-groups 첫 쪽도 read_tileset_reference 결과가 dataTruncated 가 아니다", async () => {
      const project = createBlankProject();
      const tool = createPiToolset({ project, currentMapId: START }, {}).find((entry) => entry.name === "read_tileset_reference")!;
      const result = await tool.execute("call-1", { tilesetId: "jp_city", categoryId: "jp-start", documentId: "jp-dict-groups", offset: 0 } as never, undefined as never);
      const text = (result.content[0] as { text: string }).text;
      expect(text.length).toBeGreaterThan(12_000);
      expect(JSON.parse(text).dataTruncated).not.toBe(true);
    });
  });
});

// jp_city 이야기 기물 1종(jp-spring-basin, 시트 20459~20462): 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/jp-city/blocks/story_objects.py → bake_jp.py, 목록 tiledata/jp-city/objects/spec.json).
describe("jpCityStoryObjects", () => {
  isolateTimers();
  type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
  const ITEMS = spec.items as Item[];
  const kitId = (id: string) => `jp-${id}`;
  const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
  const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
  const FIRST = 20459;   // 이 묶음이 덧붙기 전 시트 끝

  describe("jp_city 이야기 기물", () => {
    it("새 사본은 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸)", () => {
      const ts = createJpCityTileset();
      const kits = own(ts.structureKits);
      expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
      let next = FIRST;
      for (const item of ITEMS) {
        const kit = kits.find((k) => k.id === kitId(item.id))!;
        expect([kit.width, kit.height]).toEqual([item.w, item.h]);
        expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
        expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
        kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
          expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 20459 부터
          const blocked = item.block.some(([bx, by]) => bx === x && by === y);
          expect(ts.passability[tile]!.up).toBe(!blocked);
          expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
        }));
      }
      expect(next).toBe(20463); // 이 묶음의 끝. 그 뒤(20463~)는 새 건물·거리의 예약 구간이라(2026-11-14, bake_lib.RESERVE) 이제 시트 끝이 아니다
      expect(ts.count).toBeGreaterThan(next);
      expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "jp-story-objects"))).toBe(true);
    });

    it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
      const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
      const sheet = read("public/assets/jp-city/jp-city-chipset.png");
      const ts = createJpCityTileset();
      for (const item of ITEMS) {
        const piece = read(`tiledata/jp-city/objects/pieces/${item.src}`);
        expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
        const kit = own(ts.structureKits).find((k) => k.id === kitId(item.id))!;
        kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
          const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
          for (let y = 0; y < 16; y += 1) {
            const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
            expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
          }
        }));
      }
    });

    it("게임이 바란 낱말이 그 킷을 첫째로 짚는다", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[JP_CITY_ID]!;
      for (const [id, words] of Object.entries(ask.items)) for (const word of words) expect([word, existingMatches(project, ts, word)[0]?.id]).toEqual([word, kitId(id)]);
    });

    it("실제 놓기 도구로 놓으면 네 칸만 막힌다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "park", assistantRun: true };
      expect(runTool(ctx, "create_map", { id: "park", name: "공원", width: 20, height: 15, tilesetId: JP_CITY_ID }).ok).toBe(true);
      expect(runTool(ctx, "stamp_tileset_object", { mapId: "park", objectId: kitId("spring-basin"), base: { x: 3, y: 6 } }).ok).toBe(true);
      const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.park!, x, y);
      // 샘 2×2 는 네 칸 모두 막힘, 둘레는 걷는다
      expect([walk(3, 6), walk(4, 6), walk(3, 5), walk(4, 5)]).toEqual([false, false, false, false]);
      expect([walk(3, 7), walk(2, 6), walk(5, 6), walk(3, 4)]).toEqual([true, true, true, true]);
    });
  });
});

describe("jpCityStreetComposer", () => {
  isolateTimers();
  describe("jp_city street composer", () => {
    it("is deterministic per seed and differs between seeds", () => {
      const a = planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 3 });
      expect(planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 3 })).toEqual(a);
      const shapes = new Set(Array.from({ length: 20 }, (_, i) => planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: i }).summary));
      expect(shapes.size).toBeGreaterThan(14);
    });

    it("puts requested shops first and keeps buildings inside the rows", () => {
      const plan = planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 5, shops: ["ramen", "konbini"] });
      expect(plan.summary).toMatch(/ramen/);
      for (const step of plan.steps) if (step.tool === "build_jp_city_building") {
        const { x, w, y } = step.args as { x: number; w: number; y: number };
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(52);
        expect(y).toBeLessThan(34);
      }
    });

    it("tries candidate buildings in order and stops at the first success", () => {
      const plan = planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 1 });
      const seen: string[] = [];
      let fails = 0;
      const outcome = runJpStreetPlan(plan, (tool, args) => {
        if (tool !== "build_jp_city_building") return;
        if (fails++ % 3 !== 2) throw new Error("rejected");
        seen.push(`${args.x},${args.y}`);
      });
      expect(outcome.built).toBe(new Set(seen).size);
      expect(outcome.built).toBeGreaterThan(5);
    });

    it("reads shop words and style from a brief", () => {
      expect(shopsFromText("편의점 야간알바가 본 살인, 라멘집과 카페")).toEqual(["konbini", "ramen", "cafe"]);
      expect(streetStyleFromText("조용한 주택가 골목")).toBe("residential");
      expect(streetStyleFromText("번화한 상가 거리")).toBe("shopping");
    });
  });
});
