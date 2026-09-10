// OPRN-OUT-026 browser evidence — 타일 레이어·배경 정책이 출하 타일셋 편집기에서 계약대로 보인다.
//
// 유닛 테스트(`test/tileLayerPolicy*.test.ts`)는 fakeDom 이라 규칙 탭이 실제로 그려지는지,
// 경고·검토 목록이 실제 사용자 클릭으로 켜지는지 확인하지 못한다. 이 스크립트가 그 빈칸을 채운다.
//
// 담는 장면(각각 PNG):
//   01 trunk-policy         나무 밑동 290 선택 → 「받침 있는 하위」 + 근거 + 다중 조각 제약
//   02 backing-auto         받침 「자동」 기본값 — 잔디 240 을 함께 그린다, 경고 없음
//   03 backing-none-warning 받침 「없음」 → 부류가 투명 하위로 바뀌고 경고가 뜬다
//   04 review-appears       그때 비로소 「배경 없는 하위 타일 검토」 목록이 나타난다
//   05 backing-grass        받침 「잔디 받침」 → 경고·검토 목록이 다시 사라진다
//   06 review-overlay-one   검토 항목의 「상위 오버레이」는 그 타일만 상위로 옮긴다
//
// 모든 변경은 `?blankProject=1` 의 로컬 세션에만 남는다(원격 지속성 꺼짐).
//
// 실행:
//   DEV_SERVER_PORT=9865 npm run dev:worktree     # 별도 터미널
//   TILE_POLICY_QA_URL=http://127.0.0.1:9865 node scripts/qa/tile-layer-backing-policy.mjs

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.TILE_POLICY_QA_OUTPUT ?? 'verify-shots/oprn-026';
const baseUrl = process.env.TILE_POLICY_QA_URL ?? 'http://127.0.0.1:9865';
const headed = process.argv.includes('--headed');
await mkdir(output, { recursive: true });

const TRUNK = 290;
const SIBLING_TRUNK = 291;
const GRASS = 240;

const browser = await chromium.launch({ headless: !headed, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// 이 워크스테이션은 네트워크가 바뀔 때 Chromium 자신의 루프백 요청을 취소한다.
// GET 바이트만 중계하고, 앱은 실제 브라우저에서 그대로 실행된다.
await page.route('**/*', async route => {
  const request = route.request();
  if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90_000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(60_000);

// 이 기능의 동작이 아닌 환경 소음만 걸러 낸다:
//  - GET 중계는 Vite HMR 웹소켓을 프록시할 수 없어 클라이언트가 소켓 실패를 남긴다;
//  - `?blankProject=1` 은 원격 지속성을 의도적으로 끄므로 자동저장이 실패를 보고한다.
// 그 밖의 모든 것은 진짜 페이지 오류로 센다.
const IGNORED_ERROR = /WebSocket|ERR_CONNECTION_REFUSED|ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS|\[autosave\]|vite\.dev\/config\/server-options|failed to connect to websocket/;
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (!IGNORED_ERROR.test(text)) pageErrors.push(`console: ${text}`);
});

await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'standard');
  localStorage.setItem('oprn:standard-welcome-seen', '1');
  localStorage.setItem('oprn:coachmarks-basic-v1', '1');
});

const results = [];
const shot = name => page.screenshot({ path: `${output}/${name}.png` });

/**
 * 규칙 패널은 세로로 스크롤된다 — 경고·검토 목록이 접힌 아래쪽에 있으면 스크린샷이
 * 단언한 내용을 보여 주지 못한다. 증거로 찍기 전에 해당 요소를 화면에 올려 둔다.
 */
const revealInPanel = async testid => {
  const node = page.getByTestId(testid).first();
  if ((await node.count()) === 0) return false;
  await node.scrollIntoViewIfNeeded();
  await page.waitForFunction(id => {
    const found = document.querySelector(`[data-testid="${id}"]`);
    if (!found) return false;
    const rect = found.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 0;
  }, testid, { timeout: 10_000 });
  return true;
};

