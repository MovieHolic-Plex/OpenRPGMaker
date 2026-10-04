import { FACE_EXPRESSION_SETS, isFaceExpressionResource } from "@/assets/faceExpressionSets";
import { renderExpressionSection } from "./resourceExpressionSection";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { listMonsterResources, type MonsterResource } from "@/assets/monsterResourceCatalog";
import { EASYRPG_MONSTER_ASSETS } from "@/assets/easyrpgRtp";
import { SCARLOXY_MONSTER_ASSETS } from "@/assets/scarloxyPack";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { hasOpenModalLayer, isTopModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import type { Project, ResourceProfile, UploadedAsset } from "@/project/types";
import { el } from "@/util/dom";
import { jsonEqual } from "@/util/structuralJson";
import { makeSvgIcon, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { deckIcon } from "./aiDeckIcons";
import { monsterResourceStatus } from "./monsterResourcePresentation";
import { dedupeListedProfiles, makeResourcePreviewGrid, resourceKindFromUpload, uploadedResourceKindLabel } from "./resourceManagerUtils";

export type UploadedAssetActions = {
  addTileset(asset: UploadedAsset): void;
  applyTileset(asset: UploadedAsset): void;
  deleteAsset(asset: UploadedAsset): void;
};

export type ResourceCategory = {
  readonly kind: ResourceProfile["kind"];
  readonly label: string;
};

export type ResourceWorkbenchOptions = {
  readonly categories: readonly ResourceCategory[];
  readonly selectedKind: ResourceProfile["kind"];
  readonly expressionView?: boolean;
  readonly onSelectExpressions?: () => void;
  readonly profiles: readonly ResourceProfile[];
  readonly uploaded: readonly UploadedAsset[];
  readonly kindSelect: HTMLSelectElement;
  readonly fileInput: HTMLInputElement;
  readonly actions: UploadedAssetActions;
  readonly audioPanes?: {
    readonly entries: HTMLElement;
    readonly commands: HTMLElement;
  };
  readonly onSelectKind: (kind: ResourceProfile["kind"]) => void;
  readonly onImport: () => void;
  /** 방금 가져온 자산 id. 그 줄을 짚어 주고 화면 안으로 끌어온다. */
  readonly recentAssetId?: string;
  readonly onDropFile?: (file: File) => void;
  readonly onImportUrl?: (url: string) => void;
  /** 칩셋 탭에서 제작자 페이지를 연다. 파일은 그 페이지에서 사용자가 직접 받는다. */
  readonly onBrowseCreatorPage?: () => void;
};
export type ResourceItem =
  | { readonly type: "profile"; readonly profile: ResourceProfile }
  | { readonly type: "uploaded"; readonly asset: UploadedAsset };

type ViewMode = "grid" | "list";
type FilterTab = "all" | "uploaded" | "builtin";

let currentViewMode: ViewMode = "grid";
let currentFilterTab: FilterTab = "all";

// Raw registration projection mirrors listMonsterResources (including upload masking).
// It deliberately never resolves names/tags/descriptions. The equivalence contract is
// exercised in resourceManagerPerformance.test.ts when the catalog authority changes.
const retiredGeneratedMonsters = new Set([
  "generated-enemy-reference-cocoon", "generated-enemy-reference-seed-back",
  "generated-troop-preview-slime", "easyrpg-monster-hornet",
]);
let bundledMonsterIds: ReadonlySet<string> | undefined;
function monsterIds(): ReadonlySet<string> {
  return bundledMonsterIds ??= new Set([
    ...GENERATED_ASSET_PLAN.assets.filter(a => a.status === "promoted" && a.resourceKind === "monster"
      && !retiredGeneratedMonsters.has(a.resourceId)).map(a => a.resourceId),
    ...builtinGeneratedResourceIds().filter(id => id.startsWith("generated-enemy-") && !retiredGeneratedMonsters.has(id)),
    ...EASYRPG_MONSTER_ASSETS.map(a => a.id), ...SCARLOXY_MONSTER_ASSETS.map(a => a.id),
  ].filter(Boolean));
}
let uploadDependency: Project["assets"]["uploaded"] | undefined;
/** store.update shallow-copies this dictionary even for unrelated description edits. */
export function resourceManagerUploadDependency(project: Project): Project["assets"]["uploaded"] {
  const next = project.assets.uploaded;
  if (uploadDependency === next) return next;
  const keys = Object.keys(next);
  if (uploadDependency && keys.length === Object.keys(uploadDependency).length
    && keys.every(id => Object.hasOwn(uploadDependency!, id) && next[id] === uploadDependency![id])) return uploadDependency;
  uploadDependency = next;
  return next;
}
let countCache: { profiles: Project["resourceProfiles"]; uploads: Project["assets"]["uploaded"]; count: number } | undefined;
export function resourceManagerMonsterCount(project: Project): number {
  const uploads = resourceManagerUploadDependency(project);
  if (countCache?.profiles === project.resourceProfiles && countCache.uploads === uploads) return countCache.count;
  const ids = new Set([...monsterIds()].filter(id => !Object.hasOwn(project.assets.uploaded, id)));
  for (const profile of project.resourceProfiles) {
    if (profile.kind === "monster" && profile.assetId && !Object.hasOwn(project.assets.uploaded, profile.assetId)) ids.add(profile.assetId);
  }
  for (const [id, asset] of Object.entries(project.assets.uploaded)) if (id && asset.kind === "monster") ids.add(id);
  countCache = { profiles: project.resourceProfiles, uploads, count: ids.size };
  return ids.size;
}
let catalogCache: { profiles: Project["resourceProfiles"]; uploads: Project["assets"]["uploaded"];
  metadata: Project["monsterMetadata"]; resources: readonly MonsterResource[]; byId: ReadonlyMap<string, MonsterResource> } | undefined;
function monsterCatalog(project: Project) {
  const uploads = resourceManagerUploadDependency(project);
  if (!catalogCache || catalogCache.profiles !== project.resourceProfiles || catalogCache.uploads !== uploads
    || !jsonEqual(catalogCache.metadata, project.monsterMetadata)) {
    const resources = listMonsterResources(project);
    catalogCache = { profiles: project.resourceProfiles, uploads, metadata: project.monsterMetadata,
      resources, byId: new Map(resources.map(r => [r.resourceId, r])) };
  }
  // Small override maps are deep-cloned by unrelated store.update calls too.
  // Remember the new equal dependency without rebuilding full catalog semantics.
  catalogCache.metadata = project.monsterMetadata;
  return catalogCache;
}
const workbenches = new WeakMap<HTMLElement, ResourceWorkbenchOptions>();
const galleryCleanups = new WeakMap<HTMLElement, () => void>();
const charsetCleanups = new WeakMap<HTMLElement, () => void>();
export function disposeResourceWorkbench(container: HTMLElement): void {
  for (const gallery of container.querySelectorAll<HTMLElement>(".rm-modern-gallery-container")) galleryCleanups.get(gallery)?.();
  workbenches.delete(container);
}
export function refreshResourceWorkbenchCategories(container: HTMLElement): void {
  const previous = workbenches.get(container);
  if (!previous) return;
  const project = store.getCurrent();
  const options = { ...previous, profiles: project.resourceProfiles, uploaded: Object.values(project.assets.uploaded) };
  container.querySelector(".rm-category-list")?.replaceWith(resourceCategoryList(options, resourceManagerMonsterCount(project)));
  workbenches.set(container, options);
}

export function renderResourceWorkbench(container: HTMLElement, options: ResourceWorkbenchOptions): void {
  const project = store.getCurrent();
  // The monster catalog includes registrations absent from the project profile table.
  const monsterResources = options.selectedKind === "monster" ? monsterCatalog(project).resources : [];
  workbenches.set(container, options);
  let selectedProfiles = dedupeListedProfiles(options.profiles, options.uploaded)
    .filter((profile) => profile.kind === options.selectedKind)
    .filter((profile) => options.selectedKind !== "faceset" || !isFaceExpressionResource(profile.assetId));
  let selectedUploaded = options.uploaded.filter((asset) => resourceKindFromUpload(asset.kind) === options.selectedKind);
  if (options.selectedKind === "monster") {
    const derived = monsterResourceEntries(project, monsterResources);
    selectedProfiles = derived.profiles;
    selectedUploaded = derived.uploaded;
  }
  
  let selectedItem: ResourceItem | null = null;
  if (selectedUploaded.length > 0) {
    selectedItem = { type: "uploaded", asset: selectedUploaded.find(a => a.id === options.recentAssetId) ?? selectedUploaded[0]! };
  } else if (selectedProfiles.length > 0) {
    selectedItem = { type: "profile", profile: selectedProfiles[0]! };
  }

  const shell = el("div", {
    class: "rm-classic-shell rm-modern-studio-shell",
  });

  // Drag & Drop visual feedback on shell
  if (options.onDropFile) {
    shell.addEventListener("dragover", (e) => {
      e.preventDefault();
      shell.classList.add("rm-drag-over");
    });
    shell.addEventListener("dragleave", (e) => {
      if (!shell.contains(e.relatedTarget as Node)) {
        shell.classList.remove("rm-drag-over");
      }
    });
    shell.addEventListener("drop", (e) => {
      e.preventDefault();
      shell.classList.remove("rm-drag-over");
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && options.onDropFile) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file) options.onDropFile(file);
        }
      }
    });
  }

  const previewWell = el("div", { class: "rm-preview-well rm-modern-inspector-well", attrs: { "aria-label": "미리보기" } });
  const updateInspector = () => {
    renderInspector(previewWell, selectedItem, options.selectedKind, options.actions);
  };

  const handleSelect = (item: ResourceItem) => {
    selectedItem = item;
    updateInspector();
  };

  shell.append(
    resourceCategoryList(options, resourceManagerMonsterCount(project)),
    options.expressionView && options.selectedKind === "faceset" ? renderExpressionSection(profile => handleSelect({ type: "profile", profile })) : options.audioPanes?.entries ?? resourceEntryList(selectedProfiles, selectedUploaded, options.actions, handleSelect, () => selectedItem, options.onImport, options.selectedKind, options.recentAssetId),
    options.audioPanes?.commands ?? resourceCommandPanel(options, previewWell, () => selectedItem)
  );

  container.append(
    shell,
    options.kindSelect,
    options.fileInput
  );

  updateInspector();
  if (options.recentAssetId !== undefined) revealRecentUploadRow(container, options.recentAssetId);
}

