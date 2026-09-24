import { PIXEL_ART_WORLD_LOOSE, PIXEL_ART_WORLD_LOOSE_SUPPORT } from '@/project/pixelArtWorldLoose';
import { importPixelArtWorldLoose } from '@/editor/pixelArtWorldLooseImport';
import { el } from '@/util/dom';
export function appendPixelArtWorldLooseCatalog(content: HTMLElement, onImported: (id: string) => void, signal: AbortSignal, controls: (HTMLButtonElement | HTMLSelectElement)[], state: {
    isBusy: () => boolean;
    setBusy: (value: boolean) => void;
    refresh: () => void;
}) {
    content.append(el('h3', { text: '개별 소품 · 원본별 전체 객체' }), el('p', { text: '원본마다 크기와 객체 배열이 다릅니다. 대상 PNG와 받침용 ST-Icecream-I01.png를 함께 선택하세요. 보류 조각과 정적 상태는 각 원본 참고문서에 명시합니다.' }));
    for (const pack of PIXEL_ART_WORLD_LOOSE) {
        const status = el('p', { attrs: { role: 'status', 'aria-live': 'polite' }, dataset: { testid: `${pack.id}-status` } }), input = el('input', { attrs: { type: 'file', accept: '.png,image/png', multiple: '', hidden: '' }, dataset: { testid: `${pack.id}-file` } }), button = el('button', { class: 'btn', text: '소품·받침 PNG 함께 가져오기', attrs: { type: 'button' }, on: { click: () => input.click() } });
        controls.push(button);
        input.addEventListener('change', async () => {
            const files = Array.from(input.files ?? []);
            input.value = '';
            if (!files.length || signal.aborted || state.isBusy())
                return;
            const source = files.find(f => f.name === pack.filename), support = files.find(f => f.name === PIXEL_ART_WORLD_LOOSE_SUPPORT.filename);
            if (!source || !support) {
                status.textContent = `${pack.filename}와 ${PIXEL_ART_WORLD_LOOSE_SUPPORT.filename} 두 원본을 함께 선택하세요.`;
                return;
            }
            state.setBusy(true);
            controls.forEach(c => { c.disabled = true; });
            status.textContent = '원본·전체객체·받침 조립 자료 준비 중…';
            try {
                const id = await importPixelArtWorldLoose(source, pack, support, signal);
                status.textContent = pack.coverage.fixedObjects ? '전체 객체와 원본 참고를 추가했습니다. 프로젝트 저장 상태를 확인하세요.' : '원본 참고만 추가했습니다. 이 시트의 받침 조립은 아직 미검토입니다.';
                state.refresh();
                onImported(id);
            }
            catch (error) {
                if (!signal.aborted)
                    status.textContent = error instanceof Error ? error.message : '가져오지 못했습니다.';
            }
            finally {
                state.setBusy(false);
                controls.forEach(c => { c.disabled = false; });
            }
        });
        content.append(el('article', { class: 'external-tileset-card', children: [el('h3', { text: pack.name }), el('p', { text: `원본 ${pack.width}×${pack.height}px · 고정 객체 ${pack.coverage.fixedObjects}개 · 고정점 보류 ${pack.coverage.sourceOnly}개${pack.coverage.unassignedOpaquePixels ? ' · 추가 미검토 조각 있음' : ''}` }), el('p', { text: pack.recipes.slice(0, 8).map(r => r.name).join(' · ') + (pack.recipes.length > 8 ? ' …' : '') }), el('div', { class: 'external-tileset-actions', children: [el('a', { class: 'btn', text: '소품 다운로드 ↗', attrs: { href: pack.sourcePage, target: '_blank', rel: 'noopener noreferrer' } }), el('a', { text: '받침 다운로드 ↗', attrs: { href: PIXEL_ART_WORLD_LOOSE_SUPPORT.sourcePage, target: '_blank', rel: 'noopener noreferrer' } }), button, input, el('a', { text: '이용 조건 ↗', attrs: { href: pack.termsUrl, target: '_blank', rel: 'noopener noreferrer' } })] }), el('small', { text: '원본 픽셀 크기를 보존합니다. 소재 재배포 금지, 공개 게임에 Pixel Art World 크레딧 필요.' }), status] }));
    }
}
