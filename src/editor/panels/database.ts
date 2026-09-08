import { renderGrowthTreeTab } from "@/editor/panels/growthTree/studio";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { getEditorChrome } from "@/editor/editorUiMode";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { renderCharactersTab } from "@/editor/panels/databaseCharacterView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { renderDailyWeatherTab } from "@/editor/panels/databaseDailyWeatherView";
import { renderFarmAnimalsTab } from "@/editor/panels/databaseFarmAnimalsView";
import { renderFarmSpatialTab } from "@/editor/panels/databaseFarmSpatialView";
import { renderFactionsTab } from "@/editor/panels/databaseFactionView";
import { renderLifeCollectionsTab } from "@/editor/panels/databaseLifeCollectionsView";
import { renderInventoryCatalog } from "@/editor/panels/databaseInventoryCatalog";
import { inventoryCatalogSession, setSearchQueryForCollection } from "@/editor/panels/databaseRecordViewSession";
import { renderRecordTab } from "@/editor/panels/databaseRecordViews";
import { disposeAnimationPreviewsIn } from "@/editor/panels/databaseAnimationPreview";
import {
  resumeSkillAnimationStagesIn,
  stopSkillAnimationStagesIn,
} from "@/editor/panels/databaseSkillAnimationStage";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { renderVillageTab } from "@/editor/panels/databaseVillageView";
import {
  renderSwitchesTab,
  renderTermsTab,
  renderVariablesTab,
} from "@/editor/panels/databaseUtilityViews";
import {
  renderBattleCommandsTab,
  renderBattleScreenTab,
  renderElementsTab,
  renderTerrainTab,
} from "@/editor/panels/databaseUtilityRecordViews";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import { renderStructureKitsTab } from "@/editor/panels/structureKitDbTab";
import { applyTilesetFolderFacet, setTilesetFolderTabRequestHandler } from "@/editor/panels/tilesetMetadataEditor";
import { getSelectedTilesetId, renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { renderScratchConceptTab } from "@/editor/panels/scratchConceptTab";
import { interiorRoomKindCount, renderTilesetSpacesTab } from "@/editor/panels/tilesetSpacesTab";
import { listUnlabeledTileIds } from "@/editor/panels/tilesetMetadataControls";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { renderWorldCodexTab } from "@/editor/panels/databaseWorldCodexView";
import { renderWorldGenTab, resetWorldGenTabViewState } from "@/editor/panels/databaseWorldGenView";
import { worldCanonHasContent } from "@/project/world/canon";
import {} from "@/editor/uiCopy";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { BUILTIN_WORLD_GEN_KEYWORD_RULES } from "@/project/worldGenRules";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export type DatabaseTab =
  | "promotionTree"
  | "skillTrees"
  | "overview"
  | DatabaseCollection
  | "animations"
  | "battleCommands"
  | "battleScreen"
  | "commonEvents"
  | "characters"
  | "crops"
  | "lifeCrafting"
  | "dailyWeather"
  | "farmAnimals"
  | "farmSpatial"
  | "factions"
  | "lifeCollections"
  | "elements"
  | "monsterSpecies"
  | "structureKits"
  | "tilesetAutotile"
  | "tilesetUnlabeled"
  | "tilesetSpaces"
  | "scratchConcepts"
  | "system"
  | "terms"
  | "terrain"
  | "villages"
  | "switches"
  | "tilesets"
  | "variables"
  | "worldCanon"
  | "worldCodex"
  | "worldGen";

const tabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = [
  { id: "overview", label: "개요", testid: "db-tab-overview" },
  { id: "elements", label: "속성", testid: "db-tab-elements" },
  { id: "terrain", label: "지형 효과", testid: "db-tab-terrain" },
  { id: "battleScreen", label: "전투 화면", testid: "db-tab-battle-screen" },
  { id: "battleCommands", label: "전투 명령", testid: "db-tab-battle-commands" },
  { id: "actors", label: "주인공", testid: "db-tab-actors" },
  { id: "promotionTree", label: "직업 승급 트리", testid: "db-tab-promotion-tree" },
  { id: "skillTrees", label: "스킬 트리", testid: "db-tab-skill-trees" },
  { id: "classes", label: "직업", testid: "db-tab-classes" },
  { id: "skills", label: "스킬", testid: "db-tab-skills" },
  { id: "items", label: "아이템·장비", testid: "db-tab-items" },
  { id: "crops", label: "농사·작물", testid: "db-tab-crops" },
  { id: "characters", label: "주민 관계", testid: "db-tab-characters" },
  { id: "lifeCrafting", label: "생활 기술·제작", testid: "db-tab-life-crafting" },
  { id: "dailyWeather", label: "계절·날씨", testid: "db-tab-daily-weather" },
  { id: "farmAnimals", label: "동물·축사", testid: "db-tab-farm-animals" },
  { id: "farmSpatial", label: "농장 건물·집 꾸미기", testid: "db-tab-farm-spatial" },
  { id: "lifeCollections", label: "낚시·채집·박물관", testid: "db-tab-life-collections" },
  { id: "enemies", label: "몬스터", testid: "db-tab-enemies" },
  { id: "monsterSpecies", label: "몬스터 종족", testid: "db-tab-monster-species" },
  { id: "troops", label: "적 그룹", testid: "db-tab-troops" },
  { id: "factions", label: "진영", testid: "db-tab-factions" },
  { id: "states", label: "상태", testid: "db-tab-states" },
  { id: "animations", label: "전투 애니메이션", testid: "db-tab-animations" },
  { id: "tilesets", label: "통행", testid: "db-tab-tilesets" },
  { id: "tilesetAutotile", label: "오토타일 설정", testid: "db-tab-tileset-autotile" },
  { id: "tilesetUnlabeled", label: "미분류 모아보기", testid: "db-tab-tileset-unlabeled" },
  { id: "worldCanon", label: "세계 개요", testid: "db-tab-world-canon" },
  { id: "worldCodex", label: "설정집", testid: "db-tab-world-codex" },
  { id: "worldGen", label: "생성 규칙", testid: "db-tab-world-gen" },
  { id: "structureKits", label: "구조물", testid: "db-tab-structure-kits" },
  { id: "tilesetSpaces", label: "공간 종류", testid: "db-tab-tileset-spaces" },
  { id: "scratchConcepts", label: "개념 꾸러미", testid: "db-tab-scratch-concepts" },
  { id: "villages", label: "마을", testid: "db-tab-villages" },
  { id: "commonEvents", label: "공용 이벤트", testid: "db-tab-common-events" },
  { id: "system", label: "시스템", testid: "db-tab-system" },
  { id: "terms", label: "용어", testid: "db-tab-terms" },
  { id: "switches", label: "스위치", testid: "db-tab-switches" },
  { id: "variables", label: "변수", testid: "db-tab-variables" },
];

export type DatabaseTabGroup = {
  readonly label: string;
  readonly slug: string;
  readonly tabs: readonly DatabaseTab[];
};

// 사이드바 그룹 라벨/순서만 정의한다 — 탭 id는 tabs 레지스트리에서 역참조하므로
// 라벨·testid는 여기서 중복 정의하지 않는다.
//
// 이 배열이 레일 순서의 **유일한** 출처다. 전에는 `tabOrder` 가 손으로 쓴 두 번째 순서였고
// 둘이 이미 어긋나 있었다(`terrain` 이 tabOrder 에선 battleCommands 뒤, TAB_GROUPS 에선
// 전투 그룹 끝). 한쪽만 고치면 조용히 다시 갈라지므로 파생으로 묶는다.
export const TAB_GROUPS: readonly DatabaseTabGroup[] = [
  { label: "세계관", slug: "lore", tabs: ["worldCanon", "worldCodex"] },
  { label: "파티", slug: "party", tabs: ["actors", "classes", "promotionTree", "skills", "skillTrees", "items"] },
  { label: "몬스터", slug: "monster", tabs: ["enemies", "monsterSpecies", "troops", "factions"] },
  {
    label: "전투 규칙",
    slug: "battle",
    tabs: ["elements", "states", "animations", "battleScreen", "battleCommands"],
  },
  { label: "생활", slug: "life", tabs: ["crops", "characters", "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial", "lifeCollections"] },
  // 지형은 전투 데이터가 아니라 맵 데이터다 — 타일셋·구조물과 같은 그룹에 둔다.
  { label: "맵", slug: "world", tabs: ["worldGen", "tilesets", "tilesetAutotile", "tilesetUnlabeled", "structureKits", "tilesetSpaces", "scratchConcepts", "villages", "terrain", "commonEvents"] },
  { label: "시스템", slug: "system", tabs: ["system", "terms", "switches", "variables"] },
];

/** 세계 그룹 안에서 타일셋 폴더로 묶는 자식 탭 — 통행·오토타일·미분류·구조물·공간 종류·개념 꾸러미. */
export const TILESET_FOLDER_TAB_IDS: readonly DatabaseTab[] = [
  "tilesets",
  "tilesetAutotile",
  "tilesetUnlabeled",
  "structureKits",
  "tilesetSpaces",
  "scratchConcepts",
];

function isTilesetFolderTab(id: DatabaseTab): boolean {
  return (TILESET_FOLDER_TAB_IDS as readonly string[]).includes(id);
}

// 개요는 그룹 밖에 고정되므로 앞에 붙인다.
const tabOrder: readonly DatabaseTab[] = ["overview", ...TAB_GROUPS.flatMap((group) => group.tabs)];

const orderedTabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = tabOrder.map(tabFor);
function groupForTab(id: DatabaseTab): DatabaseTabGroup | undefined {
  return TAB_GROUPS.find((group) => group.tabs.includes(id));
}

// 접힘 상태는 첫 렌더에서 읽는다 — 모듈 로드 시점에는 window 가 아직 없을 수 있다.
let collapsedGroups: Set<string> | null = null;

function collapsedGroupSlugs(): Set<string> {
  if (collapsedGroups) return collapsedGroups;
  const stored = readStoredCollapsedGroups();
  collapsedGroups = stored ?? defaultCollapsedGroups();
  return collapsedGroups;
}

/** 저장된 접힘 상태. 그룹 구성이 바뀌면(`전투·몬스터` 분할, `map`→`world` 개명) 예전 배열은
 *  더 이상 아코디언 불변식을 만족하지 않는다 — 새 slug 가 집합에 없으니 펼쳐진 채로 렌더되어
 *  두 그룹이 동시에 열리고 레일이 다시 스크롤된다. 그래서 죽은 slug 를 버리고, 남은 상태가
 *  "한 그룹만 열림" 을 깨면 저장값을 폐기해 기본값으로 떨어진다. 테스트는 빈 스토리지에서
 *  시작하므로 이 경로는 오래된 사용자만 밟는다. */
function readStoredCollapsedGroups(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(DATABASE_COLLAPSED_GROUPS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const known = new Set(TAB_GROUPS.map((group) => group.slug));
    const collapsed = new Set(
      parsed.filter((slug): slug is string => typeof slug === "string" && known.has(slug)),
    );
    // `> 1` 이다 — 전부 접힌 상태는 사용자가 실제로 만들 수 있는 정당한 상태이므로 보존한다.
    if (TAB_GROUPS.length - collapsed.size > 1) return null;
    return collapsed;
  } catch {
    return null;
  }
}

/** 처음 열 때는 한 그룹만 펼친다 — 29개를 한 줄로 쏟지 않는다. 개요처럼 그룹에
 *  속하지 않은 탭이 활성이면 첫 그룹을 연다(전부 접으면 레일이 헤더만 남는다). */
function defaultCollapsedGroups(): Set<string> {
  const openSlug = groupForTab(activeTab)?.slug ?? TAB_GROUPS[0]?.slug;
  return new Set(TAB_GROUPS.filter((group) => group.slug !== openSlug).map((group) => group.slug));
}

function persistCollapsedGroups(): void {
  try {
    window.localStorage.setItem(DATABASE_COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroupSlugs()]));
  } catch {
    // 저장 실패해도 이번 세션의 접힘 상태는 메모리에 남는다.
  }
}

