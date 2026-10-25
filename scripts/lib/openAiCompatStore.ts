// 사용자 지정(OpenAI 호환) 엔드포인트 저장소 — 동반 서비스(Node) 전용. 브라우저는 이 파일을 읽지 못한다.
//
// 위치: $OPRN_OPENAI_COMPAT_PATH 또는 ~/.oprn/openai-compat-endpoints.json. 디렉터리 0700, 파일 0600.
// API 키와 사용자 헤더 **값**은 이 파일에만 있다 — localStorage·내보내기·로그·브라우저 응답 어디에도 나가지 않는다.
// 키를 들고 있는 다른 파일(oh-my-pi-auth.json)과 일부러 분리했다: 구독 로그인 자격과 수명·갱신·해제 규칙이 달라서
// 한 문서에 섞으면 한쪽 변경이 다른 쪽을 깨뜨린다.
//
// 쓰기는 임시 파일에 0600 으로 쓴 뒤 rename 한다 — 도중에 죽어도 반쪽 파일이 남지 않고, 권한이 풀린 순간이 없다.

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW,
  OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC,
  OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS,
  OPENAI_COMPAT_MAX_HEADERS,
  OPENAI_COMPAT_PREFIX,
  checkOpenAiCompatBaseUrl,
  OPENAI_COMPAT_MAX_PATTERNS,
  checkOpenAiCompatHeaderName,
  checkOpenAiCompatPattern,
  openAiCompatAllowedModels,
  openAiCompatModelVerdict,
  isOpenAiCompatProviderId,
  openAiCompatIdForName,
  parseOpenAiCompatReasoningMode,
  type OpenAiCompatReasoningMode,
  type OpenAiCompatEndpointPublic,
  type OpenAiCompatLastTest,
} from "../../src/ai/openAiCompat.ts";

const FILE_NAME = "openai-compat-endpoints.json";

export interface StoredOpenAiCompatEndpoint {
  name: string;
  baseUrl: string;
  /** 비어 있으면 키 없는 엔드포인트(LM Studio·Ollama 같은 로컬 서버). */
  apiKey: string;
  headers: Record<string, string>;
  reasoningMode: OpenAiCompatReasoningMode;
  allowModels: string[];
  blockModels: string[];
  supportsImages: boolean;
  /** 그림을 보는 모델 패턴(최종 모델 ID). 비우면 supportsImages 가 모든 모델에 적용된다. */
  imageModels: string[];
  /** 마지막 그림 시험(1화소 그림) — blind 의 모델에는 그림을 보내지 않는다. */
  imageProbe?: OpenAiCompatImageProbe;
  maxOutputTokens: number;
  contextWindow: number;
  firstTokenTimeoutSec: number;
  allowInsecurePublic: boolean;
  models: string[];
  defaultModel: string;
  lastTest?: OpenAiCompatLastTest;
}

export interface OpenAiCompatImageProbe {
  readonly at: number;
  /** 빈 답·오류를 낸 모델(최종 ID). */
  readonly blind: string[];
  /** 그림에 글로 답한 모델. */
  readonly sees: string[];
}

export interface OpenAiCompatSaveInput {
  /** 있으면 그 엔드포인트를 고친다. 없으면 이름으로 새 id 를 만든다. */
  readonly id?: string;
  readonly name?: unknown;
  readonly baseUrl?: unknown;
  /** undefined = 그대로 둔다. 문자열 = 교체. */
  readonly apiKey?: unknown;
  /** true 면 저장된 키를 지운다. */
  readonly clearKey?: unknown;
  /** 헤더 목록. value 가 없는 항목은 같은 이름의 저장값을 유지한다. 목록에 없는 이름은 지운다. */
  readonly headers?: unknown;
  readonly reasoningMode?: unknown;
  /** 문자열 배열(또는 쉼표·줄바꿈으로 나뉜 문자열). undefined = 그대로 둔다. */
  readonly allowModels?: unknown;
  readonly blockModels?: unknown;
  readonly supportsImages?: unknown;
  /** 그림을 보는 모델 패턴. undefined = 그대로 둔다. */
  readonly imageModels?: unknown;
  readonly maxOutputTokens?: unknown;
  readonly contextWindow?: unknown;
  readonly firstTokenTimeoutSec?: unknown;
  readonly allowInsecurePublic?: unknown;
  readonly defaultModel?: unknown;
}

type Doc = { version: 1; endpoints: Record<string, StoredOpenAiCompatEndpoint> };

export function defaultOpenAiCompatPath(): string {
  return process.env.OPRN_OPENAI_COMPAT_PATH || join(homedir(), ".oprn", FILE_NAME);
}

