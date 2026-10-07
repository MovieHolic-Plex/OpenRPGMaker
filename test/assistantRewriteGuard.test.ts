import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { ItemRecord } from "@/project/types";

// 실측(2026-10-07 조수 기능 시험): gpt-6.1-sol 이 가격 하나를 바꾸면서 읽은 회복약 레코드 전체를 되돌려 보냈고,
// 원래 없던 farmTool·captureProfile 을 채우고 저장값 "noLimit" 을 정수 5 로 바꿨다. 거부하면 같은 호출을 다섯 번 반복했다.
function projectWithPotion() {
  const project = createBlankProject();
  const potion = {
    id: "item_potion", name: "회복약", scope: "ally", price: 60, type: "medicine", occasion: "always", consumable: true,
    description: "아군 하나의 HP를 50 회복합니다.", consumptionLimit: "noLimit",
    hpRecovery: { flat: 50, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
    stateEffects: [], usableActorIds: [], usableClassIds: [], healStateIds: [],
  } as unknown as ItemRecord;
  project.database.items = [potion];
  return { project, potion };
}

function assistantCtx(project: ReturnType<typeof createBlankProject>): ToolContext {
  return { project, assistantRun: true };
}

describe("assistant whole-record rewrite guard", () => {
  it("applies only the changed existing fields of an echoed record", () => {
    const { project, potion } = projectWithPotion();
    const ctx = assistantCtx(project);
    const echoed = { ...potion, price: 30, consumptionLimit: 5, farmTool: "hoe", captureProfile: { multiplier: 1, ballClass: "poke" } };
    const result = runTool(ctx, "upsert_item", { item: echoed });
    expect(result.ok).toBe(true);
    const saved = ctx.project.database.items.find(item => item.id === "item_potion") as unknown as Record<string, unknown>;
    expect(saved.price).toBe(30);
    expect(saved.farmTool).toBeUndefined();
    expect(saved.captureProfile).toBeUndefined();
    expect(saved.consumptionLimit).not.toBe(5);
    expect(result.ok && result.diff.warnings.join(" ")).toContain("바뀐 칸 price 만 적용");
  });

  it("rejects an echo whose only differences are fields the record never had", () => {
    const { project, potion } = projectWithPotion();
    const result = runTool(assistantCtx(project), "upsert_item", { item: { ...potion, farmTool: "hoe" } });
    expect(result.ok).toBe(false);
  });

  it("keeps a minimal patch untouched", () => {
    const { project } = projectWithPotion();
    const ctx = assistantCtx(project);
    const result = runTool(ctx, "upsert_item", { item: { id: "item_potion", price: 30 } });
    expect(result.ok).toBe(true);
    expect(ctx.project.database.items[0]!.price).toBe(30);
  });

  it("does not store replacePages sent inside the event", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    const ctx: ToolContext = { project, assistantRun: true };
    const created = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_probe", x: 1, y: 1, pages: [{ commands: [] }] } });
    expect(created.ok).toBe(true);
    const result = runTool(ctx, "upsert_event", {
      mapId, replacePages: true, event: { id: "ev_probe", replacePages: true, pages: [{ commands: [] }, { commands: [] }] },
    });
    expect(result.ok).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find(entry => entry.id === "ev_probe") as unknown as Record<string, unknown>;
    expect("replacePages" in event).toBe(false);
  });
});
