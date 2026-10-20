#!/usr/bin/env node
// 첫 화면 「라이브러리 홈」(2026-10-20 A안) 웹 캡처 — dev 서버의 start-screen.html 에 가짜 window.oprn.start 를 꽂아 찍는다.
// 사용: node scripts/qa/home-redesign-capture.mjs --base http://127.0.0.1:9781 --out verify-shots/home-redesign
// 상태: normal(최근 게임 8개) · first(처음 켠 상태) · settings(?localAgentsMock=1 의 AI 엔진 창, 고르기 전/고른 뒤) · en(영어) — 각 1920×1080, 2560×1440.
// 카드 그림은 실제 표지 대신 같은 규격(480×270)의 번들 장소 그림을 쓴다(웹에는 데스크톱 표지 캐시가 없다).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg("base", "http://127.0.0.1:9781");
const OUT = arg("out", "verify-shots/home-redesign");
mkdirSync(OUT, { recursive: true });

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const S = "/assets/start/stages/";
const ENTRIES = [
  { projectDir: "/games/joseon", title: "바람의 고을", updatedAt: day(0.02), cover: S + "joseon-town.png", mapCount: 6 },
  { projectDir: "/games/tokyo", title: "도쿄 골목 탐정", updatedAt: day(1), cover: S + "jp-shopstreet.png", mapCount: 4 },
  { projectDir: "/games/wizard", title: "마법 학교 첫 학기", updatedAt: day(3), cover: S + "wz-library.png", mapCount: 9 },
  { projectDir: "/games/new-a", title: "새 게임", updatedAt: "2026-10-12T10:00:00Z", cover: null, mapCount: 1 },
  { projectDir: "/games/new-b", title: "새 게임", updatedAt: "2026-10-08T10:00:00Z", cover: S + "jp-tram.png", mapCount: 2 },
  { projectDir: "/games/palace", title: "궁궐의 밤", updatedAt: day(20), cover: S + "joseon-palace.png", mapCount: 3 },
  { projectDir: "/games/school", title: "방과 후 옥상", updatedAt: day(30), cover: S + "jp-school.png", mapCount: 5 },
  { projectDir: "/games/potion", title: "물약 공방", updatedAt: day(41), cover: S + "wz-potions.png", mapCount: 2 },
];

const STATES = [
  { id: "normal", entries: ENTRIES, query: "" },
  { id: "first", entries: [], query: "" },
  { id: "settings", entries: ENTRIES, query: "?localAgentsMock=1", settings: true },
  { id: "settings-chosen", entries: ENTRIES, query: "?localAgentsMock=1", settings: true, engine: { kind: "local-cli", cli: "claude", routineModel: "sonnet", deepModel: "opus", effort: "medium" } },
  { id: "en", entries: ENTRIES, query: "?lang=en" },
];
const SIZES = [[1920, 1080], [2560, 1440]];

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  for (const [width, height] of SIZES) {
    for (const state of STATES) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.addInitScript((engine) => {
        if (engine) localStorage.setItem("oprn:assistant-engine", JSON.stringify(engine));
        else localStorage.removeItem("oprn:assistant-engine");
      }, state.engine ?? null);
      await page.addInitScript((entries) => {
        const origin = location.origin;
        const abs = (entry) => ({ ...entry, cover: entry.cover ? origin + entry.cover : null, coverEmpty: !entry.cover });
        window.oprn = { start: {
          recentProjects: async () => entries.map(abs),
          openFolder: async () => null, openRecent: async () => null, createProject: async () => null,
          recentTeams: async () => [],
        } };
      }, state.entries);
      await page.goto(`${BASE}/start-screen.html${state.query}`, { waitUntil: "load" });
      await page.waitForSelector("[data-testid='start-hero']", { timeout: 60000 });
      await page.waitForTimeout(2500);
      if (state.settings) {
        await page.click("[data-testid='start-ai-status']");
        await page.waitForSelector("[data-testid='start-settings']", { timeout: 20000 });
        await page.waitForTimeout(800);
      }
      const file = `${OUT}/${state.id}-${width}.png`;
      await page.screenshot({ path: file });
      console.log(file, errors.length ? `pageerror ${errors.join(" | ")}` : "ok");
      await page.close();
    }
  }
} finally {
  await browser.close();
}
