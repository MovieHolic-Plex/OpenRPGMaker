// 확인 빌드 r5(실모델 두 편을 엔딩까지 플레이)에서 다시 나온 결함과 새로 찾은 결함 — 조수가 다음 게임을 지을 때 다시 만들지 않게.
// 증거: claude-viz/av2-confirm-r5-play.html «플레이에서 찾은 조수 결함». 앞 판의 결함은 test/aiV2PlayFixes3.test.ts.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import type { GameEvent, Project } from "@/project/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildPeople, pickPersonGraphic } from "@/ai/v2/place/people";
import { npcGraphicIntent, pickNpcGraphic, queryNpcGraphics, resolveNpcGraphic, unmatchedNpcGraphicTerms } from "@/assets/charsetQuery";
import { isPersonName } from "@/ai/v2/story/personName";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { bossDefeatReturns } from "@/ai/v2/story/bossTalkBattles";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { buildBossEncounter } from "@/ai/v2/story/sceneVerbs";
import { enemyArtFor } from "@/ai/v2/place/builders/dungeonFoes";
import { renderTitleScreen } from "@/player/titleScreen";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { planObjective } from "@/ai/v2/judge/objectivePlan";
import { objectiveCommand } from "@/ai/v2/judge/objectiveCommand";
import { createZoneFeedbackModel, currentObjectiveText, updateZoneFeedback } from "@/player/zoneFeedback";
import { blockCutsPath } from "@/editor/tools/dungeonTools";
import { sceneCraftFindings } from "@/ai/v2/judge/sceneCraft";
import { localizeCultureSpec } from "@/ai/v2/place/builders/joseon";
import { sayAs } from "@/ai/v2/story/playerLines";

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
    const pickWith = (taken: readonly (readonly [string, number])[]) => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      map.events = standing(taken);
      return pickPersonGraphic(project, map, "주모", "젊은 여자 주모 앞치마", true)!;
    };
    // 젊은 여성 칩만 섰으면 안 선 이웃 나이(중년 여성) 칩으로 선다 — 얼굴을 나눠 쓰지 않는다.
    const one = pickWith([["people1", 3]]);
    expect(one.label).not.toBe("노파");
    expect(one.shared ?? false).toBe(false);
    // r5a 의 장면: 젊은 여성 · 중년 여성 칩이 다 섰고 남은 여성 칩은 노파뿐이다 — 노파로 서느니 젊은 여성 칩을 나눠 쓴다.
    const two = pickWith([["people1", 3], ["people1", 5]]);
    expect(two.label).toBe("젊은 여성");
    expect(two.shared).toBe(true);
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

