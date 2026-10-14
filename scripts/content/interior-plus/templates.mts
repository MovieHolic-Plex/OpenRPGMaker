// interior-plus 방 견본 — 박물관·배 안·투기장 예제 평면(tiledata/hand-interior/plus/plans/*.json)을 방 사각형 단위로 잘라
// 「방 크기·바닥·벽면·가구 배치(방 안 상대 좌표)」를 뽑는다. extract.mts(v5·일본 집·캠퍼스)와 같은 꼴이지만 파일을 따로 둔다
// (공용 interiorRoomTemplates.json 한 줄을 여러 PR 이 같이 고치지 않게). templates.ts 가 배열을 이어 붙인다.
//   bun scripts/content/interior-plus/templates.mts   → src/assets/interiorPlusRoomTemplates.json
import fs from "node:fs";
import { buildHandInteriorLayers, HAND_INTERIOR_SPECS, type HandInteriorInput } from "../../../src/editor/handInterior/builder.ts";
import { createAtlasBiomeInteriorTileset } from "../../../src/project/defaults/atlasBiomeInterior.ts";
import type { InteriorRoomTemplate, InteriorTemplateItem } from "../../../src/editor/handInterior/templates.ts";

const OUT = "src/assets/interiorPlusRoomTemplates.json";
const DIR = "tiledata/hand-interior/plus/plans";
const TID = "atlas_biome_interior";
const S = HAND_INTERIOR_SPECS[TID]!;
const tileset = createAtlasBiomeInteriorTileset();
const templates: InteriorRoomTemplate[] = [];
const programs: Record<string, { map: string; kinds: string[] }[]> = {};

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const map = f.replace(/\.json$/, "");
  const ex = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8"));
  const inside = (r: any, x: number, y: number) => r.x0 <= x && x <= r.x1 && r.y0 <= y && y <= r.y1;
  const kinds: string[] = [];
  for (const r of ex.rooms as any[]) {
    const items: InteriorTemplateItem[] = [];
    const rel = (x: number, y: number) => ({ x: x - r.x0, y: y - r.y0 });
    for (const o of ex.objects ?? []) if (inside(r, o.x, o.y)) items.push({ t: "o", id: o.id, ...rel(o.x, o.y) });
    for (const t of ex.tables ?? []) if (inside(r, t.x, t.y)) items.push({ t: "t", id: t.style, ...rel(t.x, t.y), w: t.w, h: t.h });
    for (const g of ex.goods ?? []) if (inside(r, g.x, g.y)) items.push({ t: "g", id: g.id, ...rel(g.x, g.y) });
    for (const d of ex.daises ?? []) if (inside(r, d.x, d.y)) items.push({ t: "d", id: d.id, ...rel(d.x, d.y), w: d.w, h: d.h });
    for (const l of ex.lines ?? []) {
      const cs = (l.cells ?? []).filter((c: any) => inside(r, c.x, c.y));
      if (cs.length) items.push({ t: "l", id: l.id, x: 0, y: 0, cells: cs.map((c: any) => [c.x - r.x0, c.y - r.y0] as [number, number]) });
    }
    templates.push({ id: `${map}:${r.id}`, map, building: ex.building ?? map, kind: r.kind, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1,
      floor: r.floor ?? ex.floor, wall: r.wall ?? ex.wall, items });
    kinds.push(r.kind);
  }
  (programs[ex.building ?? map] ??= []).push({ map, kinds });
}

// 견본마다 옮겨 심기 시험(extract.mts 와 같다): 같은 크기 네모 방 하나에 심어 오류가 나는 가구는 뺀다.
let dropped = 0;
for (const t of templates) {
  const plan = ["#".repeat(t.w + 2), ...Array.from({ length: t.h }, () => `#${".".repeat(t.w)}#`), "#".repeat(t.w + 2)];
  plan[plan.length - 1] = plan[plan.length - 1]!.slice(0, 1 + Math.floor(t.w / 2)) + "." + plan[plan.length - 1]!.slice(2 + Math.floor(t.w / 2));
  const put = (it: InteriorTemplateItem) => ({ ...it, x: it.x + 1, y: it.y + 1 });
  const keep: InteriorTemplateItem[] = [];
  for (const it of t.items) {
    const trial = [...keep, it].map(put);
    const input: HandInteriorInput = { plan, floor: t.floor, wall: t.wall,
      objects: trial.filter((i) => i.t === "o").map((i) => ({ id: i.id, x: i.x, y: i.y })),
      tables: trial.filter((i) => i.t === "t").map((i) => ({ style: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! })),
      goods: trial.filter((i) => i.t === "g").map((i) => ({ id: i.id, x: i.x, y: i.y })),
      daises: trial.filter((i) => i.t === "d").map((i) => ({ id: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! })),
      lines: trial.filter((i) => i.t === "l").map((i) => ({ id: i.id, cells: i.cells!.map(([x, y]) => ({ x: x + 1, y: y + 1 })) })) };
    const errs = buildHandInteriorLayers(input, tileset, S).issues.filter((i) => i.severity === "error" && i.code !== "no-entrance");
    if (errs.length) { dropped++; console.log(`  뺌 ${t.id} ${it.id}: ${errs[0]!.code} ${errs[0]!.message.slice(0, 80)}`); continue; }
    keep.push(it);
  }
  t.items = keep;
}
fs.writeFileSync(OUT, JSON.stringify({ version: 1, templates: { [TID]: templates }, programs: { [TID]: programs } }) + "\n");
console.log(`방 견본 ${templates.length} · 종류 ${new Set(templates.map((t) => t.kind)).size} · 건물 ${Object.keys(programs).length} · 뺀 가구 ${dropped}`);
