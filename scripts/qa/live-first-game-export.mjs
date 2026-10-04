// Download the shipping ZIP through the editor menu, from the same saved project.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/live-first-game');
const initial = existsSync(out + '/generation.json') ? JSON.parse(readFileSync(out + '/generation.json', 'utf8')) : null;
const completion = existsSync(out + '/completion.json') ? JSON.parse(readFileSync(out + '/completion.json', 'utf8')) : null;
const recovered = existsSync(out + '/reloaded.json') ? JSON.parse(readFileSync(out + '/reloaded.json', 'utf8')) : null;
const generation = recovered?.passed && (!completion?.passed || recovered.afterReload.revision >= completion.afterReload.revision)
  ? recovered : completion?.passed ? completion : initial;
if (!generation) throw Error('A saved and reloaded live authoring receipt is required');
if (!generation.generationPrerequisitePassed && !completion?.passed && !(recovered?.passed && recovered.workerCompleted)) throw Error('Live generation or explicit repair, plus canonical reload, must pass first');
const report = { projectId: generation.afterReload.projectId, revision: generation.afterReload.revision,
  generationMode: generation.mode ?? 'automatic first build',
  projectUrl: generation.projectUrl, started: new Date().toISOString(), errors: [] };
report.networkFailures = [];
const save = () => writeFileSync(out + '/export.json', JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ args: process.env.OPENING_EDITOR_CANVAS === '1' ? ['--disable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
page.on('pageerror', e => { report.errors.push(e.message); save(); });
page.on('crash', () => { report.crashed = true; save(); });
page.on('requestfailed', r => {
  report.networkFailures.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }); save();
});
page.on('response', r => {
  if (r.status() >= 400) { report.networkFailures.push({ path: new URL(r.url()).pathname, status: r.status() }); save(); }
});
try {
  save();
  await page.goto(generation.projectUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 300000 });
  await page.locator('.studio-project-button').click();
  const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
  const failure = page.getByText(/^게임 내보내기 실패:/);
  const failurePromise = failure.waitFor({ timeout: 180000 }).then(async () => {
    throw Error(await failure.innerText());
  });
  report.exportStarted = new Date().toISOString(); save();
  await page.getByTestId('menu-project-export-web').click();
  const download = await Promise.race([downloadPromise, failurePromise]);
  const dir = resolve(process.env.LIVE_GAME_PACKAGE_OUT ?? 'output/qa/live-first-game'); mkdirSync(dir, { recursive: true });
  report.path = resolve(dir, 'game-web.zip');
  await download.saveAs(report.path);
  report.downloadFailure = await download.failure();
  report.seconds = (Date.now() - Date.parse(report.exportStarted)) / 1000;
  report.passed = !report.downloadFailure && !report.errors.length;
  await page.screenshot({ path: out + '/exported.png', timeout: 15000 });
} catch (e) {
  report.failure = e.message;
  report.visibleError = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(-1600);
  await page.screenshot({ path: out + '/export-failure.png', timeout: 5000 }).catch(() => {});
  process.exitCode = 1;
} finally { save(); await browser.close(); }
console.log(JSON.stringify(report));