// «강의 주인 두꺼비» 와의 전투 이름이 «깊은 곳의 마왕», «밀수꾼 두목» 이 낫 든 망령.
describe("보스의 전투 이름과 그림 — 확인 빌드 r5", () => {
  it("물려받은 보스전의 무리와 앞장선 적을 그 보스의 이름으로 부른다 — 다른 싸움도 쓰는 무리면 그대로", () => {
    const fight = (troopId: string) => page([], [{ kind: "battleProcessing", troopSource: "fixed", troopId, canEscape: false, canLose: false, branchOnResult: true, victoryBranch: [{ kind: "setSwitch", switchId: "sw_c", value: true }], defeatBranch: [], escapeBranch: [] }]);
    const build = (shared: boolean) => {
      const project = createBlankProject() as Project;
      project.database.enemies.push({ ...structuredClone(project.database.enemies[0]!), id: "enemy_x_boss", name: "깊은 곳의 마왕" });
      project.database.troops.push({ ...structuredClone(project.database.troops[0]!), id: "troop_x_boss", name: "깊은 곳의 마왕", enemyIds: ["enemy_x_boss"], members: [{ enemyId: "enemy_x_boss", x: 0, y: 0 }] } as never);
      project.maps[project.startMapId]!.events = [event("ev_cave_boss", "깊은 곳의 마왕", 5, 5, [fight("troop_x_boss")]), ...(shared ? [event("ev_other", "다른 싸움", 9, 9, [fight("troop_x_boss")])] : [])] as never;
      const run = runOf(project);
      expect(buildBossEncounter(run, { mapId: project.startMapId, boss: { name: "강의 주인 두꺼비" }, lines: ["꾸르륵."] } as never).ok).toBe(true);
      return [run.ctx.project.database.troops.find((t) => t.id === "troop_x_boss")!.name, run.ctx.project.database.enemies.find((e) => e.id === "enemy_x_boss")!.name];
    };
    expect(build(false)).toEqual(["강의 주인 두꺼비", "강의 주인 두꺼비"]);
    expect(build(true)).toEqual(["깊은 곳의 마왕", "깊은 곳의 마왕"]);
  });

  it("새로 세운 보스가 이미 다른 이름으로 싸우는 무리를 받으면 제 이름의 사본으로 싸운다 — 앞선 싸움의 이름은 그대로", () => {
    const project = createBlankProject() as Project;
    project.database.enemies.push({ ...structuredClone(project.database.enemies[0]!), id: "enemy_x_boss", name: "깊은 곳의 마왕" });
    project.database.troops.push({ ...structuredClone(project.database.troops[0]!), id: "troop_x_boss", name: "깊은 곳의 마왕", enemyIds: ["enemy_x_boss"], members: [{ enemyId: "enemy_x_boss", x: 0, y: 0 }] } as never);
    project.maps[project.startMapId]!.events = [event("ev_cave_boss", "깊은 곳의 마왕", 15, 12, [page([], [{ kind: "battleProcessing", troopSource: "fixed", troopId: "troop_x_boss", canEscape: false, canLose: false, branchOnResult: true, victoryBranch: [], defeatBranch: [], escapeBranch: [] }])])] as never;
    const run = runOf(project);
    expect(buildBossEncounter(run, { mapId: project.startMapId, boss: { name: "강의 주인 두꺼비", at: { x: 3, y: 3 }, troopId: "troop_x_boss" }, lines: ["꾸르륵."] } as never).ok).toBe(true);
    const db = run.ctx.project.database;
    const placed = run.ctx.project.maps[project.startMapId]!.events.find((e) => e.name === "강의 주인 두꺼비")!;
    const troopId = /"troopId":"([^"]+)"/u.exec(JSON.stringify(placed.pages))![1]!;
    expect(troopId).not.toBe("troop_x_boss");
    const troop = db.troops.find((t) => t.id === troopId)!;
    expect(troop.name).toBe("강의 주인 두꺼비");
    expect(db.enemies.find((e) => e.id === troop.enemyIds![0])!.name).toBe("강의 주인 두꺼비");
    expect(db.troops.find((t) => t.id === "troop_x_boss")!.name).toBe("깊은 곳의 마왕");
  });

  it("사람인 적의 이름은 산적 그림을 가리킨다", () => {
    expect(enemyArtFor(createBlankProject() as Project, "밀수꾼 두목")).toBe("enemy_bandit_mask");
  });
});

// 두 줄로 접힌 제목의 둘째 줄과 부제가 겹쳤다.
describe("타이틀 제목의 줄 — 확인 빌드 r5", () => {
  const titleStyle = (title: string) => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject() as Project;
      project.system.titleScreen = { ...project.system.titleScreen!, title, logoStyle: "gold", logoSubtitle: "꺼진 불빛을 찾아서" } as never;
      const handlers = { onNewGame: () => undefined, onResume: () => undefined, onContinue: () => undefined, onCredits: () => undefined, onQuit: () => undefined };
      const node = findByTestId(renderWithFakeDom(() => renderTitleScreen(project, handlers)), "title-text")!;
      return { lines: node.dataset.titleLines, whiteSpace: node.style.whiteSpace, textWrap: node.style.textWrap };
    } finally { restoreDom(); }
  };

  it("한 줄로 어림한 제목은 줄을 바꾸지 않는다 — 부제는 그 한 줄 높이 아래에 놓인다", () => {
    // textWrap «balance» 는 줄바꿈까지 켜는 단축 속성이라 nowrap 을 풀었다 — 어림 폭에 딱 맞던 제목이 화면에서 접혔다.
    expect(titleStyle("갈매기 포구의 꺼진 등대")).toEqual({ lines: "1", whiteSpace: "nowrap", textWrap: "nowrap" });
    expect(titleStyle("아주 길고 긴 이름을 가진 갈매기 포구의 꺼진 등대 이야기").textWrap).toBe("balance");
  });
});

