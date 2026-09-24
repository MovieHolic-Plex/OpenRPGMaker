import { PIXEL_ART_WORLD_STATIC_PROPS_COMPLEMENTS } from '@/project/pixelArtWorldStaticPropsComplements';
import { importPixelArtWorldStaticPropsComplements } from '@/editor/pixelArtWorldStaticPropsComplementsImport';
import { el } from '@/util/dom';
export function appendPixelArtWorldStaticPropsComplementsCatalog(content: HTMLElement, onImported: (id: string) => void, signal: AbortSignal, controls: (HTMLButtonElement | HTMLSelectElement)[], state: {
    isBusy: () => boolean;
    setBusy: (v: boolean) => void;
    refresh: () => void;
}) {
    content.append(el('h3', { text: '정적 소품 · 별도 보완 원본' }), el('p', { text: '이젤·기둥·큰 석상·주크박스·흉상의 온전한 객체와 작은 방향·지지 조립 표본입니다. 표시된 원본 PNG를 함께 선택하세요. 기존 소품 자료는 유지합니다.' }));
    for (const pack of PIXEL_ART_WORLD_STATIC_PROPS_COMPLEMENTS) {
        const status = el('p', { attrs: { role: 'status', 'aria-live': 'polite' }, dataset: { testid: pack.id + '-status' } }), input = el('input', { attrs: { type: 'file', multiple: '', accept: '.png,image/png', hidden: '' }, dataset: { testid: pack.id + '-file' } }), button = el('button', { class: 'btn', text: '원본 PNG 함께 가져오기', attrs: { type: 'button' }, on: { click: () => input.click() } });
        controls.push(button);
        input.addEventListener('change', async () => { const files = Array.from(input.files ?? []); input.value = ''; if (!files.length || signal.aborted || state.isBusy())
            return; const missing = pack.sources.filter(s => !files.some(f => f.name === s.filename)); if (missing.length) {
            status.textContent = '함께 선택할 원본: ' + missing.map(s => s.filename).join(', ');
            return;
        } state.setBusy(true); controls.forEach(c => c.disabled = true); status.textContent = '원본 확인 및 전체 조립·받침 자료 준비 중…'; try {
            const id = await importPixelArtWorldStaticPropsComplements(files, pack, signal);
            status.textContent = '완성 객체와 받침 조립 자료를 추가했습니다. 프로젝트 저장 상태를 확인하세요.';
            state.refresh();
            onImported(id);
        }
        catch (e) {
            if (!signal.aborted)
                status.textContent = e instanceof Error ? e.message : '가져오지 못했습니다.';
        }
        finally {
            state.setBusy(false);
            controls.forEach(c => c.disabled = false);
        } });
        content.append(el('article', { class: 'external-tileset-card', children: [el('h3', { text: pack.name }), el('p', { text: pack.sources.map(s => s.filename).join(' + ') }), el('p', { text: pack.recipes.map(r => r.name).join(' · ') }), el('div', { class: 'external-tileset-actions', children: [...Array.from(new Set(pack.sources.map(s => s.sourcePage))).map((url, i) => el('a', { class: 'btn', text: `원본 다운로드 ${i + 1} ↗`, attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' } })), button, input, el('a', { text: '이용 조건 ↗', attrs: { href: pack.termsUrl, target: '_blank', rel: 'noopener noreferrer' } })] }), el('small', { text: '모두 정적 상태입니다. 원본·가공 소재 재배포 금지, 공개 게임에 Pixel Art World 크레딧 필요.' }), status] }));
    }
}