/** 규칙 탭이 실제로 보여 주는 텍스트·존재 여부 — 스크린샷과 같은 순간의 실측값. */
const rulesPanel = () => page.evaluate(() => {
  const find = id => document.querySelector(`[data-testid="${id}"]`);
  const text = id => find(id)?.textContent?.trim() ?? null;
  const pressed = id => find(id)?.getAttribute('aria-pressed') ?? null;
  return {
    policyReason: text('tileset-layer-policy-reason'),
    multiPart: text('tileset-layer-multipart'),
    layerNote: text('tileset-layer-note'),
    warning: text('tileset-layer-warning'),
    backingNote: text('tileset-backing-note'),
    backingPressed: { auto: pressed('tileset-backing-auto'), none: pressed('tileset-backing-none'), tile: pressed('tileset-backing-tile') },
    reviewLegend: find('tileset-rule-review')?.querySelector('legend')?.textContent?.trim() ?? null,
    reviewItems: Array.from(document.querySelectorAll('[data-testid^="tileset-review-item-"]'))
      .map(node => Number(String(node.dataset.testid).replace('tileset-review-item-', ''))),
  };
});

/**
 * 저작 데이터의 진실 — 화면 문구가 실제 타일셋 상태와 일치하는지 교차 검증한다.
 *
 * 앱의 store 는 dev 서버가 `store.ts?t=<hmr>` 로 실어 주므로, 쿼리 없는
 * `import('/src/project/store.ts')` 는 **로드조차 안 된 두 번째 인스턴스**를 준다
 * (실측: `isLoaded() === false`, `id === undefined`). 그래서 앱이 스스로 내보내는
 * 숨은 `project-export-json` 미러(저장소 e2e 가 쓰는 그 채널)에서 프로젝트를 읽고,
 * 판정은 순수 함수 모듈로 계산한다.
 */
const exportedTileset = async () => {
  const raw = await page.getByTestId('project-export-json').textContent();
  assert.ok(raw, 'the editor must mirror the live project as JSON');
  const { project } = JSON.parse(raw);
  const entry = Object.entries(project.tilesets).find(([, tileset]) => String(tileset.image?.id ?? '').includes('combined_town'));
  assert.ok(entry, 'combined_town tileset must be present in the live project');
  return { id: entry[0], tileset: entry[1] };
};

const policyState = async tiles => {
  const { id, tileset } = await exportedTileset();
  const computed = await page.evaluate(async ({ list, snapshot }) => {
    const { tileLayerPolicy, tileBackingTile, backgroundlessLowerReviews } = await import('/src/editor/tileLayerPolicy.ts');
    const { userTileBackingOverride, userTileLayerOverride } = await import('/src/editor/runtimeTileMetadata.ts');
    const { tileLayerHome } = await import('/src/editor/tileLayerClassification.ts');
    return {
      reviews: backgroundlessLowerReviews(snapshot).map(review => review.tile),
      tiles: Object.fromEntries(list.map(tile => {
        const policy = tileLayerPolicy(snapshot, tile);
        return [tile, {
          kind: policy.kind,
          home: policy.home,
          backingTile: policy.backingTile,
          renderBacking: tileBackingTile(snapshot, tile),
          layerHome: tileLayerHome(snapshot, tile),
          layerOverride: userTileLayerOverride(snapshot, tile),
          backingOverride: userTileBackingOverride(snapshot, tile),
          reason: policy.reason,
        }];
      })),
    };
  }, { list: tiles, snapshot: tileset });
  return { tilesetId: id, ...computed };
};

/**
 * 저작 데이터가 실제로 바뀌는 순간을 기다린다 — 고정 sleep 대신 앱이 내보내는
 * 프로젝트 미러가 갱신될 때까지 기다린다(미러는 150ms trailing 디바운스).
 */
const awaitProjectChange = async action => {
  const before = await page.getByTestId('project-export-json').textContent();
  await action();
  await page.waitForFunction(
    previous => (document.querySelector('[data-testid="project-export-json"]')?.textContent ?? '') !== previous,
    before,
    { timeout: 15_000 },
  );
};

