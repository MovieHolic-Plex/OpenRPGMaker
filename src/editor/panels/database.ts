import { renderGrowthTreeTab } from "@/editor/panels/growthTree/studio";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { renderCharactersTab } from "@/editor/panels/databaseCharacterView";
import { renderCharacterGraphicsTab } from "@/editor/panels/databaseCharacterGraphicsView";
import { renderCharacterAppearancesTab, selectCharacterAppearance } from "@/editor/panels/databaseAppearanceView";
import { registerAppearanceGenerationUI } from "@/editor/characterAppearanceGeneration";
import { disposeAppearanceSlots } from "@/editor/panels/databaseAppearanceSlots";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { renderDailyWeatherTab } from "@/editor/panels/databaseDailyWeatherView";
import { renderFarmAnimalsTab } from "@/editor/panels/databaseFarmAnimalsView";
import { renderFarmSpatialTab } from "@/editor/panels/databaseFarmSpatialView";
import { renderFactionsTab } from "@/editor/panels/databaseFactionView";
import { renderLifeCollectionsTab } from "@/editor/panels/databaseLifeCollectionsView";
import { renderInventoryCatalog } from "@/editor/panels/databaseInventoryCatalog";
import { inventoryCatalogSession, setSearchQueryForCollection } from "@/editor/panels/databaseRecordViewSession";
import { renderRecordTab } from "@/editor/panels/databaseRecordViews";
import { disposeDatabasePreviewsIn, retainDatabasePreviewsIn } from "./databasePreviewLifecycle";
import {
  resumeSkillAnimationStagesIn,
  stopSkillAnimationStagesIn,
} from "@/editor/panels/databaseSkillAnimationStage";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import {
  disposeDatabaseCinematicsIn,
  renderDatabaseCinematicTab,
} from "@/editor/panels/databaseCinematicView";
import {
  renderSwitchesTab,
  renderTermsTab,
  renderVariablesTab,
} from "@/editor/panels/databaseUtilityViews";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import {
  renderBattleCommandsTab,
  renderElementsTab,
  renderTerrainTab,
} from "@/editor/panels/databaseUtilityRecordViews";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { makeDatabaseGroupIcon, makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import { renderStructureKitsTab } from "@/editor/panels/structureKitDbTab";
import { applyTilesetFolderFacet } from "@/editor/panels/tilesetMetadataEditor";
import { getSelectedTilesetId, renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { renderScratchConceptTab } from "@/editor/panels/scratchConceptTab";
import { interiorRoomKindCount, renderTilesetSpacesTab } from "@/editor/panels/tilesetSpacesTab";
import { renderSpatialAuthoringShell } from "@/editor/panels/spatialShell";
import {
  onSpatialTabReveal,
  rememberLegacySpatialRoute,
  setSpatialTab,
  type SpatialShellTab,
} from "@/editor/panels/spatialAuthoringSession";
import { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spatialAllSourceDesignCount } from "@/editor/panels/spatialCatalog";
import { listUnlabeledTileIds } from "@/editor/panels/tilesetMetadataControls";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { renderWorldCodexTab } from "@/editor/panels/databaseWorldCodexView";
import { renderRetroChoreographyTab, resetRetroChoreographyViewState } from "@/editor/panels/databaseRetroChoreographyView";
import { worldCanonHasContent } from "@/project/world/canon";
import {} from "@/editor/uiCopy";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export type DatabaseTab =
  | "promotionTree"
  | "skillTrees"
  | "overview"
  | DatabaseCollection
  | "animations"
  | "retroChoreographies"
  | "battleCommands"
  | "battleScreen"
  | "commonEvents"
  | "characters"
  | "characterGraphics"
  | "characterAppearances"
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
  | "opening"
  | "gameOver"
  | "terms"
  | "terrain"
  | "switches"
  | "tilesets"
  | "variables"
  | "worldCanon"
  | "worldCodex"
  | "spatialTiles"
  | "spatialObjects"
  | "spatialSpaces"
  | "spatialPlaces"
  | "spatialRegions"
  | "spatialWorlds";

const tabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = [
  { id: "overview", label: "개요", testid: "db-tab-overview" },
  { id: "elements", label: "속성", testid: "db-tab-elements" },
  { id: "terrain", label: "지형 효과", testid: "db-tab-terrain" },
  { id: "battleScreen", label: "전투 화면", testid: "db-tab-battle-screen" },
  { id: "battleCommands", label: "전투 명령", testid: "db-tab-battle-commands" },
  { id: "actors", label: "주인공", testid: "db-tab-actors" },
  { id: "characterAppearances", label: "캐릭터 외형", testid: "db-tab-character-appearances" },
  { id: "promotionTree", label: "직업 승급 트리", testid: "db-tab-promotion-tree" },
  { id: "skillTrees", label: "스킬 트리", testid: "db-tab-skill-trees" },
  { id: "classes", label: "직업", testid: "db-tab-classes" },
  { id: "skills", label: "스킬", testid: "db-tab-skills" },
  { id: "items", label: "아이템·장비", testid: "db-tab-items" },
  { id: "crops", label: "농사·작물", testid: "db-tab-crops" },
  { id: "characters", label: "주민 관계", testid: "db-tab-characters" },
  { id: "characterGraphics", label: "캐릭터·얼굴", testid: "db-tab-character-graphics" },
  { id: "lifeCrafting", label: "생활 기술·제작", testid: "db-tab-life-crafting" },
  { id: "dailyWeather", label: "계절·날씨", testid: "db-tab-daily-weather" },
  { id: "farmAnimals", label: "동물·축사", testid: "db-tab-farm-animals" },
  { id: "farmSpatial", label: "농장 건물·집 꾸미기", testid: "db-tab-farm-spatial" },
  { id: "lifeCollections", label: "낚시·채집·박물관", testid: "db-tab-life-collections" },
  { id: "enemies", label: "전투 몬스터", testid: "db-tab-enemies" },
  { id: "monsterSpecies", label: "포획·성장 종족", testid: "db-tab-monster-species" },
  { id: "troops", label: "적 그룹", testid: "db-tab-troops" },
  { id: "factions", label: "진영", testid: "db-tab-factions" },
  { id: "states", label: "상태", testid: "db-tab-states" },
  { id: "animations", label: "전투 애니메이션", testid: "db-tab-animations" },
  { id: "retroChoreographies", label: "도트 연출", testid: "db-tab-retro-choreographies" },
  { id: "tilesets", label: "타일셋", testid: "db-tab-tilesets" },
  { id: "tilesetAutotile", label: "오토타일 설정", testid: "db-tab-tileset-autotile" },
  { id: "tilesetUnlabeled", label: "미분류 모아보기", testid: "db-tab-tileset-unlabeled" },
  { id: "worldCanon", label: "세계 개요", testid: "db-tab-world-canon" },
  { id: "worldCodex", label: "설정집", testid: "db-tab-world-codex" },
  { id: "structureKits", label: "부품 보관함", testid: "db-tab-structure-kits" },
  { id: "tilesetSpaces", label: "기존 방 규칙", testid: "db-tab-tileset-spaces" },
  { id: "scratchConcepts", label: "개념 꾸러미", testid: "db-tab-scratch-concepts" },
  { id: "spatialTiles", label: "타일", testid: "db-tab-spatial-tiles" },
  { id: "spatialObjects", label: "오브젝트", testid: "db-tab-spatial-objects" },
  { id: "spatialSpaces", label: "장소 편집", testid: "db-tab-spatial-spaces" },
  { id: "spatialPlaces", label: "장소", testid: "db-tab-spatial-places" },
  { id: "spatialRegions", label: "지역", testid: "db-tab-spatial-regions" },
  { id: "spatialWorlds", label: "세계", testid: "db-tab-spatial-worlds" },
  { id: "commonEvents", label: "공용 이벤트", testid: "db-tab-common-events" },
  { id: "system", label: "시스템", testid: "db-tab-system" },
  { id: "opening", label: "오프닝", testid: "db-tab-opening" },
  { id: "gameOver", label: "게임 오버", testid: "db-tab-game-over" },
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
  // 공유 외형·승급 트리·스킬 트리는 레일 칸이 아니라 주인공·직업·스킬의 **보기**다
  // (PARTY_SUBVIEW_PARENT). 레일에 일곱 칸이 나란히 있으면 초보는 「직업」과 「직업 승급
  // 트리」, 「스킬」과 「스킬 트리」가 서로 다른 데이터인 줄 안다(2026-09-23 파티 UX 검토).
  { label: "파티", slug: "party", tabs: ["actors", "classes", "skills", "items"] },
  { label: "몬스터", slug: "monster", tabs: ["enemies", "monsterSpecies", "troops", "factions"] },
  {
    label: "전투 규칙",
    slug: "battle",
    // 옛 전투 애니메이션(셀 편집)은 도트 연출의 하위 보기다 — 도트 측면 전투는 스킬에 도트 연출이 있으면 셀 애니메이션을
    // 그리지 않고, 연출 없는 스킬의 대체용·몬스터 대치(포켓몬)에서만 쓴다(2026-10-02).
    tabs: ["elements", "states", "retroChoreographies", "battleScreen", "battleCommands"],
  },
  { label: "생활", slug: "life", tabs: ["crops", "characters", "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial", "lifeCollections"] },
  { label: "맵", slug: "world", tabs: ["spatialTiles", "spatialObjects", "spatialPlaces", "spatialRegions", "spatialWorlds"] },
  { label: "시스템", slug: "system", tabs: ["commonEvents", "system", "opening", "gameOver", "characterGraphics", "terms", "switches", "variables"] },
];

/** Facet editors hang off the tiles destination. Legacy map routes redirect below. */
const MAP_PARENT_TAB: Partial<Record<DatabaseTab, DatabaseTab>> = {
  spatialSpaces: "spatialPlaces",
  terrain: "spatialTiles",
  tilesetAutotile: "spatialTiles",
  tilesetUnlabeled: "spatialTiles",
};

/**
 * 파티 레코드의 하위 보기. 탭 id 는 그대로 살아 있는 목적지(딥링크·조수 도구·검색)지만
 * 레일에는 부모만 남고, 부모 본문 위의 보기 전환 줄(`db-party-subviews`)로 오간다.
 */
export const PARTY_SUBVIEW_PARENT: Partial<Record<DatabaseTab, DatabaseTab>> = {
  characterAppearances: "actors",
  promotionTree: "classes",
  skillTrees: "skills",
  animations: "retroChoreographies",
};

const PARTY_SUBVIEWS: Partial<Record<DatabaseTab, readonly { readonly tab: DatabaseTab; readonly label: string; readonly slug: string }[]>> = {
  actors: [
    { tab: "actors", label: "주인공", slug: "actors" },
    { tab: "characterAppearances", label: "공유 외형", slug: "character-appearances" },
  ],
  classes: [
    { tab: "classes", label: "직업 편집", slug: "classes" },
    { tab: "promotionTree", label: "승급 트리", slug: "promotion-tree" },
  ],
  skills: [
    { tab: "skills", label: "스킬 편집", slug: "skills" },
    { tab: "skillTrees", label: "성장 트리", slug: "skill-trees" },
  ],
  retroChoreographies: [
    { tab: "retroChoreographies", label: "도트 연출", slug: "retro-choreographies" },
    { tab: "animations", label: "옛 전투 애니메이션 (대체용)", slug: "animations" },
  ],
};

export const LEGACY_SPATIAL_ROUTE: Partial<Record<DatabaseTab, DatabaseTab>> = {
  tilesets: "spatialTiles",
  structureKits: "spatialObjects",
  tilesetSpaces: "spatialSpaces",
  scratchConcepts: "spatialPlaces",
};

const SHELL_TAB_BY_SPATIAL: Partial<Record<DatabaseTab, SpatialShellTab>> = {
  spatialTiles: "tiles",
  spatialObjects: "objects",
  spatialSpaces: "spaces",
  spatialPlaces: "places",
  spatialRegions: "regions",
  spatialWorlds: "worlds",
};

const DATABASE_TAB_BY_SHELL: Record<SpatialShellTab, DatabaseTab> = {
  tiles: "spatialTiles",
  objects: "spatialObjects",
  spaces: "spatialSpaces",
  places: "spatialPlaces",
  regions: "spatialRegions",
  worlds: "spatialWorlds",
};

bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);

export function resolveCanonicalDatabaseTab(tab: DatabaseTab): DatabaseTab {
  if (tab === "equipment") return "items";
  return LEGACY_SPATIAL_ROUTE[tab] ?? tab;
}

export function databaseTabPath(tab: DatabaseTab): readonly DatabaseTab[] {
  const canonical = resolveCanonicalDatabaseTab(tab);
  if (tab === "tilesetAutotile" || tab === "tilesetUnlabeled") return ["spatialTiles"];
  if (canonical !== tab) return databaseTabPath(canonical);
  const parent = MAP_PARENT_TAB[tab] ?? PARTY_SUBVIEW_PARENT[tab];
  return parent ? [...databaseTabPath(parent), tab] : [tab];
}

function primaryTab(tab: DatabaseTab): DatabaseTab {
  return databaseTabPath(tab)[0]!;
}

// 개요는 그룹 밖에 고정되므로 앞에 붙인다.
const tabOrder: readonly DatabaseTab[] = ["overview", ...TAB_GROUPS.flatMap((group) => group.tabs)];

const orderedTabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = tabOrder.map(tabFor);
function groupForTab(id: DatabaseTab): DatabaseTabGroup | undefined {
  return TAB_GROUPS.find((group) => group.tabs.includes(primaryTab(id)));
}

// 레일은 모든 그룹을 펼친 채로 둔다(2026-09-24, 사이드바 개선안 C). 예전 아코디언은
// 한 그룹만 열어서 그룹을 건널 때마다 두 번 눌러야 했고, 접힌 머리 하나가 66px(이름·부제·
// 배지+셰브론 세 줄)라 접힌 여섯 개가 낱말 여섯 개에 ~400px 를 썼다.
// 대신 **레코드가 0 인 목록 탭**만 그룹마다 「빈 탭 N개」 한 줄로 접는다. 카운트가 null 인
// 탭(시스템·용어·속성처럼 목록이 아닌 설정 화면)은 비어 있다고 판정할 수 없으므로 접지 않는다.
// 활성 탭은 비어 있어도 늘 보인다 — 딥링크·조수 점프가 숨은 행에 떨어지면 안 된다.
// 사용자가 펼친 그룹은 기억한다. 옛 접힘 키(`collapsedTabGroups`)는 더 읽지 않는다.
let revealedEmptyGroups: Set<string> | null = null;

function revealedEmptyGroupSlugs(): Set<string> {
  if (revealedEmptyGroups) return revealedEmptyGroups;
  revealedEmptyGroups = new Set();
  try {
    const raw = window.localStorage.getItem(DATABASE_REVEALED_EMPTY_GROUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const known = new Set(TAB_GROUPS.map((group) => group.slug));
    if (Array.isArray(parsed)) {
      for (const slug of parsed) if (typeof slug === "string" && known.has(slug)) revealedEmptyGroups.add(slug);
    }
  } catch {
    // 읽기 실패는 「아무 그룹도 안 펼침」 으로 둔다.
  }
  return revealedEmptyGroups;
}

/**
 * 활성 탭 저장. setItem 은 던질 수 있다(프라이빗 모드·할당량) — 같은 파일의
 * persistRevealedEmptyGroups 는 이미 try/catch 로 막아 두었는데 여기만 무방비라
 * 저장 실패가 **탭 전환 자체를 중단**시켰다.
 */
function persistActiveTab(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATABASE_ACTIVE_TAB_KEY, activeTab);
  } catch {
    // 저장 실패해도 이번 세션의 활성 탭은 메모리에 남는다.
  }
}

