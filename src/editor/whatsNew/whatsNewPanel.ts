// editor/whatsNew/whatsNewPanel.ts
// 「새 소식」 서랍과 톱바 버튼. 데이터는 빌드가 CHANGELOG 에서 거른 것(virtual:oprn-whats-new),
// 업데이트 상태는 데스크톱 브리지(window.oprn.updates)에서 온다. 브라우저·팀 호스트에서는 새 소식만 보인다.
//
// 알림은 조용하게: 새 버전을 처음 연 뒤에는 버튼에 점 하나만 켠다. 창을 저절로 열지 않는다
// (릴리스가 하루 수십 번이라 저절로 열면 하루에 열 번 넘게 뜬다). 서랍을 열면 그때까지를 «본 것» 으로 적는다.
import { APP_VERSION, APP_VERSION_META } from "@/brand";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { showConfirm } from "@/editor/ui/modal";
import { saveProjectNow } from "@/editor/saveActions";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { OPRN_RELEASES_URL, type OprnUpdatesBridge, type UpdateStatus } from "../../../electron/shared/updates";
import { areaLabel, buildDigest, hasUnseenNews, releaseCore, type WhatsNewData, type WhatsNewDigest } from "./whatsNewModel";

export const WHATS_NEW_SEEN_KEY = "oprn:whats-new-seen";

let data: WhatsNewData | null = null;
let dataPromise: Promise<WhatsNewData> | null = null;
let panel: HTMLElement | null = null;
let panelAnchor: HTMLElement | null = null;
let updateStatus: UpdateStatus | null = null;
let updatesSubscribed = false;
const buttons = new Set<HTMLElement>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLastSeen(): string | null {
  const value = storage()?.getItem(WHATS_NEW_SEEN_KEY) ?? null;
  return value && /^\d+\.\d+\.\d+$/.test(value) ? value : null;
}

function markSeen(): void {
  try {
    storage()?.setItem(WHATS_NEW_SEEN_KEY, releaseCore(APP_VERSION_META.version || APP_VERSION));
  } catch {
    /* 저장 못 해도 서랍은 연다 — 다음에 점이 한 번 더 켜질 뿐이다 */
  }
}

function currentVersion(): string {
  return APP_VERSION_META.version || releaseCore(APP_VERSION);
}

function updatesBridge(): OprnUpdatesBridge | null {
  return typeof window !== "undefined" ? window.oprn?.updates ?? null : null;
}

function loadData(): Promise<WhatsNewData> {
  if (data) return Promise.resolve(data);
  dataPromise ??= import("virtual:oprn-whats-new")
    .then((module) => (data = module.default))
    .catch((error: unknown) => {
      console.error("[whats-new] 새 소식 데이터를 읽지 못했습니다:", error);
      dataPromise = null;
      return (data = { releases: [] });
    });
  return dataPromise;
}

function releasesUrl(): string {
  return updateStatus?.releasesUrl ?? OPRN_RELEASES_URL;
}

function openExternal(url: string): void {
  // 데스크톱은 setWindowOpenHandler 가 https 를 시스템 브라우저로 넘긴다. 브라우저는 새 탭이다.
  window.open(url, "_blank", "noopener,noreferrer");
}

// ── 톱바 버튼 ────────────────────────────────────────────────────────────

/** 버튼 모양을 지금 상태에 맞춘다: 업데이트 알림 > 새 소식 점 > 기본. */
function paintButton(button: HTMLElement): void {
  const status = updateStatus;
  const dot = button.querySelector<HTMLElement>(".whats-new-dot");
  const label = button.querySelector<HTMLElement>(".whats-new-button-label");
  let state = "idle";
  let text = "";
  let name = "새 소식";
  if (status?.kind === "downloading") {
    state = "downloading";
    text = `${status.version} 받는 중 ${status.percent}%`;
    name = `새 소식 — 업데이트 ${status.version} 받는 중 ${status.percent}%`;
  } else if (status?.kind === "ready") {
    state = "ready";
    text = "다시 시작해 업데이트";
    name = `새 소식 — 업데이트 ${status.version} 준비됨`;
  } else if (status?.kind === "manual") {
    state = "manual";
    text = `${status.version} 새 버전`;
    name = `새 소식 — 새 버전 ${status.version} 있음`;
  }
  const unseen = data ? hasUnseenNews(data, currentVersion(), readLastSeen()) : false;
  button.dataset.state = state;
  button.setAttribute("aria-label", unseen && state === "idle" ? "새 소식 — 새로 바뀐 점이 있어요" : name);
  button.setAttribute("title", name);
  if (label) {
    label.textContent = text;
    label.hidden = !text;
  }
  if (dot) dot.hidden = !(unseen && state === "idle");
}

