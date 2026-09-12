import { PRODUCT_BRAND } from "@/brand";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { currentHumanEditorIdentity, setOwnerLabel, type EditorIdentity } from "@/project/editorIdentity";
import { listProjectCommitsFromSupabase, type SupabaseProjectCommitListItem } from "@/project/supabaseProjectSync";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { readProjectFromUrl } from "@/project/projectUrl";
import { isAutomationBootContext } from "@/editor/automationBootContext";

const LAST_LOGIN_METHOD_KEY = "oprn:editor-last-login-method";

type LoginMethod = "email" | "google" | "github" | "guest";

type LoginMode =
  | { readonly kind: "email" }
  | { readonly kind: "oauth"; readonly method: "google" | "github"; readonly defaultLabel: string };

let activeIdentityMenu: HTMLElement | null = null;
let activeCommitPanel: HTMLElement | null = null;

export function openLoginModalIfNeeded(onIdentityChanged?: () => void): void {
  if (!canRenderFloatingUi()) return;
  if (isAutomationBootContext()) return;
  if (browserLocalStorage()?.getItem(LAST_LOGIN_METHOD_KEY)) return;
  // AI 변경 카드가 떠 있으면 로그인 모달이 클릭을 가로채므로 게스트로 조용히 통과.
  if (document.querySelector("[data-testid='ai-change-card']")) {
    completeMockLogin("게스트", "guest", onIdentityChanged);
    return;
  }
  // Shared/bookmarked ?project= deep-links: do not block the loaded canvas with a login wall.
  if (readProjectFromUrl().projectId) {
    completeMockLogin("게스트", "guest", onIdentityChanged);
    return;
  }
  openMockLoginModal(onIdentityChanged);
}

/** AI 제안 UI가 로그인 모달에 가리지 않도록 게스트 신원을 확보한다. */
export function ensureGuestIdentityForAiSurface(onIdentityChanged?: () => void): void {
  if (!canRenderFloatingUi()) return;
  if (browserLocalStorage()?.getItem(LAST_LOGIN_METHOD_KEY)) {
    document.querySelector("[data-testid='login-modal']")?.remove();
    return;
  }
  completeMockLogin("게스트", "guest", onIdentityChanged);
}

export function openMockLoginModal(onIdentityChanged?: () => void): void {
  if (!canRenderFloatingUi()) return;
  renderLoginModal({ kind: "email" }, onIdentityChanged);
}

export function renderIdentityTopbarControl(onIdentityChanged: () => void): HTMLElement {
  const identity = currentHumanEditorIdentity();
  const title = `편집 신원 — ${identity.label}`;
  const button = el("button", {
    class: "team-identity-button is-icon-only",
    attrs: {
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      "aria-label": title,
      title,
      type: "button",
    },
    dataset: { testid: "topbar-identity" },
    children: [
      makeTopbarIcon("person"),
      el("span", {
        class: "team-identity-label is-visually-hidden",
        text: identity.label,
        dataset: { testid: "topbar-identity-label" },
      }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        closeCommitHistoryPanel();
        toggleIdentityMenu(button, identity, onIdentityChanged);
      },
    },
  });
  return button;
}

export function renderCommitHistoryButton(): HTMLElement {
  return el("button", {
    class: "team-history-button is-icon-only",
    attrs: {
      title: "커밋 히스토리",
      "aria-label": "커밋 히스토리",
      "aria-expanded": "false",
      "aria-haspopup": "dialog",
      type: "button",
    },
    dataset: { testid: "commit-history-toggle" },
    children: [makeTopbarIcon("history")],
    on: {
      click: (event) => {
        event.stopPropagation();
        closeIdentityMenu();
        toggleCommitHistoryPanel(event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined);
      },
    },
  });
}

