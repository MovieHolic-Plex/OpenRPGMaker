import { hasAuthoredTextOpening } from '../../project/cinematicPresentation';
import type { GameMap, Project } from '../../project/types';
import type { FirstPlayReceipt } from './firstPlay';
import { CHARSET_SEMANTICS } from '../../assets/charsetSemantics';
import { charsetFrameIndex, decodeCharsetFrameIndex } from '../../assets/easyrpgRtp';
import { CC0_ICON_ASSETS } from '../../assets/cc0IconAssets';
import { presentationArtIds } from '../../editor/tools/presentationTools';
import { handInteriorShapeFromMap, PLAIN_BOX_MIN_CELLS } from '../../editor/handInterior/shape';
import { playableSegmentGenre, SEGMENT_ROUTE_MAP_ID } from '../../project/playableSegmentContract';
import { isPassable } from '../../project/collision';

/** A finite, real catalog lets entry authoring write instead of searching forever. */
export function firstSceneObjectCatalog(): unknown {
  return {
    staticObjects: CC0_ICON_ASSETS.filter(asset => asset.id.startsWith('cc0-jetrel-') && !asset.id.includes('-gen'))
      .map(asset => ({label:asset.name,nativeGraphic:{sprite:{type:'bundled',id:asset.id},pattern:0}})),
    charsetObjects: CHARSET_SEMANTICS.filter(asset => /_object[12]$/.test(asset.textureKey))
      .map(asset => ({label:asset.label,tags:asset.tags,nativeGraphic:{sprite:{type:'bundled',id:asset.textureKey},
        pattern:charsetFrameIndex({characterIndex:asset.characterIndex,direction:'down',pattern:1})}})),
  };
}

const STORY_ROUTE_PROP = /^(bd-prop-(bench_wood|hedge|flowerbed|lamp_crook|lamp_double|tree_planter|planter_round|statue_sage|column_monument|well_roofed|door_pots|flowerbox_long)|bd-mpart-(lamp-post|flower-patch|hedge|cypress-tub|shrub-tub|ivy-arch|low-wall)|bd-garden-gate)$/;

/** 스토리 첫 구간의 길 맵 안내 — 뼈대가 깐 산책길을 보존하고, 실제로 찍을 수 있는 버들항 소품만 목록으로 준다. */
export function storyRouteBrief(project: Project): string[] {
  const route = project.maps[SEGMENT_ROUTE_MAP_ID];
  if (playableSegmentGenre(project) !== 'story-cutscene' || !route) return [];
  const kits = (project.tilesets[route.tilesetId]?.structureKits ?? []).filter(kit => STORY_ROUTE_PROP.test(kit.id));
  if (!kits.length) return [];
  return [
    `${SEGMENT_ROUTE_MAP_ID}(${route.name})에는 뼈대가 포석 산책길과 길 끝 만남 광장(석상·벤치·가로등·꽃밭·산울타리)을 이미 깔았다. 마무리 대상은 광장 벤치 앞에 선다. `
      + '몬스터 도로처럼 다시 깔거나 빈 풀밭으로 지우지 않는다. 기획의 장소(예: 교정 뒤뜰·강변 산책로)에 맞게 맵 이름을 바꾸고, 부족한 것만 stamp_object 로 더한다. 길과 광장 칸을 막지 않는다.',
    '찍을 수 있는 소품(objectId · 이름 · 칸 크기 · 쓰임): ' + JSON.stringify(kits.map(kit => ({
      objectId: `kit:${route.tilesetId}/${kit.id}`, name: kit.name, size: `${kit.width}x${kit.height}`, use: (kit.ai?.description ?? '').slice(0, 70),
    }))),
  ];
}

export function firstSceneMapIds(project: Project, receipt: FirstPlayReceipt): string[] {
  return [...new Set([project.startMapId, ...receipt.events.filter(e => e.role !== 'progression').map(e => e.mapId)])];
}

/** Actual asset identities stop a crystal from being approved as a watch. */
export function firstSceneGraphicEvidence(project: Project, receipt: FirstPlayReceipt): unknown[] {
  return receipt.events.filter(ref => ref.role !== 'progression').map(ref => {
    const event = project.maps[ref.mapId]?.events.find(event => event.id === ref.eventId);
    return { ...ref, name: event?.name, x: event?.x, y: event?.y, graphics: event?.pages?.map(page => {
      const id = page.graphic.sprite?.id ?? event?.sprite?.id;
      const slot = decodeCharsetFrameIndex(page.graphic.pattern ?? 0).characterIndex;
      const charset = CHARSET_SEMANTICS.find(entry => entry.textureKey === id && entry.characterIndex === slot);
      const icon = CC0_ICON_ASSETS.find(entry => entry.id === id);
      return { id, pattern: page.graphic.pattern, actualLabel: charset?.label ?? icon?.name
        ?? (id ? project.assets.uploaded[id]?.name : undefined), tags: charset?.tags };
    }) };
  });
}

