import { validateProjectReferences } from "../../io/references";
import type { Project } from '../../types';
import { canonicalJsonString } from './canonicalJson';
import type { MapSaveConflict } from './mapMerge';

const equal = (a: unknown, b: unknown): boolean => a === undefined || b === undefined
  ? a === b : canonicalJsonString(a) === canonicalJsonString(b);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Conservative three-way merge. Maps and individual DB records are atomic editing units.
 * Trees, ordered arrays and other roots conflict rather than inventing a semantic merge. */
export function mergeTeamProject(base: Project, local: Project, latest: Project):
  { kind: 'merged'; project: Project } | { kind: 'conflict'; conflicts: readonly MapSaveConflict[] } {
  const conflicts: MapSaveConflict[] = [];
  function merge(b: unknown, l: unknown, r: unknown, path: string[]): unknown {
    if (equal(l, b)) return r;
    if (equal(r, b) || equal(l, r)) return l;
    const dictionaries = path.length === 0 || (path.length === 1 && ['maps', 'database', 'tilesets'].includes(path[0]!));
    if (dictionaries && object(b) && object(l) && object(r)) {
      const result: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(b[key], l[key], r[key], [...path, key]);
        if (value !== undefined) Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
      }
      return result;
    }
    // Record arrays keep server order; local additions append. Reordering is atomic.
    if (path.length === 2 && path[0] === 'database' && Array.isArray(b) && Array.isArray(l) && Array.isArray(r)) {
      const records = (xs: unknown[]): xs is Array<Record<string, unknown> & { id: string }> =>
        xs.every(x => object(x) && typeof x.id === 'string') && new Set(xs.map(x => (x as {id: string}).id)).size === xs.length;
      if (records(b) && records(l) && records(r)) {
        const surviving = (xs: typeof b) => xs.filter(x => b.some(y => y.id === x.id)).map(x => x.id);
        const preserved = (xs: typeof b) => equal(surviving(xs), b.filter(x => xs.some(y => y.id === x.id)).map(x => x.id));
        if (preserved(l) && preserved(r)) {
          const bm = new Map(b.map(x => [x.id, x])), lm = new Map(l.map(x => [x.id, x])), rm = new Map(r.map(x => [x.id, x]));
          const ids = [...new Set([...r.map(x => x.id), ...l.map(x => x.id), ...b.map(x => x.id)])];
          return ids.map(id => merge(bm.get(id), lm.get(id), rm.get(id), [...path, id])).filter(x => x !== undefined);
        }
      }
    }
    const mapId = path[0] === 'maps' ? path[1]! : path.join('/');
    const named = object(l) ? l.name : undefined;
    conflicts.push({ mapId, name: typeof named === 'string' ? named : mapId });
    return l;
  }
  const project = merge(base, local, latest, []) as Project;
  return conflicts.length ? { kind: 'conflict', conflicts } : { kind: 'merged', project: structuredClone(project) };
}

export const validateMergedTeamProject = validateProjectReferences;