function renderLoginModal(mode: LoginMode, onIdentityChanged?: () => void): void {
  document.querySelector("[data-testid='login-modal']")?.remove();
  const emailMode = mode.kind === "email";
  const labelText = emailMode ? "이메일" : `${oauthProviderName(mode.method)} 표시 이름`;
  const primaryInput = el("input", {
    class: "team-login-input",
    attrs: {
      autocomplete: emailMode ? "email" : "name",
      placeholder: emailMode ? "you@example.com" : mode.defaultLabel,
      type: emailMode ? "email" : "text",
    },
    value: emailMode ? "" : mode.defaultLabel,
    dataset: { testid: emailMode ? "login-email" : "login-name" },
  }) as HTMLInputElement;
  const passwordInput = el("input", {
    class: "team-login-input",
    attrs: { autocomplete: "current-password", placeholder: "비밀번호", type: "password" },
    dataset: { testid: "login-password" },
  }) as HTMLInputElement;
  const form = el("form", {
    class: "team-login-form",
    children: [
      el("label", { class: "team-login-field", children: [el("span", { text: labelText }), primaryInput] }),
      ...(emailMode ? [el("label", { class: "team-login-field", children: [el("span", { text: "비밀번호" }), passwordInput] })] : []),
      el("button", {
        class: "team-login-submit",
        text: emailMode ? "로그인" : "이 이름으로 계속",
        attrs: { type: "submit" },
        dataset: { testid: "login-submit" },
      }),
    ],
    on: {
      submit: (event) => {
        event.preventDefault();
        const value = primaryInput.value.trim();
        const method: LoginMethod = mode.kind === "email" ? "email" : mode.method;
        completeMockLogin(value || (mode.kind === "email" ? "이메일 사용자" : mode.defaultLabel), method, onIdentityChanged);
      },
    },
  });

  const modal = el("div", {
    class: "team-login-backdrop",
    dataset: { testid: "login-modal" },
    children: [
      el("section", {
        class: "team-login-card",
        attrs: { "aria-modal": "true", role: "dialog" },
        children: [
          el("div", {
            class: "team-login-head",
            children: [
              el("h2", { text: `${PRODUCT_BRAND} 로그인` }),
              el("p", { text: "목업 신원으로 팀 작업 표시를 시작합니다." }),
            ],
          }),
          form,
          el("div", {
            class: "team-login-oauth",
            children: [
              oauthButton("google", onIdentityChanged),
              oauthButton("github", onIdentityChanged),
            ],
          }),
          el("button", {
            class: "team-login-guest",
            text: "게스트로 계속",
            attrs: { type: "button" },
            dataset: { testid: "login-guest" },
            on: { click: () => completeMockLogin("게스트", "guest", onIdentityChanged) },
          }),
        ],
      }),
    ],
  });
  document.body.append(modal);
  primaryInput.focus();
}

function oauthButton(method: "google" | "github", onIdentityChanged?: () => void): HTMLElement {
  return el("button", {
    class: "team-login-oauth-button",
    text: `${oauthProviderName(method)}로 계속`,
    attrs: { type: "button" },
    dataset: { testid: `login-oauth-${method}` },
    on: {
      click: () => {
        toast("목업: 실제 OAuth는 Phase 8 스위치오버에서 활성화됩니다", "ok");
        renderLoginModal({ kind: "oauth", method, defaultLabel: `${oauthProviderName(method)} 사용자` }, onIdentityChanged);
      },
    },
  });
}

function completeMockLogin(label: string, method: LoginMethod, onIdentityChanged?: () => void): void {
  setOwnerLabel(label);
  browserLocalStorage()?.setItem(LAST_LOGIN_METHOD_KEY, method);
  document.querySelector("[data-testid='login-modal']")?.remove();
  onIdentityChanged?.();
  toast("목업 로그인 신원을 설정했습니다", "ok");
}

