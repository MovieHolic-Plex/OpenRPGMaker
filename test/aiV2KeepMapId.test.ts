// 다시 지은 장소가 옛 맵 id 를 지킨다(src/ai/v2/place/keepMapId.ts).
// 왜(2026-11-11 lay-tools 농장·항구): 마을 빌더가 집 보호를 피해 `<id>_r2` 로 다시 짓고 옛 맵을 지워, 할 일 묶음이 없는 맵을 가리키고 검수자가 «시작 맵이 지워졌다» 로 읽었다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { PlaceBuildResult } from "@/ai/v2/shared/types";
import { keepRelaidMapId, keptMapId, keptPlaceResult, renameIdIn, renameMapId } from "@/ai/v2/place/keepMapId";

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
