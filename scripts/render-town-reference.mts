/**
 * 「이런 식의 마을」 실렌더 — 참조 그림(격자 골목 + 집 20여 채 + 연못)을 정본 경로로 짓는다.
 *
 * 경로를 속이지 않는다: `author_village`(마을 설계서 계약)를 그대로 태우고, 화면에 뜨는 그림은
 * 실제 시공 결과 맵이다. 실행: npx tsx scripts/render-town-reference.mts
 * 산출: output/evidence/town-reference/*.png
 *
 * 케이스는 환경변수 `TOWN_CASES`(JSON 배열)로 바꾼다. `report.json` 은 **이 실행분만** 담으므로,
 * 여러 케이스를 나눠 돌렸다면 보고서(gen-town-reference-html.mts) 전에 합쳐야 한다.
 * 실측 시간: 40×40·8채 1초 / 56×56·14채 1초 미만 / 72×72·20채 약 6분 30초.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { AUTHOR_VILLAGE_TOOL } from "../src/editor/tools/authorVillageTool.ts";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool, runToolDefinition } from "../src/editor/tools/toolRunner.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const T = 16;
const COLS = 30;
const OUT = path.resolve("output/evidence/town-reference");
fs.mkdirSync(OUT, { recursive: true });

const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));

/** 맵 → 1:1 픽셀(4분면 오토타일 합성 규칙까지 태운다). */
function render(map: GameMap, project: Project): PNG {
  const png = new PNG({ width: map.width * T, height: map.height * T });
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) {
      const si = ((sy0 + y) * chip.width + sx0 + x) * 4;
      const di = ((dy + y) * png.width + dx + x) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const index = y * map.width + x;
    const dx = x * T;
    const dy = y * T;
    const composition = chipsetQuarterComposition(map, project.tilesets[map.tilesetId] as never, x, y);
    if (composition) {
      blit(composition.underlayTile ?? map.lowerTiles[index]!, dx, dy);
      for (const source of composition.sources) {
        blit(source.tile, dx + source.offsetX, dy + source.offsetY, { sx: source.offsetX, sy: source.offsetY, sw: 8, sh: 8 });
      }
    } else if (map.lowerTiles[index]! >= 0) blit(map.lowerTiles[index]!, dx, dy);
    if (map.upperTiles[index]! >= 0) blit(map.upperTiles[index]!, dx, dy);
  }
  return png;
}

/** 정수배 상자 평균 축소 — 최근접 표본은 지붕 능선 한 줄을 통째로 빠뜨린다. */
function shrink(source: PNG, factor: number): PNG {
  const out = new PNG({ width: Math.floor(source.width / factor), height: Math.floor(source.height / factor) });
  const area = factor * factor;
  for (let y = 0; y < out.height; y += 1) for (let x = 0; x < out.width; x += 1) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < factor; sy += 1) for (let sx = 0; sx < factor; sx += 1) {
      const si = ((y * factor + sy) * source.width + (x * factor + sx)) * 4;
      r += source.data[si]!; g += source.data[si + 1]!; b += source.data[si + 2]!;
    }
    const di = (y * out.width + x) * 4;
    out.data[di] = Math.round(r / area); out.data[di + 1] = Math.round(g / area); out.data[di + 2] = Math.round(b / area); out.data[di + 3] = 255;
  }
  return out;
}

type Case = {
  readonly file: string;
  readonly title: string;
  readonly size: number;
  readonly houses: number;
  readonly theme: string;
  readonly layout?: "plaza-ring" | "street-grid" | "clusters";
  readonly forestDensity?: "sparse" | "normal" | "dense";
  readonly seed: number;
};

const CASES: readonly Case[] = (JSON.parse(process.env.TOWN_CASES ?? "null") as Case[] | null) ?? [
  { file: "town-main", title: "격자 골목 농촌 마을", size: 72, houses: 20, theme: "농촌 마을", layout: "street-grid", forestDensity: "normal", seed: 7 },
];

const report: Record<string, unknown>[] = [];

for (const c of CASES) {
  const started = Date.now();
  const project = createEmptyToolProject(c.title);
  const context = { project };
  const created = runTool(context, "create_map", { id: "map_town", name: c.title, width: c.size, height: c.size });
  if (!created.ok) throw new Error(created.summary);
  const result = runToolDefinition(context, AUTHOR_VILLAGE_TOOL, {
    target: { kind: "existing", mapId: "map_town" },
    houseCount: c.houses,
    countPolicy: "best-effort",
    theme: c.theme,
    ...(c.layout ? { settlementLayout: c.layout } : {}),
    forestDensity: c.forestDensity ?? "normal",
    interior: false,
    npcCount: 0,
    seed: c.seed,
  });
  const built = context.project;
  const map = built.maps.map_town!;
  const houses = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house").length;
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  report.push({ ...c, ok: result.ok, summary: result.summary, houses, seconds });
  console.log(c.file, result.ok ? `ok houses=${houses} ${seconds}s` : `FAIL ${result.summary}`);
  if (!result.ok) continue;
  // 브라우저(정본 렌더러)로 다시 그리기 위한 프로젝트 덤프. 타일 배경(검정)을 게임과
  // 같은 방식으로 키아웃하므로, 스크립트 렌더의 검은 테두리 문제를 피한다.
  fs.writeFileSync(path.join(OUT, `${c.file}-project.json`), JSON.stringify(built));
  if (process.env.TOWN_SKIP_PNG !== "1") {
    fs.writeFileSync(path.join(OUT, `${c.file}.png`), PNG.sync.write(render(map, built)));
    fs.writeFileSync(path.join(OUT, `${c.file}-half.png`), PNG.sync.write(shrink(render(map, built), 2)));
  }
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("done ->", OUT);
