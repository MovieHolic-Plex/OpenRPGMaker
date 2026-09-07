import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

// Reproduce the runtime's deferred import under Vite's real config loader.
export default {
  plugins: [{
    name: 'task8-runtime-import-diagnostic',
    async configureServer() {
      let stage = 'import';
      try {
        const module = await import('playwright');
        stage = 'executablePath';
        const executablePath = module.chromium.executablePath();
        stage = 'access';
        await access(executablePath, constants.X_OK);
        console.log('RUNNER_RUNTIME_PROBE', { executablePath, accessible: true });
      } catch (error) {
        console.error('RUNNER_RUNTIME_PROBE_ERROR', { stage, name: error.name, message: error.message, stack: error.stack });
        throw error;
      }
    },
  }],
};
