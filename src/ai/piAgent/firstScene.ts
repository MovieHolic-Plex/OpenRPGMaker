import { hasAuthoredTextOpening } from '../../project/cinematicPresentation';
import type { GameMap, Project } from '../../project/types';
import type { FirstPlayReceipt } from './firstPlay';
import { CHARSET_SEMANTICS } from '../../assets/charsetSemantics';
import { charsetFrameIndex, decodeCharsetFrameIndex } from '../../assets/easyrpgRtp';
import { CC0_ICON_ASSETS } from '../../assets/cc0IconAssets';
import { presentationArtIds } from '../../editor/tools/presentationTools';

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
export function inspectFirstScenePlaces(base: Project, project: Project, receipt: FirstPlayReceipt): string[] {
  const issues: string[] = [];
  for (const id of firstSceneMapIds(project, receipt)) {
    const map = project.maps[id];
    if (!map) { issues.push(`첫 장면 맵이 없습니다: ${id}`); continue; }
    if (JSON.stringify(scenery(map)) === JSON.stringify(scenery(base.maps[id]))) {
      issues.push(`기본 빈 맵의 장소 구성이 그대로입니다: ${id}`);
    }
    const hasScenery = [map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles]
      .some(layer => layer?.some(tile => tile >= 0)) || Boolean(map.background)
      || Boolean(map.doodadGroups?.length) || Boolean(map.relief?.levels.some(height => height > 0));
    if (!hasScenery) issues.push(`바닥 외에 장소를 보여주는 물체/구조가 없습니다: ${id}`);
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
  '회중시계/책/인물 같은 핵심 대상은 실제 그림이 있어야 한다. 정적 타일 물체에 이벤트를 붙일 때는 물체가 보이는 칸에 붙이고 옆에서 조사할 수 있게 한다. 가구 그림이 막는 칸 위로 플레이어를 걷게 하지 않는다.',
  '그림의 실제 리소스 의미를 확인한다. 보석을 시계라고 부르거나 투명 대상을 보인다고 주장하지 않는다. 제공된 실제 자산 목록의 nativeGraphic을 이벤트 pages[].graphic으로 쓴다. 예: cc0-jetrel-clock은 회중시계 그림이며 16px 크기로 표시된다. 사용자가 확정한 물체는 보존한다. 조수가 임의로 추가한 마무리 소품의 정확한 그림이 없으면 목록의 실제 물체를 고르고 그 물체에 맞게 이름·묘사를 정정한다. 요청한 선택·각기 다른 반응·진행·엔딩 연결은 유지한다.',
  '스토리의 첫 조작 안내는 실제 시작 장소가 보이는 상태에서 한두 개의 짧은 대사로 작성한다. 시작 맵에 auto 페이지 + 마지막 setSelfSwitch + 같은 스위치 조건의 빈 action 페이지로 한 번만 실행한다. 방향키 이동과 Z/Enter 조사, 실제 첫 대상의 위치를 짧게 안내한다. 작품 타이틀과 저작된 오프닝은 별도 필수 제작 단계이며 끄거나 이 맵 안내로 대체하지 않는다.',
  '첫 구간의 모든 대사(선택 결과와 결말 포함)를 확인한다. 플레이어에게는 보이는 물체와 방향으로 안내한다. 내부 타일 좌표, 이벤트 ID, JSON 역슬래시를 대사에 내보내지 않는다. 도구 body에는 실제 표시할 자연스러운 문장을 넣고 따옴표를 수동으로 이스케이프하지 않는다.',
  '첫 화면에서 이야기한 방/탁자/물건과 실제 그림·좌표가 일치해야 한다. show_map_region으로 두 장소의 전체 그림을 보고 수정한다. 최소 장소 구성과 대상 식별은 다음 요청으로 넘길 장식이 아니다.',
] as const;
