// 포켓몬 전투 스킨 어색함 진단 — 두 진입 경로를 나란히 찍는다.
//  A) 스킨 드롭다운만 "pokemon" 으로 바꾼 프로젝트(코스메틱 전용 경로)
//  B) 장르 프리셋 monster-collect (skin + battleModel=gen1 둘 다)
// 목적: 어색함이 "스타일 버그"인지 "문법 불일치"인지 가른다.
import { expect, test, type Page } from "@playwright/test";
import { seedProjectForEditor } from "./projectSeed";
import { createBlankProject } from "@/project/defaults";
// 데모 프로젝트 팩터리는 배럴이 아니라 defaultProject 에 있다 — 배럴은 가벼운 것만 내보낸다.
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import { openDatabase, switchDatabaseTab, DATABASE_TAB_SPECS } from "./oprn-database-helpers";
import type { Project } from "@/project/types";

const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const SHOTS = process.env.POKEMON_SHOTS_DIR ?? "verify-shots/pokemon-diagnosis";

test.setTimeout(180_000);

function cosmeticOnlyProject(): Project {
  const project = createBlankProject();
  // 사용자가 자료집 > 시스템에서 전투 스킨만 "포켓몬" 으로 고른 상태.
  project.system.battleUiStyle = "pokemon";
  return project;
}

async function openBattleTest(page: Page): Promise<void> {
  await openDatabase(page);
  await switchDatabaseTab(page, TROOPS_TAB);
  await page.locator(".db-list-row").first().click();
  await page.getByTestId("db-troop-battle-test").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  // 인트로 안무(BATTLE_INTRO_MS 1200) 가 끝나기를 기다린다.
  await page.waitForTimeout(2600);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** 씬 루트의 계측값 — 눈으로 못 재는 것들. */
async function probe(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>(".battle-scene");
    if (!scene) return { error: "no .battle-scene" };
    const q = (sel: string) => scene.querySelectorAll(sel).length;
    const rect = (sel: string) => {
      const el = scene.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    // 커맨드 라벨 실제 텍스트 + 폰트
    const commands = [...scene.querySelectorAll(".battle-command")].map((el) => {
      const strong = el.querySelector("strong");
      const cs = strong ? getComputedStyle(strong) : null;
      return {
        text: (strong?.textContent ?? el.textContent ?? "").trim(),
        font: cs?.fontFamily ?? null,
        size: cs?.fontSize ?? null,
      };
    });
    const msg = scene.querySelector<HTMLElement>(".battle-message-line");
    const msgStyle = msg ? getComputedStyle(msg) : null;
    return {
      skin: scene.dataset.battleSkin ?? null,
      uiStyle: scene.dataset.battleUiStyle ?? null,
      phase: scene.dataset.battlePhase ?? null,
      counts: {
        enemies: q(".battle-enemy"),
        actorsOnField: q(".battle-actor-group .battle-actor"),
        partyCards: q(".battle-party .battle-actor-status"),
        enemyListRows: q(".battle-enemy-list-row"),
        atbBars: q(".battle-atb-label, .battle-atb-bar"),
        mpReadouts: q(".battle-actor-mp"),
        commands: commands.length,
      },
      commands,
      message: msg
        ? { text: msg.textContent?.trim() ?? "", font: msgStyle?.fontFamily ?? null, wordBreak: msgStyle?.wordBreak ?? null }
        : null,
      rects: {
        scene: rect(".battle-scene"),
        field: rect(".battle-field"),
        party: rect(".battle-party"),
        enemyPanel: rect(".battle-enemy-list-panel"),
        commandPanel: rect(".battle-command-panel"),
        messageWindow: rect(".battle-message-window"),
      },
    };
  });
}

async function runPath(page: Page, label: string, project: Project): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectForEditor(page, project);
  await openBattleTest(page);

  await shot(page, `${label}-01-command`);
  const p1 = await probe(page);
  console.log(`\n===== ${label} :: 명령 국면 =====\n${JSON.stringify(p1, null, 2)}`);

  // 기술 서브메뉴
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  await shot(page, `${label}-02-submenu`);
  const p2 = await probe(page);
  console.log(`\n===== ${label} :: 서브메뉴 =====\n${JSON.stringify(p2, null, 2)}`);

  // 기술 확정. 포켓몬 스킨은 후보가 하나면 대상 목록을 건너뛰고 바로 실행하므로
  // (runtime.autoConfirmSingleTarget) 국면을 보고 분기한다.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const phase = await page.evaluate(
    () => document.querySelector<HTMLElement>(".battle-scene")?.dataset.battlePhase ?? null,
  );
  if (phase === "targetSelect") {
    await shot(page, `${label}-03-target`);
    const p3 = await probe(page);
    console.log(`\n===== ${label} :: 대상 선택 =====\n${JSON.stringify(p3, null, 2)}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
  } else {
    console.log(`\n===== ${label} :: 대상 선택 건너뜀 (phase=${phase}) — 단일 대상 자동 확정 =====`);
  }

  // 타격 연출
  await shot(page, `${label}-04-impact`);
  await page.waitForTimeout(1400);
  await shot(page, `${label}-05-after`);
  const p5 = await probe(page);
  console.log(`\n===== ${label} :: 연출 후 =====\n${JSON.stringify(p5, null, 2)}`);

  // 승리까지 밀어붙여 결과 카드를 찍는다 — 지금까지 한 번도 검증하지 않은 국면.
  for (let i = 0; i < 24; i += 1) {
    const done = await page.evaluate(
      () => document.querySelector(".battle-result-panel") !== null,
    );
    if (done) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(320);
  }
  const hasResult = await page.evaluate(
    () => document.querySelector(".battle-result-panel") !== null,
  );
  if (hasResult) {
    await page.waitForTimeout(500);
    await shot(page, `${label}-06-result`);
  } else {
    console.log(`\n!!! ${label}: 결과 카드에 도달하지 못함`);
  }
}

test("A: 스킨 드롭다운만 포켓몬 (코스메틱 전용)", async ({ page }) => {
  await runPath(page, "A-cosmetic", cosmeticOnlyProject());
});

test("B: 장르 프리셋 monster-collect (skin + gen1)", async ({ page }) => {
  await runPath(page, "B-genre", createScarloxyPokemonDemoProject());
});