function railChildren(header: HTMLElement): HTMLElement[] {
  return Array.from(header.children) as HTMLElement[];
}

function applyGroupCollapse(header: HTMLElement): void {
  const collapsed = collapsedGroupSlugs();
  let hidden = false;
  for (const child of railChildren(header)) {
    const classes = child.classList;
    if (!classes) continue;
    if (classes.contains("db-tab-group")) {
      hidden = collapsed.has(child.dataset.groupSlug ?? "");
      child.setAttribute("aria-expanded", String(!hidden));
      // 접힌 그룹은 자식 탭 버튼을 전부 가리므로, 핸드리지 이름만 남으면 안에 무엇이 들었는지
      // 알 수가 없다. 상태 전이가 37개인데 한 그룹만 열리므로 보이는 것은 6개라 — 쓰는 사람은
      // «구조물» 같은 탭이 사라진 줄 알게 된다(사용자 실제 보고, 2026-08-30).
      // 그래서 접힌 동안에만 속한 탭 이름을 부제로 보여 어디를 눌러야 하는지 답해 준다.
      const slug = child.dataset.groupSlug ?? "";
      const group = TAB_GROUPS.find((candidate) => candidate.slug === slug);
      const hint = child.querySelector<HTMLElement>(".db-tab-group-peek");
      if (group) {
        const names = groupPeekNames(group).join("·");
        if (hint) {
          hint.textContent = hidden ? names : "";
          hint.hidden = !hidden;
        }
        child.setAttribute(
          "title",
          hidden ? `${group.label} 그룹 펼치기 — ${names}` : `${group.label} 그룹 접기`,
        );
      }
      continue;
    }
    if (classes.contains("db-tab-folder")) {
      child.hidden = hidden;
      continue;
    }
    if (!classes.contains("db-tab")) continue;
    child.hidden = hidden;
  }
}

