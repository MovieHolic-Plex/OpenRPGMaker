import { beforeEach, expect, it, vi } from 'vitest';
import { store } from '@/project/store';
import { claimProjectInterviewExecution } from '@/editor/projectInterviewExecutionClaim';
import { interviewBrief } from './helpers/gameDesignBrief';
import type { Project } from '@/project/types';

vi.mock('@/project/store', () => ({store:{getCurrent:vi.fn(),getProjectIdentity:vi.fn(),update:vi.fn(),flush:vi.fn()}}));
let project: Project;
beforeEach(() => {
  vi.clearAllMocks();
  project = {gameDesignBrief:{...interviewBrief(),generationPending:true}} as Project;
  vi.mocked(store.getCurrent).mockImplementation(() => project);
  vi.mocked(store.getProjectIdentity).mockReturnValue({kind:'remote',id:'new-folder'});
  vi.mocked(store.update).mockImplementation(fn => {fn(project);});
  vi.mocked(store.flush).mockResolvedValue({kind:'saved'} as Awaited<ReturnType<typeof store.flush>>);
});
it('claims and saves before capture, and restores the marker after a pre-worker failure', async () => {
  const claim = await claimProjectInterviewExecution();
  expect(project.gameDesignBrief?.generationPending).toBeUndefined();
  expect(store.flush).toHaveBeenCalledOnce();
  await claim!.restore();
  expect(project.gameDesignBrief?.generationPending).toBe(true);
  expect(store.flush).toHaveBeenCalledTimes(2);
});
it('refuses dispatch and retains the retry marker when the canonical save fails', async () => {
  vi.mocked(store.flush).mockRejectedValue(new Error('disk full'));
  expect(await claimProjectInterviewExecution()).toBeNull();
  expect(project.gameDesignBrief?.generationPending).toBe(true);
});
it('never restores into another project after a failed worker request', async () => {
  const claim = await claimProjectInterviewExecution();
  vi.mocked(store.getProjectIdentity).mockReturnValue({kind:'remote',id:'other-folder'});
  await claim!.restore();
  expect(project.gameDesignBrief?.generationPending).toBeUndefined();
});
it('never restores an old brief after the author changes the confirmed direction', async () => {
  const claim = await claimProjectInterviewExecution();
  project.gameDesignBrief!.summary = '새 기획';
  await claim!.restore();
  expect(project.gameDesignBrief?.generationPending).toBeUndefined();
});
it('refuses dispatch when projects switch during the save', async () => {
  vi.mocked(store.flush).mockImplementation(async () => {
    vi.mocked(store.getProjectIdentity).mockReturnValue({kind:'remote',id:'other-folder'});
    return {kind:'saved'} as Awaited<ReturnType<typeof store.flush>>;
  });
  expect(await claimProjectInterviewExecution()).toBeNull();
});
