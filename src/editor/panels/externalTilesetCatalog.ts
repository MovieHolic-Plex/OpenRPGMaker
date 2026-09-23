import { EXTERNAL_TILESET_PACKS } from '@/project/externalTilesetCatalog';
import { importExternalTileset } from '@/editor/externalTilesetImport';
import { PIXEL_ART_WORLD_AUTOTILES, canAppendPixelArtWorldAutotile } from '@/project/pixelArtWorldAutotiles';
import { importPixelArtWorldAutotile } from '@/editor/pixelArtWorldAutotileImport';
import { store } from '@/project/store';
import { el } from '@/util/dom';
import { openDialog } from './databaseEnemyRecordSupport';
import '@/styles/database/external-tilesets.css';

export function openExternalTilesetCatalog(onImported: (tilesetId: string) => void): void {
  const controller = new AbortController();
  let busy = false;
  const controls: (HTMLButtonElement | HTMLSelectElement)[] = [];
  const refreshTargets: (() => void)[] = [];
  const content = el('div', { class: 'external-tileset-catalog', children: [
    el('p', { text: '제작자에게서 원본을 다운로드한 뒤 PNG를 가져오세요. 확인된 원본에는 AI 조립 설명과 그림이 함께 준비됩니다.' }),
    el('p', { class: 'external-tileset-note', text: '각 타일셋에 표시된 조립 자료와 자동 연결 소재를 지원합니다. 사전 밖의 타일과 완성 장면은 별도로 검토하세요.' }),
  ] });
  for (const pack of EXTERNAL_TILESET_PACKS) {
    const status = el('p', { attrs: { role: 'status', 'aria-live': 'polite' }, dataset: { testid: `${pack.id}-status` } });
    const input = el('input', { attrs: { type: 'file', accept: '.png,image/png', hidden: '' }, dataset: { testid: `${pack.id}-file` } });
    const button = el('button', { class: 'btn', text: '받은 PNG 가져오기', attrs: { type: 'button' }, on: { click: () => input.click() } });
    controls.push(button);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file || busy || controller.signal.aborted) return;
      busy = true;
      controls.forEach(control => { control.disabled = true; });
      status.textContent = '원본 확인 및 AI 조립 자료 준비 중…';
      try {
        const id = await importExternalTileset(file, pack, controller.signal);
        status.textContent = '타일 목록에 추가했습니다. 프로젝트 저장 상태는 편집기에서 확인하세요.';
        refreshTargets.forEach(refresh => refresh());
        onImported(id);
      } catch (error) {
        if (!controller.signal.aborted) status.textContent = error instanceof Error ? error.message : '가져오지 못했습니다.';
      } finally {
        busy = false;
        controls.forEach(control => { control.disabled = false; });
      }
    });
    content.append(el('article', { class: 'external-tileset-card', children: [
      el('h3', { text: pack.name }),
      el('p', { text: `32px · ${pack.width}×${pack.height}px · ${pack.recipes.length}종 조립 자료${pack.scenes?.length ? ` · 완성 장면 ${pack.scenes.length}개` : ''}` }),
      el('p', { text: pack.recipes.map(recipe => recipe.name).join(' · ') }),
      el('div', { class: 'external-tileset-actions', children: [
        el('a', { class: 'btn', text: '다운로드 ↗', attrs: { href: pack.sourcePage, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${pack.name} 제작자 다운로드 페이지` } }),
        button, input,
        el('a', { text: '이용 조건 ↗', attrs: { href: pack.termsUrl, target: '_blank', rel: 'noopener noreferrer' } }),
      ] }),
      el('small', { text: `제작자 페이지의 다운로드 버튼으로 ${pack.filename}을 저장하세요. 원본·가공 소재 재배포 금지, 공개 게임에 Pixel Art World 크레딧 필요.` }),
      status,
    ] }));
  }
  content.append(el('h3', { text: '천장·벽·지붕·지면 자동 연결 추가' }));
  content.append(el('p', { class: 'external-tileset-note', text: '먼저 위의 32px 타일셋을 가져온 뒤 대상을 선택하세요. 원본을 47가지 연결 모양으로 조합해 대상 끝에 추가합니다. 기존 타일 번호는 유지됩니다.' }));
  for (const pack of PIXEL_ART_WORLD_AUTOTILES) {
    const status = el('p', { attrs: { role: 'status', 'aria-live': 'polite' }, dataset: { testid: `${pack.id}-status` } });
    const select = el('select', { attrs: { 'aria-label': `${pack.name} 추가 대상` }, dataset: { testid: `${pack.id}-target` } });
    const refresh = () => {
      const previous = select.value;
      select.replaceChildren(el('option', { attrs: { value: '' }, text: '추가할 32px 타일셋 선택' }));
      for (const tileset of Object.values(store.getCurrent().tilesets)) {
        if (!canAppendPixelArtWorldAutotile(tileset) || tileset.autotileGroups?.some(group => group.id === pack.id)) continue;
        select.append(el('option', { attrs: { value: tileset.id }, text: tileset.name }));
      }
      select.value = previous;
      if (select.selectedIndex < 0) select.value = '';
    };
    refreshTargets.push(refresh); refresh();
    select.addEventListener('focus', refresh);
    const input = el('input', { attrs: { type: 'file', accept: '.png,image/png', hidden: '' }, dataset: { testid: `${pack.id}-file` } });
    const button = el('button', { class: 'btn', text: '받은 자동타일 PNG 추가', attrs: { type: 'button' }, on: { click: () => {
      if (!select.value) { status.textContent = '추가할 32px 사용자 타일셋을 먼저 선택하세요.'; return; }
      input.click();
    } } });
    controls.push(button, select);
    input.addEventListener('change', async () => {
      const file = input.files?.[0], tilesetId = select.value;
      input.value = '';
      if (!file || busy || controller.signal.aborted) return;
      if (!tilesetId) { status.textContent = '대상 타일셋을 선택하세요.'; return; }
      busy = true; controls.forEach(control => { control.disabled = true; });
      status.textContent = '원본 확인 및 47가지 연결 모양 준비 중…';
      try {
        const id = await importPixelArtWorldAutotile(file, pack, tilesetId, controller.signal);
        status.textContent = '자동 연결과 AI 참고자료를 추가했습니다. 프로젝트 저장 상태는 편집기에서 확인하세요.';
        refreshTargets.forEach(update => update());
        onImported(id);
      } catch (error) {
        if (!controller.signal.aborted) status.textContent = error instanceof Error ? error.message : '추가하지 못했습니다.';
      } finally {
        busy = false; controls.forEach(control => { control.disabled = false; });
      }
    });
    content.append(el('article', { class: 'external-tileset-card', children: [
      el('h3', { text: pack.name }),
      el('p', { text: `원본 96×128px → 32px 연결 타일 47종 · 하위 · ${pack.passage === 'solid' ? '통행 차단' : '통행 허용'}` }),
      el('p', { text: pack.description }), select,
      el('div', { class: 'external-tileset-actions', children: [
        el('a', { class: 'btn', text: '다운로드 ↗', attrs: { href: pack.sourcePage, target: '_blank', rel: 'noopener noreferrer' } }),
        button, input,
        el('a', { text: '이용 조건 ↗', attrs: { href: pack.termsUrl, target: '_blank', rel: 'noopener noreferrer' } }),
      ] }),
      el('small', { text: `${pack.filename}을 제작자 페이지에서 저장하세요. 원본·가공 소재 재배포 금지. 공개 게임에 Pixel Art World 크레딧 필요.` }), status,
    ] }));
  }
  openDialog('external-tileset-catalog', '외부 타일셋 다운로드', [content], [{ label: '닫기', testid: 'external-tileset-close' }], undefined, () => controller.abort());
}
