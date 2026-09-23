import { EXTERNAL_TILESET_PACKS } from '@/project/externalTilesetCatalog';
import { importExternalTileset } from '@/editor/externalTilesetImport';
import { el } from '@/util/dom';
import { openDialog } from './databaseEnemyRecordSupport';
import '@/styles/database/external-tilesets.css';

export function openExternalTilesetCatalog(onImported: (tilesetId: string) => void): void {
  const controller = new AbortController();
  let busy = false;
  const controls: HTMLButtonElement[] = [];
  const content = el('div', { class: 'external-tileset-catalog', children: [
    el('p', { text: '제작자에게서 원본을 다운로드한 뒤 PNG를 가져오세요. 확인된 원본에는 AI 조립 설명과 그림이 함께 준비됩니다.' }),
    el('p', { class: 'external-tileset-note', text: '시범 지원: 도서관·사무실의 가구 각 5종. 완성 방과 시트 전체의 자동 배치는 아직 지원하지 않습니다.' }),
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
      el('p', { text: `32px · ${pack.width}×${pack.height}px · ${pack.recipes.length}종 가구 조립 정보` }),
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
  openDialog('external-tileset-catalog', '외부 타일셋 다운로드', [content], [{ label: '닫기', testid: 'external-tileset-close' }], undefined, () => controller.abort());
}
