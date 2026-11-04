import type { TeamPlan } from "./teamPlan.ts";
import { planEvidence, routeName } from "./teamPlanText.ts";

// 첫 실행 AI 설정 마법사의 화면 모델 (2026-11-05 개편, lane ai-setup-ui).
// 원칙: 화면마다 카드 한 장 — 무엇을 찾았는지 / 누르면 무엇이 되는지 한 문장, 주 버튼 하나.
// 모델 이름·계획/만들기 담당·명령어 같은 기술 정보는 「자세히」 접이식 안에만 둔다. 실패는 본문에 섞지 않고 경고 상자 하나 + 「다시 시도」.

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
  /** 앱 안 로그인이 만료된 서비스. 찾은 게 없을 때 「다시 로그인」 한 번으로 돌아가게 한다. */
  readonly expired?: "chatgpt" | "google";
  /** 사용자가 「다른 AI 쓰기」를 눌러 찾은 결과 대신 서비스 목록을 보고 있다. */
  readonly picking?: boolean;
  readonly chosen?: WizardService;
  readonly failure?: string;
  /** 설치 명령을 복사했다 — 다음 할 일은 「다시 확인」 이다. */
  readonly copied?: boolean;
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
}

export type WizardScreenId = "finding" | "ready" | "key-found" | "expired" | "choose" | "service" | "help";

export interface WizardDetailRow {
  readonly label: string;
  readonly value: string;
}

/** 「자세히」 접이식 — 초보자에게 필요 없는 것(모델 이름, 담당 구분, 명령어)만 여기 둔다. */
export interface WizardDetails {
  readonly summary: string;
  readonly rows: readonly WizardDetailRow[];
  readonly command?: InstallGuide;
  readonly actions: readonly WizardAction[];
  readonly open?: boolean;
}

export interface WizardScreen {
  readonly id: WizardScreenId;
  readonly service?: WizardService;
  readonly title: string;
  readonly body: string;
  /** 실패 한 줄 — 경고 상자로 보인다. 할 일은 주 버튼(다시 시도)이 맡는다. */
  readonly alert?: string;
  readonly primary?: WizardAction;
  readonly choices: readonly WizardAction[];
  readonly secondary: readonly WizardAction[];
  /** 본문에 그대로 보이는 명령 상자(앱이 대신 설치할 수 없을 때만). */
  readonly command?: InstallGuide;
  readonly details?: WizardDetails;
}

export const SERVICE_LABEL: Readonly<Record<WizardService, string>> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  google: "Google",
  deepseek: "DeepSeek",
};

const LATER: WizardAction = { id: "later", label: "나중에" };
const OTHER: WizardAction = { id: "choose-service", label: "다른 AI 쓰기" };
const BACK: WizardAction = { id: "back", label: "← 다른 AI" };
const HAVE_KEY: WizardAction = { id: "paste-key", label: "키가 있어요" };
const RECHECK: WizardAction = { id: "recheck", label: "설치했어요, 다시 확인" };

const FAMILY_SERVICE = { claude: "claude", openai: "chatgpt", google: "google", deepseek: "deepseek" } as const;

const terminalName = (os: WizardOs): string => (os === "win32" ? "PowerShell" : "터미널");

function planServices(plan: TeamPlan): WizardService[] {
  const slots = [plan.worker, ...(plan.lead ? [plan.lead] : [])];
  return [...new Set(slots.map((slot) => FAMILY_SERVICE[slot.model.family]))];
}

function planDetails(plan: TeamPlan): WizardDetails {
  const rows: WizardDetailRow[] = [{ label: "연결", value: [...new Set(plan.routes.map(routeName))].join(", ") }];
  if (plan.lead) rows.push({ label: "계획·검토", value: plan.lead.model.label }, { label: "만들기", value: plan.worker.model.label });
  else rows.push({ label: "맡는 AI", value: plan.worker.model.label });
  rows.push({ label: "고른 이유", value: planEvidence(plan) });
  return { summary: "자세히", rows, actions: [] };
}

function readyScreen(plan: TeamPlan, failure: string | undefined): WizardScreen {
  const services = planServices(plan);
  const onlyKeys = plan.routes.every((route) => route.kind === "key");
  const first = services[0]!;
  const title = onlyKeys
    ? `${SERVICE_LABEL[first]} 키를 찾았어요`
    : services.length === 1 ? `${SERVICE_LABEL[first]}로 연결돼 있어요` : "AI가 연결돼 있어요";
  const body = onlyKeys
    ? "이 컴퓨터에 저장된 키로 바로 시작할게요. 키는 화면에 나오지 않아요."
    : services.length === 1 ? "이걸로 바로 시작할게요." : `${services.map((service) => SERVICE_LABEL[service]).join(" + ")} 둘 다 써서 바로 시작할게요.`;
  return {
    id: "ready",
    ...(services.length === 1 ? { service: first } : {}),
    title,
    body,
    ...(failure ? { alert: failure } : {}),
    primary: { id: "start-plan", label: failure ? "다시 시도" : "시작하기" },
    choices: [],
    secondary: [OTHER, LATER],
    details: planDetails(plan),
  };
}

