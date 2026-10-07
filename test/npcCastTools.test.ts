// NPC 를 만드는 툴은 대사를 지어내지 않는다 — 대사 없는 '대기' 페이지를 만들고 캐스트 라이터에 맡긴다.
//
// 실측 배경(2026-09-03): author_village 는 인자에 대사 자리가 없어(npcCount 만) 항상 DEFAULT_NPCS 10명
// (민재·소라·대길…)의 고정 대사를 돌려썼고, make_villager/place_npc 는 대사를 빼면 "안녕하세요." /
// "일하는 중이야." 를, 밑그림 npc 자동 배치는 "${name}입니다." 를 박았다. 테마와 무관하게 늘 같은 마을이
// 나온 이유다. 여기서는 생성 코드의 그 문구가 전부 사라졌음을 고정한다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";

function textBodies(event: GameEvent): string[] {
  return (event.pages ?? []).flatMap((page) => page.commands.filter((command): command is Extract<Command, { kind: "text" }> => command.kind === "text").map((command) => command.body));
}

describe("make_villager / place_npc — 대사를 빼면 인사말을 대신 넣지 않는다", () => {
  it("dialogue 없는 make_villager 의 기본 페이지·활동 페이지는 text 커맨드가 없다", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps.map_blank_start!;
    const result = runTool(ctx, "make_villager", {
      mapId: map.id,
      name: "농부",
      home: { x: 2, y: 2 },
      dailyRoutine: { workAt: { x: 4, y: 2 }, workHours: [6, 18] },
    });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[map.id]!.events.find((entry) => entry.pages?.[0]?.name === "농부")!;
    expect(event).toBeTruthy();
    expect(textBodies(event)).toEqual([]);
    expect((event.pages ?? []).length).toBeGreaterThanOrEqual(2);
    expect(event.pages!.some((page) => page.conditions.some((condition) => condition.kind === "npcActivity"))).toBe(true);
  });

  it("friendshipUnlock 페이지는 대사 인자가 없으면 text 없이 만들어지고 friendshipLines 로만 채워진다", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps.map_blank_start!;
    const bare = runTool(ctx, "make_villager", { mapId: map.id, name: "마법사", home: { x: 2, y: 2 }, dialogue: [{ text: "기록을 찾고 있어." }], friendshipUnlock: 80 });
    expect(bare.ok, bare.summary).toBe(true);
    const bareEvent = ctx.project.maps[map.id]!.events.find((entry) => entry.pages?.[0]?.name === "마법사")!;
    expect(textBodies(bareEvent)).toEqual(["기록을 찾고 있어."]);

    const ctx2 = { project: createBlankProject() };
    const map2 = ctx2.project.maps.map_blank_start!;
    const authored = runTool(ctx2, "make_villager", {
      mapId: map2.id,
      name: "마법사",
      home: { x: 2, y: 2 },
      dialogue: [{ text: "기록을 찾고 있어." }],
      friendshipUnlock: 80,
      friendshipLines: { unlock: "네가 도와줬으니 서고 열쇠를 맡기지.", after: "서고는 잘 쓰고 있나?" },
    });
    expect(authored.ok, authored.summary).toBe(true);
    const authoredEvent = ctx2.project.maps[map2.id]!.events.find((entry) => entry.pages?.[0]?.name === "마법사")!;
    expect(textBodies(authoredEvent)).toEqual(["기록을 찾고 있어.", "네가 도와줬으니 서고 열쇠를 맡기지.", "서고는 잘 쓰고 있나?"]);
  });
});

describe("author_npc_cast — 캐스트 시트를 페이지·세계관에 적용한다", () => {
  it("대기 페이지를 채우고 비텍스트 커맨드(상점)를 보존하며 주민을 세계관 개체로 등록한다", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps.map_blank_start!;
    const potion = ctx.project.database.items[0]?.id;
    expect(potion).toBeTruthy();
    const a = runTool(ctx, "place_npc", { mapId: map.id, x: 2, y: 2, name: "주민 1", pages: [{}], id: "ev_a" });
    const b = runTool(ctx, "place_npc", { mapId: map.id, x: 5, y: 2, name: "주민 2", pages: [{}], id: "ev_b" });
    const stock = runTool(ctx, "set_shop_stock", { mapId: map.id, eventId: "ev_b", stock: [{ itemId: potion }] });
    expect(a.ok && b.ok && stock.ok, `${a.summary} / ${b.summary} / ${stock.summary}`).toBe(true);
    const result = runTool(ctx, "author_npc_cast", {
      mapId: map.id,
      residents: [
        { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"], pages: [{ pageId: "ev_a_p0", lines: ["다래 가게에 은어를 넘겼어요."] }] },
        { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터 상인", knows: ["ev_a"], pages: [{ pageId: "ev_b_p0", lines: ["은호가 잡은 은어가 특산이에요."] }] },
      ],
    });
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    const events = ctx.project.maps[map.id]!.events;
    const eunho = events.find((event) => event.id === "ev_a")!;
    const darae = events.find((event) => event.id === "ev_b")!;
    expect(eunho.pages![0]!.name).toBe("은호");
    expect(textBodies(eunho)).toEqual(["다래 가게에 은어를 넘겼어요."]);
    expect(textBodies(darae)).toEqual(["은호가 잡은 은어가 특산이에요."]);
    expect(darae.pages![0]!.commands.some((command) => command.kind === "shop")).toBe(true);
    const world = ctx.project.world!;
    expect(world.entities.filter((entity) => entity.type === "character").map((entity) => entity.name).sort()).toEqual(["다래", "은호"]);
    expect(world.relations.some((relation) => relation.kind === "knows")).toBe(true);
    expect(result.diff?.eventsModified).toBe(2);
    expect(result.diff?.worldEntitiesAdded).toBeGreaterThanOrEqual(3);
  });
});
