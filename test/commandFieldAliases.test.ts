import { describe, expect, it } from "vitest";
import { canonicalizeCommandFieldAlias, canonicalizeCommandFieldAliases } from "@/project/eventCommands/commandFieldAliases";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project, Command, GameEvent } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { checkProgression } from "@/qa/gameCheck/progression";
import { numberInputAnswer } from "@/testing/numberInputAnswer";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { actorBattlers } from "@/battle/battleBattlers";
import { changeParty } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

// 결과 분기를 써 놓고 branchOnResult 를 빠뜨리거나 전투 설정을 battleProcessing 칸에 한 번 더 감싼 명령
// — 첫 관장의 승리 분기(배지·엔딩)가 한 번도 돌지 않았다(2026-10-06 qa:game monster-collect r2).
describe("battleBranchAlias", () => {
  isolateTimers();
  describe("전투 결과 분기 별칭", () => {
    it("분기에 명령이 있으면 branchOnResult:true 를 채운다", () => {
      const command: Record<string, unknown> = { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true, victoryBranch: [{ kind: "setSwitch", switchId: "s", value: true }] };
      expect(canonicalizeCommandFieldAlias(command)).toContain("branchOnResult:true");
      expect(command.branchOnResult).toBe(true);
    });

    it("branchOnResult 를 명시했거나 분기가 비었으면 그대로 둔다", () => {
      const off: Record<string, unknown> = { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true, branchOnResult: false, victoryBranch: [{ kind: "wait", ms: 1 }] };
      canonicalizeCommandFieldAlias(off);
      expect(off.branchOnResult).toBe(false);
      const empty: Record<string, unknown> = { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true, victoryBranch: [] };
      canonicalizeCommandFieldAlias(empty);
      expect(empty.branchOnResult).toBeUndefined();
    });

    it("안에 감싼 battleProcessing 객체는 빠진 값만 옮기고 지운다", () => {
      const command: Record<string, unknown> = { kind: "battleProcessing", canLose: true, battleProcessing: { troopId: "t", canEscape: false, canLose: false } };
      canonicalizeCommandFieldAlias(command);
      expect(command.battleProcessing).toBeUndefined();
      expect(command.troopId).toBe("t");
      expect(command.canEscape).toBe(false);
      expect(command.canLose).toBe(true);
    });
  });
});