/**
 * 가져오기 직후 새 항목은 목록 아래에 붙고 스크롤은 그대로라 토스트만 뜨고
 * 아무 일도 없었던 것처럼 보인다. 가져온 줄로 화면을 끌어온다.
 */
function revealRecentUploadRow(container: HTMLElement, assetId: string): void {
  const row = container.querySelector(`[data-testid="resource-upload-${assetId}"]`);
  if (!(row instanceof HTMLElement)) return;
  if (typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });

}

export function renderResourceProfiles(container: HTMLElement, profiles: readonly ResourceProfile[]): void {
  container.append(el("h3", { text: `프로필 (${profiles.length})` }));
  const list = el("div", { class: "rm-profile-list", dataset: { testid: "resource-profile-list" } });
  for (const profile of profiles) {
    list.append(resourceProfileRow(profile, false, () => {}));
  }
  container.append(list);
}

export function renderUploadedAssets(
  container: HTMLElement,
  uploaded: readonly UploadedAsset[],
  actions: UploadedAssetActions
): void {
  container.append(el("h3", { text: `업로드 (${uploaded.length})` }));
  const list = el("div", { class: "rm-upload-list", dataset: { testid: "resource-upload-list" } });
  if (uploaded.length === 0) {
    list.append(el("div", { class: "empty-hint", text: "아직 업로드한 리소스가 없습니다." }));
  }
  for (const asset of uploaded) {
    list.append(uploadedAssetRow(asset, actions, false, () => {}));
  }
  container.append(list);
}

