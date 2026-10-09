// 진단용(임시). 내보내기 플레이어에서 **픽스처만 바꿔가며** 플레이어 캐릭셋 텍스처가
// 실제로 로드되는지 본다. 목적: `oprn-sample-v3.json` 의 __MISSING 이
//   (a) 내보내기 플레이어 전반의 결함인지,
//   (b) 그 픽스처에 국한된 데이터 문제인지
// 를 가른다. 에디터 경로를 섞지 않으므로 프로젝트 주입 변수가 개입하지 않는다.
//
// 실행: node scripts/_export-charset-fixtures.mjs
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const EVIDENCE = join(REPO_ROOT, "verify-shots/runtime-export-charset");

const FIXTURES = [
  "test/fixtures/projects/oprn-sample-v3.json",
  "test/fixtures/projects/editor-authored-demo-v3.json",
  "test/fixtures/projects/fable-village-snapshot.json",
  "test/fixtures/projects/dew-village-demo.json",
];

await mkdir(EVIDENCE, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});

const rows = [];
for (const fixture of FIXTURES) {
  const projectJson = await readFile(join(REPO_ROOT, fixture), "utf8").catch(() => null);
  if (projectJson === null) {
    rows.push({ fixture, result: "(파일 없음)" });
    continue;
  }
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  const badRequests = [];
  page.on("requestfailed", (req) => badRequests.push(`${req.failure()?.errorText} ${req.url()}`));
  page.on("response", (res) => {
    if (res.status() >= 400) badRequests.push(`HTTP ${res.status()} ${res.url()}`);
  });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "cs-probe" };
  });
  await page.route("**/__runtime-qa/project.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
  );

  let sprite = null;
  try {
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 90_000 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__oprnDebug != null, undefined, { timeout: 90_000 });
    await page.waitForTimeout(3000);
    sprite = await page.evaluate(() => {
      const s = window.__oprnPlayerSprite?.() ?? null;
      return s ? { textureKey: s.textureKey, resourceId: s.resourceId } : null;
    });
    await page.screenshot({ path: join(EVIDENCE, `${basename(fixture, ".json")}.png`) });
  } catch (error) {
    rows.push({ fixture, result: `부팅 실패: ${String(error).slice(0, 120)}` });
    await context.close();
    continue;
  }
  rows.push({
    fixture,
    result: sprite ? `${sprite.textureKey}  (resourceId=${sprite.resourceId})` : "(스프라이트 훅 없음)",
    bad: badRequests.length,
  });
  await context.close();
}

console.log("\n픽스처별 플레이어 캐릭셋 텍스처 (내보내기 플레이어):\n");
for (const row of rows) {
  console.log(`  ${basename(row.fixture).padEnd(34)} ${row.result}${row.bad ? `  [실패요청 ${row.bad}]` : ""}`);
}
const missing = rows.filter((r) => String(r.result).startsWith("__MISSING"));
console.log(
  `\n판정: __MISSING ${missing.length}/${rows.length}` +
    (missing.length === rows.length
      ? " → 픽스처 무관, 내보내기 플레이어 전반의 캐릭셋 프리로드 결함"
      : missing.length === 0
        ? " → 전 픽스처 정상"
        : " → 픽스처에 따라 갈린다(데이터 의존)"),
);

await browser.close();
await server.close();