/** 아코디언: 한 그룹만 펼친다. 두세 그룹이 동시에 열리면 레일이 다시 스크롤된다. */
function openOnlyGroup(slug: string): void {
  const collapsed = collapsedGroupSlugs();
  collapsed.clear();
  for (const group of TAB_GROUPS) if (group.slug !== slug) collapsed.add(group.slug);
}

function expandGroupFor(header: HTMLElement, id: DatabaseTab): void {
  const slug = groupForTab(id)?.slug;
  if (!slug) return;
  const collapsed = collapsedGroupSlugs();
  const alreadyOpenAlone = !collapsed.has(slug) && collapsed.size === TAB_GROUPS.length - 1;
  if (alreadyOpenAlone) return;
  openOnlyGroup(slug);
  persistCollapsedGroups();
  applyGroupCollapse(header);
}

function tabFor(id: DatabaseTab): { readonly id: DatabaseTab; readonly label: string; readonly testid: string } {
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) throw new Error(`Missing database tab metadata: ${id}`);
  return tab;
}

const DATABASE_ACTIVE_TAB_KEY = "oprn:database.activeTab";
const DATABASE_COLLAPSED_GROUPS_KEY = "oprn:database.collapsedTabGroups";

let activeTab: DatabaseTab = readStoredActiveTab();

type DatabaseTabRenderCache = {
  readonly project: Project;
  readonly views: Map<DatabaseTab, readonly Node[]>;
};

// Each mounted Database panel owns detached DOM for tabs it has already rendered.
// ProjectStore replaces the Project object on every mutation, which gives the cache
// a cheap and exact invalidation boundary without hashing large database records.
const tabRenderCaches = new WeakMap<HTMLElement, DatabaseTabRenderCache>();

// 활성 탭 구독 — 모달 헤더의 현재 위치(그룹 › 탭) 표시처럼 레일 밖에서 활성 탭을 따라가야
// 하는 표면용. DOM 이벤트 대신 순수 Set 인 이유: fake DOM 테스트에는 `document.dispatchEvent`
// 가 없고, 구독자는 어차피 이 모듈 안의 setter 한 곳만 알면 된다.
const activeTabListeners = new Set<(tab: DatabaseTab) => void>();

export function subscribeDatabaseActiveTab(listener: (tab: DatabaseTab) => void): () => void {
  activeTabListeners.add(listener);
  return () => {
    activeTabListeners.delete(listener);
  };
}

export function setDatabaseActiveTab(tab: DatabaseTab): void {
  if (tab === "equipment") {
    const catalog = inventoryCatalogSession();
    catalog.collection = "equipment";
    catalog.filter = "equipment";
    catalog.subtype = "all";
    setSearchQueryForCollection("items", "");
  }
  activeTab = tab === "equipment" ? "items" : tab;
  if (typeof window !== "undefined") window.localStorage.setItem(DATABASE_ACTIVE_TAB_KEY, activeTab);
  for (const listener of activeTabListeners) listener(activeTab);
}

