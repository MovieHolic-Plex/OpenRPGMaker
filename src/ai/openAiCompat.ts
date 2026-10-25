// 「사용자 지정 (OpenAI 호환)」 제공자 — 브라우저와 순수 Node(동반 서비스)가 함께 읽는 잎 모듈.
//
// 이 모듈은 비밀을 모른다. 브라우저가 아는 것은 `OpenAiCompatEndpointPublic`(이름·주소·키가 있는지·헤더 이름)뿐이고,
// 키와 헤더 값은 동반 서비스의 파일(~/.oprn/openai-compat-endpoints.json, 0600)에만 있다
// (scripts/lib/openAiCompatStore.mjs). 에디터가 브라우저에 키를 두지 않는다는 계약은 llmClient.ts 머리말과 같다.
//
// 제공자 id 는 `openai-compat:<slug>` 다. 정적 레지스트리(ohMyPiProviders.OH_MY_PI_PROVIDERS)에는 넣지 않는다 —
// 사용자가 엔드포인트를 만들고 지우므로 목록이 동적이고, 정적 목록의 불변식(권장값·카탈로그 짝)을 건드리지 않기 위해서다.
//
// 상대 경로 import 만 쓴다: 이 파일은 Node 에서 `@/` 별칭 없이도 로드된다(ohMyPiProviders.ts 머리말).

export const OPENAI_COMPAT_PREFIX = "openai-compat:";
export const OPENAI_COMPAT_CHANGED_EVENT = "oprn:openai-compat-changed";

const ID_PATTERN = /^openai-compat:[a-z0-9][a-z0-9-]{0,31}$/u;

export const OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS = 16_384;
export const OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC = 180;
export const OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW = 128_000;
/** 키 없는 엔드포인트가 워커로 가는 자리표시값. pi-ai 가 빈 키에서 OPENAI_API_KEY 환경 변수로 떨어지는 것을 막는다(전송 fetch 가 Authorization 을 떼어 낸다). */
export const OPENAI_COMPAT_NO_KEY = "oprn-no-key";
export const OPENAI_COMPAT_MODELS_TIMEOUT_MS = 10_000;
export const OPENAI_COMPAT_MAX_HEADERS = 8;

/**
 * 추론 강도를 서버에 전하는 방식. 서버마다 다르다.
 *  - none:   보내지 않는다(기본). 모르는 인자를 400 으로 거절하는 서버에서도 안전하다.
 *  - field:  Chat Completions 의 `reasoning_effort` 필드로 보낸다(OpenAI·LiteLLM·OpenRouter 계열).
 *  - suffix: 모델 ID 에 -low/-medium/-high 를 붙여 부른다(CLIProxyAPI 의 `gemini-4-argon-high` 처럼 강도가 ID 에 박힌 서버).
 */
export type OpenAiCompatReasoningMode = "none" | "field" | "suffix";
export const OPENAI_COMPAT_REASONING_MODES: readonly OpenAiCompatReasoningMode[] = ["none", "field", "suffix"];

export function parseOpenAiCompatReasoningMode(value: unknown, legacyFlag?: unknown): OpenAiCompatReasoningMode {
  if (value === "field" || value === "suffix" || value === "none") return value;
  return legacyFlag === true ? "field" : "none";
}

// ── 모델 허용/차단 패턴 ───────────────────────────────────────────────────────
// 엔드포인트마다 「이 서버에서는 이 모델만(또는 이 모델은 빼고)」 을 정한다. 비싼 모델이 같은 프록시에 섞여 있을 때 실수로 불리지 않게 한다.
// glob: `*` 는 0자 이상, `?` 는 1자. 대소문자 무시. 차단이 허용을 이긴다. 허용이 비어 있으면 「차단만 아니면 전부」.
// 판정은 목록 숨김(UI)·역할 지정(UI)·시험 호출·호스트 요청 직전·워커 모델 구성·전송 fetch 모두에서 같은 함수를 쓴다 — 폴백 없이 거절한다.

