// 아스트라 호라이즌 — 필드 동료(파티 몬스터)가 주인공·서로와 화면에서 겹치지 않는지 잰다.
//   node scripts/qa/astra-horizon/follower-probe.mjs <project.json> <outDir>
// 출하 플레이어(player.html)를 띄워 파티에 몬스터 둘을 넣고, 문으로 맵을 드나들고, 모퉁이를 돌고,
// 서 있고, 회복 센터 간호사와 말한다. 그동안 100ms 마다 주인공·동료 스프라이트의 「불투명 화소 상자」를
// 장면에서 직접 재서 겹친 면적(게임 화소²)을 모은다. 허용치는 0 이다.
// 주인공 둘레를 잘라 찍은 컷은 <outDir>/frames/*.png 로 남기고, 한 줄로 이어 붙이는 건 호출자 몫이다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg || !outArg) throw new Error("usage: follower-probe.mjs <project.json> <outDir>");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg);
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:astra-follower", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });

const present = (testid) => page.locator(`[data-testid="${testid}"]`).count().then((n) => n > 0);
const live = () => page.evaluate(() => window.__oprnDebug.readLive());

// 새 게임 → 오프닝·첫 대사를 넘긴다.
await page.waitForTimeout(1500);
await page.keyboard.press("Enter");
await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
for (let i = 0, calm = 0; i < 120 && calm < 4; i++) {
  const busy = (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("title-screen")) || (await present("runtime-choices"));
  if (busy) { calm = 0; await page.keyboard.press("Enter"); } else calm++;
  await page.waitForTimeout(250);
}

// 파티에 몬스터 둘 — 교수 대사를 거치지 않고 세션에 직접 넣는다(동료 열차는 monsterParty 가 정본).
const speciesIds = (project.database.monsterSpecies ?? []).filter((sp) => sp.graphic?.fieldGraphic?.sprite?.id).slice(0, 2).map((sp) => sp.id);
await page.evaluate(([ids, species]) => {
  const s = window.__oprnHooksScene.session;
  s.monsterInstances = s.monsterInstances ?? {};
  s.monsterParty = [];
  s.followers = [];
  ids.forEach((speciesId, k) => {
    const instanceId = `probe_${k}`;
    s.monsterInstances[instanceId] = { instanceId, speciesId, level: 30, exp: 0, moves: [], ivs: {}, evs: {} };
    s.monsterParty.push(instanceId);
    const sp = species.find((entry) => entry.id === speciesId);
    s.followers.push({ id: `monster:${instanceId}`, name: sp.name, graphic: sp.graphic.fieldGraphic, kind: "monster", monsterInstanceId: instanceId });
  });
  s.followerTrail = [];
}, [speciesIds, project.database.monsterSpecies]);

