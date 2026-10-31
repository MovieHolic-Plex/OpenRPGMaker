// Script A/B PoC — compact event map of one built game, for writing the walkthrough binding and for the judge.
//   node scripts/qa/script-ab/dump.mjs <runtime project.json> [--full]
// Per map: size, events (id, name, x,y, trigger, per page: conditions, first lines, command kinds, script names).
import { readFileSync } from "node:fs";

const [file] = process.argv.slice(2);
const full = process.argv.includes("--full");
const p = JSON.parse(readFileSync(file, "utf8"));
const maps = Array.isArray(p.maps) ? p.maps : Object.values(p.maps ?? {});
const texts = (cmds, acc = []) => {
  for (const c of cmds ?? []) {
    if (!c || typeof c !== "object") continue;
    if (c.kind === "showText" || c.kind === "message" || c.kind === "text") acc.push(String(c.body ?? c.text ?? c.lines?.join(" ") ?? "").slice(0, full ? 400 : 60));
    for (const k of Object.keys(c)) {
      const v = c[k];
      if (Array.isArray(v) && v.length && typeof v[0] === "object") { if (Array.isArray(v[0])) v.forEach((b) => texts(b, acc)); else if (v[0]?.commands) v.forEach((b) => texts(b.commands, acc)); else if (v[0]?.kind) texts(v, acc); }
    }
  }
  return acc;
};
const kinds = (cmds, acc = {}) => {
  for (const c of cmds ?? []) {
    if (!c || typeof c !== "object") continue;
    acc[c.kind] = (acc[c.kind] ?? 0) + 1;
    for (const k of Object.keys(c)) {
      const v = c[k];
      if (Array.isArray(v) && v.length && typeof v[0] === "object") { if (Array.isArray(v[0])) v.forEach((b) => kinds(b, acc)); else if (v[0]?.commands) v.forEach((b) => kinds(b.commands, acc)); else if (v[0]?.kind) kinds(v, acc); }
    }
  }
  return acc;
};
const out = { start: { mapId: p.startMapId ?? p.system?.startMapId, x: p.startX ?? p.system?.startX, y: p.startY ?? p.system?.startY },
  items: (() => { const used = JSON.stringify(maps); return Object.values(p.database?.items ?? p.items ?? {}).filter((i) => used.includes(i.id)).map((i) => `${i.id}:${i.name}`); })(),
  variables: (p.variables ?? []).filter((v) => v.name || JSON.stringify(maps).includes(`"${v.id}"`)), switches: (p.switches ?? []).filter((v) => JSON.stringify(maps).includes(`"${v.id}"`)), maps: [] };
for (const m of maps) {
  out.maps.push({ id: m.id, name: m.name, size: `${m.width}x${m.height}`, events: (m.events ?? []).map((e) => ({
    id: e.id, name: e.name, at: [e.x, e.y],
    pages: (e.pages ?? []).map((pg) => ({ trigger: pg.trigger, cond: pg.conditions ?? pg.condition, kinds: kinds(pg.commands ?? pg.list),
      lines: texts(pg.commands ?? pg.list).slice(0, full ? 50 : 3),
      scripts: (pg.commands ?? []).filter((c) => c?.kind === "script").map((c) => full ? c.source : `${c.name ?? "(script)"} ${String(c.source ?? "").length}ch`) })),
  })) });
}
console.log(JSON.stringify(out, null, full ? 1 : 0).slice(0, full ? 1e7 : 60000));
