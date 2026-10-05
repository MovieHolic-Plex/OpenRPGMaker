import { parseMusicScore, renderOriginalMusic, musicWavDataUrl } from '@/assets/originalMusic';
import { genId } from '@/util/id';
import { setAudioDescriptionOverride } from '@/project/audioDescriptions';
import { ToolError, type ToolDefinition } from './types';

export const ORIGINAL_MUSIC_TOOLS: readonly ToolDefinition[] = [{
  name: 'generate_original_bgm', mode: 'write',
  description: 'recommend_bgm 후보가 이야기와 맞지 않을 때 직접 작곡한 악보를 실제 stereo WAV로 합성·등록한다. 외부 음악 모델이나 샘플을 쓰지 않는 원곡이다. 악보 tempo/bars와 piano/bell/strings/bass 트랙별 MIDI 음높이·박자·길이·셈여림을 작성한다. 가사 없음, 4/4, 최대90초/512음표. 반환된 resourceId를 set_opening.musicResourceId에 연결하고 재생 검수는 별도로 한다.',
  parameters: { type: 'object', additionalProperties: false, required: ['name', 'brief', 'score'], properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    brief: { type: 'string', minLength: 10, maxLength: 1200, description: '필요한 분위기·악기·전개·기존 후보가 맞지 않는 이유. 메타데이터를 들었다고 주장하지 않는다.' },
    score: { type: 'object', additionalProperties: false, required: ['tempo', 'bars', 'tracks'], properties: {
      tempo: { type: 'integer', minimum: 40, maximum: 160 }, bars: { type: 'integer', minimum: 4, maximum: 32 },
      tracks: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['instrument', 'gain', 'pan', 'notes'], properties: {
        instrument: { type: 'string', enum: ['piano', 'bell', 'strings', 'bass'] }, gain: { type: 'number', minimum: 0.05, maximum: 1 }, pan: { type: 'number', minimum: -1, maximum: 1 },
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
      draft.audioDescriptions = setAudioDescriptionOverride(draft.audioDescriptions, { kind: 'music', resourceId: id }, `${args.brief.trim()}\n조수 악보 작곡·내장 합성. ${score.tempo} BPM, 4/4 ${score.bars}마디, ${rendered.durationSeconds.toFixed(1)}초. 악기: ${score.tracks.map(t => t.instrument).join(', ')}. 곡 시작/끝 페이드가 있어 반복 경계는 무음이다.`);
      return { summary: `원곡 「${args.name.trim()}」을 실제 WAV로 생성·등록했습니다.`, data: { resourceId: id, durationSeconds: rendered.durationSeconds, tempo: score.tempo, instruments: score.tracks.map(t => t.instrument), bytes: rendered.bytes.length, peak: rendered.peak, rms: rendered.rms, source: 'model-authored score / built-in synthesis', playbackVerified: false } };
    } catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error), { code: 'invalid-args' }); }
  },
}];
