// 대화 기록의 정본은 IndexedDB 다 — 실제 Chromium 에서 (1) 옛 localStorage 키가 첫 부팅에 IndexedDB 로
// 옮겨지고 지워지는지, (2) 새로 고침 뒤에도 IndexedDB 에서 복원되는지, (3) 그 과정에 「오류:」 말풍선이
// 없는지를 증명한다.
//
// 왜 e2e 인가: 단위 테스트는 fake-indexeddb 위에서 돈다. 브라우저의 진짜 IndexedDB(트랜잭션 자동 커밋·
// 버전 업그레이드·리로드 간 지속)는 여기서만 검증된다.
//
// 실행: DEV_SERVER_PORT=<포트> npx playwright test test/e2e/ai-conversation-indexeddb.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";

const LAYOUT_KEY = "oprn:editor-layout:v4";
const COACH_KEY = "oprn:coachmarks-basic-v1";
const WELCOME_KEY = "oprn:standard-welcome-seen";
const LEGACY_KEY = "oprn:ai-conversations";
const SEED_ONCE_FLAG = "e2e:legacy-conversation-seeded";
const DB_NAME = "oprn-ai-records";
const CONVERSATION_ID = "legacy-migrate";
const MARKER = "legacy marker 7f3a";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

async function waitForEditor(page: Page): Promise<void> {
  await dismissLogin(page);
  // 콜드 부팅(vite 첫 변환)은 공유 머신에서 20초를 넘긴다 — ai-panel-reachability 와 같은 90초.
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
}

/** 옛 키는 **첫 탐색에서만** 심는다 — 새로 고침 뒤 복원이 이관본(IndexedDB)에서 왔음을 가르기 위해. */
async function seedLegacyOnce(page: Page): Promise<void> {
  await page.addInitScript(({ layoutKey, coachKey, welcomeKey, legacyKey, seedFlag, id, marker }) => {
    localStorage.setItem(layoutKey, JSON.stringify({ leftWidth: 280, mapTreeHeight: 220 }));
    localStorage.setItem(coachKey, "1");
    localStorage.setItem(welcomeKey, "1");
    if (sessionStorage.getItem(seedFlag)) return;
    sessionStorage.setItem(seedFlag, "1");
    localStorage.setItem(legacyKey, JSON.stringify([{
      id,
      title: marker,
      model: "e2e",
      savedAt: Date.now(),
      projectContextKey: "local:이슬 장터 — 30분::map_village_30_100x100",
      entries: [
        { kind: "user", text: marker },
        { kind: "assistant", text: "seeded reply" },
      ],
    }]));
  }, { layoutKey: LAYOUT_KEY, coachKey: COACH_KEY, welcomeKey: WELCOME_KEY, legacyKey: LEGACY_KEY, seedFlag: SEED_ONCE_FLAG, id: CONVERSATION_ID, marker: MARKER });
}

async function readConversationIdsFromIndexedDb(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ dbName }) =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("conversations")) {
            db.close();
            resolve([]);
            return;
          }
          const getAll = db.transaction("conversations", "readonly").objectStore("conversations").getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => {
            db.close();
            resolve((getAll.result as { id: string }[]).map((row) => row.id));
          };
        };
      }),
    { dbName: DB_NAME },
  );
}

test("옛 localStorage 대화는 첫 부팅에 IndexedDB 로 옮겨지고, 새로 고침 뒤에도 거기서 복원된다", async ({ page }) => {
  test.setTimeout(240_000);
  await seedLegacyOnce(page);
  await page.goto("/?freshProject=1");
  await waitForEditor(page);

  // (1) 복원됐다 — 옛 키에서 읽어 IndexedDB 로 옮긴 결과가 화면에 있다.
  const log = page.getByTestId("ai-chat-log");
  await expect(log).toContainText(MARKER, { timeout: 20_000 });
  await expect(log).not.toContainText("오류:");
  // 이관 뒤 옛 키는 지워진다 — 두 정본이 남지 않는다.
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), LEGACY_KEY), { timeout: 10_000 }).toBeNull();
  expect(await readConversationIdsFromIndexedDb(page)).toContain(CONVERSATION_ID);

  // (2) 새로 고침 — init script 는 이번엔 옛 키를 심지 않는다. 복원은 IndexedDB 에서만 올 수 있다.
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForEditor(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_KEY)).toBeNull();
  await expect(page.getByTestId("ai-chat-log")).toContainText(MARKER, { timeout: 20_000 });
  await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-ai-conversation", "active");
  await expect(page.getByTestId("ai-chat-log")).not.toContainText("오류:");
});
