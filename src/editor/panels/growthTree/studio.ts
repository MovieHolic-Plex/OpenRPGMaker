import { store } from '@/project/store';
import { classGrowthArt, nodeGrowthArt, treeGrowthArt } from '@/assets/growthTreeArt';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { growthArt } from './art';
import type { Project, ClassPromotionRequirement } from '@/project/types';
import { emptyGrowth, GROWTH_PARAMETERS, GROWTH_PARAMETER_LABELS, type SkillTree, type SkillTreeNode } from '@/project/growth/types';
import { arrangeTree, promotionEdges, wouldCreateCycle } from '@/project/growth/graph';
import { growthIssues } from '@/project/growth/validation';
import { growthPoints, investSkillNode, nodeRank, resetSkillTree, skillNodeBlocker, type GrowthSession } from '@/project/growth/runtime';
import { genId } from '@/util/id';
import { el } from '@/util/dom';
import { button, checkInput, note, numberInput, section, selectInput, textInput } from './controls';
import { connectPromotion, connectSkillNodes, deleteSkillNode, editGrowth, editNode, editTree, moveClass } from './actions';
import { renderGrowthCanvas, type GraphNode } from './canvas';
import '@/styles/database/growth-tree.css';

type Mode = 'promotion' | 'skill';
interface StudioState { treeId?: string; selected?: string; connecting?: string; zoom: number; search: string; preview: boolean; previewActor?: string; previewLevel: number; simulation: GrowthSession; message?: string }
const states = new WeakMap<HTMLElement, Record<Mode, StudioState>>();
export function renderGrowthTreeTab(host: HTMLElement, mode: Mode): void {
  const init = (): StudioState => ({ zoom: .8, search: '', preview: false, previewLevel: 10, simulation: { variables: {}, actorLevels: {}, growthProgress: {} } });
  let both = states.get(host);
  if (!both) { both = { promotion: init(), skill: init() }; states.set(host, both); }
  const state = both[mode];
  const root = el('div', { class: `growth-studio growth-${mode}`, dataset: { testid: `growth-studio-${mode}` } });
  host.append(root);
  const commit = (label: string, mutate: (p: Project) => void): void => { editGrowth(label, mutate); state.message = undefined; draw(); };
  const message = (text: string): void => { state.message = text; draw(); };
  const mutateTree = (label: string, fn: (t: SkillTree) => void): void => commit(label, p => editTree(p, state.treeId!, fn));
  const mutateNode = (label: string, fn: (n: SkillTreeNode) => void): void => commit(label, p => editNode(p, state.treeId!, state.selected!, fn));
  const selectNode = (id: string): void => {
    if (state.connecting) {
      const p = structuredClone(store.getCurrent());
      const from = state.connecting;
      const tree = p.growth?.skillTrees.find(t => t.id === state.treeId);
      const error = mode === 'promotion' ? connectPromotion(p, from, id) : tree ? connectSkillNodes(tree, from, id) : '트리를 선택하세요.';
      if (error) return message(error);
      state.connecting = undefined;
      commit('성장 트리 연결', actual => {
        if (mode === 'promotion') connectPromotion(actual, from, id);
        else editTree(actual, state.treeId!, t => { connectSkillNodes(t, from, id); });
      });
      return;
    }
    state.selected = id; state.message = undefined; draw();
  };
  const draw = (): void => {
    const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement.dataset.testid : undefined;
    const scroll = root.querySelector<HTMLElement>('.growth-viewport');
    const scrollPos = { x: scroll?.scrollLeft ?? 0, y: scroll?.scrollTop ?? 0 };
    const inspectorScroll = root.querySelector<HTMLElement>('.growth-inspector')?.scrollTop ?? 0;
    const p = store.getCurrent(), g = p.growth ?? emptyGrowth();
    if (!g.skillTrees.some(t => t.id === state.treeId)) state.treeId = g.skillTrees[0]?.id;
    const tree = g.skillTrees.find(t => t.id === state.treeId);
    const ids = mode === 'promotion' ? p.database.classes.map(c => c.id) : tree?.nodes.map(n => n.id) ?? [];
    if (!ids.includes(state.selected ?? '')) state.selected = ids[0];
    const edges = mode === 'promotion' ? promotionEdges(p) : tree?.nodes.flatMap(n => n.prerequisites.map(from => ({ from, to: n.id }))) ?? [];
    const auto = arrangeTree(ids, edges);
    const nodes: GraphNode[] = mode === 'promotion' ? p.database.classes.map(c => ({
      id: c.id, name: c.name, iconUrl: resolveAssetResourceUrl(classGrowthArt(p, c), { project: p }) ?? undefined, subtitle: `${c.learnedSkills.length} 스킬 · ${c.promotions?.length ?? 0} 승급 경로`, badge: c.name.slice(0, 1),
      ...(g.classPositions[c.id] ?? auto[c.id]!), invalid: edges.some(e => e.to === c.id && wouldCreateCycle(edges.filter(x => x !== e), e.from, e.to)),
    })) : (tree?.nodes ?? []).map(n => {
      const skill = n.effect.kind === 'skill' ? p.database.skills.find(s => s.id === (n.effect as { skillId: string }).skillId) : undefined;
      return { ...n, iconUrl: resolveAssetResourceUrl(nodeGrowthArt(p, n), { project: p }) ?? undefined, badge: n.effect.kind === 'parameter' ? '+' : '✧', subtitle: state.preview ? `${nodeRank(state.simulation, state.previewActor ?? '', tree!.id, n.id)} / ${n.maxRank} 습득 · ${n.cost} P` : `${n.cost} P · Lv.${n.level} · ${n.effect.kind === 'skill' ? '스킬' : GROWTH_PARAMETER_LABELS[n.effect.parameter]}`,
        invalid: n.effect.kind === 'skill' && !skill,
      };
    });
    const title = mode === 'promotion' ? '직업 승급 트리' : '스킬 트리';
    const header = el('header', { class: 'growth-header', children: [
      el('div', { class: 'growth-heading', children: [el('span', { class: 'growth-eyebrow', text: mode === 'promotion' ? '직업의 다음 장' : '가능성을 연결하다' }), el('h2', { text: title }), note(mode === 'promotion' ? '직업을 연결하고, 새로운 길이 열리는 조건을 설계하세요.' : '스킬과 패시브를 엮어 캐릭터마다 다른 성장의 길을 만드세요.')] }),
      el('div', { class: 'growth-metrics', children: [metric(mode === 'promotion' ? '직업' : '노드', nodes.length), metric('연결', edges.length), metric(mode === 'promotion' ? '연결된 스킬 트리' : '스킬 트리', g.skillTrees.length)] }),
    ] });
    const tools: HTMLElement[] = [];
    if (mode === 'skill') {
      tools.push(button('+ 스킬 노드', 'growth-add-skill', () => addNode('skill'), true), button('+ 패시브 노드', 'growth-add-parameter', () => addNode('parameter')));
      tools.push(button(state.preview ? '편집으로 돌아가기' : '성장 미리보기', 'growth-preview-toggle', () => { state.preview = !state.preview; state.connecting = undefined; draw(); }));
      for (const tool of tools.slice(0, 2)) (tool as HTMLButtonElement).disabled = !tree || state.preview;
    }
    const connect = button(state.connecting ? '연결 취소' : '선택 노드에서 연결', 'growth-connect', () => { state.connecting = state.connecting ? undefined : state.selected; draw(); });
    connect.disabled = !state.selected || state.preview; tools.push(connect);
    const toolbar = el('div', { class: 'growth-toolbar', children: [el('span', { class: 'growth-toolbar-title', text: mode === 'promotion' ? '직업 계보' : tree?.name ?? '새 트리를 만들어 시작하세요' }), ...tools] });
    const canvas = renderGrowthCanvas({ nodes, edges, selected: state.selected, connecting: state.connecting, zoom: state.zoom,
      onSelect: selectNode, onZoom: z => { state.zoom = z; draw(); },
      onMove: (id, pos) => { if (!state.preview) commit('성장 노드 이동', actual => { if (mode === 'promotion') moveClass(actual, id, pos); else editNode(actual, state.treeId!, id, n => Object.assign(n, pos)); }); },
      onArrange: () => { if (!state.preview) commit('성장 트리 자동 배치', actual => { if (mode === 'promotion') { actual.growth ??= emptyGrowth(); actual.growth.classPositions = auto; } else editTree(actual, state.treeId!, t => t.nodes.forEach(n => Object.assign(n, auto[n.id]))); }); },
    });
    const inspector = el('aside', { class: 'growth-inspector', attrs: { 'aria-label': '선택 항목 설정' }, children: mode === 'promotion' ? promotionInspector(p) : state.preview ? previewInspector(p, tree) : skillInspector(p, tree) });
    const issues = growthIssues(p).filter(issue => mode === 'skill' && (!tree || issue.startsWith(tree.name) || issue.startsWith('성장')));
    root.replaceChildren(header, el('div', { class: 'growth-body', children: [catalog(p, tree), el('main', { class: 'growth-workspace', children: [toolbar, canvas,
      el('div', { class: `growth-status${state.message || issues.length ? ' has-issue' : ''}`, attrs: { role: 'status' }, dataset: { testid: 'growth-status' }, text: state.message ?? (state.connecting ? '도착 노드를 선택하세요. 선행 조건으로 연결됩니다.' : issues[0] ?? '노드를 끌어 배치 · Alt + 방향키로 미세 이동 · Ctrl + 휠로 확대') }),
    ] }), inspector] }));
    const nextScroll = root.querySelector<HTMLElement>('.growth-viewport'); if (nextScroll) { nextScroll.scrollLeft = scrollPos.x; nextScroll.scrollTop = scrollPos.y; }
    const nextInspector = root.querySelector<HTMLElement>('.growth-inspector'); if (nextInspector) nextInspector.scrollTop = inspectorScroll;
    if (active) Array.from(root.querySelectorAll<HTMLElement>('[data-testid]')).find(e => e.dataset.testid === active)?.focus({ preventScroll: true });
  };
  const addTree = (): void => {
    const id = genId('skill-tree'); state.treeId = id; state.selected = undefined; state.preview = false;
    commit('스킬 트리 추가', p => { p.growth ??= emptyGrowth(); p.growth.skillTrees.push({ id, name: '새 스킬 트리', description: '', classIds: [], allowReset: true, nodes: [] }); });
  };
  const addNode = (kind: 'skill' | 'parameter'): void => {
    const p = store.getCurrent(), tree = p.growth?.skillTrees.find(t => t.id === state.treeId);
    if (!tree) return;
    const skill = p.database.skills[0];
    if (kind === 'skill' && !skill) return message('데이터베이스에서 스킬을 먼저 추가하세요.');
    const id = genId('node'); state.selected = id;
    mutateTree('성장 노드 추가', t => t.nodes.push({ id, name: kind === 'skill' ? skill!.name : '공격력 강화', description: '', cost: 1, maxRank: kind === 'skill' ? 1 : 3, level: 1, prerequisites: [], x: 56 + Math.floor(t.nodes.length / 3) * 248, y: 60 + (t.nodes.length % 3) * 152,
      effect: kind === 'skill' ? { kind, skillId: skill!.id } : { kind, parameter: 'attack', amount: 5 },
    }));
  };
  const catalog = (p: Project, tree?: SkillTree): HTMLElement => {
    const records = mode === 'promotion' ? p.database.classes : p.growth?.skillTrees ?? [];
    const items = records.filter(r => r.name.toLowerCase().includes(state.search.toLowerCase()));
    return el('aside', { class: 'growth-catalog', attrs: { 'aria-label': mode === 'promotion' ? '직업 목록' : '스킬 트리 목록' }, children: [
      el('div', { class: 'growth-catalog-heading', children: [el('h3', { text: mode === 'promotion' ? '직업 목록' : '스킬 트리 목록' }), el('span', { text: String(records.length) })] }),
      textInput('검색', 'growth-search', state.search, v => { state.search = v; draw(); }),
      ...(mode === 'skill' ? [button('+ 새 트리', 'growth-add-tree', addTree, true)] : []),
      el('div', { class: 'growth-catalog-list', children: items.map(r => {
        const b = button('', `growth-list-${r.id}`, () => { if (mode === 'promotion') selectNode(r.id); else { state.treeId = r.id; state.selected = undefined; state.connecting = undefined; draw(); } });
        b.className = `growth-catalog-item${r.id === (mode === 'promotion' ? state.selected : tree?.id) ? ' is-active' : ''}`;
        b.append(growthArt(resolveAssetResourceUrl('nodes' in r ? treeGrowthArt(p, r) : classGrowthArt(p, r), { project: p }), r.name.slice(0, 1), 'growth-catalog-art'), el('span', { children: [el('strong', { text: r.name }), el('small', { text: 'nodes' in r ? `${r.nodes.length} 노드 · ${r.classIds.length ? `${r.classIds.length} 직업` : '공용'}` : '직업 계보 보기' })] }));
        return b;
      }) }),
      ...(mode === 'skill' ? [section('포인트 규칙', [numberInput('시작 포인트', 'growth-initial-points', p.growth?.initialPoints ?? 0, v => commit('시작 성장 포인트 변경', actual => { actual.growth ??= emptyGrowth(); actual.growth.initialPoints = v; })), numberInput('레벨당 포인트', 'growth-level-points', p.growth?.pointsPerLevel ?? 1, v => commit('레벨 성장 포인트 변경', actual => { actual.growth ??= emptyGrowth(); actual.growth.pointsPerLevel = v; }), 0, 1000), selectInput('이벤트 보너스 변수', 'growth-bonus-variable', p.growth?.bonusVariableId ?? '', [{ id: '', name: '사용 안 함' }, ...p.variables], v => commit('성장 보너스 변수 연결', actual => { actual.growth ??= emptyGrowth(); actual.growth.bonusVariableId = v || undefined; })), note('변수 값만큼 각 주인공에게 추가 포인트가 주어집니다.')])] : [note('현재 직업 데이터에서 가져온 계보입니다. 승급 조건은 기존 이벤트에도 바로 적용됩니다.')]),
    ] });
  };
  const promotionInspector = (p: Project): HTMLElement[] => {
    const c = p.database.classes.find(c => c.id === state.selected);
    if (!c) return [note('데이터베이스에서 직업을 추가하세요.')];
    const outgoing = c.promotions ?? [];
    return [inspectorTitle('선택한 직업', c.name, classGrowthArt(p, c)), section('이 직업의 스킬 트리', [
      ...((p.growth?.skillTrees ?? []).filter(t => t.classIds.includes(c.id) || !t.classIds.length).map(t => note(`${t.name} · ${t.classIds.length ? '직업 전용' : '공용'}`))),
      ...(!p.growth?.skillTrees.length ? [note('스킬 트리 탭에서 성장 트리를 만들고 직업을 연결하세요.')] : []),
    ]), section('승급 경로', [
      ...(!outgoing.length ? [note('상단의 연결 버튼을 누르고 도착 직업을 선택하세요.')] : []),
      ...outgoing.map(path => {
        const target = p.database.classes.find(t => t.id === path.toClassId);
        const save = (patch: Partial<ClassPromotionRequirement>): void => commit('직업 승급 조건 변경', actual => {
          const record = actual.database.classes.find(t => t.id === c.id)?.promotions?.find(t => t.toClassId === path.toClassId);
          if (record) record.requires = { ...record.requires, ...patch };
        });
        return section(`→ ${target?.name ?? path.toClassId}`, [
          numberInput('필요 레벨', `growth-promotion-level-${path.toClassId}`, path.requires.level ?? 1, level => save({ level }), 1, 99),
          selectInput('필요 아이템 · 1개 소비', `growth-promotion-item-${path.toClassId}`, path.requires.itemId ?? '', [{ id: '', name: '없음' }, ...p.database.items], itemId => save({ itemId: itemId || undefined })),
          selectInput('필요 스위치 · 켜짐', `growth-promotion-switch-${path.toClassId}`, path.requires.switchId ?? '', [{ id: '', name: '없음' }, ...p.switches], switchId => save({ switchId: switchId || undefined })),
          selectInput('조건 변수', `growth-promotion-variable-${path.toClassId}`, path.requires.variableId ?? '', [{ id: '', name: '없음' }, ...p.variables], variableId => save({ variableId: variableId || undefined })),
          ...(path.requires.variableId ? [numberInput('변수 최솟값', `growth-promotion-value-${path.toClassId}`, path.requires.atLeast ?? 1, atLeast => save({ atLeast }))] : []),
          button('연결 삭제', `growth-promotion-remove-${path.toClassId}`, () => commit('직업 승급 연결 삭제', actual => { const source = actual.database.classes.find(t => t.id === c.id); if (source) source.promotions = source.promotions?.filter(t => t.toClassId !== path.toClassId); })),
        ]);
      }),
    ])];
  };
  const skillInspector = (p: Project, tree?: SkillTree): HTMLElement[] => {
    if (!tree) return [inspectorTitle('시작하기', '나만의 성장 설계'), note('새 트리를 만들면 공용 성장 트리로 시작합니다. 직업을 지정하면 해당 직업에서만 활성화됩니다.'), button('+ 새 트리', 'growth-empty-add-tree', addTree, true)];
    const node = tree.nodes.find(n => n.id === state.selected);
    const result = [inspectorTitle('트리 설정', tree.name, treeGrowthArt(p, tree)), section('기본 정보', [
      textInput('트리 이름', 'growth-tree-name', tree.name, name => mutateTree('스킬 트리 이름 변경', t => { t.name = name.trim() || '새 스킬 트리'; })),
      textInput('설명', 'growth-tree-description', tree.description, description => mutateTree('스킬 트리 설명 변경', t => { t.description = description; }), true),
      checkInput('포인트 초기화 허용', 'growth-tree-reset', tree.allowReset, v => mutateTree('스킬 초기화 설정', t => { t.allowReset = v; })),
      note('직업을 선택하지 않으면 모든 직업에서 사용하는 공용 트리입니다.'),
      ...p.database.classes.map(c => checkInput(c.name, `growth-tree-class-${c.id}`, tree.classIds.includes(c.id), checked => mutateTree('스킬 트리 직업 연결', t => { t.classIds = checked ? [...new Set([...t.classIds, c.id])] : t.classIds.filter(id => id !== c.id); }))),
    ])];
    if (node) result.unshift(inspectorTitle('선택한 노드', node.name, nodeGrowthArt(p, node)), section('노드 설정', [
      textInput('노드 이름', 'growth-node-name', node.name, name => mutateNode('성장 노드 이름 변경', n => { n.name = name.trim() || '새 노드'; })),
      textInput('노드 설명', 'growth-node-description', node.description, description => mutateNode('성장 노드 설명 변경', n => { n.description = description; }), true),
      ...(node.effect.kind === 'skill' ? [selectInput('습득할 스킬', 'growth-node-skill', node.effect.skillId, p.database.skills, skillId => mutateNode('성장 스킬 연결', n => { n.effect = { kind: 'skill', skillId }; }))] : [
        selectInput('강화할 능력치', 'growth-node-parameter', node.effect.parameter, GROWTH_PARAMETERS.map(id => ({ id, name: GROWTH_PARAMETER_LABELS[id] })), parameter => mutateNode('성장 능력치 변경', n => { if (n.effect.kind === 'parameter') n.effect.parameter = parameter as typeof n.effect.parameter; })),
        numberInput('등급당 증가량', 'growth-node-amount', node.effect.amount, amount => mutateNode('성장 능력치 증가량 변경', n => { if (n.effect.kind === 'parameter') n.effect.amount = amount; }), 1),
        numberInput('최대 등급', 'growth-node-max-rank', node.maxRank, maxRank => mutateNode('성장 최대 등급 변경', n => { n.maxRank = maxRank; }), 1, 99),
      ]),
      numberInput('등급당 포인트', 'growth-node-cost', node.cost, cost => mutateNode('성장 노드 비용 변경', n => { n.cost = cost; }), 1),
      numberInput('필요 레벨', 'growth-node-level', node.level, level => mutateNode('성장 노드 레벨 변경', n => { n.level = level; }), 1, 99),
      ...node.prerequisites.map(id => button(`선행: ${tree.nodes.find(n => n.id === id)?.name ?? id} ×`, `growth-prerequisite-${id}`, () => mutateNode('선행 노드 연결 삭제', n => { n.prerequisites = n.prerequisites.filter(p => p !== id); }))),
      note('연결된 선행 노드를 모두 1등급 이상 습득해야 열립니다.'),
      button('노드 삭제', 'growth-delete-node', () => { const id = state.selected!; state.selected = undefined; mutateTree('성장 노드 삭제', t => deleteSkillNode(t, id)); }),
    ]));
    result.push(section('트리 관리', [button('트리 복제', 'growth-duplicate-tree', () => { const copy = structuredClone(tree); copy.id = genId('skill-tree'); copy.name += ' 복사'; state.treeId = copy.id; commit('스킬 트리 복제', actual => actual.growth!.skillTrees.push(copy)); }), button('트리 삭제', 'growth-delete-tree', () => {
      const targetId = tree.id;
      const confirm = el('div', { class: 'growth-inline-confirm', attrs: { role: 'alert' }, children: [note(`“${tree.name}”과 노드 ${tree.nodes.length}개를 삭제합니다.`), button('삭제 확인', 'growth-confirm-delete-tree', () => { state.selected = undefined; commit('스킬 트리 삭제', actual => { actual.growth!.skillTrees = actual.growth!.skillTrees.filter(t => t.id !== targetId); }); }), button('취소', 'growth-cancel-delete-tree', draw)] });
      root.querySelector('.growth-inspector')?.append(confirm); confirm.scrollIntoView({ block: 'nearest' });
    })]));
    return result;
  };
  const previewInspector = (p: Project, tree?: SkillTree): HTMLElement[] => {
    if (!tree) return [note('트리를 먼저 만드세요.')];
    state.previewActor ??= p.database.actors[0]?.id;
    const actorId = state.previewActor ?? '';
    state.simulation.actorLevels = { [actorId]: state.previewLevel };
    const points = growthPoints(p, state.simulation, actorId), node = tree.nodes.find(n => n.id === state.selected);
    const children = [inspectorTitle('성장 미리보기', `${points.available} 포인트`), note('저작 데이터와 실제 게임 진행에는 영향을 주지 않습니다.'),
      selectInput('주인공', 'growth-preview-actor', actorId, p.database.actors, id => { state.previewActor = id; draw(); }),
      numberInput('미리보기 레벨', 'growth-preview-level', state.previewLevel, level => { state.previewLevel = level; draw(); }, 1, 99),
      selectInput('미리보기 직업', 'growth-preview-class', state.simulation.classOverrides?.[actorId] ?? p.database.actors.find(a => a.id === actorId)?.classId ?? '', p.database.classes, id => { state.simulation.classOverrides = { ...state.simulation.classOverrides, [actorId]: id }; draw(); }),
      note(`획득 ${points.earned} P · 사용 ${points.spent} P`),
    ];
    if (node) {
      const blocked = skillNodeBlocker(p, state.simulation, actorId, tree, node);
      const learn = button(`습득 · ${node.cost} P`, 'growth-preview-learn', () => { const error = investSkillNode(p, state.simulation, actorId, tree.id, node.id); message(error ?? `${node.name} 습득!`); }, true);
      learn.disabled = Boolean(blocked);
      children.push(section(node.name, [note(`${nodeRank(state.simulation, actorId, tree.id, node.id)} / ${node.maxRank} 등급`), note(blocked ?? '지금 습득할 수 있습니다.'), learn]));
    }
    children.push(button('이 트리 투자 초기화', 'growth-preview-reset', () => message(resetSkillTree(p, state.simulation, actorId, tree.id) ?? '포인트를 환급했습니다.')));
    return children;
  };
  draw();
}
function metric(label: string, value: number): HTMLElement { return el('div', { class: 'growth-metric', children: [el('strong', { class: 'growth-metric-value', text: String(value).padStart(2, '0') }), el('span', { text: label })] }); }
function inspectorTitle(label: string, name: string, resourceId?: string): HTMLElement { return el('div', { class: 'growth-inspector-title', children: [...(resourceId ? [growthArt(resolveAssetResourceUrl(resourceId), name.slice(0, 1), 'growth-inspector-art')] : []), el('small', { text: label }), el('h3', { text: name })] }); }
