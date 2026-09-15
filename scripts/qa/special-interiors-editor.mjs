import fs from "node:fs";
import assert from "node:assert/strict";
import { firefox } from "playwright";
const out = "output/evidence/special-interiors";
const expected = JSON.parse(fs.readFileSync(`${out}/reloaded-project.json`));
const maps = Object.values(expected.maps).filter(
  (m) => m.roomHarnessPlan && m.id.includes("special-interior:example:"),
);
const browser = await firefox.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/rest\/v1\/(projects|spatial_|project_)/, (r) =>
    ["GET", "HEAD", "OPTIONS"].includes(r.request().method())
      ? r.continue()
      : r.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
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
    maps[0].id,
    { timeout: 120000 },
  );
  const rows = [];
  for (const m of maps) {
    const result = await page.evaluate(async (id) => {
      const { store } = await import("/src/project/store.ts");
      const { editorState } = await import("/src/editor/editorState.ts");
      const { getGame } = await import("/src/app/mode.ts");
      const { requestEditorCameraFocus } =
        await import("/src/editor/editorCameraFocus.ts");
      if (store !== window.__oprnEditorStore)
        throw Error("Stale editor module");
      const scene = getGame().scene.getScene("EditScene");
      editorState.set({ currentMapId: id, zoom: 2 });
      await new Promise((r) => scene.game.events.once("postrender", r));
      const map = store.getCurrent().maps[id];
      requestEditorCameraFocus({
        mapId: id,
        tileX: map.width / 2,
        tileY: map.height / 2,
        bounds: { x: 0, y: 0, width: map.width, height: map.height },
      });
      await new Promise((r) => scene.game.events.once("postrender", r));
      const { drawMapTileLayers, loadTilesetImage } =
        await import("/src/editor/mapTileDraw.ts");
      const t = store.getCurrent().tilesets[map.tilesetId],
        image = await loadTilesetImage(t);
      const canvas = document.createElement("canvas");
      canvas.width = map.width * 16 * 2;
      canvas.height = map.height * 16 * 2;
      drawMapTileLayers(canvas.getContext("2d"), image, map, t, 2);
      return {
        map,
        remote: store.isRemotePersistenceEnabled(),
        png: canvas.toDataURL(),
      };
    }, m.id);
    assert.deepEqual(result.map, m);
    assert.equal(result.remote, true);
    const key = m.id.includes(":shop")
      ? "shop"
      : m.id.includes("floor-2")
        ? "inn-guests"
        : "inn-lobby";
    await page.screenshot({ path: `${out}/${key}-editor.png`, fullPage: true });
    fs.writeFileSync(
      `${out}/${key}.png`,
      Buffer.from(result.png.split(",")[1], "base64"),
    );
    rows.push({ key, name: m.name, mapId: m.id, src: result.png });
  }
  assert.deepEqual(errors, []);
  await page.setContent(
    '<style>body{margin:0;background:#17221e;color:#eee;font:20px system-ui}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:18px}.card{background:#0c1511;padding:14px;border-radius:10px}h2{font-size:20px;margin:0 0 12px}img{display:block;width:100%;height:410px;object-fit:contain;image-rendering:pixelated}</style><div class="grid"></div>',
  );
  await page.evaluate((rows) => {
    for (const r of rows) {
      const a = document.createElement("article");
      a.className = "card";
      const h = document.createElement("h2");
      h.textContent = r.name;
      const img = new Image();
      img.src = r.src;
      a.append(h, img);
      document.querySelector(".grid").append(a);
    }
  }, rows);
  await page.evaluate(
    async () => await Promise.all([...document.images].map((i) => i.decode())),
  );
  await page.locator(".grid").screenshot({ path: `${out}/overview.png` });
  fs.writeFileSync(
    `${out}/editor-proof.json`,
    JSON.stringify(
      {
        projectId: "rpg-zzu-house-template-gallery",
        mapIds: maps.map((m) => m.id),
        mapMatchesRemote: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Saved editor maps verified and screenshots captured");
} finally {
  await browser.close();
}
