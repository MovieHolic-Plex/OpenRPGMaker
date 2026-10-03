// 커맨드 패널의 실제 자식 구성과 트랙 높이를 찍는다. 행 수를 눈으로 가정하지 않기 위한 계측.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";

const raw = JSON.parse(await readFile(new URL("test/fixtures/projects/editor-authored-demo-v3.json", `file://${REPO_ROOT}`), "utf8"));
raw.system = { ...raw.system, battleUiStyle: process.argv[2] ?? "retro2003" };
const skillIds = raw.database.skills.slice(0, 6).map((s) => s.id);
for (const actor of raw.database.actors) actor.learnedSkills = skillIds.map((id) => ({ skillId: id, level: 1 }));
const startMap = raw.maps[raw.startMapId];
const commands = [{ kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: true }];
startMap.events = startMap.events.filter((e) => e.id !== "ev_probe");
startMap.events.push({
  id: "ev_probe", x: startMap.startX ?? 1, y: startMap.startY ?? 1, trigger: { kind: "auto" }, commands,
  pages: [{ id: "page_1", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "auto" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
});

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route(`**${PROJECT_URL}`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(raw) }));
await page.addInitScript(([u, n]) => { window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: n }; }, [PROJECT_URL, "probe-panel"]);
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
await page.keyboard.press("Enter");
await page.waitForSelector("[data-testid='battle-command-grid'] button", { timeout: 60_000 });

const dump = async (label) => {
  const info = await page.evaluate(() => {
    const panel = document.querySelector(".battle-command-panel");
    if (!panel) return null;
    const cs = getComputedStyle(panel);
    return {
      phase: document.querySelector("[data-testid='battle-scene']")?.dataset.battlePhase ?? null,
      panel: { client: [panel.clientWidth, panel.clientHeight], scroll: [panel.scrollWidth, panel.scrollHeight] },
      rows: cs.gridTemplateRows,
      children: [...panel.children].map((c) => {
        const s = getComputedStyle(c);
        return {
          cls: c.className,
          h: Math.round(c.getBoundingClientRect().height * 100) / 100,
          client: c.clientHeight,
          scroll: c.scrollHeight,
          display: s.display,
          row: s.gridRow,
          pad: `${s.paddingTop}/${s.paddingBottom}`,
          border: `${s.borderTopWidth}/${s.borderBottomWidth}`,
          lh: s.lineHeight,
          fs: s.fontSize,
          alignSelf: s.alignSelf,
          rows: s.gridTemplateRows,
          autoRows: s.gridAutoRows,
          gap: s.rowGap,
          kids: [...c.children].map((k) => ({
            cls: k.className || k.tagName.toLowerCase(),
            h: Math.round(k.getBoundingClientRect().height * 100) / 100,
            client: k.clientHeight,
            scroll: k.scrollHeight,
            display: getComputedStyle(k).display,
          })),
        };
      }),
    };
  });
  console.log(`\n=== ${label} phase=${info?.phase} ===`);
  console.log(`panel client=${JSON.stringify(info.panel.client)} scroll=${JSON.stringify(info.panel.scroll)}`);
  console.log(`grid-template-rows: ${info.rows}`);
  for (const c of info.children) {
    console.log(
      `   ${String(c.cls).padEnd(30)} rect_h=${String(c.h).padStart(7)} client=${String(c.client).padStart(4)} scroll=${String(c.scroll).padStart(4)}` +
        ` disp=${c.display} row=${c.row} pad=${c.pad} bd=${c.border} lh=${c.lh} fs=${c.fs} self=${c.alignSelf}`,
    );
    if (c.rows !== "none" || c.autoRows !== "auto") console.log(`        rows=${c.rows} autoRows=${c.autoRows} rowGap=${c.gap}`);
    for (const k of c.kids) console.log(`        · ${String(k.cls).padEnd(30)} rect_h=${String(k.h).padStart(7)} client=${String(k.client).padStart(4)} scroll=${String(k.scroll).padStart(4)} disp=${k.display}`);
  }
};

await dump("actorCommand");
const rowInfo = await page.evaluate(() => {
  const row = document.querySelector("[data-testid='battle-command-grid'] .battle-command");
  if (!row) return null;
  const strong = row.querySelector("strong");
  const cs = getComputedStyle(row);
  const ss = strong ? getComputedStyle(strong) : null;
  const range = document.createRange();
  let ink = null;
  if (strong && strong.firstChild) { range.selectNodeContents(strong); const r = range.getBoundingClientRect(); ink = [Math.round(r.width*100)/100, Math.round(r.height*100)/100]; }
  return {
    row: { rectH: row.getBoundingClientRect().height, client: row.clientHeight, scroll: row.scrollHeight, pad: cs.paddingTop+"/"+cs.paddingBottom, bd: cs.borderTopWidth+"/"+cs.borderBottomWidth, minH: cs.minHeight },
    strong: ss ? { fs: ss.fontSize, lh: ss.lineHeight, client: strong.clientHeight, scroll: strong.scrollHeight, rectH: Math.round(strong.getBoundingClientRect().height*100)/100, of: ss.overflow } : null,
    inkDevice: ink,
    rowVar: getComputedStyle(document.querySelector("[data-testid='battle-scene']")).getPropertyValue("--battle-command-row-height"),
  };
});
console.log("  ROW:", JSON.stringify(rowInfo, null, 1).replace(/\n\s*/g, " "));
await page.locator("[data-testid='battle-command-grid'] [data-testid='actor-command-attack']").first().evaluate((n) => n.click());
await page.waitForTimeout(400);
await dump("targetSelect");

await browser.close();
await server.close();
