import { animaticCaptionText, parseCssColor, sampleAnimaticTrack, type AnimaticLayer, type OpeningAnimatic } from './openingAnimatic';
import type { CinematicScene, Project } from './types';

/**
 * 오프닝 애니메틱 화풍 자물쇠의 객관 측정 — 그림 화소가 아니라 저작값만 본다.
 * 같은 프로젝트의 모든 샷이 한 도트 크기·한 자막 어법·한 배우 배율을 쓰는지 결정론적으로 세고,
 * 조수의 완료 검토와 review_opening 이 같은 수치를 보게 한다. 실제 화소(팔레트 수·자막 대비·움직이는
 * 화소 면적)는 브라우저에서 프레임을 그린 뒤 editor/openingAnimaticPreview.measureAnimaticFrames 가 잰다.
 */

/** 모든 샷이 같은 도트 크기로 보이게 하는 무대 격자. */
export const OPENING_STAGE = { width: 384, height: 216 } as const;
/** 한 샷 길이의 권장 대역(ms). 참조 도입부도 6~10초대다. */
export const OPENING_SHOT_MS = { min: 5500, max: 10500, recommend: [6000, 10000] as const };
/** 한 샷에 «동시에 살아 있는 것»의 최소 개수. 정지 그림 + 효과 하나는 연출이 아니다. */
export const OPENING_MIN_MOVING = 3;
/** 말풍선 상자의 격자 픽셀 상한 — 이보다 크면 만화 말풍선이 되어 장면을 덮는다(12×12 권장, 꼬리 포함 최대 14×16). */
export const OPENING_EMOTE_MAX = 16;
/** 오프닝 전체에서 자막 색이 바뀌어도 되는 횟수(기본색 + 강조 2회). */
export const OPENING_CAPTION_SWITCHES = 2;
/** 자막 글자 크기(격자 픽셀). */
export const OPENING_CAPTION_FONT = { min: 10, max: 12 } as const;
export const OPENING_SAFE_MARGIN = 1;

