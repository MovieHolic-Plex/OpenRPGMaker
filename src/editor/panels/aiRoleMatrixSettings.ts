// AI 설정 「모델」 탭의 역할 배정 표 — 연결된 계정으로 역할 여섯(주 작업·잔일·검토자·눈·그림 생성·도트)을 자동으로 채우고,
// 채울 수 없는 역할은 «무엇으로 물러나는지»를 그대로 보인다. 잔일·검토자 줄은 여기서 직접 고를 수 있다
// (나머지 넷은 위 「역할별 모델 직접 지정」·「그림·도트 모델」 칸이 정본이라, 이 표는 그 값을 읽어 보여 준다).
// 배정 규칙은 src/ai/assistantRoles.ts, 표 자료는 src/ai/assistantRoleMatrix.json.
import {
  ASSISTANT_ROLES, FAMILY_LABEL, ROLE_COPY, familyOfProviderId, resolveAssistantRoles,
  type AssistantRole, type AvailableRoute, type RoleAssignment, type RoleOverrides,
} from "@/ai/assistantRoles";
import type { AiConfig } from "@/ai/llmClient";
import { modelForRole, type RoleModel } from "@/ai/modelRoles";
import { resolvePixelModel } from "@/ai/pixelModel";
import { el } from "@/util/dom";

/** 이 표가 직접 고르게 하는 줄. 나머지는 기존 칸을 읽기만 한다. */
const EDITABLE: readonly AssistantRole[] = ["smol", "advisor"];
const AUTO = "";
const OFF = "off";
const key = (model: RoleModel): string => `${model.provider}::${model.model}::${model.thinkingLevel}`;

export interface AiRoleMatrixView {
  readonly element: HTMLElement;
  /** 연결 상태나 다른 칸이 바뀌었을 때 다시 그린다. */
  readonly refresh: (config: AiConfig, available: readonly AvailableRoute[]) => void;
  /** 지금 표가 정한 잔일·검토자 칸과, 직접 고른 줄. */
  readonly collect: () => { readonly assistantRoles: NonNullable<AiConfig["assistantRoles"]>; readonly pinned: Partial<Record<"smol" | "advisor", true>> };
}

/** 기존 설정 칸을 «직접 고른 값» 으로 넘긴다 — 표가 다른 칸과 다른 말을 하지 않게. */
function overridesFromConfig(config: AiConfig, available: readonly AvailableRoute[]): RoleOverrides {
  const connected = new Set(available.map((route) => route.providerId));
  const pick = (model: RoleModel | undefined): RoleModel | undefined => (model && connected.has(model.provider) ? model : undefined);
  const out: RoleOverrides = {};
  const main = pick(modelForRole(config, "deep"));
  if (main) out.main = main;
  const vision = pick(modelForRole(config, "vision"));
  if (vision && config.modelSelectionOverrides?.vision) out.vision = vision;
  const pixel = resolvePixelModel(config);
  if (!pixel.follows && pick(pixel.model)) out.pixel = pixel.model;
  if (config.modelSelectionOverrides?.image && config.imageProviderId && config.imageModel && connected.has(config.imageProviderId)) {
    out.image = { provider: config.imageProviderId, model: config.imageModel, thinkingLevel: "off" };
  }
  for (const role of ["smol", "advisor"] as const) {
    const slot = config.assistantRoles?.[role];
    if (config.modelSelectionOverrides?.[role] && slot) out[role] = slot;
  }
  return out;
}

function describe(role: AssistantRole, assignment: RoleAssignment): { readonly model: string; readonly note: string; readonly tone: "ok" | "missing" } {
  if (assignment.status === "missing") return { model: "—", note: assignment.degrade, tone: "missing" };
  const family = FAMILY_LABEL[assignment.family];
  // 주·눈·도트·그림 줄의 override 는 위·아래 설정 칸을 그대로 읽은 것이다 — 「직접 고름」 은 이 표에서 고른 잔일·검토자만.
  const source = assignment.source === "auto" ? "자동" : EDITABLE.includes(role) ? "직접 고름" : "설정 칸";
  return { model: `${assignment.model.model}`, note: `${family} · ${source}${assignment.note ? ` · ${assignment.note}` : ""}`, tone: "ok" };
}

/** 연결된 경로를 표가 읽는 모양으로. 사용자 지정 엔드포인트는 모델 목록이 계열을 정한다. */
export function availableRoutesFrom(rows: ReadonlyArray<{ readonly providerId: string; readonly models?: readonly string[]; readonly supportsImages?: boolean }>): AvailableRoute[] {
  return rows.flatMap((row) => {
    const family = familyOfProviderId(row.providerId, row.models ?? []);
    return family ? [{ provider: family, providerId: row.providerId, ...(row.models?.length ? { models: row.models } : {}), ...(row.supportsImages !== undefined ? { supportsImages: row.supportsImages } : {}) }] : [];
  });
}

