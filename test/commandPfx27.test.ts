import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { canonicalizeCommandFieldAlias, canonicalizeCommandFieldAliases } from "@/project/eventCommands/commandFieldAliases";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project, Command, GameEvent, EventPage } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { checkProgression } from "@/qa/gameCheck/progression";
import { numberInputAnswer } from "@/testing/numberInputAnswer";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { actorBattlers } from "@/battle/battleBattlers";
import { changeParty } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { commandSummaryParts, commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { store } from "@/project/store";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { runCommandContract } from "./commandContracts/harness";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { editorState } from "@/editor/editorState";

describe("commandFieldAliases", () => {
  isolateTimers();
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
});

describe("commandSummary", () => {
  isolateTimers();
  describe("actorM2CommandBodies", () => {
    isolateTimers();
    function ctx(replaceCommand = vi.fn()): CommandEditContext {
      return {
        path: [1],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand,
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    function m2(commandId: string, fields: Record<string, string | number> = {}): Extract<Command, { kind: "m2Command" }> {
      return { kind: "m2Command", commandId, fields };
    }
    describe("actor m2 command body UX", () => {
      let restoreDom: (() => void) | undefined;
      let actorId = "";
      let variableId = "";
      let stateId = "";
      let classId = "";

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        actorId = project.database.actors[0]?.id ?? "";
        variableId = project.variables[0]?.id ?? "";
        stateId = project.database.states[0]?.id ?? "";
        classId = project.database.classes[0]?.id ?? "";
        if (!actorId) throw new Error("missing actor");
        store.replace(project);
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("renders change-state rich form with party target + state picker", () => {
        const body = renderWithFakeDom(() =>
          renderM2CommandBody(ctx(), m2("m2-019-change-state", { target: "party", operation: "add", value: stateId }))!
        );
        expect(findByTestId(body, "change-state-command-body")).not.toBeNull();
        expect(findByTestId(body, "change-state-target-mode")).not.toBeNull();
        expect(findByTestId(body, "change-state-state-select")).not.toBeNull();
        expect(findByTestId(body, "change-state-preview")).not.toBeNull();
        expect(body.textContent).toContain("상태 변경");
      });

      it("writes damage value from variable source", () => {
        const replaceCommand = vi.fn();
        const body = renderWithFakeDom(() =>
          renderM2CommandBody(
            ctx(replaceCommand),
            m2("m2-021-damage-processing", {
              target: actorId,
              operation: "add",
              value: 10,
              valueSource: "number",
            })
          )!
        );
        expect(findByTestId(body, "damage-processing-command-body")).not.toBeNull();
        (findByTestId(body, "damage-processing-value-source-segment-variable") as FakeElement | null)?.dispatchEvent(
          new Event("click")
        )
        const variableRoot = findByTestId(body, "damage-processing-value-variable") as FakeElement | null;
        const variableSelect = variableRoot?.querySelector?.("select") as FakeElement | null;
        if (variableSelect && variableId) {
          variableSelect.value = variableId;
          variableSelect.dispatchEvent(new Event("change"));
        }
        expect(replaceCommand).toHaveBeenCalled();
        const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
        expect(next.fields.valueSource).toBe("variable");
        if (variableId) expect(next.fields.valueVariableId).toBe(variableId);
      });

      it("renders name/nickname/class/graphic/faceset rich shells", () => {
        const cases = [
          ["m2-022-change-actor-name", "change-actor-name-command-body"],
          ["m2-023-change-actor-nickname", "change-actor-nickname-command-body"],
          ["m2-024-change-actor-graphic", "change-actor-graphic-command-body"],
          ["m2-025-change-actor-faceset", "change-actor-faceset-command-body"],
          ["m2-091-change-actor-class", "change-actor-class-command-body"],
        ] as const;
        for (const [commandId, testId] of cases) {
          const body = renderWithFakeDom(() =>
            renderM2CommandBody(ctx(), m2(commandId, { target: actorId, value: classId || "" }))!
          );
          expect(findByTestId(body, testId), commandId).not.toBeNull();
        }
      });

      it("summarizes damage and actor identity commands in Korean", () => {
        const damage = commandSummaryParts(
          m2("m2-021-damage-processing", {
            target: "party",
            operation: "add",
            value: 12,
            valueSource: "variable",
            valueVariableId: variableId || "var_0001",
          })
        )
          .map((part) => part.text)
          .join("");
        expect(damage).toContain("데미지");
        expect(damage).toContain("변수");

        const name = commandSummaryParts(
          m2("m2-022-change-actor-name", { target: actorId, value: "새이름" })
        )
          .map((part) => part.text)
          .join("");
        expect(name).toContain("주인공 이름 변경");
        expect(name).toContain("새이름");
      });
    });
  });
  describe("changeExpCommandBody", () => {
    isolateTimers();
    describe("changeExp modern form + variable operand", () => {
      let restoreDom: (() => void) | undefined;
      let staged: Command;

      const actions: CommandListActions = {
        addCommand: () => undefined,
        insertCommand: () => undefined,
        deleteCommand: () => undefined,
        moveCommand: () => undefined,
        moveCommandTo: () => undefined,
        replaceCommand: (_path, command) => {
          staged = command;
        },
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        if (project.variables[0]) project.variables[0].name = "Quest EXP";
        store.replace(project);
        staged = { kind: "changeExp", actorId: "", op: "+=", amount: 10 };
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("폼에 대상/연산/경험치 소스/변수 피커를 노출한다", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        expect(findByTestId(body, "event-command-exp-form")).toBeTruthy();
        expect(findByTestId(body, "change-exp-target-mode")).toBeTruthy();
        expect(findByTestId(body, "change-exp-amount-source")).toBeTruthy();
        expect(findByTestId(body, "change-exp-amount-input")).toBeTruthy();
        expect(findByTestId(body, "change-exp-hint")).toBeNull();
      });

      it("경험치 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다", () => {
        const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        const source = findByTestId(body, "change-exp-amount-source") as unknown as HTMLSelectElement;
        source.value = "variable";
        source.dispatchEvent(new Event("change"));
        expect(staged.kind).toBe("changeExp");
        if (staged.kind !== "changeExp") return;
        expect(typeof staged.amount).toBe("object");
        if (typeof staged.amount === "number") return;
        expect(staged.amount.kind).toBe("var");

        const operand = findByTestId(body, "change-exp-amount-variable") as unknown as HTMLElement;
        expect(operand.hidden).toBe(false);
        const select = operand.querySelector("select") as HTMLSelectElement | null;
        expect(select).toBeTruthy();
        if (!select) return;
        select.value = variableId;
        select.dispatchEvent(new Event("change"));
        if (staged.kind !== "changeExp" || typeof staged.amount === "number") return;
        expect(staged.amount.id).toBe(variableId);
      });

      it("대상 주인공 모드에서 actorId 를 저장한다", () => {
        const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        const target = findByTestId(body, "change-exp-target-mode") as unknown as HTMLSelectElement;
        target.value = "actor";
        target.dispatchEvent(new Event("change"));
        const actorSelect = findByTestId(body, "change-exp-actor-select") as unknown as HTMLSelectElement;
        actorSelect.value = actorId;
        actorSelect.dispatchEvent(new Event("change"));
        expect(staged.kind).toBe("changeExp");
        if (staged.kind !== "changeExp") return;
        expect(staged.actorId).toBe(actorId);
      });

      it("preserves a variable operand while changing the operation on an existing command", () => {
        const variableId = store.getCurrent().variables[0]?.id;
        if (!variableId) throw new Error("missing variable fixture");
        staged = { kind: "changeExp", actorId: "", op: "+=", amount: { kind: "var", id: variableId } };
        const body = renderWithFakeDom(() => renderCommandBody({ path: [0], actions, lockKind: true }, staged));
        const operation = findByTestId(body, "change-exp-op-select");
        if (!operation) throw new Error("missing operation");
        operation.value = "-=";
        operation.dispatchEvent(new Event("change"));
        expect(staged).toEqual({ kind: "changeExp", actorId: "", op: "-=", amount: { kind: "var", id: variableId } });
      });

      it("요약에 파티 전체와 변수 경험치를 표시한다", () => {
        const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
        expect(commandSummary({
          kind: "changeExp",
          actorId: "",
          op: "+=",
          amount: { kind: "var", id: variableId },
        })).toContain("파티 전체");
        expect(commandSummary({
          kind: "changeExp",
          actorId: "",
          op: "+=",
          amount: { kind: "var", id: variableId },
        })).toContain("Quest EXP");
      });

      it("런타임: 변수 경험치로 단일 액터를 증가시킨다", () => {
        const actorId = "actor_hero";
        const result = runCommandContract([
          { kind: "setVariable", variableId: "var_exp_pay", op: "=", value: 40 },
          { kind: "changeExp", actorId, op: "+=", amount: { kind: "var", id: "var_exp_pay" } },
        ], {
          mutateSession: (session) => {
            session.actorExperience = { [actorId]: 10 };
          },
        });
        expect(result.session.actorExperience?.[actorId]).toBe(50);
        expect(result.finished).toBe(true);
      });

      it("런타임: 파티 전체에 숫자 경험치를 적용한다", () => {
        const result = runCommandContract([
          { kind: "changeExp", actorId: "", op: "+=", amount: 25 },
        ], {
          mutateSession: (session) => {
            session.partyActorIds = ["actor_a", "actor_b"];
            session.actorExperience = { actor_a: 5, actor_b: 15 };
          },
        });
        expect(result.session.actorExperience?.actor_a).toBe(30);
        expect(result.session.actorExperience?.actor_b).toBe(40);
      });

      it("런타임: 숫자 금액 레거시 형태도 유지한다", () => {
        const result = runCommandContract([
          { kind: "changeExp", actorId: "actor_hero", op: "-=", amount: 25 },
        ], {
          mutateSession: (session) => {
            session.actorExperience = { actor_hero: 30 };
          },
        });
        expect(result.session.actorExperience?.actor_hero).toBe(5);
      });
    });
  });
  describe("changeGoldCommandBody", () => {
    isolateTimers();
    describe("changeGold amount variable operand", () => {
      let restoreDom: (() => void) | undefined;
      let staged: Command;

      const actions: CommandListActions = {
        addCommand: () => undefined,
        insertCommand: () => undefined,
        deleteCommand: () => undefined,
        moveCommand: () => undefined,
        moveCommandTo: () => undefined,
        replaceCommand: (_path, command) => {
          staged = command;
        },
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        project.session.gold = 100;
        if (project.variables[0]) project.variables[0].name = "Reward Gold";
        store.replace(project);
        staged = { kind: "changeGold", op: "+=", amount: 10 };
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("폼에 금액 소스(숫자/변수)와 변수 피커를 노출한다", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        expect(findByTestId(body, "event-command-gold-form")).toBeTruthy();
        expect(findByTestId(body, "change-gold-amount-source")).toBeTruthy();
        expect(findByTestId(body, "change-gold-amount-input")).toBeTruthy();
        expect(findByTestId(body, "change-gold-hint")).toBeTruthy();
      });

      it("금액 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다", () => {
        const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        const source = findByTestId(body, "change-gold-amount-source") as unknown as HTMLSelectElement;
        source.value = "variable";
        source.dispatchEvent(new Event("change"));
        expect(staged.kind).toBe("changeGold");
        if (staged.kind !== "changeGold") return;
        expect(typeof staged.amount).toBe("object");
        if (typeof staged.amount === "number") return;
        expect(staged.amount.kind).toBe("var");

        const operand = findByTestId(body, "change-gold-amount-variable") as unknown as HTMLElement;
        expect(operand.hidden).toBe(false);
        const select = operand.querySelector("select") as HTMLSelectElement | null;
        expect(select).toBeTruthy();
        if (!select) return;
        select.value = variableId;
        select.dispatchEvent(new Event("change"));
        if (staged.kind !== "changeGold" || typeof staged.amount === "number") return;
        expect(staged.amount.id).toBe(variableId);
      });

      it("요약에 변수 금액을 표시한다", () => {
        const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
        expect(commandSummary({
          kind: "changeGold",
          op: "+=",
          amount: { kind: "var", id: variableId },
        })).toContain("Reward Gold");
      });

      it("런타임: 변수 금액으로 소지금을 증가시킨다", () => {
        const result = runCommandContract([
          { kind: "setVariable", variableId: "var_gold_pay", op: "=", value: 40 },
          { kind: "changeGold", op: "+=", amount: { kind: "var", id: "var_gold_pay" } },
        ], {
          mutateSession: (session) => {
            session.gold = 10;
          },
        });
        expect(result.session.gold).toBe(50);
        expect(result.finished).toBe(true);
      });

      it("런타임: 숫자 금액 레거시 형태도 유지한다", () => {
        const result = runCommandContract([
          { kind: "changeGold", op: "-=", amount: 25 },
        ], {
          mutateSession: (session) => {
            session.gold = 30;
          },
        });
        expect(result.session.gold).toBe(5);
      });
    });
  });
  describe("changeItemCommandBody", () => {
    isolateTimers();
    describe("changeItem amount variable operand", () => {
      let restoreDom: (() => void) | undefined;
      let staged: Command;
      let itemId = "";
      let variableId = "";

      const actions: CommandListActions = {
        addCommand: () => undefined,
        insertCommand: () => undefined,
        deleteCommand: () => undefined,
        moveCommand: () => undefined,
        moveCommandTo: () => undefined,
        replaceCommand: (_path, command) => {
          staged = command;
        },
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        itemId = project.database.items[0]?.id ?? "item_potion";
        if (project.variables[0]) project.variables[0].name = "Loot Count";
        variableId = project.variables[0]?.id ?? "var_0001";
        store.replace(project);
        staged = { kind: "changeItem", itemId, op: "+=", amount: 1 };
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("폼에 개수 소스(숫자/변수)와 변수 피커를 노출한다", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        expect(findByTestId(body, "event-command-item-form")).toBeTruthy();
        expect(findByTestId(body, "change-item-amount-source")).toBeTruthy();
        expect(findByTestId(body, "change-item-amount-input")).toBeTruthy();
        expect(findByTestId(body, "change-item-hint")).toBeTruthy();
      });

      it("개수 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        const source = findByTestId(body, "change-item-amount-source") as unknown as HTMLSelectElement;
        source.value = "variable";
        source.dispatchEvent(new Event("change"));
        expect(staged.kind).toBe("changeItem");
        if (staged.kind !== "changeItem") return;
        expect(typeof staged.amount).toBe("object");

        const operand = findByTestId(body, "change-item-amount-variable") as unknown as HTMLElement;
        expect(operand.hidden).toBe(false);
        const select = operand.querySelector("select") as HTMLSelectElement | null;
        expect(select).toBeTruthy();
        if (!select) return;
        select.value = variableId;
        select.dispatchEvent(new Event("change"));
        if (staged.kind !== "changeItem" || typeof staged.amount === "number") return;
        expect(staged.amount.id).toBe(variableId);
      });

      it("요약에 변수 개수를 표시한다", () => {
        const text = commandSummary({
          kind: "changeItem",
          itemId,
          op: "+=",
          amount: { kind: "var", id: variableId },
        });
        expect(text).toContain("Loot Count");
      });

      it("런타임: 변수 개수로 아이템을 증가시킨다", () => {
        const result = runCommandContract([
          { kind: "setVariable", variableId: "var_item_qty", op: "=", value: 3 },
          { kind: "changeItem", itemId, op: "+=", amount: { kind: "var", id: "var_item_qty" } },
        ], {
          mutateSession: (session) => {
            session.inventory[itemId] = 1;
          },
        });
        expect(result.session.inventory[itemId]).toBe(4);
        expect(result.finished).toBe(true);
      });

      it("런타임: 숫자 개수 레거시 형태도 유지한다", () => {
        const result = runCommandContract([
          { kind: "changeItem", itemId, op: "-=", amount: 2 },
        ], {
          mutateSession: (session) => {
            session.inventory[itemId] = 5;
          },
        });
        expect(result.session.inventory[itemId]).toBe(3);
      });
    });
  });
  describe("learnSkillCommandBody", () => {
    isolateTimers();
    describe("learnSkill modern form + forget/party", () => {
      let restoreDom: (() => void) | undefined;
      let staged: Command;

      const actions: CommandListActions = {
        addCommand: () => undefined,
        insertCommand: () => undefined,
        deleteCommand: () => undefined,
        moveCommand: () => undefined,
        moveCommandTo: () => undefined,
        replaceCommand: (_path, command) => {
          staged = command;
        },
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        if (project.database.skills[0]) project.database.skills[0].name = "파이어";
        store.replace(project);
        staged = { kind: "learnSkill", actorId: "", skillId: project.database.skills[0]?.id ?? "", action: "learn" };
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("폼에 액션/대상/특수기 픽커를 노출한다", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        expect(findByTestId(body, "event-command-learn-skill-form")).toBeTruthy();
        expect(findByTestId(body, "learn-skill-action-select")).toBeTruthy();
        expect(findByTestId(body, "learn-skill-target-mode")).toBeTruthy();
        expect(findByTestId(body, "learn-skill-skill-select")).toBeTruthy();
        expect(findByTestId(body, "learn-skill-preview")).toBeTruthy();
      });

      it("망각 액션을 저장한다", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        const action = findByTestId(body, "learn-skill-action-select") as unknown as HTMLSelectElement;
        action.value = "forget";
        action.dispatchEvent(new Event("change"));
        expect(staged.kind).toBe("learnSkill");
        if (staged.kind !== "learnSkill") return;
        expect(staged.action).toBe("forget");
      });

      it("주인공 대상 모드에서 actorId 를 저장한다", () => {
        const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
        const body = renderWithFakeDom(() =>
          renderCommandBody({ path: [0], actions, lockKind: true }, staged)
        );
        const target = findByTestId(body, "learn-skill-target-mode") as unknown as HTMLSelectElement;
        target.value = "actor";
        target.dispatchEvent(new Event("change"));
        const actorSelect = findByTestId(body, "learn-skill-actor-select") as unknown as HTMLSelectElement;
        actorSelect.value = actorId;
        actorSelect.dispatchEvent(new Event("change"));
        expect(staged.kind).toBe("learnSkill");
        if (staged.kind !== "learnSkill") return;
        expect(staged.actorId).toBe(actorId);
      });

      it("요약에 파티/망각을 표시한다", () => {
        const skillId = store.getCurrent().database.skills[0]?.id ?? "skill_1";
        expect(commandSummary({
          kind: "learnSkill",
          actorId: "",
          skillId,
          action: "forget",
        })).toContain("파티 전체");
        expect(commandSummary({
          kind: "learnSkill",
          actorId: "",
          skillId,
          action: "forget",
        })).toContain("잊기");
        expect(commandSummary({
          kind: "learnSkill",
          actorId: "",
          skillId,
          action: "forget",
        })).toContain("파이어");
      });

      it("런타임: 파티 전체에 스킬을 습득시킨다", () => {
        const skillId = "skill_fire";
        const result = runCommandContract([
          { kind: "learnSkill", actorId: "", skillId, action: "learn" },
        ], {
          mutateSession: (session) => {
            session.partyActorIds = ["actor_a", "actor_b"];
            session.actorSkillIds = { actor_a: [], actor_b: ["skill_old"] };
          },
        });
        expect(result.session.actorSkillIds?.actor_a).toEqual([skillId]);
        expect(result.session.actorSkillIds?.actor_b).toEqual(["skill_old", skillId]);
      });

      it("런타임: 망각은 목록에서 제거한다", () => {
        const result = runCommandContract([
          { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire", action: "forget" },
        ], {
          mutateSession: (session) => {
            session.actorSkillIds = { actor_hero: ["skill_fire", "skill_ice"] };
          },
        });
        expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_ice"]);
      });

      it("런타임: 레거시 action 없는 형태는 습득으로 유지한다", () => {
        const result = runCommandContract([
          { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire" },
        ], {
          mutateSession: (session) => {
            session.actorSkillIds = { actor_hero: [] };
          },
        });
        expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_fire"]);
      });
    });
  });
  /**
   * 계약: **`화면 효과` 편집 폼과 목록 요약이 런타임과 같은 언어로 말한다.**
   *
   * 회귀 배경(적대적 QA `.omo/evidence/screen-fx-2/qa-before.md`):
   *  - D3: 색 값이 `input[type=text]` 단독이라 스와치/피커가 0개였고, `#xyz` 도 조용히 통과했다.
   *        런타임 `parseTintColor` 는 그 값을 흰색 45% 워시로 떨어뜨린다 — 에디터는 아무 말도 없었다.
   *  - D7: `시간(ms)` 에 min/max 가 없어 `-500`/`99999` 가 유효로 통과했다.
   *        런타임 `clampMs` 는 50~5000ms 로 자른다.
   *  - D8: 목록 요약이 `화면 효과: effect: fadeIn, durationMs: 300` 처럼 내부 키를 노출했다.
   */
  describe("screenEffectFields", () => {
    isolateTimers();
    const SCREEN_EFFECT_ID = "m2-202-screen-effect";
    const noopActions: CommandListActions = {
      addCommand: () => {},
      insertCommand: () => {},
      replaceCommand: () => {},
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };
    function screenEffect(fields: Record<string, unknown>): Command {
      return { kind: "m2Command", commandId: SCREEN_EFFECT_ID, fields } as unknown as Command;
    }
    function bodyOf(fields: Record<string, unknown>, actions: CommandListActions = noopActions): FakeElement {
      return renderWithFakeDom(() =>
        renderCommandBody({ path: [], actions, lockKind: true }, screenEffect(fields))
      );
    }
    describe("screen effect authoring — color field, duration range, list summary", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("value field offers a native color picker and preset swatches (D3)", () => {
        const body = bodyOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
        const color = findByTestId(body, "m2-command-value-color");
        expect(color?.type).toBe("color");
        expect(color?.value).toBe("#39ff14");
        for (const preset of ["red", "green", "blue", "yellow", "purple", "white", "black"]) {
          expect(findByTestId(body, `m2-command-value-swatch-${preset}`)).toBeTruthy();
        }
      });

      it("preset swatch writes the color into the command (D3)", () => {
        let staged: Command | null = null;
        const body = bodyOf(
          { effect: "tint", value: "", durationMs: 300 },
          { ...noopActions, replaceCommand: (_path, command) => (staged = command) }
        );
        findByTestId(body, "m2-command-value-swatch-green")?.click();
        const applied = staged as Command | null;
        expect(applied?.kind).toBe("m2Command");
        if (applied?.kind !== "m2Command") return;
        expect(applied.fields.value).toBe("green");
      });

      it("invalid typed color marks the field aria-invalid with a short reason (D3)", () => {
        const body = bodyOf({ effect: "tint", value: "", durationMs: 300 });
        const text = findByTestId(body, "m2-command-value-input");
        expect(text).toBeTruthy();
        if (!text) return;
        text.value = "#xyz";
        text.dispatchEvent(new Event("input", { bubbles: true }));
        expect(text.getAttribute("aria-invalid")).toBe("true");
        expect(findByTestId(body, "m2-command-value-error")?.textContent).toContain("#rrggbb");

        text.value = "green";
        text.dispatchEvent(new Event("input", { bubbles: true }));
        expect(text.getAttribute("aria-invalid")).toBe("false");
      });

      it("durationMs input carries the runtime clamp range (D7)", () => {
        const body = bodyOf({ effect: "flash", value: "white", durationMs: 300 });
        const duration = findByTestId(body, "m2-command-durationMs-input");
        expect(duration?.min).toBe("50");
        expect(duration?.max).toBe("5000");
        expect(duration?.getAttribute("step")).toBe("100");

        if (!duration) return;
        duration.value = "99999";
        duration.dispatchEvent(new Event("input", { bubbles: true }));
        expect(duration.getAttribute("aria-invalid")).toBe("true");
        expect(findByTestId(body, "m2-command-durationMs-note")?.textContent).toContain("5000");
      });

      it("list summary uses catalog labels instead of raw field keys (D8)", () => {
        expect(commandSummary(screenEffect({ effect: "fadeIn", durationMs: 300 }))).toContain("페이드 인");
        expect(commandSummary(screenEffect({ effect: "fadeIn", durationMs: 300 }))).not.toContain("effect:");
        const tint = commandSummary(screenEffect({ effect: "tint", value: "#39ff14", durationMs: 1200 }));
        expect(tint).toContain("색조");
        expect(tint).toContain("#39ff14");
        expect(tint).toContain("1200ms");
        expect(tint).not.toContain("durationMs");
      });
    });
    /**
     * 3라운드 회귀:
     *  - D6: 화면 효과 모달이 `날씨 설정` 모달(의도 카드·프리셋 칩)에 비해 헐벗었다.
     *  - D9: fadeIn/fadeOut 은 `값` 을 읽지 않는데 입력이 그대로 보였다.
     *        (flash/tint/weather 는 런타임 applyScreenEffect 가 값을 읽으므로 남긴다.)
     */
    describe("screen effect authoring — intent card, duration presets, value visibility", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
      });

      function effectSelect(body: FakeElement): FakeElement {
        const select = findByTestId(body, "m2-command-effect-option-select");
        if (!select) throw new Error("효과 select 가 없다");
        return select;
      }

      it("intent card explains the selected effect in one line, with the duration (D6)", () => {
        const body = bodyOf({ effect: "flash", value: "white", durationMs: 800 });
        const card = findByTestId(body, "m2-screen-effect-intent");
        expect(card).toBeTruthy();
        expect(card?.textContent).toContain("번쩍");
        expect(card?.textContent).toContain("800ms");
      });

      it("intent card follows the effect select (D6)", () => {
        const body = bodyOf({ effect: "flash", value: "white", durationMs: 800 });
        const select = effectSelect(body);
        select.value = "fadeOut";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const card = findByTestId(body, "m2-screen-effect-intent");
        expect(card?.textContent).toContain("어두워");
        expect(card?.textContent).not.toContain("번쩍");
      });

      it("duration preset chips write 300/800/1600ms into the number input (D6)", () => {
        let staged: Command | null = null;
        const body = bodyOf(
          { effect: "fadeOut", value: "", durationMs: 300 },
          { ...noopActions, replaceCommand: (_path, command) => (staged = command) }
        );
        const chips = [
          { testid: "m2-screen-effect-duration-fast", label: "빠른", ms: 300 },
          { testid: "m2-screen-effect-duration-normal", label: "보통", ms: 800 },
          { testid: "m2-screen-effect-duration-slow", label: "느린", ms: 1600 },
        ];
        for (const chip of chips) {
          const button = findByTestId(body, chip.testid);
          expect(button, chip.testid).toBeTruthy();
          expect(button?.textContent).toContain(chip.label);
          button?.click();
          expect(findByTestId(body, "m2-command-durationMs-input")?.value).toBe(String(chip.ms));
          const applied = staged as Command | null;
          expect(applied?.kind).toBe("m2Command");
          if (applied?.kind !== "m2Command") return;
          expect(applied.fields.durationMs).toBe(chip.ms);
          expect(findByTestId(body, "m2-screen-effect-intent")?.textContent).toContain(`${chip.ms}ms`);
        }
      });

      it("hides the 값 row for effects the runtime ignores and toggles it live (D9)", () => {
        const hiddenFor = (effect: string): boolean => {
          const row = findByTestId(bodyOf({ effect, value: "", durationMs: 300 }), "m2-screen-effect-value-field");
          if (!row) throw new Error("값 행이 없다");
          return row.hidden;
        };
        expect(hiddenFor("fadeIn")).toBe(true);
        expect(hiddenFor("fadeOut")).toBe(true);
        expect(hiddenFor("tint")).toBe(false);
        expect(hiddenFor("flash")).toBe(false);
        expect(hiddenFor("weather")).toBe(false);

        const body = bodyOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
        const select = effectSelect(body);
        select.value = "fadeIn";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        expect(findByTestId(body, "m2-screen-effect-value-field")?.hidden).toBe(true);
        select.value = "tint";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        expect(findByTestId(body, "m2-screen-effect-value-field")?.hidden).toBe(false);
      });

      it("letterbox intent says the message window moves inside the bars", () => {
        const body = bodyOf({ effect: "letterbox", value: "12", durationMs: 600 });
        const card = findByTestId(body, "m2-screen-effect-intent");
        expect(card?.textContent).toContain("안쪽으로 밀린다");
        expect(card?.textContent).not.toContain("그대로");
        expect(card?.textContent).toContain("12%");
        expect(card?.textContent).toContain("600ms");
      });
    });
    /**
     * D9(3라운드): 모든 화면 효과 행에 `이 명령은 실제 게임에서 일부 효과만 실행됩니다` 라는
     * 뭉뚱그린 경고가 붙었다. fadeIn/fadeOut/flash/tint/weather 는 applyScreenEffect 가
     * 실제 렌더 경로에 얹으므로 그 문장은 거짓이고, 렌더러가 없는 값(blur)에만 참이다.
     */
    describe("screen effect authoring — runtime warning text (D9)", () => {
      const VAGUE = "이 명령은 실제 게임에서 일부 효과만 실행됩니다.";

      function validate(fields: Record<string, unknown>) {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const page = {
          id: "page-1",
          name: "화면 효과 페이지",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "below",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [screenEffect(fields)],
        } as unknown as EventPage;
        const event = { id: "event-fx", x: 3, y: 3, trigger: page.trigger, commands: [], pages: [page] } as unknown as GameEvent;
        project.maps[mapId].events = [event];
        return validateEventDraftBody(project, mapId, event);
      }

      it("drops the vague partial-runtime warning for effects the runtime renders", () => {
        for (const effect of ["fadeIn", "fadeOut", "flash", "tint", "weather"]) {
          const messages = validate({ effect, value: "", durationMs: 300 }).issues.map((issue) => issue.message);
          expect(messages, effect).not.toContain(VAGUE);
          expect(messages.join(" | "), effect).not.toContain("일부 효과만");
        }
      });

      it("names the unrenderable effect instead of hand-waving", () => {
        const issues = validate({ effect: "blur", value: "", durationMs: 300 }).issues;
        const warning = issues.find((issue) => issue.code === "runtime.screenEffect.unsupported");
        expect(warning?.severity).toBe("warning");
        expect(warning?.commandPath).toEqual([0]);
        expect(warning?.message).toContain("blur");
        expect(issues.map((issue) => issue.message)).not.toContain(VAGUE);
      });
    });
  });
  describe("transferCommandBody", () => {
    isolateTimers();
    const noopActions = {
      addCommand: () => undefined,
      deleteCommand: () => undefined,
      insertCommand: () => undefined,
      moveCommand: () => undefined,
      moveCommandTo: () => undefined,
      replaceCommand: () => undefined,
    };
    describe("transfer command body", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        const project = createBlankProject();
        store.replace(project);
        editorState.set({ currentMapId: project.startMapId });
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("embeds the map picker inline without a nested 장소 이동... button", () => {
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            { path: [], actions: noopActions },
            { kind: "transfer", mapId: "", x: 0, y: 0, direction: "retain", fade: "black" } satisfies Command
          )
        );

        expect(findByTestId(body, "event-transfer-player-dialog")).not.toBeNull();
        expect(findByTestId(body, "transfer-player-map-tree")).not.toBeNull();
        expect(findByTestId(body, "transfer-player-map-preview")).not.toBeNull();
        expect(findByTestId(body, "transfer-player-open")).not.toBeNull();
        // No second nested "open picker" button with the same label friction.
        expect(body.textContent ?? "").not.toContain("장소 이동...");
        expect(findByTestId(body, "transfer-player-ok")?.textContent).toContain("선택 완료");
      });

      it("names a non-default fade and door in the command list, and hides the defaults", () => {
        const mapId = store.getCurrent().startMapId;
        const summary = commandSummary({
          kind: "transfer",
          mapId,
          x: 7,
          y: 10,
          direction: "down",
          fade: "white",
          door: true,
        });
        expect(summary).toContain("(7,10)");
        expect(summary).toContain("아래");
        expect(summary).toContain("페이드 흰색");
        expect(summary).toContain("문 열림");

        const defaults = commandSummary({
          kind: "transfer",
          mapId,
          x: 1,
          y: 1,
          direction: "retain",
          fade: "black",
        });
        expect(defaults).not.toContain("페이드");
        expect(defaults).not.toContain("문 열림");
        expect(defaults).not.toContain("문 연출");
        expect(commandSummary({ kind: "transfer", mapId, x: 1, y: 1, door: false })).toContain("문 연출 없음");
      });

      it("keeps the chosen direction and fade when the door setting changes", () => {
        const mapId = store.getCurrent().startMapId;
        let current: Command = { kind: "transfer", mapId, x: 2, y: 3, direction: "retain", fade: "black" };
        const body = renderWithFakeDom(() =>
          renderCommandBody(
            {
              path: [],
              actions: {
                ...noopActions,
                replaceCommand: (_path, command) => { current = command; },
              },
              getCurrentCommand: () => current,
            },
            current,
          ),
        );

        const direction = findByTestId(body, "transfer-player-direction-right") as HTMLInputElement | null;
        expect(direction).not.toBeNull();
        direction!.checked = true;
        direction!.dispatchEvent(new Event("change", { bubbles: true }));
        expect(current).toMatchObject({ x: 2, y: 3, direction: "right", fade: "black" });
        expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("오른쪽");

        const fade = findByTestId(body, "transfer-player-fade-none") as HTMLInputElement | null;
        expect(fade).not.toBeNull();
        fade!.checked = true;
        fade!.dispatchEvent(new Event("change", { bubbles: true }));
        expect(current).toMatchObject({ direction: "right", fade: "none" });
        expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("페이드: 없음");

        const door = findByTestId(body, "transfer-door-mode") as HTMLSelectElement | null;
        expect(door).not.toBeNull();
        door!.value = "on";
        door!.dispatchEvent(new Event("change", { bubbles: true }));
        expect(current).toMatchObject({ mapId, x: 2, y: 3, direction: "right", fade: "none", door: true });
        expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("문 열림");
      });
    });
  });
});