function paintButtons(): void {
  for (const button of [...buttons]) {
    if (!button.isConnected) {
      buttons.delete(button);
      continue;
    }
    paintButton(button);
  }
}

function subscribeUpdates(): void {
  if (updatesSubscribed) return;
  const bridge = updatesBridge();
  if (!bridge) return;
  updatesSubscribed = true;
  bridge.onStatus((status) => {
    const previous = updateStatus;
    updateStatus = status;
    paintButtons();
    if (panel) renderPanel(panel);
    // 받기가 끝난 순간 한 번만 알린다. 뒤로 켜 둔 창에서도 놓치지 않게.
    if (status.kind === "ready" && previous?.kind !== "ready") {
      toast(`업데이트 ${status.version} 준비됨 — 다시 시작하면 적용돼요`, {
        kind: "info",
        durationMs: 10_000,
        action: { label: "보기", testid: "whats-new-ready-toast", onClick: () => openWhatsNewPanel() },
      });
    }
  });
  void bridge.status().then((status) => {
    updateStatus = status;
    paintButtons();
    if (panel) renderPanel(panel);
  }).catch(() => {});
}

/** 톱바의 「새 소식」 버튼. 톱바를 다시 그릴 때마다 새로 만든다. */
export function renderWhatsNewButton(icon: SVGSVGElement): HTMLElement {
  const button = el("button", {
    class: "studio-icon-button whats-new-button",
    attrs: { type: "button", "aria-haspopup": "dialog", "aria-expanded": panel ? "true" : "false" },
    dataset: { testid: "topbar-whats-new", state: "idle" },
    children: [
      icon,
      el("span", { class: "whats-new-button-label", attrs: { hidden: "" } }),
      el("span", { class: "whats-new-dot", attrs: { "aria-hidden": "true", hidden: "" } }),
    ],
    on: {
      click: (event) => {
        event.stopPropagation();
        if (panel) closeWhatsNewPanel();
        else openWhatsNewPanel(event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined);
      },
    },
  });
  buttons.add(button);
  paintButton(button);
  subscribeUpdates();
  void loadData().then(() => paintButtons());
  return button;
}

// ── 서랍 ─────────────────────────────────────────────────────────────────

function onOutsidePointer(event: Event): void {
  const target = event.target;
  if (!panel || !(target instanceof Node)) return;
  if (panel.contains(target)) return;
  if (target instanceof Element && target.closest("[data-testid='topbar-whats-new']")) return;
  closeWhatsNewPanel();
}

export function openWhatsNewPanel(anchor?: HTMLElement): void {
  if (typeof document === "undefined" || !document.body) return;
  if (panel) {
    panel.focus();
    return;
  }
  const lastSeen = readLastSeen();
  const node = el("section", {
    class: "whats-new-panel",
    attrs: { role: "dialog", "aria-labelledby": "whats-new-title", tabindex: "-1" },
    dataset: { testid: "whats-new-panel", lastSeen: lastSeen ?? "" },
  });
  panel = node;
  panelAnchor = anchor ?? document.querySelector<HTMLElement>("[data-testid='topbar-whats-new']");
  panelAnchor?.setAttribute("aria-expanded", "true");
  document.body.append(node);
  registerModal(node, closeWhatsNewPanel);
  renderPanel(node);
  node.focus();
  window.setTimeout(() => document.addEventListener("pointerdown", onOutsidePointer), 0);
  void loadData().then(() => {
    if (panel !== node) return;
    renderPanel(node);
    markSeen();
    paintButtons();
  });
  // 서랍을 열 때 한 번 확인한다 — 주기 확인(4시간)을 기다리지 않게.
  const bridge = updatesBridge();
  if (bridge && (updateStatus?.kind === "idle" || updateStatus?.kind === "error")) void bridge.check().catch(() => {});
}

export function closeWhatsNewPanel(): void {
  if (!panel) return;
  document.removeEventListener("pointerdown", onOutsidePointer);
  unregisterModal(panel);
  panel.remove();
  panel = null;
  panelAnchor?.setAttribute("aria-expanded", "false");
  const anchor = panelAnchor;
  panelAnchor = null;
  if (anchor?.isConnected) anchor.focus();
}

