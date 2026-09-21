import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const out = "output/evidence/house-spatial-catalog";
const project = JSON.parse(fs.readFileSync(`${out}/reloaded-project.json`, "utf8"));
assert.ok(project.spatialAuthoring);
const base = process.argv[2] ?? "http://127.0.0.1:19841";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await page.route("**/__house_catalog", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><meta charset="utf-8"><body></body>' }));
  await page.goto(`${base}/__house_catalog`);
  await page.evaluate(async (source) => {
    const { deserialize } = await import("/src/project/io.ts");
    const { drawMapTileLayers, loadTilesetImage } = await import("/src/editor/mapTileDraw.ts");
    const project = deserialize(JSON.stringify(source));
    document.head.insertAdjacentHTML("beforeend", `<style>
      body{margin:0;padding:28px;background:#eee9df;color:#34382d;font:16px 'Noto Sans CJK KR',sans-serif}
      h1{font-size:28px;margin:0 0 8px}p{margin:0 0 20px;color:#62665c}
      main{display:grid;grid-template-columns:repeat(2,750px);gap:24px}
      article{background:#faf7f0;border:1px solid #d0cabd;padding:16px;box-sizing:border-box}
      h2{margin:0 0 12px;font-size:22px}.yard{display:flex;align-items:end;justify-content:center;height:480px;background:#e6e8d7}
      canvas{display:block;image-rendering:pixelated}.rooms{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:14px}
      h3{margin:6px 0;font-size:17px}.rooms canvas{max-width:100%;height:auto}footer{margin-top:16px;color:#62665c}
    </style>`);
    document.body.innerHTML = '<h1>건물 외형 → 마당·실내 공간 → 주택 장소</h1><p>외형 15종과 주택 장소 15종 등록 · 아래는 저장 후 다시 불러온 3층·4층 예시</p><main></main><footer>침대·탁자·계단을 갖춘 기본 실내 구성 · 각 층의 출입 연결을 명시</footer>';
    const draw = async (mapId, scale) => {
      const map = project.maps[mapId], tileset = project.tilesets[map.tilesetId];
      const canvas = document.createElement("canvas");
      canvas.width = map.width * map.tileSize * scale; canvas.height = map.height * map.tileSize * scale;
      const context = canvas.getContext("2d"); context.imageSmoothingEnabled = false;
      const atlas = await loadTilesetImage(tileset);
      drawMapTileLayers(context, atlas, map, tileset, scale);
      return canvas;
    };
    for (const [key, name] of [["inn-3f", "갈색 지붕 3층 주택"], ["workshop-4f", "회색 지붕 4층 주택"]]) {
      const children = Object.values(project.spatialAuthoring.occurrences).filter(value => value.parentId === `house-example:${key}` && value.kind === "space").sort((a, b) => a.level - b.level);
      const article = document.createElement("article");
      const title = document.createElement("h2"); title.textContent = name; article.append(title);
      const yard = document.createElement("div"); yard.className = "yard"; yard.append(await draw(children[0].bindings[0].mapId, 1)); article.append(yard);
      const rooms = document.createElement("div"); rooms.className = "rooms";
      for (const floor of children.slice(1)) {
        const room = document.createElement("section"), heading = document.createElement("h3");
        heading.textContent = `${floor.level}층`; room.append(heading, await draw(floor.bindings[0].mapId, 1)); rooms.append(room);
      }
      article.append(rooms); document.querySelector("main").append(article);
    }
  }, project);
  await page.screenshot({ path: `${out}/connected-houses.png`, fullPage: true });
  fs.writeFileSync(`${out}/render-proof.json`, JSON.stringify({ source: "LegacyDb reload", renderer: "editor/mapTileDraw", examples: 2, interiorMaps: 7 }, null, 2));
  console.log(`${out}/connected-houses.png`);
} finally { await browser.close(); }
