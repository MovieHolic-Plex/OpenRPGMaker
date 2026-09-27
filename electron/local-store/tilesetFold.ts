import { createHash } from "node:crypto";

/**
 * 저장 행의 타일셋 접기.
 *
 * `project.current_json` 에는 타일셋 칸마다 `{"$blob":"<sha256>"}` 만 남기고, 본문(`JSON.stringify(tileset)`)은
 * `tileset_blobs` 에 내용 주소로 한 번만 둔다. 문서의 정체(`current_sha256`)와 내보내기 글은 **펼친 글** 기준이라
 * 지금과 바이트 단위로 같다 — 펼친 글 = 접힌 글의 표식 자리에 본문을 끼운 것 = `JSON.stringify(projectWireView(p))`.
 *
 * 왜(2026-09-27 실측, 82MB 프로젝트): 문서 81.6MB 중 80.7MB 가 타일셋이고 저장마다 호스트가 그 전체를
 * 파싱 두 번·직렬화·해시·81MB 행 쓰기로 다시 만졌다(저장 한 번 3.6–11.7s). 접으면 행은 약 1MB 이고,
 * 바뀐 타일셋만 새로 직렬화·기록한다.
 */

export type TilesetBlob = { readonly sha256: string; readonly text: string };

export type FoldedDocument = {
  readonly folded: string;
  /** 펼친 글의 SHA-256 — 예전 `current_sha256` 과 같은 값. */
  readonly sha256: string;
  readonly tilesetShas: ReadonlyMap<string, string>;
  readonly blobs: ReadonlyMap<string, string>;
  readonly full: () => string;
};

const MARKER_KEY = "$blob";
/** 표식의 앞부분. JSON 문자열 안에서는 `"` 가 이스케이프되므로 이 글은 실제 객체 구조로만 나타난다. */
const MARKER_PREFIX = '{"$blob":"';
const SHA_PATTERN = /^[0-9a-f]{64}$/;

export function sha256HexOfText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function blobOfText(text: string): TilesetBlob {
  return { sha256: sha256HexOfText(text), text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 문서를 접는다. `view` 는 `projectWireView(project)` 이거나, 같은 키 순서를 가진 파싱한 문서다.
 * 글은 `JSON.stringify(view)` 와 같은 규칙으로 조각마다 만든다: 키 순서 그대로, 값이 JSON 이 아니면(undefined 등) 키를 뺀다.
 * `tilesetBlob` 은 타일셋 값 하나의 본문을 준다 — 이미 아는 객체면 기억한 본문을, 아니면 `JSON.stringify` 한 것을.
 */
export function foldDocument(view: Record<string, unknown>, tilesetBlob: (value: unknown) => TilesetBlob): FoldedDocument {
  const hash = createHash("sha256");
  const foldedPieces: string[] = [];
  const fullPieces: string[] = [];
  const tilesetShas = new Map<string, string>();
  const blobs = new Map<string, string>();
  const emit = (fullPiece: string, foldedPiece: string): void => {
    hash.update(fullPiece, "utf8");
    fullPieces.push(fullPiece);
    foldedPieces.push(foldedPiece);
  };
  emit("{", "{");
  let separator = "";
  for (const key of Object.keys(view)) {
    const value = view[key];
    if (key === "tilesets" && isRecord(value)) {
      const head = `${separator}${JSON.stringify(key)}:{`;
      emit(head, head);
      let inner = "";
      for (const id of Object.keys(value)) {
        const tileset = value[id];
        if (tileset === undefined || typeof tileset === "function" || typeof tileset === "symbol") continue;
        const blob = tilesetBlob(tileset);
        tilesetShas.set(id, blob.sha256);
        blobs.set(blob.sha256, blob.text);
        const prefix = `${inner}${JSON.stringify(id)}:`;
        emit(prefix + blob.text, prefix + JSON.stringify({ [MARKER_KEY]: blob.sha256 }));
        inner = ",";
      }
      emit("}", "}");
      separator = ",";
      continue;
    }
    const text = JSON.stringify(value);
    if (text === undefined) continue;
    const piece = `${separator}${JSON.stringify(key)}:${text}`;
    emit(piece, piece);
    separator = ",";
  }
  emit("}", "}");
  let full: string | null = null;
  return {
    folded: foldedPieces.join(""),
    sha256: hash.digest("hex"),
    tilesetShas,
    blobs,
    full: () => (full ??= fullPieces.join("")),
  };
}

export function foldedTilesetShas(raw: string): { readonly document: Record<string, unknown>; readonly shas: ReadonlyMap<string, string> } | null {
  if (!raw.includes(MARKER_PREFIX)) return null;
  const document: unknown = JSON.parse(raw);
  if (!isRecord(document) || !isRecord(document.tilesets)) return null;
  const entries = Object.entries(document.tilesets);
  if (entries.length === 0) return null;
  const shas = new Map<string, string>();
  for (const [id, value] of entries) {
    if (!isRecord(value) || Object.keys(value).length !== 1) return null;
    const sha = value[MARKER_KEY];
    if (typeof sha !== "string" || !SHA_PATTERN.test(sha)) return null;
    shas.set(id, sha);
  }
  return { document, shas };
}

/**
 * 클라이언트가 보낸 글을 접는다. 접은 것을 다시 펼친 글이 보낸 글과 정확히 같을 때만 접고,
 * 아니면(들여쓰기 등 다른 형식) 보낸 글을 그대로 둔다 — 저장된 글과 해시는 언제나 보낸 글의 것이다.
 */
export function foldSubmittedText(serialized: string): FoldedDocument {
  const parsed: unknown = JSON.parse(serialized);
  if (isRecord(parsed) && isRecord(parsed.tilesets) && Object.keys(parsed.tilesets).length > 0) {
    const folded = foldDocument(parsed, (value) => blobOfText(JSON.stringify(value)));
    if (folded.full() === serialized) return folded;
  }
  return unfoldedDocument(serialized);
}

export function unfoldedDocument(serialized: string): FoldedDocument {
  return {
    folded: serialized,
    sha256: sha256HexOfText(serialized),
    tilesetShas: new Map(),
    blobs: new Map(),
    full: () => serialized,
  };
}

/** 모든 하위 객체를 얼린다. 기억한 본문과 객체가 영원히 같은 내용이어야 신원(===)으로 본문을 재사용할 수 있다. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
