import { retimeOpeningAnimatic, validateOpeningAnimatic, animaticResourceIds, ANIMATIC_LIMITS, sampleAnimaticTrack, type AnimaticLayer, type AnimaticTracks, type OpeningAnimatic } from '@/project/openingAnimatic';
import type { CinematicScene, Project } from '@/project/types';
import { CINEMATIC_SCENE_LIMIT } from '@/project/cinematicSettings';
import { catalogLookup, hasOpeningImage } from './cinematicTools';
import { ToolError, type ToolDefinition, type JsonSchema, type ToolExecResult } from './types';
import references from '@/assets/openingReferences.json';

type Shot = Extract<CinematicScene, { kind: 'animatic' }>;
function text(v: unknown, label: string): string { if (typeof v !== 'string' || !v.trim()) throw new ToolError(label + ' 문자열이 필요합니다.', { code: 'invalid-args' }); return v.trim(); }
function shot(project: Project, raw: unknown): Shot {
  const id = text(raw, 'shotId'), s = project.system.opening?.scenes.find(s => s.id === id);
  if (!s || s.kind !== 'animatic') throw new ToolError('애니메틱 샷을 찾을 수 없습니다: ' + id, { code: 'scene-not-found' });
  return structuredClone(s);
}
function check(project: Project, s: Shot): void {
  try { validateOpeningAnimatic(s.composition, s.durationMs); } catch (error) { throw new ToolError(String(error), { code: 'invalid-args' }); }
  const known = catalogLookup(project);
  for (const l of s.composition.layers) if (l.kind === 'image' && !hasOpeningImage(project, l.resourceId!)) throw new ToolError('그림 리소스 없음: ' + l.resourceId, { code: 'resource-not-found' });
  for (const c of s.composition.audioCues ?? []) if (!known('sound', c.resourceId) && !known('music', c.resourceId)) throw new ToolError('오디오 리소스 없음: ' + c.resourceId, { code: 'resource-not-found' });
}
function commit(project: Project, s: Shot, summary: string): ToolExecResult {
  check(project, s); const opening = project.system.opening!;
  opening.scenes[opening.scenes.findIndex(row => row.id === s.id)] = s;
  return { summary, data: { shotId: s.id, durationMs: s.durationMs, layers: s.composition.layers.length, resourceIds: animaticResourceIds(s.composition) } };
}
const str: JsonSchema = { type: 'string' }, obj: JsonSchema = { type: 'object' }, integer: JsonSchema = { type: 'integer' };
const schema = (props: Record<string, JsonSchema>, required: string[] = Object.keys(props)): JsonSchema => ({ type: 'object', additionalProperties: false, properties: props, required });
const definition = (name: string, description: string, mode: 'read' | 'write', parameters: JsonSchema, run: ToolDefinition['run']): ToolDefinition => ({ name, description, mode, parameters, run });

