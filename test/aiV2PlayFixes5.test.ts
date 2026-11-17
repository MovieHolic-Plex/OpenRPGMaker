// 확인 빌드 r7 · r8 의 플레이 결함(2026-11-17, PR agent/av2-play-fixes-5). 자료: assistant-fable-runs/r7/DEFECTS-vs-r7a.md · r8/DEFECTS-r8.md.
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
    const THRONE = JSON.parse(/const THRONE_ROOM = (\{.*\});/u.exec(readFileSync("test/aiV2InteriorSpaceAdvisory.test.ts", "utf8"))![1]!);
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