function resourceProfileRow(
  profile: ResourceProfile,
  isSelected: boolean,
  onSelect: () => void
): HTMLElement {
  const project = store.getCurrent();
  const spec = getResourceProfileSpec(profile.kind);
  const text = [
    spec.label,
    profile.name,
    profile.imageWidth && profile.imageHeight ? `${profile.imageWidth}x${profile.imageHeight}` : undefined,
    profile.tileWidth && profile.tileHeight ? `${profile.tileWidth}x${profile.tileHeight}` : undefined,
    profile.assetId,
  ].filter(Boolean).join(" · ");
  const row = el("div", {
    class: isSelected ? "rm-profile-row active" : "rm-profile-row",
    dataset: { testid: `resource-profile-${profile.kind}` },
    text,
    on: { click: onSelect },
  });
  const previewUrl = resolveAssetResourceUrl(profile.assetId, { project });
  const isAudio = profile.kind === "music" || profile.kind === "sound";
  if (previewUrl && profile.kind !== "chipset" && !isAudio) {
    const thumb = el("img", { attrs: { alt: `${profile.name} 미리보기`, src: previewUrl, loading: "lazy", decoding: "async" } }) as HTMLImageElement;
    thumb.className = "rm-profile-thumb";
    row.prepend(thumb);
  }
  if (isAudio) {
    row.prepend(el("span", { class: "rm-profile-audio-badge", text: profile.kind === "music" ? "♪ BGM" : "♪ SE", attrs: { "aria-hidden": "true" } }));
  }
  if (profile.kind === "chipset") {
    row.append(makeResourcePreviewGrid(profile.imageWidth ?? 0, profile.imageHeight ?? 0, profile.tileWidth ?? 16));
  }
  return row;
}

/**
 * 몬스터 소재 카탈로그를 기존 프로필/업로드 버킷으로 펼친다. 카탈로그가 이미 id 충돌
 * (업로드 > 번들 > 프로필) 정리를 끝냈으므로 여기서는 화면용 프로필만 합성한다.
 */
function monsterResourceEntries(
  project: Project,
  resources: readonly MonsterResource[]
): { profiles: ResourceProfile[]; uploaded: UploadedAsset[] } {
  const profiles: ResourceProfile[] = [];
  const uploaded: UploadedAsset[] = [];
  const profileIndex = new Map(project.resourceProfiles.filter(p => p.kind === "monster").map(p => [p.assetId, p]));
  for (const resource of resources) {
    if (resource.origin === "uploaded") {
      const asset = project.assets.uploaded[resource.resourceId];
      if (asset !== undefined) uploaded.push(asset);
      continue;
    }
    const existing = resource.origin === "profile"
      ? profileIndex.get(resource.resourceId)
      : undefined;
    profiles.push(
      existing !== undefined
        ? { ...existing, name: resource.name }
        : { kind: "monster", name: resource.name, assetId: resource.resourceId }
    );
  }
  return { profiles, uploaded };
}

function resourceCategoryList(options: ResourceWorkbenchOptions, monsterTotal: number): HTMLElement {
  const list = el("div", {
    class: "rm-category-list rm-modern-category-sidebar",
    attrs: { role: "listbox", "aria-label": "리소스 종류" },
    dataset: { testid: "resource-category-list" },
  });

  // 이모지 대신 에디터 공용 SVG 아이콘 — 이모지는 OS 마다 모양이 다르고 📦 가 그림·시스템·시스템 2 에
  // 겹쳐 분류를 구분하지 못했다(2026-09-24 visual QA).
  const getCategoryIcon = (kind: ResourceProfile["kind"]): SvgIconName => {
    switch (kind) {
      case "charset": return "user";
      case "battleCharset": return "combat";
      case "faceset": return "npc";
      case "chipset": return "tile";
      case "backdrop": return "terrain";
      case "monster": return "combat";
      case "battle": return "polish";
      case "battleWeapon": return "combat";
      case "music": return "music";
      case "sound": return "music";
      case "title": case "gameOver": return "image";
      case "picture": return "image";
      case "movie": return "play";
      case "system": case "system2": return "gear";
      default: return "layers";
    }
  };

  const listedProfiles = dedupeListedProfiles(options.profiles, options.uploaded);
  for (const category of options.categories) {
    const selected = category.kind === options.selectedKind && !options.expressionView;
    const countProfiles = listedProfiles.filter(p => p.kind === category.kind && (category.kind !== "faceset" || !isFaceExpressionResource(p.assetId))).length;
    const countUploaded = options.uploaded.filter(u => resourceKindFromUpload(u.kind) === category.kind).length;
    const totalCount = category.kind === "monster" ? monsterTotal : countProfiles + countUploaded;

    const icon = el("span", { class: "rm-category-icon", attrs: { "aria-hidden": "true" }, children: [makeSvgIcon(getCategoryIcon(category.kind))] });
    const labelSpan = el("span", { class: "rm-category-label", text: category.label });
    const badge = el("span", { class: "rm-category-badge", text: String(totalCount) });

    list.append(
      el("button", {
        class: selected ? "rm-category-row active" : "rm-category-row",
        children: [
          el("div", { class: "rm-category-left", children: [icon, labelSpan] }),
          badge
        ],
        attrs: {
          type: "button",
          role: "option",
          "aria-label": category.label,
          "aria-selected": selected ? "true" : "false",
        },
        on: { click: () => options.onSelectKind(category.kind) },
      })
    );
    if (category.kind === "faceset" && options.onSelectExpressions) {
      const active = options.selectedKind === "faceset" && options.expressionView;
      list.append(el("button", {
        class: `rm-category-row rm-expression-category${active ? " active" : ""}`,
        attrs: { type: "button", role: "option", "aria-label": "표정 관리", "aria-selected": String(!!active) },
        dataset: { testid: "resource-category-expressions" },
        children: [el("span", { text: "↳ 표정 관리" }), el("span", { class: "rm-category-badge", text: String(FACE_EXPRESSION_SETS.length) })],
        on: { click: options.onSelectExpressions },
      }));
    }
  }
  return list;
}

