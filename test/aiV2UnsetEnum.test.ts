import { describe, expect, it } from "vitest";
import { getTool, runTool } from "@/editor/tools";
import { createPiToolset, formatPiToolSuccess, writeResultForModel } from "@/ai/piAgent/toolAdapter";
import { englishToolCopy } from "@/ai/v2/tools/toolExposure";
import { preCheck } from "@/ai/v2/loop/argGuard";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { buildEvent } from "@/ai/v2/story/events";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { sceneCraftFindings } from "@/ai/v2/judge/sceneCraft";
import type { EventSpec } from "@/ai/v2/shared/types";
import { readFileSync } from "node:fs";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { runCheck } from "@/harnesses/assistant-capability/node/smallJobs/checks";
import { applyCalls, type SmallJob } from "@/harnesses/assistant-capability/node/smallJobs/suite";
import { effectiveFieldHud, normalizeFieldHud, resolvedHudWidgets } from "@/project/fieldHud";
import type { Command, Project } from "@/project/types";
import { PiCharsetSelectionGate } from "@/ai/piAgent/charsetSelectionGate";
import { PiTilesetReferenceGate } from "@/ai/piAgent/tilesetReferenceGate";
import { isolateTimers } from "./mergedTeardown";
import { createBlankProject } from "@/project/defaults";
import { hidingSpots, requestedFeatureGaps } from "@/ai/v2/judge/requestedFeatures";
import { applyMapLighting, litShotNote } from "@/ai/v2/judge/vqaLighting";
import { vqaReviewerCandidates } from "@/ai/v2/judge/vqa";
import { familyOfProviderId } from "@/ai/assistantRoles";
import { shuffledOptions, trivialCode } from "@/ai/v2/story/puzzle";
import { weakPuzzleLocks } from "@/ai/v2/judge/puzzleChecks";

