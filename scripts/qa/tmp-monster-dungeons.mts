import fs from "node:fs";
import path from "node:path";
import { createMonsterExpedition } from "../../src/project/examples/monsterExpedition/index.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { store } from "../../src/project/store.ts";
const out = process.argv[2]!;
fs.mkdirSync(out, { recursive: true });
const r = createMonsterExpedition({ gymCount: 8 } as never);
const project = (r as any).project ?? r;
store.loadProject?.(project);
for (const m of Object.values((project as any).maps) as any[]) {
  if (!/cave|echo|ice|ghost|hideout|ruin|tower|observ|mine|volcan|lava/i.test(m.id + m.name)) continue;
  const { png } = renderMapPng(project as never, m);
  fs.writeFileSync(path.join(out, `${m.id}.png`), png);
  console.log(m.id, m.name, m.width, m.height, m.tilesetId, m.mapRole);
}