/** Bounded pages work for both variable-height grid cards and compact rows. */
export const RESOURCE_GALLERY_PAGE_SIZE = 80;
function resourceEntryList(
  profiles: readonly ResourceProfile[], uploaded: readonly UploadedAsset[], actions: UploadedAssetActions,
  onSelect: (item: ResourceItem) => void, getSelectedItem: () => ResourceItem | null,
  onImport: () => void, selectedKind: ResourceProfile["kind"], recentAssetId?: string,
): HTMLElement {
  const container = el("div", { class: "rm-entry-container rm-modern-gallery-container" });
  const toolbar = el("div", { class: "rm-modern-toolbar" });
  const search = el("input", { class: "rm-search-input rm-modern-search",
    attrs: { type: "search", placeholder: "리소스 검색 (이름, ID)", "aria-label": "리소스 검색" } });
  const pills = el("div", { class: "rm-filter-pills" });
  const list = el("div", { class: "rm-entry-list rm-modern-entry-list", dataset: { testid: "resource-entry-list" } });
  const pager = el("div", { attrs: { "aria-label": "리소스 페이지" } });
  Object.assign(pager.style, { display: "flex", gap: "8px", alignItems: "center", flexShrink: "0" });
  const label = el("span", { attrs: { role: "status" } });
  let page = 0;
  let initial = true;
  let activeNode: HTMLElement | undefined;
  let cleanups: Array<() => void> = [];
  const cleanup = () => { for (const dispose of cleanups) dispose(); cleanups = []; };
  galleryCleanups.set(container, cleanup);
  const sameItem = (a: ResourceItem | null, b: ResourceItem) => a?.type === b.type &&
    (a.type === "uploaded" && b.type === "uploaded" ? a.asset.id === b.asset.id
      : a.type === "profile" && b.type === "profile" && (a.profile === b.profile ||
        (!!a.profile.assetId && a.profile.assetId === b.profile.assetId)));
  const choose = (item: ResourceItem, node: HTMLElement) => {
    if (sameItem(getSelectedItem(), item)) return;
    activeNode?.classList.remove("active"); activeNode?.setAttribute("aria-selected", "false");
    node.classList.add("active"); node.setAttribute("aria-selected", "true"); activeNode = node;
    onSelect(item);
  };
  const previous = el("button", { text: "이전", attrs: { type: "button", "aria-label": "이전 리소스 페이지" },
    dataset: { testid: "resource-page-prev" }, on: { click: () => { page--; renderList(); } } });
  const next = el("button", { text: "다음", attrs: { type: "button", "aria-label": "다음 리소스 페이지" },
    dataset: { testid: "resource-page-next" }, on: { click: () => { page++; renderList(); } } });
  pager.append(previous, label, next);
  if (recentAssetId) currentFilterTab = "all";
  for (const [tab, text, count] of [["all", "전체", profiles.length + uploaded.length],
    ["uploaded", "내 업로드", uploaded.length], ["builtin", "내장", profiles.length]] as const) {
    const pill = el("button", { class: `rm-filter-pill${currentFilterTab === tab ? " active" : ""}`,
      attrs: { type: "button" }, children: [el("span", { text }), el("span", { class: "rm-pill-count", text: String(count) })],
      on: { click: () => { currentFilterTab = tab; page = 0;
        for (const button of pills.children) button.classList.toggle("active", button === pill); renderList(); } } });
    pills.append(pill);
  }
  const toggle = el("div", { class: "rm-view-toggle" });
  for (const [mode, text, name] of [["grid", "⊞", "그리드 뷰"], ["list", "≡", "리스트 뷰"]] as const) {
    const button = el("button", { class: `rm-view-btn${currentViewMode === mode ? " active" : ""}`, text,
      attrs: { type: "button", "aria-label": name }, on: { click: () => {
        currentViewMode = mode; for (const b of toggle.children) b.classList.toggle("active", b === button); renderList();
      } } });
    toggle.append(button);
  }
  toolbar.append(pills, el("div", { class: "rm-modern-search-wrapper", children: [search] }), toggle);
  const all: ResourceItem[] = [...profiles.map(profile => ({ type: "profile" as const, profile })),
    ...uploaded.map(asset => ({ type: "uploaded" as const, asset }))];
  const renderList = () => {
    cleanup(); activeNode = undefined; list.replaceChildren(); list.scrollTop = 0;
    const query = search.value.trim().toLowerCase();
    const filtered = all.filter(item => {
      if (currentFilterTab === "uploaded" && item.type !== "uploaded" || currentFilterTab === "builtin" && item.type !== "profile") return false;
      const name = item.type === "uploaded" ? item.asset.name : item.profile.name;
      const id = item.type === "uploaded" ? item.asset.id : item.profile.assetId;
      return !query || name.toLowerCase().includes(query) || !!id?.toLowerCase().includes(query);
    });
    if (initial && recentAssetId) {
      const index = filtered.findIndex(item => item.type === "uploaded" && item.asset.id === recentAssetId);
      if (index >= 0) page = Math.floor(index / RESOURCE_GALLERY_PAGE_SIZE);
    }
    initial = false; page = Math.max(0, Math.min(page, Math.ceil(filtered.length / RESOURCE_GALLERY_PAGE_SIZE) - 1));
    previous.disabled = page === 0; next.disabled = (page + 1) * RESOURCE_GALLERY_PAGE_SIZE >= filtered.length;
    label.textContent = filtered.length ? `${page * RESOURCE_GALLERY_PAGE_SIZE + 1}–${Math.min((page + 1) * RESOURCE_GALLERY_PAGE_SIZE, filtered.length)} / ${filtered.length}` : "0 / 0";
    if (!filtered.length) {
      list.append(el("div", { class: "rm-gallery-empty", children: [
        el("div", { class: "rm-empty-title", text: query ? "검색 결과가 없습니다" : "등록된 리소스가 없습니다" }),
        el("button", { class: "btn primary rm-empty-cta", text: "새 파일 가져오기", attrs: { type: "button" }, on: { click: onImport } }),
      ] })); return;
    }
    const charset = selectedKind === "charset" || selectedKind === "battleCharset";
    const host = currentViewMode === "grid" ? el("div", { class: charset ? "rm-card-grid rm-charset-row-grid" : "rm-card-grid" }) : list;
    for (const item of filtered.slice(page * RESOURCE_GALLERY_PAGE_SIZE, (page + 1) * RESOURCE_GALLERY_PAGE_SIZE)) {
      const selected = sameItem(getSelectedItem(), item);
      let node: HTMLElement;
      const select = () => choose(item, node);
      if (item.type === "uploaded") node = currentViewMode === "grid"
        ? renderUploadedCard(item.asset, selected, select, item.asset.id === recentAssetId)
        : uploadedAssetRow(item.asset, actions, selected, select, item.asset.id === recentAssetId);
      else node = currentViewMode === "grid" ? (charset
        ? renderCharsetRowCard(item.profile, selected, select, list)
        : renderProfileCard(item.profile, selected, select)) : resourceProfileRow(item.profile, selected, select);
      node.setAttribute("aria-selected", String(selected));
      if (selected) activeNode = node;
      const dispose = charsetCleanups.get(node); if (dispose) cleanups.push(dispose);
      host.append(node);
    }
    if (host !== list) list.append(host);
  };
  search.addEventListener("input", () => { page = 0; renderList(); });
  renderList(); container.append(toolbar, list, pager); return container;
}

