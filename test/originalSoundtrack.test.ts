import { describe, expect, it } from 'vitest';
import { parseMusicScore, renderOriginalMusic } from '@/assets/originalMusic';
import { parseSoundPatch, renderOriginalSound } from '@/assets/originalSound';
import { ORIGINAL_MUSIC_TOOLS } from '@/editor/tools/originalMusicTools';
import { createBlankProject } from '@/project/defaults';
import { serialize, deserialize } from '@/project/io';
import { resolveMapBgm } from '@/project/mapMusic';

const score = { tempo: 120, bars: 4, loop: true, tracks: [{ instrument: 'strings', gain: 0.6, pan: 0,
  notes: [{ pitch: 60, beat: 0, duration: 2, velocity: 0.5 }, { pitch: 67, beat: 15, duration: 1, velocity: 0.5 }] }] };
const patch = { duration: 0.08, layers: [{ wave: 'triangle', at: 0, duration: 0.08, frequency: 900, endFrequency: 500, attack: 0.002, release: 0.06, gain: 0.15, pan: 0 }] };
const generate = (name: string) => ORIGINAL_MUSIC_TOOLS.find(t => t.name === name)!;

describe('authored soundtrack delivery', () => {
  it('carries the last note release over the loop boundary without a master fade to silence', () => {
    const loop = renderOriginalMusic(parseMusicScore(score));
    const intro = renderOriginalMusic(parseMusicScore({ ...score, loop: false }));
    const pcm = new DataView(loop.bytes.buffer), faded = new DataView(intro.bytes.buffer);
    const energy = (view: DataView, start: number, count: number) => {
      let sum = 0;
      for (let i = start; i < start + count; i++) sum += Math.abs(view.getInt16(44 + i * 4, true));
      return sum;
    };
    expect(energy(pcm, 0, 2205)).toBeGreaterThan(energy(faded, 0, 2205));
    expect(energy(pcm, (loop.bytes.length - 44) / 4 - 2205, 2205)).toBeGreaterThan(0);
    expect(loop.peak).toBeLessThanOrEqual(0.81);
  });
  it('preserves quiet, deterministic sound patches and rejects overruns/nonfinite inputs', () => {
    const a = renderOriginalSound(parseSoundPatch(patch)), b = renderOriginalSound(parseSoundPatch(patch));
    expect(a.bytes).toEqual(b.bytes); expect(a.durationSeconds).toBe(0.08);
    expect(a.peak).toBeGreaterThan(0); expect(a.peak).toBeLessThan(0.08);
    for (const layer of [{ ...patch.layers[0], at: 0.03 }, { ...patch.layers[0], frequency: NaN }, { ...patch.layers[0], release: 0.08 }]) {
      expect(() => parseSoundPatch({ ...patch, layers: [layer] })).toThrow();
    }
  });
  it('saves actual music and SE bytes with map/title references and plays the same map selection after reload', () => {
    const project = createBlankProject();
    const music = generate('generate_original_bgm').run(project, { name: 'Quiet study', brief: 'A repeating memory motif for the study.', score }).data as { resourceId: string };
    const sound = generate('generate_original_se').run(project, { name: 'Clock key', brief: 'A quiet clock click for the title cursor.', patch }).data as { resourceId: string };
    project.maps[project.startMapId].bgm = { mode: 'custom', resourceId: music.resourceId };
    project.system.titleScreen!.sounds = { cursorSeResourceId: sound.resourceId };
    const loaded = deserialize(serialize(project));
    expect(resolveMapBgm(loaded, loaded.startMapId)).toMatchObject({ kind: 'play', resourceId: music.resourceId });
    expect(loaded.assets.uploaded).toEqual(project.assets.uploaded);
    expect(loaded.system.titleScreen!.sounds).toEqual(project.system.titleScreen!.sounds);
    expect(loaded.audioDescriptions?.music?.[music.resourceId]).toContain('반복 경계에 강제 무음 없음');
  });
});
