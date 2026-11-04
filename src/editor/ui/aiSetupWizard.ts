import { buildTeamPlan, type DetectedKey, type TeamInputs, type TeamPlan } from "@/ai/teamPlan";
import { applyTeamPlan, type TeamApplyDeps } from "@/ai/teamApply";
import { wizardScreen, type InstallGuide, type WizardAction, type WizardInputs, type WizardOs, type WizardService } from "@/ai/setupWizardModel";
import { renderAiSetupWizard, type WizardViewState } from "./aiSetupWizardView";
import type { DetectedAccount, DetectedCli } from "@/ai/planDefaults";

export interface WizardEnvironment {
  readonly os: WizardOs;
  readonly clis: readonly DetectedCli[];
  readonly accounts: readonly DetectedAccount[];
  readonly keys: readonly DetectedKey[];
  readonly installable: WizardInputs["installable"];
  readonly claudeInstalledNotSignedIn: boolean;
  readonly expired?: "chatgpt" | "google";
}

export interface WizardDeps extends TeamApplyDeps {
  readonly detect: () => Promise<WizardEnvironment>;
  readonly login: (service: "chatgpt" | "google" | "claude") => Promise<boolean>;
  readonly install: (cli: "claude" | "codex") => Promise<boolean>;
  readonly copy: (text: string) => Promise<void>;
  readonly pasteKey: (service: WizardService, key: string) => Promise<boolean>;
  readonly onDone: (connected: boolean) => void;
}

export interface WizardController {
  readonly element: HTMLElement;
  readonly refresh: () => Promise<void>;
}

const SERVICE_LOGIN = { chatgpt: "ChatGPT", google: "Google", claude: "Claude" } as const;