describe("aiV2UnsetEnum", () => {
  isolateTimers();
  // 값이 하나뿐인 선택 enum 은 칸을 다 채우는 모델이 비울 수 없다 — v2 는 "none" 을 더해 보여 주고, 인자 검사가 도구에 가기 전에 걷는다.
  // 2026-11-11 작은 일 둘째 묶음 item-new-built: upsert_item 의 escapeTo 가 하나뿐인 값 "entrance" 로 채워져 회복 차가 탈출 로프로 저장됐다.
  describe("aiV2UnsetEnum", () => {
    isolateTimers();
    type Node = { enum?: unknown[]; properties?: Record<string, Node>; items?: Node; required?: string[] };
    const at = (node: Node, path: string[]): Node | undefined => path.reduce<Node | undefined>((n, k) => n?.properties?.[k], node);
    describe("값 하나짜리 선택 enum", () => {
      const ctx = { project: buildFixture("starter") };
      const shown = (name: string) => englishToolCopy(createPiToolset(ctx, { toolNames: [name] }).find((t) => t.name === name)!, true).parameters as Node;

      it("모델이 보는 스키마에는 none 이 앞에 있다 — 도구의 진짜 스키마는 그대로", () => {
        expect(at(shown("upsert_item"), ["item", "escapeTo"])?.enum).toEqual(["none", "entrance"]);
        expect(at(getTool("upsert_item")!.parameters as Node, ["item", "escapeTo"])?.enum).toEqual(["entrance"]);
        expect(at(shown("place_npc"), ["guide"])?.enum).toEqual(["none", "action-controls"]);
        // 값이 여럿인 enum 과 필수 칸은 건드리지 않는다.
        expect(at(shown("upsert_item"), ["item", "scope"])?.enum).toEqual(at(getTool("upsert_item")!.parameters as Node, ["item", "scope"])?.enum);
      });

      it("none 으로 온 칸은 도구에 가기 전에 걷히고, 차는 탈출 로프가 되지 않는다", () => {
        const sent = { item: { id: "item_tea", name: "눈꽃 차", scope: "ally", price: 30, type: "medicine", escapeTo: "none", hpRecovery: { flat: 50, percentMax: 0 } } };
        const pre = preCheck("upsert_item", shown("upsert_item"), sent, ctx.project);
        expect(pre.kind).toBe("ok");
        const args = (pre as { args: { item: Record<string, unknown> } }).args;
        expect("escapeTo" in args.item).toBe(false);
        // 진짜 값이 none 인 칸(scope)은 그대로 둔다.
        const keep = preCheck("upsert_item", shown("upsert_item"), { item: { id: "item_rope", name: "밧줄", scope: "none" } }, ctx.project);
        expect((keep as { args: { item: Record<string, unknown> } }).args.item.scope).toBe("none");
        const run = { project: ctx.project };
        expect(runTool(run, "upsert_item", args).ok).toBe(true);
        const saved = run.project.database.items.find((i) => i.id === "item_tea") as { escapeTo?: string; type?: string } | undefined;
        expect(saved?.escapeTo).toBeUndefined();
        expect(saved?.type).toBe("medicine");
      });
    });
  });
  // 곁에 서 있던 사람이 주인공에게 다가서는 장면 — 한 걸음이어도 걷기 검사·자리 이탈 판정에 걸리지 않는다.
  // 2026-11-11 작은 일 둘째 묶음 walk-up-greet-starter: «3걸음 미만» 과 «제자리로 돌려보내라» 가 차례로 걸려 모델이 미루의 자리를 옮겼다(요청 밖 편집).
  describe("aiV2WalkUpGreet", () => {
    isolateTimers();
    const TASK = "게임을 시작하면 꼬마 미루가 주인공한테 걸어와서 \"어서 와, 기다렸어!\"라고 말하게 해 줘. 한 번만 나오게 해 줘";
    describe("곁에 선 사람이 다가서는 시작 장면", () => {
      it("한 걸음 다가서기는 걷기 검사를 지나고, 자리 이탈로 잡히지 않고, 그 사람의 자리도 그대로다", () => {
        const before = buildFixture("starter");
        const ctx = { project: structuredClone(before) };
        const village = Object.values(ctx.project.maps).find((m) => m.name === "잿불 마을")!;
        const post = village.events.find((e) => e.name === "꼬마 미루")!;
        const built = buildEvent(createBuildRun(ctx), { kind: "cutscene", mapId: village.id, when: "game-start", beats: [{ do: "walk", who: "꼬마 미루", to: "주인공" }, { do: "say", who: "꼬마 미루", text: "어서 와, 기다렸어!" }] } as unknown as EventSpec);
        expect(built.ok, built.summary).toBe(true);
        const walk = built.stage!.checks.filter((c) => c.id === "cutscene-walk");
        expect(walk.length).toBe(1);
        expect(walk[0]!.ok, walk[0]!.detail).toBe(true);
        expect(built.stage!.walks[0]!.steps).toBeLessThan(3);
        const after = ctx.project.maps[village.id]!.events.find((e) => e.id === post.id)!;
        expect([after.x, after.y]).toEqual([post.x, post.y]);
        expect(sceneCraftFindings(before, ctx.project, TASK).filter((f) => f.id === "off-post")).toEqual([]);
      });

      it("장면에만 나오는 사람의 짧은 걷기는 여전히 문제다", () => {
        const ctx = { project: buildFixture("starter") };
        const village = Object.values(ctx.project.maps).find((m) => m.name === "잿불 마을")!;
        const built = buildEvent(createBuildRun(ctx), { kind: "cutscene", mapId: village.id, when: "game-start", beats: [{ do: "walk", who: "낯선 전령", to: "주인공" }, { do: "say", who: "낯선 전령", text: "전갈이오." }] } as unknown as EventSpec);
        expect(built.ok, built.summary).toBe(true);
        for (const w of built.stage!.walks) expect(w.besideAlready).toBeUndefined();
      });
    });
  });
  describe("genreDeviceTools", () => {
    isolateTimers();
    // 좁은 장치 도구 넷(호감 · 가진 물건 내밀기 · 제한 시간 · 화면 게이지) — 이벤트 명령을 손으로 조립하던 장치를 한 호출로.
    // 2026-11-11 셋째 묶음 Terra 기준선: 선물 36호출 · 고백 32 · 내밀기 27. 판정은 그 묶음의 기계 검사(결과만 본다)를 그대로 쓴다.

    const JOBS = (JSON.parse(readFileSync("harness-data/assistant-capability/small-jobs-3.json", "utf8")) as { jobs: SmallJob[] }).jobs;
    const NARROW = JOBS.flatMap((job) => (job.accept ?? []).filter((way) => way.note.startsWith("좁은 도구 한 호출")).map((way) => [job.id, job, way.calls] as const));
    const V = "map_ember_village", INN = "ev_ember_inn", GUARD = "ev_ember_guard", FIELD = "map_blank_start";
    const starter = (): ToolContext => ({ project: buildFixture("starter") });
    const commandsOf = (ctx: ToolContext, eventId: string): Command[] => ctx.project.maps[V]!.events.find((event) => event.id === eventId)!.pages![0]!.commands;
    const kinds = (commands: readonly Command[]): string[] => commands.map((command) => (command.kind === "label" ? `label:${command.name}` : command.kind));
    const bare = (commands: readonly Command[]) => commands.map((command) => { const { id: _id, ...rest } = command as Command & { id?: string }; return rest; });
    describe("좁은 도구 한 호출이 그 일의 판정을 통과한다", () => {
      it("일곱 가지 일에 그 풀이가 적혀 있다", () => {
        // Break: 묶음에서 풀이가 빠지면 아래 표가 비어 조용히 통과한다.
        expect(NARROW.map(([id]) => id).sort()).toEqual(["affection-grows-starter", "affection-two-pages-built", "confess-ending-starter", "evidence-present-starter", "gift-affection-starter", "hunger-hud-starter", "time-limit-starter"]);
      });
      it.each(NARROW)("%s", (_id, job, calls) => {
        const fixture = buildFixture(job.fixture as FixtureId);
        const verdict = runCheck(job.check, job.allow, fixture, applyCalls(fixture, calls));
        expect(verdict.pass, verdict.reason).toBe(true);
      }, 60_000);
    });
    describe("set_npc_affection", () => {
      it("있던 명령은 뒤에 그대로 두고, 다시 부르면 호감 토막만 갈아 끼운다", () => {
        const ctx = starter();
        const old = bare(commandsOf(ctx, INN));
        expect(runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, talkGain: 1, milestones: [{ atLeast: 3, lines: ["차"] }] }).ok).toBe(true);
        const once = kinds(commandsOf(ctx, INN));
        expect(once).toEqual(["label:affection:begin", "changeFriendship", "fork", "label:affection:end", ...kinds(old as Command[])]);
        // Break: 표시가 없으면 두 번째 호출이 토막을 하나 더 쌓아 말을 걸 때마다 호감이 두 번 오른다.
        expect(runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, talkGain: 2, milestones: [{ atLeast: 5, lines: ["케이크"] }] }).ok).toBe(true);
        const twice = commandsOf(ctx, INN);
        expect(kinds(twice)).toEqual(once);
        expect(twice.find((command) => command.kind === "changeFriendship")).toMatchObject({ delta: 2 });
        expect(JSON.stringify(twice)).toContain("케이크");
        expect(JSON.stringify(twice)).not.toContain("\"차\"");
        expect(bare(twice.slice(-old.length))).toEqual(old);
      });

      it("호감 열쇠를 돌려준다 — 다른 이벤트가 같은 열쇠로 읽는다", () => {
        const ctx = starter();
        const result = runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, npcKey: "masa", talkGain: 1 });
        expect(result.data).toMatchObject({ npcKey: "masa", condition: { kind: "friendshipAtLeast", npcKey: "masa" } });
        expect(commandsOf(ctx, INN).find((command) => command.kind === "changeFriendship")).toMatchObject({ npcKey: "masa" });
      });

      it("없는 아이템 · 없는 엔딩 · 빈 호출은 거절하고 아무것도 바꾸지 않는다", () => {
        const ctx = starter();
        const before = JSON.stringify(ctx.project);
        const bad = [
          runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, gifts: [{ itemId: "없는 물건", gain: 2 }] }),
          runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN }),
          runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, talkGain: 1, confess: { atLeast: 3, endingId: "ending_nope" } }),
          runTool(ctx, "set_npc_affection", { mapId: V, eventId: "ev_nope", talkGain: 1 }),
        ];
        expect(bad.map((result) => result.ok)).toEqual([false, false, false, false]);
        // 고칠 길(먼저 부를 도구)이 글의 앞쪽에 있다 — 실행기가 200자에서 자른다. Break(첫 판): 아이템 목록 뒤에 적어 «upsert_item 으로 먼저 만들라»가 잘려 나갔다.
        expect(bad[0]!.summary).toContain("upsert_item");
        expect(bad[2]!.summary).toContain("define_ending");
        expect(JSON.stringify(ctx.project)).toBe(before);
      });
    });
    describe("set_present_reactions", () => {
      it("평소 말 뒤에 붙고, 다시 부르면 하나만 남는다 · 스위치를 등록한다", () => {
        const ctx = starter();
        const n = commandsOf(ctx, GUARD).length;
        expect(runTool(ctx, "set_present_reactions", { mapId: V, eventId: GUARD, reactions: [{ itemId: "낡은 열쇠", lines: ["a"], switchId: "sw_confessed" }], otherLines: ["b"] }).ok).toBe(true);
        expect(runTool(ctx, "set_present_reactions", { mapId: V, eventId: GUARD, reactions: [{ itemId: "item_old_key", lines: ["c"] }], otherLines: ["d"] }).ok).toBe(true);
        const commands = commandsOf(ctx, GUARD);
        expect(commands).toHaveLength(n + 3);
        expect(kinds(commands).slice(-3)).toEqual(["label:present:begin", "presentItem", "label:present:end"]);
        expect(ctx.project.switches.some((entry) => entry.id === "sw_confessed")).toBe(true);
      });

      it("없는 아이템은 거절하고 아무것도 바꾸지 않는다", () => {
        const ctx = starter();
        const before = JSON.stringify(ctx.project);
        expect(runTool(ctx, "set_present_reactions", { mapId: V, eventId: GUARD, reactions: [{ itemId: "없는 물건", lines: ["?"] }] }).ok).toBe(false);
        expect(JSON.stringify(ctx.project)).toBe(before);
      });
    });
    describe("set_time_limit", () => {
      it("다시 부르면 새로 짓는다(이벤트 둘 그대로) · 멈춤 스위치는 타이머를 세우는 페이지가 된다", () => {
        const ctx = starter();
        const n = ctx.project.maps[FIELD]!.events.length;
        expect(runTool(ctx, "set_time_limit", { mapId: FIELD, seconds: 30 }).ok).toBe(true);
        expect(runTool(ctx, "set_time_limit", { mapId: FIELD, seconds: 45, stopSwitchId: "sw_found_key" }).ok).toBe(true);
        const events = ctx.project.maps[FIELD]!.events;
        expect(events).toHaveLength(n + 2);
        const start = events.find((event) => event.id.endsWith("_start"))!, end = events.find((event) => event.id.endsWith("_end"))!;
        expect(start.pages![0]!.commands[0]).toMatchObject({ kind: "timer", action: "set", seconds: 45 });
        expect(end.pages).toHaveLength(2);
        expect(end.pages![1]!.commands[0]).toMatchObject({ kind: "timer", action: "stop" });
        // Break: 두 진행 이벤트가 같은 칸이거나 다른 이벤트 위에 서면 편집기에서 겹쳐 보이지 않는다.
        expect(`${start.x},${start.y}`).not.toBe(`${end.x},${end.y}`);
        expect(events.filter((event) => event.x === start.x && event.y === start.y)).toHaveLength(1);
      });

      it("없는 엔딩은 거절하고 아무것도 바꾸지 않는다", () => {
        const ctx = starter();
        const before = JSON.stringify(ctx.project);
        const result = runTool(ctx, "set_time_limit", { mapId: FIELD, seconds: 30, endingId: "ending_nope" });
        expect(result.ok).toBe(false);
        expect(result.summary).toContain("define_ending");
        expect(JSON.stringify(ctx.project)).toBe(before);
      });
    });
    describe("add_hud_gauge", () => {
      it("화면에 뜨던 HUD 는 그대로 두고 게이지 하나를 더한다 · 같은 이름으로 다시 부르면 그 게이지를 고친다", () => {
        const ctx = starter();
        const shown = resolvedHudWidgets(normalizeFieldHud(effectiveFieldHud(ctx.project) ?? ctx.project.system.fieldHud)).map((widget) => widget.id);
        expect(runTool(ctx, "add_hud_gauge", { label: "배고픔", initial: 100 }).ok).toBe(true);
        expect(runTool(ctx, "add_hud_gauge", { label: "배고픔", initial: 80, max: 120 }).ok).toBe(true);
        const widgets = ctx.project.system.fieldHud!.widgets!;
        // Break: widgets 를 [게이지] 로만 쓰면 프리셋 HUD(체력 · 시계 · 도구)가 통째로 사라진다.
        expect(shown.filter((id) => !widgets.some((widget) => widget.id === id))).toEqual([]);
        const gauges = widgets.filter((widget) => widget.source === "variable");
        expect(gauges).toHaveLength(1);
        expect(gauges[0]).toMatchObject({ label: "배고픔", max: 120 });
        expect(ctx.project.session.variables[gauges[0]!.variableId!]).toBe(80);
      });

      it("둘째 게이지는 같은 모서리의 첫째 아래에 놓인다", () => {
        const ctx = starter();
        runTool(ctx, "add_hud_gauge", { label: "배고픔", initial: 100 });
        expect(runTool(ctx, "add_hud_gauge", { label: "산소", initial: 50 }).ok).toBe(true);
        const [first, second] = ctx.project.system.fieldHud!.widgets!.filter((widget) => widget.source === "variable");
        expect(second!.anchor).toBe(first!.anchor);
        expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
      });
    });
  });
  describe("piGateToolChosenChips", () => {
    isolateTimers();
    /**
     * 조수 경로(createPiToolset + 칩 관문)에서만 보이는 거절 — runTool 만 부르는 시험에는 안 잡힌다.
     * 2026-11-12 셋째 묶음 Terra «후»(#4630 머리): 장치 도구가 닿자 그다음 겹이 드러났다.
     */
    function session(fixture: FixtureId, extra: Partial<ToolContext> = {}) {
      const ctx = { project: buildFixture(fixture), assistantRun: true, ...extra } as ToolContext;
      const tools = createPiToolset(ctx, { charsetGate: new PiCharsetSelectionGate() });
      const call = async (name: string, args: Record<string, unknown>) => {
        const out = await tools.find((tool) => tool.name === name)!.execute("call", args) as { content: Array<{ text: string }> };
        return JSON.parse(out.content[0]!.text) as { ok: boolean; summary: string; warnings?: string[]; data?: { rect?: { x: number; y: number; width: number; height: number } } };
      };
      return { ctx, call };
    }
    describe("칩 관문 — 도구·잠금이 스스로 고른 칩은 모델의 선택이 아니다", () => {
      it("configure_monster_system: 잠금이 출연진 칩을 갈아 끼워도 되돌리지 않는다", async () => {
        const { ctx, call } = session("blank", { monsterTurn: true });
        const hero = ctx.project.database.actors[0]!.characterResourceId;
        const result = await call("configure_monster_system", { enabled: true, capture: true });
        expect(result.ok).toBe(true);
        expect(ctx.project.system.monsterCollection).toBe(true);
        // 잠금이 실제로 칩을 바꿨어야 이 시험이 관문을 지나간 것이다.
        expect(ctx.project.database.actors[0]!.characterResourceId).not.toBe(hero);
      });

      it("place_trainer: 빈 프로젝트의 첫 호출(잠금이 걸리는 호출)에서 트레이너가 선다", async () => {
        const { ctx, call } = session("blank", { monsterTurn: true });
        const result = await call("place_trainer", { mapId: "map_blank_start", x: 6, y: 5, name: "트레이너", troopId: "troop_slime", facing: "right", sightRange: 4, before: "눈이 마주쳤네!", after: "멋진 배틀이었어!" });
        expect(result.ok).toBe(true);
        expect(ctx.project.system.genreLock?.preset).toBe("monster-collect");
        expect(Object.values(ctx.project.maps)[0]!.events.some((event) => event.id.startsWith("ev_trainer_"))).toBe(true);
      });

      it("place_storage_chest: 그림 인자가 없는 도구가 고른 상자 칩은 첫 호출에 선다", async () => {
        const { ctx, call } = session("starter");
        const result = await call("place_storage_chest", { mapId: "map_ember_village", x: 9, y: 12 });
        expect(result.ok).toBe(true);
        expect(ctx.project.maps.map_ember_village!.events.some((event) => event.id.startsWith("ev_storage_chest_"))).toBe(true);
      });

      it("모델이 직접 적은 안 본 칩은 여전히 되돌린다(관문은 풀지 않았다)", async () => {
        const { call } = session("starter");
        const page = { id: "ev_unseen_p0", conditions: [], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern: 79 }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] };
        await expect(call("upsert_event", { mapId: "map_ember_village", event: { id: "ev_unseen", name: "상자", x: 9, y: 12, pages: [page] } }))
          .rejects.toThrow(/list_npc_graphics/u);
      });
    });
    describe("stamp_object — 사람이 선 칸", () => {
      const args = { objectId: "kit:beodeul_city/bd-pick-fishing-port-lobster-pots", mapId: "map_ember_village", layers: "both" };
      const child = (ctx: ToolContext) => ctx.project.maps.map_ember_village!.events.find((event) => event.id === "ev_ember_child")!;
      const covers = (rect: { x: number; y: number; width: number; height: number }, at: { x: number; y: number }) =>
        at.x >= rect.x && at.x < rect.x + rect.width && at.y >= rect.y && at.y < rect.y + rect.height;

      it("nearest 는 사람을 비켜 찍고 그 사람을 옮기지 않는다", async () => {
        const { ctx, call } = session("starter");
        const at = { x: child(ctx).x, y: child(ctx).y };
        const result = await call("stamp_object", { ...args, ...at, onOverlap: "nearest" });
        expect(result.ok).toBe(true);
        expect(covers(result.data!.rect!, at)).toBe(false);
        expect({ x: child(ctx).x, y: child(ctx).y }).toEqual(at);
        expect(result.warnings?.join(" ")).toMatch(/was not moved/u);
      });

      it("기본(refuse)은 전과 같다 — 그 자리에 찍고 경고한다", async () => {
        const { ctx, call } = session("starter");
        const at = { x: child(ctx).x, y: child(ctx).y };
        const result = await call("stamp_object", { ...args, ...at });
        expect(result.ok).toBe(true);
        expect(covers(result.data!.rect!, at)).toBe(true);
      });
    });
  });
  // 쓰기 도구의 성공 결과가 모델에게 가는 모양 — 도구가 남긴 알림은 싣고, 변경 전부터 있던 프로젝트 검사 줄은 뺀다.
  // 2026-11-11 작은 일 둘째 묶음(Terra): 지어진 게임에서 upsert_item 을 다섯 번 불렀고 결과마다 다른 이벤트의 같은 경고 8줄뿐이었다 —
  // 「scope 가 ally 라 … 탈출 로프는 scope none 이 맞습니다」 같은 도구 자신의 알림은 한 줄도 가지 않았다.
  describe("piWriteResultForModel", () => {
    isolateTimers();
    const shown = (ctx: { project: ReturnType<typeof buildFixture> }, name: string, args: Record<string, unknown>) => {
      const before = ctx.project;
      const result = runTool(ctx, name, args);
      expect(result.ok, result.summary).toBe(true);
      const view = writeResultForModel(result, before, ctx.project);
      return { result, view, body: JSON.parse(formatPiToolSuccess(view)) as { warnings?: string[]; issues?: { code: string; message: string }[] } };
    };
    describe("writeResultForModel", () => {
      it("변경 전부터 있던 검사 줄은 싣지 않고, 도구의 알림은 싣는다", () => {
        const ctx = { project: buildFixture("built") };
        const { result, body } = shown(ctx, "upsert_item", { item: { id: "item_tea", name: "눈꽃 차", scope: "ally", price: 30, type: "medicine", escapeTo: "entrance", hpRecovery: { flat: 50, percentMax: 0 } } });
        // 러너 결과에는 프로젝트 전체 검사가 그대로 있다(다른 이벤트의 런타임 지원 경고).
        expect((result.issues ?? []).length).toBeGreaterThan(8);
        expect(body.issues ?? []).toEqual([]);
        expect(body.warnings?.some((w) => w.includes("scope"))).toBe(true);
      });

      it("이벤트를 옮겨도 그 이벤트의 옛 검사 줄이 새 줄로 나오지 않는다", () => {
        const ctx = { project: buildFixture("built") };
        const market = Object.values(ctx.project.maps).find((m) => m.name === "겨울 시장")!;
        const withWarnings = market.events.find((e) => e.name && !/gate/u.test(e.id))!;
        const { body } = shown(ctx, "move_event", { mapId: market.id, eventId: withWarnings.id, x: withWarnings.x + 1, y: withWarnings.y });
        expect((body.issues ?? []).filter((i) => i.code.startsWith("runtime-support"))).toEqual([]);
      });

      it("이번 변경이 새로 만든 줄은 남는다 — 알림과 겹치면 알림으로 한 번만", () => {
        const ctx = { project: buildFixture("built") };
        const hall = Object.values(ctx.project.maps).find((m) => m.name === "족장의 긴 집")!;
        const market = Object.values(ctx.project.maps).find((m) => m.name === "겨울 시장")!;
        const { result, body } = shown(ctx, "create_transfer_pair", { a: { mapId: hall.id, x: 10, y: 1 }, b: { mapId: market.id, x: 21, y: 13 } });
        const moved = (result.diff?.warnings ?? []).filter((w) => w.includes("자동 조정"));
        expect(moved.length).toBeGreaterThan(0);
        for (const note of moved) expect(body.warnings).toContain(note);
        // 장면 다듬기 줄은 알림(diff.warnings)과 issues 양쪽에 있었다 — 모델에게는 한 번만 간다.
        expect((body.issues ?? []).filter((i) => body.warnings!.includes(i.message))).toEqual([]);
      });

      it("같은 프로젝트에서 이어 부르면 앞 호출이 알린 줄을 되풀이하지 않는다", () => {
        const ctx = { project: buildFixture("built") };
        const hall = Object.values(ctx.project.maps).find((m) => m.name === "족장의 긴 집")!;
        const market = Object.values(ctx.project.maps).find((m) => m.name === "겨울 시장")!;
        const first = shown(ctx, "create_transfer_pair", { a: { mapId: hall.id, x: 10, y: 1 }, b: { mapId: market.id, x: 21, y: 13 } });
        const firstIssues = new Set((first.result.issues ?? []).map((i) => i.message));
        const second = shown(ctx, "upsert_item", { item: { id: "item_tea", name: "눈꽃 차", price: 30 } });
        expect((second.body.issues ?? []).filter((i) => firstIssues.has(i.message))).toEqual([]);
      });

      it("실패 결과와 알림 없는 결과는 그대로다", () => {
        const failed: ToolResult = { ok: false, summary: "x", issues: [{ severity: "error", code: "c", message: "m" }] };
        const project = buildFixture("blank");
        expect(writeResultForModel(failed, project, project)).toBe(failed);
        const plain: ToolResult = { ok: true, summary: "done" };
        expect(writeResultForModel(plain, project, project)).toEqual(plain);
      });
    });
  });
  // 참고문서 읽기 인정은 결과 글에 알림이 붙어도 된다(2026-11-11 작은 일 재측정: Terra 가 빈 칸을 채워 보내 인자 고침 알림 «Fixed: …» 이
  // 결과에 붙었고, 관문이 글 조각을 이어 붙여 JSON 으로 읽다 실패해 읽은 것을 영영 인정하지 않았다 — place_door 가 세 번 거절).
  describe("tilesetReferenceGateNotes", () => {
    isolateTimers();
    const NOTE = "Fixed: dropped empty/default optional fields: documentId, imageId";
    const SHAPES: Record<string, (json: string) => unknown> = {
      "결과 JSON 만": (json) => json,
      "뒤에 알림 조각": (json) => [{ type: "text", text: json }, { type: "text", text: NOTE }],
      "한 글 뒤에 알림 줄": (json) => `${json}\n${NOTE}`,
      "한 글 앞에 알림 줄": (json) => `[Fixed call: {kind:"say"} → {kind:"text", body}]\n${json}`,
    };
    async function readAll(shape: (json: string) => unknown) {
      const project = buildFixture("built");
      const gate = new PiTilesetReferenceGate();
      const ctx = { project };
      const outputs: unknown[] = [], images: string[] = [];
      let after: string[] = [];
      for (let i = 0; i < 12; i++) {
        const read = runTool(ctx, "read_tileset_reference", { tilesetId: "snow_north", categoryId: "sn-snow-north", ...(after.length ? { after } : {}) });
        expect(read.ok, read.summary).toBe(true);
        for (const image of await gate.read(project, read)) images.push(image.dataUrl);
        outputs.push(shape(JSON.stringify({ ok: read.ok, summary: read.summary, data: read.data })));
        if (!/남은 쪽/u.test(read.summary)) break;
        after = (read.data as { after: string[] }).after;
      }
      const hall = Object.values(project.maps).find((m) => m?.name === "족장의 긴 집")!;
      const door = { mapId: hall.id, at: { x: 7, y: 2 }, material: "벽 통로", referencePurpose: "sn-snow-north" };
      return { project, gate, outputs, images, door };
    }
    describe("참고문서 관문 — 읽은 것 인정", () => {
      it.each(Object.keys(SHAPES))("%s: 끝까지 읽고 그림을 받았으면 배치를 막지 않는다", async (name) => {
        const { project, gate, outputs, images, door } = await readAll(SHAPES[name]!);
        expect(gate.beforeWrite(project, "place_door", door)?.ok).toBe(false);
        gate.payload({ input: [...outputs.map((output) => ({ type: "function_call_output", output })), { role: "user", content: images.map((url) => ({ type: "input_image", image_url: url })) }] });
        gate.complete(true);
        expect(gate.beforeWrite(project, "place_door", door)).toBeNull();
      }, 60_000);

      it("잘린 결과·실패한 응답은 여전히 읽은 것이 아니다", async () => {
        const { project, gate, outputs, images, door } = await readAll(SHAPES["결과 JSON 만"]!);
        const cut = (outputs as string[]).map((json) => JSON.stringify({ ...(JSON.parse(json) as object), dataTruncated: true }));
        gate.payload({ input: [...cut.map((output) => ({ type: "function_call_output", output })), { role: "user", content: images.map((url) => ({ type: "input_image", image_url: url })) }] });
        gate.complete(true);
        expect(gate.beforeWrite(project, "place_door", door)?.ok).toBe(false);
        gate.payload({ input: outputs.map((output) => ({ type: "function_call_output", output })) });
        gate.complete(false);
        expect(gate.beforeWrite(project, "place_door", door)?.ok).toBe(false);
      }, 60_000);
    });
  });
});

