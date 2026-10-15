import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PNG } from "pngjs";
import { createCapabilityFixtureProject, fixtureEvent } from "../../src/harnesses/assistant-capability/node/capabilityFixture.ts";
import { setRegionReferenceDownloadLoader } from "../../src/project/regionReferenceImport.ts";
import { defaultAiConfig, type ChatMessage, type ContentPart } from "../../src/ai/llmClient.ts";
import { completeProvider } from "../lib/ohMyPiPiAiRuntime.ts";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/toolRunner.ts";
import { getTool } from "../../src/editor/tools/toolRegistry.ts";
import { finishDraftTilesets } from "../../src/editor/tools/changeset.ts";
import { bakeAndStampCustomObject } from "../../src/editor/tools/customMapObjectTools.ts";
import { dressBeodeulGround } from "../../src/editor/tools/beodeulGroundTools.ts";
import { bakeWorkshopObject, workshopAssetId } from "../../src/project/workshopTiles.ts";
import { bundledChipsetTilesPerRow } from "../../src/assets/bundledChipsetGeometry.ts";
import { shapeAllAutotileGroupsAround } from "../../src/project/defaults/autotileEngine.ts";
import { tilesetBaseImageUrl } from "../../src/editor/tilesetImage.ts";
import type { Command, GameEvent, GameMap, Project } from "../../src/project/types.ts";

