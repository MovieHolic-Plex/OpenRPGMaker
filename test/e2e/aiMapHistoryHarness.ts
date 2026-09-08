import { expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** Local blank-project start map — kept so conversation scope stays `local:새 프로젝트::map_blank_start`. */
export const MAP_A = "map_blank_start";
export const MAP_B = "map_hist_b";
/** Known map id that is not in the current project. Unknown ≠ deleted. */
export const MAP_DELETED = "map_hist_gone";

export const MAP_A_NAME = "광장";
export const MAP_B_NAME = "숲길";
export const MAP_DELETED_NAME = "허물어진 다리";

export const TITLES = {
  a: "MAPHIST-A plaza well",
  b: "MAPHIST-B forest path",
  mixed: "MAPHIST-AB plaza then forest",
  unknown: "MAPHIST-UNKNOWN legacy",
  foreign: "MAPHIST-FOREIGN same map id",
  deleted: "MAPHIST-DELETED known map",
} as const;

export const TURNS = {
  aAssist: "MAPHIST-A-ASSIST well placed",
  bAssist: "MAPHIST-B-ASSIST path paved",
  mixedAssistA: "MAPHIST-AB-ASSIST-A plaza reply",
  mixedFollowB: "MAPHIST-AB-FOLLOWUP-B forest turn",
  mixedAssistB: "MAPHIST-AB-ASSIST-B forest reply",
  unknownAssist: "MAPHIST-UNKNOWN-ASSIST no map field",
  foreignAssist: "MAPHIST-FOREIGN-ASSIST other project",
  deletedAssist: "MAPHIST-DELETED-ASSIST still known",
} as const;

export const FOREIGN_SCOPE = "remote:foreign-map-history-qa";
export const LEGACY = {
  id: "maphist-legacy-unscoped",
  user: "MAPHIST-LEGACY-UNSCOPED-USER",
  assist: "MAPHIST-LEGACY-UNSCOPED-ASSIST",
  mapId: "map_legacy_gone",
} as const;
export const MAP_EMPTY = "map_hist_empty";
export const MAP_EMPTY_NAME = "빈 언덕";
export const EVIDENCE_DIR = path.resolve("output/evidence/map-ai-history");

mkdirSync(EVIDENCE_DIR, { recursive: true });

export async function mockRemoteAndLlm(page: Page): Promise<void> {
  // Transport only. Do not stub the history modal or conversation repository.
  await page.route("**/v1/chat/completions", (route) =>
    route.fulfill({ json: { choices: [{ message: { role: "assistant", content: "unused" }, finish_reason: "stop" }] } }),
  );
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/rest/v1/**", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    return route.fulfill({ status: 204, body: "" });
  });
}

export async function bootEditor(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:editor-layout:v4", JSON.stringify({ leftWidth: 280, mapTreeHeight: 220 }));
  });
  await mockRemoteAndLlm(page);
  const guest = page.getByTestId("login-guest");
  // Hidden mounted alternatives must not mask the visible boot surface.
  const ready = guest
    .or(page.getByTestId("ai-input"))
    .or(page.getByTestId("ai-collapsed-restore"))
    .filter({ visible: true })
    .first()
    .waitFor({ state: "visible", timeout: 90_000 });
  // Own both rejections immediately, even if navigation outlasts readiness.
  await Promise.all([
    ready,
    page.goto("/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 90_000 }),
  ]);
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible()) await restore.click();
  await expect(page.getByTestId("ai-input")).toBeVisible();
  await expect(page.getByTestId("ai-open-conversations")).toBeVisible();
  const remote = await page.evaluate(async () => {
    const storePath: string = "/src/project/store.ts";
    const { store } = await import(/* @vite-ignore */ storePath) as typeof import("@/project/store");
    if (!store.isLoaded()) throw new Error("blank project store did not load");
    return store.isRemotePersistenceEnabled();
  });
  expect(remote, "blankProject must keep remote persistence off").toBe(false);
}

export async function historySettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const modalPath: string = "/src/editor/panels/aiConversationHistoryModal.ts";
    const { whenAiConversationHistoryModalSettled } = await import(/* @vite-ignore */ modalPath) as typeof import("@/editor/panels/aiConversationHistoryModal");
    await whenAiConversationHistoryModalSettled();
  });
}

