#!/usr/bin/env node
// 첫 화면 레일 단추 상태 행렬 — 칸 바꾸기가 깨끗한지(2026-10-21, 사용자 신고 「왼쪽 버튼 누르면 상태 관리 엉망」).
// dev 서버의 start-screen.html 에 가짜 window.oprn.start 를 꽂고, 레일 단추를 모든 순서쌍(A→B, A→B→A)으로 눌러
// 매번 같은 불변식을 확인한다. vitest 가 아니다 — 가볍게 직접 돌리는 클릭 스크립트.
//
// 사용: node scripts/qa/start-screen-nav.mjs --base http://127.0.0.1:9816 [--out verify-shots/start-screen-ux/after]
// 종료 코드: 실패가 하나라도 있으면 1.
//
// 불변식(칸마다): 레일 표시 = 누른 칸 · aria-current 는 하나 · 본문에 그 칸의 표식 · 스크롤 맨 위 ·
//   새로 만들기 밖에서는 컨셉 상세·골라서 만들기 창이 없다 · 새로 만들기에 들어오면 검색어가 비어 있고 피드가 보인다.
// 시나리오: 상세 → 다른 칸 → 돌아오기 · 검색어 → 다른 칸 → 돌아오기 · 같은 칸 다시 누르기 · 연타(A→B→A, 0ms) ·
//   팀에 참여 단추 없음(2026-10-21 팀 협업 접힘) · 뒤로 가기(history) · 최근 목록이 늦게 와도 지금 칸을 덮지 않음.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg("base", "http://127.0.0.1:9816");
const OUT = arg("out", null);
if (OUT) mkdirSync(OUT, { recursive: true });

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const S = "/assets/start/stages/";
const ENTRIES = [
  { projectDir: "/games/joseon", title: "바람의 고을", updatedAt: day(0.02), cover: S + "joseon-town.png", mapCount: 6 },
  { projectDir: "/games/tokyo", title: "도쿄 골목 탐정", updatedAt: day(1), cover: S + "jp-shopstreet.png", mapCount: 4 },
  { projectDir: "/games/wizard", title: "마법 학교 첫 학기", updatedAt: day(3), cover: S + "wz-library.png", mapCount: 9 },
  { projectDir: "/games/palace", title: "궁궐의 밤", updatedAt: day(20), cover: S + "joseon-palace.png", mapCount: 3 },
  { projectDir: "/games/school", title: "방과 후 옥상", updatedAt: day(30), cover: S + "jp-school.png", mapCount: 5 },
  { projectDir: "/games/potion", title: "물약 공방", updatedAt: day(41), cover: S + "wz-potions.png", mapCount: 2 },
];
const NAVS = ["home", "games", "builtin", "create"];
/** 칸마다 본문에 있어야 하는 표식. */
const MARK = {
  home: "[data-testid='start-home-concepts']",
  games: "[data-testid='start-my-games']",
  builtin: "[data-testid='start-builtin-demos']",
  create: "[data-testid='concept-feed']",
  join: "[data-testid='start-join-input']",
};

const failures = [];
let checks = 0;
const fail = (label, message) => { failures.push(`${label}: ${message}`); console.log(`  FAIL ${label}: ${message}`); };

async function openPage(browser, { entriesDelayMs = 300, entries = ENTRIES } = {}) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(({ entries, delay }) => {
    const origin = location.origin;
    window.oprn = { start: {
      recentProjects: async () => { await new Promise((r) => setTimeout(r, delay)); return entries.map((e) => ({ ...e, cover: origin + e.cover })); },
      openFolder: async () => null, openRecent: async () => null, createProject: async () => null, recentTeams: async () => [],
    } };
  }, { entries, delay: entriesDelayMs });
  await page.goto(`${BASE}/start-screen.html`, { waitUntil: "load" });
  await page.waitForSelector("[data-testid='start-nav-home']", { timeout: 60000 });
  return { page, errors };
}

