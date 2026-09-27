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

export function unfoldedDocumentTree(folded: FoldedDocument, blobs: ReadonlyMap<string, string>): Record<string, unknown> {
  const tilesets: Record<string, unknown> = {};
  for (const [id, sha] of folded.tilesetShas) {
    const body = blobs.get(sha);
    if (body === undefined) throw new Error(`타일셋 본문 ${sha} 가 없습니다`);
    tilesets[id] = JSON.parse(body) as unknown;
  }
  folded.document.tilesets = tilesets;
  return folded.document;
}
