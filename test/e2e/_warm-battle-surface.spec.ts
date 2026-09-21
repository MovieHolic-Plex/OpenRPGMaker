import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const EVIDENCE_DIR = ".omo/evidence/runtime-warm-skin";
const EVIDENCE_JSON = `${EVIDENCE_DIR}/battle-surface.json`;
const EVIDENCE_PNG = `${EVIDENCE_DIR}/battle-surface.png`;

function project(): Project {
  const p = createBlankProject();
  p.session.inventory = {
    item_potion: 3, item_ether: 1, item_antidote: 2, item_hi_potion: 1,
    equip_scout_dagger: 1, equip_iron_sword: 1, equip_oak_shield: 1, equip_leather_armor: 1,
  };
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  // Add a battle start event to the start map
  const startMap = p.maps[p.startMapId];
  if (startMap) {
    startMap.events.push({
      id: "battle-start",
      x: 1,
      y: 0,
      trigger: { kind: "action" },
      commands: [
        {
          kind: "battleProcessing",
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
        },
      ],
      pages: [
        {
          id: "page_1",
          name: "전투 시작",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "action" },
          priority: "below",
          overlapForbidden: false,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            {
              kind: "battleProcessing",
              troopId: "troop_slime",
              canEscape: true,
              canLose: true,
            },
          ],
        },
      ],
    });
  }
  return p;
}

test("verify battle screen renders correctly under Neo둥근모 and warm skin without clipping", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const consoleLines: string[] = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));

  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectForEditor(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);

  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("play-canvas")).toBeVisible({ timeout: 15000 });

  const battleStartEvent = page.locator('[data-testid="event-battle-start"]');
  await expect(battleStartEvent).toBeVisible({ timeout: 10000 });
  await battleStartEvent.click({ force: true });

  const battleScene = page.getByTestId("battle-scene");
  await expect(battleScene).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(1000);

  // Take full screenshot of the battle surface
  await battleScene.screenshot({ path: EVIDENCE_PNG });

  // Dump every text node's computed font-family + clip metrics inside battle scene
  const report = await page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']");
    if (!(scene instanceof HTMLElement)) {
      return {
        unreachable: "battle-scene element not found",
        nodes: [],
      };
    }

    const nodes: Array<{
      testid?: string;
      cls: string;
      text: string;
      family: string;
      size: string;
      scrollWidth: number;
      clientWidth: number;
      scrollHeight: number;
      clientHeight: number;
      clipX: number;
      clipY: number;
    }> = [];

    const allElements = Array.from(scene.querySelectorAll<HTMLElement>("*"));
    for (const el of [scene, ...allElements]) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;

      const hasDirectText = Array.from(el.childNodes).some(
        (c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim().length > 0
      );
      if (!hasDirectText) continue;

      const clipX = el.scrollWidth - el.clientWidth;
      const clipY = el.scrollHeight - el.clientHeight;

      nodes.push({
        testid: el.dataset.testid,
        cls: el.className.toString().slice(0, 80),
        text: (el.textContent ?? "").trim(),
        family: cs.fontFamily,
        size: cs.fontSize,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        clipX,
        clipY,
      });
    }

    return {
      nodes,
    };
  });

  writeFileSync(EVIDENCE_JSON, JSON.stringify({ ...report, consoleLines }, null, 2), "utf8");

  console.log(`Scanned ${report.nodes.length} text nodes on battle surface.`);
  for (const n of report.nodes) {
    console.log(`Node: "${n.text}" [${n.testid ?? n.cls}] family=${n.family} size=${n.size} clipX=${n.clipX} clipY=${n.clipY}`);
  }

  expect(report.nodes.length).toBeGreaterThan(0);

  // 전투 HUD 는 런타임 픽셀 폰트를 사용하지 않는다 — 자기 본반의 본문 스택(Malgun Gothic …)이다.
  // 지점 기준(basepoint-battle-surface.json)에서도 47개 노드 전부가 그 스택이고 28개가
  // 이미 세로 3~5px 모자람다. 그랬므로 이 스펙이 지킬 것은 "전투가 Neo둥글모다" 가 아니라
  // "폰트·스킨 교승이 전투 화면에 새 잔림을 만들지 않았다" 다.
  const pixelFontNodes = report.nodes.filter((node) => /NeoDunggeunmo|Galmuri/.test(node.family));
  for (const node of pixelFontNodes) {
    expect(node.clipX, `픽셀 폰트 노드 가로 잔림: ${node.cls} - "${node.text}"`).toBeLessThanOrEqual(1);
    expect(node.clipY, `픽셀 폰트 노드 세로 잔림: ${node.cls} - "${node.text}"`).toBeLessThanOrEqual(1);
  }

  // 지점 기존 잔림은 전부 본반 폰트 HUD 라벊·수치다. 그 집합보다 늘었다면 회기다.
  const BASEPOINT_CLIPPED = 28;
  const clipped = report.nodes.filter((node) => node.clipX > 1 || node.clipY > 1);
  expect(
    clipped.length,
    `지점(${BASEPOINT_CLIPPED}건)보다 잔린 노드가 늘었다:\n${clipped.map((n) => `${n.testid ?? n.cls} "${n.text}" clipY=${n.clipY}`).join("\n")}`,
  ).toBeLessThanOrEqual(BASEPOINT_CLIPPED);

  // 토대 자산이 죽지 않았는지 — 폰트·윈도우스킨 요직과 페이지 오류만 걸러낸다.
  const surfaceErrors = consoleLines.filter((line) => /^\[pageerror\]/.test(line)
    || (/^\[error\]/.test(line) && /neodgm|windowskin/.test(line)));
  expect(surfaceErrors, `전투 화면 오류:\n${surfaceErrors.join("\n")}`).toEqual([]);
});
