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

export function renderCampaignRegionMap(map: CampaignRegionMap): HTMLElement {
  const figure = el('figure', { class: 'campaign-region-map', dataset: { testid: 'campaign-region-map' } });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 220 118');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `지역 지도. 현재 위치: ${map.currentMapName}`);
  const title = document.createElementNS(svg.namespaceURI, 'title');
  title.textContent = `현재 위치: ${map.currentMapName}`;
  svg.append(title);
  const xs = map.locations.map((location) => location.x);
  const ys = map.locations.map((location) => location.y);
  const minX = Math.min(...xs, 0), minY = Math.min(...ys, 0);
  const spanX = Math.max(...xs, 1) - minX || 1, spanY = Math.max(...ys, 1) - minY || 1;
  const positions = new Map(map.locations.map((location) => [location.mapId, { x: 14 + (location.x - minX) / spanX * 186, y: 12 + (location.y - minY) / spanY * 88 }]));
  const shape = (tag: string, attributes: Record<string, string>): SVGElement => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
    return node;
  };
  shape('path', { d: 'M22 15 L72 5 111 12 145 6 198 25 212 60 195 99 159 111 115 106 80 112 38 96 9 65 Z', class: 'campaign-region-island' });
  for (const link of map.links) {
    const from = positions.get(link.from), to = positions.get(link.to);
    if (from && to) shape('path', { d: `M${from.x} ${from.y} H${to.x} V${to.y}`, class: 'campaign-region-road' });
  }
  for (const location of map.locations) {
    const point = positions.get(location.mapId)!;
    const node = shape('rect', { x: String(point.x - 2.5), y: String(point.y - 2.5), width: '5', height: '5', class: `campaign-region-node is-${location.kind}` });
    const label = document.createElementNS(svg.namespaceURI, 'title');
    label.textContent = location.name;
    node.append(label);
    if (location.mapId === map.currentMapId) {
      shape('path', { d: `M${point.x - 4} ${point.y - 11} H${point.x + 4} L${point.x} ${point.y - 5} Z`, class: 'campaign-region-current' });
    }
  }
  figure.append(svg, el('figcaption', { text: `▼ ${map.currentMapName} · ■ 마을  ▪ 길  ◆ 탐험지`, dataset: { testid: 'campaign-region-current' } }));
  return figure;
}
