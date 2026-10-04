// Every adjacent height contact from a reloaded canonical SQLite project, rendered with native pixels.
// Usage: bun scripts/capture/inspect-terrain-seams.mts --project <folder> --out <folder>
import fs from "node:fs";
import path from "node:path";
import { openLocalProjectStore } from "../../electron/local-store/store";
import { renderMapPng } from "../qa-game/render.mts";
import { cellLift, reliefLiftField } from "../../src/project/relief/screen";
import { hasRelief, reliefSlopes } from "../../src/project/relief/walk";
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]!; };
const folder = path.resolve(arg("project", ".vite-cache/terrain-seams/project")), out = path.resolve(arg("out", "verify-shots/terrain-seams/current"));
const storage = await openLocalProjectStore({ projectDir: folder });
const snapshot = storage.loadSnapshot()!, projectId = storage.info().projectId; storage.close();
const maps = [];
for (const map of Object.values(snapshot.project.maps)) {
  if (!hasRelief(map.relief)) continue;
  const r = map.relief, field = reliefLiftField(r), contacts = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) for (const [dx, dy, dir] of [[1, 0, "e"], [0, 1, "s"]] as const) {
    if (x + dx >= map.width || y + dy >= map.height) continue;
    const a = cellLift(field, x, y), b = cellLift(field, x + dx, y + dy);
    if (Math.abs(a - b) > .01) contacts.push({ id: contacts.length + 1, x, y, dir, a, b });
  }
  const rendered = renderMapPng(snapshot.project, map); if (rendered.note) throw new Error(rendered.note);
  const mapOut = path.join(out, map.id); fs.mkdirSync(mapOut, { recursive: true });
  fs.writeFileSync(path.join(mapOut, "full-map.png"), rendered.png);
  const pad = Math.ceil(field.maxLift) * 16;
  fs.writeFileSync(path.join(mapOut, "contacts.json"), JSON.stringify({ mapId: map.id, width: map.width, height: map.height, pad, total: contacts.length, contacts }, null, 2));
  maps.push({ mapId: map.id, tilesetId: map.tilesetId, contacts: contacts.length, slopes: reliefSlopes(r) });
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ projectId, storage: folder, revision: snapshot.revision, sha256: snapshot.sha256, reloaded: true, maps }, null, 2));
console.log(JSON.stringify({ projectId, revision: snapshot.revision, maps: maps.map(m => [m.mapId, m.contacts]) }));
