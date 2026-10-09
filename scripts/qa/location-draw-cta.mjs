// 로케이션 빈 상태 CTA 브라우저 증거 — 어포던스 감사(2026-09-11)의 A 안.
//
// 주장 셋을 실제 편집기 셸에서 잰다:
//   1) 구역이 없는 맵에서 **쓰는 지점**(맵 설정 인카운터 · 이벤트 트리거 · 페이지 조건)이
//      문장이 아니라 **행동**을 낸다.
//   2) 그 행동을 누르면 로케이션 레이어가 켜지고, 켠 결과가 지금 자리에(모달 뒤라면 토스트로) 보인다.
//   3) 구역을 만들면 CTA 가 사라지고 같은 선택기에 그 구역이 뜬다 — 닫힌 루프.
//
// 실행:
//   npm run dev:worktree     # 별도 터미널(.env.local 의 DEV_SERVER_PORT)
//   LOCATION_CTA_QA_URL=http://127.0.0.1:9849 node scripts/qa/location-draw-cta.mjs
//
// GET 릴레이는 scripts/qa/map-location-layer.mjs 와 같은 이유로 쓴다(이 워크스테이션은 네트워크
// 변화 시 Chromium 자신의 루프백 요청을 취소한다). 바이트만 릴레이하고 실행은 실제 앱이 한다.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.LOCATION_CTA_QA_OUTPUT ?? 'verify-shots/loc-draw-cta';
const baseUrl = process.env.LOCATION_CTA_QA_URL ?? 'http://127.0.0.1:9849';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route('**/*', async route => {
  const request = route.request();
  if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(90000);

// 이 기능의 동작이 아닌 환경 소음:
//  - 릴레이는 Vite HMR 웹소켓을 중계하지 못한다(클라이언트가 소켓 실패를 로그로 남긴다);
//  - `?freshProject=1` 은 의도적으로 원격 저장을 끄므로 autosave 가 실패를 보고한다.
const IGNORED_ERROR = /WebSocket|ERR_CONNECTION_REFUSED|\[autosave\]|APITOPIA_API_KEY|vite\.dev\/config/;
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (!IGNORED_ERROR.test(text)) errors.push(`console: ${text}`);
});

await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'standard');
  localStorage.setItem('oprn:ai-panel-collapsed', '1');
  localStorage.removeItem('oprn:map-location-layer');
});

const checks = [];
const steps = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ name, ok, actual, expected });
  assert.ok(ok, `${name}\n  실제: ${JSON.stringify(actual)}\n  기대: ${JSON.stringify(expected)}`);
}
function checkTruthy(name, actual) {
  checks.push({ name, ok: Boolean(actual), actual: Boolean(actual), expected: true });
  assert.ok(actual, `${name} (실제: ${JSON.stringify(actual)})`);
}
/** 이벤트 편집기의 「언제 보이나요」(시작 방식·조건) 그룹은 접힌 채로 시작한다 — 여는 클릭을 대신한다. */
async function openWhenGroup() {
  const toggle = page.locator("[data-testid='evt-rail-group-when'] button, [data-testid='evt-rail-group-when'] [aria-expanded]").first();
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  await testId('event-page-trigger-select').waitFor({ state: 'visible' });
}
/** 인카운터 행의 「조건」은 `<details>` 안에 접혀 있다 — 사용자가 여는 그 클릭을 대신한다. */
async function expandEncounterConditions(index) {
  const summary = testId(`map-encounter-conditions-${index}`);
  const open = await summary.evaluate(node => node.closest('details')?.open ?? false);
  if (!open) await summary.click();
}

async function shot(name, note) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
  steps.push({ name, note });
}
const testId = id => page.getByTestId(id);
const projectState = () => page.evaluate(async () => {
  const { store } = await import('/src/project/store.ts');
  const { editorState } = await import('/src/editor/editorState.ts');
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  return { mapId, mapName: map?.name, locations: (map?.locations ?? []).map(entry => entry.name) };
});

await page.goto(`${baseUrl}/?freshProject=1`);
await testId('map-location-layer-toggle').waitFor({ state: 'visible' });
await page.waitForFunction(() => Boolean(window.__oprnEditWorldToClient), null, { timeout: 120000 });
await page.waitForFunction(async () => {
  const registry = await import('/src/editor/regionClientRect.ts');
  return registry.resolveClientPointTile({ x: 700, y: 400 }) !== null;
}, null, { timeout: 120000, polling: 250 });

// 전제: 예제 어드벤처의 현재 맵에는 구역이 없다(감사 문서의 «시작 상태» 실측).
check('prerequisite: 예제 프로젝트 현재 맵에 구역이 없다', await projectState(), { ...(await projectState()), locations: [] });
check('prerequisite: 레이어는 꺼진 채로 시작한다', await testId('map-location-layer').evaluate(node => node.classList.contains('is-active')), false);

