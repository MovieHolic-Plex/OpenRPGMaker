// 숲 팩(jp_forest_pack) 미리보기 — 저장소 시트를 굽지 않고(3/4 관문 보정 전) 임시 굽기 결과로 지역·시골 맵을 그린다.
//   python3 -c "import bake_jp; bake_jp.bake('/tmp/root')"   # 임시 굽기(저장소 시트·핀 사본을 먼저 /tmp/root 에 복사)
//   bun scripts/qa/jp-forest-preview.mts --mode regions --root /tmp/root --out /tmp/after [--only a,b] [--seed 1]
//   bun scripts/qa/jp-forest-preview.mts --mode inaka   --root /tmp/root --out /tmp/after [--before]
// --root 없이 부르면 저장소 칩셋 그대로(= 지금 상태). inaka --before 는 나무 키트를 그대로 찍는다(지금 쇼케이스와 같음),
// 아니면 나무 키트(삼나무·대숲·소나무·단풍·가로수) 발자국을 숲 마스크로 바꿔 forestPainter 로 칠한다.
import fs from "node:fs";
import path from "node:path";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { blankFillTileFor } from "../../src/project/defaults/defaultMaps.ts";
import { layerTileAt, setLayerTileAt } from "../../src/project/mapLayers.ts";
import { autotileGroupLayerView, shapeAutotileGroupAround } from "../../src/project/defaults/autotileEngine.ts";
import { JP_REGIONS } from "../../src/editor/jpCity/japaneseRegionsCatalog.ts";
import { paintJpForest } from "../../src/editor/jpCity/forestPainter.ts";
import * as Inaka from "../../src/editor/jpCity/inakaCountrysideComposer.ts";
import type { Project, TilesetDef } from "../../src/project/types.ts";

const arg = (n: string, d = ""): string => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const MODE = arg("mode", "regions");
const ROOT = arg("root");
const OUT = path.resolve(arg("out", "output/evidence/jp-forest"));
const SEED = Number(arg("seed", "1"));
const ONLY = arg("only").split(",").filter(Boolean);
const BEFORE = process.argv.includes("--before");
const CWD = process.cwd();
fs.mkdirSync(OUT, { recursive: true });

/** runTool 은 ctx.project 를 새 객체로 바꿀 수 있다 — 같은 p 를 계속 쓰도록 덮어 쓴다. */
function run(p: Project, name: string, args: Record<string, unknown>): { ok: boolean; summary: string; data?: Record<string, unknown> } {
  const ctx = { project: p };
  const res = runTool(ctx, name, args) as { ok: boolean; summary: string; data?: Record<string, unknown> };
  if (ctx.project !== p) Object.assign(p, ctx.project);
  return res;
}

function project(name: string): Project {
  const p = createNewProjectSeed("adventure-jrpg", name) as Project;
  ensureBundledTilesets(p);
  if (ROOT) {
    const def = JSON.parse(fs.readFileSync(path.join(ROOT, "src/assets/jpCityTileset.json"), "utf8")) as Record<string, unknown>;
    const ts = p.tilesets.jp_city as unknown as Record<string, unknown>;
    for (const k of ["count", "libraryEnd", "passability", "priority", "terrain", "tileMeta", "tileGroups", "autotileGroups", "animationStrips", "structureKits"]) {
      if (k in def) ts[k] = structuredClone(def[k]);
    }
  }
  return p;
}

function render(p: Project, mapId: string, file: string): void {
  if (ROOT) process.chdir(ROOT);          // 렌더러는 public/assets/... 을 현재 폴더 기준으로 읽는다 — 임시 굽기 시트를 쓰게
  try {
    fs.writeFileSync(path.join(OUT, file), renderMapPng({ ...p, startMapId: "__none__" }, p.maps[mapId]!).png);
  } finally {
    process.chdir(CWD);
  }
}

