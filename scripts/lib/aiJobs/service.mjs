import { homedir } from 'node:os';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { openAiJobsRepository } from './repository.mjs';
import { createAiJobsScheduler } from './scheduler.mjs';
import { createAiJobsHttpHandler } from './http.mjs';

/** Outside Vite's project root, public and dist, including Vite /@fs exposure. */
export function aiJobsDirectory(root = process.cwd()) {
  const id = createHash('sha256').update(resolve(root)).digest('hex').slice(0, 20);
  const directory = resolve(process.env.AI_JOBS_DIRECTORY || join(homedir(), '.local', 'state', 'rpg-zzu', 'ai-jobs', id));
  const within = relative(resolve(root), directory);
  if (within === '' || !within.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(within)) throw new Error('AI_JOBS_DIRECTORY must be outside the served project root');
  return directory;
}
export async function openAiJobsService({ directory, origins, executeJob, renderReport, dispatchProvider, unavailableReason, onError }) {
  const repository = await openAiJobsRepository({ directory });
  const scheduler = createAiJobsScheduler({ repository, executeJob, renderReport, dispatchProvider, unavailableReason, onError });
  const handler = createAiJobsHttpHandler({ repository, scheduler, origins, onError });
  scheduler.start();
  let closing;
  return { repository, scheduler, handler, close() {
    if (!closing) closing = (async () => { handler.close(); try { await scheduler.close(); } finally { await repository.close(); } })();
    return closing;
  } };
}