describe("aiV2VisibleHiding", () => {
  isolateTimers();
  const task = "학교 공포 게임 만들어 줘. 사물함에 숨을 수 있게.";
  const withHiding = (graphic: Record<string, unknown>): Project => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.events = [{ id: "hide", x: 2, y: 2, pages: [{ id: "p", graphic, interaction: { kind: "hiding" }, movement: { type: "fixed" }, commands: [] }] } as never];
    return project;
  };
  describe("hiding spots must be visible (J81)", () => {
    it("a transparent hiding event on bare floor does not count as a hiding spot", () => {
      const project = withHiding({ transparent: true });
      expect(hidingSpots(project)[0]!.visible).toBe(false);
      expect(requestedFeatureGaps(project, task).map((b) => b.evidence.split(":")[0])).toEqual(["hiding"]);
    });
    it("a drawn hiding event counts", () => {
      const project = withHiding({ appearanceId: "locker" });
      expect(requestedFeatureGaps(project, task)).toEqual([]);
    });
  });
});

describe("aiV2VqaLighting", () => {
  isolateTimers();
  const setup = (ambient: number) => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.defaultLighting = { ambient, sources: [{ id: "torch", at: { x: 1, y: 1 }, radius: 1 }] };
    const tile = 4, w = map.width * tile, h = map.height * tile;
    const rgba = new Uint8Array(w * h * 4).fill(200);
    return { project, map, rgba, w, h, tile };
  };
  describe("VQA map shots carry game lighting (J79 rerun)", () => {
    it("darkens the map by ambient and leaves the light centre bright", () => {
      const { project, map, rgba, w, h, tile } = setup(0.88);
      const lit = applyMapLighting(rgba, w, h, map, project);
      expect(lit.applied).toBe(true);
      const at = (x: number, y: number) => rgba[(y * w + x) * 4]!;
      expect(at(w - 1, h - 1)).toBe(Math.round(200 * 0.12));
      expect(at(Math.floor(1.5 * tile), Math.floor(1.5 * tile))).toBeGreaterThan(150);
      expect(litShotNote(lit)).toContain("어둠 0.88");
    });
    it("does nothing without darkness", () => {
      const { project, map, rgba, w, h } = setup(0);
      expect(applyMapLighting(rgba, w, h, map, project).applied).toBe(false);
      expect(rgba[0]).toBe(200);
    });
  });
});

