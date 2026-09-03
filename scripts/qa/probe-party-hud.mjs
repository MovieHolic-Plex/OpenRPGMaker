// 파티 HUD 이름/수치가 왜 잘리는지 — **계산된 값**으로 확인한다.
// _rm2000.css 에서 네 번이나 "나중에 나온 더 구체적인 규칙" 이 내가 고치려던 규칙을 덮었다.
// 그래서 이제 선택자를 눈으로 고르지 않고, 실제로 이기는 선언을 브라우저에 물어본다.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const SKINS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["rm2000", "mother", "ff"];

const base = JSON.parse(await readFile(new URL("test/fixtures/projects/editor-authored-demo-v3.json", `file://${REPO_ROOT}`), "utf8"));

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

for (const skin of SKINS) {
  const raw = JSON.parse(JSON.stringify(base));
  // 스킨은 system.battleUiStyle 하나로 정해진다(scripts/qa/battle-text-audit.mjs:76). 다른
  // 필드에 쓰면 조용히 기본 스킨으로 부팅된다 — 실측으로 스킨 요청이 기본 스킨으로 떴다.
  raw.system = { ...raw.system, battleUiStyle: skin };
  const startMap = raw.maps[raw.startMapId];
  const commands = [{ kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: true }];
  startMap.events = startMap.events.filter((e) => e.id !== "ev_probe");
  startMap.events.push({
    id: "ev_probe", x: startMap.startX ?? 1, y: startMap.startY ?? 1, trigger: { kind: "auto" }, commands,
    pages: [{ id: "page_1", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "auto" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route(`**${PROJECT_URL}`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(raw) }));
  await page.addInitScript(([u, n]) => { window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: n }; }, [PROJECT_URL, `probe-hud-${skin}`]);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='battle-command-grid'] button", { timeout: 60_000 });
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        sel,
        fs: cs.fontSize,
        lh: cs.lineHeight,
        rectH: Math.round(r.height * 100) / 100,
        client: el.clientHeight,
        scroll: el.scrollHeight,
        overflow: `${cs.overflowX}/${cs.overflowY}`,
        parent: el.parentElement ? el.parentElement.className : null,
        parentClient: el.parentElement ? el.parentElement.clientHeight : null,
        parentScroll: el.parentElement ? el.parentElement.scrollHeight : null,
      };
    };
    const status = document.querySelector(".battle-actor-status");
    const rows = status
      ? {
          rows: getComputedStyle(status).gridTemplateRows,
          gap: getComputedStyle(status).rowGap,
          pad: getComputedStyle(status).paddingTop + "/" + getComputedStyle(status).paddingBottom,
          kids: [...status.children].map((k) => {
            const cs = getComputedStyle(k);
            return `${k.className}: rectH=${Math.round(k.getBoundingClientRect().height * 100) / 100} client=${k.clientHeight} scroll=${k.scrollHeight} fs=${cs.fontSize} lh=${cs.lineHeight}`;
          }),
        }
      : null;
    return {
      statusRows: rows,
      skin: document.querySelector("[data-testid='battle-scene']")?.dataset.battleSkin ?? null,
      nodes: [".battle-actor-status", ".battle-actor-status-head", ".battle-actor-name", ".battle-actor-level", ".battle-vital-label", ".battle-actor-hp"].map(pick),
    };
  });
  console.log(`\n=== ${skin} (dataset=${info.skin}) ===`);
  if (info.statusRows) {
    console.log(`  status rows=${info.statusRows.rows} gap=${info.statusRows.gap} pad=${info.statusRows.pad}`);
    for (const k of info.statusRows.kids) console.log(`    · ${k}`);
  }
  for (const n of info.nodes) {
    if (!n) continue;
    console.log(
      `  ${n.sel.padEnd(28)} fs=${String(n.fs).padStart(5)} lh=${String(n.lh).padStart(7)} rectH=${String(n.rectH).padStart(7)} client=${String(n.client).padStart(4)} scroll=${String(n.scroll).padStart(4)} of=${n.overflow}` +
        ` | parent=${n.parent} pc=${n.parentClient} ps=${n.parentScroll}`,
    );
  }
  await page.close();
}

await browser.close();
await server.close();
