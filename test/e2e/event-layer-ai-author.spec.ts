// 이벤트 레이어 우클릭 「AI 로 이벤트 만들기 / 고치기」의 브라우저 증거.
//
// 단위·통합 테스트는 happy-dom 이라 "정말 캔버스 우클릭에서 닿는가"와 "도크가 눈에 보이는
// 채로 펼쳐지는가"를 증명하지 못한다. 이 스펙은 실제 편집기에서 그 두 가지만 본다.
// `_` 접두어는 진단 스펙이라 기본 스위트에서 제외된다(playwright.config.ts 주석).
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { seedProjectForEditor } from "./projectSeed";
import type { Project } from "@/project/types";

const EVIDENCE_DIR = "evidence/browser-screenshots/event-ai-author-entry";

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly width: number; readonly height: number }>;
  };
};

// 기존 스펙과 같은 경로로 상태를 읽는다 — `project-export-json` 이 프로젝트 JSON 을 노출한다.
async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

const PASSABLE = { up: true, down: true, left: true, right: true };

/**
 * 최소 프로젝트를 **인라인으로** 세운다. `createBlankProject` 를 import 하면 앱 모듈 그래프가
 * 딸려 오고, 그 안의 JSON 자산이 import attribute 없이 로드돼 스펙이 아예 뜨지 않는다(실측:
 * "Module ... needs an import attribute of type: json" → No tests found).
 * 기존 `oprn-event-layer-interactions.spec.ts` 도 같은 이유로 인라인이다.
 */
function blankProject(): Project {
  const width = 5;
  const height = 4;
  return {
    version: 3,
    meta: { title: "AI 이벤트 저작", author: "e2e", terms: { gold: "G" } },
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
      actors: [], classes: [], skills: [], items: [], equipment: [],
      enemies: [], troops: [], states: [], battleAnimations: [],
    },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_layer: {
        id: "map_layer",
        name: "Layer",
        width,
        height,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(width * height).fill(0),
        upperTiles: new Array<number>(width * height).fill(-1),
        events: [],
      },
    },
    mapTree: { mapId: "map_layer", children: [] },
    startMapId: "map_layer",
    startPos: { x: 1, y: 1 },
    flags: {},
  } satisfies Project;
}

async function seedProject(page: Page): Promise<void> {
  await seedProjectForEditor(page, blankProject());
}

async function rightClickMapTile(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 16 * 2;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  await canvas.click({
    button: "right",
    position: { x: mapLeft + x * tileSize + tileSize / 2, y: mapTop + y * tileSize + tileSize / 2 },
  });
}

test("빈 칸 우클릭 → AI 로 이벤트 만들기 → 도크가 펼쳐진 채 편집기가 열린다", async ({ page }, testInfo) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();

  // 빈 칸: 라벨은 「만들기」다. 맵은 5×4 다.
  await rightClickMapTile(page, 1, 1);
  const aiItem = page.getByTestId("event-layer-event-ai-author");
  await expect(aiItem).toBeVisible();
  await expect(aiItem).toContainText("AI 로 이벤트 만들기...");
  await page.screenshot({ path: `${EVIDENCE_DIR}/01-menu-empty-tile.png`, fullPage: true });

  await aiItem.click();

  // 편집기가 열리고, AI 명령 도크가 **펼쳐진 채** 태어난다.
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  const dock = page.getByTestId("ai-event-assist");
  await expect(dock).toBeVisible();
  await expect(dock).toHaveAttribute("open", "");
  // 입력창이 초점을 받아 곧바로 문장을 칠 수 있다.
  await expect(page.getByTestId("ai-event-input")).toBeFocused();
  await page.screenshot({ path: `${EVIDENCE_DIR}/02-dock-expanded-focused.png`, fullPage: true });

  await testInfo.attach("evidence", {
    body: JSON.stringify({ dockOpen: await dock.getAttribute("open"), focused: true }, null, 2),
    contentType: "application/json",
  });
});

test("이벤트가 있는 칸 우클릭 → 「이 이벤트를 AI 로 고치기...」로 라벨이 바뀐다", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();

  // 먼저 이벤트를 하나 만든다(편집기를 취소해 초안을 버리지 않고 저장).
  await rightClickMapTile(page, 2, 2);
  await page.getByTestId("event-layer-create-event").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  // `event-editor-ok` 는 display:none 인 숨은 저장 트리거다 — 보이는 것은 footer 의 저장 버튼이다.
  await page.getByTestId("event-editor-save").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);

  await rightClickMapTile(page, 2, 2);
  const aiItem = page.getByTestId("event-layer-event-ai-author");
  await expect(aiItem).toContainText("이 이벤트를 AI 로 고치기...");
  await page.screenshot({ path: `${EVIDENCE_DIR}/03-menu-existing-event.png`, fullPage: true });

  await aiItem.click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("ai-event-assist")).toHaveAttribute("open", "");
  await expect(page.getByTestId("ai-event-input")).toBeFocused();
  await page.screenshot({ path: `${EVIDENCE_DIR}/04-existing-event-dock-open.png`, fullPage: true });
});