// 2026-09-24 헤드리스 r0735 「등대지기의 겨울」: 보스전 승리 분기를 선택지 모양
// `battleProcessing.options:[{text:"승리",branch:[setSwitch, setSelfSwitch]}]` 으로 보냈다. 도구는 ok 였지만
// 런타임은 options 를 읽지 않아 셀프 스위치가 켜지지 않았고 엔딩 페이지가 열리지 않았다.
describe("battleResultOptionsAlias", () => {
  isolateTimers();
  const WIN = [{ kind: "setSwitch", switchId: "sw_0001", value: true }, { kind: "setSelfSwitch", key: "A", value: true }];
  function convert(battle: Record<string, unknown>): { command: Record<string, unknown>; warnings: string[] } {
    const command = { kind: "battleProcessing", troopId: "troop_x", ...battle };
    const warnings: string[] = [];
    canonicalizeCommandFieldAliases([command], message => warnings.push(message));
    return { command, warnings };
  }
  describe("battleProcessing result options alias", () => {
    it("moves a 승리 option into victoryBranch through upsert_event and warns", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const troopId = ctx.project.database.troops[0]!.id;
      const result = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_boss", x: 3, y: 3, name: "보스",
          pages: [{
            id: "p1", trigger: { kind: "action" },
            graphic: { pattern: 0, sprite: { id: "tex_easyrpg_charset_actor1", type: "bundled" }, direction: "down" },
            commands: [{ kind: "battleProcessing", troopId, options: [{ text: "승리", branch: [{ kind: "setSelfSwitch", key: "A", value: true }] }] }],
          }],
        },
      });
      expect(result.ok, result.summary).toBe(true);
      const battle = ctx.project.maps[mapId]!.events.find(e => e.id === "ev_boss")!.pages![0]!.commands[0] as Record<string, unknown>;
      expect(battle).not.toHaveProperty("options");
      expect(battle).toMatchObject({ branchOnResult: true, victoryBranch: [{ kind: "setSelfSwitch", key: "A", value: true }] });
      expect(JSON.stringify(result)).toContain("→ victoryBranch");
      expect(JSON.stringify(result)).toContain("옮겼습니다");
    });

    it("maps defeat and escape texts and enables their flags", () => {
      const { command, warnings } = convert({
        options: [
          { text: "이겼을 때", branch: WIN },
          { text: "Defeat", branch: [{ kind: "text", body: "졌다" }] },
          { text: "도망친다", commands: [{ kind: "text", body: "도망" }] },
        ],
      });
      expect(command).toMatchObject({ branchOnResult: true, canLose: true, canEscape: true });
      expect(command.victoryBranch).toEqual(WIN);
      expect(command.defeatBranch).toEqual([{ kind: "text", body: "졌다" }]);
      expect(command.escapeBranch).toEqual([{ kind: "text", body: "도망" }]);
      expect(command).not.toHaveProperty("options");
      expect(warnings.join("\n")).toMatch(/defeatBranch/);
    });

    it("treats a single unrecognized option as the victory branch and says so", () => {
      const { command, warnings } = convert({ options: [{ text: "보스 격전", branch: WIN }] });
      expect(command.victoryBranch).toEqual(WIN);
      expect(warnings.join("\n")).toContain("승리로 봤습니다");
    });

    it("leaves several unrecognized options alone but explains the right shape", () => {
      const { command, warnings } = convert({ options: [{ text: "가", branch: WIN }, { text: "나", branch: [] }] });
      expect(command).toHaveProperty("options");
      expect(command).not.toHaveProperty("victoryBranch");
      expect(warnings.join("\n")).toContain("branchOnResult:true");
    });
  });
});

