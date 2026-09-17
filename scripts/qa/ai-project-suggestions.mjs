import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const live = process.env.LIVE === "1";
const out = "output/evidence/ai-project-suggestions" + (live ? "-live" : "");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [], requests = [], errors = [];
page.on("pageerror", e => errors.push(e.message));
const check = (name, ok) => { checks.push({ name, ok }); if (!ok) throw Error(name); };
try {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.removeItem("oprn:ai-sidebar-collapsed");
  });
  await page.route("**/rest/v1/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/v1/agent/run**", async route => {
    const request = route.request().postDataJSON();
    requests.push({ readOnly: request.readOnly, maxTurns: request.maxTurns, mode: request.mode });
    if (live) { await route.continue(); return; }
    const candidates = JSON.parse(request.task.split("후보: ")[1]);
    const project = request.project;
    project.maps[request.mapIds[0]].name = "UNTRUSTED RESPONSE MUST NOT APPLY";
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: [
      { type: "tool_start", name: "get_database_records", args: {} },
      { type: "assistant", text: JSON.stringify(candidates.map(c => c.id)) },
      { type: "done", project, changedKeys: ["maps." + request.mapIds[0]], stats: { ms: 20, turns: 1, toolCalls: 1, toolErrors: 0 } },
    ].map(e => JSON.stringify(e)).join("\n") + "\n" });
  });
  await page.goto("http://127.0.0.1:9826/?devProject=1&marketTown=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible()) await guest.click();
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 60000 });
  const source = await page.evaluate(async () => (await fetch("/src/editor/panels/aiChatPanel.ts")).text());
  const storeUrl = source.match(/from "([^"]*project\/store[^"]*)"/)[1];
  const initial = await page.evaluate(async ({ storeUrl }) => {
    const { store } = await import(storeUrl);
    const mapId = store.getCurrent().startMapId;
    store.updateMap(mapId, map => {
      map.events.push({ id: "qa-missing-door", name: "동쪽 출구", x: 4, y: 4, trigger: "action",
        commands: [{ kind: "transfer", mapId: "qa-deleted-map", x: 0, y: 0 }] });
    });
    return { mapId, name: store.getCurrent().maps[mapId].name };
  }, { storeUrl });
  const card = page.getByTestId("ai-project-suggestion").filter({ hasText: "이동할 맵" });
  await card.waitFor({ timeout: live ? 65000 : 25000 });
  if (live) check("Live agent completed without local fallback", !(await page.getByTestId("ai-project-suggestions").innerText()).includes("기본 확인 결과"));
  check("Automatic grounded suggestion appears", (await card.innerText()).includes("동쪽 출구"));
  check("Agent runs read-only with bounded turns", requests.length === 1 && requests[0].readOnly === true && requests[0].maxTurns === 4);
  check("Returned project is never applied", await page.evaluate(async ({ storeUrl, initial }) => {
    const { store } = await import(storeUrl);
    return store.getCurrent().maps[initial.mapId].name === initial.name;
  }, { storeUrl, initial }));
  await page.screenshot({ path: out + "/01-suggestions.png" });
  await card.getByRole("button", { name: "위치 보기" }).click();
  check("Locate keeps proposal visible", await card.isVisible());
  await card.getByRole("button", { name: "AI와 이어가기" }).click();
  check("Suggestion fills request with exact target", (await page.getByTestId("ai-input").inputValue()).includes("qa-missing-door"));
  await page.waitForTimeout(2000);
  check("Draft never auto-sends or starts another inspection", requests.length === 1);
  await page.getByTestId("ai-input").fill("");
  await page.setViewportSize({ width: 1024, height: 800 });
  check("Compact suggestion has no horizontal overflow", await card.evaluate(n => n.scrollWidth <= n.clientWidth + 1));
  await page.screenshot({ path: out + "/02-compact.png" });
  await card.getByRole("button", { name: "넘기기" }).click();
  await page.waitForTimeout(2000);
  check("Dismissed suggestion stays dismissed", await card.count() === 0);
  check("No browser errors", errors.length === 0);
  console.log(JSON.stringify({ checks, requests, errors }));
} finally {
  writeFileSync(out + "/report.json", JSON.stringify({ checks, requests, errors }, null, 2));
  await browser.close();
}
