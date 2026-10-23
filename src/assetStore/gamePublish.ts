/**
 * 스토어 「바로 플레이」 게임 올리기 — 전송 방식과 무관한 순서(서버 계약: OpenRPGMaker-store src/games.ts).
 *   1. 파일 해시 → POST /api/v1/games/files/check  (서버에 없는 해시)
 *   2. 없는 것만 POST /api/v1/games/files            (x-sha256, x-file-ext)
 *   3. POST /api/v1/games/publish                    (경로→해시 목록 + 글 + 바뀐 점) → 서버가 판본 번호를 정한다
 * 편집기(Electron 메인의 앱 토큰)와 scripts/store/publish-game.mts(운영자 세션)가 같은 함수를 쓴다.
 */
import { sha256HexBytes } from "../util/sha256";

export interface StoreGameControl { readonly keys: string; readonly action: string }
export interface StoreGameMeta {
  readonly title: string; readonly summary: string; readonly description: string; readonly credits: string; readonly genre: string;
  readonly controls: readonly StoreGameControl[];
}
export interface StoreGameChangeSetWire { readonly added: readonly string[]; readonly changed: readonly string[]; readonly removed: readonly string[] }

export interface StoreGamePublishRequest {
  readonly projectKey: string;
  /** 처음 올릴 때 원하는 주소(운영자만 반영). */
  readonly slug?: string;
  readonly meta: StoreGameMeta;
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly entry: string;
  readonly cover: string | null;
  readonly art: readonly string[];
  readonly changelog: string;
  readonly changes: Readonly<Record<string, StoreGameChangeSetWire>>;
  readonly bump: "minor" | "major";
  /** 작가가 직접 정한 번호(선택). 지금까지의 판본보다 커야 한다. */
  readonly version?: string | null;
}

export interface StoreGamePublishResult {
  readonly slug: string; readonly version: string; readonly unchanged: boolean; readonly status: string;
  readonly playUrl: string; readonly pageUrl: string; readonly gameUrl: string;
}

/** 편집기 대화상자가 미리 받는 것: 이 프로젝트의 게임, 다음 판본 번호, 바뀐 점을 셀 기준 project.json. */
export interface StoreGameMine {
  readonly game: { readonly slug: string; readonly title: string; readonly status: string; readonly currentVersion: string | null; readonly latestVersion: string | null; readonly pageUrl: string } | null;
  readonly next: { readonly minor: string; readonly major: string };
  readonly baseline: { readonly version: string; readonly projectUrl: string } | null;
}

export interface StoreGameTransport {
  json(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown>;
  upload(path: string, bytes: Uint8Array, headers: Readonly<Record<string, string>>): Promise<void>;
}

export interface StoreGameProgress { readonly phase: "hash" | "upload" | "publish"; readonly done: number; readonly total: number }

const extOf = (path: string): string => {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

export async function publishStoreGame(
  transport: StoreGameTransport,
  request: StoreGamePublishRequest,
  onProgress: (progress: StoreGameProgress) => void = () => {},
): Promise<StoreGamePublishResult> {
  const entries = [...request.files.entries()];
  const hashed: { path: string; sha256: string; bytes: Uint8Array }[] = [];
  for (const [path, bytes] of entries) {
    hashed.push({ path, sha256: await sha256HexBytes(bytes), bytes });
    if (hashed.length % 50 === 0) onProgress({ phase: "hash", done: hashed.length, total: entries.length });
  }
  const unique = new Map(hashed.map((file) => [file.sha256, file]));
  const missing = new Set<string>();
  const shas = [...unique.keys()];
  for (let start = 0; start < shas.length; start += 2000) {
    const answer = await transport.json("POST", "/api/v1/games/files/check", { sha256s: shas.slice(start, start + 2000) }) as { missing?: unknown };
    for (const sha of Array.isArray(answer.missing) ? answer.missing : []) if (typeof sha === "string") missing.add(sha);
  }
  const queue = [...missing].map((sha) => unique.get(sha)!).filter(Boolean);
  let sent = 0;
  const total = queue.length;
  const worker = async (): Promise<void> => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      await transport.upload("/api/v1/games/files", file.bytes, { "x-sha256": file.sha256, "x-file-ext": extOf(file.path), "content-type": "application/octet-stream" });
      sent += 1;
      onProgress({ phase: "upload", done: sent, total });
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  onProgress({ phase: "publish", done: 0, total: 1 });
  const result = await transport.json("POST", "/api/v1/games/publish", {
    projectKey: request.projectKey,
    ...(request.slug ? { slug: request.slug } : {}),
    meta: request.meta,
    files: hashed.map(({ path, sha256 }) => ({ path, sha256 })),
    entry: request.entry,
    cover: request.cover,
    art: request.art,
    changelog: request.changelog,
    changes: request.changes,
    bump: request.bump,
    ...(request.version ? { version: request.version } : {}),
  }) as StoreGamePublishResult;
  onProgress({ phase: "publish", done: 1, total: 1 });
  return result;
}
