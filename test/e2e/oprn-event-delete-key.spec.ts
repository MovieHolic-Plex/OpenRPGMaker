import { expect, test, type Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

const PASSABLE = { up: true, down: true, left: true, right: true };

type ExportedEvent = {
  readonly id: string;
};

type ExportedMap = {
  readonly width: number;
  readonly height: number;
  readonly events: readonly ExportedEvent[];
};

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, ExportedMap>;
  };
};

let nativeDialogs = 0;

async function seedProject(page: Page): Promise<void> {
  nativeDialogs = 0;
  // 이벤트 삭제는 앱의 확인 창(취소/삭제)을 쓴다. 브라우저 confirm 이 뜨면 테스트가 실패한다.
  page.on("dialog", (dialog) => {
    nativeDialogs += 1;
    void dialog.dismiss();
  });
  await seedProjectForEditor(page, projectWithPlacedEvent());
}

async function confirmEventDeletion(page: Page): Promise<void> {
  const dialog = page.getByTestId("app-confirm-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("app-modal-cancel")).toHaveText("취소");
  await expect(dialog.getByTestId("app-modal-confirm")).toHaveText("삭제");
  await dialog.getByTestId("app-modal-confirm").click();
  await expect(dialog).toHaveCount(0);
  expect(nativeDialogs).toBe(0);
}

async function debugState(page: Page): Promise<DebugState> {
  // 미러는 페이지 쪽 textContent 게터로 프로젝트 전체를 직렬화한다(수십 MB).
  // 그 문자열을 노드로 넘기면 테스트가 시간 초과하므로, 필요한 맵·이벤트 id 만 페이지 안에서 고른다.
  const parsed: unknown = await page.evaluate(() => {
    const node = document.querySelector("[data-testid='project-export-json']");
    const text = node?.textContent ?? "";
    if (!text) return null;
    const full = JSON.parse(text) as {
      project?: {
        startMapId?: string;
        maps?: Record<string, { width?: number; height?: number; events?: { id?: string }[] }>;
      };
    };
    const project = full.project;
    if (!project?.maps || typeof project.startMapId !== "string") return null;
    const maps: Record<string, { width: number; height: number; events: { id: string }[] }> = {};
    for (const [id, map] of Object.entries(project.maps)) {
      maps[id] = {
        width: map.width ?? 0,
        height: map.height ?? 0,
        events: (map.events ?? []).flatMap((event) => (typeof event.id === "string" ? [{ id: event.id }] : [])),
      };
    }
    return { project: { startMapId: project.startMapId, maps } };
  });
  if (!isDebugState(parsed)) throw new Error("missing project export");
  return parsed;
}

async function clickMapTile(page: Page, x: number, y: number, clickCount: 1 | 2 = 1): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 32;
  const position = {
    x: Math.floor((box.width - map.width * tileSize) / 2) + x * tileSize + tileSize / 2,
    y: Math.floor((box.height - map.height * tileSize) / 2) + y * tileSize + tileSize / 2,
  };
  if (clickCount === 2) {
    await canvas.dblclick({ position });
    return;
  }
  await canvas.click({ position });
}

function projectWithPlacedEvent(): Project {
  return {
    version: 3,
    meta: { title: "Event Delete Key", author: "e2e", terms: { gold: "G" } },
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
        passability: new Array(8).fill(PASSABLE),
        priority: new Array(8).fill("lower"),
        terrain: new Array(8).fill(0),
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
      map_delete: {
        id: "map_delete",
        name: "Delete",
        width: 5,
        height: 4,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(20).fill(0),
        upperTiles: new Array<number>(20).fill(-1),
        events: [
          {
            id: "ev_delete",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page_delete",
                name: "Delete Target",
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
    mapTree: { mapId: "map_delete", children: [] },
    startMapId: "map_delete",
    startPos: { x: 1, y: 1 },
    flags: {},
  } satisfies Project;
}

function isDebugState(value: unknown): value is DebugState {
  if (!isRecord(value)) return false;
  const project = value.project;
  if (!isRecord(project)) return false;
  return typeof project.startMapId === "string" && isRecord(project.maps);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

test("event editor list deletes the selected event with Delete", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);

  await page.getByTestId("layer-event").click();
  await page.getByTestId("event-list-row-ev_delete").click();
  await page.keyboard.press("Delete");
  await confirmEventDeletion(page);

  await expect(page.getByTestId("event-list-row-ev_delete")).toHaveCount(0);
  expect((await debugState(page)).project.maps.map_delete?.events).toEqual([]);
});

test("event layer canvas deletes the clicked event with Delete", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);

  await page.getByTestId("layer-event").click();
  await clickMapTile(page, 2, 2);
  await page.keyboard.press("Delete");
  await confirmEventDeletion(page);

  await expect(page.getByTestId("event-list-row-ev_delete")).toHaveCount(0);
  expect((await debugState(page)).project.maps.map_delete?.events).toEqual([]);
});

test("event editor modal deletes the open event with Delete", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);

  await page.getByTestId("layer-event").click();
  await clickMapTile(page, 2, 2, 2);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  // 편집기 안에서의 Delete 는 이벤트를 지우지 않는다. 헤더 ⋯ 의 「이벤트 삭제」가 확인 창을 연다.
  await page.getByTestId("event-editor-header-more").locator(":scope > summary").click();
  await page.getByTestId("event-delete").click();
  await confirmEventDeletion(page);

  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  expect((await debugState(page)).project.maps.map_delete?.events).toEqual([]);
});