export async function openHistory(page: Page): Promise<void> {
  const clock = page.getByTestId("ai-open-conversations");
  await expect(clock).toHaveCount(1);
  const nested = page.getByTestId("ai-map-history-open");
  await expect(nested, "ai-map-history-open is a nested visible glyph, not a second button").toHaveCount(1);
  await expect(clock.getByTestId("ai-map-history-open")).toHaveCount(1);
  await expect(nested).toBeVisible();
  const appeared = page.getByTestId("ai-history-modal").waitFor({ state: "visible", timeout: 15_000 });
  // Own both rejections immediately, even if the click outlasts appearance.
  await Promise.all([appeared, nested.click()]);
  await historySettled(page);
}

export function historyRow(page: Page, title: string): Locator {
  return page.getByTestId("ai-history-row").filter({ hasText: title });
}

export async function expectFilterActive(page: Page, testId: string): Promise<void> {
  const filter = page.getByTestId(testId);
  await expect(filter).toBeVisible();
  const pressed = await filter.getAttribute("aria-pressed");
  const checked = await filter.getAttribute("aria-checked");
  expect(
    pressed === "true" || checked === "true",
    `${testId} must be the active segmented option`,
  ).toBe(true);
}

export async function selectHistoryFilter(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click();
  await historySettled(page);
  await expectFilterActive(page, testId);
}

type SeedResult = {
  readonly scope: string;
  readonly startMapId: string;
  readonly mapIds: readonly string[];
  readonly currentMapId: string | null;
};