export const OPENAI_COMPAT_MAX_PATTERNS = 20;
const PATTERN_CHARS = /^[a-z0-9._:/*?@+-]{1,80}$/iu;

export function checkOpenAiCompatPattern(pattern: string): string | null {
  const text = pattern.trim();
  if (!text) return "빈 패턴입니다.";
  if (!PATTERN_CHARS.test(text)) return `패턴에 쓸 수 없는 글자가 있어요: ${text} (영문·숫자·. _ : / @ + - 와 * ? 만 쓸 수 있어요)`;
  return null;
}

export function openAiCompatPatternMatches(pattern: string, modelId: string): boolean {
  const source = pattern.trim().toLowerCase().replace(/[.+^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, ".*").replace(/\?/gu, ".");
  return new RegExp(`^${source}$`, "u").test(modelId.trim().toLowerCase());
}

export interface OpenAiCompatModelPolicy {
  readonly allowModels: readonly string[];
  readonly blockModels: readonly string[];
}

export interface OpenAiCompatModelVerdict {
  readonly allowed: boolean;
  /** 막힌 이유 — 사용자에게 그대로 보여 준다. */
  readonly reason?: string;
}

export function openAiCompatModelVerdict(policy: OpenAiCompatModelPolicy, modelId: string): OpenAiCompatModelVerdict {
  const id = modelId.trim();
  const blocked = policy.blockModels.find((pattern) => openAiCompatPatternMatches(pattern, id));
  if (blocked) return { allowed: false, reason: `차단 패턴 「${blocked}」에 걸려 쓸 수 없는 모델이에요.` };
  if (policy.allowModels.length > 0 && !policy.allowModels.some((pattern) => openAiCompatPatternMatches(pattern, id))) {
    return { allowed: false, reason: `허용 패턴(${policy.allowModels.join(", ")})에 없는 모델이에요.` };
  }
  return { allowed: true };
}

/** 모델 목록에서 허용되는 것만 남긴다. */
export function openAiCompatAllowedModels(policy: OpenAiCompatModelPolicy, models: readonly string[]): string[] {
  return models.filter((model) => openAiCompatModelVerdict(policy, model).allowed);
}

// ── 새 엔드포인트 프리셋 ──────────────────────────────────────────────────────
export interface OpenAiCompatPreset {
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly hint: string;
  readonly reasoningMode?: OpenAiCompatReasoningMode;
  readonly allowModels?: readonly string[];
  readonly blockModels?: readonly string[];
  /** 이미지 입력을 받는 모델이면 true — 켜 두지 않으면 타일셋 참고문서의 그림이 모델에 가지 않는다. */
  readonly supportsImages?: boolean;
  /** 그림을 실제로 보는 모델 패턴(최종 모델 ID 기준). 비우면 supportsImages 가 엔드포인트 전체에 적용된다. */
  readonly imageModels?: readonly string[];
}