function toggleIdentityMenu(anchor: HTMLElement, identity: EditorIdentity, onIdentityChanged: () => void): void {
  const alreadyOpen = Boolean(activeIdentityMenu);
  closeIdentityMenu();
  if (alreadyOpen) return;
  anchor.setAttribute("aria-expanded", "true");
  const input = el("input", {
    class: "team-identity-input",
    attrs: { "aria-label": "신원 라벨", type: "text" },
    value: identity.label,
    dataset: { testid: "identity-label-input" },
  }) as HTMLInputElement;
  const menu = el("div", {
    class: "team-identity-menu",
    attrs: { role: "menu" },
    dataset: { testid: "identity-menu" },
    children: [
      el("div", { class: "team-identity-menu-title", text: identity.kind === "agent" ? "에이전트 신원" : "사람 신원" }),
      input,
      el("button", {
        class: "team-identity-menu-action primary",
        text: "라벨 변경",
        attrs: { type: "button" },
        dataset: { testid: "identity-save" },
        on: {
          click: () => {
            setOwnerLabel(input.value);
            closeIdentityMenu();
            onIdentityChanged();
          },
        },
      }),
      el("button", {
        class: "team-identity-menu-action",
        text: "재로그인",
        attrs: { type: "button" },
        dataset: { testid: "identity-relogin" },
        on: {
          click: () => {
            closeIdentityMenu();
            openMockLoginModal(onIdentityChanged);
          },
        },
      }),
    ],
  });
  const rect = anchor.getBoundingClientRect();
  // Prefer right-align under the icon so the menu stays near the topbar trailing cluster.
  const menuWidth = 220;
  const left = Math.max(8, Math.min(Math.round(rect.right - menuWidth), Math.round(viewportWidth() - menuWidth - 8)));
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  document.body.append(menu);
  activeIdentityMenu = menu;
  // Escape 계층을 점유한다 — 도크 모드에서는 데이터베이스를 켠 채 이 메뉴를 열 수 있고,
  // 등록하지 않으면 Escape 가 흘러 데이터베이스가 대신 닫힌다.
  registerModal(menu, closeIdentityMenu);
  input.focus();
  window.setTimeout(() => document.addEventListener("pointerdown", onTeamPopoverPointerDown), 0);
}

function onTeamPopoverPointerDown(event: Event): void {
  // 팝오버 내부 pointerdown 에 닫으면 버튼 click 이벤트가 소실된다 (실브라우저 결함, 유닛 fake DOM 은 못 잡음)
  const target = event.target;
  if (!(target instanceof Node)) {
    closeIdentityMenu();
    closeCommitHistoryPanel();
    return;
  }
  if (activeIdentityMenu?.contains(target)) return;
  if (activeCommitPanel?.contains(target)) return;
  if (target instanceof Element) {
    if (target.closest("[data-testid='topbar-identity']")) return;
    if (target.closest("[data-testid='commit-history-toggle']")) return;
  }
  closeIdentityMenu();
  closeCommitHistoryPanel();
}

function closeIdentityMenu(): void {
  if (!activeIdentityMenu) {
    document.querySelectorAll<HTMLElement>("[data-testid='topbar-identity']").forEach((node) => node.setAttribute("aria-expanded", "false"));
    return;
  }
  unregisterModal(activeIdentityMenu);
  activeIdentityMenu.remove();
  activeIdentityMenu = null;
  document.querySelectorAll<HTMLElement>("[data-testid='topbar-identity']").forEach((node) => node.setAttribute("aria-expanded", "false"));
  maybeRemoveTeamPopoverListener();
}

function toggleCommitHistoryPanel(anchor?: HTMLElement): void {
  if (activeCommitPanel) {
    closeCommitHistoryPanel();
    return;
  }
  const panel = el("section", {
    class: "team-commit-panel",
    attrs: { "aria-label": "커밋 히스토리", role: "dialog" },
    dataset: { testid: "commit-history-panel" },
  });
  activeCommitPanel = panel;
  document.body.append(panel);
  registerModal(panel, closeCommitHistoryPanel);
  if (anchor) {
    anchor.setAttribute("aria-expanded", "true");
    const rect = anchor.getBoundingClientRect();
    panel.style.top = `${Math.round(rect.bottom + 6)}px`;
    panel.style.right = `${Math.max(8, Math.round(viewportWidth() - rect.right))}px`;
  }
  renderCommitPanelLoading(panel);
  void refreshCommitPanel(panel);
  window.setTimeout(() => document.addEventListener("pointerdown", onTeamPopoverPointerDown), 0);
}

function closeCommitHistoryPanel(): void {
  if (!activeCommitPanel) {
    document.querySelectorAll<HTMLElement>("[data-testid='commit-history-toggle']").forEach((node) => node.setAttribute("aria-expanded", "false"));
    return;
  }
  unregisterModal(activeCommitPanel);
  activeCommitPanel.remove();
  activeCommitPanel = null;
  document.querySelectorAll<HTMLElement>("[data-testid='commit-history-toggle']").forEach((node) => node.setAttribute("aria-expanded", "false"));
  maybeRemoveTeamPopoverListener();
}