/**
 * 캐릭터셋 카드의 걷기 미리보기 시계. **카드당 인터벌 하나**이고, 카드가 DOM 에서 떨어지면 스스로 멈춘다.
 *
 * 왜 (2026-09-25 실측): 예전에는 캐릭터 8칸마다 `setInterval` 을 하나씩 만들고 정리를 `card.addEventListener("remove")`
 * 에 걸어 두었는데, `"remove"` 이벤트를 발화하는 곳이 저장소에 **한 곳도 없다**. 그래서 자원 관리자를 한 번 열면
 * 인터벌 336개가 영구히 남아 3~4.5Hz 로 캔버스를 그렸다(카드 105장 · 닫은 뒤에도 그대로). 목록은 프로젝트/자산
 * 변경마다 다시 그려지므로 렌더마다 누적됐다.
 */
function startCharsetRowTicker(card: HTMLElement, scroller: HTMLElement, draw: (animate: boolean) => void, drawable: HTMLElement = card): () => void {
  let mounted = false, waitedTicks = 0, intersecting = false, disposed = false;
  const motion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : undefined;
  const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.target === drawable) intersecting = entry.isIntersecting;
  }, { root: scroller }) : undefined;
  observer?.observe(drawable);
  const dispose = () => { if (disposed) return; disposed = true; window.clearInterval(timer); observer?.disconnect(); charsetCleanups.delete(card); };
  const timer = window.setInterval(() => {
    if (!card.isConnected) {
      if (!mounted && waitedTicks++ < CHARSET_ROW_ATTACH_TICKS) return;
      dispose(); return;
    }
    mounted = true;
    if (document.hidden || card.closest("[hidden],[aria-hidden='true'],.is-parked")) return;
    const modal = card.closest('[data-testid="resource-modal"]');
    if (modal && hasOpenModalLayer() && !isTopModal(modal)) return;
    if (!observer) {
      const a = drawable.getBoundingClientRect(), b = scroller.getBoundingClientRect();
      intersecting = a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
    }
    if (intersecting) draw(!motion?.matches);
  }, CHARSET_ROW_TICK_MS);
  charsetCleanups.set(card, dispose); return dispose;
}

/** 붙기를 기다리는 최대 톱 수. 이 안에 붙지 않으면 버려진 카드로 보고 시계를 거둔다. */
const CHARSET_ROW_ATTACH_TICKS = 4;

/** 8칸을 한 시계로 돌린다. 예전의 칸별 220~325ms 대신 한 박자로 맞춘다. */
const CHARSET_ROW_TICK_MS = 260;