const selectTile = async tile => {
  const cell = page.locator(`[data-testid="tileset-db-cell-${tile}"]`).first();
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await page.getByTestId('tileset-rule-layer').waitFor({ state: 'visible' });
  await page.waitForFunction(
    want => document.querySelector('[data-testid="tileset-selected-tile-panel"] strong')?.textContent?.startsWith(String(want)) === true,
    tile,
  );
};

const clickBacking = async choice => {
  const button = page.getByTestId(`tileset-backing-${choice}`);
  await button.waitFor({ state: 'visible' });
  await awaitProjectChange(() => button.click());
  // 규칙 탭은 클릭 뒤 rerender 로 다시 그려진다 — 새 노드가 자리 잡을 때까지 기다린다.
  await page.getByTestId('tileset-rule-layer').waitFor({ state: 'visible' });
  await page.waitForFunction(
    want => document.querySelector(`[data-testid="tileset-backing-${want}"]`)?.getAttribute('aria-pressed') === 'true',
    choice,
  );
};

const record = async (name, fn) => {
  try {
    const observed = await fn();
    await shot(name);
    results.push({ name, status: 'PASS', observed, screenshot: `${name}.png` });
  } catch (error) {
    await shot(name);
    results.push({ name, status: 'FAIL', error: error.message, screenshot: `${name}.png` });
  }
  const last = results.at(-1);
  console.log(`QA ${last.name}: ${last.status}${last.error ? ` — ${last.error}` : ''}`);
};