export function createAiSetupWizard(deps: WizardDeps): WizardController {
  const host = document.createElement("div");
  host.className = "app-modal-wizard-host";
  let env: WizardEnvironment | undefined;
  let chosen: WizardService | undefined;
  let busy: string | undefined;
  let notice: WizardViewState["notice"];
  let failure: string | undefined;
  let keyEntry = false;
  let copied = false;
  let picking = false;
  let runId = 0;

  const plan = (): TeamPlan | undefined => (env ? buildTeamPlan({ clis: env.clis, accounts: env.accounts, keys: env.keys } satisfies TeamInputs) : undefined);

  const paint = (): void => {
    const current = plan();
    const inputs: WizardInputs = {
      os: env?.os ?? "linux",
      finding: env === undefined,
      ...(current && !chosen ? { plan: current } : {}),
      keySources: !current && env ? env.keys.map((key) => ({ id: key.id, label: key.label })) : [],
      installable: env?.installable ?? {},
      claudeInstalledNotSignedIn: env?.claudeInstalledNotSignedIn ?? false,
      ...(env?.expired ? { expired: env.expired } : {}),
      ...(picking ? { picking } : {}),
      ...(chosen ? { chosen } : {}),
      ...(failure ? { failure } : {}),
      ...(copied ? { copied } : {}),
    };
    const screen = wizardScreen(inputs);
    const state: WizardViewState = { screen, ...(busy ? { busy } : {}), ...(notice ? { notice } : {}), ...(keyEntry ? { keyEntry: { service: chosen ?? "key" } } : {}), ...(copied ? { copied } : {}) };
    host.replaceChildren(renderAiSetupWizard(state, { onAction: (action, keyText) => void handle(action, keyText) }));
  };

  const run = async (label: string, work: () => Promise<void>): Promise<void> => {
    const id = ++runId;
    busy = label;
    notice = undefined;
    failure = undefined;
    paint();
    try { await work(); } finally {
      if (id === runId) { busy = undefined; paint(); }
    }
  };

  const refresh = async (): Promise<void> => {
    env = await deps.detect();
    paint();
  };

  const startPlan = async (target: TeamPlan): Promise<void> => {
    const result = await applyTeamPlan(target, deps);
    if (result.ok) { deps.onDone(true); return; }
    failure = `${result.problem ?? "시작하지 못했어요."} 인터넷이 연결돼 있는지 확인하고 다시 눌러 주세요.`;
  };

  async function handle(action: WizardAction, keyText?: string): Promise<void> {
    switch (action.id) {
      case "start-plan": {
        const target = plan();
        if (target) await run("준비하고 있어요…", () => startPlan(target));
        return;
      }
      case "use-key": {
        const key = env?.keys.find((row) => row.id === action.arg);
        const target = key && env ? buildTeamPlan({ clis: [], accounts: [], keys: [key] }) : undefined;
        if (target) await run("키를 확인하고 있어요…", () => startPlan(target));
        else failure = "이 키로는 시작할 수 없어요. 다른 AI를 골라 주세요.";
        paint();
        return;
      }
      case "choose-service":
        chosen = (action.arg as WizardService | undefined);
        picking = chosen === undefined;
        copied = false;
        failure = undefined;
        notice = undefined;
        keyEntry = chosen === "deepseek";
        paint();
        return;
      case "back":
        if (busy) { runId++; busy = undefined; }
        copied = false;
        picking = true;
        chosen = undefined; failure = undefined; notice = undefined; keyEntry = false;
        paint();
        return;
      case "login-chatgpt":
      case "login-google":
      case "login-claude": {
        const service = action.id === "login-chatgpt" ? "chatgpt" : action.id === "login-google" ? "google" : "claude";
        const id = runId + 1;
        await run(`인터넷 창에서 ${SERVICE_LOGIN[service]}에 로그인해 주세요…`, async () => {
          const ok = await deps.login(service);
          if (id !== runId) return;
          if (!ok) { failure = "로그인이 끝나지 않았어요. 인터넷 창에서 「허용」을 눌렀는지 확인해 주세요."; return; }
          await refresh();
          chosen = undefined; failure = undefined; picking = false;
          const target = plan();
          if (target) await startPlan(target);
        });
        return;
      }
      case "install-claude":
      case "install-chatgpt-helper": {
        const cli = action.id === "install-claude" ? "claude" : "codex";
        await run("설치하고 있어요. 1~2분 걸려요. 검은 창이 잠깐 보여도 닫지 마세요…", async () => {
          const ok = await deps.install(cli);
          await refresh();
          if (ok && plan()) { chosen = undefined; failure = undefined; picking = false; return; }
          failure = ok ? undefined : "설치가 끝나지 않았어요. 「직접 설치하기」를 열어 따라 해 볼 수도 있어요.";
        });
        return;
      }
      case "copy-command": {
        const guide: InstallGuide | undefined = env?.installable[(action.arg === "claude" ? "claude" : "codex")];
        const text = action.arg && action.arg !== "claude" && action.arg !== "codex" ? action.arg : guide?.command;
        if (text) {
          await deps.copy(text);
          copied = true;
          notice = { tone: "ok", text: "복사했어요. 열어 둔 창에 Ctrl+V 로 붙여 넣고 Enter 를 눌러요." };
        }
        paint();
        return;
      }
      case "recheck":
        await run("다시 찾고 있어요…", async () => {
          await refresh();
          if (plan()) { chosen = undefined; failure = undefined; picking = false; return; }
          if (!env?.claudeInstalledNotSignedIn) failure = "아직 Claude가 보이지 않아요. 설치가 끝나려면 1~2분 걸려요. 조금 뒤 다시 눌러 주세요.";
        });
        return;
      case "paste-key": {
        const service: WizardService = (action.arg as WizardService | undefined) ?? chosen ?? "deepseek";
        if (!keyText) { chosen = service; keyEntry = true; paint(); return; }
        await run("키를 확인하고 있어요…", async () => {
          const ok = await deps.pasteKey(service, keyText);
          if (ok) { deps.onDone(true); return; }
          failure = "이 키로는 연결되지 않았어요. 키를 다시 복사해 붙여 넣어 주세요.";
        });
        return;
      }
      case "advanced":
        return;
      case "later":
        if (busy) { runId++; busy = undefined; paint(); return; }
        deps.onDone(false);
        return;
    }
  }

  void refresh();
  paint();
  return { element: host, refresh };
}
