// AI 가 배치한 NPC 를 복원해 에디터/플레이 화면 증거를 촬영한다.
//
// 배치 자체는 ai-npc-place-one.cjs 가 슬롯별 별도 브라우저로 수행한다(한 탭에서
// 연속 요청하면 렌더러가 죽는다 — 실측 "Target crashed"). 여기서는 그 결과를
// 에디터 툴 훅으로 되살려 한 화면에 모아 찍는다.
//
// 사용: node scripts/ai-npc-capture-evidence.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");

const SHOTS = "tmp/ai-npc-proof";
const MAP_ID = "map_ice_grand_plain_64";
const BASE = "https://localhost:9999";

const events = JSON.parse(fs.readFileSync(`${SHOTS}/events.json`, "utf8"));
if (events.length === 0) throw new Error("events.json 이 비어 있습니다");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:coachmarks-basic-v1", "seen");
  });

  await page.goto(`${BASE}/?devProject=1&icePlain64=1&map=${MAP_ID}`, { waitUntil: "load", timeout: 60000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ timeout: 45000 });

  const restored = await page.evaluate(
    ({ mapId, list }) => {
      const hook = window.__oprnEditorTool;
      if (typeof hook !== "function") return -1;
      let n = 0;
      for (const ev of list) {
        const r = hook("upsert_event", { mapId, event: ev });
        if (r && r.ok !== false) n += 1;
      }
      return n;
    },
    { mapId: MAP_ID, list: events }
  );
  console.log(`복원: ${restored}/${events.length}`);
  await page.waitForTimeout(1500);

  // 뷰포트 이동: set_editor_viewport 같은 툴은 없고 __oprnEditCamera 는 읽기 전용이다.
  // 캔버스에 마우스 휠을 보내 NPC 가 있는 남쪽(y≈59)으로 스크롤한다.
  const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 14; i += 1) {
      await page.mouse.wheel(0, 320);
      await page.waitForTimeout(120);
    }
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/04-events-placed.png` });
  const cam = await page.evaluate(() => (window.__oprnEditCamera ? window.__oprnEditCamera() : null));
  console.log("카메라:", cam ? `scrollY=${Math.round(cam.scrollY)} zoom=${cam.zoom}` : "(훅 없음)");

  // 이벤트 레이어를 켜서 NPC 마커가 보이게 한다(testid 는 layer-event — 단수).
  const evLayer = page.getByTestId("layer-event");
  if (await evLayer.isVisible().catch(() => false)) {
    await evLayer.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SHOTS}/04b-event-layer.png` });
  }

  // 플레이 모드 — 시작 위치 (32,62) 가 NPC 들(30~38, 58~60) 바로 아래라 한 화면에 들어온다.
  const play = page.getByTestId("mode-play");
  if (await play.isVisible().catch(() => false)) {
    await play.click();
    const title = page.getByTestId("title-screen");
    if (await title.isVisible({ timeout: 20000 }).catch(() => false)) {
      await page.keyboard.press("Enter");
    }
    await page.getByTestId("runtime-state-json").waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const state = await page.getByTestId("runtime-state-json").textContent().catch(() => "");
    console.log("런타임 상태:", (state || "").slice(0, 120));
    await page.screenshot({ path: `${SHOTS}/05-play-mode.png` });
    console.log("플레이 모드 촬영 완료");
  }

  await browser.close();
})();