function rangeLine(digest: WhatsNewDigest): string {
  if (!digest.from) return `지금 ${digest.to} · 최근 릴리스 ${digest.releaseCount}개`;
  if (digest.releaseCount === 0) return `${digest.to} · 마지막으로 보신 뒤 바뀐 점이 없어요`;
  return `${digest.from} → ${digest.to} · 마지막으로 보신 뒤 릴리스 ${digest.releaseCount}개`;
}

async function restartToUpdate(): Promise<void> {
  const bridge = updatesBridge();
  if (!bridge || updateStatus?.kind !== "ready") return;
  const version = updateStatus.version;
  const ok = await showConfirm({
    title: `${version}(으)로 다시 시작할까요?`,
    message: "저장한 뒤 앱을 닫고 새 버전으로 다시 엽니다. 다른 창도 함께 닫힙니다.",
    confirmLabel: "다시 시작",
    cancelLabel: "나중에",
  });
  if (!ok) return;
  if (store.isLoaded() && store.hasUnsavedChanges()) {
    const saved = await saveProjectNow();
    if (!saved) {
      toast("저장하지 못해 업데이트를 멈췄어요. 저장 상태를 확인한 뒤 다시 시도해 주세요.", "error");
      return;
    }
  }
  const started = await bridge.install().catch(() => false);
  if (!started) toast("업데이트를 적용하지 못했어요. 릴리스 페이지에서 새 버전을 받아 주세요.", "error");
}

function updateCard(): HTMLElement | null {
  const status = updateStatus;
  if (!status || status.kind === "unavailable" || status.kind === "idle" || status.kind === "checking") return null;
  const actions: HTMLElement[] = [];
  let title = "";
  let detail = "";
  if (status.kind === "downloading") {
    title = `${status.version} 받는 중 · ${status.percent}%`;
    detail = "작업은 그대로 하셔도 돼요. 다 받으면 알려 드릴게요.";
  } else if (status.kind === "ready") {
    title = `${status.version} 준비됨`;
    detail = "저장한 뒤 다시 시작하면 적용돼요. 앱을 그냥 닫아도 다음 실행부터 적용돼요.";
    actions.push(el("button", {
      class: "whats-new-primary",
      text: "다시 시작",
      attrs: { type: "button" },
      dataset: { testid: "whats-new-restart" },
      on: { click: () => void restartToUpdate() },
    }));
  } else if (status.kind === "manual") {
    title = `새 버전 ${status.version}`;
    detail = "이 설치 방식은 스스로 바꿀 수 없어요. 릴리스 페이지에서 받아 주세요.";
    actions.push(el("button", {
      class: "whats-new-primary",
      text: "받으러 가기",
      attrs: { type: "button" },
      dataset: { testid: "whats-new-download" },
      on: { click: () => openExternal(status.downloadUrl) },
    }));
  } else if (status.kind === "error") {
    title = "업데이트를 확인하지 못했어요";
    detail = status.message;
    actions.push(el("button", {
      class: "whats-new-secondary",
      text: "다시 확인",
      attrs: { type: "button" },
      dataset: { testid: "whats-new-recheck" },
      on: { click: () => void updatesBridge()?.check().catch(() => {}) },
    }));
  }
  const children: HTMLElement[] = [el("div", { class: "whats-new-update-text", children: [el("strong", { text: title }), el("span", { text: detail })] })];
  if (status.kind === "downloading") {
    children.push(el("div", {
      class: "whats-new-progress",
      attrs: { role: "progressbar", "aria-label": "업데이트 받기", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(status.percent) },
      children: [el("span", { attrs: { style: `width:${status.percent}%` } })],
    }));
  }
  if (actions.length) children.push(el("div", { class: "whats-new-update-actions", children: actions }));
  return el("div", {
    class: `whats-new-update is-${status.kind}`,
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "whats-new-update", state: status.kind },
    children,
  });
}

function checkLine(): HTMLElement | null {
  const status = updateStatus;
  if (!status) return null;
  if (status.kind === "unavailable") {
    const text = status.reason === "dev"
      ? "개발 실행이라 업데이트를 확인하지 않아요."
      : "이 빌드는 업데이트 주소가 없어 스스로 확인하지 않아요.";
    return el("p", { class: "whats-new-check", dataset: { testid: "whats-new-check" }, text });
  }
  if (status.kind === "checking") return el("p", { class: "whats-new-check", dataset: { testid: "whats-new-check" }, text: "새 버전을 확인하는 중…" });
  if (status.kind === "idle") {
    const text = status.checkedAt ? "최신 버전을 쓰고 있어요." : "아직 새 버전을 확인하지 않았어요.";
    return el("p", {
      class: "whats-new-check",
      dataset: { testid: "whats-new-check" },
      children: [
        el("span", { text }),
        el("button", {
          class: "whats-new-link",
          text: "지금 확인",
          attrs: { type: "button" },
          dataset: { testid: "whats-new-check-now" },
          on: { click: () => void updatesBridge()?.check().catch(() => {}) },
        }),
      ],
    });
  }
  return null;
}

