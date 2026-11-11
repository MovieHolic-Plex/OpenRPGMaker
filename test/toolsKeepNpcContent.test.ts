import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { freshSession, interact } from "@/harnesses/assistant-capability/node/smallJobs/checkSupport";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { findShadowedPages } from "@/project/eventPageShadow";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

// 이미 있는 NPC 에 도구를 쓸 때 그 사람이 하던 일이 남는가 (2026-11-11 작은 일 둘째 묶음에서 본 결함 셋).
// create_quest: 여관·상점·화자·완료 뒤 대사·움직임 / add_companion: 지금 도는 페이지 + joinParty / set_shop_stock: add·remove, 상점 없던 페이지에 안 넣기.

const VILLAGE = "map_ember_village";
const SNOW = "map_1c3b4f24-9d3d-4c31-9d24-4dbda2df705d";
const MARKET = "map_5eec6ba0-1ac1-48ab-9d7f-db5032670b4c";

function start(fixture: "starter" | "built"): { project: Project } {
  return { project: buildFixture(fixture) };
}
function call(ctx: { project: Project }, tool: string, args: Record<string, unknown>) {
  const result = runTool(ctx, tool, args);
  expect(result.ok, result.summary).toBe(true);
  return result;
}
function eventOf(project: Project, id: string): GameEvent {
  const event = Object.values(project.maps).flatMap((map) => map.events).find((entry) => entry.id === id);
  if (!event) throw new Error(`missing event ${id}`);
  return event;
}
const talk = (project: Project, session: unknown, id: string) => interact(eventOf(project, id) as never, session, project as never);
const kindsOf = (play: { ran: Command[] }): string[] => play.ran.map((command) => command.kind);
const speakersOf = (play: { ran: Command[] }): (string | undefined)[] => play.ran.flatMap((command) => (command.kind === "text" ? [command.speaker] : []));
const pageIds = (event: GameEvent): string[] => (event.pages ?? []).map((page) => page.id);

function errand(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: "q_herb", title: "약초 배달", summary: "미루의 약초를 여관 주인 마사에게 전한다.", presetId: "custom", blueprint: ["talk"], order: "sequence",
    giver: { mapId: VILLAGE, eventId: "ev_ember_child" },
    steps: [{ kind: "talk", target: { mapId: VILLAGE, eventId: "ev_ember_inn" }, lines: ["약초 고마워요."] }],
    dialogue: { accepted: "이 약초를 마사 아줌마한테 전해 줄래?", completed: "고마워! 이건 심부름 값이야." },
    rewards: { gold: 50 },
    ...overrides,
  };
}

