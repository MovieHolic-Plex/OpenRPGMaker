// src/editor/assetStore/storeWorkspace.ts
/**
 * 에셋 스토어 큰 화면 — 공방과 같은 body 위 오버레이. 탭 넷: 둘러보기 · 받은 것 · 이 프로젝트 · 올리기.
 * 스토어 서버와의 통신은 전부 메인 프로세스(window.oprn.store)가 한다. 위키: openwiki/asset-store.md.
 */
import "@/styles/database/assetStore/index.css";
import type { InstalledStoreItem, MyStoreItem, StoreLoginStart, StoreProgressEvent, StoreStatus } from "@/assetStore/bridgeTypes";
import {
  STORE_ITEM_KINDS, STORE_KIND_LABELS, STORE_LICENSE_LABELS, STORE_LICENSES,
  type StoreCatalogPage, type StoreItemDetail, type StoreItemKind, type StoreItemSummary, type StoreLicense,
} from "@/assetStore/format";
import { storeCredits, storeItemsInProject } from "@/assetStore/pack";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { addStoreItemToProject } from "./storeApply";
import { fillStoreImage, storeBridge, storeFailure, type StoreFailure } from "./storeBridge";
import { buildUploadPack, previewGrade, uploadCandidates } from "./storeUpload";

type Tab = "browse" | "installed" | "project" | "upload";
const TAB_LABELS: Record<Tab, string> = { browse: "둘러보기", installed: "받은 것", project: "이 프로젝트", upload: "올리기" };

interface UploadForm {
  picked: Set<string>;
  title: string; summary: string; description: string; tags: string;
  kind: StoreItemKind; license: StoreLicense; ai: "" | "yes" | "no"; credits: string; target: string; agree: boolean;
}

interface State {
  tab: Tab;
  status: StoreStatus | null;
  error: StoreFailure | null;
  query: { q: string; kind: string; grade: "" | "pack"; sort: "" | "popular"; page: number };
  catalog: StoreCatalogPage | null;
  loading: boolean;
  selected: string | null;
  detail: StoreItemDetail | null;
  installed: InstalledStoreItem[];
  latest: Map<string, number>;
  busy: Map<string, string>;
  login: StoreLoginStart | null;
  mine: MyStoreItem[] | null;
  upload: UploadForm;
  uploadResult: { slug: string; status: string; version: number } | null;
  uploadError: StoreFailure | null;
  urlEditing: boolean;
}

let host: HTMLElement | null = null;
let disposers: (() => void)[] = [];
const blankUpload = (): UploadForm => ({ picked: new Set(), title: "", summary: "", description: "", tags: "", kind: "tileset", license: "OPRN-GAME", ai: "", credits: "", target: "", agree: false });
const state: State = {
  tab: "browse", status: null, error: null, query: { q: "", kind: "", grade: "", sort: "", page: 1 }, catalog: null, loading: false,
  selected: null, detail: null, installed: [], latest: new Map(), busy: new Map(), login: null, mine: null,
  upload: blankUpload(), uploadResult: null, uploadError: null, urlEditing: false,
};

export function isAssetStoreOpen(): boolean {
  return host !== null;
}

export function openAssetStore(tab: Tab = state.tab): void {
  closeAssetStore();
  const bridge = storeBridge();
  state.tab = tab;
  host = el("div", { class: "store-host", dataset: { testid: "store-host" }, on: { click: (event) => { if (event.target === host) closeAssetStore(); } } });
  document.body.append(host);
  document.addEventListener("keydown", onKeydown);
  if (!bridge) {
    host.append(el("section", { class: "store", attrs: { role: "dialog", "aria-label": "에셋 스토어" }, children: [
      el("p", { class: "store-empty", text: "에셋 스토어는 OPRN 데스크톱 앱에서 열 수 있습니다." }),
      el("button", { text: "닫기", attrs: { type: "button" }, on: { click: closeAssetStore } }),
    ] }));
    return;
  }
  disposers.push(bridge.onProgress((event) => onProgress(event)));
  disposers.push(bridge.onChanged((event) => {
    if (event.kind === "auth") {
      state.login = null;
      if (event.result === "denied") toast("브라우저에서 로그인을 거절했습니다.", "info");
      if (event.result === "expired") toast("로그인 코드가 만료되었습니다. 다시 시도해 주세요.", "info");
      void refreshStatus();
    } else void refreshInstalled();
  }));
  render();
  void refreshStatus();
  void refreshInstalled();
  void loadCatalog();
}

