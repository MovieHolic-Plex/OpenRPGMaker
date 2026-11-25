import { describe, expect, it } from "vitest";
import { runTool, getTool } from "@/editor/tools";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import type { Project, Command, GameEvent } from "@/project/types";
import { runGameCheck } from "@/qa/gameCheck";
import type { ToolContext } from "@/editor/tools/types";
import { isolateTimers } from "./mergedTeardown";

// 2026-10-05 조수 스트레스 실측: 「이기면 500G」를 적 보상 gold 500 과 승리 분기 changeGold +500 으로 둘 다 넣어
// 실제로는 1000G 가 들어왔는데 도구는 ok 만 돌려줬다. 거부하지 않고 합계를 경고로 알린다.
describe("battleGoldDoubleReward", () => {
  isolateTimers();
  function bossEvent(troopId: string, victoryBranch: unknown[]) {
    return { id: "ev_boss", name: "보스", x: 3, y: 3, pages: [{ conditions: [], trigger: { kind: "action" }, commands: [{
      kind: "battleProcessing", troopId, canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch, defeatBranch: [{ kind: "gameOver" }],
    }] }] };
  }
  describe("battle gold double reward warning", () => {
    const setup = () => {
      const project = createBlankProject();
      const troop = project.database.troops[0]!;
      const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0]!;
      const enemy = project.database.enemies.find(entry => entry.id === enemyId)!;
      enemy.rewards = { ...enemy.rewards, gold: 500 };
      for (const other of troop.members?.map(member => member.enemyId) ?? troop.enemyIds) {
        if (other !== enemyId) project.database.enemies.find(entry => entry.id === other)!.rewards.gold = 0;
      }
      return { project, troopId: troop.id };
    };
    const warnings = (result: ReturnType<typeof runTool>) =>
      ((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).filter(warning => warning.includes("전투 보상 골드"));

    it("warns when the victory branch adds gold on top of the troop's battle reward", () => {
      const { project, troopId } = setup();
      const result = runTool({ project }, "upsert_event", { mapId: project.startMapId,
        event: bossEvent(troopId, [{ kind: "changeGold", op: "+=", amount: 500 }]) });
      expect(result.ok).toBe(true);
      expect(warnings(result).join("\n")).toContain("1000G");
    });

    it("stays quiet when the victory branch gives no extra gold", () => {
      const { project, troopId } = setup();
      const result = runTool({ project }, "upsert_event", { mapId: project.startMapId,
        event: bossEvent(troopId, [{ kind: "text", body: "이겼다" }]) });
      expect(result.ok).toBe(true);
      expect(warnings(result)).toEqual([]);
    });
  });
});

// 2026-09-24 헤드리스 「등대지기의 겨울」: 보스 이벤트의 battleProcessing 이 부대 ID 를 commandId 로 보내
// 「troopId가 문자열이 아닙니다」로 거부됐고, 모델은 보스를 대사 NPC 로 다시 놓아 보스전이 사라졌다.
describe("battleTroopAlias", () => {
  isolateTimers();
  function bossEvent(battle: Record<string, unknown>): Record<string, unknown> {
    return {
      id: "ev_boss", x: 3, y: 3, name: "눈보라 정령",
      pages: [{
        id: "page_battle", trigger: { kind: "action" },
        graphic: { pattern: 0, sprite: { id: "tex_easyrpg_charset_actor1", type: "bundled" }, direction: "down" },
        commands: [{ kind: "text", body: "얼어붙어라!" }, { kind: "battleProcessing", ...battle }],
      }],
    };
  }
  describe("battleProcessing troop alias", () => {
    it("moves a lone commandId into troopId and warns", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const troopId = ctx.project.database.troops[0]!.id;
      const result = runTool(ctx, "upsert_event", { mapId, event: bossEvent({ commandId: troopId }) });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find(e => e.id === "ev_boss")!;
      const battle = event.pages![0]!.commands[1] as Record<string, unknown>;
      expect(battle.troopId).toBe(troopId);
      expect(battle).not.toHaveProperty("commandId");
      expect(battle).toMatchObject({ canEscape: true, canLose: false });
      expect(JSON.stringify(result)).toContain("troopId");
    });

    it("leaves ambiguous aliases alone so validation still rejects them", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const troopId = ctx.project.database.troops[0]!.id;
      const result = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: bossEvent({ commandId: troopId, troop: "troop_other" }) });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("troopId");
    });
  });
});