export function wizardScreen(input: WizardInputs): WizardScreen {
  if (input.finding) {
    return { id: "finding", title: "AI를 찾고 있어요", body: "이 컴퓨터에서 쓸 수 있는 AI를 찾는 중이에요.", choices: [], secondary: [LATER] };
  }
  if (input.chosen) return serviceScreen(input, input.chosen);
  if (!input.picking) {
    if (input.plan) return readyScreen(input.plan, input.failure);
    const key = input.keySources[0];
    if (key) {
      return {
        id: "key-found",
        title: "저장된 키를 찾았어요",
        body: "이 컴퓨터에 저장된 AI 키로 시작할까요? 키는 화면에 나오지 않고 밖으로 보내지지 않아요.",
        ...(input.failure ? { alert: input.failure } : {}),
        primary: { id: "use-key", label: "이 키로 시작하기", arg: key.id },
        choices: [],
        secondary: [OTHER, LATER],
        details: { summary: "자세히", rows: [{ label: "키", value: key.label }], actions: [] },
      };
    }
    if (input.expired) {
      const name = SERVICE_LABEL[input.expired];
      return {
        id: "expired",
        service: input.expired,
        title: `${name} 로그인이 끝났어요`,
        body: "한 번만 다시 로그인하면 그대로 이어서 쓸 수 있어요. 인터넷 창이 열려요.",
        ...(input.failure ? { alert: input.failure } : {}),
        primary: { id: input.expired === "chatgpt" ? "login-chatgpt" : "login-google", label: "다시 로그인하기" },
        choices: [],
        secondary: [OTHER, LATER],
      };
    }
    if (input.claudeInstalledNotSignedIn) return claudeSignIn(input, [OTHER, LATER]);
  }
  return {
    id: "choose",
    title: "AI를 연결해 주세요",
    body: input.picking ? "쓰고 싶은 AI의 계정을 골라 주세요. 로그인하면 끝나요." : "이 컴퓨터에서 쓸 수 있는 AI를 찾지 못했어요. 쓰는 계정을 골라 로그인하면 끝나요.",
    choices: [
      { id: "choose-service", label: "ChatGPT", arg: "chatgpt", hint: "계정으로 로그인" },
      { id: "choose-service", label: "Google", arg: "google", hint: "계정으로 로그인" },
      { id: "choose-service", label: "Claude", arg: "claude", hint: "유료 구독이 있으면" },
    ],
    secondary: [HAVE_KEY, LATER],
  };
}

function claudeSignIn(input: WizardInputs, secondary: readonly WizardAction[]): WizardScreen {
  return {
    id: "service",
    service: "claude",
    title: "Claude에 로그인만 하면 돼요",
    body: "Claude는 이 컴퓨터에 설치돼 있어요. 버튼을 누르면 인터넷 창이 열려요.",
    ...(input.failure ? { alert: input.failure } : {}),
    primary: { id: "login-claude", label: input.failure ? "다시 시도" : "Claude에 로그인" },
    choices: [],
    secondary,
  };
}

function serviceScreen(input: WizardInputs, service: WizardService): WizardScreen {
  const alert = input.failure ? { alert: input.failure } : {};
  if (service === "chatgpt" || service === "google") {
    const name = SERVICE_LABEL[service];
    return {
      id: "service",
      service,
      title: `${name}로 로그인`,
      body: `인터넷 창이 열리면 ${name}에 로그인하고 「허용」을 눌러 주세요. 끝나면 이 화면이 알아서 넘어가요.`,
      ...alert,
      primary: { id: service === "chatgpt" ? "login-chatgpt" : "login-google", label: input.failure ? "다시 시도" : `${name}로 로그인` },
      choices: [],
      secondary: [BACK, LATER],
    };
  }
  if (service === "claude") {
    if (input.claudeInstalledNotSignedIn) return claudeSignIn(input, [BACK, LATER]);
    const guide = input.installable.claude;
    const needsPlan = "Claude 유료 구독(Pro 이상)이 필요해요.";
    if (guide?.runnable) {
      return {
        id: "service",
        service: "claude",
        title: "Claude를 설치할게요",
        body: `1~2분 걸려요. 설치가 끝나면 바로 이어져요. ${needsPlan}`,
        ...alert,
        primary: { id: "install-claude", label: input.failure ? "다시 시도" : "설치하기" },
        choices: [],
        secondary: [BACK, LATER],
        details: { summary: "직접 설치하기", rows: [{ label: "여는 곳", value: guide.opens }], command: guide, actions: [RECHECK], open: Boolean(input.failure) },
      };
    }
    if (guide) {
      return {
        id: "service",
        service: "claude",
        title: "Claude 설치하기",
        body: input.copied
          ? `${terminalName(input.os)}을 열고 Ctrl+V 로 붙여 넣은 뒤 Enter를 눌러 주세요. 설치가 끝나면 「다시 확인」을 눌러요.`
          : `「복사하기」를 누른 뒤 ${terminalName(input.os)}에 붙여 넣고 Enter를 누르면 설치돼요. ${needsPlan}`,
        ...alert,
        primary: input.copied ? { id: "recheck", label: "다시 확인" } : { id: "copy-command", label: "복사하기", arg: "claude" },
        choices: [],
        secondary: [BACK, LATER],
        details: { summary: "붙여 넣을 글 보기", rows: [{ label: "여는 곳", value: guide.opens }], command: guide, actions: [] },
      };
    }
    return {
      id: "service",
      service: "claude",
      title: "Claude 설치하기",
      body: `claude.ai 에서 Claude Code를 설치한 뒤 「다시 확인」을 눌러 주세요. ${needsPlan}`,
      ...alert,
      primary: { id: "recheck", label: "다시 확인" },
      choices: [],
      secondary: [BACK, LATER],
    };
  }
  return {
    id: "service",
    service: "deepseek",
    title: "키 붙여 넣기",
    body: "DeepSeek 사이트에서 받은 키를 아래 칸에 붙여 넣어 주세요. 키는 이 컴퓨터에만 저장돼요.",
    ...alert,
    primary: { id: "paste-key", label: "시작하기", arg: "deepseek" },
    choices: [],
    secondary: [BACK, LATER],
  };
}
