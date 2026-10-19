// 높이 지형 위 타일 칠하기 위치 실측: 커서·고스트·실제로 쓰인 칸의 어긋남(dx, dy 칸)을 잰다.
// 실제 편집기(dev 서버) + ?blankProject=1 메모리 프로젝트(편집기 store 그대로) — 도구 QA 이며 정본 저장 근거가 아니다.
// 사용: RELIEF_CAPTURE_URL=http://127.0.0.1:<port> RELIEF_OFFSET_OUT=<dir> node scripts/capture/capture-relief-paint-offset.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = process.env.RELIEF_OFFSET_OUT ?? "verify-shots/relief-paint-offset";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-background-networking", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], rows = [];
page.on("pageerror", error => errors.push(error.message));

const W = 40, H = 28, PLATEAU = { x0: 6, x1: 17, y0: 9, y1: 17 };

/** 맵을 다시 깐다: 평지 + (h>0 이면) 고원. relief 는 높이 붓이 만드는 것과 같은 levels 배열이다. */
const seed = (h, levels) => page.evaluate(async ({ h, levels, W, H, P }) => {
  const { createBlankMap } = await import("/src/project/defaults/defaultMaps.ts");
  const { resetMapEditHistory } = await import("/src/editor/mapEditHistory.ts");
  const store = window.__oprnEditorStore, p = store.getCurrent(), map = p.maps[p.startMapId];
  const next = createBlankMap("높이 칠하기 실측", W, H, map.tilesetId, map.tileSize);
  next.id = map.id;
  if (levels) next.relief = { width: W, height: H, levels: levels.slice(), ramps: new Array(W * H).fill(0) };
  else if (h > 0) {
    next.relief = { width: W, height: H, levels: new Array(W * H).fill(0), ramps: new Array(W * H).fill(0) };
    for (let y = P.y0; y <= P.y1; y++) for (let x = P.x0; x <= P.x1; x++) next.relief.levels[y * W + x] = h;
  }
  store.updateMap(map.id, draft => { for (const k of Object.keys(draft)) if (!(k in next)) delete draft[k]; Object.assign(draft, next); }, { label: "실측 맵" });
  resetMapEditHistory();
}, { h, levels, W, H, P: PLATEAU });

const setState = (patch, focus) => page.evaluate(async ({ patch, focus }) => {
  const { editorState } = await import("/src/editor/editorState.ts");
  const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
  const p = window.__oprnEditorStore.getCurrent();
  editorState.set({ currentMapId: p.startMapId, autoConnectMode: false, clusterAssistMode: false, worldmapAutoBackground: false, activePaletteStamp: null, paintShape: "pen", reliefDoodad: null, ...patch });
  if (focus) requestEditorCameraFocus({ mapId: p.startMapId, tileX: focus.x, tileY: focus.y, immediate: true });
}, { patch, focus });

/** 지금 맵 상태: 칸 배열·들림·이벤트. */
const snapshot = () => page.evaluate(async () => {
  const { reliefLiftField, cellLift } = await import("/src/project/relief/screen.ts");
  const p = window.__oprnEditorStore.getCurrent(), m = p.maps[p.startMapId];
  const field = m.relief ? reliefLiftField(m.relief) : null;
  return {
    lower: m.lowerTiles.slice(), upper: m.upperTiles.slice(), tileSize: m.tileSize ?? 16,
    lift: Array.from({ length: m.width * m.height }, (_, i) => field ? cellLift(field, i % m.width, Math.floor(i / m.width)) : 0),
    events: (m.events ?? []).map(e => ({ id: e.id, x: e.x, y: e.y })),
    pendingEvent: (await import("/src/editor/editorState.ts")).editorState.get().pendingEventCoordinate,
    levels: m.relief?.levels?.slice() ?? null,
  };
});

/** 호버 고스트의 표시 칸: 미리보기 레이어의 사각형 표지가 그려진 화면 칸(들림 포함한 실제 화소 위치). */
const ghost = () => page.evaluate(async () => {
  const ts = (() => { const p = window.__oprnEditorStore.getCurrent(); return p.maps[p.startMapId].tileSize ?? 16; })();
  if (typeof window.__oprnEditHoverRects === "function") {
    return window.__oprnEditHoverRects().map(o => ({ x: Math.floor(o.x / ts), y: Math.floor(o.y / ts) }));
  }
  const { getGame } = await import("/src/app/mode.ts");
  const scene = getGame()?.scene.scenes.find(s => s.hoverPreviewLayer);
  return (scene?.hoverPreviewLayer?.list ?? []).filter(o => o.type === "Rectangle").map(o => ({ x: Math.floor(o.x / ts), y: Math.floor(o.y / ts) }));
});

const client = (wx, wy) => page.evaluate(({ wx, wy }) => window.__oprnEditWorldToClient(wx, wy), { wx, wy });
const settle = (ms = 250) => page.waitForTimeout(ms);

