// 영역 작업 재설계 스크린샷·실측 채집기.
// LLM 을 부르지 않는다 — window.__oprnRegionTaskHarness (editorToolHook) 로 영역을 지정하고
// 결정적 writes 로 검토 UI 까지 띄운 뒤 찍는다.
//
// 사용: node drive.mjs <출력디렉터리> [--url ...] [--tag 접두어] [--zoomout N] [--region x,y,w,h]
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const outDir = process.argv[2] ?? ".";
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("--url", "http://127.0.0.1:9931/");
const TAG = arg("--tag", "");
const ZOOMOUT = Number(arg("--zoomout", "2"));
const [rx, ry, rw, rh] = arg("--region", "18,14,12,10").split(",").map(Number);
const REGION = { x: rx, y: ry, width: rw, height: rh };
fs.mkdirSync(outDir, { recursive: true });

// 이 샌드박스에는 tailscale0/docker 브리지가 있어 크로미움의 NetworkChangeNotifier 가
// 수시로 "네트워크 바뀜"을 보고하고, 그때 진행 중인 요청이 전부 ERR_NETWORK_CHANGED 로
// 끊긴다. HTML 한 장은 받아지지만 vite dev 의 모듈 수백 개가 못 들어와 화면이 백지가 된다.
// 실측(2026-09-11): 플래그 없이는 60회 폴링 내내 백지, 붙이면 곧바로 부팅됐다.
const browser = await chromium.launch({
  args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const logs = [];
page.on("console", (m) => { if (m.type() === "error") logs.push(m.text()); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

async function shot(name) {
  const file = path.join(outDir, `${TAG}${name}.png`);
  await page.screenshot({ path: file });
  console.log("shot", path.basename(file));
}

await page.goto(BASE, { waitUntil: "domcontentloaded" });
// 수동 폴링 — vite 가 소스 변경 직후 페이지를 여러 번 풀리로드하면 waitForFunction 의 폴러도,
// 진행 중인 evaluate 도 함께 떨어져 나간다. 로드 상태를 먼저 기다린 뒤 재시도한다.
let ready = false;
for (let i = 0; i < 60; i += 1) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1500);
  // 앞선 세션이 남긴 확인 모달이 떠 있으면 포인터를 다 먹으므로 먼저 닫는다.
  // (「편집 권한 가져오기」는 누르지 않는다 — 확인 모달을 또 띄우고, 배너만 있어도 진행된다.)
  if (await page.locator('[data-testid="app-confirm-modal"]').count().catch(() => 0)) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(600);
  }
  ready = await page.evaluate(
    () => typeof window.__oprnRegionTaskHarness === "object" && Boolean(document.querySelector(".phaser-container")),
  ).catch(() => false);
  if (ready) {
    // 리로드가 한 번 더 오는지 확인 — 곧바로 진행하면 하네스가 중간에 사라진다.
    await page.waitForTimeout(2500);
    ready = await page.evaluate(() => typeof window.__oprnRegionTaskHarness === "object").catch(() => false);
    if (ready) break;
  }
  // 준비가 안 되는 이유를 눈으로 본다 — 이 환경에서 ERR_NETWORK_CHANGED 로 빈 화면이
  // 나오는 일이 있어 "내 코드가 깨졌나"와 구분이 필요하다.
  if (i % 8 === 7) {
    const why = await page.evaluate(() => ({
      h: typeof window.__oprnRegionTaskHarness,
      c: Boolean(document.querySelector(".phaser-container")),
      t: document.body?.innerText?.slice(0, 60) ?? "",
    })).catch((e) => ({ err: String(e).split("\n")[0] }));
    console.log(`ready ${i}:`, JSON.stringify(why), "| last err:", logs.slice(-1)[0] ?? "none");
    // 리로드가 잦으면 새로 진입해 본다.
    await page.goto(BASE, { waitUntil: "domcontentloaded" }).catch(() => {});
  }
}
if (!ready) throw new Error("하네스/캔버스 준비 실패");
await page.waitForTimeout(2500);

for (let i = 0; i < ZOOMOUT; i += 1) {
  const minus = page.locator('button:has-text("−")').first();
  if (await minus.count()) { await minus.click().catch(() => {}); await page.waitForTimeout(350); }
}
await page.waitForTimeout(600);

// 생성기(오퍼레이터) 경로를 쓴다 — LLM 0콜이고 프로덕션 코드다. 하네스 목업(openModal+writes)은
// runRegionTask 의 독립 검수 게이트(turn.review?.status !== "approved")에 무조건 막혀 HEAD 에서
// 검토 UI 까지 못 간다(목업 턴에 review 가 없다). 그건 별건이라 여기서 우회한다.
//
// P2 부터는 모드 스위치가 없다 — 입력창에 문장을 쓰고 실행을 누르면 키워드 라우터가
// 생성기로 보낸다. 그래서 이 스크립트가 곧 라우팅 계약의 실 브라우저 검증이기도 하다.
// HMR 리로드가 하네스를 날릴 수 있으니 매 단계 앞에서 다시 확인한다.
async function ensureHarness() {
  for (let i = 0; i < 15; i += 1) {
    const ok = await page.evaluate(() => typeof window.__oprnRegionTaskHarness === "object").catch(() => false);
    if (ok) return;
    await page.waitForTimeout(1500);
  }
  throw new Error("하네스 사라짐");
}
await ensureHarness();

const mapId = await page.evaluate(() => window.__oprnRegionTaskHarness.currentMapId());

// 영역 자동 선택: 화면 중앙 쪽(맵 y>=16) 에서 12×10 전부 잔디이고 위층이 빈 사각형.
// 맵 y=0 근처를 고르면 카메라가 위를 잘라 도형이 뷰포트 밖으로 나간다(실측: originY ≈ -78).
const AUTO = process.argv.includes("--auto");
let region = REGION;
if (AUTO) {
  const picked = await page.evaluate(({ mapId }) => {
    const h = window.__oprnRegionTaskHarness;
    for (let y = 16; y <= 32; y += 1) {
      for (let x = 2; x <= 46; x += 1) {
        let clean = true;
        for (let dy = 0; dy < 10 && clean; dy += 1) {
          for (let dx = 0; dx < 12; dx += 1) {
            if (h.readCell(mapId, "lower", x + dx, y + dy) !== 240) { clean = false; break; }
            const up = h.readCell(mapId, "upper", x + dx, y + dy);
            if (up !== -1 && up !== 0 && up !== null) { clean = false; break; }
          }
        }
        if (clean) return { x, y, width: 12, height: 10 };
      }
    }
    return null;
  }, { mapId });
  if (picked) region = picked;
  else console.log("WARN: 깨끗한 잔디 영역을 못 찾음 — 지정 영역을 그대로 쓴다");
}
console.log("mapId", mapId, "region", JSON.stringify(region));

await page.evaluate(({ mapId, region }) => {
  window.__oprnRegionTaskHarness.setSelection({ mapId, ...region });
}, { mapId, region });
await page.waitForTimeout(600);
await shot("10-selection");

await page.evaluate(({ mapId, region }) => {
  window.__oprnRegionTaskHarness.openModal(mapId, region);
}, { mapId, region });
await page.waitForTimeout(1500);
await shot("15-compose");

// 진입 화면의 컨트롤 수를 센다 — 스펙 §5.2 의 "7 → 5" 를 실물로 확인한다.
const composeControls = await page.evaluate(() => {
  const modal = document.querySelector('[data-testid="region-task-popover"]')
    ?? document.querySelector('[data-testid="region-task-modal"]');
  if (!modal) return null;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const chips = [...modal.querySelectorAll('[data-testid="region-task-suggestions"] button')].filter(visible);
  const buttons = [...modal.querySelectorAll(".region-task-actions button")].filter(visible);
  const inputs = [...modal.querySelectorAll("textarea, input, select")].filter(visible);
  return {
    chips: chips.length,
    actionButtons: buttons.map((b) => b.textContent.trim()),
    inputs: inputs.length,
    runLabel: modal.querySelector('[data-testid="region-task-run"]')?.textContent?.trim() ?? null,
    placeholder: modal.querySelector('[data-testid="region-task-input"]')?.getAttribute("placeholder") ?? null,
    hasModeSwitch: Boolean(modal.querySelector('[data-testid="region-task-mode-switch"]')),
    hasBrowseAll: Boolean(modal.querySelector('[data-testid="region-task-browse-all"]')),
    adjustVisible: (() => {
      const el = modal.querySelector('[data-testid="region-task-adjust"]');
      return el ? visible(el) : false;
    })(),
  };
});
console.log("compose controls:", JSON.stringify(composeControls));

// 문장으로 라우팅한다 — 「울창한 숲…」은 키워드 라우터가 forest 생성기로 보낸다(LLM 0콜).
const INSTRUCTION = process.argv.includes("--instruction")
  ? arg("--instruction", "")
  : "울창한 숲에 오솔길 하나";
await page.fill('[data-testid="region-task-input"]', INSTRUCTION);
await page.waitForTimeout(400);
await shot("16-typed");
const runLabelAfterTyping = await page.evaluate(
  () => document.querySelector('[data-testid="region-task-run"]')?.textContent?.trim() ?? null,
);
console.log("run label after typing:", runLabelAfterTyping);
await page.click('[data-testid="region-task-run"]');

await page.waitForFunction(
  () => Boolean(document.querySelector('[data-testid="region-task-chunk-tree"]'))
    || Boolean(document.querySelector('[data-testid="region-chunk-layer"]')),
  null,
  { timeout: 40000 },
).catch(() => console.log("WARN: 검토 UI 대기 시간 초과"));
await page.waitForTimeout(1800);
await shot("20-review");

const measured = await page.evaluate(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const shapes = [...document.querySelectorAll('[data-testid^="region-chunk-shape-"]')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      id: el.dataset.chunkId,
      cls: String(el.className),
      checked: el.getAttribute("aria-checked"),
      label: el.getAttribute("aria-label"),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      cells: el.querySelectorAll(".region-chunk-cell").length,
      edges: el.querySelectorAll(".region-chunk-edge").length,
    };
  });
  return {
    canvas: rect(".canvas-area"),
    phaser: rect(".phaser-container"),
    popover: rect('[data-testid="region-task-popover"]') ?? rect('[data-testid="region-task-modal"]'),
    chunkLayer: rect('[data-testid="region-chunk-layer"]'),
    checklist: Boolean(document.querySelector('[data-testid="region-task-chunk-tree"]')),
    checklistVisible: (() => {
      const el = document.querySelector('[data-testid="region-task-partial-host"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })(),
    thumbsVisible: (() => {
      const el = document.querySelector('[data-testid="region-task-compare"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })(),
    canvasReview: Boolean(document.querySelector('.region-task-modal.is-canvas-review')),
    commandBar: rect('[data-testid="region-command-bar"]'),
    actionBar: rect('[data-testid="region-review-bar"]'),
    dock: rect(".ai-chat-panel .ai-deck"),
    // 바가 실제로 보이나 — 중심점의 최상단 엘리먼트가 바 자신이어야 한다.
    barTopmost: (() => {
      const el = document.querySelector('[data-testid="region-review-apply"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top ? `${top.tagName}.${String(top.className).slice(0, 48)}` : null;
    })(),
    applyLabel: document.querySelector('[data-testid="region-review-apply"]')?.textContent?.trim() ?? null,
    layerLabels: [...document.querySelectorAll('[data-testid^="region-review-layer-"]')].map((e) => e.textContent),
    shapes,
  };
});
if (measured.canvas && measured.popover) {
  measured.popoverShareOfCanvas = `${Math.round((measured.popover.w / measured.canvas.w) * 1000) / 10}%`;
}
console.log(JSON.stringify(measured, null, 2));
if (logs.length) { console.log("--- page errors ---"); console.log(logs.slice(-10).join("\n")); }

if (measured.shapes.length > 1) {
  const target = measured.shapes.find((s) => !s.cls.includes("is-dim"));
  if (target) {
    // 클릭 지점의 최상단 엘리먼트를 먼저 물어본다 — 무엇이 가로막는지 이름으로 알 수 있다.
    const blocker = await page.evaluate((id) => {
      const hit = document.querySelector(`[data-testid="region-chunk-shape-${id}"] .region-chunk-hit`);
      if (!hit) return { error: "hit 없음" };
      const r = hit.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const chain = [];
      let n = top;
      while (n && chain.length < 5) { chain.push(`${n.tagName}.${String(n.className).slice(0, 40)}`); n = n.parentElement; }
      return { point: { x: Math.round(cx), y: Math.round(cy) }, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, chain };
    }, target.id);
    console.log("blocker:", JSON.stringify(blocker));

    // force 를 쓰지 않는다 — 실제로 눌리는지가 이 테스트의 핵심이다(가려져 있으면 실패해야 한다).
    await page.click(`[data-testid="region-chunk-shape-${target.id}"] .region-chunk-hit`, { timeout: 8000 })
      .catch((e) => console.log("클릭 실패:", String(e).split("\n")[0]));
    await page.waitForTimeout(1400);
    await shot("30-chunk-excluded");
    const after = await page.evaluate((id) => {
      const el = document.querySelector(`[data-testid="region-chunk-shape-${id}"]`);
      const apply = document.querySelector('[data-testid="region-review-apply"]');
      return { checked: el?.getAttribute("aria-checked"), cls: String(el?.className), applyText: apply?.textContent?.trim() };
    }, target.id);
    console.log("after click:", JSON.stringify(after));
    measured.afterClick = after;
  }
}

fs.writeFileSync(path.join(outDir, `${TAG}measured.json`), JSON.stringify(measured, null, 2));
await browser.close();
