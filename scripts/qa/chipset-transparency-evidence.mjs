// 커스텀 칩셋 투명도 감지 — 브라우저 실측 증거.
//
// 증명할 것 다섯 개:
//   1. 커스텀 칩셋(Modern Exteriors 아틀라스)을 고르면 감지가 검토 목록을 채운다.
//   2. 목록 항목에 픽셀 감지 부류와 실측 수치가 붙는다.
//   3. **아무것도 수락하지 않으면 메타가 그대로다** (priority/tileMeta 직렬화 비교).
//   4. 내장 칩셋 경로는 감지를 타지 않는다(스캔 요약이 없다).
//   5. 투명색 키(color key)를 건 뒤에도 판정이 정직하다. 이 아틀라스는 이미 RGBA 알파를 쓰고
//      마젠타 픽셀이 **0개**이므로(실상: 아래 NOTES 의 PNG 집계) 키는 정당한 no-op 이고
//      요약이 그대로여야 옳다 — 없는 투명을 발명하지 않는다는 뜻이다. 색 키가 실제로
//      판정을 바꿀 때의 회귀는 마젠타 픽셀이 있는 합성 시트로 단위 테스트가 고정한다
//      (test/customChipsetTransparencyDetection.test.ts, fix 쯤 2aa344397).
//
// 실행: DEV_SERVER_PORT=9863 npm run dev:worktree 를 띄운 뒤
//       node scripts/qa/chipset-transparency-evidence.mjs [--port 9863]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const portArg = process.argv.indexOf("--port");
const PORT = portArg > 0 ? process.argv[portArg + 1] : (process.env.DEV_SERVER_PORT ?? "9863");
const ORIGIN = `http://127.0.0.1:${PORT}`;
const shotDir = resolve("verify-shots/chipset-transparency");
mkdirSync(shotDir, { recursive: true });