function maybeRemoveTeamPopoverListener(): void {
  if (activeIdentityMenu || activeCommitPanel) return;
  document.removeEventListener("pointerdown", onTeamPopoverPointerDown);
}

function renderCommitPanelLoading(panel: HTMLElement): void {
  panel.replaceChildren(
    el("div", {
      class: "team-commit-head",
      children: [
        el("h2", { text: "커밋 히스토리" }),
        el("button", {
          class: "team-commit-refresh",
          text: "새로고침",
          attrs: { type: "button" },
          dataset: { testid: "commit-history-refresh" },
          on: { click: () => void refreshCommitPanel(panel) },
        }),
      ],
    }),
    el("div", { class: "team-commit-empty", text: "최근 커밋을 불러오는 중입니다.", dataset: { testid: "commit-history-loading" } }),
  );
}

async function refreshCommitPanel(panel: HTMLElement): Promise<void> {
  renderCommitPanelLoading(panel);
  try {
    const commits = await listProjectCommitsFromSupabase(20);
    renderCommitPanelRows(panel, commits);
  } catch (error) {
    renderCommitPanelError(panel, error);
  }
}

function renderCommitPanelRows(panel: HTMLElement, commits: readonly SupabaseProjectCommitListItem[]): void {
  const body = el("div", { class: "team-commit-list", dataset: { testid: "commit-history-list" } });
  if (commits.length === 0) {
    body.append(el("div", { class: "team-commit-empty", text: "표시할 커밋이 없습니다.", dataset: { testid: "commit-history-empty" } }));
  } else {
    for (const commit of commits) body.append(commitRow(commit));
  }
  panel.replaceChildren(commitPanelHeader(panel), body);
}

function renderCommitPanelError(panel: HTMLElement, error: unknown): void {
  panel.replaceChildren(
    commitPanelHeader(panel),
    el("div", {
      class: "team-commit-empty error",
      text: `커밋 히스토리를 불러오지 못했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      dataset: { testid: "commit-history-error" },
    }),
  );
}

function commitPanelHeader(panel: HTMLElement): HTMLElement {
  return el("div", {
    class: "team-commit-head",
    children: [
      el("h2", { text: "커밋 히스토리" }),
      el("button", {
        class: "team-commit-refresh",
        text: "새로고침",
        attrs: { type: "button" },
        dataset: { testid: "commit-history-refresh" },
        on: { click: () => void refreshCommitPanel(panel) },
      }),
    ],
  });
}

function commitRow(commit: SupabaseProjectCommitListItem): HTMLElement {
  const kind = commit.authorKind === "agent" ? "agent" : "human";
  return el("article", {
    class: "team-commit-row",
    dataset: { testid: `commit-history-row-${commit.commitId}` },
    children: [
      el("time", { class: "team-commit-time", text: formatCommitTime(commit.createdAt) }),
      el("span", { class: `team-commit-kind ${kind}`, text: kind === "agent" ? "에이전트" : "사람" }),
      el("span", { class: "team-commit-author", text: commit.authorLabel?.trim() || commit.authorId?.trim() || "알 수 없음" }),
      el("span", { class: `team-commit-review ${commit.reviewStatus === "approved" ? "approved" : "direct"}`, text: commit.reviewStatus === "approved" ? "approved" : "direct" }),
      el("p", { class: "team-commit-summary", text: commit.summary?.trim() || commit.message }),
    ],
  });
}

function formatCommitTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function oauthProviderName(method: "google" | "github"): string {
  return method === "google" ? "Google" : "GitHub";
}

type TopbarIconName = "history" | "person";

function makeTopbarIcon(name: TopbarIconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 22 22");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("team-topbar-icon");
  const paths =
    name === "history"
      ? ["M11 5v6l4 2", "M11 19a8 8 0 1 0-7.1-4.2", "M4 14.5l.6-3.2 2.9 1.5"]
      : ["M11 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M5 18.5c1.4-2.6 3.5-4 6-4s4.6 1.4 6 4"];
  for (const d of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function browserLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function canRenderFloatingUi(): boolean {
  return typeof document !== "undefined" && typeof document.querySelector === "function" && Boolean(document.body);
}

function viewportWidth(): number {
  if (typeof window === "undefined") return 800;
  const width = window.innerWidth;
  return typeof width === "number" && Number.isFinite(width) && width > 0 ? width : 800;
}