describe("create_quest — 이미 있는 NPC 가 하던 일은 남는다", () => {
  it("대상(여관 주인)은 단계 뒤에도 여관이고, 의뢰인은 제 이름으로 말하고 제 움직임을 지키며, 끝나면 제 대사로 돌아간다", () => {
    const ctx = start("starter");
    const before = structuredClone(eventOf(ctx.project, "ev_ember_child").pages!);
    call(ctx, "create_quest", { def: errand() });
    const child = eventOf(ctx.project, "ev_ember_child"), inn = eventOf(ctx.project, "ev_ember_inn");

    // 그 사람 페이지는 그대로, 의뢰 페이지는 뒤에(키가 든 id) — 죽은 페이지 없음.
    expect(child.pages!.slice(0, before.length)).toEqual(before);
    expect(pageIds(child).slice(before.length)).toEqual(["ev_ember_child_q_herb_offer", "ev_ember_child_q_herb_active"]);
    expect(child.pages!.every((page) => page.movement?.type === "random")).toBe(true);
    expect(findShadowedPages(child.pages)).toEqual([]);
    expect(findShadowedPages(inn.pages)).toEqual([]);

    const session = freshSession();
    const offer = talk(ctx.project, session, "ev_ember_child");
    expect(new Set(speakersOf(offer))).toEqual(new Set(["꼬마 미루"]));
    const step = talk(ctx.project, session, "ev_ember_inn");
    expect(speakersOf(step)).toEqual(["여관 주인 마사"]);
    expect(kindsOf(step)).toContain("inn");
    expect(talk(ctx.project, session, "ev_ember_child").gold).toBe(50);
    // 끝난 뒤: 여관 주인은 처음 그대로, 의뢰인은 제 대사(보상은 다시 없음).
    expect(kindsOf(talk(ctx.project, session, "ev_ember_inn"))).toEqual(["text", "inn"]);
    const after = talk(ctx.project, session, "ev_ember_child");
    expect(after.gold).toBe(0);
    expect(after.texts[0]).toContain("세라 누나");
  });

  it("가게 주인이 의뢰인이면 의뢰가 걸려 있는 동안에도 가게가 열린다 — 완료 뒤 대사를 주면 그 대사 뒤에도", () => {
    const ctx = start("starter");
    call(ctx, "create_quest", { def: errand({
      giver: { mapId: VILLAGE, eventId: "ev_ember_inn" },
      steps: [{ kind: "talk", target: { mapId: VILLAGE, eventId: "ev_ember_child" }, lines: ["알았어!"] }],
      dialogue: { afterComplete: "덕분에 방이 다 찼어요." },
    }) });
    const session = freshSession();
    expect(kindsOf(talk(ctx.project, session, "ev_ember_inn")).slice(0, 2)).toEqual(["text", "inn"]);
    const open = talk(ctx.project, session, "ev_ember_inn");
    expect(kindsOf(open).at(-1)).toBe("inn");
    expect(speakersOf(open)).toEqual(["여관 주인 마사"]);
    talk(ctx.project, session, "ev_ember_child");
    expect(talk(ctx.project, session, "ev_ember_inn").gold).toBe(50);
    const done = talk(ctx.project, session, "ev_ember_inn");
    expect(done.texts).toEqual(["덕분에 방이 다 찼어요."]);
    expect(kindsOf(done).at(-1)).toBe("inn");
  });

  it("같은 사람에게 의뢰를 하나 더 얹어도 앞 의뢰가 남는다", () => {
    const ctx = start("starter");
    call(ctx, "create_quest", { def: errand() });
    call(ctx, "create_quest", { def: errand({ key: "q_second", title: "두 번째 심부름", rewards: { gold: 7 } }) });
    const ids = pageIds(eventOf(ctx.project, "ev_ember_child"));
    expect(ids).toEqual(expect.arrayContaining(["ev_ember_child_q_herb_offer", "ev_ember_child_q_herb_active", "ev_ember_child_q_second_offer", "ev_ember_child_q_second_active"]));
    const session = freshSession();
    const rewards: number[] = [];
    for (let round = 0; round < 2; round += 1) {
      talk(ctx.project, session, "ev_ember_child");
      talk(ctx.project, session, "ev_ember_inn");
      rewards.push(talk(ctx.project, session, "ev_ember_child").gold);
    }
    expect(rewards.sort()).toEqual([50, 7].sort());
  });

  it("옛 배치(키 없는 _offer/_active/_done)가 있던 상인: 상점 페이지를 되살리고, 옛 의뢰도 남고, 옛 진행 페이지에서도 상점이 열린다", () => {
    const ctx = start("built");
    const sold = (eventOf(ctx.project, "ev_supply_shop").pages![0]!.commands.find((command) => command.kind === "shop") as { itemIds: string[] }).itemIds;
    call(ctx, "create_quest", { def: errand({
      key: "q_pen", title: "깃펜 심부름", summary: "토르에게 깃펜 값을 묻는다.",
      giver: { mapId: SNOW, eventId: "ev_supply_shop" },
      steps: [{ kind: "talk", target: { mapId: MARKET, eventId: "ev_chain_kehegd7_2" }, lines: ["은화 두 닢이지."] }],
      dialogue: {}, rewards: { gold: 10 },
    }) });
    const merchant = eventOf(ctx.project, "ev_supply_shop");
    expect(pageIds(merchant)).toEqual([
      "ev_supply_shop_base", "ev_supply_shop_q_hearth_offer", "ev_supply_shop_q_hearth_active", "ev_supply_shop_q_hearth_done",
      "ev_supply_shop_q_pen_offer", "ev_supply_shop_q_pen_active",
    ]);
    expect(merchant.pages![0]!.conditions).toEqual([]);
    expect(findShadowedPages(merchant.pages)).toEqual([]);
    const session = freshSession();
    talk(ctx.project, session, "ev_supply_shop");
    const open = talk(ctx.project, session, "ev_supply_shop");
    expect(open.shops.map((shop: { itemIds: string[] }) => shop.itemIds)).toEqual([sold]);
    expect(new Set(speakersOf(open))).toEqual(new Set(["떠돌이 상인"]));
    talk(ctx.project, session, "ev_chain_kehegd7_2");
    expect(talk(ctx.project, session, "ev_supply_shop").gold).toBe(10);
    // 새 의뢰가 끝나면 옛 의뢰 «화롯불의 안부»를 다시 받을 수 있고, 받은 뒤에도 상점이 열린다.
    const old = talk(ctx.project, session, "ev_supply_shop");
    expect(session.switches.sw_q_hearth_started).toBe(true);
    expect(old.shops).toHaveLength(1);
    expect(talk(ctx.project, session, "ev_supply_shop").shops).toHaveLength(1);
  });

  it("장 구성기가 넘기는 takeOverNpcs 는 옛 배치를 그대로 쓴다(폴른 스타 다듬기가 기대는 페이지 순서·기본 문구)", () => {
    const ctx = start("starter");
    call(ctx, "create_quest", { def: errand({ dialogue: {} }), takeOverNpcs: true });
    expect(pageIds(eventOf(ctx.project, "ev_ember_child"))).toEqual(["child_clear", "ev_ember_child_offer", "ev_ember_child_active", "ev_ember_child_done"]);
    expect(pageIds(eventOf(ctx.project, "ev_ember_inn"))).toEqual(["inn_page", "ev_ember_inn_q_herb_talk0", "ev_ember_inn_q_herb_talkdone0"]);
    const done = eventOf(ctx.project, "ev_ember_child").pages!.at(-1)!.commands[0] as { speaker?: string; body?: string };
    expect(done).toMatchObject({ speaker: "의뢰인", body: "자네 덕분에 살았어. 정말 고맙네." });
  });
});