/** 폼의 「프리셋」 — 주소·허용 패턴의 출발값일 뿐이고 모두 바꿀 수 있다. */
export const OPENAI_COMPAT_PRESETS: readonly OpenAiCompatPreset[] = [
  { id: "cliproxy-argon", label: "CLIProxyAPI · mdc-server (Argon 만)", name: "CLIProxyAPI Argon", baseUrl: "http://mdc-server:8318/v1",
    hint: "gemini-4-argon 계열만 허용합니다. claude-* 같은 비싼 모델은 목록에서 숨기고 호출도 거절해요. 패턴은 아래에서 바꿀 수 있어요.",
    // 2026-10-25 실측: 이 프록시에서 그림을 실제로 보는 것은 gemini-4-argon-high 뿐이다(argon·flash 는 빈 답, argon-medium 은 400).
    allowModels: ["gemini-4-argon*"], blockModels: ["claude-*"], supportsImages: true, imageModels: ["gemini-4-argon-high"] },
  { id: "cliproxy", label: "CLIProxyAPI (로컬)", name: "CLIProxyAPI", baseUrl: "http://127.0.0.1:8317/v1", hint: "CLI Proxy API 서버. 기본 포트는 8317 입니다. API 키는 서버 설정의 access 키예요." },
  { id: "litellm", label: "LiteLLM", name: "LiteLLM", baseUrl: "http://127.0.0.1:4000/v1", hint: "LiteLLM 프록시. 마스터 키가 있으면 API 키에 넣으세요." },
  { id: "ollama", label: "Ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", hint: "키가 필요 없어요. 모델이 도구 호출(tools)을 지원해야 조수에 쓸 수 있어요." },
  { id: "lmstudio", label: "LM Studio", name: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", hint: "키가 필요 없어요. 로컬 서버를 켜고 모델을 올려 두세요." },
  { id: "vllm", label: "vLLM", name: "vLLM", baseUrl: "http://127.0.0.1:8000/v1", hint: "도구 호출은 서버를 --enable-auto-tool-choice 로 띄워야 해요." },
  { id: "openrouter", label: "OpenRouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", hint: "OpenRouter 키가 필요해요.", reasoningMode: "field" },
  { id: "openai", label: "OpenAI", name: "OpenAI", baseUrl: "https://api.openai.com/v1", hint: "OpenAI API 키가 필요해요.", reasoningMode: "field" },
];

const EFFORT_SUFFIX = /-(?:minimal|low|medium|high|xhigh)$/u;

/** suffix 방식의 실제 모델 ID. 이미 강도 접미사가 있는 ID 와 강도 없음(off)은 그대로 둔다. */
export function openAiCompatSuffixedModelId(modelId: string, level: string | undefined): string {
  if (level !== "low" && level !== "medium" && level !== "high") return modelId;
  return EFFORT_SUFFIX.test(modelId) ? modelId : `${modelId}-${level}`;
}

/** 강도 접미사를 뗀 기본 ID(gemini-4-argon-high → gemini-4-argon). */
export function openAiCompatBaseModelId(modelId: string): string {
  return modelId.replace(EFFORT_SUFFIX, "");
}

/**
 * 이 모델(접미사가 붙은 최종 ID)에 그림을 보내도 되는가.
 * 엔드포인트 스위치(supportsImages)가 켜졌고, 그림 시험이 「못 본다」고 적지 않았고, imageModels 가 있으면 그 패턴에 맞아야 한다.
 * 2026-10-25 실측: 같은 프록시에서도 모델마다 다르다 — 못 보는 모델은 그림이 든 요청에 빈 답을 돌려준다.
 */
export function openAiCompatModelSeesImages(
  endpoint: { readonly supportsImages: boolean; readonly imageModels?: readonly string[]; readonly imageBlindModels?: readonly string[] },
  modelId: string,
): boolean {
  if (!endpoint.supportsImages) return false;
  const id = modelId.trim().toLowerCase();
  if (!id) return false;
  if (endpoint.imageBlindModels?.some((blind) => blind.toLowerCase() === id)) return false;
  if (endpoint.imageModels?.length) return endpoint.imageModels.some((pattern) => openAiCompatPatternMatches(pattern, modelId.trim()));
  return true;
}

export function isOpenAiCompatProviderId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERN.test(id);
}

/** 카드·상태 칩에 쓸 짧은 이름이 아직 모를 때(엔드포인트 목록을 못 받았을 때)의 대체 라벨. */
export function openAiCompatSlug(id: string): string {
  return id.startsWith(OPENAI_COMPAT_PREFIX) ? id.slice(OPENAI_COMPAT_PREFIX.length) : id;
}

/** 이름에서 id 를 만든다. 이미 쓰인 id 와 겹치면 -2, -3 … 를 붙인다. */
export function openAiCompatIdForName(name: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const base = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 24) || "endpoint";
  let candidate = `${OPENAI_COMPAT_PREFIX}${base}`;
  for (let n = 2; used.has(candidate); n += 1) candidate = `${OPENAI_COMPAT_PREFIX}${base}-${n}`;
  return candidate;
}

export interface OpenAiCompatLastTest {
  readonly at: number;
  readonly ok: boolean;
  readonly status?: number;
  /** 도구 호출 시험 결과. null = 시험하지 않았다. */
  readonly toolsOk?: boolean | null;
  readonly message?: string;
}

