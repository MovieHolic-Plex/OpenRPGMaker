import type { TeamPlan } from "./teamPlan.ts";
import { planSentence, planTitle } from "./teamPlanText.ts";

export type WizardOs = "win32" | "darwin" | "linux";

export type WizardService = "chatgpt" | "claude" | "google" | "deepseek";

export interface InstallGuide {
  readonly command: string;
  readonly opens: string;
  readonly runnable: boolean;
}

export interface WizardKeySource {
  readonly id: string;
  readonly label: string;
}

export interface WizardInputs {
  readonly os: WizardOs;
  readonly finding: boolean;
  readonly plan?: TeamPlan;
  readonly keySources: readonly WizardKeySource[];
  readonly installable: Readonly<Partial<Record<"claude" | "codex", InstallGuide>>>;
  readonly claudeInstalledNotSignedIn: boolean;
  readonly chosen?: WizardService;
  readonly failure?: string;
}

export type WizardActionId =
  | "start-plan"
  | "use-key"
  | "choose-service"
  | "login-chatgpt"
  | "login-google"
  | "install-claude"
  | "install-chatgpt-helper"
  | "login-claude"
  | "copy-command"
  | "recheck"
  | "back"
  | "paste-key"
  | "advanced"
  | "later";

export interface WizardAction {
  readonly id: WizardActionId;
  readonly label: string;
  readonly arg?: string;
  /** 버튼 아래 한 줄 설명. 서비스 고르기 화면에서 「무엇이 필요한지」를 미리 알린다. */
  readonly hint?: string;
  readonly outline?: boolean;
}

export type WizardScreenId = "finding" | "ready" | "key-found" | "choose" | "service" | "help";

export interface WizardScreen {
  readonly id: WizardScreenId;
  readonly title: string;
  readonly body: string;
  readonly primary?: WizardAction;
  readonly choices: readonly WizardAction[];
  readonly secondary: readonly WizardAction[];
  readonly advanced: readonly WizardAction[];
  readonly command?: InstallGuide;
  /** 명령 상자를 「직접 설치하기」 접이식 안에 둔다(앱이 대신 설치할 수 있을 때). 설치가 실패했으면 펼쳐서 보인다. */
  readonly commandFold?: { readonly open: boolean };
}

export const SERVICE_LABEL: Readonly<Record<WizardService, string>> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  google: "Google (Gemini)",
  deepseek: "DeepSeek",
};

const SERVICE_HINT: Readonly<Record<WizardService, string>> = {
  chatgpt: "계정으로 로그인만 하면 돼요",
  claude: "설치하고 로그인해요 (유료 구독 필요)",
  google: "계정으로 로그인만 하면 돼요",
  deepseek: "받아 둔 키를 붙여 넣어요",
};

const LATER: WizardAction = { id: "later", label: "나중에 할게요 (창 닫기)" };
const PASTE_KEY: WizardAction = { id: "paste-key", label: "받아 둔 키(비밀번호 같은 코드)가 있어요" };

const terminalName = (os: WizardOs): string =>
  os === "win32" ? "PowerShell(파란 글자 창)" : os === "darwin" ? "터미널" : "터미널";

export function wizardScreen(input: WizardInputs): WizardScreen {
  if (input.finding) {
    return { id: "finding", title: "AI를 찾고 있어요", body: "이 컴퓨터에서 쓸 수 있는 AI를 찾는 중이에요. 잠깐만 기다려 주세요.", choices: [], secondary: [LATER], advanced: [] };
  }
  if (input.plan) {
    return {
      id: "ready",
      title: "AI 팀이 준비됐어요",
      body: `찾았어요: ${planTitle(input.plan)}. ${planSentence(input.plan)}`,
      primary: { id: "start-plan", label: "이걸로 시작하기" },
      choices: [],
      secondary: [{ id: "choose-service", label: "다른 AI를 쓸래요" }],
      advanced: [PASTE_KEY],
    };
  }
  const key = input.keySources[0];
  if (key && !input.chosen) {
    return {
      id: "key-found",
      title: "저장된 키를 찾았어요",
      body: `이 컴퓨터에 AI 서비스 키가 저장돼 있어요(${key.label}). 이걸 쓸까요? 키는 화면에 나오지 않고 밖으로 보내지지 않아요.`,
      primary: { id: "use-key", label: "이 키로 시작하기", arg: key.id },
      choices: [],
      secondary: [{ id: "choose-service", label: "다른 AI를 쓸래요" }],
      advanced: [],
    };
  }
  if (!input.chosen) {
    return {
      id: "choose",
      title: "어떤 AI를 쓰고 계세요?",
      body: "쓰고 있는 서비스를 하나 눌러 주세요. 다음 화면에서 한 단계씩 안내해 드려요. 잘 모르겠으면 ChatGPT나 Google 계정으로 로그인하는 게 가장 쉬워요.",
      choices: (["chatgpt", "claude", "google", "deepseek"] as const).map((service) => ({ id: "choose-service" as const, label: SERVICE_LABEL[service], arg: service, hint: SERVICE_HINT[service] })),
      secondary: [LATER],
      advanced: [PASTE_KEY],
    };
  }
  return serviceScreen(input, input.chosen);
}

