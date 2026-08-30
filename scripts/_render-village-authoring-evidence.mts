/**
 * 마을 저작 레코드 → 실제 시공 결과 PNG.
 * 데이터베이스 「마을」탭에서 만든 값(집 형태 + 배치 프리셋)을 프로젝트에 넣고
 * author_village 를 presetId 로 돌린 뒤, 결과 맵을 그대로 렌더한다.
 * 실행: npx vite-node scripts/_render-village-authoring-evidence.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import type { GameMap, Project } from "@/project/types";
import type { VillageHouseTemplateRecord, VillageLayoutPresetRecord } from "@/project/types/village";

const T = 16;
const COLS = 30;
const OUT = path.resolve("reports/village-db-plan/img");
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));

// 화면에서 저작한 그대로의 레코드 — 8×9 L 자, 목조 홀 킷.
const MY_TEMPLATE: VillageHouseTemplateRecord = {
  id: "my-house",
  name: "내 장옥",
  w: 8,
  h: 9,
  stories: 1,
  kitId: "timber-hall",
  wings: [{ x: 0, y: 0, w: 8, h: 5 }, { x: 0, y: 5, w: 4, h: 4 }],
  note: "촌장 집으로 쓰는 넓은 장옥",
};

const MY_PRESET: VillageLayoutPresetRecord = {
  id: "vpreset",
  name: "내 산골 마을",
  houseCount: 6,
  pathStyle: "dirt",
  roadWidth: 3,
  roadNaturalness: 0.9,
  settlementLayout: "street-grid",
  plazaStyle: "garden",
  plazaLayout: "north",
  yardStyle: "workshop",
  npcCount: 4,
  templateIds: ["my-house", "rect-small"],
  note: "산골 분위기, 넓은 흙길",
};

function project(size: number): Project {
  const context = { project: createEmptyToolProject("village authoring evidence") };
  const created = runTool(context, "create_map", { id: "map_existing", name: "마을", width: size, height: size });
  if (!created.ok) throw new Error(`create_map: ${created.summary}`);
  return context.project;
}

function render(map: GameMap, tileset: unknown, scale: number): PNG {
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!;
      png.data[di + 1] = chip.data[si + 1]!;
      png.data[di + 2] = chip.data[si + 2]!;
      png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const dx = x * T * scale;
    const dy = y * T * scale;
    const composition = chipsetQuarterComposition(map, tileset as never, x, y);
    if (composition) {
      blit(composition.underlayTile ?? map.lowerTiles[i]!, dx, dy);
      for (const src of composition.sources) {
        blit(src.tile, dx + src.offsetX * scale, dy + src.offsetY * scale, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
      }
    } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, dx, dy);
    if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, dx, dy);
  }
  return png;
}

function crop(png: PNG, x: number, y: number, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x, y, w, h, 0, 0);
  return out;
}

interface Case {
  readonly file: string;
  readonly templateIds: string[];
  readonly size: number;
  readonly scale: number;
  readonly houseCount: number;
}

const CASES: Case[] = [
  { file: "built-village-preset.png", templateIds: ["my-house", "rect-small"], size: 50, scale: 2, houseCount: 6 },
  { file: "built-village-mine-only.png", templateIds: ["my-house"], size: 40, scale: 2, houseCount: 4 },
];

const evidence: unknown[] = [];

for (const item of CASES) {
  const proj = project(item.size);
  proj.villageTemplates = [MY_TEMPLATE];
  proj.villagePresets = [{ ...MY_PRESET, templateIds: item.templateIds }];
  const context = { project: proj };
  const result = runToolDefinition(context, AUTHOR_VILLAGE_TOOL, {
    target: { kind: "existing", mapId: "map_existing" },
    houseCount: item.houseCount,
    countPolicy: "exact",
    presetId: "vpreset",
    seed: 7,
    interior: false,
  });
  const built = context.project;
  const map = built.maps.map_existing;
  // 어떤 형태로 지었나 — 설계도 영역의 shape 태그가 정본이다.
  const regions = (map.layoutPlan?.regions ?? []) as { role?: string; shape?: string; tags?: string[] }[];
  const shapes = regions.filter((region) => region.role === "house").map((region) => region.shape);
  const presetTag = regions.flatMap((region) => region.tags ?? []).filter((tag) => tag.startsWith("preset:"));
  evidence.push({
    file: item.file,
    ok: result.ok,
    summary: result.summary,
    shapes,
    presetTag,
    npcs: (map.events ?? []).filter((event) => event.id.startsWith("ev_village_")).length,
  });
  if (!result.ok) continue;
  const png = render(map, built.tilesets[map.tilesetId], item.scale);
  fs.writeFileSync(path.join(OUT, item.file), PNG.sync.write(png));
  // 집 한 채가 보이는 확대 조각 — 형태를 눈으로 확인하려면 전경만으로는 작다.
  if (item.file === "built-village-mine-only.png") {
    const side = Math.min(png.width, png.height, 22 * T * item.scale);
    fs.writeFileSync(
      path.join(OUT, "built-house-closeup.png"),
      PNG.sync.write(crop(png, Math.floor((png.width - side) / 2), Math.floor((png.height - side) / 2), side, side)),
    );
  }
}

console.log(JSON.stringify(evidence, null, 2));
