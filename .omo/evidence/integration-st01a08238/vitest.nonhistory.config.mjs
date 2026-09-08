import { mergeConfig } from 'vitest/config';
import base from '../../../vitest.config.ts';
import { projection } from './history-projection.mjs';
export default mergeConfig(base, {
  plugins: [{ name: 'held-history-validation-only', enforce: 'pre', load(id) { return projection(id); } }],
});