function persistRevealedEmptyGroups(): void {
  try {
    window.localStorage.setItem(DATABASE_REVEALED_EMPTY_GROUPS_KEY, JSON.stringify([...revealedEmptyGroupSlugs()]));
  } catch {
    // 저장 실패해도 이번 세션의 펼침 상태는 메모리에 남는다.
  }
}

function railChildren(header: HTMLElement): HTMLElement[] {
  return Array.from(header.children) as HTMLElement[];
}

/** 목록 탭인데 레코드가 0 개인 탭만 「빈 탭」 이다. null(목록 아님)은 빈 것이 아니다. */
function isEmptyListTab(id: DatabaseTab): boolean {
  return databaseTabCount(id) === 0;
}

function foldedEmptyTabs(group: DatabaseTabGroup): DatabaseTab[] {
  if (revealedEmptyGroupSlugs().has(group.slug)) return [];
  const active = primaryTab(activeTab);
  return group.tabs.filter((id) => id !== active && isEmptyListTab(id));
}

/** 그룹마다 빈 탭을 숨기고 「빈 탭 N개」 줄을 맞춘다. 데이터·활성 탭이 바뀔 때마다 다시 부른다.
 *  레일 직계 자식을 순서대로 걷는다 — 머리 → 탭들 → 접기 줄. (복합 선택자를 쓰지 않는 것은
 *  fake DOM 테스트가 단순 선택자만 알기 때문이다.) */
