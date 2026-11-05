#!/usr/bin/env node
// Plant known defects into a copy of a shipped project.json, served by the overlay as <version>~<plant>.
// Each plant is one realistic authoring mistake on a randomly chosen (seeded) map/event, and its ground truth
// (where it is, what a player would see, which detector should catch it) is written next to it.
//
// usage: node vm/plant.mjs --cache <mirror> --slug fallen-star --version 1.37 --plant p1 --out <plantsDir> [--seed 7]
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { walkCommands } from "../lib/plan.mjs";

const { values } = parseArgs({
  options: {
    cache: { type: "string", default: "/root/vqa-sinkiru/mirror" },
    slug: { type: "string" }, version: { type: "string" }, plant: { type: "string", default: "p1" },
    out: { type: "string" }, seed: { type: "string", default: "7" },
    // Plants go only where the coverage plan looks, so catch rate measures detection, not plan coverage
    // (plan coverage is reported separately in coverage-plan.json).
    jobs: { type: "string", default: "" },
  },
});
const planned = values.jobs ? JSON.parse(fs.readFileSync(values.jobs, "utf8")) : null;
const plannedEvents = planned ? new Set(planned.map((j) => j.target?.eventId).filter(Boolean)) : null;
const plannedMaps = planned ? new Map(planned.filter((j) => j.kind === "map").map((j) => [j.target.mapId, j.checkpoint])) : null;
const project = JSON.parse(fs.readFileSync(path.join(values.cache, values.slug, values.version, "project.json"), "utf8"));
let s = Number(values.seed);
const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const used = new Set();

const events = [];
for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
  if (plannedEvents && !plannedEvents.has(event.id)) continue;
  const job = planned?.find((j) => j.target?.eventId === event.id);
  const page = job ? event.pages?.[job.target.page] : (event.pages ?? []).find((p) => p.trigger?.kind === "action" && (p.conditions ?? []).length === 0);
  if (!page) continue;
  const kinds = new Set();
  walkCommands(page.commands, (c) => kinds.add(c.kind));
  events.push({ map, event, page, kinds });
}
const take = (filter) => {
  const pool = events.filter((e) => !used.has(e.event.id) && filter(e));
  if (pool.length === 0) return null;
  const e = pick(pool);
  used.add(e.event.id);
  return e;
};
const firstText = (page) => { let t = null; walkCommands(page.commands, (c) => { if (!t && c.kind === "text") t = c; }); return t; };
const plants = [];
const add = (p, e) => plants.push({ id: `${values.plant}-${plants.length + 1}`, mapId: e.map.id, mapName: e.map.name, eventId: e.event.id, x: e.event.x, y: e.event.y, ...p });

// 1. Garbled text (mojibake) in an NPC line — only a reader of the screen can catch it.
{ const e = take((x) => x.kinds.has("text") && !x.kinds.has("shop")); if (e) { const t = firstText(e.page); const before = t.body; t.body = "ë¸Œëžœ ì§€ê¸ˆ ìˆ²ìœ¼ë¡œ ê°€ì•¼ í•´ìš”"; add({ type: "garbled-text", expect: "observer C10", visible: "대사창에 깨진 문자열(모지바케)", before: before.slice(0, 60) }, e); } }
// 2. Text that contradicts the scene: speaker name swapped to a character who is not present.
{ const e = take((x) => x.kinds.has("text") && !x.kinds.has("shop")); if (e) { const t = firstText(e.page); t.body = "TODO: 여기에 대사 넣기 (placeholder)"; add({ type: "placeholder-text", expect: "observer C10/C05", visible: "대사창에 'TODO: 여기에 대사 넣기 (placeholder)'", before: "" }, e); } }
// Plants must survive the player's load-time reference validation (a dangling id refuses the whole project, which
// is a boot failure, not a planted defect) — so every plant below points at ids that exist.
// 3. Wrong portrait: the speaker's bust is swapped for a background picture resource.
{ const picture = (project.resourceProfiles ?? []).find((r) => r.kind === "picture" && /panorama|scenery|background|title/i.test(`${r.assetId} ${r.name}`)) ?? (project.resourceProfiles ?? []).find((r) => r.kind === "picture");
  const e = picture && take((x) => x.kinds.has("changeFace")); if (e) { walkCommands(e.page.commands, (c) => { if (c.kind === "changeFace") c.resourceId = picture.assetId; }); add({ type: "wrong-portrait", expect: "observer C04/C16/C05", visible: `대사 초상 자리에 배경 그림(${picture.assetId})`, detail: picture.assetId }, e); } }
