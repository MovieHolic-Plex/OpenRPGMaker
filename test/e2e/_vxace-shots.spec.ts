/* vxace 스킨 보고서용 스크린샷 + 실측. 임시 스펙(파일명 `_` 접두사). */
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { prepareReferenceBattleProject } from "./battleReferenceProject";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const OUT = "evidence/battle-skin-vxace";

/** 참조 픽스처는 트룹에 구름 하늘 배경을 강제한다. 참조는 밝은 초원이라 스킨 기본 배경으로 바꾼다
 *  (트룹/시스템 지정이 스킨 기본보다 우선한다 — battleFieldDom: effectiveBackdropId). */
async function seedFieldBattle(page: import("@playwright/test").Page, tweak?: (p: ReturnType<typeof deserialize>) => void): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  prepareReferenceBattleProject(project);
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (troop) troop.previewBackgroundResourceId = "battle-skin-vxace-backdrop";
  tweak?.(project);
  await seedProjectForEditor(page, project);
}

async function enterBattle(page: import("@playwright/test").Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 25_000 });
}

const MEASURE = () => {
  const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']")!;
  const sr = scene.getBoundingClientRect();
  const k = 640 / sr.width; // 시각 px → 논리 px (논리 해상도 640×480)
  const rel = (sel: string) => {
    const el = scene.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const round = (n: number) => Math.round(n * k * 10) / 10;
    return { x: round(r.left - sr.left), y: round(r.top - sr.top), w: round(r.width), h: round(r.height) };
  };
  const font = (sel: string) => {
    const el = scene.querySelector(sel);
    // getComputedStyle 은 변환 전 px = 논리 px 를 그대로 돌려준다(스케일을 다시 곱하면 안 된다).
    return el ? Math.round(Number.parseFloat(getComputedStyle(el).fontSize) * 10) / 10 : null;
  };
  const cells = [...scene.querySelectorAll(".battle-actor-status")];
  const overflow = cells.map((cell) => {
    const cr = cell.getBoundingClientRect();
    let worst = 0;
    for (const child of cell.querySelectorAll("*")) {
      const r = child.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      worst = Math.max(worst, r.right - cr.right, r.bottom - cr.bottom, cr.left - r.left, cr.top - r.top);
    }
    return Math.round(worst * k * 10) / 10;
  });
  return {
    stage: { visual: `${Math.round(sr.width)}x${Math.round(sr.height)}`, scale: scene.dataset.battleStageScale ?? null },
    commandPanel: rel(".battle-command-panel"),
    commandItem: rel(".battle-command"),
    commandCursor: rel(".battle-command[data-battle-command-cursor='true']"),
    party: rel(".battle-party"),
    cell: rel(".battle-actor-status"),
    face: rel(".battle-actor-face"),
    hpValue: rel(".battle-actor-hp .battle-vital-value"),
    hpBar: rel(".battle-actor-status .battle-stat-bar-hp"),
    mpBar: rel(".battle-actor-status .battle-stat-bar-mp"),
    role: rel(".battle-actor-role"),
    apBar: rel(".battle-actor-gauge .battle-atb-bar"),
    enemyBadge: rel(".battle-enemy-index-badge"),
    enemyHpBar: rel(".battle-enemy-hp-bar"),
    enemyAtbBar: rel(".battle-enemy-atb-bar"),
    fonts: {
      command: font(".battle-command-text strong") ?? font(".battle-command-text"),
      hpValue: font(".battle-actor-hp .battle-vital-value"),
      mpValue: font(".battle-actor-mp .battle-vital-value"),
      levelValue: font(".battle-actor-level .battle-vital-value"),
      apValue: font(".battle-atb-value"),
      role: font(".battle-actor-role"),
      family: getComputedStyle(scene.querySelector(".battle-command-text") ?? scene).fontFamily.split(",")[0],
    },
    counts: {
      cells: cells.length,
      faces: scene.querySelectorAll(".battle-actor-face").length,
      roles: scene.querySelectorAll(".battle-actor-role").length,
      cursors: scene.querySelectorAll("[data-battle-command-cursor='true']").length,
      activeMarkers: scene.querySelectorAll(".battle-actor-status.is-active-actor").length,
    },
    maxTextIsHidden: getComputedStyle(scene.querySelector(".battle-vital-max")!).display === "none",
    hpTextContent: scene.querySelector(".battle-actor-hp")?.textContent ?? null,
    cellOverflowPx: overflow,
  };
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("vxace shots: 4인 파티 전투 흐름", async ({ page }) => {
  test.setTimeout(240_000);
  await seedFieldBattle(page);
  await enterBattle(page);
  const scene = page.getByTestId("battle-scene");
  const clip = async (name: string) => {
    const box = await scene.boundingBox();
    if (box) await page.screenshot({ path: `${OUT}/vx-${name}.png`, clip: box });
  };

  await page.waitForTimeout(600);
  await clip("01-command");
  const measured = await page.evaluate(MEASURE);
  await writeFile(`${OUT}/measure-command.json`, JSON.stringify(measured, null, 2), "utf8");
  console.log("MEASURE " + JSON.stringify(measured, null, 2));

  // 기술 서브메뉴
  await page.getByTestId("actor-command-skill").click();
  await page.waitForTimeout(350);
  await clip("02-skill-submenu");
  await page.keyboard.press("Escape");
  await expect(scene).toHaveAttribute("data-battle-phase", "actorCommand");

  // 대상 선택
  await page.getByTestId("actor-command-attack").click();
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  await page.waitForTimeout(350);
  await clip("03-target");

  // 해결(피해 팝업 / 명령창 내려감)
  await page.keyboard.press("z");
  for (let i = 0; i < 80; i += 1) {
    const phase = await scene.getAttribute("data-battle-phase").catch(() => null);
    if (phase !== "targetSelect") break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  await clip("04-resolve");

  // 승리까지 밀어붙인다
  for (let i = 0; i < 60; i += 1) {
    if ((await scene.getAttribute("data-battle-director-step").catch(() => null)) === "result") break;
    const attack = page.getByTestId("actor-command-attack");
    if (await attack.isVisible().catch(() => false)) {
      await attack.click({ force: true });
      await page.keyboard.press("z");
    }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  await clip("05-result");
});
