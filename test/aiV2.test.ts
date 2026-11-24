import { describe, expect, it, afterEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project, GameEvent } from "@/project/types";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { PlaceBuildResult } from "@/ai/v2/shared/types";
import { keepRelaidMapId, keptMapId, keptPlaceResult, renameIdIn, renameMapId } from "@/ai/v2/place/keepMapId";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { PLACE_SPEC_INDEX, placeSpecCards, placeSpecKindOf } from "@/ai/v2/prompt/placeSpecs";
import { editOnlyRequest } from "@/ai/v2/request/readers";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { INTERIOR_CARD } from "@/ai/v2/place/builders/interior";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { oversizedSprites } from "@/ai/v2/judge/lookChecks";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { findingLine } from "@/ai/v2/judge/finding";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { evidenceOnThing } from "@/ai/v2/story/mysteryEvidencePlaces";
import { explainRemainingClues, pendingClueChain } from "@/ai/v2/story/mysteryClues";
import type { ToolContext } from "@/editor/tools/types";
import { fitFirstLevelUp } from "@/ai/v2/story/pathBattleBudget";
import { totalExpForLevel } from "@/project/actorModel";
import assert from "node:assert/strict";
import { isolateTimers } from "./mergedTeardown";

// 다시 지은 장소가 옛 맵 id 를 지킨다(src/ai/v2/place/keepMapId.ts).
// 왜(2026-11-11 lay-tools 농장·항구): 마을 빌더가 집 보호를 피해 `<id>_r2` 로 다시 짓고 옛 맵을 지워, 할 일 묶음이 없는 맵을 가리키고 검수자가 «시작 맵이 지워졌다» 로 읽었다.
describe("aiV2KeepMapId", () => {
  isolateTimers();
  /** 옛 맵을 지우고 `<id>_r2` 로 다시 지은 뒤의 프로젝트 — 시작 맵과 다른 맵의 이동 명령이 새 id 를 가리킨다. */
  function relaidProject(): { project: Project; from: string; to: string } {
    const base = createBlankProject();
    const to = base.startMapId, from = `${to}_r2`;
    const village = { ...base.maps[to]!, id: from, name: "농장" };
    const other = { ...base.maps[to]!, id: "map_other", name: "들판", events: [{ id: "ev_door", name: "문", x: 1, y: 1, pages: [{ commands: [{ kind: "transfer", mapId: from, x: 3, y: 4 }] }] }] };
    const project = { ...base, startMapId: from, maps: { [from]: village, map_other: other } } as unknown as Project;
    return { project, from, to };
  }
  const result = (from: string, to: string): PlaceBuildResult => ({
    ok: true, mapIds: [from], entrance: { mapId: from, x: 3, y: 4 }, summary: "농장", missingArt: [], calls: [], relaidFrom: to,
    warnings: [`완성된 집 보호로 「${to}」 맵을 덮어 지을 수 없어 새 맵 ${from} 로 다시 짓고 옛 맵을 지웠다 — 이 마을의 mapId 는 이제 ${from} 다.`, "집 3채"],
  });
  const envOf = (project: Project, checkpoint: (label: string) => Promise<void>) => {
    const env = { ctx: { project }, checkpoint } as unknown as PiAssistantV2Env;
    return env;
  };
  describe("renameIdIn · renameMapId", () => {
    it("바뀐 것이 없는 가지는 같은 객체를 돌려준다", () => {
      const leaf = { a: [1, 2, 3], b: "x" };
      const tree = { keep: leaf, hit: { id: "old" } };
      const out = renameIdIn(tree, "old", "new");
      expect(out.keep).toBe(leaf);
      expect(out.hit).toEqual({ id: "new" });
      expect(renameIdIn(leaf, "old", "new")).toBe(leaf);
    });
    it("맵 사전의 키 · 맵 id · 시작 맵 · 다른 맵의 이동 명령을 같이 바꾸고, 타일셋·자산은 그대로 가리킨다", () => {
      const { project, from, to } = relaidProject();
      const renamed = renameMapId(project, from, to)!;
      expect(Object.keys(renamed.maps)).toEqual([to, "map_other"]);
      expect(renamed.maps[to]!.id).toBe(to);
      expect(renamed.maps[to]!.name).toBe("농장");
      expect(renamed.startMapId).toBe(to);
      expect(JSON.stringify(renamed.maps.map_other)).toContain(`"mapId":"${to}"`);
      expect(JSON.stringify(renamed)).not.toContain(from);
      expect(renamed.tilesets).toBe(project.tilesets);
      expect(renamed.assets).toBe(project.assets);
      // 원본은 그대로다.
      expect(project.startMapId).toBe(from);
    });
    it("없는 맵이거나 그 id 를 다른 맵이 쓰면 바꾸지 않는다", () => {
      const { project, from } = relaidProject();
      expect(renameMapId(project, "map_none", "map_x")).toBeUndefined();
      expect(renameMapId(project, from, "map_other")).toBeUndefined();
      expect(renameMapId(project, from, from)).toBeUndefined();
    });
  });
  describe("keepRelaidMapId", () => {
    it("체크포인트가 받아들이면 옛 id 로 되돌리고, 결과·알림도 옛 id 를 말한다", async () => {
      const { project, from, to } = relaidProject();
      const labels: string[] = [];
      const env = envOf(project, async (label) => { labels.push(label); });
      const session = {};
      const built = result(from, to);
      const kept = await keepRelaidMapId(env, session, "edit_place", built);
      expect(labels).toEqual(["edit_place-keep-id"]);
      expect(Object.keys(env.ctx.project.maps)).toContain(to);
      expect(env.ctx.project.maps[from]).toBeUndefined();
      expect(env.ctx.project.startMapId).toBe(to);
      expect(kept.mapIds).toEqual([to]);
      expect(kept.entrance).toEqual({ mapId: to, x: 3, y: 4 });
      expect(kept.relaidFrom).toBeUndefined();
      expect(kept.warnings).toEqual(["집 3채", `Re-laid in place: the map id is still ${to}.`]);
      // 짓기 결과를 따로 든 부르는 쪽도 끝난 뒤의 id 를 읽는다.
      expect(keptMapId(session, from)).toBe(to);
      expect(keptPlaceResult(session, built).mapIds).toEqual([to]);
    });
    it("편집기가 거절하면(워커가 그 변경을 되돌린다) 새 id 그대로 간다", async () => {
      const { project, from, to } = relaidProject();
      const env = envOf(project, async () => { env.ctx.project = project; throw new Error("적용 실패(commit-rejected): 완성된 집"); });
      const session = {};
      const built = result(from, to);
      const kept = await keepRelaidMapId(env, session, "edit_place", built);
      expect(kept).toBe(built);
      expect(env.ctx.project.maps[from]).toBeDefined();
      expect(env.ctx.project.startMapId).toBe(from);
      expect(keptMapId(session, from)).toBe(from);
    });
    it("다시 지은 표시가 없거나 실패한 결과는 건드리지 않는다 — 체크포인트도 부르지 않는다", async () => {
      const { project, from, to } = relaidProject();
      let calls = 0;
      const env = envOf(project, async () => { calls++; });
      const plain: PlaceBuildResult = { ok: true, mapIds: [from], summary: "", warnings: [], missingArt: [], calls: [] };
      expect(await keepRelaidMapId(env, {}, "make_place", plain)).toBe(plain);
      const failed = { ...result(from, to), ok: false };
      expect(await keepRelaidMapId(env, {}, "make_place", failed)).toBe(failed);
      expect(calls).toBe(0);
      expect(env.ctx.project).toBe(project);
    });
  });
});

