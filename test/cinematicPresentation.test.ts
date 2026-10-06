import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { deserialize, serialize } from '@/project/io';
import { parseCinematicPresentation, hasAuthoredTextOpening } from '@/project/cinematicPresentation';

describe('authored opening typography persistence', () => {
  it('preserves text/image/video presentation in disabled opening and game-over records', () => {
    const project = createBlankProject();
    const presentation = parseCinematicPresentation({ preset: 'memory', text: { animation: 'typewriter', color: '#aAbBcC', revealMs: 1700 }, transition: { enter: 'wipe', exitMs: 500 } });
    const scene = { id: 'letter', kind: 'text' as const, narration: '가족 👨‍👩‍👧‍👦 é <b>기억</b>', durationMs: 0, presentation };
    project.assets.uploaded.still = { id: 'still', name: 'Still', kind: 'picture', meta: {}, dataUrl: 'data:image/png;base64,AQID' };
    project.assets.uploaded.movie = { id: 'movie', name: 'Movie', kind: 'movie', meta: {}, dataUrl: 'data:video/mp4;base64,AQID' };
    project.system.opening = { enabled: false, skippable: true, scenes: [scene,
      { ...scene, id: 'still', kind: 'image', resourceId: 'still', motion: 'none' },
      { ...scene, id: 'movie', kind: 'video', resourceId: 'movie' },
    ] };
    project.system.gameOver = { sequence: structuredClone(project.system.opening) };
    const restored = deserialize(serialize(project));
    expect(restored.system.opening).toEqual(project.system.opening);
    expect(restored.system.gameOver).toEqual(project.system.gameOver);
    expect(serialize(restored)).toEqual(serialize(project));
  });

  it.each([
    { preset: 'invented' }, { text: { animation: 'script' } }, { text: { revealMs: Infinity } },
    { text: { revealMs: 0.5 } }, { text: { color: 'url(secret)' } }, { letterbox: 21 },
    { transition: { enterMs: 5001 } }, { text: { html: '<script>' } },
  ])('rejects malformed presentation at project load: %j', presentation => {
    const project = createBlankProject();
    const wire = JSON.parse(serialize(project));
    wire.system.opening = { enabled: true, skippable: true, scenes: [{ id: 'bad', kind: 'text', narration: 'bad', durationMs: 3000, presentation }] };
    expect(() => deserialize(JSON.stringify(wire))).toThrow();
  });

  it('accepts intentional varied typography and rejects unstyled black text', () => {
    const scenes = [{ kind: 'text', narration: '편지가 왔다.', presentation: { preset: 'prologue' as const } }, { kind: 'text', narration: '첫 번째 기억', presentation: { preset: 'chapter' as const } }];
    expect(hasAuthoredTextOpening(scenes)).toBe(true);
    expect(hasAuthoredTextOpening(scenes.map(scene => ({ ...scene, presentation: undefined })))).toBe(false);
    expect(hasAuthoredTextOpening([scenes[0], scenes[0]])).toBe(false);
  });
});
