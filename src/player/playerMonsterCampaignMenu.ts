import type { StatusMenuDetail, StatusMenuDetailOptions } from '@/player/playerStatusMenuDetailTypes';
import { monsterCampaign, reconcileMonsterJournal, type MonsterCampaignDefinition } from '@/project/monsterJournal';
import type { PlaySession } from '@/project/session';
import type { Project } from '@/project/types';
import { dexDetail } from '@/player/playerMonsterDexDetail';
import { el } from '@/util/dom';

export type MonsterCampaignCommand = 'monster-dex' | 'region-map' | 'campaign-progress';
export type CampaignRegionMap = {
  locations: MonsterCampaignDefinition['locations'];
  links: readonly { from: string; to: string }[];
  currentMapId?: string;
  currentMapName: string;
};

const readOnly = (): void => {};

export function createMonsterCampaignDetail(options: StatusMenuDetailOptions, command: MonsterCampaignCommand): StatusMenuDetail {
  const { project, session } = options;
  const campaign = monsterCampaign(project);
  // 도감은 원정 정의 없이도(수집 게임 종 레코드 전부) 열린다. 지도·배지는 원정 정의가 있어야 한다.
  if (command === 'monster-dex') {
    reconcileMonsterJournal(project, session);
    return dexDetail(options);
  }
  if (!campaign) return { title: '원정 기록', entries: [], emptyLabel: '원정 기록이 없습니다.' };
  reconcileMonsterJournal(project, session);
  if (command === 'region-map') {
    const regionMap = buildCampaignRegionMap(project, session, campaign);
    return {
      title: `${campaign.name} · 지도`,
      layout: 'campaign-map',
      regionMap,
      entries: campaign.locations.map((location) => ({
        label: `${location.mapId === regionMap.currentMapId ? '▶ ' : ''}${location.name}`,
        value: locationKindLabel(location.kind),
        description: location.mapId === regionMap.currentMapId
          ? `현재 위치: ${regionMap.currentMapName}`
          : `${location.name} · ${locationKindLabel(location.kind)}`,
        attributes: { 'data-current-location': String(location.mapId === regionMap.currentMapId) },
        testId: `campaign-location-${location.mapId}`,
        onActivate: readOnly,
      })),
      hint: `현재 위치: ${regionMap.currentMapName} · ↑↓ 장소 보기 · Esc 돌아가기`,
    };
  }
  const earned = campaign.badges.filter((badge) => session.switches[badge.switchId] === true).length;
  const next = campaign.objectives.find((objective) => session.switches[objective.switchId] !== true
    && (!objective.requiresSwitchId || session.switches[objective.requiresSwitchId] === true));
  return {
    title: `배지·목표 · ${earned}/${campaign.badges.length}`,
    layout: 'campaign-progress',
    entries: [
      { label: '다음 목표', value: '', description: next?.title ?? '모든 원정을 마쳤습니다. 섬의 숨은 몬스터를 찾아보세요.', testId: 'campaign-next-objective', onActivate: readOnly, attributes: { 'data-campaign-information': 'true' } },
      ...campaign.badges.map((badge, index) => {
        const acquired = session.switches[badge.switchId] === true;
        return {
          label: `${String(index + 1).padStart(2, '0')} ${badge.name}`,
          value: acquired ? '획득 ◆' : '미획득 ◇',
          description: project.maps[badge.cityMapId]?.name ?? campaign.locations.find((location) => location.mapId === badge.cityMapId)?.name ?? '체육관',
          // 배지 케이스: 받은 배지는 그 배지의 그림(캠페인 정의 iconResourceId, 없으면 기본 배지 아이콘)이 앞에 붙는다.
          ...(acquired ? { icon: { resourceId: badge.iconResourceId ?? 'cc0-jetrel-badge', alt: badge.name, testId: `campaign-badge-icon-${badge.id}` } } : {}),
          attributes: { 'data-badge-acquired': String(acquired) },
          testId: `campaign-badge-${badge.id}`,
          onActivate: readOnly,
        };
      }),
      ...campaign.objectives.map((objective) => {
        const complete = session.switches[objective.switchId] === true;
        const unlocked = !objective.requiresSwitchId || session.switches[objective.requiresSwitchId] === true;
        return {
          label: objective.title,
          value: complete ? '완료' : unlocked ? '진행 중' : '대기',
          description: complete ? '이 목표를 완료했습니다.' : unlocked ? objective.title : '앞선 목표를 마치면 시작합니다.',
          testId: `campaign-objective-${objective.id}`,
          attributes: { 'data-objective-complete': String(complete) },
          onActivate: readOnly,
        };
      }),
    ],
    hint: next?.title ?? '원정 완료',
  };
}


function locationKindLabel(kind: MonsterCampaignDefinition['locations'][number]['kind']): string {
  return { town: '마을', route: '길', dungeon: '탐험지', league: '리그' }[kind];
}