describe("aiV2VqaReviewerOrder", () => {
  isolateTimers();
  // 2026-11-12 측정(Haiku 5.5 high 실행, GPT 할당량 없음 · Gemini CLI 는 그림을 못 봄): 다른 계열 검수자가 모두 답하지 못하자 Haiku 가 제 화면을 검수했다.
  // 같은 계열의 검수용 모델(Sonnet)은 후보에 없었다. 지은 모델이 제 화면을 보는 것은 맨 마지막이어야 한다.
  const order = (main: { provider: string; model: string }, keyed: string[] = [main.provider]) =>
    vqaReviewerCandidates({ main, keyed: new Set(keyed), familyOf: (id) => familyOfProviderId(id, [main.model]) }).map((p) => `${p.provider}/${p.model}${p.sameAsMain ? " (같은 계열)" : ""}`);
  // 2026-11-16 실모델 확인 r7a(Opus 5.5 medium 실행, N6): 다른 계열이 답하지 못한 뒤의 Claude 검수자가 Sonnet 으로 박혀 있어 화면 검수 7번이 Sonnet 으로 갔다.
  // 오너 결정 2026-11-23 「조수는 sonnet 5.5 high 만」 — Claude 검수자는 Sonnet 5.5 · high 이다. Sonnet 으로 지으면 지은 모델과 검수 모델이 같다(«같은 계열 검수», 약한 증거).
  const picks = (main: { provider: string; model: string }) =>
    vqaReviewerCandidates({ main, keyed: new Set([main.provider]), familyOf: (id) => familyOfProviderId(id, [main.model]) });
  describe("화면 검수자 차례 — 자기 자신은 맨 마지막 · 미사용 Claude CLI 몰래 호출 금지", () => {
    it("Haiku 가 지으면: 다른 계열(Codex Sol 6.2 high) → 같은 계열의 Sonnet 5.5 → Haiku 자신", () => {
      expect(order({ provider: "local-cli:claude", model: "claude-haiku-5-5" })).toEqual([
        "local-cli:codex/gpt-6.2-sol",
        "local-cli:claude/claude-sonnet-5-5 (같은 계열)", "local-cli:claude/claude-haiku-5-5 (같은 계열)",
      ]);
    });

    it("Sonnet 5.5 가 지으면(Claude 기본): 다른 계열(Codex) → Sonnet 5.5 · high 한 번 — Opus 로 가지 않고, 같은 모델을 두 번 넣지 않는다", () => {
      expect(order({ provider: "local-cli:claude", model: "claude-sonnet-5-5" })).toEqual([
        "local-cli:codex/gpt-6.2-sol", "local-cli:claude/claude-sonnet-5-5 (같은 계열)",
      ]);
      const claude = picks({ provider: "local-cli:claude", model: "claude-sonnet-5-5" }).filter((p) => p.provider === "local-cli:claude");
      expect(claude).toEqual([{ provider: "local-cli:claude", model: "claude-sonnet-5-5", effort: "high", sameAsMain: true }]);
    });

    it("Opus 가 지으면(사람이 고름): 같은 계열의 Sonnet 5.5 가 먼저, Opus 자신은 맨 끝", () => {
      const got = order({ provider: "local-cli:claude", model: "claude-opus-5-5" });
      expect(got.filter((p) => p.startsWith("local-cli:claude/"))).toEqual(["local-cli:claude/claude-sonnet-5-5 (같은 계열)", "local-cli:claude/claude-opus-5-5 (같은 계열)"]);
    });

    it("GPT-6.2 Sol 이 지으면(2026-11-28 기본): Claude/Gemini CLI 가 연결되지 않았으면 몰래 호출하지 않고 Sol 6.2 high 만 쓴다", () => {
      const got = order({ provider: "openai-codex", model: "gpt-6.2-sol" });
      expect(got).toEqual(["local-cli:codex/gpt-6.2-sol (같은 계열)", "openai-codex/gpt-6.2-sol (같은 계열)"]);
      expect(picks({ provider: "openai-codex", model: "gpt-6.2-sol" })[0]).toMatchObject({ model: "gpt-6.2-sol", effort: "high", sameAsMain: true });
      const withClaude = order({ provider: "openai-codex", model: "gpt-6.2-sol" }, ["openai-codex", "local-cli:claude"]);
      expect(withClaude[0]).toBe("local-cli:claude/claude-sonnet-5-5");
    });

    it("다른 계열 후보에는 «같은 계열» 표시가 붙지 않고, 같은 계열 후보에는 늘 붙는다", () => {
      const picks = vqaReviewerCandidates({ main: { provider: "local-cli:claude", model: "claude-haiku-5-5" }, keyed: new Set(["local-cli:claude"]), familyOf: (id) => familyOfProviderId(id) });
      for (const p of picks) expect(p.sameAsMain).toBe(familyOfProviderId(p.provider) === "claude");
    });
  });
});

