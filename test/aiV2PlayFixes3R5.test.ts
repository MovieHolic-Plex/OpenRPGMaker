// 확인 빌드 r5(실모델 두 편을 엔딩까지 플레이)에서 다시 나온 결함과 새로 찾은 결함 — 조수가 다음 게임을 지을 때 다시 만들지 않게.
// 증거: claude-viz/av2-confirm-r5-play.html «플레이에서 찾은 조수 결함». 앞 판의 결함은 test/aiV2PlayFixes3.test.ts.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildPeople, pickPersonGraphic } from "@/ai/v2/place/people";
import { npcGraphicIntent } from "@/assets/charsetQuery";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { bossDefeatReturns } from "@/ai/v2/story/bossTalkBattles";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

type Obj = Record<string, unknown>;
const page = (conditions: unknown[], commands: unknown[], kind = "action", more: Obj = {}) =>
  ({ id: "p", name: "p", conditions, trigger: { kind }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...more });
const event = (id: string, name: string, x: number, y: number, pages: unknown[], kind = "action") => ({ id, name, x, y, trigger: { kind }, commands: [], pages });
const chip = (sheet: string, index: number) => ({ sprite: { type: "bundled", id: `tex_easyrpg_charset_${sheet}` }, direction: "down", pattern: charsetFrameIndex({ characterIndex: index, direction: "down", pattern: 1 }) });
const runOf = (project: Project) => createBuildRun({ project, currentMapId: project.startMapId, assistantRun: true } as never);
const standing = (taken: readonly (readonly [string, number])[]) => taken.map(([sheet, index], n) => event(`ev_t${n}`, `사람${n}`, n, 6, [page([], [], "action", { graphic: chip(sheet, index) })])) as unknown as GameEvent[];
const chipOf = (project: Project, name: string): string | undefined => {
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) if (ev.name === name) {
    const g = ev.pages![0]!.graphic as unknown as { sprite: { id: string }; pattern: number };
    return `${g.sprite.id.replace("tex_easyrpg_charset_", "")}#${decodeCharsetFrameIndex(g.pattern).characterIndex}`;
  }
  return undefined;
};

// 얼굴: «젊은 여자 주모» 가 노파, 같은 이름의 농부가 밖과 안에서 다른 얼굴, 서기와 등대지기가 한 얼굴.
describe("이름 있는 사람의 얼굴 — 확인 빌드 r5", () => {
  it("«젊은» · «늙은» 을 나이로 읽는다", () => {
    // «젊은 여자 주모 앞치마» 에서 성별만 읽혀, 젊은 여성 칩이 이미 선 게임에서 노파 칩이 «맞는 칩» 으로 섰다.
    expect(npcGraphicIntent("주모 젊은 여자 주모 앞치마")).toEqual({ gender: "female", age: "youth" });
    expect(npcGraphicIntent("늙은 어부").age).toBe("elder");
  });

  it("젊은 여자 주모는 젊은 여성 칩이 이미 서 있어도 노파로 서지 않는다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.events = standing([["people1", 3]]);
    const pick = pickPersonGraphic(project, map, "주모", "젊은 여자 주모 앞치마", true)!;
    expect(pick.label).toBe("젊은 여성");
    expect(pick.shared).toBe(true);
  });

  it("같은 사람을 다른 장소에 다시 세우면 같은 칩이다 — 이름 끝의 괄호는 선 자리일 뿐", () => {
    const project = createBlankProject() as Project;
    const start = project.maps[project.startMapId]!;
    project.maps.map_home = { ...structuredClone(start), id: "map_home", name: "말순네 농가", events: [] } as typeof start;
    const run = runOf(project);
    expect(buildPeople(run, [{ role: "농부", name: "농부 말순", looks: "농부 여자 아주머니" }, { role: "주모", name: "주모 선이", looks: "젊은 여자 주모 앞치마" }], project.startMapId).ok).toBe(true);
    const again = buildPeople(run, [{ role: "농부", name: "농부 말순 (집)", looks: "농부 여자 아주머니" }], "map_home");
    expect(again.ok).toBe(true);
    expect(again.summary).toContain("앞선 모습");
    expect(chipOf(run.ctx.project, "농부 말순 (집)")).toBe(chipOf(run.ctx.project, "농부 말순"));
    // 남의 칩은 그대로 남의 것이다 — 주모는 다른 칩.
    expect(chipOf(run.ctx.project, "주모 선이")).not.toBe(chipOf(run.ctx.project, "농부 말순"));
  });

  it("주민 칩이 모두 선 뒤에는 꼬리표 없는 그냥 사람 칩이 먼저다 — 같은 얼굴 둘이 되기 전에", () => {
    // 역할을 못 알아들은 «회관 서기» 가 «등대지기» 와 같은 콧수염 칩으로 섰다 — 안 선 노파 칩은 후보에 없었다.
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.events = standing([["people1", 2], ["people1", 3], ["people1", 4], ["people1", 5], ["people1", 6]]);
    const pick = pickPersonGraphic(project, map, "회관 서기", undefined, true)!;
    expect(pick.label).toBe("노파");
    expect(pick.shared).toBeUndefined();
  });
});

