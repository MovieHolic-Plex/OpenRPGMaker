import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { startNewGameFromTitle } from "./runtimeInput";

type RuntimeState = {
  readonly mapId: string;
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly events: Record<string, { readonly pageId?: string }>;
  readonly battleResult?: "victory" | "defeat" | "escape";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!isRecord(value)) return false;
  if (typeof value.mapId !== "string") return false;
  if (!isRecord(value.switches) || !isRecord(value.variables) || !isRecord(value.events)) return false;
  if (value.battleResult === undefined) return true;
  return value.battleResult === "victory" || value.battleResult === "defeat" || value.battleResult === "escape";
}

async function importProjectViaBrowser(page: Page, path: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await importJsonThroughChooser(page, path);
}

async function importExportedJsonViaBrowser(page: Page, project: Project, exportedPath: string): Promise<void> {
  await writeFile(exportedPath, serialize(project), "utf8");
  await importJsonThroughChooser(page, exportedPath);
}

async function importJsonThroughChooser(
  page: Page,
  file: string
): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("toolbar-import").click();
  const fileChooser = await chooser;
  await fileChooser.setFiles(file);
  await expect(page.getByTestId("toast")).toContainText("가져오기 완료");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

async function exportedProject(page: Page): Promise<Project> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error("invalid project export wrapper");
  return deserialize(JSON.stringify(parsed.project));
}

async function dismissDialogue(page: Page, expected: string): Promise<void> {
  const box = page.getByTestId("dialogue-box");
  await expect(box).toContainText(expected);
  await box.click();
  await expect(box).toBeHidden();
}

async function openMenu(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("main-menu")).toBeVisible();
}

async function closeMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByTestId("main-menu")).toBeHidden();
}

async function enterDungeon(page: Page): Promise<void> {
  await page.getByTestId("event-dungeon-door").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_dungeon");
}

async function visitInterior(page: Page, interiorScreenshotPath?: string): Promise<void> {
  await page.getByTestId("event-interior-door").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_interior");
  await page.getByTestId("event-interior-host").click();
  await dismissDialogue(page, "이 작은 실내에서 맵 이동을 확인합니다.");
  if (interiorScreenshotPath) await page.screenshot({ path: interiorScreenshotPath, fullPage: true });
  await page.getByTestId("event-interior-exit").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_town");
}

async function winBattle(page: Page, battleScreenshotPath?: string): Promise<void> {
  await page.getByTestId("event-battle-start").click();
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-skill")).toBeVisible();
  if (battleScreenshotPath) await page.screenshot({ path: battleScreenshotPath, fullPage: true });
  await page.getByTestId("actor-command-skill").click();
  await expect.poll(async () => (await runtimeState(page)).battleResult).toBe("victory");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_battle_won).toBe(true);
  await expect(page.getByTestId("battle-scene")).toBeHidden();
}

