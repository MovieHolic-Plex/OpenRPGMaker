import { retimeOpeningAnimatic, validateOpeningAnimatic, animaticResourceIds, ANIMATIC_LIMITS, ANIMATIC_EMOTE_PRESETS, sampleAnimaticTrack, type AnimaticLayer, type AnimaticTracks, type OpeningAnimatic } from '@/project/openingAnimatic';
import type { CinematicScene, CinematicSequence, Project } from '@/project/types';
import { CINEMATIC_SCENE_LIMIT } from '@/project/cinematicSettings';
import { catalogLookup, hasOpeningImage } from './cinematicTools';
import { ToolError, type ToolDefinition, type JsonSchema, type ToolExecResult } from './types';
import { unsuitableOpeningStillMessage } from '@/assets/openingStillMoods';
import references from '@/assets/openingReferences.json';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { findCharsetAsset } from '@/assets/charsetCatalog';
import { CHARSET_CHARACTER_COUNT, CHARSET_FRAME_COUNT, CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, charsetFrameIndex, type CharsetDirection } from '@/assets/easyrpgRtp';
import { isTitleCardNarration } from '@/project/defaults/defaultOpeningSequence';
import { openingMapViewCrop, openingMapViewMapId, openingMapViewResourceId } from '@/project/openingMapView';
type Shot = Extract<CinematicScene, { kind: 'animatic' }>;
function text(v: unknown, label: string): string { if (typeof v !== 'string' || !v.trim()) throw new ToolError(label + ' 문자열이 필요합니다.', { code: 'invalid-args' }); return v.trim(); }
/**
 * 애니메틱 샷이 사는 두 트랙: opening(새 게임 뒤, 기본) · title-intro(게임을 켜면 타이틀 앞, system.titleIntro).
 * 샷 id 는 두 트랙에서 서로 겹치지 않게 만든다 — 그래서 레이어·카메라 도구는 트랙을 몰라도 샷 id 로 찾는다.
 */
export type AnimaticTrack = 'opening' | 'title-intro';
const TRACKS: readonly AnimaticTrack[] = ['opening', 'title-intro'];
const trackSchema: JsonSchema = { type: 'string', enum: ['opening', 'title-intro'], description: 'opening=새 게임 뒤(기본) · title-intro=게임을 켜면 타이틀 앞(전설 추격 인트로)' };
function trackArg(raw: unknown): AnimaticTrack {
  if (raw === undefined || raw === null || raw === '') return 'opening';
  if (raw !== 'opening' && raw !== 'title-intro') throw new ToolError('track 은 opening 또는 title-intro.', { code: 'invalid-args' });
  return raw;
}
function trackSequence(project: Project, track: AnimaticTrack): CinematicSequence | undefined {
  return track === 'title-intro' ? project.system.titleIntro : project.system.opening;
}
function setTrackSequence(project: Project, track: AnimaticTrack, sequence: CinematicSequence): void {
  if (track === 'title-intro') project.system.titleIntro = sequence; else project.system.opening = sequence;
}
function trackOfShot(project: Project, id: string): AnimaticTrack | undefined {
  return TRACKS.find(track => trackSequence(project, track)?.scenes.some(s => s.id === id));
}
function shot(project: Project, raw: unknown): Shot {
  const id = text(raw, 'shotId'), track = trackOfShot(project, id), s = track ? trackSequence(project, track)?.scenes.find(s => s.id === id) : undefined;
  if (!s || s.kind !== 'animatic') throw new ToolError('애니메틱 샷을 찾을 수 없습니다: ' + id, { code: 'scene-not-found' });
  return structuredClone(s);
}
function isBundledPaintedBackdrop(project: Project, id: string): boolean {
  const hasDedicatedOpeningStills = Object.keys(project.assets.uploaded).some(k => /^opening_still_[0-9a-f-]+$/iu.test(k));
  if (!hasDedicatedOpeningStills) return false;
  const asset = project.assets.uploaded[id];
  if (asset && /^opening_still_[0-9a-f-]+$/iu.test(id)) return false;
  if (asset?.generatedBy === 'pixel-art') return false;
  if (asset?.kind === 'backdrop' || asset?.kind === 'title') return true;
  return /^(oprn-still-|battle-scenery-|scarloxy|oga-|opengameart|tex_|easyrpg-|title_art_)/iu.test(id) || !asset;
}
function criticalObject(id: string): boolean { return /crystal|수정|eye|눈|sword|검/iu.test(id); }
function check(project: Project, s: Shot, enforceBackdrop = false): void {
  try { validateOpeningAnimatic(s.composition, s.durationMs); } catch (error) { throw new ToolError(String(error), { code: 'invalid-args' }); }
  const known = catalogLookup(project);
  for (const l of s.composition.layers) {
    if (l.kind === 'image' && !hasOpeningImage(project, l.resourceId!)) throw new ToolError('그림 리소스 없음: ' + l.resourceId, { code: 'resource-not-found' });
    if (l.kind === 'image' && l.role === 'background') {
      const banned = unsuitableOpeningStillMessage(l.resourceId!, `배경 ${l.id}`);
      if (banned) throw new ToolError(banned, { code: 'opening-composition-invalid' });
      if ((l.opacity ?? 1) < 0.9) throw new ToolError(`배경 ${l.id}의 opacity가 ${(l.opacity ?? 1).toFixed(2)}로 너무 낮습니다. 팔레트/오버레이로 어둡게 하세요.`, { code: 'opening-composition-invalid' });
      const hasIndependentSubjects = s.composition.layers.some(candidate => candidate.role === 'actor' || candidate.role === 'prop' || candidate.role === 'foreground');
      if (enforceBackdrop && hasIndependentSubjects && isBundledPaintedBackdrop(project, l.resourceId!)) throw new ToolError(`번들 스틸 ${l.resourceId}를 오프닝 배경으로 쓸 수 없습니다. 이미지 생성이 실패했다면 조용히 대체하지 말고 중단·보고하세요.`, { code: 'dedicated-backdrop-required' });
    }
    if (l.kind === 'image' && l.role === 'effect' && l.sheet && Math.abs(l.width / l.sheet.frameWidth - Math.round(l.width / l.sheet.frameWidth)) > 0.01) {
      throw new ToolError(`효과 스트립 ${l.id}는 정수배로만 확대해야 합니다(${l.width}/${l.sheet.frameWidth}).`, { code: 'effect-scale-not-integer' });
    }
    if (criticalObject(l.id) && l.role !== 'effect' && ((l.kind === 'shape') || (l.kind === 'image' && (l.opacity ?? 1) < 0.3))) {
      throw new ToolError(`이야기 핵심 오브젝트 ${l.id}는 평면 도형/저불투명도로 만들 수 없습니다. 2상태 픽셀 스프라이트(sheet/strip + frame 키)를 사용하세요.`, { code: 'critical-pixel-sprite-required' });
    }
    if (l.kind === 'image' && l.role === 'actor') {
      const top = l.y - l.height * (l.anchorY ?? 0);
      const bottom = top + l.height;
      const safe = s.composition.height * (s.composition.letterbox ?? 0);
      if (top < safe - 1 || bottom > s.composition.height - safe + 1) throw new ToolError(`배우 ${l.id}가 레터박스 안전영역을 벗어났습니다. y=${Math.round(top)}..${Math.round(bottom)}, 안전영역=${Math.round(safe)}..${Math.round(s.composition.height - safe)}.`, { code: 'opening-safe-area' });
    }
  }
  for (const c of s.composition.audioCues ?? []) if (!known('sound', c.resourceId) && !known('music', c.resourceId)) throw new ToolError('오디오 리소스 없음: ' + c.resourceId, { code: 'resource-not-found' });
}
// 같은 그림을 두 컷에 깔면 같은 화면이 반복된다. 맵 그대로(map-view:<mapId>)는 맵의 다른 곳을 오려 쓰므로
// «그림 + 오려 낸 자리»가 같을 때만 재사용으로 본다(한 거리의 정문·가게 앞은 다른 장면이다).
function backdropKey(l: { resourceId?: string; crop?: { x: number; y: number; width: number; height: number } }): string {
  const id = l.resourceId!;
  if (!openingMapViewMapId(id)) return id;
  const c = l.crop;
  return c ? `${id}@${Math.round(c.x / 32)},${Math.round(c.y / 32)}` : id;
}
function backdropConflict(project: Project, s: Shot): string | null {
  const keys = s.composition.layers.filter(l => l.kind === 'image' && l.role === 'background').map(backdropKey);
  for (const other of trackSequence(project, trackOfShot(project, s.id) ?? 'opening')?.scenes ?? []) {
    if (other.kind !== 'animatic' || other.id === s.id) continue;
    if (other.composition.layers.some(l => l.kind === 'image' && l.role === 'background' && keys.includes(backdropKey(l)))) return other.id;
  }
  return null;
}
function commit(project: Project, s: Shot, summary: string, touchesBackdrop = false): ToolExecResult {
  if (touchesBackdrop) {
    const conflict = backdropConflict(project, s);
    if (conflict) throw new ToolError(`오프닝 배경이 다른 샷 ${conflict}와 재사용됩니다. 현재 샷의 배경을 새 리소스로 바꾸세요.`, { code: 'dedicated-backdrop-required' });
  }
  check(project, s, touchesBackdrop); const opening = trackSequence(project, trackOfShot(project, s.id) ?? 'opening')!;
  opening.scenes[opening.scenes.findIndex(row => row.id === s.id)] = s;
  return { summary, data: { shotId: s.id, durationMs: s.durationMs, layers: s.composition.layers.length, resourceIds: animaticResourceIds(s.composition) } };
}
const str: JsonSchema = { type: 'string' }, obj: JsonSchema = { type: 'object' }, integer: JsonSchema = { type: 'integer' };
const num: JsonSchema = { type: 'number' }, bool: JsonSchema = { type: 'boolean' };
const schema = (props: Record<string, JsonSchema>, required: string[] = Object.keys(props)): JsonSchema => ({ type: 'object', additionalProperties: false, properties: props, required });
const definition = (name: string, description: string, mode: 'read' | 'write', parameters: JsonSchema, run: ToolDefinition['run']): ToolDefinition => ({ name, description, mode, parameters, run });
const regionSchema: JsonSchema = { type: 'object', additionalProperties: false, properties: { x: integer, y: integer, width: integer, height: integer, mode: { type: 'string', enum: ['scroll-x', 'scroll-y', 'palette-cycle', 'strip'] }, pixels: integer, everyTicks: integer, tickMs: integer, wrap: bool, colors: { type: 'array', items: str, minItems: 2, maxItems: 8 }, frames: { type: 'object', additionalProperties: false, properties: { frameWidth: integer, frameHeight: integer, count: integer, fps: num } } } };
const pulseSchema: JsonSchema = { type: 'object', additionalProperties: false, properties: { hz: num, amount: num, pattern: { type: 'string', enum: ['pulse', 'flicker'] }, seed: integer } };
const cueSchema: JsonSchema = { type: 'object', additionalProperties: false, properties: { atMs: integer, text: { type: 'string', minLength: 1, maxLength: 200 }, color: str, typewriterMs: integer } };
/**
 * 모델은 선택 칸을 다 채워 보낸다 — 지금 모드에서 뜻이 없는 칸은 버리고 저장한다.
 * 실측(2026-10-16 run-4): palette-cycle 에 pixels 를 실어 보내 «scroll modes only» 로 거부됐다.
 * 진짜 잘못(모드가 없거나 scroll 인데 pixels 가 없음)은 그대로 거부한다.
 */
