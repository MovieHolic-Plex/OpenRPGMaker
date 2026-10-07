// 캐스케이드 회귀용 결정적 덤프.
// 픽셀 비교는 이 표면에서 못 쓴다 — 배경 애니메이션·유휴 프레임·RNG 때문에 같은 코드로
// 두 번 찍어도 수만 픽셀이 다르다(실측 잡음 바닥이 "차이"보다 큰 경우도 있었다).
// 대신 .battle-scene 아래 모든 노드의 계산 스타일을 안정 경로 키로 떠서 JSON 으로 남긴다.
// 애니메이션이 만지는 속성(transform/opacity/animation/filter)은 제외한다.
import { expect, test, type Page } from "@playwright/test";
import { seedProjectForEditor } from "./projectSeed";
import { createBlankProject } from "@/project/defaults";
// 데모 프로젝트 팩터리는 배럴이 아니라 defaultProject 에 있다 — 배럴은 가벼운 것만 내보낸다.
import { createScarloxyPokemonDemoProject } from "../support/scarloxyPokemonProject";
import { openDatabase, switchDatabaseTab, DATABASE_TAB_SPECS } from "./oprn-database-helpers";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Project } from "@/project/types";

const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const OUT = process.env.STYLE_DUMP_DIR ?? "verify-shots/style-dump";
test.setTimeout(180_000);

const PROPS = [
  "display", "position", "grid-template-columns", "grid-template-rows", "grid-auto-rows",
  "grid-area", "flex-direction", "flex-wrap", "align-items", "align-content", "justify-content",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "white-space",
  "word-break", "text-align", "text-overflow", "overflow-x", "overflow-y",
  "color", "background-color", "background-image", "border-top-width", "border-right-width",
  "border-bottom-width", "border-left-width", "border-top-color", "border-radius",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "min-height", "max-height", "min-width", "max-width", "z-index", "box-shadow", "clip-path",
] as const;

async function dump(page: Page, label: string, project: Project): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectForEditor(page, project);
  await openDatabase(page);
  await switchDatabaseTab(page, TROOPS_TAB);
  await page.locator(".db-list-row").first().click();
  await page.getByTestId("db-troop-battle-test").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2600);

  const collect = async (state: string) =>
    page.evaluate(
      ({ props }) => {
        const scene = document.querySelector<HTMLElement>(".battle-scene");
        if (!scene) return { error: "no scene" };
        const out: Record<string, Record<string, string>> = {};
        const walk = (el: Element, path: string) => {
          const cs = getComputedStyle(el);
          const rec: Record<string, string> = {};
          for (const p of props) rec[p] = cs.getPropertyValue(p);
          // ::before 도 뜬다 — 바 채움·커서 글리프가 거기 산다.
          const before = getComputedStyle(el, "::before");
          if (before.content && before.content !== "none") {
            for (const p of props) rec[`::before/${p}`] = before.getPropertyValue(p);
            rec["::before/content"] = before.content;
          }
          out[path] = rec;
          [...el.children].forEach((c, i) => walk(c, `${path}>${c.tagName.toLowerCase()}.${(c.className || "").toString().trim().replace(/\s+/g, ".")}[${i}]`));
        };
        walk(scene, "scene");
        return out;
      },
      { props: [...PROPS] },
    );

  const states: Record<string, unknown> = {};
  states.command = await collect("command");

  // 서브메뉴
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  states.submenu = await collect("submenu");

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${label}.json`, JSON.stringify(states, null, 1));
}

function pokemonProject(): Project {
  const p = createBlankProject();
  p.system.battleUiStyle = "pokemon";
  return p;
}
function retro2003Project(): Project {
  const p = createBlankProject();
  p.system.battleUiStyle = "retro2003";
  return p;
}

test("pokemon 계산 스타일 덤프", async ({ page }) => {
  await dump(page, "pokemon", pokemonProject());
});
test("genre 계산 스타일 덤프", async ({ page }) => {
  await dump(page, "genre", createScarloxyPokemonDemoProject());
});
test("retro2003 계산 스타일 덤프", async ({ page }) => {
  await dump(page, "retro2003", retro2003Project());
});
