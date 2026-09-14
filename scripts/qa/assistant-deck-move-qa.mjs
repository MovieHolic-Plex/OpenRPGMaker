/**
 * 조수(AI 어시스턴트) 데크 위치 이동 QA — 레일 드래그로 데크를 캔버스 위 아무 데나 놓는다.
 *
 * 목적: (1) 레일을 끌면 데크가 포인터를 따라오는가, (2) 놓으면 localStorage(oprn:ai-deck-pos)에
 * 저장되고 새로고침 뒤 복원되는가, (3) 접으면 알약이 같은 자리에 서는가, (4) 패널 가장자리 밖으로
 * 못 나가는가, (5) 레일 더블클릭이 기본 위치로 되돌리는가, (6) 1px 지터 클릭이 위치를 굳히지
 * 않는가, (7) 드래그 중 창이 초점을 잃어도(창 밖 릴리스) 그 자리에서 끝나고 저장되는가,
 * (8) 전체 기록(도킹) 상태에서 커서·힌트가 「끌 수 없음」을 말하는가 — 를 실측한다.
 *
 * (7) 의 blur 는 합성 이벤트(`window.dispatchEvent(new Event("blur"))`)다 — OS 창 전환은 헤드리스에서
 * 만들 수 없으므로, 그 릴리스 경로가 도는지만 본다. 유닛 테스트가 같은 경로를 고정한다.
 *
 * Usage:
 *   RPG_ZZU_URL=http://127.0.0.1:9841 node scripts/qa/assistant-deck-move-qa.mjs --label after
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9841";
const label = (() => {
  const i = process.argv.indexOf("--label");
  return i > 0 ? process.argv[i + 1] : "run";
})();
const OUT = process.env.QA_OUT ?? "output/evidence/assistant-deck-move";
const POS_KEY = "oprn:ai-deck-pos";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("dialog", (d) => d.accept());
await mkdir(OUT, { recursive: true });

const shot = async (name) => {
  const file = path.join(OUT, `${label}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
};

const failures = [];
const check = (name, ok, detail) => {
  if (!ok) failures.push({ name, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}`, detail ?? "");
};

/** 데크·레일·패널 사각형과 위치 변수를 한 번에 읽는다. */
const probe = () =>
  page.evaluate((key) => {
    const panel = document.querySelector('[data-testid="ai-panel"]');
    const deck = document.querySelector('[data-testid="ai-deck"]');
    const rail = document.querySelector('[data-testid="ai-deck-rail"]');
    const pill = document.querySelector('[data-testid="ai-collapsed-restore"]');
    const box = (el) => {
      const r = el?.getBoundingClientRect();
      return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
    };
    const hitAt = (x, y) => {
      const el = document.elementFromPoint(Math.round(x), Math.round(y));
      return el ? (el.closest("[data-testid]")?.dataset?.testid ?? el.className?.toString?.().slice(0, 60) ?? el.tagName) : null;
    };
    return {
      panel: box(panel),
      deck: box(deck),
      rail: box(rail),
      pill: box(pill),
      right: panel?.style.getPropertyValue("--ai-deck-right") || null,
      bottom: panel?.style.getPropertyValue("--ai-deck-bottom") || null,
      stored: localStorage.getItem(key),
      isDragging: panel?.classList.contains("is-dragging") ?? null,
      collapsed: panel?.classList.contains("is-collapsed") ?? null,
      bodyCursor: document.body.style.cursor || "",
      railHit: rail ? hitAt(rail.getBoundingClientRect().x + rail.getBoundingClientRect().width * 0.4, rail.getBoundingClientRect().y + 6) : null,
      railCursor: rail ? getComputedStyle(rail).cursor : null,
      railHint: rail?.querySelector(".ai-deck-rail-who")?.getAttribute("title") ?? null,
      deckDisplay: deck ? getComputedStyle(deck).display : null,
    };
  }, POS_KEY);

await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
// 로그인 게이트가 열리면 게스트로 들어간다 — 세션 쿠키 유무에 따라 부팅 경로가 갈린다.
const guest = page.getByTestId("login-guest");
if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
for (let attempt = 0; attempt < 3; attempt += 1) {
  const ok = await page
    .getByTestId("edit-canvas")
    .waitFor({ state: "visible", timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (ok) break;
  console.log("boot retry", attempt + 1);
  await page.reload({ waitUntil: "domcontentloaded" });
}
await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 20_000 });
await page.waitForTimeout(1200);

const report = { label, base: BASE, at: new Date().toISOString(), steps: {}, consoleErrors: [] };