setRegionReferenceDownloadLoader(async (url: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public${url}`), "utf8")),
);

const OUT_DIR = resolve(process.cwd(), "artifacts/beodeul-tile-test");
mkdirSync(OUT_DIR, { recursive: true });

// Load beodeul_city sheet via tilesetBaseImageUrl to extract real reference tiles and palettes
const baseProj = createCapabilityFixtureProject();
const beodeulUrl = tilesetBaseImageUrl(baseProj.tilesets["beodeul_city"]!, baseProj);
const beodeulPngBytes = beodeulUrl.startsWith("data:image/png;base64,")
  ? Buffer.from(beodeulUrl.slice(beodeulUrl.indexOf(",") + 1), "base64")
  : readFileSync(resolve(process.cwd(), "public", beodeulUrl.replace(/^\.?\//u, "")));
const beodeulSheet = PNG.sync.read(beodeulPngBytes);
const TILES_PER_ROW = Math.floor(beodeulSheet.width / 16);

type Rgba = [number, number, number, number];

function extractTilePatch(tileIdsGrid: readonly (readonly number[])[], scale = 6): PNG {
  const rows = tileIdsGrid.length;
  const cols = tileIdsGrid[0]?.length ?? 1;
  const rawW = cols * 16;
  const rawH = rows * 16;
  const out = new PNG({ width: rawW * scale, height: rawH * scale });
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const tid = tileIdsGrid[ty]?.[tx] ?? 737;
      const sx0 = (tid % TILES_PER_ROW) * 16;
      const sy0 = Math.floor(tid / TILES_PER_ROW) * 16;
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const si = ((sy0 + py) * beodeulSheet.width + (sx0 + px)) * 4;
          const r = beodeulSheet.data[si] ?? 93;
          const g = beodeulSheet.data[si + 1] ?? 150;
          const b = beodeulSheet.data[si + 2] ?? 58;
          const a = beodeulSheet.data[si + 3] ?? 255;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const ox = (tx * 16 + px) * scale + dx;
              const oy = (ty * 16 + py) * scale + dy;
              const di = (oy * out.width + ox) * 4;
              out.data[di] = r;
              out.data[di + 1] = g;
              out.data[di + 2] = b;
              out.data[di + 3] = a;
            }
          }
        }
      }
    }
  }
  return out;
}

function pngToDataUrl(png: PNG): string {
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

// Extract authentic beodeul_city reference patches
// 1. Road Autotile 3x3 with 2px stone curbs (NW, N, NE / W, Body, E / SW, S, SE)
const refRoadPatch = extractTilePatch([
  [23021, 23015, 23019],
  [23018, 3221, 23016],
  [23022, 23017, 23020],
], 6);
writeFileSync(join(OUT_DIR, "ref_beodeul_road_3x3.png"), PNG.sync.write(refRoadPatch));

// 2. Roman Plaza Flagstones 3x3
const refPlazaPatch = extractTilePatch([
  [1509, 2691, 1077],
  [1212, 1672, 2523],
  [1673, 1674, 2364],
], 6);
writeFileSync(join(OUT_DIR, "ref_beodeul_plaza_3x3.png"), PNG.sync.write(refPlazaPatch));

// 3. Temple Ruins Mosaic Medallion 5x5 (composite over travertine 26817)
function extractCompositeKitPatch(lowerTile: number, upperGrid: readonly (readonly number[])[], scale = 5): PNG {
  const rows = upperGrid.length;
  const cols = upperGrid[0]?.length ?? 1;
  const out = new PNG({ width: cols * 16 * scale, height: rows * 16 * scale });
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const utid = upperGrid[ty]?.[tx] ?? -1;
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const lsi = ((Math.floor(lowerTile / TILES_PER_ROW) * 16 + py) * beodeulSheet.width + ((lowerTile % TILES_PER_ROW) * 16 + px)) * 4;
          let r = beodeulSheet.data[lsi] ?? 180;
          let g = beodeulSheet.data[lsi + 1] ?? 172;
          let b = beodeulSheet.data[lsi + 2] ?? 156;
          if (utid >= 0) {
            const usi = ((Math.floor(utid / TILES_PER_ROW) * 16 + py) * beodeulSheet.width + ((utid % TILES_PER_ROW) * 16 + px)) * 4;
            const ua = beodeulSheet.data[usi + 3] ?? 0;
            if (ua > 128) {
              r = beodeulSheet.data[usi]!;
              g = beodeulSheet.data[usi + 1]!;
              b = beodeulSheet.data[usi + 2]!;
            }
          }
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const ox = (tx * 16 + px) * scale + dx;
              const oy = (ty * 16 + py) * scale + dy;
              const di = (oy * out.width + ox) * 4;
              out.data[di] = r;
              out.data[di + 1] = g;
              out.data[di + 2] = b;
              out.data[di + 3] = 255;
            }
          }
        }
      }
    }
  }
  return out;
}

const refMosaicPatch = extractCompositeKitPatch(
  1509,
  [
    [26820, 26821, 26822, 26823, 26824],
    [26825, 26826, 26827, 26828, 26829],
    [26830, 26831, 26832, 26833, 26834],
    [26835, 26836, 26837, 26838, 26839],
    [26840, 26841, 26842, 26843, 26844],
  ],
  5,
);
writeFileSync(join(OUT_DIR, "ref_beodeul_mosaic_5x5.png"), PNG.sync.write(refMosaicPatch));

// 4. Grass & Sand Path Autotile 3x3 transition
const refSandGrassPatch = extractTilePatch([
  [737, 23160, 737],
  [23163, 23175, 23161],
  [2502, 23162, 11628],
], 6);
writeFileSync(join(OUT_DIR, "ref_beodeul_sand_grass_3x3.png"), PNG.sync.write(refSandGrassPatch));

// Curated Beodeul-hang Ground & Stone Palette extracted directly from beodeul_city tiles
const BEODEUL_TILE_PALETTE: Readonly<Record<string, { hex: string; rgba: Rgba; desc: string }>> = {
  G: { hex: "#5d963a", rgba: [93, 150, 58, 255], desc: "버들항 기본 풀밭(737 주조색)" },
  g: { hex: "#538c31", rgba: [83, 140, 49, 255], desc: "버들항 풀밭 중간 그림자" },
  d: { hex: "#477d28", rgba: [71, 125, 40, 255], desc: "버들항 풀밭 깊은 결/테두리" },
  l: { hex: "#6ba446", rgba: [107, 164, 70, 255], desc: "버들항 풀밭 밝은 잎끝" },
  K: { hex: "#4a4842", rgba: [74, 72, 66, 255], desc: "버들항 석재 깊은 줄눈/틈새(순검정 금지)" },
  D: { hex: "#68655d", rgba: [104, 101, 93, 255], desc: "버들항 포석/연석 어두운 돌그림자" },
  S: { hex: "#878378", rgba: [135, 131, 120, 255], desc: "버들항 길 포석 중간 회갈색 돌" },
  L: { hex: "#a39e91", rgba: [163, 158, 145, 255], desc: "버들항 광장 판석 밝은 회베이지" },
  P: { hex: "#bab4a4", rgba: [186, 180, 164, 255], desc: "버들항 트래버틴 판석 상단 하이라이트" },
  W: { hex: "#d2ccb8", rgba: [210, 204, 184, 255], desc: "버들항 연석/모자이크 밝은 석회암 모서리" },
  M: { hex: "#7d6b52", rgba: [125, 107, 82, 255], desc: "버들항 모랫길/흙 어두운 황토" },
  m: { hex: "#9c8769", rgba: [156, 135, 105, 255], desc: "버들항 모랫길/모자이크 따뜻한 사암" },
  s: { hex: "#b8a282", rgba: [184, 162, 130, 255], desc: "버들항 모랫길 밝은 모래결" },
  R: { hex: "#8c4a38", rgba: [140, 74, 56, 255], desc: "버들항 신전 모자이크 테라코타 적갈색" },
  r: { hex: "#b5694d", rgba: [181, 105, 77, 255], desc: "버들항 신전 모자이크 밝은 테라코타" },
  B: { hex: "#3b6e8c", rgba: [59, 110, 140, 255], desc: "버들항 모자이크/성소 청금석 어두운 청색" },
  C: { hex: "#5da3c2", rgba: [93, 163, 194, 255], desc: "버들항 성소 마석/룬 은은한 청록 빛" },
  Y: { hex: "#c7a246", rgba: [199, 162, 70, 255], desc: "버들항 성소 황동/금박 문양" },
};

async function callArgonForBeodeulTileGrid(
  title: string,
  brief: string,
): Promise<{ rows: string[]; note: string }> {
  const apiKey = await resolveRequestApiKey("google-antigravity");
  const paletteLines = Object.entries(BEODEUL_TILE_PALETTE)
    .map(([k, v]) => `  "${k}": ${v.hex} (${v.desc})`)
    .join("\n");

  const systemPrompt = [
    "너는 OPRN 스튜디오의 '버들항(beodeul_city)' 16px 타일셋 전담 바닥 타일 도트 디자이너다.",
    "첨부된 4장의 실제 버들항(beodeul_city) 타일 레퍼런스 이미지를 자세히 관찰하라:",
    "1) 버들항 길 포석(3×3): 바깥 가장자리 2px에 밝은 연석(W/P)과 줄눈(K/D)이 둘러지고, 내부는 불규칙한 둥근 사각 포석(S/L)과 1px 줄눈(D/K)이 맞물린다. 순검정(#000000)이나 쨍한 원색 벽돌 격자는 절대 쓰지 않는다.",
    "2) 버들항 광장 판석(3×3): 따뜻한 회베이지/트래버틴 석판(S/L/P)이 6~10px 크기의 자연스러운 석판 결로 나뉘며, 과도한 체크무늬나 노란 벽돌색을 쓰지 않는다.",
    "3) 버들항 신전 모자이크 메달리온(5×5): 석판 바닥 위에 테라코타(R/r), 사암(m/s), 청금석(B/C), 황동(Y)으로 정교한 기하학 테두리와 중앙 문양을 얹되, 주변 석판/풀밭과 톤이 차분하게 어우러진다.",
    "4) 버들항 모랫길·풀밭 경계(3×3): 바깥 1~2px 모서리가 버들항 풀밭(G/g/d/l)과 계단식(dithered/organic)으로 자연스럽게 이어져 네모난 칼자국이 나지 않는다.",
    "",
    "출력 형식: 오직 JSON 객체 하나만 출력하라 (마크다운 코드블록 없이 순수 JSON):",
    '{"rows": ["48글자 문자열 48줄..."], "note": "버들항 레퍼런스 반영 포인트 한 줄"}',
    "- 캔버스 크기: 48×48 화소 (16px 타일 3×3칸). rows 배열 길이는 정확히 48이고, 각 문자열 길이는 정확히 48이어야 한다.",
    "- 사용할 수 있는 문자는 오직 아래 팔레트 키(G,g,d,l,K,D,S,L,P,W,M,m,s,R,r,B,C,Y) 뿐이다.",
  ].join("\n");

  const userContent: ContentPart[] = [
    {
      type: "text",
      text: [
        `# 생성할 버들항 3×3 바닥 타일 키트 (48×48px): ${title}`,
        `- 설계 지시: ${brief}`,
        "- 핵심 규칙:",
        "  1. 맨 바깥 테두리 1~2px은 버들항 풀밭(G, g, d, l)과 둥글게/자연스럽게 맞물리도록 귀퉁이를 풀밭(G/g)으로 감싸고, 그 안쪽에 2px 버들항 연석 테두리(D, L, P, W)를 둘러라.",
        "  2. 내부 판석(S, L, P)은 버들항 광장 판석 레퍼런스처럼 차분한 석회암/트래버틴 결을 유지하고, 중앙에 요청된 성소/제단 모자이크 문양(R, r, B, C, Y, m)을 정교하게 새겨라.",
        "  3. 단조로운 가로줄 벽돌이나 2색 체크무늬를 절대 그리지 마라.",
        "",
        "## 버들항 고정 팔레트 키:",
        paletteLines,
        "",
        "## 첨부 레퍼런스 1: 버들항 길 포석 3×3 (연석 2px + 포석 결)",
      ].join("\n"),
    },
    { type: "image_url", image_url: { url: pngToDataUrl(refRoadPatch), detail: "high" } },
    { type: "text", text: "## 첨부 레퍼런스 2: 버들항 광장 판석 3×3 (트래버틴 석판 질감)" },
    { type: "image_url", image_url: { url: pngToDataUrl(refPlazaPatch), detail: "high" } },
    { type: "text", text: "## 첨부 레퍼런스 3: 버들항 신전 모자이크 메달리온 5×5 (테두리 + 중앙 문양)" },
    { type: "image_url", image_url: { url: pngToDataUrl(refMosaicPatch), detail: "high" } },
    { type: "text", text: "## 첨부 레퍼런스 4: 버들항 모랫길·풀밭 자연 경계 3×3" },
    { type: "image_url", image_url: { url: pngToDataUrl(refSandGrassPatch), detail: "high" } },
  ];

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const { completion } = (await completeProvider(
    "google-antigravity",
    {
      model: "gemini-4-argon",
      messages,
      stream: false,
      max_tokens: 4096,
      temperature: 0.3,
      reasoning: { effort: "low" },
    },
    { apiKey },
  )) as { completion: { choices: { message: { content: unknown } }[] } };

  const content = String(completion.choices[0]?.message?.content ?? "");
  const raw = content.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as { rows: string[]; note?: string };
  const normalizedRows: string[] = [];
  for (let y = 0; y < 48; y++) {
    const line = (parsed.rows?.[y] ?? parsed.rows?.[parsed.rows.length - 1] ?? "G".repeat(48))
      .replace(/[^GgdlKDSLPWMmsRrBCY]/gu, "S");
    normalizedRows.push(line.padEnd(48, "G").slice(0, 48));
  }
  return { rows: normalizedRows, note: parsed.note ?? "" };
}