// 2026-09-24 추격 호러 r8 라운드에서 고친 결함의 회귀 고정.
// r7(qa-runs/chase-r7) 실측: 금고 inputNumber → fork(var == 7419) 의 변수를 「세터 없는 선행」으로
// 오판해 암호 이벤트·열쇠 사슬이 전부 unresolved 로 남고, 자동 플레이가 엔딩까지 못 갔다(막힘 1).
// 같은 라운드: rename_switch/rename_variable 이 대상 없이 to+name 만 온 인자를 연속 거부했다(r7 5회 반복 실패).
describe("chaseDogfoodR8", () => {
  isolateTimers();
  const ok = (ctx: { project: Project }, name: string, args: Record<string, unknown>): void => {
    const result = runTool(ctx, name, args);
    expect(result.ok, `${name}: ${result.summary}`).toBe(true);
  };
  /** inputNumber 금고 + 열쇠/암호 조건의 문(엔딩) — r7「잿빛 저택의 술래」를 축약한 픽스처. */
  function vaultEscapeProject(doorCondition: "item" | "variable"): { project: Project } {
    const ctx: { project: Project } = { project: createBlankProject() };
    const hall = ctx.project.startMapId;
    const { x, y } = ctx.project.startPos;
    const variableId = ctx.project.variables[0]!.id;
    if (doorCondition === "item") ok(ctx, "upsert_item", { item: { id: "item_key", name: "현관 열쇠" } });
    ok(ctx, "define_ending", { id: "ending_escape", name: "탈출", conditions: [] });
    ok(ctx, "upsert_event", { mapId: hall, event: {
      id: "ev_vault", x: x + 1, y,
      pages: [{ trigger: { kind: "action" }, conditions: [], commands: [
        { kind: "inputNumber", variableId, digits: 4 },
        { kind: "fork", condition: { kind: "variable", variableId, op: "==", value: 7419 },
          then: doorCondition === "item"
            ? [{ kind: "changeItem", itemId: "item_key", op: "+=", amount: 1 }]
            : [{ kind: "text", body: "금고가 열렸다." }],
          else: [
            { kind: "text", body: "암호가 틀렸다." },
            { kind: "setVariable", variableId, op: "=", value: 0 },
          ] },
      ] }],
    } });
    ok(ctx, "upsert_event", { mapId: hall, event: {
      id: "ev_front_door", x: x - 2, y,
      pages: [
        { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "문이 잠겨 있다." }] },
        { trigger: { kind: "action" },
          conditions: doorCondition === "item"
            ? [{ kind: "item", present: true, itemId: "item_key" }]
            : [{ kind: "variable", variableId, op: "==", value: 7419 }],
          commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] },
      ],
    } });
    return ctx;
  }
  describe("추격 호러 r8 — 자동 플레이 금고 암호", () => {
    it("fork 안에서 열쇠를 주는 금고도 세터 없이 계획에 넣고 엔딩까지 간다(문은 아이템 조건)", () => {
      const ctx = vaultEscapeProject("item");
      const report = runGameCheck(ctx.project, { autoPlayBudgetMs: 20_000 });
      const run = report.autoPlay!.runs[0]!;
      expect(run.ok, JSON.stringify(run.steps)).toBe(true);
      expect(run.endingReached).toBe("ending_escape");
    });

    it("문이 암호 변수를 직접 요구하면 inputNumber 페이지를 세터로 잡는다", () => {
      const ctx = vaultEscapeProject("variable");
      const report = runGameCheck(ctx.project, { autoPlayBudgetMs: 20_000 });
      const run = report.autoPlay!.runs[0]!;
      expect(run.ok, JSON.stringify(run.steps)).toBe(true);
      expect(run.endingReached).toBe("ending_escape");
      expect(report.autoPlay!.plan.join(" ")).toContain("만들기");
    });
  });
  describe("추격 호러 r8 — rename_switch/rename_variable 대상 없는 to+name", () => {
    it("switch: 대상 없이 to+name 으로 오면 그 id 로 새 스위치를 만든다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "rename_switch", { to: "sw_chase_active", name: "잿빛 술래 추격 활성화" });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.switches.find((def) => def.id === "sw_chase_active")).toEqual({ id: "sw_chase_active", name: "잿빛 술래 추격 활성화" });
      expect(ctx.project.session.switches["sw_chase_active"]).toBe(false);
    });

    it("switch: 이미 있는 id 는 겝침으로 거절하고 첫 이름을 남긴다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      expect(runTool(ctx, "rename_switch", { to: "sw_chase_active", name: "잿빛 술래 추격 활성화" }).ok).toBe(true);
      const second = runTool(ctx, "rename_switch", { to: "sw_chase_active", name: "덮어쓰기 시도" });
      expect(second.ok).toBe(false);
      expect(second.issues?.[0]?.code).toBe("switch-exists");
      expect(ctx.project.switches.find((def) => def.id === "sw_chase_active")?.name).toBe("잿빛 술래 추격 활성화");
    });

    it("switch: 대상 없이 name 만 오면 여전히 거부한다(to 없이는 어디에 둘지 모른다)", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "rename_switch", { name: "대상 없는 이름" });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("rename-target");
    });

    it("variable: 대상 없이 to+name 으로 오면 그 id 로 새 변수를 만든다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "rename_variable", { to: "var_code", name: "금고 암호" });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.variables.find((def) => def.id === "var_code")).toEqual({ id: "var_code", name: "금고 암호" });
      expect(ctx.project.session.variables["var_code"]).toBe(0);
    });
  });
});

