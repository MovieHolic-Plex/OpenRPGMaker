// 공방 「한 번에 만들기」 실화면 시험 — 생성기 하나당 1배 영상 하나. 실제 모델(사용자 계정 경로 = 조수 엔진 local-cli)로 돈다.
// 정본 저장 확인: oprn-serve(프로젝트 폴더 SQLite)에 띄우고 Ctrl+S → 새로고침 → 맵에 놓인 것을 화면으로 다시 본다.
//   node scripts/oprn-serve.mjs --project-dir /tmp/proj --port 9860 &
//   BASE=http://127.0.0.1:9860 KIND=object OUT=/tmp/wsoc/e2e ENGINE_CLI=claude ENGINE_MODEL=sonnet node scripts/qa/workshop-oneclick-e2e.mjs
// 결과: OUT/<KIND>.webm, OUT/<KIND>-*.png, OUT/<KIND>.json(클릭 수·첫 결과까지 걸린 시간·저장 뒤 재로드 확인)
import { chromium } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9860";
const kind = process.env.KIND ?? "object";
const out = resolve(process.env.OUT ?? "verify-shots/workshop-oneclick");
const text = process.env.TEXT ?? "";
const width = 1440, height = 900;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } });
const page = await context.newPage();
page.setDefaultTimeout(120_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const engine = { kind: "local-cli", cli: process.env.ENGINE_CLI ?? "claude", routineModel: process.env.ENGINE_MODEL ?? "sonnet", deepModel: process.env.ENGINE_MODEL ?? "sonnet", effort: "high" };
await page.addInitScript((engineJson) => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
  localStorage.setItem("oprn:assistant-engine", engineJson);
}, JSON.stringify(engine));

const hold = (ms) => page.waitForTimeout(ms);
const result = { kind, engine: `${engine.cli}:${engine.routineModel} (stand-in for the user's own account)`, clicks: 0, typed: false };
const click = async (locator) => { await locator.click(); result.clicks += 1; };
const t0 = Date.now();
const marks = {};
const mark = (name) => { marks[name] = Number(((Date.now() - t0) / 1000).toFixed(1)); console.log(`[mark] ${name} ${marks[name]}s`); };

async function boot() {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.getByTestId("sidebar-workshop").waitFor({ timeout: 240_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("도구 준비 중"), null, { timeout: 300_000 });
  await hold(1500);
}

async function canvasBox() {
  const canvas = page.locator("canvas").first();
  return canvas.boundingBox();
}

try {
  await boot();
  mark("booted");
  await click(page.getByTestId("sidebar-workshop"));
  await page.getByTestId("workshop-oneclick").waitFor();
  await page.getByTestId(`workshop-oneclick-tab-${kind}`).click();
  await hold(900);
  if (text) { await page.getByTestId("workshop-oneclick-input").pressSequentially(text, { delay: 60 }); result.typed = true; }
  else await click(page.getByTestId("workshop-oneclick-example-0"));
  await hold(600);
  await page.screenshot({ path: resolve(out, `${kind}-1-ready.png`) });
  const made = Date.now();
  mark("make");
  await click(page.getByTestId("workshop-oneclick-make"));
  await hold(2500);
  await page.screenshot({ path: resolve(out, `${kind}-2-running.png`) });
  const toast = page.getByTestId("workshop-oneclick-place-toast").first();
  const failed = page.getByTestId("workshop-oneclick-error");
  await Promise.race([toast.waitFor({ timeout: 45 * 60_000 }), failed.waitFor({ timeout: 45 * 60_000 }).then(() => { throw new Error(`실패 카드: ${"" }`); })]).catch(async (error) => {
    const reason = await failed.textContent().catch(() => null);
    throw new Error(`${error.message} ${reason ?? ""}`);
  });
  result.firstResultSeconds = Number(((Date.now() - made) / 1000).toFixed(1));
  mark("result");
  await hold(1200);
  await page.screenshot({ path: resolve(out, `${kind}-3-done.png`) });
  await click(toast);
  await hold(900);
  const box = await canvasBox();
  const cx = box.x + box.width * 0.5, cy = box.y + box.height * 0.5;
  await page.mouse.move(cx - 40, cy - 20, { steps: 8 });
  await hold(700);
  if (kind === "terrain") {
    await page.mouse.move(cx - 80, cy - 40); await page.mouse.down();
    for (let row = 0; row < 4; row++) for (let i = 0; i <= 8; i++) await page.mouse.move(cx - 80 + (row % 2 ? 8 - i : i) * 20, cy - 40 + row * 24, { steps: 3 });
    await page.mouse.up();
  } else {
    // 캐릭터는 풀밭(용암·우물이 아닌 칸)에 세운다
    const dx = kind === "character" ? -160 : -40;
    await page.mouse.move(cx + dx, cy - 20, { steps: 6 });
    await hold(400);
    await page.mouse.click(cx + dx, cy - 20);
  }
  result.clicks += 1;
  mark("placed");
  await hold(2000);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: resolve(out, `${kind}-4-placed.png`) });
  // 정본 저장 → 새로고침 → 다시 본다
  await page.keyboard.press("Control+s");
  await hold(4000);
  const status = await page.getByTestId("topbar-save-status").textContent().catch(() => "");
  result.saveStatus = status?.trim() ?? "";
  mark("saved");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("sidebar-workshop").waitFor({ timeout: 240_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("도구 준비 중"), null, { timeout: 300_000 });
  await hold(4000);
  // 타일 층에서는 이벤트가 「E」 배지로만 보인다 — NPC 그림을 다시 보려면 이벤트 층(F7)
  if (kind === "character") { await page.keyboard.press("F7"); await hold(1500); }
  await page.mouse.move(cx - 40, cy - 20, { steps: 4 });
  await hold(800);
  await page.screenshot({ path: resolve(out, `${kind}-5-reloaded.png`) });
  mark("reloaded");
} catch (error) {
  result.error = error instanceof Error ? error.message.slice(0, 500) : String(error);
  console.log("FAIL", result.error);
  await page.screenshot({ path: resolve(out, `${kind}-fail.png`) }).catch(() => {});
} finally {
  result.marks = marks;
  result.errors = errors.slice(0, 10);
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) renameSync(await video.path(), resolve(out, `${kind}.webm`));
  writeFileSync(resolve(out, `${kind}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
