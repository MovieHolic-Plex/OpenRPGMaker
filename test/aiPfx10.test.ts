import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { anchorsOf, blockersOf, bodyReached, reachFrom } from "@/ai/v2/judge/eventReach";
import { buildBossEncounter } from "@/ai/v2/story/sceneVerbs";
import { eventPassageRect } from "@/project/eventFootprintQuery";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { readFileSync } from "node:fs";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { V2_CORE_PROMPT } from "@/ai/v2/prompt/core";
import { GAME_CARD, gameCard } from "@/ai/v2/prompt/gameCard";
import { classifyRequest } from "@/ai/v2/request/intent";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { isolateTimers } from "./mergedTeardown";

// 확인 빌드 r7 · r8 의 플레이 결함(2026-11-17, PR agent/av2-play-fixes-5). 자료: assistant-fable-runs/r7/DEFECTS-vs-r7a.md · r8/DEFECTS-r8.md.
describe("aiV2PlayFixes5", () => {
  isolateTimers();
  it("reports the coast builder's river mouth limitation before and after building r8's harbor", async () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = {
      ctx,
      request: { task: "강이 바다로 흘러드는 강어귀에 포구 마을을 만들어 줘.", provider: "local-cli:claude", mapIds: [], project },
      emit: () => {},
      record: () => {},
      checkpoint: async () => {},
    } as unknown as PiAssistantV2Env;
    const make = createV2Tools(env, new V2Session()).find((t) => t.name === "make_place")!;
    const makePlace = async (spec: object) => {
      const result = await make.execute("coast-place", { spec });
      return JSON.parse((result.content.find((part) => part.type === "text") as { text: string }).text);
    };
    const spec = { type: "village", name: "갈매나루", theme: "coast", features: ["plaza"] };
    const hints = { kind: "fishing-cove", terrainSeed: 85206, width: 42, height: 42 };

    const preview = await makePlace({ ...spec, hints });
    expect(preview.notFailure).toBe(true);
    expect(preview.terrainLimitation).toContain("cannot lay a river flowing into the sea");

    const built = await makePlace({ ...spec, hints: { ...hints, layout: {
      gather: { x: 18, y: 21, plaza: true }, work: { x: 23, y: 30 },
      houses: [{ x: 8, y: 18, kind: "medium" }, { x: 9, y: 27, kind: "small" }, { x: 28, y: 15, kind: "medium" }],
      exits: ["west"],
    } } });
    expect(built.ok, built.summary).toBe(true);
    expect(built.warnings).toEqual(expect.arrayContaining([preview.terrainLimitation]));
  }, 60_000);
  type Obj = Record<string, unknown>;
  const page = (conditions: unknown[], commands: unknown[], more: Obj = {}) =>
    ({ id: `p${Math.random().toString(36).slice(2, 7)}`, trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions, commands, ...more });
  const event = (id: string, name: string, x: number, y: number, pages: unknown[]) => ({ id, name, x, y, trigger: { kind: "action" }, commands: [], pages }) as unknown as GameEvent;
  const cave = (): { project: Project; map: GameMap } => {
    const ctx: ToolContext = { project: createEmptyToolProject("굴") };
    const blank = createBlankProject() as Project;
    ctx.project.database = blank.database;
    ctx.project.system = { ...ctx.project.system, startActorIds: blank.system.startActorIds };
    expect(runTool(ctx, "author_dungeon", { type: "cave", size: "small", name: "굴", seed: 2 }, { dryRun: false }).ok).toBe(true);
    const map = Object.values(ctx.project.maps)[0]!;
    map.events = [...map.events.filter((e) => !/_lever/u.test(e.id)), event("ev_far_stairs", "부서진 비석", 24, 9, [page([], [{ kind: "transfer", mapId: map.id, x: 14, y: 28 }])])];
    return { project: ctx.project, map };
  };
  /** 그 적을 이기지 않고(몸 전체를 벽으로) 비석에 닿는가. */
  const pastFoe = (project: Project, map: GameMap, foe: GameEvent): boolean => {
    const blocked = blockersOf(map);
    const r = eventPassageRect(foe);
    for (let y = r.top; y <= r.bottom; y++) for (let x = r.left; x <= r.right; x++) blocked.add(y * map.width + x);
    blocked.add(foe.y * map.width + foe.x);
    return bodyReached(map, reachFrom(project, map, anchorsOf(project, map), blocked), map.events.find((e) => e.id === "ev_far_stairs")!);
  };
  // D5(r8 `001.67`): 모델이 add_boss_encounter 로 「해골 병사」 를 청사진 s4(싸움)에 맞춰 묘지 (16,13) 에 세웠고 blocks 를 주지 않았다 — 플레이어가 옆으로 지나갔다.
  describe("청사진의 중간 싸움 단계는 blocks 를 말하지 않아도 다음 단계로 가는 길을 막는다 — r8 D5", () => {
    const withBlueprint = (project: Project, foeName: string, laterOnSameMap: boolean) => {
      const st = (id: string, kind: string, who: string, place: string) => ({ id, kind, who, place, event: who, action: kind === "battle" ? "싸운다" : "읽는다", gives: `${id} 끝`, feeling: "긴장" });
      project.gameBlueprint = normalizeGameBlueprint({ title: "굴", genre: "JRPG", playerGoal: "지나가자", request: "x",
        steps: [st("s1", "talk", "신부", "굴"), st("s2", "battle", foeName, "굴"), ...(laterOnSameMap ? [st("s3", "find", "부서진 비석", "굴")] : [])],
        ending: { name: "끝", how: "이긴다", feeling: "안도" } });
    };

    it("다음 단계가 같은 맵에 있으면 길목으로 옮겨 세우고 그렇다고 알린다", () => {
      const { project, map } = cave();
      withBlueprint(project, "해골 병사", true);
      const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
      const res = buildBossEncounter(run, { mapId: map.id, boss: { name: "해골 병사", at: { x: 20, y: 20 }, enemy: "해골" }, lines: ["지나갈 수 없다."] } as never);
      expect(res.ok).toBe(true);
      expect(res.summary).toContain("It is a blueprint fight step with later steps on this map, so it stands in their way.");
      const now = run.ctx.project.maps[map.id]!;
      const foe = now.events.find((e) => e.name === "해골 병사")!;
      expect([foe.x, foe.y]).not.toEqual([20, 20]);
      expect(pastFoe(run.ctx.project, now, foe)).toBe(false);
    }, 60_000);

    it("마지막 싸움(보스)이거나 blocks:false 면 옮기지 않는다", () => {
      for (const [later, blocks] of [[false, undefined], [true, false]] as const) {
        const { project, map } = cave();
        withBlueprint(project, "해골 병사", later);
        const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
        buildBossEncounter(run, { mapId: map.id, boss: { name: "해골 병사", at: { x: 20, y: 20 }, enemy: "해골", ...(blocks === false ? { blocks } : {}) }, lines: ["지나갈 수 없다."] } as never);
        const foe = run.ctx.project.maps[map.id]!.events.find((e) => e.name === "해골 병사")!;
        expect([foe.x, foe.y], `later=${later} blocks=${blocks}`).toEqual([20, 20]);
      }
    }, 60_000);
  });
  // R3 · R2(r7-harbour `001.44` «Kept as built (their own fight or shop): s2»): 청사진 s2 고르기 단계의 어물전 주인이 상점을 갖고 있어 단계가 지어지지 않았다 —
  // 고르기 · 번호 대사가 빠졌고, 사슬이 s1 → 단서로 건너뛰어 강지기의 «어물전에 가 보게» 와 목표 줄이 다른 곳을 가리켰다.
  describe("상점만 든 청사진 단계도 짓고 상점은 그 사람에게 남긴다 — r7 R3 · R2", () => {
    async function harbour() {
      const { buildBlueprintPath } = await import("@/ai/v2/story/blueprintPath");
      const project = createBlankProject() as Project;
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      const map = project.maps[project.startMapId]!;
      const place = map.name || map.id;
      map.events.push(event("ev_fishwife", "어물전 주인", 6, 6, [page([], [{ kind: "text", body: "오늘 잡은 생선이야!" }, { kind: "shop", itemIds: ["item_potion"] }])]));
      project.gameBlueprint = normalizeGameBlueprint({
        title: "갈매나루", genre: "JRPG", playerGoal: "지하 문을 열자.", ending: { name: "다시 열린 바다", how: "문을 연다.", feeling: "안도", closing: ["바다가 열렸다."] },
        steps: [
          { id: "s1", kind: "talk", who: "강지기", place, event: "강지기", action: "강지기 이야기를 듣는다", gives: "강지기의 부탁", feeling: "불길", text: { lines: ["어물전 아낙이 밤바다에서 뭘 봤다더군. 가서 물어보게나."] } },
          { id: "s2", kind: "choice", who: "어물전 주인", place, event: "어물전 주인", action: "소문을 듣고 챙길 것을 고른다", needs: "강지기의 부탁", gives: "어물전 소문", feeling: "응원",
            text: { lines: ["지하 문 번호는 7474야. 잊지 마!"], choices: [{ text: "회복약을 챙겨 간다", lines: ["옳지."] }, { text: "성수를 챙겨 간다", lines: ["망자한텐 성수지."] }] } },
          { id: "s3", kind: "puzzle", place, event: "지하 문", action: "지하 문을 연다", needs: "어물전 소문", gives: "ending", feeling: "긴장", text: { lines: ["녹슨 숫자 자물쇠."], code: "7474" } },
        ],
      });
      const result = buildBlueprintPath(createBuildRun(ctx));
      return { result, ctx };
    }

    it("고르기 · 번호 대사가 지어지고 상점은 그 사람의 페이지에 남는다", async () => {
      const { result, ctx } = await harbour();
      expect(result.ok).toBe(true);
      expect(result.summary).not.toContain("Kept as built (their own fight or shop): s2");
      const fishwife = ctx.project.maps[ctx.project.startMapId]!.events.find((e) => e.id === "ev_fishwife")!;
      const json = JSON.stringify(fishwife.pages);
      expect(json).toContain("회복약을 챙겨 간다");
      expect(json).toContain("7474");
      expect(json).toContain('"kind":"shop"');
      expect((result.warnings ?? []).join(" ")).toContain("Built the step and kept the shop on it: s2 어물전 주인");
      // 단계를 넘기는 페이지(고르기)에는 가게가 없다 — 이야기 중에 가게 창이 열리지 않는다. 자동 플레이가 엔딩까지 간다.
      expect(fishwife.pages!.filter((p) => JSON.stringify(p.commands).includes("choices")).every((p) => !JSON.stringify(p.commands).includes('"kind":"shop"'))).toBe(true);
      const { runAutoPlay } = await import("@/qa/gameCheck/autoPlay");
      const run = runAutoPlay(ctx.project, { budgetMs: 30_000, honest: true }).runs[0]!;
      expect(run.ok, run.failure?.detail).toBe(true);
      // s3 자물쇠는 s2 다음에만 열린다 — 강지기 뒤로 곧장 건너뛰지 않는다.
      const s2Built = ctx.project.gameBlueprint!.steps[1]!.built;
      expect(s2Built?.eventId).toBe("ev_fishwife");
    }, 60_000);
  });
  // D4(r8 `001.10/18/26/157/168`): 생선 바구니 더하기 · 소금통 빼기 · 계단 빼기 · 침대 더하기가 «The rebuild had more problems … restored» 로 다섯 번 되돌려졌다.
  // 늘어난 것이 꾸밈 비평(major)뿐이면 고친 것을 남기고 알린다 — 걸어 닿지 못함 같은 게임을 깨는 실패가 늘 때만 되돌린다.
  describe("고치기 되돌림은 게임이 깨질 때만 — r8 D4", () => {
    const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAEElEQVR4nGNgGAWjYBTAAAADEAABPywr7AAAAABJRU5ErkJggg==";
    it("비평 major 만 늘어난 꾸밈 고치기는 남기고 그렇다고 알린다", async () => {
      const THRONE = JSON.parse(/const THRONE_ROOM = (\{.*\});/u.exec(readFileSync("test/aiV2KeepMapId.test.ts", "utf8"))![1]!);
      const project = createBlankProject();
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      let majors = 0;
      const env = { ctx, render: async () => PNG, request: { task: "왕의 알현실을 만들어 줘.", provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, checkpoint: async () => {},
        sideChat: async () => JSON.stringify({ score: 7, imagesSeen: 1, axes: { composition: 7, view: 7, doors: 7 }, majors: Array.from({ length: majors }, (_, i) => ({ axis: 1, x: 2 + i, y: 2, w: 1, h: 1, what: "빈 바닥", fix: "채운다" })) }) } as unknown as PiAssistantV2Env;
      const tools = createV2Tools(env, new V2Session());
      const call = async (name: string, args: unknown) => JSON.parse(((await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)).content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as { ok: boolean; reverted?: boolean; mapIds?: string[]; warnings?: string[] };
      const made = await call("make_place", THRONE);
      expect(made.ok).toBe(true);
      const mapId = made.mapIds![0]!;
      majors = 2;
      const edit = await call("edit_place", { mapId, patch: { mapId, layoutPatch: { add_objects: [{ id: "candle", x: 3, y: 8, purpose: "촛불" }] } } });
      expect(edit.reverted ?? false).toBe(false);
      expect(edit.ok).toBe(true);
      expect((edit.warnings ?? []).join(" ")).toContain("Kept this change: the review now lists 2 problem(s) (was 0), but none of the new ones breaks the game");
      expect(JSON.stringify(ctx.project.maps[mapId])).toContain("candle");
    }, 120_000);
  });
  // R6 · N4(r7-jpcity `001.5` → `001.8`): 거리 빌더가 «편의점 문 (27,9) · 헌책방 문 (35,9) · 파출소 문 (1,25)» 를 결과에 적은 바로 뒤 add_people 이
  // «편의점 문 앞» 을 못 찾아 넷을 시작 근처에 두었다. 거리·마을 빌더는 건물마다 장소 기록(「편의점 건물」, 메모 «문 (27,9)»)을 남긴다.
  describe("«<건물> 문 앞» 은 그 건물의 문 앞이다 — r7 R6 · N4", () => {
    it("장소 기록의 이름으로 그 건물 문을 찾고, 없는 건물이면 가장 가까운 문이라고 적는다", async () => {
      const { resolveWhere } = await import("@/ai/v2/place/where");
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      (map as unknown as { locations: unknown[] }).locations = [
        { id: "loc_a", name: "편의점 건물", x: 2, y: 1, w: 3, h: 3, tags: ["jp-building"], note: "종류 konbini · 문 (3,3) · 문 앞 접근칸 (3,4)" },
        { id: "loc_b", name: "파출소 건물", x: 14, y: 1, w: 3, h: 3, tags: ["jp-building"], note: "종류 koban · 문 (15,3) · 문 앞 접근칸 (15,4)" },
      ];
      const konbini = resolveWhere(project, map, "편의점 문 앞");
      expect(konbini.fallback).toBeUndefined();
      expect(konbini.anchor).toEqual({ x: 3, y: 3 });
      const koban = resolveWhere(project, map, "파출소 문 앞");
      expect(koban.anchor).toEqual({ x: 15, y: 3 });
      expect(Math.abs(koban.cell.x - 15) + Math.abs(koban.cell.y - 3)).toBeLessThanOrEqual(4);
      const post = resolveWhere(project, map, "우체국 문 앞");
      expect(post.fallback).toBeUndefined();
      expect(post.how).toContain("「우체국」 건물이 없어 가장 가까운 문");
    });
  });
  // R7(r7-jpcity `001.21`): 비평이 «주차장 공터가 비었다» 해 모델이 edit_place{addAnchors:[{what:"주차장 (승합차·자전거 거치대)", near:{27,1}}]} 를 보내자
  // «A jp-city place is re-laid only by variant … not for single props» 로 거절하고 고치기 한 번을 셌다. 물건만 더하는 고침은 선 맵에 그 이름의 칩셋 물건을 놓고 알린다.
  describe("거리에 물건 하나 더하는 고침은 놓고 알린다 — r7 R7", () => {
    it("jp-city 거리의 addAnchors 고침이 다시 깔지 않고 물건을 놓으며 고치기 바퀴를 쓰지 않는다", async () => {
      const project = createBlankProject();
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      const env = { ctx, request: { task: "역 앞 상점가를 지어 줘.", provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, checkpoint: async () => {},
        sideChat: async () => JSON.stringify({ score: 7, imagesSeen: 0, majors: [] }) } as unknown as PiAssistantV2Env;
      const session = new V2Session();
      const tools = createV2Tools(env, session);
      const call = async (name: string, args: unknown) => JSON.parse(((await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)).content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as { ok: boolean; summary: string; mapIds?: string[] };
      // r6b-jpcity calls.json #6 의 인자 그대로
      const made = await call("make_place", { type: "street", name: "역 앞 상점가", style: "jp-modern", size: "small", salt: 7191,
        features: ["상점가", "konbini", "ramen", "서점", "police box", "vending", "bench", "lamp", "post box"], hints: { length: "short", shops: "conbini,ramen,books" } });
      expect(made.ok, made.summary).toBe(true);
      const mapId = made.mapIds![0]!;
      const rounds0 = session.placeOf(mapId)!.rounds;
      const before = JSON.stringify(ctx.project.maps[mapId]!.upperTiles);
      const edit = await call("edit_place", { patch: { mapId, addAnchors: [{ what: "주차장 (승합차·자전거 거치대)", near: { x: 27, y: 1 } }] } });
      expect(edit.ok, edit.summary).toBe(true);
      expect(edit.summary).toContain("Placed on the standing map (not re-laid, no repair round used): «주차장 (승합차·자전거 거치대)» →");
      expect(edit.summary).not.toContain("re-laid only by variant");
      expect(session.placeOf(mapId)!.rounds).toBe(rounds0);
      expect(JSON.stringify(ctx.project.maps[mapId]!.upperTiles)).not.toBe(before);
      // 칩셋에 없는 이름만 오면 예전처럼 draw_object 를 이른다.
      const none = await call("edit_place", { patch: { mapId, addAnchors: [{ what: "zzqx 없는 물건", near: { x: 27, y: 1 } }] } });
      expect(none.ok).toBe(false);
      expect(none.summary).toContain("draw_object");
    }, 180_000);
  });
  // N7(r7a-harbour `003.1` ~ `003.5`): 없는 id 로 todo start 를 하면 목록 전문을 붙여 4,000자에서 끊었다 — 모델은 다른 id 를 다섯 번 넣어 보았다.
  describe("없는 todo id 의 거절 글은 열린 항목만 싣는다 — r7a N7", () => {
    it("긴 목록에서 열린 id 를 요약에 적고, 목록은 열린 줄만", async () => {
      const { TodoStore } = await import("@/ai/v2/loop/todoStore");
      const store = new TodoStore();
      store.init([{ phase: "짓기", items: Array.from({ length: 45 }, (_, i) => ({ content: `할 일 ${i + 1} — 장소 하나를 짓고 사람을 세우고 문을 잇는다 (${"긴 설명 ".repeat(8)})` })) }]);
      for (const item of store.items.slice(0, 41)) store.done(item, undefined);
      const brief = store.viewOpenEn();
      expect(brief.length).toBeLessThan(store.view(40, true).length / 3);
      for (const item of store.items.slice(41)) expect(brief).toContain(` ${item.id} `);
      expect(brief).not.toContain(` ${store.items[0]!.id} `);
      // 짧은 목록은 그대로 전체.
      const short = new TodoStore();
      short.init([{ phase: "p", items: [{ content: "하나" }, { content: "둘" }] }]);
      expect(short.viewOpenEn()).toBe(short.view(40, true));
    });
  });
  // R5(r7-jpcity `003.22`): 현대 칩 넷 사이에 라멘집 «단골손님» 만 공유 배우 칩(«별담 · 천문 기록관», 판타지 · 짝 얼굴 없음)으로 섰다.
  describe("현대 맵의 사람 칩은 한 화풍 — r7 R5", () => {
    it("공유 배우 칩은 현대 맵의 기본 계열이 아니다 — 현대 칩은 그대로", async () => {
      const { familyFits } = await import("@/ai/v2/place/people");
      const street = { id: "m", tilesetId: "jp_city" } as unknown as GameMap;
      expect(familyFits(street, "shared_charset_actor_0e6e611b752feb5ea9f3fe96")).toBe(false);
      expect(familyFits(street, "tex_oprn_charset_modern3")).toBe(true);
      expect(familyFits(street, "tex_easyrpg_charset_people1")).toBe(false);
    });
  });
});

// 작은 일의 지시문·도구 예산 — 요청 한 줄에 실리는 지시문 글자 수와 처음 싣는 도구 수를 못박는다(모델 없음).
// 2026-11-11 구조 재점검: 「이 맵에 상점 주인 한 명 세워 줘」에 지시문 63,679자·도구 43개(97,272자)가 실렸다. 이제 그 일이 쓰는 카드·도구만 싣는다.
describe("aiV2PromptBudget", () => {
  isolateTimers();
  type State = "blank" | "oneEvent";
  function project(state: State): Project {
    const p = createBlankProject() as Project;
    if (state === "oneEvent") {
      const map = p.maps[p.startMapId]!;
      map.events = [...(map.events ?? []), { id: "ev_npc", name: "촌장", x: 2, y: 2, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "어서 오게." }] }] } as never];
    }
    return p;
  }
  function shoot(task: string, state: State) {
    const p = project(state);
    const env = { ctx: { project: p, currentMapId: p.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project: p, projectKey: "golden-key" },
      emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as never;
    const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
    const sys = buildV2SystemPrompt(p, p.startMapId, task, undefined, "golden-key");
    const toolChars = exposure.tools.reduce((n, t) => n + JSON.stringify({ n: t.name, d: t.description, p: t.parameters }).length, 0);
    return { text: sys.join("\n"), chars: sys.reduce((n, block) => n + block.length, 0), upFront: exposure.tools.map((t) => t.name), toolChars, lazy: exposure.lazy };
  }
  /** 작은 일 — [요청, 지시문 글자 상한]. 처음 싣는 도구는 모두 20개·40,000자 안. */
  const SMALL_JOBS: readonly (readonly [string, number])[] = [
    ["이 맵에 상점 주인 한 명 세워 줘.", 15_000],
    ["이 NPC를 두 칸 왼쪽으로 옮겨 줘", 12_000],
    ["저 상자를 방 안쪽으로 옮겨 줘", 12_000],
    ["촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘", 15_000],
    ["여기 보물상자 하나 놓고 포션 3개 넣어 줘", 15_000],
    ["촌장한테 말 걸면 열쇠를 받게 해 줘", 15_000],
    ["슬라임 세 마리와 싸우는 전투 하나 넣어 줘", 15_000],
    ["게임 제목을 '별의 노래'로 바꿔 줘", 15_000],
    // 게임 낱말이 없는 작은 일도 게임 카드의 늘 싣는 줄(2,617자)을 받는다 — 이벤트 찾기·옮기기 도구와 함께(12,292자).
    ["광장 빈 곳에 나무랑 벤치 좀 놓아 줘", 13_000],
    ["이 게임 뭐가 부족한지 알려 줘", 12_000],
  ];
  /** 작은 일에는 처음부터 싣지 않는 도구(필요할 때 싣는다). */
  const HEAVY = ["write_blueprint", "build_blueprint_path", "make_place", "edit_place", "review_layout", "set_opening", "edit_opening", "author_opening_stage", "create_opening_animatic_shot"];
  describe("small jobs get a small prompt and a short tool list", () => {
    for (const state of ["blank", "oneEvent"] as const) {
      it.each(SMALL_JOBS.map(([task, max]) => [task, max] as const))(`${state} | %s ≤ %d chars`, (task, max) => {
        const shot = shoot(task, state);
        expect(shot.chars).toBeLessThanOrEqual(max);
        // load_tools 포함 19개 — 실행기가 더하는 todo 한 자리까지 20개.
        expect(shot.upFront.length).toBeLessThanOrEqual(19);
        expect(shot.toolChars).toBeLessThanOrEqual(40_000);
        expect(shot.upFront[0]).not.toBe("write_blueprint");
        for (const name of HEAVY) expect(shot.upFront).not.toContain(name);
        expect(shot.upFront).toContain("load_tools");
        expect(shot.text).not.toContain("[Interior catalog —");
        // 그 요청이 말한 주제의 줄만 — 게임 하나에는 16줄이 다 실린다.
        expect(shot.text.split("\n").filter((line) => line.startsWith("  · ")).length).toBeLessThanOrEqual(2);
      });
    }

    it("keeps the heavy tools loadable by name", () => {
      const shot = shoot("이 맵에 상점 주인 한 명 세워 줘.", "oneEvent");
      for (const name of ["write_blueprint", "make_place", "edit_place", "upsert_event"]) expect(shot.lazy.has(name)).toBe(true);
    });

    it("gives each job the tools it names", () => {
      expect(shoot("이 NPC를 두 칸 왼쪽으로 옮겨 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["move_event", "find_events"]));
      expect(shoot("이 맵에 상점 주인 한 명 세워 줘.", "blank").upFront).toEqual(expect.arrayContaining(["add_people", "set_shop_stock", "list_npc_graphics"]));
      expect(shoot("촌장한테 말 걸면 열쇠를 받게 해 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["upsert_event", "patch_event_page", "run_scene_test"]));
      expect(shoot("여기 보물상자 하나 놓고 포션 3개 넣어 줘", "oneEvent").upFront).toContain("place_chest");
      // 줍는 물건도 같은 도구다(look:"item") — 그림을 그리게 하거나 투명 이벤트로 흉내 내지 않게 처음부터 싣는다.
      expect(shoot("여기 바닥에 낡은 열쇠가 떨어져 있게 해 줘. 조사하면 주워 가게 해 줘", "oneEvent").upFront).toContain("place_chest");
      expect(shoot("슬라임 세 마리와 싸우는 전투 하나 넣어 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["upsert_troop", "simulate_battle"]));
    });

    it("a snowfield with no «빈 곳» word still gets the filling tools; a wandering foe keeps its tool under the size cap", () => {
      expect(shoot("눈보라 마을 왼쪽 아래 빈 눈밭에 나무랑 바위를 좀 놓아 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["find_empty_ground", "furnish_outdoor_area"]));
      const foe = shoot("얼어붙은 호수에 돌아다니는 적을 하나 놓아 줘. 부딪히면 전투가 시작되게 해 줘", "oneEvent");
      expect(foe.upFront).toEqual(expect.arrayContaining(["place_field_enemy", "upsert_event"]));
      expect(foe.toolChars).toBeLessThanOrEqual(40_000);
    });

    it("dress words bring the outdoor filling tools and their card", () => {
      const shot = shoot("마을이 좀 허전해. 꾸며 줘", "oneEvent");
      expect(shot.upFront).toEqual(expect.arrayContaining(["find_empty_ground", "furnish_outdoor_area", "stamp_object"]));
      expect(shot.text).toContain("[Filling empty outdoor ground]");
    });

    it("on an empty project a bare description starts a first place; a clear small job stays small", () => {
      expect(classifyRequest("폐업 직전 태엽 장난감 가게", project("blank"))).toMatchObject({ scope: "place", editOnly: false });
      expect(classifyRequest("폐업 직전 태엽 장난감 가게", project("oneEvent"))).toMatchObject({ scope: "edit", editOnly: true });
      expect(classifyRequest("이 맵에 상점 주인 한 명 세워 줘.", project("blank"))).toMatchObject({ scope: "edit", editOnly: true });
      // 빈 프로젝트의 「계속」은 고칠 것이 없다 — 짓는 카드·도구를 그대로 싣는다.
      expect(classifyRequest("계속", project("blank"))).toMatchObject({ scope: "continue", editOnly: false });
      expect(classifyRequest("계속", project("oneEvent"))).toMatchObject({ scope: "continue", editOnly: true });
    });

    it("leaves out what small jobs never called and loads what they had to fetch (Terra small jobs, 2026-11-11)", () => {
      const keeper = shoot("이 맵에 상점 주인 한 명 세워 줘.", "oneEvent").upFront;
      for (const name of ["restore_event", "place_object", "remove_event", "move_object", "declare_story_flag"]) expect(keeper).not.toContain(name);
      expect(shoot("촌장 옆에 있는 경비병을 지워 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["remove_event", "restore_event", "move_object"]));
      expect(shoot("여기 보물상자 하나 놓고 포션 3개 넣어 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["find_empty_ground", "get_database_records"]));
      expect(shoot("촌장한테 말 걸면 열쇠를 받게 해 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["upsert_item", "get_database_records"]));
      // 게임 제목은 프로젝트 설정에 있다 — 제목을 말한 요청에만 싣는다.
      expect(shoot("게임 제목을 '별의 노래'로 바꿔 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["set_title_screen", "set_project_settings"]));
      expect(keeper).not.toContain("set_project_settings");
      // 「주워 가게 해 줘」의 「가게」는 상점이 아니다.
      expect(shoot("족장의 긴 집 바닥에 낡은 열쇠가 떨어져 있게 해 줘. 조사하면 주워 가게 해 줘", "oneEvent").upFront).not.toContain("set_shop_stock");
      expect(shoot("광장에 가게 하나 차려서 포션을 사게 해 줘", "oneEvent").upFront).toContain("set_shop_stock");
      // 물어야 풀리는 일(「내 이름」)의 ask_user 와 말한 음악의 도구는 글자 상한에 밀리지 않는다.
      expect(shoot("엔딩 크레딧 음악 넣고 크레딧에 내 이름도 넣어 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["ask_user", "store_find_music", "set_game_audio"]));
    });

    it("a small job with no game word still finds and moves events; a place build and a sound-only job are unchanged", () => {
      // 전에는 도구 6개(inspect·add_event·add_people·read_specs·ask_user·load_tools)뿐이었다 — 이벤트 찾기·옮기기 도구가 만들어지지도 않았다.
      const line = shoot('촌장이 "배경 음악이 참 좋지?"라고 말하게 해 줘', "oneEvent");
      expect(line.upFront).toEqual(expect.arrayContaining(["find_events", "get_event", "patch_event_page", "move_event", "upsert_event"]));
      for (const ask of ["계속", "썸네일 그림 하나 골라 줘", "광장 빈 곳에 나무랑 벤치 좀 놓아 줘"]) {
        const shot = shoot(ask, "oneEvent");
        expect(shot.upFront, ask).toEqual(expect.arrayContaining(["find_events", "move_event"]));
        expect(shot.lazy.has("remove_event"), ask).toBe(true);
        expect(shot.upFront.length, ask).toBeLessThanOrEqual(19);
      }
      expect(classifyRequest("계속", project("oneEvent")).tools.game).toBe(true);
      // 장소를 짓는 요청·빈 프로젝트의 «계속»·소리만 바라는 요청은 그대로다.
      expect(classifyRequest("작은 마을 하나 만들어 줘", project("oneEvent")).tools.game).toBe(false);
      expect(classifyRequest("계속", project("blank")).tools.game).toBe(false);
      // 소리만 바라는 요청은 소리 묶음만 싣는다(«음악» 이 게임 낱말이어도 이벤트 도구를 내놓지 않는다).
      const music = shoot("마을에 잔잔한 배경 음악 깔아 줘", "oneEvent");
      expect(music.upFront).not.toContain("move_event");
      expect(music.lazy.has("move_event")).toBe(false);
    });

    it("carries the people card for a new person and no event card for a bare move", () => {
      expect(shoot("이 맵에 상점 주인 한 명 세워 줘.", "blank").text).toContain("People spec:");
      const move = shoot("이 NPC를 두 칸 왼쪽으로 옮겨 줘", "oneEvent").text;
      expect(move).not.toContain("Events spec:");
      expect(move).not.toContain("People spec:");
    });
  });
  describe("place and whole-game requests", () => {
    it("an interior request carries the interior catalog; a village request does not", () => {
      expect(shoot("여관 1층 하나 지어 줘", "blank").text).toContain("[Interior catalog —");
      expect(shoot("작은 마을 하나 만들어 줘", "blank").text).not.toContain("[Interior catalog —");
      expect(shoot("이 맵에 상점 주인 한 명 세워 줘.", "blank").text).not.toContain("[Fallen-Star-style jobs");
    });

    // 2026-11-12: 실내 이야기 기물 8종(#4677)으로 방탈출 지시문이 67,493자가 됐다 — 상한을 올리지 않고 목록에서 «크기 표의 구운 크기» 52줄을 뺐다(66,610자).
    // 2026-11-13: 청사진 카드의 goal · item 한 줄(+176)로 판타지 지시문이 35,663자가 됐다 — 상한을 올리지 않고 카드에서 도구 스키마의 칸 설명과 같은 말을 뺐다(35,328자).
    // 2026-11-16: 마을 종류 서른여덟의 목록을 마을 카드에 실어(#4726, +1,170) 방탈출 지시문이 67,657자가 됐다 — 상한을 올리지 않고 카드에는 한 문장과 예 넷만 남겼다(+195, 66,682자).
    // 전체 목록은 마을의 땅 그림 답과 모르는 kind 의 거절 글에 실린다(test/beodeulVillageKinds.test.ts).
    // 2026-11-26: 38,024. 11-19(#4740)에 이미 35,965 로 넘었고(시험이 아무 PR 에도 걸리지 않아 몰랐다), 그 뒤 첫 판 MVP 흐름(#4944·#4946·#4948·#5047 청사진 카드 +1,179),
    // 장르 변주 카드(#4986 +226), 세계 카드(+383), 코어(+224)가 더했다. 모두 의도한 지시문이라 상한을 지금 값으로 다시 고정한다 — 더 늘면 다시 빨개진다.
    it("a whole-game prompt does not grow (main 2026-11-11 after #4556: 35,491 · 67,349 chars; 2026-11-12: 66,610; 2026-11-13: 35,328; 2026-11-26: 38,024)", () => {
      const fantasy = shoot("판타지 RPG 게임 하나 만들어 줘.", "blank");
      expect(fantasy.chars).toBeLessThanOrEqual(38_024);
      // 뺀 말은 write_blueprint · build_blueprint_path 의 칸 설명이 한다 — 두 도구가 처음부터 실려야 한다.
      expect(fantasy.upFront).toContain("build_blueprint_path");
      expect(fantasy.text).toContain("[Fallen-Star-style jobs");
      expect(fantasy.upFront).toContain("write_blueprint");
      const escape = shoot("방탈출 게임 만들어 줘.", "blank");
      // 2026-11-26 CI: 68,446 — 첫 판 MVP·장르 변주 카드(위 38,024 와 같은 증가)가 이 요청에도 실린다. 상한을 지금 값으로 다시 고정한다.
      expect(escape.chars).toBeLessThanOrEqual(68_446);
      // 크기 표는 한 줄이 말한다 — 놓는 법 글자가 붙고, 구운 크기(dining 2x1 2x1 f)는 목록에 다시 실리지 않는다.
      expect(escape.text).toMatch(/sized tables [^\n]*: dining f, [^\n]*sideboard\(1 row\) w\^1/u);
      expect(escape.text).not.toContain("dining 2x1 2x1");
    });

    it("a place request gets only the game-card lines its words name", () => {
      const inn = shoot("여관 1층 하나 지어 줘", "blank").text;
      expect(inn).toContain("[Game elements");
      expect(inn).not.toContain("[Fallen-Star-style jobs");
    });
  });
  describe("instructions agree with each other and with the tools", () => {
    it("coordinates come from a tool result, never a guess — and move_event needs none", () => {
      expect(V2_CORE_PROMPT).toContain("gets only cells a tool or the critic gave you");
      expect(V2_CORE_PROMPT).not.toContain("pass only coordinates the critic gave you");
      expect(GAME_CARD).toContain("move_event{eventId, dx,dy | where}");
    });
    it("a missing object is drawn first; the nearest existing object is the fallback, said in the report", () => {
      expect(V2_CORE_PROMPT).toContain("Do not quietly swap in a similar object");
      expect(GAME_CARD).toContain("draw_object first (core rule)");
      expect(GAME_CARD).not.toContain("do not stop at a draw_object card");
    });
    it("new NPCs are stood with add_people, not the hidden place_npc", () => {
      expect(GAME_CARD).not.toContain("place_npc");
      expect(GAME_CARD).toContain("add_people (a new NPC)");
    });
    it("the topic card is a subset of the full card", () => {
      const full = new Set(GAME_CARD.split("\n"));
      for (const line of gameCard(["items", "battle", "snow"]).split("\n")) expect(full.has(line)).toBe(true);
      expect(gameCard([]).length).toBeLessThan(3_000);
    });
  });
});