/** 브라우저가 보는 엔드포인트. **비밀이 없다** — 키는 hasKey, 헤더 값은 headerNames 로만 드러난다. */
export interface OpenAiCompatEndpointPublic {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly hasKey: boolean;
  readonly headerNames: readonly string[];
  /** 추론 강도 전달 방식(위 OpenAiCompatReasoningMode). 엔드포인트마다 다르다. */
  readonly reasoningMode: OpenAiCompatReasoningMode;
  /** 허용 모델 패턴(비어 있으면 차단만 아니면 전부). 위 「모델 허용/차단 패턴」 참고. */
  readonly allowModels: readonly string[];
  /** 차단 모델 패턴. 허용보다 우선한다. */
  readonly blockModels: readonly string[];
  /** 이미지(content parts)를 받는 모델인지 — Vision 역할이 이 엔드포인트를 쓸 때만 의미가 있다. */
  readonly supportsImages: boolean;
  /** 그림을 보는 모델 패턴. 비우면 supportsImages 가 모든 모델에 적용된다(openAiCompatModelSeesImages). */
  readonly imageModels?: readonly string[];
  /** 그림 시험(1화소 그림)에서 빈 답·오류를 낸 모델 — 그림을 보내지 않는다. */
  readonly imageBlindModels?: readonly string[];
  readonly maxOutputTokens: number;
  /** 모델의 컨텍스트 창(토큰). 서버가 알려 주지 않는 값이라 사용자가 맞춘다 — 에디터의 컨텍스트 압축 기준이 된다. */
  readonly contextWindow: number;
  readonly firstTokenTimeoutSec: number;
  /** http + 공개 주소를 사용자가 명시로 허락했는가. */
  readonly allowInsecurePublic: boolean;
  /** 마지막 연결 시험에서 받은 모델 목록(비밀이 아니다). 목록을 못 받았으면 비어 있다. */
  readonly models: readonly string[];
  /** 사용자가 마지막으로 고른 모델. 새 역할 칸의 기본값이다. */
  readonly defaultModel: string;
  readonly lastTest?: OpenAiCompatLastTest;
}

// ── 기본 주소 검사 ────────────────────────────────────────────────────────────

export type OpenAiCompatHostKind = "loopback" | "lan" | "public";

export interface OpenAiCompatBaseUrlCheck {
  readonly ok: boolean;
  /** 정규화된 주소(끝 슬래시 없음). ok 일 때만 있다. */
  readonly url?: string;
  readonly hostKind?: OpenAiCompatHostKind;
  /** 저장·시험 전에 반드시 알릴 문제. 사용자가 고칠 수 있는 말로 쓴다. */
  readonly error?: string;
  /** 막지는 않지만 보여 줄 경고. */
  readonly warnings: readonly string[];
  /** http 로 공개 주소를 쓰려는가 — 저장하려면 allowInsecurePublic 이 필요하다. */
  readonly insecurePublic: boolean;
}

function ipv4Octets(host: string): readonly number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((n) => n >= 0 && n <= 255) ? octets : null;
}

/** 클라우드 메타데이터·링크로컬 — 어떤 경우에도 연결하지 않는다(SSRF 로 자격이 새는 길). */
export function isBlockedOpenAiCompatHost(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/gu, "").toLowerCase();
  if (host === "metadata.google.internal" || host === "metadata" || host === "instance-data") return true;
  const octets = ipv4Octets(host);
  if (octets) {
    const [a, b] = octets;
    if (a === 169 && b === 254) return true; // 링크로컬(AWS/GCP/Azure 메타데이터 169.254.169.254 포함)
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 100 && b === 100 && octets[2] === 100 && octets[3] === 200) return true; // Alibaba 메타데이터
    return false;
  }
  if (host.includes(":")) {
    if (host === "::" || host.startsWith("fe80:") || host.startsWith("fd00:ec2:")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(host);
    if (mapped?.[1]) return isBlockedOpenAiCompatHost(mapped[1]);
  }
  return false;
}

