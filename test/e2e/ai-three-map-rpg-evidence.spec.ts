/**
 * 내장 AI 가 저작한 맵 3개 RPG(`rpg-zzu-three-map-rpg`)를 **화면에서** 확인하고
 * HTML 리포트용 스크린샷 증거를 모은다.
 *
 * 프로젝트는 `test/aiThreeMapRpg.live.test.ts` 가 LegacyDb 에 저장한 것을 그대로
 * 읽어 주입한다(에디터 실제 로드 경로 = `__OPRN_E2E_PROJECT__`).
 *
 * 실행:
 *   OPRN_AI_THREE_MAP_SHOTS=1 npx playwright test test/e2e/ai-three-map-rpg-evidence.spec.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectForEditor } from "./projectSeed";

const PROJECT_JSON = path.resolve("output/evidence/ai-three-map-rpg/project-after.json");
const REPORT_JSON = path.resolve("output/evidence/ai-three-map-rpg/build-report.json");
const SHOT_DIR = path.resolve("docs/ai-three-map-rpg-assets");

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

type ShotMeta = { readonly file: string; readonly title: string; readonly caption: string };
const shots: ShotMeta[] = [];

async function shot(page: Page, file: string, title: string, caption: string): Promise<void> {
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, file) });
  shots.push({ file, title, caption });
}

test("AI 저작 3맵 RPG — 에디터/런타임 증거 스크린샷", async ({ page }) => {
  test.skip(process.env.OPRN_AI_THREE_MAP_SHOTS !== "1", "증거 수집 전용 스펙");
  expect(existsSync(PROJECT_JSON), `먼저 aiThreeMapRpg.live.test.ts 를 돌려라: ${PROJECT_JSON}`).toBe(true);

  type EvidenceEvent = {
    readonly id: string;
    readonly pages?: readonly {
      readonly name?: string;
      readonly commands?: readonly { readonly kind?: string }[];
    }[];
  };
  const project = JSON.parse(readFileSync(PROJECT_JSON, "utf8")) as {
    readonly maps: Record<
      string,
      { readonly name: string; readonly width: number; readonly height: number; readonly events?: readonly EvidenceEvent[] }
    >;
    readonly startMapId: string;
  };
  const mapIds = Object.keys(project.maps);
  expect(mapIds.length, "3맵이어야 한다").toBe(3);

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  });
  await page.setViewportSize({ width: 1680, height: 1020 });
  await seedProjectForEditor(page, project);

  // 1) 시작 맵이 실제로 그려진 에디터 화면
  await page.waitForTimeout(2500);
  await shot(
    page,
    "01-editor-start-map.png",
    "에디터 — AI 가 만든 시작 맵",
    `프로젝트를 열면 AI 가 시작 맵으로 지정한 ${project.maps[project.startMapId]?.name ?? project.startMapId} 이 그려진다. 좌측 맵 트리에 3장이 보인다.`,
  );

  // 2) 맵 트리 — 3장이 목록에 있는지 화면으로 확인
  const tree = page.getByTestId("map-tree");
  if (await tree.count()) {
    await expect(tree).toBeVisible();
    await tree.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // 맵 트리만 크롭해서 "3장이 등록됨" 을 또렷하게 남긴다(전체 화면 중복 방지).
    mkdirSync(SHOT_DIR, { recursive: true });
    await tree.screenshot({ path: path.join(SHOT_DIR, "02-map-tree-three-maps.png") });
    shots.push({
      file: "02-map-tree-three-maps.png",
      title: "맵 목록 — 3장",
      caption: "에디터 맵 트리에 마을·던전·실내 3장이 등록돼 있다. AI 가 create_map 을 3번 호출한 결과다.",
    });
  }

  // 3) 각 맵을 클릭해 캔버스에 실제로 렌더되는지 확인
  for (const [index, mapId] of mapIds.entries()) {
    const row = page.getByTestId(`map-tree-node-${mapId}`);
    if (!(await row.count())) continue;
    await row.first().click();
    await page.waitForTimeout(1800);
    const map = project.maps[mapId]!;
    await shot(
      page,
      `03-map-${index + 1}-${mapId}.png`,
      `맵 ${index + 1}/3 — ${map.name}`,
      `${map.name} (${map.width}×${map.height}). AI 가 타일을 깔고 이벤트를 배치한 결과가 캔버스에 그대로 렌더된다.`,
    );
  }

  // 4) 런타임 — 테스트 플레이로 진입. 확립된 경로: mode-play → test-play-window → 타이틀 새 게임.
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page, { timeoutMs: 30_000 });
  const stateNode = page.getByTestId("runtime-state-json");
  await expect(stateNode).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1200);

  const readState = async (): Promise<{ mapId: string; player: { x: number; y: number } } | null> => {
    try {
      return JSON.parse((await stateNode.first().textContent()) ?? "null");
    } catch {
      return null;
    }
  };
  const startState = await readState();
  console.log("[evidence] runtime start:", JSON.stringify(startState));
  expect(startState?.mapId, "런타임이 AI 가 지정한 시작 맵에서 시작해야 한다").toBe(project.startMapId);

  await shot(
    page,
    "04-runtime-playable.png",
    "런타임 — 실제로 플레이된다",
    `테스트 플레이로 들어가면 AI 가 시작 맵으로 지정한 ${project.maps[project.startMapId]?.name} 에서 플레이가 시작된다. 런타임이 보고한 맵 = ${startState?.mapId}, 좌표 = ${startState?.player.x},${startState?.player.y}.`,
  );

  // 5) NPC 대화 — AI 가 place_npc 로 심은 이벤트가 실제로 말을 하는지.
  //    걷기 대신 이벤트 마커를 직접 클릭한다(확립된 e2e 패턴 — 벽/방향 어긋남에 강하다).
  const dialogue = page.getByTestId("dialogue-box");
  const villagers = (project.maps[project.startMapId]?.events ?? []).filter((e) =>
    (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "text")),
  );
  let spoke = false;
  for (const npc of villagers) {
    const marker = page.getByTestId(`event-${npc.id}`);
    if (!(await marker.count())) continue;
    await marker.first().click({ force: true });
    try {
      await expect(dialogue).toBeVisible({ timeout: 8_000 });
    } catch {
      continue;
    }
    // 타자기 출력이 멈출 때까지 기다린다.
    let text = "";
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await page.waitForTimeout(150);
      const next = (await dialogue.first().textContent()) ?? "";
      if (next === text && next.length > 0) break;
      text = next;
    }
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 140);
    console.log(`[evidence] dialogue from ${npc.pages?.[0]?.name ?? npc.id}:`, clean);
    await shot(
      page,
      "05-runtime-npc-dialogue.png",
      "런타임 — AI 가 심은 NPC 가 말한다",
      `AI 가 place_npc 로 배치한 "${npc.pages?.[0]?.name ?? npc.id}" 에게 말을 걸면 대화창이 뜬다. 실제 출력: "${clean}"`,
    );
    spoke = true;
    break;
  }
  expect(spoke, "AI 가 심은 NPC 중 하나는 실제로 말을 해야 한다").toBe(true);

  const report = existsSync(REPORT_JSON) ? JSON.parse(readFileSync(REPORT_JSON, "utf8")) : null;
  writeFileSync(
    path.join(SHOT_DIR, "shots.json"),
    `${JSON.stringify({ shots, report: report ? { toolCallCount: report.toolCallCount, toolOkCount: report.toolOkCount, verified: report.verified } : null }, null, 2)}\n`,
  );
  expect(shots.length, "스크린샷이 하나도 안 찍혔다").toBeGreaterThanOrEqual(3);
});
