/**
 * REVIEW-2 항목 3 검증: side 도크 seam 에서 리사이즈 손잡이의 **실제 연속 hit 폭**을 잰다.
 * 선언된 rect(12px)가 아니라 elementFromPoint 가 손잡이를 돌려주는 x 구간을 센다.
 * overflow:hidden 호스트에 절반이 잘리면 여기서 6px 로 드러난다.
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9823";
const OUT = "output/evidence/assistant-resize-collapse/side-seam-hittest.json";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("dialog", (d) => d.accept());
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 20_000 });

// 숨은 도크 순환 훅으로 side 로 맞춘다(e2e 스펙과 동일 경로).
await page.evaluate(() => {
  const toggle = document.querySelector('[data-testid="chat-dock-toggle"]');
  for (let i = 0; i < 3; i += 1) {
    if (document.querySelector('[data-testid="ai-panel"]')?.dataset.chatDock === "side") return;
    toggle?.click();
  }
});
await page.waitForFunction(
  () => document.querySelector('[data-testid="ai-panel"]')?.dataset.chatDock === "side",
  { timeout: 10_000 },
);
await page.getByTestId("ai-resize-handle").waitFor({ state: "visible", timeout: 5_000 });

const result = await page.evaluate(() => {
  const handle = document.querySelector('[data-testid="ai-resize-handle"]');
  const host = document.querySelector(".ai-chat-side-panel");
  const hr = handle.getBoundingClientRect();
  const y = Math.round(hr.y + hr.height / 2);
  const scan = [];
  // 손잡이 선언 rect 좌우로 8px 여유를 두고 1px 씩 훑는다.
  for (let x = Math.floor(hr.x) - 8; x <= Math.ceil(hr.x + hr.width) + 8; x += 1) {
    const el = document.elementFromPoint(x, y);
    const isHandle = !!el?.closest?.('[data-testid="ai-resize-handle"]');
    scan.push({ x, hit: isHandle ? "handle" : (el?.dataset?.testid ?? el?.tagName?.toLowerCase() ?? "none") });
  }
  // 가장 긴 연속 handle 구간
  let best = 0;
  let run = 0;
  let bestStart = null;
  let runStart = null;
  for (const s of scan) {
    if (s.hit === "handle") {
      if (run === 0) runStart = s.x;
      run += 1;
      if (run > best) { best = run; bestStart = runStart; }
    } else {
      run = 0;
    }
  }
  return {
    handleRect: { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) },
    hostLeft: host ? Math.round(host.getBoundingClientRect().x) : null,
    hostOverflow: host ? getComputedStyle(host).overflow : null,
    continuousHitWidth: best,
    hitRange: bestStart === null ? null : { from: bestStart, to: bestStart + best - 1 },
    scan,
  };
});

result.pass = result.continuousHitWidth >= 10;
await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `handle rect x=${result.handleRect.x} w=${result.handleRect.w} | host left=${result.hostLeft} overflow=${result.hostOverflow}`,
);
console.log(`continuous handle hit width = ${result.continuousHitWidth}px (range ${JSON.stringify(result.hitRange)}) → ${result.pass ? "PASS" : "FAIL"} (>=10px 필요)`);
console.log("scan:", result.scan.map((s) => `${s.x}:${s.hit}`).join(" "));
await browser.close();
process.exit(result.pass ? 0 : 1);
