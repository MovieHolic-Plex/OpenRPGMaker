// editor/tools/planGridBuild.ts
// build_from_plan — 도안을 읽은 칸 도면(ai/planGrid.ts)을 맵으로 그대로 짓는다(2026-11-05 plan-to-grid). 빌더 인자로 바꿔 빌더가 다시 배치하던 옛 길은
// 방을 옮기고 늘려 도안이 사라졌다. 이제 던전·성은 lay_dungeon_layout, 마을·숲은 lay_village_layout, 집 실내는 build_hand_interior_room 이 도면 칸을 그대로 깐다.
// 칩셋에 없어 놓지 못한 도안 물건은 결과 data.missing 으로 돌려준다 — 조수가 generate_missing_object 로 만든다(#4331).
import { compilePlan, parsePlanCode, type PlanCode } from "@/ai/planGrid";
import { bboxDungeonCatalog } from "../dungeonKit/bboxFloor";
import { BBOX_PLACE_TOOLS } from "./bboxPlaceTools";
import { bboxVillageCatalog, checkBboxVillage } from "./bboxVillage";
import { HAND_INTERIOR_TOOLS } from "./handInteriorTools";
import { planToDungeon } from "./planGridDungeon";
import { planToInterior, type InteriorPart } from "./planGridInterior";
import { planToVillage } from "./planGridVillage";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

let lastPlan: PlanCode | null = null;
/** 이번 턴 도안을 읽은 칸 도면 — editor/imagePlanMockup.ts 가 읽기 직후 넣는다. */
export function setPlanGrid(code: PlanCode | null): void { lastPlan = code; }
export function getPlanGrid(): PlanCode | null { return lastPlan; }

const TEMPLE = /신전|사원|피라미드|파라오|아누비스|temple|pyramid/iu;

function interiorParts(draft: Parameters<ToolDefinition["run"]>[0]): InteriorPart[] {
  const list = HAND_INTERIOR_TOOLS.find((t) => t.name === "list_hand_interior_parts")!;
  const base = (list.run(draft, {}) as ToolExecResult).data as { objectCategories: { id: string }[] };
  const out: InteriorPart[] = [];
  for (const c of base.objectCategories) {
    const r = (list.run(draft, { category: c.id }) as ToolExecResult).data as { objects?: InteriorPart[] };
    for (const o of r.objects ?? []) out.push({ id: o.id, ko: o.ko, kind: o.kind, w: o.w, h: o.h });
  }
  return out;
}