describe("aiV2WeakPuzzles", () => {
  isolateTimers();
  // 판정 J63: 정답이 첫 보기, 1024·1234·0000 같은 번호.
  function lockProject(commands: unknown[]): Project {
    return { maps: { m: { id: "m", name: "서재", width: 5, height: 5, events: [{ id: "ev_safe", name: "금고", x: 1, y: 1, pages: [{ conditions: [], trigger: { kind: "action" }, commands }] }] } } } as unknown as Project;
  }
  describe("weak puzzle locks (J63)", () => {
    it("treats repeated, sequential and common codes as trivial", () => {
      for (const c of ["1024", "1234", "0000", "4321", "1111"]) expect(trivialCode(c)).toBe(true);
      for (const c of ["3817", "0917", "12"]) expect(trivialCode(c)).toBe(false);
    });
    it("never puts the answer first and keeps it among the five shown options", () => {
      for (const seed of ["a", "b", "chain:0", "chain:1", "x:9"]) {
        const out = shuffledOptions(["정답", "가", "나", "다", "라", "마", "바"], "정답", seed);
        expect(out.length).toBe(5);
        expect(out.indexOf("정답")).toBeGreaterThan(0);
      }
    });
    it("flags a trivial number code and a correct-first choice, passes a fair lock", () => {
      const num = (value: number) => lockProject([{ kind: "inputNumber", variableId: "v", digits: 4 }, { kind: "fork", condition: { kind: "variable", variableId: "v", op: "==", value }, then: [{ kind: "setSwitch", switchId: "s", value: true }], else: [] }]);
      expect(weakPuzzleLocks(num(1024))).toHaveLength(1);
      expect(weakPuzzleLocks(num(3817))).toEqual([]);
      const choice = (answerAt: number) => lockProject([{ kind: "choices", options: ["봄", "여름", "가을"].map((text, i) => ({ text, branch: i === answerAt ? [{ kind: "setSwitch", switchId: "s", value: true }] : [{ kind: "showText", text: "아니다" }] })) }]);
      expect(weakPuzzleLocks(choice(0))).toHaveLength(1);
      expect(weakPuzzleLocks(choice(2))).toEqual([]);
    });
  });
});
