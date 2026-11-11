// 게임 하나를 잇는 «계속» 은 게임 도구 묶음을 받는다 · 그림 요청은 generate_art 를 받는다 · 지시문이 이미 실은 카드를 동사가 다시 돌려주지 않는다
// (2026-11-11 — openwiki/assistant-v2.md 「이어 하기 턴의 도구」).
import { describe, expect, it } from "vitest";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { classifyRequest } from "@/ai/v2/request/intent";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";

function tools(fixture: FixtureId, task: string) {
  const project = buildFixture(fixture);
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env: PiAssistantV2Env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","continue-tools"]` } as never,
    emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => 0,
  };
  const list = createV2Tools(env, new V2Session());
  return { ctx, list, names: new Set(list.map((t) => t.name)) };
}

describe("이어 하기 턴의 도구", () => {
  it.each(["계속", "남은 거 마저 해 줘"])("게임 하나를 잇는 «%s» 은 엔딩·타이틀·이벤트를 고치는 도구를 받는다", (task) => {
    const { ctx, names } = tools("built", task);
    expect(classifyRequest(task, ctx.project).wholeGame).toBe(true);
    for (const name of ["define_ending", "set_title_screen", "upsert_event", "move_event", "upsert_item", "generate_art"]) expect(names.has(name), name).toBe(true);
  });

  it("청사진이 없는 프로젝트의 «계속» 은 게임 하나를 물려받지 않는다 — 지은 것을 고치는 도구는 받는다", () => {
    const { ctx, names } = tools("starter", "계속");
    const intent = classifyRequest("계속", ctx.project);
    expect(intent.wholeGame).toBe(false);
    // 게임 하나의 묶음(엔딩·타이틀)은 이 요청의 도구로 내놓지 않는다 — 풀에 있어 이름으로 부르면 실릴 뿐이다.
    for (const name of ["define_ending", "set_title_screen"]) expect(intent.tools.extra, name).not.toContain(name);
    // 전에는 이벤트를 찾고 옮기는 도구가 만들어지지도 않았다(요청 글에 게임 낱말이 없어서).
    for (const name of ["find_events", "get_event", "patch_event_page", "move_event"]) expect(names.has(name), name).toBe(true);
  });

  it("타이틀 그림을 새로 그려 달라는 작은 요청도 generate_art 를 받고, 대사 고치기는 받지 않는다", () => {
    expect(tools("built", "타이틀 화면 그림 새로 그려 줘").names.has("generate_art")).toBe(true);
    expect(tools("built", "겨울 시장 모피 상인의 첫 대사를 바꿔 줘").names.has("generate_art")).toBe(false);
  });

  it("사람 카드가 지시문에 실린 요청의 첫 add_people 은 카드를 다시 돌려주지 않고 바로 세운다", async () => {
    const { ctx, list } = tools("starter", "이 맵에 상점 주인 한 명 세워 줘.");
    const before = ctx.project.maps[ctx.project.startMapId]!.events.length;
    const res = await list.find((t) => t.name === "add_people")!.execute("c1", { people: [{ role: "상인", name: "잡화점 주인", where: "광장", firstTalk: ["어서 오세요."], sells: [{ item: "회복약" }] }] });
    const head = JSON.parse((res.content as { type: string; text?: string }[])[0]!.text!) as { ok?: boolean; summary?: string };
    expect(head.ok, head.summary).toBe(true);
    expect(ctx.project.maps[ctx.project.startMapId]!.events.length).toBe(before + 1);
  }, 60_000);
});