/**
 * 셀 (x, y) 의 **보이는 윗면** 가운데를 누른다. 의도한 칸 = (x, y). 커서가 놓인 화면 칸 = (x, y - lift).
 * 반환: 실제로 바뀐 칸과 그 칸까지의 어긋남(논리 dx, dy) · 바뀐 칸이 화면에 보이는 줄과 커서 줄의 어긋남(시각 dy) · 고스트.
 */
async function probe(scenario, x, y, layer, opts = {}) {
  const before = await snapshot(), ts = before.tileSize, lift = before.lift[y * W + x];
  const at = await client((x + .5) * ts, (y + .5 - lift) * ts);
  await page.mouse.move(at.x - 3, at.y - 3); await page.mouse.move(at.x, at.y); await settle(180);
  const g = await ghost();
  if (opts.shot) await page.screenshot({ path: `${out}/${opts.shot}-ghost.png`, clip: { x: Math.round(at.x - 160), y: Math.round(at.y - 120), width: 320, height: 240 } });
  await page.mouse.down(); await page.mouse.up(); await settle(350);
  const after = await snapshot();
  if (layer === "event") { await page.keyboard.press("Escape"); await settle(150); }
  await page.mouse.move(1430, 60); await settle(350);
  if (opts.shot) await page.screenshot({ path: `${out}/${opts.shot}-result.png`, clip: { x: Math.round(at.x - 160), y: Math.round(at.y - 120), width: 320, height: 240 } });
  let changed = [];
  if (layer === "event") {
    const old = new Set(before.events.map(e => e.id));
    changed = after.events.filter(e => !old.has(e.id)).map(e => ({ x: e.x, y: e.y }));
    if (!changed.length && after.pendingEvent) changed = [{ x: after.pendingEvent.x, y: after.pendingEvent.y }];
  } else {
    const a = layer === "upper" ? before.upper : before.lower, b = layer === "upper" ? after.upper : after.lower;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed.push({ x: i % W, y: Math.floor(i / W) });
  }
  // 브러시 크기 > 1 이면 바뀐 칸 묶음의 가운데(정수)로 비교한다.
  const c = changed.length ? { x: Math.round(changed.reduce((s, p) => s + p.x, 0) / changed.length - (opts.centerBias ?? 0)), y: Math.round(changed.reduce((s, p) => s + p.y, 0) / changed.length - (opts.centerBias ?? 0)) } : null;
  const cursorRow = y - lift;
  const gc = g.length ? { x: Math.round(g.reduce((s, p) => s + p.x, 0) / g.length - (opts.centerBias ?? 0)), y: Math.round(g.reduce((s, p) => s + p.y, 0) / g.length - (opts.centerBias ?? 0)) } : null;
  const row = {
    scenario, layer, target: { x, y }, heightUnderCursor: lift, written: c, writtenCount: changed.length,
    dx: c ? c.x - x : null, dy: c ? c.y - y : null,
    visualDy: c ? (c.y - after.lift[c.y * W + c.x]) - cursorRow : null,
    ghostVisualDy: gc ? gc.y - cursorRow : null, ghostDx: gc ? gc.x - x : null,
  };
  rows.push(row); console.log(JSON.stringify(row));
  return row;
}