// 선택지 보기 목록을 `choices` 로 쓴 명령 — place_npc 가 「command.options is not iterable」 로 죽던 것(2026-09-24 JRPG 도그푸딩).
describe("choicesOptionsAlias", () => {
  isolateTimers();
  describe("choices 보기 목록 별칭", () => {
    it("choices/items/answers 를 options 로 옮긴다(options 가 이미 있으면 건드리지 않는다)", () => {
      const command: Record<string, unknown> = { kind: "choices", items: [{ text: "예", commands: [{ kind: "text", body: "좋아" }] }] };
      expect(canonicalizeCommandFieldAlias(command)).toContain("choices.items 를 options 로");
      expect(command).toEqual({ kind: "choices", options: [{ text: "예", branch: [{ kind: "text", body: "좋아" }] }] });
      const kept: Record<string, unknown> = { kind: "choices", options: [{ text: "예", branch: [] }], choices: [{ text: "x" }] };
      canonicalizeCommandFieldAlias(kept);
      expect(kept.options).toEqual([{ text: "예", branch: [] }]);
    });

    it("choices.text 질문을 prompt 로 옮긴다", () => {
      const command: Record<string, unknown> = { kind: "choices", text: "다이브하시겠습니까?", options: [{ text: "들어간다", branch: [] }] };
      expect(canonicalizeCommandFieldAlias(command)).toContain("choices.text 를 prompt");
      expect(command.prompt).toBe("다이브하시겠습니까?");
      expect(command.text).toBeUndefined();
      const kept: Record<string, unknown> = { kind: "choices", prompt: "이미 있음", text: "버림", options: [] };
      expect(canonicalizeCommandFieldAlias(kept)).toBeUndefined();
      expect(kept.prompt).toBe("이미 있음");
    });

    it("choices.body 질문을 prompt 로 옮긴다(2026-09-24 갤러리 r3)", () => {
      const command: Record<string, unknown> = { kind: "choices", body: "벽에 낡은 레버가 달려 있다. 당겨보겠습니까?", options: [{ text: "당긴다", branch: [] }] };
      expect(canonicalizeCommandFieldAlias(command)).toContain("choices.body 를 prompt");
      expect(command.prompt).toBe("벽에 낡은 레버가 달려 있다. 당겨보겠습니까?");
      expect(command.body).toBeUndefined();
      const kept: Record<string, unknown> = { kind: "choices", prompt: "이미 있음", body: "버림", options: [] };
      expect(canonicalizeCommandFieldAlias(kept)).toBeUndefined();
      expect(kept.prompt).toBe("이미 있음");
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
});

// 2026-09-24 장르 도그푸딩 1라운드 보고서에서 소스로 확인한 도구·자동 플레이 결함의 회귀 고정.
describe("dogfoodRound1Fixes", () => {
  isolateTimers();
  function startMap(project: Project) {
    return project.maps[project.startMapId]!;
  }
  describe("wait 시간 별칭 (꿈 세계)", () => {
    it.each([
      [{ kind: "wait", durationMs: 600 }, 600],
      [{ kind: "wait", seconds: 1.5 }, 1500],
      [{ kind: "wait", frames: 60 }, 1000],
    ])("%j → ms %i", (raw, ms) => {
      const command = { ...raw } as Record<string, unknown>;
      expect(canonicalizeCommandFieldAlias(command)).toContain("ms");
      expect(command).toEqual({ kind: "wait", ms });
    });

    it("ms 가 이미 있으면 건드리지 않는다", () => {
      const command = { kind: "wait", ms: 200, durationMs: 900 };
      expect(canonicalizeCommandFieldAlias(command)).toBeUndefined();
      expect(command.ms).toBe(200);
    });
  });
  describe("자동 플레이 숫자 입력 (추격 호러 금고)", () => {
    it("변수를 상수와 비교하는 저작 조건에서 정답을 고른다", () => {
      const project = createBlankProject();
      const variableId = project.variables[0]!.id;
      const commands: Command[] = [
        { kind: "inputNumber", variableId, digits: 4 } as Command,
        { kind: "fork", condition: { kind: "variable", variableId, op: "==", value: 7419 }, then: [], else: [] } as unknown as Command,
      ];
      startMap(project).events.push({ id: "ev_safe", name: "금고", x: 1, y: 1, pages: [{ trigger: "action", commands }] } as never);
      expect(numberInputAnswer(project, variableId)).toBe(7419);
      expect(numberInputAnswer(project, "var_unused")).toBe(0);
    });
  });
  describe("define_ending 미연결 경고 (연애 배드 엔딩)", () => {
    it("다른 엔딩은 연결됐고 이 엔딩만 안 불리면 정의 시 경고를 낸다", () => {
      const context: ToolContext = { project: createBlankProject() };
      // 레퍼런스 검증이 endingId 를 보므로 엔딩을 먼저 정의하고, 이벤트는 upsert_event 로 정규화해 심는다.
      const ok = runTool(context, "define_ending", {
        id: "ending_ok", name: "엔딩", conditions: [],
      });
      expect(ok.ok, ok.summary).toBe(true);
      // 첫 정의 시점엔 연결 전이라 미연결 경고가 뜨는 것이 정상 — 연결 후 조용해지는지 reOk 에서 본다.
      const wired = runTool(context, "upsert_event", {
        mapId: startMap(context.project).id,
        event: {
          id: "ev_wired", name: "연결됨", x: 1, y: 1,
          pages: [{ id: "p", trigger: { kind: "action" }, commands: [{ kind: "triggerEnding", endingId: "ending_ok" } as Command] }],
        },
      });
      expect(wired.ok, wired.summary).toBe(true);

      // wired 상태를 확정하기 위해 ending_ok 를 한 번 더 정의(경고 재계산) — 이 시점엔 연결돼 있어 조용해야 한다.
      const reOk = runTool(context, "define_ending", {
        id: "ending_ok", name: "엔딩", conditions: [],
      });
      expect(reOk.ok, reOk.summary).toBe(true);
      expect((reOk.diff?.warnings ?? []).join(" ")).not.toContain("부르는 triggerEnding 이 아직 없습니다");

      const bad = runTool(context, "define_ending", {
        id: "ending_bad", name: "배드 엔딩", conditions: [],
      });
      expect(bad.ok, bad.summary).toBe(true);
      expect((bad.diff?.warnings ?? []).join(" ")).toContain("ending_bad");
      expect((bad.diff?.warnings ?? []).join(" ")).toContain("부르는 triggerEnding 이 아직 없습니다");
    });

    it("endingId 없는 bare triggerEnding 이 있으면 조건 선택형으로 열 수 있어 경고하지 않는다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const bare = runTool(context, "upsert_event", {
        mapId: startMap(context.project).id,
        event: {
          id: "ev_bare", name: "선택형", x: 1, y: 1,
          pages: [{ id: "p", trigger: { kind: "action" }, commands: [{ kind: "triggerEnding" } as Command] }],
        },
      });
      expect(bare.ok, bare.summary).toBe(true);
      const result = runTool(context, "define_ending", {
        id: "ending_any", name: "조건형 엔딩", conditions: [{ kind: "switch", switchId: "sw_x", value: true }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect((result.diff?.warnings ?? []).join(" ")).not.toContain("부르는 triggerEnding 이 아직 없습니다");
    });
  });
  describe("rename_variable 표시 이름 (연애)", () => {
    it("name 만 주면 id 는 두고 표시 이름을 바꾼다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const id = context.project.variables[0]!.id;
      const result = runTool(context, "rename_variable", { variableId: id, name: "나래 호감" });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.variables[0]).toMatchObject({ id, name: "나래 호감" });
    });

    it("이름 없는 빈 칸의 id 만 바꾸면 새 id 를 표시 이름으로도 쓴다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const id = context.project.variables[0]!.id;
      context.project.variables[0]!.name = "";
      const result = runTool(context, "rename_variable", { fromId: id, to: "나래호감" });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.variables.find((entry) => entry.id === "나래호감")?.name).toBe("나래호감");
    });
  });
  describe("엔딩별 호출 검사 (연애 배드 엔딩)", () => {
    it("이름으로만 부르는 게임에서 아무도 부르지 않는 엔딩을 경고한다", () => {
      const project = createBlankProject();
      project.endings = [
        { id: "ending_narae", name: "나래 엔딩", conditions: [] },
        { id: "ending_bad", name: "배드 엔딩", conditions: [] },
      ] as never;
      startMap(project).events.push({
        id: "ev_end", name: "끝", x: 1, y: 1,
        pages: [{ trigger: "action", commands: [{ kind: "triggerEnding", endingId: "ending_narae" }] }],
      } as never);
      const findings = checkProgression(project).filter((finding) => finding.code === "ending-uninvoked");
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain("배드 엔딩");
    });
  });
  describe("script_cutscene moveActor 대상 이름 (회상 스토리)", () => {
    it("같은 맵의 이벤트 이름을 이벤트 id 로 바꿔 실제 이동 명령을 만든다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const map = startMap(context.project);
      const placed = runTool(context, "upsert_event", {
        mapId: map.id,
        event: { id: "ev_npc_opaque", name: "노을", x: 3, y: 3, pages: [{ trigger: "action", commands: [{ kind: "text", body: "…" }] }] },
      });
      expect(placed.ok, placed.summary).toBe(true);
      const result = runTool(context, "script_cutscene", {
        mapId: map.id,
        beats: [
          { kind: "say", speaker: "노을", text: "가자." },
          { kind: "moveActor", target: "노을", moves: [{ kind: "turn", dir: "left" }] },
        ],
      });
      expect(result.ok, result.summary).toBe(true);
      const cutscene = context.project.maps[map.id]!.events.find((event) => event.id !== "ev_npc_opaque" && JSON.stringify(event).includes("moveEvent"));
      expect(JSON.stringify(cutscene)).toMatch(/"kind":"moveEvent"[^}]*"ev_npc_opaque"|"ev_npc_opaque"[^}]*"kind":"moveEvent"/);
      expect(JSON.stringify(result)).toContain("이벤트 id 'ev_npc_opaque'");
    });
  });
});

