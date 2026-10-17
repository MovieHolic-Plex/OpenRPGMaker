// 포켓몬라이크 깊이 감사(2026-10-16) 수리 ⑤⑥⑧: place_field_obstacle 우회 경고·span/fullWidth, run_scene_test HM 선행 조건 문장,
// define_monster_families 의 ability·machineSkillIds·생성 id 응답. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
// 같은 시나리오를 bun 프로브(scripts/qa/poke-audit-fix/obstacle-probe.mts·families-probe.mts)로 실행해 출력을 확인했다.
import { beforeAll, describe, expect, it } from "vitest";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { getTool } from "@/editor/tools";

let base: Project;
beforeAll(async () => {
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId };
  const built = await runToolAsync(ctx as never, "build_monster_game", { mode: "create", gymCount: 1, speciesCount: 12 });
  expect(built.ok).toBe(true);
  base = ctx.project;
}, 60_000);

function roadCell(project: Project): { map: GameMap; x: number; y: number; width: number } {
  const map = project.maps.mx_map_meadow ?? Object.values(project.maps).find((m) => m.width >= 20)!;
  for (let y = 3; y < map.height - 3; y += 1) for (let x = 3; x < map.width - 3; x += 1) {
    if (!isPassable(project, map, x, y) || map.events.some((e) => e.x === x && e.y === y)) continue;
    let width = 1;
    for (const step of [1, -1]) for (let cx = x + step; cx >= 0 && cx < map.width && isPassable(project, map, cx, y); cx += step) width += 1;
    if (width >= 3 && width <= 10) return { map, x, y, width };
  }
  throw new Error("no road cell");
}

const place = (project: Project, args: Record<string, unknown>) => {
  const draft = structuredClone(project);
  const out = getTool("place_field_obstacle")!.run(draft, args as never) as { data: Record<string, unknown>; warnings?: string[] };
  return { draft, out };
};

describe("place_field_obstacle 우회 판정", () => {
  it("한 칸만 놓으면 우회로 경고와 data.bypass:true", () => {
    const { map, x, y } = roadCell(base);
    const { out } = place(base, { mapId: map.id, x, y, kind: "tree" });
    expect(out.data.bypass).toBe(true);
    expect((out.warnings ?? []).some((w) => w.includes("우회로가 있습니다"))).toBe(true);
  });
  it("fullWidth 는 도로 폭 전체를 막아 bypass:false, 칸마다 이벤트가 있다", () => {
    const { map, x, y, width } = roadCell(base);
    const { out, draft } = place(base, { mapId: map.id, x, y, kind: "tree", fullWidth: true });
    expect(out.data.bypass).toBe(false);
    expect((out.data.cells as unknown[]).length).toBe(width);
    expect((out.data.eventIds as string[]).length).toBe(width);
    expect((out.warnings ?? []).some((w) => w.includes("우회로가 있습니다"))).toBe(false);
    const placed = draft.maps[map.id]!;
    for (const cell of out.data.cells as { x: number; y: number }[]) expect(isPassable(draft, placed, cell.x, cell.y)).toBe(false);
  });
  it("span 이 폭보다 작으면 여전히 우회 경고, span 이 폭과 같으면 닫힌다", () => {
    const { map, x, y, width } = roadCell(base);
    expect(place(base, { mapId: map.id, x, y, kind: "tree", span: 1 }).out.data.bypass).toBe(true);
    expect(place(base, { mapId: map.id, x, y, kind: "tree", fullWidth: true }).out.data.bypass).toBe(false);
    expect(width).toBeGreaterThanOrEqual(3);
  });
  it("span 과 fullWidth 를 같이 주거나 water 에 span 을 주면 거절", () => {
    const { map, x, y } = roadCell(base);
    expect(() => place(base, { mapId: map.id, x, y, kind: "tree", span: 2, fullWidth: true })).toThrow(/함께 쓰지/u);
    expect(() => place(base, { mapId: map.id, x, y, kind: "water", span: 2 })).toThrow(/rock·tree/u);
  });
  it("같은 id 로 한 칸으로 다시 놓으면 보조 이벤트가 정리된다", () => {
    const { map, x, y } = roadCell(base);
    const first = place(base, { mapId: map.id, x, y, kind: "tree", fullWidth: true });
    const id = first.out.data.eventId as string;
    const again = getTool("place_field_obstacle")!.run(first.draft, { mapId: map.id, x, y, kind: "tree", id } as never) as { data: Record<string, unknown> };
    expect((again.data.eventIds as string[]).length).toBe(1);
    expect(first.draft.maps[map.id]!.events.filter((e) => e.id.startsWith(id)).length).toBe(1);
  });
});

describe("run_scene_test 설명", () => {
  it("HM 체인 선행 조건(스타터·가르칠 몬스터)을 적는다", () => {
    const description = getTool("run_scene_test")!.description;
    expect(description).toContain("몬스터 파티는 비어 있다");
    expect(description).toContain("가르칠 파티 몬스터를 선택하세요");
  });
});

describe("define_monster_families ability·machineSkillIds", () => {
  const run = (families: unknown[]) => {
    const draft = structuredClone(base);
    const out = getTool("define_monster_families")!.run(draft, { families, autoGraphics: true } as never) as { summary: string; data: { speciesIds: string[]; failed: { family: string }[] } };
    return { draft, out };
  };
  it("계통 특성·기술머신 제한이 모든 단계에 들어가고 단계 값이 우선한다", () => {
    const skill = base.database.skills[0]!.id;
    const { draft, out } = run([{ family: "otter_line", types: ["water"], ability: { name: "물갈이", kind: "endure" }, machineSkillIds: [skill], stages: [{ name: "수달이" }, { name: "수달왕", ability: { name: "강인함", kind: "statMultiplier", stat: "defense" } }] }]);
    const [a, b] = out.data.speciesIds.map((id) => draft.database.monsterSpecies!.find((s) => s.id === id)!);
    expect(a!.ability?.kind).toBe("endure");
    expect(b!.ability?.kind).toBe("statMultiplier");
    expect(a!.machineSkillIds).toEqual([skill]);
  });
  it("응답 summary 와 data 에 만든 종 id 가 있다", () => {
    const { out } = run([{ family: "owl_line", types: ["normal"], stages: [{ name: "올빼미" }] }]);
    expect(out.summary).toContain("species_owl_line_1");
    expect(out.data.speciesIds).toEqual(["species_owl_line_1"]);
  });
  it("틀린 특성 종류는 그 계통만 실패하고 허용 값을 알려 준다", () => {
    const { out } = run([{ family: "bad_line", types: ["normal"], ability: { name: "x", kind: "flyHigh" }, stages: [{ name: "나쁜이" }] }, { family: "ok_line", types: ["normal"], stages: [{ name: "좋은이" }] }]);
    expect(out.data.failed.map((f) => f.family)).toEqual(["bad_line"]);
    expect(out.data.speciesIds).toEqual(["species_ok_line_1"]);
  });
});
