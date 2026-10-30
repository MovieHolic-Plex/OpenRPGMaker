// bbox-dungeon: pick up the dungeon object pool at run time (another agent's object-gen output; local experiment only, never bundled).
// Folders: $BBD_POOL (":"-separated dirs) or every ~/z-project/assistant-whole-game/suite/rooms/objpool/<dir> whose name mentions
// beodeul or dungeon. Each item = <slug>.json (+ <slug>.png, 16px grid), same schema as the other objpool folders.
// Each piece is baked into the beodeul_city tileset (bakeWorkshopObject) and added to PIECES under its English name.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { PIECES } from "./pieces.mts";

export const POOL_CLASS: Record<string, "wall" | "floor" | "decal"> = {};
export const POOL_NAMES = new Set<string>();

const T = 16;
const kindOf = (s: string) => /\bhang|wall[- ]?mount|on the (wall )?face|mounted/i.test(s) ? "hang" : /against[- ]?(the )?wall/i.test(s) ? "wall" : /\bflat\b|decal|walkable|rug|mat\b|floor patch/i.test(s) ? "flat" : "floor";
const wh = (fp: unknown): [number, number] | null => {
  if (fp && typeof fp === "object" && !Array.isArray(fp)) return [Number((fp as any).w) || 1, Number((fp as any).h) || 1];
  if (Array.isArray(fp) && fp.length >= 2) return [Number(fp[0]), Number(fp[1])];
  const m = String(fp ?? "").match(/(\d+)\s*[x×]\s*(\d+)/u); return m ? [Number(m[1]), Number(m[2])] : null;
};

export function poolDirs(): string[] {
  if (process.env.BBD_POOL !== undefined) return process.env.BBD_POOL.split(":").filter(Boolean);
  const root = resolve(homedir(), "z-project/assistant-whole-game/suite/rooms/objpool");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_") && /beodeul|dungeon/i.test(d.name)).map((d) => resolve(root, d.name));
}

/** Bake every pool item into project.tilesets[tilesetId]; returns how many were added. Safe to call when the pool is empty. */
export async function loadPool(project: any, tilesetId = "beodeul_city"): Promise<number> {
  const dirs = poolDirs(); if (!dirs.length) return 0;
  const { bakeWorkshopObject, workshopAssetId } = await import("../../../src/project/workshopTiles");
  const { PNG } = await import("pngjs");
  let n = 0;
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
      const png = resolve(dir, f.replace(/\.json$/u, ".png"));
      if (!existsSync(png)) continue;
      let r: any; try { r = JSON.parse(readFileSync(resolve(dir, f), "utf8")); } catch { continue; }
      const img = PNG.sync.read(readFileSync(png));
      const cols = Math.round(img.width / T), rows = Math.round(img.height / T);
      if (!cols || !rows) continue;
      const slug = String(r.id ?? f.replace(/\.json$/u, "")).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
      const kind = kindOf(String(r.anchor ?? "") + " " + (typeof r.placement === "string" ? r.placement : JSON.stringify(r.placement ?? "")));
      let [, h] = wh(r.footprint) ?? [cols, 1];
      if (kind === "hang") h = 0;
      if ((kind === "floor" || kind === "wall") && /tall|column/u.test(String(r.gate_kind ?? "")) && rows > 1) h = 1;
      const foot = kind === "floor" || kind === "wall" ? Math.max(1, Math.min(rows, h)) : 0;
      const cells: { sourceTile: number; dx: number; dy: number }[] = []; const tiles: Buffer[] = [];
      for (let dy = 0; dy < rows; dy += 1) for (let dx = 0; dx < cols; dx += 1) {
        const b = Buffer.alloc(T * T * 4); let any = false;
        for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) { const s = ((dy * T + y) * img.width + dx * T + x) * 4; if (s + 3 >= img.data.length) continue; img.data.copy(b, (y * T + x) * 4, s, s + 4); if (img.data[s + 3]! > 0) any = true; }
        if (any) { cells.push({ sourceTile: tiles.length, dx, dy }); tiles.push(b); }
      }
      if (!cells.length) continue;
      const sheet = new PNG({ width: 30 * T, height: Math.ceil(tiles.length / 30) * T });
      tiles.forEach((b, i) => { const ox = (i % 30) * T, oy = Math.floor(i / 30) * T; for (let y = 0; y < T; y += 1) b.copy(sheet.data, ((oy + y) * sheet.width + ox) * 4, y * T * 4, (y + 1) * T * 4); });
      const dataUrl = `data:image/png;base64,${PNG.sync.write(sheet).toString("base64")}`;
      const id = `workshop:pool-${slug}`;
      bakeWorkshopObject(project, tilesetId, { objectId: id, title: String(r.name_en ?? r.name ?? slug), description: String(r.brief ?? ""), kind,
        columns: cols, rows, footRows: foot, risePx: Math.max(0, rows - Math.max(1, foot)) * T, use: [], gridHash: `pool-${slug}-${cells.length}-${dataUrl.length}`,
        asset: { id: workshopAssetId(dataUrl), dataUrl, width: sheet.width, height: sheet.height }, cells, provenance: { aiGenerated: true, tool: "objpool (bbox-dungeon, local only)" } as any });
      let name = String(r.name_en ?? r.name ?? slug).toLowerCase().trim();
      if (PIECES[name] && !POOL_NAMES.has(name)) name = `${name} (new)`;
      PIECES[name] = id; POOL_NAMES.add(name);
      POOL_CLASS[name] = kind === "hang" ? "wall" : kind === "flat" ? "decal" : "floor";
      n += 1;
    }
  }
  return n;
}