function scenery(map: GameMap | undefined): unknown {
  if (!map) return null;
  return [map.width, map.height, map.tilesetId, map.lowerTiles, map.upperTiles,
    map.lowerOverlayTiles, map.upperOverlayTiles, map.background, map.relief, map.doodadGroups];
}

/** Minimum evidence only. A delivered map image and semantic review are still required. */
function hasSceneryOf(map: GameMap | undefined): boolean {
  if (!map) return false;
  return [map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles]
    .some(layer => layer?.some(tile => tile >= 0)) || Boolean(map.background)
    || Boolean(map.doodadGroups?.length) || Boolean(map.relief?.levels.some(height => height > 0));
}

/**
 * 실내의 출구와 모양. 출구 이벤트가 가장자리 틈 위에 있어야 「밖으로 나가는 길」이 그림으로 보인다.
 * 왜(2026-10-07): 세미나실이 틈 없는 20×15 ㅁ자로 지어지고 출구는 방 안 바닥의 보이지 않는 이동 칸이었는데 검수를 통과했다.
 */
export function inspectInteriorExits(project: Project, mapId: string): string[] {
  const map = project.maps[mapId];
  const shape = map && handInteriorShapeFromMap(map);
  if (!map || !shape) return [];
  const issues: string[] = [];
  const isOpening = (x: number, y: number) => shape.openings.some(o => o.x === x && o.y === y);
  for (const event of map.events) {
    const outbound = [...(event.commands ?? []), ...(event.pages ?? []).flatMap(page => page.commands)]
      .some(command => command.kind === 'transfer' && command.mapId !== mapId);
    if (!outbound || isOpening(event.x, event.y)) continue;
    issues.push(shape.openings.length
      ? `${mapId}: 출구 ${event.id}(${event.x},${event.y})가 벽 틈이 아니라 방 안 바닥의 보이지 않는 이동 칸입니다. 평면 맨 아래 줄 틈(${shape.openings.slice(0, 3).map(o => `${o.x},${o.y}`).join(' / ')})으로 옮기세요 — build_hand_interior_room 을 다시 부르면 문을 틈으로 자동으로 옮깁니다.`
      : `${mapId}: 바깥으로 나가는 틈이 없습니다(출구 ${event.id}). plan 맨 아래 줄의 '#' 하나를 '.' 로 비워 문을 내고 다시 지으세요.`);
  }
  if (shape.plainBox && shape.innerCells >= PLAIN_BOX_MIN_CELLS) {
    issues.push(`${mapId}: 방이 칸막이·알코브 없는 직사각형 하나(ㅁ자, 실내 ${shape.innerCells}칸)입니다. ㄱ·ㄷ자 외곽, 벽에서 들어간 알코브, 두꺼운 칸막이('#' 덩이)로 쓰임이 다른 구역을 나누거나 평면을 줄이세요.`);
  }
  return issues;
}

export function inspectFirstScenePlaces(base: Project, project: Project, receipt: FirstPlayReceipt): string[] {
  const issues: string[] = [];
  for (const id of firstSceneMapIds(project, receipt)) {
    const map = project.maps[id];
    if (!map) { issues.push(`첫 장면 맵이 없습니다: ${id}`); continue; }
    // 뼈대가 이미 장소를 깔아 둔 맵(스토리 산책길 등)은 그대로 써도 된다 — 빈 맵을 그대로 둔 것만 막는다.
    if (!hasSceneryOf(base.maps[id]) && JSON.stringify(scenery(map)) === JSON.stringify(scenery(base.maps[id]))) {
      issues.push(`기본 빈 맵의 장소 구성이 그대로입니다: ${id}`);
    }
    if (!hasSceneryOf(map)) issues.push(`바닥 외에 장소를 보여주는 물체/구조가 없습니다: ${id}`);
    issues.push(...inspectInteriorExits(project, id));
  }
  return issues;
}