/** 탭이 속한 사이드바 그룹 라벨. 개요처럼 그룹 밖 탭은 undefined. */
export function databaseTabGroupLabel(tab: DatabaseTab): string | undefined {
  return groupForTab(tab === "equipment" ? "items" : tab)?.label;
}
export function switchDatabaseActiveTab(tab: DatabaseTab, panelRoot: HTMLElement): void {
  if (tab === "worldGen" && activeTab !== tab) resetWorldGenTabViewState();
  setDatabaseActiveTab(tab);
  const header = panelRoot.querySelector(".db-tabs");
  if (header instanceof HTMLElement) updateTabButtons(header);
  // panelRoot must be the modal host passed to renderDatabasePanel (e.g. .database-modal-body),
  // not the inner .db-body alone — refreshDatabasePanel looks up .db-body under the host.
  refreshDatabasePanel(panelRoot);
}

export function getDatabaseActiveTab(): DatabaseTab {
  return activeTab;
}

export function databaseTabLabel(tab: DatabaseTab): string {
  return tabs.find((entry) => entry.id === (tab === "equipment" ? "items" : tab))?.label ?? tab;
}

export function renderDatabasePanel(container: HTMLElement): void {
  const cache = tabRenderCaches.get(container);
  if (cache) for (const tab of cache.views.keys()) evictDatabaseTabView(cache, tab);
  clearChildren(container);
  tabRenderCaches.delete(container);
  resetWorldGenTabViewState();
  // 타일셋 섹션 탭(타일 규칙·타일 지식·구성)과 좌측 폴더 자식(통행·미분류·오토타일)은 같은 것을
  // 가리키는 두 내비게이션이다. 섹션 탭을 누르면 좌측 선택도 따라오게 연결한다.
  setTilesetFolderTabRequestHandler((tab) => {
    if (!isDatabaseTab(tab)) return false;
    // 이전 패널이 남긴 핸들러가 떨어져 나간 컨테이너를 가리킬 수 있다 — 붙어 있을 때만 옮긴다.
    if (typeof document !== "undefined" && typeof document.contains === "function" && !document.contains(container)) return false;
    switchDatabaseActiveTab(tab, container);
    return true;
  });
  const header = el("div", { class: "db-tabs" });
  const body = el("div", {
    class: "db-body db-shared-workspace",
    dataset: { testid: "db-shared-workspace" },
  });
  // 버튼의 testid/라벨/.active 토글 계약(G006 + databaseCrossTabNav)은 모드와 무관하게 유지한다.
  const chrome = getEditorChrome();
  if (chrome.databaseNav === "grouped") {
    appendTabSearch(header);
    appendTabButton(header, body, container, tabFor("overview"));
    for (const group of TAB_GROUPS) {
      const groupCount = groupRecordCount(group);
      header.append(el("div", {
        class: "db-tab-group",
        // 접힌 그룹은 라벨 한 낱말만 남는다 — 「마을」이 「세계」 안에 있다는 걸 알 길이
        // 탭 검색뿐이었다(사용자 실제 보고: 구조물이 사라진 줄 알았다). 세 갈래로 답한다.
        //  1) 눈에 보이는 부제(.db-tab-group-peek) — hover 없이 읽힌다.
        //  2) 툴팁 — 마우스로도 닿는다.
        //  3) 탭 수 배지 — 안에 몇 개가 접혀 있는지 센다.
        attrs: { title: `${group.label} 그룹 펼치기/접기 — ${groupTabLabels(group)}` },
        dataset: {
          testid: `db-tab-group-${group.slug}`,
          groupSlug: group.slug,
          // 배지는 탭과 같은 규칙(0 은 표시하지 않음).
          ...(groupCount > 0 ? { tabCount: String(groupCount) } : {}),
        },
        children: [
          // 라벨을 **별도 span 으로** 둔다. 헤더 textContent 를 그대로 비교하는 계약이 있어
          // (databaseNavMode·db-desktop-matrix) 부제를 헤더에 직접 넣으면 그 계약이 깨진다 —
          // 실제로 깼다(02afd56f). 계약은 .db-tab-group-label 을 보도록 함께 고쳤다.
          el("span", { class: "db-tab-group-label", text: group.label }),
          // 접혀 있을 때 applyGroupCollapse 가 여기에 속한 탭 이름을 쓴다.
          el("span", { class: "db-tab-group-peek", attrs: { hidden: "" } }),
        ],
        on: {
          click: () => {
            const collapsed = collapsedGroupSlugs();
            if (collapsed.has(group.slug)) openOnlyGroup(group.slug);
            else collapsed.add(group.slug);
            persistCollapsedGroups();
            applyGroupCollapse(header);
          },
        },
      }));
      let folderEmitted = false;
      for (const id of group.tabs) {
        if (chrome.databaseNav === "grouped" && isTilesetFolderTab(id)) {
          if (!folderEmitted) {
            appendTilesetFolder(header, body, container);
            folderEmitted = true;
          }
          continue;
        }
        appendTabButton(header, body, container, tabFor(id));
      }
    }
    applyGroupCollapse(header);
  } else {
    appendTabSearch(header);
    for (const tab of orderedTabs) appendTabButton(header, body, container, tab);
  }

  renderActiveTab(body, container);
  container.append(header, body);
  revealActiveTab(header);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => revealActiveTab(header));
    observer.observe(header);
  }
}

// 이미 마운트된 패널을 부분 갱신한다(본문만 다시 그림). undo/redo 재렌더 경로용.
export function refreshDatabasePanel(container: HTMLElement): void {
  const body = container.querySelector(".db-body");
  if (body instanceof HTMLElement) {
    renderActiveTab(body, container, { forceFresh: true });
    refreshTabCounts(container);
    return;
  }
  renderDatabasePanel(container);
}