// 2026-10-26 j80: 추격자에게 잡히면 게임 오버다 — 헤드리스 시험(run_scene_test)으로 확인한다.
// 그때 「게임 오버: 기대 true, 실제 false」는 시험이 주인공을 벽 덩이 안에 놓아서였다 — 그런 칸은 이제 경고한다.
describe("chaserCatchGameOver", () => {
  isolateTimers();
  describe("추격자에게 잡히면 게임 오버", () => {
    it("killOnTouch 추격자 옆 걸을 칸에서 기다리면 게임 오버가 된다", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.startPos = { x: 1, y: 1 };
      const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 }, sightRange: 5 }, killOnTouch: true });
      const { x, y } = made.data as { x: number; y: number };
      const result = getTool("run_scene_test")!.run(project, { mapId, start: { x: x - 2, y }, steps: [{ kind: "wait", ticks: 600 }, { kind: "expect", gameOver: true }] });
      expect(result.summary).toContain("성공");
    });

    it("주인공을 맵 밖·걸을 수 없는 칸에 놓는 set 은 경고한다", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      const result = getTool("run_scene_test")!.run(project, { mapId, start: { x: 1, y: 1 }, steps: [{ kind: "set", x: map.width + 3, y: 1 }] });
      expect((result.warnings ?? []).join(" ")).toContain("걸을 수 없는 칸");
    });
  });
});

