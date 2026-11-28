// editor/panels/aiThreeProviders.ts
// AI 설정 첫 화면의 핵심 — GPT · Claude · Gemini 3개 주 버튼과 선택된 AI 상세 연결 카드.
//
// 사용자가 가장 자주 쓰는 3대장(GPT · Claude · Gemini)을 첫 화면에서 바로 선택·연결·전환하고,
// 모델과 생각 깊이까지 한 자리에서 바꿀 수 있게 한다.
// OpenRouter · OpenAI 호환 서버 · 기타 제공자는 아래 접힌 「계정 추가」/「다른 방법으로 연결」에 남긴다.
import { ASSISTANT_CHATGPT_EFFORT, ASSISTANT_CHATGPT_MODEL } from "@/ai/chatgptDefault";
import { ChatGptCompanionResponseError, connectOpenAiCompatEndpoint } from "@/ai/chatgptOAuthClient";
import { ASSISTANT_CLAUDE_EFFORT, ASSISTANT_CLAUDE_MODEL } from "@/ai/claudeDefault";
import { KEY_ROUTES } from "@/ai/keyRoutes";
import { AI_CONFIG_CHANGED_EVENT, loadAiConfig } from "@/ai/llmClient";
import { localCliProviderId } from "@/ai/localCliEngine";
import { modelDisplayName } from "@/ai/modelDisplayName";
import { modelForRole, type RoleModel } from "@/ai/modelRoles";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { ANTHROPIC_PROVIDER_ID } from "@/ai/ohMyPiProviders";
import { listKnownOpenAiCompatEndpoints, type OpenAiCompatEndpointPublic } from "@/ai/openAiCompat";
import { loadProviderPin, saveProviderPin } from "@/ai/providerPin";
import { lowestRemaining } from "@/ai/providerQuota";
import { AI_AUTO_PICK_EVENT, currentProviderId, lastAutoRoutes, runAutoProviderPick } from "@/editor/panels/aiAutoProvider";
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus, refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { deckIcon } from "@/editor/panels/aiDeckIcons";
import { aiProviderIcon } from "@/editor/panels/aiProviderIcons";
import {
  AI_STARTUP_HEALTH_EVENT,
  CORE_PROVIDER_FAMILIES,
  checkSingleProviderHealth,
  getStartupAiHealth,
  type CoreProviderFamily,
  type CoreProviderHealth,
} from "@/editor/panels/aiStartupHealth";
import {
  ASSISTANT_ENGINE_CHANGED_EVENT,
  createLocalAgentsApi,
  loadEngineChoice,
  localAgentsEnabled,
  saveEngineChoice,
} from "@/start/settings/localAgents";
import { el } from "@/util/dom";

export interface AiThreeProvidersOptions {
  readonly onStartOAuth: (providerId: string) => void;
  readonly onDisconnectOAuth: (providerId: string) => void;
  readonly onSelectOAuthProvider: (providerId: string, model: string, effort: RoleModel["thinkingLevel"]) => void;
  readonly onConnectedCompat: (endpoint: OpenAiCompatEndpointPublic, model: string) => void;
}

export interface AiThreeProvidersView {
  readonly element: HTMLElement;
  readonly dispose: () => void;
}

interface FamilyMeta {
  readonly id: CoreProviderFamily;
  readonly label: string;
  readonly idleSub: string;
  readonly oauthId: string;
  readonly cliId: "codex" | "claude" | "agy";
  readonly defaultModel: string;
  readonly defaultEffort: "low" | "medium" | "high";
  readonly models: readonly { readonly id: string; readonly label: string }[];
  readonly efforts: readonly { readonly id: "low" | "medium" | "high" | "xhigh"; readonly label: string }[];
  readonly oauthLoginLabel?: string;
  readonly apiKeyFamily?: "claude" | "google";
  readonly apiKeyPlaceholder?: string;
  readonly note: string;
}