function cleanRegion(r: AnimaticLayer['region']): AnimaticLayer['region'] {
  if (!r) return r;
  const out = { ...r };
  const scroll = out.mode === 'scroll-x' || out.mode === 'scroll-y';
  if (!scroll) { delete out.pixels; delete out.wrap; }
  if (out.mode !== 'palette-cycle') delete out.colors;
  if (out.mode !== 'strip') delete out.frames;
  return out;
}

const regionOf = (s: Shot, layerId: unknown): AnimaticLayer => {
  const id = text(layerId, 'layerId'), l = s.composition.layers.find(l => l.id === id);
  if (!l) throw new ToolError('layerId 없음: ' + id + '. upsert_opening_layer로 그림 레이어를 먼저 만드세요.', { code: 'layer-not-found' });
  return l;
};
const imageLayerOf = (s: Shot, layerId: unknown): AnimaticLayer => {
  const l = regionOf(s, layerId);
  if (l.kind !== 'image') throw new ToolError(`레이어 ${l.id}는 ${l.kind}입니다. 그림 레이어(kind:"image")에만 붙일 수 있습니다.`, { code: 'invalid-args' });
  return l;
};

/** 업로드 자산의 실제 가로·세로: dataUrl 의 PNG 헤더를 먼저 보고, 없으면 등록된 meta 치수를 쓴다. 모르면 null. */
function uploadedImageSize(asset: Project['assets']['uploaded'][string]): { width: number; height: number } | null {
  const url = asset.dataUrl ?? '';
  if (url.startsWith('data:image/png')) {
    try {
      const head = atob(url.slice(url.indexOf(',') + 1, url.indexOf(',') + 1 + 64).replace(/[^A-Za-z0-9+/]/g, '').slice(0, 60));
      const bytes = Uint8Array.from(head, ch => ch.charCodeAt(0));
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
      if (png && bytes.length >= 24) { const view = new DataView(bytes.buffer); return { width: view.getUint32(16), height: view.getUint32(20) }; }
    } catch { /* fall through to meta */ }
  }
  const { width, height } = asset.meta ?? {};
  return typeof width === 'number' && typeof height === 'number' ? { width, height } : null;
}
const CHARSET_DIRECTIONS_ALLOWED = ['down', 'left', 'right', 'up'] as const;
/** 번들·업로드 캐릭터 칩인지 실제 URL·종류로 확인한다 — 아무 그림이나 24×32 격자로 잘라 쓰면 안 된다. */
function charsetFrameWidth(project: Project, resourceId: string): number | null {
  const uploaded = project.assets.uploaded[resourceId];
  if (uploaded?.kind === 'charset') {
    // 24×32 칸 12열 8행(288×256) 시트만 — 다른 크기를 이 격자로 자르면 재생 때 프레임 범위 오류가 난다.
    const size = uploadedImageSize(uploaded);
    if (size) return size.width === 288 && size.height === 256 ? CHARSET_FRAME_WIDTH : null;
    // 내용 주소 참조(ref)만 있고 치수를 모르는 자산은 업로드 파이프라인이 등록한 것으로 보고 통과 — 재생기가 마지막에 범위를 검사한다.
    return uploaded.ref ? CHARSET_FRAME_WIDTH : null;
  }
  if (findCharsetAsset(resourceId)) return CHARSET_FRAME_WIDTH;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return null;
  if (/\/assets\/(?:easyrpg|wizarding|heroes-charsets|modern-charsets|scarloxy|oprn-monster-charsets|farming)\/.*\.png(?:[?#]|$)/iu.test(url)) return CHARSET_FRAME_WIDTH;
  return null;
}

/**
 * 배우를 «막대인간»으로 그리지 않게 한다: 번들 24×32 캐릭터 칩을 그대로 놓고 캐릭터 번호·방향·정수배율·보폭 걷기를 한 번에 붙인다.
 * 칩의 걷기 프레임은 charsetFrameIndex 로 계산하므로 조수가 프레임 번호를 셀 필요가 없다.
 */
function resolveOpeningCharsetForGenre(project: Project, rawResourceId: string): string {
  const normalized = rawResourceId.trim().replace(/^tex_oprn_charset_/iu, 'oprn-charset-').replace(/^tex_easyrpg_charset_/iu, 'easyrpg-charset-');
  if (/^(?:pixelart_|charset_)/iu.test(normalized)) {
    throw new ToolError(`author_pixel_art 로 찍은 커스텀 인물(${rawResourceId})은 오프닝 배우로 쓸 수 없습니다(막대인간 금지). 번들 24×32 캐릭터 칩(현대·연애: oprn-charset-modern1~3, 판타지: oprn-charset-heroes1, easyrpg-charset-actor1~4, easyrpg-charset-people1~5)을 지정하세요.`, { code: 'custom-stick-actor-forbidden' });
  }
  const isModernOrRomance = project.system?.genreLock?.preset === 'romance'
    || project.gameDesignBrief?.interview?.genre === 'romance'
    || (project.system as { genre?: string } | undefined)?.genre === 'modern';
  if (isModernOrRomance && /^easyrpg-charset-/iu.test(normalized)) {
    throw new ToolError(`현대·연애 오프닝에 중세 캐릭터 칩(${rawResourceId})은 사용할 수 없습니다(폴백 금지). oprn-charset-modern1~3 또는 create_character(char-gen)로 생성한 캐릭터 칩을 지정하세요.`, { code: 'genre-charset-forbidden' });
  }
  return normalized;
}

function charsetActorLayer(project: Project, s: Shot, args: Record<string, unknown>): AnimaticLayer {
  const rawId = text(args.charsetResourceId ?? args.resourceId ?? args.characterResourceId, 'charsetResourceId');
  const colonMatch = /^(.+):([0-7])$/u.exec(rawId);
  const resourceId = resolveOpeningCharsetForGenre(project, colonMatch ? colonMatch[1]! : rawId);
  if (charsetFrameWidth(project, resourceId) === null) throw new ToolError(`캐릭터 칩이 아닙니다: ${resourceId}. list_resources(kind:"charset") 또는 list_opening_media 로 번들 캐릭터 칩(oprn-charset-heroes1, easyrpg-charset-actor1 등)을 찾아 쓰세요.`, { code: 'resource-not-found' });
  const characterIndex = Number(args.characterIndex ?? (colonMatch ? Number(colonMatch[2]) : 0));
  if (!Number.isSafeInteger(characterIndex) || characterIndex < 0 || characterIndex >= CHARSET_CHARACTER_COUNT) throw new ToolError(`characterIndex 는 0..${CHARSET_CHARACTER_COUNT - 1} 입니다.`, { code: 'invalid-args' });
  const direction = String(args.direction ?? 'right') as CharsetDirection;
  if (!(CHARSET_DIRECTIONS_ALLOWED as readonly string[]).includes(direction)) throw new ToolError('direction 은 down/left/right/up 입니다.', { code: 'invalid-args' });
  const scale = Number(args.scale ?? 1);
  if (!Number.isSafeInteger(scale) || scale < 1 || scale > 8) throw new ToolError('scale 은 1..8 정수입니다(칩 24px의 정수배여야 배경과 도트 크기가 같습니다).', { code: 'invalid-args' });
  const stride = Number(args.stride ?? 8 * scale);
  if (!Number.isSafeInteger(stride) || stride < 1) throw new ToolError('stride 는 1 이상 정수(한 걸음에 이동하는 격자 픽셀)입니다.', { code: 'invalid-args' });
  const walkFrames = [0, 1, 2, 1].map(pattern => charsetFrameIndex({ characterIndex, direction, pattern })).filter(frame => frame < CHARSET_FRAME_COUNT);
  const holdFrame = charsetFrameIndex({ characterIndex, direction, pattern: 1 });
  const actorH = CHARSET_FRAME_HEIGHT * scale;
  const safe = Math.ceil(s.composition.height * (s.composition.letterbox ?? 0.15));
  const maxSafeY = Math.max(safe, Math.floor(s.composition.height - safe - actorH));
  const clampY = (yVal: number): number => Math.max(safe, Math.min(maxSafeY, Math.round(yVal)));
  const fromX = Math.round(args.fromX === undefined ? Number(args.x) : Number(args.fromX));
  const fromY = clampY(args.fromY === undefined ? Number(args.y) : Number(args.fromY));
  const start = Math.max(0, Math.min(s.durationMs - 100, Math.round(Number(args.startMs ?? 0))));
  const rawDuration = args.durationMs === undefined ? (s.durationMs - start) : Number(args.durationMs);
  const duration = Math.max(100, Math.min(s.durationMs - start, Math.round(rawDuration)));
  const snapStride = (from: number, to: number): number => {
    const diff = to - from;
    if (diff === 0) return to;
    const steps = Math.max(1, Math.round(Math.abs(diff) / stride));
    return from + Math.sign(diff) * steps * stride;
  };
  const keysX = args.toX === undefined ? undefined : (() => {
    const toX = snapStride(fromX, Math.round(Number(args.toX)));
    if (Math.abs(toX - fromX) / stride > ANIMATIC_LIMITS.keysPerTrack) throw new ToolError('이동 거리에 비해 보폭이 작아 걸음이 너무 많습니다. stride 를 키우거나 이동을 줄이세요.', { code: 'invalid-args' });
    return [{ atMs: start, value: fromX }, { atMs: Math.round(start + duration), value: toX }];
  })();
  const keysY = args.toY === undefined ? undefined : (() => {
    const toY = clampY(snapStride(fromY, Math.round(Number(args.toY))));
    if (Math.abs(toY - fromY) / stride > ANIMATIC_LIMITS.keysPerTrack) throw new ToolError('이동 거리에 비해 보폭이 작아 걸음이 너무 많습니다. stride 를 키우거나 이동을 줄이세요.', { code: 'invalid-args' });
    return [{ atMs: start, value: fromY }, { atMs: Math.round(start + duration), value: toY }];
  })();
  const combinedKeys = (keysX || keysY) ? { ...(keysX ? { x: keysX } : {}), ...(keysY ? { y: keysY } : {}) } : undefined;
  const defaultRole: AnimaticLayer['characterRole'] = /cathedral|hall|기사|knight/iu.test(s.id) ? 'knight'
    : /village|마을|villager/iu.test(s.id) ? 'villager'
    : /mage|wizard|마법|현자/iu.test(s.id) ? 'mage' : 'hero';
  return {
    id: String(args.layerId), kind: 'image', role: 'actor', resourceId, x: fromX, y: fromY,
    width: CHARSET_FRAME_WIDTH * scale, height: actorH, sampling: 'nearest',
    characterRole: (args.characterRole as AnimaticLayer['characterRole'] | undefined) ?? defaultRole,
    sheet: { frameWidth: CHARSET_FRAME_WIDTH, frameHeight: CHARSET_FRAME_HEIGHT, columns: CHARSET_SHEET_COLUMNS, count: CHARSET_FRAME_COUNT, fps: 0 },
    walk: { stride, frames: walkFrames, holdFrame },
    ...(combinedKeys ? { keys: combinedKeys } : {}),
  };
}

export const OPENING_ANIMATIC_TOOLS: readonly ToolDefinition[] = [
  definition('get_animatic_capabilities', '시간축·레이어·카메라·큐 계약과 예시 조회.', 'read', schema({}), () => ({ summary: '애니메틱은 실제 시간 기반2D 합성입니다.', data: {
    coordinates: 'stage px, anchors0..1, rotation degrees; all times shot-local milliseconds', limits: ANIMATIC_LIMITS,
    easing: 'linear/ease-in/ease-out/ease-in-out/step; ease belongs to destination key; hold endpoint values outside range',
    layer: { required: 'id,kind,x,y,width,height', kinds: 'image/text/shape/particles/shaft/glow/emote/caption', order: 'array back-to-front (caption overlays compose last, above the letterbox board)',
      anchors: 'x,y is the position of the ANCHOR POINT, not the top-left corner. Default anchor is 0.5,0.5 = center, so a 384×216 background at x:0,y:0 covers only the top-left quadrant. For a full-stage background use place_opening_background (anchorX/Y:0, x:0, y:0, width/height = stage) or set anchorX:0, anchorY:0 explicitly.',
      optional: 'role(background/actor/foreground/prop/effect/credit), resourceId(image), text(text), color, shape(rect/ellipse/line), anchorX/Y, scaleX/Y(negative mirrors), rotation,opacity,startMs,endMs,space(world/screen),parallax(0..2),blend(source-over/lighter/screen/multiply)',
      keys: '{x/y/scaleX/scaleY/rotation/opacity/frame:[{atMs,value,ease?}]}',
      sampling: 'nearest/linear; sheets default nearest, other images default linear', crop: '{x,y,width,height} source pixels', sheet: '{frameWidth,frameHeight,columns,count,fps,loop?}; frame keys select poses; crop and sheet exclusive',
      typography: '{fontSize?,weight?,align:left/center/right,typewriterMs?}', particles: '{preset:rain/snow/sparks/dust/stars/petals/paper/meteors,count,seed,speed?,size?}; meteors = shooting stars that streak down-left across the box with a fading tail (speed = streak px/s, default 260; count 3..8 reads as an occasional meteor shower); petals = cherry-blossom petals drifting down and sideways (colour = petal pink), paper = fluttering paper sheets (colour = white)',
      tint: 'image-only {color, amount?(0..1, default 1)}: recolours the opaque pixels, alpha kept. amount 1 = solid silhouette (a legendary monster crossing the moon, a shadow sliding over the grass), 0.3..0.6 = night/sunset wash on one sprite',
      region: 'image-only masked loop: {x,y,width,height,mode:scroll-x/scroll-y/palette-cycle/strip,pixels?,everyTicks?,tickMs?,wrap?,colors?,frames?}; layer-local pixels, so with no crop they are source-image pixels; only that window animates',
      shaft: 'kind:shaft: {spread(0..0.95),softness(0..1),dust:{count,seed,speed?,size?},pulse}; angled beam drawn as dithered pixel cells, dust only inside the beam mask',
      glow: 'kind:glow: {inner(0..0.95),pulse}; radial light in the layer box',
      emote: 'kind:emote: {preset:exclaim/question/ellipsis/heart/sweat,tail:down/none,popMs?,outMs?}; procedural pixel bubble, no external image; box size is in stage px like every other layer',
      caption: 'kind:caption: {cues:[{atMs,text,color?,typewriterMs?}],safeArea?,fadeOutMs?}; bottom bar captions',
      walk: 'image+sheet only: {stride,frames[],holdFrame?,phase?}; the pose advances with travelled x, so feet do not slide',
      type: 'text/caption font sizes are measured in GRID pixels when the shot has a pixelGrid (no grid: stage pixels). Recommend authoring the shot at width/height == pixelGrid size (e.g. 384×216) so every number in the shot is already a grid pixel.',
      pulse: '{hz(0.05..20),amount(0..1),pattern:pulse/flicker,seed}; seeded, pure function of time' },
    composition: 'width,height,layers; background?,letterbox(0..0.25)?, pixelGrid?, camera?, transition?, audioCues?',
    pixelGrid: '{width,height} stage integer resolution (e.g.384×216, must fit the stage). The shot rasterises there and upscales by the largest integer factor, letterboxed; layer/camera coordinates, image sizes and letterbox bars snap to it so sprites, backgrounds and particles share ONE pixel size. Omit for the classic smooth stage; pre-existing animatics are unchanged. Use it with set_opening_pixel_grid.',
    captionTrack: 'set_opening_caption places the line inside the letterbox band when letterbox is set (reference framing), otherwise safeArea above the bottom edge. Typewriter timing reuses typography.typewriterMs; a cue colour overrides the layer colour; only the last cue fades out, ending at the layer/shot end. Reading time counts these characters.',
    camera: '{x?,y?,zoom?,rotation?,keys:{x/y/zoom/rotation:[{atMs,value,ease?}]},shake:{atMs,durationMs,amplitude,frequency?,seed?}}',
    transition: '{kind:cut/fade/wipe-left/wipe-right/iris/flash/dither,durationMs,color?}; reveals from the stage background at shot entry, never a cross-dissolve of the previous shot. dither = ordered 4×4 Bayer dissolve from the background (pixel-art vocabulary); cross-dissolve is still not offered — the earlier shot is disposed, not blended.',
    audio: '{id,resourceId,atMs,durationMs,volume(0..1)?,fadeInMs?,fadeOutMs?,offsetMs?,loop?}; separate timed cues; sequence music remains uninterrupted',
    entry: 'configure_opening_entry chooses where the opening track plays: new-game(default), before-title(first cold title visit; input dismisses), attract(title idle with repeat; any key dismisses without activating menu).',
    tracks: 'Two separate tracks can coexist. track:"opening" (default) plays after New Game (e.g. the professor introduction). track:"title-intro" (system.titleIntro) plays when the game boots, BEFORE the title screen (e.g. a Pokémon-style legend-chase cold open: shooting stars → a legendary silhouette crosses the sky → starters look up → logo slam); any key skips to the title. Create its shots with create_opening_animatic_shot({track:"title-intro",…}); every layer/camera/audio tool then finds the shot by its id. configure_opening_entry({track:"title-intro", mode:"attract", idleMs}) also replays it as the title idle demo. Shot ids must be unique across both tracks.',
    playback: 'loading completes before clock starts; Skip/abort removes frame loop and all cues; reduced motion freezes camera/shake, region loops, dust, glow pulse, sprite walk and dither reveal, keeps narration/caption/emote timing',
    preview: 'preview_opening_animatic returns real canvas frames to Pi; images inspect composition/time, native playback separately proves audio/Skip/handoff',
      tools: 'place_opening_background, set_opening_pixel_grid, set_opening_region_loop, upsert_opening_light_fx, upsert_opening_emote, set_opening_caption, apply_opening_walk, place_opening_charset_actor, set_opening_sprite_states, plus up to date with new primitives: upsert_opening_layer, animate_opening_layer, animate_opening_camera, set_opening_transition, upsert_opening_audio_cue',
    example: { id: 'actor', kind: 'image', resourceId: 'actual_project_png', x: 500, y: 500, width: 180, height: 180, anchorX: 0.5, anchorY: 1, keys: { x: [{ atMs: 0, value: 350 }, { atMs: 3000, value: 650, ease: 'ease-in-out' }] } },
    examples: {
      pixelGrid: { stage: 'set_opening_pixel_grid({shotId,width:384,height:216}) — 384×216 도트 무대, 정수배 확대', width: 384, height: 216, background: { tool: 'place_opening_background', args: { shotId: 'village', layerId: 'bg', resourceId: 'opening_still_…' }, note: 'x:0,y:0,width:384,height:216,anchorX/Y:0 로 정확히 덮는다' }, layer: { id: 'hero', kind: 'image', resourceId: 'easyrpg-charset-actor1', x: 72, y: 140, width: 24, height: 32, sampling: 'nearest' } },
      charsetActor: { tool: 'place_opening_charset_actor', args: { shotId: 'village', layerId: 'villager_1', charsetResourceId: 'easyrpg-charset-people1', characterIndex: 0, direction: 'up', scale: 1, x: 140, y: 132, fromX: 104, toX: 176, durationMs: 6500, stride: 8 } },
      regionLoop: { tool: 'set_opening_region_loop', args: { shotId: 'village', layerId: 'fountain', region: { x: 176, y: 112, width: 32, height: 28, mode: 'palette-cycle', colors: ['#5cb8ff', '#9be2ff', '#ffffff'], everyTicks: 6, tickMs: 16 } } },
      lightFx: { tool: 'upsert_opening_light_fx', args: { shotId: 'hall', layerId: 'window-beam', kind: 'shaft', x: 140, y: 24, width: 64, height: 140, rotation: 24, color: '#ffe9b0', spread: 0.7, softness: 0.8, dust: { count: 26, seed: 11, speed: 22, size: 1 }, pulse: { hz: 0.7, amount: 0.25, pattern: 'pulse', seed: 5 } } },
      glow: { tool: 'upsert_opening_light_fx', args: { shotId: 'cavern', layerId: 'crystal-glow', kind: 'glow', x: 110, y: 54, width: 96, height: 96, color: '#ffd479', inner: 0.2, pulse: { hz: 0.6, amount: 0.35, seed: 3 } } },
      emote: { tool: 'upsert_opening_emote', args: { shotId: 'village', layerId: 'npc1_emote', preset: 'ellipsis', targetLayerId: 'villager_1', width: 12, height: 14, startMs: 3200, endMs: 6800, popMs: 160, outMs: 160 } },
      caption: { tool: 'set_opening_caption', args: { shotId: 'village', layerId: 'line', letterbox: 0.14, color: '#fff0dc', cues: [{ atMs: 400, text: '새벽의 수정이 빛을 잃어 가던 어느 봄 —', typewriterMs: 900 }] } },
      walk: { tool: 'apply_opening_walk', args: { shotId: 'road', layerId: 'hero', stride: 9, frames: [0, 1, 2, 1], holdFrame: 1, fromX: 20, toX: 200, atMs: 0, durationMs: 3000 } }
    },
    boundaries: '2D animatic, sprite loops and registered video supported. No skeletal animation, 3D actor rig, automatic pose invention or synthetic voice promised.',
    pixelOpening: {
      what: '새 게임 오프닝을 정수 픽셀 무대(384×216) 위의 다층 레이어 샷 목록으로 만드는 법. 정지 그림 한 장 + 효과 하나가 아니라, 한 샷 안에서 배경·전경·군중/배우·지역 루프·카메라 하강/팬이 동시에 살아 움직인다.',
      stage: '모든 샷을 width:384, height:216 으로 만들고 set_opening_pixel_grid({shotId,width:384,height:216})을 부른다. 배경은 place_opening_background({shotId, layerId, resourceId}) 로 깐다 — 레이어 x,y 는 «앵커 점»의 자리이고 기본 앵커가 0.5(중심)라, 직접 upsert 하면서 x:0,y:0 만 넣으면 무대의 한 사분면만 덮인다(2026-10-16 run-3 실측: 여섯 샷 배경이 모두 좌상단 사분면만 칠해졌다). 레터박스는 letterbox:0.15(216의 32px — 참조 도입부 KNIGHT OF LUMERIA 실측 32/216), 가시 영역 y:32..184. 샷 길이는 반드시 6000~9500ms(6~9.5초)로 맞춘다.',
      shots: '샷 목록은 7~8개(총 52~64초): (1) 밤하늘·성좌에서 수정 왕국 전경으로 카메라 하강(하늘/구름 레이어 + 빛기둥 + 카메라 y 하강), (2) 대성당 제단과 스테인드글라스 아래 진홍 기사단 대열(place_opening_charset_actor로 기사 5~7명을 2열 대열로 배치 + 대장 전진 보행 + 대각 빛줄기 shaft 2개 + 제단 glow), (3) 지하 동굴의 황금 수호 수정과 오른편에서 눈을 뜨는 거대한 마젠타 타락의 눈(독립 전경 레이어 role:foreground로 마젠타 눈/덩굴을 얹어 opacity/scale 키로 서서히 깨어나게 연출 + 수정 glow + 마젠타 입자), (4) 분수대가 있는 새벽의 평화로운 마을 광장(분수 수면 region palette-cycle + place_opening_charset_actor로 주민 5~6명 광장 배치 및 산책 + 주민 머리 위 12×14 소형 말풍선 2~3개만), (5) 노을빛 들판 길을 걷는 주인공과 절벽 위 검 발광(하늘·언덕·길 시차 레이어 + 주인공 보행 + 절벽 끝에서 검을 치켜들고 빛기둥/번개 flash), (6) 다크 크림슨 배경 위 황금 검 문장과 타이틀 로고 충격파(상단 y:18..46 문장 소품 + 중앙 제목/부제 텍스트 + 황금 입자 + 발광 고리). 마지막 로고 샷 뒤에 여분 맵 전환 샷을 만들지 않는다.',
      backgroundDiscipline: '배경은 place_opening_background({shotId, layerId, resourceId}) 로 깐다(x,y 는 «앵커 점»의 자리라 손으로 0,0 을 넣으면 중심 앵커 때문에 사분면만 덮인다). 배경 그림은 반드시 generate_opening_image(role:"backdrop") 로 이 오프닝 전용으로 만들고 프롬프트에 "16-bit SNES JRPG pixel art, crisp pixel clusters, unified 32-color dark fantasy palette, empty environment only, no people or characters in background"와 cast:"nobody"를 넣는다 — 번들 스틸(oprn-still-*, battle-scenery-*, title_art_*)은 인물이 그려진 부드러운 일러스트라 도트 배우와 화풍이 갈리고 배경 인물과 겹친다.',
      regionDiscipline: '⚠️ 절대 384×216 전체 배경(width>=300, height>=150)에 scroll-x나 scroll-y를 걸지 마라. scroll-x는 반드시 상단 하늘/구름 띠(예: x:0, y:28, width:384, height:44)에만 걸고, 마을 분수대·수호 수정·스테인드글라스에는 작은 영역(예: width:28..48, height:24..40) palette-cycle을 써라. 전체 화면 하강/패닝은 animate_opening_camera(예: y: 98 -> 114 또는 zoom: 1.04 -> 1.14)로 연출한다.',
      spriteDiscipline: '⚠️ 인물·기사·주민·주인공을 author_pixel_art로 찍지 마라(막대인간 금지!). 인물은 반드시 번들 24×32 캐릭터 칩(현대·연애·학원·오피스는 oprn-charset-modern1~3, 중세·판타지 JRPG는 oprn-charset-heroes1, easyrpg-charset-actor1~4, easyrpg-charset-people1~5)을 place_opening_charset_actor로 놓아라(scale:1 = 24×32, 정밀한 16-bit JRPG 도트 + 자동 보폭 걷기). 성당에서는 기사 5~7명을 대열로 놓고, 마을 광장에서는 분수대 둘레에 주민 5~6명을 놓아 살아 있는 광장을 만든다. author_pixel_art(kind:"picture")는 타이틀 검 문장이나 마젠타 눈/수정 코어 같은 비인물 소품에만 쓴다. 인물은 배경 그림 안이 아니라 배경 위에 독립 레이어로 놓는다.',
      primitives: '샷마다 최소 3개 이상의 독립 움직임(region 루프 + shaft/glow pulse + particles + place_opening_charset_actor 보행 + animate_opening_camera)을 겹쳐라. 말풍선(upsert_opening_emote)은 width:12, height:14 소형으로 마을 광장(주민 2~3명: ellipsis/question/exclaim)과 절벽(주인공: exclaim 1개)에만 쓰고 성당이나 수정 동굴에는 절대 쓰지 마라.',
      captionDiscipline: '자막(set_opening_caption)은 모든 샷에서 letterbox:0.15 하단 검정 바 안에 한 줄씩 타이프라이터로 찍고, 오프닝 전체에서 기본 색 하나(#fff0dc)로 통일하며 클라이맥스 대사 한두 큐만 강조색(#ff6878)을 써라(전체 색 종류 2가지 이하, 샷마다 무지개색 자막 금지!).',
      transitions: '샷 사이 전환은 dither({kind:"dither", durationMs:650})를 최소 2~3개 샷에, 클라이맥스(검 뽑기·타이틀 로고 등장)에는 flash({kind:"flash", durationMs:240, color:"#fff6d8"})를, 나머지에는 fade를 섞어라.',
      music: 'set_opening(musicResourceId) 로 시퀀스 음악을 깔아 두면 샷 컷을 넘어 계속 재생되고 시작 맵 handoff 뒤 페이드된다. 사건 시각에는 upsert_opening_audio_cue 로 효과음을 얹는다.',
      handoff: '마지막 로고 샷 뒤에 맵으로 넘기는 샷을 만들지 않는다. 시작 맵은 이미 있는 것을 그대로 유지한다.',
      proof: '각 샷마다 preview_opening_animatic 으로 시작·중간·끝 표본을 실제로 보고, review_opening 으로 styleLock 경고 0건을 확인한 뒤 마친다.'
    },
  } })),
  definition('get_opening_references', '조사한 게임/영상·연출기법·도구 대응표. query 또는 id.', 'read', schema({ query: str, id: str }, []), (_p, args) => {
    const q = String(args.query ?? '').toLowerCase(), rows = references as Record<string, unknown>[];
    const matches = rows.filter(r => (!args.id || r.id === args.id) && (!q || JSON.stringify(r).toLowerCase().includes(q))).map(row => {
      const { toolRequirements, ...facts } = row;
      return { ...facts, conceptualRequirements: toolRequirements, actualAuthoringTools: [
        { tool: 'upsert_opening_layer', fields: 'image/text/shape/particles; image.sheet loops supplied frames; frame keys select supplied poses' },
        { tool: 'animate_opening_layer', fields: 'keys.x/y/scaleX/scaleY/rotation/opacity/frame; repeated movement must be authored as keys and/or duplicated layers' },
        { tool: 'set_opening_region_loop', fields: 'masked window loop on an image layer: scroll-x/scroll-y (pixels per everyTicks at tickMs), palette-cycle (colors), strip (frames)' },
        { tool: 'upsert_opening_light_fx', fields: 'shaft (angled dithered beam + dust inside the mask, pulse/flicker) or glow (radial light, pulse)' },
        { tool: 'upsert_opening_emote', fields: 'procedural pixel bubble (!, ?, …, heart, sweat) with pop-in/hold/pop-out on a target layer' },
        { tool: 'set_opening_caption', fields: 'bottom letterbox caption track: per-cue text/color/typewriterMs, last-cue fade out, safe area' },
        { tool: 'apply_opening_walk', fields: 'stride-matched sprite walk: frame advances with travelled x; optional fromX/toX travel track' },
        { tool: 'set_opening_pixel_grid', fields: 'integer stage raster (e.g.384×216) with nearest-neighbour upscale; every primitive shares one pixel size' },
        { tool: 'animate_opening_camera', fields: 'camera.x/y/zoom/rotation/keys/shake' },
        { tool: 'set_opening_transition', fields: 'cut/fade/wipe-left/wipe-right/iris/flash/dither; entry reveal from the stage background, not cross-dissolve' },
        { tool: 'upsert_opening_audio_cue', fields: 'cue.resourceId/atMs/durationMs/volume/fades; whole-sequence BGM uses set_opening' },
        { tool: 'preview_opening_reference', fields: 'id; inspect actual bundled research frames' },
        { tool: 'preview_opening_animatic', fields: 'inspect actual authored timeline frames before declaring completion' },
      ], implementationLimits: 'Conceptual labels such as actor.pose, layer.loopScroll or text.creditsTrack ARE NOT callable tools. Region loops cover water/waterfall/shimmer without a separate scrolling layer, but there is still no skeletal pose invention, 3D rig or synthesized voice. Translate to the actual tools above and state approximations.' };
    });
    return { summary: `조사 사례 ${matches.length}개. 개념 요구사항과 실제 등록 도구를 구분합니다.`, data: { cases: matches, exhaustiveAllGames: false, usage: 'Use actualAuthoringTools names when explaining or executing. conceptualRequirements are research labels, not tool names. Source video is a reference, not project media.' } };
  }),
  definition('preview_opening_reference', '조사한 공식 영상의 실제 확인 프레임을 모델에 전달. 게임 소재가 아님.', 'read', schema({ id: str }), (_p, args) => {
    const row = (references as Record<string, unknown>[]).find(r => r.id === args.id);
    const frames = row?.referenceFrames as { publicPath: string; timeSeconds: number; sourceUrl: string }[] | undefined;
    if (!frames?.length) throw new ToolError('이 사례는 실제 확인 프레임이 없습니다. 문헌 확인 범위를 읽으세요.', { code: 'reference-frames-unavailable' });
    return { summary: '연구용 실제 프레임 전달 요청. 프로젝트 리소스가 아닙니다.', data: { id: row!.id, frames: frames.slice(0, 4) } };
  }),
  definition('configure_opening_entry', '재생 위치:새 게임/최초 타이틀 전/타이틀 유휴 데모. 기존 샷 유지. track:"title-intro" 는 타이틀 앞 인트로(before-title=켤 때 한 번, attract=켤 때+유휴 데모).', 'write', schema({ mode: { type: 'string', enum: ['new-game', 'before-title', 'attract'] }, idleMs: integer, repeatDelayMs: integer, track: trackSchema }, ['mode']), (p, args) => {
    if (trackArg(args.track) === 'title-intro') {
      const intro = p.system.titleIntro;
      if (!intro) throw new ToolError('먼저 track:"title-intro" 로 create_opening_animatic_shot 을 만드세요.', { code: 'opening-not-found' });
      if (args.mode === 'new-game') throw new ToolError('타이틀 인트로는 타이틀 앞에서만 돈다(before-title 또는 attract). 새 게임 뒤 장면은 track:"opening" 에 만드세요.', { code: 'invalid-args' });
      const idle = args.mode === 'attract';
      for (const name of ['idleMs', 'repeatDelayMs']) if (idle && args[name] !== undefined && (!Number.isSafeInteger(args[name]) || Number(args[name]) < 1000 || Number(args[name]) > 300000)) throw new ToolError(name + ':1000..300000ms 정수 필요.', { code: 'invalid-args' });
      if (idle) intro.entry = { mode: 'attract', ...(args.idleMs !== undefined ? { idleMs: Number(args.idleMs) } : {}), ...(args.repeatDelayMs !== undefined ? { repeatDelayMs: Number(args.repeatDelayMs) } : {}) };
      else delete intro.entry;
      return { summary: idle ? '타이틀 인트로: 켤 때 한 번 + 타이틀 유휴 데모.' : '타이틀 인트로: 켤 때 타이틀 앞에서 한 번.', data: { track: 'title-intro', entry: intro.entry ?? { mode: 'before-title' } } };
    }
    if (!p.system.opening) throw new ToolError('먼저 오프닝을 저작하세요.', { code: 'opening-not-found' });
    if (!['new-game', 'before-title', 'attract'].includes(String(args.mode)) || typeof args.mode !== 'string') throw new ToolError('재생 위치 오류.', { code: 'invalid-args' });
    // 유휴 대기 값은 attract 에서만 뜻이 있다 — new-game/before-title 로 보낸 값은 버린다(선택 칸을 다 채우는 모델이
    // new-game 에도 idleMs 를 넣어 «1000..300000ms 정수 필요» 로 거부됐다. 2026-10-16 run-2 실측).
    const usesIdle = args.mode === 'attract';
    for (const name of ['idleMs', 'repeatDelayMs']) if (usesIdle && args[name] !== undefined && (!Number.isSafeInteger(args[name]) || Number(args[name]) < 1000 || Number(args[name]) > 300000)) throw new ToolError(name + ':1000..300000ms 정수 필요.', { code: 'invalid-args' });
    p.system.opening.entry = { mode: args.mode as 'new-game' | 'before-title' | 'attract', ...(usesIdle && args.idleMs !== undefined ? { idleMs: Number(args.idleMs) } : {}), ...(usesIdle && args.repeatDelayMs !== undefined ? { repeatDelayMs: Number(args.repeatDelayMs) } : {}) };
    return { summary: '재생 위치를 저장했습니다. before-title/attract는 새 게임에 같은 시퀀스를 중복 재생하지 않습니다.', data: { entry: p.system.opening.entry } };
  }),
  definition('configure_title_intro', '타이틀 앞 인트로(track:"title-intro")의 음악·켜기·지우기. 샷은 create_opening_animatic_shot({track:"title-intro"}).', 'write', schema({ musicResourceId: str, enabled: bool, remove: bool }, []), (p, args) => {
    if (args.remove === true) {
      if (!p.system.titleIntro) throw new ToolError('지울 타이틀 인트로가 없습니다.', { code: 'opening-not-found' });
      const count = p.system.titleIntro.scenes.length; delete p.system.titleIntro;
      return { summary: `타이틀 인트로(샷 ${count}개)를 지웠습니다.`, data: { removed: true } };
    }
    const intro = p.system.titleIntro;
    if (!intro) throw new ToolError('먼저 create_opening_animatic_shot({track:"title-intro",…}) 로 샷을 만드세요.', { code: 'opening-not-found' });
    if (args.enabled !== undefined) intro.enabled = args.enabled === true;
    if (typeof args.musicResourceId === 'string') {
      const music = args.musicResourceId.trim();
      if (!music) delete intro.musicResourceId;
      else if (!catalogLookup(p)('music', music)) throw new ToolError(`음악 ${music} 을 찾을 수 없습니다. list_opening_media(kind:"music") 에서 고르세요.`, { code: 'resource-not-found' });
      else intro.musicResourceId = music;
    }
    const total = intro.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
    return { summary: `타이틀 인트로: 샷 ${intro.scenes.length}개 · ${(total / 1000).toFixed(1)}초 · ${intro.enabled ? '켜짐' : '꺼짐'} · 음악 ${intro.musicResourceId ?? '없음'}.`, data: { titleIntro: { enabled: intro.enabled, musicResourceId: intro.musicResourceId ?? null, entry: intro.entry ?? { mode: 'before-title' }, shots: intro.scenes.map(scene => ({ shotId: scene.id, durationMs: scene.durationMs })) } } };
  }),
  definition('create_opening_animatic_shot', '빈 합성 샷 추가. 교체는 replace:true와 clearLayers:true를 함께 명시해야 기존 레이어를 지웁니다. track:"title-intro" 면 게임을 켜면 타이틀 앞에 도는 인트로(opening=새 게임 뒤 장면과 따로).', 'write', schema({ shotId: str, durationMs: integer, width: integer, height: integer, background: str, index: integer, replace: { type: 'boolean' }, clearLayers: { type: 'boolean' }, narration: str, track: trackSchema }, ['shotId', 'durationMs']), (p, args) => {
    const track = trackArg(args.track), otherTrack = trackOfShot(p, String(args.shotId ?? '').trim());
    if (otherTrack && otherTrack !== track) throw new ToolError(`샷 ${String(args.shotId)} 은 이미 ${otherTrack} 트랙에 있습니다. 다른 shotId 를 쓰세요.`, { code: 'scene-exists' });
    const id = text(args.shotId, 'shotId'), duration = Number(args.durationMs), opening = structuredClone(trackSequence(p, track) ?? { enabled: true, skippable: true, scenes: [] });
    const existing = opening.scenes.findIndex(s => s.id === id); if (existing >= 0 && args.replace !== true) throw new ToolError('기존 샷입니다. 명시적 replace:true 필요.', { code: 'scene-exists' });
    if (existing >= 0 && args.clearLayers !== true) throw new ToolError('기존 샷의 레이어를 지우려면 clearLayers:true를 명시하세요. 아니면 새 shotId를 사용하세요.', { code: 'replace-would-erase-layers' });
    if (!opening.scenes.some(sc => sc.kind === 'animatic') && opening.scenes.every(sc => sc.kind === 'text' && isTitleCardNarration(sc.narration, p.system?.titleScreen?.title ?? p.meta?.title))) {
      opening.scenes = [];
    }
    const width = Number(args.width ?? 1280), height = Number(args.height ?? 720);
    const rawBg = typeof args.background === 'string' ? args.background.trim() : '';
    const bgIsResource = Boolean(rawBg && !rawBg.startsWith('#') && hasOpeningImage(p, rawBg));
    const shotIndex = existing >= 0 ? existing : (args.index === undefined ? opening.scenes.length : Number(args.index));
    const defaultTransition: OpeningAnimatic['transition'] = width === 384 && height === 216
      ? (shotIndex % 3 === 1 ? { kind: 'dither', durationMs: 650, color: '#000000' } : shotIndex % 3 === 2 ? { kind: 'flash', durationMs: 260, color: '#fff6d8' } : { kind: 'fade', durationMs: 550, color: '#000000' })
      : undefined;
    const initialLayers: AnimaticLayer[] = bgIsResource
      ? [{ id: 'bg', kind: 'image', role: 'background', resourceId: rawBg, x: 0, y: 0, width, height, anchorX: 0, anchorY: 0, sampling: 'nearest' }]
      : [];
    const s: Shot = {
      id, kind: 'animatic', durationMs: duration, narration: String(args.narration ?? ''),
      composition: {
        width, height, background: bgIsResource || !rawBg ? '#000000' : rawBg,
        ...(width === 384 && height === 216 ? { pixelGrid: { width: 384, height: 216 }, letterbox: 0.15 } : {}),
        ...(defaultTransition ? { transition: defaultTransition } : {}),
        layers: initialLayers,
      },
    };
    check(p, s);
    if (existing >= 0) opening.scenes[existing] = s;
    else { if (opening.scenes.length >= CINEMATIC_SCENE_LIMIT) throw new ToolError('장면 수 초과.', { code: 'too-many-scenes' }); const index = args.index === undefined ? opening.scenes.length : Number(args.index); if (!Number.isSafeInteger(index) || index < 0 || index > opening.scenes.length) throw new ToolError('index 범위 오류.', { code: 'invalid-args' }); opening.scenes.splice(index, 0, s); }
    setTrackSequence(p, track, opening); return { summary: `애니메틱 샷을 만들었습니다(${track}). 레이어·동작을 저작하세요.`, data: { shotId: id, track, composition: s.composition } };
  }),
  definition('upsert_opening_layer', '그림/배우/글/도형/입자 레이어 추가·교체. 계약:get_animatic_capabilities.', 'write', schema({ shotId: str, layer: obj, index: integer }, ['shotId', 'layer']), (p, args) => {
    const s = shot(p, args.shotId), l = structuredClone(args.layer) as AnimaticLayer;
    if (!l || typeof l !== 'object' || Array.isArray(l)) throw new ToolError('layer 객체 필요.', { code: 'invalid-args' });
    if (l.kind === 'image' && l.role === 'actor' && typeof l.resourceId === 'string') {
      l.resourceId = resolveOpeningCharsetForGenre(p, l.resourceId);
    }
    // 배경은 불투명이어야 한다(check). 어둡게 하려고 0.85 를 주면 거절되고, 같은 턴에 그 레이어를 움직이던 animate 까지 「layerId 없음」으로 줄줄이 실패했다
    // (2026-10-25 장난감 가게 G40) — 1 로 받아 저장하고 어둡게 하는 길을 알려 준다.
    let note = '';
    if (l.kind === 'image' && l.role === 'background' && typeof l.opacity === 'number' && l.opacity < 0.9) {
      note = ` 배경 ${l.id} opacity ${l.opacity} 는 1 로 맞췄다(배경은 불투명) — 어둡게 하려면 위에 shape 레이어(검정·opacity 0.2~0.5)를 얹는다.`;
      l.opacity = 1;
    }
    const rows = s.composition.layers, at = rows.findIndex(row => row.id === l.id);
    if (at >= 0) rows[at] = l; else { const index = args.index === undefined ? rows.length : Number(args.index); if (!Number.isSafeInteger(index) || index < 0 || index > rows.length) throw new ToolError('index 범위 오류.', { code: 'invalid-args' }); rows.splice(index, 0, l); }
    return commit(p, s, '실제 합성 레이어를 저장했습니다.' + note, l.kind === 'image' && l.role === 'background');
  }),
  definition('remove_opening_layer', '선택한 레이어만 제거.', 'write', schema({ shotId: str, layerId: str }), (p, args) => {
    const s = shot(p, args.shotId), id = text(args.layerId, 'layerId'); if (!s.composition.layers.some(l => l.id === id)) throw new ToolError('layerId 없음.', { code: 'layer-not-found' });
    s.composition.layers = s.composition.layers.filter(l => l.id !== id); return commit(p, s, '레이어를 제거했습니다.');
  }),
  definition('animate_opening_layer', '지정 속성의 key 배열 교체. 나머지 트랙 유지.', 'write', schema({ shotId: str, layerId: str, keys: obj }), (p, args) => {
    const s = shot(p, args.shotId), l = s.composition.layers.find(l => l.id === args.layerId); if (!l) throw new ToolError(`layerId 없음: ${String(args.layerId)} — 이 샷의 레이어: ${s.composition.layers.map(x => x.id).join(', ') || '(없음)'}. 같은 턴에 만든 레이어가 실패했으면 그 upsert_opening_layer 를 먼저 고친다.`, { code: 'layer-not-found' });
    l.keys = { ...l.keys, ...structuredClone(args.keys as AnimaticTracks) }; return commit(p, s, '레이어 동작을 저장했습니다.');
  }),
  definition('apply_opening_motion', 'jump/float/pulse/run-across 동작 키 생성. 다른 트랙 유지.', 'write', schema({ shotId: str, layerId: str, preset: { type: 'string', enum: ['jump', 'float', 'pulse', 'run-across'] }, atMs: integer, durationMs: integer, amount: { type: 'number' } }, ['shotId', 'layerId', 'preset']), (p, args) => {
    const s = shot(p, args.shotId), l = s.composition.layers.find(l => l.id === args.layerId); if (!l) throw new ToolError(`layerId 없음: ${String(args.layerId)} — 이 샷의 레이어: ${s.composition.layers.map(x => x.id).join(', ') || '(없음)'}. 같은 턴에 만든 레이어가 실패했으면 그 upsert_opening_layer 를 먼저 고친다.`, { code: 'layer-not-found' });
    const start = Number(args.atMs ?? 0), duration = Number(args.durationMs ?? s.durationMs), preset = String(args.preset), property = preset === 'run-across' ? 'x' : preset === 'pulse' ? 'scaleX' : 'y';
    const base = sampleAnimaticTrack(l.keys?.[property], start, property === 'scaleX' ? l.scaleX ?? 1 : l[property]), amount = Number(args.amount ?? (property === 'scaleX' ? 0.12 : preset === 'run-across' ? 300 : 35));
    const keys = preset === 'run-across' ? [{ atMs: start, value: base }, { atMs: start + duration, value: base + amount, ease: 'ease-in-out' as const }]
      : [{ atMs: start, value: base }, { atMs: Math.round(start + duration / 2), value: base + (property === 'y' ? -amount : amount), ease: 'ease-out' as const }, { atMs: start + duration, value: base, ease: 'ease-in' as const }];
    l.keys = { ...l.keys, [property]: keys }; if (preset === 'pulse') l.keys.scaleY = keys.map(k => ({ ...k, value: k.value + (l.scaleY ?? 1) - (l.scaleX ?? 1) }));
    return commit(p, s, '동작 키를 저장했습니다. 실제 시간 표본을 검토하세요.');
  }),
  definition('animate_opening_camera', '카메라 위치·줌·회전·키·흔들기 변경. 기존 속성 유지.', 'write', schema({ shotId: str, camera: obj }), (p, args) => {
    const s = shot(p, args.shotId);
    const camera = cameraFromTo(args.camera, s.durationMs) as OpeningAnimatic['camera'];
    s.composition.camera = { ...s.composition.camera, ...structuredClone(camera), keys: { ...s.composition.camera?.keys, ...camera?.keys } };
    return commit(p, s, '카메라 타임라인을 저장했습니다.');
  }),
  definition('set_opening_transition', '샷 입장 cut/fade/wipe/iris/flash와 레터박스.', 'write', schema({ shotId: str, transition: obj, letterbox: { type: 'number' } }, ['shotId', 'transition']), (p, args) => {
    const s = shot(p, args.shotId); s.composition.transition = structuredClone(args.transition) as OpeningAnimatic['transition']; if (args.letterbox !== undefined) s.composition.letterbox = Number(args.letterbox); return commit(p, s, '샷 전환을 저장했습니다.');
  }),
  definition('upsert_opening_audio_cue', '시간별 효과음/음악 큐 추가·교체. 전체 BGM 유지.', 'write', schema({ shotId: str, cue: obj }), (p, args) => {
    const s = shot(p, args.shotId), rawCue = structuredClone(args.cue) as Record<string, unknown>, rows = s.composition.audioCues ?? [];
    if (!rawCue || typeof rawCue !== 'object') throw new ToolError('cue 객체 필요.', { code: 'invalid-args' });
    const atMs = Math.max(0, Math.min(s.durationMs - 1, Math.round(Number(rawCue.atMs ?? 0))));
    const maxDur = Math.max(1, s.durationMs - atMs);
    const durationMs = Math.max(1, Math.min(maxDur, Math.round(Number(rawCue.durationMs ?? maxDur))));
    const cue = {
      ...rawCue,
      atMs,
      durationMs,
      ...(rawCue.fadeInMs !== undefined ? { fadeInMs: Math.min(durationMs, Math.max(0, Math.round(Number(rawCue.fadeInMs)))) } : {}),
      ...(rawCue.fadeOutMs !== undefined ? { fadeOutMs: Math.min(durationMs, Math.max(0, Math.round(Number(rawCue.fadeOutMs)))) } : {}),
    } as NonNullable<OpeningAnimatic['audioCues']>[number];
    const at = rows.findIndex(c => c.id === cue.id); if (at >= 0) rows[at] = cue; else rows.push(cue); s.composition.audioCues = rows; return commit(p, s, '오디오 큐를 저장했습니다.');
  }),
  definition('remove_opening_audio_cue', '선택한 오디오 큐 제거.', 'write', schema({ shotId: str, cueId: str }), (p, args) => { const s = shot(p, args.shotId), id = text(args.cueId, 'cueId'); if (!s.composition.audioCues?.some(c => c.id === id)) throw new ToolError('cueId 없음.', { code: 'cue-not-found' }); s.composition.audioCues = s.composition.audioCues.filter(c => c.id !== id); return commit(p, s, '오디오 큐를 제거했습니다.'); }),
  definition('retime_opening_shot', '샷 길이와 모든 키·생존시간·오디오 큐를 비례 변경.', 'write', schema({ shotId: str, durationMs: integer }), (p, args) => {
    const s = shot(p, args.shotId), duration = Number(args.durationMs);
    s.composition = retimeOpeningAnimatic(s.composition, s.durationMs, duration); s.durationMs = duration;
    return commit(p, s, '샷과 종속 시간축을 함께 변경했습니다. 스프라이트 fps와 원본 음원은 유지됩니다.');
  }),
  definition('inspect_opening_timeline', '샷별 레이어·동작·포즈·큐·빈 무대 구조 검토. track:"title-intro" 면 타이틀 앞 인트로.', 'read', schema({ shotId: str, track: trackSchema }, []), (p, args) => {
    const track = args.shotId && !args.track ? trackOfShot(p, String(args.shotId)) ?? 'opening' : trackArg(args.track);
    let offset = 0; const shots = (trackSequence(p, track)?.scenes ?? []).map(s => { const startMs = offset; offset += s.durationMs; if (s.kind !== 'animatic') return { shotId: s.id, kind: s.kind, startMs, durationMs: s.durationMs };
      return { shotId: s.id, kind: s.kind, startMs, durationMs: s.durationMs, composition: s.composition, movingLayers: s.composition.layers.filter(l => Object.keys(l.keys ?? {}).some(k => k !== 'opacity') || (l.sheet?.fps ?? 0) > 0).map(l => l.id), warnings: s.composition.layers.length ? [] : ['레이어 없는 빈 무대'] }; }).filter(s => !args.shotId || s.shotId === args.shotId);
    return { summary: `타임라인(${track}) ${shots.length}샷, 시간은 ms. 구조 검토이며 재생 증거와 다릅니다.`, data: { track, shots, automaticDurationMs: (trackSequence(p, track)?.scenes ?? []).every(s => s.durationMs > 0 && s.kind !== 'video') ? offset : null } };
  }),
  definition('preview_opening_animatic', '현재 합성 샷의 실제 시간 표본을 모델에 전달. 최대4프레임.', 'read', schema({ shotId: str, atMs: { type: 'array', items: integer, maxItems: 4 } }, ['shotId']), (p, args) => {
    const s = shot(p, args.shotId), samples = args.atMs ?? [...new Set([0, Math.floor(s.durationMs / 3), Math.floor(s.durationMs * 2 / 3), s.durationMs])];
    if (!Array.isArray(samples) || !samples.length || samples.length > 4 || samples.some(t => !Number.isSafeInteger(t) || t < 0 || t > s.durationMs)) throw new ToolError('atMs는 샷 안의 정수시간1~4개여야 합니다.', { code: 'invalid-args' });
    check(p, s); return { summary: '실제 합성 프레임 전달을 요청했습니다.', data: { shotId: s.id, atMs: samples, resourceIds: animaticResourceIds(s.composition) } };
  }),
  // 사용 중단: 에디터 조수 세션은 이 이름을 가로채지 않아 늘 실패한다(Pi 스크립트 실행기만 가로챈다). 새 저작은 generate_opening_image.
  definition('generate_opening_layer', '사용 중단 — generate_opening_image(role:backdrop|foreground)를 쓴다.', 'write', schema({ prompt: str, name: str, role: { type: 'string', enum: ['background', 'actor', 'prop', 'foreground'] }, referenceResourceIds: { type: 'array', items: str, maxItems: 2 }, artStyle: str, aspectRatio: { type: 'string', enum: ['16:9', '4:3', '1:1'] } }, ['prompt', 'role']), () => { throw new ToolError('generate_opening_layer 는 사용 중단되었습니다. generate_opening_image(role:backdrop 또는 foreground)로 다시 부르세요.', { code: 'deprecated-tool' }); }),
  definition('set_opening_pixel_grid', '샷 전체를 정수 픽셀 격자(예384×216)로 렌더한다. 인자 없이 부르면 해제.', 'write', schema({ shotId: str, width: integer, height: integer }, ['shotId']), (p, args) => {
    const s = shot(p, args.shotId);
    if (args.width === undefined && args.height === undefined) delete s.composition.pixelGrid;
    else {
      if (!Number.isSafeInteger(args.width) || !Number.isSafeInteger(args.height)) throw new ToolError('width와 height를 정수 쌍으로 주거나 둘 다 생략하세요.', { code: 'invalid-args' });
      s.composition.pixelGrid = { width: Number(args.width), height: Number(args.height) };
    }
    return commit(p, s, '무대 픽셀 격자를 저장했습니다. 레이어·카메라 좌표가 이 격자에 스냅되어 모든 요소의 픽셀 크기가 같아집니다.');
  }),
  definition('set_opening_region_loop', '그림 레이어의 한 영역만 반복 재생(물 흐름·반짝임·프레임 띠). remove:true로 제거.', 'write', schema({ shotId: str, layerId: str, region: regionSchema, remove: bool }, ['shotId', 'layerId']), (p, args) => {
    const s = shot(p, args.shotId), l = imageLayerOf(s, args.layerId);
    if (args.remove === true) delete l.region;
    else {
      if (!args.region || typeof args.region !== 'object') throw new ToolError('region 객체가 필요합니다(또는 remove:true).', { code: 'invalid-args' });
      const region = cleanRegion(structuredClone(args.region) as AnimaticLayer['region'])!;
      if (l.role === 'background' && (region.mode === 'scroll-x' || region.mode === 'scroll-y')
        && region.width >= s.composition.width * 0.7 && region.height >= s.composition.height * 0.65) {
        throw new ToolError('전체 배경에는 scroll 루프를 걸 수 없습니다. 상단 하늘 띠/작은 영역만 scroll하고 전체 이동은 animate_opening_camera로 만드세요.', { code: 'background-scroll-unsafe' });
      }
      l.region = region;
    }
    return commit(p, s, '영역 루프를 저장했습니다. 영역 밖은 바뀌지 않습니다.');
  }),
  definition('upsert_opening_light_fx', '빛줄기(각진 빔+먼지) 또는 발광 덩어리 레이어를 추가·교체. kind:shaft|glow.', 'write', schema({ shotId: str, layerId: str, kind: { type: 'string', enum: ['shaft', 'glow'] }, x: num, y: num, width: num, height: num, rotation: num, color: str, blend: { type: 'string', enum: ['source-over', 'lighter', 'screen', 'multiply'] }, spread: num, softness: num, dust: { type: 'object', additionalProperties: false, properties: { count: integer, seed: integer, speed: num, size: num } }, pulse: pulseSchema, inner: num, startMs: integer, endMs: integer }, ['shotId', 'layerId', 'kind', 'x', 'y', 'width', 'height']), (p, args) => {
    const s = shot(p, args.shotId), id = text(args.layerId, 'layerId'), light = text(args.kind, 'kind');
    if (light !== 'shaft' && light !== 'glow') throw new ToolError('kind는 shaft 또는 glow입니다.', { code: 'invalid-args' });
    const layer: AnimaticLayer = { id, kind: light, role: 'effect', x: Number(args.x), y: Number(args.y), width: Number(args.width), height: Number(args.height),
      blend: (args.blend as AnimaticLayer['blend']) ?? 'lighter', color: String(args.color ?? (light === 'shaft' ? '#ffe9b0' : '#ffcc66')),
      ...(args.rotation !== undefined ? { rotation: Number(args.rotation) } : {}),
      ...(args.startMs !== undefined ? { startMs: Number(args.startMs) } : {}), ...(args.endMs !== undefined ? { endMs: Number(args.endMs) } : {}),
      ...(light === 'shaft' ? { shaft: { ...(args.spread !== undefined ? { spread: Number(args.spread) } : {}), ...(args.softness !== undefined ? { softness: Number(args.softness) } : {}), ...(args.dust !== undefined ? { dust: structuredClone(args.dust) as NonNullable<AnimaticLayer['shaft']>['dust'] } : {}), ...(args.pulse !== undefined ? { pulse: structuredClone(args.pulse) as NonNullable<AnimaticLayer['shaft']>['pulse'] } : {}) } }
        : { glow: { ...(args.inner !== undefined ? { inner: Number(args.inner) } : {}), ...(args.pulse !== undefined ? { pulse: structuredClone(args.pulse) as NonNullable<AnimaticLayer['glow']>['pulse'] } : {}) } }) };
    const at = s.composition.layers.findIndex(row => row.id === id);
    if (at >= 0) s.composition.layers[at] = layer; else s.composition.layers.push(layer);
    return commit(p, s, light === 'shaft' ? '빛줄기를 저장했습니다. 먼지는 빔 안에서만 보입니다.' : '발광을 저장했습니다. pulse로 호흡·점멸을 만든다.');
  }),
  definition('upsert_opening_emote', '배우·소품 위에 픽셀 말풍선(!, ?, …, 하트, 땀)을 붙인다. pop-in→유지→pop-out.', 'write', schema({ shotId: str, layerId: str, preset: { type: 'string', enum: ['exclaim', 'question', 'ellipsis', 'heart', 'sweat'] }, targetLayerId: str, x: num, y: num, width: num, height: num, startMs: integer, endMs: integer, tail: { type: 'string', enum: ['down', 'none'] }, popMs: integer, outMs: integer }, ['shotId', 'layerId', 'preset', 'startMs', 'endMs']), (p, args) => {
    const s = shot(p, args.shotId), id = text(args.layerId, 'layerId'), preset = text(args.preset, 'preset');
    if (!(ANIMATIC_EMOTE_PRESETS as readonly string[]).includes(preset)) throw new ToolError(`preset은 ${ANIMATIC_EMOTE_PRESETS.join('/')} 중 하나입니다.`, { code: 'invalid-args' });
    const target = args.targetLayerId === undefined ? undefined : s.composition.layers.find(l => l.id === args.targetLayerId);
    if (args.targetLayerId !== undefined && !target) throw new ToolError('targetLayerId 없음: ' + String(args.targetLayerId), { code: 'layer-not-found' });
    const isPixelStage = (s.composition.pixelGrid?.width ?? s.composition.width) <= 480;
    const width = Number(args.width ?? (isPixelStage ? 12 : 24)), height = Number(args.height ?? (isPixelStage ? 14 : 34));
    const layer: AnimaticLayer = { id, kind: 'emote', role: 'effect', width, height,
      x: Number(args.x ?? (target ? target.x + target.width / 2 - width / 2 : 0)), y: Number(args.y ?? (target ? target.y - height - 2 : 0)),
      startMs: Number(args.startMs), endMs: Number(args.endMs),
      emote: { preset: preset as 'exclaim', ...(args.tail !== undefined ? { tail: args.tail as 'down' } : {}), ...(args.popMs !== undefined ? { popMs: Number(args.popMs) } : {}), ...(args.outMs !== undefined ? { outMs: Number(args.outMs) } : {}) } };
    const at = s.composition.layers.findIndex(row => row.id === id);
    if (at >= 0) s.composition.layers[at] = layer; else s.composition.layers.push(layer);
    return commit(p, s, '말풍선을 저장했습니다. 외부 그림을 쓰지 않고 격자에 직접 그립니다.');
  }),
  definition('set_opening_caption', '하단 레터박스 자막 트랙. 큐별 문구·색·타자 속도, 마지막 큐에서 페이드 아웃.', 'write', schema({ shotId: str, layerId: str, cues: { type: 'array', items: cueSchema, minItems: 1, maxItems: 32 }, letterbox: num, safeArea: num, fadeOutMs: integer, fontSize: integer, color: str }, ['shotId', 'layerId', 'cues']), (p, args) => {
    const s = shot(p, args.shotId), id = text(args.layerId, 'layerId');
    const baseColor = String(args.color ?? '#fff0dc');
    const rawCues = structuredClone(args.cues) as { atMs: number; text: string; color?: string; typewriterMs?: number }[];
    if (!Array.isArray(rawCues) || !rawCues.length) throw new ToolError('cues는 1개 이상이어야 합니다.', { code: 'invalid-args' });
    const cues = rawCues.map((c, idx) => {
      const clampedAt = Math.max(0, Math.min(Math.max(0, s.durationMs - 200), Math.round(Number(c.atMs ?? idx * 1500))));
      const remaining = Math.max(100, s.durationMs - clampedAt);
      const desiredTw = c.typewriterMs ?? Math.min(1800, Math.max(450, Math.round(Array.from(c.text).length * 48)));
      return {
        ...c,
        atMs: clampedAt,
        color: c.color ?? baseColor,
        typewriterMs: Math.min(remaining, Math.max(100, Math.round(Number(desiredTw)))),
      };
    });
    if (args.letterbox !== undefined) s.composition.letterbox = Number(args.letterbox);
    else if (!s.composition.letterbox) s.composition.letterbox = 0.15;
    const safe = Math.ceil(s.composition.height * (s.composition.letterbox ?? 0.15));
    for (const actor of s.composition.layers) {
      if (actor.kind === 'image' && actor.role === 'actor') {
        const maxActorY = Math.max(safe, Math.floor(s.composition.height - safe - actor.height));
        actor.y = Math.max(safe, Math.min(maxActorY, actor.y));
      }
    }
    const layer: AnimaticLayer = { id, kind: 'caption', x: 0, y: 0, width: s.composition.width, height: 40, color: baseColor,
      typography: { fontSize: Number(args.fontSize ?? 11), align: 'center', weight: 600 },
      caption: { cues, ...(args.safeArea !== undefined ? { safeArea: Number(args.safeArea) } : {}), ...(args.fadeOutMs !== undefined ? { fadeOutMs: Number(args.fadeOutMs) } : {}) } };
    const at = s.composition.layers.findIndex(row => row.id === id);
    if (at >= 0) s.composition.layers[at] = layer; else s.composition.layers.push(layer);
    return commit(p, s, '자막 트랙을 저장했습니다. letterbox가 있으면 막대 안에, 없으면 하단 안전 영역에 놓인다.');
  }),
  definition('place_opening_background', '무대 전체를 덮는 배경 그림 레이어를 정확히 깔아 준다(x,y는 «앵커 점»이므로 손으로 채우면 어긋난다). '
    + '그림 대신 mapId 를 주면 그 게임 맵을 그대로 배경으로 쓴다(맞는 오프닝 그림이 없을 때 — 엉뚱한 스틸 대신 실제 무대). focus {x,y} = 가운데에 올 맵 칸(기본 맵 가운데), zoom 1 = 맵 화소 1:1(384×216 무대면 칸 24×13.5개), 2 = 두 배로 당김. 인물은 그려지지 않으니 place_opening_charset_actor 로 얹는다.',
  'write', schema({ shotId: str, layerId: str, resourceId: str, mapId: str, focus: { type: 'object', properties: { x: num, y: num }, required: ['x', 'y'], additionalProperties: false }, zoom: num, opacity: num, index: integer }, ['shotId', 'layerId']), (p, args) => {
    const s = shot(p, args.shotId), id = text(args.layerId, 'layerId');
    const width = s.composition.width, height = s.composition.height;
    const mapId = typeof args.mapId === 'string' && args.mapId.trim() ? args.mapId.trim() : '';
    if (!!mapId === (typeof args.resourceId === 'string' && !!args.resourceId.trim())) throw new ToolError('resourceId(그림) 와 mapId(게임 맵 그대로) 중 정확히 하나를 줍니다.', { code: 'invalid-args' });
    let resourceId: string, crop: AnimaticLayer['crop'];
    if (mapId) {
      const map = p.maps[mapId];
      if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: 'map-not-found' });
      const focus = args.focus as { x: number; y: number } | undefined;
      const zoom = args.zoom === undefined ? 1 : Number(args.zoom);
      if (!Number.isFinite(zoom) || zoom < 0.25 || zoom > 4) throw new ToolError('zoom 은 0.25~4 입니다.', { code: 'invalid-args' });
      resourceId = openingMapViewResourceId(mapId);
      crop = openingMapViewCrop(map, { width, height }, focus ? { x: Number(focus.x), y: Number(focus.y) } : undefined, zoom);
    } else {
      resourceId = text(args.resourceId, 'resourceId');
      if (!hasOpeningImage(p, resourceId)) throw new ToolError(`배경 그림을 찾을 수 없습니다: ${resourceId}`, { code: 'resource-not-found' });
    }
    const layer: AnimaticLayer = { id, kind: 'image', role: 'background', resourceId, x: 0, y: 0, width, height, anchorX: 0, anchorY: 0, sampling: 'nearest',
      ...(crop ? { crop } : {}),
      ...(args.opacity !== undefined ? { opacity: Number(args.opacity) } : {}) };
    const rows = s.composition.layers, at = rows.findIndex(row => row.id === id);
    if (at >= 0) rows[at] = layer;
    else { const index = args.index === undefined ? 0 : Number(args.index); if (!Number.isSafeInteger(index) || index < 0 || index > rows.length) throw new ToolError('index 범위 오류.', { code: 'invalid-args' }); rows.splice(index, 0, layer); }
    return commit(p, s, mapId
      ? `맵 ${mapId} 를 배경으로 무대 ${width}×${height} 에 깔았습니다(맵 화소 ${crop!.x},${crop!.y} 부터 ${crop!.width}×${crop!.height}). 인물은 place_opening_charset_actor 로 얹으세요.`
      : `배경 ${resourceId} 를 무대 ${width}×${height} 에 정확히 깔았습니다(anchorX/Y:0, x:0, y:0). 다른 그림은 이 레이어의 자식처럼 그 위에 얹으세요.`, true);
  }),
  definition('place_opening_charset_actor', '번들 24×32 캐릭터 칩을 배우로 놓고 보폭 걷기를 붙인다. 장면 역할 태그를 지정한다.', 'write', schema({ shotId: str, layerId: str, charsetResourceId: str, resourceId: str, characterRole: { type: 'string', enum: ['knight', 'villager', 'mage', 'hero', 'monster', 'crowd'] }, x: num, y: num, characterIndex: integer, direction: { type: 'string', enum: ['down', 'left', 'right', 'up'] }, scale: integer, fromX: num, toX: num, fromY: num, toY: num, startMs: integer, durationMs: integer, stride: integer }, ['shotId', 'layerId', 'x', 'y']), (p, args) => {
    const s = shot(p, args.shotId), id = text(args.layerId, 'layerId'), layer = charsetActorLayer(p, s, args);
    layer.id = id;
    const rows = s.composition.layers, at = rows.findIndex(row => row.id === id);
    if (at >= 0) rows[at] = layer; else rows.push(layer);
    return commit(p, s, `캐릭터 칩 배우를 저장했습니다(${layer.width}×${layer.height}, ${String(args.direction ?? 'right')}, 보폭 ${layer.walk!.stride}px). 배경과 같은 도트 크기입니다. 레이어를 나중에 고치려면 upsert_opening_layer 로 같은 id 를 덮으세요.`);
  }),
  definition('apply_opening_walk', '스프라이트 배우가 미끄러지지 않고 걷게 한다: 이동 거리와 보폭(stride)을 묶어 프레임을 진행시킨다.', 'write', schema({ shotId: str, layerId: str, stride: integer, frames: { type: 'array', items: integer, minItems: 1, maxItems: 16 }, holdFrame: integer, phase: num, fromX: num, toX: num, atMs: integer, durationMs: integer }, ['shotId', 'layerId', 'stride']), (p, args) => {
    const s = shot(p, args.shotId), l = imageLayerOf(s, args.layerId);
    const sheet = l.sheet;
    if (!sheet) throw new ToolError(`레이어 ${l.id}에 sprite sheet가 없습니다. upsert_opening_layer로 sheet:{frameWidth,frameHeight,columns,count,fps:0}를 먼저 지정하세요.`, { code: 'invalid-args' });
    const frames = args.frames === undefined ? [0, 1, 2, 1].filter(f => f < sheet.count) : (args.frames as number[]).map(Number);
    if (!frames.length) throw new ToolError('조각 프레임이 없습니다. sheet.count를 늘리거나 frames를 지정하세요.', { code: 'invalid-args' });
    const stride = Number(args.stride);
    if (args.toX !== undefined) {
      const fromX = Math.round(Number(args.fromX ?? l.x));
      const rawToX = Math.round(Number(args.toX));
      const diff = rawToX - fromX;
      const toX = diff === 0 ? rawToX : fromX + Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) / stride)) * stride;
      const start = Math.max(0, Math.min(s.durationMs - 100, Math.round(Number(args.atMs ?? l.startMs ?? 0))));
      const duration = Math.max(100, Math.min(s.durationMs - start, Math.round(Number(args.durationMs ?? (s.durationMs - start)))));
      const distance = Math.abs(toX - fromX);
      if (distance / stride > ANIMATIC_LIMITS.keysPerTrack) throw new ToolError(`이동 ${distance}px에 보폭 ${stride}px면 걸음이 너무 많습니다. stride를 키우거나 이동을 줄이세요.`, { code: 'invalid-args' });
      l.keys = { ...l.keys, x: [{ atMs: start, value: fromX }, { atMs: Math.round(start + duration), value: toX }] };
    }
    l.walk = { stride, frames, ...(args.holdFrame !== undefined ? { holdFrame: Number(args.holdFrame) } : {}), ...(args.phase !== undefined ? { phase: Number(args.phase) } : {}) };
    return commit(p, s, `걷기를 저장했습니다. 이동 거리÷보폭만큼 프레임이 진행되므로 발이 미끄러지지 않습니다.`);
  }),
  definition('set_opening_sprite_states', '수정/눈/검 같은 핵심 픽셀 스프라이트에 두 상태를 연결하고 시간별 frame 키를 만든다.', 'write', schema({
    shotId: str, layerId: str, states: obj, timeline: { type: 'array', items: obj, minItems: 2, maxItems: 16 },
  }, ['shotId', 'layerId', 'states', 'timeline']), (p, args) => {
    const s = shot(p, args.shotId), l = imageLayerOf(s, args.layerId);
    if (!l.sheet && l.region?.mode !== 'strip') throw new ToolError(`레이어 ${l.id}에 두 상태를 담을 sprite sheet 또는 strip이 없습니다.`, { code: 'critical-pixel-sprite-required' });
    const states = args.states as Record<string, unknown>;
    const entries = Object.entries(states);
    if (entries.length < 2) throw new ToolError('states는 최소 두 상태(normal/cracked, closed/open, sheathed/drawn)를 가져야 합니다.', { code: 'invalid-args' });
    const count = l.sheet?.count ?? l.region?.frames?.count ?? 0;
    const stateFrames: Record<string, number> = {};
    for (const [name, raw] of entries) {
      if (!name.trim() || !Number.isSafeInteger(raw) || Number(raw) < 0 || Number(raw) >= count) throw new ToolError(`상태 ${name}의 frame이 strip 범위를 벗어났습니다.`, { code: 'invalid-args' });
      stateFrames[name] = Number(raw);
    }
    const timeline = args.timeline as Record<string, unknown>[];
    const keys = timeline.map((row, index) => {
      if (!Number.isSafeInteger(row.atMs) || typeof row.state !== 'string' || !(row.state in stateFrames)) throw new ToolError(`timeline[${index}]은 atMs와 등록된 state가 필요합니다.`, { code: 'invalid-args' });
      return { atMs: Number(row.atMs), value: stateFrames[row.state]! };
    });
    l.stateFrames = stateFrames; l.keys = { ...l.keys, frame: keys };
    return commit(p, s, `픽셀 스프라이트 상태 ${entries.map(([name]) => name).join('/') }를 연결했습니다. 실제 frame strip으로 전환됩니다.`);
  }),
];