try {
  await page.goto(`${baseUrl}/?blankProject=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('edit-canvas').waitFor({ state: 'visible', timeout: 120_000 });

  // 데이터베이스 → 맵/타일 → 합본 마을 칩셋 → 「통행·지형」(규칙) 탭.
  await page.getByTestId('toolbar-database').click();
  await page.getByTestId('database-modal').waitFor({ state: 'visible' });
  const tilesTab = page.getByTestId('db-tab-spatial-tiles');
  if (!(await tilesTab.isVisible())) {
    const groups = page.locator('[data-testid^="db-tab-group-"]');
    const total = await groups.count();
    for (let index = 0; index < total; index += 1) {
      await groups.nth(index).click();
      if (await tilesTab.isVisible()) break;
    }
  }
  await tilesTab.click({ force: true });
  await page.getByTestId('spatial-card-easyrpg_chipset_combined_town').click();
  await page.getByTestId('spatial-tiles-editor').waitFor({ state: 'visible' });
  await page.getByTestId('tileset-section-tab-rules').click();
  await page.getByTestId('tileset-rule-layer').waitFor({ state: 'visible' });

  // 이 QA 는 Supabase 에 아무것도 쓰지 않는다. 앱이 스스로 그 사실을 배너로 말한다.
  const sessionBanner = (await page.getByTestId('save-skip-banner').textContent() ?? '').trim();
  assert.ok(sessionBanner.includes('임시 세션'), `remote persistence must be off for QA, banner said: ${sessionBanner}`);

  await record('01-trunk-policy', async () => {
    await selectTile(TRUNK);
    const panel = await rulesPanel();
    const state = await policyState([TRUNK]);
    assert.ok(panel.policyReason?.startsWith('받침 있는 하위'), `policy class must read 「받침 있는 하위」, got: ${panel.policyReason}`);
    assert.ok(panel.policyReason.includes('수관(상위)과 같은 칸에 공존'), `reason must be shown next to the class: ${panel.policyReason}`);
    assert.ok(panel.multiPart?.includes('다중 조각 제약'), `multi-part constraint must be visible: ${panel.multiPart}`);
    for (const canopy of [260, 261, 262, 263]) {
      assert.ok(panel.multiPart.includes(String(canopy)), `multi-part note must name canopy ${canopy}`);
    }
    assert.equal(state.tiles[TRUNK].kind, 'backedLower', 'the store agrees with the screen');
    assert.equal(state.tiles[TRUNK].home, 'lower', 'trunk home layer stays lower');
    await revealInPanel('tileset-layer-multipart');
    return { policyReason: panel.policyReason, multiPart: panel.multiPart, layerNote: panel.layerNote, storeKind: state.tiles[TRUNK].kind };
  });

  await record('02-backing-auto', async () => {
    const panel = await rulesPanel();
    const state = await policyState([TRUNK]);
    assert.equal(panel.backingPressed.auto, 'true', 'backing defaults to 자동');
    assert.equal(panel.backingNote, `받침 타일 ${GRASS} 을 함께 그립니다.`, `auto backing names the grass tile: ${panel.backingNote}`);
    assert.equal(panel.warning, null, 'no warning while a backing tile exists');
    assert.equal(state.tiles[TRUNK].renderBacking, GRASS, 'the renderer would composite grass under the trunk');
    assert.equal(state.tiles[TRUNK].backingOverride, null, '자동 means no user override is recorded');
    assert.deepEqual(state.reviews, [], 'no review items while every transparent lower tile is backed');
    await revealInPanel('tileset-backing-note');
    return { backingPressed: panel.backingPressed, backingNote: panel.backingNote, warning: null, renderBacking: state.tiles[TRUNK].renderBacking };
  });

  await record('03-backing-none-warning', async () => {
    await clickBacking('none');
    const panel = await rulesPanel();
    const state = await policyState([TRUNK, SIBLING_TRUNK]);
    assert.equal(panel.backingPressed.none, 'true', '없음 is now the pressed choice');
    assert.equal(panel.backingNote, '받침 없음 — 투명 픽셀 아래가 비어 보입니다.', `note flips: ${panel.backingNote}`);
    assert.ok(panel.warning?.includes('투명 부분이 검게 보일 수 있습니다'), `warning must appear exactly now: ${panel.warning}`);
    assert.ok(panel.policyReason?.startsWith('투명 하위(받침 없음)'), `policy class flips too: ${panel.policyReason}`);
    // 브라우저 실측으로 잡은 결함: 부류는 「받침 없음」인데 근거만 "받침 타일로 채웁니다" 로
    // 굳어 있어 바로 위 경고와 정면으로 모순됐다. 이제 근거도 결과를 말한다.
    assert.ok(!panel.policyReason.includes('받침 타일로 투명 픽셀을 채웁니다'),
      `reason must not contradict the warning right above it: ${panel.policyReason}`);
    assert.ok(panel.policyReason.includes('비어 보일 수 있습니다'), `reason states the real outcome: ${panel.policyReason}`);
    assert.equal(state.tiles[TRUNK].renderBacking, null, 'the renderer would composite nothing');
    assert.equal(state.tiles[TRUNK].backingOverride, 'none', 'user choice is recorded on this tile');
    assert.equal(state.tiles[SIBLING_TRUNK].backingOverride, null, `trunk ${SIBLING_TRUNK} is untouched`);
    assert.equal(state.tiles[SIBLING_TRUNK].renderBacking, GRASS, `trunk ${SIBLING_TRUNK} keeps its grass backing`);
    assert.equal(await revealInPanel('tileset-layer-warning'), true, 'the warning must be reachable on screen, not clipped away');
    return { backingPressed: panel.backingPressed, backingNote: panel.backingNote, warning: panel.warning, policyReason: panel.policyReason, sibling: state.tiles[SIBLING_TRUNK] };
  });

  await record('04-review-appears', async () => {
    const panel = await rulesPanel();
    const state = await policyState([TRUNK]);
    assert.ok(panel.reviewLegend?.startsWith('배경 없는 하위 타일 검토'), `review list must appear now: ${panel.reviewLegend}`);
    assert.deepEqual(panel.reviewItems, [TRUNK], `only the tile that lost its backing is listed: ${JSON.stringify(panel.reviewItems)}`);
    assert.deepEqual(state.reviews, [TRUNK], 'the store agrees with the list on screen');
    const choices = await page.evaluate(tile => Array.from(document.querySelectorAll(`[data-testid^="tileset-review-${tile}-"]`))
      .map(node => ({ testid: node.dataset.testid, label: node.textContent?.trim() })), TRUNK);
    assert.equal(choices.length, 4, `each item offers four explicit choices: ${JSON.stringify(choices)}`);
    assert.equal(await revealInPanel(`tileset-review-item-${TRUNK}`), true, 'the review item must be reachable on screen');
    return { reviewLegend: panel.reviewLegend, reviewItems: panel.reviewItems, choices };
  });

  await record('05-backing-grass', async () => {
    await clickBacking('tile');
    const panel = await rulesPanel();
    const state = await policyState([TRUNK]);
    assert.equal(panel.backingPressed.tile, 'true', '잔디 받침 is the pressed choice');
    assert.equal(panel.backingNote, `받침 타일 ${GRASS} 을 함께 그립니다.`, `note returns: ${panel.backingNote}`);
    assert.equal(panel.warning, null, 'the warning disappears together with the missing backing');
    assert.equal(panel.reviewLegend, null, 'the review list only exists while such a tile exists');
    await revealInPanel('tileset-backing-note');
    assert.equal(state.tiles[TRUNK].renderBacking, GRASS);
    assert.equal(state.tiles[TRUNK].backingOverride, GRASS, 'grass is now an explicit user choice');
    assert.deepEqual(state.reviews, []);
    return { backingPressed: panel.backingPressed, backingNote: panel.backingNote, warning: null, reviewLegend: null };
  });

  await record('06-review-overlay-one', async () => {
    // 검토 목록을 다시 만든 다음, 그 항목에서 「상위 오버레이」를 고른다.
    await clickBacking('none');
    await page.getByTestId(`tileset-review-item-${TRUNK}`).waitFor({ state: 'visible' });
    const before = await policyState([TRUNK, SIBLING_TRUNK, 292, 293]);
    assert.equal(before.tiles[TRUNK].layerHome, 'lower', 'the reviewed tile starts on the lower layer');
    await revealInPanel(`tileset-review-item-${TRUNK}`);
    await shot('06-review-overlay-one-before');

    const overlay = page.getByTestId(`tileset-review-${TRUNK}-overlay`);
    await overlay.scrollIntoViewIfNeeded();
    await awaitProjectChange(() => overlay.click());

    const after = await policyState([TRUNK, SIBLING_TRUNK, 292, 293]);
    assert.equal(after.tiles[TRUNK].layerOverride, 'upper', 'the chosen tile is confirmed as an upper overlay');
    assert.equal(after.tiles[TRUNK].layerHome, 'upper', 'its home layer moved');
    assert.equal(after.tiles[TRUNK].kind, 'transparentOverlay', 'and its policy class follows');
    for (const other of [SIBLING_TRUNK, 292, 293]) {
      assert.equal(after.tiles[other].layerOverride, before.tiles[other].layerOverride, `tile ${other} layer override unchanged`);
      assert.equal(after.tiles[other].layerHome, 'lower', `tile ${other} stays on the lower layer`);
      assert.equal(after.tiles[other].renderBacking, before.tiles[other].renderBacking, `tile ${other} backing unchanged`);
    }
    assert.deepEqual(after.reviews, [], 'moving it upper resolves its review item');
    await revealInPanel('tileset-layer-policy-reason');
    return {
      moved: { tile: TRUNK, before: before.tiles[TRUNK].layerHome, after: after.tiles[TRUNK].layerHome, kind: after.tiles[TRUNK].kind },
      untouched: Object.fromEntries([SIBLING_TRUNK, 292, 293].map(tile => [tile, { home: after.tiles[tile].layerHome, backing: after.tiles[tile].renderBacking }])),
    };
  });
} finally {
  const failed = results.filter(result => result.status === 'FAIL');
  await writeFile(`${output}/RESULTS.json`, JSON.stringify({ baseUrl, pageErrors, results }, null, 2));
  await writeFile(
    `${output}/SUMMARY.md`,
    [
      '# OPRN-OUT-026 — 타일 레이어·배경 정책 (브라우저 증거)',
      '',
      `실행: \`${baseUrl}/?blankProject=1\` → 데이터베이스 → 맵/타일 → 합본 마을 칩셋 → 「통행·지형」 탭.`,
      '1440x900, 실제 Chromium. 모든 변경은 로컬 세션에만 남는다(원격 지속성 꺼짐을 단언으로 확인).',
      `결과: ${results.length - failed.length}/${results.length} PASS · 페이지 오류 ${pageErrors.length}건.`,
      '',
      '먼저 열 파일: `01-trunk-policy.png`(정책 부류·근거·다중 조각) →',
      '`03-backing-none-warning.png`(경고가 켜지는 정확한 순간) → `04-review-appears.png`(검토 목록) →',
      '`RESULTS.json`(화면 문구와 저작 데이터를 나란히 담은 실측값).',
      '',
      '| PNG | 무엇을 증명하나 |',
      '|---|---|',
      '| `01-trunk-policy.png` | 나무 밑동 290 을 고르면 정책 부류 「받침 있는 하위」 + 근거 문장 + 다중 조각 제약(수관 260~263)이 함께 보인다. |',
      '| `02-backing-auto.png` | 받침 기본값 「자동」 — 잔디 240 을 함께 그린다고 알려 주고, 경고는 없다. |',
      '| `03-backing-none-warning.png` | 받침을 「없음」으로 바꾸면 부류가 「투명 하위(받침 없음)」로 뒤집히고 **바로 그때** 경고가 뜬다. 형제 밑동 291 은 그대로다. |',
      '| `04-review-appears.png` | 그 타일이 생긴 뒤에야 「배경 없는 하위 타일 검토」 목록이 나타나고, 항목은 290 하나 · 선택지는 네 개다. |',
      '| `05-backing-grass.png` | 받침을 「잔디 받침」으로 되돌리면 경고와 검토 목록이 함께 사라진다 — 경고는 정확히 조건에만 붙는다. |',
      '| `06-review-overlay-one-before.png` → `06-review-overlay-one.png` | 검토 항목의 「상위 오버레이」는 그 타일만 상위로 옮긴다. 291·292·293 의 홈 레이어와 받침은 불변. |',
      '',
      '## 이 촬영이 드러낸 결함 (같은 변경에서 고쳤다)',
      '',
      '받침을 「없음」으로 확정하면 부류는 「투명 하위(받침 없음)」로 바뀌는데, 근거 문장만',
      '"받침 타일로 투명 픽셀을 채웁니다" 로 굳어 있었다. 즉 규칙 탭이 바로 위 경고',
      '(「받침 없이 하위에 깔면 투명 부분이 검게 보일 수 있습니다」)와 정면으로 모순되는 설명을',
      '같은 화면에 띄웠고, 그 문장은 검토 목록 항목에도 그대로 복사된다.',
      '고침: `src/editor/tileLayerPolicy.ts` 의 `trunkReason()` 이 실제 받침 결과를 말한다.',
      '회귀: `test/tileLayerPolicy.test.ts` 2건(없음일 때 모순 문구 금지 / 받침이 살아 있을 때는 그대로).',
      '',
      '## 페이지 오류',
      '',
      pageErrors.length > 0
        ? pageErrors.map(error => `- ${error}`).join('\n')
        : '없음. Vite HMR 웹소켓 실패(GET 중계는 웹소켓을 프록시하지 못한다)와 `?blankProject=1` 의 의도적 자동저장 비활성 알림만 환경 소음으로 걸렀다.',
      '',
      '## 재현',
      '',
      '```',
      'DEV_SERVER_PORT=9865 npm run dev:worktree',
      `TILE_POLICY_QA_URL=${baseUrl} node scripts/qa/tile-layer-backing-policy.mjs`,
      '```',
      '',
      ...results.map(result => `- **${result.name}** — ${result.status}${result.error ? `\n  - error: ${result.error}` : ''}`),
      '',
    ].join('\n'),
  );
  await context.close();
  await browser.close();
}

const failed = results.filter(result => result.status === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} PASS · page errors: ${pageErrors.length}`);
if (pageErrors.length > 0) console.log(pageErrors.join('\n'));
if (failed.length > 0 || pageErrors.length > 0) process.exitCode = 1;