function renderCharsetRowCard(profile: ResourceProfile, isSelected: boolean, onSelect: () => void, scroller: HTMLElement): HTMLElement {
  const project = store.getCurrent();
  const previewUrl = resolveAssetResourceUrl(profile.assetId, { project });
  const dims = profile.imageWidth && profile.imageHeight ? `${profile.imageWidth}×${profile.imageHeight}` : "";

  const card = el("div", {
    class: isSelected ? "rm-asset-card rm-charset-row-card active" : "rm-asset-card rm-charset-row-card",
    dataset: { testid: `resource-profile-${profile.kind}` },
    on: { click: onSelect },
  });

  const header = el("div", {
    class: "rm-charset-row-header",
    children: [
      el("div", { class: "rm-card-name", text: profile.name, attrs: { title: profile.name } }),
      el("div", { class: "rm-charset-meta", children: [
        el("span", { class: "rm-card-kind", text: "캐릭터 8종 모음" }),
        dims ? el("span", { class: "rm-card-dims font-mono", text: dims }) : null
      ].filter(Boolean) as HTMLElement[] }),
    ],
  });

  const charactersStrip = el("div", { class: "rm-charset-characters-strip" });
  const advanceFns: Array<() => void> = [];
  const drawFns: Array<() => void> = [];
  
  if (previewUrl) {
    const sheetImg = new Image();
    sheetImg.crossOrigin = "anonymous";
    let loading = false;
    let drawn = false;

    // 8 characters in RM2K3 sheet (4 across, 2 down)
    const DIRECTIONS = ["down", "left", "up", "right"] as const;

    for (let charIdx = 0; charIdx < 8; charIdx++) {
      const charBox = el("div", { class: "rm-char-mini-slot", attrs: { title: `캐릭터 #${charIdx + 1}` } });
      const canvas = el("canvas", { class: "rm-char-mini-canvas" }) as HTMLCanvasElement;
      canvas.width = 24;
      canvas.height = 32;
      charBox.append(canvas);

      const charCol = charIdx % 4; // 0..3
      const charRow = Math.floor(charIdx / 4); // 0..1

      let dirIdx = 0;
      let walkPattern = 1;

      const drawFrame = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx || !sheetImg.complete || !sheetImg.naturalWidth) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 24, 32);

        // Direction row inside character (down:0, left:1, right:2, up:3)
        let dirRowOffset = 0;
        if (DIRECTIONS[dirIdx] === "down") dirRowOffset = 0;
        else if (DIRECTIONS[dirIdx] === "left") dirRowOffset = 1;
        else if (DIRECTIONS[dirIdx] === "right") dirRowOffset = 2;
        else if (DIRECTIONS[dirIdx] === "up") dirRowOffset = 3;

        const srcX = (charCol * 3 + (walkPattern % 3)) * 24;
        const srcY = (charRow * 4 + dirRowOffset) * 32;

        ctx.drawImage(sheetImg, srcX, srcY, 24, 32, 0, 0, 24, 32);
      };

      drawFns.push(drawFrame);

      // Continuous 4-direction walk rotation loop
      advanceFns.push(() => {
        walkPattern = (walkPattern + 1) % 3;
        if (walkPattern === 0) {
          dirIdx = (dirIdx + 1) % 4; // rotate direction
        }
        drawFrame();
      });
      charactersStrip.append(charBox);
    }
    startCharsetRowTicker(card, scroller, animate => {
      if (!loading) { loading = true; sheetImg.src = previewUrl; }
      if (!sheetImg.complete || !sheetImg.naturalWidth) return;
      if (!drawn) { for (const draw of drawFns) draw(); drawn = true; }
      else if (animate) for (const advance of advanceFns) advance();
    }, charactersStrip);
  }

  card.append(header, charactersStrip);
  return card;
}
function renderProfileCard(profile: ResourceProfile, isSelected: boolean, onSelect: () => void): HTMLElement {
  const project = store.getCurrent();
  const spec = getResourceProfileSpec(profile.kind);
  const previewUrl = resolveAssetResourceUrl(profile.assetId, { project });
  const isAudio = profile.kind === "music" || profile.kind === "sound";
  const dims = profile.imageWidth && profile.imageHeight ? `${profile.imageWidth}×${profile.imageHeight}` : "";

  const card = el("div", {
    class: isSelected ? "rm-asset-card active" : "rm-asset-card",
    dataset: { testid: `resource-profile-${profile.kind}` },
    on: { click: onSelect },
  });

  const previewBox = el("div", { class: "rm-card-preview-box" });
  if (previewUrl && !isAudio) {
    const img = el("img", {
      class: "rm-card-img",
      attrs: { src: previewUrl, alt: profile.name, loading: "lazy", decoding: "async" },
    }) as HTMLImageElement;
    previewBox.append(img);
  } else if (isAudio) {
    previewBox.append(el("div", { class: "rm-card-audio-icon", text: profile.kind === "music" ? "🎵" : "🔊" }));
  } else {
    previewBox.append(el("div", { class: "rm-card-no-img", text: "미리보기 없음" }));
  }

  const infoBox = el("div", {
    class: "rm-card-info",
    children: [
      el("div", { class: "rm-card-name", text: profile.name, attrs: { title: profile.name } }),
      el("div", { class: "rm-card-meta", children: [
        el("span", { class: "rm-card-kind", text: spec.label }),
        dims ? el("span", { class: "rm-card-dims font-mono", text: dims }) : null
      ].filter(Boolean) as HTMLElement[] }),
    ],
  });

  card.append(previewBox, infoBox);
  return card;
}

function renderUploadedCard(
  asset: UploadedAsset,
  isSelected: boolean,
  onSelect: () => void,
  recent = false
): HTMLElement {
  const dims = asset.meta.width && asset.meta.height ? `${asset.meta.width}×${asset.meta.height}` : "";

  const card = el("div", {
    class: `rm-asset-card uploaded${recent ? " is-recent" : ""}${isSelected ? " active" : ""}`,
    dataset: recent ? { testid: `resource-upload-${asset.id}`, recent: "true" } : { testid: `resource-upload-${asset.id}` },
    on: { click: onSelect },
  });

  const badge = el("span", { class: "rm-card-upload-badge", text: "내 업로드" });

  const previewBox = el("div", { class: "rm-card-preview-box" });
  const previewUrl = uploadedAssetUrl(asset);
  if (previewUrl) {
    const img = el("img", {
      class: "rm-card-img",
      attrs: { src: previewUrl, alt: asset.name, loading: "lazy", decoding: "async" },
    });
    previewBox.append(img);
  }

  const infoBox = el("div", {
    class: "rm-card-info",
    children: [
      el("div", { class: "rm-card-name", text: asset.name, attrs: { title: asset.name } }),
      el("div", { class: "rm-card-meta", children: [
        el("span", { class: "rm-card-kind", text: uploadedResourceKindLabel(asset) }),
        dims ? el("span", { class: "rm-card-dims font-mono", text: dims }) : null
      ].filter(Boolean) as HTMLElement[] }),
    ],
  });

  card.append(badge, previewBox, infoBox);
  return card;
}

