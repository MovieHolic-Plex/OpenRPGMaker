/**
 * 스토어 「바로 플레이」 게임 올리기 — 전송 방식과 무관한 순서(서버 계약: OpenRPGMaker-store src/games.ts).
 *   1. 파일 해시 → POST /api/v1/games/files/check  (서버에 없는 해시)
 *   2. 없는 것만 POST /api/v1/games/files            (x-sha256, x-file-ext)
 *   3. POST /api/v1/games/publish                    (경로→해시 목록 + 글 + 바뀐 점) → 서버가 판본 번호를 정한다
 * 편집기(Electron 메인의 앱 토큰)와 scripts/store/publish-game.mts(운영자 세션)가 같은 함수를 쓴다.
 *
 * 게임 공개 선언(2026-11-15): OPRN PLAY 는 무료·비영리 게임만 싣는다. 올릴 때마다(새 판본도, 운영자도) 선언을 함께 보낸다 —
 * 문구는 스토어가 준다(GET /api/v1/games/declaration). 선언 없는 게시는 스토어가 400 `declaration_required` 로 거절한다.
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
  /** 이 판본의 제작자 코멘트(선택, 600자). 스토어 판본 카드에 작가 말투로 보인다. */
  readonly comment?: string;
  /** 같이 올릴 소식 글(선택). 본문은 마크다운 — 스토어가 안전한 부분만 보여 준다. */
  readonly post?: StoreGamePostDraft | null;
  /** 게임 공개 선언. 옛 스토어(선언 문구를 주지 않는 서버)에 올릴 때만 비운다 — 새 스토어는 없으면 거절한다. */
  readonly declaration?: StoreGameDeclaration | null;
}

/** 선언 항목(스토어 src/gameDeclaration.ts 의 DECLARATION_KEYS 와 같다). */
export const STORE_GAME_DECLARATION_KEYS = ["nonCommercial", "ownWork", "noAdultContent", "age14", "agreeTerms"] as const;
export type StoreGameDeclarationKey = (typeof STORE_GAME_DECLARATION_KEYS)[number];
export type StoreGameResidence = "kr" | "outside_kr";

/** 게시 요청에 싣는 선언: 본 문구의 판(version), 다섯 항목 모두 true, 지금 사는 곳. */
export type StoreGameDeclaration = { readonly version: string; readonly residence: StoreGameResidence } & { readonly [K in StoreGameDeclarationKey]: true };

/** 스토어가 주는 선언 문구(화면·명령줄이 그대로 보여 준다). */
export interface StoreGameDeclarationDoc {
  readonly version: string; readonly title: string; readonly lead: string;
  readonly items: readonly { readonly key: StoreGameDeclarationKey; readonly text: string }[];
  readonly residence: { readonly question: string; readonly note: string; readonly options: readonly { readonly value: StoreGameResidence; readonly label: string }[] };
  readonly termsUrl: string;
}

const text = (value: unknown, max: number): string | null => (typeof value === "string" && value.trim() !== "" && value.length <= max ? value : null);

/**
 * 스토어가 준 선언 문구를 확인한다. 다섯 항목이 순서대로 다 있고, 사는 곳 선택지가 둘이고, 약관 주소가 http(s) 일 때만 받는다 —
 * 하나라도 빠진 문구로는 선언을 받지 않는다(빈 칸에 동의하게 하지 않는다).
 */