/** 루프백·사설망·Tailscale 이름은 LAN, 그 밖은 공개로 본다. */
export function classifyOpenAiCompatHost(rawHost: string): OpenAiCompatHostKind {
  const host = rawHost.replace(/^\[|\]$/gu, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return "loopback";
  const octets = ipv4Octets(host);
  if (octets) {
    const [a, b] = octets;
    if (a === 127) return "loopback";
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "lan";
    if (a === 100 && b >= 64 && b <= 127) return "lan"; // CGNAT = Tailscale
    return "public";
  }
  if (host.includes(":")) {
    if (host === "::1") return "loopback";
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return "lan";
    return "public";
  }
  // 점 없는 이름(mdc-server 같은 MagicDNS·호스트 이름)과 사내 접미사는 LAN 이다.
  if (!host.includes(".")) return "lan";
  if (/\.(?:local|lan|internal|intranet|home\.arpa|ts\.net)$/u.test(host)) return "lan";
  return "public";
}

export function checkOpenAiCompatBaseUrl(raw: unknown): OpenAiCompatBaseUrlCheck {
  const warnings: string[] = [];
  const fail = (error: string): OpenAiCompatBaseUrlCheck => ({ ok: false, error, warnings, insecurePublic: false });
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return fail("기본 주소를 입력하세요. 예: http://127.0.0.1:1234/v1");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail("주소 형식이 올바르지 않아요. http:// 또는 https:// 로 시작해야 합니다.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return fail("http:// 또는 https:// 주소만 쓸 수 있어요.");
  if (!url.hostname) return fail("주소에 호스트 이름이 없어요.");
  if (url.username || url.password) return fail("주소에 계정·비밀번호를 넣지 마세요. 키는 「API 키」 칸에 넣으세요.");
  if (isBlockedOpenAiCompatHost(url.hostname)) return fail("이 주소(클라우드 메타데이터·링크로컬)에는 연결하지 않아요.");
  if (url.search || url.hash) warnings.push("주소 뒤의 ? 와 # 부분은 쓰지 않아 지웠어요.");
  const path = url.pathname.replace(/\/+$/u, "");
  const normalized = `${url.protocol}//${url.host}${path}`;
  const hostKind = classifyOpenAiCompatHost(url.hostname);
  const insecurePublic = url.protocol === "http:" && hostKind === "public";
  if (insecurePublic) {
    warnings.push("공개 인터넷 주소에 http(암호화 없음)로 연결합니다. API 키와 대화 내용이 그대로 전송돼요. https 주소를 쓰는 편이 안전해요.");
  }
  if (path === "" || path === "/") {
    warnings.push("대부분의 서버는 주소가 /v1 로 끝나요(예: …:8318/v1). 시험이 404 면 /v1 을 붙여 보세요.");
  }
  return { ok: true, url: normalized, hostKind, warnings, insecurePublic };
}

// ── 헤더 ──────────────────────────────────────────────────────────────────────

/** 사용자가 넣을 수 없는 헤더. 전송 계층이 정하는 값을 사용자 헤더가 덮어쓰지 못하게 한다. */
const FORBIDDEN_HEADERS = new Set([
  "host", "content-length", "content-type", "connection", "transfer-encoding", "te", "upgrade",
  "proxy-authorization", "cookie", "accept-encoding", "content-encoding",
]);

export function checkOpenAiCompatHeaderName(name: string): string | null {
  const lower = name.trim().toLowerCase();
  if (!lower) return "헤더 이름이 비어 있어요.";
  if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/u.test(lower)) return `헤더 이름에 쓸 수 없는 글자가 있어요: ${name}`;
  if (FORBIDDEN_HEADERS.has(lower)) return `${name} 헤더는 직접 지정할 수 없어요.`;
  return null;
}

// ── 오류를 사람 말로 ──────────────────────────────────────────────────────────

/**
 * 서버·전송 오류 원문을 「무엇을 고치면 되는지」 문장으로 바꾼다. 원문은 뒤에 붙여 둔다 — 말만 바꾸고 원인을 숨기지 않는다.
 * 키 값은 이 함수에 들어오지 않는다(호출부가 원문에서 이미 가린다).
 */
export function explainOpenAiCompatError(raw: string, endpoint: { readonly name: string; readonly baseUrl?: string }): string {
  const text = String(raw ?? "").trim();
  const name = endpoint.name || "사용자 지정 엔드포인트";
  const tail = text ? ` (원문: ${text.slice(0, 280)})` : "";
  if (/tools?\b[^.]{0,80}(?:not supported|unsupported|unavailable|not allowed)|function[ _]calling[^.]{0,40}(?:not supported|unsupported|unavailable)|does not support (?:tools|function)|tool_choice[^.]{0,60}(?:not supported|unsupported)|tools is not supported/iu.test(text)) {
    return `${name} 의 이 모델은 도구 호출(tools)을 지원하지 않아 조수를 돌릴 수 없어요. 조수는 도구로 맵을 고치기 때문에 도구를 지원하는 모델이 필요해요. 모델을 바꾸거나, 서버에서 도구 호출을 켜 주세요.${tail}`;
  }
  if (/\b401\b|missing api key|invalid api key|incorrect api key|unauthorized|authentication/iu.test(text)) {
    return `${name} 이(가) 인증을 거절했어요(401). API 키가 없거나 틀렸어요. 연결 설정에서 키를 다시 넣으세요.${tail}`;
  }
  if (/\b403\b|forbidden|permission denied/iu.test(text)) {
    return `${name} 이(가) 접근을 막았어요(403). 키의 권한이나 허용 모델을 확인하세요.${tail}`;
  }
  if (/\b404\b|not found|404 page/iu.test(text)) {
    return `${name} 에서 경로나 모델을 찾지 못했어요(404). 기본 주소 끝에 /v1 이 필요한지, 모델 이름이 서버 목록에 있는지 확인하세요.${tail}`;
  }
  if (/\b429\b|rate.?limit|too many requests|quota|insufficient_quota/iu.test(text)) {
    return `${name} 이(가) 요청이 너무 많다고 해요(429). 잠시 뒤 다시 시도하거나 요금·한도를 확인하세요.${tail}`;
  }
  if (/reasoning_effort|unrecognized request argument|unknown (?:parameter|field)|unsupported (?:parameter|field)/iu.test(text)) {
    return `${name} 이(가) 요청의 일부 필드를 모른다고 해요. 연결 설정의 「추론 강도」 방식을 「보내지 않음」으로 바꾸고 다시 시도하세요.${tail}`;
  }
  if (/ECONNREFUSED|connection refused/iu.test(text)) {
    return `${name} 에 연결하지 못했어요(연결 거부). 서버가 켜져 있는지, 주소와 포트가 맞는지 확인하세요.${tail}`;
  }
  if (/ENOTFOUND|getaddrinfo|dns/iu.test(text)) {
    return `${name} 의 호스트 이름을 찾지 못했어요. 주소 철자나 네트워크(Tailscale 등)를 확인하세요.${tail}`;
  }
  if (/ETIMEDOUT|timed out|timeout|aborted due to timeout/iu.test(text)) {
    return `${name} 의 응답이 너무 늦어요. 서버가 모델을 올리는 중이거나 멈췄을 수 있어요. 연결 설정에서 대기 시간을 늘려 보세요.${tail}`;
  }
  if (/\b(?:500|502|503|504)\b|bad gateway|service unavailable|internal server error/iu.test(text)) {
    return `${name} 쪽 서버 오류예요(5xx). 서버 로그를 확인하거나 잠시 뒤 다시 시도하세요.${tail}`;
  }
  if (/image|vision|multimodal/iu.test(text) && /not supported|unsupported|cannot|invalid/iu.test(text)) {
    return `${name} 의 모델이 이미지를 받지 못해요. Vision 역할에는 이미지를 지원하는 모델을 쓰거나 연결 설정의 「이미지 입력」을 확인하세요.${tail}`;
  }
  return text ? `${name}: ${text.slice(0, 400)}` : `${name} 호출이 실패했어요.`;
}

// ── 알려진 엔드포인트(브라우저 실행 중 사본) ──────────────────────────────────

let known: ReadonlyMap<string, OpenAiCompatEndpointPublic> = new Map();

/** 동반 서비스가 준 목록으로 갈아 끼운다. 브라우저에서는 변경 이벤트를 쏜다. */
export function setKnownOpenAiCompatEndpoints(list: readonly OpenAiCompatEndpointPublic[]): void {
  known = new Map(list.map((endpoint) => [endpoint.id, endpoint]));
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(OPENAI_COMPAT_CHANGED_EVENT));
  }
}

