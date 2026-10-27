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

describe('build_monster_game create title', () => {
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