function transferTargets(value: unknown, targets: Set<string>): void {
  if (Array.isArray(value)) { for (const child of value) transferTargets(child, targets); return; }
  if (!value || typeof value !== 'object') return;
  const command = value as Record<string, unknown>;
  if (command.kind === 'transfer' && typeof command.mapId === 'string') targets.add(command.mapId);
  for (const child of Object.values(command)) {
    if (child && typeof child === 'object') transferTargets(child, targets);
  }
}

export function buildCampaignRegionMap(project: Project, session: PlaySession, campaign: MonsterCampaignDefinition): CampaignRegionMap {
  const adjacency = new Map<string, Set<string>>();
  for (const map of Object.values(project.maps)) {
    const targets = new Set<string>();
    transferTargets(map.events.map((event) => (event.pages ?? []).map((page) => page.commands)), targets);
    adjacency.set(map.id, targets);
  }
  const regionIds = new Set(campaign.locations.map((location) => location.mapId));
  // Buildings inherit the nearest named exterior by following real transfer commands.
  const findRegion = (mapId: string): string | undefined => {
    const visited = new Set<string>();
    const queue = [mapId];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (regionIds.has(id)) return id;
      queue.push(...(adjacency.get(id) ?? []));
    }
    return undefined;
  };
  const links: { from: string; to: string }[] = [];
  const emitted = new Set<string>();
  for (const location of campaign.locations) {
    for (const target of adjacency.get(location.mapId) ?? []) {
      const to = findRegion(target);
      if (!to || to === location.mapId) continue;
      const key = [location.mapId, to].sort().join('|');
      if (emitted.has(key)) continue;
      emitted.add(key);
      links.push({ from: location.mapId, to });
    }
  }
  return { locations: campaign.locations, links, currentMapId: findRegion(session.currentMapId),
    currentMapName: project.maps[session.currentMapId]?.name ?? '알 수 없는 장소' };
}

const MAP_W = 448;
const MAP_H = 136;
const LABEL_PX = 16;

type LabelBox = { x0: number; y0: number; x1: number; y1: number };

const textWidth = (text: string): number => [...text].reduce((sum, ch) => sum + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3040-\u30ff\u4e00-\u9fff]/.test(ch) ? LABEL_PX : ch === ' ' ? 6 : 9), 0);

