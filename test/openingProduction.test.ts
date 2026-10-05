import { describe, it, expect } from 'vitest';
import { parseCinematicDirection } from '@/project/cinematicDirection';
import { parseMusicScore, renderOriginalMusic, musicWavDataUrl } from '@/assets/originalMusic';
import { ORIGINAL_MUSIC_TOOLS } from '@/editor/tools/originalMusicTools';
import { createBlankProject } from '@/project/defaults';
import { serialize, deserialize } from '@/project/io';

const frames = [{ at: 0, x: 0.4, y: 0.5, scale: 1, opacity: 0, rotation: 0 }, { at: 1, x: 0.6, y: 0.4, scale: 1.1, opacity: 1, rotation: 15 }];
const layers = [{ resourceId: 'moving-watch', width: 0.2, depth: 'foreground', easing: 'ease-out', frames }];
const score = { tempo: 80, bars: 4, tracks: [{ instrument: 'piano', gain: 0.8, pan: -0.2, notes: [{ pitch: 60, beat: 0, duration: 2, velocity: 0.7 }, { pitch: 67, beat: 8, duration: 2, velocity: 0.6 }] }] };

describe('opening production data boundary', () => {
  it('preserves independent normalized actor frames through disabled sequence save/load', () => {
    const project = createBlankProject();
    project.assets.uploaded['moving-watch'] = { id: 'moving-watch', name: 'watch', kind: 'picture', dataUrl: 'data:image/png;base64,AAA=', meta: {} };
    project.system.opening = { enabled: false, skippable: true, scenes: [{ id: 'image', kind: 'image', resourceId: 'moving-watch', motion: 'none', narration: '', durationMs: 4000, direction: parseCinematicDirection({ layers }) }] };
    expect(deserialize(serialize(project)).system.opening).toEqual(project.system.opening);
  });
  it('rejects malformed time order, extra fields and nonfinite actor coordinates', () => {
    for (const wrong of [ { ...frames[1], at: 0 }, { ...frames[1], x: NaN }, { ...frames[1], script: 'execute' } ]) expect(() => parseCinematicDirection({ layers: [{ ...layers[0], frames: [frames[0], wrong] }] })).toThrow();
  });
  it('makes deterministic nonclipping stereo PCM and refuses an unbounded score', () => {
    const parsed = parseMusicScore(score), a = renderOriginalMusic(parsed), b = renderOriginalMusic(parsed);
    expect(a.bytes).toEqual(b.bytes);
    expect(new TextDecoder().decode(a.bytes.slice(0, 4))).toBe('RIFF');
    expect(a.durationSeconds).toBe(12); expect(a.peak).toBeLessThanOrEqual(0.81); expect(a.rms).toBeGreaterThan(0);
    expect(musicWavDataUrl(a.bytes)).toMatch(/^data:audio\/wav;base64,UklGR/);
    expect(() => parseMusicScore({ ...score, bars: 32, tempo: 40 })).toThrow();
    expect(() => parseMusicScore({ ...score, tracks: [{ ...score.tracks[0], notes: [{ ...score.tracks[0].notes[0], beat: 16 }] }] })).toThrow();
  });
  it('registers generated audio and description in the normal persistent project', () => {
    const project = createBlankProject();
    const result = ORIGINAL_MUSIC_TOOLS[0].run(project, { name: 'Clock memory', brief: 'Quiet original piano for a clock memory reveal.', score });
    const id = (result.data as { resourceId: string }).resourceId;
    expect(project.assets.uploaded[id].kind).toBe('music');
    expect(project.audioDescriptions?.music?.[id]).toContain('80 BPM');
    expect(deserialize(serialize(project)).assets.uploaded[id]).toEqual(project.assets.uploaded[id]);
  });
});
