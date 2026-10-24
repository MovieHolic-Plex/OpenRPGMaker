// 폴른 스타 마을 살림 프로브: 수납 수·가게 재고·빵 정의. stdout = JSON 요약, 프로젝트 JSON 은 RES_OUT 로.
import { serialize } from "../../../src/project/io";
import { writeFileSync } from "node:fs";
const { createChronoBellFlagshipDemo } = await import("../../../src/project/flagship/chronoBell");
const project = createChronoBellFlagshipDemo().project;
const out: Record<string, unknown> = {};
for (const id of ["fs_inn", "fs_apothecary", "fs_bakery_home", "fs_stargazer_home", "fs_lisa_home", "fs_smithy"]) {
  const m = project.maps[id];
  out[id] = m ? { size: `${m.width}x${m.height}`, boxes: m.events.filter((e) => e.id.startsWith("ev_fs_box_")).map((e) => `${e.x},${e.y}`) } : "MISSING";
}
const shops: Record<string, unknown> = {};
for (const m of Object.values(project.maps)) for (const e of m.events) for (const p of e.pages) for (const c of p.commands as { kind: string; itemIds?: string[] }[]) if (c.kind === "shop") shops[e.id] = c.itemIds;
out.shops = shops;
out.breads = (project.database.items ?? []).filter((i) => i.id.startsWith("fs_bread_")).map((i) => `${i.id}:${i.price}`);
out.lisaGate = Object.values(project.maps).flatMap((m) => m.events).filter((e) => e.pages.some((p) => p.id.endsWith("_banned"))).map((e) => `${e.id}@${e.x},${e.y}`);
if (process.env.RES_OUT) writeFileSync(process.env.RES_OUT, serialize(project));
process.stdout.write(JSON.stringify(out, null, 1));
