// bun scripts/content/interior-authored/check.mts --out <dir> [--ids a,b] — 손으로 짠 견본마다 그 크기 그대로 방 하나를 짓기 도구(견본 길)로 지어
// 고른 견본·심은/뺀 가구 수·닿지 못한 바닥·맨바닥 비율·1배/3배 PNG 를 낸다. 먼저 build.mts 로 JSON 을 굽는다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { measureInteriorBareFloor } from "../../../src/editor/handInterior/bareFloor.ts";
import { roomTemplates } from "../../../src/editor/handInterior/templates.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { AUTHORED_MAP_PREFIX } from "./lib.mts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const out = path.resolve(opt("out") ?? "/tmp/authored-check");
const ids = opt("ids")?.split(",").map((s) => `${AUTHORED_MAP_PREFIX}${s}`);
fs.mkdirSync(out, { recursive: true });
const mine = roomTemplates("atlas_biome_interior").filter((t) => t.map.startsWith(AUTHORED_MAP_PREFIX) && (!ids || ids.includes(t.id)));
const rows: Record<string, unknown>[] = [];
for (const t of mine) {
  const project = createBlankProject() as Project;
  const run = createBuildRun({ project, currentMapId: project.startMapId });
  const r = run.call("build_hand_interior_room", { tileset: "atlas_biome_interior", name: t.id, layout: { rooms: [{ id: "r", kind: t.kind, w: t.w, h: t.h }], seed: 1, styleVariant: "A" } });
  const data = r.data as { mapId?: string; unreachedFloor?: unknown[]; layout?: { rooms?: { template?: string; furniture?: { placed: number; dropped: number } }[] } } | undefined;
  const map = data?.mapId ? run.ctx.project.maps[data.mapId] : undefined;
  const room = data?.layout?.rooms?.[0];
  const name = t.id.slice(AUTHORED_MAP_PREFIX.length);
  if (!r.ok || !map) { rows.push({ id: name, ok: false, why: String(r.summary).slice(0, 200) }); continue; }
  const png = renderMapPng(run.ctx.project, map, 1).png;
  fs.writeFileSync(path.join(out, `${name}.png`), png);
  const bare = measureInteriorBareFloor(run.ctx.project, map)?.pct;
  rows.push({ id: name, kind: t.kind, size: `${t.w}x${t.h}`, template: room?.template === t.id ? "ok" : `OTHER ${room?.template}`, placed: room?.furniture?.placed, dropped: room?.furniture?.dropped, missing: (room?.furniture as { missing?: string[] } | undefined)?.missing?.join(";"), unreached: data?.unreachedFloor?.length ?? -1, bare, map: `${map.width}x${map.height}`, warnings: (r.data as { warnings?: string[] })?.warnings?.length ?? 0 });
  fs.writeFileSync(path.join(out, `${name}.txt`), `${r.summary}\n${((r.data as { warnings?: string[] })?.warnings ?? []).join("\n")}\n`);
}
const lines = rows.map((x) => Object.entries(x).map(([k, v]) => `${k}=${v}`).join(" "));
console.log(lines.join("\n"));
fs.writeFileSync(path.join(out, "check.json"), JSON.stringify(rows, null, 1));
const html = `<!doctype html><meta charset=utf-8><title>authored rooms</title><style>body{background:#222;color:#ddd;font:13px sans-serif}div{display:inline-block;margin:8px;vertical-align:top}img{image-rendering:pixelated;width:auto;height:auto;zoom:3}</style>
${rows.map((x) => `<div><b>${x.id}</b> ${x.kind ?? ""} ${x.size ?? ""}<br>placed ${x.placed} dropped ${x.dropped} unreached ${x.unreached} bare ${x.bare}% ${x.template}<br>${x.ok === false ? `FAIL ${x.why}` : `<img src="${x.id}.png">`}</div>`).join("\n")}`;
fs.writeFileSync(path.join(out, "index.html"), html);
