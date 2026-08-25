// NPC 한 명을 내부 AI 로 배치하고 결과를 tmp/ai-npc-proof/ 에 누적한다.
//
// 왜 한 명씩 별도 프로세스인가: 한 탭에서 세 번 연속 요청하면 세 번째에 렌더러가
// 죽었다(실측 "Target crashed"). 대화 로그 + 툴 내역 + 45KB 페이로드가 누적되며
// 메모리를 밀어올린다. 요청마다 브라우저를 새로 띄우면 그 누적이 사라진다.
//
// 사용: node scripts/ai-npc-place-one.cjs <슬롯번호> "<라벨>" "<요청문>"
const { chromium } = require("playwright");
const fs = require("node:fs");

const SHOTS = "tmp/ai-npc-proof";
const MAP_ID = "map_ice_grand_plain_64";
const BASE = "https://localhost:9999";

const [slot, label, request] = process.argv.slice(2);
if (!slot || !label || !request) {
  console.error('사용: node scripts/ai-npc-place-one.cjs <슬롯> "<라벨>" "<요청문>"');
  process.exit(2);
}

// 이전 슬롯이 남긴 이벤트를 seed 로 주입해 맵 상태를 이어간다.
const statePath = `${SHOTS}/events.json`;
const seed = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : [];

const readEvents = (page) =>
  page.evaluate((mapId) => {
    const raw = document.querySelector("[data-testid='project-export-json']")?.textContent ?? "{}";
    try {
      return JSON.parse(raw).project?.maps?.[mapId]?.events ?? [];
    } catch {
      return [];
    }
  }, MAP_ID);

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1000 } });
  const page = await ctx.newPage();

  // ai-config 는 손대지 않는다 — autoApprove 를 주입해 덮어쓰면 대화 세션이 초기화된다(실측).
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:coachmarks-basic-v1", "seen");
  });

  await page.goto(`${BASE}/?devProject=1&icePlain64=1&map=${MAP_ID}`, { waitUntil: "load", timeout: 60000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ timeout: 45000 });

  // 앞 슬롯의 NPC 를 에디터 툴 훅으로 되살려 누적 상태를 만든다.
  if (seed.length > 0) {
    const restored = await page.evaluate(
      ({ mapId, events }) => {
        const hook = window.__oprnEditorTool;
        if (typeof hook !== "function") return -1;
        let n = 0;
        for (const ev of events) {
          const r = hook("upsert_event", { mapId, event: ev });
          if (r && r.ok !== false) n += 1;
        }
        return n;
      },
      { mapId: MAP_ID, events: seed }
    );
    console.log(`  seed 복원: ${restored}/${seed.length}`);
  }

  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  const input = page.getByTestId("ai-input");
  await input.waitFor({ timeout: 20000 });

  const before = (await readEvents(page)).length;
  if (slot === "1") await page.screenshot({ path: `${SHOTS}/01-editor-ready.png` });

  await input.fill(request);
  await page.getByTestId("ai-send").click();

  const accept = page.getByTestId("ai-proposal-accept").first();
  let events = [];
  let sawCard = false;
  for (let i = 0; i < 100; i += 1) {
    await page.waitForTimeout(3000);
    events = await readEvents(page);
    if (events.length > before) break;
    if (await accept.isVisible().catch(() => false)) {
      sawCard = true;
      if (slot === "1") await page.screenshot({ path: `${SHOTS}/02-proposal-card.png` });
      await accept.click();
      for (let k = 0; k < 25; k += 1) {
        await page.waitForTimeout(2000);
        events = await readEvents(page);
        if (events.length > before) break;
      }
      break;
    }
  }

  const ok = events.length > before;
  await page.screenshot({ path: `${SHOTS}/1${slot}-after-${label}.png` });
  if (ok) fs.writeFileSync(statePath, JSON.stringify(events, null, 2));

  const kinds = events
    .slice(before)
    .map((e) => (e.pages ?? []).map((p) => (p.commands ?? []).map((c) => c.kind).join("→")).join(" | "))
    .join(" ; ");
  console.log(`[슬롯 ${slot}] ${label}: ${ok ? "성공" : "실패"} · 카드 ${sawCard} · ${before}→${events.length} · ${kinds}`);

  await browser.close();
  process.exit(ok ? 0 : 1);
})();
