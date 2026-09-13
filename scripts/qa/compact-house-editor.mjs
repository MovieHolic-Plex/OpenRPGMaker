import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, firefox } from "playwright";
const out = "output/evidence/compact-interior",
  expected = JSON.parse(
    fs.readFileSync(`${out}/reloaded-project.json`, "utf8"),
  );
const mapId = "spatial:child:32:compact-interior:example:cottage7:floor-1:0";
const browserType = process.env.QA_BROWSER === "firefox" ? firefox : chromium;
const browser = await browserType.launch({
  ...(browserType === chromium
    ? { args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] }
    : {}),
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [],
    writes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(
    /\/(?:rest\/v1\/(?:projects|spatial_|project_)|rpc\/(?:commit|save|upsert))/,
    (route) => {
      const r = route.request(),
        u = new URL(r.url());
      if (
        !["GET", "HEAD", "OPTIONS"].includes(r.method()) &&
        (/\/rest\/v1\/(?:projects|spatial_|project_)/.test(u.pathname) ||
          /\/rpc\/(?:commit|save|upsert)/.test(u.pathname))
      ) {
        writes.push(u.pathname);
        return route.abort();
      }
      return route.continue();
    },
  );
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
    for (const k of [
      "oprn:editor-welcome-dismissed",
      "oprn:standard-welcome-seen",
      "oprn:coachmarks-basic-v1",
    ])
      localStorage.setItem(k, "1");
  });
  await page.goto(
    "http://127.0.0.1:19841/?project=rpg-zzu-house-template-gallery",
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForFunction(
    (id) =>
      !!window.__oprnEditorStore?.getCurrent()?.maps[id] &&
      !!window.__oprnEditWorldToClient,
    mapId,
    { timeout: 120000 },
  );
  const data = await page.evaluate(async (mapId) => {
    const { store } = await import("/src/project/store.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { requestEditorCameraFocus } = await import(
      "/src/editor/editorCameraFocus.ts"
    );
    const { getGame } = await import("/src/app/mode.ts");
    if (store !== window.__oprnEditorStore) throw Error("Different store");
    editorState.set({ currentMapId: mapId, zoom: 3 });
    const scene = getGame().scene.getScene("EditScene");
    await new Promise((r) => scene.game.events.once("postrender", r));
    const map = store.getCurrent().maps[mapId];
    requestEditorCameraFocus({
      mapId,
      tileX: map.width / 2,
      tileY: map.height / 2,
      bounds: { x: 0, y: 0, width: map.width, height: map.height },
    });
    await new Promise((r) => scene.game.events.once("postrender", r));
    return {
      map,
      space:
        store.getCurrent().spatialAuthoring.library.spaces[
          "house-catalog:room:single"
        ],
      remote: store.isRemotePersistenceEnabled(),
    };
  }, mapId);
  assert.deepEqual(data.map, expected.maps[mapId]);
  assert.equal(data.space.width, 8);
  assert.equal(data.space.height, 6);
  assert.equal(data.remote, true);
  await page.screenshot({ path: `${out}/editor-interior.png`, fullPage: true });
  await page.evaluate(async () => {
    const { openDatabaseModal } = await import(
      "/src/editor/panels/databaseModal.ts"
    );
    openDatabaseModal("spatialSpaces");
  });
  await page
    .getByTestId("composition-design")
    .selectOption({ label: "작은 단층집 · 취사·식사·수면" });
  await page.getByTestId("composition-board").waitFor({ state: "visible" });
  assert.equal(await page.getByTestId("composition-width").inputValue(), "12");
  assert.equal(await page.getByTestId("composition-height").inputValue(), "12");
  assert.equal(
    await page.locator('[data-testid^="composition-member-"]').count(),
    8,
  );
  await page.getByText("기존 설계와 생성 규칙", { exact: true }).click();
  assert.equal(await page.getByTestId("spatial-space-width").inputValue(), "8");
  assert.equal(
    await page.getByTestId("spatial-space-height").inputValue(),
    "6",
  );
  await page.screenshot({ path: `${out}/editor-space.png`, fullPage: true });
  assert.deepEqual(errors, []);
  assert.ok(writes.every((p) => p === "/rest/v1/project_commits"));
  fs.writeFileSync(
    `${out}/editor-proof.json`,
    JSON.stringify(
      {
        projectId: "rpg-zzu-house-template-gallery",
        mapId,
        remoteEnabled: data.remote,
        mapMatchesSaved: true,
        spaceWidth: 8,
        spaceHeight: 6,
        errors,
        blockedWrites: writes,
      },
      null,
      2,
    ),
  );
  console.log("Editor verified");
} finally {
  await browser.close();
}
