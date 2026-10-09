/** Read-only editor map art export from a project snapshot. This does not run the game.
 * node scripts/capture-authored-village.mjs --project snapshot.json --map map_village
 *   --out output/evidence/village --base http://127.0.0.1:19851 --rect 10,20,24,18
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium, firefox } from "playwright";

const HELP = `Usage: node scripts/capture-authored-village.mjs --project <json> --map <id>
  [--out <directory>] [--base <vite-origin>] [--rect x,y,w,h ...]

Required: --project is a saved project JSON snapshot; --map selects its map.
Defaults: --out output/evidence/authored-village, --base http://127.0.0.1:9999
Repeat --rect to export multiple detail regions in tile coordinates.
Outputs: map-full.png (native pixels), map-overview.png, detail-01.png, index.html,
         render-proof.json (source hash, dimensions and browser error counts).
This reads the snapshot and editor tile renderer only; it does not save project data.
`;

function options(args) {
  const result = { out: "output/evidence/authored-village", base: "http://127.0.0.1:9999", rects: [] };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--help" || flag === "-h") return null;
    assert.ok(["--project", "--map", "--out", "--base", "--rect"].includes(flag), `Unknown option: ${flag}`);
    const value = args[++i];
    assert.ok(value && !value.startsWith("--"), `Missing value for ${flag}`);
    if (flag === "--rect") {
      assert.match(value, /^\d+,\d+,[1-9]\d*,[1-9]\d*$/, "--rect requires nonnegative x,y and positive w,h integers");
      const [x, y, width, height] = value.split(",").map(Number);
      assert.ok([x, y, width, height].every(Number.isSafeInteger), "--rect coordinate exceeds safe integer range");
      result.rects.push({ x, y, width, height });
    } else result[flag.slice(2)] = value;
  }
  assert.ok(result.project && result.map, "--project and --map are required; use --help");
  const origin = new URL(result.base);
  assert.ok(["http:", "https:"].includes(origin.protocol) && !origin.username && !origin.password, "--base must be an HTTP(S) origin");
  assert.ok(origin.pathname === "/" && !origin.search && !origin.hash, "--base must be an origin without a path or query");
  result.base = origin.origin;
  return result;
}

const sha256 = text => createHash("sha256").update(text).digest("hex");
const escapeHtml = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
// Image URLs can contain expiring access parameters. Evidence needs the path only.
function diagnostic(value) {
  return String(value).replace(/https?:\/\/[^\s"'<>]+/g, raw => {
    try { const url = new URL(raw); return `${url.origin}${url.pathname}`; } catch { return raw.split("?")[0]; }
  }).replace(/data:[^\s]+/g, "[data URL]").slice(0, 2000);
}

function inspectorHtml(rendered) {
  const name = escapeHtml(rendered.name), mapId = escapeHtml(rendered.mapId);
  const details = rendered.details.map((detail, i) => {
    const file = `detail-${String(i + 1).padStart(2, "0")}.png`;
    return `<article><h2>상세 ${i + 1} · (${detail.x}, ${detail.y}) ${detail.width}×${detail.height}칸</h2>
      <div class="detail"><a href="${file}" target="_blank"><img src="${file}" width="${detail.pixelWidth * 2}" height="${detail.pixelHeight * 2}" alt="${name} 상세 ${i + 1}"></a></div>
      <p><a href="${file}" target="_blank">상세 원본 PNG 열기</a></p></article>`;
  }).join("\n");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>${name} · 마을 지도</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eeeae1;color:#29392d;font:16px system-ui,sans-serif}
    main{max-width:1480px;margin:auto;padding:24px}h1{margin:0 0 8px;font-size:28px}h2{font-size:20px}
    p{line-height:1.5}a{color:#155d51}nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:18px 0}
    button,a.action{padding:9px 14px;border:1px solid #9eaa98;border-radius:6px;background:#fffdf6;color:#244c35;cursor:pointer;font:inherit}
    button[aria-pressed=true]{background:#244c35;color:white}.map-frame{max-height:80vh;overflow:auto;background:#e0e6d5;border:1px solid #bcc6b3}
    #map{display:block;image-rendering:pixelated;max-width:none}.map-frame.fit{display:flex;justify-content:center}
    .map-frame.fit #map{width:auto;height:auto;max-width:100%;max-height:75vh}
    .caption{color:#536451;font-size:14px}article{padding:16px;margin:20px 0;background:#fbf8f0;border:1px solid #c5cdbd}
    .detail{overflow:auto;max-height:80vh}.detail img{display:block;max-width:none;image-rendering:pixelated}
    </style><main><h1>${name}</h1><p>${rendered.width}×${rendered.height}칸 · 원본 ${rendered.pixelWidth}×${rendered.pixelHeight}px</p>
    <nav aria-label="지도 확대"><button data-scale="fit" aria-pressed="true">전체 보기</button><button data-scale="1" aria-pressed="false">1배</button>
    <button data-scale="2" aria-pressed="false">2배</button><button data-scale="4" aria-pressed="false">4배</button>
    <a class="action" href="map-full.png" target="_blank">원본 PNG 열기</a><a class="action" href="map-full.png" download>원본 받기</a></nav>
    <div class="map-frame fit"><img id="map" src="map-full.png" width="${rendered.pixelWidth}" height="${rendered.pixelHeight}" alt="${name} 전체 지도"></div>
    <p class="caption">확대하면 지도 안에서 스크롤할 수 있습니다. <a href="map-overview.png" target="_blank">전체보기 PNG</a> · 맵 ID: ${mapId}</p>
    ${details}<p class="caption"><a href="render-proof.json">렌더 기록</a> · 저장 스냅샷의 편집기 타일 그림입니다.</p></main>
    <script>const frame=document.querySelector('.map-frame'),img=document.querySelector('#map');
    for(const button of document.querySelectorAll('[data-scale]'))button.addEventListener('click',()=>{
      const fit=button.dataset.scale==='fit';frame.classList.toggle('fit',fit);
      img.style.width=fit?'':String(${rendered.pixelWidth}*Number(button.dataset.scale))+'px';img.style.height='auto';
      for(const other of document.querySelectorAll('[data-scale]'))other.setAttribute('aria-pressed',String(other===button));
    });</script></html>`;
}

async function main() {
  const opts = options(process.argv.slice(2));
  if (!opts) { console.log(HELP); return; }
  const sourcePath = path.resolve(opts.project), out = path.resolve(opts.out);
  const sourceText = fs.readFileSync(sourcePath, "utf8"), project = JSON.parse(sourceText);
  const sourceMap = project.maps?.[opts.map];
  assert.ok(sourceMap, `Map ${opts.map} is not in the snapshot`);
  for (const rect of opts.rects) assert.ok(rect.x + rect.width <= sourceMap.width && rect.y + rect.height <= sourceMap.height, `Detail rectangle is outside ${sourceMap.width}×${sourceMap.height}: ${JSON.stringify(rect)}`);
  const files = ["map-full.png", "map-overview.png", "index.html", "render-proof.json", ...opts.rects.map((_, i) => `detail-${String(i + 1).padStart(2, "0")}.png`)];
  assert.ok(!files.some(file => path.join(out, file) === sourcePath), "Output would overwrite the project snapshot");
  fs.mkdirSync(out, { recursive: true });
  const errors = { page: [], console: [], requests: [], responses: [] };
  const proof = { source: sourcePath, sourceSHA256: sha256(sourceText), mapId: opts.map,
    renderer: "editor/mapTileDraw", base: opts.base, status: "failed", startedAt: new Date().toISOString() };
  let browser;
  try {
    browser = await (process.env.QA_BROWSER === "firefox" ? firefox : chromium).launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(30000);
    page.on("pageerror", error => errors.page.push(diagnostic(error.message)));
    page.on("console", message => { if (message.type() === "error") errors.console.push(diagnostic(message.text())); });
    page.on("requestfailed", request => errors.requests.push({ url: diagnostic(request.url()), error: diagnostic(request.failure()?.errorText ?? "request failed") }));
    page.on("response", response => { if (response.status() >= 400) errors.responses.push({ url: diagnostic(response.url()), status: response.status() }); });
    await page.route("**/__authored_village_capture", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><meta charset="utf-8"><body></body>' }));
    await page.goto(`${opts.base}/__authored_village_capture`, { waitUntil: "domcontentloaded" });
    const rendered = await page.evaluate(async ({ project, mapId, rects }) => {
      const { deserialize } = await import("/src/project/io.ts");
      const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
      const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
      const p = deserialize(JSON.stringify(project)), map = p.maps[mapId];
      if (!map) throw new Error(`Map ${mapId} missing after deserialization`);
      const tileset = p.tilesets[map.tilesetId];
      if (!tileset || tileset.tileSize !== map.tileSize) throw new Error("Map and tileset must have the same tile size");
      // Uploaded atlases resolve through the snapshot, not the (empty) editor store: the store fallback
      // silently drew the default sheet, so an uploaded-tileset map captured as solid black.
      const atlas = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Tileset atlas failed to load"));
        image.src = tilesetBaseImageUrl(tileset, p);
      });
      const canvas = document.createElement("canvas");
      canvas.width = map.width * map.tileSize; canvas.height = map.height * map.tileSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to allocate the full map canvas");
      ctx.imageSmoothingEnabled = false;
      drawMapTileLayers(ctx, atlas, map, tileset, 1);
      const fullPng = canvas.toDataURL("image/png");
      if (!fullPng.startsWith("data:image/png;base64,")) throw new Error("Full map canvas exceeded browser image limits");
      const overview = document.createElement("canvas"), scale = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
      overview.width = Math.max(1, Math.round(canvas.width * scale)); overview.height = Math.max(1, Math.round(canvas.height * scale));
      const overviewCtx = overview.getContext("2d"); overviewCtx.imageSmoothingEnabled = false;
      overviewCtx.drawImage(canvas, 0, 0, overview.width, overview.height);
      const details = rects.map(rect => {
        const detail = document.createElement("canvas"); detail.width = rect.width * map.tileSize; detail.height = rect.height * map.tileSize;
        const detailCtx = detail.getContext("2d"); detailCtx.imageSmoothingEnabled = false;
        detailCtx.drawImage(canvas, rect.x * map.tileSize, rect.y * map.tileSize, detail.width, detail.height, 0, 0, detail.width, detail.height);
        return { ...rect, pixelWidth: detail.width, pixelHeight: detail.height, png: detail.toDataURL("image/png") };
      });
      return { mapId, name: map.name || mapId, width: map.width, height: map.height, tileSize: map.tileSize,
        pixelWidth: canvas.width, pixelHeight: canvas.height, overviewWidth: overview.width, overviewHeight: overview.height,
        fullPng, overviewPng: overview.toDataURL("image/png"), details };
    }, { project, mapId: opts.map, rects: opts.rects });
    const writePng = (file, data) => fs.writeFileSync(path.join(out, file), Buffer.from(data.split(",")[1], "base64"));
    writePng("map-full.png", rendered.fullPng); writePng("map-overview.png", rendered.overviewPng);
    rendered.details.forEach((detail, i) => writePng(`detail-${String(i + 1).padStart(2, "0")}.png`, detail.png));
    fs.writeFileSync(path.join(out, "index.html"), inspectorHtml(rendered));
    Object.assign(proof, { mapName: rendered.name, tiles: { width: rendered.width, height: rendered.height, size: rendered.tileSize },
      nativePixels: { width: rendered.pixelWidth, height: rendered.pixelHeight }, overviewPixels: { width: rendered.overviewWidth, height: rendered.overviewHeight },
      rects: opts.rects, files, sourceUnchanged: sha256(fs.readFileSync(sourcePath, "utf8")) === proof.sourceSHA256 });
    assert.ok(proof.sourceUnchanged, "Source snapshot changed during capture");
    assert.equal(Object.values(errors).reduce((sum, list) => sum + list.length, 0), 0, "Browser errors occurred; inspect render-proof.json");
    proof.status = "passed";
    console.log(JSON.stringify({ mapId: opts.map, output: out, nativePixels: proof.nativePixels, details: opts.rects.length, browserErrors: 0 }));
  } catch (error) {
    proof.failure = diagnostic(error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
    proof.completedAt = new Date().toISOString();
    proof.browserErrorCounts = Object.fromEntries(Object.entries(errors).map(([kind, list]) => [kind, list.length]));
    proof.browserErrorCount = Object.values(proof.browserErrorCounts).reduce((sum, count) => sum + count, 0);
    proof.browserErrors = errors;
    fs.writeFileSync(path.join(out, "render-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  }
}

main().catch(error => { console.error(diagnostic(error.message)); process.exitCode = 1; });