export function closeAssetStore(): void {
  document.removeEventListener("keydown", onKeydown);
  for (const dispose of disposers) dispose();
  disposers = [];
  host?.remove();
  host = null;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && host) { event.preventDefault(); closeAssetStore(); }
}

function onProgress(event: StoreProgressEvent): void {
  state.busy.set(event.slug, `${event.phase === "install" ? "받는 중" : "올리는 중"} ${event.done}/${event.total}`);
  const bar = host?.querySelector<HTMLElement>(`[data-progress="${CSS.escape(event.slug)}"]`);
  if (bar) bar.textContent = state.busy.get(event.slug) ?? "";
}

async function guard<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    const value = await work();
    state.error = null;
    return value;
  } catch (error) {
    state.error = storeFailure(error);
    render();
    return null;
  }
}

async function refreshStatus(): Promise<void> {
  const status = await guard(() => storeBridge()!.status());
  if (status) state.status = status;
  if (status?.loggedIn && state.tab === "upload") void refreshMine();
  render();
}

async function refreshInstalled(): Promise<void> {
  const installed = await guard(() => storeBridge()!.installed());
  if (installed) state.installed = installed;
  render();
}

async function refreshMine(): Promise<void> {
  const mine = await guard(() => storeBridge()!.mine());
  state.mine = mine?.items ?? null;
  render();
}

async function loadCatalog(): Promise<void> {
  state.loading = true;
  render();
  const { q, kind, grade, sort, page } = state.query;
  const catalog = await guard(() => storeBridge()!.catalog({ q, kind, grade, sort, page }));
  state.loading = false;
  if (catalog) {
    state.catalog = catalog;
    for (const item of catalog.items) state.latest.set(item.slug, item.latestVersion);
  }
  render();
}

async function openDetail(slug: string): Promise<void> {
  state.selected = slug;
  state.detail = null;
  render();
  const detail = await guard(() => storeBridge()!.item({ slug }));
  if (detail && state.selected === slug) {
    state.detail = detail;
    state.latest.set(slug, detail.latestVersion);
  }
  render();
}

async function install(slug: string, title: string): Promise<boolean> {
  state.busy.set(slug, "받는 중…");
  render();
  const record = await guard(() => storeBridge()!.install({ slug }));
  state.busy.delete(slug);
  if (record) {
    toast(`받았습니다: ${title} (판본 ${record.version})`, "ok");
    await refreshInstalled();
  } else render();
  return record !== null;
}

async function addToProject(slug: string, title: string): Promise<void> {
  if (!state.installed.some((item) => item.slug === slug) && !await install(slug, title)) return;
  state.busy.set(slug, "프로젝트에 넣는 중…");
  render();
  try {
    const result = await addStoreItemToProject(slug);
    toast(`${result.replaced ? "새 판본으로 바꿨습니다" : "프로젝트에 넣었습니다"}: ${result.title} — 타일셋 ${result.tilesetIds.length} · 에셋 ${result.assetIds.length}`, "ok");
    state.error = null;
  } catch (error) {
    state.error = storeFailure(error);
  }
  state.busy.delete(slug);
  render();
}

async function uninstall(slug: string): Promise<void> {
  if (await guard(() => storeBridge()!.uninstall({ slug }))) await refreshInstalled();
}

async function startLogin(): Promise<void> {
  const started = await guard(() => storeBridge()!.login({}));
  if (started) state.login = started;
  render();
}

async function logout(): Promise<void> {
  await guard(() => storeBridge()!.logout());
  state.mine = null;
  await refreshStatus();
}

function switchTab(tab: Tab): void {
  const reload = tab === "browse" && state.tab !== "browse";
  state.tab = tab;
  if (reload) void loadCatalog();
  if (tab === "upload" && state.status?.loggedIn && state.mine === null) void refreshMine();
  render();
}

// ── 그리기 ─────────────────────────────────────────────────────────────

function render(): void {
  if (!host) return;
  const scroll = host.querySelector(".store-main")?.scrollTop ?? 0;
  const focusedName = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? document.activeElement.dataset.focusKey ?? null : null;
  clearChildren(host);
  host.append(el("section", {
    class: "store", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "에셋 스토어" }, dataset: { testid: "store", tab: state.tab },
    children: [header(), state.error ? errorBanner(state.error) : null, el("div", { class: "store-main", children: [body()] }), footer()].filter(Boolean) as HTMLElement[],
  }));
  const main = host.querySelector(".store-main");
  if (main) main.scrollTop = scroll;
  if (focusedName) host.querySelector<HTMLElement>(`[data-focus-key="${focusedName}"]`)?.focus();
  if (state.login) host.append(loginOverlay(state.login));
}