export async function seedMapsAndHistory(page: Page): Promise<SeedResult> {
  const result = await page.evaluate(async (fixture) => {
    const load = async <T>(url: string): Promise<T> => {
      const modulePath: string = url;
      return await import(/* @vite-ignore */ modulePath) as T;
    };
    const [{ store }, { conversationScopeKey, saveConversation }, { selectEditorMap }] = await Promise.all([
      load<typeof import("@/project/store")>("/src/project/store.ts"),
      load<typeof import("@/ai/conversationStore")>("/src/ai/conversationStore.ts"),
      load<typeof import("@/editor/mapSelection")>("/src/editor/mapSelection.ts"),
    ]);
    if (!store.isLoaded()) throw new Error("store not loaded");
    if (store.isRemotePersistenceEnabled()) throw new Error("seed refused: remote persistence is on");

    store.update((project) => {
      const start = project.maps[project.startMapId];
      if (!start) throw new Error("missing start map");
      start.name = fixture.mapAName;
      const cellCount = start.width * start.height;
      project.maps[fixture.mapB] = {
        id: fixture.mapB,
        name: fixture.mapBName,
        width: start.width,
        height: start.height,
        tilesetId: start.tilesetId,
        tileSize: start.tileSize,
        lowerTiles: start.lowerTiles.slice(0, cellCount),
        upperTiles: new Array<number>(cellCount).fill(-1),
        events: [],
      };
      project.maps[fixture.mapEmpty] = {
        id: fixture.mapEmpty,
        name: fixture.mapEmptyName,
        width: start.width,
        height: start.height,
        tilesetId: start.tilesetId,
        tileSize: start.tileSize,
        lowerTiles: start.lowerTiles.slice(0, cellCount),
        upperTiles: new Array<number>(cellCount).fill(-1),
        events: [],
      };
      project.mapTree = {
        mapId: project.startMapId,
        children: [
          { mapId: fixture.mapB, children: [] },
          { mapId: fixture.mapEmpty, children: [] },
        ],
      };
    });
    if (!selectEditorMap(fixture.mapA)) throw new Error(`could not select ${fixture.mapA}`);

    const project = store.getCurrent();
    const scope = conversationScopeKey(store.getProjectIdentity(), project);
    const ctx = (mapId: string, mapName: string) => ({
      mapId,
      mapName,
      mapWidth: project.maps[mapId]?.width ?? 20,
      mapHeight: project.maps[mapId]?.height ?? 15,
    });
    const t0 = 1_700_000_000_000;
    const records = [
      {
        id: "maphist-foreign",
        title: fixture.titles.foreign,
        model: "e2e",
        savedAt: t0,
        projectContextKey: fixture.foreignScope,
        entries: [
          { kind: "user" as const, text: fixture.titles.foreign, context: ctx(fixture.mapA, fixture.mapAName) },
          { kind: "assistant" as const, text: fixture.turns.foreignAssist },
        ],
      },
      {
        id: "maphist-unknown",
        title: fixture.titles.unknown,
        model: "e2e",
        savedAt: t0 + 1,
        projectContextKey: scope,
        entries: [
          { kind: "user" as const, text: fixture.titles.unknown },
          { kind: "assistant" as const, text: fixture.turns.unknownAssist },
        ],
      },
      {
        id: "maphist-deleted",
        title: fixture.titles.deleted,
        model: "e2e",
        savedAt: t0 + 2,
        projectContextKey: scope,
        entries: [
          {
            kind: "user" as const,
            text: fixture.titles.deleted,
            context: { mapId: fixture.mapDeleted, mapName: fixture.mapDeletedName, mapWidth: 16, mapHeight: 16 },
          },
          { kind: "assistant" as const, text: fixture.turns.deletedAssist },
        ],
      },
      {
        id: "maphist-b",
        title: fixture.titles.b,
        model: "e2e",
        savedAt: t0 + 3,
        projectContextKey: scope,
        entries: [
          { kind: "user" as const, text: fixture.titles.b, context: ctx(fixture.mapB, fixture.mapBName) },
          { kind: "assistant" as const, text: fixture.turns.bAssist },
        ],
      },
      {
        id: "maphist-a",
        title: fixture.titles.a,
        model: "e2e",
        savedAt: t0 + 4,
        projectContextKey: scope,
        entries: [
          { kind: "user" as const, text: fixture.titles.a, context: ctx(fixture.mapA, fixture.mapAName) },
          { kind: "assistant" as const, text: fixture.turns.aAssist },
        ],
      },
      {
        id: "maphist-mixed",
        title: fixture.titles.mixed,
        model: "e2e",
        savedAt: t0 + 5,
        projectContextKey: scope,
        entries: [
          { kind: "user" as const, text: fixture.titles.mixed, context: ctx(fixture.mapA, fixture.mapAName) },
          { kind: "assistant" as const, text: fixture.turns.mixedAssistA },
          {
            kind: "tool" as const,
            name: "paint_tiles",
            args: { mapId: fixture.mapB },
            ok: true,
            summary: "painted forest on map B",
          },
          { kind: "user" as const, text: fixture.turns.mixedFollowB, context: ctx(fixture.mapB, fixture.mapBName) },
          { kind: "assistant" as const, text: fixture.turns.mixedAssistB },
        ],
      },
    ];
    for (const record of records) {
      const outcome = await saveConversation(record);
      if (!outcome.ok) throw new Error(`saveConversation failed for ${record.id}`);
    }
    return {
      scope,
      startMapId: project.startMapId,
      mapIds: Object.keys(project.maps),
      currentMapId: (await load<typeof import("@/editor/editorState")>("/src/editor/editorState.ts")).editorState.get().currentMapId,
    };
  }, {
    mapA: MAP_A,
    mapB: MAP_B,
    mapEmpty: MAP_EMPTY,
    mapDeleted: MAP_DELETED,
    mapAName: MAP_A_NAME,
    mapBName: MAP_B_NAME,
    mapEmptyName: MAP_EMPTY_NAME,
    mapDeletedName: MAP_DELETED_NAME,
    titles: TITLES,
    turns: TURNS,
    foreignScope: FOREIGN_SCOPE,
  });

  expect(result.mapIds).toEqual(expect.arrayContaining([MAP_A, MAP_B, MAP_EMPTY]));
  expect(result.mapIds).not.toContain(MAP_DELETED);
  expect(result.startMapId).toBe(MAP_A);
  await expect(page.getByTestId("sidebar-map-switcher")).toContainText(MAP_A_NAME);
  return result;
}

