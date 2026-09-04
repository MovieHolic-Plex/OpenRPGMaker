// scripts/capture-world-bible.mjs
// 자료집 「세계관」 그룹(이 세계 · 설정집) 브라우저 증거. 빈 상태 → 저작 → 설정집 항목 추가 → 개요 카드.
//
//   CAPTURE_BASE=http://127.0.0.1:9841 node scripts/capture-world-bible.mjs verify-shots/world-bible/before
//
// 스크린샷 외에 layout.json 을 남긴다 — 설정집 임베드가 .db-body 안에서 이중 스크롤을 만드는지,
// 이 세계 폼의 컨트롤이 워크스페이스 밖으로 새는지를 숫자로 적어 사람이 눈으로 재지 않게 한다.
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "/home/main/z-project/rpg-zzu/node_modules/playwright/index.mjs";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const BASE = process.env.CAPTURE_BASE ?? "http://127.0.0.1:9841";
const OUT = process.argv[2] ?? "verify-shots/world-bible/run";
const ONBOARDING_KEYS = [
  "oprn:coachmarks-basic-v1",
  "oprn:standard-welcome-seen",
  "oprn:editor-welcome-dismissed",
  "oprn:db-dock-mode",
  "oprn:database.activeTab",
  "oprn:database.collapsedTabGroups",
];

const errors = [];
const layout = {};

async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`[shot] ${path}`);
}

async function dismiss(page) {
  // 게스트 로그인 게이트가 보이면 통과한다 (워크트리 localStorage 상태에 따라 다름).
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) {
    await guest.click();
    await page.getByTestId("login-modal").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  }
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 60_000 });
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}

async function openTab(page, testid) {
  const button = page.getByTestId(testid);
  if (!(await button.isVisible().catch(() => false))) {
    // 접힌 그룹 안에 있으면 보인다 — 세계관 탭은 lore 그룹에 산다.
    const group = page.getByTestId("db-tab-group-lore");
    if (await group.isVisible().catch(() => false)) await group.click();
  }
  await button.click({ force: true });
  await page.waitForTimeout(150);
}

async function measure(page, key) {
  layout[key] = await page.evaluate(() => {
    const body = document.querySelector(".db-body");
    const win = document.querySelector(".database-modal-window");
    const first = body?.firstElementChild;
    const overflowing = [];
    if (body) {
      const bb = body.getBoundingClientRect();
      for (const node of body.querySelectorAll("input, textarea, select, button")) {
        const r = node.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > bb.right + 1 || r.left < bb.left - 1) overflowing.push(node.dataset.testid ?? node.className);
      }
    }
    return {
      window: win ? { w: Math.round(win.getBoundingClientRect().width), h: Math.round(win.getBoundingClientRect().height) } : null,
      body: body ? { clientH: body.clientHeight, scrollH: body.scrollHeight } : null,
      firstChild: first ? { cls: first.className, clientH: first.clientHeight, scrollH: first.scrollHeight } : null,
      nestedScrollers: body
        ? Array.from(body.querySelectorAll("*")).filter((n) => {
          const s = getComputedStyle(n);
          return /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1;
        }).map((n) => `${n.tagName.toLowerCase()}.${String(n.className).split(" ")[0]}`).slice(0, 12)
        : [],
      overflowing,
    };
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error" && !msg.text().includes("ERR_CONNECTION_REFUSED")) errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));
await page.addInitScript((keys) => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  for (const key of keys) localStorage.removeItem(key);
}, ONBOARDING_KEYS);

try {
  await mkdir(OUT, { recursive: true });
  // dev 서버 HMR 모듈 로딩은 호스트 네트워크 변동(ERR_NETWORK_CHANGED)에 약하다 —
  // testid 가 붙을 때까지 내비게이션을 다시 건다. 브라우저 탭 새로고침과 같은 대응이다.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await gotoWithRetry(page, `${BASE}/?freshProject=1`);
    } catch (error) {
      console.log(`[nav] attempt ${attempt} failed: ${String(error).slice(0, 120)}`);
    }
    await page.waitForTimeout(6000);
    const count = await page.evaluate(() => document.querySelectorAll("[data-testid]").length);
    if (count > 50) break;
    console.log(`[nav] attempt ${attempt} testids=${count}, retrying`);
  }
  await dismiss(page);

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  await openTab(page, "db-tab-world-canon");
  await measure(page, "canon-empty");
  await shot(page, "01-canon-empty");

  await page.getByTestId("db-world-canon-name").fill("서녘 공화국");
  await page.getByTestId("db-world-canon-premise").fill("마법은 피의 대가다. 왕위는 비어 있고 다섯 상단이 도시를 나눠 가졌다.");
  await page.getByTestId("db-world-canon-tone-grim").click();
  await page.getByTestId("db-world-canon-tone-political").click();
  await page.getByTestId("db-world-canon-absence-input").fill("총");
  await page.getByTestId("db-world-canon-absence-add").click();
  await page.getByTestId("db-world-canon-absence-input").fill("엘프");
  await page.getByTestId("db-world-canon-absence-add").click();
  await page.getByTestId("db-world-canon-body").fill([
    "## 역사",
    "- 대붕괴(0년): 옛 왕국이 하룻밤에 가라앉았다.",
    "- 상단 시대(120년~): 다섯 상단이 항구를 나눠 가진다.",
    "",
    "## 금기",
    "피를 대가로 하지 않는 마법은 **사기**다.",
  ].join("\n"));
  const preview = page.getByTestId("db-world-canon-preview-toggle");
  if (await preview.isVisible().catch(() => false)) await preview.click();
  await measure(page, "canon-filled");
  await shot(page, "02-canon-filled");

  await openTab(page, "db-tab-world-codex");
  await measure(page, "codex-empty");
  await shot(page, "03-codex-empty");

  await page.getByTestId("world-add-entity").click();
  await page.getByTestId("world-edit-name").fill("아린");
  await page.getByTestId("world-edit-summary").fill("잿불을 지키는 마지막 수호자");
  await page.getByTestId("world-edit-body").fill("어릴 적 대붕괴에서 살아남았다. 총을 본 적이 없다.");
  await page.getByTestId("world-edit-save").click();
  await page.waitForTimeout(200);
  await measure(page, "codex-filled");
  await shot(page, "04-codex-filled");

  await openTab(page, "db-tab-overview");
  await page.getByTestId("db-overview-canon").waitFor({ state: "visible" });
  await shot(page, "05-overview-canon-card");

  await writeFile(`${OUT}/layout.json`, JSON.stringify({ base: BASE, errors, layout }, null, 2));
  console.log(`[layout] ${OUT}/layout.json errors=${errors.length}`);
} finally {
  await browser.close();
}