function header(): HTMLElement {
  const user = state.status?.user;
  return el("header", { class: "store-head", children: [
    el("h2", { class: "store-title", children: [el("span", { class: "store-mark", attrs: { "aria-hidden": "true" } }), "에셋 스토어"] }),
    el("nav", { class: "store-tabs", attrs: { role: "tablist" }, children: (Object.keys(TAB_LABELS) as Tab[]).map((tab) => el("button", {
      class: "store-tab" + (tab === state.tab ? " is-active" : ""), attrs: { type: "button", role: "tab", "aria-selected": String(tab === state.tab) },
      dataset: { testid: `store-tab-${tab}` }, text: tab === "installed" && state.installed.length > 0 ? `${TAB_LABELS[tab]} ${state.installed.length}` : TAB_LABELS[tab],
      on: { click: () => switchTab(tab) },
    })) }),
    el("div", { class: "store-account", children: user
      ? [el("span", { class: "store-user", dataset: { testid: "store-user" }, text: user.displayName }), el("button", { class: "store-link", text: "로그아웃", attrs: { type: "button" }, on: { click: () => void logout() } })]
      : [el("button", { class: "store-button small", text: "로그인", attrs: { type: "button" }, dataset: { testid: "store-login" }, on: { click: () => void startLogin() } })] }),
    el("button", { class: "store-close", text: "닫기", attrs: { type: "button", "aria-label": "스토어 닫기" }, on: { click: closeAssetStore } }),
  ] });
}

function errorBanner(error: StoreFailure): HTMLElement {
  return el("div", { class: "store-error", attrs: { role: "alert" }, dataset: { testid: "store-error" }, children: [
    el("strong", { text: error.message }),
    ...(error.details.length > 0 ? [el("ul", { children: error.details.slice(0, 8).map((detail) => el("li", { text: detail })) })] : []),
    el("button", { class: "store-link", text: "닫기", attrs: { type: "button" }, on: { click: () => { state.error = null; render(); } } }),
  ] });
}

function footer(): HTMLElement {
  const url = state.status?.url ?? "";
  if (state.urlEditing) {
    const input = el("input", { class: "store-url-input", attrs: { value: url, "aria-label": "스토어 주소" }, dataset: { testid: "store-url-input" } }) as HTMLInputElement;
    return el("footer", { class: "store-foot", children: [input,
      el("button", { class: "store-button small", text: "저장", attrs: { type: "button" }, on: { click: async () => {
        const status = await guard(() => storeBridge()!.setUrl({ url: input.value.trim() }));
        if (status) { state.status = status; state.urlEditing = false; state.catalog = null; state.installed = []; void loadCatalog(); void refreshInstalled(); }
        render();
      } } }),
      el("button", { class: "store-link", text: "취소", attrs: { type: "button" }, on: { click: () => { state.urlEditing = false; render(); } } })] });
  }
  return el("footer", { class: "store-foot", children: [
    el("span", { text: `스토어 ${url}` }),
    el("button", { class: "store-link", text: "주소 바꾸기", attrs: { type: "button" }, on: { click: () => { state.urlEditing = true; render(); } } }),
    ...(state.status && !state.status.tokenPersistent && state.status.loggedIn ? [el("span", { class: "store-hint", text: "이 컴퓨터는 로그인을 저장하지 못해 앱을 다시 켜면 다시 로그인해야 합니다." })] : []),
  ] });
}

function body(): HTMLElement {
  switch (state.tab) {
    case "browse": return browseView();
    case "installed": return installedView();
    case "project": return projectView();
    case "upload": return uploadView();
  }
}

function badges(item: Pick<StoreItemSummary, "grade" | "aiGenerated" | "license">): HTMLElement {
  return el("span", { class: "store-badges", children: [
    ...(item.grade === "pack" ? [el("span", { class: "store-badge pack", text: "조수 사용 가능", attrs: { title: "참고문서가 들어 있어 조수가 이 타일로 바로 맵을 깝니다" } })] : []),
    ...(item.aiGenerated ? [el("span", { class: "store-badge ai", text: "AI 생성" })] : []),
    el("span", { class: "store-badge", text: item.license }),
  ] });
}

