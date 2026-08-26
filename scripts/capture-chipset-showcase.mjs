// 6종 칩셋으로 실제 맵을 만들어 에디터/런타임 스크린샷을 모은다.
//
// 왜 이렇게 만드는가: 타일을 무작위로 칠하면 "칩셋이 무엇을 담고 있는지" 가 드러나지 않는다.
// 이 스크립트는 내가 저작한 시맨틱(role/passage)을 역으로 이용해 타일을 고른다 —
// role=water 인 칸으로 못을 파고, role=wall 로 건물을 세우고, role=roof 를 얹고,
// 투명 소품(passage=solid)들을 상위 레이어에 배치한다. 라벨이 맞다면 장면이 자연스럽게 나오고,
// 틀렸다면 그림이 어그러져 눈에 띈다. 즉 이 스크린샷 자체가 라벨 품질의 육안 검사다.
//
// 사용: node scripts/capture-chipset-showcase.mjs --base http://127.0.0.1:9843 --out .omo/evidence/showcase

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const base = val("--base", "http://127.0.0.1:9843");
const outDir = val("--out", ".omo/evidence/showcase");

const picks = JSON.parse(fs.readFileSync(".omo/evidence/scene-picks.json", "utf8"));

const SHEETS = [
  { key: "retro_dungeon", tilesetId: "easyrpg_chipset_retro_dungeon", ko: "레트로 던전" },
  { key: "retro_exterior", tilesetId: "easyrpg_chipset_retro_exterior", ko: "레트로 외부" },
  { key: "retro_house", tilesetId: "easyrpg_chipset_retro_house", ko: "레트로 주택" },
  { key: "retro_world", tilesetId: "easyrpg_chipset_retro_world", ko: "레트로 월드맵" },
  { key: "ship", tilesetId: "easyrpg_chipset_ship", ko: "배" },
  { key: "world", tilesetId: "easyrpg_chipset_world", ko: "월드맵" },
];

const log = [];
const shots = [];
function step(m) { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; log.push(l); console.log(l); }