// 사이드바 탭의 레코드 카운트 — 컬렉션이 아닌 탭(개요/시스템/용어 등)은 null.
// data-count 어트리뷰트로만 노출한다(버튼 textContent 는 라벨 계약 유지 — G006).
function databaseTabCount(tab: DatabaseTab): number | null {
  const project = store.getCurrent();
  const database = project.database;
  switch (tab) {
    case "promotionTree":
      return database.classes.length;
    case "skillTrees":
      return project.growth?.skillTrees.length ?? 0;
    case "actors":
    case "classes":
    case "skills":
    case "equipment":
    case "enemies":
    case "troops":
    case "states":
      return database[tab].length;
    case "items":
      return database.items.length + database.equipment.length;
    case "animations":
      return database.battleAnimations.length;
    case "monsterSpecies":
      return database.monsterSpecies?.length ?? 0;
    case "crops":
      return database.crops?.length ?? 0;
    case "characters":
      return Object.keys(project.characters ?? {}).length;
    case "lifeCrafting":
      return (database.lifeSkills?.length ?? 0)
        + (project.system.craftRecipes?.length ?? 0)
        + (project.system.itemUpgrades?.length ?? 0)
        + (project.system.sellPrices?.length ?? 0)
        + (project.system.toolActions?.length ?? 0)
        + (project.system.energy ? 1 : 0)
        + (project.system.shipping ? 1 : 0)
        + (project.system.worldUnlocks?.length ?? 0)
        + (project.system.bundles?.length ?? 0)
        + (project.system.makers?.length ?? 0);
    case "dailyWeather":
      return Object.values(project.system.dailyWeather?.seasons ?? {}).reduce((sum, rules) => sum + (rules?.length ?? 0), 0);
    case "farmAnimals":
      return (database.farmAnimalSpecies?.length ?? 0)
        + (project.system.farmAnimalBuildings?.length ?? 0)
        + (project.session.farmAnimals?.length ?? 0);
    case "farmSpatial":
      return (database.farmBuildingTypes?.length ?? 0)
        + (database.homeDecorationTypes?.length ?? 0)
        + (project.session.farmBuildingPlacements?.length ?? 0)
        + (project.session.homeDecorationPlacements?.length ?? 0);
    case "lifeCollections":
      return (database.fishSpecies?.length ?? 0)
        + (project.system.fishing?.spots.length ?? 0)
        + (project.system.seasonalForage?.areas.length ?? 0)
        + (project.system.museum?.rewards.length ?? 0);
    case "switches":
      return project.switches.filter((record) => record.name.trim().length > 0).length;
    case "variables":
      return project.variables.filter((record) => record.name.trim().length > 0).length;
    case "commonEvents":
      return project.commonEvents.length;
    case "factions":
      return 2 + new Set((project.factions?.defs ?? [])
        .map((def) => def.id)
        .filter((id) => id !== PLAYER_FACTION_ID && id !== DEFAULT_ENEMY_FACTION_ID)).size;
    case "tilesets":
      return Object.keys(project.tilesets).length;
    case "tilesetAutotile": {
      const tileset = project.tilesets[getSelectedTilesetId() ?? ""];
      return tileset?.autotileGroups?.length ?? 0;
    }
    case "tilesetUnlabeled": {
      const tileset = project.tilesets[getSelectedTilesetId() ?? ""];
      return tileset ? listUnlabeledTileIds(tileset).length : 0;
    }
    case "tilesetSpaces": {
      const tileset = project.tilesets[getSelectedTilesetId() ?? ""];
      return interiorRoomKindCount(tileset);
    }
    case "scratchConcepts": {
      const tileset = project.tilesets[getSelectedTilesetId() ?? ""];
      return tileset?.scratchConceptBundles?.length ?? 0;
    }
    case "worldCanon":
      return worldCanonHasContent(project.worldCanon) ? 1 : 0;
    case "worldCodex":
      return project.world?.entities.length ?? 0;
    case "worldGen": {
      const builtinIds = new Set(BUILTIN_WORLD_GEN_KEYWORD_RULES.map((rule) => rule.id));
      return (project.system.worldGen?.keywords ?? []).filter((rule) => !builtinIds.has(rule.id)).length;
    }
    case "structureKits":
      return Object.values(project.tilesets).reduce(
        (sum, tileset) => sum + (tileset.structureKits?.length ?? 0),
        0,
      );
    case "villages":
      // 내장 34종은 세지 않는다 — 배지는 "사용자가 저작한 것" 만 센다.
      return (project.villageTemplates?.length ?? 0) + (project.villagePresets?.length ?? 0);
    default:
      return null;
  }
}

/** 그룹 헤더에 실을 합계. 컬렉션이 아닌 탭(개요/시스템 등)은 null 이므로 0 으로 센다. */
function groupRecordCount(group: DatabaseTabGroup): number {
  return group.tabs.reduce((sum, id) => sum + (databaseTabCount(id) ?? 0), 0);
}

/** 접힌 그룹 부제·툴팁에 쓸 이름. 세계는 다섯 타일셋 면을 「타일셋」 한 낱말로 접는다. */
function groupPeekNames(group: DatabaseTabGroup): string[] {
  if (group.slug !== "world") return group.tabs.map((id) => tabFor(id).label);
  const names: string[] = [];
  let folderEmitted = false;
  for (const id of group.tabs) {
    if (isTilesetFolderTab(id)) {
      if (!folderEmitted) {
        names.push("타일셋");
        folderEmitted = true;
      }
      continue;
    }
    names.push(tabFor(id).label);
  }
  return names;
}

function groupTabLabels(group: DatabaseTabGroup): string {
  return groupPeekNames(group).join(", ");
}