// 2026-09-24 「등대지기의 겨울」 3차 재시험(origin/main 86b9a12d5)에서 남은 결함의 회귀.
// 동료 합류 선택지 분기의 changeParty 가 speciesId/level 로 저장돼 파티에 null → 보스전 「Missing actor」,
// 눈보라 항구 브리프인데 마을은 여름 강마을·보스 배경은 여름 숲.
describe("jrpgDogfoodRetest3Regressions", () => {
  isolateTimers();
  function blank(): { ctx: { project: Project }; mapId: string } {
    const project = createBlankProject();
    return { ctx: { project }, mapId: project.startMapId };
  }
  function eventOf(project: Project, mapId: string, id: string): GameEvent {
    const event = project.maps[mapId]!.events.find(entry => entry.id === id);
    if (!event) throw new Error(`missing event ${id}`);
    return event;
  }
  function warningsOf(result: unknown): string {
    return ((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).join("\n");
  }
  /** 도그푸딩 저장본 그대로의 동료 이벤트(place_npc SimplePage, 선택지 branch 안에 speciesId). */
  function companionArgs(mapId: string, speciesId: string): Record<string, unknown> {
    return {
      mapId, x: 3, y: 3, id: "ev_companion_kai", name: "카이",
      pages: [
        {
          name: "카이 · 영입 전",
          lines: ["나도 같이 갈게!"],
          choices: [
            { text: "함께 가자!", branch: [
              { kind: "text", speaker: "카이", body: "좋아!" },
              { kind: "changeParty", speciesId, level: 1, action: "add" },
              { kind: "setSelfSwitch", key: "A", value: true },
            ] },
            { text: "혼자서도 괜찮아", branch: [{ kind: "text", speaker: "카이", body: "마음이 바뀌면 말해줘!" }] },
          ],
        },
        { name: "카이 · 동행 중", conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["조심해서 가자, 린!"] },
      ],
    };
  }
  function partyCommands(event: GameEvent): Command[] {
    const found: Command[] = [];
    const visit = (commands: readonly Command[]) => {
      for (const command of commands) {
        if (command.kind === "changeParty") found.push(command);
        if (command.kind === "choices") for (const option of command.options) visit(option.branch);
      }
    };
    for (const page of event.pages ?? []) visit(page.commands);
    return found;
  }
  describe("defect 1 — companion changeParty written with speciesId", () => {
    it("place_npc moves a speciesId that names an actor onto actorId, drops level, and says so", () => {
      const { ctx, mapId } = blank();
      const actorId = ctx.project.database.actors[1]!.id;
      const result = runTool(ctx, "place_npc", companionArgs(mapId, actorId));
      expect(result.ok, result.summary).toBe(true);
      expect(partyCommands(eventOf(ctx.project, mapId, "ev_companion_kai"))).toEqual([{ kind: "changeParty", actorId, action: "add" }]);
      expect(warningsOf(result)).toContain("actorId");
    });

    it("place_npc rejects a party change that names no actor, inside a choice branch, with the actor list", () => {
      const { ctx, mapId } = blank();
      const result = runTool(ctx, "place_npc", companionArgs(mapId, "actor_ghost"));
      expect(result.ok).toBe(false);
      const message = JSON.stringify(result.issues);
      expect(message).toContain("actor_ghost");
      expect(message).toContain("branch0");
      expect(message).toContain(ctx.project.database.actors[0]!.id);
      expect(message).not.toContain("pages:[{lines");
      expect(ctx.project.maps[mapId]!.events.some(event => event.id === "ev_companion_kai")).toBe(false);
    });

    it("the Pi tool path (createPiToolset → place_npc) rejects it too", async () => {
      const { ctx, mapId } = blank();
      const [tool] = createPiToolset(ctx, { toolNames: ["place_npc"] });
      await expect(tool!.execute("call_1", companionArgs(mapId, "actor_ghost"), undefined as never)).rejects.toThrow(/actor_ghost/);
      expect(ctx.project.maps[mapId]!.events.some(event => event.id === "ev_companion_kai")).toBe(false);
    });

    it("upsert_event checks native choice branches and battle branches", () => {
      const { ctx, mapId } = blank();
      const inChoice = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_join", x: 4, y: 4, trigger: { kind: "action" }, commands: [], pages: [{
          id: "p0", name: "p0", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "choices", options: [
            { text: "예", branch: [{ kind: "changeParty", speciesId: "actor_ghost", level: 1, action: "add" }] },
            { text: "아니", branch: [] },
          ] }],
        }] },
      });
      expect(inChoice.ok).toBe(false);
      expect(JSON.stringify(inChoice.issues)).toContain("actor_ghost");
    });

    it("the runtime never pushes a non-actor into the party", () => {
      const project = createBlankProject();
      const session = { partyActorIds: [project.database.actors[0]!.id], actorVitals: {} } as unknown as Parameters<typeof changeParty>[0];
      changeParty(session, undefined as unknown as string, "add", project);
      changeParty(session, "actor_ghost", "add", project);
      expect(session.partyActorIds).toEqual([project.database.actors[0]!.id]);
    });

    it("battle setup skips a null party slot instead of dead-ending with 「Missing actor」", () => {
      const project = createBlankProject();
      const hero = project.database.actors[0]!.id;
      const battlers = actorBattlers(project, { partyActorIds: [hero, null as unknown as string] });
      expect(battlers.map(battler => battler.recordId)).toEqual([hero]);
    });

    it("an already-saved speciesId is moved onto actorId on load (canonicalizer recurses into branches)", () => {
      const commands = [{ kind: "choices", options: [{ text: "예", branch: [{ kind: "changeParty", speciesId: "actor_2", level: 1, action: "add" }] }] }];
      canonicalizeCommandFieldAliases(commands);
      expect(commands[0]!.options[0]!.branch[0]).toEqual({ kind: "changeParty", actorId: "actor_2", action: "add" });
    });
  });
});