describe("add_companion — 지금 도는 페이지에 붙이고, joinParty 면 파티에도 넣는다", () => {
  it("조건 페이지가 있는 NPC: 게임 시작 때 도는 첫 페이지에 붙는다(마지막 조건 페이지가 아니다)", () => {
    const ctx = start("starter");
    const result = call(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { eventId: "ev_ember_guard" } });
    const guard = eventOf(ctx.project, "ev_ember_guard");
    expect(guard.pages!.map((page) => page.commands.some((command) => command.kind === "addFollower"))).toEqual([true, false, false]);
    expect(kindsOf(talk(ctx.project, freshSession(), "ev_ember_guard"))).toContain("addFollower");
    expect(result.summary).toContain("page 1 of 3");
    expect(JSON.stringify(result)).toContain("joinParty:true");
  });

  it("joinParty: 말을 걸면 파티에 들어오고 그 자리에서 떠난다 — who 를 비우면(빈 문자열 채움 포함) 그 사람으로 배우를 만든다", () => {
    for (const who of [undefined, { actorId: "", query: "", textureKey: "", characterIndex: 0 }]) {
      const ctx = start("starter");
      const actorsBefore = ctx.project.database.actors.length;
      const result = call(ctx, "add_companion", { ...(who ? { who } : {}), target: { eventId: "ev_ember_guard", mapId: "", x: 0, y: 0 }, joinParty: true, name: "" });
      const actorId = (result.data as { actorId: string }).actorId;
      const made = ctx.project.database.actors.find((actor) => actor.id === actorId);
      expect(made?.name).toBe("파수꾼 데릭");
      expect(ctx.project.database.actors).toHaveLength(actorsBefore + 1);
      const guard = eventOf(ctx.project, "ev_ember_guard");
      const session = Object.assign(freshSession(), { partyActorIds: ["actor_hero"] });
      const first = talk(ctx.project, session, "ev_ember_guard");
      expect(first.ran).toContainEqual({ kind: "changeParty", actorId, action: "add" });
      // 합류 뒤: 마지막 페이지(투명·통과)가 이긴다.
      expect(talk(ctx.project, session, "ev_ember_guard").ran).toEqual([]);
      const gone = guard.pages!.at(-1) as EventPage;
      expect(gone).toMatchObject({ id: "ev_ember_guard_joined", graphic: { transparent: true }, priority: "below", commands: [] });
      expect(findShadowedPages(guard.pages)).toEqual([]);
    }
  });

  it("joinParty 에 있는 배우를 주면 그 배우가 들어오고, 그림만 준 동료는 파티에 못 넣는다고 알려 준다", () => {
    const ctx = start("starter");
    call(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { eventId: "ev_ember_guard" }, joinParty: true });
    const play = talk(ctx.project, Object.assign(freshSession(), { partyActorIds: ["actor_hero"] }), "ev_ember_guard");
    expect(play.ran).toContainEqual({ kind: "changeParty", actorId: "actor_guardian", action: "add" });
    const refused = runTool(start("starter"), "add_companion", { who: { query: "고양이" }, target: { eventId: "ev_ember_guard" }, joinParty: true });
    expect(refused.ok).toBe(false);
    expect(refused.summary).toContain("who:{actorId}");
  });

  it("새로 세우는 합류 이벤트: 합류 뒤 페이지가 뒤에 있어 실제로 사라진다", () => {
    const ctx = start("starter");
    const result = call(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { mapId: VILLAGE, x: 12, y: 12 }, trigger: "talk", joinParty: true });
    const id = (result.data as { eventId: string }).eventId;
    const event = eventOf(ctx.project, id);
    expect(findShadowedPages(event.pages)).toEqual([]);
    const session = Object.assign(freshSession(), { partyActorIds: ["actor_hero"] });
    expect(kindsOf(talk(ctx.project, session, id))).toEqual(["addFollower", "changeParty", "setSelfSwitch"]);
    expect(talk(ctx.project, session, id).ran).toEqual([]);
  });
});

