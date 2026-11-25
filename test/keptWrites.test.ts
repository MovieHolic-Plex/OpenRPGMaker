import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import type { ToolContext } from "@/editor/tools/types";
import { describesCityStreet, jpCityTargetFor, JP_CITY_POINTER_LINE, JP_CITY_DETAIL_LINE, formatJpCityNote } from "@/ai/jpCityPolicy";
import { declaredIntent } from "./intentFixture";
import type { Command } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("historyRevertTool", () => {
  isolateTimers();
  beforeEach(() => {
    vi.unstubAllGlobals();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  describe("history tools", () => {
    it("revert_last_edit replaces the tool draft with the previous snapshot", () => {
      const mapId = store.getCurrent().startMapId;
      recordProjectSnapshot("첫 칠하기", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 111;
      });
      const previous = structuredClone(store.getCurrent());
      recordProjectSnapshot("둘째 칠하기", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 222;
      });

      const ctx: ToolContext = { project: store.getCurrent() };
      const result = runTool(ctx, "revert_last_edit", { steps: 1 }, { dryRun: false });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("둘째 칠하기");
      expect(result.diff?.tilesChanged).toBeGreaterThan(0);
      expect(ctx.project).toEqual(previous);
    });

    it("revert_last_edit reports an empty history without changing the draft", () => {
      const project = store.getCurrent();
      const ctx: ToolContext = { project };

      const result = runTool(ctx, "revert_last_edit", {}, { dryRun: false });

      expect(result.ok).toBe(false);
      expect(result.summary).toContain("되돌릴 이전 상태가 없습니다");
      expect(ctx.project).toBe(project);
    });

    it("list_edit_history returns labels filtered by map", () => {
      const mapId = store.getCurrent().startMapId;
      recordProjectSnapshot("현재 맵 편집", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 111;
      });
      recordProjectSnapshot("다른 맵 편집", "map_other");

      const ctx: ToolContext = { project: store.getCurrent() };
      const result = runTool(ctx, "list_edit_history", { mapId, limit: 5 });

      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toEqual({
        entries: [
          expect.objectContaining({ label: "현재 맵 편집", mapId }),
        ],
      });
    });
  });
});

// jp_city 라우팅 — 일본이라는 말 없이 도시 거리를 말한 요청은 «프로젝트에 jp_city 맵이 있을 때만» jp_city 로 간다. 이 파일은 작성 시 실행하지 않았다.
describe("jpCityRouting", () => {
  isolateTimers();
  const START = "map_blank_start";
  const create = declaredIntent({ mode: "create", space: "outdoor" });
  function withJpMap() {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: START, approvedTilesetFamilies: ["oprn-jp"] };
    expect(runTool(ctx, "create_map", { name: "상가", width: 50, height: 36, tilesetId: "jp_city", id: "jpmap" }).ok).toBe(true);
    return ctx.project;
  }
  describe("도시 거리 낱말", () => {
    it.each(["현대 번화가 만들어줘", "상점가 거리 하나", "도심 맵", "시가지 지어줘", "주택가 동네 거리", "downtown shopping street", "residential area"])("%s", (text) => {
      expect(describesCityStreet(text)).toBe(true);
    });
    it.each(["미국풍 번화가", "new york downtown", "modern_city 도심", "성 하나 만들어줘", "숲속 마을"])("%s 는 아니다", (text) => {
      expect(describesCityStreet(text)).toBe(false);
    });
  });
  describe("jpCityTargetFor — 일본 낱말 없는 요청", () => {
    it("프로젝트에 jp_city 맵이 있으면 새 맵 생성 요청도 jp_city 로 간다", () => {
      expect(jpCityTargetFor(withJpMap(), create, "현대 번화가 만들어줘", START, false)).toEqual({});
    });
    it("jp_city 맵이 없으면 약한 낱말(주택가·골목)만으로는 가지 않는다", () => {
      expect(jpCityTargetFor(createBlankProject(), create, "주택가 골목 만들어줘", START, false)).toBeNull();
    });
    it("jp_city 맵이 없어도 분명한 현대 도시 낱말(번화가·상점가·도심)은 jp_city 로 간다(2026-10-13 실시험 0/10 수정)", () => {
      for (const text of ["현대 도시 상점가 거리를 하천이 흐르게 만들어 줘", "번화가 만들어줘", "도심 맵"]) {
        expect(jpCityTargetFor(createBlankProject(), create, text, START, false)).toEqual({});
      }
    });
    it("미국풍·성 요청은 빈 프로젝트에서도 가지 않는다", () => {
      for (const text of ["미국풍 번화가", "new york downtown", "성 하나 만들어줘"]) {
        expect(jpCityTargetFor(createBlankProject(), create, text, START, false)).toBeNull();
      }
    });
    it("미국풍 낱말이 있으면 jp_city 맵이 있어도 가지 않는다", () => {
      expect(jpCityTargetFor(withJpMap(), create, "미국풍 번화가 만들어줘", START, false)).toBeNull();
    });
    it("실내·질문은 여전히 제외", () => {
      expect(jpCityTargetFor(withJpMap(), declaredIntent({ mode: "create", space: "interior" }), "번화가 가게 실내", START, false)).toBeNull();
      expect(jpCityTargetFor(withJpMap(), declaredIntent({ mode: "question", space: "outdoor" }), "번화가가 뭐야", START, false)).toBeNull();
    });
  });
  describe("compose 우선 지침", () => {
    it("포인터·상세·노트가 compose_jp_city_street 를 기본으로 말하고 PAW 게이트 낱말을 쓰지 않는다", () => {
      for (const text of [JP_CITY_POINTER_LINE, JP_CITY_DETAIL_LINE, formatJpCityNote({}, null), formatJpCityNote({ mapId: "m", lived: false }, null)]) {
        expect(text).toContain("compose_jp_city_street");
        expect(text).not.toMatch(/현대|모던|modern|contemporary/iu);
      }
      expect(JP_CITY_DETAIL_LINE).toContain("replace:true");
      expect(JP_CITY_DETAIL_LINE).toContain("link_jp_city_interior");
    });
  });
});