// 걸음 kind 에 방향을 붙여 쓴 이동 경로({kind:"turnUp"}) — 컷신 전체가 「알 수 없는 move command kind」로 거절되던 것
// (2026-11-03 조수 대조 B1 감방, Opus 5.5 patch_event_page).
describe("moveRouteDirectedStepAlias", () => {
  isolateTimers();
  describe("이동 경로의 방향 붙은 걸음 kind", () => {
    it("turnUp·moveLeft·faceDown·step_right 를 {kind,dir} 로 옮긴다", () => {
      const command: Record<string, unknown> = {
        kind: "moveEvent", eventId: "ev_rino",
        route: { moves: [{ kind: "move", dir: "left" }, { kind: "moveLeft" }, { kind: "turnUp" }, { kind: "faceDown" }, { kind: "step_right" }], wait: true },
      };
      expect(canonicalizeCommandFieldAlias(command)).toContain("route 객체로");
      expect((command.route as { moves: unknown[] }).moves).toEqual([
        { kind: "move", dir: "left" }, { kind: "move", dir: "left" }, { kind: "turn", dir: "up" }, { kind: "turn", dir: "down" }, { kind: "move", dir: "right" },
      ]);
      expect((command.route as { wait?: boolean }).wait).toBe(true);
    });

    it("dir 이 이미 있거나 뜻이 다른 kind 는 그대로 둔다", () => {
      const kept: Record<string, unknown> = { kind: "moveEvent", eventId: "e", route: { moves: [{ kind: "turnUp", dir: "down" }, { kind: "turnRandom" }], repeat: false } };
      expect(canonicalizeCommandFieldAlias(kept)).toBeUndefined();
      expect((kept.route as { moves: unknown[] }).moves).toEqual([{ kind: "turnUp", dir: "down" }, { kind: "turnRandom" }]);
    });
  });
  describe("다른 엔진식 한 걸음 명령", () => {
    it("moveActor turn/move 를 한 칸 moveEvent 로, setEventLocation 을 placeAt 경로로 옮긴다", () => {
      const turn: Record<string, unknown> = { kind: "moveActor", target: "@player", action: "turn", dir: "down" };
      expect(canonicalizeCommandFieldAlias(turn)).toContain("moveActor");
      expect(turn).toEqual({ kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turn", dir: "down" }], repeat: false, wait: true } });
      const place: Record<string, unknown> = { kind: "setEventLocation", eventId: "rino", x: 4, y: 12 };
      canonicalizeCommandFieldAlias(place);
      expect(place).toEqual({ kind: "moveEvent", eventId: "rino", route: { moves: [{ kind: "placeAt", x: 4, y: 12 }], repeat: false, wait: true } });
    });

    it("다른 맵으로 옮기거나 방향이 없으면 그대로 둔다", () => {
      const other: Record<string, unknown> = { kind: "setEventLocation", eventId: "rino", mapId: "m2", x: 1, y: 1 };
      expect(canonicalizeCommandFieldAlias(other)).toBeUndefined();
      const vague: Record<string, unknown> = { kind: "moveActor", target: "@player", action: "jump" };
      expect(canonicalizeCommandFieldAlias(vague)).toBeUndefined();
    });
  });
});

// transfer 의 도착 방향을 facing/dir 로 쓴 명령 — 런타임이 direction 만 읽어 조용히 버리던 것(2026-09-24 JRPG ember-4).
describe("transferFacingAlias", () => {
  isolateTimers();
  describe("transfer 도착 방향 별칭", () => {
    it("facing/dir 을 direction 으로 옮긴다", () => {
      const command: Record<string, unknown> = { kind: "transfer", mapId: "map_a", x: 3, y: 4, facing: "down" };
      expect(canonicalizeCommandFieldAlias(command)).toContain("transfer.facing 를 direction");
      expect(command).toEqual({ kind: "transfer", mapId: "map_a", x: 3, y: 4, direction: "down" });
    });

    it("방향이 아닌 값이거나 direction 이 이미 있으면 그대로 둔다", () => {
      const odd: Record<string, unknown> = { kind: "transfer", mapId: "m", x: 1, y: 1, facing: "north" };
      expect(canonicalizeCommandFieldAlias(odd)).toBeUndefined();
      expect(odd.facing).toBe("north");
      const kept: Record<string, unknown> = { kind: "transfer", mapId: "m", x: 1, y: 1, direction: "up", facing: "down" };
      canonicalizeCommandFieldAlias(kept);
      expect(kept.direction).toBe("up");
    });

    it("저장본을 읽을 때도 옮긴다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events.push({
        id: "ev_exit", name: "출구", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
        pages: [{ id: "p", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "transfer", mapId: map.id, x: 5, y: 5, facing: "left" } as never] }],
      });
      const loaded = deserialize(serialize(project));
      expect(loaded.maps[map.id]!.events.find((event) => event.id === "ev_exit")!.pages[0]!.commands[0]).toMatchObject({ kind: "transfer", direction: "left" });
    });
  });
});
