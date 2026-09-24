import { PIXEL_ART_WORLD_FOOD, PIXEL_ART_WORLD_FOOD_SUPPORT } from '@/project/pixelArtWorldFood';
import { importPixelArtWorldFood } from '@/editor/pixelArtWorldFoodImport';
import { el } from '@/util/dom';
export function appendPixelArtWorldFoodCatalog(content: HTMLElement, onImported: (id: string) => void, signal: AbortSignal, controls: (HTMLButtonElement | HTMLSelectElement)[], state: {
    isBusy: () => boolean;
    setBusy: (value: boolean) => void;
    refresh: () => void;
}) {
    content.append(el('h3', { text: '음식·식기 소품과 식탁 합성' }), el('p', { text: '음식 원본과 받침용 ST-Icecream-I01.png를 함께 선택하세요. 원본 소품과 음식이 놓인 식탁을 별도 타일셋으로 준비합니다. 빈 그릇·식후·포장 상태도 보존합니다.' }));
    for (const pack of PIXEL_ART_WORLD_FOOD) {
        const status = el('p', { attrs: { role: 'status', 'aria-live': 'polite' }, dataset: { testid: `${pack.id}-status` } });
        const input = el('input', { attrs: { type: 'file', accept: '.png,image/png', multiple: '', hidden: '' }, dataset: { testid: `${pack.id}-file` } });
        const button = el('button', { class: 'btn', text: '음식·식탁 PNG 함께 가져오기', attrs: { type: 'button' }, on: { click: () => input.click() } });
        controls.push(button);
        input.addEventListener('change', async () => {
            const files = Array.from(input.files ?? []);
            input.value = '';
            if (!files.length || state.isBusy() || signal.aborted)
                return;
            const food = files.find(file => file.name === pack.filename), table = files.find(file => file.name === PIXEL_ART_WORLD_FOOD_SUPPORT.filename);
            if (!food || !table) {
                status.textContent = `${pack.filename}와 ${PIXEL_ART_WORLD_FOOD_SUPPORT.filename} 두 원본을 함께 선택하세요.`;
                return;
            }
            state.setBusy(true);
            controls.forEach(control => { control.disabled = true; });
            status.textContent = '두 원본 확인 및 음식·식탁 조립 자료 준비 중…';
            try {
                const id = await importPixelArtWorldFood(food, pack, table, signal);
                status.textContent = '원본 소품과 식탁 합성 타일셋을 추가했습니다. 프로젝트 저장 상태를 확인하세요.';
                state.refresh();
                onImported(id);
            }
            catch (error) {
                if (!signal.aborted)
                    status.textContent = error instanceof Error ? error.message : '가져오지 못했습니다.';
            }
            finally {
                state.setBusy(false);
                controls.forEach(control => { control.disabled = false; });
            }
        });
        content.append(el('article', { class: 'external-tileset-card', dataset: { search: `${pack.name} ${pack.filename} 음식 식기 식탁 food ${pack.recipes.map(recipe => recipe.name).join(' ')}`.toLocaleLowerCase() }, children: [
                el('h3', { text: pack.name }), el('p', { text: `원본 ${pack.width}×${pack.height}px · 4열 · ${pack.recipes.length}개 그림 묶음 · 식탁 합성 ${pack.coverage.tableComposites}개` }),
                el('p', { text: pack.recipes.map(recipe => recipe.name).join(' · ') }),
                el('div', { class: 'external-tileset-actions', children: [el('a', { class: 'btn', text: '음식 다운로드 ↗', attrs: { href: pack.sourcePage, target: '_blank', rel: 'noopener noreferrer' } }), el('a', { text: '식탁 원본 다운로드 ↗', attrs: { href: PIXEL_ART_WORLD_FOOD_SUPPORT.sourcePage, target: '_blank', rel: 'noopener noreferrer' } }), button, input, el('a', { text: '이용 조건 ↗', attrs: { href: pack.termsUrl, target: '_blank', rel: 'noopener noreferrer' } })] }),
                el('small', { text: `${pack.filename} + ${PIXEL_ART_WORLD_FOOD_SUPPORT.filename}. ${pack.coverage.excludedCompositionIds.length ? '매달린 고기·소시지·장갑의 받침 조립은 미검토. ' : ''}원본·가공 소재 재배포 금지, 공개 게임에 Pixel Art World 크레딧 필요.` }), status,
            ] }));
    }
}