describe("compilePuzzlePassword", () => {
  isolateTimers();
  // compile_puzzle kind:"password" — 작은 일 셋째 묶음(password-safe)에서 드러난 셋:
  // 선택지 암호의 맞는 글자가 늘 첫 칸이었다 · 0 으로 시작하는 숫자 암호가 숫자 입력이 아니라 선택지로 갔다 · 그림 없는 칸의 장치가 아무 알림 없이 투명했다.

  function compile(answer: string, prepare?: (project: Project) => void) {
    const project = createBlankProject();
    prepare?.(project);
    const result = getTool("compile_puzzle")!.run(project, { mapId: project.startMapId, puzzleId: "safe", kind: "password", at: { x: 6, y: 2 }, name: "금고", answer, onSolve: { message: "열렸다." } });
    const event = project.maps[project.startMapId]!.events.find((entry) => entry.id === "ev_safe_password") as GameEvent;
    return { project, result, event, commands: event.pages![0]!.commands as Command[] };
  }
  type Choices = Extract<Command, { kind: "choices" }>;
  /** 자리마다 (보기 글자들, 맞는 글자의 자리). 맞는 가지만 다음 자리로 이어진다. */
  function steps(commands: readonly Command[]): { options: string[]; correct: number }[] {
    const ask = commands.find((command): command is Choices => command.kind === "choices");
    if (!ask) return [];
    const correct = ask.options.findIndex((option) => !option.branch.some((command) => command.kind === "text" && command.body === "암호가 틀렸다."));
    return [{ options: ask.options.map((option) => option.text), correct }, ...steps(ask.options[correct]!.branch)];
  }
  describe("compile_puzzle password", () => {
    it("선택지 암호: 자리마다 보기 다섯에 맞는 글자가 한 번 있고, 맞는 글자가 늘 첫 칸은 아니다", () => {
      for (const answer of ["BELL", "가나다", "a1Z", "MOON"]) {
        const asked = steps(compile(answer).commands);
        expect(asked.map((step) => step.options[step.correct]).join("")).toBe(answer);
        for (const step of asked) {
          expect(step.options).toHaveLength(5);
          expect(new Set(step.options).size).toBe(5);
        }
      }
      // 네 글자 암호 넷 가운데 첫 칸만 눌러 열리는 것은 없다.
      expect(["BELL", "MOON", "STAR", "가나다라"].filter((answer) => steps(compile(answer).commands).every((step) => step.correct === 0))).toEqual([]);
    });

    it("보기는 맞는 글자와 같은 종류다 — 영문 암호에 숫자를 섞지 않는다", () => {
      for (const step of steps(compile("BELL").commands)) expect(step.options.join("")).toMatch(/^[A-Z]{5}$/u);
      for (const step of steps(compile("가나다").commands)) expect(step.options.join("")).toMatch(/^[가-힣]{5}$/u);
    });

    it("다시 지어도 보기 차례가 같다", () => {
      expect(steps(compile("BELL").commands)).toEqual(steps(compile("BELL").commands));
    });

    it("0 으로 시작하는 숫자 암호도 숫자 입력으로 받는다(자리 수 그대로)", () => {
      const { commands } = compile("0427");
      expect(commands.find((command) => command.kind === "inputNumber")).toMatchObject({ digits: 4 });
      expect(commands.find((command) => command.kind === "fork")).toMatchObject({ condition: { kind: "variable", op: "==", value: 427 } });
      expect(commands.some((command) => command.kind === "choices")).toBe(false);
    });

    it("그 칸에 물건 타일이 없으면 가까이서 반짝이게 하고 영어로 알린다 — 물건 타일 위면 조용하다", () => {
      const bare = compile("1234");
      expect(bare.event.pages![0]!.nearSparkle).toEqual({ radius: 2 });
      expect(bare.result.warnings).toEqual([expect.stringMatching(/has no picture.*stamp_object/u)]);
      const onProp = compile("1234", (project) => { const map = project.maps[project.startMapId]!; map.upperTiles[2 * map.width + 6] = 5; });
      expect(onProp.event.pages![0]!.nearSparkle).toBeUndefined();
      expect(onProp.result.warnings).toBeUndefined();
    });
  });
});