function applyEmptyTabFold(header: HTMLElement): void {
  let group: DatabaseTabGroup | undefined;
  let folded = new Set<DatabaseTab>();
  for (const child of railChildren(header)) {
    const classes = child.classList;
    if (!classes) continue;
    if (classes.contains("db-tab-group")) {
      group = TAB_GROUPS.find((candidate) => candidate.slug === child.dataset.groupSlug);
      folded = new Set(group ? foldedEmptyTabs(group) : []);
      if (!group) continue;
      // aria-expanded 는 「이 그룹에 숨은 탭이 있는가」 다 — 머리를 누르면 그걸 펼친다.
      child.setAttribute("aria-expanded", String(folded.size === 0));
      const names = [...folded].map((id) => tabFor(id).label);
      child.setAttribute(
        "title",
        folded.size > 0 ? `${group.label} — 빈 탭 펼치기: ${names.join(", ")}` : group.label,
      );
      continue;
    }
    if (!group) continue;
    if (classes.contains("db-tab")) {
      if (child.dataset.searchSecondary) continue;
      child.hidden = folded.has(child.dataset.tab as DatabaseTab);
      continue;
    }
    if (!classes.contains("db-tab-fold")) continue;
    const names = [...folded].map((id) => tabFor(id).label);
    child.hidden = folded.size === 0;
    const [count, text] = Array.from(child.children) as HTMLElement[];
    if (count) count.textContent = `빈 탭 ${folded.size}개`;
    if (text) text.textContent = names.join("·");
    child.setAttribute("title", `비어 있는 탭 펼치기 — ${names.join(", ")}`);
    child.setAttribute("aria-label", `${group.label}: 빈 탭 ${folded.size}개 펼치기`);
  }
}

/** 그룹 머리·「빈 탭」 줄 — 숨은 빈 탭을 펼친다. 이미 다 보이면 아무것도 하지 않는다(접지 않는다). */
function revealGroupEmptyTabs(slug: string, header: HTMLElement): void {
  // 그룹 머리를 누르면 그 구획을 본다 — 띠를 거치지 않는 옛 경로(e2e 헬퍼·키보드)도 같은 곳에 닿는다.
  if (viewedGroupSlug !== slug && TAB_GROUPS.some((candidate) => candidate.slug === slug)) viewGroup(header, slug);
  const group = TAB_GROUPS.find((candidate) => candidate.slug === slug);
  if (!group || foldedEmptyTabs(group).length === 0) return;
  revealedEmptyGroupSlugs().add(slug);
  persistRevealedEmptyGroups();
  applyEmptyTabFold(header);
}

function tabFor(id: DatabaseTab): { readonly id: DatabaseTab; readonly label: string; readonly testid: string } {
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) throw new Error(`Missing database tab metadata: ${id}`);
  return tab;
}

const DATABASE_ACTIVE_TAB_KEY = "oprn:database.activeTab";
const DATABASE_REVEALED_EMPTY_GROUPS_KEY = "oprn:database.revealedEmptyTabGroups";

