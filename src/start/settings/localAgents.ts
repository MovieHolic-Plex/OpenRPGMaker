// start/settings/localAgents.ts
// 설정 화면 「AI 엔진·모델」이 읽는 로컬 에이전트 백엔드의 얼굴.
//
// 백엔드는 PR #3072(agent/assistant-claude-p)가 짓는다(동반 서비스):
//   GET  /v1/local-agents[?fresh=1]   → { clis: LocalCliStatus[], recommended?: "claude"|"codex"|"gemini" }  (30초 캐시, fresh 로 우회)
//   POST /v1/local-agents/health {cli} → 그 프로그램으로 아주 짧은 「OK」 왕복 한 번
// 이 모듈은 그 모양만 안다(타입을 복사해 둔다 — 그쪽 src/ai/localCliEngine.ts · scripts/lib/localCliAgent/types.ts 가 정본). 합쳐지기 전에는
// 깃발(oprn:flag:local-agents=1 또는 ?localAgents=1)이 꺼져 있어 아무 요청도 보내지 않고, 화면은 「곧 켜져요」로 둔다.
// 엔진 선택 저장 키·모양은 그쪽 src/ai/localCliEngine.ts 와 같다(oprn:assistant-engine) — 고른 값은 조수가 그대로 읽는다.
//
// 첫 화면 번들을 키우지 않게 이 파일은 아무것도 가져오지 않는다(동반 서비스 주소·토큰은 window 에서 직접 읽는다).

export type LocalCliId = "claude" | "codex" | "gemini";
export const LOCAL_CLI_IDS: readonly LocalCliId[] = ["claude", "codex", "gemini"];

export type LocalCliModel = { readonly id: string; readonly label: string; readonly roles?: readonly ("routine" | "deep")[] };

/** 감지 한 줄 — #3072 LocalCliStatus 와 같은 모양. 문구(stateLabel·help)는 백엔드가 비개발자용으로 준다. */
export type LocalCliStatus = {
  readonly id: LocalCliId;
  readonly label: string;
  readonly state: "ready" | "login-required" | "not-installed" | "error";
  readonly stateLabel: string;
  readonly found: boolean;
  readonly version?: string;
  readonly loggedIn?: boolean;
  readonly authMethod?: string;
  readonly billing: "subscription" | "api" | "unknown";
  readonly models: readonly LocalCliModel[];
  readonly defaults: { readonly routine: string; readonly deep: string };
  readonly install: { readonly command: string; readonly help: string; readonly url: string };
  readonly login: { readonly command: string; readonly help: string };
  readonly problem?: string;
};

export type LocalAgentsReport = {
  readonly clis: readonly LocalCliStatus[];
  readonly recommended?: LocalCliId;
};

export type HealthResult = { readonly ok: boolean; readonly ms: number; readonly reply?: string; readonly problem?: string };

export type LocalAgentsApi = {
  detect(fresh?: boolean): Promise<LocalAgentsReport>;
  health(id: LocalCliId): Promise<HealthResult>;
};

/** 고른 엔진 — #3072 AssistantEngineChoice 와 같은 저장 모양. 비우면 기존 엔진(편집기의 AI 연결)이다. */
export type AssistantEngineChoice = {
  readonly kind: "local-cli";
  readonly cli: LocalCliId;
  readonly routineModel?: string;
  readonly deepModel?: string;
  readonly effort?: "low" | "medium" | "high";
};

export const ASSISTANT_ENGINE_STORAGE_KEY = "oprn:assistant-engine";
export const LOCAL_AGENTS_FLAG_KEY = "oprn:flag:local-agents";

function storage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function query(name: string): string | null {
  try { return typeof location === "undefined" ? null : new URLSearchParams(location.search).get(name); } catch { return null; }
}

/**
 * 백엔드(/v1/local-agents, PR #3072)가 이 빌드에 들어 있는가. 들어오기 전에는 깃발·주소 인자가 있어도 **요청을 보내지 않는다** —
 * 없는 경로를 부르면 동반 서비스가 404 를 돌려주고 화면은 «목록을 읽지 못했어요» 가 된다. #3072 가 합쳐질 때 true 로 바꾼다.
 */
export const LOCAL_AGENTS_BACKEND_AVAILABLE = false;

/** 백엔드가 있고 깃발이 켜졌을 때만 켠다. 그 전에는 화면만 「준비 중」으로 보이고 요청은 보내지 않는다(목업은 예외 — 요청 없음). */
export function localAgentsEnabled(): boolean {
  if (query("localAgentsMock") === "1") return true;
  if (!LOCAL_AGENTS_BACKEND_AVAILABLE) return false;
  if (query("localAgents") === "1") return true;
  return storage()?.getItem(LOCAL_AGENTS_FLAG_KEY) === "1";
}