// 1. 기본 위치: 저장값·변수 없이 우하단.
{
  const p = await probe();
  report.steps.default = p;
  check("기본 위치는 저장 변수 없이 우하단", p.right === null && p.bottom === null && p.stored === null, JSON.stringify({ right: p.right, bottom: p.bottom }));
  const nearCorner = p.deck && p.panel && p.panel.x + p.panel.w - (p.deck.x + p.deck.w) < 40 && p.panel.y + p.panel.h - (p.deck.y + p.deck.h) < 40;
  check("기본 데크는 패널 우하단에 붙어 있다", Boolean(nearCorner), `deck=${JSON.stringify(p.deck)}`);
  await shot("01-default");
}

// 2. 레일 드래그 — state 슬롯(버튼 아님)에서 잡아 왼쪽 위로 옮긴다.
{
  const p0 = await probe();
  const gx = p0.rail.x + p0.rail.w * 0.4;
  const gy = p0.rail.y + 6;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx - 300, gy - 180, { steps: 5 });
  const mid = await probe();
  check("드래그 중 is-dragging + grabbing 커서", mid.isDragging === true && mid.bodyCursor === "grabbing", `dragging=${mid.isDragging} cursor=${mid.bodyCursor}`);
  await shot("02-dragging");
  await page.mouse.move(gx - 560, gy - 360, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const p1 = await probe();
  report.steps.moved = p1;
  const movedFar = p1.deck && p0.deck && Math.abs(p1.deck.x - p0.deck.x) > 200 && Math.abs(p1.deck.y - p0.deck.y) > 150;
  check("데크가 포인터를 따라 실제로 이동했다", Boolean(movedFar), `${JSON.stringify(p0.deck)} → ${JSON.stringify(p1.deck)}`);
  const stored = p1.stored ? JSON.parse(p1.stored) : null;
  check("놓는 순간 oprn:ai-deck-pos 에 저장된다", Boolean(stored && stored.right > 400 && stored.bottom > 300), `stored=${p1.stored}`);
  check("새 자리에서 레일 히트테스트가 산다", p1.railHit !== null && p1.railHit !== "edit-canvas", `hit=${p1.railHit}`);
  await shot("03-moved");
}

// 3. 가장자리 밖으로 못 나간다 — 왼쪽 위 끝까지 끌어도 데크 전체가 패널 안.
{
  const p0 = await probe();
  const gx = p0.rail.x + p0.rail.w * 0.4;
  const gy = p0.rail.y + 6;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(-2000, -2000, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const p1 = await probe();
  report.steps.clamped = p1;
  const inside = p1.deck && p1.panel && p1.deck.x >= p1.panel.x - 1 && p1.deck.y >= p1.panel.y - 1;
  check("패널 밖으로 못 끌어간다 — 왼쪽·위 가장자리에 멈춘다", Boolean(inside), `deck=${JSON.stringify(p1.deck)} panel=${JSON.stringify(p1.panel)}`);
  await shot("04-clamped-corner");
}

// 4. 새로고침 복원.
{
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(1500);
  const p = await probe();
  report.steps.reloaded = p;
  const stored = p.stored ? JSON.parse(p.stored) : null;
  const restored = stored && Math.abs(p.deck.x + p.deck.w - (p.panel.x + p.panel.w) + stored.right) < 8;
  check("새로고침 뒤 저장 위치로 복원된다", Boolean(restored), `stored=${p.stored} deckRightGap=${p.deck && p.panel ? Math.round(p.panel.x + p.panel.w - p.deck.x - p.deck.w) : "?"}`);
  await shot("05-reloaded");
}

// 5. 접기 — 알약이 데크가 있던 그 자리(호스트 오른쪽·아래 변 기준 같은 오프셋)에 선다.
{
  const before = await probe();
  // 접히면 패널 자체가 알약 상자로 줄어든다 — 비교 기준(호스트 우·하 변)은 펼친 채 잡아 둔다.
  const hostRight = before.panel.x + before.panel.w;
  const hostBottom = before.panel.y + before.panel.h;
  const collapse = page.getByTestId("ai-collapse");
  await collapse.click();
  await page.waitForTimeout(400);
  const p = await probe();
  report.steps.collapsed = p;
  const vars = { right: parseFloat(p.right ?? "NaN"), bottom: parseFloat(p.bottom ?? "NaN") };
  const pillRightGap = p.pill ? hostRight - (p.pill.x + p.pill.w) : NaN;
  const pillBottomGap = p.pill ? hostBottom - (p.pill.y + p.pill.h) : NaN;
  const sameSpot =
    Number.isFinite(vars.right) &&
    Math.abs(pillRightGap - vars.right) < 8 &&
    Math.abs(pillBottomGap - vars.bottom) < 8;
  check("접힘 알약은 데크가 있던 자리에 선다", Boolean(p.collapsed && sameSpot), `pillGap=${JSON.stringify({ right: Math.round(pillRightGap), bottom: Math.round(pillBottomGap) })} vars=${JSON.stringify(vars)}`);
  await shot("06-collapsed-pill");
  await page.getByTestId("ai-collapsed-restore").click();
  await page.waitForTimeout(400);
}

// 6. 레일 더블클릭 → 기본 위치.
{
  const p0 = await probe();
  const gx = p0.rail.x + p0.rail.w * 0.4;
  const gy = p0.rail.y + 6;
  await page.mouse.dblclick(gx, gy);
  await page.waitForTimeout(300);
  const p1 = await probe();
  report.steps.reset = p1;
  check("더블클릭은 저장 위치를 지우고 기본 우하단으로 돌아온다", p1.stored === null && p1.right === null && p1.bottom === null, `stored=${p1.stored} right=${p1.right}`);
  await shot("07-reset");
}

// 7. 1px 지터 클릭 — 드래그가 아니므로 아무것도 저장하지 않는다.
{
  const p0 = await probe();
  const gx = p0.rail.x + p0.rail.w * 0.4;
  const gy = p0.rail.y + 6;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + 1, gy + 1);
  const mid = await probe();
  await page.mouse.up();
  await page.waitForTimeout(250);
  const p1 = await probe();
  report.steps.jitterClick = { mid, after: p1 };
  check("1px 클릭은 드래그를 열지 않는다", mid.isDragging === false && mid.right === null, `dragging=${mid.isDragging} right=${mid.right}`);
  check("1px 클릭은 위치를 저장하지 않는다", p1.stored === null && p1.right === null, `stored=${p1.stored} right=${p1.right}`);
  await shot("08-jitter-click");
}

