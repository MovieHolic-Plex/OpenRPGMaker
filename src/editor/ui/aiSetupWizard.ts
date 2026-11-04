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
      ...(chosen ? { chosen } : {}),
      ...(failure ? { failure } : {}),
    };
    const screen = wizardScreen(inputs);
    const state: WizardViewState = { screen, ...(busy ? { busy } : {}), ...(notice ? { notice } : {}), ...(keyEntry ? { keyEntry: { service: chosen ?? "key" } } : {}), ...(copied ? { copied } : {}) };
    host.replaceChildren(renderAiSetupWizard(state, { onAction: (action, keyText) => void handle(action, keyText) }));
  };

  const run = async (label: string, work: () => Promise<void>): Promise<void> => {
    busy = label;
    notice = undefined;
    paint();
    try { await work(); } finally { busy = undefined; paint(); }
  };

  const refresh = async (): Promise<void> => {
    env = await deps.detect();
    paint();
  };

  const startPlan = async (target: TeamPlan): Promise<void> => {
    const result = await applyTeamPlan(target, deps);
    if (result.ok) { deps.onDone(true); return; }
    notice = { tone: "error", text: result.problem ?? "시작하지 못했어요. 다시 눌러 주세요." };
  };

  async function handle(action: WizardAction, keyText?: string): Promise<void> {
    switch (action.id) {
      case "start-plan": {
        const target = plan();
        if (target) await run("AI 팀을 준비하고 있어요…", () => startPlan(target));
        return;
      }
      case "use-key": {
        const key = env?.keys.find((row) => row.id === action.arg);
        const target = key && env ? buildTeamPlan({ clis: [], accounts: [], keys: [key] }) : undefined;
        if (target) await run("키를 확인하고 있어요…", () => startPlan(target));
        else notice = { tone: "error", text: "이 키로는 AI 팀을 만들 수 없어요. 다른 방법을 골라 주세요." };
        paint();
        return;
      }
      case "choose-service":
        chosen = (action.arg as WizardService | undefined);
        copied = false;
        failure = undefined;
        notice = undefined;
        keyEntry = chosen === "deepseek";
        paint();
        return;
      case "back":
        copied = false;
        chosen = undefined; failure = undefined; notice = undefined; keyEntry = false;
        paint();
        return;
      case "login-chatgpt":
      case "login-google":
      case "login-claude": {
        const service = action.id === "login-chatgpt" ? "chatgpt" : action.id === "login-google" ? "google" : "claude";
        await run(`${SERVICE_LOGIN[service]} 로그인 창을 열었어요. 로그인을 마치면 이 화면이 알아서 넘어가요…`, async () => {
          const ok = await deps.login(service);
          if (!ok) { failure = "아직 로그인이 끝나지 않았어요. 인터넷 창에서 「허용」을 눌렀는지 확인하고 다시 눌러 주세요."; return; }
          await refresh();
          chosen = undefined; failure = undefined;
          const target = plan();
          if (target) await startPlan(target);
        });
        return;
      }
      case "install-claude":
      case "install-chatgpt-helper": {
        const cli = action.id === "install-claude" ? "claude" : "codex";
        await run("설치하고 있어요. 1~2분 걸려요. 검은 창이 잠깐 보일 수 있어요. 닫지 마세요…", async () => {
          const ok = await deps.install(cli);
          failure = ok ? undefined : "설치가 끝나지 않았어요. 아래 「직접 설치하기」를 열어서 따라 해 볼 수도 있어요.";
          await refresh();
          if (ok && plan()) { chosen = undefined; failure = undefined; }
        });
        return;
      }
      case "copy-command": {
        const guide: InstallGuide | undefined = env?.installable[(action.arg === "claude" ? "claude" : "codex")];
        const text = action.arg && action.arg !== "claude" && action.arg !== "codex" ? action.arg : guide?.command;
        if (text) {
          await deps.copy(text);
          { copied = true; notice = { tone: "ok", text: "복사했어요. 열어 둔 창을 클릭한 뒤 Ctrl+V 로 붙여 넣고 Enter 를 눌러요." }; }
        }
        paint();
        return;
      }
      case "recheck":
        await run("다시 찾고 있어요…", async () => {
          await refresh();
          if (plan()) { chosen = undefined; failure = undefined; return; }
          if (!env?.claudeInstalledNotSignedIn) notice = { tone: "error", text: "아직 Claude가 보이지 않아요. 설치가 끝나려면 1~2분 걸려요. 조금 기다렸다가 「설치했어요, 다시 확인」을 한 번 더 눌러 주세요." };
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
        deps.onDone(false);
        return;
    }
  }

  void refresh();
  paint();
  return { element: host, refresh };
}