export function loadEngineChoice(): AssistantEngineChoice | null {
  const raw = storage()?.getItem(ASSISTANT_ENGINE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AssistantEngineChoice>;
    if (value?.kind !== "local-cli" || !LOCAL_CLI_IDS.includes(value.cli as LocalCliId)) return null;
    const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const routineModel = text(value.routineModel);
    const deepModel = text(value.deepModel);
    return {
      kind: "local-cli", cli: value.cli as LocalCliId,
      ...(routineModel ? { routineModel } : {}), ...(deepModel ? { deepModel } : {}),
      ...(value.effort === "low" || value.effort === "medium" || value.effort === "high" ? { effort: value.effort } : {}),
    };
  } catch {
    return null;
  }
}

export function saveEngineChoice(choice: AssistantEngineChoice | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (choice) store.setItem(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify(choice));
    else store.removeItem(ASSISTANT_ENGINE_STORAGE_KEY);
  } catch { /* 저장을 못 해도 이번 화면은 그대로 */ }
}

/** 동반 서비스 주소. 데스크톱은 preload 가 준 값(chatgptOAuthClient 의 companionOrigin 과 같은 규칙), 없으면 같은 오리진. */
function companionBase(): string {
  return (typeof window !== "undefined" ? (window as { oprn?: { companionOrigin?: string } }).oprn?.companionOrigin : undefined) ?? "";
}

function companionHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? (window as { oprn?: { companionToken?: string } }).oprn?.companionToken : undefined;
  return { "Content-Type": "application/json", ...(token ? { "x-oprn-companion-token": token } : {}) };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${companionBase()}/v1${path}`, { method, headers: companionHeaders(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as T;
}

export function createLocalAgentsApi(): LocalAgentsApi {
  if (query("localAgentsMock") === "1") return mockLocalAgentsApi();
  return {
    detect: (fresh = false) => call<LocalAgentsReport>("GET", fresh ? "/local-agents?fresh=1" : "/local-agents"),
    health: (id) => call<HealthResult>("POST", "/local-agents/health", { cli: id }),
  };
}

/** 화면 확인용(?localAgentsMock=1) — 네 상태(연결됨·로그인 필요·찾지 못함)를 한 번에 보인다. 실제 요청은 없다. */
export function mockLocalAgentsApi(): LocalAgentsApi {
  const base = { models: [] as LocalCliModel[], install: { command: "", help: "", url: "" }, login: { command: "", help: "" } };
  const clis: LocalCliStatus[] = [
    { ...base, id: "claude", label: "Claude Code", state: "ready", stateLabel: "연결됨", found: true, version: "2.1.284", loggedIn: true, authMethod: "구독", billing: "subscription",
      models: [{ id: "sonnet", label: "Sonnet" }, { id: "opus", label: "Opus" }, { id: "haiku", label: "Haiku" }], defaults: { routine: "sonnet", deep: "opus" } },
    { ...base, id: "codex", label: "Codex", state: "login-required", stateLabel: "로그인 필요", found: true, version: "0.98.0", billing: "unknown",
      defaults: { routine: "", deep: "" }, login: { command: "codex login", help: "터미널에서 이 명령을 실행해 로그인해 주세요." } },
    { ...base, id: "gemini", label: "Gemini CLI", state: "not-installed", stateLabel: "설치 필요", found: false, billing: "unknown",
      defaults: { routine: "", deep: "" }, install: { command: "npm install -g @google/gemini-cli", help: "", url: "https://github.com/google-gemini/gemini-cli" } },
  ];
  return {
    detect: async () => ({ clis, recommended: "claude" }),
    health: async (id) => (id === "claude" ? { ok: true, ms: 1900, reply: "OK" } : { ok: false, ms: 300, problem: "로그인이 필요해요" }),
  };
}

/** 비용 한 줄(#3072 D8 와 같은 규칙). 구독이면 청구가 아니라 한도 사용이다. */
export function costLine(billing: LocalCliStatus["billing"], costUsd?: number): string {
  if (billing === "subscription") return costUsd === undefined ? "구독 한도에서 써요(따로 청구되지 않아요)" : `구독 한도에서 써요 · 환산 $${costUsd.toFixed(2)}(청구 아님)`;
  if (billing === "api") return costUsd === undefined ? "쓴 만큼 키 계정에 청구돼요" : `이번 달 $${costUsd.toFixed(2)}`;
  return "요금은 그 프로그램의 계정 기준이에요";
}
