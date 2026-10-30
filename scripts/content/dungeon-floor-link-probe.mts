// 여러 층 던전 층 잇기 프로브(2026-10-30) — 시드마다 author_beodeul_dungeon 을 floors 2·3 으로 돌려 층마다 계단 잇기가 있는지 본다.
//   bun scripts/content/dungeon-floor-link-probe.mts [type,type...] [maxSeed]
import { createBlankProject } from "../../src/project/defaults/blankProject.ts";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "../../src/editor/tools/dungeonTools.ts";

const types = (process.argv[2] ?? "castle,cave").split(",");
const maxSeed = Number(process.argv[3] ?? 40);
const minSeed = Number(process.argv[4] ?? 1);
let bad = 0, total = 0;
for (const type of types) for (const floors of [2, 3]) {
  const fails: string[] = [];
  for (let seed = minSeed; seed <= maxSeed; seed += 1) {
    total += 1;
    const project = createBlankProject();
    try {
      const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { type, floors, seed, populate: false, ...(type === "tower" ? { direction: "up" } : {}) });
      const d = res.data as { links?: string[]; floorData?: { exitStair: unknown; entryStair: unknown }[] };
      const fd = d.floorData ?? [];
      const missing = fd.slice(0, -1).map((f, i) => (!f.exitStair || !fd[i + 1]!.entryStair ? `${i + 1}(${f.exitStair ? "" : "나가는 계단 없음"}${fd[i + 1]!.entryStair ? "" : " 위층 들어오는 계단 없음"})` : "")).filter(Boolean);
      if ((d.links?.length ?? 0) !== floors - 1 || missing.length) { bad += 1; fails.push(`seed ${seed}: links ${d.links?.length ?? 0}/${floors - 1}, 끊긴 층 ${missing.join(",")} ${(res.warnings ?? []).filter((w) => /계단|자리/u.test(w)).join(" | ").slice(0, 300)}`); }
    } catch (e) { bad += 1; fails.push(`seed ${seed}: ERR ${(e as { code?: string }).code} ${(e as Error).message.slice(0, 120)}`); }
  }
  console.log(`${type} floors ${floors}: ${maxSeed - minSeed + 1 - fails.length}/${maxSeed - minSeed + 1} 연결${fails.length ? "\n  " + fails.join("\n  ") : ""}`);
}
console.log(`합계: ${total - bad}/${total} 통과`);
process.exit(bad ? 1 : 0);
