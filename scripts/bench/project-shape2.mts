/** spatialAuthoring 하위 키별 크기·clone ms. */
import { loadLagProject } from './lib/lagLoad.mts';

const { project } = await loadLagProject(process.env.LAG_PROJECT_DIR ?? '/tmp/lag-proj-b');
const sa = (project as unknown as Record<string, unknown>).spatialAuthoring as Record<string, unknown>;
const walk = (label: string, v: unknown, depth: number): void => {
  const t = performance.now();
  const bytes = JSON.stringify(v)?.length ?? 0;
  const t1 = performance.now();
  structuredClone(v);
  const ms = performance.now() - t1;
  const kind = Array.isArray(v) ? `array(${v.length})` : typeof v === 'object' && v ? `object(${Object.keys(v).length})` : typeof v;
  if (bytes > 20000) console.log(`${'  '.repeat(depth)}${label} ${kind} ${bytes}B clone ${ms.toFixed(1)}ms`);
  if (depth < 2 && v && typeof v === 'object' && !Array.isArray(v)) for (const k of Object.keys(v)) walk(k, (v as Record<string, unknown>)[k], depth + 1);
  void t;
};
walk('spatialAuthoring', sa, 0);
process.exit(0);