// ── 1. 맵 설정 → 랜덤 전투 ────────────────────────────────────────────────────────
await testId('sidebar-map-settings').click();
await page.locator("[data-testid^='map-properties-modal-']").waitFor({ state: 'visible' });
await testId('map-props-tab-encounter').click();
// 조건 필드는 인카운터 **행**마다 붙는다. 예제 맵의 표가 비어 있으면 행을 먼저 만든다(사용자가
// 실제로 하는 순서와 같다). 행이 이미 있으면 다시 만들지 않는다.
if (await testId('map-encounter-location-0').count() === 0) await testId('map-encounter-row-add').click();
await expandEncounterConditions(0);
await testId('map-encounter-location-draw-0').waitFor({ state: 'visible' });
checkTruthy('인카운터: 0개 맵에서도 «이름 붙은 구역» 필드가 자리를 지킨다', await testId('map-encounter-location-0').count());
checkTruthy('인카운터: 빈 이유를 말한다', await testId('map-encounter-location-empty-0').isVisible());
checkTruthy('인카운터: 행동(버튼)을 낸다', await testId('map-encounter-location-draw-0').isVisible());
// 증거 사진은 «보이는 것» 이어야 한다 — 스크롤 밖이면 단언만 통과하고 사진에는 없다(실측).
await testId('map-encounter-location-draw-0').scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await shot('01-encounter-empty-state', '맵 설정 > 랜덤 전투: 구역 0개인 맵에서도 필드가 남고, 빈 이유와 [맵에서 구역 그리기] 가 함께 나온다.');

await testId('map-encounter-location-draw-0').click();
await page.waitForTimeout(400);
check('버튼: 로케이션 레이어를 켠다', await page.evaluate(() => localStorage.getItem('oprn:map-location-layer')), '1');
checkTruthy('버튼: 모달 뒤라도 토스트가 그 자리를 잇는다', (await testId('toast').textContent()).includes('로케이션 레이어를 켰습니다'));
await testId('map-encounter-location-draw-0').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await shot('02-encounter-cta-clicked', '버튼 클릭 직후: 레이어가 켜졌고, 켠 결과가 모달 뒤라 토스트가 무엇을 하면 되는지 말한다.');

await page.keyboard.press('Escape');
await page.locator("[data-testid^='map-properties-modal-']").waitFor({ state: 'hidden' });
await testId('map-location-inspector').waitFor({ state: 'visible' });
checkTruthy('모달을 닫으면 레이어 표면이 실제로 보인다', await testId('map-location-hint').isVisible());
await shot('03-layer-on-after-cta', '모달을 닫은 화면: 레이어가 켜져 있고 인스펙터가 «빈 곳을 드래그하면 구역이 생깁니다» 로 다음 행동을 말한다.');

// ── 2. 이벤트 편집기 — 트리거와 페이지 조건 ───────────────────────────────────────
await testId('layer-event').click();
await page.waitForTimeout(400);
await page.locator("[data-testid^='event-list-row-']").first().dblclick();
await testId('event-editor-modal').waitFor({ state: 'visible' });

await openWhenGroup();
await testId('event-page-trigger-select').selectOption('locationTransition');
await testId('event-page-trigger-location-draw').waitFor({ state: 'visible' });
checkTruthy('트리거: 빈 상태에서 행동을 낸다', await testId('event-page-trigger-location-draw').isVisible());
await testId('event-page-trigger-location-draw').scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await shot('04-trigger-empty-state', '이벤트 편집기 「시작 방식 = 구역에 드나들면」: 안내 문장과 함께 [맵에서 구역 그리기] 가 붙는다.');

// 페이지 출현 조건(「고급 조건」)의 같은 버튼은 여기서 재지 않는다 — 실측으로 막혔다:
// `event-page-advanced-condition-add` 를 누르면 **저장소에는 조건이 들어가지만**
// (`page0Conditions: [] → [{kind:"switch",…}]`) 목록·요약 DOM 이 다시 그려지지 않는다
// (1.2초 대기 후에도 «추가 조건 없음» / «고급 조건 (0)»). 그래서 그 자리에서는 종류를
// «구역(로케이션)» 으로 바꿀 행 자체가 화면에 없다. 이 버튼의 표면 계약은 유닛이 고정한다:
// `test/locationDrawCta.test.ts` 의 «조건 폼은 구역이 없을 때만 그리기 버튼을 붙인다».
// (편집기 결함은 이 변경의 범위가 아니다 — 감사 문서 「검증 공백」에 기록.)

// 트리거를 바꾼 초안이 남아 있으므로 닫기는 «버리고 닫기» 확인을 지난다(사용자와 같은 경로).
await testId('event-editor-modal-close').click();
await testId('app-confirm-modal').waitFor({ state: 'visible' });
await testId('app-modal-confirm').click();
await testId('event-editor-modal').waitFor({ state: 'hidden' });

