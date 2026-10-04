import { dataUrlExtension, dataUrlMime, decodeDataUrlBytes } from "./core/dataUrl";
import type { ProjectRepository } from "./types";
import type { Project, UploadedAsset } from "../types";

const PUT_CONCURRENCY = 6;

/**
 * 문서 안의 인라인 업로드 자산(dataUrl)을 저장소 파일 참조(ref)로 바꾼 새 프로젝트를 만든다. 바꿀 것이 없으면 null.
 *
 * 왜 (2026-09-28 실측, 빈 폴더 새 프로젝트 + 팀 모드 마을): 편집기가 심은 새 문서에는 공용 그림 414장(85MB)이
 * dataUrl 로 들어 있다. 첫 저장이 성공하면 호스트가 저장 직후 그것을 파일로 떼어 문서를 다시 쓰고(리비전 +1),
 * 팀 폴링이 모르는 리비전을 보고 호스트 문서를 다시 받아 편집기 프로젝트를 통째로 바꿨다. 그 사이 시작된 조수
 * 실행은 기준 프로젝트가 바뀌었다고 판정해 시공 적용이 매번 stale-base 로 거부됐다(맵 0개). 로드 정규화에서
 * 먼저 떼면 호스트가 다시 쓸 것이 없고, 첫 저장 본문도 85MB 줄어든다.
 *
 * 원래 객체는 고치지 않는다 — 저장 기준본이 같은 자산 객체를 공유할 수 있다. 실패한 자산은 dataUrl 그대로 둔다
 * (호스트의 저장 뒤 분리가 여전히 뒷받침한다).
 */
export async function separateInlineUploadedMedia(
  project: Project,
  assets: ProjectRepository["assets"],
): Promise<{ readonly project: Project; readonly assetIds: readonly string[] } | null> {
  const pending = Object.entries(project.assets.uploaded)
    .filter(([, asset]) => !asset.ref && typeof asset.dataUrl === "string" && asset.dataUrl.startsWith("data:"));
  if (pending.length === 0) return null;
  const replaced = new Map<string, UploadedAsset>();
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < pending.length) {
      const [id, asset] = pending[cursor++]!;
      const dataUrl = asset.dataUrl!;
      const mime = dataUrlMime(dataUrl) ?? "application/octet-stream";
      try {
        const stored = await assets.put(decodeDataUrlBytes(dataUrl), {
          mime, extension: dataUrlExtension(dataUrl, mime), originalName: asset.name, kind: asset.kind,
        });
        const { dataUrl: _inline, ...rest } = asset;
        replaced.set(id, { ...rest, ref: stored.ref });
      } catch (error) {
        console.warn(`[media] 업로드 자산 '${id}' 을 파일로 옮기지 못해 문서에 그대로 둡니다.`, error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PUT_CONCURRENCY, pending.length) }, worker));
  if (replaced.size === 0) return null;
  const uploaded: Record<string, UploadedAsset> = {};
  for (const [id, asset] of Object.entries(project.assets.uploaded)) uploaded[id] = replaced.get(id) ?? asset;
  return {
    project: { ...project, assets: { ...project.assets, uploaded } },
    assetIds: pending.map(([id]) => id).filter((id) => replaced.has(id)),
  };
}