// 이름 상자 사이에 여백을 둔다 — 서로 붙은 두 줄이 한 덩어리 문구로 읽히지 않게, 다른 이름은 한 줄 이상 띄운다.
const LABEL_GAP_X = 10, LABEL_GAP_Y = 6;
// 가장자리와도 떨어뜨려 글자가 지도 틀에 붙어 잘려 보이지 않게 한다.
const EDGE_X = 8, EDGE_Y = 4;
const padBox = (box: LabelBox, dx: number, dy: number): LabelBox => ({ x0: box.x0 - dx, y0: box.y0 - dy, x1: box.x1 + dx, y1: box.y1 + dy });
const overlaps = (a: LabelBox, b: LabelBox): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** 지역 지도: 실제 장소 좌표와 연결선만 그린다. 이름은 16px 도트 글꼴로 노드 옆에 놓고, 겹치면 위·아래·옆으로 피한다. */
export function renderCampaignRegionMap(map: CampaignRegionMap): HTMLElement {
  const figure = el('figure', { class: 'campaign-region-map', dataset: { testid: 'campaign-region-map' } });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `지역 지도. 현재 위치: ${map.currentMapName}`);
  const title = document.createElementNS(ns, 'title');
  title.textContent = `현재 위치: ${map.currentMapName}`;
  svg.append(title);
  const shape = (tag: string, attributes: Record<string, string>, text?: string): SVGElement => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    svg.append(node);
    return node;
  };
  // 도식 지도: 실제 좌표의 순서만 지키고 간격은 고르게 편다 — 가까운 장소끼리 이름이 겹치지 않게 한다.
  const rankOf = (values: number[]): Map<number, number> => {
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    return new Map(sorted.map((value, index) => [value, sorted.length <= 1 ? 0.5 : index / (sorted.length - 1)]));
  };
  const rankX = rankOf(map.locations.map((location) => location.x));
  const rankY = rankOf(map.locations.map((location) => location.y));
  // 가운데 영역에 좌표를 펴고, 가장자리는 이름이 들어갈 여백으로 둔다.
  const left = 52, right = MAP_W - 52, top = 22, bottom = MAP_H - 24;
  const positions = new Map(map.locations.map((location) => [location.mapId, {
    x: Math.round(left + rankX.get(location.x)! * (right - left)),
    y: Math.round(top + (1 - rankY.get(location.y)!) * (bottom - top)),
  }]));
  // 길 선분도 이름이 피해야 하는 상자다 — 글자가 선에 가로로 긁히면 취소선처럼 읽힌다.
  const roadBoxes: LabelBox[] = [];
  for (const link of map.links) {
    const from = positions.get(link.from), to = positions.get(link.to);
    if (!from || !to) continue;
    shape('path', { d: `M${from.x} ${from.y} H${to.x} V${to.y}`, class: 'campaign-region-road' });
    roadBoxes.push({ x0: Math.min(from.x, to.x) - 2, y0: from.y - 2, x1: Math.max(from.x, to.x) + 2, y1: from.y + 2 });
    roadBoxes.push({ x0: to.x - 2, y0: Math.min(from.y, to.y) - 2, x1: to.x + 2, y1: Math.max(from.y, to.y) + 2 });
  }
  const nodeBoxes: LabelBox[] = [...positions.values()].map((p) => ({ x0: p.x - 7, y0: p.y - 7, x1: p.x + 7, y1: p.y + 7 }));
  const placed: LabelBox[] = [];
  // 현재 위치·가까운 노드를 먼저 놓아 긴 이름이 밀려나지 않게 한다.
  const order = [...map.locations].sort((a, b) => Number(b.mapId === map.currentMapId) - Number(a.mapId === map.currentMapId));
  for (const location of order) {
    const point = positions.get(location.mapId)!;
    const width = textWidth(location.name);
    const candidates: { box: LabelBox; anchor: 'start' | 'middle' | 'end'; x: number; y: number }[] = [];
    const add = (anchor: 'start' | 'middle' | 'end', x: number, yTop: number) => {
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
      candidates.push({ box: { x0, y0: yTop, x1: x0 + width, y1: yTop + LABEL_PX }, anchor, x, y: yTop + LABEL_PX - 3 });
    };
    add('middle', point.x, point.y + 9);
    add('middle', point.x, point.y - 9 - LABEL_PX);
    add('start', point.x + 10, point.y - LABEL_PX / 2);
    add('end', point.x - 10, point.y - LABEL_PX / 2);
    add('start', point.x - 4, point.y + 9);
    add('end', point.x + 4, point.y + 9);
    add('start', point.x - 4, point.y - 9 - LABEL_PX);
    add('end', point.x + 4, point.y - 9 - LABEL_PX);
    // 길이 빽빽해 위 여덟 자리가 모두 선에 걸리면, 노드에서 가까운 순으로 선 사이 빈 줄을 찾는다.
    const extras: typeof candidates = [];
    const mark = candidates.length;
    for (let dy = -40; dy <= 24; dy += 2) {
      for (const [anchor, dx] of [['start', 10], ['end', -10], ['middle', 0]] as const) add(anchor, point.x + dx, point.y + dy);
    }
    extras.push(...candidates.splice(mark));
    extras.sort((a, b) => (Math.abs(a.x - point.x) + Math.abs(a.y - point.y)) - (Math.abs(b.x - point.x) + Math.abs(b.y - point.y)));
    candidates.push(...extras);
    const inside = (c: (typeof candidates)[number]): boolean => c.box.x0 >= EDGE_X && c.box.x1 <= MAP_W - EDGE_X && c.box.y0 >= EDGE_Y && c.box.y1 <= MAP_H - EDGE_Y;
    const clearOf = (c: (typeof candidates)[number]): boolean => !placed.some((other) => overlaps(c.box, padBox(other, LABEL_GAP_X, LABEL_GAP_Y))) && !nodeBoxes.some((other) => overlaps(c.box, other));
    const roadHits = (c: (typeof candidates)[number]): number => roadBoxes.filter((other) => overlaps(c.box, other)).length;
    const choice = candidates.find((c) => inside(c) && clearOf(c) && roadHits(c) === 0)
      ?? candidates.filter((c) => inside(c) && clearOf(c)).sort((a, b) => roadHits(a) - roadHits(b))[0]
      ?? candidates[0]!;
    placed.push(choice.box);
    shape('text', { x: String(choice.x), y: String(choice.y), 'text-anchor': choice.anchor, class: `campaign-region-label${location.mapId === map.currentMapId ? ' is-current' : ''}` }, location.name);
  }
  for (const location of map.locations) {
    const point = positions.get(location.mapId)!;
    shape('rect', { x: String(point.x - 4), y: String(point.y - 4), width: '8', height: '8', class: `campaign-region-node is-${location.kind}` });
    if (location.mapId === map.currentMapId) {
      shape('path', { d: `M${point.x - 5} ${point.y - 5} H${point.x + 5} L${point.x} ${point.y - 11} Z`, class: 'campaign-region-current' });
    }
  }
  const legend = el('figcaption', { dataset: { testid: 'campaign-region-current' } });
  legend.append(el('span', { class: 'is-current', text: '▼ 현재' }), el('span', { class: 'is-town', text: '■ 마을' }), el('span', { class: 'is-route', text: '■ 길' }), el('span', { class: 'is-dungeon', text: '■ 탐험지' }));
  figure.append(svg, legend);
  return figure;
}
