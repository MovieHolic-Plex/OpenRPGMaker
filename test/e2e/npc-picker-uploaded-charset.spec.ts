// 소재 관리자에서 업로드한 charset이 NPC 그래픽 피커에 나타나는지 검증
import { expect, test, type Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const PASSABLE = { up: true, down: true, left: true, right: true };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly width: number; readonly height: number }>;
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function doubleClickMapTile(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 16 * 2;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  await canvas.dblclick({
    position: {
      x: mapLeft + x * tileSize + tileSize / 2,
      y: mapTop + y * tileSize + tileSize / 2,
    },
  });
}

function projectWithUploadedCharset(): Project {
  return {
    version: 3,
    meta: { title: "Uploaded Charset Picker", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {},
      uploaded: {
        "uploaded-custom-hero": {
          id: "uploaded-custom-hero",
          name: "커스텀영웅.png",
          kind: "charset",
          dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          meta: { width: 288, height: 256 },
        },
      },
    },
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
            id: "ev_test",
            name: "NPC",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page-1",
                name: "1",
                conditions: [],
                graphic: {},
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

test("uploaded charset appears in NPC graphic picker resource list", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, projectWithUploadedCharset());

  // 이벤트 레이어 → 이벤트 더블클릭 → 그래픽 설정
  await page.getByTestId("layer-event").click();
  await doubleClickMapTile(page, 2, 2);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await page.getByTestId("event-page-graphic-set").click();

  // 리소스 목록에 uploaded charset이 나타나는지 확인
  await expect(page.getByTestId("event-graphic-resource-list")).toBeVisible();
  const uploadedRow = page.getByTestId("event-graphic-resource-uploaded-custom-hero");
  await expect(uploadedRow).toBeVisible();
  await expect(uploadedRow).toContainText("커스텀영웅");

  // 번들 charset도 여전히 보이는지 확인
  await expect(page.getByTestId("event-graphic-resource-tex_easyrpg_charset_actor1")).toBeVisible();

  // 스크린샷 증거
  const graphicDialog = page.getByTestId("event-graphic-dialog").locator(".event-subdialog-window");
  await graphicDialog.screenshot({ path: testInfo.outputPath("npc-picker-uploaded-charset-visible.png") });
});
