// poke-sys ② 기본 캠페인의 필드 도구·낚시: 도구점 진열, 낚싯대 규칙, 낚시 구역(물 칸만), upsert_item 도구 검증. 작성만 했고 실행하지 않았다(워크트리 규칙).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { serialize, deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { attemptFishingCatch } from "@/project/fishing";
import { EXPEDITION_FIELD_ITEM_IDS, EXPEDITION_FISHING_ROD_ID } from "@/project/examples/monsterExpedition/fieldItems";

describe("monster campaign field items", () => {
  it("ships repellents, an escape rope, an angler with a rod and one fishing pond that only covers water", async () => {
    const ctx: any = { project: createBlankProject(), currentMapId: undefined };
    ctx.currentMapId = ctx.project.startMapId;
    // 체육관 수로 세계를 덜어 내면(#2573·#2581) 1~2관 판에는 낚시할 물길(강·항구·해변의 넓은 물)이 없다 — 강이 남는 3관 판에서 본다.
    const built = await runToolAsync(ctx, "build_monster_game", { mode: "create", gymCount: 3 });
    expect(built.ok).toBe(true);
    const project = deserialize(serialize(ctx.project));
    for (const id of [...EXPEDITION_FIELD_ITEM_IDS, EXPEDITION_FISHING_ROD_ID]) expect(project.database.items.some((item) => item.id === id)).toBe(true);
    const shops = Object.values(project.maps).flatMap((map) => map.events.flatMap((event) => JSON.stringify(event.pages ?? event.commands)));
    expect(shops.some((json) => json.includes('"mx_repel"') && json.includes('"mx_escape_rope"'))).toBe(true);
    const spot = project.system.fishing!.spots[0]!;
    expect(spot.catches).toEqual([]);
    expect(spot.monsterCatches!.length).toBeGreaterThan(0);
    expect(project.system.toolActions).toEqual([{ id: "mx-rod-fish", itemId: EXPEDITION_FISHING_ROD_ID, action: "fish" }]);
    const map = project.maps[spot.mapId]!;
    expect(map.events.some((event) => /angler$/.test(event.id))).toBe(true);
    const session: any = startSession(project, 1);
    expect(session.collections).toBeDefined();
    const target = { mapId: spot.mapId, x: spot.area.x, y: spot.area.y };
    expect(attemptFishingCatch(project, session, target)).toMatchObject({ ok: false, reason: "tool" });
    session.inventory[EXPEDITION_FISHING_ROD_ID] = 1;
    const cast = attemptFishingCatch(project, session, target);
    expect(cast).toMatchObject({ ok: true, kind: "encounter" });
  }, 120_000);
});

describe("upsert_item field utility fields", () => {
  it("accepts repelSteps / escapeTo and rejects invalid values", () => {
    const ctx: any = { project: createBlankProject(), currentMapId: undefined };
    ctx.currentMapId = ctx.project.startMapId;
    const ok = runTool(ctx, "upsert_item", { item: { id: "r1", name: "향", repelSteps: 120, occasion: "field", scope: "none" } });
    expect(ok.ok).toBe(true);
    expect(ctx.project.database.items.find((item: any) => item.id === "r1").repelSteps).toBe(120);
    const rope = runTool(ctx, "upsert_item", { item: { id: "e1", name: "로프", escapeTo: "entrance", occasion: "field", scope: "none" } });
    expect(rope.ok).toBe(true);
    expect(runTool(ctx, "upsert_item", { item: { id: "r2", name: "나쁜 향", repelSteps: 0 } }).ok).toBe(false);
    expect(runTool(ctx, "upsert_item", { item: { id: "e2", name: "나쁜 로프", escapeTo: "somewhere" } }).ok).toBe(false);
    const wrongOccasion = runTool(ctx, "upsert_item", { item: { id: "r3", name: "배틀 향", repelSteps: 5, occasion: "battle", scope: "ally" } });
    expect(wrongOccasion.ok).toBe(true);
    // 쓰기 도구 경고는 이제 diff.warnings 로 온다(toolRunner).
    expect((wrongOccasion.diff?.warnings ?? wrongOccasion.warnings ?? []).length).toBeGreaterThan(0);
  });
});