function httpError(message: string, status = 400): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** 패턴 목록 정규화. 배열 또는 쉼표·줄바꿈 문자열을 받고, 잘못된 패턴은 status 400 으로 거절한다. */
function normalizePatterns(value: unknown, label: string): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,]+/u) : [];
  const out: string[] = [];
  for (const item of raw) {
    const text = String(item ?? "").trim();
    if (!text) continue;
    const problem = checkOpenAiCompatPattern(text);
    if (problem) throw httpError(`${label}: ${problem}`);
    if (!out.some((existing) => existing.toLowerCase() === text.toLowerCase())) out.push(text);
  }
  if (out.length > OPENAI_COMPAT_MAX_PATTERNS) throw httpError(`${label}는 ${OPENAI_COMPAT_MAX_PATTERNS}개까지예요.`);
  return out;
}

function readImageProbe(raw: unknown): OpenAiCompatImageProbe | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { at?: unknown; blind?: unknown; sees?: unknown };
  if (typeof r.at !== "number") return undefined;
  const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((m): m is string => typeof m === "string").slice(0, 50) : []);
  return { at: r.at, blind: ids(r.blind), sees: ids(r.sees) };
}

function readDoc(path: string): Doc {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { endpoints?: unknown };
    const endpoints: Record<string, StoredOpenAiCompatEndpoint> = {};
    if (raw && typeof raw.endpoints === "object" && raw.endpoints) {
      for (const [id, row] of Object.entries(raw.endpoints as Record<string, unknown>)) {
        if (!isOpenAiCompatProviderId(id) || !row || typeof row !== "object") continue;
        const r = row as Partial<StoredOpenAiCompatEndpoint>;
        if (typeof r.baseUrl !== "string" || typeof r.name !== "string") continue;
        const imageProbe = readImageProbe(r.imageProbe);
        endpoints[id] = {
          name: r.name,
          baseUrl: r.baseUrl,
          apiKey: typeof r.apiKey === "string" ? r.apiKey : "",
          headers: r.headers && typeof r.headers === "object"
            ? Object.fromEntries(Object.entries(r.headers).filter(([, v]) => typeof v === "string")) as Record<string, string> : {},
          // 옛 파일의 supportsReasoningEffort(불리언)는 field 방식으로 읽는다.
          reasoningMode: parseOpenAiCompatReasoningMode(r.reasoningMode, (r as { supportsReasoningEffort?: unknown }).supportsReasoningEffort),
          // 읽기는 관대하게(손으로 고친 파일의 잘못된 패턴은 버린다) — 쓰기만 엄격하다.
          allowModels: Array.isArray(r.allowModels) ? r.allowModels.filter((p): p is string => typeof p === "string" && !checkOpenAiCompatPattern(p)).slice(0, OPENAI_COMPAT_MAX_PATTERNS) : [],
          blockModels: Array.isArray(r.blockModels) ? r.blockModels.filter((p): p is string => typeof p === "string" && !checkOpenAiCompatPattern(p)).slice(0, OPENAI_COMPAT_MAX_PATTERNS) : [],
          supportsImages: r.supportsImages === true,
          imageModels: Array.isArray(r.imageModels) ? r.imageModels.filter((p): p is string => typeof p === "string" && !checkOpenAiCompatPattern(p)).slice(0, OPENAI_COMPAT_MAX_PATTERNS) : [],
          ...(imageProbe ? { imageProbe } : {}),
          maxOutputTokens: clampInt(r.maxOutputTokens, OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS, 256, 1_000_000),
          contextWindow: clampInt(r.contextWindow, OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW, 2048, 4_000_000),
          firstTokenTimeoutSec: clampInt(r.firstTokenTimeoutSec, OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC, 10, 3600),
          allowInsecurePublic: r.allowInsecurePublic === true,
          models: Array.isArray(r.models) ? r.models.filter((m): m is string => typeof m === "string").slice(0, 500) : [],
          defaultModel: typeof r.defaultModel === "string" ? r.defaultModel : "",
          ...(r.lastTest && typeof r.lastTest === "object" ? { lastTest: r.lastTest as OpenAiCompatLastTest } : {}),
        };
      }
    }
    return { version: 1, endpoints };
  } catch {
    return { version: 1, endpoints: {} };
  }
}

function writeDoc(path: string, doc: Doc): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* 공유 위치(테스트 임시 폴더)면 건드리지 못할 수 있다 */ }
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(doc, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
}

/** 읽기 전에 권한을 조인다 — 다른 도구가 만든 파일이 0644 로 남아 있어도 키가 읽히지 않게 한다. */
function tightenPermissions(path: string): void {
  try {
    if (existsSync(path) && (statSync(path).mode & 0o077) !== 0) chmodSync(path, 0o600);
  } catch { /* 권한을 못 바꾸는 파일 시스템 */ }
}

