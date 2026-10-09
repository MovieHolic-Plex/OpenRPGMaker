// 시간표 점검을 100ms 주기로 묶은 뒤에도 **주민이 실제로 걸어간다**는 브라우저 증거.
//
// 왜 별도 스펙인가: npc-daily-life.spec.ts 는 데모 마을(createSampleAdventureProject)을 쓰는데
// 그 프로젝트는 origin/main 에서도 시연 창이 열리지 않아 실패한다(실측, 두 워크트리 동일).
// 여기서는 최소 프로젝트로 같은 코드 경로(tickNpcSchedules → registerAutonomousMover →
// refreshRuntimeEntities)만 태운다.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectForEditor } from "./projectSeed";

const SIZE = 20;
const EVIDENCE = path.resolve(".omo/evidence/runtime-perf");

test.setTimeout(150_000);
test.use({ serviceWorkers: "block" });

test("시간표 주기를 묶어도 주민이 목표 칸까지 걸어간다", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  const project = createBlankProject();
  const map = createBlankMap("시간표 증거 맵", SIZE, SIZE);
  map.id = "map_schedule_proof";
  map.tilesetId = project.maps[project.startMapId]!.tilesetId;
  map.lowerTiles = new Array(SIZE * SIZE).fill(TILE.GRASS);
  map.upperTiles = new Array(SIZE * SIZE).fill(-1);
  map.events = [{
    id: "villager",
    x: 2,
    y: 2,
    trigger: { kind: "action" },
    commands: [],
    schedule: [{
      when: { hourRange: [6, 18] },
      at: { mapId: "map_schedule_proof", x: 12, y: 9 },
      activity: "work",
    }],
    pages: [{
      id: "villager_base",
      name: "주민",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    }],
  }];
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  project.system = {
    ...project.system,
    timeSystem: { enabled: true, minutesPerRealSecond: 60, dayStartHour: 6, dayEndHour: 26 },
  };

  await seedProjectForEditor(page, project);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });

  const marker = page.getByTestId("event-villager");
  await expect(marker).toBeAttached({ timeout: 15_000 });

  // 시간표는 목표 칸(12,9)까지 걸어가야 한다. 100ms 묶음이 걸음을 막지 않는지가 핵심이다.
  await expect
    .poll(async () => Number(await marker.getAttribute("data-map-x")) / 16, { timeout: 60_000 })
    .toBe(12);
  expect(Number(await marker.getAttribute("data-map-y")) / 16).toBe(9);

  // npcActivities 는 상태 JSON 거울이 아니라 __oprnDebug.readState 가 노출한다.
  const activity = await page.evaluate(() => {
    const hook = (window as unknown as {
      __oprnDebug?: { readState(): { npcActivities: Record<string, string> } };
    }).__oprnDebug;
    return hook?.readState().npcActivities.villager ?? null;
  });
  expect(activity, "시간표 활동이 배정되지 않았다").toBe("work");

  const shot = await page.locator("[data-testid='test-play-window'] canvas").first().screenshot();
  await testInfo.attach("schedule-walked.png", { body: shot, contentType: "image/png" });
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(path.join(EVIDENCE, "schedule-walked.png"), shot);
});