export function normalizeStoreGameDeclarationDoc(raw: unknown): StoreGameDeclarationDoc {
  const bad = (what: string): never => { throw new Error(`스토어가 준 게임 공개 선언을 읽지 못했습니다(${what}). 편집기를 최신 버전으로 올려 주세요.`); };
  if (!raw || typeof raw !== "object") return bad("형식");
  const doc = raw as Record<string, unknown>;
  const version = text(doc.version, 40) ?? bad("version");
  const title = text(doc.title, 200) ?? bad("title");
  const lead = text(doc.lead, 1000) ?? bad("lead");
  const rawItems = Array.isArray(doc.items) ? doc.items as Record<string, unknown>[] : bad("items");
  const items = STORE_GAME_DECLARATION_KEYS.map((key, index) => {
    const item = rawItems[index];
    if (!item || item.key !== key) return bad(`items[${index}]`);
    return { key, text: text(item.text, 4000) ?? bad(`items.${key}`) };
  });
  if (rawItems.length !== items.length) bad("items 개수");
  const residence = (doc.residence && typeof doc.residence === "object" ? doc.residence : bad("residence")) as Record<string, unknown>;
  const rawOptions = Array.isArray(residence.options) ? residence.options as Record<string, unknown>[] : bad("residence.options");
  const options = (["kr", "outside_kr"] as const).map((value, index) => {
    const option = rawOptions[index];
    if (!option || option.value !== value) return bad(`residence.options[${index}]`);
    return { value, label: text(option.label, 200) ?? bad(`residence.${value}`) };
  });
  if (rawOptions.length !== options.length) bad("residence.options 개수");
  const termsUrl = text(doc.termsUrl, 600) ?? bad("termsUrl");
  let terms: URL;
  try { terms = new URL(termsUrl); } catch { return bad("termsUrl"); }
  if (terms.protocol !== "https:" && terms.protocol !== "http:") bad("termsUrl");
  return {
    version, title, lead, items,
    residence: { question: text(residence.question, 200) ?? bad("residence.question"), note: text(residence.note, 600) ?? bad("residence.note"), options },
    termsUrl: terms.toString(),
  };
}

/** 화면·명령줄에서 확인한 것으로 게시 요청의 선언을 만든다. 하나라도 빠지면 null(보내지 않는다). */
export function storeGameDeclaration(doc: Pick<StoreGameDeclarationDoc, "version">, checked: ReadonlySet<string>, residence: string | null): StoreGameDeclaration | null {
  if (residence !== "kr" && residence !== "outside_kr") return null;
  if (!STORE_GAME_DECLARATION_KEYS.every((key) => checked.has(key))) return null;
  return { version: doc.version, nonCommercial: true, ownWork: true, noAdultContent: true, age14: true, agreeTerms: true, residence };
}

/** 명령줄에 찍는 선언 문구(번호를 붙인 줄글). */
export function storeGameDeclarationText(doc: StoreGameDeclarationDoc): string {
  return [
    `${doc.title} (${doc.version})`, doc.lead,
    ...doc.items.map((item, index) => `  ${index + 1}. ${item.text}`),
    `  ${doc.residence.question}: ${doc.residence.options.map((option) => `${option.value} = ${option.label}`).join(" / ")}`,
    `  ${doc.residence.note}`, `  ${doc.termsUrl}`,
  ].join("\n");
}

/**
 * 명령줄 선언: `--declare <문구 판> --residence kr|outside_kr`. --declare 의 값이 스토어의 지금 문구 판과 같아야 한다 —
 * 문구가 바뀌면 옛 판을 적어 둔 스크립트는 멈추고, 사람이 새 문구를 읽고 판을 고쳐 적는다.
 */
export function storeGameDeclarationFromFlags(doc: StoreGameDeclarationDoc, declared: string | undefined, residence: string | undefined): StoreGameDeclaration {
  const how = `위 ${doc.items.length}개 항목을 읽고 모두 맞으면 --declare ${doc.version} --residence kr|outside_kr 을 붙여 다시 실행하세요`;
  if (!declared) throw new Error(`게임 공개 선언이 필요합니다. ${how}.`);
  if (declared !== doc.version) throw new Error(`게임 공개 선언 문구가 바뀌었습니다(--declare ${declared} 은 옛 판, 지금 판은 ${doc.version}). ${how}.`);
  const declaration = storeGameDeclaration(doc, new Set(STORE_GAME_DECLARATION_KEYS), residence ?? null);
  if (!declaration) throw new Error(`지금 사는 곳을 --residence kr(대한민국) 또는 --residence outside_kr(대한민국 밖)로 알려 주세요. ${doc.residence.note}`);
  return declaration;
}

/** 소식 글(스토어 「소식」 탭). 그림은 그 판본 파일 경로(예: store/shot1.webp)만 보인다. */
export interface StoreGamePostDraft { readonly title: string; readonly body: string; readonly pinned?: boolean }