function render48GridToPng(rows: readonly string[], scale = 4): PNG {
  const out = new PNG({ width: 48 * scale, height: 48 * scale });
  for (let y = 0; y < 48; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < 48; x++) {
      const ch = row[x] ?? "G";
      const rgba = BEODEUL_TILE_PALETTE[ch]?.rgba ?? BEODEUL_TILE_PALETTE.G!.rgba;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const ox = x * scale + dx;
          const oy = y * scale + dy;
          const di = (oy * out.width + ox) * 4;
          out.data[di] = rgba[0];
          out.data[di + 1] = rgba[1];
          out.data[di + 2] = rgba[2];
          out.data[di + 3] = 255;
        }
      }
    }
  }
  return out;
}

function bakeAndStamp3x3FloorKit(
  project: Project,
  map: GameMap,
  slug: string,
  title: string,
  rows48: readonly string[],
  topLeftX: number,
  topLeftY: number,
): void {
  const tileset = project.tilesets[map.tilesetId]!;
  const perRow = bundledChipsetTilesPerRow("workshop_");
  const sheet = new PNG({ width: perRow * 16, height: 16 });
  const cells: { sourceTile: number; dx: number; dy: number }[] = [];

  let k = 0;
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      const sourceTile = k++;
      cells.push({ sourceTile, dx: tx, dy: ty });
      for (let py = 0; py < 16; py++) {
        const rowStr = rows48[ty * 16 + py] ?? "";
        for (let px = 0; px < 16; px++) {
          const ch = rowStr[tx * 16 + px] ?? "G";
          const rgba = BEODEUL_TILE_PALETTE[ch]?.rgba ?? BEODEUL_TILE_PALETTE.G!.rgba;
          const di = (py * sheet.width + (sourceTile * 16 + px)) * 4;
          sheet.data[di] = rgba[0];
          sheet.data[di + 1] = rgba[1];
          sheet.data[di + 2] = rgba[2];
          sheet.data[di + 3] = 255;
        }
      }
    }
  }

  const dataUrl = pngToDataUrl(sheet);
  const assetId = workshopAssetId(dataUrl);
  const kit = bakeWorkshopObject(project, map.tilesetId, {
    objectId: `workshop:${slug}`,
    title,
    description: title,
    kind: "flat",
    columns: 3,
    rows: 3,
    footRows: 0,
    risePx: 0,
    use: ["ground", "beodeul-floor"],
    gridHash: `${slug}_48x48`,
    asset: { id: assetId, dataUrl, width: sheet.width, height: sheet.height },
    cells,
  });

  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const mx = topLeftX + dx;
      const my = topLeftY + dy;
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) continue;
      const tid = kit.rows[dy]?.upperTiles?.[dx] ?? kit.rows[dy]?.tiles?.[dx] ?? -1;
      if (tid >= 0) {
        map.lowerTiles[my * map.width + mx] = tid;
        tileset.priority[tid] = "lower";
        tileset.passability[tid] = { up: true, down: true, left: true, right: true };
      }
    }
  }
}

