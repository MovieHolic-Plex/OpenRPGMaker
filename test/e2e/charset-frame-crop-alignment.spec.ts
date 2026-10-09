// 캐릭터 그림(charset) 크롭은 프레임 경계에서 이웃 프레임 픽셀을 노출해서는 안 된다.
//
// 실측 결함(2026-08-28, Monster3 · 몬스터 3):
//   `.event-graphic-preview-panel .npc-character-cell` 이 `border: 2px solid transparent` +
//   전역 `box-sizing: border-box` 라서 48x64 상자의 **패딩 박스가 44x60** 으로 줄었다.
//   배경 원점은 패딩 박스(background-origin 기본값)인데 그리는 범위는 테두리 박스
//   (background-clip 기본값)라서, 투명 테두리 2px 아래로 **위 행 프레임의 하단 픽셀**이
//   그대로 보였다. 동시에 프레임의 오른쪽·아래 2 소스 픽셀은 잘려 나갔다.
//   Actor/People 시트는 셀 경계가 투명해서 증상이 안 보인다.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs"; // 선언은 test/pngjs.d.ts 에 좁게 두었다.
import { openEventEditor } from "./eventEditorCertEvidence";
import type { Project } from "@/project/types";

const FRAME_WIDTH = 24;
const FRAME_HEIGHT = 32;
const SHEET_COLUMNS = 12;
const SHEET_ROWS = 8;
const SHEET_PATH = "public/assets/easyrpg/charset/Monster3.png";
/** 시트 (col 2, row 6) = characterIndex 4 · 아래 · 패턴 2. 위 셀(col 2, row 5) 하단행에
 *  불투명 픽셀이 20개 닿아 있어 누출이 가장 크게 보이는 셀이다. */
const BLEED_COLUMN = 2;
const BLEED_ROW = 6;
const BLEED_SLOT = 4;
/** characterIndex 0 · 아래 · 패턴 2 로 열면 슬롯 4 는 **비활성**(투명 테두리) 상태로 렌더된다. */
const SEED_FRAME_INDEX = 2 * SHEET_COLUMNS + 2;
const PASSABLE = { up: true, down: true, left: true, right: true };

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

function projectWithMonsterCharsetEvent(): Project {
  return {
    version: 3,
    meta: { title: "Charset Frame Crop", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "Default tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: [PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE],
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    switches: [],
    variables: [],
    commonEvents: [],
    database: {
      actors: [],
      classes: [],
      skills: [],
      items: [],
      equipment: [],
      enemies: [],
      troops: [],
      states: [],
      battleAnimations: [],
    },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_test: {
        id: "map_test",
        name: "테스트 맵",
        width: 5,
        height: 5,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(25).fill(0),
        upperTiles: new Array<number>(25).fill(-1),
        events: [
          {
            id: "ev_monster",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page-1",
                name: "1",
                conditions: [],
                graphic: {
                  sprite: { type: "bundled", id: "tex_easyrpg_charset_monster3" },
                  pattern: SEED_FRAME_INDEX,
                },
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_test", children: [] },
    startMapId: "map_test",
    startPos: { x: 1, y: 1 },
    flags: {},
  } satisfies Project;
}

type CropGeometry = {
  readonly label: string;
  readonly paddingWidth: number;
  readonly paddingHeight: number;
  readonly maxBorder: number;
  readonly backgroundClip: string;
  readonly scaleX: number;
  readonly scaleY: number;
};

async function openMonsterGraphicPicker(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    window.__OPRN_E2E_PROJECT__ = seed;
    const uiMode = window.localStorage.getItem("oprn:editor-ui-mode");
    window.localStorage.clear();
    if (uiMode !== null) window.localStorage.setItem("oprn:editor-ui-mode", uiMode);
  }, projectWithMonsterCharsetEvent());
  await page.goto("/");
  const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
  try {
    await expect(canvas).toBeVisible({ timeout: 60_000 });
  } catch {
    // 워크트리 dev 서버는 첫 요청에서 네트워크가 끊기면(ERR_NETWORK_CHANGED) 빈 화면으로 남는다.
    // 재부팅 한 번만 허용하고, 그다음은 실패로 둔다.
    await page.reload();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
  }
  await openEventEditor(page, "ev_monster");
  await page.getByTestId("event-page-graphic-set").click();
  await expect(page.getByTestId("npc-graphic-picker")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator(`.npc-character-cell[data-slot="${BLEED_SLOT}"][data-transparent-color-key="applied"]`)
  ).toBeVisible({ timeout: 30_000 });
}

/** 시트에서 셀 (column,row) 첫 행의 불투명 x 좌표. 색상키는 좌상단 픽셀 색이다. */
function opaqueColumnsOfFirstRow(column: number, row: number): readonly number[] {
  const png = PNG.sync.read(readFileSync(SHEET_PATH));
  const at = (x: number, y: number): readonly number[] => {
    const index = (y * png.width + x) * 4;
    return [png.data[index]!, png.data[index + 1]!, png.data[index + 2]!, png.data[index + 3]!];
  };
  const key = at(0, 0);
  const columns: number[] = [];
  for (let x = 0; x < FRAME_WIDTH; x += 1) {
    const pixel = at(column * FRAME_WIDTH + x, row * FRAME_HEIGHT);
    const isKey = pixel[0] === key[0] && pixel[1] === key[1] && pixel[2] === key[2];
    if (!isKey && pixel[3] !== 0) columns.push(x);
  }
  return columns;
}

test("charset 크롭의 패딩 박스가 프레임과 정확히 일치하고, 배경이 테두리 밖으로 새지 않는다", async ({ page }) => {
  await openMonsterGraphicPicker(page);

  const crops = await page.evaluate(
    ({ frameWidth, frameHeight, sheetColumns, sheetRows }) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-transparent-color-key="applied"]'));
      // 진짜로 그려진 크롭만 본다 — 이벤트 편집기 변허 뒤에는 0px 로 숨은 통합 샘프링도 남아 있다.
      return nodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const border = {
          top: parseFloat(style.borderTopWidth) || 0,
          right: parseFloat(style.borderRightWidth) || 0,
          bottom: parseFloat(style.borderBottomWidth) || 0,
          left: parseFloat(style.borderLeftWidth) || 0,
        };
        const [sheetWidth, sheetHeight] = style.backgroundSize
          .split(" ")
          .map((value) => parseFloat(value));
        return {
          label: `${node.className}${node.dataset.slot ? `[slot=${node.dataset.slot}]` : ""}`,
          paddingWidth: rect.width - border.left - border.right,
          paddingHeight: rect.height - border.top - border.bottom,
          maxBorder: Math.max(border.top, border.right, border.bottom, border.left),
          backgroundClip: style.backgroundClip,
          scaleX: (sheetWidth ?? 0) / (sheetColumns * frameWidth),
          scaleY: (sheetHeight ?? 0) / (sheetRows * frameHeight),
        };
        });
    },
    { frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT, sheetColumns: SHEET_COLUMNS, sheetRows: SHEET_ROWS }
  );

  expect(crops.length, "피커에 charset 크롭이 렌더돼 있어야 한다").toBeGreaterThan(0);
  for (const crop of crops as readonly CropGeometry[]) {
    expect(crop.scaleX, `${crop.label} 배율`).toBeGreaterThan(0);
    expect(crop.scaleX, `${crop.label} 가로/세로 배율 동일`).toBeCloseTo(crop.scaleY, 3);
    expect(crop.paddingWidth, `${crop.label} 패딩 박스 폭`).toBeCloseTo(FRAME_WIDTH * crop.scaleX, 1);
    expect(crop.paddingHeight, `${crop.label} 패딩 박스 높이`).toBeCloseTo(FRAME_HEIGHT * crop.scaleY, 1);
    // 테두리가 있으면 그 아래로 이웃 프레임이 드러난다 — 반드시 패딩 박스로 잘라야 한다.
    if (crop.maxBorder > 0) {
      expect(crop.backgroundClip, `${crop.label} background-clip`).toBe("padding-box");
    }
  }
});