function cover(sha: string | null, kind: string, alt: string): HTMLElement {
  if (!sha) return el("span", { class: "store-cover-icon", text: kind === "music" || kind === "sound" ? "♪" : "▦" });
  return fillStoreImage(el("img", { attrs: { alt, loading: "lazy" } }) as HTMLImageElement, sha);
}

function installState(slug: string): { installed: InstalledStoreItem | null; inProject: number | null; update: boolean } {
  const installed = state.installed.find((item) => item.slug === slug) ?? null;
  const inProject = storeItemsInProject(store.getCurrent()).find((item) => item.slug === slug)?.version ?? null;
  const latest = state.latest.get(slug);
  return { installed, inProject, update: installed !== null && latest !== undefined && latest > installed.version };
}

function browseView(): HTMLElement {
  const search = el("input", {
    class: "store-search", attrs: { type: "search", placeholder: "타일셋, 캐릭터, 음악 찾기", value: state.query.q, "aria-label": "찾기" },
    dataset: { testid: "store-search", focusKey: "search" },
    on: { keydown: (event) => { if ((event as KeyboardEvent).key === "Enter") { state.query.q = (event.target as HTMLInputElement).value; state.query.page = 1; void loadCatalog(); } } },
  });
  const chip = (label: string, active: boolean, onClick: () => void, testid?: string) => el("button", {
    class: "store-chip" + (active ? " is-on" : ""), text: label, attrs: { type: "button", "aria-pressed": String(active) }, ...(testid ? { dataset: { testid } } : {}),
    on: { click: onClick },
  });
  const setQuery = (patch: Partial<State["query"]>) => { Object.assign(state.query, { page: 1 }, patch); void loadCatalog(); };
  const filters = el("div", { class: "store-filters", children: [
    search,
    el("div", { class: "store-chips", children: [
      chip("전체", !state.query.kind, () => setQuery({ kind: "" })),
      ...STORE_ITEM_KINDS.map((kind) => chip(STORE_KIND_LABELS[kind], state.query.kind === kind, () => setQuery({ kind }), `store-kind-${kind}`)),
    ] }),
    el("div", { class: "store-chips", children: [
      chip("조수 사용 가능만", state.query.grade === "pack", () => setQuery({ grade: state.query.grade === "pack" ? "" : "pack" }), "store-filter-pack"),
      chip("최신", state.query.sort === "", () => setQuery({ sort: "" })),
      chip("인기", state.query.sort === "popular", () => setQuery({ sort: "popular" })),
    ] }),
  ] });
  const items = state.catalog?.items ?? [];
  const grid = items.length > 0
    ? el("div", { class: "store-grid", dataset: { testid: "store-grid" }, children: items.map(card) })
    : el("p", { class: "store-empty", text: state.loading ? "불러오는 중…" : state.catalog ? "찾는 에셋이 없습니다." : "스토어에 연결하지 못했습니다." });
  const pages = state.catalog ? Math.max(1, Math.ceil(state.catalog.total / state.catalog.pageSize)) : 1;
  const pager = pages > 1 ? el("div", { class: "store-pager", children: [
    el("button", { text: "← 이전", attrs: { type: "button", ...(state.query.page <= 1 ? { disabled: "" } : {}) }, on: { click: () => { state.query.page -= 1; void loadCatalog(); } } }),
    el("span", { text: `${state.query.page} / ${pages}` }),
    el("button", { text: "다음 →", attrs: { type: "button", ...(state.query.page >= pages ? { disabled: "" } : {}) }, on: { click: () => { state.query.page += 1; void loadCatalog(); } } }),
  ] }) : null;
  return el("div", { class: "store-browse" + (state.selected ? " has-detail" : ""), children: [
    el("div", { class: "store-list", children: [filters, grid, ...(pager ? [pager] : [])] }),
    ...(state.selected ? [detailView()] : []),
  ] });
}

