// 추격 곡이 추격 상태를 따라가는가 + 음악만 바라는 요청의 범위(2026-10-30 실조수 e2e r11·r12 후속).
// r12: 금고를 열 때만 추격 곡으로 바꿔서, 스위치가 켜진 채 맵에 다시 들어오거나 잡혀서 다시 시작하면 평소 곡이 깔렸다.
// r12: 검토자의 «체크포인트가 추격자 시야 안» 우려가 관문 글로 넘어가 조수가 상자를 찍고 make_chase_scene 을 불렀다.
// r11: 엔딩곡 요청에 이미 있던 ev_boss 의 triggerEnding 을 못 보고 «triggerEnding 이 없다»고 막았다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { resolveMapBgm } from "@/project/mapMusic";
import { musicOnly } from "@/ai/v2/musicWords";
import { v2ExtraToolNames } from "@/ai/v2/game";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import { advisorFollowUp, scopeAdviceToRequest, type AdvisorVerdict } from "@/ai/v2/advisor";
import type { GameMap, Project } from "@/project/types";

function chaseProject() {
  const ctx = { project: createBlankProject() };
  const must = (name: string, args: Record<string, unknown>) => {
    const result = runTool(ctx, name, args, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    return result;
  };
  must("create_map", { id: "map_cellar", name: "지하실", width: 20, height: 15 });
  must("upsert_event", { mapId: "map_cellar", event: { id: "ev_safe", name: "금고", x: 15, y: 10, commands: [{ kind: "setSwitch", switchId: "sw_chase_on", value: true }] } });
  must("make_chase_scene", { mapId: "map_cellar", id: "ev_chaser", chaser: { at: { x: 3, y: 3 }, speed: 4 }, activateSwitch: "sw_chase_on", killOnTouch: true, hidingSpots: [], patrol: { mode: "auto" } });
  return { ctx, must };
}

describe("chase music follows the chase switch", () => {
  it("leaves a while-switch entry music on the chaser map, idempotently", () => {
    const { ctx, must } = chaseProject();
    const [first, second] = listAudioResources("music", ctx.project).map((r) => r.id);
    const mapBgm = structuredClone(ctx.project.maps.map_cellar!.bgm);
    must("set_game_audio", { role: "chase", resourceId: first });
    must("set_game_audio", { role: "chase", resourceId: second });
    const map = ctx.project.maps.map_cellar!;
    expect(map.bgmWhileSwitch).toEqual([{ switchId: "sw_chase_on", resourceId: second }]);
    // 평소 맵 곡은 그대로 — 스위치가 꺼져 있으면 평소 곡이다.
    expect(map.bgm).toEqual(mapBgm);
  });

  it("upgrades an older unguarded switch-on cue to the guarded one without duplicating it", () => {
    const { ctx, must } = chaseProject();
    const id = listAudioResources("music", ctx.project)[0]!.id;
    const safe = ctx.project.maps.map_cellar!.events.find((e) => e.id === "ev_safe")!;
    safe.pages![0]!.commands.unshift({ kind: "m2Command", commandId: "m2-063-memorize-current-bgm", fields: {} } as never, { kind: "playAudio", resourceId: "old", loop: true, channel: "bgm" } as never);
    must("set_game_audio", { role: "chase", resourceId: id });
    must("set_game_audio", { role: "chase", resourceId: id });
    const commands = ctx.project.maps.map_cellar!.events.find((e) => e.id === "ev_safe")!.pages![0]!.commands as unknown as { kind: string; then?: { kind: string; resourceId?: string }[] }[];
    expect(commands.map((c) => c.kind)).toEqual(["fork", "setSwitch"]);
    expect(commands[0]!.then!.map((c) => c.resourceId ?? c.kind)).toEqual(["m2Command", id]);
  });

  it("resolves the chase track on map entry only while the switch is on", () => {
    const maps = { m: { id: "m", bgm: { mode: "custom", resourceId: "calm" }, bgmWhileSwitch: [{ switchId: "sw", resourceId: "chase" }] } as unknown as GameMap };
    const project = { maps, mapTree: { mapId: "m", children: [] }, system: {} } as unknown as Parameters<typeof resolveMapBgm>[0];
    expect(resolveMapBgm(project, "m", { switches: { sw: true } })).toEqual({ kind: "play", resourceId: "chase" });
    expect(resolveMapBgm(project, "m", { switches: { sw: false } })).toMatchObject({ kind: "play", resourceId: "calm" });
    // 스위치를 넘기지 않는 호출(편집기 미리보기·추천)은 평소 곡.
    expect(resolveMapBgm(project, "m")).toMatchObject({ kind: "play", resourceId: "calm" });
  });
});

describe("music-only requests", () => {
  it.each([
    ["아오오니 느낌으로 추격 음악", true],
    ["투더문처럼 잔잔하게 엔딩곡", true],
    ["테일즈런너처럼 신나는 거 마을에 깔아 줘", true],
    ["배경음악 추가해 줘", true],
    ["엔딩곡 만들어 줘", true],
    ["보스 만들고 보스곡 넣어 줘", false],
    ["추격자 만들고 추격 음악", false],
    ["마을을 만들고 배경음악 깔아 줘", false],
    ["파판처럼 마을 만들어", false],
  ] as const)("「%s」 music-only = %s", (task, expected) => {
    expect(musicOnly(task)).toBe(expected);
  });

  it("does not load map/event writing tools for a music-only chase request", () => {
    const names = v2ExtraToolNames("아오오니 느낌으로 추격 음악");
    expect(names).toContain("set_game_audio");
    expect(names).toContain("store_find_music");
    for (const tool of ["stamp_object", "make_chase_scene", "list_spatial_designs", "define_ending"]) expect(names).not.toContain(tool);
  });

  it("demotes reviewer concerns about pre-existing issues to notes, keeps report-honesty blockers", () => {
    const verdict: AdvisorVerdict = { ms: 1, inputChars: 1, notes: [
      { level: "blocker", what: "[출하 차단 default-hero] 기본 주인공이 남았다", evidence: "-" },
      { level: "concern", what: "체크포인트가 추격자 시야 안에 있어 위험함", evidence: "⚠ 위협" },
      { level: "blocker", claim: "추격 곡을 걸었다", what: "보고의 주장이 실제 변경과 반대다", evidence: "-" },
    ] };
    const scoped = scopeAdviceToRequest(verdict, "아오오니 느낌으로 추격 음악");
    expect(scoped.notes.map((n) => n.level)).toEqual(["aside", "aside", "blocker"]);
    expect(scoped.notes[1]!.what).toMatch(/음악 요청 밖/u);
    expect(advisorFollowUp(scoped)).toMatch(/보고의 주장/u);
    // 다른 일이 섞인 요청은 그대로.
    expect(scopeAdviceToRequest(verdict, "추격자 만들고 추격 음악")).toBe(verdict);
  });
});

describe("ending finish-check looks at the whole project", () => {
  const withBossEnding = (): Project => {
    const project = createBlankProject();
    const ctx = { project };
    expect(runTool(ctx, "create_map", { id: "m1", name: "던전", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
    expect(runTool(ctx, "define_ending", { id: "ending_main", name: "끝", priority: 0, conditions: [] }, { dryRun: false }).ok).toBe(true);
    expect(runTool(ctx, "upsert_event", { mapId: "m1", event: { id: "ev_boss", name: "그림자", x: 1, y: 1, commands: [{ kind: "triggerEnding", endingId: "ending_main" }] } }, { dryRun: false }).ok).toBe(true);
    return ctx.project;
  };

  it("does not claim a missing triggerEnding for a music-only ending request", () => {
    const before = withBossEnding();
    const after = structuredClone(before);
    after.endings![0]!.presentation = { ...(after.endings![0]!.presentation ?? {}), musicResourceId: "song" };
    expect(gameContentProblems(before, after, "투더문처럼 잔잔하게 엔딩곡").join("\n")).not.toMatch(/triggerEnding 명령이 없다/u);
  });

  it("counts an existing triggerEnding elsewhere in the project for an ending request", () => {
    const before = withBossEnding();
    const after = structuredClone(before);
    expect(gameContentProblems(before, after, "엔딩 장면 다듬어 줘").join("\n")).not.toMatch(/triggerEnding 명령이 없다/u);
    const empty = createBlankProject();
    expect(gameContentProblems(empty, structuredClone(empty), "엔딩 장면 다듬어 줘").join("\n")).toMatch(/triggerEnding 명령이 없다/u);
  });
});