async function probe(page) {
  return page.evaluate((MARK) => {
    const current = [...document.querySelectorAll("[data-testid='start-rail'] [aria-current='page']")];
    const body = document.querySelector("[data-testid='start-body']");
    const scroller = body?.querySelector(".ln-scroll, .cf-body");
    const detail = document.querySelector("[data-testid='concept-detail']");
    const feedRoot = document.querySelector("[data-testid='concept-feed']");
    const search = document.querySelector("[data-testid='concept-feed-search']");
    const marks = Object.fromEntries(Object.entries(MARK).map(([k, sel]) => [k, !!body?.querySelector(sel)]));
    return {
      view: document.getElementById("start-app")?.dataset.view ?? null,
      active: current.map((b) => b.getAttribute("data-nav")),
      scrollTop: scroller ? Math.round(scroller.scrollTop) : 0,
      detailOpen: !!(detail && !detail.hidden && body?.contains(detail)),
      quickOpen: !!document.querySelector("[data-testid='quick-interview']"),
      searchValue: search && body?.contains(search.closest(".cf-search") ?? search) ? search.value : (document.querySelector("[data-testid='start-top'] [data-testid='concept-feed-search']")?.value ?? null),
      feedMounted: !!(feedRoot && body?.contains(feedRoot)),
      marks,
      hash: location.hash,
    };
  }, MARK);
}

async function expectSection(page, label, section, extra = {}) {
  checks += 1;
  const s = await probe(page);
  if (s.view !== section) fail(label, `view=${s.view} (기대 ${section})`);
  const wantActive = section === "join" ? [] : [section];
  if (JSON.stringify(s.active) !== JSON.stringify(wantActive)) fail(label, `레일 표시=${JSON.stringify(s.active)} (기대 ${JSON.stringify(wantActive)})`);
  if (!s.marks[section]) fail(label, `본문에 ${section} 표식이 없다`);
  for (const [other, present] of Object.entries(s.marks)) if (other !== section && present) fail(label, `본문에 다른 칸(${other}) 표식이 남았다`);
  if (s.hash !== `#${section}`) fail(label, `주소 해시=${s.hash}`);
  if (section !== "create" && (s.detailOpen || s.quickOpen)) fail(label, "새로 만들기 밖인데 상세/골라서 만들기 창이 열려 있다");
  if (extra.top !== false && s.scrollTop !== 0) fail(label, `스크롤=${s.scrollTop} (맨 위가 아님)`);
  if (section === "create" && extra.fresh !== false) {
    if (s.detailOpen) fail(label, "새로 만들기에 들어왔는데 앞 상세가 남았다");
    if (s.searchValue) fail(label, `새로 만들기에 들어왔는데 앞 검색어 「${s.searchValue}」가 남았다`);
  }
  return s;
}

