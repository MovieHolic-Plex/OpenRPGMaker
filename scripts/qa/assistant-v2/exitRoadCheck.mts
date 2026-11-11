// 구성기 출구 길 재기(모델 없음): exits 를 받는 세계의 바깥 장소 종류마다 씨앗 여럿으로 «그 변까지 길을 내라»를 주문하고,
// 지은 맵의 그 변에 길 입구(edgeRoadMouths)가 생겼는지 센다. 구성기의 exits 처리를 고친 뒤 종류·변·씨앗별 성공률을 볼 때 쓴다.
//   bun scripts/qa/assistant-v2/exitRoadCheck.mts [씨앗 수=6] [세계 id…]
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { WORLDS } from "../../../src/ai/v2/place/world.ts";
import { edgeRoadMouths } from "../../../src/ai/v2/place/roadMouths.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const seeds = Number(process.argv[2] ?? 6);
const only = process.argv.slice(3);
const SIDES = ["east", "west", "north"] as const;
let asked = 0, laid = 0;
for (const world of WORLDS) {
  if (!world.composer?.exits || (only.length && !only.includes(world.id))) continue;
  for (const kind of world.kinds) {
    if (kind.indoor || !kind.compose) continue;
    const tally = new Map<string, number>(), natural = new Map<string, number>();
    let failed = 0;
    for (let seed = 1; seed <= seeds; seed++) for (const side of SIDES) {
      const build = (exits: readonly string[]) => {
        const project = createBlankProject();
        const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
        const tool = kind.compose!.tool ?? world.composer!.tool;
        let mapId: string | undefined;
        if (!world.composer!.newMap) mapId = (runTool(ctx, "create_map", { name: "t", width: kind.compose!.size[0], height: kind.compose!.size[1], tilesetId: world.tilesetId }).data as { mapId?: string } | undefined)?.mapId;
        const res = runTool(ctx, tool, { ...(mapId ? { mapId } : { newMap: { name: "t" } }), [world.composer!.param]: kind.compose!.value, seed, ...(exits.length ? { exits } : {}) });
        const map = ctx.project.maps[((res.data ?? {}) as { mapId?: string }).mapId ?? mapId ?? ""];
        return res.ok && map ? edgeRoadMouths(ctx.project, map).map((m) => m.side) : undefined;
      };
      const before = side === SIDES[0] ? build([]) : undefined;
      if (before) for (const s of new Set(before)) natural.set(s, (natural.get(s) ?? 0) + 1);
      const after = build([side]);
      if (!after) { failed += 1; continue; }
      asked += 1;
      if (after.includes(side)) { laid += 1; tally.set(side, (tally.get(side) ?? 0) + 1); }
    }
    console.log(`${world.id.padEnd(14)} ${kind.id.padEnd(14)} 주문한 변에 길 입구: ${SIDES.map((s) => `${s} ${tally.get(s) ?? 0}/${seeds}`).join(" · ")} | 주문 없이 있는 입구(씨앗 ${seeds}개): ${[...natural].map(([s, n]) => `${s} ${n}`).join(" · ") || "없음"}${failed ? ` | 못 지음 ${failed}` : ""}`);
  }
}
console.log(`합계: 주문 ${asked} · 길이 난 것 ${laid} (${asked ? Math.round((laid / asked) * 100) : 0}%)`);
