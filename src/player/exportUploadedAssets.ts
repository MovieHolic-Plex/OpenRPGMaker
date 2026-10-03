import { withInlineAsset } from '@/assets/inlineAssetStore';
import { setUploadedAssetResolver } from '@/project/persistence/assetAccessors';
import type { Project, UploadedAssetRef } from '@/project/types';
import { webUploadedAssetPath } from '@/project/webUploadedAssetPath';

/** SQLite media refs survive project.json. In a shipped game their bytes belong
 * to the adjacent ZIP files, rather than an editor's project-folder bridge. */
export function installExportUploadedAssets(project: Project): void {
  const paths = new Map<string, string>();
  for (const asset of Object.values(project.assets.uploaded)) {
    if (asset.ref) paths.set(asset.ref.sha256, webUploadedAssetPath(asset));
  }
  const url = (ref: UploadedAssetRef): string => {
    const path = paths.get(ref.sha256);
    if (!path) throw new Error('Exported media ref is missing from the project');
    return withInlineAsset(path);
  };
  setUploadedAssetResolver(paths.size ? {
    url,
    bytes: async ref => {
      const response = await fetch(url(ref));
      if (!response.ok) throw new Error(`Exported media request failed (${response.status})`);
      return new Uint8Array(await response.arrayBuffer());
    },
  } : null);
}