describe("aiV2LeanPrompt", () => {
  isolateTimers();
  const task = "이제 이 서재에 방탈출 규칙을 넣어 줘. 자물쇠에 4자리 비밀번호를 넣어.";
  afterEach(() => { delete process.env.OPRN_V2_LEAN_PROMPT; });
  /** 이미 지은 게임(이벤트가 있는 맵) — 빈 프로젝트는 첫 장소를 짓는 요청으로 본다. */
  function builtProject() {
    const project = createBlankProject();
    (project.maps[project.startMapId]!.events as unknown[]).push({ id: "ev_desk", name: "책상", x: 1, y: 1, pages: [] });
    return project;
  }
  describe("v2 lean prompt — place specs on demand", () => {
    it("keeps place-building cards out of the system prompt and lists them in one index line", () => {
      const project = builtProject();
      const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
      expect(sys).toContain(PLACE_SPEC_INDEX);
      expect(sys).not.toContain(INTERIOR_CARD);
      expect(sys).not.toContain("[Interior catalog");
    });
    it("place-building and whole-game requests keep the full cards; so does a bare description on an empty project", () => {
      const built = builtProject();
      expect(editOnlyRequest(built, task)).toBe(true);
      expect(editOnlyRequest(built, "마을에 대장간 하나 추가해 줘")).toBe(false);
      expect(editOnlyRequest(built, "새 맵에 동굴을 만들어 줘")).toBe(false);
      expect(editOnlyRequest(built, "방탈출 게임 하나 만들어 줘")).toBe(false);
      // 빈 프로젝트라도 시킨 일이 분명한 작은 요청은 작은 일이다(2026-11-11 B3). 묘사뿐인 글은 첫 장소를 짓는 시작으로 본다.
      expect(editOnlyRequest(createBlankProject(), task)).toBe(true);
      expect(editOnlyRequest(createBlankProject(), "폐업 직전 태엽 장난감 가게")).toBe(false);
      const sys = buildV2SystemPrompt(built, built.startMapId, "마을에 대장간 하나 추가해 줘").join("\n");
      expect(sys).toContain(INTERIOR_CARD);
      expect(sys).not.toContain(PLACE_SPEC_INDEX);
    });
    it("OPRN_V2_LEAN_PROMPT=0 restores the full cards", () => {
      process.env.OPRN_V2_LEAN_PROMPT = "0";
      const project = builtProject();
      const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
      expect(sys).toContain(INTERIOR_CARD);
      expect(sys).not.toContain(PLACE_SPEC_INDEX);
    });
    it("maps place types to spec kinds and gives the interior card with its chipset catalog", () => {
      expect(placeSpecKindOf("cave")).toBe("dungeon");
      expect(placeSpecKindOf("house")).toBe("street");
      expect(placeSpecKindOf(undefined)).toBeUndefined();
      const project = createBlankProject();
      const cards = placeSpecCards("interior", project, project.startMapId, task);
      expect(cards[0]).toBe(INTERIOR_CARD);
      expect(cards[1]).toContain("[Interior catalog");
    });
    it("edit-only requests load place-building verbs on demand", () => {
      const project = builtProject();
      const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
        emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, lazyToolsVia: "call_tool" } as never;
      const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
      const listed = exposure.tools.map((t) => t.name);
      expect(listed).not.toContain("make_place");
      expect(listed).not.toContain("edit_place");
      expect(listed).toContain("add_people");
      expect(listed).toContain("load_tools");
      expect(exposure.lazy.has("make_place")).toBe(true);
      expect(exposure.offered).toContain("edit_place");
    });
    it("the first build call of a kind in a conversation returns its spec instead of building, then builds", async () => {
      const project = builtProject();
      let epoch = 0;
      const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
        emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => epoch } as never;
      const tools = createV2Tools(env, new V2Session());
      const addPeople = tools.find((t) => t.name === "add_people")!;
      const first = await addPeople.execute("a", { people: [{ role: "guard" }] } as never, undefined as never);
      const head = JSON.parse((first.content[0] as { text: string }).text);
      expect(head).toMatchObject({ ok: false, notFailure: true });
      expect((first.content[1] as { text: string }).text).toContain("People spec");
      const second = await addPeople.execute("b", { people: [{ role: "guard" }] } as never, undefined as never);
      expect(JSON.parse((second.content[0] as { text: string }).text).notFailure).toBeUndefined();
      epoch = 1; // conversation was cleared → the spec is given again
      const third = await addPeople.execute("c", { people: [{ role: "guard" }] } as never, undefined as never);
      expect(JSON.parse((third.content[0] as { text: string }).text)).toMatchObject({ notFailure: true });
    });
  });
});

