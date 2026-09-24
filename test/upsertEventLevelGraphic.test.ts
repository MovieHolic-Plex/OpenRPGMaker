// 2026-09-24 연애 도그푸딩: 조수가 공략 인물에 event.graphic(sprite)을 줬는데 도구가 버려 세 인물이 투명·발밑이 됐다.
// 대사가 「오늘 이미 만났나」 fork 안에만 있어 대화 페이지로도 안 잡혔고, 「한여름」 은 사물로 오판됐다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

const SPRITE = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 25 };
const talkInFork = [{ kind: "fork", condition: { kind: "switch", switchId: "sw_met", value: true },
  then: [{ kind: "text", body: "한여름:\n내일 또 보자!" }], else: [{ kind: "text", body: "한여름:\n어? 왔어?" }] }];

function page(ctx: { project: ReturnType<typeof createBlankProject> }, id: string) {
  return ctx.project.maps[ctx.project.startMapId]!.events.find((event) => event.id === id)!.pages![0]!;
}

describe("upsert_event 인물 그림", () => {
  it("이벤트 최상위 graphic 을 그림 없는 페이지에 입힌다", () => {
    const ctx = { project: createBlankProject() };
    const r = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_summer", name: "한여름", x: 3, y: 3, graphic: SPRITE, pages: [{ trigger: { kind: "action" }, commands: talkInFork }] } });
    expect(r.ok, r.summary).toBe(true);
    expect(page(ctx, "ev_summer").graphic).toMatchObject({ pattern: 25, sprite: { id: "tex_easyrpg_charset_people1" } });
    expect(page(ctx, "ev_summer").priority).toBe("same");
  });
  it("fork 안 대사·「이름:」 본문이면 그림 없어도 인물로 보고 주민 그림을 세운다", () => {
    const ctx = { project: createBlankProject() };
    const r = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_summer", name: "한여름", x: 3, y: 3, pages: [{ trigger: { kind: "action" }, commands: talkInFork }] } });
    expect(r.ok, r.summary).toBe(true);
    expect(page(ctx, "ev_summer").graphic?.sprite).toBeDefined();
    expect(page(ctx, "ev_summer").priority).toBe("same");
  });
});
