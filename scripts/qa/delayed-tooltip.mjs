// OPRN-OUT-024 browser evidence — 공통 지연 툴팁이 출하 편집기에서 계약대로 동작한다.
//
// 유닛 테스트(`test/delayedTooltip.test.ts`)는 fakeDom + 가짜 타이머라 실제 렌더 좌표와
// 실제 setTimeout·MutationObserver 경로를 밟지 않는다. 이 스크립트가 그 빈칸을 채운다.
//
// 담는 장면(각각 PNG):
//   01 short-hover        지연(1.2초)보다 짧은 호버는 아무것도 띄우지 않는다
//   02 delayed-shown      지연을 넘기면 짧은 라벨이 뜨고 클릭을 가로채지 않는다
//   03 keyboard-focus     키보드 초점은 같은 라벨을 즉시 보여 준다
//   04 escape-dismiss     Escape 는 툴팁만 닫고 컨트롤을 실행하지 않는다
//   05 viewport-edge      화면 오른쪽 끝 컨트롤에서도 툴팁이 뷰포트 안에 머문다
//   06 rerender-clears    떠 있는 툴팁은 패널이 다시 렌더되면 유령으로 남지 않는다
//   07 title-restored     접근 가능한 이름은 그대로, 네이티브 title 은 이탈 후 복원된다
//   08 assistant-panel    조수 패널 컨트롤(ai-new-chat / ai-command-menu-toggle)
//   09 tileset-editor     타일셋 편집기 컨트롤(tileset-layer-filter-* / tileset-layer-auto)
//
// 실행:
//   DEV_SERVER_PORT=9865 npm run dev:worktree     # 별도 터미널
//   TOOLTIP_QA_URL=http://127.0.0.1:9865 node scripts/qa/delayed-tooltip.mjs

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.TOOLTIP_QA_OUTPUT ?? 'verify-shots/oprn-024';
const baseUrl = process.env.TOOLTIP_QA_URL ?? 'http://127.0.0.1:9865';
const headed = process.argv.includes('--headed');
await mkdir(output, { recursive: true });

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

/** 지연 시간은 소스가 정본이다 — 스크립트에 숫자를 베끼지 않는다. */
const delayMs = () => page.evaluate(async () => {
  const { TOOLTIP_DELAY_MS } = await import('/src/editor/delayedTooltip.ts');
  return TOOLTIP_DELAY_MS;
});

const rollout = () => page.evaluate(async () => {
  const { DELAYED_TOOLTIP_ROLLOUT } = await import('/src/editor/delayedTooltipRollout.ts');
  return DELAYED_TOOLTIP_ROLLOUT.map(target => ({ label: target.label, name: target.name, testid: target.testid }));
});

/** 떠 있는 툴팁의 실측 상태. 없으면 null. */
const tooltip = () => page.evaluate(() => {
  const tip = document.querySelector('[data-testid="delayed-tooltip"]');
  if (!tip) return null;
  const rect = tip.getBoundingClientRect();
  const style = getComputedStyle(tip);
  return {
    text: (tip.textContent ?? '').trim(),
    role: tip.getAttribute('role'),
    side: tip.classList.contains('side-above') ? 'above' : 'below',
    rect: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
    pointerEvents: style.pointerEvents,
    position: style.position,
    zIndex: style.zIndex,
    // 화면에 실제로 보이는가. `pointer-events: none` 이라 elementFromPoint 는 툴팁을
    // 건너뛰므로, 그 자리의 최상단 요소가 툴팁을 가리는 층인지 z-index 로 잰다.
    occludedBy: (() => {
      const x = Math.round((rect.left + rect.right) / 2);
      const y = Math.round((rect.top + rect.bottom) / 2);
      const own = Number(style.zIndex) || 0;
      for (let node = document.elementFromPoint(x, y); node; node = node.parentElement) {
        const layer = Number(getComputedStyle(node).zIndex);
        if (!Number.isFinite(layer) || layer <= own) continue;
        return { selector: node.dataset?.testid ?? node.className ?? node.tagName, zIndex: layer };
      }
      return null;
    })(),
  };
});

const control = async testid => {
  const locator = page.getByTestId(testid).first();
  await locator.waitFor({ state: 'visible' });
  // 편집기 셸은 첫 프레임 뒤 한 번 더 그려진다 — 그 사이 노드가 떨어지면 박스가 null 이다.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const box = await locator.boundingBox();
    if (box && box.width > 0) return { box, locator };
    await locator.waitFor({ state: 'visible' });
  }
  throw new Error(`no layout box for ${testid}`);
};

