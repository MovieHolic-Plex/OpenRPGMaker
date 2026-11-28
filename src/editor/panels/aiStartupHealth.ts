// editor/panels/aiStartupHealth.ts
// 에디터 시작 시 핵심 3대장(GPT · Claude · Gemini)의 로그인 상태와 실제 응답(health)을 확인해 보관한다.
//
// 왜 필요한가:
//  - /auth/status 와 local-agents 감지는 로컬 토큰/CLI 존재 여부만 본다.
//  - 에디터를 켜자마자 ChatGPT(Codex 로그인 포함)와 Claude 의 로그인 상태와 실제 응답 가능 여부를
//    백그라운드에서 한 번 확인해 두면, AI 설정의 3버튼 화면에서 곧바로 연결 상태를 보여 주고
//    만료·오류를 사용자가 첫 요청을 보내기 전에 알 수 있다.
import { fetchCachedAuthStatus } from "@/ai/authStatusCache";
import { companionAuthUrl, fetchChatGptAuthStatus, hasUsableCompanionCredential, type ChatGptAuthStatus } from "@/ai/chatgptOAuthClient";
import { fetchCompanion } from "@/ai/companionConnection";
import { localCliProviderId } from "@/ai/localCliEngine";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { ANTHROPIC_PROVIDER_ID } from "@/ai/ohMyPiProviders";
import type { ProviderUsageSnapshot } from "@/ai/providerQuota";
import { createLocalAgentsApi, localAgentsEnabled, type LocalCliId, type LocalCliStatus } from "@/start/settings/localAgents";

export type CoreProviderFamily = "gpt" | "claude" | "gemini";
export const CORE_PROVIDER_FAMILIES: readonly CoreProviderFamily[] = ["gpt", "claude", "gemini"];

export const AI_STARTUP_HEALTH_EVENT = "oprn:ai-startup-health";
const HEALTH_TTL_MS = 5 * 60 * 1000;

export interface CoreProviderHealth {
  readonly family: CoreProviderFamily;
  readonly state: "idle" | "checking" | "ok" | "needs-login" | "error";
  /** 연결이 살아 있을 때 쓸 제공자 ID (예: openai-codex, local-cli:claude, google-antigravity). */
  readonly routeProviderId?: string;
  readonly via?: "oauth" | "local-cli" | "env";
  /** 실제 서버/CLI 왕복(사용량 조회 또는 health)까지 확인했는가. */
  readonly verifiedLive?: boolean;
  readonly accountEmail?: string;
  readonly planType?: string;
  readonly usage?: ProviderUsageSnapshot | null;
  readonly cli?: LocalCliStatus;
  readonly latencyMs?: number;
  readonly message?: string;
  readonly checkedAt?: number;
}

export type StartupHealthMap = Readonly<Record<CoreProviderFamily, CoreProviderHealth>>;

const OAUTH_PROVIDER_FOR: Readonly<Record<CoreProviderFamily, string>> = {
  gpt: CODEX_PROVIDER_ID,
  claude: ANTHROPIC_PROVIDER_ID,
  gemini: ANTIGRAVITY_PROVIDER_ID,
};

const CLI_ID_FOR: Readonly<Record<CoreProviderFamily, LocalCliId>> = {
  gpt: "codex",
  claude: "claude",
  gemini: "agy",
};

function initialEntry(family: CoreProviderFamily): CoreProviderHealth {
  return { family, state: "idle" };
}

let snapshot: Record<CoreProviderFamily, CoreProviderHealth> = {
  gpt: initialEntry("gpt"),
  claude: initialEntry("claude"),
  gemini: initialEntry("gemini"),
};
let lastRunAt = 0;
let inFlight: Promise<StartupHealthMap> | null = null;
const liveHealthCheckedAt = new Map<CoreProviderFamily, number>();

function emit(): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(AI_STARTUP_HEALTH_EVENT, { detail: getStartupAiHealth() }));
  }
}

export function getStartupAiHealth(): StartupHealthMap {
  return { gpt: snapshot.gpt, claude: snapshot.claude, gemini: snapshot.gemini };
}