// 이벤트 레이어에 들어와 있었으므로 타일 레이어로 돌아온다 — 이벤트 레이어에서는 캔버스가
// 제스처를 가져가 새 이벤트를 만들 뿐, 구역을 그리지 않는다(canvasPointerOwnership 계약).
await testId('layer-lower').click();
await page.waitForTimeout(300);
// ── 3. 구역을 그린다 — CTA 가 사라지고 선택기에 뜨는지 ─────────────────────────────
const tilePoint = async (x, y) => page.evaluate(async ([tx, ty]) => {
  const module = await import('/src/editor/regionClientRect.ts');
  const rect = module.resolveRegionClientRect({ x: tx, y: ty, width: 1, height: 1 });
  return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
}, [x, y]);
// 예제 맵은 100×100 이고 카메라는 시작 위치(중앙)에 있다 — 타일 (3,3) 은 화면 밖이다(실측:
// 클라이언트 x=-632). 그래서 «캔버스 중앙이 가리키는 타일» 을 기준으로 그린다.
const anchorTile = await page.evaluate(async () => {
  const registry = await import('/src/editor/regionClientRect.ts');
  const shell = document.querySelector("[data-testid='edit-canvas']");
  const rect = shell.getBoundingClientRect();
  return registry.resolveClientPointTile({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }) ?? null;
});
assert.ok(anchorTile, '캔버스 중앙이 가리키는 타일을 해석해야 한다');
const from = await tilePoint(anchorTile.x - 4, anchorTile.y - 3);
const to = await tilePoint(anchorTile.x + 4, anchorTile.y + 3);
assert.ok(from && to, '카메라가 두 끝점을 해석해야 한다');
assert.ok(from.x > 0 && from.y > 0 && to.x > 0 && to.y > 0, `두 끝점이 화면 안이어야 한다 (${JSON.stringify(from)} → ${JSON.stringify(to)})`);
await page.mouse.move(from.x, from.y);
await page.mouse.down();
await page.mouse.move(to.x, to.y, { steps: 12 });
await page.mouse.up();
await testId('map-location-name-input').waitFor({ state: 'visible' });
const nameInput = testId('map-location-name-input');
await nameInput.fill('정문 광장');
await nameInput.blur();
await page.waitForTimeout(300);
check('구역 생성', (await projectState()).locations, ['정문 광장']);
await shot('06-region-drawn', '드래그로 구역을 만들고 이름을 붙였다 — 감사 문서가 «볼 경로가 없다» 고 지목한 화면이 이 화면이다.');

// 인카운터 표면: CTA 가 사라지고 선택기에 그 구역이 뜬다.
await testId('sidebar-map-settings').click();
await page.locator("[data-testid^='map-properties-modal-']").waitFor({ state: 'visible' });
await testId('map-props-tab-encounter').click();
if (await testId('map-encounter-location-0').count() === 0) await testId('map-encounter-row-add').click();
await expandEncounterConditions(0);
await testId('map-encounter-location-0').waitFor({ state: 'attached' });
const encounterOptions = await testId('map-encounter-location-0').locator('option').allTextContents();
checkTruthy('인카운터: 만든 구역이 선택기에 뜬다', encounterOptions.some(text => text.includes('정문 광장')));
check('인카운터: 구역이 생기면 CTA 는 사라진다', await testId('map-encounter-location-draw-0').count(), 0);
check('인카운터: 빈 상태 안내도 사라진다', await testId('map-encounter-location-empty-0').count(), 0);
await shot('07-encounter-lists-region', '같은 자리, 구역이 생긴 뒤: 선택기에 «정문 광장» 이 뜨고 빈 상태 안내·버튼은 사라졌다.');
await page.keyboard.press('Escape');
await page.locator("[data-testid^='map-properties-modal-']").waitFor({ state: 'hidden' });

// 구역이 생긴 뒤의 «조건 폼 선택기» 는 위와 같은 함수(`renderInsideLocationCondition`)를 쓰고
// 같은 계약(0개일 때만 CTA)을 지키는 것을 `test/locationDrawCta.test.ts` 가 고정한다. 브라우저에서
// 그 자리를 여는 길은 위에 적은 편집기 결함(조건 추가 후 목록 미갱신)에 막혀 있어 여기서 재지 않는다.

check('예상 밖 페이지 오류 없음', errors, []);

const failed = checks.filter(entry => !entry.ok).length;
const lines = [
  '# 로케이션 빈 상태 CTA — 브라우저 증거',
  '',
  `- 실행: ${new Date().toISOString()}`,
  `- URL: ${baseUrl}/?freshProject=1 (예제 어드벤처 · 현재 맵에 구역 0개)`,
  `- 검사 ${checks.length}건 중 실패 ${failed}건`,
  '',
  '## 즉시 확인할 PNG',
  '',
  '| 파일 | 무엇을 보여 주는가 |',
  '|---|---|',
  ...steps.map(step => `| \`${step.name}.png\` | ${step.note} |`),
  '',
  '## 측정한 단언',
  '',
  '| 단언 | 결과 |',
  '|---|---|',
  ...checks.map(entry => `| ${entry.name} | ${entry.ok ? 'PASS' : `FAIL (${JSON.stringify(entry.actual)})`} |`),
  '',
];
await writeFile(`${output}/SUMMARY.md`, lines.join('\n'), 'utf8');
await browser.close();

console.log(`${output}/SUMMARY.md — 검사 ${checks.length}건, 실패 ${failed}건`);
if (failed > 0) process.exit(1);
