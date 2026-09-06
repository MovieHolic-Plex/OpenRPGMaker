/** Display projection only. Full bytes/tile payloads remain inspectable through the
 * section's immutable snapshot/result/checkpoint reference, never copied per revision. */
export function reportData(value) {
  if (typeof value === 'string' && /^data:[^;,]+(?:;[^,]*)?,/.test(value)) return { retainedInSource: true, mediaType: value.slice(5, value.indexOf(';') > 0 ? value.indexOf(';') : value.indexOf(',')) };
  if (Array.isArray(value)) return value.map(reportData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['dataUrl', 'lowerTiles', 'upperTiles', 'lowerTileStacks', 'upperTileStacks'].includes(key))
    .map(([key, child]) => [key, reportData(child)]));
  return value;
}