async function shoot(page, name, caption, meta) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ file: path.resolve(file), name, caption, ...meta });
  step(`shot ${name} — ${caption}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") step(`console error: ${m.text().slice(0, 120)}`); });

  try {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    });
    step(`goto ${base}/?blankProject=1`);
    await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 });
    for (const id of ["standard-welcome-start", "coach-mark-skip"]) {
      const b = page.getByTestId(id);
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(300); }
    }
    const ai = page.getByTestId("ai-collapse");
    if (await ai.isVisible().catch(() => false)) { await ai.click().catch(() => {}); await page.waitForTimeout(300); }

    await shoot(page, "00-editor-blank.png", "빈 프로젝트로 띄운 에디터", { sheet: "-", kind: "overview" });

    for (const sheet of SHEETS) {
      const p = picks[sheet.key];
      const built = await page.evaluate(
        async ({ tilesetId, ko, p }) => {
          const actions = await import("/src/editor/actions.ts");
          const { store } = await import("/src/project/store.ts");
          const idx = (arr, n) => (arr && arr[n] ? arr[n].i : arr && arr[0] ? arr[0].i : 0);
          const g0 = idx(p.ground, 0), g1 = idx(p.ground, 1), g2 = idx(p.ground, 2);
          const w0 = idx(p.water, 0), w1 = idx(p.water, 1);
          const wl = idx(p.wall, 0), wl2 = idx(p.wall, 1), wl3 = idx(p.wall, 2);
          const rf = p.roof.length ? idx(p.roof, 0) : wl2;
          const dr = p.door.length ? idx(p.door, 0) : wl3;
          const props = (p.prop || []).map((e) => e.i);

          function fill(mapId, tile) {
            store.update((d) => { const m = d.maps[mapId]; if (!m) return;
              for (let i = 0; i < m.lowerTiles.length; i += 1) m.lowerTiles[i] = tile; });
          }
          function rect(mapId, x, y, w, h, tile, upper) {
            store.update((d) => { const m = d.maps[mapId]; if (!m) return;
              const layer = upper ? m.upperTiles : m.lowerTiles;
              if (!layer) return;
              for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) {
                if (xx < 0 || yy < 0 || xx >= m.width || yy >= m.height) continue;
                layer[yy * m.width + xx] = tile;
              } });
          }
          function put(mapId, x, y, tile, upper) { rect(mapId, x, y, 1, 1, tile, upper); }

          // 장면 A — 지형과 물: 바탕을 깔고 못을 파고 길을 낸다.
          const aId = actions.addMap(`${ko} · 지형과 물`, 20, 14, tilesetId, g0);
          actions.setMapTileset(aId, tilesetId);
          fill(aId, g0);
          rect(aId, 1, 1, 7, 5, w0);
          rect(aId, 2, 2, 5, 3, w1);
          rect(aId, 0, 8, 20, 2, g1);
          rect(aId, 12, 1, 7, 5, g2);
          props.slice(0, 5).forEach((t, k) => put(aId, 13 + k, 11, t));

          // 장면 B — 건축: 벽을 세우고 지붕을 얹고 문을 낸다.
          const bId = actions.addMap(`${ko} · 건축`, 20, 14, tilesetId, g0);
          actions.setMapTileset(bId, tilesetId);
          fill(bId, g0);
          rect(bId, 3, 6, 6, 4, wl);
          rect(bId, 3, 4, 6, 2, rf);
          put(bId, 5, 9, dr);
          rect(bId, 12, 6, 5, 4, wl2);
          rect(bId, 12, 4, 5, 2, rf);
          put(bId, 14, 9, dr);
          rect(bId, 0, 11, 20, 1, wl3);
          props.slice(0, 6).forEach((t, k) => put(bId, 2 + k * 3, 2, t));

          // 장면 C — 소품 전시: 저작한 소품을 격자로 늘어놓아 하나하나 보이게 한다.
          const cId = actions.addMap(`${ko} · 소품 전시`, 20, 14, tilesetId, g0);
          actions.setMapTileset(cId, tilesetId);
          fill(cId, g0);
          props.forEach((t, k) => put(cId, 2 + (k % 6) * 3, 2 + Math.floor(k / 6) * 3, t));

          actions.setStartMap(aId);
          actions.setStartPos(10, 10);
          return { aId, bId, cId,
            labels: {
              ground: p.ground.slice(0, 3).map((e) => `${e.i} ${e.l}`),
              water: p.water.slice(0, 2).map((e) => `${e.i} ${e.l}`),
              wall: p.wall.slice(0, 3).map((e) => `${e.i} ${e.l}`),
              roof: p.roof.slice(0, 2).map((e) => `${e.i} ${e.l}`),
              door: p.door.slice(0, 2).map((e) => `${e.i} ${e.l}`),
              prop: p.prop.slice(0, 8).map((e) => `${e.i} ${e.l}`),
            } };
        },
        { tilesetId: sheet.tilesetId, ko: sheet.ko, p }
      );
      step(`${sheet.key}: 맵 3개 생성 (${built.aId} / ${built.bId} / ${built.cId})`);
      await page.waitForTimeout(900);

      for (const [n, mapId, label] of [
        ["a", built.aId, "지형과 물"],
        ["b", built.bId, "건축"],
        ["c", built.cId, "소품 전시"],
      ]) {
        await page.evaluate(async (id) => {
          const { selectEditorMap } = await import("/src/editor/panels/mapList.ts");
          selectEditorMap(id);
        }, mapId).catch(async () => {
          await page.getByTestId(`map-tree-node-${mapId}`).click().catch(() => {});
        });
        await page.waitForTimeout(700);
        await shoot(page, `${sheet.key}-${n}-${label.replace(/\s/g, "")}.png`,
          `${sheet.ko} — ${label}`, { sheet: sheet.key, kind: "scene", labels: built.labels });
        const canvas = page.getByTestId("edit-canvas");
        const cf = path.join(outDir, `${sheet.key}-${n}-canvas.png`);
        await canvas.screenshot({ path: cf }).catch(() => {});
        if (fs.existsSync(cf)) {
          shots.push({ file: path.resolve(cf), name: path.basename(cf), caption: `${sheet.ko} — ${label} (캔버스 확대)`, sheet: sheet.key, kind: "canvas", labels: built.labels });
          step(`shot ${path.basename(cf)} — 캔버스 확대`);
        }
      }

      const palette = page.getByTestId("tile-palette");
      const pf = path.join(outDir, `${sheet.key}-palette.png`);
      await palette.screenshot({ path: pf }).catch(() => {});
      if (fs.existsSync(pf)) {
        shots.push({ file: path.resolve(pf), name: path.basename(pf), caption: `${sheet.ko} — 타일 그림판 (한국어 라벨 배선 확인)`, sheet: sheet.key, kind: "palette", labels: built.labels });
        step(`shot ${path.basename(pf)} — 팔레트`);
      }
    }

    // 런타임: 실제로 걸어 다니는 화면
    step("switch to play mode");
    await page.getByTestId("mode-play").click().catch(() => {});
    await page.waitForTimeout(2500);
    await shoot(page, "99-runtime.png", "런타임 — 만든 맵을 실제로 실행한 화면", { sheet: "-", kind: "runtime" });
  } catch (e) {
    step(`예외: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
  } finally {
    await context.close();
    await browser.close();
    step("browser context + browser closed (cleanup)");
  }

  fs.writeFileSync(path.join(outDir, "shots.json"), JSON.stringify(shots, null, 1), "utf8");
  fs.writeFileSync(path.join(outDir, "action-log.txt"), log.join("\n") + "\n", "utf8");
  step(`총 ${shots.length}장 캡처`);
  process.exit(shots.length >= 30 ? 0 : 1);
}

await main();