function card(item: StoreItemSummary): HTMLElement {
  const info = installState(item.slug);
  const tag = info.update ? "업데이트 있음" : info.inProject !== null ? "프로젝트에 있음" : info.installed ? "받음" : null;
  return el("button", {
    class: "store-card" + (state.selected === item.slug ? " is-selected" : ""), attrs: { type: "button" },
    dataset: { testid: `store-card-${item.slug}`, slug: item.slug },
    on: { click: () => void openDetail(item.slug) },
    children: [
      el("span", { class: "store-cover", children: [cover(item.cover, item.kind, item.title), ...(tag ? [el("span", { class: "store-card-state", text: tag })] : [])] }),
      el("span", { class: "store-card-body", children: [
        el("strong", { class: "store-card-title", text: item.title }),
        el("span", { class: "store-card-meta", text: `${item.author} · ${STORE_KIND_LABELS[item.kind]} · 받기 ${item.downloads}` }),
        badges(item),
      ] }),
    ],
  });
}

function actionButtons(slug: string, title: string): HTMLElement {
  const info = installState(slug);
  const busy = state.busy.get(slug);
  if (busy) return el("div", { class: "store-actions", children: [el("span", { class: "store-progress", dataset: { progress: slug, testid: "store-progress" }, text: busy })] });
  const latest = state.latest.get(slug);
  return el("div", { class: "store-actions", children: [
    el("button", {
      class: "store-button", attrs: { type: "button" }, dataset: { testid: "store-add" },
      text: info.inProject !== null ? (latest !== undefined && latest > info.inProject ? `프로젝트를 판본 ${latest}로 바꾸기` : "프로젝트에 다시 넣기") : "이 프로젝트에 넣기",
      on: { click: () => void addToProject(slug, title) },
    }),
    info.installed
      ? (info.update
        ? el("button", { class: "store-button ghost", text: `판본 ${latest} 받기`, attrs: { type: "button" }, dataset: { testid: "store-update" }, on: { click: () => void install(slug, title) } })
        : el("button", { class: "store-button ghost", text: "받은 것 지우기", attrs: { type: "button" }, dataset: { testid: "store-uninstall" }, on: { click: () => void uninstall(slug) } }))
      : el("button", { class: "store-button ghost", text: "받기만", attrs: { type: "button" }, dataset: { testid: "store-install" }, on: { click: () => void install(slug, title) } }),
  ] });
}

function detailView(): HTMLElement {
  const detail = state.detail;
  const close = el("button", { class: "store-link store-detail-close", text: "닫기 ✕", attrs: { type: "button" }, on: { click: () => { state.selected = null; state.detail = null; render(); } } });
  if (!detail) return el("aside", { class: "store-detail", dataset: { testid: "store-detail" }, children: [close, el("p", { class: "store-empty", text: "불러오는 중…" })] });
  const info = installState(detail.slug);
  const previews = detail.previews.length > 0 ? detail.previews : [];
  return el("aside", { class: "store-detail", dataset: { testid: "store-detail", slug: detail.slug }, children: [
    close,
    el("div", { class: "store-gallery", children: previews.length > 0
      ? previews.map((sha, index) => el("figure", { class: index === 0 ? "is-main" : "", children: [fillStoreImage(el("img", { attrs: { alt: `${detail.title} 미리보기 ${index + 1}` } }) as HTMLImageElement, sha)] }))
      : [el("figure", { class: "is-main", children: [cover(null, detail.kind, detail.title)] })] }),
    el("p", { class: "store-kind", text: STORE_KIND_LABELS[detail.kind] }),
    el("h3", { class: "store-detail-title", dataset: { testid: "store-detail-title" }, text: detail.title }),
    el("p", { class: "store-by", text: `${detail.author} · 받기 ${detail.downloads} · 판본 ${detail.latestVersion}` }),
    badges(detail),
    el("p", { class: "store-summary", text: detail.summary }),
    actionButtons(detail.slug, detail.title),
    ...(info.inProject !== null ? [el("p", { class: "store-hint", text: `이 프로젝트에 판본 ${info.inProject}이 들어 있습니다.` })] : []),
    el("dl", { class: "store-facts", children: [
      el("dt", { text: "라이선스" }), el("dd", { text: STORE_LICENSE_LABELS[detail.license] }),
      el("dt", { text: "들어 있는 것" }), el("dd", { text: `타일셋 ${detail.counts.tilesets} · 에셋 ${detail.counts.assets} · 참고문서 ${detail.counts.referenceDocuments}` }),
    ] }),
    ...(detail.description ? [el("h4", { text: "설명" }), el("p", { class: "store-pre", text: detail.description })] : []),
    ...(detail.credits ? [el("h4", { text: "크레딧 표기" }), el("p", { class: "store-pre", text: detail.credits }), el("p", { class: "store-hint", text: "게임의 타이틀 「크레딧」 창에 자동으로 들어갑니다." })] : []),
    el("p", { class: "store-hint", text: `웹: ${state.status?.url ?? ""}/items/${detail.slug}` }),
  ] });
}