export const OPENING_ANIMATIC_TOOLS: readonly ToolDefinition[] = [
  definition('get_animatic_capabilities', '시간축·레이어·카메라·큐 계약과 예시 조회.', 'read', schema({}), () => ({ summary: '애니메틱은 실제 시간 기반2D 합성입니다.', data: {
    coordinates: 'stage px, anchors0..1, rotation degrees; all times shot-local milliseconds', limits: ANIMATIC_LIMITS,
    easing: 'linear/ease-in/ease-out/ease-in-out/step; ease belongs to destination key; hold endpoint values outside range',
    layer: { required: 'id,kind,x,y,width,height', kinds: 'image/text/shape/particles', order: 'array back-to-front',
      optional: 'role(background/actor/foreground/prop/effect/credit), resourceId(image), text(text), color, shape(rect/ellipse/line), anchorX/Y, scaleX/Y(negative mirrors), rotation,opacity,startMs,endMs,space(world/screen),parallax(0..2),blend(source-over/lighter/screen/multiply)',
      keys: '{x/y/scaleX/scaleY/rotation/opacity/frame:[{atMs,value,ease?}]}',
      crop: '{x,y,width,height} source pixels', sheet: '{frameWidth,frameHeight,columns,count,fps,loop?}; frame keys select poses; crop and sheet exclusive',
      typography: '{fontSize?,weight?,align:left/center/right,typewriterMs?}', particles: '{preset:rain/snow/sparks/dust/stars,count,seed,speed?,size?}' },
    composition: 'width,height,layers; background?,letterbox(0..0.25)?, camera?, transition?, audioCues?',
    camera: '{x?,y?,zoom?,rotation?,keys:{x/y/zoom/rotation:[{atMs,value,ease?}]},shake:{atMs,durationMs,amplitude,frequency?,seed?}}',
    transition: '{kind:cut/fade/wipe-left/wipe-right/iris/flash,durationMs,color?}; reveals from color/black at shot entry, not a dissolve of previous shot',
    audio: '{id,resourceId,atMs,durationMs,volume(0..1)?,fadeInMs?,fadeOutMs?,offsetMs?,loop?}; separate timed cues; sequence music remains uninterrupted',
    entry: 'configure_opening_entry chooses one sequence location: new-game(default), before-title(first cold title visit; input dismisses), attract(title idle with repeat; any key dismisses without activating menu). One sequence, not simultaneous separate tracks.',
    playback: 'loading completes before clock starts; Skip/abort removes frame loop and all cues; reduced motion freezes camera/shake and positional motion, keeps narration and timing',
    preview: 'preview_opening_animatic returns real canvas frames to Pi; images inspect composition/time, native playback separately proves audio/Skip/handoff',
    example: { id: 'actor', kind: 'image', resourceId: 'actual_project_png', x: 500, y: 500, width: 180, height: 180, anchorX: 0.5, anchorY: 1, keys: { x: [{ atMs: 0, value: 350 }, { atMs: 3000, value: 650, ease: 'ease-in-out' }] } },
    boundaries: '2D animatic, sprite loops and registered video supported. No skeletal animation, 3D actor rig, automatic pose invention or synthetic voice promised.'
  } })),
  definition('get_opening_references', '조사한 게임/영상·연출기법·도구 대응표. query 또는 id.', 'read', schema({ query: str, id: str }, []), (_p, args) => {
    const q = String(args.query ?? '').toLowerCase(), rows = references as Record<string, unknown>[];
    const matches = rows.filter(r => (!args.id || r.id === args.id) && (!q || JSON.stringify(r).toLowerCase().includes(q)));
    return { summary: `조사 사례 ${matches.length}개. 공식/플레이 관찰/트레일러를 구별합니다.`, data: { cases: matches, exhaustiveAllGames: false, usage: 'Study composition/timing principles; author new assets/story. Source video is a reference, not project media.' } };
  }),
  definition('preview_opening_reference', '조사한 공식 영상의 실제 확인 프레임을 모델에 전달. 게임 소재가 아님.', 'read', schema({ id: str }), (_p, args) => {
    const row = (references as Record<string, unknown>[]).find(r => r.id === args.id);
    const frames = row?.referenceFrames as { path: string; timeSeconds: number; sourceUrl: string }[] | undefined;
    if (!frames?.length) throw new ToolError('이 사례는 실제 확인 프레임이 없습니다. 문헌 확인 범위를 읽으세요.', { code: 'reference-frames-unavailable' });
    return { summary: '연구용 실제 프레임 전달 요청. 프로젝트 리소스가 아닙니다.', data: { id: row!.id, frames: frames.slice(0, 4) } };
  }),
  definition('configure_opening_entry', '재생 위치:새 게임/최초 타이틀 전/타이틀 유휴 데모. 기존 샷 유지.', 'write', schema({ mode: { type: 'string', enum: ['new-game', 'before-title', 'attract'] }, idleMs: integer, repeatDelayMs: integer }, ['mode']), (p, args) => {
    if (!p.system.opening) throw new ToolError('먼저 오프닝을 저작하세요.', { code: 'opening-not-found' });
    if (!['new-game', 'before-title', 'attract'].includes(String(args.mode)) || typeof args.mode !== 'string') throw new ToolError('재생 위치 오류.', { code: 'invalid-args' });
    for (const name of ['idleMs', 'repeatDelayMs']) if (args[name] !== undefined && (!Number.isSafeInteger(args[name]) || Number(args[name]) < 1000 || Number(args[name]) > 300000)) throw new ToolError(name + ':1000..300000ms 정수 필요.', { code: 'invalid-args' });
    p.system.opening.entry = { mode: args.mode as 'new-game' | 'before-title' | 'attract', ...(args.idleMs !== undefined ? { idleMs: Number(args.idleMs) } : {}), ...(args.repeatDelayMs !== undefined ? { repeatDelayMs: Number(args.repeatDelayMs) } : {}) };
    return { summary: '재생 위치를 저장했습니다. before-title/attract는 새 게임에 같은 시퀀스를 중복 재생하지 않습니다.', data: { entry: p.system.opening.entry } };
  }),
  definition('create_opening_animatic_shot', '빈 합성 샷 추가. 교체는 replace:true 명시.', 'write', schema({ shotId: str, durationMs: integer, width: integer, height: integer, background: str, index: integer, replace: { type: 'boolean' }, narration: str }, ['shotId', 'durationMs']), (p, args) => {
    const id = text(args.shotId, 'shotId'), duration = Number(args.durationMs), opening = structuredClone(p.system.opening ?? { enabled: true, skippable: true, scenes: [] });
    const existing = opening.scenes.findIndex(s => s.id === id); if (existing >= 0 && args.replace !== true) throw new ToolError('기존 샷입니다. 명시적 replace:true 필요.', { code: 'scene-exists' });
    const s: Shot = { id, kind: 'animatic', durationMs: duration, narration: String(args.narration ?? ''), composition: { width: Number(args.width ?? 1280), height: Number(args.height ?? 720), background: String(args.background ?? '#000000'), layers: [] } }; check(p, s);
    if (existing >= 0) opening.scenes[existing] = s;
    else { if (opening.scenes.length >= CINEMATIC_SCENE_LIMIT) throw new ToolError('장면 수 초과.', { code: 'too-many-scenes' }); const index = args.index === undefined ? opening.scenes.length : Number(args.index); if (!Number.isSafeInteger(index) || index < 0 || index > opening.scenes.length) throw new ToolError('index 범위 오류.', { code: 'invalid-args' }); opening.scenes.splice(index, 0, s); }
    p.system.opening = opening; return { summary: '애니메틱 샷을 만들었습니다. 레이어·동작을 저작하세요.', data: { shotId: id, composition: s.composition } };
  }),
  definition('upsert_opening_layer', '그림/배우/글/도형/입자 레이어 추가·교체. 계약:get_animatic_capabilities.', 'write', schema({ shotId: str, layer: obj, index: integer }, ['shotId', 'layer']), (p, args) => {
    const s = shot(p, args.shotId), l = structuredClone(args.layer) as AnimaticLayer;
    if (!l || typeof l !== 'object' || Array.isArray(l)) throw new ToolError('layer 객체 필요.', { code: 'invalid-args' });
    const rows = s.composition.layers, at = rows.findIndex(row => row.id === l.id);
    if (at >= 0) rows[at] = l; else { const index = args.index === undefined ? rows.length : Number(args.index); if (!Number.isSafeInteger(index) || index < 0 || index > rows.length) throw new ToolError('index 범위 오류.', { code: 'invalid-args' }); rows.splice(index, 0, l); }
    return commit(p, s, '실제 합성 레이어를 저장했습니다.');
  }),
  definition('remove_opening_layer', '선택한 레이어만 제거.', 'write', schema({ shotId: str, layerId: str }), (p, args) => {
    const s = shot(p, args.shotId), id = text(args.layerId, 'layerId'); if (!s.composition.layers.some(l => l.id === id)) throw new ToolError('layerId 없음.', { code: 'layer-not-found' });
    s.composition.layers = s.composition.layers.filter(l => l.id !== id); return commit(p, s, '레이어를 제거했습니다.');
  }),
  definition('animate_opening_layer', '지정 속성의 key 배열 교체. 나머지 트랙 유지.', 'write', schema({ shotId: str, layerId: str, keys: obj }), (p, args) => {
    const s = shot(p, args.shotId), l = s.composition.layers.find(l => l.id === args.layerId); if (!l) throw new ToolError('layerId 없음.', { code: 'layer-not-found' });
    l.keys = { ...l.keys, ...structuredClone(args.keys as AnimaticTracks) }; return commit(p, s, '레이어 동작을 저장했습니다.');
  }),
  definition('apply_opening_motion', 'jump/float/pulse/run-across 동작 키 생성. 다른 트랙 유지.', 'write', schema({ shotId: str, layerId: str, preset: { type: 'string', enum: ['jump', 'float', 'pulse', 'run-across'] }, atMs: integer, durationMs: integer, amount: { type: 'number' } }, ['shotId', 'layerId', 'preset']), (p, args) => {
    const s = shot(p, args.shotId), l = s.composition.layers.find(l => l.id === args.layerId); if (!l) throw new ToolError('layerId 없음.', { code: 'layer-not-found' });
    const start = Number(args.atMs ?? 0), duration = Number(args.durationMs ?? s.durationMs), preset = String(args.preset), property = preset === 'run-across' ? 'x' : preset === 'pulse' ? 'scaleX' : 'y';
    const base = sampleAnimaticTrack(l.keys?.[property], start, property === 'scaleX' ? l.scaleX ?? 1 : l[property]), amount = Number(args.amount ?? (property === 'scaleX' ? 0.12 : preset === 'run-across' ? 300 : 35));
    const keys = preset === 'run-across' ? [{ atMs: start, value: base }, { atMs: start + duration, value: base + amount, ease: 'ease-in-out' as const }]
      : [{ atMs: start, value: base }, { atMs: Math.round(start + duration / 2), value: base + (property === 'y' ? -amount : amount), ease: 'ease-out' as const }, { atMs: start + duration, value: base, ease: 'ease-in' as const }];
    l.keys = { ...l.keys, [property]: keys }; if (preset === 'pulse') l.keys.scaleY = keys.map(k => ({ ...k, value: k.value + (l.scaleY ?? 1) - (l.scaleX ?? 1) }));
    return commit(p, s, '동작 키를 저장했습니다. 실제 시간 표본을 검토하세요.');
  }),
  definition('animate_opening_camera', '카메라 위치·줌·회전·키·흔들기 변경. 기존 속성 유지.', 'write', schema({ shotId: str, camera: obj }), (p, args) => {
    const s = shot(p, args.shotId), camera = args.camera as OpeningAnimatic['camera'];
    s.composition.camera = { ...s.composition.camera, ...structuredClone(camera), keys: { ...s.composition.camera?.keys, ...camera?.keys } };
    return commit(p, s, '카메라 타임라인을 저장했습니다.');
  }),
  definition('set_opening_transition', '샷 입장 cut/fade/wipe/iris/flash와 레터박스.', 'write', schema({ shotId: str, transition: obj, letterbox: { type: 'number' } }, ['shotId', 'transition']), (p, args) => {
    const s = shot(p, args.shotId); s.composition.transition = structuredClone(args.transition) as OpeningAnimatic['transition']; if (args.letterbox !== undefined) s.composition.letterbox = Number(args.letterbox); return commit(p, s, '샷 전환을 저장했습니다.');
  }),
  definition('upsert_opening_audio_cue', '시간별 효과음/음악 큐 추가·교체. 전체 BGM 유지.', 'write', schema({ shotId: str, cue: obj }), (p, args) => {
    const s = shot(p, args.shotId), cue = structuredClone(args.cue) as NonNullable<OpeningAnimatic['audioCues']>[number], rows = s.composition.audioCues ?? [];
    if (!cue || typeof cue !== 'object') throw new ToolError('cue 객체 필요.', { code: 'invalid-args' }); const at = rows.findIndex(c => c.id === cue.id); if (at >= 0) rows[at] = cue; else rows.push(cue); s.composition.audioCues = rows; return commit(p, s, '오디오 큐를 저장했습니다.');
  }),
  definition('remove_opening_audio_cue', '선택한 오디오 큐 제거.', 'write', schema({ shotId: str, cueId: str }), (p, args) => { const s = shot(p, args.shotId), id = text(args.cueId, 'cueId'); if (!s.composition.audioCues?.some(c => c.id === id)) throw new ToolError('cueId 없음.', { code: 'cue-not-found' }); s.composition.audioCues = s.composition.audioCues.filter(c => c.id !== id); return commit(p, s, '오디오 큐를 제거했습니다.'); }),
  definition('retime_opening_shot', '샷 길이와 모든 키·생존시간·오디오 큐를 비례 변경.', 'write', schema({ shotId: str, durationMs: integer }), (p, args) => {
    const s = shot(p, args.shotId), duration = Number(args.durationMs);
    s.composition = retimeOpeningAnimatic(s.composition, s.durationMs, duration); s.durationMs = duration;
    return commit(p, s, '샷과 종속 시간축을 함께 변경했습니다. 스프라이트 fps와 원본 음원은 유지됩니다.');
  }),
  definition('inspect_opening_timeline', '샷별 레이어·동작·포즈·큐·빈 무대 구조 검토.', 'read', schema({ shotId: str }, []), (p, args) => {
    let offset = 0; const shots = (p.system.opening?.scenes ?? []).map(s => { const startMs = offset; offset += s.durationMs; if (s.kind !== 'animatic') return { shotId: s.id, kind: s.kind, startMs, durationMs: s.durationMs };
      return { shotId: s.id, kind: s.kind, startMs, durationMs: s.durationMs, composition: s.composition, movingLayers: s.composition.layers.filter(l => Object.keys(l.keys ?? {}).some(k => k !== 'opacity') || (l.sheet?.fps ?? 0) > 0).map(l => l.id), warnings: s.composition.layers.length ? [] : ['레이어 없는 빈 무대'] }; }).filter(s => !args.shotId || s.shotId === args.shotId);
    return { summary: `타임라인 ${shots.length}샷, 시간은 ms. 구조 검토이며 재생 증거와 다릅니다.`, data: { shots, automaticDurationMs: (p.system.opening?.scenes ?? []).every(s => s.durationMs > 0 && s.kind !== 'video') ? offset : null } };
  }),
  definition('preview_opening_animatic', '현재 합성 샷의 실제 시간 표본을 모델에 전달. 최대4프레임.', 'read', schema({ shotId: str, atMs: { type: 'array', items: integer, maxItems: 4 } }, ['shotId']), (p, args) => {
    const s = shot(p, args.shotId), samples = args.atMs ?? [...new Set([0, Math.floor(s.durationMs / 3), Math.floor(s.durationMs * 2 / 3), s.durationMs])];
    if (!Array.isArray(samples) || !samples.length || samples.length > 4 || samples.some(t => !Number.isSafeInteger(t) || t < 0 || t > s.durationMs)) throw new ToolError('atMs는 샷 안의 정수시간1~4개여야 합니다.', { code: 'invalid-args' });
    check(p, s); return { summary: '실제 합성 프레임 전달을 요청했습니다.', data: { shotId: s.id, atMs: samples, resourceIds: animaticResourceIds(s.composition) } };
  }),
  definition('generate_opening_layer', '실제 독립 배경/배우/소품/전경 생성. Pi 브라우저 생성 연결 필요.', 'write', schema({ prompt: str, name: str, role: { type: 'string', enum: ['background', 'actor', 'prop', 'foreground'] }, referenceResourceIds: { type: 'array', items: str, maxItems: 2 }, artStyle: str, aspectRatio: { type: 'string', enum: ['16:9', '4:3', '1:1'] } }, ['prompt', 'role']), () => { throw new ToolError('실제 브라우저 이미지 생성 경로가 필요합니다.', { code: 'image-generation-unavailable' }); }),
];