function refreshTabCounts(container: HTMLElement): void {
  const header = container.querySelector(".db-tabs");
  if (!(header instanceof HTMLElement)) return;
  for (const button of Array.from(header.querySelectorAll(".db-tab"))) {
    if (!(button instanceof HTMLElement)) continue;
    const tab = orderedTabs.find((entry) => entry.testid === button.dataset.testid);
    if (!tab) continue;
    const count = databaseTabCount(tab.id);
    if (count === null || count === 0) delete button.dataset.count;
    else button.dataset.count = String(count);
  }
  // 그룹 배지도 같이 갱신한다 — 안 하면 접힌 그룹이 undo/redo 뒤에도 옛 합계를 들고 있다.
  for (const node of Array.from(header.querySelectorAll(".db-tab-group"))) {
    if (!(node instanceof HTMLElement)) continue;
    const group = TAB_GROUPS.find((entry) => entry.slug === node.dataset.groupSlug);
    if (!group) continue;
    const count = groupRecordCount(group);
    if (count === 0) delete node.dataset.tabCount;
    else node.dataset.tabCount = String(count);
  }
}

// 사이드바 상단 탭 검색 — 라벨 부분 일치로 탭을 거르고, 매치가 없는 그룹 라벨은
// 함께 숨긴다. DOM 계약(직계 자식 button.db-tab)은 유지 — hidden 토글만 한다.
function appendTabSearch(header: HTMLElement): void {
  const input = el("input", {
    class: "db-tab-search",
    attrs: { type: "search", placeholder: "탭 검색", title: "탭 검색", "aria-label": "탭 검색" },
    dataset: { testid: "db-tab-search" },
    on: { input: () => applyTabFilter(header, input.value) },
  });
  header.append(input);
}

function applyTabFilter(header: HTMLElement, rawQuery: string): void {
  const query = rawQuery.trim().toLowerCase();
  if (query === "") {
    for (const child of railChildren(header)) child.hidden = false;
    applyGroupCollapse(header);
    syncTabSearchEmptyNotice(header, rawQuery);
    return;
  }
  let currentGroup: HTMLElement | null = null;
  let groupHasMatch = false;
  let folderEl: HTMLElement | null = null;
  let folderNameMatched = false;
  const closeGroup = (): void => {
    if (currentGroup) currentGroup.hidden = query !== "" && !groupHasMatch;
  };
  for (const child of Array.from(header.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains("db-tab-group")) {
      closeGroup();
      currentGroup = child;
      groupHasMatch = false;
      folderEl = null;
      folderNameMatched = false;
      continue;
    }
    if (child.classList.contains("db-tab-folder")) {
      folderEl = child;
      folderNameMatched = (child.textContent ?? "").toLowerCase().includes(query);
      child.hidden = !folderNameMatched;
      if (folderNameMatched) groupHasMatch = true;
      continue;
    }
    if (!child.classList.contains("db-tab")) continue;
    const matches = (child.textContent ?? "").toLowerCase().includes(query);
    const isFolderChild = child.dataset.folderChild === "1";
    if (isFolderChild && folderNameMatched) {
      child.hidden = false;
      groupHasMatch = true;
    } else {
      child.hidden = !matches;
      if (matches) {
        groupHasMatch = true;
        if (isFolderChild && folderEl) folderEl.hidden = false;
      }
    }
  }
  closeGroup();
  syncTabSearchEmptyNotice(header, rawQuery);
}

/**
 * 탭 검색이 아무것도 못 맞히면 사이드바가 검색 상자만 남은 빈 공백이 된다 — 안내가
 * 없으면 탭이 사라진 줄 안다(2026-09-01 실측: 그룹 라벨까지 전부 숨어 200px 공백).
 */
function syncTabSearchEmptyNotice(header: HTMLElement, rawQuery: string): void {
  const query = rawQuery.trim();
  const existing = header.querySelector<HTMLElement>("[data-testid='db-tab-search-empty']");
  // 검색 상자 자신과 이 안내는 세지 않는다 — 전부 세면 판정이 늘 "보이는 게 있다"가 된다.
  const anyVisible = railChildren(header).some((child) => {
    if (child.hidden) return false;
    const classes = child.classList;
    if (!classes) return false;
    return classes.contains("db-tab") || classes.contains("db-tab-group") || classes.contains("db-tab-folder");
  });
  if (query === "" || anyVisible) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = `“${query}”와 일치하는 탭이 없습니다.`;
    return;
  }
  header.append(el("p", {
    class: "db-tab-search-empty",
    dataset: { testid: "db-tab-search-empty" },
    text: `“${query}”와 일치하는 탭이 없습니다.`,
  }));
}

function appendTilesetFolder(
  header: HTMLElement,
  body: HTMLElement,
  container: HTMLElement,
): void {
  const childActive = isTilesetFolderTab(activeTab);
  header.append(
    el("button", {
      class: `db-tab-folder${childActive ? " open" : ""}`,
      attrs: {
        type: "button",
        title: "타일셋 — 이 칩셋의 통행·오토타일·미분류·구조물·공간 종류·개념 꾸러미",
        "aria-label": "타일셋",
        "aria-expanded": "true",
      },
      dataset: { testid: "db-tileset-folder" },
      children: [makeDatabaseTabIcon("tilesets"), "타일셋"],
      on: {
        click: () => {
          if (isTilesetFolderTab(activeTab)) return;
          setDatabaseActiveTab("tilesets");
          expandGroupFor(header, "tilesets");
          updateTabButtons(header);
          renderActiveTab(body, container);
        },
      },
    }),
  );
  for (const id of TILESET_FOLDER_TAB_IDS) {
    appendTabButton(header, body, container, tabFor(id), { folderChild: true });
  }
}