function resourceCommandPanel(
  options: ResourceWorkbenchOptions,
  previewWell: HTMLElement,
  _getSelectedItem: () => ResourceItem | null
): HTMLElement {
  const openUrlModal = () => {
    const input = el("input", {
      class: "rm-search-input rm-url-input",
      attrs: {
        type: "url",
        placeholder: "https://example.com/character.png",
        "aria-label": "이미지 또는 오디오 URL",
      },
    }) as HTMLInputElement;

    const backdrop = el("div", {
      class: "database-modal-backdrop rm-url-backdrop",
      children: [
        el("div", {
          class: "database-modal-window rm-url-modal-window",
          children: [
            el("header", {
              class: "database-modal-header",
              children: [
                el("h2", { text: "웹 URL로 리소스 가져오기" }),
                el("button", {
                  class: "database-modal-close",
                  text: "×",
                  attrs: { type: "button", title: "닫기" },
                  on: { click: () => backdrop.remove() },
                }),
              ],
            }),
            el("div", {
              class: "rm-url-modal-body",
              children: [
                el("div", { class: "rm-url-desc", text: "웹 상의 이미지 또는 오디오 파일의 직접 링크 URL을 입력하세요." }),
                input,
                el("div", { class: "rm-url-actions", children: [
                  el("button", {
                    class: "btn",
                    text: "취소",
                    attrs: { type: "button" },
                    on: { click: () => backdrop.remove() },
                  }),
                  el("button", {
                    class: "btn primary",
                    text: "가져오기",
                    attrs: { type: "button" },
                    on: {
                      click: () => {
                        const val = input.value.trim();
                        if (val && options.onImportUrl) {
                          options.onImportUrl(val);
                          backdrop.remove();
                        }
                      },
                    },
                  }),
                ]}),
              ],
            }),
          ],
        }),
      ],
    });

    document.body.append(backdrop);
    input.focus();
  };

  const quickActions = [
    el("button", {
      class: "rm-command-button primary rm-modern-import-btn",
      children: [deckIcon("plus", { size: 15 }), el("span", { text: "가져오기..." })],
      attrs: { type: "button" },
      dataset: { testid: "resource-import-button" },
      on: { click: options.onImport },
    }),
    el("button", {
      class: "rm-command-button rm-action-compact rm-url-btn",
      children: [deckIcon("link", { size: 15 }), el("span", { text: "URL" })],
      attrs: { type: "button", title: "웹 링크로 가져오기" },
      on: { click: openUrlModal },
    }),
  ];
  if (options.selectedKind === "chipset" && options.onBrowseCreatorPage) {
    quickActions.push(el("button", {
      class: "rm-command-button",
      text: "제작자 페이지",
      attrs: { type: "button", title: "제작자 페이지에서 직접 받아 이 프로젝트에만 넣습니다" },
      dataset: { testid: "resource-creator-page" },
      on: { click: options.onBrowseCreatorPage },
    }));
  }
  quickActions.push(el("button", { class: "rm-command-button rm-action-compact", text: "삭제", attrs: { type: "button", disabled: "true" } }));

  return el("aside", {
    class: "rm-command-panel rm-modern-side-panel",
    dataset: { testid: "resource-command-panel" },
    children: [
      el("div", { class: "rm-quick-actions-bar", children: quickActions }),
      previewWell,
      importFormatNote(),
    ],
  });
}
function importFormatNote(): HTMLElement {
  return el("div", {
    class: "rm-import-format rm-modern-drop-card",
    dataset: { testid: "resource-import-format" },
    children: [
      el("div", { class: "rm-import-format-title", text: "가져오기 형식" }),
      el("div", { text: "PNG·JPEG (표준)" }),
      el("div", { text: "WebP·GIF (PNG 첫 프레임으로 자동 변환)" }),
      el("div", { class: "rm-format-tags", children: [
        el("span", { class: "rm-tag", text: "PNG" }),
        el("span", { class: "rm-tag", text: "JPEG" }),
        el("span", { class: "rm-tag", text: "WebP" }),
        el("span", { class: "rm-tag", text: "GIF" }),
        el("span", { class: "rm-tag", text: "MP3" }),
        el("span", { class: "rm-tag", text: "WAV" }),
      ]}),
      el("div", { class: "rm-drop-tip", text: "탐색기에서 파일이나 폴더를 창으로 바로 끌어다 놓아도 됩니다." }),
    ],
  });
}

function uploadedAssetRow(
  asset: UploadedAsset,
  actions: UploadedAssetActions,
  isSelected: boolean,
  onSelect: () => void,
  recent = false
): HTMLElement {
  const row = el("div", {
    class: `rm-asset-row${recent ? " is-recent" : ""}${isSelected ? " active" : ""}`,
    dataset: recent ? { testid: `resource-upload-${asset.id}`, recent: "true" } : { testid: `resource-upload-${asset.id}` },
    on: { click: onSelect },
  });
  const preview = el("img", { attrs: { src: uploadedAssetUrl(asset), alt: `${asset.name} 미리보기`, loading: "lazy", decoding: "async" } }) as HTMLImageElement;
  preview.className = "rm-preview";
  const dims = asset.meta.width && asset.meta.height ? `${asset.meta.width}x${asset.meta.height}px` : "크기 미확인";
  row.append(preview, uploadedAssetInfo(asset, dims));
  if (asset.kind === "chipset" || asset.kind === "tileset") {
    row.append(tilesetActions(asset, actions));
  }
  row.append(el("button", {
    class: "btn danger",
    text: "삭제",
    dataset: { testid: `resource-delete-${asset.id}` },
    on: {
      click: (e) => {
        e.stopPropagation();
        actions.deleteAsset(asset);
      }
    },
  }));
  return row;
}

function uploadedAssetInfo(asset: UploadedAsset, dims: string): HTMLElement {
  return el("div", {
    class: "rm-asset-info",
    children: [
      el("div", { class: "rm-asset-name", text: asset.name }),
      el("div", { class: "rm-asset-kind", text: `${uploadedResourceKindLabel(asset)} · ${asset.id.slice(0, 12)}` }),
      el("div", { class: "rm-asset-dims", text: dims }),
    ],
  });
}

