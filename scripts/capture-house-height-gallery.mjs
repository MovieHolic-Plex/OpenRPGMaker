import fs from "node:fs";
import { chromium } from "playwright";
const out = "output/evidence/house-heights";
const source = process.argv.includes("--reloaded") ? "reloaded-project.json" : "preview-project.json";
const project = JSON.parse(fs.readFileSync(`${out}/${source}`, "utf8"));
const manifest = JSON.parse(fs.readFileSync(`${out}/studies.json`, "utf8"));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2496, height: 920 }, deviceScaleFactor: 1 });
  await page.route("**/__house_heights", route => route.fulfill({ contentType: "text/html", body: '<html><meta charset="utf-8"><body></body></html>' }));
  await page.goto("http://127.0.0.1:19841/__house_heights");
  const rendered = await page.evaluate(async ({ project, manifest }) => {
    const { deserialize } = await import("/src/project/io.ts");
    const { drawMapTileLayers, loadTilesetImage } = await import("/src/editor/mapTileDraw.ts");
    const p = deserialize(JSON.stringify(project)), map = p.maps[manifest.mapId], tileset = p.tilesets[map.tilesetId];
    const atlas = await loadTilesetImage(tileset);
    const full = document.createElement("canvas");
    full.width = map.width*16; full.height = map.height*16;
    const ctx = full.getContext("2d"); ctx.imageSmoothingEnabled = false;
    drawMapTileLayers(ctx, atlas, map, tileset, 1);
    document.head.insertAdjacentHTML("beforeend", '<style>body{margin:0;font-family:"Noto Sans CJK KR",sans-serif;background:#eee9df;color:#34382d}#gallery{width:2496px}.family{display:grid;grid-template-columns:repeat(3,832px)}article{border:1px solid #d6d1c5;box-sizing:border-box;background:#f8f5ef;height:884px}canvas{display:block;image-rendering:pixelated}h2{font-size:24px;margin:15px 24px 3px}p{font-size:16px;color:#676d60;margin:0 24px}</style>');
    const gallery = document.createElement("main"); gallery.id = "gallery"; document.body.append(gallery);
    for (const family of [11,12]) {
      const section = document.createElement("section"); section.className = "family"; section.id = `family-${family}`; gallery.append(section);
      for (const item of manifest.placements.filter(item => item.family === family)) {
        const card = document.createElement("article"), canvas = document.createElement("canvas");
        canvas.width = 830; canvas.height = 800;
        const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false;
        for(let y=0;y<800;y+=32)for(let x=0;x<830;x+=32)c.drawImage(full,0,0,16,16,x,y,32,32);
        // All six houses use 2× integer scale and a common ground line.
        c.drawImage(full,(item.x-1)*16,(item.y-1)*16,(item.width+2)*16,(item.height+2)*16,
          Math.floor((830-(item.width+2)*32)/2),800-(item.height+2)*32,(item.width+2)*32,(item.height+2)*32);
        card.dataset.family=String(family);card.dataset.floors=String(item.floors);card.append(canvas);
        const title = document.createElement("h2"); title.textContent = item.name; card.append(title);
        const detail = document.createElement("p"); detail.textContent = `${item.width} × ${item.height}칸 · ${item.floors === 2 ? "기준 집" : "새로 만든 집"}`; card.append(detail);
        section.append(card);
      }
    }
    return full.toDataURL("image/png");
  }, { project, manifest });
  await page.locator("#gallery").screenshot({ path: `${out}/height-comparison.png` });
  for (const family of [11,12]) await page.locator(`#family-${family}`).screenshot({ path: `${out}/family-${family}.png` });
  await page.evaluate(()=>{
    const grid=document.createElement('section');grid.id='corrected';grid.className='family';grid.style.gridTemplateColumns='repeat(2,832px)';grid.style.width='1664px';
    for(const family of [11,12])for(const floors of [3,4]){
      const source=document.querySelector(`article[data-family="${family}"][data-floors="${floors}"]`);
      const copy=source.cloneNode(true);copy.querySelector('canvas').getContext('2d').drawImage(source.querySelector('canvas'),0,0);grid.append(copy);
    }
    document.body.append(grid);
  });
  await page.locator('#corrected').screenshot({path:`${out}/corrected-3-4.png`});
  fs.writeFileSync(`${out}/gallery-map.png`, Buffer.from(rendered.split(",")[1], "base64"));
  fs.writeFileSync(`${out}/index.html`, '<!doctype html><meta charset="utf-8"><title>2층 · 3층 · 4층 비교</title><style>body{margin:30px auto;max-width:1800px;background:#eee9df;color:#34382d;font-family:sans-serif}img{width:100%;image-rendering:pixelated}h1{font-size:26px}</style><h1>11·12번 구조 — 2층 / 3층 / 4층</h1><p>같은 배율, 같은 지면 높이에서 비교한 실제 에디터 타일 렌더링.</p><img alt="층수 비교" src="data:image/png;base64,' + fs.readFileSync(`${out}/height-comparison.png`).toString("base64") + '">');
  fs.writeFileSync(`${out}/render-proof.json`, JSON.stringify({ source, renderer: "editor/mapTileDraw", integerScale: 2, comparedHouses: 6, mapId: manifest.mapId }, null, 2));
  console.log(JSON.stringify({ source, output: `${out}/height-comparison.png` }));
} finally { await browser.close(); }