const FAMILY_META: Readonly<Record<CoreProviderFamily, FamilyMeta>> = {
  gpt: {
    id: "gpt",
    label: "GPT",
    idleSub: "ChatGPT",
    oauthId: CODEX_PROVIDER_ID,
    cliId: "codex",
    defaultModel: ASSISTANT_CHATGPT_MODEL,
    defaultEffort: ASSISTANT_CHATGPT_EFFORT,
    models: [
      { id: ASSISTANT_CHATGPT_MODEL, label: "GPT-6.2 Sol" },
      { id: "gpt-6.2-astra", label: "GPT-6.2 Astra" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
    ],
    efforts: [
      { id: "medium", label: "보통" },
      { id: "high", label: "높음" },
      { id: "xhigh", label: "매우 높음" },
    ],
    oauthLoginLabel: "ChatGPT로 로그인",
    note: "Codex에 로그인돼 있으면 바로 연결되며, 이미지 생성도 함께 쓸 수 있어요.",
  },
  claude: {
    id: "claude",
    label: "Claude",
    idleSub: "Anthropic",
    oauthId: ANTHROPIC_PROVIDER_ID,
    cliId: "claude",
    defaultModel: ASSISTANT_CLAUDE_MODEL,
    defaultEffort: ASSISTANT_CLAUDE_EFFORT,
    models: [
      { id: ASSISTANT_CLAUDE_MODEL, label: "Claude Sonnet 5.5" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    ],
    efforts: [
      { id: "low", label: "낮음" },
      { id: "medium", label: "보통" },
      { id: "high", label: "높음" },
    ],
    apiKeyFamily: "claude",
    apiKeyPlaceholder: "sk-ant-…",
    note: "에디터 기본 추천 조합이에요. Claude Code 구독이나 API 키로 쓸 수 있어요.",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    idleSub: "Google",
    oauthId: ANTIGRAVITY_PROVIDER_ID,
    cliId: "agy",
    defaultModel: "gemini-4-argon",
    defaultEffort: "medium",
    models: [
      { id: "gemini-4-neon", label: "Gemini 4 Neon" },
      { id: "gemini-4-carbon", label: "Gemini 4 Carbon" },
      { id: "gemini-4-argon", label: "Gemini 4 Argon" },
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    ],
    efforts: [
      { id: "low", label: "낮음" },
      { id: "medium", label: "보통" },
      { id: "high", label: "높음" },
      { id: "xhigh", label: "매우 높음" },
    ],
    // Google 계정 직접 OAuth(Antigravity)는 제3자 하네스 사용 시 계정 정지 위험이 있어 비활성화한다.
    // 대신 Google 공식 Antigravity CLI(agy acp) 구독 또는 Gemini API 키로 안전하게 연결한다.
    apiKeyFamily: "google",
    apiKeyPlaceholder: "AIza…",
    note: "공식 Antigravity CLI(agy acp) 구독 또는 Gemini API 키로 안전하게 연결할 수 있어요.",
  },
};

function familyOfProvider(providerId: string): CoreProviderFamily | null {
  if (providerId === CODEX_PROVIDER_ID || providerId === localCliProviderId("codex")) return "gpt";
  if (providerId === ANTHROPIC_PROVIDER_ID || providerId === localCliProviderId("claude")) return "claude";
  if (providerId === ANTIGRAVITY_PROVIDER_ID || providerId === "google-gemini-cli" || providerId === localCliProviderId("agy") || providerId === localCliProviderId("gemini")) return "gemini";
  const compat = listKnownOpenAiCompatEndpoints().find((entry) => entry.id === providerId);
  if (compat) {
    if (compat.baseUrl.includes("anthropic.com")) return "claude";
    if (compat.baseUrl.includes("generativelanguage.googleapis.com")) return "gemini";
  }
  return null;
}

function findCompatFor(family: CoreProviderFamily): OpenAiCompatEndpointPublic | undefined {
  const needle = family === "claude" ? "anthropic.com" : family === "gemini" ? "generativelanguage.googleapis.com" : "";
  if (!needle) return undefined;
  return listKnownOpenAiCompatEndpoints().find((entry) => entry.baseUrl.includes(needle) && entry.hasKey);
}

interface ResolvedFamilyState {
  readonly connected: boolean;
  readonly checking: boolean;
  readonly active: boolean;
  readonly routeProviderId?: string;
  readonly via?: "oauth" | "local-cli" | "env" | "compat";
  readonly canDisconnectOAuth: boolean;
  readonly quotaPct?: number;
  readonly verifiedLive: boolean;
  readonly latencyMs?: number;
  readonly accountEmail?: string;
  readonly planType?: string;
  readonly errorMessage?: string;
  readonly health: CoreProviderHealth;
}

function resolveFamilyState(family: CoreProviderFamily): ResolvedFamilyState {
  const meta = FAMILY_META[family];
  const health = getStartupAiHealth()[family];
  const routes = lastAutoRoutes();
  const current = currentProviderId();
  const active = familyOfProvider(current) === family;
  // Google Antigravity 직접 OAuth 는 계정 정지 위험으로 비활성화한다(공식 agy ACP 또는 Gemini API 키만 연결로 본다).
  const oauthAllowed = family !== "gemini";
  const oauthRoute = oauthAllowed ? routes.find((r) => r.providerId === meta.oauthId && r.connected) : undefined;
  const cliRoute = routes.find((r) => r.providerId === localCliProviderId(meta.cliId) && r.connected);
  const compat = findCompatFor(family);
  const connStatus = getAiConnectionStatus();
  const liveReady = oauthAllowed && connStatus.kind === "ready" && connStatus.providerId === meta.oauthId;

  let routeProviderId: string | undefined;
  let via: ResolvedFamilyState["via"];
  const healthRouteDisabled = family === "gemini"
    && (health.routeProviderId === meta.oauthId || health.routeProviderId === "google-gemini-cli" || health.routeProviderId === localCliProviderId("gemini"));
  if (health.state === "ok" && health.routeProviderId && !healthRouteDisabled) {
    routeProviderId = health.routeProviderId;
    via = health.via;
  } else if (oauthRoute || liveReady) {
    routeProviderId = meta.oauthId;
    via = connStatus.account?.env ? "env" : "oauth";
  } else if (cliRoute) {
    routeProviderId = localCliProviderId(meta.cliId);
    via = "local-cli";
  } else if (compat) {
    routeProviderId = compat.id;
    via = "compat";
  }

  const connected = Boolean(routeProviderId);
  const healthMeta = healthRouteDisabled ? undefined : health;
  const checking = healthMeta?.state === "checking" || (!connected && oauthAllowed && connStatus.kind === "checking" && connStatus.providerId === meta.oauthId);
  const usage = healthMeta?.usage ?? oauthRoute?.usage ?? null;
  const remaining = lowestRemaining(usage);
  const quotaPct = remaining !== null ? Math.round(remaining * 100) : undefined;
  const accountEmail = healthMeta?.accountEmail ?? (oauthAllowed && connStatus.providerId === meta.oauthId ? connStatus.account?.accountEmail : undefined);
  const planType = healthMeta?.planType ?? (oauthAllowed && connStatus.providerId === meta.oauthId ? connStatus.account?.planType : undefined);

  return {
    connected,
    checking,
    active: active && connected,
    routeProviderId,
    via,
    canDisconnectOAuth: via === "oauth" && routeProviderId === meta.oauthId,
    quotaPct,
    verifiedLive: healthMeta?.verifiedLive === true,
    latencyMs: healthMeta?.latencyMs,
    accountEmail,
    planType,
    errorMessage: healthMeta?.state === "error" ? healthMeta.message : undefined,
    health,
  };
}

function joinParts(parts: ReadonlyArray<string | undefined>): HTMLElement[] {
  return parts.filter((part): part is string => Boolean(part)).flatMap((part, index) => [
    ...(index ? [el("span", { class: "ai-settings-sep", text: " · ", attrs: { "aria-hidden": "true" } })] : []),
    el("span", { text: part }),
  ]);
}

function activeModelAndEffort(family: CoreProviderFamily): { model: string; effort: RoleModel["thinkingLevel"] } {
  const meta = FAMILY_META[family];
  const engine = loadEngineChoice();
  if (engine && engine.cli === meta.cliId) {
    return {
      model: engine.routineModel || meta.defaultModel,
      effort: engine.effort || meta.defaultEffort,
    };
  }
  const config = loadAiConfig();
  if (familyOfProvider(config.providerId ?? "") === family) {
    const deep = modelForRole(config, "deep");
    return {
      model: deep.model || meta.defaultModel,
      effort: deep.thinkingLevel || meta.defaultEffort,
    };
  }
  return { model: meta.defaultModel, effort: meta.defaultEffort };
}

export function renderAiThreeProviders(options: AiThreeProvidersOptions): AiThreeProvidersView {
  let disposed = false;
  let selected: CoreProviderFamily = familyOfProvider(currentProviderId()) ?? "gpt";
  let showApiKeyFor: CoreProviderFamily | null = null;
  let apiKeyBusy = false;
  let apiKeyStatusText = "";
  let apiKeyStatusTone: "idle" | "busy" | "ok" | "error" = "idle";
  let installingClaude = false;
  let installMessage = "";

  const chosenModel: Record<CoreProviderFamily, string> = {
    gpt: activeModelAndEffort("gpt").model,
    claude: activeModelAndEffort("claude").model,
    gemini: activeModelAndEffort("gemini").model,
  };
  const chosenEffort: Record<CoreProviderFamily, RoleModel["thinkingLevel"]> = {
    gpt: activeModelAndEffort("gpt").effort,
    claude: activeModelAndEffort("claude").effort,
    gemini: activeModelAndEffort("gemini").effort,
  };

  const cards = new Map<CoreProviderFamily, {
    button: HTMLButtonElement;
    sub: HTMLElement;
    pill: HTMLElement;
    meta: HTMLElement;
  }>();

  const grid = el("div", {
    class: "ai-three-grid",
    attrs: { role: "tablist", "aria-label": "기본 AI 선택" },
    dataset: { testid: "ai-three-providers" },
    children: CORE_PROVIDER_FAMILIES.map((family) => {
      const meta = FAMILY_META[family];
      const sub = el("span", { class: "ai-three-sub", text: meta.idleSub });
      const pill = el("span", { class: "ai-settings-pill", dataset: { testid: `ai-provider-status-${family}`, tone: "muted" }, text: "미연결" });
      const metaText = el("span", { class: "ai-three-meta" });
      const button = el("button", {
        class: "ai-three-card",
        attrs: { type: "button", role: "tab", "aria-selected": String(family === selected) },
        dataset: { testid: `ai-provider-btn-${family}`, provider: family },
        children: [
          el("span", { class: "ai-three-card-top", children: [
            el("span", { class: "ai-three-card-brand", children: [
              el("span", { class: "ai-three-logo", children: [aiProviderIcon(family, 16) ?? deckIcon("spark", { size: 15 })] }),
              el("span", { class: "ai-three-card-titles", children: [
                el("strong", { text: meta.label }),
                sub,
              ] }),
            ] }),
            el("span", { class: "ai-three-check", attrs: { "aria-hidden": "true" }, children: [deckIcon("check", { size: 15 })] }),
          ] }),
          el("span", { class: "ai-three-card-foot", children: [pill, metaText] }),
        ],
        on: {
          click: () => {
            selected = family;
            apiKeyStatusText = "";
            apiKeyStatusTone = "idle";
            paint();
          },
        },
      }) as HTMLButtonElement;
      cards.set(family, { button, sub, pill, meta: metaText });
      return button;
    }),
  });

  const multiSubBar = el("div", {
    class: "ai-three-detail-head",
    dataset: { testid: "ai-multi-sub-bar" },
  });
  multiSubBar.hidden = true;

  const detailHost = el("div", { class: "ai-three-detail", dataset: { testid: "ai-provider-detail" } });

  function activateFamily(family: CoreProviderFamily, state: ResolvedFamilyState): void {
    const meta = FAMILY_META[family];
    const model = chosenModel[family] || meta.defaultModel;
    const effort = chosenEffort[family] || meta.defaultEffort;
    if (!state.routeProviderId) return;

    if (state.via === "local-cli") {
      const cliEffort = effort === "low" || effort === "high" ? effort : "medium";
      saveProviderPin(state.routeProviderId);
      saveEngineChoice({
        kind: "local-cli",
        cli: meta.cliId,
        routineModel: model,
        deepModel: model,
        effort: cliEffort,
      });
      resetAiConnectionStatusCache();
      void refreshAiConnectionStatus();
      paint();
      return;
    }

    saveEngineChoice(null);
    saveProviderPin(state.routeProviderId);
    options.onSelectOAuthProvider(state.routeProviderId, model, effort);
    resetAiConnectionStatusCache();
    void refreshAiConnectionStatus();
    paint();
  }

  function buildApiKeyBox(family: CoreProviderFamily): HTMLElement {
    const meta = FAMILY_META[family];
    const keyFamily = meta.apiKeyFamily!;
    const route = KEY_ROUTES[keyFamily];
    const input = el("input", {
      class: "ai-quick-connect-input",
      attrs: {
        type: "password",
        placeholder: meta.apiKeyPlaceholder ?? "API 키",
        autocomplete: "new-password",
        spellcheck: "false",
        "aria-label": `${meta.label} API 키`,
      },
      dataset: { testid: `ai-provider-apikey-${family}` },
    }) as HTMLInputElement;
    const submit = el("button", {
      class: "ai-settings-button is-primary",
      attrs: { type: "button" },
      text: "연결",
      dataset: { testid: `ai-provider-apikey-submit-${family}` },
    }) as HTMLButtonElement;
    submit.disabled = apiKeyBusy;
    const status = el("p", {
      class: "ai-quick-connect-status",
      attrs: { role: "status", "aria-live": "polite" },
      dataset: { tone: apiKeyStatusTone },
      text: apiKeyStatusText,
    });
    submit.addEventListener("click", () => {
      if (apiKeyBusy) return;
      const apiKey = input.value.trim();
      if (!apiKey) {
        apiKeyStatusText = "API 키를 붙여 넣어 주세요.";
        apiKeyStatusTone = "error";
        paint();
        return;
      }
      apiKeyBusy = true;
      apiKeyStatusText = "연결을 확인하는 중…";
      apiKeyStatusTone = "busy";
      paint();
      void connectOpenAiCompatEndpoint({
        kind: "custom",
        name: route.label,
        baseUrl: route.baseUrl,
        apiKey,
        model: meta.defaultModel,
        reasoningMode: route.reasoningMode,
      }).then((result) => {
        if (disposed) return;
        apiKeyBusy = false;
        if (!result.ok || !result.endpoint) {
          apiKeyStatusText = result.message || "연결하지 못했어요. API 키를 확인해 주세요.";
          apiKeyStatusTone = "error";
          paint();
          return;
        }
        input.value = "";
        showApiKeyFor = null;
        apiKeyStatusText = "";
        apiKeyStatusTone = "idle";
        options.onConnectedCompat(result.endpoint, result.model || meta.defaultModel);
        void runAutoProviderPick();
        paint();
      }).catch((error: unknown) => {
        if (disposed) return;
        apiKeyBusy = false;
        apiKeyStatusText = error instanceof ChatGptCompanionResponseError && error.serverMessage
          ? error.serverMessage
          : "연결 서비스에 닿지 못했어요.";
        apiKeyStatusTone = "error";
        paint();
      });
    });

    return el("div", {
      class: "ai-three-apikey",
      children: [
        el("div", { class: "ai-three-apikey-row", children: [input, submit] }),
        el("span", { class: "ai-config-help", text: "키는 이 PC에만 저장되고 프로젝트 파일에는 남지 않아요." }),
        ...(apiKeyStatusText ? [status] : []),
      ],
    });
  }

  function paintDetail(family: CoreProviderFamily, state: ResolvedFamilyState): void {
    const meta = FAMILY_META[family];
    const viaLabel = state.via === "local-cli"
      ? (family === "claude" ? "Claude Code" : family === "gpt" ? "Codex CLI" : "Antigravity (ACP)")
      : state.via === "env"
        ? "환경 변수"
        : state.via === "compat"
          ? "API 키"
          : state.connected
            ? (family === "gpt" ? "ChatGPT 구독" : family === "gemini" ? "Google 계정" : "Claude 계정")
            : undefined;

    const statusBadge = el("span", {
      class: "ai-settings-pill",
      dataset: {
        tone: state.active ? "accent" : state.connected ? "ok" : state.errorMessage ? "warn" : "muted",
      },
      text: state.checking ? "확인 중…" : state.active ? "사용 중" : state.connected ? "연결됨" : state.errorMessage ? "확인 필요" : "로그인 필요",
    });

    const subtitleParts: Array<string | undefined> = state.connected
      ? [
        viaLabel,
        state.planType ? state.planType.toUpperCase() : undefined,
        state.accountEmail,
        state.quotaPct !== undefined ? `남음 ${state.quotaPct}%` : undefined,
        state.verifiedLive ? "응답 확인됨" : undefined,
      ]
      : [state.errorMessage || "연결하면 바로 사용할 수 있어요."];

    const headerActions: HTMLElement[] = [];
    if (state.connected && !state.active) {
      headerActions.push(el("button", {
        class: "ai-settings-button is-primary",
        attrs: { type: "button" },
        text: "이 AI로 사용하기",
        dataset: { testid: `ai-provider-use-${family}` },
        on: { click: () => activateFamily(family, state) },
      }));
    }
    headerActions.push(el("button", {
      class: "ai-settings-button",
      attrs: { type: "button" },
      text: state.checking ? "확인 중…" : "연결 확인",
      dataset: { testid: `ai-provider-check-${family}` },
      on: {
        click: () => {
          void checkSingleProviderHealth(family).then(() => {
            void runAutoProviderPick();
            if (!disposed) paint();
          });
        },
      },
    }));
    if (state.canDisconnectOAuth) {
      headerActions.push(el("button", {
        class: "ai-settings-link",
        attrs: { type: "button" },
        text: "연결 해제",
        dataset: { testid: `ai-provider-disconnect-${family}` },
        on: { click: () => options.onDisconnectOAuth(meta.oauthId) },
      }));
    }

    const bodyNodes: HTMLElement[] = [
      el("div", { class: "ai-three-detail-head", children: [
        el("div", { class: "ai-three-detail-copy", children: [
          el("div", { class: "ai-three-detail-title", children: [el("strong", { text: meta.label }), statusBadge] }),
          el("small", { class: "ai-config-help", children: joinParts(subtitleParts) }),
        ] }),
        el("div", { class: "ai-three-detail-actions", children: headerActions }),
      ] }),
    ];

    if (state.connected) {
      const current = activeModelAndEffort(family);
      if (state.active) {
        chosenModel[family] = current.model;
        chosenEffort[family] = current.effort;
      }
      const modelSelect = el("select", {
        class: "ai-config-select",
        attrs: { "aria-label": `${meta.label} 모델` },
        dataset: { testid: `ai-provider-model-${family}` },
        children: meta.models.map((entry) => el("option", { attrs: { value: entry.id }, text: entry.label })),
      }) as HTMLSelectElement;
      if (!meta.models.some((entry) => entry.id === chosenModel[family])) {
        modelSelect.append(el("option", { attrs: { value: chosenModel[family] }, text: modelDisplayName(chosenModel[family]) }));
      }
      modelSelect.value = chosenModel[family];
      modelSelect.addEventListener("change", () => {
        chosenModel[family] = modelSelect.value;
        activateFamily(family, state);
      });

      const effortButtons = meta.efforts.map((entry) => el("button", {
        class: "ai-three-effort-btn",
        attrs: { type: "button", "aria-pressed": String(chosenEffort[family] === entry.id) },
        text: entry.label,
        dataset: { testid: `ai-provider-effort-${family}-${entry.id}` },
        on: {
          click: () => {
            chosenEffort[family] = entry.id;
            activateFamily(family, state);
          },
        },
      }));

      bodyNodes.push(
        el("div", { class: "ai-three-quick", children: [
          el("label", { class: "ai-three-field", children: [
            el("span", { class: "ai-three-field-label", text: "모델" }),
            modelSelect,
          ] }),
          el("div", { class: "ai-three-field", children: [
            el("span", { class: "ai-three-field-label", text: "생각 깊이" }),
            el("div", { class: "ai-three-effort", attrs: { role: "group", "aria-label": "생각 깊이" }, children: effortButtons }),
          ] }),
        ] }),
        el("p", { class: "ai-config-help ai-three-note", text: meta.note }),
      );
    } else {
      const actionButtons: HTMLElement[] = [];
      if (meta.oauthLoginLabel) {
        actionButtons.push(el("button", {
          class: "ai-settings-button is-primary",
          attrs: { type: "button" },
          text: meta.oauthLoginLabel,
          dataset: { testid: `ai-provider-login-${family}` },
          on: { click: () => options.onStartOAuth(meta.oauthId) },
        }));
      }
      if ((family === "claude" || family === "gemini") && state.health.cli?.state === "login-required" && state.health.cli.login.command) {
        const cmd = state.health.cli.login.command;
        const copyBtn = el("button", {
          class: "ai-settings-button",
          attrs: { type: "button" },
          text: "명령 복사",
          on: { click: () => void navigator.clipboard?.writeText(cmd) },
        });
        bodyNodes.push(el("div", { class: "ai-three-cli-box", children: [
          el("span", { class: "ai-config-help", text: "터미널에서 아래 명령으로 로그인한 뒤 「연결 확인」을 눌러 주세요." }),
          el("div", { class: "ai-three-cli-cmd", children: [el("code", { text: cmd }), copyBtn] }),
        ] }));
      } else if (family === "claude" && localAgentsEnabled()) {
        const installBtn = el("button", {
          class: "ai-settings-button is-primary",
          attrs: { type: "button" },
          text: installingClaude ? "설치 중…" : "Claude Code 설치",
          dataset: { testid: "ai-provider-install-claude" },
          on: {
            click: () => {
              if (installingClaude) return;
              installingClaude = true;
              installMessage = "Claude Code를 설치하는 중…";
              paint();
              void createLocalAgentsApi().install("claude").then((result) => {
                if (disposed) return;
                installingClaude = false;
                installMessage = result.message;
                void checkSingleProviderHealth("claude").finally(() => { if (!disposed) paint(); });
              }).catch(() => {
                if (disposed) return;
                installingClaude = false;
                installMessage = "설치를 시작하지 못했어요.";
                paint();
              });
            },
          },
        }) as HTMLButtonElement;
        installBtn.disabled = installingClaude;
        actionButtons.push(installBtn);
      }

      if (meta.apiKeyFamily) {
        actionButtons.push(el("button", {
          class: "ai-settings-button",
          attrs: { type: "button", "aria-expanded": String(showApiKeyFor === family) },
          text: "API 키로 연결",
          dataset: { testid: `ai-provider-apikey-toggle-${family}` },
          on: {
            click: () => {
              showApiKeyFor = showApiKeyFor === family ? null : family;
              apiKeyStatusText = "";
              apiKeyStatusTone = "idle";
              paint();
            },
          },
        }));
      }

      if (actionButtons.length) {
        bodyNodes.push(el("div", { class: "ai-three-connect-actions", children: actionButtons }));
      }
      if (family === "claude" && installMessage) {
        bodyNodes.push(el("p", { class: "ai-config-help", text: installMessage }));
      }
      if (showApiKeyFor === family && meta.apiKeyFamily) {
        bodyNodes.push(buildApiKeyBox(family));
      }
      bodyNodes.push(el("p", { class: "ai-config-help ai-three-note", text: meta.note }));
    }

    detailHost.replaceChildren(...bodyNodes);
  }

  function paint(): void {
    if (disposed) return;
    const states: Record<CoreProviderFamily, ResolvedFamilyState> = {
      gpt: resolveFamilyState("gpt"),
      claude: resolveFamilyState("claude"),
      gemini: resolveFamilyState("gemini"),
    };

    for (const family of CORE_PROVIDER_FAMILIES) {
      const card = cards.get(family)!;
      const st = states[family];
      const meta = FAMILY_META[family];
      card.button.setAttribute("aria-selected", String(family === selected));
      card.button.dataset.active = String(st.active);
      card.button.dataset.connected = String(st.connected);

      const shownModel = st.active ? activeModelAndEffort(family).model : chosenModel[family];
      card.sub.textContent = st.connected ? modelDisplayName(shownModel).replace(/^GPT (?=\d)/u, "GPT-") : meta.idleSub;

      if (st.checking) {
        card.pill.textContent = "확인 중…";
        card.pill.dataset.tone = "muted";
      } else if (st.active) {
        card.pill.textContent = "사용 중";
        card.pill.dataset.tone = "accent";
      } else if (st.connected) {
        card.pill.textContent = "연결됨";
        card.pill.dataset.tone = "ok";
      } else if (st.errorMessage) {
        card.pill.textContent = "확인 필요";
        card.pill.dataset.tone = "warn";
      } else {
        card.pill.textContent = "미연결";
        card.pill.dataset.tone = "muted";
      }

      card.meta.textContent = st.quotaPct !== undefined
        ? `남음 ${st.quotaPct}%`
        : st.verifiedLive
          ? "확인됨"
          : "";
    }

    // 다중 구독 요약 · 한도 도달 시 자동 전환 제어 막대(2개 이상 연결 시 표시)
    const connectedFamilies = CORE_PROVIDER_FAMILIES.filter((f) => states[f].connected);
    const extraConnected = lastAutoRoutes().filter((r) => r.connected && familyOfProvider(r.providerId) === null);
    const totalConnected = connectedFamilies.length + extraConnected.length;
    if (totalConnected >= 2) {
      const pinned = loadProviderPin();
      const names = connectedFamilies.map((f) => FAMILY_META[f].label);
      const summary = el("div", {
        class: "ai-three-detail-copy",
        children: [
          el("div", {
            class: "ai-three-detail-title",
            children: [
              el("span", { class: "ai-settings-pill", dataset: { tone: pinned ? "muted" : "ok" }, text: pinned ? "고정 사용 중" : "자동 전환" }),
              el("small", {
                class: "ai-config-help",
                children: [
                  el("span", { text: "연결된 구독" }),
                  ` ${totalConnected} (${names.join(" · ")}${extraConnected.length > 0 ? " · +" + extraConnected.length : ""})`,
                ],
              }),
            ],
          }),
        ],
      });
      const actions = pinned
        ? [el("button", {
          class: "ai-settings-link",
          attrs: { type: "button" },
          text: "자동 전환 켜기",
          dataset: { testid: "ai-multi-sub-auto" },
          on: {
            click: () => {
              saveProviderPin(null);
              void runAutoProviderPick().finally(() => { if (!disposed) paint(); });
              paint();
            },
          },
        })]
        : [el("small", { class: "ai-config-help", text: "한도 시 다음 구독으로 전환" })];
      multiSubBar.replaceChildren(summary, el("div", { class: "ai-three-detail-actions", children: actions }));
      multiSubBar.hidden = false;
    } else {
      multiSubBar.hidden = true;
      multiSubBar.replaceChildren();
    }

    paintDetail(selected, states[selected]);
  }

  const section = el("section", {
    class: "ai-settings-section ai-settings-section-three",
    dataset: { testid: "ai-settings-section-three" },
    children: [
      el("header", { class: "ai-settings-section-header", children: [el("h3", { text: "기본 AI" })] }),
      el("div", { class: "ai-three-wrap", children: [grid, multiSubBar, detailHost] }),
    ],
  });

  const win = typeof window === "undefined" ? undefined : window;
  const events = [
    AI_STARTUP_HEALTH_EVENT,
    AI_AUTO_PICK_EVENT,
    AI_CONNECTION_STATUS_CHANGED_EVENT,
    AI_CONFIG_CHANGED_EVENT,
    ASSISTANT_ENGINE_CHANGED_EVENT,
  ];
  for (const name of events) win?.addEventListener?.(name, paint);
  paint();

  return {
    element: section,
    dispose: () => {
      disposed = true;
      for (const name of events) win?.removeEventListener?.(name, paint);
    },
  };
}
