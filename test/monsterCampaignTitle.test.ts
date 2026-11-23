import { describe, expect, it } from 'vitest';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
import { createBlankProject } from '@/project/defaults';

// 시각 QA D05: build_monster_game(create) 가 빈 프로젝트의 기본 이름 「새 프로젝트」를 meta.title·titleScreen.title 에 그대로 남겼다.
async function create(configure: (p: ReturnType<typeof createBlankProject>) => void, args: Record<string, unknown> = {}) {
  const project = createBlankProject();
  configure(project);
  const context = { project, currentMapId: project.startMapId };
  const result = await runToolAsync(context as never, 'build_monster_game', { mode: 'create', ...args });
  expect(result.ok, result.summary).toBe(true);
  // create reuses the shared original campaign and swaps context.project for it — read the built project from the context.
  return context.project;
}

// build_monster_game(create) 한 번이 #4934(겹치면 다른 씨앗으로 다시 짓기·천장/테두리 칠하기) 뒤 CI 에서 약 3초 → 9초가 됐다.
// 세 번 짓는 둘째 시험이 9.4s(04d5d878) → 28.2s(ci-vitest-files 45180506664 단독)로 기본 15s 를 넘는다. 이웃 몬스터 시험(180s)처럼 넉넉히 준다.
describe('build_monster_game create title', { timeout: 120_000 }, () => {
  it('names the game after the campaign instead of the blank-project default', async () => {
    const project = await create(() => {});
    expect(project.meta.title).not.toBe('새 프로젝트');
    expect(project.system.titleScreen?.title).toBe(project.meta.title);
  });

  it('prefers an explicit title, then the user-set project title, then the concept title', async () => {
    expect((await create(() => {}, { title: '달빛 원정' })).meta.title).toBe('달빛 원정');
    const named = await create(p => { p.meta.title = '내 게임'; });
    expect(named.meta.title).toBe('내 게임');
    expect(named.system.titleScreen?.title).toBe('내 게임');
    const concept = await create(p => { p.gameDesignBrief = { concept: { slug: 'x', title: '별빛 수집가', hook: '훅' } } as never; });
    expect(concept.meta.title).toBe('별빛 수집가');
    expect(concept.system.titleScreen?.title).toBe('별빛 수집가');
  });
});
