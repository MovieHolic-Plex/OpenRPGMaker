import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { commitChangeset, getTool, runTool } from "@/editor/tools";
import { MYSTERY_ITEM_PREFIX, compileAccusationChoice, mysteryClueItemId } from "@/editor/tools/mysteryCaseTool";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io/serialize";
import type { Command, GameEvent, Project } from "@/project/types";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";

// 빈 프로젝트 시작 맵은 20×15 전부 통행 가능, 시작 위치 (10,8).
function fixture(): Project {
  return createBlankProject();
}

function caseSpec(mapId: string, patch: (spec: Record<string, any>) => void = () => {}): Record<string, unknown> {
  const spec: Record<string, any> = {
    caseId: "manor",
    title: "저택 독살 사건",
    victim: { name: "바론" },
    culprit: "butler",
    suspects: [
      {
        id: "butler", name: "집사 토마스", at: { mapId, x: 3, y: 3 },
        alibi: ["저는 밤새 부엌에서 은식기를 닦고 있었습니다."],
        motive: ["바론께서 제 퇴직금을 없애겠다고 하셨지요."],
        testimony: ["바론께서는 늘 차를 드시고 주무셨습니다."],
        lie: { claim: "찻잔에는 손도 대지 않았습니다.", contradictedBy: "teacup", truth: ["…제가 차를 올린 건 맞습니다."] },
      },
      {
        id: "elena", name: "약초상 엘레나", at: { mapId, x: 7, y: 3 },
        alibi: ["그 시각엔 약방에서 손님을 받고 있었어요."],
        motive: ["바론이 약방 임대료를 두 배로 올렸죠."],
        testimony: ["어젯밤 집사님이 약방에 와서 쥐약을 사 갔어요."],
      },
      {
        id: "leo", name: "사냥꾼 레오", at: { mapId, x: 12, y: 3 },
        alibi: ["난 숲에서 사냥 중이었어."],
        motive: ["바론이 내 사냥터를 빼앗았지."],
        lie: { claim: "밤새 숲에 있었다.", contradictedBy: "tavern_note", truth: ["사실은 주막에서 노름을 했어. 부끄러워서 숨겼지."] },
      },
    ],
    clues: [
      { id: "teacup", name: "독이 남은 찻잔", at: { mapId, x: 3, y: 10 }, description: "바닥에 쓴 냄새가 나는 가루가 남아 있다. 집사가 쓰는 은쟁반 위에 놓여 있다.", implicates: ["butler"], obtainedBy: "examine" },
      { id: "receipt", name: "약방 영수증", at: { mapId, x: 8, y: 12 }, description: "사건 시각에 엘레나가 약방에서 발행한 영수증이다.", excludes: ["elena"], obtainedBy: "examine" },
      { id: "tavern_note", name: "주막 외상 장부", at: { mapId, x: 15, y: 11 }, description: "레오가 밤새 주막에서 노름한 기록이 적혀 있다.", obtainedBy: "examine" },
      { id: "rat_poison", name: "쥐약 구매 증언", description: "엘레나: 어젯밤 집사가 쥐약을 사 갔다.", implicates: ["butler"], obtainedBy: "testimony", givenBy: "elena" },
    ],
    accuser: { name: "경비대장 로버트", at: { mapId, x: 10, y: 5 } },
    endings: {
      solved: { name: "사건 해결", lines: ["자네 말이 맞았네. 집사를 체포하겠네."] },
      wrong: { name: "미궁에 빠진 사건", lines: ["엉뚱한 사람을 잡았군…"] },
    },
  };
  patch(spec);
  return spec;
}

function author(project: Project, spec = caseSpec(project.startMapId)) {
  const ctx = { project };
  const result = runTool(ctx, "author_mystery_case", spec);
  return { ctx, result };
}

function eventsOf(project: Project): GameEvent[] {
  return Object.values(project.maps).flatMap((map) => map.events);
}

function eventNamed(project: Project, name: string): GameEvent {
  const event = eventsOf(project).find((entry) => entry.name === name);
  if (!event) throw new Error(`이벤트 없음: ${name}`);
  return event;
}

const W: SceneStep = { kind: "wait", ticks: 400 };

// 대상 이벤트 바로 아래 칸에 서서 위를 보고 조사한다.
function talk(event: GameEvent): SceneStep[] {
  return [{ kind: "set", x: event.x, y: event.y + 1, facing: "up" }, { kind: "interact", eventId: event.id }, W];
}

