import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const OUT = join(process.cwd(), "output", "evidence", "map-tree-ux-2026-08-20");

type ExportState = {
  project: {
    startMapId: string;
    maps: Record<string, {
      name: string;
      width: number;
      height: number;
      tilesetId: string;
      encounterRate?: number;
      bgm?: { mode: string };
      disableSave?: boolean;
      events: { commands: { kind: string; mapId?: string }[] }[];
    }>;
  };
  editor: { currentMapId: string | null };
};

async function exportState(page: Page): Promise<ExportState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project-export-json");
  return JSON.parse(text) as ExportState;
}

test("map tree create interior, link parent, duplicate", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");

  const mapTree = page.getByTestId("map-tree");
  await expect(mapTree).toBeVisible();
  const before = await exportState(page);
  const startId = before.project.startMapId;

  await page.getByTestId("map-add").click();
  await expect(page.getByTestId("map-create-dialog")).toBeVisible();
  await page.getByTestId("map-create-preset-interior").click();
  await page.getByTestId("map-create-name").fill("검증용 방");
  await page.getByTestId("map-create-confirm").click();

  const afterCreate = await exportState(page);
  const roomId = afterCreate.editor.currentMapId;
  expect(roomId).toBeTruthy();
  expect(roomId).not.toBe(startId);
  const room = afterCreate.project.maps[roomId!];
  expect(room.name).toBe("검증용 방");
  expect(room.width).toBe(20);
  expect(room.height).toBe(15);
  expect(room.tilesetId).toBe("easyrpg_chipset_interior");
  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "06-interior-created.png") });

  await page.getByTestId(`map-tree-node-${roomId}`).click({ button: "right" });
  await page.getByRole("menuitem", { name: "부모와 왕복 이동 넣기" }).click();
  await expect.poll(async () => {
    const state = await exportState(page);
    const created = state.project.maps[roomId!];
    const parent = state.project.maps[startId];
    const out = parent.events.some((event) => event.commands.some((command) => command.kind === "transfer" && command.mapId === roomId));
    const back = created.events.some((event) => event.commands.some((command) => command.kind === "transfer" && command.mapId === startId));
    return out && back;
  }).toBe(true);
  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "07-parent-link.png") });

  await page.getByTestId(`map-tree-node-${roomId}`).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "여기서 테스트 플레이" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("map-add-folder").click();
  const folderRename = page.locator("[data-testid^='map-rename-folder_']");
  await expect(folderRename).toBeVisible();
  await folderRename.fill("던전 묶음");
  await folderRename.press("Enter");
  await expect(mapTree).toContainText("던전 묶음");

  await page.getByTestId(`map-tree-node-${roomId}`).click({ button: "right" });
  await page.getByRole("menuitem", { name: "복제" }).click();
  const afterDup = await exportState(page);
  const copyId = afterDup.editor.currentMapId;
  expect(copyId).toBeTruthy();
  expect(copyId).not.toBe(roomId);
  expect(afterDup.project.maps[copyId!].tilesetId).toBe("easyrpg_chipset_interior");
  expect(afterDup.project.maps[copyId!].width).toBe(20);
  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "08-duplicated.png") });
});
