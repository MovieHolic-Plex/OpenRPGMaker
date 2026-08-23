// 제안 pill·완료 스트립 밴드 실측 프로브 (4단계).
// 1) 밴드가 모든 도크에서 문서에 있는가 — 예전에는 오버레이 안이라 유리·float 에서 없었다.
// 2) 비어 있을 때 맵 클릭을 삼키지 않는가 — 빈 투명 밴드가 캔버스 클릭을 먹던 사고(2026-08-19 P0).
// 3) pill 이 뜨면 그 자리에서 실제로 잡히는가(hit-test) — 보이지만 눌리지 않으면 의미가 없다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE_URL ?? "http://127.0.0.1:9802";
mkdirSync(OUT, { recursive: true });

const log = [];
const say = (line) => { log.push(line); console.log(line); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.addInitScript(() => {
  localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  localStorage.setItem("rpg-zzu:ai-studio-mode", "0");
});
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector("[data-testid='ai-panel']", { timeout: 60_000 });
await page.waitForTimeout(3000);

const hook = async (id) => {
  await page.locator(`[data-testid='${id}']`).first().evaluate((node) => node.click());
  await page.waitForTimeout(500);
};
const setDock = async (want) => {
  for (let i = 0; i < 4; i += 1) {
    if (await page.getAttribute("[data-testid='ai-panel']", "data-chat-dock") === want) return;
    await hook("chat-dock-toggle");
  }
  throw new Error(`dock ${want} 로 못 갔다`);
};

for (const dock of ["glass", "side", "float"]) {
  await setDock(dock);
  const state = await page.evaluate(() => {
    const band = document.querySelector("[data-testid='ai-rising-sticky-zone']");
    if (!band) return { mounted: false };
    const rect = band.getBoundingClientRect();
    const cx = Math.round(rect.x + rect.width / 2);
    const cy = Math.round(rect.y + rect.height / 2);
    const hit = rect.width > 0 && rect.height > 0 ? document.elementFromPoint(cx, cy) : null;
    return {
      mounted: true,
      pointerEvents: getComputedStyle(band).pointerEvents,
      position: getComputedStyle(band).position,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      emptyHit: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).split(" ")[0]}` : "(none)",
      swallows: Boolean(hit?.closest("[data-testid='ai-rising-sticky-zone']")),
    };
  });
  say(`[${dock}] ${JSON.stringify(state)}`);
  if (!state.mounted) say(`[FAIL] ${dock}: 밴드가 문서에 없다`);
  if (state.swallows) say(`[FAIL] ${dock}: 빈 밴드가 클릭을 삼킨다`);
}

// pill 히트테스트 — 도크별로 최소화 pill 을 띄우고 그 자리를 실제로 잡는지 본다.
for (const dock of ["glass", "side", "float"]) {
  await setDock(dock);
  const pillHit = await page.evaluate(() => {
    const pill = document.querySelector("[data-testid='ai-proposal-reopen']");
    if (!pill) return { ok: false, why: "pill 이 문서에 없다" };
    pill.textContent = "검토 대기 1건";
    pill.hidden = false;
    const rect = pill.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2));
    return {
      ok: hit === pill,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      hit: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).split(" ")[0]}` : "(none)",
    };
  });
  say(`[${dock} pill] ${JSON.stringify(pillHit)}`);
  if (!pillHit.ok) say(`[FAIL] ${dock}: pill 을 클릭으로 잡을 수 없다`);
  await page.screenshot({ path: join(OUT, `${dock}-pill-band.png`) });
  await page.evaluate(() => {
    const pill = document.querySelector("[data-testid='ai-proposal-reopen']");
    if (pill) { pill.hidden = true; pill.textContent = ""; }
  });
}

writeFileSync(join(OUT, "probe-log.txt"), `${log.join("\n")}\n`, "utf8");
await browser.close();
