/** Browser-safe capture metadata validation, shared with repository admission/reload.
 * IDs are opaque. Only immutable raster references, never URLs or image bytes, live here.
 * The repository separately requires exact membership in input.artwork and checks bytes. */
export function parseReportAssets(value, check = (condition, message) => { if (!condition) throw new Error(message); }) {
  function record(v) {
    check(v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype, 'Invalid reportAssets object');
    check(Reflect.ownKeys(v).every(key => typeof key === 'string'
      && Object.getOwnPropertyDescriptor(v, key).enumerable && 'value' in Object.getOwnPropertyDescriptor(v, key)), 'Invalid reportAssets JSON property');
  }
  record(value);
  for (const ref of Object.values(value)) {
    record(ref);
    check(Object.keys(ref).sort().join(',') === 'byteLength,mediaType,sha256', 'Unexpected reportAssets reference field');
    check(typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256), 'Invalid reportAssets hash');
    check(Number.isSafeInteger(ref.byteLength) && ref.byteLength > 0, 'Invalid reportAssets byte length');
    check(typeof ref.mediaType === 'string' && /^image\/(png|jpeg|webp|gif)$/.test(ref.mediaType), 'Invalid reportAssets media type');
  }
  return value;
}
