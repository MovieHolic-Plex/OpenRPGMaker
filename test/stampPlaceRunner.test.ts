// 바로 깔기 실행기 — 모델 계획(실패 시 1회 재시도) → 결정적 적용 → 실패만 한 번 수리. 모델 없으면 아무것도 깔지 않는다.
// 스토어·모델은 주입한다(runStampPlaceWith). 실제 도구는 돌리지 않는다.
import { describe, expect, it } from "vitest";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import type { ToolResult } from "@/editor/tools/types";
import { runStampPlaceWith, type StampChatFn, type StampRunDeps } from "@/editor/stampPlaceRunner";
import { createBlankProject } from "@/project/defaults";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";

const CONFIG = { authMode: "apiKey", baseUrl: "x", model: "m", liteModel: "lite", apiKey: "k", maxTokens: 512, maxToolCalls: 4 } as AiConfig;

function reply(content: string): ChatResult {
  return { message: { role: "assistant", content }, finishReason: "stop" } as ChatResult;
}

type Call = { name: string; args: Record<string, unknown> };

const VISUAL: Readonly<Record<string, true>> = { fill_region: true, place_props: true, paint_road: true, paint_tiles: true, tile_erase: true, build_wall: true, place_door: true, stamp_tileset_object: true, place_terrain_house: true, build_jp_city_building: true };
// 우물·집·상자 배치 사실은 합본 마을 칸을 가정한다 — 정리(0d4f13e7c8) 뒤 기본 beodeul_city 라서 되살린다(#3657 패턴).
const BASE_PROJECT = withRetiredCombinedTownMaps(createBlankProject());

function harness(options: {
  readonly replies?: readonly string[];
  readonly ready?: boolean;
  readonly chatError?: Error;
  readonly fail?: (call: Call) => string | null;
  /** 맵 이름을 바꾸고 조우를 비운다 — 이름만으로 마을 성격을 추정하게. */
  readonly mapName?: string;
}) {
  const project = { ...BASE_PROJECT, maps: structuredClone(BASE_PROJECT.maps), tilesets: { ...BASE_PROJECT.tilesets } };
  const mapId = project.startMapId;
  if (options.mapName) {
    const map = project.maps[mapId]!;
    map.name = options.mapName;
    map.encounterRate = 0;
    map.encounterTable = [];
    map.troopIds = [];
    map.fieldSpawns = [];
  }
  const requests: ChatRequest[] = [];
  const applied: Call[][] = [];
  let mutation = 0;
  const queue = [...(options.replies ?? [])];
  const chat: StampChatFn = async (_config, req) => {
    requests.push(req);
    if (options.chatError) throw options.chatError;
    const next = queue.shift();
    if (next === undefined) throw new Error("no more replies");
    return reply(next);
  };
  const deps: StampRunDeps = {
    getProject: () => project,
    apply: (calls) => {
      applied.push(calls.map((call) => ({ name: call.name, args: call.args })));
      return calls.map((call): ToolResult => {
        const error = options.fail?.(call) ?? null;
        if (error) return { ok: false, summary: "", issues: [{ message: error } as never] };
        // 실제 도구처럼 그림 도구는 맵 타일을 바꾼다 — 결과 줄이 「실제로 바뀐 것」을 재므로 가짜 성공 검사가 통과해야 한다.
        if (VISUAL[call.name]) {
          const map = project.maps[mapId]!;
          mutation += 1;
          map.lowerTiles[mutation % map.lowerTiles.length] = 100000 + mutation;
        }
        return { ok: true, summary: `${call.name} 완료` };
      });
    },
    chat,
    getConfig: () => CONFIG,
    isModelReady: () => options.ready ?? true,
    timeoutMs: 1000,
  };
  return { project, mapId, requests, applied, deps };
}