function installedView(): HTMLElement {
  if (state.installed.length === 0) return el("p", { class: "store-empty", text: "아직 받은 것이 없습니다. 둘러보기에서 받으면 모든 프로젝트에서 쓸 수 있습니다." });
  return el("div", { class: "store-rows", dataset: { testid: "store-installed" }, children: state.installed.map((item) => {
    const info = installState(item.slug);
    return el("div", { class: "store-row", dataset: { testid: `store-installed-${item.slug}` }, children: [
      el("span", { class: "store-cover small", children: [cover(item.cover, item.kind, item.title)] }),
      el("span", { class: "store-row-body", children: [
        el("strong", { text: item.title }),
        el("span", { class: "store-card-meta", text: `${item.author} · 판본 ${item.version}${info.update ? ` (판본 ${state.latest.get(item.slug)} 있음)` : ""} · ${item.license}${info.inProject !== null ? " · 이 프로젝트에 있음" : ""}` }),
      ] }),
      actionButtons(item.slug, item.title),
    ] });
  }) });
}

function projectView(): HTMLElement {
  const project = store.getCurrent();
  const items = storeItemsInProject(project);
  if (items.length === 0) return el("p", { class: "store-empty", text: "이 프로젝트에는 아직 스토어 에셋이 없습니다." });
  return el("div", { class: "store-project", children: [
    el("div", { class: "store-rows", dataset: { testid: "store-project-items" }, children: items.map((item) => el("div", { class: "store-row", children: [
      el("span", { class: "store-row-body", children: [
        el("strong", { text: item.title }),
        el("span", { class: "store-card-meta", text: `${item.origin.author} · 판본 ${item.version} · ${item.origin.license}${item.origin.aiGenerated ? " · AI 생성 포함" : ""} · 타일셋 ${item.tilesetIds.length} · 에셋 ${item.assetIds.length}` }),
      ] }),
    ] })) }),
    el("h4", { text: "게임 크레딧에 이렇게 들어갑니다" }),
    el("pre", { class: "store-credits", dataset: { testid: "store-credits" }, text: storeCredits(project) }),
    el("p", { class: "store-hint", text: "타이틀 메뉴 「크레딧」 창에 기본 저작자 표기 뒤로 붙습니다. 에셋을 지우면 이 목록에서도 빠집니다." }),
  ] });
}