function appendTabButton(
  header: HTMLElement,
  body: HTMLElement,
  container: HTMLElement,
  tab: { readonly id: DatabaseTab; readonly label: string; readonly testid: string },
  options?: { readonly folderChild?: boolean },
): void {
  const count = databaseTabCount(tab.id);
  header.append(
    el("button", {
      class: `db-tab${activeTab === tab.id ? " active" : ""}`,
      // 아이콘은 `children` 으로만 넣는다 — el() 은 `text` 를 먼저 배정하고 children 을
      // 나중에 append 하므로 둘을 섞으면 라벨이 아이콘 앞으로 온다. <path> 는 텍스트
      // 노드를 안 가지므로 button.textContent 는 라벨 그대로 남는다(G006 라벨 계약).
      children: [makeDatabaseTabIcon(tab.id), tab.label],
      attrs: { type: "button", title: tab.label, "aria-label": tab.label },
      dataset: {
        testid: tab.testid,
        ...(count !== null && count > 0 ? { count: String(count) } : {}),
        ...(options?.folderChild ? { folderChild: "1" } : {}),
      },
      on: {
        click: () => {
          if (activeTab === tab.id) return;
          if (tab.id === "worldGen") resetWorldGenTabViewState();
          setDatabaseActiveTab(tab.id);
          expandGroupFor(header, tab.id);
          // 탭 헤더/스캐폴드는 유지하고 본문만 다시 그린다(전체 재빌드 회피).
          updateTabButtons(header);
          renderActiveTab(body, container, { forceFresh: tab.id === "worldGen" });
        },
      },
    }),
  );
}

function updateTabButtons(header: HTMLElement): void {
  // G006 프로그램 점프가 접힌 그룹으로 들어오면 활성 행이 숨은 채로 남는다 — 항상 펼쳐 준다.
  expandGroupFor(header, activeTab);
  const activeTestId = orderedTabs.find((tab) => tab.id === activeTab)?.testid;
  for (const button of Array.from(header.querySelectorAll(".db-tab"))) {
    if (!(button instanceof HTMLElement)) continue;
    if (button.dataset.testid === activeTestId) button.classList.add("active");
    else button.classList.remove("active");
  }
  const folder = header.querySelector(".db-tab-folder");
  if (folder instanceof HTMLElement) {
    folder.classList.toggle("open", isTilesetFolderTab(activeTab));
  }
  revealActiveTab(header);
}