/**
 * 툴팁이 뜨는(또는 사라지는) 순간을 상태 폴링이 아니라 DOM 변화로 기다린다.
 * 지연 시간 자체가 계약이라 대기 상한만 지연 기준으로 잡는다.
 */
const waitForTooltip = (expected, timeout) =>
  page.waitForFunction(
    want => Boolean(document.querySelector('[data-testid="delayed-tooltip"]')) === want,
    expected,
    { timeout },
  );

const attrs = testid => page.evaluate(id => {
  const node = document.querySelector(`[data-testid="${id}"]`);
  if (!node) return null;
  return {
    ariaLabel: node.getAttribute('aria-label'),
    title: node.getAttribute('title'),
    attached: node.dataset.delayedTooltipAttached ?? null,
  };
}, testid);

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

const AWAY = { x: 720, y: 520 };

/**
 * 다음 장면을 깨끗한 상태에서 시작한다. 초점으로 띄운 툴팁은 포인터를 옮겨도 닫히지
 * 않으므로(blur 가 없다) 초점을 명시적으로 걷고 포인터도 중립 지점으로 보낸다.
 */
const dismissTooltip = async () => {
  await page.evaluate(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
  });
  await page.mouse.move(AWAY.x, AWAY.y);
  await waitForTooltip(false, 5_000);
};

