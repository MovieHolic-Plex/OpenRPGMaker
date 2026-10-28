// editor/panels/aiCompatSettings.ts
// 「사용자 지정 (OpenAI 호환)」 연결 카드 — CLIProxyAPI·LiteLLM·Ollama·LM Studio·vLLM·OpenRouter·OpenAI 같은
// Chat Completions 서버를 이름·주소·(선택) 키로 등록하고, 연결 시험으로 모델 목록을 받아 역할 칸에 지정한다.
//
// 비밀 계약: API 키와 추가 헤더 **값**은 이 화면에서 동반 서비스로 **보내기만** 한다. 돌려받지도, localStorage 에
// 두지도 않는다(응답에는 hasKey·headerNames 만 있다). 입력칸은 password 이고, 저장된 키는 「저장됨 ••••••••」 마스크로만 보인다.
// 서버 쪽 정본은 scripts/lib/openAiCompatStore.ts(0600 파일). 로그인(OAuth) 두 카드는 건드리지 않는다.

import {
  ChatGptCompanionResponseError,
  deleteOpenAiCompatEndpoint,
  fetchOpenAiCompatEndpoints,
  saveOpenAiCompatEndpoint,
  testOpenAiCompatEndpoint,
  type OpenAiCompatSaveRequest,
  type OpenAiCompatTestResponse,
} from "@/ai/chatgptOAuthClient";
import {
  OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW,
  OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC,
  OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS,
  OPENAI_COMPAT_MAX_HEADERS,
  OPENAI_COMPAT_PRESETS,
  checkOpenAiCompatBaseUrl,
  checkOpenAiCompatPattern,
  openAiCompatModelSeesImages,
  openAiCompatModelVerdict,
  parseOpenAiCompatReasoningMode,
  type OpenAiCompatReasoningMode,
  type OpenAiCompatEndpointPublic,
} from "@/ai/openAiCompat";
import { HOST_AI_DISABLED_GUIDANCE, isHostAiDisabledMessage } from "@/ai/hostAiDisabled";
import { getOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { attachDelayedTooltip } from "@/editor/delayedTooltip";
import { el } from "@/util/dom";

/** 연결 카드에서 모델을 꽂을 수 있는 역할 칸. 설정 모달의 역할 표와 같은 다섯이다. */
export type AiCompatRoleSlot = "ultrabrain" | "deep" | "vision" | "writer" | "build";

export const AI_COMPAT_ROLE_SLOTS: ReadonlyArray<{ readonly id: AiCompatRoleSlot; readonly label: string; readonly eng: string }> = [
  { id: "ultrabrain", label: "계획 · 최종 판단", eng: "Ultrabrain" },
  { id: "deep", label: "실행 · 검증", eng: "Deep" },
  { id: "vision", label: "시각 관찰", eng: "Vision" },
  { id: "writer", label: "작문", eng: "Writer" },
  { id: "build", label: "시공", eng: "Build" },
];

export interface AiCompatSettingsOptions {
  /** 지금 그 역할 칸이 쓰는 제공자·모델. */
  readonly getAssignment: (slot: AiCompatRoleSlot) => { readonly provider: string; readonly model: string };
  /** 지금 기본 연결(주 계정)로 선택된 제공자 id. */
  readonly getMainProvider: () => string;
  /** 이 엔드포인트를 기본 연결로 쓴다 — 역할 칸 중 직접 지정하지 않은 것이 따라온다. */
  readonly selectMain: (endpointId: string) => void;
  /** 역할 칸을 이 엔드포인트의 이 모델로 바꾼다(저장은 모달이 한다). */
  readonly assign: (slot: AiCompatRoleSlot, endpointId: string, model: string) => void;
}

export interface AiCompatSettingsView {
  readonly element: HTMLElement;
  readonly refresh: () => void;
  readonly dispose: () => void;
}

interface HeaderRow {
  readonly row: HTMLElement;
  readonly name: HTMLInputElement;
  readonly value: HTMLInputElement;
  /** 서버에 같은 이름의 값이 이미 있는가(있으면 비워 둬도 유지된다). */
  readonly keptOnServer: boolean;
}

const KEY_MASK = "••••••••";

function describeError(error: unknown): string {
  if (error instanceof ChatGptCompanionResponseError) {
    // 서버가 AI 를 꺼 둔 503 은 서버 원문 대신 톱바·설정 창과 같은 안내를 쓴다.
    if (error.serverMessage && isHostAiDisabledMessage(error.serverMessage)) return HOST_AI_DISABLED_GUIDANCE;
    return error.serverMessage ?? `연결 서비스가 ${error.httpStatus} 로 응답했어요.`;
  }
  const reason = (error as { reason?: string } | undefined)?.reason;
  return reason === "timeout"
    ? "연결 서비스의 응답이 늦어요. 잠시 뒤 다시 시도하세요."
    : "연결 서비스에 닿지 못했어요. 앱을 다시 열거나 서버 관리자에게 알려 주세요.";
}

/** 조각 배열을 따로따로의 글자 노드로 붙인다 — i18n 번역기가 노드마다 번역하므로 조합 문장을 카탈로그에 늘어놓지 않아도 된다. */
function setParts(target: HTMLElement, parts: readonly string[], separator = " · "): void {
  target.replaceChildren(...parts.flatMap((part, index) => [...(index ? [document.createTextNode(separator)] : []), document.createTextNode(part)]));
}

function lastTestSummary(endpoint: OpenAiCompatEndpointPublic): { parts: string[]; tone: "ok" | "bad" | "idle" } {
  const test = endpoint.lastTest;
  if (!test) return { parts: ["아직 시험 안 함"], tone: "idle" };
  if (!test.ok) return { parts: [test.status ? `마지막 시험 실패(${test.status})` : "마지막 시험 실패"], tone: "bad" };
  const parts = ["시험 통과"];
  if (endpoint.models.length) parts.push(`모델 ${endpoint.models.length}개`);
  if (test.toolsOk === true) parts.push("도구 호출 가능");
  else if (test.toolsOk === false) parts.push("도구 호출 불가");
  return { parts, tone: test.toolsOk === false ? "bad" : "ok" };
}

export function renderAiCompatSettings(options: AiCompatSettingsOptions): AiCompatSettingsView {
  let disposed = false;
  let endpoints: readonly OpenAiCompatEndpointPublic[] = [];
  let editing: { readonly id: string | null; readonly source?: OpenAiCompatEndpointPublic } | null = null;
  let loadError = "";
  /** 오류 원문·원인 안내. 안내 문장과 한 문장으로 잇지 않고 따로 한 줄로 보인다(번역·서버 원문이 섞이지 않게). */
  let loadErrorDetail = "";
  let confirmingDelete: string | null = null;

  const list = el("div", { class: "ai-compat-list", dataset: { testid: "ai-compat-list" } });
  const formHost = el("div", { class: "ai-compat-form-host" });
  const loadNote = el("p", { class: "ai-config-help ai-compat-load-note", attrs: { role: "status", hidden: "" }, dataset: { testid: "ai-compat-load-note" } });
  const addButton = el("button", {
    class: "ai-assistant-action ai-compat-add",
    text: "엔드포인트 추가",
    attrs: { type: "button" },
    dataset: { testid: "ai-compat-add" },
  }) as HTMLButtonElement;
  addButton.addEventListener("click", () => openForm(null));

  const root = el("section", {
    class: "ai-compat-settings",
    attrs: { "aria-label": "사용자 지정 (OpenAI 호환)" },
    dataset: { testid: "ai-compat" },
    children: [
      el("div", { class: "ai-compat-head", children: [
        // 절 제목·서버 목록은 위 「사용자 지정 연결」 절이 한 번 말한다 — 여기서 되풀이하지 않는다(C-71).
        el("div", { class: "ai-compat-head-copy", children: [
          el("span", {
            class: "ai-config-help",
            text: "키는 이 PC의 연결 서비스에만 저장되고 브라우저에는 남지 않아요.",
          }),
        ] }),
        addButton,
      ] }),
      loadNote,
      list,
      formHost,
    ],
  });

  // ── 목록 ──────────────────────────────────────────────────────────────────
  function renderList(): void {
    loadNote.hidden = !loadError;
    loadNote.replaceChildren(
      document.createTextNode(loadError),
      ...(loadErrorDetail ? [el("span", { class: "ai-compat-load-detail", text: loadErrorDetail })] : []),
    );
    if (endpoints.length === 0) {
      list.replaceChildren(el("p", {
        class: "ai-config-help ai-compat-empty",
        text: loadError ? "" : "등록한 엔드포인트가 없어요. 「엔드포인트 추가」로 주소를 넣고 연결을 시험해 보세요.",
        dataset: { testid: "ai-compat-empty" },
      }));
      return;
    }
    list.replaceChildren(...endpoints.map(renderCard));
  }

  function renderCard(endpoint: OpenAiCompatEndpointPublic): HTMLElement {
    const summary = lastTestSummary(endpoint);
    const keyPill = el("span", {
      class: "ai-compat-pill",
      text: endpoint.hasKey ? `API 키 저장됨 ${KEY_MASK}` : "API 키 없음",
      dataset: { testid: `ai-compat-key-state-${endpoint.id}`, tone: endpoint.hasKey ? "ok" : "idle" },
    });
    const testPill = el("span", {
      class: "ai-compat-pill",
      dataset: { testid: `ai-compat-test-state-${endpoint.id}`, tone: summary.tone },
    });
    setParts(testPill, summary.parts);
    const flags = [
      ...(endpoint.headerNames.length ? [`추가 헤더 ${endpoint.headerNames.join(", ")}`] : []),
      ...(endpoint.reasoningMode === "field" ? ["추론 강도: reasoning_effort"] : endpoint.reasoningMode === "suffix" ? ["추론 강도: 모델 ID 접미사"] : []),
      ...(endpoint.allowModels.length ? [`허용 ${endpoint.allowModels.join(", ")}`] : []),
      ...(endpoint.blockModels.length ? [`차단 ${endpoint.blockModels.join(", ")}`] : []),
      ...(endpoint.supportsImages ? [endpoint.imageModels?.length ? `이미지 입력 ${endpoint.imageModels.join(", ")}` : "이미지 입력"] : []),
      ...(endpoint.supportsImages && endpoint.imageBlindModels?.length ? [`그림 못 봄 ${endpoint.imageBlindModels.join(", ")}`] : []),
    ];
    const deleting = confirmingDelete === endpoint.id;
    const testButton = el("button", { class: "ai-assistant-action", text: "연결 시험", attrs: { type: "button" }, dataset: { testid: `ai-compat-card-test-${endpoint.id}` } }) as HTMLButtonElement;
    const cardResult = el("div", { class: "ai-compat-result", attrs: { role: "status", hidden: "" }, dataset: { testid: `ai-compat-card-result-${endpoint.id}` } });
    testButton.addEventListener("click", () => {
      testButton.disabled = true;
      cardResult.hidden = false;
      cardResult.dataset.tone = "checking";
      cardResult.textContent = "연결을 시험하는 중…";
      void testOpenAiCompatEndpoint({ id: endpoint.id, probeTools: Boolean(endpoint.defaultModel), ...(endpoint.defaultModel ? { model: endpoint.defaultModel } : {}) })
        .then((result) => { cardResult.dataset.tone = result.ok ? "ok" : "bad"; cardResult.textContent = result.message; })
        .catch((error: unknown) => { cardResult.dataset.tone = "bad"; cardResult.textContent = describeError(error); })
        .finally(() => { testButton.disabled = false; void reload(false); });
    });
    const isMain = options.getMainProvider() === endpoint.id;
    const hasModel = Boolean(endpoint.defaultModel || endpoint.models[0]);
    const mainButton = el("button", {
      class: `ai-assistant-action${isMain ? " is-primary" : ""}`,
      text: isMain ? "기본 연결로 사용 중" : "기본 연결로 사용",
      attrs: { type: "button", "aria-pressed": String(isMain), ...(isMain || !hasModel ? { disabled: "" } : {}), title: hasModel ? "이 엔드포인트를 기본 연결로 씁니다. 직접 지정하지 않은 역할이 이 서버의 모델로 바뀌어요." : "먼저 연결 시험으로 모델을 받거나 모델 ID 를 입력해 저장하세요." },
      dataset: { testid: `ai-compat-main-${endpoint.id}` },
    }) as HTMLButtonElement;
    mainButton.addEventListener("click", () => { options.selectMain(endpoint.id); window.setTimeout(renderList, 0); });
    const editButton = el("button", { class: "ai-assistant-action", text: "편집", attrs: { type: "button" }, dataset: { testid: `ai-compat-edit-${endpoint.id}` } });
    editButton.addEventListener("click", () => openForm(endpoint));
    const deleteButton = el("button", {
      class: `ai-assistant-action${deleting ? " is-danger" : ""}`,
      text: deleting ? "정말 삭제" : "삭제",
      attrs: { type: "button" },
      dataset: { testid: `ai-compat-delete-${endpoint.id}` },
    });
    deleteButton.addEventListener("click", () => {
      if (confirmingDelete !== endpoint.id) {
        confirmingDelete = endpoint.id;
        renderList();
        return;
      }
      confirmingDelete = null;
      void deleteOpenAiCompatEndpoint(endpoint.id)
        .then((next) => { endpoints = next; if (editing?.id === endpoint.id) closeForm(); renderList(); })
        .catch((error: unknown) => { loadError = describeError(error); loadErrorDetail = ""; renderList(); });
    });

    // 마지막 시험이 실패했으면 그 이유(어느 단계·무엇을 고칠지)를 카드에 남긴다. 예전에는 「마지막 시험 실패」 알약만 있어서
    // 키 없이 저장한 엔드포인트가 왜 안 되는지 카드에서 알 수 없었다.
    const failureNote = endpoint.lastTest && !endpoint.lastTest.ok && endpoint.lastTest.message
      ? el("p", { class: "ai-compat-warning", text: endpoint.lastTest.message, attrs: { role: "status" }, dataset: { testid: `ai-compat-last-error-${endpoint.id}` } })
      : null;
    const toolsWarning = endpoint.lastTest?.toolsOk === false
      ? el("p", {
        class: "ai-compat-warning",
        text: "이 모델은 도구 호출(tools)을 지원하지 않아요. 조수는 도구로 맵을 고치므로 이 모델로는 조수를 돌릴 수 없어요.",
        attrs: { role: "alert" },
      })
      : null;

    return el("article", {
      class: "ai-compat-card",
      dataset: { testid: `ai-compat-card-${endpoint.id}`, endpoint: endpoint.id },
      children: [
        el("div", { class: "ai-compat-card-head", children: [
          el("div", { class: "ai-compat-card-name", children: [
            el("strong", { text: endpoint.name }),
            el("code", { class: "ai-compat-url", text: endpoint.baseUrl, dataset: { testid: `ai-compat-url-${endpoint.id}` } }),
          ] }),
          el("div", { class: "ai-compat-card-actions", children: [mainButton, testButton, editButton, deleteButton] }),
        ] }),
        el("div", { class: "ai-compat-pills", children: [keyPill, testPill] }),
        ...(flags.length ? [el("small", { class: "ai-config-help", text: flags.join(" · ") })] : []),
        ...(failureNote ? [failureNote] : []),
        ...(toolsWarning ? [toolsWarning] : []),
        cardResult,
        renderRoleAssigner(endpoint),
      ],
    });
  }

  // ── 역할 칸에 꽂기 ─────────────────────────────────────────────────────────
  function renderRoleAssigner(endpoint: OpenAiCompatEndpointPublic): HTMLElement {
    const rows = AI_COMPAT_ROLE_SLOTS.map((slot) => {
      const current = options.getAssignment(slot.id);
      const usingThis = current.provider === endpoint.id;
      const modelListId = `ai-compat-models-${endpoint.id.replace(/[^a-z0-9-]/gu, "-")}-${slot.id}`;
      const input = el("input", {
        class: "ai-config-input",
        attrs: { type: "text", list: modelListId, placeholder: "모델 ID", spellcheck: "false", autocomplete: "off", "aria-label": `${slot.eng} 모델 ID` },
        value: usingThis ? current.model : (endpoint.defaultModel || endpoint.models[0] || ""),
        dataset: { testid: `ai-compat-role-model-${endpoint.id}-${slot.id}` },
      }) as HTMLInputElement;
      const datalist = el("datalist", { attrs: { id: modelListId }, children: endpoint.models.map((model) => el("option", { attrs: { value: model } })) });
      const apply = el("button", {
        class: "ai-assistant-action",
        text: usingThis ? "다시 적용" : "이 역할에 쓰기",
        attrs: { type: "button" },
        dataset: { testid: `ai-compat-role-apply-${endpoint.id}-${slot.id}` },
      }) as HTMLButtonElement;
      const note = el("small", {
        class: "ai-compat-role-note",
        text: usingThis ? "지금 이 엔드포인트를 씁니다" : `지금: ${getOhMyPiProvider(current.provider)?.label ?? current.provider} · ${current.model}`,
        dataset: { testid: `ai-compat-role-note-${endpoint.id}-${slot.id}`, active: usingThis ? "true" : "false" },
      });
      const imageWarning = slot.id === "vision" && !endpoint.supportsImages
        ? el("small", { class: "ai-compat-warning", text: "이미지 입력이 꺼져 있어요. 편집에서 「이미지 입력」을 켜야 시각 관찰에 쓸 수 있어요." })
        : slot.id === "vision" && input.value.trim() && !openAiCompatModelSeesImages(endpoint, input.value.trim())
          ? el("small", { class: "ai-compat-warning", text: `「${input.value.trim()}」 은(는) 그림을 보지 못해요(그림 시험·그림 모델 패턴). 그림을 보는 모델 ID 를 고르세요.` })
          : null;
      apply.addEventListener("click", () => {
        const model = input.value.trim();
        if (!model) {
          note.textContent = "모델 ID를 먼저 입력하거나 목록에서 고르세요.";
          return;
        }
        const verdict = openAiCompatModelVerdict(endpoint, model);
        if (!verdict.allowed) {
          setParts(note, ["적용하지 않았어요.", verdict.reason ?? ""], " ");
          note.dataset.active = "false";
          return;
        }
        options.assign(slot.id, endpoint.id, model);
        note.textContent = "적용했어요 · 자동 저장됨";
        note.dataset.active = "true";
        apply.textContent = "다시 적용";
        if (!endpoint.defaultModel) {
          void saveOpenAiCompatEndpoint({ id: endpoint.id, name: endpoint.name, baseUrl: endpoint.baseUrl, defaultModel: model })
            .then((saved) => { endpoints = saved.endpoints; }).catch(() => undefined);
        }
      });
      return el("div", {
        class: "ai-compat-role-row",
        dataset: { testid: `ai-compat-role-${endpoint.id}-${slot.id}` },
        children: [
          el("span", { class: "ai-compat-role-name", children: [el("strong", { text: slot.label }), el("small", { text: slot.eng })] }),
          el("span", { class: "ai-compat-role-model", children: [input, datalist] }),
          apply,
          el("span", { class: "ai-compat-role-extra", children: [note, ...(imageWarning ? [imageWarning] : [])] }),
        ],
      });
    });
    return el("details", {
      class: "ai-compat-roles",
      dataset: { testid: `ai-compat-roles-${endpoint.id}` },
      children: [
        el("summary", { text: "역할에 모델 지정 (계획 · 실행 · 시각 · 작문 · 시공)" }),
        el("p", { class: "ai-config-help", text: "역할마다 모델을 따로 고를 수 있어요. 기본 제공자(Google·ChatGPT)는 직접 바꾸기 전까지 그대로입니다." }),
        ...rows,
      ],
    });
  }

  // ── 추가·편집 폼 ───────────────────────────────────────────────────────────
  function closeForm(): void {
    editing = null;
    formHost.replaceChildren();
  }

  function openForm(source: OpenAiCompatEndpointPublic | null): void {
    editing = { id: source?.id ?? null, ...(source ? { source } : {}) };
    formHost.replaceChildren(buildForm(source));
    (formHost.querySelector("[data-testid='ai-compat-name']") as HTMLElement | null)?.focus();
  }

  function field(label: string, help: string, control: HTMLElement): HTMLElement {
    return el("label", { class: "ai-config-row ai-compat-field", children: [
      el("span", { class: "ai-config-row-copy", children: [el("span", { class: "ai-config-label", text: label }), ...(help ? [el("span", { class: "ai-config-help", text: help })] : [])] }),
      el("span", { class: "ai-config-control", children: [control] }),
    ] });
  }

  function toggle(label: string, help: string, testid: string, checked: boolean): { row: HTMLElement; input: HTMLInputElement } {
    const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
    input.checked = checked;
    const row = el("label", { class: "ai-compat-toggle", children: [
      input,
      el("span", { children: [el("strong", { text: label }), el("small", { text: help })] }),
    ] });
    return { row, input };
  }

  function buildForm(source: OpenAiCompatEndpointPublic | null): HTMLElement {
    const presetSelect = el("select", { class: "ai-config-select", attrs: { "aria-label": "프리셋" }, dataset: { testid: "ai-compat-preset" }, children: [
      el("option", { attrs: { value: "" }, text: "직접 입력" }),
      ...OPENAI_COMPAT_PRESETS.map((preset) => el("option", { attrs: { value: preset.id }, text: preset.label })),
    ] }) as HTMLSelectElement;
    const presetHint = el("small", { class: "ai-config-help", dataset: { testid: "ai-compat-preset-hint" } });
    const name = el("input", { class: "ai-config-input", attrs: { type: "text", placeholder: "예: 집 서버 CLIProxy", maxlength: "60" }, value: source?.name ?? "", dataset: { testid: "ai-compat-name" } }) as HTMLInputElement;
    const baseUrl = el("input", { class: "ai-config-input", attrs: { type: "url", placeholder: "http://mdc-server:8318/v1", spellcheck: "false", autocomplete: "off" }, value: source?.baseUrl ?? "", dataset: { testid: "ai-compat-baseurl" } }) as HTMLInputElement;
    const urlNote = el("small", { class: "ai-compat-url-note", attrs: { role: "status" }, dataset: { testid: "ai-compat-url-note" } });
    const apiKey = el("input", {
      class: "ai-config-input",
      attrs: {
        type: "password", autocomplete: "new-password", spellcheck: "false", name: "oprn-compat-key",
        placeholder: source?.hasKey ? `저장됨 ${KEY_MASK} — 바꾸려면 새 키를 입력` : "키가 필요 없으면 비워 두세요",
      },
      dataset: { testid: "ai-compat-key" },
    }) as HTMLInputElement;
    const clearKey = toggle("저장된 키 지우기", "다음 저장 때 이 엔드포인트의 키를 삭제합니다.", "ai-compat-clear-key", false);
    clearKey.row.hidden = !source?.hasKey;

    const headerRows: HeaderRow[] = [];
    const headerHost = el("div", { class: "ai-compat-headers", dataset: { testid: "ai-compat-headers" } });
    const addHeaderButton = el("button", { class: "ai-assistant-action", text: "헤더 추가", attrs: { type: "button" }, dataset: { testid: "ai-compat-add-header" } }) as HTMLButtonElement;
    const addHeader = (initialName = "", keptOnServer = false): void => {
      if (headerRows.length >= OPENAI_COMPAT_MAX_HEADERS) return;
      const nameInput = el("input", { class: "ai-config-input", attrs: { type: "text", placeholder: "헤더 이름", "aria-label": "헤더 이름", spellcheck: "false" }, value: initialName, dataset: { testid: "ai-compat-header-name" } }) as HTMLInputElement;
      const valueInput = el("input", {
        class: "ai-config-input",
        attrs: { type: "password", autocomplete: "new-password", "aria-label": "헤더 값", placeholder: keptOnServer ? `저장됨 ${KEY_MASK}` : "헤더 값", spellcheck: "false" },
        dataset: { testid: "ai-compat-header-value" },
      }) as HTMLInputElement;
      const remove = el("button", { class: "ai-compat-icon-button", text: "×", attrs: { type: "button", "aria-label": "헤더 삭제" }, dataset: { testid: "ai-compat-header-remove" } }) as HTMLButtonElement;
      attachDelayedTooltip(remove, { label: "헤더 삭제", accessibleName: "헤더 삭제" });
      const row = el("div", { class: "ai-compat-header-row", children: [nameInput, valueInput, remove] });
      const entry: HeaderRow = { row, name: nameInput, value: valueInput, keptOnServer };
      headerRows.push(entry);
      remove.addEventListener("click", () => { headerRows.splice(headerRows.indexOf(entry), 1); row.remove(); addHeaderButton.disabled = false; });
      headerHost.append(row);
      addHeaderButton.disabled = headerRows.length >= OPENAI_COMPAT_MAX_HEADERS;
    };
    addHeaderButton.addEventListener("click", () => addHeader());
    for (const headerName of source?.headerNames ?? []) addHeader(headerName, true);

    const reasoningSelect = el("select", { class: "ai-config-select", attrs: { "aria-label": "추론 강도 방식" }, dataset: { testid: "ai-compat-reasoning-mode" }, children: [
      el("option", { attrs: { value: "none" }, text: "보내지 않음 (기본)" }),
      el("option", { attrs: { value: "field" }, text: "reasoning_effort 필드로 보내기" }),
      el("option", { attrs: { value: "suffix" }, text: "모델 ID 접미사 (-low / -medium / -high)" }),
    ] }) as HTMLSelectElement;
    reasoningSelect.value = source?.reasoningMode ?? "none";
    const reasoningHelp = el("small", { class: "ai-config-help", dataset: { testid: "ai-compat-reasoning-help" } });
    const REASONING_HELP: Record<OpenAiCompatReasoningMode, string> = {
      none: "역할의 추론 강도를 서버에 보내지 않아요. 모르는 인자를 400 으로 거절하는 서버에서도 안전해요. 강도가 이름에 박힌 모델(예: gemini-4-argon-high)은 모델 ID 를 직접 고르세요.",
      field: "OpenAI·LiteLLM·OpenRouter 처럼 reasoning_effort 를 받는 서버용이에요. 역할의 추론 강도가 「끔」이면 보내지 않아요.",
      suffix: "역할의 추론 강도에 따라 모델 ID 뒤에 -low·-medium·-high 를 붙여 불러요(이미 붙어 있으면 그대로). 접미사 모델이 허용 패턴에도 맞아야 해요.",
    };
    const refreshReasoningHelp = (): void => { reasoningHelp.textContent = REASONING_HELP[parseOpenAiCompatReasoningMode(reasoningSelect.value)]; };
    reasoningSelect.addEventListener("change", refreshReasoningHelp);
    refreshReasoningHelp();
    const allowModels = el("textarea", { class: "ai-config-input ai-compat-patterns", attrs: { rows: "2", placeholder: "예: gemini-4-argon*  (한 줄에 하나, 비우면 전부 허용)", spellcheck: "false", "aria-label": "허용 모델 패턴" }, dataset: { testid: "ai-compat-allow" } }) as HTMLTextAreaElement;
    allowModels.value = (source?.allowModels ?? []).join("\n");
    const blockModels = el("textarea", { class: "ai-config-input ai-compat-patterns", attrs: { rows: "2", placeholder: "예: claude-*  (한 줄에 하나)", spellcheck: "false", "aria-label": "차단 모델 패턴" }, dataset: { testid: "ai-compat-block" } }) as HTMLTextAreaElement;
    blockModels.value = (source?.blockModels ?? []).join("\n");
    const patternList = (area: HTMLTextAreaElement): string[] => area.value.split(/[\n,]+/u).map((line) => line.trim()).filter(Boolean);
    const patternNote = el("small", { class: "ai-compat-url-note", attrs: { role: "status" }, dataset: { testid: "ai-compat-pattern-note" } });
    const refreshPatternNote = (): void => {
      const bad = [...patternList(allowModels), ...patternList(blockModels)].map((p) => checkOpenAiCompatPattern(p)).find(Boolean);
      patternNote.textContent = bad ?? "";
      patternNote.dataset.tone = bad ? "bad" : "idle";
    };
    allowModels.addEventListener("input", refreshPatternNote);
    blockModels.addEventListener("input", refreshPatternNote);
    const images = toggle("이미지 입력 (Vision)", "이 서버의 모델이 이미지를 받을 때 켜세요. 시각 관찰 역할에 필요해요.", "ai-compat-images", source?.supportsImages ?? false);
    const insecure = toggle("그래도 사용 (암호화 없는 http)", "공개 인터넷 주소에 http 로 연결합니다. 키와 대화가 그대로 전송돼요.", "ai-compat-insecure", source?.allowInsecurePublic ?? false);
    insecure.row.hidden = true;
    const maxTokens = el("input", { class: "ai-config-input", attrs: { type: "number", min: "256", max: "1000000" }, value: source?.maxOutputTokens ?? OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS, dataset: { testid: "ai-compat-maxtokens" } }) as HTMLInputElement;
    const contextWindow = el("input", { class: "ai-config-input", attrs: { type: "number", min: "2048", max: "4000000" }, value: source?.contextWindow ?? OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW, dataset: { testid: "ai-compat-context" } }) as HTMLInputElement;
    const timeoutSec = el("input", { class: "ai-config-input", attrs: { type: "number", min: "10", max: "3600" }, value: source?.firstTokenTimeoutSec ?? OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC, dataset: { testid: "ai-compat-timeout" } }) as HTMLInputElement;

    // 시험 결과·모델 고르기
    const result = el("div", { class: "ai-compat-result", attrs: { role: "status", hidden: "" }, dataset: { testid: "ai-compat-result" } });
    const warnings = el("ul", { class: "ai-compat-warnings", attrs: { hidden: "" }, dataset: { testid: "ai-compat-warnings" } });
    const modelSelect = el("select", { class: "ai-config-select", attrs: { "aria-label": "받은 모델 목록" }, dataset: { testid: "ai-compat-model-select" } }) as HTMLSelectElement;
    const modelInput = el("input", { class: "ai-config-input", attrs: { type: "text", placeholder: "모델 ID 직접 입력", spellcheck: "false", autocomplete: "off" }, value: source?.defaultModel ?? "", dataset: { testid: "ai-compat-model-input" } }) as HTMLInputElement;
    // 직접 입력한 모델 ID 가 지금 폼의 허용/차단 패턴에 걸리면 바로 이유를 보여 주고 시험·저장을 막는다(대체 모델로 바꾸지 않는다).
    const modelNote = el("small", { class: "ai-compat-url-note", attrs: { role: "status" }, dataset: { testid: "ai-compat-model-note" } });
    const modelVerdict = () => {
      const id = modelInput.value.trim();
      return id ? openAiCompatModelVerdict({ allowModels: patternList(allowModels), blockModels: patternList(blockModels) }, id) : { allowed: true as const };
    };
    const refreshModelNote = (): void => {
      const verdict = modelVerdict();
      if (verdict.allowed) modelNote.replaceChildren(); else setParts(modelNote, [verdict.reason ?? ""]);
      modelNote.dataset.tone = verdict.allowed ? "idle" : "bad";
    };
    const probeTools = toggle("도구 호출도 시험", "고른 모델로 짧은 요청을 보내 tools 를 받는지 확인합니다. 토큰을 몇 개 씁니다.", "ai-compat-probe-tools", true);
    const modelBox = el("div", { class: "ai-compat-model-box", attrs: { hidden: "" }, dataset: { testid: "ai-compat-model-box" }, children: [
      field("모델", "목록에서 고르거나 모델 ID 를 직접 입력하세요. 목록을 못 받는 서버도 직접 입력하면 쓸 수 있어요.", el("span", { class: "ai-config-stack", children: [el("span", { class: "ai-compat-model-control", children: [modelSelect, modelInput] }), modelNote] })),
      probeTools.row,
    ] });
    let testedModels: readonly string[] = source?.models ?? [];
    const fillModels = (models: readonly string[]): void => {
      testedModels = models;
      modelSelect.replaceChildren(
        el("option", { attrs: { value: "" }, text: models.length ? `목록에서 고르기 (${models.length}개)` : "받은 목록 없음" }),
        ...models.map((model) => el("option", { attrs: { value: model }, text: model })),
      );
      modelSelect.value = models.includes(modelInput.value) ? modelInput.value : "";
    };
    fillModels(testedModels);
    modelBox.hidden = !source;
    modelSelect.addEventListener("change", () => { if (modelSelect.value) modelInput.value = modelSelect.value; refreshModelNote(); });
    modelInput.addEventListener("input", refreshModelNote);
    allowModels.addEventListener("input", refreshModelNote);
    blockModels.addEventListener("input", refreshModelNote);

    const refreshUrlNote = (): void => {
      const text = baseUrl.value.trim();
      const check = text ? checkOpenAiCompatBaseUrl(text) : null;
      insecure.row.hidden = !(check?.insecurePublic);
      const lines = !check ? [] : check.ok ? [...check.warnings] : [check.error ?? ""];
      urlNote.textContent = lines.join(" ");
      urlNote.dataset.tone = !check ? "idle" : !check.ok ? "bad" : check.insecurePublic ? "warn" : "idle";
    };
    // 프리셋이 아는 «그림을 실제로 보는 모델» — 폼에 칸은 없고 저장할 때 같이 보낸다(연결 시험의 그림 시험이 나머지를 채운다).
    let presetImageModels: readonly string[] | undefined;
    presetSelect.addEventListener("change", () => {
      const preset = OPENAI_COMPAT_PRESETS.find((entry) => entry.id === presetSelect.value);
      presetHint.textContent = preset?.hint ?? "";
      if (!preset) return;
      name.value = preset.name;
      baseUrl.value = preset.baseUrl;
      reasoningSelect.value = preset.reasoningMode ?? "none";
      allowModels.value = (preset.allowModels ?? []).join("\n");
      blockModels.value = (preset.blockModels ?? []).join("\n");
      images.input.checked = preset.supportsImages === true;
      presetImageModels = preset.imageModels;
      refreshUrlNote();
      refreshReasoningHelp();
      refreshPatternNote();
    });
    baseUrl.addEventListener("input", refreshUrlNote);
    refreshUrlNote();

    const headerPayload = (): NonNullable<OpenAiCompatSaveRequest["headers"]> =>
      headerRows.filter((entry) => entry.name.value.trim()).map((entry) => ({
        name: entry.name.value.trim(),
        ...(entry.value.value ? { value: entry.value.value } : {}),
      }));

    const status = el("span", { class: "ai-compat-form-status", attrs: { role: "status" }, dataset: { testid: "ai-compat-form-status" } });
    const testButton = el("button", { class: "ai-assistant-action", text: "연결 시험", attrs: { type: "button" }, dataset: { testid: "ai-compat-test" } }) as HTMLButtonElement;
    const saveButton = el("button", { class: "ai-assistant-action is-primary", text: "저장", attrs: { type: "button" }, dataset: { testid: "ai-compat-save" } }) as HTMLButtonElement;
    const cancelButton = el("button", { class: "ai-assistant-action", text: "닫기", attrs: { type: "button" }, dataset: { testid: "ai-compat-cancel" } }) as HTMLButtonElement;
    cancelButton.addEventListener("click", closeForm);

    const showResult = (response: OpenAiCompatTestResponse): void => {
      result.hidden = false;
      result.dataset.tone = response.ok ? "ok" : "bad";
      result.dataset.code = response.code;
      setParts(result, [
        response.ok ? "연결됨" : response.code === "auth" ? "인증 거절" : response.code === "not-found" ? "경로를 찾지 못함" : "연결 실패",
        response.message,
      ]);
      if (response.status) result.append(document.createTextNode(` [${response.status}]`));
      warnings.hidden = response.warnings.length === 0 && response.hiddenModels === 0;
      warnings.replaceChildren(...response.warnings.map((warning) => el("li", { text: warning })));
      if (response.hiddenModels > 0) warnings.append(el("li", { text: `허용/차단 패턴 때문에 모델 ${response.hiddenModels}개를 숨겼어요.` }));
      if (response.toolsOk === false) {
        warnings.hidden = false;
        warnings.append(el("li", { text: "이 모델은 도구 호출(tools)을 지원하지 않아요. 조수에는 쓸 수 없어요." }));
      } else if (response.toolsOk === true) {
        warnings.hidden = false;
        warnings.append(el("li", { text: "도구 호출 확인됨." }));
      }
      // 서버에 닿았지만 /models 가 없거나 비정상인 경우(404 등)도 모델 ID 를 직접 입력할 수 있어야 한다.
      if (response.ok || response.models.length || response.code === "not-found" || response.code === "not-json" || response.code === "server") {
        modelBox.hidden = false;
        fillModels(response.models);
        if (!modelInput.value && response.models.length) modelInput.value = response.models[0] ?? "";
        modelSelect.value = response.models.includes(modelInput.value) ? modelInput.value : "";
      }
    };

    testButton.addEventListener("click", () => {
      testButton.disabled = true;
      status.textContent = "";
      result.hidden = false;
      result.dataset.tone = "checking";
      result.textContent = "연결을 시험하는 중… (GET /models)";
      const model = modelInput.value.trim();
      if (model && !modelVerdict().allowed) { refreshModelNote(); testButton.disabled = false; result.hidden = true; return; }
      void testOpenAiCompatEndpoint({
        ...(source ? { id: source.id } : {}),
        name: name.value,
        baseUrl: baseUrl.value,
        ...(apiKey.value ? { apiKey: apiKey.value } : {}),
        headers: headerPayload(),
        allowInsecurePublic: insecure.input.checked,
        allowModels: patternList(allowModels),
        blockModels: patternList(blockModels),
        ...(model ? { model, probeTools: probeTools.input.checked } : {}),
      })
        .then(showResult)
        .catch((error: unknown) => {
          result.dataset.tone = "bad";
          result.textContent = describeError(error);
        })
        .finally(() => { testButton.disabled = false; });
    });

    saveButton.addEventListener("click", () => {
      if (!modelVerdict().allowed) { refreshModelNote(); status.textContent = "차단·비허용 모델은 저장하지 않아요. 모델을 바꾸거나 비우세요."; return; }
      saveButton.disabled = true;
      status.textContent = "저장하는 중…";
      const body: OpenAiCompatSaveRequest = {
        ...(source ? { id: source.id } : {}),
        name: name.value,
        baseUrl: baseUrl.value,
        ...(apiKey.value ? { apiKey: apiKey.value } : {}),
        ...(clearKey.input.checked ? { clearKey: true } : {}),
        headers: headerPayload(),
        reasoningMode: parseOpenAiCompatReasoningMode(reasoningSelect.value),
        allowModels: patternList(allowModels),
        blockModels: patternList(blockModels),
        supportsImages: images.input.checked,
        ...(presetImageModels ? { imageModels: [...presetImageModels] } : {}),
        maxOutputTokens: Number(maxTokens.value),
        contextWindow: Number(contextWindow.value),
        firstTokenTimeoutSec: Number(timeoutSec.value),
        allowInsecurePublic: insecure.input.checked,
        defaultModel: modelInput.value.trim(),
      };
      void saveOpenAiCompatEndpoint(body)
        .then(async (saved) => {
          apiKey.value = "";
          for (const entry of headerRows) entry.value.value = "";
          endpoints = saved.endpoints;
          // 새로 만든 엔드포인트는 시험 결과(모델 목록)가 아직 서버에 없다 — 한 번 더 시험해 기록해 둔다(키는 서버가 안다).
          const id = saved.endpoint?.id;
          if (id && (!source || testedModels.length === 0)) {
            const keepModel = modelInput.value.trim();
            await testOpenAiCompatEndpoint({ id, ...(keepModel ? { model: keepModel, probeTools: probeTools.input.checked } : {}) }).catch(() => undefined);
            endpoints = await fetchOpenAiCompatEndpoints();
          }
          closeForm();
          renderList();
        })
        .catch((error: unknown) => { status.textContent = describeError(error); status.dataset.tone = "bad"; })
        .finally(() => { saveButton.disabled = false; });
    });

    return el("div", {
      class: "ai-compat-form",
      attrs: { role: "group", "aria-label": source ? `${source.name} 편집` : "엔드포인트 추가" },
      dataset: { testid: "ai-compat-form" },
      children: [
        el("h4", { text: source ? `${source.name} 편집` : "엔드포인트 추가" }),
        ...(source ? [] : [field("프리셋", "자주 쓰는 서버의 주소와 모델 패턴을 채워 줘요. 채운 뒤에도 모두 바꿀 수 있어요.", el("span", { class: "ai-config-stack", children: [presetSelect, presetHint] }))]),
        field("이름", "역할 표와 상태 줄에 보이는 이름입니다.", name),
        field("기본 주소", "보통 …/v1 로 끝나요. LAN·localhost 는 http 로도 괜찮아요.", el("span", { class: "ai-config-stack", children: [baseUrl, urlNote] })),
        field("API 키", "선택. Ollama·LM Studio 같은 로컬 서버는 비워 두세요. 저장하면 다시 보여 주지 않아요.", el("span", { class: "ai-config-stack", children: [apiKey, clearKey.row] })),
        el("div", { class: "ai-compat-header-block", children: [
          el("span", { class: "ai-config-label", text: "추가 헤더 (선택)" }),
          el("span", { class: "ai-config-help", text: "게이트웨이가 요구하는 헤더(예: X-Api-Key). 값은 저장 뒤 다시 보여 주지 않아요." }),
          headerHost,
          addHeaderButton,
        ] }),
        field("모델 허용 패턴", "여기에 맞는 모델만 목록·역할 지정·호출에 쓸 수 있어요. * 는 아무 글자, ? 는 한 글자. 비우면 차단 패턴만 아니면 전부 허용해요.", allowModels),
        field("모델 차단 패턴", "여기에 맞는 모델은 목록에서 숨기고 호출도 거절해요(허용보다 우선). 비싼 모델을 실수로 부르지 않게 할 때 써요.", el("span", { class: "ai-config-stack", children: [blockModels, patternNote] })),
        field("추론 강도 방식", "서버가 추론 강도를 받는 방법이 달라요. 모르면 「보내지 않음」으로 두세요.", el("span", { class: "ai-config-stack", children: [reasoningSelect, reasoningHelp] })),
        el("div", { class: "ai-compat-toggles", children: [images.row, insecure.row] }),
        el("details", { class: "ai-compat-advanced", children: [
          el("summary", { text: "고급 — 토큰·시간 한도" }),
          field("최대 출력 토큰", "한 요청에서 모델이 쓸 수 있는 출력 한도. 역할 설정의 최대 토큰이 이보다 크면 이 값으로 낮춰 보냅니다.", maxTokens),
          field("컨텍스트 창(토큰)", "모델의 입력 한도. 에디터의 대화 압축 기준으로 쓰며, 서버가 알려 주지 않아 직접 맞춰요.", contextWindow),
          field("첫 응답 대기(초)", "이 시간 안에 첫 글자가 안 오면 실패로 봅니다. 느린 로컬 모델은 늘리세요.", timeoutSec),
        ] }),
        el("div", { class: "ai-compat-form-actions", children: [testButton, saveButton, cancelButton, status] }),
        result,
        warnings,
        modelBox,
      ],
    });
  }

  // ── 데이터 ────────────────────────────────────────────────────────────────
  async function reload(showErrors = true): Promise<void> {
    try {
      endpoints = await fetchOpenAiCompatEndpoints();
      loadError = "";
      loadErrorDetail = "";
    } catch (error) {
      if (!showErrors) return;
      loadError = "사용자 지정 엔드포인트 목록을 불러오지 못했어요.";
      loadErrorDetail = describeError(error);
    }
    if (disposed) return;
    renderList();
  }

  renderList();
  void reload();

  return {
    element: root,
    refresh: () => { if (!disposed) renderList(); },
    dispose: () => { disposed = true; },
  };
}