function revealActiveTab(header: HTMLElement): void {
  const active = header.querySelector(".db-tab.active");
  if (!(active instanceof HTMLElement) || typeof active.scrollIntoView !== "function") return;
  active.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// saveAndMarkClean → refreshDatabasePanel → body.replaceChildren while a focused
// farmSpatial name/id/capacity control still has a dirty value. Chrome then fires
// change/blur synchronously; those handlers call rerender() → renderActiveTab again
// → nested replaceChildren/removeChild (pageError:
// "The node to be removed is no longer a child… blur event handler").
// Subscribe/scheduleModalRefresh already guard editing; the save refresh path does not.
// Before each paint, commit focus under this depth flag so change handlers queue instead
// of nesting replaceChildren; then drain the queue until stable (no dropped commits).
let activeTabRenderDepth = 0;
// Box the queue so control-flow narrowing cannot erase blur/rerender writes.
type ActiveTabRenderRequest = { body: HTMLElement; container: HTMLElement };
let queuedActiveTabRender: ActiveTabRenderRequest | null = null;

function queueActiveTabRender(body: HTMLElement, container: HTMLElement): void {
  queuedActiveTabRender = { body, container };
}

function takeQueuedActiveTabRender(): ActiveTabRenderRequest | null {
  const queued = queuedActiveTabRender;
  queuedActiveTabRender = null;
  return queued;
}

function commitFocusedControlIn(body: HTMLElement): void {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (!(active instanceof HTMLElement) || !body.contains(active)) return;
  // blur → change/commit (+ optional rerender). rerender sees depth>0 and queues.
  active.blur();
}

function renderActiveTab(
  body: HTMLElement,
  container: HTMLElement,
  options: { readonly forceFresh?: boolean } = {},
): void {
  if (activeTabRenderDepth > 0) {
    queueActiveTabRender(body, container);
    return;
  }
  activeTabRenderDepth += 1;
  try {
    let nextBody = body;
    let nextContainer = container;
    let nextOptions: { readonly forceFresh?: boolean } = options;
    for (;;) {
      takeQueuedActiveTabRender();
      commitFocusedControlIn(nextBody);
      // Focus commit may have queued a force-fresh; promote so list labels match model.
      const afterCommit = takeQueuedActiveTabRender();
      if (afterCommit) {
        nextBody = afterCommit.body;
        nextContainer = afterCommit.container;
        nextOptions = { forceFresh: true };
      }
      renderActiveTabUnguarded(nextBody, nextContainer, nextOptions);
      const queued = takeQueuedActiveTabRender();
      if (!queued) break;
      nextBody = queued.body;
      nextContainer = queued.container;
      nextOptions = { forceFresh: true };
      refreshTabCounts(nextContainer);
    }
  } finally {
    activeTabRenderDepth = 0;
    queuedActiveTabRender = null;
  }
}

function renderActiveTabUnguarded(
  body: HTMLElement,
  container: HTMLElement,
  options: { readonly forceFresh?: boolean } = {},
): void {
  const tab = activeTab;
  let cache = tabRenderCacheFor(container);
  if (options.forceFresh) evictDatabaseTabView(cache, tab);
  const cached = cache.views.get(tab);
  if (cached) {
    stopSkillAnimationStagesIn(body);
    body.replaceChildren(...cached);
    resumeSkillAnimationStagesIn(body);
    return;
  }

  stopSkillAnimationStagesIn(body);
  body.replaceChildren();
  const rerender = (): void => {
    // A debounced callback from a tab that has since been detached must not repaint
    // whichever tab is currently visible. Its cache entry is simply made cold.
    if (activeTab !== tab) {
      evictDatabaseTabView(tabRenderCacheFor(container), tab);
      return;
    }
    renderActiveTab(body, container, { forceFresh: true });
    refreshTabCounts(container);
  };
  if (tab === "enemies" || tab === "monsterSpecies" || tab === "troops") {
    const banner = collectionGateBanner(container);
    if (banner) body.append(banner);
  }
  switch (tab) {
    case "promotionTree":
      renderGrowthTreeTab(body, "promotion");
      break;
    case "skillTrees":
      renderGrowthTreeTab(body, "skill");
      break;
    case "actors":
    case "classes":
    case "skills":
    case "enemies":
    case "troops":
    case "states":
      renderRecordTab(body, tab, rerender);
      break;
    case "items":
    case "equipment":
      renderInventoryCatalog(body, rerender);
      break;
    case "animations":
      renderRecordTab(body, "battleAnimations", rerender);
      break;
    case "elements":
      renderElementsTab(body);
      break;
    case "terrain":
      renderTerrainTab(body);
      break;
    case "battleScreen":
      renderBattleScreenTab(body);
      break;
    case "battleCommands":
      renderBattleCommandsTab(body);
      break;
    case "monsterSpecies":
      renderMonsterSpeciesTab(body, rerender);
      break;
    case "crops":
      renderCropTab(body, rerender);
      break;
    case "characters":
      renderCharactersTab(body, rerender);
      break;
    case "lifeCrafting":
      renderLifeCraftingTab(body, rerender);
      break;
    case "dailyWeather":
      renderDailyWeatherTab(body, rerender);
      break;
    case "farmAnimals":
      renderFarmAnimalsTab(body, rerender);
      break;
    case "farmSpatial":
      renderFarmSpatialTab(body, rerender);
      break;
    case "lifeCollections":
      renderLifeCollectionsTab(body, rerender);
      break;
    case "factions":
      renderFactionsTab(body, rerender);
      break;
    case "switches":
      renderSwitchesTab(body, rerender);
      break;
    case "variables":
      renderVariablesTab(body, rerender);
      break;
    case "commonEvents":
      renderCommonEventsTab(body, rerender);
      break;
    case "tilesets":
    case "tilesetAutotile":
    case "tilesetUnlabeled":
      applyTilesetFolderFacet(tab);
      renderTilesetsTab(body, rerender);
      break;
    case "structureKits":
      renderStructureKitsTab(body, rerender);
      break;
    case "tilesetSpaces":
      renderTilesetSpacesTab(body, rerender);
      break;
    case "scratchConcepts":
      renderScratchConceptTab(body, rerender);
      break;
    case "villages":
      renderVillageTab(body, rerender);
      break;
    case "worldCanon":
      renderWorldCanonTab(body, rerender);
      break;
    case "worldCodex":
      renderWorldCodexTab(body, container);
      break;
    case "worldGen":
      renderWorldGenTab(body, rerender);
      break;
    case "system":
      renderSystemTab(body, rerender);
      break;
    case "terms":
      renderTermsTab(body, rerender);
      break;
    case "overview":
      renderOverviewTab(body, rerender);
      break;
  }

  // A renderer may update the store while normalizing its own view. Re-read the
  // project after rendering so such a mutation invalidates every older tab entry.
  cache = tabRenderCacheFor(container);
  cache.views.set(tab, Array.from(body.childNodes));
}

function evictDatabaseTabView(cache: DatabaseTabRenderCache, tab: DatabaseTab): void {
  for (const node of cache.views.get(tab) ?? []) {
    if (node instanceof HTMLElement) disposeAnimationPreviewsIn(node);
  }
  cache.views.delete(tab);
}

function tabRenderCacheFor(container: HTMLElement): DatabaseTabRenderCache {
  const project = store.getCurrent();
  const current = tabRenderCaches.get(container);
  if (current?.project === project) return current;
  if (current) for (const tab of current.views.keys()) evictDatabaseTabView(current, tab);
  const next: DatabaseTabRenderCache = { project, views: new Map() };
  tabRenderCaches.set(container, next);
  return next;
}

/**
 * 몬스터 데이터를 저작했는데 시스템 탭에서 몬스터 수집이 꺼져 있으면 포획 명령이 전투에
 * 나오지 않는다 — 몬스터/종족/적 그룹 탭 상단에 경고와 시스템 탭 점프를 준다.
 */
function collectionGateBanner(container: HTMLElement): HTMLElement | null {
  const project = store.getCurrent();
  if (project.system.monsterCollection === true) return null;
  const hasSpecies = (project.database.monsterSpecies?.length ?? 0) > 0;
  const hasCaptureItem = project.database.items.some((item) => item.captureProfile !== undefined);
  if (!hasSpecies && !hasCaptureItem) return null;
  return el("div", {
    class: "db-collection-gate-warn is-info",
    dataset: { testid: "db-collection-gate-warn" },
    children: [
      el("span", { text: "전투 중심 모드입니다. 포획을 사용하려면 시스템에서 몬스터 수집을 켜세요." }),
      el("button", {
        class: "btn small",
        attrs: { type: "button" },
        text: "시스템 탭 열기",
        dataset: { testid: "db-collection-gate-open-system" },
        on: { click: () => switchDatabaseActiveTab("system", container) },
      }),
    ],
  });
}

function readStoredActiveTab(): DatabaseTab {
  if (typeof window === "undefined") return "actors";
  const stored = window.localStorage.getItem(DATABASE_ACTIVE_TAB_KEY);
  if (stored === "equipment") {
    inventoryCatalogSession().collection = "equipment";
    inventoryCatalogSession().filter = "equipment";
    return "items";
  }
  return isDatabaseTab(stored) ? stored : "actors";
}

function isDatabaseTab(value: string | null): value is DatabaseTab {
  return orderedTabs.some((tab) => tab.id === value);
}
