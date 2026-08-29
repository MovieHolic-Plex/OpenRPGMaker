/**
 * 헤더 용어 통일 + 음악·효과음 / 맵·이벤트 찾기 / AI 설정 현대화 — 실표면 증거 수집.
 *
 * 왜 스크립트인가: 이 네 표면의 "실제로 작동한다" 는 단정이 단위 테스트로는 증명되지 않는다.
 * 슬라이더가 HTMLAudioElement 에 닿는지, 검색 결과 클릭이 편집기 맵을 바꾸는지는 실제 브라우저에서
 * 값을 읽어야 안다. 그래서 각 축마다 화면 캡처 + `page.evaluate` 실측값을 함께 남긴다.
 *
 * 사용:
 *   npm run dev:worktree            # 이 워크트리의 dev 서버 (DEV_SERVER_PORT)
 *   node scripts/qa-header-unify-evidence.mjs
 *
 * 산출물: output/evidence/header-unify/*.png + summary.json (판정 포함)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9841";
const BASE = process.env.RPG_ZZU_URL ?? `http://127.0.0.1:${PORT}/`;
const OUT = path.resolve("output/evidence/header-unify");
fs.mkdirSync(OUT, { recursive: true });

/** 폐기된 용어 — 헤더 어디에도 남아 있으면 안 된다. */
const RETIRED = ["자료 보관함", "시연 실행", "음악/효과음"];
/** 레이어 의미의 하위/상위는 정확히 그 낱말일 때만 잡는다("하위 조건" 같은 일반 한국어는 무관). */
const RETIRED_EXACT = ["하위", "상위", "자료"];

const findings = {};
const failures = [];