// 메뉴의 «현재 목표» 가 맨 처음 글이고 같은 때 필드의 목표 줄은 다음 할 일이었다.
describe("현재 목표 — 확인 빌드 r5", () => {
  it("시작 목표와 같은 글은 이정표 뒤에 걸지 않는다 — 다음 할 일은 건다", () => {
    // 모델이 «한씨에게 말을 걸어 사정을 듣자» 를 한씨의 이정표 뒤에 걸어, 한씨의 곁 의뢰를 끝내자 목표가 맨 처음으로 돌아갔다.
    const project = createBlankProject() as Project;
    const first = "방앗간 주인 한씨에게 말을 걸어 사정을 듣자.";
    project.maps[project.startMapId]!.events = [
      event("ev_objective_start", "시작 목표", 1, 1, [page([], [objectiveCommand(`${first} (방앗간: 북쪽)`), { kind: "setSelfSwitch", key: "A", value: true }], "auto")]),
      event("ev_han", "방앗간 주인 한씨", 5, 5, [page([], [{ kind: "text", speaker: "방앗간 주인 한씨", body: "부탁하네." }, { kind: "setSwitch", switchId: "sw_a", value: true }])])] as never;
    const again = planObjective(project, { text: first, eventId: "ev_han" });
    expect(again.ok).toBe(false);
    expect(again.summary).toContain("start objective");
    expect(planObjective(project, { text: "어부 도윤에게 강물이 줄어든 까닭을 묻자.", eventId: "ev_han" }).ok).toBe(true);
  });

  it("필드의 목표 줄과 메뉴의 «현재 목표» 는 같은 글이다 — 한 번 뜬 글이 다시 걸려도", () => {
    const entries = [{ surface: "objectiveChip", message: "한씨에게 말을 걸자", durationMs: 0 }];
    const frame = (model: ReturnType<typeof createZoneFeedbackModel>, nowMs: number) => updateZoneFeedback(model, { entries, nowMs, prompt: null, suppressed: false });
    let shown = frame(createZoneFeedbackModel([]), 0);
    entries.push({ surface: "objectiveChip", message: "열쇠를 찾아 수로 동굴로 가자", durationMs: 0 });
    shown = frame(shown.model, 16);
    expect(shown.view.objective).toBe("열쇠를 찾아 수로 동굴로 가자");
    entries.push({ surface: "objectiveChip", message: "한씨에게 말을 걸자", durationMs: 0 });
    shown = frame(shown.model, 32);
    expect(shown.view.objective).toBe(currentObjectiveText(entries as never));
    expect(shown.view.objective).toBe("한씨에게 말을 걸자");
  });
});

// 레버로 치우는 «막힌 바위» 가 넓은 바닥에 서서 아무 길도 막지 않았다.
describe("레버 관문의 자리 — 확인 빌드 r5", () => {
  it("지은 굴의 레버 관문은 길을 끊는다 — 막이를 그대로 두면 그 너머에 닿지 못한다", () => {
    let gates = 0;
    for (const type of ["cave", "volcano"]) for (const seed of [1, 2, 3]) {
      const ctx: ToolContext = { project: createEmptyToolProject("굴") };
      expect(runTool(ctx, "author_dungeon", { type, size: "small", name: "굴", seed, gimmick: "lever" }, { dryRun: false }).ok).toBe(true);
      for (const map of Object.values(ctx.project.maps)) {
        const block = (map.events ?? []).filter((e) => /_lever_gate/u.test(e.id)).map((e) => ({ x: e.x, y: e.y }));
        if (!block.length) continue;
        gates += 1;
        expect(blockCutsPath(ctx.project, map, block), `${type}#${seed}`).toBe(true);
      }
      // 길 폭만큼의 칸이 한 막이다 — 칸마다 같은 글을 «같은 줄이 두 번» 으로 모델에게 돌려보내지 않는다.
      expect(sceneCraftFindings(createBlankProject(), ctx.project, "굴").filter((f) => f.id === "repeat"), `${type}#${seed}`).toEqual([]);
    }
    expect(gates).toBeGreaterThan(0);
  }, 60_000);

  it("트인 바닥 한 칸은 길을 끊지 않는다", () => {
    const project = createBlankProject() as Project;
    expect(blockCutsPath(project, project.maps[project.startMapId]!, [{ x: 8, y: 8 }])).toBe(false);
  });
});

