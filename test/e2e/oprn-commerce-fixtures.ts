import type { Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";

export type RuntimeState = {
  readonly gold: number;
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly actorVitals: Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>;
  /** 상점 경제 상태. 세이브에는 진작 있었지만 상태 덤프에는 없어서 밖에서 검증할 수 없었다(X-3). */
  readonly shopLoyaltySpend?: Record<string, number>;
  readonly shopTradeCounts?: Record<string, { readonly sold: number; readonly bought: number }>;
  readonly shopMileagePoints?: number;
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

/**
 * 상점·여관 픽스처. 빈 프로젝트(v4)를 바탕으로 짓는다 — 손으로 쓴 v3 자료집을 쓰던 시절에는
 * 적재 경로가 기본 아이템 목록(179개)만 채우고 스킬·상태·전투 애니메이션은 비워 둬서
 * 참조 문제 89개가 생겼고, 당시 fail-closed 게이트가 시연 실행을 막았다(게이트는 제거됨). 그러면
 * 런타임 스펙이 타이틀 화면조차 못 본다. 기본 자료집은 그 자체로 참조가 성립한다.
 *
 * 가격만 덮어쓴다: 회복약 50 → 12, 해독초 30 → 8. 스펙의 소지금 산수(63 · 76 · 82)가
 * 이 두 값에 걸려 있다.
 */
export function makeCommerceProject(): Project {
  const project = structuredClone(createBlankProject());
  project.meta = { ...project.meta, title: "상점 여관 테스트", author: "e2e" };
  project.commonEvents = [
    {
      id: "ce_shop",
      name: "상점 공용 이벤트",
      trigger: "none",
      commands: [{ kind: "shop", itemIds: ["item_potion"] }],
    },
  ];
  project.database.items = project.database.items.map((item) => {
    if (item.id === "item_potion") return normalizeItemRecord({ ...item, price: 12 });
    if (item.id === "item_antidote") return normalizeItemRecord({ ...item, price: 8 });
    return item;
  });
  project.maps = {
    map_shop: {
      id: "map_shop",
      name: "상점 맵",
      width: 2,
      height: 2,
      // 타일셋은 빈 프로젝트가 들고 있는 것을 그대로 쓴다. 예전 픽스처의 `tiles_default` 는
      // 이 프로젝트에 없는 id 라 그 자체로 참조 문제 1건이었다.
      tilesetId: project.maps[project.startMapId]?.tilesetId ?? "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: [130, 130, 130, 130],
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
  };
  project.mapTree = { mapId: "map_shop", children: [] };
  project.startMapId = "map_shop";
  project.startPos = { x: 0, y: 0 };
  return project;
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
