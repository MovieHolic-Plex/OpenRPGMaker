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

// 시작 맵 구석에 주막으로 가는 문을 단다 — 사건 맵은 시작 맵에서 갈 수 있어야 한다.
function linkInn(project: Project): void {
  project.maps[project.startMapId].events.push({
    id: "ev_inn_door", name: "주막 문", x: 19, y: 14, trigger: { kind: "playerTouch" },
    commands: [{ kind: "transfer", mapId: "map_inn", x: 1, y: 1 }],
  } as never);
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

  // 실측(manor-mystery gen): 지목 테이블이 서재 문간 한 칸에 서서 그 너머 방의 증거·용의자에게 못 갔는데 검사를 통과했다.
  it("한 칸 통로에 선 인물이 그 너머 배치를 막으면 막는 인물을 짚고 통로 밖 후보를 준다", () => {
    const project = fixture();
    const map = project.maps[project.startMapId];
    const wall = (x: number, y: number) => { map.lowerTiles[y * map.width + x] = TILE.WALL; };
    // y=6 가로 벽, 통로는 (10,6) 한 칸. 용의자 셋(y=3)은 벽 너머, 시작 (10,8) 은 아래.
    for (let x = 0; x < map.width; x += 1) if (x !== 10) wall(x, 6);
    const spec = caseSpec(map.id, (s) => { s.accuser.at = { mapId: map.id, x: 10, y: 6 }; });
    const problems = (runTool({ project }, "check_mystery_case", spec).data as { problems: { code: string; message: string }[] }).problems;
    const problem = problems.find((p) => p.code === "mystery-unreachable" && p.message.includes("경비대장 로버트") && p.message.includes("통로를 막아"));
    assert(problem, JSON.stringify(problems));
    const hint = /가까운 후보: \((\d+), (\d+)\)/.exec(problem.message);
    assert(hint, problem.message);
    expect(`${hint[1]},${hint[2]}`).not.toBe("10,6");
    expect(runTool({ project }, "author_mystery_case", spec).ok).toBe(false);
    // 후보 칸으로 옮기면 통과한다.
    const moved = caseSpec(map.id, (s) => { s.accuser.at = { mapId: map.id, x: Number(hint[1]), y: Number(hint[2]) }; });
    const recheck = runTool({ project }, "check_mystery_case", moved);
    expect(recheck.data, JSON.stringify(recheck.data)).toMatchObject({ ok: true });
  });

  it("시작 맵이 아닌 사건 맵도 문으로 들어선 칸에서 걸어서 닿는지 본다", () => {
    const project = fixture();
    const ctx = { project };
    expect(runTool(ctx, "create_map", { id: "map_inn", name: "주막", width: 20, height: 15 }).ok).toBe(true);
    linkInn(ctx.project);
    const inn = ctx.project.maps.map_inn;
    // 주막 (15,11) 장부를 벽 고리로 가둔다 — 문 도착 칸 (1,1) 에서 닿지 않는다.
    for (let x = 13; x <= 17; x += 1) { inn.lowerTiles[9 * inn.width + x] = TILE.WALL; inn.lowerTiles[13 * inn.width + x] = TILE.WALL; }
    for (let y = 9; y <= 13; y += 1) { inn.lowerTiles[y * inn.width + 13] = TILE.WALL; inn.lowerTiles[y * inn.width + 17] = TILE.WALL; }
    const spec = caseSpec(ctx.project.startMapId, (s) => { s.clues[2].at = { mapId: "map_inn", x: 15, y: 11 }; });
    const problems = (runTool(ctx, "check_mystery_case", spec).data as { problems: { code: string; message: string }[] }).problems;
    expect(problems.some((p) => p.code === "mystery-unreachable" && p.message.includes("주막 외상 장부") && p.message.includes("입구"))).toBe(true);
  });

  // 실측(run5): 지목 NPC 가 project.startPos 에 놓여 플레이어가 NPC 와 겹쳐 스폰됐는데 검사를 통과했다.
  it("플레이어 시작 칸에 둔 인물·조사 지점을 거부하고 시작 칸이 아닌 후보를 제안한다", () => {
    const project = fixture();
    const { x, y } = project.startPos;
    const spec = caseSpec(project.startMapId, (s) => {
      s.accuser.at = { mapId: project.startMapId, x, y };
      s.clues[1].at = { mapId: project.startMapId, x, y };
    });
    const check = runTool({ project }, "check_mystery_case", spec);
    expect(check.data).toMatchObject({ ok: false });
    const problems = (check.data as { problems: { code: string; message: string }[] }).problems;
    for (const label of ["경비대장 로버트", "약방 영수증"]) {
      const problem = problems.find((p) => p.code === "mystery-unreachable" && p.message.includes(label) && p.message.includes("시작 위치"));
      assert(problem, `${label} 의 시작 칸 거부가 없다: ${JSON.stringify(problems)}`);
      expect(problem.message).toContain(`(${x}, ${y})`);
      const hint = /가까운 후보: \((\d+), (\d+)\)/.exec(problem.message);
      assert(hint, problem.message);
      expect(`${hint[1]},${hint[2]}`).not.toBe(`${x},${y}`);
    }
    const write = runTool({ project }, "author_mystery_case", spec);
    expect(write.ok).toBe(false);
  });

  it("시작 맵이 아닌 맵의 같은 좌표는 시작 칸이 아니다", () => {
    const project = fixture();
    const ctx = { project };
    expect(runTool(ctx, "create_map", { id: "map_inn", name: "주막", width: 20, height: 15 }).ok).toBe(true);
    linkInn(ctx.project);
    const { x, y } = ctx.project.startPos;
    const spec = caseSpec(ctx.project.startMapId, (s) => { s.clues[2].at = { mapId: "map_inn", x, y }; });
    const check = runTool(ctx, "check_mystery_case", spec);
    expect(check.data, JSON.stringify(check.data)).toMatchObject({ ok: true });
  });

  // 실측(run6): 벽 위 단서의 유일한 통행 가능 옆 칸에 집 문 이벤트가 있었는데 검사를 통과했다 — 조사하려면 문을 밟아야 한다.
  it("조사할 옆 칸이 모두 다른 이벤트로 막힌 단서를 거부하고 후보를 제안한다", () => {
    const project = fixture();
    const map = project.maps[project.startMapId];
    const wall = (x: number, y: number) => { map.lowerTiles[y * map.width + x] = TILE.WALL; };
    // 찻잔 (3,10) 은 벽 위, 열린 옆 칸은 (3,11) 하나뿐이고 거기에 문 이벤트가 있다.
    for (const [x, y] of [[3, 10], [3, 9], [2, 10], [4, 10]]) wall(x, y);
    map.events.push({ id: "ev_door", name: "집 문", x: 3, y: 11, trigger: { kind: "playerTouch" }, commands: [] } as never);
    const problems = (runTool({ project }, "check_mystery_case", caseSpec(map.id)).data as { problems: { code: string; message: string }[] }).problems;
    const problem = problems.find((p) => p.code === "mystery-unreachable" && p.message.includes("독이 남은 찻잔"));
    assert(problem, JSON.stringify(problems));
    expect(problem.message).toContain("다른 이벤트로 막혀");
    expect(problem.message).toMatch(/가까운 후보: \(\d+, \d+\)/);
  });

  // 실측(run7): 시작 위치가 빈 기본 맵에 남아 사건 맵(마을)으로 갈 길이 없었는데, set 순간이동 시나리오는 통과했다.
  it("시작 맵에서 문·연결로 갈 수 없는 맵의 사건 배치를 맵 단위로 한 번 거부한다", () => {
    const project = fixture();
    const ctx = { project };
    expect(runTool(ctx, "create_map", { id: "town", name: "마을", width: 20, height: 15 }).ok).toBe(true);
    const check = runTool(ctx, "check_mystery_case", caseSpec("town"));
    expect(check.data).toMatchObject({ ok: false });
    const problems = (check.data as { problems: { code: string; message: string }[] }).problems.filter((p) => p.message.includes("갈 수 없습니다"));
    expect(problems).toHaveLength(1);
    // 인물 라벨 없이 맵 단위로, 좌표 이동으로는 안 풀린다고, 바로 쓸 시작 좌표까지 준다(run8: 인물 좌표만 옮기며 3회 헛돎).
    expect(problems[0].message).not.toMatch(/^용의자|^지목 NPC|^조사 단서/);
    expect(problems[0].message).toContain("좌표를 옮겨도");
    const suggested = /set_start_position\(\{mapId:"town", x:(\d+), y:(\d+)\}\)/.exec(problems[0].message);
    assert(suggested, problems[0].message);
    expect(runTool(ctx, "set_start_position", { mapId: "town", x: Number(suggested[1]), y: Number(suggested[2]) }).ok).toBe(true);
    expect(runTool(ctx, "check_mystery_case", caseSpec("town")).data).toMatchObject({ ok: true });
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

  // manor-mystery 실측 두 번: 「저택 1층」 을 빈 시작 맵 위 바닥 사각형으로 흉내 내고 인물을 세웠다(통행 불가 0.6%).
  it("벽·가구 없는 맨땅 무대에 사건을 쓰면 실내를 지을 도구를 짚는 경고를 남긴다", () => {
    const { result } = author(fixture());
    expect(result.ok).toBe(true);
    const warnings = (result.diff?.warnings ?? []) as string[];
    expect(warnings.some((warning) => warning.includes("사건 무대") && warning.includes("place_concept"))).toBe(true);
    // 5회차: 경고만으로는 모델이 요약의 「다음 = run_scene_test」 만 따랐다 — 요약이 무대부터 짚는다.
    expect(result.summary.indexOf("place_concept")).toBeGreaterThan(-1);
    expect(result.summary.indexOf("place_concept")).toBeLessThan(result.summary.indexOf("run_scene_test"));
    // 방이 있는 맵이면 경고가 없다.
    const walled = fixture();
    const map = walled.maps[walled.startMapId];
    for (let x = 0; x < map.width; x += 1) { map.lowerTiles[x] = TILE.WALL; map.lowerTiles[(map.height - 1) * map.width + x] = TILE.WALL; }
    for (let y = 0; y < map.height; y += 1) { map.lowerTiles[y * map.width] = TILE.WALL; map.lowerTiles[y * map.width + map.width - 1] = TILE.WALL; }
    const inside = author(walled, caseSpec(walled.startMapId, (s) => { s.suspects[1].at.x = 8; }));
    expect(inside.result.ok, JSON.stringify(inside.result)).toBe(true);
    expect(((inside.result.diff?.warnings ?? []) as string[]).some((warning) => warning.includes("사건 무대"))).toBe(false);
    expect(inside.result.summary).not.toContain("맨땅");
  });

  // manor-mystery 실측 두 번: 지목 NPC 를 「추리 정리 테이블」「사건 정리 수첩」 으로 지었는데 주민 외형·얼굴로 그려졌다.
  it("물건 이름의 지목 NPC 는 보이지 않는 지점으로 두고 얼굴·이름표 없이 서술한다", () => {
    const project = fixture();
    const spec = caseSpec(project.startMapId, (s) => { s.accuser.name = "사건 정리 수첩"; });
    const { ctx, result } = author(project, spec);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const accuser = eventNamed(ctx.project, "사건 정리 수첩");
    for (const page of accuser.pages ?? []) {
      expect(page.graphic).toEqual({ transparent: true });
      expect(page.commands.some((command) => command.kind === "changeFace")).toBe(false);
    }
    const texts = allCommands(accuser).filter((command): command is Extract<Command, { kind: "text" }> => command.kind === "text");
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((command) => !command.speaker)).toBe(true);
    const warnings = (result.diff?.warnings ?? []) as string[];
    expect(warnings.some((warning) => warning.includes("물건이라"))).toBe(true);
    // 사람 이름이면 그대로 인물이다. 물건 지목 지점의 「graphic 생략 → 기본 주민」 경고는 사실이 아니므로 뺀다.
    const personRun = author(fixture());
    expect(eventNamed(personRun.ctx.project, "경비대장 로버트").pages?.[0]?.graphic).not.toEqual({ transparent: true });
    const omitted = (list: readonly string[]) => list.filter((warning) => warning.includes("graphic 생략")).length;
    expect(omitted(warnings)).toBe(omitted((personRun.result.diff?.warnings ?? []) as string[]) - 1);
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

// author_mystery_case 는 이 사건을 끝까지 도는 run_scene_test 입력을 data 에 동봉한다.
// 실측(run5): 에이전트가 검증 시나리오를 손으로 짜다 7번 헛돌았다(좌표 형식·증언 선택지·지목 페이지).
describe("author_mystery_case — 동봉 검증 시나리오", () => {
  type Scene = { mapId: string; start: { x: number; y: number }; steps: SceneStep[] };
  function bundled(result: ReturnType<typeof runTool>): Scene {
    const data = result.data as { verificationScene?: Scene } | undefined;
    assert(data?.verificationScene, `verificationScene 이 없다: ${JSON.stringify(result.data)}`);
    return data.verificationScene;
  }

  function runBundled(project: Project, scene: Scene) {
    const viaTool = runTool({ project }, "run_scene_test", structuredClone(scene) as never);
    expect(viaTool.ok, viaTool.summary).toBe(true);
    const data = viaTool.data as { ok: boolean; failureReason?: string; failedStepIndex?: number; finalState: { endingsReached: string[]; messages: string[] } };
    expect(data.ok, `${viaTool.summary} @${data.failedStepIndex} ${JSON.stringify(scene.steps[data.failedStepIndex ?? 0])}`).toBe(true);
    return data;
  }

  it("그대로 run_scene_test 에 넣으면 증거 수집 → 증거 대면 → 정답 지목 → solved 엔딩까지 통과한다", () => {
    const project = fixture();
    const { ctx, result } = author(project);
    expect(result.ok, result.summary).toBe(true);
    const scene = bundled(result);
    expect(scene.mapId).toBe(ctx.project.startMapId);
    expect(scene.start).toEqual(ctx.project.startPos);
    // 증언은 탐문 선택지로, 대면은 presentItem 으로, 지목은 2페이지 선택지로 한다.
    expect(scene.steps.some((step) => step.kind === "present" && step.itemId !== undefined)).toBe(true);
    expect(scene.steps.filter((step) => step.kind === "choose").length).toBeGreaterThanOrEqual(3);
    expect(scene.steps.at(-1)).toEqual({ kind: "expect", endingReached: "ending_mystery_manor_solved" });
    // 방향은 set.facing 이 아니라 face 스텝으로 — 모델이 옮겨 적으며 set.facing 만 빠뜨렸다(run6).
    expect(scene.steps.some((step) => step.kind === "set" && "facing" in step)).toBe(false);
    scene.steps.forEach((step, index) => {
      if (step.kind === "interact") expect(scene.steps[index - 1]?.kind, `steps[${index - 1}]`).toBe("face");
    });
    const data = runBundled(ctx.project, scene);
    expect(data.finalState.endingsReached).toContain("ending_mystery_manor_solved");
    // 대면 예시는 레오의 거짓말(주막 장부)을 무너뜨린다.
    expect(JSON.stringify(data.finalState.messages)).toContain("노름");
    expect(result.summary).toContain("verificationScene");
  });

  it("시간 시스템이 켜지고 용의자에게 시간표가 있어도(재사용 주민 포함) 통과한다", () => {
    const project = fixture();
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    const map = project.maps[project.startMapId];
    map.events.push({
      id: "ev_village_roofer", name: "레오", placementRole: "npc", x: 16, y: 6, trigger: { kind: "action" }, commands: [],
      schedule: [
        { when: { timePhase: "day" }, at: { mapId: map.id, x: 17, y: 2 }, activity: "지붕 수리" },
        { when: { timePhase: "evening" }, at: { mapId: map.id, x: 16, y: 6 }, activity: "장터 소식 나누기" },
      ],
      pages: [{
        id: "p0", name: "레오", conditions: [], trigger: { kind: "action" }, priority: "same",
        overlapForbidden: true, animationType: "fixedGraphic", movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", speaker: "레오", body: "지붕 고치느라 바빠." }],
      }] as never,
    });
    const spec = caseSpec(map.id, (s) => {
      s.suspects[2].eventId = "ev_village_roofer";
      s.suspects[2].activity = "주막 앞에서 서성임";
      s.suspects[1].activity = "약방 앞 정리";
    });
    const { ctx, result } = author(project, spec);
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    runBundled(ctx.project, bundled(result));
  });

  it("조사 지점이 다른 맵에 있으면 set 스텝으로 그 맵에 들어가 조사한다", () => {
    const project = fixture();
    const ctx = { project };
    expect(runTool(ctx, "create_map", { id: "map_inn", name: "주막", width: 20, height: 15 }).ok).toBe(true);
    linkInn(ctx.project);
    const spec = caseSpec(ctx.project.startMapId, (s) => { s.clues[2].at = { mapId: "map_inn", x: 5, y: 5 }; });
    const result = runTool(ctx, "author_mystery_case", spec);
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    const scene = bundled(result);
    expect(scene.steps.some((step) => step.kind === "set" && step.mapId === "map_inn")).toBe(true);
    runBundled(ctx.project, scene);
  });
});