export function inspectFirstScene(base: Project, project: Project, receipt: FirstPlayReceipt, openingPending = false): string[] {
  const issues = inspectFirstScenePlaces(base, project, receipt);
  for (const id of firstSceneMapIds(project, receipt)) {
    for (const event of project.maps[id]?.events ?? []) {
      const visit = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(visit); return; }
        const record = value as Record<string, unknown>;
        if (record.kind === 'text' && typeof record.body === 'string') {
          if (/\\+"/.test(record.body)) issues.push(`대사에 JSON 이스케이프 문자가 보입니다: ${event.id}. 따옴표 앞 역슬래시를 제거하세요.`);
          if (/\(\s*\d+\s*,\s*\d+\s*\)/.test(record.body)) issues.push(`대사가 플레이어에게 내부 타일 좌표를 보여줍니다: ${event.id}. 보이는 물체/방향으로 안내하세요.`);
        }
        Object.values(record).forEach(visit);
      };
      visit(event.pages?.length ? event.pages.map(page => page.commands) : event.commands);
    }
  }
  for (const ref of receipt.events.filter(e => e.role !== 'progression')) {
    const map = project.maps[ref.mapId], event = map?.events.find(e => e.id === ref.eventId);
    if (!map || !event) continue;
    const initial = event.pages?.find(page => !page.conditions.length);
    const sprite = initial?.graphic.transparent !== true && (initial?.graphic.sprite?.id || initial?.graphic.appearanceId || event.sprite?.id);
    const index = event.y * map.width + event.x;
    const tileObject = [map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles].some(layer => (layer?.[index] ?? -1) >= 0);
    if (!sprite && !tileObject) issues.push(`첫 상호작용/마무리 대상의 그림이 없습니다: ${ref.mapId}/${ref.eventId}`);
    // 2026-10-07 적대적 검토: 모델이 마무리 대상(친구)을 벤치 위로 옮겨 사람이 가구 위에 서 있었다. 인물 그림 대상은 밟을 수 있는 칸에 선다.
    if (sprite && !isPassable(project, map, event.x, event.y)) {
      issues.push(`첫 상호작용/마무리 대상이 막힌 칸(가구·벽·나무) 위에 서 있습니다: ${ref.mapId}/${ref.eventId}(${event.x},${event.y}). 그 물체 앞 빈 바닥 칸으로 옮기세요.`);
    }
  }
  const opening = project.system.opening;
  if (!openingPending && opening?.enabled && opening.scenes.length) {
    if (opening.scenes.every(scene => scene.kind === 'text') && !hasAuthoredTextOpening(opening.scenes)) issues.push('검은 화면의 글만으로 첫 오프닝을 완료할 수 없습니다. 실제 장소에서 짧게 시작하거나 장면에 맞는 그림을 사용하세요.');
    if (opening.scenes.reduce((sum, scene) => sum + scene.durationMs, 0) > 90_000) issues.push('첫 오프닝의 자동 재생이 90초를 넘습니다. 첫 행동에 필요한 짧은 도입으로 줄이세요.');
  } else if (project.system.genre === 'story-cutscene') {
    const intros = project.maps[project.startMapId]?.events.filter(event => event.pages?.some(page =>
      !page.conditions.length && page.trigger.kind === 'auto' && page.commands.some(command => command.kind === 'text'))) ?? [];
    if (!intros.length) issues.push('스토리 첫 장면의 도입/첫 행동 안내가 없습니다. 실제 맵에서 한 번만 실행되는 짧은 자동 이벤트로 작성하세요.');
    for (const event of intros) {
      const page = event.pages!.find(page => !page.conditions.length && page.trigger.kind === 'auto')!;
      const stop = page.commands.find(command => command.kind === 'setSelfSwitch' && command.value === true);
      if (!stop || stop.kind !== 'setSelfSwitch' || !event.pages!.some(other => other !== page && other.trigger.kind !== 'auto' && other.conditions.some(condition =>
        condition.kind === 'selfSwitch' && condition.key === stop.key && condition.value === true))) {
        issues.push(`첫 도입을 한 번만 실행하고 조작을 돌려주는 페이지가 없습니다: ${event.id}`);
      }
    }
  }
  return issues;
}

