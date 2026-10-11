// 오프닝 제작 실행기가 바이블·앵글 다양성을 실제로 거르는지 보는 시연(모델 호출 없음).
import { PiOpeningProduction } from '../../src/ai/piAgent/openingProduction';
const scenes = [1, 2, 3, 4].map(i => ({ id: `s${i}`, kind: 'text', narration: `컷 ${i}`, durationMs: 3000 }));
const mk = (n: number) => ({ system: { opening: { enabled: true, skippable: true, scenes: scenes.slice(0, n) } }, meta: {}, assets: { uploaded: {} } }) as never;
const base = { system: { opening: undefined }, meta: {}, assets: { uploaded: {} } } as never;
const shots = (angles: string[]) => angles.map((angle, i) => ({ event: `e${i}`, composition: 'c', continuity: 'k', angle }));
const bible = { premise: 'p', question: 'q', motifs: ['금 간 별등'], palette: '잉크 청 + 불씨 하나', artStyle: '16-bit pixel art', voice: '짧은 과거형, 설명 금지' };
const run = (name: string, args: Record<string, unknown>) => {
  const p = new PiOpeningProduction(true, '오프닝 새로 만들어줘'); const project = mk(4);
  p.record('plan_opening', true, project, args); p.record('review_opening', true, project);
  console.log(JSON.stringify({ case: name, issues: p.inspect(project, base).filter(i => !i.includes('설정이 요청 전과')), autofill: p.withBible({ prompt: 'x' }) }, null, 1));
};
run('바이블 없음 + 앵글 전부 같음', { intent: 'i', entry: 'e', shots: shots(['eye level', 'eye level', 'eye level', 'eye level']) });
run('바이블 있음 + 앵글 다양', { intent: 'i', entry: 'e', bible, shots: shots(['low angle', 'through a doorway', 'top-down', 'high overhead']) });