/**
 * camera:{from:{x,y,zoom},to:{x,y,zoom}} 를 정본 모양(시작 값 + 샷 길이에 걸친 keys)으로 옮긴다.
 * 실측(2026-10-22 조용한 현대 거리, Sonnet 5.5): from/to 로 보내 「camera.from: unsupported field」로 거부됐다 — 뜻이 하나뿐인 모양이다.
 */
function cameraFromTo(raw: unknown, durationMs: number): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const { from, to, ...rest } = raw as Record<string, unknown>;
  if (!from || typeof from !== 'object' || !to || typeof to !== 'object') return raw;
  const a = from as Record<string, unknown>, b = to as Record<string, unknown>;
  const camera: Record<string, unknown> = { ...rest };
  const keys: Record<string, { atMs: number; value: number; ease?: 'ease-in-out' }[]> = { ...((rest.keys as Record<string, never>) ?? {}) };
  for (const k of ['x', 'y', 'zoom', 'rotation']) {
    const start = typeof a[k] === 'number' ? a[k] as number : undefined, end = typeof b[k] === 'number' ? b[k] as number : undefined;
    if (start !== undefined) camera[k] = start;
    if (start !== undefined && end !== undefined && start !== end) keys[k] = [{ atMs: 0, value: start }, { atMs: Math.max(1, durationMs), value: end, ease: 'ease-in-out' }];
  }
  if (Object.keys(keys).length) camera.keys = keys;
  return camera;
}