function serviceScreen(input: WizardInputs, service: WizardService): WizardScreen {
  const back: WizardAction = { id: "back", label: "← 다른 AI 고르기" };
  const failure = input.failure ? ` ${input.failure}` : "";
  if (service === "chatgpt") {
    return {
      id: "service", title: "ChatGPT로 로그인", choices: [], secondary: [back], advanced: [PASTE_KEY],
      body: `아래 버튼을 누르면 인터넷 창이 열려요. ChatGPT에 로그인하고 「허용」을 누르면 끝나요.${failure}`,
      primary: { id: "login-chatgpt", label: "ChatGPT로 로그인" },
    };
  }
  if (service === "google") {
    return {
      id: "service", title: "Google로 로그인", choices: [], secondary: [back], advanced: [PASTE_KEY],
      body: `아래 버튼을 누르면 인터넷 창이 열려요. Google 계정을 고르고 「허용」을 누르면 끝나요.${failure}`,
      primary: { id: "login-google", label: "Google로 로그인" },
    };
  }
  if (service === "claude") {
    const guide = input.installable.claude;
    if (input.claudeInstalledNotSignedIn) {
      return {
        id: "service", title: "Claude에 로그인", choices: [], secondary: [back], advanced: [],
        body: `Claude는 설치돼 있어요. 로그인만 하면 돼요. 아래 버튼을 누르면 인터넷 창이 열려요.${failure}`,
        primary: { id: "login-claude", label: "Claude에 로그인" },
      };
    }
    const needsPlan = "Claude 유료 구독(Pro 이상)이 있어야 해요. 없으면 「다른 AI 고르기」에서 ChatGPT나 Google을 골라 보세요.";
    const runnable = guide?.runnable === true;
    return {
      id: "service", title: "Claude 설치하기", choices: [], advanced: [PASTE_KEY],
      secondary: [back, { id: "recheck", label: "설치했어요, 다시 확인", outline: true }],
      body: runnable
        ? `Claude를 이 컴퓨터에 설치해야 해요. 아래 버튼을 누르면 앱이 대신 설치해 드려요. 1~2분 걸려요. ${needsPlan}${failure}`
        : `Claude를 이 컴퓨터에 설치해야 해요. 1) 「${terminalName(input.os)}」을 열어요. 2) 아래 글을 복사해서 붙여 넣고 Enter를 눌러요. 3) 끝나면 「설치했어요, 다시 확인」을 눌러요. ${needsPlan}${failure}`,
      primary: runnable ? { id: "install-claude", label: "지금 설치하기" } : { id: "copy-command", label: "설치 글 복사하기", arg: "claude" },
      ...(guide ? { command: guide } : {}),
      ...(guide && runnable ? { commandFold: { open: Boolean(input.failure) } } : {}),
    };
  }
  return {
    id: "service", title: "DeepSeek 키 붙여 넣기", choices: [], secondary: [back], advanced: [],
    body: `DeepSeek 사이트에서 받은 키(비밀번호 같은 긴 코드)를 아래 칸에 붙여 넣어 주세요. 키는 이 컴퓨터에만 저장돼요.${failure}`,
    primary: { id: "paste-key", label: "키 붙여 넣고 시작하기", arg: "deepseek" },
  };
}