function uploadView(): HTMLElement {
  if (!state.status?.loggedIn) {
    return el("div", { class: "store-login-card", children: [
      el("h3", { text: "올리려면 로그인하세요" }),
      el("p", { text: "브라우저에서 스토어 계정으로 로그인하면 이 앱도 로그인됩니다. 둘러보기·받기는 로그인 없이 됩니다." }),
      el("button", { class: "store-button", text: "로그인", attrs: { type: "button" }, dataset: { testid: "store-upload-login" }, on: { click: () => void startLogin() } }),
    ] });
  }
  const form = state.upload;
  const project = store.getCurrent();
  const candidates = uploadCandidates(project);
  const selection = {
    tilesetIds: candidates.filter((c) => c.kind === "tileset" && form.picked.has(c.id)).map((c) => c.id),
    assetIds: candidates.filter((c) => c.kind === "asset" && form.picked.has(c.id)).map((c) => c.id),
  };
  const grade = selection.tilesetIds.length + selection.assetIds.length > 0 ? previewGrade(project, selection) : null;
  const bind = (key: "title" | "summary" | "description" | "tags" | "credits", attrs: Record<string, string> = {}, area = false) => el(area ? "textarea" : "input", {
    attrs: { ...attrs, ...(area ? {} : { value: form[key] }) }, dataset: { testid: `store-upload-${key}`, focusKey: `upload-${key}` },
    ...(area ? { text: form[key] } : {}),
    on: { input: (event) => { form[key] = (event.target as HTMLInputElement).value; } },
  });
  const pickRow = (c: (typeof candidates)[number]) => el("label", {
    class: "store-pick-row" + (c.blocked ? " is-blocked" : ""), dataset: { testid: `store-upload-candidate-${c.id}` },
    children: [
      el("input", { attrs: { type: "checkbox", ...(form.picked.has(c.id) ? { checked: "" } : {}), ...(c.blocked ? { disabled: "" } : {}) },
        on: { change: (event) => { if ((event.target as HTMLInputElement).checked) form.picked.add(c.id); else form.picked.delete(c.id); render(); } } }),
      el("span", { class: "store-pick-name", text: c.name }),
      el("span", { class: "store-card-meta", text: c.blocked ?? c.detail }),
      ...(c.withReferences ? [el("span", { class: "store-badge pack", text: "참고문서" })] : []),
    ],
  });
  const open = candidates.filter((c) => !c.blocked);
  const blocked = candidates.filter((c) => c.blocked);
  const list = el("div", { class: "store-pick", children: [
    ...(open.length > 0 ? open.map(pickRow) : [el("p", { class: "store-empty", text: "올릴 수 있는 타일셋·그림이 이 프로젝트에 없습니다. 직접 만든 그림만 올릴 수 있습니다." })]),
    ...(blocked.length > 0 ? [el("details", { class: "store-pick-blocked", dataset: { testid: "store-upload-blocked" }, children: [
      el("summary", { text: `올릴 수 없는 것 ${blocked.length}개 (스토어에서 받은 것·공용 자료집·제3자 팩)` }),
      ...blocked.map(pickRow),
    ] })] : []),
  ] });
  const mine = (state.mine ?? []).filter((item) => item.status !== "removed");
  const submit = el("button", { class: "store-button", text: "올리기", attrs: { type: "button" }, dataset: { testid: "store-upload-submit" }, on: { click: () => void submitUpload(selection) } });
  return el("div", { class: "store-upload", children: [
    ...(state.uploadResult ? [el("p", { class: "store-ok store-upload-done", dataset: { testid: "store-upload-result" }, text: state.uploadResult.status === "pending"
      ? `올렸습니다 (판본 ${state.uploadResult.version}). 새 작가의 첫 공개는 운영자가 한 번 확인한 뒤 목록에 보입니다.`
      : `올렸습니다 (판본 ${state.uploadResult.version}). 지금 스토어에 보입니다.` })] : []),
    el("section", { class: "store-upload-col", children: [
      el("h3", { text: "1. 올릴 것 고르기" }),
      el("p", { class: "store-hint", text: "타일셋을 고르면 그림·이식 원본·참고문서가 함께 들어갑니다. 참고문서가 있으면 「조수 사용 가능」으로 표시됩니다." }),
      list,
      grade ? el("p", { class: "store-grade", dataset: { testid: "store-upload-grade" }, children: ["등급: ", grade === "pack" ? el("span", { class: "store-badge pack", text: "조수 사용 가능" }) : el("span", { class: "store-badge", text: "낱장" })] }) : null,
    ].filter(Boolean) as HTMLElement[] }),
    el("section", { class: "store-upload-col store-form", children: [
      el("h3", { text: "2. 소개하기" }),
      el("label", { children: ["어디에", el("select", { dataset: { testid: "store-upload-target" }, on: { change: (event) => { form.target = (event.target as HTMLSelectElement).value; } },
        children: [el("option", { value: "", text: "새 상품" }), ...mine.map((item) => el("option", { value: item.slug, text: `새 판본: ${item.title} (지금 판본 ${item.latestVersion})`, attrs: form.target === item.slug ? { selected: "" } : {} }))] })] }),
      el("label", { children: ["제목", bind("title", { maxlength: "80", placeholder: "숲 마을 타일 팩" })] }),
      el("label", { children: ["한 줄 소개", bind("summary", { maxlength: "160" })] }),
      el("label", { children: ["설명", bind("description", { rows: "3", maxlength: "8000" }, true)] }),
      el("label", { children: ["종류", el("select", { dataset: { testid: "store-upload-kind" }, on: { change: (event) => { form.kind = (event.target as HTMLSelectElement).value as StoreItemKind; } },
        children: STORE_ITEM_KINDS.map((kind) => el("option", { value: kind, text: STORE_KIND_LABELS[kind], attrs: form.kind === kind ? { selected: "" } : {} })) })] }),
      el("label", { children: ["태그(쉼표로 구분)", bind("tags", { placeholder: "숲, 마을, 16px" })] }),
      el("fieldset", { children: [el("legend", { text: "라이선스" }), ...STORE_LICENSES.map((license) => el("label", { class: "store-radio", children: [
        el("input", { attrs: { type: "radio", name: "store-license", ...(form.license === license ? { checked: "" } : {}) }, on: { change: () => { form.license = license; } } }), STORE_LICENSE_LABELS[license],
      ] }))] }),
      el("fieldset", { children: [el("legend", { text: "AI 생성 여부 (필수)" }), ...([["yes", "AI 도구로 만든 부분이 있다"], ["no", "전부 직접 만들었다"]] as const).map(([value, label]) => el("label", { class: "store-radio", children: [
        el("input", { attrs: { type: "radio", name: "store-ai", ...(form.ai === value ? { checked: "" } : {}) }, dataset: { testid: `store-upload-ai-${value}` }, on: { change: () => { form.ai = value; } } }), label,
      ] }))] }),
      el("label", { children: ["크레딧 표기", bind("credits", { maxlength: "400", placeholder: "그림: 이름" })] }),
      el("label", { class: "store-radio", children: [
        el("input", { attrs: { type: "checkbox", ...(form.agree ? { checked: "" } : {}) }, dataset: { testid: "store-upload-agree" }, on: { change: (event) => { form.agree = (event.target as HTMLInputElement).checked; } } }),
        "이 그림·소리의 권리를 내가 가지고 있고 스토어 이용약관에 동의합니다.",
      ] }),
      state.busy.has("__upload") ? el("span", { class: "store-progress", dataset: { progress: form.title, testid: "store-progress" }, text: state.busy.get("__upload") ?? "" }) : submit,
      ...(state.uploadError ? [errorBanner(state.uploadError)] : []),
    ] }),
  ] });
}