try {
  await page.goto(`${baseUrl}/?blankProject=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('edit-canvas').waitFor({ state: 'visible', timeout: 120_000 });
  const DELAY = await delayMs();
  const ROLLOUT = await rollout();
  const labelOf = testid => {
    const found = ROLLOUT.find(target => target.testid === testid);
    assert.ok(found, `${testid} must be in DELAYED_TOOLTIP_ROLLOUT`);
    return found;
  };

  await record('01-short-hover', async () => {
    const save = await control('toolbar-save');
    await dismissTooltip();
    await page.mouse.move(save.box.x + save.box.width / 2, save.box.y + save.box.height / 2);
    // 지연의 1/3 만 머문다 — 뜨기 전에 실제로 아무것도 없어야 한다.
    await assert.rejects(() => waitForTooltip(true, Math.round(DELAY / 3)), /Timeout/, 'short hover must not reveal the tooltip');
    const during = await attrs('toolbar-save');
    assert.equal(await tooltip(), null, 'no tooltip before the delay elapses');
    assert.equal(during.title, null, 'native title is stashed while the pointer rests on the control');
    assert.equal(during.ariaLabel, labelOf('toolbar-save').name, 'accessible name stays complete');
    return { delayMs: DELAY, hoverMs: Math.round(DELAY / 3), tooltip: null, titleWhileHovered: during.title };
  });

  await record('02-delayed-shown', async () => {
    const save = await control('toolbar-save');
    await dismissTooltip();
    await page.mouse.move(save.box.x + save.box.width / 2, save.box.y + save.box.height / 2);
    await waitForTooltip(true, DELAY + 3_000);
    const tip = await tooltip();
    const target = labelOf('toolbar-save');
    assert.equal(tip.text, target.label, `tooltip shows the concise label, got ${tip.text}`);
    assert.ok(tip.text.length <= 6, `visual label stays short: ${tip.text}`);
    assert.equal(tip.role, 'tooltip');
    assert.equal(tip.pointerEvents, 'none', 'tooltip must not intercept clicks');
    assert.equal(tip.position, 'fixed', 'tooltip must not push layout');
    assert.ok(tip.rect.top >= save.box.y + save.box.height, 'tooltip does not cover its target');
    assert.equal(tip.occludedBy, null, `tooltip must be on screen, not behind ${JSON.stringify(tip.occludedBy)}`);
    return { label: tip.text, accessibleName: target.name, side: tip.side, rect: tip.rect, pointerEvents: tip.pointerEvents, zIndex: tip.zIndex };
  });

  await record('03-keyboard-focus', async () => {
    await dismissTooltip();
    const palette = await control('workspace-command-palette-button');
    await palette.locator.focus();
    await waitForTooltip(true, 3_000);
    const tip = await tooltip();
    const target = labelOf('workspace-command-palette-button');
    assert.equal(tip.text, target.label, 'keyboard focus reveals the same concise label');
    const live = await attrs('workspace-command-palette-button');
    assert.equal(live.ariaLabel, target.name, 'focus path keeps the full accessible name');
    return { control: 'workspace-command-palette-button', label: tip.text, accessibleName: live.ariaLabel, rect: tip.rect };
  });

  await record('04-escape-dismiss', async () => {
    await dismissTooltip();
    // Escape 가 컨트롤을 실행하면 명령 팔레트가 열린다 — 열림 여부와 click 횟수를 함께 본다.
    await page.evaluate(() => {
      window.__tooltipQaClicks = 0;
      document.querySelector('[data-testid="workspace-command-palette-button"]')
        ?.addEventListener('click', () => { window.__tooltipQaClicks += 1; });
    });
    const palette = await control('workspace-command-palette-button');
    await palette.locator.focus();
    await waitForTooltip(true, 3_000);
    await shot('04-escape-dismiss-before');
    await page.keyboard.press('Escape');
    await waitForTooltip(false, 3_000);
    const clicks = await page.evaluate(() => window.__tooltipQaClicks);
    const paletteOpen = await page.evaluate(() => Boolean(document.querySelector('[data-testid="command-palette"], [data-testid="workspace-command-palette"]')));
    assert.equal(await tooltip(), null, 'Escape closes the tooltip');
    assert.equal(clicks, 0, 'Escape must not activate the control');
    assert.equal(paletteOpen, false, 'Escape must not open the command palette');
    return { clicks, paletteOpen, tooltipAfterEscape: null };
  });

  await record('05-viewport-edge', async () => {
    // 톱바 맨 오른쪽 컨트롤 — 대상 중앙 정렬이면 툴팁이 화면 밖으로 나간다.
    await dismissTooltip();
    const fullscreen = await control('window-fullscreen');
    await fullscreen.locator.focus();
    await waitForTooltip(true, 3_000);
    const tip = await tooltip();
    const viewport = page.viewportSize();
    const target = labelOf('window-fullscreen');
    assert.equal(tip.text, target.label);
    assert.ok(tip.rect.left >= 0 && tip.rect.top >= 0, `tooltip stays inside the viewport: ${JSON.stringify(tip.rect)}`);
    assert.ok(tip.rect.right <= viewport.width, `tooltip right edge ${tip.rect.right} <= ${viewport.width}`);
    assert.ok(tip.rect.bottom <= viewport.height, `tooltip bottom ${tip.rect.bottom} <= ${viewport.height}`);
    assert.ok(tip.rect.right < fullscreen.box.x + fullscreen.box.width + 8, 'tooltip is clamped, not centered off-screen');
    return { control: 'window-fullscreen', targetRight: Math.round(fullscreen.box.x + fullscreen.box.width), tooltipRect: tip.rect, viewport };
  });

  await record('06-rerender-clears', async () => {
    // 툴팁을 띄운 채 톱바를 다시 그린다(앱이 editorUiMode·workspace 구독에서 하는 그대로).
    // 초점이 아니라 **호버**로 띄운다: 초점 경로는 리렌더가 focus 를 걷어 가며 blur 로도
    // 닫히므로, 대상이 DOM 에서 떨어지는 진짜 경로를 가린다(실측 2026-09-10).
    const settings = await control('topbar-ai-settings');
    await dismissTooltip();
    await page.mouse.move(settings.box.x + settings.box.width / 2, settings.box.y + settings.box.height / 2);
    await waitForTooltip(true, DELAY + 3_000);
    const before = await tooltip();
    assert.equal(before.text, labelOf('topbar-ai-settings').label);
    await shot('06-rerender-clears-before');
    await page.evaluate(async () => {
      const { renderTopbar } = await import('/src/editor/panels/menu.ts');
      const topbar = document.querySelector('[data-testid="oprn-menu-bar"]')?.parentElement;
      if (!topbar) throw new Error('topbar host not found');
      renderTopbar(topbar);
    });
    await waitForTooltip(false, 3_000);
    assert.equal(await tooltip(), null, 'a visible tooltip must not survive its target being re-rendered away');
    // 새로 그려진 컨트롤에도 툴팁이 다시 붙어 있어야 한다(설치기는 멱등).
    const reattached = await attrs('topbar-ai-settings');
    assert.equal(reattached.attached, '1', 'the fresh node gets the tooltip installed again');
    return { labelBefore: before.text, tooltipAfterRerender: null, reattached: reattached.attached };
  });

  await record('07-title-restored', async () => {
    const testid = 'toolbar-save';
    const target = labelOf(testid);
    await dismissTooltip();
    const idle = await attrs(testid);
    assert.equal(idle.title, target.name, `native title is intact while idle (e2e contract): ${idle.title}`);
    assert.equal(idle.ariaLabel, target.name, 'accessible name is the full sentence');

    const save = await control(testid);
    await page.mouse.move(save.box.x + save.box.width / 2, save.box.y + save.box.height / 2);
    await waitForTooltip(true, DELAY + 3_000);
    const hovered = await attrs(testid);
    assert.equal(hovered.title, null, 'native title is removed only while hovered, so the popups never stack');
    assert.equal(hovered.ariaLabel, target.name, 'accessible name is never truncated to the visual label');
    assert.notEqual(hovered.ariaLabel, target.label, 'the short visual label does not replace the accessible name');

    await dismissTooltip();
    const restored = await attrs(testid);
    assert.equal(restored.title, target.name, 'native title is restored after the pointer leaves');
    return { idleTitle: idle.title, hoveredTitle: hovered.title, restoredTitle: restored.title, accessibleName: restored.ariaLabel, visualLabel: target.label };
  });

  await record('08-assistant-panel', async () => {
    const proofs = [];
    for (const testid of ['ai-new-chat', 'ai-command-menu-toggle']) {
      const target = labelOf(testid);
      await dismissTooltip();
      const found = await control(testid);
      await page.mouse.move(found.box.x + found.box.width / 2, found.box.y + found.box.height / 2);
      await waitForTooltip(true, DELAY + 3_000);
      const tip = await tooltip();
      const live = await attrs(testid);
      assert.equal(tip.text, target.label, `${testid} shows its rollout label`);
      assert.equal(live.ariaLabel, target.name, `${testid} keeps its full accessible name`);
      assert.ok(tip.rect.left >= 0 && tip.rect.right <= page.viewportSize().width, `${testid} tooltip stays in the viewport`);
      assert.equal(tip.occludedBy, null, `${testid} tooltip is hidden behind ${JSON.stringify(tip.occludedBy)}`);
      await shot(`08-assistant-panel-${testid}`);
      proofs.push({ testid, label: tip.text, accessibleName: live.ariaLabel, side: tip.side, rect: tip.rect, zIndex: tip.zIndex });
    }
    return { controls: proofs };
  });

  await record('09-tileset-editor', async () => {
    await dismissTooltip();
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

    const proofs = [];
    for (const testid of ['tileset-layer-filter-lower', 'tileset-layer-auto']) {
      const target = labelOf(testid);
      await dismissTooltip();
      const found = await control(testid);
      await page.mouse.move(found.box.x + found.box.width / 2, found.box.y + found.box.height / 2);
      await waitForTooltip(true, DELAY + 3_000);
      const tip = await tooltip();
      const live = await attrs(testid);
      assert.equal(tip.text, target.label, `${testid} shows its rollout label`);
      assert.equal(live.ariaLabel, target.name, `${testid} keeps its full accessible name`);
      assert.equal(tip.pointerEvents, 'none');
      // 데이터베이스 모달 안의 컨트롤이다 — 툴팁이 모달 뒤로 가면 없는 것과 같다.
      assert.equal(tip.occludedBy, null, `${testid} tooltip is hidden behind ${JSON.stringify(tip.occludedBy)}`);
      await shot(`09-tileset-editor-${testid}`);
      proofs.push({ testid, label: tip.text, accessibleName: live.ariaLabel, side: tip.side, rect: tip.rect, zIndex: tip.zIndex });
    }

    // 세 표면 모두를 실제로 덮었는지 마지막에 한 번 더 못 박는다.
    const covered = ['toolbar-save', 'workspace-command-palette-button', 'window-fullscreen', 'topbar-ai-settings', 'ai-new-chat', 'ai-command-menu-toggle', 'tileset-layer-filter-lower', 'tileset-layer-auto'];
    for (const testid of covered) labelOf(testid);
    assert.ok(covered.length >= 3, 'at least three rollout controls proven');
    return { controls: proofs, coveredRolloutControls: covered, rolloutSize: ROLLOUT.length };
  });
} finally {
  const failed = results.filter(result => result.status === 'FAIL');
  await writeFile(`${output}/RESULTS.json`, JSON.stringify({ baseUrl, pageErrors, results }, null, 2));
  await writeFile(
    `${output}/SUMMARY.md`,
    [
      '# OPRN-OUT-024 — 공통 지연 툴팁 (브라우저 증거)',
      '',
      `실행: \`${baseUrl}/?blankProject=1\`, 1440x900, 편집기 표준 모드, 실제 Chromium.`,
      `결과: ${results.length - failed.length}/${results.length} PASS · 페이지 오류 ${pageErrors.length}건.`,
      '',
      '먼저 열 파일: `02-delayed-shown.png`(정상 표시) → `05-viewport-edge.png`(가장자리 클램프)',
      '→ `06-rerender-clears.png`(유령 툴팁 회귀 지점) → `RESULTS.json`(모든 단언의 실측값).',
      '',
      '| PNG | 무엇을 증명하나 |',
      '|---|---|',
      '| `01-short-hover.png` | 지연(TOOLTIP_DELAY_MS)의 1/3 만 머문 호버는 툴팁을 띄우지 않는다. 그 사이에도 접근 가능한 이름은 완전하다. |',
      '| `02-delayed-shown.png` | 지연을 넘기면 짧은 라벨(「저장」)이 대상 아래에 뜨고, `pointer-events: none` · `position: fixed` 로 클릭·레이아웃을 건드리지 않는다. |',
      '| `03-keyboard-focus.png` | 키보드 초점만으로 같은 라벨이 즉시 뜬다(명령 팔레트 버튼). |',
      '| `04-escape-dismiss-before.png` → `04-escape-dismiss.png` | Escape 가 툴팁만 닫는다 — click 0회, 명령 팔레트도 열리지 않는다. |',
      '| `05-viewport-edge.png` | 톱바 맨 오른쪽 컨트롤에서 툴팁이 뷰포트 안으로 잘려 들어온다(중앙 정렬이면 화면 밖). |',
      '| `06-rerender-clears-before.png` → `06-rerender-clears.png` | 떠 있는 툴팁이 `renderTopbar` 재렌더에서 사라지고, 새 노드에 툴팁이 다시 붙는다. |',
      '| `07-title-restored.png` | 완전한 접근 가능한 이름은 유지되고, 네이티브 `title` 은 호버 중에만 빠졌다가 이탈 후 복원된다(e2e 계약 보존). |',
      '| `08-assistant-panel-ai-new-chat.png`, `08-assistant-panel-ai-command-menu-toggle.png` | 조수 패널 롤아웃 컨트롤 두 개. |',
      '| `09-tileset-editor-tileset-layer-filter-lower.png`, `09-tileset-editor-tileset-layer-auto.png` | 타일셋 편집기 규칙 탭 롤아웃 컨트롤 두 개. |',
      '',
      '롤아웃 표면 세 곳(톱바·조수 패널·타일셋 편집기)에서 총 8개 컨트롤을 실측했다.',
      '',
      '## 이 촬영이 드러낸 결함 두 건 (같은 변경에서 고쳤다)',
      '',
      '1. **유령 툴팁** — 떠 있는 툴팁의 대상이 패널 리렌더로 교체되면 `pointerleave` 가',
      '   오지 않아 툴팁이 죽은 노드 좌표에 남았다. 유닛 테스트는 *대기 중* 타이머만 덮고',
      '   있었다. 고침: `src/editor/delayedTooltip.ts` 가 표시 중 대상의 이탈을',
      '   `MutationObserver` 로 보고 닫는다. 회귀: `test/delayedTooltip.test.ts`',
      '   「이미 떠 있는 툴팁도 대상이 리렌더로 떨어지면 사라진다」.',
      '2. **모달 뒤에 그려지는 툴팁** — `z-index: 400` 하드코딩 때문에 데이터베이스 모달',
      '   (z-index 900) 안 타일셋 편집기 컨트롤의 툴팁이 화면에 아예 보이지 않았다.',
      '   롤아웃 14개 중 5개가 그 모달 안에 있다. 고침: 토큰 `--z-tooltip`(2650, 모달 위 ·',
      '   토스트 아래)을 `src/styles/tokens.css` 에 추가하고 CSS 가 그것을 쓴다.',
      '   회귀: `test/editorZLayerOrder.test.ts` 3건.',
      '',
      '두 결함 모두 DOM 존재만 보는 단언으로는 잡히지 않는다. 그래서 이 스크립트는',
      '`elementFromPoint` + z-index 로 **가려졌는지**까지 재고, 리렌더 장면을 초점이 아니라',
      '호버로 띄운다(초점 경로는 리렌더가 focus 를 걷어 가며 blur 로도 닫혀 결함을 가린다).',
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
      `TOOLTIP_QA_URL=${baseUrl} node scripts/qa/delayed-tooltip.mjs`,
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
