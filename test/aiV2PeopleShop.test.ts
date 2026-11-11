import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { createV2Tools } from "@/ai/v2/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { createBlankProject } from "@/project/defaults";

// 2026-11-11 구조 재점검 5-1: 상점 주인 한 명에 호출 4~6번이 들었다(add_people 에 상점 칸이 없고 상점 도구는 뒤로 밀려 있었다).
async function addPeople(people: unknown[]) {
  const project = createBlankProject();
  const task = "이 맵에 상점 주인 한 명 세워 줘";
  const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
    emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as unknown as PiAssistantV2Env;
  const tool = createV2Tools(env, new V2Session()).find((entry) => entry.name === "add_people");
  assert(tool);
  const res = await tool.execute("call-1", { people } as never, undefined as never);
  const text = (res.content as { type: string; text?: string }[]).find((part) => part.type === "text")?.text ?? "{}";
  return { project: env.ctx.project, result: JSON.parse(text) as { ok: boolean; summary: string; warnings?: string[] } };
}

describe("add_people sells — 상점 주인을 한 번에", () => {
  it("있는 아이템은 이름으로 찾아 대사 뒤에 사고파는 상점을 단다", async () => {
    const { project, result } = await addPeople([{ role: "상인", name: "잡화점 주인 보리", where: "광장", firstTalk: ["어서 오세요!"], sells: [{ item: "회복약" }, { item: "해독초", price: 30 }] }]);
    assert(result.ok, result.summary);
    const keeper = project.maps[project.startMapId]!.events.find((event) => event.name === "잡화점 주인 보리");
    assert(keeper?.pages?.length);
    const kinds = keeper.pages[0]!.commands.map((command) => command.kind);
    expect(kinds.indexOf("shop")).toBeGreaterThan(kinds.indexOf("text"));
    const shop = keeper.pages[0]!.commands.find((command) => command.kind === "shop") as { stock: { itemId: string; priceOverride?: number }[]; allowSell: boolean };
    expect(shop.allowSell).toBe(true);
    expect(shop.stock).toEqual([{ itemId: "item_potion" }, { itemId: "item_antidote", priceOverride: 30 }]);
  });

  it("없는 이름은 값만 있는 잡화로 만들고 그 사실을 알린다", async () => {
    const { project, result } = await addPeople([{ role: "상인", name: "지도 장수", sells: [{ item: "마을 지도", price: 15 }] }]);
    assert(result.ok, result.summary);
    const made = project.database.items.find((item) => item.name === "마을 지도");
    expect(made).toMatchObject({ price: 15 });
    expect((result.warnings ?? []).join("\n")).toContain("new plain items were created");
  });

  it("sells 가 없으면 상점을 달지 않는다", async () => {
    const { project, result } = await addPeople([{ role: "촌장", name: "촌장 하르", firstTalk: ["어서 오게."] }]);
    assert(result.ok, result.summary);
    const chief = project.maps[project.startMapId]!.events.find((event) => event.name === "촌장 하르");
    expect(chief?.pages?.[0]?.commands.some((command) => command.kind === "shop")).toBe(false);
  });
});