async function submitUpload(selection: { tilesetIds: string[]; assetIds: string[] }): Promise<void> {
  const form = state.upload;
  const problems: string[] = [];
  if (selection.tilesetIds.length + selection.assetIds.length === 0) problems.push("올릴 것을 하나 이상 고르세요.");
  if (form.title.trim().length < 2) problems.push("제목을 2자 이상 적어 주세요.");
  if (!form.ai) problems.push("AI 생성 여부를 골라 주세요.");
  if (!form.agree) problems.push("권리·이용약관 확인에 동의해 주세요.");
  if (problems.length > 0) { state.uploadError = { message: "올리기 전에 확인해 주세요.", status: 0, details: problems }; render(); return; }
  state.uploadError = null;
  state.uploadResult = null;
  state.busy.set("__upload", "팩 만드는 중…");
  render();
  try {
    const built = await buildUploadPack(store.getCurrent(), selection, {
      title: form.title, summary: form.summary, description: form.description, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
      kind: form.kind, license: form.license, aiGenerated: form.ai === "yes", credits: form.credits,
    });
    const unsubscribe = storeBridge()!.onProgress((event) => {
      if (event.phase !== "upload") return;
      state.busy.set("__upload", `올리는 중 ${event.done}/${event.total}`);
      const bar = host?.querySelector<HTMLElement>('[data-testid="store-progress"]');
      if (bar) bar.textContent = state.busy.get("__upload") ?? "";
    });
    try {
      state.uploadResult = await storeBridge()!.upload({ manifest: built.manifest, blobs: Object.fromEntries([...built.blobs].map(([sha, blob]) => [sha, blob.bytes])), ...(form.target ? { targetSlug: form.target } : {}) });
    } finally {
      unsubscribe();
    }
    state.upload = blankUpload();
    host?.querySelector(".store-main")?.scrollTo({ top: 0 });
    void refreshMine();
  } catch (error) {
    state.uploadError = storeFailure(error);
  }
  state.busy.delete("__upload");
  render();
}

function loginOverlay(login: StoreLoginStart): HTMLElement {
  return el("div", { class: "store-login-overlay", dataset: { testid: "store-login-panel" }, children: [el("div", { class: "store-login-box", children: [
    el("h3", { text: "브라우저에서 로그인을 허락하세요" }),
    el("p", { text: "브라우저가 열렸습니다. 스토어에 로그인한 뒤, 아래 코드가 화면의 코드와 같은지 확인하고 「허락」을 누르세요." }),
    el("p", { class: "store-user-code", dataset: { testid: "store-login-code" }, text: login.userCode }),
    el("p", { class: "store-hint", text: `브라우저가 안 열렸으면: ${login.verificationUri} 에서 코드 입력` }),
    el("button", { class: "store-button ghost", text: "취소", attrs: { type: "button" }, on: { click: () => { state.login = null; render(); } } }),
  ] })] });
}