// 8. 드래그 중 창이 초점을 잃으면(창 밖 릴리스·Alt-Tab) 그 자리에서 끝나고 저장된다.
{
  const p0 = await probe();
  const gx = p0.rail.x + p0.rail.w * 0.4;
  const gy = p0.rail.y + 6;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx - 300, gy - 180, { steps: 4 });
  const mid = await probe();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(250);
  const p1 = await probe();
  const stored = p1.stored ? JSON.parse(p1.stored) : null;
  const liveRight = Number(String(mid.right ?? "").replace("px", ""));
  report.steps.blurRelease = { mid, after: p1 };
  check("blur 는 드래그 상태와 grabbing 커서를 내린다", p1.isDragging === false && p1.bodyCursor === "", `dragging=${p1.isDragging} cursor=${p1.bodyCursor}`);
  check(
    "blur 는 눈에 보이던 자리를 저장한다",
    Boolean(mid.isDragging && stored && Math.abs(liveRight - stored.right) <= 1),
    `midRight=${mid.right} stored=${p1.stored}`,
  );
  await page.mouse.up().catch(() => undefined);
  await page.waitForTimeout(200);
  await shot("09-blur-release");
}

// 9. 전체 기록(도킹)에서는 데크가 보여도 끌 수 없다 — 커서·힌트가 그 사실을 말해야 한다.
{
  await page.evaluate(() => document.querySelector('[data-testid="ai-panel"]').classList.add("is-history-open", "is-docked"));
  await page.mouse.move(600, 400);
  await page.waitForTimeout(150);
  const p0 = await probe();
  const gx = p0.rail.x + p0.rail.w * 0.4;
  const gy = p0.rail.y + 6;
  await page.mouse.move(gx, gy);
  await page.waitForTimeout(150);
  const hovered = await probe();
  await page.mouse.down();
  await page.mouse.move(gx - 200, gy - 120, { steps: 4 });
  const mid = await probe();
  await page.mouse.up();
  await page.waitForTimeout(200);
  const p1 = await probe();
  report.steps.dockedState = { visible: p0, hovered, mid, after: p1 };
  check("도킹 상태에서도 데크는 보인다 — 신호만 걷어야 한다", p0.deckDisplay === "flex" && Boolean(p0.deck && p0.deck.h > 200), `display=${p0.deckDisplay} h=${p0.deck?.h}`);
  check("도킹 상태의 레일 커서는 grab 이 아니다", hovered.railCursor !== "grab", `cursor=${hovered.railCursor}`);
  check("도킹 상태에서는 드래그 힌트가 사라진다", hovered.railHint === "", `hint=${hovered.railHint}`);
  check("도킹 상태에서 끌어도 데크는 움직이지 않는다", mid.isDragging === false && mid.right === p0.right, `dragging=${mid.isDragging} right=${p0.right}→${mid.right}`);
  await page.evaluate(() => document.querySelector('[data-testid="ai-panel"]').classList.remove("is-history-open", "is-docked"));
  await page.waitForTimeout(300);
  await shot("10-docked-not-draggable");
}

report.consoleErrors = consoleErrors.slice(0, 20);
const jsonFile = path.join(OUT, `${label}-measure.json`);
await writeFile(jsonFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await browser.close();
console.log("\nwrote", jsonFile);
if (failures.length > 0) {
  console.error(`\n${failures.length}건 실패:`);
  for (const f of failures) console.error(`  ✗ ${f.name} — ${f.detail}`);
  process.exit(1);
}
console.log("\n모든 검사 통과");
