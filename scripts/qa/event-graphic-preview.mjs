// Focused browser coverage for the editor's image formats; no persisted content.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const out = resolve('verify-shots/event-diary-graphic');
mkdirSync(out, { recursive: true });
const fixtureDir = resolve('output/qa/event-diary');
mkdirSync(fixtureDir, { recursive: true });
writeFileSync(fixtureDir + '/preview.html', '<!doctype html><html lang="ko"><meta charset="utf-8"><title>이벤트 그래픽 확인</title><body></body></html>');
writeFileSync(fixtureDir + '/before-eventGraphicPreview.ts', execFileSync('git', ['show', 'f7e0357ffb36a2137e1ece9264fa935bdd1898e6']));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
try {
  await page.goto((process.env.DIARY_PREVIEW_URL ?? 'http://127.0.0.1:9860') + '/output/qa/event-diary/preview.html');
  await page.evaluate(() => { const base = document.createElement('base'); base.href = '/'; document.head.append(base); });
  const result = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { renderEventGraphicPreview, renderFootprintPreview } = await import('/src/editor/panels/eventEditor/eventGraphicPreview.ts');
    const { renderEventGraphicPreview: before } = await import('/output/qa/event-diary/before-eventGraphicPreview.ts');
    const { editorEventMarkerTexture } = await import('/src/editor/editSceneEventMarkers.ts');
    const { eventGraphicPreviewResource } = await import('/src/editor/panels/eventEditor/eventGraphicPreviewResource.ts');
    const project = store.getCurrent();
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#235b8e','#4d824f','#bc7245','#764f99'][i]; ctx.fillRect(i % 2 * 32, Math.floor(i / 2) * 16, 32, 16); }
    project.assets.uploaded.qa_sheet = { id: 'qa_sheet', name: 'QA sheet', kind: 'sprite', dataUrl: canvas.toDataURL(), meta: { width: 64, height: 32, frameWidth: 32, frameHeight: 16, frames: 4 } };
    project.assets.sprites.qa_alias = { id: 'qa_alias', image: { type: 'uploaded', id: 'qa_sheet' }, frameWidth: 32, frameHeight: 16, frames: 4 };
    project.assets.sprites.qa_charset = { id: 'qa_charset', image: { type: 'bundled', id: 'tex_easyrpg_charset_actor1' }, frameWidth: 24, frameHeight: 32, frames: 96 };
    const cases = [
      { name: '일기 · 노트', graphic: { sprite: { type: 'bundled', id: 'cc0-jetrel-notebook' }, pattern: 91 } },
      { name: '일반 시트 · 아래 행', graphic: { sprite: { type: 'uploaded', id: 'qa_sheet' }, pattern: 3, direction: 'up' } },
      { name: '프로젝트 시트 참조', graphic: { sprite: { type: 'uploaded', id: 'qa_alias' }, pattern: 2 } },
      { name: '캐릭터 시트 참조', graphic: { sprite: { type: 'bundled', id: 'qa_charset' }, pattern: 76 } },
      { name: '기존 캐릭터', graphic: { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_actor1' }, pattern: 76 } },
    ];
    document.body.innerHTML = '<h1>이벤트 편집기 그래픽</h1><p>수정 전 / 수정 후 · 같은 그림과 프레임</p>';
    document.body.style.cssText = 'font:16px sans-serif;background:#f7f3ea;color:#342d26;padding:24px';
    const results = cases.map(({ name, graphic }) => {
      const old = before(graphic), next = renderEventGraphicPreview(graphic, 'random');
      const card = document.createElement('section'); card.style.cssText = 'display:inline-grid;gap:14px;padding:20px;background:white;margin:6px;vertical-align:top';
      const label = document.createElement('div'); label.textContent = name; card.append(label);
      for (const [title, node] of [['수정 전', old], ['수정 후', next]]) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:18px;align-items:center';
        const caption = document.createElement('span'); caption.textContent = title; row.append(caption, node);
        node.style.border = '1px solid #a79980'; node.style.imageRendering = 'pixelated';
        if (node.dataset.unsupported) node.style.cssText += ';width:48px;height:64px;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/12px 12px';
        card.append(row);
      }
      document.body.append(card);
      return { name, marker: editorEventMarkerTexture(project, graphic), before: { ...old.dataset }, after: { ...next.dataset }, size: [next.style.width, next.style.height], position: next.style.backgroundPosition, moving: next.classList.contains('moving'), resource: eventGraphicPreviewResource(project, graphic)?.kind };
    });
    const footprint = renderFootprintPreview({ graphic: cases[0].graphic, footprint: { width: 1, height: 1 }, passRows: 1 });
    return { cases: results, footprint: { width: footprint.style.width, height: footprint.style.height, sprite: footprint.querySelector('[data-testid="event-page-footprint-preview-sprite"]').style.width }, invalid: eventGraphicPreviewResource(project, { sprite: { type:'uploaded', id:'qa_sheet' }, pattern: 4 }) };
  });
  assert(result.cases.every(c => c.marker && !c.after.unsupported), 'Supported map graphics must also render in the editor');
  assert.equal(result.cases[0].before.unsupported, 'true');
  assert.equal(result.cases[1].position, '-48px -24px');
  assert.equal(result.cases[2].position, '0px -24px');
  assert(result.cases.slice(0, 3).every(c => !c.moving), 'General sprites must not animate through unrelated frames');
  assert.equal(result.cases[3].after.slot, '5');
  assert.equal(result.cases[4].after.pattern, result.cases[4].before.pattern);
  assert.equal(result.footprint.sprite, '32px');
  assert.equal(result.invalid, null);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-transparent-color-key]')].every(n => n.dataset.transparentColorKey !== 'pending'));
  assert(await page.locator('[data-transparent-color-key]').evaluateAll(nodes => nodes.every(n => n.dataset.transparentColorKey === 'applied')), 'Character images must actually load');
  await page.screenshot({ path: out + '/formats-before-after.png', fullPage: true });
  writeFileSync(out + '/formats.json', JSON.stringify(result, null, 2) + '\n');
  console.log('Verified', result.cases.length, 'image cases and footprint geometry');
} finally { await browser.close(); }
