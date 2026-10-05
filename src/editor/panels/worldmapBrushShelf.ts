import { el } from '@/util/dom';
import { tilesetTileBackgroundStyle } from '@/editor/tilesetImage';
import type { TilesetDef } from '@/project/types';
import { WORLDMAP_BRUSHES } from '@/project/defaults/worldmapAuthoring';
import { editorState } from '@/editor/editorState';
let background = 'sea';
export function hasWorldmapBrushes(t: TilesetDef): boolean {
    return t.autotileGroups?.some(g => g.id === 'worldmap-brush-grass-sea') === true;
}
/** Actual native tile selections, with all connection variants hidden behind each brush. */
export function makeWorldmapBrushShelf(t: TilesetDef, layer: 'lower' | 'upper', selected: number, onSelect: (tile: number) => void, rerender: () => void): HTMLElement {
    const root = el('div', { dataset: { testid: 'worldmap-brush-shelf' }, attrs: { style: 'padding:8px;overflow:auto;min-height:0;flex:1 1 auto' } });
    if (layer === 'lower') {
        const select = el('select', { attrs: { 'aria-label': '붓 배경', style: 'width:100%;margin-bottom:8px' }, dataset: { testid: 'worldmap-brush-background' } }) as HTMLSelectElement;
        for (const [value, name] of [['sea', '바다 위에 육지·섬'], ['grass', '초원 위에 지형·강·길'], ['sand', '사막 위에 지형·강·길'], ['snow', '설원 위에 지형·강·길']])
            select.append(el('option', { text: name, attrs: { value } }));
        select.value = background;
        select.onchange = () => { background = select.value; rerender(); };
        root.append(select);
        root.append(el('p', { text: '바탕에 맞는 붓을 고르세요. 지형·강·길은 이웃에 맞춰 연결됩니다.', attrs: { style: 'font-size:11px;margin:0 0 8px;line-height:1.5' } }));
    }
    else
        root.append(el('p', { text: '숲·산은 아래 지형을 보존합니다. 고개·도시 자리는 위층 지우개로 비우세요.', attrs: { style: 'font-size:11px;line-height:1.5' } }));
    const grid = el('div', { attrs: { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px' } });
    const tileGroups = new Map(t.tileGroups?.map(g => [g.id, g]));
    const button = (id: string, label: string, tile: number) => el('button', { class: 'btn' + (selected === tile ? ' active' : ''), attrs: { type: 'button', 'aria-pressed': String(selected === tile), title: label, style: 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;min-height:64px;font-size:11px;white-space:normal' },
        dataset: { testid: id, tile: String(tile) }, children: [el('span', { attrs: { style: 'display:block;width:32px;height:32px;image-rendering:pixelated;' + tilesetTileBackgroundStyle(t, tile, 32) } }), el('span', { text: label })], on: { click: () => onSelect(tile) } });
    if (layer === 'lower')
        for (const key of ['sea', background === 'sea' ? 'grass' : background]) {
            const group = tileGroups.get('worldmap-brush-plain-' + key);
            if (group)
                grid.append(button('worldmap-brush-plain-' + key, key === 'sea' ? '바다 · 땅 지우기' : group.name + ' 바탕', group.tileIds[0]!));
        }
    for (const brush of WORLDMAP_BRUSHES) {
        if (brush.layer !== layer)
            continue;
        if (layer === 'lower' && brush.background !== background && brush.background !== 'water')
            continue;
        const group = tileGroups.get(brush.id);
        if (!group)
            continue;
        const auto = t.autotileGroups?.find(g => g.id === brush.id);
        const tile = auto?.variantMap['0'] ?? group.tileIds[0]!;
        grid.append(button(brush.id, brush.name, tile));
    }
    root.append(grid);
    if (layer === 'lower') {
        const height = el('div', { attrs: { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:10px' } });
        for (const [id, name, mode] of [['plateau', '고원·절벽', 'set'], ['flatten', '높이 지우기', 'flatten']] as const)
            height.append(el('button', { class: 'btn', text: name, attrs: { type: 'button' }, dataset: { testid: 'worldmap-brush-' + id }, on: { click: () => { editorState.set({ tool: 'relief', layer: 'lower', activePaletteStamp: null, reliefMode: mode, reliefLevel: 1, reliefTopGrass: false, reliefDoodad: null, reliefRoughSize: 'S', brushSize: 1 }); rerender(); } } }));
        height.append(el('button', { class: 'btn', text: '고개·경사로', attrs: { type: 'button' }, dataset: { testid: 'worldmap-brush-slope' }, on: { click: () => { editorState.set({ tool: 'relief', layer: 'lower', activePaletteStamp: null, reliefTopGrass: false, reliefDoodad: 'ramp:slope', reliefRampWidth: 1 }); rerender(); } } }));
        root.append(height);
    }
    return root;
}