// 4. Endless loop: the event never returns control (soft-lock).
{ const e = take((x) => x.kinds.has("text") && !x.kinds.has("shop") && !x.kinds.has("transfer")); if (e) { e.page.commands.push({ kind: "loop", body: [{ kind: "wait", ms: 200 }] }); add({ type: "soft-lock-loop", expect: "deterministic stuck + static endless-loop", visible: "대사 후 조작 불가" }, e); } }
// 5. Transfer to coordinates outside the destination map.
{ const tr = []; for (const m of Object.values(project.maps)) for (const ev of m.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (c.kind === "transfer" && project.maps[c.mapId] && !used.has(ev.id)) tr.push({ map: m, event: ev, c }); });
  const t = pick(tr.filter((x) => !plannedEvents || plannedEvents.has(x.event.id))); if (t) { used.add(t.event.id); const dest = project.maps[t.c.mapId]; t.c.x = dest.width + 5; t.c.y = dest.height + 3; add({ type: "out-of-bounds-transfer", expect: "static bad-transfer", visible: `${dest.name ?? dest.id} 밖으로 이동`, detail: `${t.c.mapId} (${t.c.x},${t.c.y})` }, { map: t.map, event: t.event }); } }
// 6. Shop item whose name is far too long for the shop row (an authoring slip that clips in the list).
{ const e = take((x) => x.kinds.has("shop")); if (e) { let first = null; walkCommands(e.page.commands, (c) => { if (c.kind === "shop" && !first) first = (c.itemIds ?? [])[0]; });
  const item = [...(project.database.items ?? []), ...(project.database.equipment ?? [])].find((i) => i.id === first);
  if (item) { const before = item.name; item.name = `${item.name}의 전설적인 고대 왕국 대마법사 특제 강화판`; add({ type: "long-shop-name", expect: "deterministic text-clipped, observer C01/C14", visible: `상점 목록 '${item.name}' 잘림`, before }, e); } } }
// 7. NPC drawn with a nonsensical charset pattern: a valid sprite, but the pattern index points past the sheet's
//    frames, so the NPC renders as a wrong/partial cell (or nothing).
{ const e = take((x) => x.page.graphic?.sprite && Number.isInteger(x.page.graphic.pattern)); if (e) { const before = e.page.graphic.pattern; e.page.graphic.pattern = before + 977; add({ type: "broken-npc-sprite", expect: "deterministic missing-texture, observer C04", visible: "NPC 그림이 엉뚱한 칸이거나 비어 있음", detail: `pattern ${before} -> ${before + 977}` }, e); } }
// 8. A hole of void tiles in a visited map, next to the map entry.
{ const maps = Object.values(project.maps).filter((m) => (m.lowerTiles ?? []).length === m.width * m.height && m.width >= 16 && m.height >= 12 && !plants.some((p) => p.mapId === m.id) && (!plannedMaps || plannedMaps.has(m.id)));
  const m = pick(maps); if (m) { const at = plannedMaps?.get(m.id); const cx = Math.min(m.width - 5, Math.max(4, (at?.x ?? Math.floor(m.width / 2)) + 3)), cy = Math.min(m.height - 4, Math.max(3, (at?.y ?? Math.floor(m.height / 2)) - 3)); for (let y = cy - 3; y <= cy + 3; y += 1) for (let x = cx - 4; x <= cx + 4; x += 1) { m.lowerTiles[y * m.width + x] = -1; if (m.upperTiles) m.upperTiles[y * m.width + x] = -1; }
    plants.push({ id: `${values.plant}-${plants.length + 1}`, mapId: m.id, mapName: m.name, eventId: null, x: cx, y: cy, type: "void-tiles", expect: "observer C08", visible: `${m.name ?? m.id} 가운데 9x7 칸이 비어 검게 보임` }); } }

fs.mkdirSync(values.out, { recursive: true });
fs.writeFileSync(path.join(values.out, `${values.slug}@${values.version}~${values.plant}.json`), JSON.stringify(project));
fs.writeFileSync(path.join(values.out, `${values.slug}@${values.version}~${values.plant}.truth.json`), JSON.stringify(plants, null, 1));
console.log("PLANTED " + JSON.stringify(plants.map((p) => `${p.id}:${p.type}@${p.mapId}/${p.eventId ?? "-"}`)));