export function renderAiRoleMatrixSettings(onChange: () => void): AiRoleMatrixView {
  let available: readonly AvailableRoute[] = [];
  let config: AiConfig | undefined;
  const pinned: Partial<Record<"smol" | "advisor", true>> = {};
  const chosen: Partial<Record<"smol" | "advisor", RoleModel | "off">> = {};
  const selects = new Map<AssistantRole, HTMLSelectElement>();
  const modelCells = new Map<AssistantRole, HTMLElement>();
  const noteCells = new Map<AssistantRole, HTMLElement>();
  const rows = new Map<AssistantRole, HTMLElement>();
  let resolved: Record<AssistantRole, RoleAssignment> | undefined;
  const summary = el("p", { class: "ai-config-help ai-role-matrix-summary", dataset: { testid: "ai-role-matrix-summary" } });

  const optionsFor = (role: AssistantRole): HTMLOptionElement[] => {
    const seen = new Set<string>();
    const candidates: RoleModel[] = [];
    // 연결된 경로마다 그 역할 후보를 다시 구해 고를 수 있게 한다(다른 줄의 선택과 무관하게 후보만).
    for (const route of available) {
      const one = resolveAssistantRoles([route])[role];
      if (one.status === "ok" && !seen.has(key(one.model))) { seen.add(key(one.model)); candidates.push(one.model); }
    }
    return [
      el("option", { attrs: { value: AUTO }, text: "자동" }) as HTMLOptionElement,
      ...candidates.map((model) => el("option", { attrs: { value: key(model), translate: "no" }, text: `${model.model} · ${model.provider}` }) as HTMLOptionElement),
      el("option", { attrs: { value: OFF }, text: "끔" }) as HTMLOptionElement,
    ];
  };

  const redraw = (): void => {
    if (!config) return;
    const overrides: RoleOverrides = { ...overridesFromConfig(config, available) };
    for (const role of EDITABLE) {
      if (pinned[role as "smol" | "advisor"]) overrides[role] = chosen[role as "smol" | "advisor"]!;
      else delete overrides[role];
    }
    resolved = resolveAssistantRoles(available, overrides);
    let filled = 0;
    for (const role of ASSISTANT_ROLES) {
      const shown = describe(role, resolved[role]);
      if (resolved[role].status === "ok") filled += 1;
      modelCells.get(role)!.textContent = shown.model;
      noteCells.get(role)!.textContent = shown.note;
      rows.get(role)!.dataset.tone = shown.tone;
      const select = selects.get(role);
      if (select) {
        const value = pinned[role as "smol" | "advisor"] ? (chosen[role as "smol" | "advisor"] === "off" ? OFF : key(chosen[role as "smol" | "advisor"] as RoleModel)) : AUTO;
        select.replaceChildren(...optionsFor(role));
        if (![...select.options].some((option) => option.value === value)) select.append(el("option", { attrs: { value }, text: `${value.split("::")[1] ?? value} · 연결 안 됨` }));
        select.value = value;
      }
    }
    const families = [...new Set(available.map((route) => FAMILY_LABEL[route.provider]))];
    summary.textContent = available.length
      ? `연결된 계정: ${families.join(" · ")} — 역할 ${filled}/${ASSISTANT_ROLES.length}개를 채웠습니다.`
      : "연결된 계정이 없습니다 — 「연결」 탭에서 계정을 하나 연결하면 역할이 자동으로 채워집니다.";
  };

  const table = el("div", {
    class: "ai-roles-table ai-role-matrix",
    dataset: { testid: "ai-role-matrix" },
    children: [
      el("div", { class: "ai-roles-head", attrs: { role: "presentation" }, children: ["역할", "모델", "상태", "직접 고르기"].map((text) => el("span", { text })) }),
      ...ASSISTANT_ROLES.map((role) => {
        const copy = ROLE_COPY[role];
        const modelCell = el("code", { class: "ai-role-matrix-model", attrs: { translate: "no" } });
        const noteCell = el("small", { class: "ai-role-matrix-note" });
        modelCells.set(role, modelCell);
        noteCells.set(role, noteCell);
        let control: HTMLElement = el("small", { class: "ai-role-matrix-elsewhere", text: role === "image" || role === "pixel" ? "아래 「그림·도트 모델」" : "위 「역할별 모델」" });
        if (EDITABLE.includes(role)) {
          const select = el("select", { class: "ai-config-select", attrs: { "aria-label": `${copy.label} 모델` }, dataset: { testid: `ai-role-matrix-${role}-select` } }) as HTMLSelectElement;
          select.addEventListener("change", () => {
            const slot = role as "smol" | "advisor";
            if (select.value === AUTO) { delete pinned[slot]; delete chosen[slot]; }
            else if (select.value === OFF) { pinned[slot] = true; chosen[slot] = "off"; }
            else {
              const [provider, model, thinkingLevel] = select.value.split("::");
              pinned[slot] = true;
              chosen[slot] = { provider: provider!, model: model!, thinkingLevel: thinkingLevel as RoleModel["thinkingLevel"] };
            }
            redraw();
            onChange();
          });
          selects.set(role, select);
          control = select;
        }
        const row = el("div", {
          class: "ai-role-row",
          dataset: { testid: `ai-role-matrix-${role}` },
          children: [
            el("div", { class: "ai-role-name", children: [el("strong", { text: copy.label }), el("small", { text: copy.desc })] }),
            el("div", { class: "ai-role-cell", children: [modelCell] }),
            el("div", { class: "ai-role-cell", children: [noteCell] }),
            el("div", { class: "ai-role-cell", children: [control] }),
          ],
        });
        rows.set(role, row);
        return row;
      }),
    ],
  });

  return {
    element: el("div", { class: "ai-role-matrix-wrap", children: [summary, table] }),
    refresh: (next, nextAvailable) => {
      config = next;
      available = nextAvailable;
      for (const role of ["smol", "advisor"] as const) {
        if (next.modelSelectionOverrides?.[role] && next.assistantRoles?.[role]) { pinned[role] = true; chosen[role] = next.assistantRoles[role]; }
      }
      redraw();
    },
    collect: () => {
      const assistantRoles: NonNullable<AiConfig["assistantRoles"]> = {};
      for (const role of ["smol", "advisor"] as const) {
        if (pinned[role]) { assistantRoles[role] = chosen[role]!; continue; }
        const assignment = resolved?.[role];
        if (assignment?.status === "ok") assistantRoles[role] = assignment.model;
      }
      return { assistantRoles, pinned: { ...pinned } };
    },
  };
}