export async function selectMap(page: Page, mapId: string, mapName: string): Promise<void> {
  await page.evaluate(async (id) => {
    const load = async <T>(url: string): Promise<T> => {
      const modulePath: string = url;
      return await import(/* @vite-ignore */ modulePath) as T;
    };
    const [{ editorState }, { selectEditorMap }] = await Promise.all([
      load<typeof import("@/editor/editorState")>("/src/editor/editorState.ts"),
      load<typeof import("@/editor/mapSelection")>("/src/editor/mapSelection.ts"),
    ]);
    if (editorState.get().currentMapId === id) return;
    const switched = new Promise<void>((resolve, reject) => {
      const deadline = AbortSignal.timeout(10_000);
      const stop = editorState.subscribe((state) => {
        if (state.currentMapId !== id) return;
        deadline.removeEventListener("abort", onAbort);
        stop();
        resolve();
      });
      function onAbort(): void {
        stop();
        reject(new Error(`timed out waiting for map ${id}`));
      }
      deadline.addEventListener("abort", onAbort, { once: true });
    });
    if (!selectEditorMap(id)) throw new Error(`selectEditorMap(${id}) failed`);
    await switched;
  }, mapId);
  await expect(page.getByTestId("sidebar-map-switcher")).toContainText(mapName);
}

export async function selectKnownMapInHistory(page: Page, mapId: string): Promise<void> {
  const modal = page.getByTestId("ai-history-modal");
  const option = modal.locator(`[data-map-id="${mapId}"]`).first();
  await expect(option).toBeVisible();
  await option.click();
  await historySettled(page);
}

export async function captureHistoryShot(page: Page, name: string, size: { width: number; height: number }): Promise<string> {
  await page.setViewportSize(size);
  const filePath = path.join(EVIDENCE_DIR, `${name}-${size.width}x${size.height}.png`);
  await page.screenshot({ path: filePath, animations: "disabled" });
  return filePath;
}

export async function seedExtraCurrentMapRows(page: Page, count: number): Promise<void> {
  await page.evaluate(async (input) => {
    const load = async <T>(url: string): Promise<T> => {
      const modulePath: string = url;
      return await import(/* @vite-ignore */ modulePath) as T;
    };
    const [{ store }, { conversationScopeKey }, { AI_RECORD_STORES, writeAiRecords }] = await Promise.all([
      load<typeof import("@/project/store")>("/src/project/store.ts"),
      load<typeof import("@/ai/conversationStore")>("/src/ai/conversationStore.ts"),
      load<typeof import("@/ai/aiRecordDb")>("/src/ai/aiRecordDb.ts"),
    ]);
    const project = store.getCurrent();
    const scope = conversationScopeKey(store.getProjectIdentity(), project);
    const map = project.maps[input.mapA];
    // Trusted catalog fixtures, not save-path coverage: avoid unrelated remote mirrors.
    const records: import("@/ai/conversationStore").ConversationRecord[] = [];
    for (let index = 0; index < input.count; index += 1) {
      records.push({
        id: `maphist-page-${index}`,
        title: `MAPHIST-PAGE ${index}`,
        model: "e2e",
        savedAt: 1_700_000_100_000 + index,
        projectContextKey: scope,
        entries: [
          { kind: "user" as const, text: `MAPHIST-PAGE ${index}`, context: { mapId: input.mapA, mapName: input.mapAName, mapWidth: map?.width ?? 20, mapHeight: map?.height ?? 15 } },
          { kind: "assistant" as const, text: `page ${index}` },
        ],
        mapIndex: { viewedMapIds: [input.mapA], targetMapIds: [], mapAttribution: "complete" },
      });
    }
    const backend = await writeAiRecords(AI_RECORD_STORES.conversations, records);
    if (backend !== "indexeddb") throw new Error("bulk history fixture requires IndexedDB");
  }, { count, mapA: MAP_A, mapAName: MAP_A_NAME });
}

export async function seedUnscopedLegacy(page: Page): Promise<void> {
  await page.evaluate(async (fixture) => {
    const storePath: string = "/src/ai/conversationStore.ts";
    const { saveConversation } = await import(/* @vite-ignore */ storePath) as typeof import("@/ai/conversationStore");
    const outcome = await saveConversation({
      id: fixture.id,
      title: fixture.user,
      model: "e2e",
      savedAt: 1_600_000_000_000,
      entries: [
        { kind: "user" as const, text: fixture.user, context: { mapId: fixture.mapId, mapName: "기록된 옛 이름", mapWidth: 16, mapHeight: 16 } },
        { kind: "assistant" as const, text: fixture.assist },
      ],
    });
    if (!outcome.ok) throw new Error("saveConversation failed for unscoped legacy");
  }, LEGACY);
}