// Helper to build a BEFORE (old raw brick tile baseline) vs AFTER (Beodeul-hang reference-guided tile layout + Argon custom floor tile) comparison
function buildOldRawBrickScene(project: Project, map: GameMap, fx: number, fy: number): void {
  const tileset = project.tilesets[map.tilesetId]!;
  const midX = Math.floor(map.width / 2);
  const midY = Math.floor(map.height / 2);
  for (const tid of [25270, 25850, 24529]) {
    tileset.passability[tid] = { up: true, down: true, left: true, right: true };
  }
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      const idx = y * map.width + x;
      const inPlaza = Math.abs(x - midX) <= 3 && Math.abs(y - midY) <= 2;
      const onHorizontalRoad = Math.abs(y - midY) <= 1;
      const onVerticalRoad = Math.abs(x - midX) <= 1;
      const onPerimeterWalk = x === 1 || x === map.width - 2 || y === 1 || y === map.height - 2;
      if (inPlaza) {
        map.lowerTiles[idx] = (x + y) % 2 === 0 ? 25850 : 24529;
      } else if (onHorizontalRoad || onVerticalRoad) {
        map.lowerTiles[idx] = 25270;
      } else if (onPerimeterWalk && (x + y) % 3 === 0) {
        map.lowerTiles[idx] = 24529;
      }
    }
  }
  // Old 5x5 yellow/gray brick square around (fx, fy)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const gx = fx + dx;
      const gy = fy + dy;
      if (gx < 1 || gy < 1 || gx >= map.width - 1 || gy >= map.height - 1) continue;
      map.lowerTiles[gy * map.width + gx] = Math.abs(dx) === 2 || Math.abs(dy) === 2 ? 24529 : 25850;
    }
  }
}

