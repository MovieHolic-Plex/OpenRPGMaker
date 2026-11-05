import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { pickDefaultItemIcon } from "@/editor/tools/defaultItemIcon";
import { isPlaceholderIcon, livePlaceholderIcons, prepareItemIconTargets } from "@/editor/tools/itemIconTools";
import { drawItemIcons } from "../scripts/lib/piItemIcons";
import type { CinematicStillResult } from "@/editor/openingImageGeneration";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function upsertItem(ctx: ToolContext, id: string, name: string, extra: Record<string, unknown> = {}) {
  const result = runTool(ctx, "upsert_item", { item: { id, name, type: "medicine", ...extra } }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  return result;
}

describe("이름에 맞는 아이콘이 없으면 「대신 쓴 그림」으로 적는다", () => {
  it("나그네 도시락은 종류 기본 그림(빨간 물약)을 받지만 대신 쓴 그림으로 표시된다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = upsertItem(ctx, "item_lunchbox", "나그네 도시락");
    expect(ctx.project.database.items.find((item) => item.id === "item_lunchbox")?.iconResourceId).toBe("cc0-jetrel-potion-red");
    expect(isPlaceholderIcon(ctx.project, "items", "item_lunchbox")).toBe(true);
    expect(result.diff?.warnings?.join("\n")).toContain("generate_item_icon");
  });

  it("이름 낱말이 맞는 기본 그림(여우 가죽 장갑 → 장갑)은 맞는 것으로 본다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    runTool(ctx, "upsert_equipment", { equipment: { id: "equip_fox_gloves", name: "여우 가죽 장갑", slot: "accessory" } }, { dryRun: false });
    expect(ctx.project.database.equipment.find((entry) => entry.id === "equip_fox_gloves")?.iconResourceId).toBe("cc0-jetrel-gloves");
    expect(isPlaceholderIcon(ctx.project, "equipment", "equip_fox_gloves")).toBe(false);
  });

  it("한 글자 한국어 낱말이 낱말 전체일 때 맞는다(달빛 차 → 차), 다른 낱말 속에서는 맞지 않는다", () => {
    expect(pickDefaultItemIcon({ name: "달빛 차" }, "medicine")).toBe("cc0-jetrel-tea");
    expect(pickDefaultItemIcon({ name: "차가운 돌" }, "medicine")).toBe("cc0-jetrel-potion-red");
    expect(pickDefaultItemIcon({ name: "수정 구슬" }, "special")).toBe("cc0-jetrel-crystal");
  });

  it("설명에만 있는 낱말은 그림을 고르지만 이름에 맞는 것으로 보지 않는다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    upsertItem(ctx, "item_bento", "나그네 도시락", { description: "주먹밥과 빵을 싼 도시락" });
    expect(ctx.project.database.items.find((item) => item.id === "item_bento")?.iconResourceId).toBe("cc0-jetrel-bread");
    expect(isPlaceholderIcon(ctx.project, "items", "item_bento")).toBe(true);
  });

  it("직접 준 아이콘이 있으면 표식이 지워진다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    upsertItem(ctx, "item_lunchbox", "나그네 도시락");
    upsertItem(ctx, "item_lunchbox", "나그네 도시락", { iconResourceId: "cc0-jetrel-bread" });
    expect(livePlaceholderIcons(ctx.project)).toEqual([]);
  });

  it("상태는 기본 그림이 없어 빈칸으로 표시된다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    runTool(ctx, "upsert_state", { state: { id: "state_homesick", name: "향수병" } }, { dryRun: false });
    expect(isPlaceholderIcon(ctx.project, "states", "state_homesick")).toBe(true);
  });
});

describe("drawItemIcons", () => {
  const ok = (resourceId: string): CinematicStillResult => ({ ok: true, resourceId, name: "아이콘", prompt: "", dataUrl: PNG_1PX });

  it("그린 그림을 등록해 레코드에 잇고 표식을 지운다", async () => {
    const ctx: ToolContext = { project: createBlankProject() };
    upsertItem(ctx, "item_lunchbox", "나그네 도시락");
    const targets = prepareItemIconTargets(ctx.project, {});
    const seen: Record<string, unknown>[] = [];
    const outcomes = await drawItemIcons(targets, {
      ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }),
      generate: async (_project, args) => { seen.push(args); return ok("generated-item-icon_t1"); },
    });
    expect(outcomes.map((o) => o.ok)).toEqual([true]);
    expect((seen[0]!.itemIcon as { name: string }).name).toBe("나그네 도시락");
    expect(ctx.project.database.items.find((item) => item.id === "item_lunchbox")?.iconResourceId).toBe("generated-item-icon_t1");
    expect(ctx.project.assets.uploaded["generated-item-icon_t1"]?.kind).toBe("picture");
    expect(isPlaceholderIcon(ctx.project, "items", "item_lunchbox")).toBe(false);
  });

  it("실패하면 대신 쓴 그림을 두고 시도 횟수를 올린다", async () => {
    const ctx: ToolContext = { project: createBlankProject() };
    upsertItem(ctx, "item_lunchbox", "나그네 도시락");
    const outcomes = await drawItemIcons(prepareItemIconTargets(ctx.project, {}), {
      ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }),
      generate: async () => ({ ok: false, code: "image-generation-failed", summary: "한도 초과" }),
    });
    expect(outcomes[0]!.ok).toBe(false);
    expect(ctx.project.database.items.find((item) => item.id === "item_lunchbox")?.iconResourceId).toBe("cc0-jetrel-potion-red");
    expect(livePlaceholderIcons(ctx.project)[0]!.mark.attempts).toBe(1);
  });

  it("그리는 동안 아이콘이 바뀌면 새 그림을 붙이지 않는다", async () => {
    const ctx: ToolContext = { project: createBlankProject() };
    upsertItem(ctx, "item_lunchbox", "나그네 도시락");
    const outcomes = await drawItemIcons(prepareItemIconTargets(ctx.project, {}), {
      ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }),
      generate: async () => { upsertItem(ctx, "item_lunchbox", "나그네 도시락", { iconResourceId: "cc0-jetrel-bread" }); return ok("generated-item-icon_t2"); },
    });
    expect(outcomes[0]!.ok).toBe(false);
    expect(ctx.project.database.items.find((item) => item.id === "item_lunchbox")?.iconResourceId).toBe("cc0-jetrel-bread");
  });

  it("generate_item_icon 레지스트리 실행은 생성 경로가 없다고 실패한다(헤드리스에서 그렸다고 보고하지 않는다)", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    upsertItem(ctx, "item_lunchbox", "나그네 도시락");
    const result = runTool(ctx, "generate_item_icon", {}, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(isPlaceholderIcon(ctx.project, "items", "item_lunchbox")).toBe(true);
  });
});