// 장비 상점 계약 — 무기점·방어구점이 실제로 장비를 팔 수 있어야 한다(2026-09-24 도그푸딩 「잿불 광산의 세 사람」).
// 조수는 upsert_item(type:weapon) 7번·make_villager shop.stock(장비 id) 2번·changeItem(장비 id) 2번 거부를 받고
// 끝내 「돈만 받고 아무것도 안 주는」 선택지 상점을 만들었다. 런타임 상점·소지품은 장비 id 를 그대로 받는다.
describe("jrpgEquipmentShopContract", () => {
  isolateTimers();
  function shopCommand(project: ReturnType<typeof createBlankProject>, mapId: string, eventId: string): Extract<Command, { kind: "shop" }> | undefined {
    const event = project.maps[mapId]!.events.find((entry) => entry.id === eventId)!;
    const commands = [...(event.pages?.flatMap((page) => page.commands) ?? []), ...(event.commands ?? [])];
    return commands.find((command): command is Extract<Command, { kind: "shop" }> => command.kind === "shop");
  }
  describe("JRPG 장비 상점 계약", () => {
    it("make_villager shop.stock 은 장비 id 를 받는다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const weapon = ctx.project.database.equipment.find((record) => record.slot === "weapon")!;
      const result = runTool(ctx, "make_villager", {
        mapId, id: "ev_weapon_shop", name: "무기 상인", home: { x: 2, y: 2 },
        dialogue: [{ text: "어서 오게." }],
        shop: { stock: [{ itemId: weapon.id }, { itemId: "item_potion" }] },
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(shopCommand(ctx.project, mapId, "ev_weapon_shop")?.stock?.map((entry) => entry.itemId)).toEqual([weapon.id, "item_potion"]);
    });

    it("set_shop_stock 은 장비 id 를 받고, 없는 id 는 아이템·장비 후보를 함께 알린다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const armor = ctx.project.database.equipment.find((record) => record.slot === "armor")!;
      expect(runTool(ctx, "make_villager", { mapId, id: "ev_armor_shop", name: "방어구 상인", home: { x: 3, y: 3 }, dialogue: [{ text: "튼튼하지." }] }, { dryRun: false }).ok).toBe(true);
      const ok = runTool(ctx, "set_shop_stock", { mapId, eventId: "ev_armor_shop", stock: [{ itemId: armor.id }] }, { dryRun: false });
      expect(ok.ok, ok.summary).toBe(true);
      expect(shopCommand(ctx.project, mapId, "ev_armor_shop")?.stock?.[0]?.itemId).toBe(armor.id);
      const missing = runTool(ctx, "set_shop_stock", { mapId, eventId: "ev_armor_shop", stock: [{ itemId: "equip_nope" }] }, { dryRun: false });
      expect(missing.ok).toBe(false);
      expect(missing.summary).toContain("장비");
    });

    it("changeItem 으로 장비를 건네는 이벤트가 참조 검증을 통과한다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const weapon = ctx.project.database.equipment.find((record) => record.slot === "weapon")!;
      const result = runTool(ctx, "place_npc", {
        mapId, id: "ev_gift", name: "대장장이", x: 4, y: 4,
        pages: [{ name: "선물", lines: ["이 검을 가져가게."], commands: [{ kind: "changeItem", itemId: weapon.id, op: "+=", amount: 1 }] }],
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
    });

    it("upsert_item 의 방어구 종류는 슬롯을 옮겨 장비로 저장하고 능력치를 보존한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_item", {
        item: { id: "item_mage_robe", name: "마법사 로브", type: "body", price: 200, description: "마력이 깃든 로브", equipmentProfile: { statBonuses: { defense: 10, mind: 18 } } },
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const record = ctx.project.database.equipment.find((entry) => entry.id === "item_mage_robe")!;
      expect(record).toMatchObject({ slot: "armor", price: 200, name: "마법사 로브" });
      expect(record.statBonuses).toMatchObject({ defense: 10, mind: 18 });
    });
  });
});

describe("keptWrites", () => {
  isolateTimers();
  // 페이지를 통째로 다시 쓸 때 빠진 상태 쓰기를 지킨다 — 2026-11-16 pf4 명세 은행 r5a-river(한씨 첫 페이지를 다시 쓰자 경로 스위치가 빠져 곁 의뢰가 막혔다).
  const page = (commands: unknown[], conditions: unknown[] = []) => ({ id: `p${Math.random().toString(36).slice(2, 7)}`, trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions, commands });
  function setup(readSwitch = true): { ctx: ToolContext; mapId: string } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const db = project.database as unknown as { switches?: { id: string; name: string }[] };
    db.switches = [...(db.switches ?? []), { id: "sw_path_taken", name: "길" }, { id: "sw_plain", name: "그냥" }];
    map.events.push({ id: "ev_han", name: "한씨", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "부탁하네" }, { kind: "setSwitch", switchId: "sw_path_taken", value: true }, { kind: "setSwitch", switchId: "sw_plain", value: true }])] } as never);
    map.events.push({ id: "ev_fisher", name: "어부", x: 6, y: 6, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "안녕" }]), ...(readSwitch ? [page([{ kind: "text", body: "그래 들었네" }], [{ kind: "switch", switchId: "sw_path_taken", value: true }])] : [])] } as never);
    return { ctx: { project }, mapId: map.id };
  }
  const hanCommands = (ctx: ToolContext, mapId: string) => JSON.stringify(ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_han")!.pages![0]!.commands);
  describe("페이지를 다시 쓸 때 다른 이벤트가 기다리는 상태 쓰기를 지킨다", () => {
    it("patch_event_page — 다른 어디서도 켜지 않는데 어부가 기다리는 스위치는 새 페이지 끝에 되붙이고 알린다", () => {
      const { ctx, mapId } = setup();
      const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] } });
      expect(result.ok).toBe(true);
      expect(hanCommands(ctx, mapId)).toContain('"switchId":"sw_path_taken"');
      // 아무도 읽지 않는 스위치는 되붙이지 않는다.
      expect(hanCommands(ctx, mapId)).not.toContain('"switchId":"sw_plain"');
      expect(result.summary).toContain("Carried over 1 state write");
      expect(result.summary).toContain("sw_path_taken");
    });

    it("dropWrites:true 면 정말 지우고, 이제 쓰는 곳이 없는 것을 결과에 적는다", () => {
      const { ctx, mapId } = setup();
      const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] }, dropWrites: true });
      expect(result.ok).toBe(true);
      expect(hanCommands(ctx, mapId)).not.toContain("sw_path_taken");
      expect(result.summary).toContain("Removed as asked");
      expect(result.summary).toContain("sw_path_taken");
    });

    it("어디서도 읽지 않는 쓰기는 되붙이지 않는다", () => {
      const { ctx, mapId } = setup(false);
      const result = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_han", pageIndex: 0, set: { commands: [{ kind: "text", body: "새 대사" }] } });
      expect(result.ok).toBe(true);
      expect(hanCommands(ctx, mapId)).not.toContain("setSwitch");
      expect(result.summary).not.toContain("Carried over");
    });

    it("upsert_event replacePages 도 같은 길을 쓴다", () => {
      const { ctx, mapId } = setup();
      const result = runTool(ctx, "upsert_event", { mapId, replacePages: true, event: { id: "ev_han", pages: [page([{ kind: "text", body: "갈아엎음" }])] } });
      expect(result.ok).toBe(true);
      expect(hanCommands(ctx, mapId)).toContain('"switchId":"sw_path_taken"');
      expect((result.data as { carriedWrites?: string[] }).carriedWrites).toEqual(["sw:sw_path_taken"]);
    });
  });
  // 2026-11-16 #4751 실모델 확인 2번: 「열쇠를 주는 대신 옆 상자에서 얻게」 를 주는 사람부터 다시 쓰면 열쇠 주기가 되붙고, 뒤에 놓은 상자와 두 군데서 열쇠가 나왔다.
  describe("되붙인 쓰기를 뒤의 호출이 다른 곳에 만들면 되붙인 사본을 걷는다", () => {
    function keySetup(): { ctx: ToolContext; mapId: string } {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      project.database.items.push({ id: "item_gate_key", name: "열쇠", kind: "key" } as never);
      map.events.push({ id: "ev_keeper", name: "문지기", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "열쇠 받게" }, { kind: "changeItem", itemId: "item_gate_key", op: "+=", amount: 1 }])] } as never);
      map.events.push({ id: "ev_gate", name: "문", x: 6, y: 6, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "text", body: "잠겼다" }]), page([{ kind: "text", body: "열렸다" }], [{ kind: "item", itemId: "item_gate_key" }])] } as never);
      return { ctx: { project, assistantRun: true }, mapId: map.id };
    }
    const keeper = (ctx: ToolContext, mapId: string) => JSON.stringify(ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_keeper")!.pages![0]!.commands);

    it("주는 사람을 먼저 다시 쓰고 상자를 놓으면 열쇠는 상자 하나에서만 나오고 결과가 알린다", () => {
      const { ctx, mapId } = keySetup();
      const first = runTool(ctx, "patch_event_page", { mapId, eventId: "ev_keeper", pageIndex: 0, set: { commands: [{ kind: "text", body: "옆 상자를 열어 보게" }] } });
      expect(first.summary).toContain("Carried over 1 state write");
      expect(keeper(ctx, mapId)).toContain("item_gate_key");
      const chest = runTool(ctx, "place_chest", { mapId, x: 3, y: 2, contents: { itemId: "item_gate_key" } });
      expect(chest.ok).toBe(true);
      expect(chest.summary).toContain("Withdrew the item item_gate_key write");
      expect(keeper(ctx, mapId)).not.toContain("item_gate_key");
      const givers = ctx.project.maps[mapId]!.events.filter((e) => JSON.stringify(e.pages).includes('"changeItem","itemId":"item_gate_key"') || JSON.stringify(e.pages).includes('"itemId":"item_gate_key","op":"+="'));
      expect(givers.map((e) => e.id).filter((id) => id !== "ev_gate")).toHaveLength(1);
    });

    it("모델이 되붙은 쓰기를 직접 다시 적었으면(받아들임) 걷지 않는다", () => {
      const { ctx, mapId } = keySetup();
      runTool(ctx, "patch_event_page", { mapId, eventId: "ev_keeper", pageIndex: 0, set: { commands: [{ kind: "text", body: "옆 상자" }] } });
      runTool(ctx, "patch_event_page", { mapId, eventId: "ev_keeper", pageIndex: 0, set: { commands: [{ kind: "text", body: "이것도 받게" }, { kind: "changeItem", itemId: "item_gate_key", op: "+=", amount: 1 }] } });
      const chest = runTool(ctx, "place_chest", { mapId, x: 3, y: 2, contents: { itemId: "item_gate_key" } });
      expect(chest.summary).not.toContain("Withdrew");
      expect(keeper(ctx, mapId)).toContain("item_gate_key");
    });
  });
});