const nav = (page, id) => page.click(`[data-testid='start-nav-${id}']`);
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` }); };

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const { page, errors } = await openPage(browser);
  await page.waitForSelector("[data-testid='start-hero']:not(.is-loading)", { timeout: 30000 });
  await page.waitForSelector("[data-testid='start-home-concept']", { timeout: 30000 });
  await expectSection(page, "처음", "home");
  await shot(page, "home");

  console.log("· 모든 순서쌍 A→B (바로 확인, 기다리지 않음)");
  for (const a of NAVS) for (const b of NAVS) {
    await nav(page, a); await nav(page, b);
    await expectSection(page, `${a}→${b}`, b);
  }
  console.log("· 연타 A→B→A (0ms)");
  for (const a of NAVS) for (const b of NAVS) {
    if (a === b) continue;
    await nav(page, a); await nav(page, b); await nav(page, a);
    await expectSection(page, `${a}→${b}→${a}`, a);
  }
  for (const id of NAVS) { await nav(page, id); await page.waitForTimeout(400); await shot(page, `nav-${id}`); }

  console.log("· 스크롤한 뒤 다른 칸 → 돌아오면 맨 위");
  await nav(page, "create"); await page.waitForSelector("[data-testid='concept-feed-card']");
  await page.locator("[data-testid='start-body'] .cf-body").evaluate((e) => { e.scrollTop = 900; });
  await nav(page, "home"); await expectSection(page, "스크롤 create→home", "home");
  await nav(page, "create"); await expectSection(page, "스크롤 home→create", "create");

  console.log("· 컨셉 상세 → 다른 칸 → 새로 만들기");
  await page.locator("[data-testid='concept-feed-card']").first().click();
  await page.waitForSelector("[data-testid='concept-detail-make']");
  await expectSection(page, "상세 열림", "create", { fresh: false });
  await shot(page, "create-detail");
  await nav(page, "builtin"); await expectSection(page, "상세→기본 게임", "builtin");
  await nav(page, "create"); await expectSection(page, "기본 게임→새로 만들기(상세 비움)", "create");

  console.log("· 같은 칸 다시 누르기 = 그 칸 처음으로");
  await page.locator("[data-testid='concept-feed-card']").first().click();
  await page.waitForSelector("[data-testid='concept-detail-make']");
  await nav(page, "create"); await expectSection(page, "상세에서 새로 만들기 다시", "create");

  console.log("· 검색어 → 다른 칸 → 새로 만들기");
  await page.fill("[data-testid='concept-feed-search']", "용사");
  await page.waitForTimeout(400);
  await nav(page, "games"); await expectSection(page, "검색→내 게임", "games");
  await nav(page, "create"); await expectSection(page, "내 게임→새로 만들기(검색 비움)", "create");

  console.log("· 골라서 만들기 창 → Esc → 다른 칸");
  await page.click("[data-testid='concept-feed-quick-start']");
  await page.waitForSelector("[data-testid='quick-interview']");
  await page.keyboard.press("Escape");
  await nav(page, "home"); await expectSection(page, "골라서 만들기 닫고 홈", "home");

  console.log("· 홈 카드 → 그 컨셉 상세");
  await page.locator("[data-testid='start-home-concept']").first().click();
  await page.waitForSelector("[data-testid='concept-detail-make']");
  await expectSection(page, "홈 컨셉 카드", "create", { fresh: false });
  if (!(await probe(page)).detailOpen) fail("홈 컨셉 카드", "상세가 열리지 않았다");

  console.log("· 홈 「모두 보기」 링크");
  await nav(page, "home");
  await page.click("[data-testid='start-home-recent-more']"); await expectSection(page, "최근 게임 모두 보기", "games");
  await nav(page, "home");
  await page.click("[data-testid='start-home-concepts-more']"); await expectSection(page, "컨셉 모두 보기", "create");
  await nav(page, "home");
  await page.click("[data-testid='start-home-builtin-more']"); await expectSection(page, "기본 게임 자세히", "builtin");

  // 2026-10-21: 사람 팀 협업을 접었다(electron/shared/teamCollab.ts TEAM_COLLAB_ENABLED=false). 단추가 없어야 한다.
  console.log("· 팀에 참여 단추 없음(팀 협업 접힘)");
  if (await page.$("[data-testid='start-join-team']")) fail("팀에 참여", "팀 협업을 접었는데 단추가 보인다");

  console.log("· 뒤로 가기(마우스 뒤로 단추)");
  await nav(page, "home"); await nav(page, "builtin"); await nav(page, "create");
  await page.goBack(); await expectSection(page, "뒤로 1", "builtin");
  await page.goBack(); await expectSection(page, "뒤로 2", "home");
  await page.goForward(); await expectSection(page, "앞으로", "builtin");

  if (errors.length) fail("페이지 오류", errors.join(" | "));
  await page.close();

  console.log("· 최근 목록이 늦게 와도 지금 칸을 덮지 않음");
  {
    const late = await openPage(browser, { entriesDelayMs: 2500 });
    await nav(late.page, "create");
    await late.page.waitForTimeout(3200);
    await expectSection(late.page, "늦은 목록 동안 새로 만들기", "create");
    await nav(late.page, "home");
    const s = await expectSection(late.page, "늦은 목록 뒤 홈", "home");
    if (!(await late.page.$("[data-testid='start-hero']:not(.is-loading)"))) fail("늦은 목록 뒤 홈", "배너가 아직 불러오는 중");
    void s;
    if (late.errors.length) fail("페이지 오류(늦은 목록)", late.errors.join(" | "));
    await late.page.close();
  }
  console.log("· 처음 켠 상태(게임 없음)");
  {
    const first = await openPage(browser, { entries: [] });
    await first.page.waitForSelector("[data-testid='start-hero']:not(.is-loading)");
    await expectSection(first.page, "처음 켠 홈", "home");
    if (await first.page.$("[data-testid='start-home-recent']")) fail("처음 켠 홈", "게임이 없는데 최근 게임 줄이 있다");
    await shot(first.page, "home-first-run");
    await nav(first.page, "games"); await expectSection(first.page, "처음 켠 내 게임", "games");
    await first.page.click("[data-testid='start-new-game']"); await expectSection(first.page, "첫 게임 만들기 → 새로 만들기", "create");
    await first.page.close();
  }
} catch (error) {
  fail("중단", error instanceof Error ? error.message.split("\n")[0] : String(error));
} finally {
  await browser.close();
}
console.log(`\n${checks}개 확인, 실패 ${failures.length}개`);
process.exit(failures.length ? 1 : 0);