/** 알려진 엔드포인트 기준으로 이 모델이 막혔는지(UI 용). 엔드포인트를 모르면 null — 서버가 요청 시점에 다시 판정한다. */
export function openAiCompatModelBlockReason(providerId: string, modelId: string): string | null {
  const endpoint = known.get(providerId);
  if (!endpoint || !modelId.trim()) return null;
  const verdict = openAiCompatModelVerdict(endpoint, modelId);
  return verdict.allowed ? null : verdict.reason ?? "허용되지 않는 모델이에요.";
}

export function getKnownOpenAiCompatEndpoint(id: string): OpenAiCompatEndpointPublic | undefined {
  return known.get(id);
}

export function listKnownOpenAiCompatEndpoints(): readonly OpenAiCompatEndpointPublic[] {
  return [...known.values()];
}

/** 워커가 모델을 만들 때 필요한 값. 키는 여기 없다(providerApiKeys 로 따로 간다). 헤더 값은 루프백 워커로만 간다. */
export interface OpenAiCompatWorkerEndpoint {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly keyless: boolean;
  readonly reasoningMode: OpenAiCompatReasoningMode;
  readonly allowModels: readonly string[];
  readonly blockModels: readonly string[];
  readonly supportsImages: boolean;
  readonly imageModels?: readonly string[];
  readonly imageBlindModels?: readonly string[];
  readonly maxOutputTokens: number;
  readonly contextWindow: number;
  readonly firstTokenTimeoutSec: number;
}