export const BUILD_FROM_PLAN_TOOL: ToolDefinition = {
  name: "build_from_plan",
  description: "그림 도안을 칸 단위로 읽은 도면(구역·길·물건·입구)을 맵으로 그대로 짓는다 — 던전·성은 칸 배치 던전, 마을·숲은 코드 지형 위 칸 배치, 집 실내는 손 도트 실내. "
    + "[그림 도안] 메모가 이 도구를 부르라고 할 때만 쓴다. 인자 없이 부르면 이번 턴에 읽은 도면을 쓴다. 지은 맵 id·놓지 못한 도안 물건(data.missing: 이름·칸·크기)·도면에 맞추려고 고친 것(warnings)을 돌려준다. "
    + "missing 의 물건은 비슷한 것으로 때우지 말고 generate_missing_object 로 만든다(물건마다 한 번, base 는 그 칸).",
  mode: "write",
  domains: ["map", "tile"],
  parameters: { type: "object", properties: { name: { type: "string", description: "새 맵 이름" }, plan: { type: "object", description: "(선택) 도면 코드 — 생략하면 이번 턴에 읽은 도면" } }, required: [] },
  run(draft, args): ToolExecResult {
    const given = args.plan && typeof args.plan === "object" ? args.plan as Record<string, unknown> : null;
    const code = given && lastPlan ? parsePlanCode(given, lastPlan.subject, lastPlan.cols, lastPlan.rows) ?? lastPlan : lastPlan;
    if (!code) throw new ToolError("읽은 도면이 없다 — 이번 턴에 그림 도안을 읽지 못했다. 평소 빌더로 짓는다.", { code: "no-plan" });
    const g = compilePlan(code);
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : code.zones[0]?.name ?? "도안 맵";
    const subject = code.subject;
    if (subject === "dungeon" || subject === "castle") {
      const ts = draft.tilesets.beodeul_city;
      if (!ts) throw new ToolError("버들항 칩셋이 이 프로젝트에 없다.", { code: "tileset-missing" });
      const theme = subject === "castle" ? "castle" : code.zones.some((z) => TEMPLE.test(z.name)) ? "temple" : "catacomb";
      const res = planToDungeon(g, theme, bboxDungeonCatalog(ts));
      const lay = BBOX_PLACE_TOOLS.find((t) => t.name === "lay_dungeon_layout")!;
      const r = lay.run(draft, { layout: res.layout, name }) as ToolExecResult;
      const mapId = (r.data as { mapId: string }).mapId;
      return { summary: `도안 도면 그대로 지음: ${name} (${res.layout.map!.w}×${res.layout.map!.h}, 방 ${res.layout.rooms!.length})`, warnings: [...res.notes, ...(r.warnings ?? [])], data: { mapId, kind: "dungeon", missing: res.missing, rowMap: res.rowMap, dx: res.dx } };
    }
    if (subject === "village" || subject === "forest") {
      const ts = draft.tilesets.beodeul_city;
      if (!ts) throw new ToolError("버들항 칩셋이 이 프로젝트에 없다.", { code: "tileset-missing" });
      const cat = bboxVillageCatalog(ts);
      const res = planToVillage(g, cat);
      const rep = res.repair((L, T) => checkBboxVillage(cat, L, T));
      if (!rep.ok) throw new ToolError(`도면을 마을 규칙에 맞추지 못했다(fallback): ${rep.errors.slice(0, 6).join(" | ")}`, { code: "plan-fallback" });
      const lay = BBOX_PLACE_TOOLS.find((t) => t.name === "lay_village_layout")!;
      const r = lay.run(draft, { layout: rep.layout, terrain: res.terrain, name }) as ToolExecResult;
      const mapId = (r.data as { mapId: string }).mapId;
      return { summary: `도안 도면 그대로 지음: ${name} (${res.terrain.W}×${res.terrain.H})`, warnings: [...res.notes, ...(r.warnings ?? [])], data: { mapId, kind: "village", missing: res.missing } };
    }
    const res = planToInterior(g, interiorParts(draft));
    const build = HAND_INTERIOR_TOOLS.find((t) => t.name === "build_hand_interior_room")!;
    const args2: Record<string, unknown> = { name, floor: "plank", wall: "plaster", ...res.args };
    const dropped: string[] = [];
    for (let k = 0; k < 8; k += 1) {
      try { build.run(structuredClone(draft), args2); break; } catch (e) {
        const bad = new Set([...String((e as Error).message).matchAll(/\(([^()]+)\) @\((\d+),(\d+)\)/gu)].map((m) => `${m[1]}@${m[2]},${m[3]}`));
        const objs = args2.objects as { id: string; x: number; y: number }[];
        const keep = objs.filter((o) => !bad.has(`${o.id}@${o.x},${o.y}`));
        if (keep.length === objs.length) break;
        dropped.push(...objs.filter((o) => !keep.includes(o)).map((o) => o.id));
        args2.objects = keep;
      }
    }
    const r = build.run(draft, args2) as ToolExecResult;
    const mapId = (r.data as { mapId?: string } | undefined)?.mapId ?? Object.keys(draft.maps).at(-1)!;
    return { summary: `도안 도면 그대로 지음: ${name} (방 ${res.args.rooms.length}, 가구 ${(args2.objects as unknown[]).length})`, warnings: [...res.notes, ...(dropped.length ? [`자리가 맞지 않아 뺀 가구: ${dropped.join(", ")}`] : []), ...(r.warnings ?? [])], data: { mapId, kind: "interior", missing: res.missing } };
  },
};
