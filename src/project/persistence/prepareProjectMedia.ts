import type { Project } from "../types";
import { dataUrlExtension, dataUrlMime, decodeDataUrlBytes } from "./core/dataUrl";
import { sameProjectTarget } from "./target";
import type { ProjectRepository } from "./types";

/** Prepare a privately owned seed before adoption. Commit files first; leave the open document intact on failure. */
export async function prepareProjectMedia(project: Project, repository: ProjectRepository): Promise<void> {
  if (!repository.supportsAssetRefs) return;
  const target = repository.currentTarget();
  if (!target) throw new Error("프로젝트 폴더가 연결되지 않았습니다.");
  const requireSameTarget = (): void => {
    const active = repository.currentTarget();
    if (!sameProjectTarget(target, active) || active?.projectId !== target.projectId) throw new Error("소재를 준비하는 동안 프로젝트 폴더가 바뀌었습니다. 다시 시작하세요.");
  };
  for (const [id, asset] of Object.entries(project.assets.uploaded)) {
    if (asset.ref || !asset.dataUrl) continue;
    requireSameTarget();
    const mime = dataUrlMime(asset.dataUrl) ?? "application/octet-stream";
    const { ref } = await repository.assets.put(decodeDataUrlBytes(asset.dataUrl), {
      mime, extension: dataUrlExtension(asset.dataUrl, mime), originalName: asset.name, kind: asset.kind,
    });
    if (!ref) throw new Error("소재 파일을 저장하지 못했습니다.");
    requireSameTarget();
    const { dataUrl: _inline, ...rest } = asset;
    project.assets.uploaded[id] = { ...rest, ref };
  }
  requireSameTarget();
}
