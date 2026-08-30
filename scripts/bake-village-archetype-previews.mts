/**
 * 마을 원형 6갈래 → 전경 PNG. 데이터베이스 「마을」탭의 원형 카드가 읽는 그림을 굽는다.
 *
 * 왜 굽는가: 원형 전경은 도로 탐색·마당·바깥 숲까지 도는 무거운 시공이다. 브라우저에서
 * 6장을 즉석에서 돌리면 탭을 열 때마다 화면이 멈춘다. 집 한 채 미리보기는 스탬프 한 번이라
 * 실시간이지만(`src/editor/panels/villageHousePreview.ts`), 전경은 여기서 미리 만든다.
 *
 * 그림이 거짓말하지 않는 이유: 화면이 상상해 그리는 게 아니라 **실제 `author_village`**
 * 결과 맵을 그대로 렌더한다. 원형 값이 바뀌면 다시 구워야 하고, 안 구우면
 * `test/villageArchetypePreviews.test.ts` 가 빨갛게 잡는다.
 *
 * 실행: npx vite-node scripts/bake-village-archetype-previews.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { presetRecordFromArchetype } from "@/editor/panels/databaseVillageModel";
import { VILLAGE_ARCHETYPES } from "@/editor/tools/village/authoringData";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import type { GameMap, Project, TilesetDef } from "@/project/types";

const T = 16;
/** 합본 마을 칩셋의 열 수. 킷 타일 번호(406·467·374…)가 이 번호 체계에 종속이다. */
const COLS = 30;
/** 맵 한 변(칸). 광장 + 집 6채가 들어가고, 16px×36 = 576px 이 2로 정확히 나뉜다. */
const MAP_SIZE = 36;
/** 2배 축소 — 카드가 220px 쯤이라 288px 이면 고밀도 화면에서도 충분하다. */
const SHRINK = 2;
const HOUSE_COUNT = 6;
const SEED = 7;

export const OUT_DIR = path.resolve("public/assets/village-preview");

const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));

function blankProject(size: number): Project {
  const context = { project: createEmptyToolProject("village archetype preview") };
  const created = runTool(context, "create_map", { id: "map_preview", name: "마을", width: size, height: size });
  if (!created.ok) throw new Error(`create_map: ${created.summary}`);
  return context.project;
}

/** 맵 → 1:1 픽셀 PNG. 4분면 오토타일까지 실제 합성 규칙(`chipsetQuarterComposition`)을 태운다. */
function render(map: GameMap, tileset: TilesetDef): PNG {
  const png = new PNG({ width: map.width * T, height: map.height * T });
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const si = ((sy0 + y) * chip.width + (sx0 + x)) * 4;
        const di = ((dy + y) * png.width + (dx + x)) * 4;
        if (chip.data[si + 3] === 0) continue;
        png.data[di] = chip.data[si]!;
        png.data[di + 1] = chip.data[si + 1]!;
        png.data[di + 2] = chip.data[si + 2]!;
        png.data[di + 3] = 255;
      }
    }
  };
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      const dx = x * T;
      const dy = y * T;
      const composition = chipsetQuarterComposition(map, tileset as never, x, y);
      if (composition) {
        blit(composition.underlayTile ?? map.lowerTiles[index]!, dx, dy);
        for (const source of composition.sources) {
          blit(source.tile, dx + source.offsetX, dy + source.offsetY, {
            sx: source.offsetX,
            sy: source.offsetY,
            sw: 8,
            sh: 8,
          });
        }
      } else if (map.lowerTiles[index]! >= 0) blit(map.lowerTiles[index]!, dx, dy);
      if (map.upperTiles[index]! >= 0) blit(map.upperTiles[index]!, dx, dy);
    }
  }
  return png;
}

/** 정수배 상자 평균 축소. 최근접 표본은 지붕 능선 한 줄이 통째로 빠져 다른 집처럼 보인다. */
function shrink(source: PNG, factor: number): PNG {
  const out = new PNG({ width: Math.floor(source.width / factor), height: Math.floor(source.height / factor) });
  const area = factor * factor;
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const si = ((y * factor + sy) * source.width + (x * factor + sx)) * 4;
          r += source.data[si]!;
          g += source.data[si + 1]!;
          b += source.data[si + 2]!;
        }
      }
      const di = (y * out.width + x) * 4;
      out.data[di] = Math.round(r / area);
      out.data[di + 1] = Math.round(g / area);
      out.data[di + 2] = Math.round(b / area);
      out.data[di + 3] = 255;
    }
  }
  return out;
}

/**
 * pngjs 기본값(`deflateStrategy:3` = Z_RLE, 필터 자동)은 타일 그림에 최악이다 — 실측
 * 288×288 한 장이 141KB 였다. 전략 0 + 필터 None 이면 같은 픽셀이 14KB 로 떨어진다
 * (6장 840KB → 90KB). 화면에 뜨는 카드 자산이라 크기가 그대로 첫 로딩 시간이 된다.
 */
const PNG_WRITE = { deflateLevel: 9, deflateStrategy: 0, filterType: 0 } as const;

function bake(): { readonly id: string; readonly ok: boolean; readonly summary: string; readonly houses: number }[] {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report: { id: string; ok: boolean; summary: string; houses: number }[] = [];
  for (const archetype of VILLAGE_ARCHETYPES) {
    const project = blankProject(MAP_SIZE);
    // 화면의 「원형에서 프리셋 만들기」와 **같은 변환**을 태운다 — 여기서 값을 손으로 짜면
    // 카드 그림과 실제로 만들어지는 프리셋이 갈라진다.
    project.villagePresets = [presetRecordFromArchetype(archetype, `vpreset_${archetype.id}`)];
    const context = { project };
    const result = runToolDefinition(context, AUTHOR_VILLAGE_TOOL, {
      target: { kind: "existing", mapId: "map_preview" },
      houseCount: HOUSE_COUNT,
      countPolicy: "exact",
      presetId: `vpreset_${archetype.id}`,
      seed: SEED,
      // 실내·NPC 는 전경 한 장에 보이지 않는 데다 시공 시간의 대부분이 거기서 난다.
      // `author_village` 스키마는 `additionalProperties:false` 라 없는 키(doorEvent 등)를
      // 넣으면 인자 검증에서 통째로 반려된다 — 파사드가 받는 키만 쓴다.
      interior: false,
      npcCount: 0,
    });
    const built = context.project;
    const map = built.maps.map_preview!;
    const houses = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house").length;
    report.push({ id: archetype.id, ok: result.ok, summary: result.summary, houses });
    if (!result.ok) continue;
    const png = shrink(render(map, built.tilesets[map.tilesetId]!), SHRINK);
    fs.writeFileSync(path.join(OUT_DIR, `${archetype.id}.png`), PNG.sync.write(png, PNG_WRITE));
  }
  return report;
}

const report = bake();
console.log(JSON.stringify(report, null, 2));
const failed = report.filter((entry) => !entry.ok);
if (failed.length > 0) {
  console.error(`시공 실패 ${failed.length}건 — PNG 를 굽지 못했습니다.`);
  process.exitCode = 1;
}