export interface StoreGamePublishResult {
  readonly slug: string; readonly version: string; readonly unchanged: boolean; readonly status: string;
  readonly playUrl: string; readonly pageUrl: string; readonly gameUrl: string;
  /** 진열 범위: 전 세계 / 한국 밖 전용(대한민국 밖에 사는 작가의 게임). 옛 서버는 보내지 않는다. */
  readonly distribution?: "worldwide" | "outside_kr";
  /** 바로 공개되지 않고 운영자 확인으로 간 이유 코드(first_version·build_link·hold_word·…). 있으면 status 는 "pending" 이다. */
  readonly held?: readonly string[];
  /** held 를 사람 말로 풀어 쓴 것(스토어가 준다). */
  readonly message?: string;
  /** 코멘트·소식 글 결과(보냈을 때만). 판본은 이것과 무관하게 올라간다 — 실패하면 error 코드가 온다. */
  readonly comment?: { readonly status?: string | null; readonly held?: readonly string[]; readonly error?: string };
  readonly post?: { readonly id?: number; readonly status?: string; readonly url?: string; readonly held?: readonly string[]; readonly error?: string };
}

/** 편집기 대화상자가 미리 받는 것: 이 프로젝트의 게임, 다음 판본 번호, 바뀐 점을 셀 기준 project.json. */
export interface StoreGameMine {
  readonly game: {
    readonly slug: string; readonly title: string; readonly status: string; readonly currentVersion: string | null; readonly latestVersion: string | null; readonly pageUrl: string;
    /** 소식 글 본문에 쓸 수 있는 그림 경로(지금 판본의 표지·스크린샷). 옛 서버는 보내지 않는다. */
    readonly images?: readonly string[];
    readonly distribution?: "worldwide" | "outside_kr";
  } | null;
  /** 이 게임의 마지막 제출이 운영자 확인을 기다리거나(pending) 돌려보내졌을 때(rejected). note 는 운영자가 작가에게 남긴 말. */
  readonly submission?: { readonly status: string; readonly reasons: readonly string[]; readonly reasonTexts: readonly string[]; readonly note: string; readonly createdAt: string } | null;
  readonly next: { readonly minor: string; readonly major: string };
  readonly baseline: { readonly version: string; readonly projectUrl: string } | null;
}

export interface StoreGameTransport {
  json(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<unknown>;
  upload(path: string, bytes: Uint8Array, headers: Readonly<Record<string, string>>): Promise<void>;
}

export interface StoreGameProgress {
  readonly phase: "hash" | "upload" | "publish";
  readonly done: number;
  readonly total: number;
  /** upload 단계: 막 보내기 시작한 파일(올리기 전에 찍는다 — 멈추면 이 파일 때문이다). */
  readonly starting?: { readonly sha256: string; readonly path: string; readonly bytes: number };
}

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
    const slice = shas.slice(start, start + 2000);
    // 확장자도 보낸다: 같은 바이트가 다른 형식으로 먼저 올라와 있으면 서버가 「없음」으로 알려 준다.
    const answer = await transport.json("POST", "/api/v1/games/files/check", { sha256s: slice, exts: slice.map((sha) => extOf(unique.get(sha)!.path)) }) as { missing?: unknown };
    for (const sha of Array.isArray(answer.missing) ? answer.missing : []) if (typeof sha === "string") missing.add(sha);
  }
  const queue = [...missing].map((sha) => unique.get(sha)!).filter(Boolean);
  let sent = 0;
  const total = queue.length;
  const worker = async (): Promise<void> => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      onProgress({ phase: "upload", done: sent, total, starting: { sha256: file.sha256, path: file.path, bytes: file.bytes.byteLength } });
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
    ...(request.comment?.trim() ? { comment: request.comment.trim() } : {}),
    ...(request.post?.title.trim() ? { post: { title: request.post.title.trim(), body: request.post.body, pinned: request.post.pinned === true } } : {}),
    ...(request.declaration ? { declaration: request.declaration } : {}),
  }) as StoreGamePublishResult;
  onProgress({ phase: "publish", done: 1, total: 1 });
  return result;
}