function buildAuthenticBeodeulScene(
  project: Project,
  map: GameMap,
  fx: number,
  fy: number,
  customFloorRows?: readonly string[],
): void {
  const fillTool = getTool("fill_region")!;
  const stampTool = getTool("stamp_object")!;

  // 1. Base meadow grass
  fillTool.run(project, {
    mapId: map.id,
    rect: { x: 0, y: 0, w: map.width, h: map.height },
    material: "버들항 풀밭",
    clearUpper: true,
  });

  // 2. Winding cobblestone main road with automatic 2px stone curbs ("버들항 길 포석")
  const midY = Math.floor(map.height / 2);
  const midX = Math.floor(map.width / 2);
  fillTool.run(project, {
    mapId: map.id,
    rect: { x: 0, y: midY, w: map.width, h: 2 },
    material: "버들항 길 포석",
  });
  fillTool.run(project, {
    mapId: map.id,
    rect: { x: midX - 1, y: 0, w: 2, h: map.height },
    material: "버들항 길 포석",
  });

  // 3. Central plaza framed by cobblestone road curbs & filled with Roman travertine flagstones ("버들항 광장 판석")
  fillTool.run(project, {
    mapId: map.id,
    rect: { x: midX - 4, y: midY - 3, w: 9, h: 7 },
    material: "버들항 길 포석",
  });
  fillTool.run(project, {
    mapId: map.id,
    rect: { x: midX - 3, y: midY - 2, w: 7, h: 5 },
    material: "버들항 광장 판석",
  });

  // 4. Secondary sand path trail ("버들항 모랫길") leading to northwest & southeast groves
  fillTool.run(project, {
    mapId: map.id,
    rect: { x: 2, y: 2, w: 5, h: 2 },
    material: "버들항 모랫길",
  });
  fillTool.run(project, {
    mapId: map.id,
    rect: { x: 3, y: 4, w: 2, h: midY - 4 },
    material: "버들항 모랫길",
  });

  // 5. Stamp authentic Beodeul-hang multi-tile trees, bushes, lamps, benches, flowerboxes
  const safeStamps: Array<{ id: string; x: number; y: number }> = [
    { id: "kit:beodeul_city/bd-tree-03a8f7", x: 1, y: 1 },
    { id: "kit:beodeul_city/bd-tree-3e8732", x: map.width - 4, y: 1 },
    { id: "kit:beodeul_city/bd-tree-1a786c", x: 1, y: map.height - 5 },
    { id: "kit:beodeul_city/bd-tree-03a8f7", x: map.width - 4, y: map.height - 5 },
    { id: "kit:beodeul_city/bd-tree-f4f319", x: 5, y: 2 },
    { id: "kit:beodeul_city/bd-tree-37f48b", x: map.width - 7, y: 2 },
    { id: "kit:beodeul_city/bd-tree-37f48b", x: 5, y: map.height - 4 },
    { id: "kit:beodeul_city/bd-tree-f4f319", x: map.width - 7, y: map.height - 4 },
    { id: "kit:beodeul_city/bd-prop-lamp_crook", x: midX - 5, y: midY - 2 },
    { id: "kit:beodeul_city/bd-prop-lamp_crook", x: midX + 5, y: midY - 2 },
    { id: "kit:beodeul_city/bd-prop-bench_wood", x: midX - 4, y: midY - 4 },
    { id: "kit:beodeul_city/bd-prop-flowerbox_long", x: midX + 2, y: midY - 3 },
    { id: "kit:beodeul_city/bd-pick-temple-ruins-column-temple-tall", x: midX - 4, y: midY + 1 },
    { id: "kit:beodeul_city/bd-pick-temple-ruins-column-temple-tall", x: midX + 4, y: midY + 1 },
  ];
  for (const s of safeStamps) {
    if (map.events.some((e) => Math.abs(e.x - s.x) <= 1 && Math.abs(e.y - s.y) <= 1)) continue;
    try {
      stampTool.run(project, { objectId: s.id, mapId: map.id, x: s.x, y: s.y, layers: "upper" });
    } catch {
      // ignore if clipped or blocked
    }
  }

  // 6. Apply dressBeodeulGround for natural grass/wildflower/stone clusters
  try {
    dressBeodeulGround(project, map.id, "living", 1004);
  } catch {
    // ignore
  }

  // 7. If Argon generated a custom Beodeul-referenced 3x3 sanctuary floor tile kit, stamp it at (fx - 1, fy - 1)
  if (customFloorRows) {
    bakeAndStamp3x3FloorKit(project, map, `argon-beodeul-floor-${map.id}`, "버들항 레퍼런스 커스텀 바닥", customFloorRows, fx - 1, fy - 1);
  }
}

