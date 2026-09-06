import { store } from '@/project/store';
import { applyGrowthPreset, GROWTH_PRESETS, type GrowthPresetApplication, type GrowthPresetKind } from '@/project/growth/presets';
import { classGrowthArt, nodeGrowthArt } from '@/assets/growthTreeArt';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { arrangeTree, promotionEdges } from '@/project/growth/graph';
import { el } from '@/util/dom';
import { button, note, section } from './controls';
import { growthArt } from './art';
import { renderGrowthCanvas, type GraphNode } from './canvas';
import { editGrowth } from './actions';

/** In-studio browsing owns only detached data. The library remains the template authority. */
export function presetBrowser(mode: GrowthPresetKind, close: () => void, added: (result: GrowthPresetApplication) => void): HTMLElement {
  const presets = GROWTH_PRESETS.filter(p => p.kind === mode);
  let selected = presets[0];
  let zoom = 1;
  let selectedNode: string | undefined;
  const root = el('section', { class: 'growth-preset-browser', attrs: { 'aria-label': '성장 프리셋' }, dataset: { testid: 'growth-preset-browser' } });
  const details = el('div', { class: 'growth-preset-details', attrs: { 'aria-live': 'polite' } });
  const status = el('p', { class: 'growth-note', attrs: { role: 'status' } });
  const apply = button('이 프리셋 추가', 'growth-preset-apply', () => {
    if (!selected) return;
    try {
      // Preflight current data before recording history; allocation failures leave no empty undo entry.
      applyGrowthPreset(structuredClone(store.getCurrent()), selected.id);
      let result: GrowthPresetApplication | undefined;
      editGrowth(`성장 프리셋 추가: ${selected.name}`, p => { result = applyGrowthPreset(p, selected.id); });
      if (result) added(result);
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  }, true);
  const cards = presets.map(preset => {
    const card = button('', `growth-preset-${preset.id}`, () => { selected = preset; zoom = 1; draw(); });
    card.classList.add('growth-preset-card');
    card.append(growthArt(preset.coverUrl, '표지 없음', 'growth-preset-cover'), el('strong', { text: preset.name }), el('span', { text: preset.description }), el('small', { text: `${preset.nodeCount} 노드 · ${preset.edgeCount} 연결` }));
    return card;
  });
  const draw = (): void => {
    if (!selected) return;
    const focused = document.activeElement instanceof HTMLElement && details.contains(document.activeElement) ? document.activeElement.dataset.testid : undefined;
    cards.forEach((card, i) => card.setAttribute('aria-pressed', String(presets[i]?.id === selected?.id)));
    try {
      const p = structuredClone(store.getCurrent());
      const result = applyGrowthPreset(p, selected.id);
      const classes = p.database.classes.filter(c => result.addedClassIds.includes(c.id));
      const tree = p.growth?.skillTrees.find(t => result.addedTreeIds.includes(t.id));
      const edges = mode === 'promotion' ? promotionEdges(p).filter(e => result.addedClassIds.includes(e.from)) : tree?.nodes.flatMap(n => n.prerequisites.map(from => ({ from, to: n.id }))) ?? [];
      const positions = arrangeTree(mode === 'promotion' ? result.addedClassIds : result.addedNodeIds, edges);
      const nodes: GraphNode[] = classes.map(c => ({ id: c.id, name: c.name, ...positions[c.id]!, badge: c.name.slice(0, 1), iconUrl: resolveAssetResourceUrl(classGrowthArt(p, c), { project: p }) ?? undefined,
        subtitle: `Lv.${classes.flatMap(from => from.promotions ?? []).find(path => path.toClassId === c.id)?.requires.level ?? 1} · ${c.learnedSkills.length} 스킬` }));
      for (const n of tree?.nodes ?? []) nodes.push({ ...n, ...positions[n.id]!, badge: '+', subtitle: `Lv.${n.level} · ${n.cost} P · ${n.maxRank}등급`, iconUrl: resolveAssetResourceUrl(nodeGrowthArt(p, n), { project: p }) ?? undefined });
      const graph = renderGrowthCanvas({ nodes, edges, zoom, selected: selectedNode, readOnly: true, onSelect: id => { selectedNode = id; draw(); }, onMove: () => {}, onArrange: () => {}, onZoom: value => { zoom = value; draw(); } });
      const ledger = nodes.map(n => note(`${n.name} — ${n.subtitle} · 선행: ${edges.filter(e => e.to === n.id).map(e => nodes.find(a => a.id === e.from)?.name).join(' + ') || '시작'}`));
      details.replaceChildren(section(selected.name, [note(selected.description), note(`추가: 직업 ${result.addedClassIds.length} · 스킬 ${result.addedSkillIds.length} · 트리 ${result.addedTreeIds.length} · 스킬 노드 ${result.addedNodeIds.length}`),
        note(mode === 'promotion' ? '승급은 포인트를 소비하지 않습니다. 주인공의 시작 직업은 직접 지정하세요.' : '공용 트리로 추가됩니다. 선행 노드는 모두 필요하며 포인트 규칙은 기존 설정을 유지합니다.'), graph, ...ledger,
        section('함께 추가되는 스킬', p.database.skills.filter(s => result.addedSkillIds.includes(s.id)).map(s => note(s.name))),
      ]));
      apply.disabled = false; status.textContent = '';
      if (focused) Array.from(details.querySelectorAll<HTMLElement>('[data-testid]')).find(node => node.dataset.testid === focused)?.focus({ preventScroll: true });
    } catch (error) {
      details.replaceChildren(); apply.disabled = true;
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  };
  root.append(el('div', { class: 'growth-preset-content', children: [el('div', { class: 'growth-preset-collection', children: cards }), details] }),
    el('footer', { class: 'growth-preset-footer', children: [note('기존 기록은 보존됩니다. 다시 추가하면 독립된 사본이 생깁니다.'), status, button('취소 · 편집으로', 'growth-presets-cancel', close), apply] }));
  draw();
  return root;
}
