import { el } from '@/util/dom';
import { tilesetTileBackgroundStyle } from '@/editor/tilesetImage';
import type { TilesetDef } from '@/project/types';
import { WORLDMAP_BRUSHES } from '@/project/defaults/worldmapAuthoring';
import { editorState } from '@/editor/editorState';
import { worldmapBrushMaterial } from '@/project/worldmapAutoBrush';
import { makeStructureKitShelf } from '@/editor/harnessSuggestion/structureKitShelf';
let background = 'auto';
let category = 'terrain';
export function hasWorldmapBrushes(t: TilesetDef): boolean {
    return t.autotileGroups?.some(g => g.id === 'worldmap-brush-grass-sea') === true;
}
/** Actual native tile selections, with all connection variants hidden behind each brush. */
export function makeWorldmapBrushShelf(t: TilesetDef, layer: 'lower' | 'upper', selected: number, onSelect: (tile: number) => void, rerender: () => void): HTMLElement {
    const root = el('div', { dataset: { testid: 'worldmap-brush-shelf' }, attrs: { style: 'padding:8px;overflow:auto;min-height:0;flex:1 1 auto' } });
    const tabs = el('div', {attrs:{style:'display:flex;gap:4px;margin-bottom:8px;position:sticky;top:0;z-index:2;background:var(--bg-raised)'}});
    for(const [id,name] of [['terrain','지형'],['icons','거점']]) tabs.append(el('button',{class:'btn'+(category===id?' active':''),text:id==='terrain'?'지형':name,attrs:{type:'button','aria-pressed':String(category===id),style:'flex:1'},dataset:{testid:'worldmap-category-'+id},on:{click:()=>{category=id;rerender();}}}));
    root.append(tabs);
    if(category==='icons') {
        root.append(el('p',{text:'아이콘을 고르고 지도에 놓으세요. 전체 모양이 함께 배치됩니다.',attrs:{style:'font-size:11px;line-height:1.5'}}));
        const shelf=makeStructureKitShelf({tileset:t,title:'거점',activeKitId:editorState.get().activePaletteStamp?.kitId??null,rerender,showNames:true});
        if(shelf) root.append(shelf);
        return root;
    }
    {
        const details = el('details');
        details.append(el('summary', {text:'바탕 설정',attrs:{style:'font-size:11px;cursor:pointer;margin-bottom:6px'}}));
        const select = el('select', { attrs: { 'aria-label': '붓 배경', style: 'width:100%;margin-bottom:8px' }, dataset: { testid: 'worldmap-brush-background' } }) as HTMLSelectElement;
        for (const [value, name] of [['auto', '자동 · 칠하는 자리의 바탕 유지'], ['sea', '바다 위에 육지·섬'], ['grass', '초원 위에 지형·강·길'], ['sand', '사막 위에 지형·강·길'], ['snow', '설원 위에 지형·강·길']])
            select.append(el('option', { text: name, attrs: { value } }));
        select.value = background;
        select.onchange = () => { background = select.value; editorState.set({worldmapAutoBackground:background==='auto'}); rerender(); };
        details.append(select); root.append(details);
        root.append(el('p', { text: background==='auto' ? '붓을 고르고 그리세요. 바탕과 층은 자동으로 맞춥니다. 길로 강을 건너면 다리가 놓입니다.' : '고른 바탕으로 칠합니다. 지형·강·길은 이웃에 맞춰 연결됩니다.', attrs: { style: 'font-size:11px;margin:0 0 8px;line-height:1.5' } }));
    }
    const grid = el('div', { attrs: { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px' } });
    const tileGroups = new Map(t.tileGroups?.map(g => [g.id, g]));
    const isSelected = (tile: number) => {
        const a=worldmapBrushMaterial(t,selected), b=worldmapBrushMaterial(t,tile);
        return selected===tile || background==='auto' && a?.kind===b?.kind && !!a && !!b
            && (a.kind!=='sea' || (a.background==='plain')===(b.background==='plain'));
    };
    const button = (id: string, label: string, tile: number) => el('button', { class: 'btn' + (isSelected(tile) ? ' active' : ''), attrs: { type: 'button', 'aria-pressed': String(isSelected(tile)), title: label, style: 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;min-height:64px;font-size:11px;white-space:normal' },
        dataset: { testid: id, tile: String(tile) }, children: [el('span', { attrs: { style: 'display:block;width:32px;height:32px;image-rendering:pixelated;' + tilesetTileBackgroundStyle(t, tile, 32) } }), el('span', { text: label })], on: { click: () => onSelect(tile) } });
    if (background==='auto' || layer === 'lower')
        for (const key of background==='auto' ? ['sea'] : ['sea', background === 'sea' ? 'grass' : background]) {
            const group = tileGroups.get('worldmap-brush-plain-' + key);
            if (group)
                grid.append(button('worldmap-brush-plain-' + key, key === 'sea' ? '바다 · 땅 지우기' : group.name + ' 바탕', group.tileIds[0]!));
        }
    const seen = new Set<string>();
    const order = ['grass','sand','snow','river','road','sea','forest','mountain','snowforest','bridge-horizontal','bridge-vertical','conifer','snowmountain'];
    const brushes = background==='auto' ? [...WORLDMAP_BRUSHES].sort((a,b)=>(order.includes(a.kind)?order.indexOf(a.kind):100)-(order.includes(b.kind)?order.indexOf(b.kind):100)) : WORLDMAP_BRUSHES;
    const extra=el('details');extra.append(el('summary',{text:'다른 지형',attrs:{style:'font-size:12px;cursor:pointer;margin:10px 0'}}));
    const extraGrid=el('div',{attrs:{style:'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px'}});
    for (const brush of brushes) {
        if (background!=='auto' && brush.layer !== layer)
            continue;
        if (background!=='auto' && layer === 'lower' && brush.background !== background && brush.background !== 'water')
            continue;
        if (background!=='auto' && brush.background === 'water' && background !== 'sea' && background !== 'grass')
            continue;
        if(background==='auto') {
            if(seen.has(brush.kind)) continue;
            seen.add(brush.kind);
        }
        const group = tileGroups.get(brush.id);
        if (!group)
            continue;
        const auto = t.autotileGroups?.find(g => g.id === brush.id);
        const tile = auto?.variantMap['0'] ?? group.tileIds[0]!;
        (background==='auto' && !order.includes(brush.kind) ? extraGrid : grid).append(button(brush.id, background==='auto' ? brush.name.replace(' 해안','') : brush.name, tile));
    }
    root.append(grid);
    if(extraGrid.childElementCount) {extra.append(extraGrid);root.append(extra);}
    if (background==='auto' || layer === 'lower') {
        const height = el('div', { attrs: { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:10px' } });
        for (const [id, name, mode] of [['plateau', '고원·절벽', 'set'], ['flatten', '높이 지우기', 'flatten']] as const)
            height.append(el('button', { class: 'btn', text: name, attrs: { type: 'button' }, dataset: { testid: 'worldmap-brush-' + id }, on: { click: () => { editorState.set({ tool: 'relief', layer: 'lower', activePaletteStamp: null, reliefMode: mode, reliefLevel: 1, reliefTopGrass: false, reliefDoodad: null, reliefRoughSize: 'S', brushSize: 1 }); rerender(); } } }));
        height.append(el('button', { class: 'btn', text: '고개·경사로', attrs: { type: 'button' }, dataset: { testid: 'worldmap-brush-slope' }, on: { click: () => { editorState.set({ tool: 'relief', layer: 'lower', activePaletteStamp: null, reliefTopGrass: false, reliefDoodad: 'ramp:slope', reliefRampWidth: 2 }); rerender(); } } }));
        root.append(height);
    }
    return root;
}