describe("aiV2LookChecks", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const oversizedLines = (...args: Parameters<typeof oversizedSprites>): string[] => oversizedSprites(...args).map(findingLine);
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  function withEvent(project: Project, event: Partial<GameEvent> & { id: string }, scale?: number): Project {
    const p = structuredClone(project);
    const map = Object.values(p.maps)[0]!;
    map.events = [...(map.events ?? []), {
      x: 3, y: 3, trigger: "action", ...event,
      pages: [{ id: "p1", name: "", conditions: [], trigger: "action", priority: "same", commands: [],
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster5" }, direction: "down", pattern: 28, ...(scale !== undefined ? { scale, scaleMode: "auto" as const } : {}) } }],
    } as unknown as GameEvent];
    return p;
  }
  describe("v2 look checks: oversized sprites (J23)", () => {
    const before = createBlankProject() as Project;

    it("flags a non-boss charset drawn 2x next to the party", () => {
      const after = withEvent(before, { id: "ev_cave_guardian", name: "석상 수호병" }, 2);
      const problems = oversizedLines(before, after);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("석상 수호병");
      expect(problems[0]).toContain("2.0배");
      // 끝맺음 관문(게임 검사)에도 올라간다.
      expect(gameLines(before, after, "동굴에 수문장을 둬 줘").some((p) => p.includes("[게임 검사 크기]"))).toBe(true);
    });

    it("leaves bosses and party-size sprites alone", () => {
      expect(oversizedLines(before, withEvent(before, { id: "ev_floor2_boss", name: "붉은 용" }, 2.5))).toEqual([]);
      expect(oversizedLines(before, withEvent(before, { id: "ev_x", name: "마왕" }, 2.5))).toEqual([]);
      expect(oversizedLines(before, withEvent(before, { id: "ev_npc", name: "병정" }))).toEqual([]);
      expect(oversizedLines(before, withEvent(before, { id: "ev_npc", name: "병정" }, 1.25))).toEqual([]);
    });

    it("only looks at events this run created or changed", () => {
      const already = withEvent(before, { id: "ev_old_statue", name: "거대 석상" }, 2);
      expect(oversizedLines(already, already)).toEqual([]);
    });
  });
});

describe("aiV2MysteryEvidence", () => {
  isolateTimers();
  // 2026-11-12 Terra 측정 r1-mystery(눈가림 판정: 엔딩 못 봄). 판정자는 사슬의 단서 다섯을 다 모았는데 「최후의 지목」이
  // «남은 단서 1개는 「서진의 해명」» 을 서른네 번 되풀이했다 — 실제로 없던 것은 지목 페이지가 요구하는 증거 아이템 『사건 의뢰』였다.
  // 그 증거는 첫 단계 「서진」이 말로 주는 것(청사진 gives)인데 다른 맵 건물 앞 바닥 칸이 됐고, 서진은 그 자리를 처음 한 번만 말했다.
  // 재는 법(모델 없음): 저장된 판을 판정자가 누른 차례로 눌러 보는 탐침(~/z-project/assistant-fable-runs/genre-tools/mystery/judgePath.mts)과 같은 함수 호출.
  // 문서 openwiki/assistant-v2.md 「추리 — 지목이 안 열리는 까닭을 말한다」.

  const person = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 1 };
  const base = { trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 } };
  const hidden = { transparent: true };
  /** 사람 「서진」(말하고 증거를 준다) → 「멈춘 시계」 → 「최후의 지목」(시계 단서 + 증거 아이템이 있어야 열린다). gives = 청사진 첫 단계가 준다고 적은 것. */
  function game(evidence: string, gives: string) {
    const project = createBlankProject();
    const place = project.maps[project.startMapId]!.name;
    project.database.items.push({ id: "item_ev", name: evidence, description: "[증거]", price: 0, consumable: false } as never);
    project.gameBlueprint = { version: 1, title: "시험 사건", genre: "추리", playerGoal: "범인을 찾는다", request: "추리 게임", updatedAt: "", ending: { name: "사건 해결", how: "지목", feeling: "후련" }, steps: [
      { id: "s1", kind: "talk", who: "서진", place, event: "서진", action: "집사에게 듣는다", needs: "", gives, feeling: "" },
      { id: "s2", kind: "find", place, event: "멈춘 시계", action: "시계를 본다", needs: gives, gives: "시계 단서", feeling: "" },
      { id: "s3", kind: "choice", place, event: "최후의 지목", action: "범인을 지목한다", needs: "시계 단서", gives: "사건 해결", feeling: "" },
    ] } as never;
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const run = createBuildRun(ctx);
    const put = (event: Record<string, unknown>) => expect(run.call("upsert_event", { mapId: project.startMapId, event }).ok).toBe(true);
    put({ id: "ev_seojin", name: "서진", x: 4, y: 4, pages: [
      { ...base, id: "p0", conditions: [], graphic: person, commands: [{ kind: "text", speaker: "서진", body: "주인님이 돌아가셨습니다." }, { kind: "setSwitch", switchId: "sw_0001", value: true }, { kind: "changeItem", itemId: "item_ev", op: "+=", amount: 1 }, { kind: "text", body: `『${evidence}』을 증거로 챙겼다.` }, { kind: "setSwitch", switchId: "sw_0002", value: true }] },
      { ...base, id: "p1", conditions: [{ kind: "switch", switchId: "sw_0002", value: true }], graphic: person, commands: [{ kind: "text", body: "(다시 묻는다.)" }, { kind: "text", speaker: "서진", body: "주인님이 돌아가셨습니다." }] },
    ] });
    put({ id: "ev_clock", name: "멈춘 시계", x: 8, y: 4, pages: [
      { ...base, id: "p0", conditions: [], graphic: hidden, commands: [{ kind: "text", body: "먼저 서진의 이야기를 듣자." }] },
      { ...base, id: "p1", conditions: [{ kind: "switch", switchId: "sw_0001", value: true }], graphic: hidden, commands: [{ kind: "text", body: "(시계는 9시 12분에 멈춰 있다.)" }, { kind: "setSwitch", switchId: "sw_0003", value: true }] },
    ] });
    put({ id: "ev_accuse", name: "최후의 지목", x: 12, y: 4, pages: [
      { ...base, id: "p0", conditions: [], graphic: hidden, commands: [{ kind: "text", body: "아직 단서가 모자라다." }] },
      { ...base, id: "p1", conditions: [{ kind: "switch", switchId: "sw_0003", value: true }, { kind: "item", itemId: "item_ev", present: true }], graphic: hidden, commands: [{ kind: "presentItem", prompt: "증거는?", options: [{ itemId: "item_ev", branch: [{ kind: "text", body: "범인은 당신이다." }, { kind: "gameOver" }] }], otherwiseBranch: [], cancelBranch: [] }] },
    ] });
    return { ctx, run };
  }
  const eventOf = (project: Project, id: string): GameEvent | undefined => project.maps[project.startMapId]!.events.find((event) => event.id === id);
  const textOf = (event: GameEvent | undefined): string => JSON.stringify(event?.pages ?? []);
  describe("추리 증거 — 말로 건네는 것과 바닥에 떨어진 것", () => {
    it("청사진의 말하는 단계가 준다고 적은 그대로의 증거는 그 말이 건넨다(바닥 칸을 만들지 않는다)", () => {
      const { ctx, run } = game("사건 의뢰", "사건 의뢰");
      expect(evidenceOnThing(run)).toEqual([]);
      expect(eventOf(ctx.project, "ev_seojin_evidence")).toBeUndefined();
      expect(textOf(eventOf(ctx.project, "ev_seojin"))).toContain('"changeItem"');
    });

    it("세우기가 지어낸 물건은 바닥 칸으로 가고, 다시 물어도(못 주운 동안) 자리를 일러 준다", () => {
      const { ctx, run } = game("떨어진 은단추", "수사 시작");
      expect(evidenceOnThing(run)).toHaveLength(1);
      const giver = eventOf(ctx.project, "ev_seojin")!;
      expect(eventOf(ctx.project, "ev_seojin_evidence")).toBeDefined();
      expect(textOf(giver)).not.toContain('"changeItem"');
      const pages = giver.pages!;
      expect(JSON.stringify(pages[0]!.commands)).toMatch(/반짝이던데/u);
      const again = pages[1]!.commands.at(-1) as unknown as { kind: string; condition: { kind: string; itemId: string; present: boolean }; then: Array<{ body: string }> };
      expect(again.kind).toBe("fork");
      expect(again.condition).toEqual({ kind: "item", itemId: "item_ev", present: false });
      expect(again.then[0]!.body).toMatch(/ 바닥을 살펴보게\./u);
      // 되풀이 안전.
      expect(evidenceOnThing(run)).toEqual([]);
    });

    it("조사 칸·문 표시가 가로로 늘어선 줄에는 증거 칸을 놓지 않는다", () => {
      const plain = game("떨어진 은단추", "수사 시작");
      evidenceOnThing(plain.run);
      // 표시가 없으면 사람 둘레에서 가장 위 칸(같은 줄 y=2)에 놓인다 — 그 줄에 문 표시를 세우면 비켜 간다.
      expect(eventOf(plain.ctx.project, "ev_seojin_evidence")!.y).toBe(2);
      const { ctx, run } = game("떨어진 은단추", "수사 시작");
      for (const x of [2, 6]) expect(run.call("upsert_event", { mapId: ctx.project.startMapId, event: { id: `ev_door_${x}`, name: "들어갈 수 없는 입구", x, y: 2, pages: [{ ...base, id: "p0", conditions: [], graphic: hidden, commands: [{ kind: "text", body: "문이 잠겨 있다." }] }] } }).ok).toBe(true);
      evidenceOnThing(run);
      expect(eventOf(ctx.project, "ev_seojin_evidence")!.y).not.toBe(2);
    });

    it("이미 바닥 칸이 된 말 증거(저장된 판)는 되돌린다 — 칸과 귀띔을 걷고 그 말이 다시 건넨다", () => {
      const { ctx, run } = game("떨어진 은단추", "수사 시작");
      evidenceOnThing(run);
      const bp = ctx.project.gameBlueprint!;
      ctx.project = { ...ctx.project, gameBlueprint: { ...bp, steps: bp.steps.map((step, i) => (i === 0 ? { ...step, gives: "떨어진 은단추" } : step)) } };
      expect(evidenceOnThing(run)).toHaveLength(1);
      expect(eventOf(ctx.project, "ev_seojin_evidence")).toBeUndefined();
      const giver = textOf(eventOf(ctx.project, "ev_seojin"));
      expect(giver).toContain('"changeItem"');
      expect(giver).not.toMatch(/바닥/u);
    });
  });
  describe("추리 — 지목이 안 열리는 까닭을 말한다", () => {
    it("사슬을 다 마쳤는데 증거 아이템이 없으면 그 증거와 얻는 곳을 말한다(하나 앞 단서를 되풀이하지 않는다)", () => {
      const { ctx, run } = game("떨어진 은단추", "수사 시작");
      evidenceOnThing(run);
      explainRemainingClues(run);
      const accuse = eventOf(ctx.project, "ev_accuse")!;
      const pages = accuse.pages!;
      const names = pages.map((page) => (page as { name?: string }).name ?? page.id);
      // 남은 단서 페이지들 → 증거 페이지 → 지목 페이지. 뒤 페이지가 먼저 맞으므로 증거가 있으면 지목이 열린다.
      expect(names.indexOf("남은 단서 · 증거")).toBe(names.length - 2);
      const lack = pages.find((page) => (page as { name?: string }).name === "남은 단서 · 증거")!;
      expect(lack.conditions).toEqual([{ kind: "switch", switchId: "sw_0003", value: true }]);
      expect(JSON.stringify(lack.commands)).toMatch(/"itemId":"item_ev","present":false/u);
      expect(JSON.stringify(lack.commands)).toMatch(/『떨어진 은단추』.*「서진」이 일러 준 .*바닥을 살펴보자/u);
      const before = textOf(accuse);
      explainRemainingClues(run);
      expect(textOf(eventOf(ctx.project, "ev_accuse"))).toBe(before);
    });

    it("목표 사슬: 증거 칸을 안 주웠으면 그 칸을, 단서를 다 마쳤으면 어느 페이지에서든 지목을 가리킨다", () => {
      const { ctx, run } = game("떨어진 은단추", "수사 시작");
      evidenceOnThing(run);
      const chain = JSON.stringify(pendingClueChain(ctx.project, ctx.project.startMapId, { kind: "text", body: "이 페이지가 원래 걸던 다음 단계" }));
      expect(chain).toContain('"itemId":"item_ev","present":false');
      expect(chain).toMatch(/아직 못 찾은 단서가 있다\. 「서진」이 일러 준 곳에서/u);
      expect(chain).toContain("「최후의 지목」을 찾아가자");
      expect(chain).not.toContain("이 페이지가 원래 걸던 다음 단계");
    });
  });
});

