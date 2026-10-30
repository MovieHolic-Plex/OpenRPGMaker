// 조건 O 3단계: object-gen 이 고른 그림을 이 판 프로젝트의 손 도트 실내 칩셋(atlas_biome_interior)에 공방 칸으로 굽는다(tileGrafts + workshop: 킷).
//   bun scripts/experiments/img-room/bake_objects.mts <run dir G> <prep dir>     (repo 루트에서, 세션 전)
// 실험 전용 로컬 칩셋이다 — 번들·공용 DB·스토어에 넣지 않는다(object-gate 미통과). stdout: 구운 id 목록 JSON.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { initLocalProjectStore } from "../../../electron/local-store/store";
import { bakeWorkshopObject, workshopAssetId, type WorkshopHandKind } from "@/project/workshopTiles";

const [G, PREP] = process.argv.slice(2).map((p) => resolve(p));
if (!G || !PREP) throw Error("bake_objects.mts <run dir> <prep dir>");
const T = 16, COLS = 30, TILESET = "atlas_biome_interior";
const store = await initLocalProjectStore({ projectDir: resolve(G, "project") });
const out: { id: string; name: string; kind: string; w: number; h: number; cells: number; brief: string }[] = [];
try {
  const project = store.loadSnapshot()!.project as any;
  if (!project.tilesets[TILESET]) throw Error(`no ${TILESET} in the project`);
  const dir = resolve(PREP, "objects");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const rec = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
    const job = JSON.parse(readFileSync(resolve(rec.job, "job.json"), "utf8"));
    const png = PNG.sync.read(readFileSync(resolve(dir, f.replace(/\.json$/, ".png"))));
    const cols = Math.round(png.width / T), rows = Math.round(png.height / T);
    const cells: { sourceTile: number; dx: number; dy: number }[] = [];
    const tiles: Buffer[] = [];
    for (let dy = 0; dy < rows; dy++) for (let dx = 0; dx < cols; dx++) {
      const b = Buffer.alloc(T * T * 4); let any = false;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const s = ((dy * T + y) * png.width + dx * T + x) * 4, d = (y * T + x) * 4;
        png.data.copy(b, d, s, s + 4); if (png.data[s + 3]! > 0) any = true;
      }
      if (any) { cells.push({ sourceTile: tiles.length, dx, dy }); tiles.push(b); }
    }
    const sheet = new PNG({ width: COLS * T, height: Math.ceil(tiles.length / COLS) * T });
    tiles.forEach((b, i) => { const ox = (i % COLS) * T, oy = Math.floor(i / COLS) * T;
      for (let y = 0; y < T; y++) b.copy(sheet.data, ((oy + y) * sheet.width + ox) * 4, y * T * 4, (y + 1) * T * 4); });
    const dataUrl = `data:image/png;base64,${PNG.sync.write(sheet).toString("base64")}`;
    const kind = (["floor", "wall", "hang", "flat"].includes(rec.anchor) ? rec.anchor : "floor") as WorkshopHandKind;
    const id = `workshop:${rec.slug}`;
    bakeWorkshopObject(project, TILESET, {
      objectId: id, title: rec.name, description: rec.brief, kind, columns: cols, rows,
      footRows: Number(job.spec?.view?.footRows ?? (kind === "floor" || kind === "wall" ? 1 : 0)), risePx: Number(job.spec?.view?.risePx ?? 0),
      use: [], gridHash: rec.pixelSha256 ?? id,
      asset: { id: workshopAssetId(dataUrl), dataUrl, width: sheet.width, height: sheet.height }, cells,
      provenance: { aiGenerated: true, tool: "object-gen (img-room-test, local only)" } as any,
    });
    out.push({ id, name: rec.name, kind, w: cols, h: rows, cells: cells.length, brief: rec.brief });
  }
  await store.saveProject(project);
  const back = store.loadSnapshot()!.project as any;
  const kits = (back.tilesets[TILESET].structureKits ?? []).filter((k: any) => String(k.id).startsWith("workshop:")).map((k: any) => k.id);
  writeFileSync(resolve(G, "baked.json"), JSON.stringify({ objects: out, reloadedKits: kits }, null, 1));
  console.log(JSON.stringify({ baked: out.length, reloadedKits: kits.length }));
} finally { store.close(); }
