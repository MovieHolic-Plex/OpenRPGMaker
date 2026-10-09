/* 파티 DB 감사용 공용 부팅 헬퍼.
   에디터 부팅은 (a) vite 의존성 재최적화와 겹치면 첫 로드가 빈 화면이 되고,
   (b) localStorage 상태에 따라 런처/환영 모달/코치마크 중 무엇이 뜨는지가 달라진다.
   그래서 "특정 화면을 가정"하지 않고 목표 testid 가 나타날 때까지 방해물을 걷어낸다. */
const PORT = process.env.AUDIT_PORT || "9247";
const BASE = `http://127.0.0.1:${PORT}`;

const DISMISS = ["건너뛰기", "빈 맵으로 시작", "닫기"];

async function bootEditor(page, { timeout = 180000 } = {}) {
  // 이 머신은 모듈 fetch 가 `net::ERR_NETWORK_CHANGED` 로 통째로 깨지는 일이 잦다(프록시/VPN
  // 인터페이스 flapping). 그러면 앱이 빈 화면으로 남지만 **제품 결함이 아니다** — 재적재하면
  // 정상 부팅한다. 한 번만 재시도하면 게이트가 네트워크 상태에 따라 흔들려 회귀 판정 자체가
  // 무의미해지므로 성공까지 여러 번 재적재한다.
  const loaded = () => page.evaluate(() => document.querySelectorAll("[data-testid]").length > 5).catch(() => false);
  let booted = false;
  for (let attempt = 0; attempt < 6 && !booted; attempt += 1) {
    if (attempt === 0) await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
    else await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    for (let wait = 0; wait < 12 && !booted; wait += 1) {
      await page.waitForTimeout(1000);
      booted = await loaded();
    }
  }
  if (!booted) throw new Error("bootEditor: 앱이 부팅되지 않았다(모듈 fetch 실패 가능)");
  await page.waitForTimeout(1500);

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.getByTestId("authoring-task-data").count()) return;
    let acted = false;
    for (const label of DISMISS) {
      const l = page.locator(`text=${label}`);
      if (await l.count()) {
        await l.first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(900);
        acted = true;
        break;
      }
    }
    if (!acted) await page.waitForTimeout(700);
  }
  throw new Error("bootEditor: authoring-task-data 가 나타나지 않았다");
}

async function openDatabase(page, tabTestid) {
  await bootEditor(page);
  await page.getByTestId("authoring-task-data").click();
  await page.waitForSelector('[data-testid="database-modal"]', { timeout: 40000 });
  await page.waitForTimeout(1200);
  if (tabTestid) {
    await page.getByTestId(tabTestid).click({ force: true });
    await page.waitForTimeout(1400);
  }
}

module.exports = { BASE, bootEditor, openDatabase };