function choiceTexts(commands: readonly Command[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly Command[]) => {
    for (const command of list) {
      if (command.kind === "choices") {
        for (const option of command.options) {
          out.push(option.text);
          walk(option.branch);
        }
      } else if (command.kind === "fork") {
        walk(command.then);
        walk(command.else ?? []);
      }
    }
  };
  walk(commands);
  return out;
}

function allCommands(event: GameEvent): Command[] {
  const out: Command[] = [];
  const walk = (list: readonly Command[]) => {
    for (const command of list) {
      out.push(command);
      if (command.kind === "choices") command.options.forEach((option) => walk(option.branch));
      if (command.kind === "fork") {
        walk(command.then);
        walk(command.else ?? []);
      }
    }
  };
  walk(event.commands);
  for (const page of event.pages ?? []) walk(page.commands);
  return out;
}

describe("check_mystery_case — 사건 일관성 검사", () => {
  it("단서로 범인만 남는 사건은 통과한다", () => {
    const project = fixture();
    const result = runTool({ project }, "check_mystery_case", caseSpec(project.startMapId));
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ ok: true, problems: [] });
    expect((result.data as { requiredClues: string[] }).requiredClues.sort()).toEqual(["rat_poison", "receipt", "tavern_note", "teacup"]);
  });

  it("배제할 근거가 없는 용의자를 이름으로 짚어 거부한다", () => {
    const project = fixture();
    const spec = caseSpec(project.startMapId, (s) => {
      s.clues = s.clues.filter((clue: { id: string }) => clue.id !== "receipt");
    });
    const check = runTool({ project }, "check_mystery_case", spec);
    expect(check.data).toMatchObject({ ok: false });
    const problems = (check.data as { problems: { code: string; message: string }[] }).problems;
    expect(problems.some((p) => p.code === "mystery-unexcluded-suspect" && p.message.includes("약초상 엘레나"))).toBe(true);
    const write = runTool({ project }, "author_mystery_case", spec);
    expect(write.ok).toBe(false);
    expect(write.summary + JSON.stringify(write.issues)).toContain("약초상 엘레나");
  });

  it("범인을 가리키는 단서가 하나도 없으면 거부한다", () => {
    const project = fixture();
    const spec = caseSpec(project.startMapId, (s) => {
      s.clues = s.clues.map((clue: Record<string, unknown>) => ({ ...clue, implicates: [] }));
      s.suspects[0].lie = undefined;
    });
    const problems = (runTool({ project }, "check_mystery_case", spec).data as { problems: { code: string }[] }).problems;
    expect(problems.map((p) => p.code)).toContain("mystery-culprit-unimplicated");
  });

  it("범인을 배제하는 단서는 모순으로 거부한다", () => {
    const project = fixture();
    const spec = caseSpec(project.startMapId, (s) => {
      s.clues[1].excludes = ["elena", "butler"];
    });
    const problems = (runTool({ project }, "check_mystery_case", spec).data as { problems: { code: string }[] }).problems;
    expect(problems.map((p) => p.code)).toContain("mystery-culprit-excluded");
  });

  it.each([
    ["용의자 이름", (s: Record<string, any>) => { s.suspects[0].name = "집사 토마스 (진범)"; }],
    ["지목 NPC 대사", (s: Record<string, any>) => { s.accuser.hint = ["범인은 집사야. 증거만 가져오게."]; }],
    ["지목 선택 문구", (s: Record<string, any>) => { s.accuser.prompt = "누가 진범인가? (정답은 하나)"; }],
    ["범인 이름 + 단정", (s: Record<string, any>) => { s.accuser.intro = ["토마스가 죽였을 거라고 다들 수군대더군."]; }],
    ["단서 이름", (s: Record<string, any>) => { s.clues[0].name = "범인의 찻잔"; }],
  ])("답을 누설하는 %s을 거부한다", (_label, patch) => {
    const project = fixture();
    const spec = caseSpec(project.startMapId, patch);
    const problems = (runTool({ project }, "check_mystery_case", spec).data as { problems: { code: string }[] }).problems;
    expect(problems.map((p) => p.code)).toContain("mystery-leak");
    expect(runTool({ project }, "author_mystery_case", spec).ok).toBe(false);
  });

  it("맵 밖·없는 맵의 단서를 거부한다", () => {
    const project = fixture();
    const map = project.maps[project.startMapId];
    const outside = caseSpec(map.id, (s) => { s.clues[0].at = { mapId: map.id, x: 40, y: 40 }; });
    const missingMap = caseSpec(map.id, (s) => { s.clues[1].at = { mapId: "no_such_map", x: 1, y: 1 }; });
    const codes = (spec: Record<string, unknown>) =>
      (runTool({ project }, "check_mystery_case", spec).data as { problems: { code: string; message: string }[] }).problems;
    expect(codes(outside).some((p) => p.code === "mystery-unreachable" && p.message.includes("독이 남은 찻잔"))).toBe(true);
    expect(codes(missingMap).some((p) => p.code === "mystery-unreachable" && p.message.includes("no_such_map"))).toBe(true);
    expect(runTool({ project }, "author_mystery_case", outside).ok).toBe(false);
  });

  it("사방이 막힌 단서, 시작 위치에서 걸어서 못 닿는 용의자를 거부한다", () => {
    const project = fixture();
    const map = project.maps[project.startMapId];
    const wall = (x: number, y: number) => { map.lowerTiles[y * map.width + x] = TILE.WALL; };
    // 찻잔 (3,10) 을 벽으로 둘러싼다.
    for (const [x, y] of [[3, 9], [3, 11], [2, 10], [4, 10], [3, 10]]) wall(x, y);
    // 사냥꾼 (12,3) 을 벽 고리로 가둔다 — 서 있는 칸은 통행 가능하지만 시작 위치에서 닿지 않는다.
    for (let x = 10; x <= 14; x += 1) { wall(x, 1); wall(x, 5); }
    for (let y = 1; y <= 5; y += 1) { wall(10, y); wall(14, y); }
    const problems = (runTool({ project }, "check_mystery_case", caseSpec(map.id)).data as { problems: { code: string; message: string }[] }).problems;
    expect(problems.some((p) => p.code === "mystery-unreachable" && p.message.includes("독이 남은 찻잔") && p.message.includes("조사할 수 없"))).toBe(true);
    expect(problems.some((p) => p.code === "mystery-unreachable" && p.message.includes("사냥꾼 레오") && p.message.includes("닿을 수 없"))).toBe(true);
  });

  it("다른 이벤트가 이미 서 있는 칸의 단서를 거부한다", () => {
    const project = fixture();
    const map = project.maps[project.startMapId];
    map.events.push({ id: "ev_box", x: 3, y: 10, trigger: { kind: "action" }, commands: [] });
    const problems = (runTool({ project }, "check_mystery_case", caseSpec(map.id)).data as { problems: { code: string }[] }).problems;
    expect(problems.map((p) => p.code)).toContain("mystery-unreachable");
  });

  it("사건 밖 이벤트가 같은 엔딩(또는 id 없는 엔딩)을 부르면 증거 우회로 거부한다", () => {
    const project = fixture();
    const map = project.maps[project.startMapId];
    map.events.push({ id: "ev_old_guard", name: "옛 경비병", x: 18, y: 13, trigger: { kind: "action" },
      commands: [{ kind: "triggerEnding", endingId: "ending_mystery_manor_solved" }] });
    map.events.push({ id: "ev_old_gate", name: "옛 문", x: 1, y: 13, trigger: { kind: "action" },
      commands: [{ kind: "triggerEnding" }] });
    const problems = (runTool({ project }, "check_mystery_case", caseSpec(map.id)).data as { problems: { code: string; message: string }[] }).problems;
    expect(problems.filter((p) => p.code === "mystery-order").map((p) => p.message).join("\n")).toMatch(/옛 경비병[\s\S]*옛 문|옛 문[\s\S]*옛 경비병/);
  });

  it("증언 단서는 존재하는 용의자에게서 얻어야 한다", () => {
    const project = fixture();
    const spec = caseSpec(project.startMapId, (s) => { s.clues[3].givenBy = "ghost"; });
    const problems = (runTool({ project }, "check_mystery_case", spec).data as { problems: { code: string }[] }).problems;
    expect(problems.map((p) => p.code)).toContain("mystery-reference");
  });
});