export function openAiCompatPublicView(id: string, row: StoredOpenAiCompatEndpoint): OpenAiCompatEndpointPublic {
  return {
    id,
    name: row.name,
    baseUrl: row.baseUrl,
    hasKey: row.apiKey.length > 0,
    headerNames: Object.keys(row.headers),
    reasoningMode: row.reasoningMode,
    allowModels: row.allowModels,
    blockModels: row.blockModels,
    supportsImages: row.supportsImages,
    imageModels: row.imageModels,
    imageBlindModels: row.imageProbe?.blind ?? [],
    maxOutputTokens: row.maxOutputTokens,
    contextWindow: row.contextWindow,
    firstTokenTimeoutSec: row.firstTokenTimeoutSec,
    allowInsecurePublic: row.allowInsecurePublic,
    // 패턴이 바뀐 뒤에도 차단 모델이 목록·기본값으로 새지 않게 보기 시점에도 거른다.
    models: openAiCompatAllowedModels(row, row.models),
    defaultModel: openAiCompatModelVerdict(row, row.defaultModel).allowed ? row.defaultModel : "",
    ...(row.lastTest ? { lastTest: row.lastTest } : {}),
  };
}

export function createOpenAiCompatStore(filePath: string = defaultOpenAiCompatPath()) {
  const load = (): Doc => {
    tightenPermissions(filePath);
    return readDoc(filePath);
  };
  return {
    path: filePath,
    list(): Array<{ id: string; row: StoredOpenAiCompatEndpoint }> {
      return Object.entries(load().endpoints).map(([id, row]) => ({ id, row }));
    },
    get(id: string): StoredOpenAiCompatEndpoint | undefined {
      return load().endpoints[id];
    },
    /** 검증·정규화 후 저장한다. 잘못된 입력은 status 400 오류. 저장된 행의 공개 보기를 돌려준다. */
    upsert(input: OpenAiCompatSaveInput): OpenAiCompatEndpointPublic {
      const doc = load();
      const existingId = typeof input.id === "string" && input.id ? input.id : undefined;
      if (existingId && !isOpenAiCompatProviderId(existingId)) throw httpError("엔드포인트 id 형식이 올바르지 않습니다.");
      const existing = existingId ? doc.endpoints[existingId] : undefined;
      if (existingId && !existing) throw httpError("고치려는 엔드포인트를 찾을 수 없습니다.", 404);

      const name = (typeof input.name === "string" ? input.name : existing?.name ?? "").trim();
      if (!name) throw httpError("이름을 입력하세요.");
      if (name.length > 60) throw httpError("이름은 60자 이하로 입력하세요.");

      const check = checkOpenAiCompatBaseUrl(input.baseUrl ?? existing?.baseUrl);
      if (!check.ok || !check.url) throw httpError(check.error ?? "기본 주소가 올바르지 않습니다.");
      const allowInsecurePublic = input.allowInsecurePublic === true
        || (input.allowInsecurePublic === undefined && existing?.allowInsecurePublic === true);
      if (check.insecurePublic && !allowInsecurePublic) {
        throw httpError("공개 인터넷 주소에 http(암호화 없음)로 연결하려면 「그래도 사용」을 확인해야 해요. 가능하면 https 주소를 쓰세요.");
      }

      // 키: undefined 는 유지, 문자열은 교체, clearKey 는 삭제. 공백만 있는 키는 키가 아니다.
      let apiKey = existing?.apiKey ?? "";
      if (input.clearKey === true) apiKey = "";
      else if (typeof input.apiKey === "string" && input.apiKey.trim()) apiKey = input.apiKey.trim();
      if (/[\r\n]/u.test(apiKey)) throw httpError("API 키에 줄바꿈이 들어 있어요. 키만 붙여 넣으세요.");

      // 헤더: 목록에 있는 이름만 남기고, value 가 없으면 저장된 값을 유지한다.
      let headers: Record<string, string> = existing ? { ...existing.headers } : {};
      if (Array.isArray(input.headers)) {
        const next: Record<string, string> = {};
        for (const entry of input.headers) {
          if (!entry || typeof entry !== "object") continue;
          const rawName = String((entry as { name?: unknown }).name ?? "").trim();
          if (!rawName) continue;
          const problem = checkOpenAiCompatHeaderName(rawName);
          if (problem) throw httpError(problem);
          const lower = rawName.toLowerCase();
          const value = (entry as { value?: unknown }).value;
          const kept = Object.entries(headers).find(([existingName]) => existingName.toLowerCase() === lower)?.[1];
          const resolved = typeof value === "string" && value.length > 0 ? value : kept;
          if (resolved === undefined) throw httpError(`${rawName} 헤더의 값을 입력하세요.`);
          if (/[\r\n]/u.test(resolved)) throw httpError(`${rawName} 헤더 값에 줄바꿈이 들어 있어요.`);
          next[rawName] = resolved;
        }
        if (Object.keys(next).length > OPENAI_COMPAT_MAX_HEADERS) throw httpError(`추가 헤더는 ${OPENAI_COMPAT_MAX_HEADERS}개까지예요.`);
        headers = next;
      }

      const id = existingId ?? openAiCompatIdForName(name, Object.keys(doc.endpoints));
      const defaultModel = typeof input.defaultModel === "string" ? input.defaultModel.trim() : existing?.defaultModel ?? "";
      const row: StoredOpenAiCompatEndpoint = {
        name,
        baseUrl: check.url,
        apiKey,
        headers,
        allowModels: input.allowModels === undefined ? existing?.allowModels ?? [] : normalizePatterns(input.allowModels, "허용 모델 패턴"),
        blockModels: input.blockModels === undefined ? existing?.blockModels ?? [] : normalizePatterns(input.blockModels, "차단 모델 패턴"),
        reasoningMode: input.reasoningMode === undefined
          ? existing?.reasoningMode ?? "none" : parseOpenAiCompatReasoningMode(input.reasoningMode),
        supportsImages: typeof input.supportsImages === "boolean" ? input.supportsImages : existing?.supportsImages ?? false,
        imageModels: input.imageModels === undefined ? existing?.imageModels ?? [] : normalizePatterns(input.imageModels, "그림 모델 패턴"),
        maxOutputTokens: clampInt(input.maxOutputTokens, existing?.maxOutputTokens ?? OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS, 256, 1_000_000),
        contextWindow: clampInt(input.contextWindow, existing?.contextWindow ?? OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW, 2048, 4_000_000),
        firstTokenTimeoutSec: clampInt(input.firstTokenTimeoutSec, existing?.firstTokenTimeoutSec ?? OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC, 10, 3600),
        allowInsecurePublic: check.insecurePublic ? allowInsecurePublic : false,
        models: existing?.models ?? [],
        defaultModel,
        // 주소·키·헤더가 바뀌면 이전 시험 결과는 더 이상 이 엔드포인트의 것이 아니다.
        ...(existing?.lastTest && existing.baseUrl === check.url && existing.apiKey === apiKey ? { lastTest: existing.lastTest } : {}),
        ...(existing?.imageProbe && existing.baseUrl === check.url && existing.apiKey === apiKey ? { imageProbe: existing.imageProbe } : {}),
      };
      doc.endpoints[id] = row;
      writeDoc(filePath, doc);
      return openAiCompatPublicView(id, row);
    },
    /** 시험 결과(모델 목록·도구 시험)를 남긴다. 저장되지 않은 엔드포인트면 아무것도 하지 않는다. */
    recordTest(id: string, result: { models?: string[]; lastTest: OpenAiCompatLastTest }): void {
      const doc = load();
      const row = doc.endpoints[id];
      if (!row) return;
      if (result.models && result.models.length) row.models = result.models.slice(0, 500);
      row.lastTest = result.lastTest;
      writeDoc(filePath, doc);
    },
    /** 그림 시험 결과를 남긴다. 이번에 시험한 모델만 갈아 끼우고, 시험하지 않은 모델의 이전 판정은 둔다. */
    recordImageProbe(id: string, probe: OpenAiCompatImageProbe): void {
      const doc = load();
      const row = doc.endpoints[id];
      if (!row) return;
      const tested = new Set([...probe.blind, ...probe.sees].map((m) => m.toLowerCase()));
      const keep = (list: readonly string[] | undefined) => (list ?? []).filter((m) => !tested.has(m.toLowerCase()));
      row.imageProbe = {
        at: probe.at,
        blind: [...keep(row.imageProbe?.blind), ...probe.blind].slice(0, 50),
        sees: [...keep(row.imageProbe?.sees), ...probe.sees].slice(0, 50),
      };
      writeDoc(filePath, doc);
    },
    setDefaultModel(id: string, model: string): void {
      const doc = load();
      const row = doc.endpoints[id];
      if (!row) return;
      row.defaultModel = model.trim();
      writeDoc(filePath, doc);
    },
    remove(id: string): boolean {
      const doc = load();
      if (!doc.endpoints[id]) return false;
      delete doc.endpoints[id];
      writeDoc(filePath, doc);
      return true;
    },
  };
}

export const openAiCompatStore = createOpenAiCompatStore();
export { OPENAI_COMPAT_PREFIX };