function record(name, ok, detail) {
  findings[name] = { ok, ...detail };
  if (!ok) failures.push(`${name}: ${JSON.stringify(detail)}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(45_000);
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
});
await page.goto(`${BASE}?freshProject=1&cb=${Date.now()}`, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForSelector("[data-testid='oprn-menu-bar']", { timeout: 60_000 });
await page.waitForTimeout(1200);

// ── C1: 헤더 용어 ────────────────────────────────────────────────────────────
// 톱바 영역의 모든 사용자 가시 문구(텍스트 · title · aria-label)를 수집한다. 메뉴 팝업은
// 열어야 DOM 에 붙으므로 4개 메뉴를 차례로 열어 그때마다 수집한다.
const menuIds = ["menu-project", "menu-tools", "menu-game", "menu-help"];
const headerStrings = new Set();

async function collectHeaderStrings() {
  const picked = await page.evaluate(() => {
    const out = [];
    const roots = [
      document.querySelector("[data-testid='oprn-menu-bar']"),
      document.querySelector("[data-testid='oprn-toolbar']"),
      ...Array.from(document.querySelectorAll(".oprn-menu-popup")),
    ].filter(Boolean);
    for (const root of roots) {
      for (const node of root.querySelectorAll("*")) {
        const own = Array.from(node.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .filter(Boolean);
        out.push(...own);
        for (const attr of ["title", "aria-label"]) {
          const v = node.getAttribute?.(attr);
          if (v) out.push(v.trim());
        }
      }
    }
    return out;
  });
  for (const s of picked) headerStrings.add(s);
}

await collectHeaderStrings();
for (const id of menuIds) {
  const trigger = page.getByTestId(id);
  if ((await trigger.count()) === 0) continue;
  await trigger.click();
  await page.waitForTimeout(350);
  await collectHeaderStrings();
  await page.screenshot({ path: path.join(OUT, `c1-${id}.png`) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}
await page.screenshot({ path: path.join(OUT, "c1-topbar.png"), clip: { x: 0, y: 0, width: 1440, height: 130 } });

const all = [...headerStrings];
// 메뉴 항목은 관례상 말줄음표로 끝난다(`자료집...`). 그것은 용어 분열이 아니므로 별개 이름으로
// 세지 않는다 — 버리지 않으면 정본을 제대로 쓴 메뉴까지 위반으로 보고하는 오탄이 난다.
const norm = (s) => s.replace(/[.…]+$/u, "").trim();
const allNorm = all.map(norm);
const retiredHits = [
  ...allNorm.filter((s) => RETIRED.some((bad) => s.includes(bad))),
  ...allNorm.filter((s) => RETIRED_EXACT.includes(s)),
];
record("C1-헤더에-폐기용어-없음", retiredHits.length === 0, { retiredHits, collected: all.length });

// 같은 개념이 한 이름으로만 나타나는지 — 개념별 허용 집합(정본 + 축약)을 넘는 변종을 잡는다.
const CONCEPTS = {
  보관함: { canonical: "리소스 보관함", short: "리소스", probe: /보관함|소재|리소스/ },
  음악: { canonical: "음악·효과음", short: "음악", probe: /음악|효과음/ },
  // 찾기 표면은 둘이다 — 맵·이벤트 찾기(프로젝트 데이터)와 커먼드 팔레트(전역 명령 실행).
  // 팔레트 이름은 terms 노드가 정하므로 여기서는 "맵·이벤트 찾기"와 가려지는 변종(맵/이벤트,
  // 이미 삭제된 스킬을 광고하는 이름)만 위반으로 본다.
  찾기: { canonical: "맵·이벤트 찾기", short: "찾기", probe: /맵[·\/]이벤트|검색|스킬 찾기/ },
  실행: { canonical: "테스트 실행", short: "테스트", probe: /시연|테스트 실행/ },
};
// **expert 모드는 jargonStyle 이 technical 이다** — 이 하네스는 expert 로 부트하므로 정본도
// technical 쪽 값(리소스 보관함/리소스)이다. plain(소재 보관함)으로 적어두면 정본을 제대로 쓴
// 화면을 위반으로 보고하는 오탄이 난다(실제로 난 사고).
// 또 정본을 **포함하는** 설명문은 분열이 아니다 — 작업 런처 힌트 `현재 프로젝트 테스트 실행` 은
// 정본 `테스트 실행` 을 그대로 쓴 것이므로 통과시킨다.
const conceptViolations = {};
for (const [name, spec] of Object.entries(CONCEPTS)) {
  const variants = allNorm.filter(
    (s) => spec.probe.test(s) && s !== spec.canonical && s !== spec.short && !s.includes(spec.canonical)
  );
  if (variants.length) conceptViolations[name] = [...new Set(variants)];
}
record("C1-개념별-이름-단일", Object.keys(conceptViolations).length === 0, { conceptViolations });

// ── C3: 음악·효과음 실동작 ──────────────────────────────────────────────────
await page.getByTestId("toolbar-sound-test").click();
await page.waitForSelector("[data-testid='audio-test-dialog']");
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "c3-audio-open.png") });

const audioTitle = await page
  .locator("[data-testid='audio-test-dialog'] h2")
  .first()
  .textContent();
record("C3-모달-제목-정본", (audioTitle ?? "").trim() === "음악·효과음", { audioTitle });

// 재생 가능한 CC0 항목을 골라 재생한다(첫 항목은 (꺼짐)).
await page.getByTestId("audio-test-option-1").click();
await page.getByTestId("audio-test-play").click();
await page.waitForTimeout(900);

const readState = () =>
  page.evaluate(() => {
    const fn = window.__oprnAudioState;
    const engine = typeof fn === "function" ? fn() : null;
    // 엔진은 재생 엘리먼트를 `data-oprn-audio` 마킹과 함께 DOM 에 등록한다
    // (audioEngine.ts). 그러므로 엔진이 보고하는 값과 **실제 미디어의 값**을 따로 읽어
    // 둘이 갈라지는 지점(= 소리는 그대로인데 필드만 바뀌는 회귀)을 잡을 수 있다.
    const media = document.querySelector("audio[data-oprn-audio]");
    return {
      engine,
      media: media ? { volume: media.volume, playbackRate: media.playbackRate, paused: media.paused } : null,
    };
  });

const beforeSliders = await readState();

// 슬라이더를 실제로 움직인다 — fill 로 값을 넣고 input 이벤트를 발생시킨다.
async function setSlider(testId, value) {
  const input = page.locator(`[data-testid='${testId}'] input[type=range]`);
  await input.evaluate((node, v) => {
    node.value = String(v);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(250);
}

await setSlider("audio-test-volume", 40);
await setSlider("audio-test-tempo", 135);
await setSlider("audio-test-balance", -40);
await setSlider("audio-test-fade", 4);
await page.waitForTimeout(500);
const afterSliders = await readState();
await page.screenshot({ path: path.join(OUT, "c3-audio-sliders.png") });

// 슬라이더 값 → 엔진 값 매핑은 대화상자가 정하는 것이다(audioTestDialog):
//   음량 0..100  → volume  = value / 100
//   템포 50..150 → rate    = value / 100
//   밸런스 -50..50 → pan    = value / 50    ← /100 이 아니다(처음엔 -0.4 를 기대해 오탄이 나왔다)
//   페이드인 0..10초 → fadeInMs = value * 1000
const EXPECT = { volume: 0.4, rate: 1.35, pan: -40 / 50, fadeInMs: 4000 };
const engineAfter = afterSliders.engine;
record("C3-음량이-엔진에-반영", Math.abs((engineAfter?.volume?.bgm ?? -1) - EXPECT.volume) < 0.02, {
  before: beforeSliders.engine?.volume?.bgm,
  after: engineAfter?.volume?.bgm,
  expected: EXPECT.volume,
});
record("C3-템포가-엔진에-반영", Math.abs((engineAfter?.playbackRate ?? -1) - EXPECT.rate) < 0.02, {
  before: beforeSliders.engine?.playbackRate,
  after: engineAfter?.playbackRate,
  expected: EXPECT.rate,
});
record("C3-밸런스가-엔진에-반영", Math.abs((engineAfter?.pan ?? 0) - EXPECT.pan) < 0.02, {
  after: engineAfter?.pan,
  expected: EXPECT.pan,
});
record("C3-페이드인이-엔진에-반영", (engineAfter?.fadeInMs ?? -1) === EXPECT.fadeInMs, {
  after: engineAfter?.fadeInMs,
  expected: EXPECT.fadeInMs,
});
// 엔진 필드에만 잡힐 들어가고 **미디어에는 안 닿는** 회귀를 잡는 교차 검증.
// 엘리먼트를 못 찾으면 그 자실을 사실로 기록한다(몰래 통과시키지 않는다).
const liveMedia = afterSliders.media;
record("C3-엔진값이-실제-미디어에-닿는다", liveMedia !== null
  && Math.abs(liveMedia.playbackRate - EXPECT.rate) < 0.02
  && Math.abs(liveMedia.volume - EXPECT.volume) < 0.05, {
  liveMedia,
  expected: { volume: EXPECT.volume, rate: EXPECT.rate },
  note: liveMedia === null ? "audio[data-oprn-audio] 미발견 — 엔진/미디어 일치를 증명할 수 없다" : undefined,
});

await page.getByTestId("audio-test-stop").click();
await page.waitForTimeout(300);
await page.getByTestId("audio-test-close").click();
await page.waitForTimeout(300);

// ── C4: 맵·이벤트 찾기 실이동 ───────────────────────────────────────────────
const mapNames = await page.evaluate(() => {
  // DEV 전용 훅(src/main.ts). 프로젝트 데이터를 실측해 검색어를 고른다.
  const project = window.__oprnEditorStore?.getCurrent?.() ?? null;
  if (!project) return null;
  return Object.values(project.maps).map((m) => ({ id: m.id, name: m.name }));
});

await page.getByTestId("toolbar-search").click();
await page.waitForSelector("[data-testid='map-event-search-modal']");
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "c4-search-open.png") });

const searchTitle = await page
  .locator("[data-testid='map-event-search-modal'] h2")
  .first()
  .textContent();
record("C4-모달-제목-정본", (searchTitle ?? "").trim() === "맵·이벤트 찾기", { searchTitle });

// 현재 맵은 `?map=<mapId>` 로 URL 에 동기화된다(src/editor/mapUrlSync.ts — editorState 구독 →
// pushState). 이동 성공을 브라우저 주소로 관측한다.
const readMapId = () => page.evaluate(() => new URLSearchParams(location.search).get("map"));
const beforeMapId = await readMapId();

// 맵 이름의 앞 두 글자로 검색한다 — 프로젝트가 무엇이든 맵은 최소 하나 있다.
// 한 축이 없을 때 스토이 예외로 죽으면 다음 축을 아예 재지 못해 증거가 반초리 난다 — 축당 생족시킨다.
const probe = (mapNames?.[0]?.name ?? "").slice(0, 2) || "맵";
let resultCount = 0;
try {
  await page.getByTestId("map-event-search-input").fill(probe, { timeout: 10_000 });
  await page.waitForTimeout(700);
  resultCount = await page.locator("[data-testid^='map-event-search-result-']").count();
  record("C4-결과가-나온다", resultCount > 0, { probe, resultCount, mapNames });
} catch (error) {
  record("C4-결과가-나온다", false, { probe, error: String(error).split("\n")[0], mapNames });
}
await page.screenshot({ path: path.join(OUT, "c4-search-results.png") });

if (resultCount > 0) {
  const rowIsButton = await page
    .locator("[data-testid^='map-event-search-result-']")
    .first()
    .evaluate((n) => n.tagName.toLowerCase());
  record("C4-결과행이-버튼", rowIsButton === "button", { tagName: rowIsButton });

  await page.locator("[data-testid^='map-event-search-result-']").first().click();
  await page.waitForTimeout(900);
  const afterMapId = await readMapId();
  const modalGone = (await page.locator("[data-testid='map-event-search-modal']").count()) === 0;
  await page.screenshot({ path: path.join(OUT, "c4-after-navigate.png") });
  record("C4-클릭이-실제로-이동시킨다", modalGone && afterMapId !== null, {
    beforeMapId,
    afterMapId,
    modalGone,
  });
}

// ── C5: AI 설정 모달 ────────────────────────────────────────────────────────
if ((await page.locator("[data-testid='map-event-search-modal']").count()) > 0) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}
try {
  await page.getByTestId("topbar-ai-settings").click();
  await page.waitForSelector("[data-testid='ai-settings-modal']", { timeout: 20_000 });
  await page.waitForTimeout(500);
} catch (error) {
  record("C5-모달이-열린다", false, { error: String(error).split("\n")[0] });
}
await page.screenshot({ path: path.join(OUT, "c5-ai-settings.png") });

const aiShape = await page.evaluate(() => {
  const root = document.querySelector("[data-testid='ai-settings-modal']");
  if (!root) return null;
  const testids = Array.from(root.querySelectorAll("[data-testid]")).map(
    (n) => n.dataset.testid
  );
  return {
    sections: Array.from(root.querySelectorAll("section, .ai-settings-section")).length,
    descriptions: Array.from(root.querySelectorAll(".ai-settings-help, .ai-config-help, .ai-settings-desc"))
      .length,
    testids,
  };
});
const requiredIds = [
  "ai-config",
  "ai-config-model",
  "ai-config-lite-model",
  "ai-config-maxtokens",
  "ai-config-reasoning",
  "ai-config-agentmode",
  "ai-font-size",
];
const missing = requiredIds.filter((id) => !(aiShape?.testids ?? []).includes(id));
record("C5-설정-계약-유지", missing.length === 0, { missing, found: aiShape?.testids?.length });
record("C5-보이는-설명이-있다", (aiShape?.descriptions ?? 0) > 0, {
  descriptions: aiShape?.descriptions,
  sections: aiShape?.sections,
});

await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// 로컬 동반 AI 서버(기본 :17832)가 이 호스트에 없으면 연결 거부가 당연하게 난다 — 이 변경과
// 무관한 환경 사사이므로 사실로 기록하고 통과/실패 판정에서는 끈다. 그 외의 콘솔 오류는 실패다.
const envRefused = consoleErrors.filter((m) => /ERR_CONNECTION_REFUSED/.test(m));
const realErrors = consoleErrors.filter((m) => !/ERR_CONNECTION_REFUSED/.test(m));
record("콘솔-오류-없음", realErrors.length === 0, {
  realErrors: realErrors.slice(0, 10),
  envRefusedCount: envRefused.length,
  note: "ERR_CONNECTION_REFUSED 는 로컬 동반 AI 서버 부재(환경) — 판정 제외",
});

const summary = { base: BASE, at: new Date().toISOString(), findings, failures };
fs.writeFileSync(path.join(OUT, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\n증거: ${OUT}`);
console.log(failures.length ? `\n실패 ${failures.length}건:\n${failures.join("\n")}` : "\n전부 통과");

await page.close();
await browser.close();
process.exit(failures.length ? 1 : 0);
