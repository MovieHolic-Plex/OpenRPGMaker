import fs from "node:fs";
import { firefox } from "playwright";
const suffix = process.argv[2] ?? "before";
const out = "output/evidence/interior-catalog-review";
const data = JSON.parse(fs.readFileSync(`${out}/renders-${suffix}.json`));
const audit = JSON.parse(fs.readFileSync(`${out}/audit-${suffix}.json`));
const browser = await firefox.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1800, height: 1500 },
  });
  await page.route("**/__interior_catalog", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><meta charset="utf-8"><body></body>',
    }),
  );
  await page.goto("http://127.0.0.1:19841/__interior_catalog");
  const images = await page.evaluate(async (data) => {
    const { drawMapTileLayers, loadTilesetImage } =
      await import("/src/editor/mapTileDraw.ts");
    const imgs = {};
    for (const t of Object.values(data.tilesets))
      if (data.renders.some((r) => r.map.tilesetId === t.id))
        imgs[t.id] = await loadTilesetImage(t);
    return data.renders.map((r) => {
      const c = document.createElement("canvas");
      c.width = r.map.width * 16;
      c.height = r.map.height * 16;
      drawMapTileLayers(
        c.getContext("2d"),
        imgs[r.map.tilesetId],
        r.map,
        data.tilesets[r.map.tilesetId],
        1,
      );
      return { ...r, map: undefined, png: c.toDataURL() };
    });
  }, data);
  fs.mkdirSync(`${out}/${suffix}`, { recursive: true });
  for (const r of images)
    fs.writeFileSync(
      `${out}/${suffix}/${r.index}.png`,
      Buffer.from(r.png.split(",")[1], "base64"),
    );
  for (let i = 0; i < audit.length; i += 16) {
    const rows = audit.slice(i, i + 16);
    await page.setContent(
      `<style>body{margin:16px;background:#202629;color:#fff;font:16px sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#111719;padding:10px;min-height:260px}img{image-rendering:pixelated;max-width:100%;height:230px;object-fit:contain}small{display:block;color:#bbc}.err{color:#ff9999;overflow-wrap:anywhere}</style><div class="grid"></div>`,
    );
    await page.evaluate(
      ({ rows, images }) => {
        for (const r of rows) {
          const div = document.createElement("div");
          div.className = "card";
          const title = document.createElement("div");
          title.textContent = `${r.index + 1}. ${r.name} (${r.width}×${r.height})`;
          div.append(title);
          const small = document.createElement("small");
          small.textContent = r.id;
          div.append(small);
          const found = images.find((v) => v.index === r.index);
          if (found) {
            const im = document.createElement("img");
            im.src = found.png;
            div.append(im);
          } else {
            const e = document.createElement("p");
            e.className = "err";
            e.textContent = r.error;
            div.append(e);
          }
          document.querySelector(".grid").append(div);
        }
      },
      {
        rows,
        images: images.filter((r) => rows.some((a) => a.index === r.index)),
      },
    );
    await page.screenshot({
      path: `${out}/${suffix}/sheet-${Math.floor(i / 16) + 1}.png`,
      fullPage: true,
    });
  }
  if (suffix === "after") {
    const chosen = images.filter((r) => r.id.startsWith("reviewed-interior:"));
    await page.setContent(
      '<style>body{margin:20px;background:#202629;color:#eee;font:19px sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{padding:14px;background:#111719}img{display:block;image-rendering:pixelated;height:300px;max-width:100%;object-fit:contain;margin:auto}h3{font-size:18px;font-weight:500;margin:0 0 8px}</style><div class="grid"></div>',
    );
    await page.evaluate((rows) => {
      for (const r of rows) {
        const div = document.createElement("div");
        div.className = "card";
        const h = document.createElement("h3");
        h.textContent = r.name;
        const im = document.createElement("img");
        im.src = r.png;
        div.append(h, im);
        document.querySelector(".grid").append(div);
      }
    }, chosen);
    await page
      .locator(".grid")
      .screenshot({ path: `${out}/new-interiors.png` });
  }
  console.log(
    JSON.stringify({
      suffix,
      images: images.length,
      sheets: Math.ceil(audit.length / 16),
    }),
  );
} finally {
  await browser.close();
}
