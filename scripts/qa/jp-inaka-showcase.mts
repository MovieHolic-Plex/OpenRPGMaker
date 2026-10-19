// 일본 시골(이나카 여름방학, jp-inaka) 6대 쇼케이스 맵(32×22) 조립 및 PNG 렌더러.
// 실행: bun scripts/qa/jp-inaka-showcase.mts [--out /home/main/claude-viz/jp-inaka-countryside-1]
import fs from "node:fs";
import path from "node:path";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { blankFillTileFor } from "../../src/project/defaults/defaultMaps.ts";
import { setLayerTileAt } from "../../src/project/mapLayers.ts";
import { autotileGroupLayerView, shapeAutotileGroupAround } from "../../src/project/defaults/autotileEngine.ts";
import {
  INAKA_GROUND_TILES,
  INAKA_KITS,
  INAKA_SHOWCASE_SCENES,
  paintInakaGround,
  planInakaShowcaseScene,
} from "../../src/editor/jpCity/inakaCountrysideComposer.ts";

const outIndex = process.argv.indexOf("--out");
const OUT = outIndex >= 0 ? (process.argv[outIndex + 1] ?? "/home/main/claude-viz/jp-inaka-countryside-1") : "/home/main/claude-viz/jp-inaka-countryside-1";
fs.mkdirSync(OUT, { recursive: true });

interface SceneSummaryRow {
  readonly no: number;
  readonly id: string;
  readonly fileName: string;
  readonly titleKo: string;
  readonly width: number;
  readonly height: number;
  readonly plannedStamps: number;
  readonly appliedStamps: number;
  readonly skippedStamps: readonly string[];
  readonly failedStamps: readonly string[];
}

const rows: SceneSummaryRow[] = [];

const onlyIndex = process.argv.indexOf("--only");
const ONLY = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : undefined;

