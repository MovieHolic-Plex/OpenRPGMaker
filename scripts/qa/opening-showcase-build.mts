// 시연 오프닝 프로젝트를 실제 도구(runTool)로 짓는다: 그림 등록 → 원곡 BGM → 효과음 → set_opening. 직접 system.opening 을 대입하지 않는다.
// 사용: bun scripts/qa/opening-showcase-build.mts <showcaseDir> <directionJson> <outProjectJson>
import { readFileSync, writeFileSync } from 'node:fs';
import { createBlankProject } from '../../src/project/defaults';
import { runTool } from '../../src/editor/tools/toolRunner';
import { serialize, deserialize } from '../../src/project/io';

const [dir, directionFile, outFile] = process.argv.slice(2) as [string, string, string];
const direction = JSON.parse(readFileSync(directionFile, 'utf8')) as Record<string, { camera: unknown; effects: unknown[]; durationMs: number; narration: string; transition: unknown }>;
const project = createBlankProject();
project.meta.title = '별등 군도';
const ctx = { project };
const must = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); if (!r.ok) throw new Error(`${name}: ${r.summary}`); return r; };

const ids: string[] = [];
for (let i = 1; i <= 6; i++) {
  const bytes = readFileSync(`${dir}/shot${i}.png`);
  const id = `showcase_shot_${i}`; ids.push(id);
  must('upsert_resource', { resource: { id, name: `별등 군도 오프닝 ${i}`, kind: 'backdrop', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` } });
}

// 원곡: A단조, 60 BPM, 10마디(40초). 불씨 동기(E5-G5-D5)가 2·5·8마디에 돌아오고 7마디부터 플루트와 북이 출항을 민다.
const bell = (beat: number, up = 0, v = 0.5) => [[76, 0], [79, 1], [74, 2.5]].map(([p, o]) => ({ pitch: p + up, beat: beat + o, duration: o === 2.5 ? 2 : 1, velocity: v }));
const strings = [[45 + 12, 0], [52 + 12, 0], [41 + 12, 8], [48 + 12, 8], [43 + 12, 16], [50 + 12, 16], [45 + 12, 24], [52 + 12, 24], [41 + 12, 32], [48 + 12, 32]].flatMap(([p, b]) => [{ pitch: p!, beat: b!, duration: b! === 32 ? 8 : 8, velocity: 0.35 }]);
const bass = Array.from({ length: 10 }, (_, i) => ({ pitch: [45, 45, 41, 41, 43, 43, 45, 45, 41, 45][i]! - 0, beat: i * 4, duration: 4, velocity: 0.55 }));
const flute = [[69, 24], [72, 25.5], [76, 27], [74, 29], [72, 30], [69, 31], [76, 32], [79, 33.5], [76, 35], [74, 36], [69, 37.5]].map(([p, b]) => ({ pitch: p!, beat: b!, duration: 1.5, velocity: 0.5 }));
const drum = [24, 26, 28, 30, 32, 34, 36, 38].map(b => ({ pitch: 40, beat: b, duration: 0.5, velocity: 0.45 }));
const bgm = must('generate_original_bgm', { name: '별등 군도 오프닝', brief: '꺼진 등대에서 시작해 불씨를 안고 출항하기까지. 희박한 현악 지속음과 종(불씨 동기 E-G-D)이 반복되고, 후반에 플루트와 약한 북이 들어와 길을 민다.', score: { tempo: 60, bars: 10, loop: false, tracks: [
  { instrument: 'strings', gain: 0.5, pan: 0, notes: strings }, { instrument: 'bass', gain: 0.55, pan: 0, notes: bass },
  { instrument: 'bell', gain: 0.6, pan: 0.25, notes: [...bell(5), ...bell(20, 0, 0.55), ...bell(32, 12, 0.5)] }, { instrument: 'flute', gain: 0.55, pan: -0.2, notes: flute }, { instrument: 'drum', gain: 0.4, pan: 0, notes: drum },
] } }).data as { resourceId: string };
const crackle = must('generate_original_se', { name: '불씨 타닥', brief: '유리병 속 불씨가 아주 작게 튀는 소리. 짧은 잡음 세 번과 낮은 공명.', patch: { duration: 1.2, layers: [
  { wave: 'noise', at: 0, duration: 0.04, frequency: 3000, endFrequency: 1800, attack: 0.001, release: 0.03, gain: 0.35, pan: 0.2 },
  { wave: 'noise', at: 0.31, duration: 0.03, frequency: 3500, endFrequency: 2000, attack: 0.001, release: 0.02, gain: 0.25, pan: -0.1 },
  { wave: 'noise', at: 0.72, duration: 0.05, frequency: 2800, endFrequency: 1500, attack: 0.001, release: 0.04, gain: 0.3, pan: 0.15 },
  { wave: 'sine', at: 0, duration: 0.9, frequency: 110, endFrequency: 90, attack: 0.05, release: 0.6, gain: 0.12, pan: 0 },
] } }).data as { resourceId: string };

const scenes = ids.map((resourceId, i) => {
  const d = direction[String(i + 1)]!;
  return { id: `showcase-${i + 1}`, kind: 'image', resourceId, narration: d.narration, durationMs: d.durationMs, motion: 'none',
    presentation: { preset: 'subtitle', text: { layout: 'bottom', font: 'pixel', size: 14, color: '#f3ead2', animation: 'typewriter', delayMs: 700, revealMs: 1400, exitMs: 400 }, transition: { enter: i === 0 ? 'fade' : 'dissolve', enterMs: i === 0 ? 900 : 600, exitMs: i === 5 ? 900 : 0 }, letterbox: 8 },
    direction: { camera: d.camera, transition: d.transition, effects: d.effects, ...(i === 2 ? { soundResourceId: crackle.resourceId } : {}) } };
});
must('set_opening', { enabled: true, skippable: true, musicResourceId: bgm.resourceId, scenes });
const json = serialize(ctx.project); deserialize(json);
writeFileSync(outFile, json);
console.log(JSON.stringify({ bgm: bgm.resourceId, se: crackle.resourceId, scenes: scenes.length, totalMs: scenes.reduce((s, x) => s + x.durationMs, 0), bytes: json.length }));