describe("author_mystery_case — 컴파일 산출물", () => {
  it("증거는 아이템 한 가지로만 표기하고 스위치를 만들지 않는다", () => {
    const project = fixture();
    const switchesBefore = project.switches.length;
    const { ctx, result } = author(project);
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    const items = ctx.project.database.items.filter((item) => item.id.startsWith(MYSTERY_ITEM_PREFIX));
    expect(items.map((item) => item.name).sort()).toEqual(["독이 남은 찻잔", "약방 영수증", "주막 외상 장부", "쥐약 구매 증언"].sort());
    for (const item of items) {
      expect(item.description).toMatch(/^\[증거\]/);
      expect(item.consumable).toBe(false);
    }
    expect(ctx.project.switches.length).toBe(switchesBefore);
    const mysteryEvents = eventsOf(ctx.project).filter((event) => event.id.startsWith("ev_mystery_manor_"));
    expect(mysteryEvents.flatMap(allCommands).some((command) => command.kind === "setSwitch")).toBe(false);
  });

  it("조사 지점은 페이지 안 명령으로 한 번만 증거를 준다", () => {
    const project = fixture();
    const { ctx } = author(project);
    const teacup = eventsOf(ctx.project).find((event) => event.id === "ev_mystery_manor_clue_teacup")!;
    expect(teacup).toBeDefined();
    expect(teacup.commands).toEqual([]);
    expect(teacup.x).toBe(3);
    expect(teacup.y).toBe(10);
    const grants = (teacup.pages ?? []).flatMap((page) => page.commands).filter((c) => c.kind === "changeItem");
    expect(grants).toEqual([{ kind: "changeItem", itemId: mysteryClueItemId("manor", "teacup"), op: "+=", amount: 1 }]);
  });

  it("지목 NPC 는 증거 미확보 페이지에 엔딩이 없고, 선택지 라벨은 이름뿐이다", () => {
    const project = fixture();
    const { ctx } = author(project);
    const accuser = eventNamed(ctx.project, "경비대장 로버트");
    const [locked, open] = accuser.pages ?? [];
    expect(locked.conditions).toEqual([]);
    expect(allCommands({ ...accuser, pages: [locked] }).some((c) => c.kind === "triggerEnding")).toBe(false);
    expect(open.conditions).toHaveLength(4);
    expect(open.conditions.every((c) => c.kind === "item" && c.present)).toBe(true);
    const labels = choiceTexts(open.commands);
    expect(labels).toEqual(["집사 토마스", "약초상 엘레나", "사냥꾼 레오", "아직 모르겠다"]);
    const endings = allCommands({ ...accuser, pages: [open] }).filter((c) => c.kind === "triggerEnding");
    expect(endings.map((c) => (c as { endingId?: string }).endingId)).toEqual([
      "ending_mystery_manor_solved", "ending_mystery_manor_wrong", "ending_mystery_manor_wrong",
    ]);
    expect((ctx.project.endings ?? []).map((ending) => ending.id).sort()).toEqual(["ending_mystery_manor_solved", "ending_mystery_manor_wrong"]);
  });

  it("지목 선택지 컴파일 지점은 한 함수다 — 정답 인덱스가 라벨에 드러나지 않는다", () => {
    const command = compileAccusationChoice({
      prompt: "누구인가?",
      suspects: [{ id: "a", name: "갑" }, { id: "b", name: "을" }],
      culpritId: "b",
      solvedEndingId: "s",
      wrongEndingId: "w",
      solvedLines: [],
      wrongLines: [],
      notYetLines: ["다시 오게."],
      speaker: "대장",
    });
    expect(command.kind).toBe("choices");
    expect(command.options.map((option) => option.text)).toEqual(["갑", "을", "아직 모르겠다"]);
    expect(command.cancelBehavior).toBe("branch");
  });

  it("용의자 탐문 선택지(알리바이/동기/증언/증거 대면)를 만든다", () => {
    const project = fixture();
    const { ctx } = author(project);
    const butler = eventNamed(ctx.project, "집사 토마스");
    const labels = choiceTexts(butler.pages![0].commands);
    expect(labels.slice(0, 5)).toEqual(["알리바이를 묻는다", "동기를 묻는다", "증언을 듣는다", "증거를 들이민다", "그만둔다"]);
  });

  it("기존 마을 주민을 용의자로 쓰면 사건 당일 시간표를 비우고 id·외형을 유지한다", () => {
    const project = fixture();
    const map = project.maps[project.startMapId];
    const graphic = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 76 } as const;
    map.events.push({
      id: "ev_village_roofer", name: "레오", placementRole: "npc", x: 16, y: 6, trigger: { kind: "action" }, commands: [],
      schedule: [
        { when: { timePhase: "day" }, at: { mapId: map.id, x: 17, y: 2 }, activity: "지붕 수리" },
        { when: { timePhase: "evening" }, at: { mapId: map.id, x: 16, y: 6 }, activity: "장터 소식 나누기" },
      ],
      pages: [{
        id: "p0", name: "레오", conditions: [], graphic: graphic as never, trigger: { kind: "action" }, priority: "same",
        overlapForbidden: true, animationType: "fixedGraphic", movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", speaker: "레오", body: "지붕 고치느라 바빠." }],
      }],
    });
    const spec = caseSpec(map.id, (s) => {
      s.suspects[2].eventId = "ev_village_roofer";
      s.suspects[2].activity = "주막 앞에서 서성임";
    });
    const { ctx, result } = author(project, spec);
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    const leo = ctx.project.maps[map.id].events.find((event) => event.id === "ev_village_roofer")!;
    expect({ x: leo.x, y: leo.y }).toEqual({ x: 12, y: 3 });
    expect(leo.schedule).toEqual([{ when: {}, at: { mapId: map.id, x: 12, y: 3 }, activity: "주막 앞에서 서성임" }]);
    expect(leo.pages![0].graphic).toEqual(graphic);
    expect(JSON.stringify(leo.pages)).not.toContain("지붕 고치느라");
    expect(result.warnings?.join("\n") ?? JSON.stringify(result.diff?.warnings)).toContain("지붕 수리");
  });

  it("같은 사건을 다시 쓰면 이벤트를 중복하지 않고 갈아 끼운다", () => {
    const project = fixture();
    const first = author(project);
    expect(first.result.ok).toBe(true);
    const count = eventsOf(first.ctx.project).length;
    const second = runTool(first.ctx, "author_mystery_case", caseSpec(project.startMapId));
    expect(second.ok, `${second.summary} ${JSON.stringify(second.issues)}`).toBe(true);
    expect(eventsOf(first.ctx.project).length).toBe(count);
  });

  it("직렬화 왕복과 커밋 게이트(왕복 포함)를 통과한다", () => {
    const project = fixture();
    const { ctx } = author(project);
    const commit = commitChangeset(ctx.project, project);
    expect(commit.ok, JSON.stringify(commit.blocking)).toBe(true);
    const reloaded = deserialize(serialize(ctx.project));
    expect(eventNamed(reloaded, "경비대장 로버트").pages).toEqual(eventNamed(ctx.project, "경비대장 로버트").pages);
    expect(reloaded.database.items.filter((item) => item.id.startsWith(MYSTERY_ITEM_PREFIX))).toHaveLength(4);
    expect(reloaded.endings).toEqual(ctx.project.endings);
  });

  it("도구 설명이 추리 게임 요청을 이 도구로 라우팅한다", () => {
    expect(getTool("author_mystery_case")?.description).toMatch(/추리.*살인사건.*탐정/);
    expect(getTool("check_mystery_case")?.mode).toBe("read");
  });
});