function blankJpMap(p: Project, w: number, h: number): string {
  const id = p.startMapId;
  const kit = p.tilesets.jp_city!;
  const m = p.maps[id]!;
  m.tilesetId = kit.id; m.tileSize = kit.tileSize; m.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit));
  const rr = run(p, "resize_map", { mapId: id, width: w, height: h });
  if (!rr.ok) throw new Error(`resize_map: ${rr.summary}`);
  p.maps[id]!.lowerTiles.fill(blankFillTileFor(kit.id, 0, p.tilesets.jp_city!));
  return id;
}

const summary: unknown[] = [];
if (MODE === "regions") {
  for (const region of JP_REGIONS) {
    if (ONLY.length && !ONLY.includes(region.id)) continue;
    const p = project(region.id);
    const id = blankJpMap(p, region.size[0], region.size[1]);
    const res = run(p, "compose_jp_region", { mapId: id, region: region.id, seed: SEED, replace: true });
    render(p, id, `${String(region.no).padStart(2, "0")}-${region.id}.png`);
    summary.push({ id: region.id, ok: res.ok, forest: res.data?.forest ?? null, violations: (res.data?.violations as unknown[] | undefined)?.length ?? 0 });
    console.log(region.no, region.id, res.ok ? "ok" : `FAIL ${res.summary.slice(0, 200)}`, JSON.stringify(res.data?.forest ?? null));
  }
} else {
  const TREE = /^jp-(rg-(sugi|pine|maple|bamboo-grove|bamboo-grove-b|bamboo-clump)|prop-tree-(zelkova|sakura))$/u;
  const species = (kit: string): number => kit.includes("bamboo") ? 2 : kit.includes("sakura") ? 3 : (kit.includes("sugi") || kit.includes("pine")) ? 4 : kit.includes("maple") ? 5 : 1;
  for (const scene of Inaka.INAKA_SHOWCASE_SCENES) {
    if (ONLY.length && !ONLY.some((o) => scene.id.startsWith(o))) continue;
    const p = project(scene.id);
    const mapId = blankJpMap(p, scene.width, scene.height);
    const kitShapes = new Map((p.tilesets.jp_city!.structureKits ?? []).map((k) => [k.id, { w: k.width, h: k.height, opaque: k.rows.flatMap((row) => row.upperTiles.map((t) => t >= 0)) }]));
    const plan = Inaka.planInakaShowcaseScene({ scene, mapId, kitSize: (id: string) => kitShapes.get(id) } as Parameters<typeof Inaka.planInakaShowcaseScene>[0]);
    const W = scene.width, H = scene.height;
    const kinds = new Uint8Array(W * H);
    const treeSteps: { kit: string; x: number; y: number; cells: number[]; args: Record<string, unknown> }[] = [];
    let trees = 0;
    for (const step of plan.steps as readonly { tool: string; args: Record<string, unknown>; note: string }[]) {
      const m = p.maps[mapId]!;
      if (step.tool === "fill_region") {
        const rect = step.args.rect as { x: number; y: number; w: number; h: number };
        if (!Inaka.paintInakaGround(m, p.tilesets.jp_city!, rect, String(step.args.material))) run(p, "fill_region", { ...step.args });
        continue;
      }
      if (step.tool === "paint_line") {
        const rect = step.args.rect as { x: number; y: number; w: number; h: number };
        const group = (p.tilesets.jp_city!.autotileGroups ?? []).find((g) => g.name === String(step.args.material) && g.layer === "upper");
        if (!group) continue;
        const pts: { x: number; y: number }[] = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) { m.upperTiles[y * m.width + x] = group.memberTileIds[0]!; pts.push({ x, y }); }
        shapeAutotileGroupAround(autotileGroupLayerView(m, group), group, pts);
        continue;
      }
      const kitId = String(step.args.objectId ?? "").replace(/^kit:jp_city\//u, "");
      if (!BEFORE && TREE.test(kitId)) {
        // 나무 키트 발자국(수관 칸) → 숲 마스크
        const sh = kitShapes.get(kitId);
        const sx = Number(step.args.x), sy = Number(step.args.y);
        const cells: number[] = [];
        if (sh) for (let j = 0; j < sh.h; j++) for (let i = 0; i < sh.w; i++) {
          const x = sx + i, y = sy + j;
          if (x >= 0 && y >= 0 && x < W && y < H && sh.opaque[j * sh.w + i]) { kinds[y * W + x] = species(kitId); cells.push(y * W + x); }
        }
        treeSteps.push({ kit: kitId, x: sx, y: sy, cells, args: step.args });
        trees++;
        continue;
      }
      const prev = m.upperTiles.slice();
      const layer = typeof step.args.layer === "number" ? step.args.layer : 3;
      const { layer: _l, ...stampArgs } = step.args;
      const r = run(p, "stamp_object", stampArgs);
      if (!r.ok) continue;
      const after = p.maps[mapId]!;
      for (let i = 0; i < after.upperTiles.length; i++) {
        const b = prev[i] ?? -1, a = after.upperTiles[i] ?? -1;
        if (b === a) continue;
        if (layer === 4 && a >= 0) { setLayerTileAt(after, 4, i, a); after.upperTiles[i] = b; } else if (b >= 0 && a >= 0) setLayerTileAt(after, 2, i, b);
      }
    }
    // 외딴 나무(겹친 나무 무리가 30칸 미만)는 숲으로 만들지 않고 한 그루로 둔다 — 삼나무는 새 한 그루(jp-forest-sg-tree-*), 나머지는 원래 키트
    if (!BEFORE) {
      const comp = new Int32Array(W * H).fill(-1);
      let n = 0;
      const sizes: number[] = [];
      for (let i0 = 0; i0 < W * H; i0++) {
        if (!kinds[i0] || comp[i0]! >= 0) continue;
        const st = [i0]; comp[i0] = n; let c = 0;
        while (st.length) {
          const i = st.pop()!; c++;
          const x = i % W, y = (i - x) / W;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const xx = x + dx, yy = y + dy, j = yy * W + xx;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && kinds[j] && comp[j]! < 0) { comp[j] = n; st.push(j); }
          }
        }
        sizes.push(c); n++;
      }
      const lone = treeSteps.filter((t) => t.cells.length && sizes[comp[t.cells[0]!]!]! < 30);
      for (const t of lone) for (const i of t.cells) kinds[i] = 0;
      for (const t of lone.sort((a, b) => a.y - b.y)) {
        const mm = p.maps[mapId]!;
        if (t.kit.includes("sugi")) {
          const sh = kitShapes.get(t.kit)!;
          const v = (t.x * 7 + t.y * 3) % 4;
          const key = sh.h >= 6 ? "s3x5" : "s2x5";
          const nk = `jp-forest-sg-tree-${key}-${v}`;
          const ns = kitShapes.get(nk);
          if (ns) { run(p, "stamp_object", { objectId: `kit:jp_city/${nk}`, mapId, x: t.x + Math.floor((sh.w - ns.w) / 2), y: t.y + sh.h - ns.h }); continue; }
        }
        const { layer: _l2, ...a2 } = t.args;
        run(p, "stamp_object", a2);
        void mm;
      }
    }
    const m = p.maps[mapId]!;
    // 다른 기물이 선 칸은 숲에서 뺀다
    for (let i = 0; i < W * H; i++) if (kinds[i] && (m.upperTiles[i] ?? -1) >= 0) kinds[i] = 0;
    const rep = BEFORE ? null : paintJpForest({
      width: W, height: H,
      getLayer: (layer, i) => layerTileAt(m, layer, i),
      setLayer: (layer, i, t) => setLayerTileAt(m, layer, i, t),
    }, p.tilesets.jp_city as unknown as TilesetDef, kinds, SEED);
    render(p, mapId, scene.fileName);
    summary.push({ id: scene.id, trees, forest: rep });
    console.log(scene.id, `trees→forest ${trees}`, JSON.stringify(rep));
  }
}
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