// 컷신·에필로그에 이벤트 명령 모양 {kind:"text",body} 로 쓴 대사를 say 로 옮긴다.
// 2026-09-24 갤러리 호러 r5: define_ending 세 번이 스키마 enum 에서 통째로 튕겼다.
describe("cutsceneSayBeatAlias", () => {
  isolateTimers();
  describe("say beat aliases", () => {
    it("define_ending accepts text/body epilogue beats as say", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const result = runTool(ctx, "define_ending", { id: "ending_bad", name: "그림 속의 미아", conditions: [], epilogue: [
        { kind: "text", body: "마지막 꽃잎이 떨어졌다." },
        { kind: "narrate", text: "하린은 그림의 일부가 되었다." },
      ] });
      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
      const ending = ctx.project.endings!.find((entry) => entry.id === "ending_bad")!;
      expect(JSON.stringify(ending.epilogue)).toContain('"kind":"say"');
      expect(JSON.stringify(ending.epilogue)).toContain("마지막 꽃잎이 떨어졌다.");
      expect(JSON.stringify(ending.epilogue)).not.toContain('"body"');
      expect(JSON.stringify(result)).toContain("say 로 옮겼습니다");
    });

    it("script_cutscene accepts a text beat inside parallel", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const result = runTool(ctx, "script_cutscene", { mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true, beats: [
        { kind: "text", body: "그림이 웃었다." },
        { kind: "parallel", beats: [{ kind: "text", message: "…" }, { kind: "shake", durationMs: 300 }] },
      ] });
      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    });
  });
});

// define_ending 을 이미 있는 id 로 다시 부르면 안 보낸 칸은 그대로다(2026-11-11 작은 일 기준선:
// generate_art{target:"ending"} 가 그림만 걸려고 id·name·presentation 으로 불렀다가 conditions 필수에 걸려 41번 중 27번 거절됐다).
describe("defineEndingKeepsFields", () => {
  isolateTimers();
  function withEnding() {
    const ctx = { project: createBlankProject() };
    const made = runTool(ctx, "define_ending", {
      id: "ending_a", name: "봄", priority: 3,
      conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
      epilogue: [{ kind: "say", speaker: "나", text: "끝났다." }],
      presentation: { tone: "warm", finalTitle: "봄" },
    });
    expect(made.ok, made.summary).toBe(true);
    return ctx;
  }
  const ending = (ctx: { project: ReturnType<typeof createBlankProject> }, id = "ending_a") => ctx.project.endings!.find((e) => e.id === id)!;
  describe("define_ending — 다시 부르기", () => {
    it("id·name 만 보내면 아무것도 바뀌지 않는다", () => {
      const ctx = withEnding();
      const before = JSON.stringify(ending(ctx));
      expect(runTool(ctx, "define_ending", { id: "ending_a", name: "봄" }).ok).toBe(true);
      expect(JSON.stringify(ending(ctx))).toBe(before);
    });

    it("presentation 만 보내면 조건·우선순위·에필로그는 그대로다(빈 epilogue 는 안 보낸 것)", () => {
      const ctx = withEnding();
      expect(runTool(ctx, "define_ending", { id: "ending_a", name: "봄", epilogue: [], presentation: { tone: "dark" } }).ok).toBe(true);
      const e = ending(ctx);
      expect(e.presentation?.tone).toBe("dark");
      expect(e.conditions).toHaveLength(1);
      expect(e.priority).toBe(3);
      expect(e.epilogue).toHaveLength(1);
    });

    // 2026-11-16 확인 빌드 r6 P9: 다섯 값을 정한 뒤 배경 하나만 다시 보내자 제목·윗글·크레딧·tone 이 지워졌다(엔딩 화면 «끝» · 크레딧 없음).
    it("presentation 은 칸마다 합친다 — 한 칸만 보내면 나머지 칸은 그대로다", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "define_ending", { id: "ending_cat", name: "미케, 집으로", presentation: { tone: "warm", kicker: "상점가의 미케", finalTitle: "미케, 집으로", credits: "만든 이\n도윤", badge: "HAPPY ENDING" } }).ok).toBe(true);
      const again = runTool(ctx, "define_ending", { id: "ending_cat", name: "미케, 집으로", presentation: { tone: "dark" } });
      expect(again.ok, again.summary).toBe(true);
      expect(ending(ctx, "ending_cat").presentation).toEqual({ tone: "dark", kicker: "상점가의 미케", finalTitle: "미케, 집으로", credits: "만든 이\n도윤", badge: "HAPPY ENDING" });
      // 무엇을 그대로 두었는지 결과 글이 말한다(모델이 읽는 글 — 영어).
      expect(again.summary).toContain("presentation: kept kicker, finalTitle, credits, badge from before");
      // 빈 글은 안 보낸 것이다 — 스키마 칸을 빈 값으로 채워 보내도 앞의 글이 남는다. null 은 그 칸을 지운다.
      expect(runTool(ctx, "define_ending", { id: "ending_cat", name: "미케, 집으로", presentation: { kicker: "", credits: null } }).ok).toBe(true);
      expect(ending(ctx, "ending_cat").presentation).toEqual({ tone: "dark", kicker: "상점가의 미케", finalTitle: "미케, 집으로", badge: "HAPPY ENDING" });
      // 새 엔딩의 빈 칸은 그냥 없는 칸이다.
      expect(runTool(ctx, "define_ending", { id: "ending_new", name: "새벽", presentation: { tone: "warm", kicker: "" } }).ok).toBe(true);
      expect(ending(ctx, "ending_new").presentation).toEqual({ tone: "warm" });
    });

    it("보낸 칸은 바꾼다 — conditions:[] 는 조건을 없앤다", () => {
      const ctx = withEnding();
      expect(runTool(ctx, "define_ending", { id: "ending_a", name: "봄", conditions: [], priority: 0 }).ok).toBe(true);
      expect(ending(ctx).conditions).toHaveLength(0);
      expect(ending(ctx).priority).toBe(0);
    });

    it("새 엔딩은 conditions 없이도 만든다(조건 없는 엔딩)", () => {
      const ctx = withEnding();
      expect(runTool(ctx, "define_ending", { id: "ending_b", name: "겨울" }).ok).toBe(true);
      expect(ending(ctx, "ending_b").conditions).toEqual([]);
      expect(ending(ctx, "ending_b").priority).toBe(0);
    });
  });
});