describe("author_mystery_case — run_scene_test 로 끝까지 플레이", () => {
  function authored() {
    const project = fixture();
    const { ctx, result } = author(project);
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    return ctx.project;
  }

  function play(project: Project, steps: SceneStep[]) {
    const input = { mapId: project.startMapId, start: { x: 10, y: 8 }, steps };
    const direct = runSceneTest(project, input);
    const viaTool = runTool({ project }, "run_scene_test", input as never);
    expect(viaTool.ok).toBe(true);
    return direct;
  }

  function collectAll(project: Project): SceneStep[] {
    const clue = (id: string) => eventsOf(project).find((event) => event.id === `ev_mystery_manor_clue_${id}`)!;
    const elena = eventNamed(project, "약초상 엘레나");
    return [
      ...talk(clue("teacup")),
      ...talk(clue("receipt")),
      ...talk(clue("tavern_note")),
      ...talk(elena), { kind: "choose", index: 2 }, W,
    ];
  }

  it("증거 없이 지목 NPC 에게 가면 힌트만 듣고 엔딩에 닿지 않는다", () => {
    const project = authored();
    const accuser = eventNamed(project, "경비대장 로버트");
    const result = play(project, [...talk(accuser), { kind: "wait", ticks: 1200 }]);
    expect(result.failureReason ?? null).toBeNull();
    expect(result.finalState.endingsReached).toEqual([]);
    expect(result.finalState.messages.length).toBeGreaterThan(0);
  });

  it("증거를 실제로 모은 뒤 진범을 지목하면 solved 엔딩", () => {
    const project = authored();
    const accuser = eventNamed(project, "경비대장 로버트");
    const result = play(project, [
      ...collectAll(project),
      { kind: "expect", inventoryCount: Object.fromEntries(["teacup", "receipt", "tavern_note", "rat_poison"].map((id) => [mysteryClueItemId("manor", id), 1])) },
      ...talk(accuser), { kind: "choose", index: 0 }, { kind: "wait", ticks: 1500 },
      { kind: "expect", endingReached: "ending_mystery_manor_solved" },
    ]);
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("증거를 모은 뒤 엉뚱한 사람을 지목하면 wrong 엔딩", () => {
    const project = authored();
    const accuser = eventNamed(project, "경비대장 로버트");
    const result = play(project, [
      ...collectAll(project),
      ...talk(accuser), { kind: "choose", index: 1 }, { kind: "wait", ticks: 1500 },
      { kind: "expect", endingReached: "ending_mystery_manor_wrong" },
    ]);
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.finalState.endingsReached).not.toContain("ending_mystery_manor_solved");
  });

  it("증거 하나가 빠지면 여전히 지목할 수 없다", () => {
    const project = authored();
    const accuser = eventNamed(project, "경비대장 로버트");
    const steps = collectAll(project).slice(3); // 찻잔 조사를 건너뛴다
    const result = play(project, [...steps, ...talk(accuser), { kind: "wait", ticks: 1500 }]);
    expect(result.failureReason ?? null).toBeNull();
    expect(result.finalState.inventory[mysteryClueItemId("manor", "receipt")]).toBe(1);
    expect(result.finalState.endingsReached).toEqual([]);
  });

  it("조사 지점은 두 번 조사해도 증거를 한 번만 준다", () => {
    const project = authored();
    const teacup = eventsOf(project).find((event) => event.id === "ev_mystery_manor_clue_teacup")!;
    const result = play(project, [...talk(teacup), ...talk(teacup),
      { kind: "expect", inventoryCount: { itemId: mysteryClueItemId("manor", "teacup"), count: 1 } }]);
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("거짓말 반박 증거를 들이밀면 진술을 번복한다", () => {
    const project = authored();
    const leo = eventNamed(project, "사냥꾼 레오");
    const note = eventsOf(project).find((event) => event.id === "ev_mystery_manor_clue_tavern_note")!;
    const result = play(project, [...talk(note), ...talk(leo), { kind: "choose", index: 2 }, W,
      { kind: "present", itemId: mysteryClueItemId("manor", "tavern_note") }, { kind: "wait", ticks: 1200 }]);
    expect(result.failureReason ?? null).toBeNull();
    expect(JSON.stringify(result.finalState.messages)).toContain("노름");
  });

  // 증거 대면은 presentItem 목록이다 — 무엇을 낼지 플레이어가 고른다. 상관없는 증거엔 반응하지 않는다.
  it("상관없는 증거를 내밀면 진술을 번복하지 않고, 닫으면 아무 일도 없다", () => {
    const project = authored();
    const leo = eventNamed(project, "사냥꾼 레오");
    const present = allCommands(leo).find((command): command is Extract<Command, { kind: "presentItem" }> => command.kind === "presentItem");
    assert(present);
    const reacted = new Set(present.options.map((option) => option.itemId));
    const unrelated = (present.itemIds ?? []).find((itemId) => !reacted.has(itemId));
    assert(unrelated, "레오와 상관없는 사건 증거가 있어야 한다");
    const clueId = unrelated.replace(mysteryClueItemId("manor", ""), "");
    const clue = eventsOf(project).find((event) => event.id === `ev_mystery_manor_clue_${clueId}`);
    assert(clue, `조사로 얻는 증거여야 한다: ${clueId}`);
    const wrong = play(project, [...talk(clue), ...talk(leo), { kind: "choose", index: 2 }, W,
      { kind: "present", itemId: unrelated }, { kind: "wait", ticks: 1200 }]);
    expect(wrong.failureReason ?? null).toBeNull();
    expect(JSON.stringify(wrong.finalState.messages)).toContain("무슨 상관");
    expect(JSON.stringify(wrong.finalState.messages)).not.toContain("노름");
    const closed = play(project, [...talk(clue), ...talk(leo), { kind: "choose", index: 2 }, W,
      { kind: "present" }, { kind: "wait", ticks: 1200 }]);
    expect(closed.failureReason ?? null).toBeNull();
    expect(closed.finalState.inventory[unrelated]).toBe(1);
  });
});
