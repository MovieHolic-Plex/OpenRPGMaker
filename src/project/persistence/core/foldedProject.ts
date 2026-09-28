/**
 * 호스트가 보낸 **접힌** 프로젝트 문서를 푼다(electron/local-store/tilesetFold.ts 와 짝).
 *
 * 접힌 문서는 `tilesets` 칸마다 `{"$blob":"<sha256>"}` 만 들고, 본문은 내용 주소 `JSON.stringify(tileset)` 이다.
 * 호스트의 펼친 글(= `current_sha256` 의 원문)은 접힌 문서의 `tilesets` 자리에 본문을 순서대로 끼운 것이므로,
 * 접힌 문서를 파싱하고 타일셋 칸만 본문 파싱 결과로 바꾼 트리는 펼친 글을 `JSON.parse` 한 트리와 같다
 * (키 순서 포함 — 기존 키에 대입하면 자리가 유지된다). 렌더러는 81MB 글을 만들지도 받지도 않는다.
 */

const SHA_PATTERN = /^[0-9a-f]{64}$/;

export type FoldedDocument = {
  readonly document: Record<string, unknown>;
  /** 타일셋 id → 본문 sha, 문서 순서. */
  readonly tilesetShas: ReadonlyMap<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 호스트 판정(tilesetFold.ts `foldedTilesetShas`)과 같다: 모든 타일셋 칸이 표식일 때만 접힌 문서다. */
export function parseFoldedDocument(folded: string): FoldedDocument {
  const document: unknown = JSON.parse(folded);
  if (!isRecord(document) || !isRecord(document.tilesets)) throw new Error("접힌 프로젝트 문서에 tilesets 가 없습니다");
  const tilesetShas = new Map<string, string>();
  for (const [id, marker] of Object.entries(document.tilesets)) {
    const sha = isRecord(marker) && Object.keys(marker).length === 1 ? marker.$blob : undefined;
    if (typeof sha !== "string" || !SHA_PATTERN.test(sha)) throw new Error(`접힌 프로젝트 문서의 타일셋 ${id} 표식이 올바르지 않습니다`);
    tilesetShas.set(id, sha);
  }
  return { document, tilesetShas };
}

/**
 * `reuse(id, sha)` 가 객체를 주면 본문을 파싱하지 않고 그 객체를 그 자리에 둔다. 호출자는 그 객체가 같은 sha 본문을
 * 풀어 만든 것이고 그 뒤 고쳐지지 않았음을 보장해야 한다(persistence/electronRepository.ts 참조).
 */
export function unfoldedDocumentTree(
  folded: FoldedDocument,
  blobs: ReadonlyMap<string, string>,
  reuse?: (id: string, sha: string) => unknown,
): Record<string, unknown> {
  const tilesets: Record<string, unknown> = {};
  for (const [id, sha] of folded.tilesetShas) {
    const reused = reuse?.(id, sha);
    if (reused !== undefined) {
      tilesets[id] = reused;
      continue;
    }
    const body = blobs.get(sha);
    if (body === undefined) throw new Error(`타일셋 본문 ${sha} 가 없습니다`);
    tilesets[id] = JSON.parse(body) as unknown;
  }
  folded.document.tilesets = tilesets;
  return folded.document;
}

/**
 * HTTP 팀 호스트의 전송 전용 자산 표식. 업로드 자산의 `dataUrl` 을 `ASSET_BLOB_PREFIX + sha` 로 바꿔 보낸다.
 * sha 는 dataUrl 글의 SHA-256 이고, 본문은 `project.assetBlobs` 로 따로 받는다. 저장 행·문서 정체(sha)와는 무관하다 —
 * 편집기는 받은 즉시 원래 dataUrl 로 되돌리므로 편집·저장 경로는 예전과 같은 문서를 본다.
 * `data:` 로 시작하지 않으므로 실제 dataUrl 과 겹치지 않는다.
 */
export const ASSET_BLOB_PREFIX = "oprn-blob:";

/** 문서의 자산 표식: 본문 sha → 자산 id 들(같은 그림을 여러 자산이 쓸 수 있다). */
export function assetBlobOwners(document: Record<string, unknown>): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  const assets = document.assets;
  if (!isRecord(assets) || !isRecord(assets.uploaded)) return owners;
  for (const [id, asset] of Object.entries(assets.uploaded)) {
    if (!isRecord(asset) || typeof asset.dataUrl !== "string" || !asset.dataUrl.startsWith(ASSET_BLOB_PREFIX)) continue;
    const sha = asset.dataUrl.slice(ASSET_BLOB_PREFIX.length);
    owners.set(sha, [...(owners.get(sha) ?? []), id]);
  }
  return owners;
}

/** 문서 트리의 업로드 자산 표식을 본문으로 되돌린다. 모르는 표식이면 던진다(빈 그림으로 저장하지 않게). */
export function restoreAssetBlobs(document: Record<string, unknown>, blobs: ReadonlyMap<string, string>): void {
  const assets = document.assets;
  if (!isRecord(assets) || !isRecord(assets.uploaded)) return;
  for (const [id, asset] of Object.entries(assets.uploaded)) {
    if (!isRecord(asset) || typeof asset.dataUrl !== "string" || !asset.dataUrl.startsWith(ASSET_BLOB_PREFIX)) continue;
    const sha = asset.dataUrl.slice(ASSET_BLOB_PREFIX.length);
    const body = blobs.get(sha);
    if (body === undefined) throw new Error(`자산 ${id} 의 본문 ${sha} 가 없습니다`);
    asset.dataUrl = body;
  }
}