try {
  await page.goto(`${process.env.RELIEF_CAPTURE_URL ?? "http://127.0.0.1:9833"}/?blankProject=1`, { waitUntil: "load", timeout: 120000 });
  for (let i = 0; ; i++) {
    const ready = await page.evaluate(() => !!(window.__oprnEditWorldToClient && window.__oprnEditorStore)).catch(() => false);
    if (ready) break;
    if (i > 300) throw Error("editor did not boot");
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(3000);
  const welcome = page.getByTestId("editor-welcome-skip"); if (await welcome.isVisible().catch(() => false)) await welcome.click();
  await seed(0); await settle(800);
  const { base, lowerTile, upperTile } = await page.evaluate(async () => {
    const { tileLayerHome } = await import("/src/editor/tileLayerClassification.ts");
    const p = window.__oprnEditorStore.getCurrent(), m = p.maps[p.startMapId], ts = p.tilesets[m.tilesetId];
    const base = m.lowerTiles[0];
    let lowerTile = base === 360 ? 361 : 360, upperTile = 0;
    for (let t = 0; t < 600; t++) {
      const home = tileLayerHome(ts, t);
      if (home === "upper" && !upperTile) upperTile = t;
    }
    return { base, lowerTile, upperTile };
  });
  console.log("tiles", JSON.stringify({ base, lowerTile, upperTile }));

  // (a) 평지 기준선: 격자 무늬 3×3 (간격 3칸), 줌 1·2·3.
  for (const zoom of [1, 2, 3]) {
    await seed(0); await setState({ tool: "paint", layer: "lower", selectedTile: lowerTile, brushSize: 1, zoom }, { x: 12, y: 13 }); await settle(900);
    for (const gy of [10, 13, 16]) for (const gx of [9, 12, 15]) await probe(`flat z${zoom}`, gx, gy, "lower");
  }

  // (b) 고원 h=1..3 × 줌 1..3 × 바닥/덧그림: 고원 안쪽·북쪽 끝 줄·남쪽 끝 줄·평지 칸.
  for (const h of [1, 2, 3]) for (const zoom of [1, 2, 3]) for (const layer of ["lower", "upper"]) {
    await seed(h);
    await setState({ tool: "paint", layer, selectedTile: layer === "upper" ? upperTile : lowerTile, brushSize: 1, zoom }, { x: 12, y: 13 - h }); await settle(900);
    const shot = h === 2 && zoom === 2 ? `h2-z2-${layer}` : undefined;
    for (const [x, y, s] of [[10, 13, shot], [12, 9], [14, 17], [20, 13]]) await probe(`plateau h${h} z${zoom}`, x, y, layer, { shot: s });
  }

  // (c) 스크롤: 같은 h2·줌2 를 카메라 초점 두 곳에서.
  for (const focus of [{ x: 6, y: 5 }, { x: 22, y: 20 }]) {
    await seed(2); await setState({ tool: "paint", layer: "lower", selectedTile: lowerTile, brushSize: 1, zoom: 2 }, focus); await settle(900);
    for (const [x, y] of [[9, 12], [15, 15]]) await probe(`scroll h2 z2 focus${focus.x},${focus.y}`, x, y, "lower");
  }

  // (d) 붓 크기 3(가운데 기준) · 지우개(바닥=빈 칸 아님 → 덧그림에서) · 이벤트.
  await seed(2); await setState({ tool: "paint", layer: "lower", selectedTile: lowerTile, brushSize: 3, zoom: 2 }, { x: 12, y: 11 }); await settle(900);
  await probe("brush3 h2 z2", 11, 13, "lower", { centerBias: 0, shot: "brush3-h2-z2" });
  await seed(2);
  await page.evaluate(async ({ W, P, upperTile }) => {
    const p = window.__oprnEditorStore.getCurrent();
    window.__oprnEditorStore.updateMap(p.startMapId, d => { for (let y = 0; y < 28; y++) for (let x = 0; x < W; x++) d.upperTiles[y * W + x] = upperTile; }, { label: "덧그림 채움" });
  }, { W, P: PLATEAU, upperTile });
  await setState({ tool: "erase", layer: "upper", brushSize: 1, zoom: 2 }, { x: 12, y: 11 }); await settle(900);
  for (const [x, y] of [[10, 13], [13, 9], [20, 13]]) await probe("erase h2 z2", x, y, "upper");
  await seed(2); await setState({ tool: "event", layer: "event", zoom: 1 }, { x: 12, y: 11 }); await settle(900);
  for (const [x, y] of [[10, 13], [20, 13]]) await probe("event h2 z1", x, y, "event");

  // (e) 실제 「높이」 러프 붓으로 올린 지형(S·M 크기, 올리기·산) 위에 칠하기.
  for (const [size, mode, hold] of [["S", "raise", 1200], ["M", "mountain", 200]]) {
    await seed(0); await setState({ tool: "relief", layer: "lower", reliefRoughSize: size, reliefMode: mode, reliefLevel: 3, reliefTopGrass: false, terrainBrush: "height", zoom: 1 }, { x: 20, y: 13 }); await settle(900);
    const at = await client(20.5 * 16, 13.5 * 16);
    await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.up(); await settle(1200);
    const s = await snapshot();
    const hist = {}; for (const v of s.levels ?? []) hist[v] = (hist[v] ?? 0) + 1;
    console.log("brush", size, mode, JSON.stringify(hist));
    await seed(0, s.levels);
    await setState({ tool: "paint", layer: "lower", selectedTile: lowerTile, brushSize: 1, zoom: 2 }, { x: 20, y: 11 }); await settle(900);
    const lifts = (await snapshot()).lift;
    const picks = [];
    for (const want of [3, 2, 1, 0]) {
      const i = lifts.findIndex((v, k) => v === want && Math.abs(k % W - 20) <= 6 && !picks.some(p => Math.abs(p.x - k % W) + Math.abs(p.y - Math.floor(k / W)) < 3));
      if (i >= 0) picks.push({ x: i % W, y: Math.floor(i / W) });
    }
    for (const p of picks) await probe(`real brush ${size}/${mode}`, p.x, p.y, "lower");
  }
  await page.screenshot({ path: `${out}/final.png` });
} finally {
  writeFileSync(`${out}/observations.json`, JSON.stringify({ rows, errors }, null, 2) + "\n");
  await browser.close();
}
console.log("errors", JSON.stringify(errors));
