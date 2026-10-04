import type { Project } from '@/project/types';
import { jsonEqual } from '@/util/structuralJson';
import { sha256HexBytes } from '@/util/sha256';

/** Only an exact inline-bytes → content-addressed-file substitution is storage-only.
 * Labels/revision/origin are insufficient: a real edit must still invalidate an active draft. */
export async function isMediaSeparationOnly(before: Project, after: Project): Promise<boolean> {
  const withoutUploads = (project: Project) => ({ ...project, assets: { ...project.assets, uploaded: {} } });
  if (!jsonEqual(withoutUploads(before), withoutUploads(after))) return false;
  const old = before.assets.uploaded, next = after.assets.uploaded;
  if (Object.keys(old).length !== Object.keys(next).length) return false;
  let changed = false;
  for (const [id, asset] of Object.entries(old)) {
    const replacement = next[id];
    if (!replacement) return false;
    if (jsonEqual(asset, replacement)) continue;
    if (!asset.dataUrl || asset.ref || replacement.dataUrl || !replacement.ref) return false;
    const { dataUrl, ref: _oldRef, ...oldFields } = asset;
    const { ref, dataUrl: _newData, ...newFields } = replacement;
    if (!jsonEqual(oldFields, newFields)) return false;
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/u.exec(dataUrl);
    if (!match || match[1] !== ref.mime) return false;
    try {
      const binary = atob(match[2]!);
      if (binary.length !== ref.bytes) return false;
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (await sha256HexBytes(bytes) !== ref.sha256) return false;
    } catch { return false; }
    changed = true;
  }
  return changed;
}