/**
 * 지금 연결된 경로 — 동반 서비스의 계정 로그인 둘(Google·ChatGPT), 연결 시험을 통과한 사용자 지정 엔드포인트, 준비된 로컬 CLI.
 * 조회가 실패한 경로는 연결 안 됨으로 센다(표는 «없다» 고 말하고 물러난다). 시험용 `?roleMatrixMock=gemini,gpt,...` 는 요청 없이 그 조합을 쓴다.
 */
export async function fetchConnectedRoutes(): Promise<AvailableRoute[]> {
  const mock = (() => { try { return typeof location === "undefined" ? null : new URLSearchParams(location.search).get("roleMatrixMock"); } catch { return null; } })();
  if (mock !== null) return mockConnectedRoutes(mock);
  const [{ fetchChatGptAuthStatus, hasUsableCompanionCredential, fetchOpenAiCompatEndpoints }, { createLocalAgentsApi, localAgentsEnabled }, { OH_MY_PI_PROVIDERS }] = await Promise.all([
    import("@/ai/chatgptOAuthClient"), import("@/start/settings/localAgents"), import("@/ai/ohMyPiProviders"),
  ]);
  const rows: { providerId: string; models?: readonly string[]; supportsImages?: boolean }[] = [];
  await Promise.all([
    ...OH_MY_PI_PROVIDERS.map(async (provider) => {
      try { if (hasUsableCompanionCredential(await fetchChatGptAuthStatus(provider.id))) rows.push({ providerId: provider.id }); } catch { /* 닿지 못함 = 연결 안 됨 */ }
    }),
    (async () => {
      try {
        for (const endpoint of await fetchOpenAiCompatEndpoints()) {
          if (endpoint.lastTest?.ok) rows.push({ providerId: endpoint.id, models: endpoint.models, supportsImages: endpoint.supportsImages });
        }
      } catch { /* 엔드포인트 목록 없음 */ }
    })(),
    (async () => {
      if (!localAgentsEnabled()) return;
      try {
        for (const cli of (await createLocalAgentsApi().detect()).clis) if (cli.state === "ready") rows.push({ providerId: `local-cli:${cli.id}` });
      } catch { /* 감지 실패 */ }
    })(),
  ]);
  return availableRoutesFrom(rows);
}

/** 화면 확인·시험용 조합. 이름: gemini · gpt · claude · deepseek (쉼표로). 빈 값 = 연결 없음. */
export function mockConnectedRoutes(spec: string): AvailableRoute[] {
  const names = spec.split(",").map((name) => name.trim()).filter(Boolean);
  const rows: { providerId: string; models?: readonly string[]; supportsImages?: boolean }[] = [];
  if (names.includes("gemini")) rows.push({ providerId: "google-antigravity" });
  if (names.includes("gpt")) rows.push({ providerId: "openai-codex" });
  if (names.includes("claude")) rows.push({ providerId: "local-cli:claude" });
  if (names.includes("deepseek")) rows.push({ providerId: "openai-compat:inferhub", models: ["deepseek-v4.1-flash"], supportsImages: false });
  return availableRoutesFrom(rows);
}