export function resetStartupAiHealthForTests(): void {
  snapshot = { gpt: initialEntry("gpt"), claude: initialEntry("claude"), gemini: initialEntry("gemini") };
  lastRunAt = 0;
  inFlight = null;
  liveHealthCheckedAt.clear();
}

async function fetchUsageQuiet(providerId: string): Promise<ProviderUsageSnapshot | null> {
  try {
    const response = await fetchCompanion(companionAuthUrl("/auth/usage", providerId), undefined, { notifyProblems: false });
    if (!response.ok) return null;
    const body = await response.json() as ProviderUsageSnapshot;
    return body && typeof body.readable === "boolean" ? body : null;
  } catch {
    return null;
  }
}

async function fetchOAuthQuiet(providerId: string, fresh: boolean): Promise<{ auth?: ChatGptAuthStatus; error?: string }> {
  try {
    const auth = fresh ? await fetchChatGptAuthStatus(providerId) : await fetchCachedAuthStatus(providerId);
    return { auth };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "연결 상태를 확인하지 못했어요." };
  }
}

async function evaluateFamily(
  family: CoreProviderFamily,
  cli: LocalCliStatus | undefined,
  options: { readonly fresh: boolean; readonly liveHealth: boolean },
): Promise<CoreProviderHealth> {
  const oauthId = OAUTH_PROVIDER_FOR[family];
  const cliId = CLI_ID_FOR[family];
  // Google Antigravity 직접 OAuth 는 계정 정지 위험으로 비활성화한다(공식 agy ACP 또는 Gemini API 키만 사용).
  const oauthAllowed = family !== "gemini";
  const { auth, error } = oauthAllowed ? await fetchOAuthQuiet(oauthId, options.fresh) : { auth: undefined, error: undefined };
  const now = Date.now();
  const oauthUsable = oauthAllowed && Boolean(auth && hasUsableCompanionCredential(auth));
  const cliReady = cli?.state === "ready";

  // 1) OAuth(Codex ~/.codex/auth.json 자동 입양 포함) 또는 환경 변수로 연결됨
  if (oauthUsable && auth) {
    const usage = family === "gpt" ? await fetchUsageQuiet(oauthId) : null;
    const verifiedLive = Boolean(usage?.readable);
    if (verifiedLive) liveHealthCheckedAt.set(family, now);
    return {
      family,
      state: "ok",
      routeProviderId: oauthId,
      via: auth.env ? "env" : "oauth",
      verifiedLive,
      accountEmail: auth.accountEmail,
      planType: auth.planType,
      usage,
      cli,
      checkedAt: now,
    };
  }

  // 2) 이 PC 에 로그인된 로컬 CLI(Claude Code · Codex CLI · Antigravity ACP)로 연결됨
  if (cliReady) {
    const shouldHealth = options.liveHealth
      && (options.fresh || (now - (liveHealthCheckedAt.get(family) ?? 0) > HEALTH_TTL_MS));
    if (shouldHealth && localAgentsEnabled()) {
      try {
        const health = await createLocalAgentsApi().health(cliId);
        liveHealthCheckedAt.set(family, Date.now());
        return {
          family,
          state: health.ok ? "ok" : "error",
          routeProviderId: localCliProviderId(cliId),
          via: "local-cli",
          verifiedLive: health.ok,
          latencyMs: health.ms,
          cli,
          ...(health.ok ? {} : { message: health.problem || "연결 시험에 실패했어요." }),
          checkedAt: Date.now(),
        };
      } catch (err) {
        return {
          family,
          state: "error",
          routeProviderId: localCliProviderId(cliId),
          via: "local-cli",
          verifiedLive: false,
          cli,
          message: err instanceof Error ? err.message : "연결 시험에 실패했어요.",
          checkedAt: Date.now(),
        };
      }
    }
    const prev = snapshot[family];
    return {
      family,
      state: "ok",
      routeProviderId: localCliProviderId(cliId),
      via: "local-cli",
      verifiedLive: prev.routeProviderId === localCliProviderId(cliId) ? prev.verifiedLive : false,
      latencyMs: prev.routeProviderId === localCliProviderId(cliId) ? prev.latencyMs : undefined,
      cli,
      checkedAt: now,
    };
  }

  // 3) 자격 만료 또는 로그인 실패
  if (auth?.expired) {
    return {
      family,
      state: "needs-login",
      cli,
      message: "로그인이 만료됐어요. 다시 로그인해 주세요.",
      checkedAt: now,
    };
  }
  if (auth?.lastLoginError) {
    return {
      family,
      state: "error",
      cli,
      message: auth.lastLoginError,
      checkedAt: now,
    };
  }
  if (error && !cli) {
    return {
      family,
      state: "error",
      cli,
      message: error,
      checkedAt: now,
    };
  }
  return {
    family,
    state: "needs-login",
    cli,
    checkedAt: now,
  };
}

