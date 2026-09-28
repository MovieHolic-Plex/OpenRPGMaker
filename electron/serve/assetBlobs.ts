// HTTP 팀 호스트의 자산 떼기. 접힌 행의 업로드 자산 dataUrl 을 내용 주소 표식으로 바꿔 보내고, 본문은 따로 준다.
//
// 왜 전송 계층에만 두나: 저장 행·문서 정체(current_sha256)·로컬 IPC 경로는 그대로다. 참여 창은 받은 즉시 원래 dataUrl 로
// 되돌린다(src/project/persistence/core/foldedProject.ts restoreAssetBlobs). 실측(2026-09-28, Tailscale 참여):
// 접힌 행 64MB 중 63MB 가 공용 자산 dataUrl 393개였고 부팅·팀 변경 반영마다 gzip 45MB 를 다시 받았다.
// 본문은 내용 주소라 참여 기기의 IndexedDB 에 한 번 남으면 다음부터는 행(약 1MB)만 온다.

import { createHash } from "node:crypto";
import { ASSET_BLOB_PREFIX } from "../../src/project/persistence/core/foldedProject";

/** 이보다 작은 dataUrl 은 그대로 보낸다 — 왕복 한 번이 더 비싸다. */
const MIN_BLOB_CHARS = 4096;
/** 호스트가 들고 있는 본문 상한. 넘으면 가장 오래된 것부터 버린다(다음 요청이 다시 채운다). */
const MAX_INDEX_CHARS = 512 * 1024 * 1024;

export type AssetBlobIndex = {
  /** 접힌 행의 자산 dataUrl 을 표식으로 바꾼 글과, 뗀 본문의 sha 목록. 자산이 없으면 원문 그대로. */
  strip(folded: string): StrippedRow;
  /** strip 이 기억한 본문. 모르는 sha 는 빠진다 — 클라이언트가 다시 읽는다. */
  read(sha256s: readonly string[]): Readonly<Record<string, string>>;
};

/**
 * 본문 sha → 그 dataUrl 의 바이트 SHA-256 과 머리(`data:<mime>;base64`). 참여 창은 이미 받은 공용 카탈로그의
 * 같은 자산(바이트 해시가 같고 머리가 같으면 글도 같다)을 쓰고 본문을 받지 않는다. 실측(2026-09-28): 첫 참여에
 * 프로젝트 자산 본문 45MB 가 공용 카탈로그 기본 범위와 같은 그림이었다.
 */
export type AssetBlobHint = { readonly bytesSha256: string; readonly head: string };
export type StrippedRow = { readonly folded: string; readonly assetBlobShas: readonly string[]; readonly assetBlobHints: Readonly<Record<string, AssetBlobHint>> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createAssetBlobIndex(): AssetBlobIndex {
  const bodies = new Map<string, string>();
  let size = 0;
  // 같은 행을 다시 떼지 않는다(3초 팀 폴링 뒤 재로드가 같은 행을 부른다).
  let last: { readonly folded: string; readonly result: StrippedRow } | null = null;
  const remember = (sha: string, body: string): void => {
    if (bodies.has(sha)) { bodies.delete(sha); bodies.set(sha, body); return; }
    bodies.set(sha, body);
    size += body.length;
    for (const [oldest, text] of bodies) {
      if (size <= MAX_INDEX_CHARS || oldest === sha) break;
      bodies.delete(oldest);
      size -= text.length;
    }
  };
  return {
    strip(folded) {
      if (last?.folded === folded) {
        // 본문이 상한으로 밀려났을 수 있다 — 다시 기억시킨다.
        if (last.result.assetBlobShas.every((sha) => bodies.has(sha))) return last.result;
      }
      // 빠른 판정: 업로드 자산에 dataUrl 이 없으면 파싱하지 않는다.
      const none: StrippedRow = { folded, assetBlobShas: [], assetBlobHints: {} };
      if (!folded.includes('"dataUrl":"data:')) return none;
      const document: unknown = JSON.parse(folded);
      if (!isRecord(document) || !isRecord(document.assets) || !isRecord(document.assets.uploaded)) return none;
      const shas = new Set<string>();
      const hints: Record<string, AssetBlobHint> = {};
      for (const asset of Object.values(document.assets.uploaded)) {
        if (!isRecord(asset) || typeof asset.dataUrl !== "string" || !asset.dataUrl.startsWith("data:") || asset.dataUrl.length < MIN_BLOB_CHARS) continue;
        const sha = createHash("sha256").update(asset.dataUrl, "utf8").digest("hex");
        remember(sha, asset.dataUrl);
        const comma = asset.dataUrl.indexOf(",");
        const head = comma > 0 ? asset.dataUrl.slice(0, comma) : "";
        if (head.endsWith(";base64")) {
          hints[sha] = { head, bytesSha256: createHash("sha256").update(Buffer.from(asset.dataUrl.slice(comma + 1), "base64")).digest("hex") };
        }
        asset.dataUrl = ASSET_BLOB_PREFIX + sha;
        shas.add(sha);
      }
      const result: StrippedRow = shas.size === 0 ? none : { folded: JSON.stringify(document), assetBlobShas: [...shas], assetBlobHints: hints };
      last = { folded, result };
      return result;
    },
    read(sha256s) {
      const out: Record<string, string> = {};
      for (const sha of sha256s) {
        const body = bodies.get(sha);
        if (body !== undefined) out[sha] = body;
      }
      return out;
    },
  };
}
