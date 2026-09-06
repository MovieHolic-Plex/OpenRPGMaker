import { defineConfig } from '@playwright/test';
import { join } from 'node:path';
export default defineConfig({
  testDir: join(process.cwd(),'test/e2e'), testMatch:'event-command-remediation-U05.spec.ts',
  workers:1, retries:0, timeout:360000, outputDir:join(process.env.U05_OWNED_ROOT!,'playwright-output'),
  reporter:[['list']], use:{baseURL:process.env.U05_EDITOR_URL,browserName:'firefox',headless:true,viewport:{width:1440,height:1000}},
});