let activeTab: DatabaseTab = readStoredActiveTab();
let databaseHeaderResizeObserver: ResizeObserver | null = null;
let spatialDatabaseHost: HTMLElement | null = null;

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

onSpatialTabReveal((tab) => {
  const requested = DATABASE_TAB_BY_SHELL[tab];
  if (activeTab === requested) return;
  activeTab = requested;
  persistActiveTab();
  for (const listener of activeTabListeners) listener(activeTab);
  const host = spatialDatabaseHost;
  if (!host?.isConnected) return;
  const header = host.querySelector(".db-tabs");
  if (header instanceof HTMLElement) updateTabButtons(header);
  refreshDatabasePanel(host);
});

export function subscribeDatabaseActiveTab(listener: (tab: DatabaseTab) => void): () => void {
  activeTabListeners.add(listener);
  return () => {
    activeTabListeners.delete(listener);
  };
}

export function setDatabaseActiveTab(tab: DatabaseTab): void {
  // Programmatic navigation also ends cinematic ownership immediately, before
  // a caller refreshes or detaches the body. The active tab is shared globally.
  if (tab !== activeTab && (activeTab === "opening" || activeTab === "gameOver")
    && typeof document !== "undefined") {
    disposeDatabaseCinematicsIn(document.body);
  }
  if (activeTab === "characterAppearances" && tab !== "characterAppearances") disposeAppearanceSlots();
  // Legacy shortcuts apply once per navigation, never on a renderer's own redraw.
  applyTilesetFolderFacet(tab);
  if (tab === "equipment") {
    const catalog = inventoryCatalogSession();
    catalog.collection = "equipment";
    catalog.filter = "equipment";
    catalog.subtype = "all";
    setSearchQueryForCollection("items", "");
  }
  const requested = tab === "equipment" ? "items" : tab;
  const legacyOrigin = requested === "tilesetSpaces" ? "tilesetSpaces"
    : null;
  activeTab = resolveCanonicalDatabaseTab(requested);
  const shellTab = SHELL_TAB_BY_SPATIAL[activeTab];
  if (legacyOrigin) rememberLegacySpatialRoute(legacyOrigin);
  else if (shellTab) setSpatialTab(shellTab);
  persistActiveTab();
  for (const listener of activeTabListeners) listener(activeTab);
}

/** 탭이 속한 사이드바 그룹 라벨. 개요처럼 그룹 밖 탭은 undefined. */
export function databaseTabGroupLabel(tab: DatabaseTab): string | undefined {
  return groupForTab(tab === "equipment" ? "items" : tab)?.label;
}
export function switchDatabaseActiveTab(tab: DatabaseTab, panelRoot: HTMLElement): void {
  if (tab === "retroChoreographies" && activeTab !== tab) resetRetroChoreographyViewState();
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
  spatialDatabaseHost = container;
  const cache = tabRenderCaches.get(container);
  if (cache) for (const tab of cache.views.keys()) evictDatabaseTabView(cache, tab);
  disposeDatabasePreviewsIn(container);
  clearChildren(container);
  tabRenderCaches.delete(container);
  resetRetroChoreographyViewState();
  applyTilesetFolderFacet(activeTab);
  const header = el("div", { class: "db-tabs" });
  const body = el("div", {
    class: "db-body db-shared-workspace",
    dataset: { testid: "db-shared-workspace" },
  });
  // 버튼의 testid/라벨/.active 토글 계약(G006 + databaseCrossTabNav)을 유지한다.
  appendTabSearch(header, body, container);
  appendTabButton(header, body, container, tabFor("overview"));
  for (const group of TAB_GROUPS) {
    header.append(el("div", {
      class: "db-tab-group",
      // 그룹 머리는 이제 구획 제목이다 — 모든 그룹이 늘 펼쳐져 있다. 누르면 그 그룹의 빈 탭을
      // 펼친다(「빈 탭 N개」 줄과 같은 동작). div+onclick 이라 role/tabindex 를 주고
      // Enter/Space 를 직접 받는다 — <button> 은 기본 스타일이 달라 레일 모양이 흔들린다.
      attrs: { title: group.label, role: "button", tabindex: "0" },
      dataset: { testid: `db-tab-group-${group.slug}`, groupSlug: group.slug },
      // 라벨을 **별도 span 으로** 둔다. 라벨 계약(databaseNavMode·db-desktop-matrix)은
      // .db-tab-group-label 의 textContent 를 본다.
      children: [el("span", { class: "db-tab-group-label", text: group.label })],
      on: {
        click: () => revealGroupEmptyTabs(group.slug, header),
        keydown: (event: Event) => {
          if (!("key" in event)) return;
          const key = (event as KeyboardEvent).key;
          if (key !== "Enter" && key !== " " && key !== "Spacebar") return;
          event.preventDefault(); // Space 가 레일을 스크롤하지 않게.
          revealGroupEmptyTabs(group.slug, header);
        },
      },
    }));
    for (const id of group.tabs) {
      appendTabButton(header, body, container, tabFor(id));
    }
    // 빈 탭 접기 줄. `.db-tab` 이 아니다 — 탭 버튼 계약(라벨·testid·포커스 순서 검사)은
    // `.db-tab` 만 센다. 문구·숨김은 applyEmptyTabFold 가 채운다.
    header.append(el("button", {
      class: "db-tab-fold",
      attrs: { type: "button", hidden: "" },
      dataset: { testid: `db-tab-fold-${group.slug}`, groupSlug: group.slug },
      children: [
        el("span", { class: "db-tab-fold-count" }),
        el("span", { class: "db-tab-fold-names" }),
      ],
      on: { click: () => revealGroupEmptyTabs(group.slug, header) },
    }));
  }
  applyEmptyTabFold(header);

  renderActiveTab(body, container);
  container.append(buildGroupStrip(header), header, body);
  resumeSkillAnimationStagesIn(body);
  syncGroupStrip(header);
  revealActiveTab(header);
  if (typeof ResizeObserver !== "undefined") {
    // 헤더가 교체되면(탭 레일 재구성) 이전 옵저버는 할 일이 없다. GC 로 수거될 "가능성"에
    // 기대지 않고 명시적으로 끊는다 — 패널을 여러 번 다시 그리면 그만큼 쌓였다.
    databaseHeaderResizeObserver?.disconnect();
    const observer = new ResizeObserver(() => revealActiveTab(header));
    observer.observe(header);
    databaseHeaderResizeObserver = observer;
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
    case "characterAppearances":
      return database.characterAppearances?.length ?? 0;
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
    // 기본 연출(번들 계약)이 늘 있으므로 0 이 될 일이 없고, 빈 탭으로 접히면 안 된다.
    case "retroChoreographies":
      return null;
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
    case "spatialTiles":
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
    case "spatialObjects":
      return spatialAllSourceDesignCount("objects");
    case "spatialSpaces":
      return spatialAllSourceDesignCount("spaces");
    case "spatialPlaces":
      return spatialAllSourceDesignCount("places");
    case "spatialRegions":
      return spatialAllSourceDesignCount("regions");
    case "spatialWorlds":
      return spatialAllSourceDesignCount("worlds");
    case "worldCanon":
      return worldCanonHasContent(project.worldCanon) ? 1 : 0;
    case "worldCodex":
      return project.world?.entities.length ?? 0;
    case "structureKits":
      return Object.values(project.tilesets).reduce(
        (sum, tileset) => sum + (tileset.structureKits?.length ?? 0),
        0,
      );
    default:
      return null;
  }
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
  // 카운트가 0 이 되거나 0 을 벗어나면 빈 탭 접기도 달라진다.
  applyEmptyTabFold(header);
}