/**
 * 핵심 3대장(GPT · Claude · Gemini)의 로그인 상태를 한 번에 점검한다.
 * `liveHealth: true` 면 에디터 시작 시 연결된 ChatGPT·Claude 에 실제 응답 확인(usage/health)까지 수행한다.
 */
export function runStartupAiHealthCheck(options: { readonly force?: boolean; readonly liveHealth?: boolean } = {}): Promise<StartupHealthMap> {
  const force = options.force === true;
  const liveHealth = options.liveHealth === true;
  if (!force && inFlight) return inFlight;
  if (!force && lastRunAt > 0 && Date.now() - lastRunAt < HEALTH_TTL_MS && (!liveHealth || liveHealthCheckedAt.size > 0)) {
    return Promise.resolve(getStartupAiHealth());
  }
  const run = (async (): Promise<StartupHealthMap> => {
    for (const family of CORE_PROVIDER_FAMILIES) {
      if (snapshot[family].state === "idle" || force) {
        snapshot[family] = { ...snapshot[family], state: "checking" };
      }
    }
    emit();

    const clis = localAgentsEnabled()
      ? await createLocalAgentsApi().detect(force).then((report) => report.clis, () => [] as readonly LocalCliStatus[])
      : [];
    const cliById = new Map(clis.map((row) => [row.id, row]));

    // 먼저 빠른 로그인/자격 상태부터 반영(특히 GPT·Claude)
    const initialResults = await Promise.all(
      CORE_PROVIDER_FAMILIES.map((family) => evaluateFamily(family, cliById.get(CLI_ID_FOR[family]), { fresh: force, liveHealth: false })),
    );
    for (const row of initialResults) snapshot[row.family] = row;
    lastRunAt = Date.now();
    emit();

    // 에디터 시작 시 연결된 ChatGPT·Claude 의 실제 응답(health)까지 비동기로 검증
    if (liveHealth) {
      const liveTargets: CoreProviderFamily[] = ["gpt", "claude"];
      const liveResults = await Promise.all(
        liveTargets.map((family) => evaluateFamily(family, cliById.get(CLI_ID_FOR[family]), { fresh: false, liveHealth: true })),
      );
      for (const row of liveResults) snapshot[row.family] = row;
      lastRunAt = Date.now();
      emit();
    }
    return getStartupAiHealth();
  })();

  inFlight = run.finally(() => { if (inFlight === run) inFlight = null; });
  return inFlight;
}

/** 사용자가 설정 화면에서 특정 AI(GPT · Claude · Gemini)의 「연결 확인」을 눌렀을 때. */
export async function checkSingleProviderHealth(family: CoreProviderFamily): Promise<CoreProviderHealth> {
  snapshot[family] = { ...snapshot[family], state: "checking" };
  emit();
  const clis = localAgentsEnabled()
    ? await createLocalAgentsApi().detect(true).then((report) => report.clis, () => [] as readonly LocalCliStatus[])
    : [];
  const cli = clis.find((row) => row.id === CLI_ID_FOR[family]);
  const next = await evaluateFamily(family, cli, { fresh: true, liveHealth: true });
  snapshot[family] = next;
  emit();
  return next;
}