const luminance = (r: number, g: number, b: number): number => {
  const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const parseHex = (color: string): [number, number, number] | null => {
  const parsed = parseCssColor(color);
  // 반투명 색은 자막 바(검정) 위에 합성한 값으로 잰다.
  return parsed ? [Math.round(parsed[0] * parsed[3]), Math.round(parsed[1] * parsed[3]), Math.round(parsed[2] * parsed[3])] : null;
};
/** WCAG 대비비. 자막 색과 레터박스 바(검정) 사이의 실제 읽힘을 잰다. */
export function contrastAgainst(foreground: string, background = '#000000'): number {
  const f = parseHex(foreground), b = parseHex(background);
  if (!f || !b) return 0;
  const lf = luminance(f[0], f[1], f[2]), lb = luminance(b[0], b[1], b[2]);
  return Number(((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05)).toFixed(2));
}

/** 무대 위에서 «실제로 상태가 변하는» 레이어만 센다(움직임의 종류까지 기록). */
export function movingLayers(composition: OpeningAnimatic): { id: string; what: string }[] {
  return composition.layers.flatMap((l) => {
    const what: string[] = [];
    if (l.region) what.push(`region:${l.region.mode}`);
    if (l.walk) what.push('walk');
    if (l.particles) what.push(`particles:${l.particles.preset}`);
    if (l.shaft) what.push(l.shaft.dust ? 'shaft+dust' : 'shaft');
    if (l.glow) what.push(l.glow.pulse ? 'glow+pulse' : 'glow');
    if (l.emote) what.push(`emote:${l.emote.preset}`);
    if ((l.sheet?.fps ?? 0) > 0) what.push('sheet');
    const keyed = Object.keys(l.keys ?? {}).filter((k) => k !== 'opacity');
    if (keyed.length) what.push(`keys:${keyed.join('+')}`);
    return what.length ? [{ id: l.id, what: what.join(',') }] : [];
  });
}

/** 카메라는 «값이 실제로 변하는 키» 가 있을 때만 움직인다 — 정적 x/y/zoom 은 움직임이 아니다. */
function cameraMoves(c: OpeningAnimatic): boolean {
  const keys = c.camera?.keys;
  if (!keys) return false;
  return Object.values(keys).some((track) => Array.isArray(track) && new Set(track.map((k) => k.value)).size > 1);
}

export type OpeningShotMeasurement = {
  readonly id: string;
  readonly durationMs: number;
  readonly grid: { width: number; height: number } | null;
  readonly moving: { id: string; what: string }[];
  readonly movingCount: number;
  readonly planes: { background: number; actor: number; prop: number; foreground: number; effect: number; credit: number };
  readonly hasCamera: boolean;
  readonly spriteScale: { layerId: string; resourceId: string; frameWidth: number; drawnWidth: number; scale: number }[];
  readonly emoteBox: { layerId: string; width: number; height: number }[];
  readonly captionColors: string[];
  readonly captionFontSizes: number[];
  readonly backgroundResourceIds: string[];
  readonly backgrounds: { layerId: string; resourceId: string; x: number; y: number; width: number; height: number; anchorX: number; anchorY: number }[];
  readonly bundledBackgrounds: { layerId: string; resourceId: string }[];
  readonly actorCount: number;
  readonly actorBoxes: { layerId: string; resourceId: string; x: number; y: number; width: number; height: number; bundledPainted: boolean; characterRole?: string }[];
  readonly lowOpacityCritical: string[];
  readonly statefulCritical: string[];
};

export type OpeningMeasurement = {
  readonly shots: OpeningShotMeasurement[];
  readonly grid: { width: number; height: number } | null;
  readonly distinctGrids: string[];
  readonly distinctSpriteScales: number[];
  readonly captionColorSequence: string[];
  readonly captionSwitches: number;
  readonly lowestCaptionContrast: number;
  readonly emoteShotIds: string[];
  readonly transitionCounts: Record<string, number>;
  readonly totalMs: number;
  readonly issues: string[];
};

const animaticShots = (project: Project): Extract<CinematicScene, { kind: 'animatic' }>[] =>
  (project.system.opening?.scenes ?? []).filter((s): s is Extract<CinematicScene, { kind: 'animatic' }> => s.kind === 'animatic');

function shotMeasurement(project: Project, scene: Extract<CinematicScene, { kind: 'animatic' }>): OpeningShotMeasurement {
  const c = scene.composition;
  const moving = movingLayers(c);
  if (cameraMoves(c)) moving.push({ id: 'camera', what: 'camera' });
  const role = (l: AnimaticLayer) => l.role ?? (l.kind === 'shaft' || l.kind === 'glow' || l.kind === 'emote' || l.kind === 'particles' ? 'effect' : 'prop');
  const planes = { background: 0, actor: 0, prop: 0, foreground: 0, effect: 0, credit: 0 };
  for (const l of c.layers) planes[role(l)] += 1;
  const grid = c.pixelGrid ?? null;
  const spriteScale = c.layers.flatMap((l) => {
    if (l.kind !== 'image') return [];
    if (l.role === 'effect' || /(?:^|_)(glow|flash|eye|sun)(?:_|$)/iu.test(l.id) || /pixelart_opener_(?:crystal|magenta|eye|sword).*strip/iu.test(l.resourceId ?? '')) return [];
    const asset = project.assets.uploaded[l.resourceId ?? ''];
    const isBundledCharset = /^easyrpg-charset-/iu.test(l.resourceId ?? '');
    const frameWidth = l.sheet?.frameWidth ?? (asset?.kind === 'charset' || isBundledCharset ? 24 : undefined);
    if (!frameWidth) return [];
    return [{ layerId: l.id, resourceId: l.resourceId ?? '', frameWidth, drawnWidth: l.width, scale: Number((l.width / frameWidth).toFixed(3)) }];
  });
  const emoteBox = c.layers.filter((l) => l.kind === 'emote').map((l) => ({ layerId: l.id, width: l.width, height: l.height }));
  const captionLayers = c.layers.filter((l) => l.kind === 'caption');
  // 배경이 «지금 번들에 있는 그림 한 장» 인지, 이 오프닝을 위해 만든 도트 그림인지 구분한다.
  // 번들 스틸(사진·전투 배경·타이틀 아트)을 격자 무대 배경으로 쓰면 부드러운 그림이 384×216 로 줄어
  // 도트 배우와 화풍이 갈린다 — 조수 검사가 그 자리를 짚어 준다.
  const bundledPainted = (id: string): boolean => {
    const asset = project.assets.uploaded[id];
    if (asset && /^opening_still_[0-9a-f-]+$/iu.test(id)) return false;
    const kind = asset?.kind;
    if (kind === 'backdrop' || kind === 'title') return true;
    if (asset?.generatedBy === 'pixel-art') return false;
    return /^(oprn-still-|battle-scenery-|scarloxy|oga-|opengameart|tex_|easyrpg-|title_art_)|^title_art_/iu.test(id) ? true : kind === undefined;
  };
  const critical = (id: string) => /crystal|수정|eye|눈|sword|검/iu.test(id);
  return {
    id: scene.id, durationMs: scene.durationMs, grid, moving, movingCount: moving.length, planes,
    hasCamera: cameraMoves(c),
    spriteScale, emoteBox,
    captionColors: captionLayers.flatMap((l) => (l.caption?.cues ?? []).map((cue) => (cue.color ?? l.color ?? '#ffffff').toLowerCase())),
    captionFontSizes: captionLayers.map((l) => l.typography?.fontSize ?? 12),
    backgroundResourceIds: c.layers.filter((l) => l.kind === 'image' && l.resourceId && (l.role ?? 'prop') === 'background').map((l) => l.resourceId!),
    backgrounds: c.layers.filter((l) => l.kind === 'image' && l.resourceId && (l.role ?? 'prop') === 'background').map((l) => ({ layerId: l.id, resourceId: l.resourceId!, x: l.x, y: l.y, width: l.width, height: l.height, anchorX: l.anchorX ?? 0.5, anchorY: l.anchorY ?? 0.5 })),
    bundledBackgrounds: c.layers.filter((l) => l.kind === 'image' && l.resourceId && (l.role ?? 'prop') === 'background' && bundledPainted(l.resourceId!) && !l.sheet).map((l) => ({ layerId: l.id, resourceId: l.resourceId! })),
    actorCount: c.layers.filter((l) => l.kind === 'image' && l.role === 'actor').length,
    actorBoxes: c.layers.filter((l) => l.kind === 'image' && l.resourceId && l.role === 'actor').map((l) => ({ layerId: l.id, resourceId: l.resourceId!, x: l.x, y: l.y, width: l.width, height: l.height, bundledPainted: bundledPainted(l.resourceId!), ...(l.characterRole ? { characterRole: l.characterRole } : {}) })),
    lowOpacityCritical: c.layers.filter((l) => critical(l.id) && (l.opacity ?? 1) < 0.3).map((l) => l.id),
    statefulCritical: c.layers.filter((l) => critical(l.id) && (l.sheet || l.region?.mode === 'strip' || l.stateFrames)).map((l) => l.id),
  };
}

/** 프로젝트 하나의 오프닝을 한 번에 잰다. 반환된 issues 는 그대로 조수에게 보여 줄 수 있는 문장이다. */
export function measureOpeningAnimatic(project: Project): OpeningMeasurement {
  const shots = animaticShots(project).map((scene) => shotMeasurement(project, scene));
  const issues: string[] = [];
  const gridLabels = [...new Set(shots.map((s) => (s.grid ? `${s.grid.width}x${s.grid.height}` : 'no-grid')))];
  const captionColorSequence = shots.flatMap((s) => s.captionColors);
  const distinctCaptionColors = [...new Set(captionColorSequence)];
  const emoteShotIds = shots.filter((s) => s.emoteBox.length).map((s) => s.id);
  const transitionCounts: Record<string, number> = {};
  for (const scene of animaticShots(project)) {
    const kind = scene.composition.transition?.kind ?? 'none';
    transitionCounts[kind] = (transitionCounts[kind] ?? 0) + 1;
  }
  const lowestCaptionContrast = captionColorSequence.length
    ? Number(Math.min(...captionColorSequence.filter((color) => parseHex(color)).map((color) => contrastAgainst(color, '#000000')), Infinity).toFixed(2)) : 0;
  const distinctSpriteScales = [...new Set(shots.flatMap((s) => s.spriteScale.map((sp) => sp.scale)))];
  const backgroundUses = new Map<string, string[]>();
  for (const s of shots) for (const id of s.backgroundResourceIds) {
    const uses = backgroundUses.get(id) ?? []; uses.push(s.id); backgroundUses.set(id, uses);
  }
  for (const [resourceId, sceneIds] of backgroundUses) if (new Set(sceneIds).size > 1) {
    issues.push(`배경 ${resourceId}가 ${[...new Set(sceneIds)].join(', ')} 샷에서 재사용됩니다. 오프닝 전용 배경은 샷마다 새로 생성해야 합니다.`);
  }

  if (shots.length) {
    const divergent = shots.filter((s) => s.grid && (s.grid.width !== OPENING_STAGE.width || s.grid.height !== OPENING_STAGE.height));
    if (gridLabels.some((label) => label === 'no-grid') || divergent.length) {
      issues.push(`화면 격자가 샷마다 다릅니다(${gridLabels.join(', ')}). 오프닝의 모든 샷을 width:384, height:216 으로 만들고 set_opening_pixel_grid({shotId,width:384,height:216})을 부르세요 — 그래야 컷마다 도트가 같은 크기로 보입니다. 어긋난 샷: ${divergent.map((s) => s.id).join(', ') || '(격자 없음)'}.`);
    }
    for (const s of shots) {
      const composition = animaticShots(project).find((scene) => scene.id === s.id)!.composition;
      const shotCaptionColors = [...new Set(composition.layers.filter((layer) => layer.kind === 'caption').flatMap((layer) => (layer.caption?.cues ?? []).map((cue) => (cue.color ?? layer.color ?? '#fff0dc').toLowerCase())))];
      if (s.durationMs < OPENING_SHOT_MS.min || s.durationMs > OPENING_SHOT_MS.max) {
        issues.push(`${s.id}: 샷 길이 ${(s.durationMs / 1000).toFixed(1)}초. 6~10초로 맞추세요(짧으면 사건이 읽히지 않고 길면 정지 화면처럼 보입니다).`);
      }
      if (s.movingCount < OPENING_MIN_MOVING) {
        issues.push(`${s.id}: 실제로 움직이는 것이 ${s.movingCount}개(${s.moving.map((m) => `${m.id}:${m.what}`).join(', ') || '없음'})뿐입니다. 한 샷에 최소 ${OPENING_MIN_MOVING}개를 동시에 살리세요 — 지역 루프(물·구름·횃불), 빛줄기/발광 pulse, 입자, 걷는 배우, 카메라 이동을 겹칩니다.`);
      }
      if (s.planes.background === 0) issues.push(`${s.id}: role:background 레이어가 없습니다. 배경/중경/전경을 독립 레이어로 나눠야 카메라가 지나갈 때 시차가 생깁니다.`);
      if (s.planes.actor + s.planes.prop + s.planes.foreground === 0) issues.push(`${s.id}: 배경 위에 얹힌 독립 레이어(role:actor/prop/foreground)가 하나도 없습니다. 완성 그림 한 장 + 효과만으로는 연출이 아니라 그림입니다.`);
      if (!composition.layers.some((layer) => layer.kind === 'caption')) issues.push(`${s.id}: 자막 트랙이 없습니다. set_opening_caption으로 모든 픽셀 샷에 읽을 수 있는 캡션을 붙이세요.`);
      if (shotCaptionColors.length > 1) issues.push(`${s.id}: 한 샷 안에서 자막 색이 ${shotCaptionColors.length}개로 갑자기 바뀝니다. 기본 cream 한 색을 유지하고 강조는 오프닝 전체에서 한 번만 쓰세요.`);
      if (/title|logo|타이틀|로고/iu.test(s.id) && !composition.layers.some((layer) => layer.kind === 'text' || layer.role === 'foreground' || layer.role === 'prop')) {
        issues.push(`${s.id}: 픽셀 타이틀 로고 레이어가 없습니다. anti-aliased 기본 글자 대신 픽셀 로고 image/prop/text를 추가하세요.`);
      }
      if (/title|logo|타이틀|로고/iu.test(s.id)) {
        const titleText = project.system.titleScreen?.title?.trim();
        const titleLayer = composition.layers.find((layer) => layer.kind === 'text' && layer.text?.trim() === titleText);
        if (!titleText || !titleLayer) issues.push(`${s.id}: rendered title logo/text가 titleScreen.title과 일치하지 않습니다(${titleText ?? '(없음)'}).`);
        if (titleLayer) {
          const safeTop = composition.height * (composition.letterbox ?? 0);
          const safeBottom = composition.height - safeTop;
          if (titleLayer.y - titleLayer.height * (titleLayer.anchorY ?? 0) < safeTop || titleLayer.y + titleLayer.height * (1 - (titleLayer.anchorY ?? 0)) > safeBottom) {
            issues.push(`${s.id}: title logo/text가 active area 밖으로 잘립니다. 레터박스 ${Math.round(safeTop)}..${Math.round(safeBottom)} 안으로 옮기세요.`);
          }
        }
        if (project.system.titleScreen?.menuVisibility?.newGame === false) issues.push(`${s.id}: title screen New Game menu가 숨겨져 rendered menu gate를 통과할 수 없습니다.`);
        const bg = s.backgroundResourceIds[0] ?? '';
        if (!bg || /void|black|near.?black/iu.test(bg)) issues.push(`${s.id}: 타이틀 배경이 전용 밝기/구도 검수에 부적합합니다. near-black void를 배경으로 쓰지 마세요.`);
      }
      if (!s.hasCamera) issues.push(`${s.id}: 카메라 키가 없습니다. animate_opening_camera 로 하강·상승·팬 중 하나를 넣으세요(참조 도입부는 하늘에서 내려오는 하강과 성당 팬을 씁니다).`);
      for (const sp of s.spriteScale) {
        if (/^pixelart_/u.test(sp.resourceId)) {
          issues.push(`${s.id}/${sp.layerId}: author_pixel_art 로 찍은 커스텀 인물(${sp.resourceId}) 대신 번들 24×32 캐릭터 칩(easyrpg-charset-actor1~4, easyrpg-charset-people1~5 등)을 place_opening_charset_actor 로 놓으세요 — 막대인간이 되지 않고 배경과 도트 밀도가 맞습니다.`);
        }
        if (Math.abs(sp.scale - Math.round(sp.scale)) > 0.01) {
          const next = Math.max(1, Math.round(sp.scale));
          issues.push(`${s.id}/${sp.layerId}: ${sp.frameWidth}px 캐릭터 칩을 ${sp.drawnWidth}px 로 그려 배경과 도트 크기가 다릅니다. ${sp.frameWidth}의 정수배(${next}배 = ${sp.frameWidth * next}px)로 맞추세요(place_opening_charset_actor 의 scale 인자를 쓰면 자동입니다).`);
        }
      }
      // 레이어 x/y 는 «앵커 점»이다 — 배경을 x:0,y:0 + anchorX/Y:0.5 로 두면 무대의 한 사분면만 덮인다.
      // 실측(2026-10-16 run-3): 여섯 샷의 배경이 모두 좌상단 사분면만 칠해 나머지가 스테이지 배경색으로 남았다.
      for (const b of s.backgrounds) {
        const layer = composition.layers.find((candidate) => candidate.id === b.layerId);
        if ((layer?.opacity ?? 1) < 0.9) issues.push(`${s.id}/${b.layerId}: 배경 opacity ${(layer?.opacity ?? 1).toFixed(2)}가 0.90 미만입니다. 그림을 흐리게 하지 말고 팔레트/오버레이로 어둡게 만드세요.`);
        const left = b.x - b.width * b.anchorX, top = b.y - b.height * b.anchorY;
        if (left > 1.5 || top > 1.5 || left + b.width < OPENING_STAGE.width - 1.5 || top + b.height < OPENING_STAGE.height - 1.5) {
          const x = b.anchorX === 0 && b.anchorY === 0 ? Math.max(0, Math.round(-left)) : Math.round(OPENING_STAGE.width / 2);
          const y = b.anchorX === 0 && b.anchorY === 0 ? Math.max(0, Math.round(-top)) : Math.round(OPENING_STAGE.height / 2);
          issues.push(`${s.id}/${b.layerId}: 배경이 무대를 다 덮지 않습니다(그린 영역 x ${Math.round(left)}..${Math.round(left + b.width)}, y ${Math.round(top)}..${Math.round(top + b.height)} / 무대 ${OPENING_STAGE.width}×${OPENING_STAGE.height}). 레이어 x,y 는 «앵커 점»의 자리이고 기본 앵커는 0.5(중심)입니다 — place_opening_background({shotId, layerId, resourceId}) 로 깔면 anchorX/Y:0, x:0, y:0, width/height=무대 크기로 정확히 덮습니다(직접 upsert 한다면 x:${x}, y:${y}, width:${OPENING_STAGE.width}, height:${OPENING_STAGE.height}, anchorX:0, anchorY:0).`);
        }
      }
      const safeTop = s.grid ? Math.round(s.grid.height * (composition.letterbox ?? 0)) : 0;
      const safeBottom = s.grid ? s.grid.height - safeTop : composition.height;
      for (const actor of s.actorBoxes) {
        const layer = composition.layers.find((candidate) => candidate.id === actor.layerId);
        const left = actor.x - actor.width * (layer?.anchorX ?? 0);
        const top = actor.y - actor.height * (layer?.anchorY ?? 0);
        if (left < -OPENING_SAFE_MARGIN || left + actor.width > (s.grid?.width ?? composition.width) + OPENING_SAFE_MARGIN || top < safeTop - OPENING_SAFE_MARGIN || top + actor.height > safeBottom + OPENING_SAFE_MARGIN) {
          issues.push(`${s.id}/${actor.layerId}: 배우가 레터박스 안전영역 밖입니다(${Math.round(left)},${Math.round(top)} ${actor.width}×${actor.height}). ${safeTop}..${safeBottom} 안에 배치하세요.`);
        }
        const expected = /cathedral|hall|기사|knight/iu.test(s.id) ? 'knight' : /village|마을|villager/iu.test(s.id) ? 'villager' : /mage|마법/iu.test(s.id) ? 'mage' : /cliff|절벽|hero|주인공/iu.test(s.id) ? 'hero' : undefined;
        if (expected && actor.characterRole && actor.characterRole !== expected) issues.push(`${s.id}/${actor.layerId}: characterRole=${actor.characterRole}가 장면 역할 ${expected}와 맞지 않습니다.`);
        if (expected && !actor.characterRole) issues.push(`${s.id}/${actor.layerId}: 장면 역할 ${expected}를 characterRole에 명시하세요.`);
      }
      for (const id of s.lowOpacityCritical) issues.push(`${s.id}/${id}: 이야기 핵심 오브젝트 opacity가 0.30 미만입니다. 수정/눈/검은 낮추지 말고 픽셀 상태 변화로 보여 주세요.`);
      for (const layer of composition.layers) if (/crystal|수정|eye|눈|sword|검/iu.test(layer.id) && !s.statefulCritical.includes(layer.id)) {
        issues.push(`${s.id}/${layer.id}: 이야기 핵심 오브젝트에 2상태 픽셀 스프라이트가 없습니다. sprite sheet frame/strip 또는 stateFrames(normal/cracked, closed/open, sheathed/drawn)를 사용하세요.`);
      }
      // 배경 그림이 이미 인물을 그려 넣은 «화려한 일러스트» 면 도트 배우와 겹친다 — 배경은 빈 환경이어야 한다.
      for (const b of s.bundledBackgrounds) {
        if (s.actorCount > 0) issues.push(`${s.id}/${b.layerId}: 배경 ${b.resourceId} 는 이 오프닝을 위해 만든 도트 그림이 아니라 번들 스틸입니다. 그 위에 24×32 도트 배우 ${s.actorCount}명을 얹으면 화풍이 갈리고 배경 속 인물과 겹칩니다. 그 장소를 generate_opening_image(role:"backdrop", artStyle:"16-bit SNES JRPG pixel art, crisp pixel clusters, unified 32-color dark fantasy palette, empty environment only, no people or characters in background", cast:"nobody") 로 다시 만들어 그리드에 맞추거나, 배우를 빼고 스틸만 쓰세요.`);
      }
      if (s.emoteBox.length > 4) {
        issues.push(`${s.id}: 한 샷에 말풍선이 ${s.emoteBox.length}개 있습니다. NPC 군집 위 말풍선은 한 샷에 2~4개까지만 두세요.`);
      }
      for (const e of s.emoteBox) {
        if (e.width > OPENING_EMOTE_MAX || e.height > OPENING_EMOTE_MAX) {
          issues.push(`${s.id}/${e.layerId}: 말풍선 상자가 ${e.width}×${e.height}px 입니다. 격자 ${OPENING_STAGE.width}×${OPENING_STAGE.height} 에서 상한 ${OPENING_EMOTE_MAX}px 를 넘으면 만화 말풍선이 장면을 덮습니다. width:12, height:14 이하로 줄이세요.`);
        }
      }
      for (const size of s.captionFontSizes) {
        if (size < OPENING_CAPTION_FONT.min || size > OPENING_CAPTION_FONT.max) issues.push(`${s.id}: 자막 글자 ${size}px. 격자 픽셀 ${OPENING_CAPTION_FONT.min}~${OPENING_CAPTION_FONT.max} 로 맞추세요.`);
      }
    }
    if (distinctCaptionColors.length > OPENING_CAPTION_SWITCHES + 1) {
      issues.push(`자막 색이 ${distinctCaptionColors.length}가지(${distinctCaptionColors.join(', ')})로 바뀝니다. 오프닝 전체에서 색 전환은 ${OPENING_CAPTION_SWITCHES}번까지만 — 기본 한 색 + 이야기 강조 한두 번입니다. set_opening_caption 의 color/cue.color 를 같은 값으로 통일하세요.`);
    }
    const unreadable = distinctCaptionColors.filter((color) => !parseHex(color));
    if (unreadable.length) issues.push(`자막 색 ${unreadable.join(', ')} 은(는) 대비를 잴 수 없는 형식입니다. #rrggbb 로 지정하세요.`);
    if (lowestCaptionContrast && lowestCaptionContrast < 4.5) {
      issues.push(`자막 색 중 레터박스 검정 바와의 대비가 ${lowestCaptionContrast}:1 인 색이 있습니다(권장 4.5:1 이상). #f4f4f8 같은 밝은 색으로 바꾸세요.`);
    }
    if (emoteShotIds.length > 2) {
      issues.push(`말풍선이 ${emoteShotIds.length}개 샷(${emoteShotIds.join(', ')})에 나옵니다. 오프닝 전체에서 1~2개 샷에만 남기고 remove_opening_layer 로 지우세요 — 엄숙한 장면의 만화 말풍선은 분위기를 깹니다.`);
    }
    if (shots.length >= 4 && shots.some((s) => s.grid)) {
      if ((transitionCounts.dither ?? 0) < 2) issues.push(`dither 전환이 ${transitionCounts.dither ?? 0}개뿐입니다. 창을 여는 샷 최소 2개에 set_opening_transition({kind:'dither',durationMs:600})을 넣으세요.`);
      if ((transitionCounts.flash ?? 0) < 1) issues.push('flash 전환이 하나도 없습니다. 결정적 순간(검을 뽑거나 수정이 깨지는 샷)에 set_opening_transition({kind:"flash",durationMs:240,color:"#fff6d8"})을 쓰세요.');
      const kinds = Object.keys(transitionCounts).filter((k) => k !== 'none');
      if (kinds.length < 3) issues.push(`전환 종류가 ${kinds.length}가지(${kinds.join(', ')})뿐입니다. fade·dither·flash를 섞어 호흡을 만드세요.`);
    }
    for (const scene of animaticShots(project)) {
      if (scene.composition.layers.some((l) => l.walk)) {
        for (const layer of scene.composition.layers.filter((l) => l.walk)) {
          const travelled = Math.abs(sampleAnimaticTrack(layer.keys?.x, scene.durationMs, layer.x) - sampleAnimaticTrack(layer.keys?.x, layer.startMs ?? 0, layer.x)) * Math.abs(layer.scaleX ?? 1);
          const remainder = travelled / layer.walk!.stride - Math.round(travelled / layer.walk!.stride);
          if (Math.abs(remainder) > 0.3) issues.push(`${scene.id}/${layer.id}: 걷기가 보폭의 ${(Math.abs(remainder) * 100).toFixed(0)}% 지점에서 끝나 발이 반걸음에 멈춥니다. 이동 거리를 보폭의 배수로 맞추세요.`);
        }
      }
    }
  }
  const totalMs = (project.system.opening?.scenes ?? []).reduce((n, s) => n + (s.durationMs ?? 0), 0);
  return {
    shots, grid: shots[0]?.grid ?? null,
    distinctGrids: gridLabels, distinctSpriteScales,
    captionColorSequence, captionSwitches: Math.max(0, distinctCaptionColors.length - 1),
    lowestCaptionContrast, emoteShotIds, transitionCounts, totalMs, issues,
  };
}

/** 조수 보고용 한 줄 요약 — 수치를 그대로 보여 준다. */
export function openingMeasurementSummary(m: OpeningMeasurement): string {
  if (!m.shots.length) return '애니메틱 샷 없음.';
  const moving = m.shots.map((s) => `${s.id.slice(0, 12)}:${s.movingCount}`).join(' ');
  return `샷 ${m.shots.length}개 · 격자 ${m.distinctGrids.join('/')} · 샷당 움직임 ${moving} · 배우 배율 ${m.distinctSpriteScales.join('/') || '없음'} · 자막색 ${m.captionSwitches}전환(최저 대비 ${m.lowestCaptionContrast}:1) · 말풍선 샷 ${m.emoteShotIds.length} · 전환 ${Object.entries(m.transitionCounts).map(([k, v]) => `${k}x${v}`).join(' ')} · 문제 ${m.issues.length}건`;
}

/** 자막 문장 길이 대비 샷 길이 — 읽을 시간이 없으면 사건이 아니라 숙제가 된다. */
export function captionReadingIssues(project: Project): string[] {
  return animaticShots(project).flatMap((scene) => {
    const characters = animaticCaptionText(scene.composition).join('').length;
    const estimate = characters ? Math.ceil(1000 + characters / 6 * 1000) : 0;
    return estimate > scene.durationMs ? [`${scene.id}: 자막 ${characters}자를 ${scene.durationMs}ms 안에 읽어야 합니다(추정 ${estimate}ms).`] : [];
  });
}
