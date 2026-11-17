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
