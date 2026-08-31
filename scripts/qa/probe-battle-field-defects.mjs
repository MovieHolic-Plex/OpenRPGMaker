// 전투 필드의 시각/기능 결함을 DOM 계측으로 확정한다.
// 확인 대상:
//   1) `.battle-actor + .battle-actor { border-top }` (HUD 행 구분선)이 필드 스프라이트
//      노드에도 새어 스프라이트를 가로지르는 밝은 선을 그리는지
//   2) 파티 스프라이트가 필드 우측 경계로 잘리는지 / 서로 겹치는지
//   3) 동명 적 2마리의 이름표가 구분 접미(1/2)를 잃었는지
//   4) 커맨드에서 스킬을 골랐을 때 서브메뉴가 열리는지
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const OUT = "verify-shots/runtime-qa/field-defects";

const raw = JSON.parse(await readFile(new URL("test/fixtures/projects/editor-authored-demo-v3.json", `file://${REPO_ROOT}`), "utf8"));
const startMap = raw.maps[raw.startMapId];
const commands = [{ kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: true }];
startMap.events = startMap.events.filter((e) => e.id !== "ev_probe");
startMap.events.push({
  id: "ev_probe", x: startMap.startX ?? 1, y: startMap.startY ?? 1, trigger: { kind: "auto" }, commands,
  pages: [{ id: "page_1", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "auto" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
});

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.route(`**${PROJECT_URL}`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(raw) }));
await page.addInitScript(([u, n]) => { window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: n }; }, [PROJECT_URL, "probe-field"]);
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
await page.keyboard.press("Enter");
await page.waitForSelector("[data-testid='battle-scene']", { timeout: 120_000 });
await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 60_000 });

const geo = await page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
  const field = document.querySelector(".battle-field");
  const scene = document.querySelector("[data-testid='battle-scene']");
  const nodes = [...document.querySelectorAll(".battle-actor-group .battle-actor")];
  const enemies = [...document.querySelectorAll(".battle-enemy")];
  return {
    sceneData: { uiStyle: scene?.dataset.battleUiStyle, skin: scene?.dataset.battleSkin, phase: scene?.dataset.battlePhase },
    field: r(field),
    sprites: nodes.map((n, i) => {
      const cs = getComputedStyle(n);
      const img = n.querySelector("img");
      const plat = n.querySelector(".battle-actor-platform");
      return {
        i, name: n.getAttribute("aria-label"), node: r(n),
        borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
        img: img ? r(img) : null,
        imgTransform: img ? getComputedStyle(img).transform : null,
        platform: plat ? { rect: r(plat), bg: getComputedStyle(plat).backgroundImage.slice(0, 60), w: getComputedStyle(plat).width, h: getComputedStyle(plat).height } : null,
      };
    }),
    hudRows: [...document.querySelectorAll(".battle-party .battle-actor")].map((n, i) => ({ i, borderTop: getComputedStyle(n).borderTopWidth })),
    enemies: enemies.map((n) => ({
      recordId: n.dataset.recordId,
      label: n.querySelector(".battle-enemy-name")?.textContent ?? n.querySelector(".battle-enemy-hud")?.textContent ?? null,
      aria: n.getAttribute("aria-label"),
      rect: r(n),
    })),
    commandPanel: (() => { const p = document.querySelector(".battle-command-panel"); return p ? { rect: r(p), text: p.textContent.trim().slice(0, 120) } : null; })(),
  };
});
console.log("=== scene ===", JSON.stringify(geo.sceneData));
console.log("field:", JSON.stringify(geo.field));
console.log("\n=== field party sprite nodes ===");
for (const s of geo.sprites) {
  const clipped = s.img ? s.img.right - geo.field.right : null;
  console.log(`[${s.i}] ${s.name} node=${JSON.stringify(s.node)}`);
  console.log(`     border-top=${s.borderTop}`);
  console.log(`     img=${JSON.stringify(s.img)} transform=${s.imgTransform} overflowRight=${clipped}`);
  console.log(`     platform=${JSON.stringify(s.platform)}`);
}
console.log("\nHUD row border-tops:", JSON.stringify(geo.hudRows));
console.log("\n=== sprite overlap (node boxes) ===");
for (let a = 0; a < geo.sprites.length; a++) for (let b = a + 1; b < geo.sprites.length; b++) {
  const A = geo.sprites[a].img, B = geo.sprites[b].img;
  if (!A || !B) continue;
  const ox = Math.min(A.right, B.right) - Math.max(A.x, B.x);
  const oy = Math.min(A.bottom, B.bottom) - Math.max(A.y, B.y);
  if (ox > 0 && oy > 0) console.log(`  ${geo.sprites[a].name} × ${geo.sprites[b].name}: ${ox}×${oy}px`);
}
console.log("\n=== enemies ===");
for (const e of geo.enemies) console.log(`  ${e.recordId} label=${JSON.stringify(e.label)} aria=${JSON.stringify(e.aria)} rect=${JSON.stringify(e.rect)}`);
console.log("\ncommandPanel:", JSON.stringify(geo.commandPanel));

// ---- 스킬 서브메뉴 진입 시도 ----
const snap = async (label) => {
  const info = await page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']");
    const testids = [...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid).filter((t) => t.includes("skill") || t.includes("command") || t.includes("target") || t.includes("cursor"));
    const sel = [...document.querySelectorAll(".battle-command-panel .selected, .battle-command-panel [aria-selected='true']")].map((n) => n.textContent.trim());
    return { phase: scene?.dataset.battlePhase, mode: scene?.dataset.commandMode ?? null, testids: [...new Set(testids)], selected: sel, panelText: document.querySelector(".battle-command-panel")?.textContent.trim().slice(0, 160) };
  });
  console.log(`\n--- ${label} phase=${info.phase} mode=${info.mode}`);
  console.log(`    selected=${JSON.stringify(info.selected)}`);
  console.log(`    testids=${JSON.stringify(info.testids)}`);
  console.log(`    panel="${info.panelText}"`);
};
await snap("command root");
await page.keyboard.press("ArrowDown");
await snap("after ArrowDown (스킬)");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
await snap("after Enter on 스킬");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
await snap("after 2nd Enter");
await page.screenshot({ path: `${OUT}/after-skill-enter.png` });

await browser.close();
await server.close();
