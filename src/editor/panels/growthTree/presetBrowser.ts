import { store } from '@/project/store';
import { applyGrowthPreset, createGrowthPresetPreview, GROWTH_PRESETS, type GrowthPresetApplication, type GrowthStudioMode } from '@/project/growth/presets';
import { classGrowthArt, nodeGrowthArt } from '@/assets/growthTreeArt';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { arrangeTree, promotionEdges } from '@/project/growth/graph';
import type { ClassPromotionRequirement } from '@/project/types';
import { el } from '@/util/dom';
import { button, note, section, selectInput } from './controls';
import { renderGrowthCanvas, type GraphNode } from './canvas';
import { skillPrerequisiteGraph } from './skillGraph';
import { editGrowth } from './actions';

export interface PresetBrowserState { presetId: string; treeId?: string; selected?: string; zoom: number; x?: number; y?: number }
export function newPresetBrowserState(): PresetBrowserState { return { presetId: 'bundle-vanguard', zoom: 1 }; }

/** Browsing never reads destination allocation. Only Apply touches the live store. */
export function presetBrowser(mode: GrowthStudioMode, close: () => void, added: (result: GrowthPresetApplication) => void,
  options: { compact?: boolean; state?: PresetBrowserState; disabled?: boolean } = {}): HTMLElement {
  const presets = GROWTH_PRESETS.filter(p => p.kind === 'bundle' || p.kind === mode);
  const state = options.state ?? newPresetBrowserState();
  const root = el('section', { class: `growth-preset-browser${options.compact ? ' is-compact' : ''}`,
    attrs: { 'aria-label': '프리셋 미리보기 · 미적용' }, dataset: { testid: options.compact ? 'growth-preset-preview' : 'growth-preset-browser' } });
  let project = createGrowthPresetPreview(state.presetId);
  let statusMessage = '';
  const selectPreset = (id: string): void => {
    state.presetId = id; state.treeId = undefined; state.selected = undefined; state.zoom = 1; state.x = 0; state.y = 0;
    project = createGrowthPresetPreview(id); statusMessage = ''; draw();
  };
  const draw = (): void => {
    const focused = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement.dataset.testid : undefined;
    const selected = presets.find(p => p.id === state.presetId)!;
    const trees = project.growth!.skillTrees.filter(t => t.nodes.length);
    const tree = trees.find(t => t.id === state.treeId) ?? trees[0];
    state.treeId = tree?.id;
    const dependency = tree ? skillPrerequisiteGraph(project, tree) : { edges: [], portals: [] };
    const edges = mode === 'promotion' ? promotionEdges(project) : dependency.edges;
    const ids = mode === 'promotion' ? project.database.classes.map(c => c.id) : [...dependency.portals.map(p => p.id), ...(tree?.nodes.map(n => n.id) ?? [])];
    const positions = arrangeTree(ids, edges);
    // Keep native-size nodes, bringing the first row into view rather than shrinking to fit.
    for (const p of Object.values(positions)) { p.x -= 40; p.y -= 44; }
    const nodes: GraphNode[] = mode === 'promotion' ? project.database.classes.map(c => ({ id: c.id, name: c.name, ...positions[c.id]!, badge: c.name.slice(0, 1),
      iconUrl: resolveAssetResourceUrl(classGrowthArt(project, c)) ?? undefined,
      subtitle: `승급 Lv.${project.database.classes.flatMap(from => from.promotions ?? []).find(path => path.toClassId === c.id)?.requires.level ?? 1} · 스킬 트리 ${project.growth!.skillTrees.filter(t => t.classIds.includes(c.id)).length}개`,
    })) : [
      ...dependency.portals.map(portal => {
        const n = portal.tree.nodes.find(n => n.id === portal.requirement.nodeId)!;
        return { id: portal.id, name: portal.tree.name, ...positions[portal.id]!, external: true, badge: '+',
          subtitle: `${n.name} · ${portal.requirement.rank}등급 · 열기`, iconUrl: resolveAssetResourceUrl(nodeGrowthArt(project, n)) ?? undefined };
      }),
      ...(tree?.nodes ?? []).map(n => ({ ...n, ...positions[n.id]!, badge: '+',
        subtitle: `Lv.${n.level} · 비용 ${n.cost}P · 최대 ${n.maxRank}등급`, iconUrl: resolveAssetResourceUrl(nodeGrowthArt(project, n)) ?? undefined })),
    ];
    if (!ids.includes(state.selected ?? '')) state.selected = mode === 'skill' ? tree?.nodes[0]?.id : ids[0];
    const showTree = (id: string, nodeId?: string): void => { state.treeId = id; state.selected = nodeId; state.x = 0; state.y = 0; draw(); };
    const graph = renderGrowthCanvas({ nodes, edges, zoom: state.zoom, selected: state.selected, readOnly: true,
      testIdPrefix: 'growth-preset', label: '프리셋 노드 미리보기 · 미적용',
      onSelect: id => {
        const portal = dependency.portals.find(p => p.id === id);
        if (portal) showTree(portal.tree.id, portal.requirement.nodeId);
        else { state.selected = id; draw(); }
      }, onMove: () => {}, onArrange: () => {}, onZoom: zoom => { state.zoom = zoom; draw(); },
    });
    const viewport = graph.querySelector<HTMLElement>('.growth-viewport')!;
    viewport.addEventListener('scroll', () => { state.x = viewport.scrollLeft; state.y = viewport.scrollTop; });
    const requirementText = (requires: ClassPromotionRequirement): string => [
      `Lv.${requires.level ?? 1}`,
      ...(requires.requiredSkillIds ?? []).map(id => project.database.skills.find(s => s.id === id)!.name),
      ...(requires.requiredNodes ?? []).map(r => { const t = trees.find(t => t.id === r.treeId)!; return `${t.name} / ${t.nodes.find(n => n.id === r.nodeId)!.name} ${r.rank}등급`; }),
      ...(requires.requiredTreePoints ?? []).map(r => `${trees.find(t => t.id === r.treeId)!.name} 투자 ${r.points} P`),
    ].join(' + ');
    const inspect = el('div', { class: 'growth-preset-inspect', attrs: { 'aria-live': 'polite', tabindex: '0', 'aria-label': '선택 노드 조건' }, dataset: { testid: 'growth-preset-inspect' } });
    if (mode === 'promotion') {
      const klass = project.database.classes.find(c => c.id === state.selected);
      inspect.append(note(`${klass?.name ?? ''} · ${(klass?.promotions ?? []).map(e => `${project.database.classes.find(c => c.id === e.toClassId)!.name}: ${requirementText(e.requires)}`).join(' / ') || '최종 직업'}`));
    } else {
      const node = tree?.nodes.find(n => n.id === state.selected);
      inspect.append(note(`${tree?.name ?? ''} · ${tree?.inheritOnPromotion ? '실제 승급 경로에서 계승' : '공용 트리'} · ${node?.name ?? ''}`));
      for (const req of node?.requiredNodes ?? []) {
        const target = trees.find(t => t.id === req.treeId)!;
        const label = `${target.name} / ${target.nodes.find(n => n.id === req.nodeId)!.name} ${req.rank}등급`;
        inspect.append(req.treeId === tree?.id ? note(`선행: ${label}`) : button(`다른 트리 선행: ${label} · 열기`, 'growth-preset-cross-tree', () => showTree(req.treeId, req.nodeId)));
      }
      if (node?.prerequisites.length && !node.requiredNodes?.length) inspect.append(note(`선행: ${node.prerequisites.map(id => tree!.nodes.find(n => n.id === id)!.name).join(' + ')} 1등급`));
    }
    const status = el('p', { class: 'growth-note', text: statusMessage, attrs: { role: 'status' }, dataset: { testid: 'growth-preset-status' } });
    const apply = button('이 프리셋 추가', 'growth-preset-apply', () => {
      try {
        applyGrowthPreset(structuredClone(store.getCurrent()), selected.id);
        let result: GrowthPresetApplication | undefined;
        editGrowth(`성장 프리셋 추가: ${selected.name}`, p => { result = applyGrowthPreset(p, selected.id); });
        if (result) added(result);
      } catch (error) { statusMessage = error instanceof Error ? error.message : String(error); status.textContent = statusMessage; }
    }, true);
    apply.disabled = Boolean(options.disabled);
    const toolbar = el('div', { class: 'growth-preset-toolbar', children: [
      el('strong', { text: options.compact ? '예시로 시작하기 · 아직 추가 안 됨' : '프리셋 미리보기 · 미적용' }),
      ...(options.compact ? [selectInput('프리셋', 'growth-preset-select', selected.id, presets, selectPreset)] : []),
      ...(mode === 'skill' ? [selectInput('묶음 안의 트리', 'growth-preset-tree', tree?.id ?? '', trees, id => showTree(id))] : []),
      ...(options.compact ? [apply] : []),
    ] });
    const cards = presets.map(preset => {
      const card = button(preset.name, `growth-preset-${preset.id}`, () => selectPreset(preset.id));
      card.classList.add('growth-preset-card'); card.setAttribute('aria-pressed', String(preset.id === selected.id));
      return card;
    });
    const details = options.compact ? [] : [section(selected.name, [note(selected.description),
      note(`추가: 직업 ${project.database.classes.length} · 스킬 ${project.database.skills.length} · 트리 ${trees.length}`),
      note(selected.kind === 'bundle' ? '각 출발 트리에 기초 2등급 + 스킬을 투자하세요. 5레벨 첫 승급 3 P, 12레벨 최종 승급 누적 6 P. 새 예산은 시작 2 / 레벨당 1이며 기존 예산(0 포함)을 유지합니다.' : '독립 프리셋입니다. 기존 기록과 포인트 설정은 그대로 유지됩니다.'),
      ...nodes.map(n => note(`${n.name} — ${n.subtitle} · 선행: ${edges.filter(e => e.to === n.id).map(e => nodes.find(a => a.id === e.from)?.name).join(' + ') || '시작'}`)),
      note('주인공의 시작 직업은 추가 후 직접 지정하세요. 다시 추가하면 독립 사본이 생깁니다.'),
    ])];
    // 작은 띠에서는 조건 원문 줄을 뺀다 — 띠 맨 아래에 「견습 기사 · 돌격 기사: Lv.5 + …」 가 원문
    // 그대로 흘러 무엇인지 알 수 없었다(2026-09-23). 다른 트리로 건너가는 **버튼**만 남긴다.
    if (options.compact) for (const line of Array.from(inspect.querySelectorAll('.growth-note'))) line.remove();
    const showInspect = !options.compact || inspect.childElementCount > 0;
    root.replaceChildren(toolbar,
      ...(!options.compact ? [el('div', { class: 'growth-preset-collection', children: cards })] : []), graph, ...(showInspect ? [inspect] : []),
      ...(options.compact ? [status] : [el('div', { class: 'growth-preset-details', children: details }),
        el('footer', { class: 'growth-preset-footer', children: [status, button('취소 · 편집으로', 'growth-presets-cancel', close), apply] })]));
    viewport.scrollLeft = state.x ?? 0; viewport.scrollTop = state.y ?? 0;
    if (focused) Array.from(root.querySelectorAll<HTMLElement>('[data-testid]')).find(n => n.dataset.testid === focused)?.focus({ preventScroll: true });
  };
  draw(); return root;
}