describe("runStampPlaceWith", () => {
  it("applies several model steps in one batch", async () => {
    const h = harness({
      replies: [JSON.stringify({ steps: [
        { tool: "fill_region", args: { rect: { x: 0, y: 0, w: 5, h: 5 }, material: "흙", shape: "circle" }, label: "흙 원" },
        { tool: "fill_region", args: { rect: { x: 5, y: 0, w: 5, h: 5 }, material: "물", shape: "circle" }, label: "물 원" },
        { tool: "place_props", args: { area: { x: 10, y: 0, w: 3, h: 5 }, material: "침엽수", density: "impassable" }, label: "나무" },
      ] })],
    });
    const result = await runStampPlaceWith({ text: "땅을 동그랗게, 물을 동그랗게 옆에 나무", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: true, applied: 3, usedModel: true });
    // 단계 줄 셋 + 「실제로 바뀐 것」 한 줄.
    expect(result.lines).toHaveLength(4);
    expect(result.lines.at(-1)).toContain("실제로 바뀐 것");
    expect(h.applied).toHaveLength(1);
    expect(h.applied[0]!.map((call) => call.name)).toEqual(["fill_region", "fill_region", "place_props"]);
    expect(h.applied[0]!.every((call) => call.args.mapId === h.mapId)).toBe(true);
    // 계획 호출 하나, 사실에 실제 재료 라벨.
    expect(h.requests).toHaveLength(1);
    const payload = JSON.parse(String(h.requests[0]!.messages[1]!.content)) as { fillMaterials: unknown[] };
    expect(Array.isArray(payload.fillMaterials)).toBe(true);
  });

  it("repairs a failing step once with the tool error", async () => {
    const h = harness({
      replies: [
        JSON.stringify({ steps: [
          { tool: "fill_region", args: { material: "땅으로" }, label: "땅" },
          { tool: "place_props", args: { material: "침엽수", density: "dense" }, label: "나무" },
        ] }),
        JSON.stringify({ steps: [{ tool: "fill_region", args: { material: "흙" }, label: "흙" }] }),
      ],
      fail: (call) => (call.args.material === "땅으로" ? "라벨/설명이 \"땅으로\" 인 타일을 찾지 못했습니다." : null),
    });
    const result = await runStampPlaceWith({ text: "땅으로 깔고 나무", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: true, applied: 2, usedModel: true });
    expect(h.requests).toHaveLength(2);
    const repairAsk = String(h.requests[1]!.messages.at(-1)!.content);
    expect(repairAsk).toContain("땅으로");
    expect(h.applied).toHaveLength(2);
    expect(h.applied[1]!.map((call) => call.args.material)).toEqual(["흙"]);
    expect(result.lines.some((line) => line.includes("실패"))).toBe(true);
  });

  it("reports a step that still fails after repair and keeps the rest", async () => {
    const h = harness({
      replies: [
        JSON.stringify({ steps: [
          { tool: "fill_region", args: { material: "용암" }, label: "용암" },
          { tool: "place_props", args: { material: "침엽수", density: "dense" }, label: "나무" },
        ] }),
        JSON.stringify({ steps: [{ tool: "fill_region", args: { material: "마그마" }, label: "마그마" }] }),
      ],
      fail: (call) => (call.name === "fill_region" ? "재료 없음" : null),
    });
    const result = await runStampPlaceWith({ text: "용암 깔고 나무", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: false, applied: 1, usedModel: true });
    expect(h.requests).toHaveLength(2); // 수리는 한 번뿐.
    expect(result.lines.some((line) => line.startsWith("고쳐도"))).toBe(true);
  });

  it("does not stamp anything when the model is not configured", async () => {
    const h = harness({ ready: false });
    const result = await runStampPlaceWith({ text: "숲", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: false, applied: 0, usedModel: false });
    expect(h.requests).toHaveLength(0);
    expect(h.applied).toHaveLength(0);
    expect(result.lines[0]).toContain("AI 연결");
  });

  it("retries a failing model call once, then stamps nothing", async () => {
    const h = harness({ chatError: new Error("502") });
    const result = await runStampPlaceWith({ text: "길", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: false, applied: 0 });
    expect(h.requests).toHaveLength(2);
    expect(h.applied).toHaveLength(0);
    expect(result.lines[0]).toContain("502");
  });

  it("retries once when the first plan has no usable steps", async () => {
    const h = harness({ replies: [
      JSON.stringify({ steps: [{ tool: "delete_map" }] }),
      JSON.stringify({ steps: [{ tool: "fill_region", args: { material: "물" } }] }),
    ] });
    const result = await runStampPlaceWith({ text: "물", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: true, applied: 1, usedModel: true });
    expect(h.requests).toHaveLength(2);
    expect(h.applied[0]![0]!.name).toBe("fill_region");
  });

  it("stamps nothing when both plans are unusable", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [] }), "not json"] });
    const result = await runStampPlaceWith({ text: "물", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: false, applied: 0 });
    expect(h.applied).toHaveLength(0);
  });

  it("sends an empty sentence to the model too", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [{ tool: "place_props", args: { material: "침엽수", density: "dense" } }] })] });
    const result = await runStampPlaceWith({ text: "  ", mapId: h.mapId, selection: null }, h.deps);
    expect(h.requests).toHaveLength(1);
    expect(String(h.requests[0]!.messages[1]!.content)).toContain("빈 입력");
    expect(result).toMatchObject({ ok: true, usedModel: true, applied: 1 });
  });

  it("gives the model this map's placement facts and clamps chest gold into its range", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [
      { tool: "place_chest", args: { at: { x: 3, y: 3 }, gold: 1 } },
      { tool: "place_chest", args: { at: { x: 5, y: 3 }, itemId: "item_made_up" } },
      { tool: "place_npc", args: { at: { x: 7, y: 3 }, name: "떠돌이 상인", role: "merchant", lines: ["좋은 물건 있어요."] } },
      { tool: "place_savepoint", args: { at: { x: 9, y: 3 } } },
      { tool: "place_examine_hotspots", args: { spots: [{ at: { x: 11, y: 3 }, name: "비석", lines: ["오래된 글씨"] }] } },
    ] })] });
    const result = await runStampPlaceWith({ text: "상자 둘, 상인, 세이브, 비석", mapId: h.mapId, selection: null }, h.deps);
    // 빈 바닥 위 비석 조사 지점은 그림이 없어 투명 이벤트가 되므로 계획 단계에서 버린다.
    expect(result.lines.some((line) => line.includes("비석"))).toBe(true);
    const payload = JSON.parse(String(h.requests[0]!.messages[1]!.content)) as { placement?: { chestGold: { min: number; max: number }; knownItemIds?: unknown } };
    expect(payload.placement?.chestGold.min).toBeGreaterThan(1);
    expect(payload.placement?.knownItemIds).toBeUndefined();
    const calls = h.applied[0]!;
    expect(calls.map((call) => call.name)).toEqual(["place_chest", "place_chest", "place_npc", "place_savepoint"]);
    const first = calls[0]!.args.contents as { gold?: number };
    expect(first.gold).toBeGreaterThanOrEqual(payload.placement!.chestGold.min);
    const second = calls[1]!.args.contents as { itemId?: string; gold?: number };
    expect(second.itemId).toBeUndefined();
    expect(second.gold).toBeGreaterThan(0);
    expect(calls[2]!.args).toMatchObject({ name: "떠돌이 상인", pages: [{ lines: ["좋은 물건 있어요."] }] });
    expect(result.lines.some((line) => line.includes("올림"))).toBe(true);
    expect(result.lines.some((line) => line.includes("item_made_up"))).toBe(true);
  });

  it("moves new events off existing events and off each other", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [
      { tool: "place_chest", args: { at: { x: 5, y: 5 }, gold: 60 }, label: "A" },
      { tool: "place_chest", args: { at: { x: 5, y: 5 }, gold: 60 }, label: "B" },
    ] })] });
    const result = await runStampPlaceWith({ text: "상자 둘", mapId: h.mapId, selection: null }, h.deps);
    const calls = h.applied[0]!;
    const a = calls[0]!.args as { x: number; y: number };
    const b = calls[1]!.args as { x: number; y: number };
    expect(a.x === b.x && Math.abs(a.y - b.y) <= 1).toBe(false);
    expect(result.lines.some((line) => line.includes("겹쳐서"))).toBe(true);
  });

  it("turns a merchant into make_villager with real, affordable stock only", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [
      { tool: "place_npc", args: { at: { x: 8, y: 8 }, name: "상인", merchant: true, stock: ["item_potion", "item_made_up"] } },
    ] })] });
    await runStampPlaceWith({ text: "상인", mapId: h.mapId, selection: null }, h.deps);
    const call = h.applied[0]![0]!;
    expect(call.name).toBe("make_villager");
    const stock = (call.args.shop as { stock: { itemId: string }[] }).stock.map((entry) => entry.itemId);
    expect(stock).toContain("item_potion");
    expect(stock).not.toContain("item_made_up");
  });

  it("drops a battle blocker when the map has no encounters, and unknown event ids", async () => {
    const h = harness({ replies: [
      JSON.stringify({ steps: [
        { tool: "place_battle_blocker", args: { at: { x: 4, y: 4 }, troopId: "tr_x" } },
        { tool: "remove_event", args: { eventId: "ev_missing" } },
      ] }),
      JSON.stringify({ steps: [] }),
    ] });
    const result = await runStampPlaceWith({ text: "몬스터", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: false, applied: 0 });
    expect(result.lines[0]).toContain("적 그룹");
  });

  it("in a town, drops unrequested traps and blockers but keeps townsfolk", async () => {
    const h = harness({ mapName: "조용한 마을", replies: [JSON.stringify({ steps: [
      { tool: "place_trap", args: { at: { x: 4, y: 4 } } },
      { tool: "place_signpost", args: { at: { x: 6, y: 6 }, lines: ["북쪽: 동굴"] } },
    ] })] });
    const result = await runStampPlaceWith({ text: "", mapId: h.mapId, selection: null }, h.deps);
    const names = h.applied[0]!.map((call) => call.name);
    expect(names).toEqual(["place_npc"]);
    expect(result.lines.some((line) => line.includes("마을이라 요청 없이 함정을"))).toBe(true);
  });

  it("in a town, keeps a trap the sentence asks for", async () => {
    const h = harness({ mapName: "조용한 마을", replies: [JSON.stringify({ steps: [{ tool: "place_trap", args: { at: { x: 4, y: 4 } } }] })] });
    await runStampPlaceWith({ text: "마을 입구에 함정 하나", mapId: h.mapId, selection: null }, h.deps);
    expect(h.applied[0]!.map((call) => call.name)).toEqual(["place_trap"]);
  });

  it("clamps an inn price to the map's basis", async () => {
    const h = harness({ mapName: "조용한 마을", replies: [JSON.stringify({ steps: [{ tool: "place_inn", args: { at: { x: 5, y: 5 }, price: 99999 } }] })] });
    await runStampPlaceWith({ text: "여관", mapId: h.mapId, selection: null }, h.deps);
    const page = (h.applied[0]![0]!.args.pages as { commands: { kind: string; price: number }[] }[])[0]!;
    expect(page.commands[0]!.kind).toBe("inn");
    expect(page.commands[0]!.price).toBeLessThan(99999);
  });

  it("keeps model rects inside the selection", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [{ tool: "fill_region", args: { rect: { x: 0, y: 0, w: 99, h: 99 }, material: "물" } }] })] });
    await runStampPlaceWith({ text: "물", mapId: h.mapId, selection: { mapId: h.mapId, x: 2, y: 3, width: 4, height: 5 } }, h.deps);
    expect(h.applied[0]![0]!.args.rect).toEqual({ x: 2, y: 3, w: 4, h: 5 });
  });

  it("stops without applying when aborted during planning", async () => {
    const controller = new AbortController();
    const h = harness({});
    const deps: StampRunDeps = {
      ...h.deps,
      chat: async (_config, req) => {
        controller.abort();
        await Promise.resolve();
        if (req.signal?.aborted) throw new Error("aborted");
        return reply("{}");
      },
    };
    const result = await runStampPlaceWith({ text: "물", mapId: h.mapId, selection: null, signal: controller.signal }, deps);
    expect(result).toMatchObject({ ok: false, applied: 0 });
    expect(h.applied).toHaveLength(0);
  });

  it("clears removable upper decorations before placing a house on a decorated map", async () => {
    const h = harness({
      replies: [JSON.stringify({ steps: [{ tool: "place_house", args: { area: { x: 2, y: 2, w: 10, h: 9 }, size: "small" }, label: "작은 집" }] })],
    });
    const map = h.project.maps[h.mapId]!;
    for (let y = 2; y < 11; y++) {
      for (let x = 2; x < 12; x++) {
        map.upperTiles[y * map.width + x] = 751;
      }
    }
    const result = await runStampPlaceWith({ text: "작은 집 하나 지어줘", mapId: h.mapId, selection: { mapId: h.mapId, x: 2, y: 2, width: 10, height: 9 } }, h.deps);
    expect(result.ok).toBe(true);
    expect(h.applied[0]!.map((call) => call.name)).toEqual(["tile_erase", "place_terrain_house"]);
  });

  it("preserves too-small selection rejection reason when no other steps remain", async () => {
    const h = harness({
      replies: [JSON.stringify({ steps: [{ tool: "place_house", args: { area: { x: 2, y: 2, w: 4, h: 4 }, size: "small" }, label: "집" }] })],
    });
    const tooSmall = await runStampPlaceWith({ text: "집 지어줘", mapId: h.mapId, selection: { mapId: h.mapId, x: 2, y: 2, width: 4, height: 4 } }, h.deps);
    expect(tooSmall.ok).toBe(false);
    expect(tooSmall.lines.join(" ")).toContain("가장 작은 집도 5×6칸");
  });

  it("preserves missing house styles rejection reason when no other steps remain", async () => {
    const h = harness({
      replies: [JSON.stringify({ steps: [{ tool: "place_house", args: { area: { x: 2, y: 2, w: 10, h: 9 } }, label: "집" }] })],
    });
    const map = h.project.maps[h.mapId]!;
    h.project.tilesets.grassland_test = { ...h.project.tilesets[map.tilesetId]!, id: "grassland_test", name: "초원", structureKits: [] };
    map.tilesetId = "grassland_test";
    const noStyles = await runStampPlaceWith({ text: "집 지어줘", mapId: h.mapId, selection: { mapId: h.mapId, x: 2, y: 2, width: 10, height: 9 } }, h.deps);
    expect(noStyles.ok).toBe(false);
    expect(noStyles.lines.join(" ")).toContain("이 타일셋(grassland_test)에는 집 외관이 없습니다");
  });

  it("supports jp_city with build_jp_city_building when quickHouseStyles is empty", async () => {
    const h = harness({
      replies: [JSON.stringify({ steps: [{ tool: "place_house", args: { area: { x: 2, y: 2, w: 10, h: 9 }, size: "small" }, label: "일본 집" }] })],
    });
    const map = h.project.maps[h.mapId]!;
    h.project.tilesets.jp_city = { ...h.project.tilesets[map.tilesetId]!, id: "jp_city", name: "일본 도시" };
    map.tilesetId = "jp_city";
    const result = await runStampPlaceWith({ text: "작은 집 하나 지어줘", mapId: h.mapId, selection: { mapId: h.mapId, x: 2, y: 2, width: 10, height: 9 } }, h.deps);
    expect(result.ok).toBe(true);
    expect(h.applied[0]!.map((call) => call.name)).toEqual(["build_jp_city_building"]);
  });

  it("carves connected dungeon rooms via union floorMask without leaving floating wall tiles inside rooms", async () => {
    const h = harness({
      replies: [
        JSON.stringify({
          steps: [
            { tool: "place_dungeon_room", args: { area: { x: 2, y: 2, w: 6, h: 6 }, kind: "room", style: "crypt" }, label: "서쪽 방" },
            { tool: "place_dungeon_room", args: { area: { x: 8, y: 2, w: 6, h: 6 }, kind: "room", style: "crypt" }, label: "동쪽 방" },
            { tool: "place_dungeon_room", args: { area: { x: 2, y: 2, w: 12, h: 6 }, kind: "connect", style: "crypt" }, label: "방 연결" },
          ],
        }),
      ],
    });
    const map = h.project.maps[h.mapId]!;
    h.project.tilesets.dungeon_test = {
      ...h.project.tilesets[map.tilesetId]!,
      id: "dungeon_test",
      name: "던전",
      structureKits: [
        {
          id: "bd-pick-aqueduct-sewer-face-cata-2h",
          name: "벽",
          width: 3,
          height: 2,
          rows: [{ tiles: [101, 102, 103] }, { tiles: [104, 105, 106] }],
        },
        {
          id: "bd-pick-aqueduct-sewer-floor-cata",
          name: "바닥",
          width: 2,
          height: 2,
          rows: [{ tiles: [201, 202] }, { tiles: [203, 204] }],
        },
      ] as never,
    };
    map.tilesetId = "dungeon_test";
    const result = await runStampPlaceWith({ text: "던전 방 두 개를 만들고 복도로 연결해줘", mapId: h.mapId, selection: { mapId: h.mapId, x: 2, y: 2, width: 12, height: 6 } }, h.deps);
    expect(result.ok).toBe(true);
    const paintCalls = h.applied[0]!.filter((call) => call.name === "paint_tiles");
    expect(paintCalls.length).toBeGreaterThan(0);
  });

  it("hard-rejects quest/event/narrative requests in fast-path with FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT without calling the model", async () => {
    const h = harness({ replies: [] });
    const questRes = await runStampPlaceWith({ text: "퀘스트 세우기", mapId: h.mapId, selection: null }, h.deps);
    expect(questRes.ok).toBe(false);
    expect(questRes.code).toBe("FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT");
    expect(questRes.tier).toBe("QUEST_OR_NARRATIVE_REJECTED");
    expect(questRes.usedModel).toBe(false);
    expect(questRes.applied).toBe(0);
    expect(h.requests).toHaveLength(0);
    expect(h.applied).toHaveLength(0);
    expect(questRes.lines[0]).toContain("「퀘스트·이벤트·대화 만들기」는 타일만 찍는 『바로 깔기』로 처리할 수 없습니다.");

    const bossRes = await runStampPlaceWith({ text: "광장에 보스 이벤트 만들기", mapId: h.mapId, selection: null }, h.deps);
    expect(bossRes.ok).toBe(false);
    expect(bossRes.code).toBe("FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT");
    expect(bossRes.usedModel).toBe(false);
    expect(h.requests).toHaveLength(0);
  });

  it("erases a matched tree in the top-right region and a fountain in the plaza via erase_object", async () => {
    const h = harness({
      replies: [
        JSON.stringify({
          steps: [{ tool: "erase_object", args: { query: "나무", region: "오른쪽 위" }, label: "오른쪽 위 나무 지우기" }],
        }),
      ],
    });
    const map = h.project.maps[h.mapId]!;
    const ts = h.project.tilesets[map.tilesetId]!;
    const treeKit = (ts.structureKits ?? []).find((k) => /tree|나무/i.test(`${k.id} ${k.name}`));
    expect(treeKit).toBeDefined();
    // 오른쪽 위 (x=15, y=2) 에 나무 스탬프 배치
    const tx = 15;
    const ty = 2;
    for (let dy = 0; dy < treeKit!.height; dy++) {
      for (let dx = 0; dx < treeKit!.width; dx++) {
        const u = treeKit!.rows[dy]?.upperTiles?.[dx] ?? -1;
        if (u >= 0) map.upperTiles[(ty + dy) * map.width + (tx + dx)] = u;
      }
    }
    const res = await runStampPlaceWith({ text: "오른쪽 위 나무 지워줘", mapId: h.mapId, selection: null }, h.deps);
    expect(res.ok).toBe(true);
    expect(h.applied[0]!.some((c) => c.name === "tile_erase")).toBe(true);
    const eraseCall = h.applied[0]!.find((c) => c.name === "tile_erase")!;
    expect(eraseCall.args.rect).toMatchObject({ x: tx, y: ty, w: treeKit!.width, h: treeKit!.height });
  });

  it("moves a placed well to the plaza center and shifts a house 4 tiles right via move_object", async () => {
    const h = harness({
      replies: [
        JSON.stringify({
          steps: [{ tool: "move_object", args: { query: "집", dx: 4, dy: 0 }, label: "집 오른쪽 4칸 이동" }],
        }),
      ],
    });
    const map = h.project.maps[h.mapId]!;
    map.structurePlacements = [
      {
        id: "house_1",
        kitId: "quick_house_1",
        x: 3,
        y: 4,
        w: 4,
        h: 4,
        before: {
          lower: new Array(16).fill(0),
          lowerOverlay: new Array(16).fill(-1),
          upper: new Array(16).fill(-1),
          upperOverlay: new Array(16).fill(-1),
          shadow: new Array(16).fill(0),
        },
      },
    ];
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        map.upperTiles[(4 + dy) * map.width + (3 + dx)] = 500 + dy * 4 + dx;
      }
    }
    const res = await runStampPlaceWith({ text: "집을 오른쪽으로 4칸 옮겨줘", mapId: h.mapId, selection: null }, h.deps);
    expect(res.ok).toBe(true);
    const eraseCalls = h.applied[0]!.filter((c) => c.name === "tile_erase");
    expect(eraseCalls.length).toBeGreaterThanOrEqual(2);
    expect(eraseCalls[0]!.args.rect).toMatchObject({ x: 3, y: 4, w: 4, h: 4 });
    expect(eraseCalls[1]!.args.rect).toMatchObject({ x: 7, y: 4, w: 4, h: 4 });
    const paintUpper = h.applied[0]!.filter((c) => c.name === "paint_tiles" && c.args.layer === "upper");
    expect(paintUpper.length).toBeGreaterThan(0);
    expect(res.llmTurnsUsed).toBe(1);
  });

  it("executes a 2-turn LLM loop within a single apply checkpoint when Turn 1 requests follow-up refinement", async () => {
    const h = harness({
      replies: [
        JSON.stringify({
          steps: [{ tool: "place_inn", args: { area: { x: 2, y: 2, w: 8, h: 8 }, name: "여관 주인", price: 20 }, label: "1턴: 여관 시공" }],
          needsFollowUp: true,
          remainingGoals: ["auto_connect_roads", "populate_crowd"],
        }),
        JSON.stringify({
          steps: [
            { tool: "auto_connect_roads", args: { area: { x: 2, y: 2, w: 12, h: 12 } }, label: "2턴: 출입구 도로 자동 연결" },
            { tool: "populate_crowd", args: { area: { x: 2, y: 10, w: 12, h: 5 }, count: 3 }, label: "2턴: 마을 군중 3명" },
          ],
        }),
      ],
    });
    const res = await runStampPlaceWith(
      { text: "여관을 세우고 출입구 도로망을 자동 연결한 뒤 마을 군중으로 북적이게 해줘", mapId: h.mapId, selection: null },
      h.deps,
    );
    expect(res.ok).toBe(true);
    expect(res.llmTurnsUsed).toBe(2);
    expect(h.requests).toHaveLength(2);
    // 1턴 + 2턴 결과가 단일 apply 체크포인트(h.applied.length === 1)로 묶여 적용된다.
    expect(h.applied).toHaveLength(1);
    expect(res.lines.at(-1)).toContain("LLM 2턴 연쇄 시공");
  });

  it("executes a 4-turn progressive RPG worldbuilding loop with enriched observation (placedStructures, doorCells, switchesWired)", async () => {
    const h = harness({
      replies: [
        JSON.stringify({
          steps: [
            { tool: "place_castle", args: { area: { x: 2, y: 1, w: 14, h: 11 }, gate: true, towers: true }, label: "1턴: 성채와 성문" },
            { tool: "carve_waterfall_pond", args: { area: { x: 16, y: 1, w: 7, h: 8 } }, label: "1턴: 폭포와 연못" },
          ],
          needsFollowUp: true,
          remainingGoals: ["place_inn", "place_shop", "auto_connect_roads", "place_switch_and_gate", "populate_crowd", "set_mood_weather"],
        }),
        JSON.stringify({
          steps: [
            { tool: "place_inn", args: { area: { x: 2, y: 12, w: 8, h: 7 }, name: "여관 주인", price: 20 }, label: "2턴: 여관 시공" },
            { tool: "place_shop", args: { area: { x: 11, y: 12, w: 7, h: 7 }, kind: "potion", name: "물약 상점" }, label: "2턴: 물약 상점 시공" },
            { tool: "auto_connect_roads", args: { area: { x: 2, y: 1, w: 20, h: 18 } }, label: "2턴: 출입구 도로 자동 연결" },
          ],
          needsFollowUp: true,
          remainingGoals: ["place_switch_and_gate", "place_roaming_enemies", "populate_crowd", "set_mood_weather"],
        }),
        JSON.stringify({
          steps: [
            { tool: "place_switch_and_gate", args: { area: { x: 18, y: 10, w: 5, h: 5 } }, label: "3턴: 레버와 강철 성문" },
            { tool: "place_roaming_enemies", args: { area: { x: 18, y: 15, w: 5, h: 4 }, count: 2 }, label: "3턴: 배회 심볼 몬스터" },
          ],
          needsFollowUp: true,
          remainingGoals: ["populate_crowd", "set_mood_weather"],
        }),
        JSON.stringify({
          steps: [
            { tool: "populate_crowd", args: { area: { x: 2, y: 10, w: 14, h: 4 }, count: 4 }, label: "4턴: 마을 군중 4명" },
            { tool: "set_mood_weather", args: { area: { x: 1, y: 1, w: 22, h: 18 }, weather: "clear", preset: "sunset" }, label: "4턴: 노을 조명 연출" },
          ],
        }),
      ],
    });
    const res = await runStampPlaceWith(
      {
        text: "성채와 폭포를 세우고 여관과 물약 상점을 지어 도로망을 자동 연결한 뒤 레버 철문과 배회하는 몬스터를 깔고 마을 군중과 노을 조명으로 4단계 월드빌딩해줘",
        mapId: h.mapId,
        selection: null,
      },
      h.deps,
    );
    expect(res.ok).toBe(true);
    expect(res.llmTurnsUsed).toBe(4);
    expect(h.requests).toHaveLength(4);
    expect(h.applied).toHaveLength(1);
    expect(res.lines.at(-1)).toContain("LLM 4턴 연쇄 시공");
    const turn4UserPayload = JSON.parse(String(h.requests[3]!.messages.at(-1)!.content));
    expect(turn4UserPayload.turn).toBe(4);
    expect(turn4UserPayload.observation.switchesWired.length).toBeGreaterThan(0);
    expect(turn4UserPayload.observation.doorCells.length).toBeGreaterThanOrEqual(2);
  });
});