function stitchSideBySide(left: PNG, right: PNG, tile3x3?: PNG): PNG {
  const gap = 16;
  const pad = 16;
  const extraW = tile3x3 ? tile3x3.width + gap : 0;
  const width = pad * 2 + left.width + gap + right.width + extraW;
  const height = pad * 2 + Math.max(left.height, right.height, tile3x3?.height ?? 0);
  const out = new PNG({ width, height });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 18;
    out.data[i + 1] = 22;
    out.data[i + 2] = 31;
    out.data[i + 3] = 255;
  }
  PNG.bitblt(left, out, 0, 0, left.width, left.height, pad, pad);
  PNG.bitblt(right, out, 0, 0, right.width, right.height, pad + left.width + gap, pad);
  if (tile3x3) {
    const ty = pad + Math.floor((Math.max(left.height, right.height) - tile3x3.height) / 2);
    PNG.bitblt(tile3x3, out, 0, 0, tile3x3.width, tile3x3.height, pad + left.width + gap + right.width + gap, Math.max(pad, ty));
  }
  return out;
}

function decodePngTo48Grid(png: PNG, scale = 4): string[] {
  const entries = Object.entries(BEODEUL_TILE_PALETTE);
  const rows: string[] = [];
  for (let y = 0; y < 48; y++) {
    let line = "";
    for (let x = 0; x < 48; x++) {
      const di = (y * scale * png.width + x * scale) * 4;
      const r = png.data[di] ?? 0;
      const g = png.data[di + 1] ?? 0;
      const b = png.data[di + 2] ?? 0;
      let bestSym = "G";
      let bestDist = Infinity;
      for (const [sym, info] of entries) {
        const dr = r - info.rgba[0];
        const dg = g - info.rgba[1];
        const db = b - info.rgba[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestSym = sym;
        }
      }
      line += bestSym;
    }
    rows.push(line);
  }
  return rows;
}

async function loadOrGenerateArgonFloor(
  slug: string,
  title: string,
  brief: string,
): Promise<{ rows: string[]; note: string }> {
  const pngPath = join(OUT_DIR, `${slug}.png`);
  const jsonPath = join(OUT_DIR, `${slug}.json`);
  const forceRegen = process.argv.includes("--regen");
  if (!forceRegen && existsSync(jsonPath)) {
    return JSON.parse(readFileSync(jsonPath, "utf8")) as { rows: string[]; note: string };
  }
  if (!forceRegen && existsSync(pngPath)) {
    const png = PNG.sync.read(readFileSync(pngPath));
    const rows = decodePngTo48Grid(png, 4);
    const cached = { rows, note: `${title} (decoded from generated ${slug}.png)` };
    writeFileSync(jsonPath, JSON.stringify(cached, null, 2));
    return cached;
  }
  const generated = await callArgonForBeodeulTileGrid(title, brief);
  writeFileSync(jsonPath, JSON.stringify(generated, null, 2));
  return generated;
}