// «정신을 차리니 「수로 동굴 입구」 입구다.»
describe("깨어나는 글 — 확인 빌드 r5", () => {
  it("이름이 «입구» 로 끝나는 맵에는 «입구» 를 덧붙이지 않는다", () => {
    const project = createBlankProject() as Project;
    const start = project.maps[project.startMapId]!;
    start.name = "마을";
    const cave = { ...structuredClone(start), id: "map_cave", name: "수로 동굴 입구", events: [] } as typeof start;
    project.maps[cave.id] = cave;
    start.events = [event("ev_door", "", 8, 8, [page([], [{ kind: "transfer", mapId: "map_cave", x: 3, y: 9 }], "playerTouch")], "playerTouch")] as never;
    cave.events = [event("ev_bat", "박쥐", 5, 5, [page([], [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: false }], "eventTouch")], "eventTouch")] as never;
    (project.system as unknown as Obj).gameOver = { outcome: "recover", message: "눈앞이 캄캄해졌다." };
    project.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" }, steps: [{ id: "s1", place: "마을", event: "x", label: "l" }] } as never;
    const run = runOf(project);
    expect(bossDefeatReturns(run)).toHaveLength(1);
    const def = (run.ctx.project.system as unknown as { gameOvers: { id: string; settings: { message: string } }[] }).gameOvers.find((g) => g.id === "go_back_map_cave")!;
    expect(def.settings.message).toContain("정신을 차리니 「수로 동굴 입구」다.");
  });
});

// «의뢰 '멈춘 물레방아'을 완수했다!» 가 의뢰인의 이름표 밑에 떴다.
describe("의뢰의 기본 글 — 확인 빌드 r5", () => {
  const compiled = (title: string): string => {
    const ctx: ToolContext = { project: createEmptyToolProject("의뢰 글") };
    for (const [name, args] of [["create_map", { name: "마을", width: 20, height: 16, id: "m_village" }], ["set_start_position", { mapId: "m_village", x: 10, y: 10 }]] as const)
      expect(runTool(ctx, name, args, { dryRun: false }).ok).toBe(true);
    const def = { key: "q_mill", title, summary: "물레방아가 멈췄다.", giver: { create: { mapId: "m_village", x: 10, y: 8, name: "방앗간 주인 한씨", textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } },
      steps: [{ kind: "talk", target: { create: { mapId: "m_village", x: 5, y: 5, name: "어부 도윤", graphicQuery: "주민" } }, lines: ["강물이 줄었어."] }] };
    expect(runTool(ctx, "create_quest", { def }, { dryRun: false }).ok).toBe(true);
    return JSON.stringify(ctx.project.maps.m_village!.events.find((e) => e.id === "ev_q_mill_giver"));
  };

  it("완료 글은 이름표 없는 서술이고, 조사는 제목의 받침을 따른다", () => {
    const vowel = compiled("멈춘 물레방아");
    expect(vowel).toContain(`{"kind":"text","body":"의뢰 '멈춘 물레방아'를 완수했다!"}`);
    expect(vowel).toContain("의뢰 '멈춘 물레방아'를 수락할까요?");
    expect(compiled("빈 그물")).toContain(`{"kind":"text","body":"의뢰 '빈 그물'을 완수했다!"}`);
  });
});