function tilesetActions(asset: UploadedAsset, actions: UploadedAssetActions): HTMLElement {
  return el("div", {
    class: "rm-asset-actions",
    children: [
      el("button", {
        class: "btn",
        text: "타일셋 추가",
        dataset: { testid: `resource-add-tileset-${asset.id}` },
        on: {
          click: (e) => {
            e.stopPropagation();
            actions.addTileset(asset);
          }
        },
      }),
      el("button", {
        class: "btn primary",
        text: "현재 맵에 적용",
        dataset: { testid: `resource-apply-tileset-${asset.id}` },
        on: {
          click: (e) => {
            e.stopPropagation();
            actions.applyTileset(asset);
          }
        },
      }),
    ],
  });
}

function renderInspector(
  container: HTMLElement,
  item: ResourceItem | null,
  currentKind: ResourceProfile["kind"],
  actions?: UploadedAssetActions
): void {
  container.innerHTML = "";
  const project = store.getCurrent();

  if (!item) {
    container.append(
      el("div", {
        class: "rm-inspector-empty",
        children: [
          el("div", { class: "rm-inspector-empty-icon", text: "🎨" }),
          el("div", { class: "rm-inspector-empty-text", text: "에셋을 선택하면 고해상도 프리뷰와 메타데이터가 표시됩니다." }),
        ],
      })
    );
    return;
  }

  const isUploaded = item.type === "uploaded";
  const name = isUploaded ? item.asset.name : item.profile.name;
  const kind = isUploaded ? (resourceKindFromUpload(item.asset.kind) ?? currentKind) : item.profile.kind;
  const spec = getResourceProfileSpec(kind);
  const resourceId = isUploaded ? item.asset.id : item.profile.assetId;
  const monsterResource = kind === "monster" && resourceId !== undefined
    ? monsterCatalog(project).byId.get(resourceId)
    : undefined;

  let previewUrl = "";
  let dimensions = "";
  if (isUploaded) {
    previewUrl = uploadedAssetUrl(item.asset);
    if (item.asset.meta.width && item.asset.meta.height) {
      dimensions = `${item.asset.meta.width} × ${item.asset.meta.height} px`;
    }
  } else {
    previewUrl = resolveAssetResourceUrl(item.profile.assetId, { project }) ?? "";
    if (item.profile.imageWidth && item.profile.imageHeight) {
      dimensions = `${item.profile.imageWidth} × ${item.profile.imageHeight} px`;
    }
  }

  const header = el("div", {
    class: "rm-inspector-header",
    children: [
      el("div", { class: "rm-inspector-title", text: name, attrs: { title: name } }),
      el("div", { class: isUploaded ? "rm-inspector-badge upload" : "rm-inspector-badge builtin", text: isUploaded ? "내 업로드" : "내장 리소스" }),
    ],
  });

  const previewContainer = el("div", { class: "rm-inspector-preview-box" });
  if (previewUrl) {
    const img = el("img", {
      class: "rm-inspector-img",
      attrs: { src: previewUrl, alt: name },
    });
    previewContainer.append(img);
  } else {
    previewContainer.append(el("div", { class: "rm-inspector-no-img", text: "미리보기 이미지 없음" }));
  }

  const metaList = el("div", {
    class: "rm-inspector-meta-list",
    children: [
      el("div", { class: "rm-inspector-meta-row", children: [
        el("span", { class: "rm-meta-label", text: "분류" }),
        el("span", { class: "rm-meta-val", text: spec.label }),
      ]}),
      dimensions ? el("div", { class: "rm-inspector-meta-row", children: [
        el("span", { class: "rm-meta-label", text: "해상도" }),
        el("span", { class: "rm-meta-val font-mono", text: dimensions }),
      ]}) : null,
      el("div", { class: "rm-inspector-meta-row", children: [
        el("span", { class: "rm-meta-label", text: "에셋 ID" }),
        el("span", { class: "rm-meta-val font-mono", text: resourceId }),
      ]}),
      ...(monsterResource === undefined ? [] : [
        el("div", { class: "rm-inspector-meta-row", children: [
          el("span", { class: "rm-meta-label", text: "상태" }),
          el("span", { class: "rm-meta-val", text: monsterResourceStatus(monsterResource) }),
        ]}),
        ...(monsterResource.tags.length > 0 ? [el("div", { class: "rm-inspector-meta-row", children: [
          el("span", { class: "rm-meta-label", text: "태그" }),
          el("span", { class: "rm-meta-val", text: monsterResource.tags.join(" · "), attrs: { title: monsterResource.tags.join(" · ") } }),
        ]})] : []),
        ...(monsterResource.description.length > 0 ? [el("div", { class: "rm-inspector-meta-row", children: [
          el("span", { class: "rm-meta-label", text: "설명" }),
          el("span", { class: "rm-meta-val", text: monsterResource.description, attrs: { title: monsterResource.description } }),
        ]})] : []),
      ]),
    ].filter(Boolean) as HTMLElement[],
  });

  const actionBox = el("div", { class: "rm-inspector-actions" });
  if (isUploaded && actions) {
    if (kind === "chipset") {
      actionBox.append(
        el("button", {
          class: "btn primary rm-action-btn",
          text: "🗺️ 현재 맵에 적용",
          attrs: { type: "button" },
          on: { click: () => actions.applyTileset(item.asset) }
        }),
        el("button", {
          class: "btn rm-action-btn",
          text: "타일셋 등록",
          attrs: { type: "button" },
          on: { click: () => actions.addTileset(item.asset) }
        })
      );
    }
    actionBox.append(
      el("button", {
        class: "btn danger rm-action-btn",
        text: "🗑️ 리소스 삭제",
        attrs: { type: "button" },
        on: { click: () => actions.deleteAsset(item.asset) }
      })
    );
  }

  container.append(header, previewContainer, metaList, actionBox);
}