describe("aiV2PathLevels", () => {
  isolateTimers();
  // 2026-11-11 눈가림 플레이(fun-x1-gatefix): «EXP 677 을 얻어도 L1» — 기본 곡선은 Lv2 까지 678 인데 첫 길 전투가 108 이라(108/678 < 1/5) 곡선 맞추기가 손을 뗐다.
  // 문서 openwiki/assistant-v2.md 「짧은 게임에서도 레벨이 오른다」.

  describe("짧은 게임에서도 레벨이 오른다", () => {
    it("길 위 경험치를 알면 첫 전투 경험치가 작아도 곡선을 맞춘다(길을 다 이겨도 8레벨까지)", () => {
      const project = createBlankProject() as Project;
      const hero = project.database.actors[0]!;
      project.system.startActorIds = [hero.id];
      const troop = project.database.troops.find((t) => t.id === "troop_slime")!;
      const enemy = project.database.enemies.find((e) => e.id === troop.enemyIds[0])!;
      enemy.rewards = { ...enemy.rewards, exp: 108 };
      // 길 위 경험치를 모르는 호출은 그 전투 하나를 길로 본다 — 108/678 < 1/5 라 손을 떼던 자리.
      expect(fitFirstLevelUp(structuredClone(project), troop.id, { ids: [hero.id], level: 1 })).toHaveLength(1);
      expect(fitFirstLevelUp(project, troop.id, { ids: [hero.id], level: 1 }, 785)).toHaveLength(1);
      const curve = hero.expCurve!;
      expect(totalExpForLevel(curve, 2)).toBeLessThanOrEqual(108);
      expect(totalExpForLevel(curve, 3)).toBeLessThanOrEqual(785);
      expect(totalExpForLevel(curve, 10)).toBeGreaterThan(785);
    });
  });
});

