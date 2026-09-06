// Process-test instrumentation only: log calls, preserving the real Vite/service close promises.
import { registerHooks } from 'node:module';
const vite = import.meta.resolve('vite');
const service = new URL('../../../../scripts/lib/aiJobs/service.mjs', import.meta.url).href;
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'vite') return { shortCircuit: true, url: moduleUrl(`
    export * from ${JSON.stringify(vite)};
    import { createServer as create } from ${JSON.stringify(vite)};
    export async function createServer(options) {
      const server = await create(options), close = server.close.bind(server);
      server.close = () => { console.log('TASK7_PROBE_VITE_CLOSE'); return close(); };
      return server;
    }
  `) };
  if (specifier === '../../../../scripts/lib/aiJobs/service.mjs') return { shortCircuit: true, url: moduleUrl(`
    import { openAiJobsService as open } from ${JSON.stringify(service)};
    export async function openAiJobsService(options) {
      const service = await open(options), close = service.close.bind(service);
      service.close = () => { console.log('TASK7_PROBE_SERVICE_CLOSE'); return close(); };
      return service;
    }
  `) };
  return next(specifier, context);
} });