test("RM2K3 sample fixture loads in the editor, exports cleanly, and plays title to ending with save/load", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await importProjectViaBrowser(page, "test/fixtures/projects/rm2k3-sample-v3.json");

  await expect(page.getByTestId("map-tree-node-map_town")).toContainText("샘플 마을");
  await expect(page.getByTestId("map-tree-node-map_interior")).toContainText("샘플 실내");
  await expect(page.getByTestId("map-tree-node-map_dungeon")).toContainText("샘플 던전");

  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-profile-chipset")).toContainText("tex_tiles_default");
  await expect(page.getByTestId("resource-profile-charset").first()).toContainText("sample_hero");
  await expect(page.getByTestId("resource-profile-battleCharset")).toContainText("sample_hero");
  await page.getByTestId("resource-kind-select").selectOption("charset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/charset-valid-288x256.png");
  await expect(page.getByTestId("resource-profile-charset").last()).toContainText("288x256");
  await page.screenshot({ path: testInfo.outputPath("00-editor-resource-authoring.png"), fullPage: true });
  await page.getByTestId("resource-modal-close").click();

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("QA 불꽃");
  await page.getByTestId("db-field-power").fill("17");
  await page.getByTestId("db-tab-enemies").click();
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("QA 슬라임");
  await page.getByTestId("db-picker-skill").selectOption({ label: "QA 불꽃" });
  await page.getByTestId("db-tab-troops").click();
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("QA 적 그룹");
  await page.getByTestId("db-picker-troop-member-enemy").selectOption({ label: "QA 슬라임" });
  await page.getByTestId("db-tab-actors").click();
  await page.getByRole("button", { name: /미라/ }).click();
  await expect(page.getByTestId("db-field-name")).toHaveValue("미라");
  await page.getByTestId("db-tab-troops").click();
  await page.getByRole("button", { name: /동굴 슬라임 무리/ }).click();
  await expect(page.getByTestId("db-field-name")).toHaveValue("동굴 슬라임 무리");
  await page.getByTestId("db-tab-common-events").click();
  await expect(page.getByTestId("db-detail-form")).toContainText("ce_blessing");
  await expect(page.getByTestId("db-detail-form")).toContainText("스위치 조작");
  await page.getByTestId("database-modal-close").click();

  const exported = await exportedProject(page);
  expect(exported.meta.title).toBe("T14 RM2K3 샘플");
  expect(Object.keys(exported.maps)).toEqual(["map_town", "map_interior", "map_dungeon"]);
  expect(exported.mapTree.children.map((node) => node.mapId)).toEqual(["map_interior", "map_dungeon"]);
  expect(exported.commonEvents.some((record) => record.id === "ce_blessing")).toBe(true);
  expect(exported.maps.map_town?.events.some((event) => event.id === "save-point")).toBe(true);
  expect(exported.maps.map_town?.events.some((event) => event.id === "interior-door")).toBe(true);
  expect(exported.maps.map_town?.events.find((event) => event.id === "town-npc")?.pages?.length).toBe(2);
  expect(exported.maps.map_dungeon?.events.find((event) => event.id === "battle-start")?.pages?.length).toBe(2);
  expect(exported.resourceProfiles.some((profile) => profile.imageWidth === 288 && profile.imageHeight === 256)).toBe(true);
  expect(exported.database.skills.some((record) => record.name === "QA 불꽃")).toBe(true);
  expect(exported.database.enemies.some((record) => record.name === "QA 슬라임")).toBe(true);
  expect(exported.database.troops.some((record) => record.name === "QA 적 그룹")).toBe(true);
  await testInfo.attach("exported-sample.json", { body: serialize(exported), contentType: "application/json" });
  await importExportedJsonViaBrowser(page, deserialize(serialize(exported)), testInfo.outputPath("exported-rm2k3-sample-v3.json"));
  await page.getByTestId("toolbar-save").click();
  await expect(page.getByTestId("toast")).toContainText("저장됨");
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("map-tree-node-map_town")).toContainText("샘플 마을");
  await expect(page.getByTestId("map-tree-node-map_interior")).toContainText("샘플 실내");
  await expect(page.getByTestId("map-tree-node-map_dungeon")).toContainText("샘플 던전");

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toHaveAttribute("data-title-resource", "sample_title");
  await page.screenshot({ path: testInfo.outputPath("01-title.png"), fullPage: true });
  await startNewGameFromTitle(page);
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_town");

  await expect(page.getByTestId("event-town-npc")).toHaveAttribute("data-page-id", "npc-before");
  await page.getByTestId("event-town-npc").click();
  await page.getByRole("button", { name: /예/ }).click();
  await dismissDialogue(page, "마을 동쪽의 스위치를 찾으세요.");
  await expect.poll(async () => (await runtimeState(page)).variables.var_choice).toBe(1);

  await page.getByTestId("event-switch-puzzle").click();
  await dismissDialogue(page, "언덕의 문이 열렸습니다.");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_gate_open).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_blessed).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).variables.var_blessing).toBe(3);
  await expect(page.getByTestId("picture-layer")).toContainText("문 그림");
  await expect(page.getByTestId("picture-layer")).not.toContainText("pic_gate");
  await expect(page.getByTestId("audio-indicator")).toContainText("샘플 테마");
  await expect(page.getByTestId("audio-indicator")).not.toContainText("sample_theme");
  await expect(page.getByTestId("audio-state-json")).toContainText("sample_theme");
  await expect(page.getByTestId("event-town-npc")).toHaveAttribute("data-page-id", "npc-after");
  await page.getByTestId("event-clear-effects").click();
  await dismissDialogue(page, "공기가 맑아졌습니다.");
  await page.screenshot({ path: testInfo.outputPath("02-town-after-puzzle.png"), fullPage: true });

  await visitInterior(page, testInfo.outputPath("03-interior-visit.png"));
  await page.screenshot({ path: testInfo.outputPath("04-town-after-interior.png"), fullPage: true });

  await page.getByTestId("event-save-point").click();
  await dismissDialogue(page, "던전에 들어가기 전에 여기서 저장하세요.");
  await openMenu(page);
  await page.getByTestId("save-slot-1").click();
  await expect(page.getByTestId("main-menu")).toContainText("1번 저장 칸에 저장했습니다");
  await closeMenu(page);

  await enterDungeon(page);
  await winBattle(page, testInfo.outputPath("05-battle-scene.png"));
  await expect.poll(async () => (await runtimeState(page)).events["battle-start"]?.pageId).toBe("battle-after");
  await page.screenshot({ path: testInfo.outputPath("06-battle-victory.png"), fullPage: true });

  await openMenu(page);
  await page.getByTestId("load-slot-1").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_town");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_battle_won).toBeFalsy();

  await enterDungeon(page);
  await winBattle(page);
  await page.getByTestId("event-battle-start").click();
  await dismissDialogue(page, "슬라임이 사라졌습니다. 포털을 이용하세요.");
  await page.getByTestId("event-ending-portal").click();
  await expect(page.getByTestId("ending-screen")).toBeVisible();
  await expect(page.getByTestId("ending-screen")).toContainText("T14 샘플 완료.");
  await page.screenshot({ path: testInfo.outputPath("07-ending-screen.png"), fullPage: true });
});

test("missing-resource sample import fails recoverably through the browser import path", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const before = await exportedProject(page);
  const beforeMaps = Object.keys(before.maps);

  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("toolbar-import").click();
  const fileChooser = await chooser;
  await fileChooser.setFiles("test/fixtures/projects/rm2k3-sample-missing-resource-v3.json");

  await expect(page.getByTestId("toast")).toContainText("sample_monster");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const after = await exportedProject(page);
  expect(Object.keys(after.maps)).toEqual(beforeMaps);
  await page.screenshot({ path: testInfo.outputPath("08-missing-resource-recoverable.png"), fullPage: true });
});