/** Review expires on scenery, event, opening, protagonist or ending changes. */
export function firstSceneSignature(project: Project, receipt: FirstPlayReceipt): string {
  return JSON.stringify({ maps: firstSceneMapIds(project, receipt).map(id => project.maps[id]),
    startMapId: project.startMapId, startPos: project.startPos, system: project.system,
    actors: project.database.actors, endings: project.endings, brief: project.gameDesignBrief,
    presentationArt: presentationArtIds(project).map(id => project.assets.uploaded[id]) });
}

export const FIRST_SCENE_INSTRUCTIONS = [
  '핵심 행동이 구현되어도 빈 풀밭·안 보이는 조사물·검은 화면의 긴 독백은 완성이 아니다.',
  '기획의 실제 첫 장소와 마무리 장소를 구성한다. 첫 조사/대화 대상과 출구가 그림으로 보이고 정상 이동으로 접근 가능해야 한다. 실내를 잔디 맵으로 부르지 않는다.',
  '실내는 list_tileset_references → read_tileset_reference(조립법과 가까운 예제 그림) → list_hand_interior_parts → build_hand_interior_room을 사용한다. 기존 빈 맵은 set_map_properties로 tilesetId를 atlas_biome_interior로 바꾼 뒤 replace:true로 지을 수 있다. 맵/핵심 이벤트/출입구 ID와 두 선택 결과를 보존하고 필요한 좌표·통행을 함께 맞춘다.',
  '실내 평면 문법: 바깥으로 나가는 문은 plan 맨 아래 줄의 \'.\' 틈이다(3/4 시점 실내의 정석 출입구). 틈은 1~2칸 폭으로 낸다 — 더 넓으면 문이 아니라 막다른 홈으로 읽힌다. 틈을 내면 기존 출구 이벤트와 맞은편 도착 칸은 도구가 틈으로 자동으로 옮기고 안쪽에 발깔개를 깐다. 틈 없이 start 로 방 안 바닥을 출입구로 삼거나 출구 이벤트를 방 안 바닥에 두지 않는다. 60칸 넘는 방을 칸막이 없는 직사각형 하나(ㅁ자)로 짓지 않는다 — ㄱ·ㄷ자 외곽, 벽에서 들어간 알코브, 두꺼운 칸막이로 쓰임이 다른 구역(예: 서가 구역·모임 탁자·창가 자리)을 나누고, 빈 바닥이 남으면 평면을 줄인다.',
  '회중시계/책/인물 같은 핵심 대상은 실제 그림이 있어야 한다. 정적 타일 물체에 이벤트를 붙일 때는 물체가 보이는 칸에 붙이고 옆에서 조사할 수 있게 한다. 가구 그림이 막는 칸 위로 플레이어를 걷게 하지 않는다.',
  '그림의 실제 리소스 의미를 확인한다. 보석을 시계라고 부르거나 투명 대상을 보인다고 주장하지 않는다. 제공된 실제 자산 목록의 nativeGraphic을 이벤트 pages[].graphic으로 쓴다. 예: cc0-jetrel-clock은 회중시계 그림이며 16px 크기로 표시된다. 사용자가 확정한 물체는 보존한다. 조수가 임의로 추가한 마무리 소품의 정확한 그림이 없으면 목록의 실제 물체를 고르고 그 물체에 맞게 이름·묘사를 정정한다. 요청한 선택·각기 다른 반응·진행·엔딩 연결은 유지한다.',
  '스토리의 첫 조작 안내는 실제 시작 장소가 보이는 상태에서 한두 개의 짧은 대사로 작성한다. 시작 맵에 auto 페이지 + 마지막 setSelfSwitch + 같은 스위치 조건의 빈 action 페이지로 한 번만 실행한다. 방향키 이동과 Z/Enter 조사, 실제 첫 대상의 위치를 짧게 안내한다. 작품 타이틀과 저작된 오프닝은 별도 필수 제작 단계이며 끄거나 이 맵 안내로 대체하지 않는다.',
  '첫 구간의 모든 대사(선택 결과와 결말 포함)를 확인한다. 플레이어에게는 보이는 물체와 방향으로 안내한다. 내부 타일 좌표, 이벤트 ID, JSON 역슬래시를 대사에 내보내지 않는다. 도구 body에는 실제 표시할 자연스러운 문장을 넣고 따옴표를 수동으로 이스케이프하지 않는다.',
  '첫 화면에서 이야기한 방/탁자/물건과 실제 그림·좌표가 일치해야 한다. show_map_region으로 두 장소의 전체 그림을 보고 수정한다. 최소 장소 구성과 대상 식별은 다음 요청으로 넘길 장식이 아니다.',
] as const;
