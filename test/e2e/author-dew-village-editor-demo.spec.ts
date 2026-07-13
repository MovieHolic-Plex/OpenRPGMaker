/**
 * blankProject에서 에디터 모듈(actions / eventActions / eventPages / store)로
 * 《이슬 마을의 종》 데모를 작성하고 fixture로 내보낸다.
 *
 * 이벤트 데이터는 에디터 CRUD 경로(addEvent, updateEventPage, addEventPageCommand)만 사용한다.
 * 실행: npx playwright test test/e2e/author-dew-village-editor-demo.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Command, Project } from "@/project/types";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/dew-village-demo";
const FIXTURE_PATH = "test/fixtures/projects/dew-village-demo.json";
const DEMO_TITLE = "이슬 마을의 종";
const DEMO_TITLE_SHORT = "이슬 마을";
const SW_QUEST = "sw_0001";
const SW_BELL = "sw_0002";
const SW_DONE = "sw_0003";

type ProjectExport = { readonly project: Project };

test.use({ serviceWorkers: "block" });

test("authors dew-village demo through editor modules and exports fixture", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("mode-play")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await screenshot(page, "01-blank.png");

  const mapIds = await page.evaluate(
    async ({ demoTitle, demoTitleShort, swQuest, swBell, swDone }) => {
      const actions = await import("/src/editor/actions.ts");
      const eventActions = await import("/src/editor/eventActions.ts");
      const eventPages = await import("/src/editor/eventPages.ts");
      const { editorState } = await import("/src/editor/editorState.ts");
      const { store } = await import("/src/project/store.ts");
      const { TILE, DEFAULT_ITEM_ID } = await import("/src/project/defaults/constants.ts");
      const { charsetFrameIndex } = await import("/src/assets/easyrpgRtp.ts");

      const people1 = "tex_easyrpg_charset_people1";
      const people2 = "tex_easyrpg_charset_people2";
      const people3 = "tex_easyrpg_charset_people3";
      const monster1 = "tex_easyrpg_charset_monster1";

      const villageId = store.getCurrent().startMapId;
      actions.renameMap(villageId, "이슬 마을");
      actions.setStartMap(villageId);
      actions.setStartPos(10, 8);
      paintRect(villageId, 9, 2, 3, 12, TILE.PATH);
      paintRect(villageId, 1, 1, 5, 5, TILE.WATER);
      paintRect(villageId, 2, 2, 3, 3, TILE.SAND);

      const hillId = actions.addMap("갈대 언덕", 20, 15);
      paintRect(hillId, 9, 1, 3, 13, TILE.PATH);
      paintRect(hillId, 14, 3, 5, 4, TILE.WATER);

      store.update((draft) => {
        draft.meta = { ...draft.meta, title: demoTitle, author: "RPG ZZU" };
        draft.system = {
          ...draft.system,
          titleScreen: {
            ...(draft.system.titleScreen ?? {
              title: demoTitleShort,
              menuLabels: { newGame: "새 게임", continueGame: "이어 하기", quit: "종료" },
              layout: { titleX: 160, titleY: 48, menuX: 160, menuY: 140 },
            }),
            title: demoTitleShort,
            menuLabels: {
              newGame: "종을 찾으러",
              continueGame: "이어 하기",
              quit: "그만두기",
            },
          },
        };
        for (const entry of draft.switches) {
          if (entry.id === swQuest) entry.name = "종 의뢰 수락";
          if (entry.id === swBell) entry.name = "종 조각 회수";
          if (entry.id === swDone) entry.name = "종 복구 완료";
        }
      });

      // ── 촌장 미르 (3 pages) ──
      const elderId = eventActions.addEvent(villageId, 10, 6);
      if (!elderId) throw new Error("failed to add elder event");
      eventPages.ensureEventPages(villageId, elderId);
      const elderP1 = pageId(villageId, elderId, 0);
      eventPages.updateEventPage(villageId, elderId, elderP1, {
        name: "촌장 미르",
        graphic: graphic(people2, 0),
        commands: [
          { kind: "text", speaker: "미르", body: "이슬 마을의 종이 깨져 아침이 오지 않아요." },
          { kind: "text", speaker: "미르", body: "갈대 언덕에서 종 조각을 찾아 주시겠어요?" },
          {
            kind: "choices",
            prompt: "종 조각을 찾으러 갈까요?",
            options: [
              {
                text: "간다",
                branch: [
                  { kind: "setSwitch", switchId: swQuest, value: true },
                  { kind: "text", speaker: "미르", body: "언덕 입구는 마을 남쪽에 있어요. 조심하세요." },
                ],
              },
              {
                text: "나중에",
                branch: [{ kind: "text", speaker: "미르", body: "준비가 되면 다시 와 주세요." }],
              },
            ],
            cancelBehavior: "choice2",
          },
        ],
      });
      const elderP2 = eventPages.addEventPage(villageId, elderId);
      eventPages.updateEventPage(villageId, elderId, elderP2, {
        name: "촌장 미르 (진행)",
        conditions: [{ kind: "switch", switchId: swQuest, value: true }],
        graphic: graphic(people2, 0),
        commands: [{ kind: "text", speaker: "미르", body: "갈대 언덕의 종 조각을 아직 못 찾으셨나요?" }],
      });
      const elderP3 = eventPages.addEventPage(villageId, elderId);
      eventPages.updateEventPage(villageId, elderId, elderP3, {
        name: "촌장 미르 (완료)",
        conditions: [{ kind: "switch", switchId: swBell, value: true }],
        graphic: graphic(people2, 0),
        commands: [
          { kind: "text", speaker: "미르", body: "종 조각이군요! 마을에 아침이 돌아올 거예요." },
          { kind: "changeGold", op: "+=", amount: 50 },
          { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 },
          { kind: "setSwitch", switchId: swDone, value: true },
          {
            kind: "ending",
            title: demoTitleShort,
            message: "이슬 마을의 종이 다시 울리고, 안개 사이로 아침 빛이 스며들었다.",
          },
        ],
      });

      // 약사
      const healerId = eventActions.addEvent(villageId, 6, 9);
      eventPages.ensureEventPages(villageId, healerId);
      eventPages.updateEventPage(villageId, healerId, pageId(villageId, healerId, 0), {
        name: "약사 노아",
        graphic: graphic(people3, 4),
        commands: [
          { kind: "text", speaker: "노아", body: "다치면 제게 오세요. 언덕 길도 조심하세요." },
          { kind: "recoverAll" },
          { kind: "text", speaker: "노아", body: "기운이 돌아오길." },
        ],
      });

      // 아이
      const childId = eventActions.addEvent(villageId, 14, 9);
      eventPages.ensureEventPages(villageId, childId);
      eventPages.updateEventPage(villageId, childId, pageId(villageId, childId, 0), {
        name: "아이 루",
        graphic: graphic(people1, 2),
        movement: { type: "random", speed: 2, frequency: 3 },
        commands: [
          { kind: "text", speaker: "루", body: "남쪽 길이 갈대 언덕으로 이어져요. 슬라임이 지키고 있대요." },
        ],
      });

      // 마을 → 언덕
      const toHillId = eventActions.addEvent(villageId, 10, 13, { kind: "playerTouch" });
      eventPages.ensureEventPages(villageId, toHillId);
      eventPages.updateEventPage(villageId, toHillId, pageId(villageId, toHillId, 0), {
        name: "갈대 언덕 입구",
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        commands: [{ kind: "transfer", mapId: hillId, x: 10, y: 12, direction: "up", fade: "black" }],
      });

      // 언덕 → 마을
      const toVillageId = eventActions.addEvent(hillId, 10, 13, { kind: "playerTouch" });
      eventPages.ensureEventPages(hillId, toVillageId);
      eventPages.updateEventPage(hillId, toVillageId, pageId(hillId, toVillageId, 0), {
        name: "마을로",
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        commands: [{ kind: "transfer", mapId: villageId, x: 10, y: 12, direction: "down", fade: "black" }],
      });

      // 슬라임
      const slimeId = eventActions.addEvent(hillId, 10, 5);
      eventPages.ensureEventPages(hillId, slimeId);
      eventPages.updateEventPage(hillId, slimeId, pageId(hillId, slimeId, 0), {
        name: "안개 슬라임",
        conditions: [{ kind: "switch", switchId: swQuest, value: true }],
        graphic: graphic(monster1, 0),
        commands: [
          { kind: "text", body: "안개 속에서 슬라임이 덤벼든다!" },
          {
            kind: "battleProcessing",
            troopId: "troop_slime",
            canEscape: true,
            canLose: false,
          },
          { kind: "text", body: "쓰러진 슬라임 곁에 반짝이는 종 조각이 있다." },
          { kind: "setSwitch", switchId: swBell, value: true },
          { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 },
        ],
      });
      const slimeP2 = eventPages.addEventPage(hillId, slimeId);
      eventPages.updateEventPage(hillId, slimeId, slimeP2, {
        name: "빈 자리",
        conditions: [{ kind: "switch", switchId: swBell, value: true }],
        graphic: { transparent: true },
        commands: [{ kind: "text", body: "슬라임은 이미 사라졌다." }],
      });

      editorState.set({ currentMapId: villageId, selectedEventId: null, selectedEventPageId: null });
      return { villageId, hillId, elderId, slimeId };

      function pageId(mapId: string, eventId: string, index: number): string {
        const page = store.getCurrent().maps[mapId]?.events.find((e) => e.id === eventId)?.pages?.[index];
        if (!page) throw new Error(`missing page ${index} on ${eventId}`);
        return page.id;
      }

      function graphic(spriteId: string, characterIndex: number) {
        return {
          sprite: { type: "bundled" as const, id: spriteId },
          direction: "down" as const,
          pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
        };
      }

      function paintRect(mapId: string, x: number, y: number, w: number, h: number, tile: number): void {
        store.update((draft) => {
          const map = draft.maps[mapId];
          if (!map) return;
          for (let yy = y; yy < y + h; yy += 1) {
            for (let xx = x; xx < x + w; xx += 1) {
              if (xx < 0 || yy < 0 || xx >= map.width || yy >= map.height) continue;
              map.lowerTiles[yy * map.width + xx] = tile;
            }
          }
        });
      }
    },
    {
      demoTitle: DEMO_TITLE,
      demoTitleShort: DEMO_TITLE_SHORT,
      swQuest: SW_QUEST,
      swBell: SW_BELL,
      swDone: SW_DONE,
    }
  );

  await page.waitForTimeout(400);
  await screenshot(page, "02-authored-editor.png");

  const exported = await projectExport(page);
  assertDemoShape(exported.project, mapIds.villageId, mapIds.hillId);
  await writeFile(FIXTURE_PATH, `${JSON.stringify(exported.project, null, 2)}\n`, "utf8");
  await writeFile(`${EVIDENCE_DIR}/dew-village-demo.json`, `${JSON.stringify(exported.project, null, 2)}\n`, "utf8");

  // 플레이: 제목 → 시작 → 촌장 선택지
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("title-screen").getByRole("heading", { name: DEMO_TITLE_SHORT })).toBeVisible();
  await screenshot(page, "03-title.png");
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(mapIds.villageId);
  await screenshot(page, "04-play-start.png");

  await page.getByTestId(`event-${mapIds.elderId}`).click();
  await expect(page.getByTestId("dialogue-box")).toContainText("이슬 마을의 종이 깨져");
  await advancePastText(page, "이슬 마을의 종이 깨져 아침이 오지 않아요.");
  await advancePastText(page, "갈대 언덕에서 종 조각을 찾아 주시겠어요?");
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await expect(page.getByTestId("runtime-choice-0")).toContainText("간다");
  await screenshot(page, "05-quest-offer.png");
  await page.getByTestId("runtime-choice-0").click();
  await expect.poll(async () => (await runtimeState(page)).switches[SW_QUEST]).toBe(true);
  await screenshot(page, "06-quest-accepted.png");
});

function assertDemoShape(project: Project, villageMapId: string, hillMapId: string): void {
  expect(project.meta.title).toBe(DEMO_TITLE);
  expect(project.system.titleScreen?.title).toBe(DEMO_TITLE_SHORT);
  expect(Object.keys(project.maps).length).toBe(2);
  expect(project.maps[villageMapId]?.name).toBe("이슬 마을");
  expect(project.maps[hillMapId]?.name).toBe("갈대 언덕");
  expect(project.maps[villageMapId]?.events.length).toBeGreaterThanOrEqual(4);
  expect(project.maps[hillMapId]?.events.length).toBeGreaterThanOrEqual(2);
  const commands = Object.values(project.maps)
    .flatMap((map) => map.events)
    .flatMap((event) => event.pages ?? [])
    .flatMap((page) => flatten(page.commands));
  expect(commands.some((c) => c.kind === "choices")).toBe(true);
  expect(commands.some((c) => c.kind === "battleProcessing")).toBe(true);
  expect(commands.some((c) => c.kind === "transfer")).toBe(true);
  expect(commands.some((c) => c.kind === "ending")).toBe(true);
  expect(commands.some((c) => c.kind === "setSwitch")).toBe(true);
  expect(JSON.stringify(project)).toContain("미르");
  expect(JSON.stringify(project)).not.toContain("별등");
  expect(JSON.stringify(project)).not.toContain("map_lantern");
}

function flatten(commands: readonly Command[]): Command[] {
  return commands.flatMap((command) => {
    if (command.kind === "choices") {
      return [command, ...command.options.flatMap((o) => flatten(o.branch)), ...flatten(command.cancelBranch ?? [])];
    }
    if (command.kind === "fork") return [command, ...flatten(command.then), ...flatten(command.else ?? [])];
    return [command];
  });
}

async function projectExport(page: Page): Promise<ProjectExport> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as ProjectExport;
}

async function runtimeState(page: Page): Promise<{ mapId: string; switches: Record<string, boolean> }> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as { mapId: string; switches: Record<string, boolean> };
}

async function advanceDialogue(page: Page): Promise<void> {
  const dialogue = page.getByTestId("dialogue-box");
  if ((await dialogue.count()) > 0) {
    await dialogue.click({ force: true });
    return;
  }
  await page.keyboard.press("Enter");
}

async function advancePastText(page: Page, currentText: string): Promise<void> {
  await expect(page.getByTestId("dialogue-box")).toContainText(currentText);
  await page.waitForTimeout(80);
  await advanceDialogue(page);
  try {
    await expect
      .poll(async () => {
        if ((await page.getByTestId("runtime-choices").count()) > 0) return false;
        const dialogue = page.getByTestId("dialogue-box");
        if ((await dialogue.count()) === 0) return false;
        return ((await dialogue.textContent()) ?? "").includes(currentText);
      }, { timeout: 750 })
      .toBe(false);
    return;
  } catch {
    await advanceDialogue(page);
  }
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}`, fullPage: true });
}