// 2026-09-24 헤드리스 「등대지기의 겨울」: find_tools("define_ending") 이 define_ending 과 함께 설명에 그 이름이
// 나오는 툴 5개를 스키마째 돌려줘 한 번에 약 45k자였다. 정확한 이름 검색은 그 툴만 돌려준다.
describe("discoveryReadContracts", () => {
  isolateTimers();
  function names(query: string): { names: string[]; summary: string } {
    const result = runTool({ project: createBlankProject() }, "find_tools", { query });
    expect(result.ok, result.summary).toBe(true);
    return { names: (result.data as { matches: { name: string }[] }).matches.map(match => match.name), summary: result.summary };
  }
  describe("find_tools exact names", () => {
    it("returns only the named tool for an exact tool name", () => {
      expect(names("define_ending").names).toEqual(["define_ending"]);
    });

    it("returns every named tool and reports names that do not exist", () => {
      const found = names("configure_time_system configure_weather_system");
      expect(found.names).toEqual(["configure_time_system"]);
      expect(found.summary).toContain("configure_weather_system");
    });

    it("keyword queries still rank across tools", () => {
      expect(names("ending").names.length).toBeGreaterThan(1);
    });
  });
  describe("list_resources empty query", () => {
    it("browses the catalog like '*' instead of returning nothing", () => {
      for (const kind of ["charset", "monster"]) {
        const project = createBlankProject();
        const empty = runTool({ project }, "list_resources", { kind, query: "", limit: 5 });
        const star = runTool({ project }, "list_resources", { kind, query: "*", limit: 5 });
        expect(empty.ok, empty.summary).toBe(true);
        expect((empty.data as { matches: unknown[] }).matches.length, kind).toBeGreaterThan(0);
        expect(empty.data).toEqual(star.data);
      }
    });
  });
});