// 100ms 측정기 — 주인공·동료의 불투명 화소 상자(월드 좌표, 게임 화소). 겹치면 면적을 남긴다.
await page.evaluate(() => {
  // 프레임별 알파 가면(불투명 화소). 겹침은 상자가 아니라 화소로 센다 — 24×32 칩은 투명 여백이 커서
  // 상자끼리는 한 칸 떨어져도 닿는다. 「몸 위에 그려졌다」는 두 그림의 불투명 화소가 같은 자리에 있을 때다.
  const maskCache = new Map();
  const maskOf = (sprite) => {
    const frame = sprite.frame;
    const key = `${sprite.texture.key}#${frame.name}`;
    let mask = maskCache.get(key);
    if (!mask) {
      const c = document.createElement("canvas");
      c.width = frame.cutWidth; c.height = frame.cutHeight;
      const g = c.getContext("2d");
      g.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const bits = new Uint8Array(c.width * c.height);
      for (let i = 0; i < bits.length; i++) bits[i] = d[i * 4 + 3] > 16 ? 1 : 0;
      mask = { w: c.width, h: c.height, bits };
      maskCache.set(key, mask);
    }
    return mask;
  };
  const placed = (sprite) => {
    if (!sprite.visible || sprite.alpha <= 0.05) return null;
    const mask = maskOf(sprite);
    const sx = sprite.scaleX, sy = sprite.scaleY;
    const left = sprite.x - sprite.displayOriginX * sx, top = sprite.y - sprite.displayOriginY * sy;
    return { mask, left, top, sx, sy, flip: sprite.flipX, x0: left, y0: top, x1: left + mask.w * sx, y1: top + mask.h * sy };
  };
  const opaqueAt = (p, wx, wy) => {
    let u = Math.floor((wx - p.left) / p.sx), v = Math.floor((wy - p.top) / p.sy);
    if (p.flip) u = p.mask.w - 1 - u;
    if (u < 0 || v < 0 || u >= p.mask.w || v >= p.mask.h) return false;
    return p.mask.bits[v * p.mask.w + u] === 1;
  };
  // 겹친 불투명 화소 수(게임 화소, 반 화소 격자로 표본).
  const area = (a, b) => {
    const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), y0 = Math.max(a.y0, b.y0), y1 = Math.min(a.y1, b.y1);
    if (x1 <= x0 || y1 <= y0) return 0;
    let n = 0;
    for (let y = Math.floor(y0) + 0.5; y < y1; y += 1) for (let x = Math.floor(x0) + 0.5; x < x1; x += 1) {
      if (opaqueAt(a, x, y) && opaqueAt(b, x, y)) n++;
    }
    return n;
  };
  const opaqueBox = placed;
  const rec = { samples: 0, overlapSamples: 0, maxArea: 0, worst: [], byPhase: {}, phase: "start", minGapPx: Infinity };
  window.__followerProbe = rec;
  setInterval(() => {
    const scene = window.__oprnHooksScene;
    if (!scene?.player || !scene.followerSprites || document.querySelector('[data-testid="battle-scene"]')) return;
    const boxes = [["hero", opaqueBox(scene.player)], ...[...scene.followerSprites.entries()].map(([k, sp]) => [k, opaqueBox(sp)])].filter(([, b]) => b);
    const ph = (rec.byPhase[rec.phase] ??= { samples: 0, overlapSamples: 0, maxArea: 0, followers: 0 });
    rec.samples++; ph.samples++;
    ph.followers = Math.max(ph.followers, boxes.length - 1);
    let worst = 0, pair = "";
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = area(boxes[i][1], boxes[j][1]);
      if (a > worst) { worst = a; pair = `${boxes[i][0]}×${boxes[j][0]}`; }
    }
    if (worst > 0) {
      rec.overlapSamples++; ph.overlapSamples++;
      ph.maxArea = Math.max(ph.maxArea, worst);
      if (worst > rec.maxArea) rec.maxArea = worst;
      if (rec.worst.length < 12) rec.worst.push({ phase: rec.phase, pair, area: Math.round(worst), session: { x: scene.session.x, y: scene.session.y }, trail: (scene.session.followerTrail ?? []).slice(0, 6).map((p) => `${p.x},${p.y}`), sprites: [scene.player, ...scene.followerSprites.values()].map((sp) => `${(sp.x / 16 - 0.5).toFixed(2)},${(sp.y / 16 - 1).toFixed(2)}`).join(" ") });
    }
  }, 100);
});
const phase = (name) => page.evaluate((n) => { window.__followerProbe.phase = n; }, name);