// 사이드바 상단 탭 검색 — 라벨 부분 일치로 탭을 거르고, 매치가 없는 그룹 라벨은
// 함께 숨긴다. DOM 계약(직계 자식 button.db-tab)은 유지 — hidden 토글만 한다.
const LEGACY_TAB_SEARCH: Partial<Record<DatabaseTab, string>> = {
  items: "equipment",
  tilesets: "통행 지형",
  tilesetAutotile: "자동 연결 구성",
  tilesetUnlabeled: "타일 설명 타일 지식 단어장",
  structureKits: "구조물",
  tilesetSpaces: "공간 종류",
  // 옛 「전투 애니메이션」 레일 칸은 도트 연출의 하위 보기로 들어갔다(2026-10-02) — 그 이름으로 찾아도 연출 탭이 걸린다.
  retroChoreographies: "스킬 이펙트 연출 번개 도트 skillChoreographies 전투 애니메이션 animations",
  spatialTiles: "타일셋 AI 참고문서 MD 이미지 통행 지형 tilesets references",
  spatialObjects: "구조물 부품 보관함 오브젝트 structureKits",
  spatialSpaces: "공간 종류 기존 방 규칙 tilesetSpaces",
  spatialPlaces: "장소 방 실내 실외 건물 개념 꾸러미 시설 scratchConcepts",
  spatialRegions: "지역 정주지",
  spatialWorlds: "세계 맵",
};

function tabMatchesQuery(tab: typeof tabs[number], query: string): boolean {
  const exact = tabs.find((entry) => entry.id.toLowerCase() === query);
  if (exact) return tab.id === exact.id || tab.id === resolveCanonicalDatabaseTab(exact.id);
  if (tab.id.toLowerCase().startsWith(query)) return true;
  if (tab.label.toLowerCase().includes(query)) return true;
  // 레일 그룹 이름(「파티」「세계관」「전투 규칙」)으로 찾으면 그 그룹의 탭이 모두 걸린다.
  if (TAB_GROUPS.some((group) => group.tabs.includes(tab.id) && group.label.toLowerCase().includes(query))) return true;
  const aliases = (LEGACY_TAB_SEARCH[tab.id] ?? "").toLowerCase().split(/\s+/);
  return aliases.some((token) => token === query || token.includes(query));
}

function appendTabSearch(header: HTMLElement, body: HTMLElement, container: HTMLElement): void {
  const input = el("input", {
    class: "db-tab-search",
    attrs: { type: "search", placeholder: "탭 검색", title: "탭 검색", "aria-label": "탭 검색" },
    dataset: { testid: "db-tab-search" },
    on: { input: () => {
      for (const node of Array.from(header.querySelectorAll("[data-search-secondary]"))) node.remove();
      const query = input.value.trim().toLowerCase();
      if (query) {
        // Secondary destinations exist in search results, not as hidden legacy rail rows.
        for (const tab of tabs) {
          if (
            !tabOrder.includes(tab.id)
            && resolveCanonicalDatabaseTab(tab.id) === tab.id
            && tabMatchesQuery(tab, query)
          ) {
            appendTabButton(header, body, container, tab, { searchSecondary: true });
          }
        }
      }
      applyTabFilter(header, input.value);
    } },
  });
  header.append(input);
}

