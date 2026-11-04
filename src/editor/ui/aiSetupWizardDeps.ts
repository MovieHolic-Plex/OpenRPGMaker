import { adoptKeySource, fetchChatGptAuthStatus, fetchKeySources, hasUsableCompanionCredential, startChatGptLogin, setCompanionEnvScan } from "@/ai/chatgptOAuthClient";
import { loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { configForProviderSelection } from "@/ai/providerSelection";
import { saveAssistantEngine } from "@/ai/localCliEngine";
import { CODEX_ACCOUNT_PROVIDER_ID, GOOGLE_ACCOUNT_PROVIDER_ID, configForPlanAccount, type DetectedAccount } from "@/ai/planDefaults";
import { KEY_ROUTES } from "@/ai/keyRoutes";
import { TEAM_MODELS } from "@/ai/teamScoreboard";
import type { DetectedKey } from "@/ai/teamPlan";
import { saveTeamLead } from "@/ai/teamLeadStore";
import type { WizardService } from "@/ai/setupWizardModel";
import { createLocalAgentsApi, localAgentsEnabled, type LocalCliStatus } from "@/start/settings/localAgents";
import { getAiConnectionStatus, refreshAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import type { WizardDeps, WizardEnvironment } from "./aiSetupWizard";

const LOGIN_POLL_MS = 2000;
const LOGIN_WINDOW_MS = 5 * 60_000;

function detectOs(): WizardEnvironment["os"] {
  const platform = typeof navigator !== "undefined" ? `${navigator.platform} ${navigator.userAgent}` : "";
  if (/win/iu.test(platform) && !/darwin/iu.test(platform)) return "win32";
  if (/mac/iu.test(platform)) return "darwin";
  return "linux";
}

function installGuide(cli: LocalCliStatus | undefined, os: WizardEnvironment["os"]): { command: string; opens: string; runnable: boolean } | undefined {
  if (!cli) return undefined;
  const step = cli.installByOs?.[os];
  const command = step?.command ?? cli.install.command;
  if (!command) return undefined;
  const opens = os === "win32" ? "PowerShell (시작 메뉴에서 「PowerShell」을 찾아 열어요)" : os === "darwin" ? "터미널 (Spotlight 에서 「터미널」을 찾아 열어요)" : "터미널";
  const runnable = (cli.id === "claude" || cli.id === "codex") && step?.requires !== "node";
  return { command, opens, runnable };
}

async function detectEnvironment(): Promise<WizardEnvironment> {
  const os = detectOs();
  const agents = localAgentsEnabled() ? createLocalAgentsApi().detect(true).then((report) => report.clis, () => [] as readonly LocalCliStatus[]) : Promise.resolve([] as readonly LocalCliStatus[]);
  const accounts = Promise.all([CODEX_ACCOUNT_PROVIDER_ID, GOOGLE_ACCOUNT_PROVIDER_ID].map((providerId) =>
    fetchChatGptAuthStatus(providerId).then((status): DetectedAccount => ({ providerId, ...status }), () => null),
  )).then((rows) => rows.filter((row): row is DetectedAccount => row !== null));
  const sources = fetchKeySources().then((result) => result.sources, () => []);
  const [clis, accountRows, keySources] = await Promise.all([agents, accounts, sources]);
  const keys: DetectedKey[] = keySources.filter((source) => source.adoptable).map((source) => {
    const route = KEY_ROUTES[source.family];
    return { id: source.id, family: source.family, label: source.label, models: route.models };
  });
  const claude = clis.find((cli) => cli.id === "claude");
  const codex = clis.find((cli) => cli.id === "codex");
  return {
    os,
    clis,
    accounts: accountRows,
    keys,
    installable: {
      ...(claude && claude.state === "not-installed" ? { claude: installGuide(claude, os)! } : {}),
      ...(codex && codex.state === "not-installed" ? { codex: installGuide(codex, os)! } : {}),
    },
    claudeInstalledNotSignedIn: claude?.state === "login-required",
  };
}

async function connectedNow(): Promise<boolean> {
  try { await refreshAiConnectionStatus(); } catch { /* 판정은 캐시가 한다 */ }
  const config = loadAiConfig();
  return isAssistantEndpointReady(config, getAiConnectionStatus(config));
}

async function loginAndWait(providerId: string, open: (url: string) => void): Promise<boolean> {
  const login = await startChatGptLogin(providerId);
  if (login.connected) return true;
  if (login.verificationUrl) open(login.verificationUrl);
  const deadline = Date.now() + Math.min(LOGIN_WINDOW_MS, login.expiresAt ? Math.max(0, login.expiresAt - Date.now()) : LOGIN_WINDOW_MS);
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, LOGIN_POLL_MS));
    const status = await fetchChatGptAuthStatus(providerId).catch(() => undefined);
    if (status && hasUsableCompanionCredential(status)) return true;
    if (status?.lastLoginError) return false;
  }
  return false;
}

export function realWizardDeps(onDone: (connected: boolean) => void): WizardDeps {
  const openWindow = (url: string): void => {
    if (typeof window !== "undefined" && typeof window.open === "function") window.open(url, "_blank", "noopener,noreferrer");
  };
  return {
    detect: detectEnvironment,
    login: async (service) => {
      if (service === "claude") {
        const result = await createLocalAgentsApi().health("claude").catch(() => undefined);
        return result?.ok === true;
      }
      return loginAndWait(service === "chatgpt" ? CODEX_ACCOUNT_PROVIDER_ID : GOOGLE_ACCOUNT_PROVIDER_ID, openWindow);
    },
    install: async (cli) => (await createLocalAgentsApi().install(cli).catch(() => ({ ok: false, code: "failed", message: "" }))).ok,
    copy: async (text) => { await navigator.clipboard?.writeText(text); },
    pasteKey: async (service: WizardService, key: string) => {
      if (service !== "deepseek") return false;
      const { connectOpenAiCompatEndpoint } = await import("@/ai/chatgptOAuthClient");
      const route = KEY_ROUTES.deepseek;
      const result = await connectOpenAiCompatEndpoint({ kind: "custom", baseUrl: route.baseUrl, apiKey: key, model: route.models.deepseek ?? TEAM_MODELS.deepseek.id }).catch(() => undefined);
      if (!result?.ok || !result.endpoint) return false;
      saveAiConfig(configForProviderSelection(loadAiConfig(), result.endpoint.id));
      return connectedNow();
    },
    adoptKey: async (sourceId, modelId) => {
      void modelId;
      const result = await adoptKeySource(sourceId).catch(() => undefined);
      return result?.ok && result.endpoint ? result.endpoint.id : undefined;
    },
    saveEngine: saveAssistantEngine,
    saveLead: saveTeamLead,
    selectProvider: (providerId, workerModel) => {
      const base = configForProviderSelection(loadAiConfig(), providerId);
      saveAiConfig(providerId === CODEX_ACCOUNT_PROVIDER_ID ? configForPlanAccount(base, providerId) : { ...base, model: workerModel });
    },
    onDone,
  };
}

export { setCompanionEnvScan };
