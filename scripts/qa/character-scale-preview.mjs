// Visual experiment on the existing engine QA fixture. No project writes or automatic scaling policy.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const out = 'verify-shots/character-scale-preview';
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile('verify-shots/tile-size-support/fixture.json', 'utf8'));
project.startMapId = 'geometry48';
project.startPos = { x: 2, y: 2 };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const errors = [], observations = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: '/character-scale-fixture.json', saveNamespace: 'character-scale-preview', qaInstrumentation: true };
  });
  await page.route('**/character-scale-fixture.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('title-screen').waitFor({ timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__oprnDebug?.readState().currentMapId === 'geometry48' && !!window.__oprnHooksScene?.player, null, { timeout: 60000 });
  await page.evaluate(() => window.__oprnInput.face('down'));
  for (const scale of [1, 2, 3]) {
    await page.evaluate(scale => window.__oprnHooksScene.player.setScale(scale), scale);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const observation = await page.evaluate(() => {
      const sprite = window.__oprnHooksScene.player;
      return { map: window.__oprnDebug.readState().currentMapId, x: sprite.x, y: sprite.y,
        frameWidth: sprite.frame.width, frameHeight: sprite.frame.height,
        scaleX: sprite.scaleX, scaleY: sprite.scaleY, displayWidth: sprite.displayWidth, displayHeight: sprite.displayHeight,
        camera: window.__oprnCamera(), texture: sprite.texture.key, frame: sprite.frame.name };
    });
    assert.equal(observation.scaleX, scale);
    assert.equal(observation.scaleY, scale);
    assert.equal(observation.x, 120);
    assert.equal(observation.y, 144);
    observations.push(observation);
    await page.screenshot({ path: `${out}/scale-${scale}.png` });
    console.log(JSON.stringify(observation));
  }
  assert.deepEqual(errors, []);
  // Display the three unmodified runtime captures together with explicit comparison labels.
  const frames = await Promise.all([1, 2, 3].map(async (scale, index) => {
    const png = (await readFile(`${out}/scale-${scale}.png`)).toString('base64');
    const row = observations[index];
    return `<section><h2>${scale}× <span>${row.displayWidth} × ${row.displayHeight}px</span></h2><img src="data:image/png;base64,${png}" alt="48px map, character scale ${scale}"/><p>${['현재 크기', '중간 크기', '16px 맵에서의 상대 비율 유지'][index]}</p></section>`;
  }));
  const gallery = await browser.newPage({ viewport: { width: 1984, height: 646 }, deviceScaleFactor: 1 });
  await gallery.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#eef0f3;color:#182333;font:18px sans-serif}
    h1{font-size:25px;margin:0 0 8px}header p{margin:0 0 20px;color:#526073}
    article{display:flex;gap:16px}section{width:640px;background:white;border-radius:10px;overflow:hidden}
    h2{margin:0;padding:12px 16px;font-size:22px}h2 span{font-size:16px;color:#526073;float:right}
    img{display:block;width:640px;height:480px;image-rendering:pixelated}section p{margin:0;padding:12px 16px;font-size:16px}
  </style><header><h1>48 × 48 타일맵 · 동일 캐릭터 배율 비교</h1><p>동일한 카메라와 위치에서 촬영한 실제 플레이어 화면 · 원본 프레임 ${observations[0].frameWidth} × ${observations[0].frameHeight}px · 최근접 확대</p></header><article>${frames.join('')}</article>`);
  await gallery.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await gallery.screenshot({ path: `${out}/comparison.png`, fullPage: true });
  await writeFile(`${out}/observations.json`, JSON.stringify({ date: new Date().toISOString(), observations, errors, scope: 'Temporary runtime sprite-scale comparison; automatic scaling is not implemented and project data is unchanged.' }, null, 2));
  await writeFile(`${out}/SUMMARY.md`, '# Character scale preview\n\n48px engine QA map, identical player/camera/position at 1×, 2×, 3×. The existing 16px-world character frame is 24×32px; display frames are 24×32, 48×64, and 72×96px. Feet remain (120,144). No image resampling or asset rewriting. Comparison labels surround unmodified player screenshots. This is a temporary runtime experiment, not an automatic scaling policy or authored content.\n\n즉시 확인: comparison.png\n');
  console.log(resolve(`${out}/comparison.png`));
} finally {
  await browser.close();
  await server.close();
}
