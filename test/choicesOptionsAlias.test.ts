// 선택지 보기 목록을 `choices` 로 쓴 명령 — place_npc 가 「command.options is not iterable」 로 죽던 것(2026-09-24 JRPG 도그푸딩).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";

describe("choices 보기 목록 별칭", () => {
  it("choices/items/answers 를 options 로 옮긴다(options 가 이미 있으면 건드리지 않는다)", () => {
    const command: Record<string, unknown> = { kind: "choices", items: [{ text: "예", commands: [{ kind: "text", body: "좋아" }] }] };
    expect(canonicalizeCommandFieldAlias(command)).toContain("choices.items 를 options 로");
    expect(command).toEqual({ kind: "choices", options: [{ text: "예", branch: [{ kind: "text", body: "좋아" }] }] });
    const kept: Record<string, unknown> = { kind: "choices", options: [{ text: "예", branch: [] }], choices: [{ text: "x" }] };
    canonicalizeCommandFieldAlias(kept);
    expect(kept.options).toEqual([{ text: "예", branch: [] }]);
  });

  it("place_npc 여관 선택지가 TypeError 없이 배치된다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "place_npc", {
      mapId: ctx.project.startMapId, id: "ev_inn", name: "여관 주인", x: 4, y: 4, movement: "fixed",
      pages: [{ conditions: [], commands: [{ kind: "text", body: "쉬어 가요" }, { kind: "choices", choices: [
        { text: "숙박", branch: [{ kind: "recoverAll", actorId: "actor_hero" }] }, { text: "그만", branch: [{ kind: "text", body: "안녕" }] },
      ] }] }],
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const commands = ctx.project.maps[ctx.project.startMapId]!.events.find((event) => event.id === "ev_inn")!.pages![0]!.commands;
    const choices = commands.find((command) => command.kind === "choices") as { options: { text: string }[] };
    expect(choices.options.map((option) => option.text)).toEqual(["숙박", "그만"]);
  });
});
