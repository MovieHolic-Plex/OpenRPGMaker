import { expect, it, vi } from 'vitest';
import { configureProjectInterviewBootPreparation, prepareProjectInterviewBootAssets } from '@/editor/projectInterviewBootPreparation';

it('shares the same boot preparation between folder startup and first generation', async () => {
  let ready!: () => void;
  const work = vi.fn(() => new Promise<void>(resolve => { ready = resolve; }));
  configureProjectInterviewBootPreparation(work);
  const startup = prepareProjectInterviewBootAssets();
  const generation = prepareProjectInterviewBootAssets();
  expect(startup).toBe(generation);
  await Promise.resolve();
  expect(work).toHaveBeenCalledOnce();
  ready();
  await startup;
  await prepareProjectInterviewBootAssets();
  expect(work).toHaveBeenCalledOnce();
});

it('retains a preparation failure so later callers cannot silently skip the fence', async () => {
  const work = vi.fn(async () => { throw new Error('reference failure'); });
  configureProjectInterviewBootPreparation(work);
  await expect(prepareProjectInterviewBootAssets()).rejects.toThrow('reference failure');
  await expect(prepareProjectInterviewBootAssets()).rejects.toThrow('reference failure');
  expect(work).toHaveBeenCalledOnce();
});
