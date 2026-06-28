import type { Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";

export type RuntimeState = {
  readonly gold: number;
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly actorVitals: Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>;
};

type DebugState = {
  readonly project: Project;
};

export async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await runtimeTapKey(page, key, holdMs);
}

export async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

export async function exportedProject(page: Page): Promise<Project> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return (JSON.parse(text) as DebugState).project;
}

export async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

export function makeCommerceProject(): Project {
  return {
    version: 3,
    meta: { title: "상점 여관 테스트", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "기본 타일셋",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: [
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
        ],
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    switches: [],
    variables: [],
    commonEvents: [
      {
        id: "ce_shop",
        name: "상점 공용 이벤트",
        trigger: "none",
        commands: [{ kind: "shop", itemIds: ["item_potion"] }],
      },
    ],
    database: {
      actors: [],
      classes: [],
      skills: [],
      items: [
        normalizeItemRecord({
          id: "item_potion",
          name: "회복약",
          scope: "ally",
          price: 12,
          description: "작은 회복 아이템.",
          type: "medicine",
          occasion: "always",
          consumable: true,
          stateEffects: [],
        }),
        normalizeItemRecord({
          id: "item_antidote",
          name: "해독초",
          scope: "ally",
          price: 8,
          description: "독을 치료한다.",
          type: "medicine",
          occasion: "always",
          consumable: true,
          stateEffects: [],
        }),
      ],
      equipment: [],
      enemies: [],
      troops: [],
      states: [],
      battleAnimations: [],
    },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_shop: {
        id: "map_shop",
        name: "상점 맵",
        width: 2,
        height: 2,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: [0, 0, 1, 0],
        upperTiles: [-1, -1, -1, -1],
        events: [
          {
            id: "ev_shopkeeper",
            x: 0,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page_shop",
                name: "상점 주인",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [
                  { kind: "changeGold", op: "+=", amount: 100 },
                  { kind: "shop", itemIds: ["item_potion"] },
                  { kind: "inn", price: 25 },
                ],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_shop", children: [] },
    startMapId: "map_shop",
    startPos: { x: 0, y: 0 },
    flags: {},
  };
}

export function makeInsufficientCommerceProject(): Project {
  const project = makeCommerceProject();
  const page = project.maps.map_shop.events[0]?.pages?.[0];
  if (!page) throw new Error("missing commerce event page");
  page.commands = [
    { kind: "shop", itemIds: ["item_potion"] },
    { kind: "inn", price: 25 },
  ];
  return project;
}

export function makeInnRecoveryProject(): Project {
  const project = structuredClone(createBlankProject());
  project.maps = makeCommerceProject().maps;
  project.mapTree = { mapId: "map_shop", children: [] };
  project.startMapId = "map_shop";
  project.startPos = { x: 0, y: 0 };
  const page = project.maps.map_shop.events[0]?.pages?.[0];
  if (!page) throw new Error("missing commerce event page");
  page.commands = [
    { kind: "changeGold", op: "+=", amount: 100 },
    { kind: "inn", price: 25 },
  ];
  return project;
}