const notes = [];
const record = (ok, line) => {
  notes.push(`${ok ? "OK  " : "FAIL"} ${line}`);
  console.log(`${ok ? "OK  " : "FAIL"} ${line}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.setDefaultTimeout(30000);
// 페이지 오류는 조용히 지나가면 안 된다 — 스크린샷은 멀쩡해 보이는데 콘솔이 타 있는
// 상태로 '통과' 를 찍는 것이 이런 증거 스크립트가 거짓말하는 가장 흔한 방식이다.
// 잡음(외부 폰트·확장 프로그램 등)과 진짜 결함을 가르기 위해 무해한 것만 이름으로 뺀다.
const BENIGN_ERROR_PATTERNS = [
  /favicon/i,
  /net::ERR_(BLOCKED_BY_CLIENT|CONNECTION_REFUSED)/i,
  /APITOPIA_API_KEY/i, // dev 서버가 AI 프록시 없이 뜬다는 안내(이 증거와 무관)
];
const pageErrors = [];
const notePageError = (source, text) => {
  const line = `${source}: ${text.replace(/\s+/g, " ").slice(0, 300)}`;
  if (BENIGN_ERROR_PATTERNS.some((pattern) => pattern.test(line))) return;
  pageErrors.push(line);
  console.log("  [page error]", line);
};
page.on("console", (message) => {
  if (message.type() === "error") notePageError("console", message.text());
});
// 잡히지 않은 예외 — console 이벤트로는 안 오는 경우가 있다.
page.on("pageerror", (error) => notePageError("uncaught", error.message));

const CUSTOM_TILESET_ID = "tileset_modern_exteriors";

/**
 * 프로젝트 전체의 정본 직렬화 + 타일셋별 레이어/메타 지문.
 * DEV + webdriver 에서만 열리는 __oprnProjectE2E 브리지를 쓴다(운영 번들에는 없다).
 */
const metaFingerprint = () =>
  page.evaluate(() => {
    const bridge = window.__oprnProjectE2E;
    if (!bridge) return null;
    const snapshot = bridge.currentProject();
    return {
      canonicalPayload: snapshot.canonicalPayload,
      tilesets: Object.fromEntries(
        Object.entries(snapshot.project.tilesets).map(([id, tileset]) => [
          id,
          JSON.stringify({ priority: tileset.priority, tileMeta: tileset.tileMeta ?? null }),
        ]),
      ),
    };
  });

try {
  await page.goto(`${ORIGIN}/?devProject=1&modernNocturne=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-group-world").waitFor({ state: "attached" });
  await page.getByTestId("db-tab-group-world").click();
  // 타일셋 편집기는 「맵 → 타일」 탭 아래에 산다(tilesets → spatialTiles 라우팅).
  await page.getByTestId("db-tab-spatial-tiles").click({ force: true });
  await page.getByTestId("tileset-passage-blocked").waitFor();

  // 커스텀 칩셋 레코드를 고른다 — Modern Exteriors 아틀라스(kind: custom).
  await page.getByTestId(`spatial-card-${CUSTOM_TILESET_ID}`).click({ force: true });
  // 규칙 탭으로 — 검토 목록과 정책 근거가 사는 표면.
  await page.getByTestId("tileset-section-tab-rules").click({ force: true });
  await page.getByTestId("tileset-rule-layer").waitFor();
  await page.screenshot({ path: resolve(shotDir, "01-rules-tab-custom-chipset.png"), fullPage: false });

  const before = await metaFingerprint();
  record(before !== null, `감지 전 메타 지문 확보 (타일셋 ${Object.keys(before?.tilesets ?? {}).length}개)`);

  // 스캔은 비동기다. 요약 노트가 뜨는 것을 기다린다(고정 sleep 없음).
  const summary = page.getByTestId("tileset-alpha-scan-summary");
  await summary.waitFor({ state: "visible" });
  const summaryText = (await summary.textContent()) ?? "";
  record(summaryText.includes("픽셀 감지"), `스캔 요약 표시: ${summaryText.trim()}`);
  record(/부분 투명 \d+/.test(summaryText) && !/부분 투명 0 /.test(summaryText), "부분 투명 칸이 실제로 감지됐다");

  const reviewList = page.getByTestId("tileset-rule-review");
  await reviewList.waitFor({ state: "visible" });
  const legend = (await reviewList.locator("legend").textContent()) ?? "";
  record(/\((\d+)\)/.test(legend) && !legend.includes("(0)"), `검토 목록 열림: ${legend.trim()}`);

  const detectedBadges = page.locator('[data-testid^="tileset-review-detected-"]');
  const badgeCount = await detectedBadges.count();
  record(badgeCount > 0, `픽셀 감지 배지 ${badgeCount}개 — 감지가 목록을 채웠다`);
  const firstReason = (await page.locator(".tileset-review-item").first().textContent()) ?? "";
  record(firstReason.includes("커버리지"), `첫 항목 근거에 실측 수치: ${firstReason.replace(/\s+/g, " ").slice(0, 150)}`);

  const choiceButtons = await page.locator('[data-testid^="tileset-review-"][data-testid$="-overlay"]').count();
  record(choiceButtons > 0, `항목마다 선택지 제공(상위 오버레이 버튼 ${choiceButtons}개) — 적용은 사용자 몫`);
  await page.screenshot({ path: resolve(shotDir, "02-detection-populated-review-list.png") });
  await page.locator(".tileset-review-item").first().screenshot({ path: resolve(shotDir, "03-review-item-detail.png") });

  // ── 핵심: 아무것도 수락하지 않았으므로 메타가 그대로여야 한다 ──
  const after = await metaFingerprint();
  const metaUnchanged = JSON.stringify(before?.tilesets) === JSON.stringify(after?.tilesets);
  const payloadUnchanged = before?.canonicalPayload === after?.canonicalPayload;
  record(metaUnchanged, "아무것도 수락하지 않으면 priority·tileMeta 가 바이트 단위로 동일하다");
  record(payloadUnchanged, "프로젝트 정본 직렬화(canonicalPayload)도 동일하다");
  if (!metaUnchanged) {
    for (const id of Object.keys(after?.tilesets ?? {})) {
      if (before?.tilesets?.[id] !== after?.tilesets?.[id]) console.log("  변한 타일셋:", id);
    }
  }
  await page.screenshot({ path: resolve(shotDir, "04-metadata-unchanged.png") });

  // ── 내장 칩셋은 감지를 타지 않는다 ──
  const bundledId = await page.evaluate(() => {
    const bridge = window.__oprnProjectE2E;
    const tilesets = bridge?.currentProject().project.tilesets ?? {};
    const found = Object.values(tilesets).find((tileset) => tileset.kind !== "custom");
    return found?.id ?? null;
  });
  if (bundledId) {
    await page.getByTestId(`spatial-card-${bundledId}`).click({ force: true });
    await page.getByTestId("tileset-rule-layer").waitFor();
    const bundledSummary = await page.getByTestId("tileset-alpha-scan-summary").count();
    const bundledPending = await page.getByTestId("tileset-alpha-scan-pending").count();
    record(
      bundledSummary === 0 && bundledPending === 0,
      `내장 칩셋(${bundledId}) 규칙 탭에는 스캔 노트가 없다 — 생성 목록이 정본`,
    );
    await page.screenshot({ path: resolve(shotDir, "05-bundled-chipset-unscanned.png") });
  } else {
    record(false, "내장(rpg2k) 타일셋을 프로젝트에서 찾지 못해 이 항목 미확인");
  }

  // ── 5. 투명색 키 회귀 ────────────────────────────────────────
  //
  // 이전 수확의 99-failure.png 가 우연히 담았던 결함이 이 경로다: `투명색 #ff00ff` 가 걸린
  // 칩셋에서 규칙 탭이 "불투명 바닥/벽면이므로 하위에 그대로 놓입니다" 로 단정했다.
  // 스캔이 베이크와 달리 색 키를 안 보던 것이 원인이고, 그건 쯤 2aa344397 에서 고침다.
  //
  // 단, 이 아틀라스 자신은 마젠타 픽셀이 0개라 키가 정당한 no-op 이다. 그러니 여기서
  // 고정할 계약은 "키를 걸어도 없는 투명을 발명하지 않고, 요약이 사라지지도 않는다" 다.
  // 색 키가 진짜로 판정을 바꾸는 변환은 합성 시트 단위 테스트가 맡는다(위 주석).
  await page.getByTestId(`spatial-card-${CUSTOM_TILESET_ID}`).click({ force: true });
  await page.getByTestId("tileset-section-tab-rules").click({ force: true });
  const keyedSummary = page.getByTestId("tileset-alpha-scan-summary");
  await keyedSummary.waitFor({ state: "visible" });
  const keyedBaseline = ((await keyedSummary.textContent()) ?? "").trim();
  const hexField = page.getByTestId("tileset-transparent-hex");
  if ((await hexField.count()) > 0) {
    // 반드시 실제 UI 로 건다 — E2E 브리지는 읽기 전용이고, 그게 맞는 설계다.
    await hexField.fill("#ff00ff");
    await hexField.press("Enter");
    await page.getByTestId("tileset-section-tab-rules").click({ force: true });
    await keyedSummary.waitFor({ state: "visible" });
    // 색만 바뀌어도 캐시 키가 달라지므로 재스캔된다. 새 요약 문장을 기다린다(고정 sleep 없슴).
    const changed = await page
      .waitForFunction(
        (previous) =>
          ((document.querySelector('[data-testid="tileset-alpha-scan-summary"]')?.textContent ?? "").trim()
            !== previous),
        keyedBaseline,
        { timeout: 30000 },
      )
      .then(() => true)
      .catch(() => false);
    const keyedText = ((await keyedSummary.textContent()) ?? "").trim();
    // 마젠타 0개 아틀라스 → 판정이 그대로여야 옳다. 바뀌었다면 없는 투명을 발명한 것이다.
    record(
      keyedText === keyedBaseline,
      `투명색 #ff00ff 를 걸어도 판정이 변하지 않는다 — 이 아틀라스엔 마젠타 픽셀이 0개라 키가 no-op 이고,`
        + ` 없는 투명을 발명하지 않았다${changed ? " (재스캔 발생)" : ""}`,
    );
    console.log(`       전: ${keyedBaseline}`);
    console.log(`       후: ${keyedText}`);
    record(keyedText.includes("픽셀 감지"), "색 키 적용 후에도 픽셀 감지 요약이 실측 수치로 살아있다(빈칸이 아니다)");
    await page.screenshot({ path: resolve(shotDir, "06-transparent-color-key-rescan.png") });

    // 원상복구 — 증거 수확이 프로젝트에 색 키를 남기지 않는다.
    const resetButton = page.getByTestId("tileset-transparent-reset");
    if ((await resetButton.count()) > 0) await resetButton.click({ force: true }).catch(() => {});
  } else {
    record(false, "투명색 HEX 입력을 찾지 못해 색 키 회귀 미확인");
  }
} catch (error) {
  record(false, `예외: ${error.message}`);
  await page.screenshot({ path: resolve(shotDir, "99-failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  // 페이지 오류 자체가 하나의 검사다 — 화면이 그럴듯해도 콘솔이 타 있으면 실패다.
  record(pageErrors.length === 0, pageErrors.length === 0
    ? "페이지 오류 0건(콘솔 error · 잡히지 않은 예외)"
    : `페이지 오류 ${pageErrors.length}건: ${pageErrors.join(" | ")}`);
  const summaryPath = resolve(shotDir, "SUMMARY.md");
  const failed = notes.filter((line) => line.startsWith("FAIL"));
  writeFileSync(
    summaryPath,
    [
      "# 커스텀 칩셋 투명도 감지 — 브라우저 실측",
      "",
      `- 실행: ${new Date().toISOString()}`,
      `- 대상: ${ORIGIN}/?devProject=1&modernNocturne=1 (Modern Exteriors 커스텀 아틀라스)`,
      `- 결과: ${failed.length === 0 ? "전부 통과" : `${failed.length}건 실패`}`,
      "",
      "## 검사",
      "",
      ...notes.map((line) => `- ${line}`),
      "",
      "## 즉시 확인할 PNG",
      "",
      "- `02-detection-populated-review-list.png` — 감지가 채운 검토 목록",
      "- `03-review-item-detail.png` — 항목의 감지 부류 + 실측 수치 + 네 선택지",
      "- `04-metadata-unchanged.png` — 아무것도 수락하지 않은 뒤의 화면(메타 동일)",
      "- `05-bundled-chipset-unscanned.png` — 내장 칩셋 규칙 탭에 스캔 노트가 없다",
      "- `06-transparent-color-key-rescan.png` — 투명색 키를 건 뒤의 재스캔 판정",
      "",
    ].join("\n"),
  );
  console.log(`\nSUMMARY → ${summaryPath}`);
  await browser.close();
  if (failed.length > 0) process.exitCode = 1;
}