let shotNo = 0;
const shots = [];
const dims = [];
const shot = async (label) => {
  const box = await page.evaluate(() => {
    const scene = window.__oprnHooksScene, cam = scene.cameras.main, canvas = document.querySelector("canvas").getBoundingClientRect();
    const k = canvas.width / cam.worldView.width;
    return { x: canvas.left + (scene.player.x - cam.worldView.x) * k, y: canvas.top + (scene.player.y - cam.worldView.y) * k, k };
  });
  dims.push(await page.evaluate(() => { const sc = window.__oprnHooksScene; const d = (sp) => ({ x: sp.x, y: sp.y, w: sp.displayWidth, h: sp.displayHeight, ox: sp.originX, oy: sp.originY, frame: sp.frame.name, tex: sp.texture.key }); return { hero: d(sc.player), followers: [...sc.followerSprites.values()].map(d), zoom: sc.cameras.main.zoom }; }));
  const w = 6 * 16 * box.k, h = 5 * 16 * box.k;
  const file = `${String(++shotNo).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path: join(out, "frames", file), clip: { x: Math.max(0, box.x - w / 2), y: Math.max(0, box.y - h * 0.6), width: w, height: h } });
  shots.push({ file, label });
};

const step = async (dir) => {
  await page.evaluate((d) => window.__oprnInput.dir(d), dir);
  await page.waitForTimeout(260);
  await page.evaluate(() => window.__oprnInput.dir(null));
  await page.waitForTimeout(120);
};
const walk = async (dirs) => { for (const d of dirs) await step(d); };
const stand = (ms) => page.waitForTimeout(ms);
const teleport = async (mapId, x, y) => {
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
};
const waitMap = (mapId) => page.waitForFunction((m) => window.__oprnDebug.readLive().currentMapId === m, mapId, { timeout: 15000 });
const eventRunning = () => page.evaluate(() => Boolean(window.__oprnHooksScene?.running));
const clearDialogue = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 4; i++) {
    if (!(await eventRunning()) && !(await present("dialogue-box")) && !(await present("runtime-choices"))) { calm++; await page.waitForTimeout(250); continue; }
    calm = 0;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
};

// 1) 순간이동 직후 서 있기 — 마을 광장, 아래를 본 채.
await phase("teleport-stand");
await teleport("mx_map_home", 9, 16);
await stand(1200); await shot("teleport");
// 2) 걷기 + 모퉁이 돌기
await phase("walk-corners");
await walk(["right", "right", "right", "down"]); await shot("corner");
await walk(["left", "left", "left", "left", "up"]);
await phase("stand-after-walk");
await stand(1200); await shot("stand");
// 3) 회복 센터 문으로 들어가기 (문 9,14 — 바로 아래 칸에서 위로)
await phase("door-enter");
await teleport("mx_map_home", 9, 15);
await stand(400);
await step("up");
await waitMap("mx_map_home_center").catch(() => {});
await stand(1500); await shot("enter-center");
// 4) 간호사(7,6) 앞(7,7) 까지 걸어 가 말 걸기 → 회복 대사
await phase("walk-to-nurse");
const here = await live();
const dx = 7 - here.x, dy = 7 - here.y;
await walk([...Array(Math.max(0, -dy)).fill("up")]);
await walk([...Array(Math.abs(dx)).fill(dx < 0 ? "left" : "right")]);
await walk([...Array(Math.max(0, dy)).fill("down")]);
await shot("at-nurse");
await phase("nurse-dialogue");
await page.evaluate(() => window.__oprnInput.face("up"));
await page.evaluate(() => window.__oprnInput.action());
await stand(800); await shot("nurse-talk");
await clearDialogue();
await phase("after-heal");
await stand(1500); await shot("after-heal");
// 5) 나가서 마을로 (문 7,9)
await phase("door-exit");
await walk(["down", "down", "down"]);
await waitMap("mx_map_home").catch(() => {});
await stand(1500); await shot("exit-center");
await phase("walk-town");
await walk(["right", "right", "down", "down", "left", "up", "up", "up"]);
await stand(1000); await shot("walk-town");
// 6) 전투 뒤 — 순간이동 대신 실제 맵 재진입 경로: 같은 맵 안 칸 옮기기와 다른 맵 순간이동 모두
await phase("same-map-teleport");
await teleport("mx_map_home", 12, 13);
await page.evaluate(() => window.__oprnInput.face("left"));
await stand(1000); await shot("same-map-tp");

const rec = await page.evaluate(() => window.__followerProbe);
await writeFile(join(out, "report.json"), JSON.stringify({ rec, shots, dims, errors }, null, 2));
console.log(JSON.stringify({ samples: rec.samples, overlapSamples: rec.overlapSamples, maxArea: rec.maxArea, byPhase: rec.byPhase, worst: rec.worst.slice(0, 6) }, null, 1));
await browser.close();
await server.close();