// 실내 이름 «물레강 주막» 이 조선 주막을 가져오려다 거절됐다.
describe("장소 이름의 낱말과 문화권 — 확인 빌드 r5", () => {
  const inn = { type: "interior", name: "물레강 주막" } as never;
  const built = (): Project => {
    const project = createBlankProject() as Project;
    project.maps[project.startMapId]!.events = [event("ev_well", "우물", 3, 3, [page([], [])])] as never;
    return project;
  };

  it("다른 칩셋으로 이미 지은 게임에서는 이름의 «주막» 이 조선 장소로 바꾸지 않는다 — 요청이 조선을 말하면 따른다", () => {
    expect((localizeCultureSpec(inn, "강가 마을 게임", built()) as { style?: string }).style).toBeUndefined();
    expect((localizeCultureSpec(inn, "조선 시대 사극 게임", built()) as { style?: string }).style).toBe("joseon");
    // 아직 지은 맵이 없으면 종전대로 이름으로 고른다.
    expect((localizeCultureSpec(inn, "강가 마을 게임", createBlankProject() as Project) as { style?: string }).style).toBe("joseon");
  });
});

// 등대지기를 그린 서술 줄이 등대지기의 이름표와 얼굴 밑에 떴다.
describe("사람 단계의 서술 줄 — 확인 빌드 r5", () => {
  it("그 사람을 이름으로 부르며 시작하는 평서형 줄은 서술이다 — 그 사람의 말은 그대로 이름표를 단다", () => {
    const [about, said, named] = sayAs(["등대지기는 어두운 등불 앞에서 고개를 떨구고 있다.", "이제 불을 켤 일만 남았소.", "등대지기는 나 하나뿐이오!"], "등대지기");
    expect(about).toEqual({ kind: "text", body: "등대지기는 어두운 등불 앞에서 고개를 떨구고 있다." });
    expect(said!.speaker).toBe("등대지기");
    expect(named!.speaker).toBe("등대지기");
  });
});

// 없는 그림의 이름을 graphic:{query} 로 주면 가장 가까운 칸이 조용히 섰다 — 「고양이 석상」 이 살아 있는 고양이, 「나무 통」 이 나무 보물상자.
// 목록(list_npc_graphics)에 가까운 칸을 보이려던 길(#3522)을 고르기도 같이 탔다. 2026-09-27 전수 조사의 못 placementMatchingAudit 이 그때부터 빨갰다.
describe("없는 그림의 이름은 고르지 않는다 — 확인 빌드 r5 뒤", () => {
  const MISSING = ["고양이 석상", "나무 통", "강철 문", "낡은 표지판"];

  it("고르기는 모든 낱말이 맞는 칸만 준다", () => {
    for (const name of MISSING) {
      expect(pickNpcGraphic(name), name).toBeNull();
      expect(resolveNpcGraphic(name), name).toBeNull();
    }
    // 다 맞는 칸이 있으면 그대로다 — 성별·나이 낱말은 맞은 것으로 친다.
    expect(pickNpcGraphic("하얀 드레스 여자")?.gender).toBe("female");
    expect(resolveNpcGraphic("나무 보물상자")?.label).toBe("나무 보물상자");
  });

  it("목록·검색은 가장 가까운 칸을 주고, 칸마다 안 맞은 낱말이 남는다", () => {
    const near = queryNpcGraphics("고양이 석상", 5);
    expect(near.length).toBeGreaterThan(0);
    for (const match of near) expect(unmatchedNpcGraphicTerms("고양이 석상", match.entry)).toEqual(["석상"]);
  });

  it("도구는 다른 그림으로 세우지 않고 거절하며, 어느 낱말이 안 맞았는지 말한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const res = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, x: 2, y: 2, id: "ev_cat", name: "고양이 석상", graphic: { query: "고양이 석상" }, pages: [{ text: "돌로 깎은 고양이다." }] });
    expect(res.ok).toBe(false);
    expect(res.issues?.[0]?.code).toBe("graphic-not-found");
    expect(res.summary).toContain('lacks "석상"');
    expect(ctx.project.maps[ctx.project.startMapId]!.events.some((e) => e.id === "ev_cat")).toBe(false);
  });

  it("석상·통은 이름만으로 사람 칩을 받지 않는다 — 역할을 못 알아들은 사람은 전처럼 그냥 주민으로 선다", () => {
    for (const name of ["고양이 석상", "나무 통", "기사 동상"]) expect(isPersonName(name), name).toBe(false);
    const project = createBlankProject() as Project;
    const pick = pickPersonGraphic(project, project.maps[project.startMapId]!, "회관 서기", undefined, true)!;
    expect(pick.query).toBe("villager");
  });
});