for (const scene of INAKA_SHOWCASE_SCENES) {
  if (ONLY && !scene.id.startsWith(ONLY)) continue;
  const project = createNewProjectSeed("adventure-jrpg", scene.id);
  ensureBundledTilesets(project);
  const ctx = { project };
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  const kit = project.tilesets.jp_city;
  if (!map || !kit) {
    throw new Error(`필수 맵 또는 jp_city 타일셋이 없습니다: ${scene.id}`);
  }
  map.tilesetId = kit.id;
  map.tileSize = kit.tileSize;
  map.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit));
  runTool(ctx, "resize_map", { mapId, width: scene.width, height: scene.height });
  const resizedMap = ctx.project.maps[mapId];
  const refreshedKit = ctx.project.tilesets.jp_city;
  if (!resizedMap || !refreshedKit) {
    throw new Error(`리사이즈 후 맵/타일셋을 찾을 수 없습니다: ${scene.id}`);
  }
  resizedMap.lowerTiles.fill(blankFillTileFor(refreshedKit.id, 0, refreshedKit));

  const kitShapes = new Map(
    (refreshedKit.structureKits ?? []).map((k) => [
      k.id,
      { w: k.width, h: k.height, opaque: k.rows.flatMap((row) => row.upperTiles.map((t) => t >= 0)) },
    ]),
  );
  const plan = planInakaShowcaseScene({
    scene,
    mapId,
    kitSize: (id) => kitShapes.get(id),
  });

  let appliedStamps = 0;
  const failedStamps: string[] = [];

  for (const step of plan.steps) {
    if (step.tool === "fill_region") {
      const rectArg = step.args.rect as { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
      const matArg = String(step.args.material);
      const curMap = ctx.project.maps[mapId];
      const curKit = ctx.project.tilesets.jp_city;
      if (curMap && curKit && paintInakaGround(curMap, curKit, rectArg, matArg)) {
        continue;
      }
      const fillRes = runTool(ctx, "fill_region", { ...step.args });
      if (!fillRes.ok) {
        throw new Error(`${scene.id} fill_region(${matArg}) 실패: ${fillRes.summary}`);
      }
      continue;
    }
    if (step.tool === "paint_line") {
      // 생울타리·블록담은 jp_city 2층 선 오토타일: 멤버 타일을 깐 뒤 4방향 이웃으로 끝·모서리 모양을 다시 고른다.
      const rectArg = step.args.rect as { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
      const matArg = String(step.args.material);
      const curMap = ctx.project.maps[mapId];
      const group = (ctx.project.tilesets.jp_city?.autotileGroups ?? []).find((g) => g.name === matArg && g.layer === "upper");
      const member = group?.memberTileIds[0];
      if (!curMap || !group || member === undefined) {
        throw new Error(`${scene.id} paint_line(${matArg}): jp_city 2층 선 오토타일이 없습니다`);
      }
      const points: { x: number; y: number }[] = [];
      for (let y = rectArg.y; y < rectArg.y + rectArg.h; y++) {
        for (let x = rectArg.x; x < rectArg.x + rectArg.w; x++) {
          curMap.upperTiles[y * curMap.width + x] = member;
          points.push({ x, y });
        }
      }
      shapeAutotileGroupAround(autotileGroupLayerView(curMap, group), group, points);
      continue;
    }
    const curMapBefore = ctx.project.maps[mapId];
    const prevUpper = curMapBefore ? curMapBefore.upperTiles.slice() : [];
    const targetLayer = typeof step.args.layer === "number" ? step.args.layer : 3;
    const { layer: _omitLayer, ...stampArgs } = step.args;
    const stampRes = runTool(ctx, "stamp_object", stampArgs);
    if (stampRes.ok) {
      const curMapAfter = ctx.project.maps[mapId];
      if (curMapAfter && prevUpper.length === curMapAfter.upperTiles.length) {
        for (let i = 0; i < curMapAfter.upperTiles.length; i++) {
          const beforeTile = prevUpper[i] ?? -1;
          const afterTile = curMapAfter.upperTiles[i] ?? -1;
          if (beforeTile === afterTile) continue;
          if (targetLayer === 4 && afterTile >= 0) {
            setLayerTileAt(curMapAfter, 4, i, afterTile);
            curMapAfter.upperTiles[i] = beforeTile;
          } else if (beforeTile >= 0 && afterTile >= 0) {
            setLayerTileAt(curMapAfter, 2, i, beforeTile);
          }
        }
      }
      appliedStamps++;
    } else {
      failedStamps.push(`${step.note}: ${stampRes.summary}`);
    }
  }

  const finalMap = ctx.project.maps[mapId];
  if (!finalMap) {
    throw new Error(`최종 맵이 없습니다: ${scene.id}`);
  }
  const rendered = renderMapPng({ ...ctx.project, startMapId: "__none__" }, finalMap);
  const pngPath = path.join(OUT, scene.fileName);
  fs.writeFileSync(pngPath, rendered.png);
  if (scene.no === 1) {
    const thumbsDir = "/home/main/claude-viz/_thumbs";
    if (fs.existsSync(thumbsDir)) {
      fs.writeFileSync(path.join(thumbsDir, "jp-inaka-countryside-1.png"), rendered.png);
      fs.writeFileSync(path.join(thumbsDir, "jp-inaka-countryside-1.mid.png"), rendered.png);
    }
  }
  rows.push({
    no: scene.no,
    id: scene.id,
    fileName: scene.fileName,
    titleKo: scene.titleKo,
    width: scene.width,
    height: scene.height,
    plannedStamps: plan.stampedCount,
    appliedStamps,
    skippedStamps: plan.skippedStamps,
    failedStamps,
  });
  console.log(
    `[${String(scene.no).padStart(2, "0")}] ${scene.id} -> ${appliedStamps}/${plan.stampedCount} stamped, skipped=${plan.skippedStamps.length}, failed=${failedStamps.length}`,
  );
  if (plan.skippedStamps.length > 0) {
    console.log("  skipped:", plan.skippedStamps.join(", "));
  }
  if (failedStamps.length > 0) {
    console.log("  failed:", failedStamps.join(" | "));
  }
}

if (!ONLY) fs.writeFileSync(
  path.join(OUT, "summary.json"),
  JSON.stringify(
    {
      groundTiles: INAKA_GROUND_TILES.length,
      kits: INAKA_KITS.length,
      scenes: rows,
    },
    null,
    2,
  ),
);
