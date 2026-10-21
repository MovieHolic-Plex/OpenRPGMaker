// start/settings/localAgents.ts
// 설정 화면 「AI 엔진·모델」이 읽는 로컬 에이전트 백엔드의 얼굴.
//
// 백엔드(동반 서비스, scripts/lib/localCliAgent/):
//   GET  /v1/local-agents[?fresh=1]   → { clis: LocalCliStatus[], recommended?: "claude"|"codex"|"gemini" }  (30초 캐시, fresh 로 우회)
//   POST /v1/local-agents/health {cli} → 그 프로그램으로 아주 짧은 「OK」 왕복 한 번
// 응답 모양은 scripts/lib/localCliAgent/types.ts 가 정본이다(Node 전용 모듈이라 여기 모양만 옮겨 둔다).
// 엔진 선택 저장·해석은 조수가 읽는 src/ai/localCliEngine.ts 하나를 쓴다(그 모듈은 타입 말고 아무것도 가져오지 않아 첫 화면 번들이 늘지 않는다).
// 고르는 것은 여전히 opt-in 이다 — 고르지 않으면(또는 「원래 AI 연결로 되돌리기」) 기존 엔진이다.

import { fetchCompanion } from "@/ai/companionConnection";
import { ASSISTANT_ENGINE_STORAGE_KEY, LOCAL_CLI_ENGINE_IDS, loadAssistantEngine, saveAssistantEngine, type AssistantEngineChoice, type LocalCliEngineId } from "@/ai/localCliEngine";

export { ASSISTANT_ENGINE_STORAGE_KEY, type AssistantEngineChoice };

export type LocalCliId = LocalCliEngineId;
export const LOCAL_CLI_IDS: readonly LocalCliId[] = LOCAL_CLI_ENGINE_IDS;

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

export const LOCAL_AGENTS_FLAG_KEY = "oprn:flag:local-agents";

function storage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function query(name: string): string | null {
  try { return typeof location === "undefined" ? null : new URLSearchParams(location.search).get(name); } catch { return null; }
}

/** 백엔드(/v1/local-agents)가 이 빌드에 들어 있는가 — #3072 로 들어왔다. 끄면 깃발이 있어도 요청을 보내지 않는다(없는 경로는 404). */
export const LOCAL_AGENTS_BACKEND_AVAILABLE = true;

/** 감지를 켤지. 기본으로 켠다 — 화면 확인용 깃발 값 "0" 으로만 끈다(감지는 상태 명령뿐이라 싸다). 목업은 요청 없이 항상 켠다. */
export function localAgentsEnabled(): boolean {
  if (query("localAgentsMock") === "1") return true;
  if (!LOCAL_AGENTS_BACKEND_AVAILABLE) return false;
  if (query("localAgents") === "0") return false;
  return storage()?.getItem(LOCAL_AGENTS_FLAG_KEY) !== "0";
}

export function loadEngineChoice(): AssistantEngineChoice | null {
  return loadAssistantEngine() ?? null;
}

export function saveEngineChoice(choice: AssistantEngineChoice | null): void {
  try { saveAssistantEngine(choice ?? undefined); } catch { /* 저장을 못 해도 이번 화면은 그대로 */ }
}

/** 동반 서비스 주소. 데스크톱은 preload 가 준 값(chatgptOAuthClient 의 companionOrigin 과 같은 규칙), 없으면 같은 오리진. */
function companionBase(): string {
  return (typeof window !== "undefined" ? (window as { oprn?: { companionOrigin?: string } }).oprn?.companionOrigin : undefined) ?? "";
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  // 토큰·서버 재시작 뒤 다시 맺기는 한 입구(fetchCompanion)가 맡는다.
  const response = await fetchCompanion(`${companionBase()}/v1${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
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

/** 비용 한 줄(D8 와 같은 규칙, 조수 쪽은 localCliEngine.formatLocalCliCost). 구독이면 청구가 아니라 한도 사용이다. */
export function costLine(billing: LocalCliStatus["billing"], costUsd?: number): string {
  if (billing === "subscription") return costUsd === undefined ? "구독 한도에서 써요(따로 청구되지 않아요)" : `구독 한도에서 써요 · 환산 $${costUsd.toFixed(2)}(청구 아님)`;
  if (billing === "api") return costUsd === undefined ? "쓴 만큼 키 계정에 청구돼요" : `이번 달 $${costUsd.toFixed(2)}`;
  return "요금은 그 프로그램의 계정 기준이에요";
}