describe("aiV2PeopleShop", () => {
  isolateTimers();
  // 2026-11-11 구조 재점검 5-1: 상점 주인 한 명에 호출 4~6번이 들었다(add_people 에 상점 칸이 없고 상점 도구는 뒤로 밀려 있었다).
  async function addPeople(people: unknown[]) {
    const project = createBlankProject();
    const task = "이 맵에 상점 주인 한 명 세워 줘";
    const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
      emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as unknown as PiAssistantV2Env;
    const tool = createV2Tools(env, new V2Session()).find((entry) => entry.name === "add_people");
    assert(tool);
    const res = await tool.execute("call-1", { people } as never, undefined as never);
    const text = (res.content as { type: string; text?: string }[]).find((part) => part.type === "text")?.text ?? "{}";
    return { project: env.ctx.project, result: JSON.parse(text) as { ok: boolean; summary: string; warnings?: string[] } };
  }
  describe("add_people sells — 상점 주인을 한 번에", () => {
    it("있는 아이템은 이름으로 찾아 대사 뒤에 사고파는 상점을 단다", async () => {
      const { project, result } = await addPeople([{ role: "상인", name: "잡화점 주인 보리", where: "광장", firstTalk: ["어서 오세요!"], sells: [{ item: "회복약" }, { item: "해독초", price: 30 }] }]);
      assert(result.ok, result.summary);
      const keeper = project.maps[project.startMapId]!.events.find((event) => event.name === "잡화점 주인 보리");
      assert(keeper?.pages?.length);
      const kinds = keeper.pages[0]!.commands.map((command) => command.kind);
      expect(kinds.indexOf("shop")).toBeGreaterThan(kinds.indexOf("text"));
      const shop = keeper.pages[0]!.commands.find((command) => command.kind === "shop") as { stock: { itemId: string; priceOverride?: number }[]; allowSell: boolean };
      expect(shop.allowSell).toBe(true);
      expect(shop.stock).toEqual([{ itemId: "item_potion" }, { itemId: "item_antidote", priceOverride: 30 }]);
    });

    it("없는 이름은 값만 있는 잡화로 만들고 그 사실을 알린다", async () => {
      const { project, result } = await addPeople([{ role: "상인", name: "지도 장수", sells: [{ item: "마을 지도", price: 15 }] }]);
      assert(result.ok, result.summary);
      const made = project.database.items.find((item) => item.name === "마을 지도");
      expect(made).toMatchObject({ price: 15 });
      expect((result.warnings ?? []).join("\n")).toContain("new plain items were created");
    });

    it("sells 가 없으면 상점을 달지 않는다", async () => {
      const { project, result } = await addPeople([{ role: "촌장", name: "촌장 하르", firstTalk: ["어서 오게."] }]);
      assert(result.ok, result.summary);
      const chief = project.maps[project.startMapId]!.events.find((event) => event.name === "촌장 하르");
      expect(chief?.pages?.[0]?.commands.some((command) => command.kind === "shop")).toBe(false);
    });
  });
});