function applyTabFilter(header: HTMLElement, rawQuery: string): void {
  const query = rawQuery.trim().toLowerCase();
  // 검색은 모든 구획을 가로지른다 — 보던 그룹 제한(data-in-view)을 CSS 에서 푼다.
  if (query === "") delete header.dataset.searching;
  else header.dataset.searching = "1";
  if (query === "") {
    for (const child of railChildren(header)) child.hidden = false;
    applyEmptyTabFold(header);
    syncTabSearchEmptyNotice(header, rawQuery);
    return;
  }
  for (const child of Array.from(header.children)) {
    if (!(child instanceof HTMLElement)) continue;
    // 검색 중에는 구획 머리와 「빈 탭」 줄을 숨기고, 빈 탭도 이름이 맞으면 보인다.
    if (child.classList.contains("db-tab-group") || child.classList.contains("db-tab-fold")) {
      child.hidden = true;
      continue;
    }
    if (!child.classList.contains("db-tab")) continue;
    const tab = tabs.find((entry) => entry.id === child.dataset.tab);
    child.hidden = !tab || !tabMatchesQuery(tab, query);
  }
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
    return classes.contains("db-tab") || classes.contains("db-tab-group");
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

function appendTabButton(
  header: HTMLElement,
  body: HTMLElement,
  container: HTMLElement,
  tab: { readonly id: DatabaseTab; readonly label: string; readonly testid: string },
  options?: { readonly searchSecondary?: boolean },
): void {
  const count = databaseTabCount(tab.id);
  header.append(
    el("button", {
      class: `db-tab${primaryTab(activeTab) === tab.id ? " active" : ""}`,
      // 아이콘은 `children` 으로만 넣는다 — el() 은 `text` 를 먼저 배정하고 children 을
      // 나중에 append 하므로 둘을 섞으면 라벨이 아이콘 앞으로 온다. <path> 는 텍스트
      // 노드를 안 가지므로 button.textContent 는 라벨 그대로 남는다(G006 라벨 계약).
      children: [makeDatabaseTabIcon(tab.id), tab.label],
      // 카운트 배지(CSS `content: attr(data-count)`)는 보조기술이 못 읽는다. 다만 이 버튼은
      // `aria-label === title === 라벨` 을 계약으로 쓰고 있어(databaseTabIcons·databaseSidebarNav
      // 가 단언, e2e getByLabel 도 의존) 숫자를 둘 중 어디에도 끼워 넣을 수 없다.
      // 배지를 읽히게 하려면 시각적 숨김 span 을 버튼 안에 넣어야 하는데, 그건 다시
      // `button.textContent === 라벨`(G006) 계약과 부딪힌다 — 세 계약을 함께 손보는 별도 작업.
      attrs: { type: "button", title: tab.label, "aria-label": tab.label },
      dataset: {
        testid: tab.testid,
        tab: tab.id,
        ...(count !== null && count > 0 ? { count: String(count) } : {}),
        ...(options?.searchSecondary ? { searchSecondary: "1" } : {}),
      },
      on: {
        click: () => {
          const already = activeTab === tab.id;
          if (tab.id === "retroChoreographies" && !already) resetRetroChoreographyViewState();
          setDatabaseActiveTab(tab.id);
          // 탭 헤더/스캐폴드는 유지하고 본문만 다시 그린다(전체 재빌드 회피).
          updateTabButtons(header);
          renderActiveTab(body, container);
        },
      },
    }),
  );
}

function updateTabButtons(header: HTMLElement): void {
  const search = header.querySelector<HTMLInputElement>(".db-tab-search");
  if (search?.value) {
    search.value = "";
    for (const node of Array.from(header.querySelectorAll("[data-search-secondary]"))) node.remove();
    applyTabFilter(header, "");
  }
  // G006 프로그램 점프가 접힌 빈 탭으로 들어오면 활성 행이 숨은 채로 남는다 — 활성 탭은
  // 늘 보이게 접기를 다시 맞춘다.
  applyEmptyTabFold(header);
  const activeTestId = tabFor(primaryTab(activeTab)).testid;
  for (const button of Array.from(header.querySelectorAll(".db-tab"))) {
    if (!(button instanceof HTMLElement)) continue;
    const isActive = button.dataset.testid === activeTestId;
    button.classList.toggle("active", isActive);
    // `.active` 클래스만으로는 보조기술이 어느 탭에 있는지 알 수 없었다(레일 전체에
    // aria-current/selected/pressed 가 0건이었다). 맵 패널이 쓰는 aria-current 규약을 맞춘다.
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  syncGroupStrip(header);
  revealActiveTab(header);
}

// ── 그룹 띠 (2026-09-27 자료집 개선안) ───────────────────────────────────────────
// 레일 왼쪽 64px 세로 띠에 그룹 7개를 아이콘+짧은 이름으로 세우고, 옆 목록(.db-tabs)은
// **보고 있는 그룹 구획만** 보인다. 30개 넘는 탭이 한 줄로 쌓여 늘 스크롤되던 레일이
// 그룹당 4~8줄이 된다.
//
// .db-tabs 의 평평한 DOM 계약(검색 → 개요 → 그룹 머리·탭 번갈아)은 그대로 둔다 — 띠는 형제다.
// 어떤 그룹을 보일지는 레일의 data-view-group 한 속성이 정하고, 구획을 숨기는 것은 CSS 다.
// 그래서 탭 버튼의 hidden(빈 탭 접기·검색)과 섞이지 않고, 검색 중에는 CSS 가 구획 제한을 푼다.
let viewedGroupSlug: string | null = null;
// 띠가 마지막으로 따라간 활성 탭. 활성 탭이 **바뀐 때만** 그 그룹으로 옮긴다 — 매번 옮기면
// 띠 클릭(viewGroup)이 고른 그룹을 syncGroupStrip 이 곧바로 활성 탭의 그룹으로 되돌린다
// (2026-09-28 사용자 보고: 「사이드바 눌러도 메뉴가 안 바뀐다」).
let groupFollowedTab: DatabaseTab | null = null;

function groupStripOf(header: HTMLElement): HTMLElement | null {
  const strip = header.previousElementSibling;
  return strip instanceof HTMLElement && strip.classList.contains("db-group-strip") ? strip : null;
}

function currentViewedGroup(): string {
  return viewedGroupSlug ?? groupForTab(activeTab)?.slug ?? TAB_GROUPS[0]!.slug;
}

function syncGroupStrip(header: HTMLElement): void {
  // 활성 탭이 바뀌면(조수 점프·딥링크 포함) 그 탭의 그룹을 본다. 개요는 그룹 밖이라 보던 그룹을 둔다.
  if (groupFollowedTab !== activeTab) {
    groupFollowedTab = activeTab;
    const owner = groupForTab(activeTab)?.slug;
    if (owner) viewedGroupSlug = owner;
  }
  const slug = currentViewedGroup();
  header.dataset.viewGroup = slug;
  markViewedSection(header, slug);
  const strip = groupStripOf(header);
  if (!strip) return;
  for (const button of Array.from(strip.children)) {
    if (!(button instanceof HTMLElement)) continue;
    const on = button.dataset.groupSlug === slug;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  }
}

/** 구획 소속을 행마다 data-in-view 로 적는다 — CSS 가 이것만 보고 다른 구획을 숨긴다. */
function markViewedSection(header: HTMLElement, slug: string): void {
  let current: string | null = null;
  for (const child of railChildren(header)) {
    const classes = child.classList;
    if (!classes) continue;
    if (classes.contains("db-tab-group")) current = child.dataset.groupSlug ?? null;
    else if (!classes.contains("db-tab") && !classes.contains("db-tab-fold")) continue;
    // 개요와 검색 결과 보조 목적지는 구획 밖이다 — 늘 보인다.
    if (current === null || child.dataset.searchSecondary) {
      delete child.dataset.inView;
      continue;
    }
    child.dataset.inView = current === slug ? "1" : "0";
  }
}

function viewGroup(header: HTMLElement, slug: string): void {
  viewedGroupSlug = slug;
  syncGroupStrip(header);
  header.scrollTop = 0;
}

function buildGroupStrip(header: HTMLElement): HTMLElement {
  return el("nav", {
    class: "db-group-strip",
    attrs: { "aria-label": "자료 분류" },
    dataset: { testid: "db-group-strip" },
    children: TAB_GROUPS.map((group) => el("button", {
      class: "db-group-strip-btn",
      attrs: { type: "button", title: group.label, "aria-pressed": "false" },
      dataset: { testid: `db-group-strip-${group.slug}`, groupSlug: group.slug },
      children: [makeDatabaseGroupIcon(group.slug), el("span", { class: "db-group-strip-label", text: group.label })],
      on: { click: () => viewGroup(header, group.slug) },
    })),
  });
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
  // 탭 이동은 activeTab 을 먼저 바꾸고 이 함수를 부른다. 그래서 "직전에 이 본문에 그린 탭"과
  // 비교해야 옛 탭의 스크롤이 새 탭으로 새지 않는다.
  const sameTabRedraw = lastRenderedTab.get(body) === activeTab;
  const scrollTab = activeTab;
  const scrollSnapshot = sameTabRedraw ? snapshotBodyScroll(body) : [];
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
  lastRenderedTab.set(body, activeTab);
  // 같은 탭을 다시 그렸을 때만 되돌린다. 탭을 옮긴 경우는 새 화면의 맨 위가 맞다.
  if (activeTab === scrollTab) restoreBodyScroll(body, scrollSnapshot);
}

const lastRenderedTab = new WeakMap<HTMLElement, DatabaseTab>();

/**
 * 값 하나를 바꿔도(숫자 ±, 버튼, 통행 토글…) 저장소 갱신이 탭 본문을 통째로 새로 그린다.
 * 목록은 각 뷰가 제 스크롤을 되돌리지만 상세·설정 칸은 그러지 않아 매번 맨 위로 튀었다
 * (실측 2026-09-28: 몬스터·적 그룹·속성·전투 애니메이션·타일 상세, 400px → 0).
 * 새로 그리기 전에 스크롤된 칸을 적어 두고, 새로 그린 뒤 같은 자리의 새 칸에 되돌린다.
 */
type BodyScrollEntry = { readonly node: HTMLElement; readonly key: string; readonly ordinal: number; readonly top: number; readonly left: number };

function scrollKey(node: HTMLElement): string {
  const testid = node.dataset?.testid;
  return testid ? `#${testid}` : `${node.tagName}.${node.classList?.[0] ?? ""}`;
}

function snapshotBodyScroll(body: HTMLElement): readonly BodyScrollEntry[] {
  if (typeof body.querySelectorAll !== "function") return [];
  const ordinals = new Map<string, number>();
  const entries: BodyScrollEntry[] = [];
  for (const node of Array.from(body.querySelectorAll<HTMLElement>("*"))) {
    const top = node.scrollTop || 0;
    const left = node.scrollLeft || 0;
    if (top <= 0 && left <= 0) continue;
    const key = scrollKey(node);
    const ordinal = ordinals.get(key) ?? 0;
    ordinals.set(key, ordinal + 1);
    entries.push({ node, key, ordinal, top, left });
  }
  return entries;
}

function restoreBodyScroll(body: HTMLElement, entries: readonly BodyScrollEntry[]): void {
  if (entries.length === 0 || !body.isConnected) return;
  const pending: { node: HTMLElement; entry: BodyScrollEntry }[] = [];
  for (const entry of entries) {
    // 살아남은 같은 노드는 제 위치를 그대로 갖고 있다 — 건드리지 않는다.
    if (entry.node.isConnected && body.contains(entry.node)) continue;
    const candidates = Array.from(body.querySelectorAll<HTMLElement>("*")).filter((node) => scrollKey(node) === entry.key);
    const node = candidates[entry.ordinal];
    if (!node) continue;
    // 뷰가 스스로 위치를 정했으면(선택 행 보이기 등) 그 뜻을 따른다.
    if ((node.scrollTop || 0) > 0 || (node.scrollLeft || 0) > 0) continue;
    node.scrollTop = entry.top;
    node.scrollLeft = entry.left;
    // 내용이 아직 덜 그려져 목표에 못 닿았으면 다음 프레임에 한 번 더 넣는다.
    if (node.scrollTop < entry.top - 1 || node.scrollLeft < entry.left - 1) pending.push({ node, entry });
  }
  if (pending.length === 0 || typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    for (const { node, entry } of pending) {
      if (!node.isConnected) continue;
      if (entry.top > 0) node.scrollTop = entry.top;
      if (entry.left > 0) node.scrollLeft = entry.left;
    }
  });
}

function renderActiveTabUnguarded(
  body: HTMLElement,
  container: HTMLElement,
  options: { readonly forceFresh?: boolean } = {},
): void {
  const tab = activeTab;
  let cache = tabRenderCacheFor(container);
  // Cinematic callbacks and player ownership cannot survive detached caching.
  // Other tabs retain their existing cache policy.
  for (const cinematicTab of ["opening", "gameOver"] as const) {
    evictDatabaseTabView(cache, cinematicTab);
  }
  disposeDatabaseCinematicsIn(body);
  // Map renderers share selection/mode sessions. Detached DOM cannot represent a
  // newer session after visiting a sibling. Other domains retain their cache lifecycle.
  const mapView = groupForTab(tab)?.slug === "world";
  if (options.forceFresh || mapView || tab === "characterAppearances") evictDatabaseTabView(cache, tab);
  const cached = cache.views.get(tab);
  if (cached) {
    retainDatabasePreviewsIn(body, true);
    stopSkillAnimationStagesIn(body);
    body.replaceChildren(...cached);
    retainDatabasePreviewsIn(body, false);
    resumeSkillAnimationStagesIn(body);
    return;
  }

  retainDatabasePreviewsIn(body, true);
  stopSkillAnimationStagesIn(body);
  body.replaceChildren();
  const content = mapView ? el("div", { class: "db-map-content" }) : body;
  if (mapView) {
    // 링크가 하나도 없으면 빈 내비 바만 남는다 — 그 경우 아예 안 단다.
    const contextNav = renderMapContextNav(tab, container);
    body.append(...(contextNav ? [contextNav, content] : [content]));
  }
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
  const subviews = partySubviewNav(tab, container);
  if (subviews) body.append(subviews);
  // 포획 경고는 포획을 저작하는 종족 탭에만 띄운다 — 몬스터·적 그룹 탭마다 한 줄씩 먹던 띠였다.
  if (tab === "monsterSpecies") {
    const banner = collectionGateBanner(container);
    if (banner) body.append(banner);
  }
  switch (tab) {
    case "characterAppearances":
      renderCharacterAppearancesTab(body);
      break;
    case "promotionTree":
    case "skillTrees":
      renderGrowthTreeTab(body, tab === 'promotionTree' ? 'promotion' : 'skill', undefined, target => {
        const destination = target === 'promotion' ? 'promotionTree' : target === 'skill' ? 'skillTrees' : 'actors';
        evictDatabaseTabView(tabRenderCacheFor(container), destination);
        switchDatabaseActiveTab(destination, container);
        if (target === 'actors') {
          const selector = body.querySelector<HTMLElement>('[data-testid="db-picker-class"]');
          selector?.scrollIntoView({ block: 'nearest' });
          selector?.focus();
        }
      });
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
    case "retroChoreographies":
      renderRetroChoreographyTab(content, rerender);
      break;
    case "elements":
      renderElementsTab(body);
      break;
    case "terrain":
      renderTerrainTab(content);
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
    case "characterGraphics":
      renderCharacterGraphicsTab(body, rerender);
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
      renderTilesetsTab(content, rerender);
      break;
    case "spatialTiles":
    case "spatialObjects":
    case "spatialSpaces":
    case "spatialPlaces":
    case "spatialRegions":
    case "spatialWorlds": {
      const shellTab = SHELL_TAB_BY_SPATIAL[tab];
      if (shellTab) renderSpatialAuthoringShell(content, shellTab, rerender);
      break;
    }
    case "structureKits":
      renderStructureKitsTab(content, rerender);
      break;
    case "tilesetSpaces":
      renderTilesetSpacesTab(content, rerender);
      break;
    case "scratchConcepts":
      renderScratchConceptTab(content, rerender);
      break;
    case "worldCanon":
      renderWorldCanonTab(body, rerender);
      break;
    case "worldCodex":
      renderWorldCodexTab(body, container);
      break;
    case "system":
      renderSystemTab(body, rerender);
      break;
    case "opening":
    case "gameOver":
      renderDatabaseCinematicTab(body, tab, () => activeTab === tab);
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
  resumeSkillAnimationStagesIn(body);
}

registerAppearanceGenerationUI((appearanceId) => {
  selectCharacterAppearance(appearanceId);
  return import("./databaseModal").then(({ openDatabaseModal }) => openDatabaseModal("characterAppearances"));
});

function evictDatabaseTabView(cache: DatabaseTabRenderCache, tab: DatabaseTab): void {
  for (const node of cache.views.get(tab) ?? []) {
    if (node instanceof HTMLElement) {
      disposeDatabasePreviewsIn(node);
      disposeDatabaseCinematicsIn(node);
    }
  }
  cache.views.delete(tab);
}

/** Close includes detached cache entries, not just the connected modal subtree. */
export function disposeDatabasePanelPreviews(container: HTMLElement): void {
  disposeDatabasePreviewsIn(container);
  const cache = tabRenderCaches.get(container);
  if (cache) for (const nodes of cache.views.values()) {
    for (const node of nodes) if (node instanceof HTMLElement) disposeDatabasePreviewsIn(node);
  }
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
 * 나오지 않는다 — 종족 탭 상단에 경고와 시스템 탭 점프를 준다(닫으면 다시 뜨지 않는다).
 */
const COLLECTION_GATE_DISMISSED_KEY = "oprn:db-collection-gate-dismissed";

function collectionGateBanner(container: HTMLElement): HTMLElement | null {
  const project = store.getCurrent();
  if (project.system.monsterCollection === true) return null;
  if (readCollectionGateDismissed()) return null;
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
      el("button", {
        class: "btn small ghost",
        attrs: { type: "button", "aria-label": "포획 경고 닫기" },
        text: "닫기",
        dataset: { testid: "db-collection-gate-dismiss" },
        on: {
          click: (event) => {
            try {
              window.localStorage.setItem(COLLECTION_GATE_DISMISSED_KEY, "1");
            } catch {
              /* private mode */
            }
            (event.currentTarget as HTMLElement).closest(".db-collection-gate-warn")?.remove();
          },
        },
      }),
    ],
  });
}