describe("set_shop_stock — 더하고 빼기, 상점 없던 페이지는 그대로", () => {
  const shopsPerPage = (event: GameEvent): string[][][] => event.pages!.map((page) => page.commands.flatMap((command) => (command.kind === "shop" ? [command.stock?.map((entry) => entry.itemId) ?? command.itemIds] : [])));
  const was = ["item_gen_potion_large", "item_hi_potion", "item_antidote", "item_gen2_purifying_serum"];

  it("add 는 지금 파는 것에 더하고 remove 는 그것만 뺀다 — 의뢰 페이지에는 상점이 생기지 않는다", () => {
    const ctx = start("built");
    call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", add: [{ itemId: "item_quill" }] });
    expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))).toEqual([[[...was, "item_quill"]], [], []]);
    call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", remove: ["item_antidote"] });
    expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))).toEqual([[["item_gen_potion_large", "item_hi_potion", "item_gen2_purifying_serum", "item_quill"]], [], []]);
  });

  it("빈 배열 채움(stock:[] remove:[])은 «안 줬다»다 — add 만 적용된다", () => {
    const ctx = start("built");
    call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", stock: [], add: [{ itemId: "item_quill" }], remove: [] });
    expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))[0]).toEqual([[...was, "item_quill"]]);
  });

  it("값을 붙여 더하면 stock 표로 옮겨 가격을 지킨다", () => {
    const ctx = start("built");
    call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", add: [{ itemId: "item_quill", priceOverride: 12 }] });
    const shop = eventOf(ctx.project, "ev_supply_shop").pages![0]!.commands.find((command) => command.kind === "shop") as Extract<Command, { kind: "shop" }>;
    expect(shop.stock).toEqual([...was.map((itemId) => ({ itemId })), { itemId: "item_quill", priceOverride: 12 }]);
    expect(shop.itemIds).toEqual([...was, "item_quill"]);
  });

  it("stock 은 여전히 통째로 바꾸지만 상점이 있던 페이지만 고친다", () => {
    const ctx = start("built");
    call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", stock: [{ itemId: "item_quill" }] });
    expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))).toEqual([[["item_quill"]], [], []]);
  });

  it("상점 페이지가 뒤의 조건 없는 페이지에 늘 가려져 있으면 실제로 도는 그 페이지에도 상점을 둔다(2026-08-24 결함 유지)", () => {
    const ctx = start("starter");
    call(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_inn", stock: [{ itemId: "item_potion" }] });
    call(ctx, "add_event_page", { mapId: VILLAGE, eventId: "ev_ember_inn", page: { name: "잡담", conditions: [], commands: [{ kind: "text", body: "오늘은 날이 좋네요." }] } });
    call(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_inn", add: [{ itemId: "item_ether" }] });
    expect(shopsPerPage(eventOf(ctx.project, "ev_ember_inn"))).toEqual([[["item_potion", "item_ether"]], [["item_potion", "item_ether"]]]);
    expect(talk(ctx.project, freshSession(), "ev_ember_inn").shops).toHaveLength(1);
  });

  it("상점이 없던 사람은 add 로 상점이 되고(말할 수 있는 페이지마다), remove 만 주면 거절한다", () => {
    const ctx = start("starter");
    const refused = runTool(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_guard", remove: ["item_potion"] });
    expect(refused.ok).toBe(false);
    expect(refused.summary).toContain("no shop command");
    call(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_guard", add: [{ itemId: "item_potion" }] });
    expect(shopsPerPage(eventOf(ctx.project, "ev_ember_guard"))).toEqual([[["item_potion"]], [["item_potion"]], [["item_potion"]]]);
    const nothing = runTool(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_guard" });
    expect(nothing.ok).toBe(false);
    expect(nothing.summary).toContain("stock (whole replacement), add");
  });
});