function renderPanel(node: HTMLElement): void {
  const digest = data ? buildDigest(data, currentVersion(), node.dataset.lastSeen || null) : null;
  clearChildren(node);
  node.append(el("header", {
    class: "whats-new-head",
    children: [
      el("div", {
        children: [
          el("h2", { attrs: { id: "whats-new-title" }, text: "새 소식" }),
          el("p", { class: "whats-new-range", dataset: { testid: "whats-new-range" }, text: digest ? rangeLine(digest) : "불러오는 중…" }),
        ],
      }),
      el("button", {
        class: "whats-new-close",
        text: "×",
        attrs: { type: "button", "aria-label": "닫기" },
        dataset: { testid: "whats-new-close" },
        on: { click: () => closeWhatsNewPanel() },
      }),
    ],
  }));
  const card = updateCard();
  if (card) node.append(card);

  const body = el("div", { class: "whats-new-body", dataset: { testid: "whats-new-list" } });
  if (digest) {
    // 본 뒤 릴리스가 없으면 머리 줄이 이미 말한다. 릴리스는 있었는데 보일 것만 없을 때 한 줄 남긴다.
    if (digest.items.length === 0 && digest.releaseCount > 0) {
      body.append(el("p", { class: "whats-new-empty", text: "사용자에게 보이는 변경은 없었어요." }));
    }
    for (const [kind, heading] of [["new", "새 기능"], ["fix", "고친 점"]] as const) {
      const rows = digest.items.filter((item) => item.kind === kind);
      if (rows.length === 0) continue;
      body.append(el("section", {
        class: "whats-new-section",
        children: [
          el("h3", { text: heading }),
          el("ul", {
            children: rows.map((item) => el("li", {
              class: "whats-new-item",
              children: [
                el("span", { class: `whats-new-tag is-${item.kind}`, text: areaLabel(item.scope) }),
                // 커밋 문장은 번역 카탈로그에 없다 — 번역 계층이 조각을 잘못 잡지 않게 건너뛴다.
                el("span", { class: "whats-new-text", attrs: { "data-i18n-skip": "" }, text: item.text }),
                el("span", { class: "whats-new-version", text: item.version }),
              ],
            })),
          }),
        ],
      }));
    }
  }
  node.append(body);

  const footer: (HTMLElement | string)[] = [];
  const check = checkLine();
  if (check) footer.push(check);
  const meta: HTMLElement[] = [];
  if (digest && digest.hidden > 0) meta.push(el("span", { dataset: { testid: "whats-new-hidden" }, text: `개발 내부 변경 ${digest.hidden}건은 숨김` }));
  if (digest?.truncated) meta.push(el("span", { text: "더 오래된 변경은 전체 기록에 있어요" }));
  meta.push(el("button", {
    class: "whats-new-link",
    text: "전체 변경 기록",
    attrs: { type: "button" },
    dataset: { testid: "whats-new-releases" },
    on: { click: () => openExternal(releasesUrl()) },
  }));
  footer.push(el("div", { class: "whats-new-meta", children: meta }));
  node.append(el("footer", { class: "whats-new-foot", children: footer }));
  positionPanel(node);
}

function positionPanel(node: HTMLElement): void {
  const anchor = panelAnchor;
  if (!anchor?.isConnected) return;
  const rect = anchor.getBoundingClientRect();
  const width = typeof window.innerWidth === "number" && window.innerWidth > 0 ? window.innerWidth : 800;
  node.style.top = `${Math.round(rect.bottom + 6)}px`;
  node.style.right = `${Math.max(8, Math.round(width - rect.right))}px`;
}

/** 테스트용 — 모듈 상태를 비운다. */
export function resetWhatsNewForTest(next: WhatsNewData | null = null, status: UpdateStatus | null = null): void {
  closeWhatsNewPanel();
  data = next;
  dataPromise = null;
  updateStatus = status;
  updatesSubscribed = false;
  buttons.clear();
}