function readCollectionGateDismissed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(COLLECTION_GATE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function readStoredActiveTab(): DatabaseTab {
  if (typeof window === "undefined") return "actors";
  const stored = window.localStorage.getItem(DATABASE_ACTIVE_TAB_KEY);
  if (stored === "equipment") {
    inventoryCatalogSession().collection = "equipment";
    inventoryCatalogSession().filter = "equipment";
    return "items";
  }
  return isDatabaseTab(stored) ? resolveCanonicalDatabaseTab(stored) : "actors";
}

function isDatabaseTab(value: string | null): value is DatabaseTab {
  return tabs.some((tab) => tab.id === value);
}

/** 파티 레코드의 보기 전환 줄 — 「직업 편집 | 승급 트리」처럼 같은 데이터의 두 얼굴. */
function partySubviewNav(tab: DatabaseTab, container: HTMLElement): HTMLElement | null {
  const owner = PARTY_SUBVIEW_PARENT[tab] ?? tab;
  const views = PARTY_SUBVIEWS[owner];
  if (!views) return null;
  return el("nav", {
    class: "db-party-subviews",
    attrs: { "aria-label": `${databaseTabLabel(owner)} 보기` },
    dataset: { testid: "db-party-subviews" },
    children: views.map((view) => el("button", {
      class: `db-party-subview${view.tab === tab ? " active" : ""}`,
      text: view.label,
      attrs: {
        type: "button",
        ...(view.tab === tab ? { "aria-current": "page" } : {}),
      },
      dataset: { testid: `db-subview-${view.slug}`, tab: view.tab },
      on: {
        click: () => {
          if (view.tab !== activeTab) switchDatabaseActiveTab(view.tab, container);
        },
      },
    })),
  });
}

/** 맵 그룹의 관련 편집 링크 바. 걸 링크가 없으면 null — 빈 바를 그리지 않는다. */
function renderMapContextNav(tab: DatabaseTab, container: HTMLElement): HTMLElement | null {
  const nav = el("nav", {
    class: "db-map-context-nav",
    attrs: { "aria-label": "맵 관련 편집" },
    dataset: { testid: "db-map-context-nav" },
  });
  const addLink = (target: DatabaseTab, back = false): void => {
    nav.append(el("button", {
      class: "btn small",
      // 앞으로 가는 링크는 「→」로 어디론가 넘어간다는 걸 보인다 — 맨 칩은 무엇의 버튼인지 안 읽혔다.
      text: back ? `← ${databaseTabLabel(target)} 돌아가기` : `${databaseTabLabel(target)} 열기 →`,
      attrs: {
        type: "button",
        ...(target === "terrain" ? { title: "타일별 지형 효과(통행·이동 판정)를 편집합니다" } : {}),
      },
      dataset: { testid: back ? "db-context-back" : `db-context-${target}`, tab: target },
      on: { click: () => switchDatabaseActiveTab(target, container) },
    }));
  };
  const parent = MAP_PARENT_TAB[tab];
  if (parent) addLink(parent, true);
  // Legacy mode routes are facets of the same tileset workspace, not extra rails.
  const context = tab === "tilesetAutotile" || tab === "tilesetUnlabeled" ? "spatialTiles" : tab;
  for (const [child, owner] of Object.entries(MAP_PARENT_TAB)) {
    // tilesetAutotile·tilesetUnlabeled 는 같은 타일셋 작업대의 facet 이라 별도 링크를 안 건다.
    // spatialSpaces(「장소 편집」)는 사정이 다르다 — 레일 그룹에서도 빠져 있어서 여기까지
    // 막으면 **자유 텍스트 검색이 유일한 진입로**가 된다. 정보구조가 스스로 spatialPlaces 를
    // 부모로 선언해 놓고(MAP_PARENT_TAB) 그 부모에서 오는 링크만 막던 자기모순이었다.
    // 형제 facet 인 terrain 은 이미 링크가 살아 있다.
    if (owner === context && child !== "tilesetAutotile" && child !== "tilesetUnlabeled") {
      addLink(child as DatabaseTab);
    }
  }
  return nav.childElementCount > 0 ? nav : null;
}
