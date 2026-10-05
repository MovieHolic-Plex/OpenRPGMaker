import { parseMusicScore, renderOriginalMusic, musicWavDataUrl } from '@/assets/originalMusic';
import { parseSoundPatch, renderOriginalSound } from '@/assets/originalSound';
import { resolveMapBgm } from '@/project/mapMusic';
import { listAudioResources } from '@/assets/audioResourceCatalog';
import { genId } from '@/util/id';
import { setAudioDescriptionOverride } from '@/project/audioDescriptions';
import { ToolError, type ToolDefinition } from './types';

export const ORIGINAL_MUSIC_TOOLS: readonly ToolDefinition[] = [{
  name: 'generate_original_bgm', mode: 'write',
  description: '맵·타이틀·오프닝·전투 OST를 직접 작곡한 악보로 실제 stereo WAV 합성·등록한다. 사용자 원곡 요청 또는 장면에 맞는 후보가 없거나 기존 곡 반복이 부적합하면 적극 사용한다. get_soundtrack으로 기존 배치를 읽고 장소별 리듬/악기/화성을 변주한다. 외부 음악 모델이나 샘플은 쓰지 않는다. 4/4, 최대90초/512음표, piano/bell/strings/bass/flute/pluck/drum. 맵은 score.loop:true(경계 무음 없음), resourceId를 set_map_properties({mapId,bgm:{mode:"custom",resourceId}})에 연결. 타이틀 set_title_screen.musicResourceId, 오프닝 set_opening.musicResourceId, 전투 set_project_settings.resources.battleBgmResourceId에 연결. 생성만 하고 끝내지 말고 저장·재생 검수한다.',
  parameters: { type: 'object', additionalProperties: false, required: ['name', 'brief', 'score'], properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    brief: { type: 'string', minLength: 10, maxLength: 1200, description: '필요한 분위기·악기·전개·기존 후보가 맞지 않는 이유. 메타데이터를 들었다고 주장하지 않는다.' },
    score: { type: 'object', additionalProperties: false, required: ['tempo', 'bars', 'tracks'], properties: {
      tempo: { type: 'integer', minimum: 40, maximum: 160 }, bars: { type: 'integer', minimum: 4, maximum: 32 },
      loop: { type: 'boolean', description: '맵 등 반복 OST는 true. 끝 음의 잔향이 다음 주기 시작으로 이어지고 전체 시작/끝 페이드를 넣지 않는다.' },
      tracks: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['instrument', 'gain', 'pan', 'notes'], properties: {
        instrument: { type: 'string', enum: ['piano', 'bell', 'strings', 'bass', 'flute', 'pluck', 'drum'] }, gain: { type: 'number', minimum: 0.05, maximum: 1 }, pan: { type: 'number', minimum: -1, maximum: 1 },
        notes: { type: 'array', minItems: 1, maxItems: 128, items: { type: 'object', additionalProperties: false, required: ['pitch', 'beat', 'duration', 'velocity'], properties: {
          pitch: { type: 'integer', minimum: 36, maximum: 96 }, beat: { type: 'number', minimum: 0, maximum: 128 },
          duration: { type: 'number', minimum: 0.125, maximum: 8 }, velocity: { type: 'number', minimum: 0.05, maximum: 1 },
        } } },
      } } },
    } },
  } },
  run(draft, args) {
    try {
      if (typeof args.name !== 'string' || !args.name.trim() || args.name.length > 80 || typeof args.brief !== 'string' || args.brief.trim().length < 10 || args.brief.length > 1200) throw new TypeError('곡 제목과 작곡 의도가 필요합니다.');
      const score = parseMusicScore(args.score), rendered = renderOriginalMusic(score), id = genId('original_bgm');
      draft.assets.uploaded[id] = { id, kind: 'music', name: args.name.trim(), dataUrl: musicWavDataUrl(rendered.bytes), meta: {} };
      draft.audioDescriptions = setAudioDescriptionOverride(draft.audioDescriptions, { kind: 'music', resourceId: id }, `${args.brief.trim()}\n조수 악보 작곡·내장 합성. ${score.tempo} BPM, 4/4 ${score.bars}마디, ${rendered.durationSeconds.toFixed(1)}초. 악기: ${score.tracks.map(t => t.instrument).join(', ')}. ${score.loop ? '순환 잔향 포함 반복용 OST. 반복 경계에 강제 무음 없음.' : '곡 시작/끝 페이드가 있어 반복 경계는 무음이다.'}`);
      return { summary: `원곡 「${args.name.trim()}」을 실제 WAV로 생성·등록했습니다.`, data: { resourceId: id, durationSeconds: rendered.durationSeconds, tempo: score.tempo, instruments: score.tracks.map(t => t.instrument), bytes: rendered.bytes.length, peak: rendered.peak, rms: rendered.rms, source: 'model-authored score / built-in synthesis', playbackVerified: false } };
    } catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error), { code: 'invalid-args' }); }
  },
}, {
  name: 'generate_original_se', mode: 'write',
  description: '키보드 커서·확정·취소와 오프닝 장면 효과음을 조수가 직접 음색/주파수 변화/시간/셈여림으로 설계해 실제 stereo WAV로 생성한다. patch.duration 0.02~5초, layers 1~8. UI 커서는 0.03~0.10초의 조용한 소리, 확정은 짧은 2음 등 구분한다. 반환 resourceId를 set_title_screen.sounds의 cursorSeResourceId/confirmSeResourceId/cancelSeResourceId 또는 image 장면 direction.soundResourceId, 컷신 se/event playSound에 연결. 생성만으로 재생되지 않는다. 외부 오디오 모델이 아닌 내장 합성이다.',
  parameters: { type: 'object', additionalProperties: false, required: ['name', 'brief', 'patch'], properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 }, brief: { type: 'string', minLength: 10, maxLength: 1200 },
    patch: { type: 'object', additionalProperties: false, required: ['duration', 'layers'], properties: {
      duration: { type: 'number', minimum: 0.02, maximum: 5 },
      layers: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', additionalProperties: false,
        required: ['wave', 'at', 'duration', 'frequency', 'endFrequency', 'attack', 'release', 'gain', 'pan'], properties: {
          wave: { type: 'string', enum: ['sine', 'triangle', 'square', 'bell', 'noise'] },
          at: { type: 'number', minimum: 0, maximum: 5 }, duration: { type: 'number', minimum: 0.01, maximum: 5 },
          frequency: { type: 'number', minimum: 30, maximum: 8000 }, endFrequency: { type: 'number', minimum: 30, maximum: 8000 },
          attack: { type: 'number', minimum: 0.001, maximum: 5 }, release: { type: 'number', minimum: 0.001, maximum: 5 },
          gain: { type: 'number', minimum: 0.01, maximum: 1 }, pan: { type: 'number', minimum: -1, maximum: 1 },
        } } },
    } },
  } },
  run(draft, args) {
    try {
      if (typeof args.name !== 'string' || !args.name.trim() || args.name.length > 80 || typeof args.brief !== 'string' || args.brief.trim().length < 10 || args.brief.length > 1200) throw new TypeError('효과음 이름과 의도가 필요합니다.');
      const patch = parseSoundPatch(args.patch), rendered = renderOriginalSound(patch), id = genId('original_se');
      draft.assets.uploaded[id] = { id, kind: 'sound', name: args.name.trim(), dataUrl: musicWavDataUrl(rendered.bytes), meta: {} };
      draft.audioDescriptions = setAudioDescriptionOverride(draft.audioDescriptions, { kind: 'sound', resourceId: id }, `${args.brief.trim()}\n조수 음향 설계·내장 합성. ${rendered.durationSeconds.toFixed(3)}초. ${patch.layers.map(l => l.wave).join(', ')}.`);
      return { summary: `효과음 「${args.name.trim()}」을 WAV로 생성했습니다.`, data: { resourceId: id, ...rendered, bytes: rendered.bytes.length, source: 'model-authored patch / built-in synthesis', playbackVerified: false } };
    } catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error), { code: 'invalid-args' }); }
  },
}, {
  name: 'get_soundtrack', mode: 'read',
  description: '현재 맵별 BGM·타이틀·오프닝·전투·타이틀 키 입력 효과음 배치를 읽는다. 같은 곡을 무조건 재사용하지 말고 장소 분위기가 바뀌면 원곡/변주를 계획한다.',
  parameters: { type: 'object', additionalProperties: false, properties: {} },
  run(project) {
    const music = new Map(listAudioResources('music', project).map(r => [r.id, r]));
    const maps = Object.values(project.maps).map(m => ({ mapId: m.id, name: m.name, bgm: m.bgm ?? { mode: 'parent' }, effective: resolveMapBgm(project, m.id) }));
    const usages = new Map<string, string[]>();
    const use = (id: string | undefined, target: string) => { if (id) usages.set(id, [...(usages.get(id) ?? []), target]); };
    for (const map of maps) use(map.effective.kind === 'play' ? map.effective.resourceId : undefined, map.mapId);
    use(project.system.titleScreen?.musicResourceId, 'title'); use(project.system.opening?.musicResourceId, 'opening'); use(project.system.battleBgmResourceId, 'battle');
    return { summary: `${maps.length}개 맵의 음악·효과음 배치입니다.`, data: { maps, titleSounds: project.system.titleScreen?.sounds,
      tracks: [...usages].map(([resourceId, targets]) => ({ resourceId, targets, name: music.get(resourceId)?.name, description: music.get(resourceId)?.description ?? '' })) } };
  },
}];