test("몬스터 3 슬롯 상단에 위 행 프레임의 하단 픽셀이 보이지 않는다", async ({ page }, testInfo) => {
  await openMonsterGraphicPicker(page);

  const slot = page.locator(`.npc-character-cell[data-slot="${BLEED_SLOT}"]`);
  const inset = await slot.evaluate((node) => {
    const style = getComputedStyle(node);
    return { top: parseFloat(style.borderTopWidth) || 0, left: parseFloat(style.borderLeftWidth) || 0 };
  });
  const shot = await slot.screenshot({ path: testInfo.outputPath("monster3-slot.png") });
  const captured = PNG.sync.read(shot);
  const scale = Math.round((captured.width - 2 * inset.left) / FRAME_WIDTH);
  expect(scale, "슬롯 패딩 박스 폭이 프레임 폭의 정수배").toBeGreaterThan(0);

  const pixel = (x: number, y: number): readonly number[] => {
    const index = (y * captured.width + x) * 4;
    return [captured.data[index]!, captured.data[index + 1]!, captured.data[index + 2]!];
  };
  // 프레임의 4번째 소스 행은 통째로 색상키(투명)다 — 그 자리는 곧 패널 배경색이다.
  const background = pixel(0, inset.top + 4 * scale);
  const differs = (x: number, y: number): boolean => {
    const value = pixel(x, y);
    return (
      Math.abs(value[0]! - background[0]!) > 12 ||
      Math.abs(value[1]! - background[1]!) > 12 ||
      Math.abs(value[2]! - background[2]!) > 12
    );
  };

  const allowed = new Set<number>();
  for (const column of opaqueColumnsOfFirstRow(BLEED_COLUMN, BLEED_ROW)) {
    for (let offset = 0; offset < scale; offset += 1) allowed.add(inset.left + column * scale + offset);
  }

  // 캡처 맨 위부터 프레임 첫 행까지 — 테듀리 아래로 이웃 프레임이 드러나는 지대를 함개 본다.
  const leaked: string[] = [];
  for (let y = 0; y < inset.top + scale; y += 1) {
    for (let x = 0; x < captured.width; x += 1) {
      if (differs(x, y) && !allowed.has(x)) leaked.push(`${x},${y}`);
    }
  }
  expect(leaked, `슬롯 상단 ${inset.top + scale}행에 프레임 밖 픽셀이 있다: ${leaked.slice(0, 12).join(" ")}`).toEqual([]);
});