async function main() {
  console.log("1. Preparing gemini-4-argon Beodeul-hang (beodeul_city) reference-guided 3x3 floor kits...");
  const [
    portalFloor,
    altarFloor,
    ruinFloor,
    bossFloor,
    innFloor,
    merchantFloor,
    trapFloor,
    magitekFloor,
    dockFloor,
  ] = await Promise.all([
    loadOrGenerateArgonFloor(
      "argon_tile_portal_3x3",
      "천년제 텔레포드 차원문 성소 바닥 (3×3칸)",
      "버들항 광장 트래버틴 판석(S,L,P)과 2px 연석(W,D) 테두리 안에, 청금석(B,C)과 황동(Y), 테라코타(R,r)로 정교한 팔각 시공 룬 모자이크가 새겨진 3×3 성소 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_altar_3x3",
      "고대 마석 제단 성소 모자이크 바닥 (3×3칸)",
      "버들항 풀밭(G,g,d)과 자연스럽게 맞물리는 2px 석회암 연석(W,P,D) 안쪽에, 로마 신전 스타일의 테라코타(R,r)·사암(m,s)·청록 마석(B,C) 태양 문양 모자이크가 놓인 3×3 제단 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_ruin_3x3",
      "가르디아 왕국 고대 유적 결계 석판 바닥 (3×3칸)",
      "버들항 회갈색 포석(S,L,D)과 이끼 낀 풀밭 귀퉁이(G,g,d)가 조화를 이루며, 중심에 황동(Y)과 청금석(B,C) 십자 문양이 박힌 3×3 고대 유적 석판 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_boss_3x3",
      "마왕 결전 제단 로마 모자이크 바닥 (3×3칸)",
      "버들항 2px 석회암 연석(W,P,D) 안쪽에 어두운 판석(D,S)과 진홍 테라코타(R,r)·황금 테두리(Y)로 위엄 있는 왕좌 문장 카펫 모자이크가 새겨진 3×3 보스 제단 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_inn_3x3",
      "여관 모닥불 휴식터 따뜻한 테라코타 석판 바닥 (3×3칸)",
      "버들항 풀밭(G,g,d)과 둥글게 이어지는 2px 연석(P,W) 안쪽에 따뜻한 사암(m,s)과 테라코타 벽돌 모자이크(R,r,Y)가 원형 화로 자리처럼 깔린 3×3 여관 휴식처 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_merchant_3x3",
      "버들항 장터 상점 가판대 광장 모자이크 바닥 (3×3칸)",
      "버들항 트래버틴 광장 판석(S,L,P) 위에 사암(m,s)과 테라코타(R,r), 청금석(B)으로 장터 길드 문양 테두리가 상감된 3×3 상점 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_trap_3x3",
      "고대 유적 함정 발판 석판 바닥 (3×3칸)",
      "버들항 회갈색 포석(S,D,K)과 2px 연석(L,P) 안에 정교한 청동(Y,M)과 적갈색 경고 문양(R,r) 및 어두운 줄눈 구멍(K,D)이 대칭으로 배열된 3×3 함정 석판 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_magitek_3x3",
      "제국 마도 연구소 동력 코어 도관 바닥 (3×3칸)",
      "버들항 중후한 석판(D,S,L)과 황동 파이프 라인(Y,m), 청록 마도 에너지 도관(B,C)이 십자 및 팔각 회로처럼 상감된 3×3 마도 장치 바닥.",
    ),
    loadOrGenerateArgonFloor(
      "argon_tile_dock_3x3",
      "버들항 부두·비공정 승강장 판석 바닥 (3×3칸)",
      "버들항 밝은 석회암 연석(W,P,L) 테두리와 사암(m,s)·황동 방위표(Y)·청금석 나침반(B,C)이 새겨진 3×3 탈것 승강장 바닥.",
    ),
  ]);

  const portalTilePng = render48GridToPng(portalFloor.rows, 4);
  const altarTilePng = render48GridToPng(altarFloor.rows, 4);
  const ruinTilePng = render48GridToPng(ruinFloor.rows, 4);

  writeFileSync(join(OUT_DIR, "argon_tile_portal_3x3.png"), PNG.sync.write(portalTilePng));
  writeFileSync(join(OUT_DIR, "argon_tile_altar_3x3.png"), PNG.sync.write(altarTilePng));
  writeFileSync(join(OUT_DIR, "argon_tile_ruin_3x3.png"), PNG.sync.write(ruinTilePng));
  writeFileSync(join(OUT_DIR, "argon_tile_boss_3x3.png"), PNG.sync.write(render48GridToPng(bossFloor.rows, 4)));
  writeFileSync(join(OUT_DIR, "argon_tile_inn_3x3.png"), PNG.sync.write(render48GridToPng(innFloor.rows, 4)));
  writeFileSync(join(OUT_DIR, "argon_tile_merchant_3x3.png"), PNG.sync.write(render48GridToPng(merchantFloor.rows, 4)));
  writeFileSync(join(OUT_DIR, "argon_tile_trap_3x3.png"), PNG.sync.write(render48GridToPng(trapFloor.rows, 4)));
  writeFileSync(join(OUT_DIR, "argon_tile_magitek_3x3.png"), PNG.sync.write(render48GridToPng(magitekFloor.rows, 4)));
  writeFileSync(join(OUT_DIR, "argon_tile_dock_3x3.png"), PNG.sync.write(render48GridToPng(dockFloor.rows, 4)));

  // Scene 1: Dimensional Portal Plaza (Before vs After)
  const projBefore1 = createCapabilityFixtureProject();
  const mapBefore1 = projBefore1.maps["map_ember_village"]!;
  buildOldRawBrickScene(projBefore1, mapBefore1, 10, 7);
  bakeAndStampCustomObject(projBefore1, mapBefore1, {
    archetype: "dimensional_portal",
    title: "시공의 차원문",
    focusX: 10,
    focusY: 7,
    dressSurroundings: false,
  });
  finishDraftTilesets(createCapabilityFixtureProject(), projBefore1);
  const pngBefore1 = PNG.sync.read(renderMapPng(projBefore1, mapBefore1, 2).png);

  const projAfter1 = createCapabilityFixtureProject();
  const mapAfter1 = projAfter1.maps["map_ember_village"]!;
  buildAuthenticBeodeulScene(projAfter1, mapAfter1, 10, 7, portalFloor.rows);
  bakeAndStampCustomObject(projAfter1, mapAfter1, {
    archetype: "dimensional_portal",
    title: "시공의 차원문",
    focusX: 10,
    focusY: 7,
    dressSurroundings: false,
  });
  finishDraftTilesets(createCapabilityFixtureProject(), projAfter1);
  const pngAfter1 = PNG.sync.read(renderMapPng(projAfter1, mapAfter1, 2).png);

  const comp1 = stitchSideBySide(pngBefore1, pngAfter1, portalTilePng);
  writeFileSync(join(OUT_DIR, "compare_scene1_portal.png"), PNG.sync.write(comp1));
  writeFileSync(join(OUT_DIR, "scene1_before.png"), PNG.sync.write(pngBefore1));
  writeFileSync(join(OUT_DIR, "scene1_after.png"), PNG.sync.write(pngAfter1));

  // Scene 2: Magicite Altar Sanctuary (Before vs After)
  const projBefore2 = createCapabilityFixtureProject();
  const mapBefore2 = projBefore2.maps["map_ember_village"]!;
  buildOldRawBrickScene(projBefore2, mapBefore2, 10, 7);
  bakeAndStampCustomObject(projBefore2, mapBefore2, {
    archetype: "magicite_altar",
    title: "고대 마석 제단",
    focusX: 10,
    focusY: 7,
    dressSurroundings: false,
  });
  finishDraftTilesets(createCapabilityFixtureProject(), projBefore2);
  const pngBefore2 = PNG.sync.read(renderMapPng(projBefore2, mapBefore2, 2).png);

  const projAfter2 = createCapabilityFixtureProject();
  const mapAfter2 = projAfter2.maps["map_ember_village"]!;
  buildAuthenticBeodeulScene(projAfter2, mapAfter2, 10, 7, altarFloor.rows);
  bakeAndStampCustomObject(projAfter2, mapAfter2, {
    archetype: "magicite_altar",
    title: "고대 마석 제단",
    focusX: 10,
    focusY: 7,
    dressSurroundings: false,
  });
  finishDraftTilesets(createCapabilityFixtureProject(), projAfter2);
  const pngAfter2 = PNG.sync.read(renderMapPng(projAfter2, mapAfter2, 2).png);

  const comp2 = stitchSideBySide(pngBefore2, pngAfter2, altarTilePng);
  writeFileSync(join(OUT_DIR, "compare_scene2_altar.png"), PNG.sync.write(comp2));
  writeFileSync(join(OUT_DIR, "scene2_before.png"), PNG.sync.write(pngBefore2));
  writeFileSync(join(OUT_DIR, "scene2_after.png"), PNG.sync.write(pngAfter2));

  // Scene 3: Puzzle Mechanism & Temple Mosaic (Before vs After)
  const projBefore3 = createCapabilityFixtureProject();
  const mapBefore3 = projBefore3.maps["map_ember_village"]!;
  buildOldRawBrickScene(projBefore3, mapBefore3, 10, 7);
  bakeAndStampCustomObject(projBefore3, mapBefore3, {
    archetype: "puzzle_mechanism",
    title: "고대 수문 제어기",
    focusX: 10,
    focusY: 7,
    dressSurroundings: false,
  });
  finishDraftTilesets(createCapabilityFixtureProject(), projBefore3);
  const pngBefore3 = PNG.sync.read(renderMapPng(projBefore3, mapBefore3, 2).png);

  const projAfter3 = createCapabilityFixtureProject();
  const mapAfter3 = projAfter3.maps["map_ember_village"]!;
  buildAuthenticBeodeulScene(projAfter3, mapAfter3, 10, 7, ruinFloor.rows);
  bakeAndStampCustomObject(projAfter3, mapAfter3, {
    archetype: "puzzle_mechanism",
    title: "고대 수문 제어기",
    focusX: 10,
    focusY: 7,
    dressSurroundings: false,
  });
  finishDraftTilesets(createCapabilityFixtureProject(), projAfter3);
  const pngAfter3 = PNG.sync.read(renderMapPng(projAfter3, mapAfter3, 2).png);

  const comp3 = stitchSideBySide(pngBefore3, pngAfter3, ruinTilePng);
  writeFileSync(join(OUT_DIR, "compare_scene3_ruin.png"), PNG.sync.write(comp3));
  writeFileSync(join(OUT_DIR, "scene3_before.png"), PNG.sync.write(pngBefore3));
  writeFileSync(join(OUT_DIR, "scene3_after.png"), PNG.sync.write(pngAfter3));

  console.log("Saved all comparison images to:", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
