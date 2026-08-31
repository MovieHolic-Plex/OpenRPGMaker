// 낚시·채집·박물관 탭 (life-collections) — 2026-08 모던 워크스페이스 개편.
//
// 이전 구조에는 **인스펙터가 아예 없었다**. 네 컬렉션의 레코드가 "이름 입력 + 요약
// 텍스트 + 빨간 삭제" 한 줄로만 그려져서, 실제 저작 대상인
//   - 낚시터의 어획 표(어종/가중치/계절/시간대/날씨/최소 숙련도)와 영역 사각형
//   - 채집 구역의 채집 표(계절별 드롭)와 스폰 규칙
//   - 박물관 보상의 조건(기부 수/지정 아이템)과 보상 페이로드
// 는 UI 어디에서도 만질 수 없었다. 오직 editor/tools/lifeCollectionTools.ts 의
// configure_* 툴(=AI 에이전트)로만 도달 가능했다(감사 C 축 P0).
//
// 여기서는 목록/상세 워크스페이스를 깔고, 위 필드를 전부 인스펙터로 끌어올린다.
// 시스템 스위치(낚시/채집/박물관/도감 사용 여부, 기력 소모, 기부 가능 아이템,
// 도감 추적 아이템)도 탭 수준 카드로 노출한다 — 역시 예전엔 툴 전용이었다.
//
// 큰 장식 히어로 이미지(≈245px)는 상세 히어로의 56px 미디어로 강등했다.
//
// DOM 계약: `db-life-collections-name-<kind>-<id>` / `-delete-<kind>-<id>` /
// `db-life-collections-<kind>` 섹션 앵커는 그대로 둔다. 비활성 레코드 인스펙터는
// `hidden` 으로 감추되 DOM 에는 남긴다(용어 탭과 같은 계약 보존 패턴).

import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { field, matchesNameOrId, numberField, toggleSwitch } from "@/editor/panels/databaseControls";
import { renderLifePanel } from "@/editor/panels/databaseLifeUi";
import {
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  noticeBar,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { SEASONS, TIME_PHASES, type Season, type TimePhase } from "@/project/gameTime";
import { store } from "@/project/store";
import type {
  BundleRewardDefinition,
  FishSpeciesRecord,
  FishingCatchRule,
  FishingSpotDefinition,
  ForageAreaDefinition,
  ForageEntryDefinition,
  MuseumRewardDefinition,
  Project,
  Rect,
  WeatherKind,
} from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const WEATHER_KINDS: readonly WeatherKind[] = ["none", "rain", "storm", "snow", "fog"];
const SEASON_LABEL: Readonly<Record<Season, string>> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
const TIME_PHASE_LABEL: Readonly<Record<TimePhase, string>> = { morning: "아침", day: "낮", evening: "저녁", night: "밤" };
const WEATHER_LABEL: Readonly<Record<WeatherKind, string>> = { none: "맑음", rain: "비", storm: "폭풍", snow: "눈", fog: "안개" };

type LifeCollectionKind = "fish" | "fishing" | "forage" | "museum";
type Selection = { readonly kind: LifeCollectionKind; readonly id: string };

const GROUP_LABEL: Readonly<Record<LifeCollectionKind, string>> = {
  fish: "물고기",
  fishing: "낚시터",
  forage: "채집 구역",
  museum: "박물관 보상",
};

let lifeSearch = "";
let lifeFilter: LifeCollectionKind | "all" = "all";
let lifeSelection: Selection | null = null;

// ---------------------------------------------------------------------------
// 탭 본체
// ---------------------------------------------------------------------------

export function renderLifeCollectionsTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const fish = project.database.fishSpecies ?? [];
  const spots = project.system.fishing?.spots ?? [];
  const areas = project.system.seasonalForage?.areas ?? [];
  const rewards = project.system.museum?.rewards ?? [];
  const total = fish.length + spots.length + areas.length + rewards.length;

  lifeSelection = resolveSelection(project, lifeSelection);
  const selection = lifeSelection;

  const rows: HTMLElement[] = [];
  pushGroup(rows, "fish", fish.map((row, index) => collectionRow("fish", row.id, row.name, itemName(project, row.itemId), index, rerender)));
  pushGroup(rows, "fishing", spots.map((row, index) => collectionRow("fishing", row.id, row.name ?? row.id, `${row.catches.length}종`, index, rerender)));
  pushGroup(rows, "forage", areas.map((row, index) => collectionRow("forage", row.id, row.name ?? row.id, `하루 ${row.dailySpawnCount}`, index, rerender)));
  pushGroup(rows, "museum", rewards.map((row, index) => collectionRow("museum", row.id, row.name ?? row.id, row.minDonations ? `${row.minDonations}개` : `${row.requiredItemIds?.length ?? 0}종`, index, rerender)));

  const list = listPane({
    title: "생활 컬렉션",
    count: total,
    search: listSearch({
      placeholder: "이름 또는 ID 검색",
      value: lifeSearch,
      testid: "db-life-collections-search",
      onInput: (value) => { lifeSearch = value; rerender(); },
    }),
    chips: filterChips(rerender, { fish: fish.length, fishing: spots.length, forage: areas.length, museum: rewards.length }),
    rows,
    empty: lifeSearch
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${lifeSearch}" 와 일치하는 항목이 없습니다.`, compact: true })
      : emptyState({ icon: "🎣", title: "아직 컬렉션이 없습니다", compact: true }),
    toolbar: listToolbar([
      { label: "+ 물고기", kind: "primary", testid: "db-life-collections-add-fish", onClick: () => addFish(rerender) },
      { label: "+ 낚시터", testid: "db-life-collections-add-spot", onClick: () => addSpot(rerender) },
      { label: "+ 채집 구역", testid: "db-life-collections-add-forage", onClick: () => addForage(rerender) },
      { label: "+ 박물관 보상", testid: "db-life-collections-add-museum", onClick: () => addMuseumReward(rerender) },
    ]),
    testid: "db-life-collections-list-pane",
  });

  const panels = el("div", { class: "db-ws-section-panels db-life-panels" });
  // .db-ws-detail-body 는 flex column 이라 자식이 내용보다 작게 눌릴 수 있다 —
  // 그러면 그리드 내용이 넘쳐 아래 형제(시스템 카드)와 겹쳐 보인다.
  panels.style.flexShrink = "0";
  for (const record of fish) {
    panels.append(panelHost(`db-life-collections-panel-fish-${record.id}`, isActive(selection, "fish", record.id), fishInspector(record, rerender)));
  }
  for (const record of spots) {
    panels.append(panelHost(`db-life-collections-panel-fishing-${record.id}`, isActive(selection, "fishing", record.id), spotInspector(record, project, rerender)));
  }
  for (const record of areas) {
    panels.append(panelHost(`db-life-collections-panel-forage-${record.id}`, isActive(selection, "forage", record.id), areaInspector(record, project, rerender)));
  }
  for (const record of rewards) {
    panels.append(panelHost(`db-life-collections-panel-museum-${record.id}`, isActive(selection, "museum", record.id), rewardInspector(record, project, rerender)));
  }
  if (!selection) panels.append(panelHost("db-life-collections-empty", true, onboardingBoard(rerender)));

  const summary = renderLifePanel({
    testid: "db-life-collections-stats",
    title: selection ? selectionTitle(project, selection) : "생활 컬렉션",
    headingTestid: "db-life-collections-hero",
    media: el("img", {
      class: "db-life-panel-art",
      attrs: { src: FARMING_LIFE_UI_ASSETS.foraging, alt: "계절 채집과 수집 도감", loading: "lazy" },
      dataset: { testid: "db-life-collections-hero-image" },
    }),
    compact: true,
    cards: [
      { testid: "db-life-collections-stat-fish", icon: "capture", label: "물고기", value: String(fish.length), detail: "지급 아이템 연결", state: fish.length ? "ready" : "info", onClick: () => { lifeFilter = "fish"; rerender(); } },
      { testid: "db-life-collections-stat-fishing", icon: "field", label: "낚시터", value: String(spots.length), detail: "출현 조건 표", state: spots.length ? "ready" : "info", onClick: () => { lifeFilter = "fishing"; rerender(); } },
      { testid: "db-life-collections-stat-forage", icon: "crop", label: "채집", value: String(areas.length), detail: "계절별 드롭", state: areas.length ? "ready" : "info", onClick: () => { lifeFilter = "forage"; rerender(); } },
      { testid: "db-life-collections-stat-museum", icon: "item", label: "박물관", value: String(rewards.length), detail: "한 번만 지급", state: rewards.length ? "ready" : "info", onClick: () => { lifeFilter = "museum"; rerender(); } },
    ],
  });

  const detail = detailPane({
    body: [
      shrinkless(summary),
      panels,
      shrinkless(systemStack(project, rerender)),
    ],
    testid: "db-life-collections-detail-pane",
  });

  host.append(workspaceShell({ list, detail, legacyClass: "db-life-collections-ws", testid: "db-life-collections-workspace" }));
}

function pushGroup(rows: HTMLElement[], kind: LifeCollectionKind, built: readonly HTMLElement[]): void {
  if (built.length === 0) return;
  if (lifeFilter !== "all" && lifeFilter !== kind) return;
  const visible = built.filter((node) => node.dataset.lifeHidden !== "1");
  rows.push(el("div", {
    class: "db-life-group",
    dataset: { testid: `db-life-collections-${kind}` },
    children: [
      el("div", {
        class: "db-life-group-head",
        children: [
          el("span", { class: "db-life-group-title", text: GROUP_LABEL[kind] }),
          el("span", { class: "db-life-group-count", text: `${built.length}` }),
        ],
      }),
      ...(visible.length > 0 ? visible : [el("p", { class: "db-life-group-empty", text: "검색과 일치하는 항목이 없습니다." })]),
    ],
  }));
}

function shrinkless(node: HTMLElement): HTMLElement {
  node.style.flexShrink = "0";
  return node;
}

/** db-ws-stack 한 행을 통째로 쓰게 한다(안내 바처럼 가로로 긴 것). */
function spanned(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}

function isActive(selection: Selection | null, kind: LifeCollectionKind, id: string): boolean {
  return selection?.kind === kind && selection.id === id;
}

function panelHost(testid: string, active: boolean, body: HTMLElement): HTMLElement {
  const node = el("div", { class: "db-ws-section-panel", dataset: { testid }, children: [body] });
  if (!active) node.setAttribute("hidden", "");
  return node;
}

function resolveSelection(project: Project, current: Selection | null): Selection | null {
  const has = (kind: LifeCollectionKind, id: string): boolean => recordIds(project, kind).includes(id);
  if (current && has(current.kind, current.id)) return current;
  for (const kind of ["fish", "fishing", "forage", "museum"] as const) {
    const first = recordIds(project, kind)[0];
    if (first) return { kind, id: first };
  }
  return null;
}

function recordIds(project: Project, kind: LifeCollectionKind): string[] {
  if (kind === "fish") return (project.database.fishSpecies ?? []).map((row) => row.id);
  if (kind === "fishing") return (project.system.fishing?.spots ?? []).map((row) => row.id);
  if (kind === "forage") return (project.system.seasonalForage?.areas ?? []).map((row) => row.id);
  return (project.system.museum?.rewards ?? []).map((row) => row.id);
}

function selectionTitle(project: Project, selection: Selection): string {
  if (selection.kind === "fish") return project.database.fishSpecies?.find((row) => row.id === selection.id)?.name ?? selection.id;
  if (selection.kind === "fishing") return project.system.fishing?.spots.find((row) => row.id === selection.id)?.name ?? selection.id;
  if (selection.kind === "forage") return project.system.seasonalForage?.areas.find((row) => row.id === selection.id)?.name ?? selection.id;
  return project.system.museum?.rewards.find((row) => row.id === selection.id)?.name ?? selection.id;
}

function filterChips(rerender: () => void, counts: Readonly<Record<LifeCollectionKind, number>>): HTMLElement {
  const chip = (id: LifeCollectionKind | "all", label: string): HTMLElement => el("button", {
    class: `db-filter-chip${lifeFilter === id ? " active" : ""}`,
    text: label,
    attrs: { type: "button", "aria-pressed": lifeFilter === id ? "true" : "false" },
    dataset: { testid: `db-life-collections-chip-${id}` },
    on: { click: () => { lifeFilter = id; rerender(); } },
  });
  return el("div", {
    class: "db-filter-chips db-life-chips",
    attrs: { role: "group", "aria-label": "생활 컬렉션 분류" },
    children: [
      chip("all", "전체"),
      chip("fish", `물고기 ${counts.fish}`),
      chip("fishing", `낚시터 ${counts.fishing}`),
      chip("forage", `채집 ${counts.forage}`),
      chip("museum", `박물관 ${counts.museum}`),
    ],
  });
}

function collectionRow(
  kind: LifeCollectionKind,
  id: string,
  name: string,
  sub: string,
  index: number,
  rerender: () => void,
): HTMLElement {
  const row = listRow({
    name,
    sub,
    number: index + 1,
    title: id,
    active: isActive(lifeSelection, kind, id),
    testid: `db-life-collections-row-${kind}-${id}`,
    dataset: { recordId: id },
    onSelect: () => { lifeSelection = { kind, id }; rerender(); },
  });
  row.classList.add("db-row");
  // 삭제는 한 번 눌러 즉시 지우되 되돌리기 경로를 명시한다 — 이 탭의 삭제 계약
  // (`db-life-collections-delete-<kind>-<id>` 한 번 클릭 = 삭제)이 테스트에 박혀 있다.
  const remove = el("button", {
    class: "db-ws-row-delete",
    text: "삭제",
    attrs: { type: "button", "aria-label": `${name} 삭제` },
    dataset: { testid: `db-life-collections-delete-${kind}-${id}` },
    on: { click: () => deleteRecord(kind, id, rerender) },
  });
  const wrap = el("div", { class: "db-ws-row-wrap db-life-row-wrap", children: [row, remove] });
  if (!matchesNameOrId(name, id, lifeSearch)) wrap.dataset.lifeHidden = "1";
  return wrap;
}

// ---------------------------------------------------------------------------
// 빈 상태 / 온보딩
// ---------------------------------------------------------------------------

function onboardingBoard(rerender: () => void): HTMLElement {
  const card = (title: string, hint: string, bullets: readonly string[], label: string, testid: string, onClick: () => void, kind: "primary" | "ghost"): HTMLElement =>
    sectionCard({
      title,
      hint,
      children: [
        el("ul", { class: "db-life-bullets", children: bullets.map((text) => el("li", { text })) }),
        el("div", {
          class: "db-ws-toolbar",
          children: [el("button", { class: `db-ws-btn db-ws-btn-${kind}`, text: label, attrs: { type: "button" }, dataset: { testid }, on: { click: onClick } })],
        }),
      ],
    });

  return el("div", {
    class: "db-ws-stack",
    children: [
      spanned(noticeBar({
        text: "물고기 → 낚시터 → 채집 구역 → 박물관 보상 순서로 이어집니다. 기본값을 만들면 넷이 연결된 상태로 채워집니다.",
        action: {
          label: "기본 생활 컬렉션 만들기",
          kind: "primary",
          testid: "db-life-collections-seed-defaults",
          onClick: () => seedDefaults(rerender),
        },
        testid: "db-life-collections-onboarding-notice",
      })),
      card("물고기", "어종 정의", [
        "낚았을 때 실제로 지급할 아이템",
        "낚시 숙련도 경험치",
      ], "물고기 추가", "db-life-collections-empty-add-fish", () => addFish(rerender), "ghost"),
      card("낚시터", "출현 조건 표", [
        "맵과 낚시 가능한 영역 사각형",
        "어종별 가중치 · 계절 · 시간대 · 날씨",
        "어종별 최소 낚시 숙련도",
      ], "낚시터 추가", "db-life-collections-empty-add-spot", () => addSpot(rerender), "ghost"),
      card("채집 구역", "날짜별 재생성", [
        "하루 스폰 수 · 최대 동시 수 · 소멸 일수",
        "채집물 가중치와 계절별 드롭 아이템",
      ], "채집 구역 추가", "db-life-collections-empty-add-forage", () => addForage(rerender), "ghost"),
      card("박물관 보상", "한 번만 지급", [
        "기부 개수 조건 또는 지정 아이템 조건",
        "골드 · 아이템 · 스위치 보상 페이로드",
      ], "박물관 보상 추가", "db-life-collections-empty-add-museum", () => addMuseumReward(rerender), "ghost"),
    ],
  });
}

// ---------------------------------------------------------------------------
// 인스펙터 — 물고기
// ---------------------------------------------------------------------------

function fishInspector(record: FishSpeciesRecord, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const usedBy = (project.system.fishing?.spots ?? []).filter((spot) => spot.catches.some((rule) => rule.fishId === record.id));
  return el("div", {
    class: "db-ws-stack",
    children: [
      sectionCard({
        title: "기본 정보",
        hint: `ID ${record.id}`,
        children: [
          nameInput("이름", `db-life-collections-name-fish-${record.id}`, record.name, (value) => patchFish(record.id, { name: value }), rerender),
          chooserField("지급 아이템", `db-life-collections-fish-item-${record.id}`, record.itemId, itemOptions(project), (itemId) => patchFish(record.id, { itemId }, rerender)),
          numberField("낚시 숙련 경험치", `db-life-collections-fish-skillxp-${record.id}`, record.skillXp ?? 0, (skillXp) => patchFish(record.id, { skillXp }), { min: 0, max: 9999 }),
        ],
        testid: `db-life-collections-fish-basics-${record.id}`,
      }),
      sectionCard({
        title: "출현하는 낚시터",
        hint: `${usedBy.length}곳`,
        children: usedBy.length > 0
          ? usedBy.map((spot) => el("p", { class: "db-ws-usage db-ws-usage-active", text: `${spot.name ?? spot.id} · ${spot.mapId}` }))
          : [el("p", { class: "db-ws-usage", text: "아직 어느 낚시터에도 등록되지 않았습니다. 낚시터의 어획 표에 추가하세요." })],
        testid: `db-life-collections-fish-usage-${record.id}`,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 인스펙터 — 낚시터
// ---------------------------------------------------------------------------

function spotInspector(record: FishingSpotDefinition, project: Project, rerender: () => void): HTMLElement {
  const fishList = project.database.fishSpecies ?? [];
  const cards: HTMLElement[] = [
    sectionCard({
      title: "기본 정보",
      hint: `ID ${record.id}`,
      children: [
        nameInput("이름", `db-life-collections-name-fishing-${record.id}`, record.name ?? "", (value) => patchSpot(record.id, { name: value || undefined }), rerender),
        chooserField("맵", `db-life-collections-fishing-map-${record.id}`, record.mapId, mapOptions(project), (mapId) => patchSpot(record.id, { mapId }, rerender)),
      ],
      testid: `db-life-collections-fishing-basics-${record.id}`,
    }),
    rectCard("낚시 가능 영역", `db-life-collections-fishing-area-${record.id}`, record.area, project, record.mapId, (area) => patchSpot(record.id, { area })),
  ];

  for (const [index, rule] of record.catches.entries()) {
    const fishName = fishList.find((entry) => entry.id === rule.fishId)?.name ?? rule.fishId;
    const prefix = `db-life-collections-fishing-catch-${record.id}-${index}`;
    const card = sectionCard({
      title: `어획 ${index + 1} · ${fishName}`,
      hint: "비우면 모든 계절/시간/날씨",
      children: [
        el("div", {
          class: "db-life-inline-row",
          children: [
            chooserField("어종", `${prefix}-fish`, rule.fishId, fishList.map(namedOption), (fishId) => patchCatch(record.id, index, { fishId }, rerender)),
            numberField("가중치", `${prefix}-weight`, rule.weight, (weight) => patchCatch(record.id, index, { weight }), { min: 1, max: 999 }),
            numberField("최소 숙련도", `${prefix}-minskill`, rule.minSkillLevel ?? 1, (minSkillLevel) => patchCatch(record.id, index, { minSkillLevel }), { min: 1, max: 99 }),
          ],
        }),
        toggleRow("계절", SEASONS, rule.seasons, SEASON_LABEL, `${prefix}-season`, (next) => patchCatch(record.id, index, { seasons: next }, rerender)),
        toggleRow("시간대", TIME_PHASES, rule.timePhases, TIME_PHASE_LABEL, `${prefix}-phase`, (next) => patchCatch(record.id, index, { timePhases: next }, rerender)),
        toggleRow("날씨", WEATHER_KINDS, rule.weatherKinds, WEATHER_LABEL, `${prefix}-weather`, (next) => patchCatch(record.id, index, { weatherKinds: next }, rerender)),
        el("div", {
          class: "db-ws-toolbar",
          children: [el("button", {
            class: "db-ws-row-delete db-life-inline-delete",
            text: "어획 규칙 삭제",
            attrs: { type: "button" },
            dataset: { testid: `${prefix}-delete` },
            on: { click: () => removeCatch(record.id, index, rerender) },
          })],
        }),
      ],
      testid: prefix,
    });
    card.classList.add("db-ws-span");
    cards.push(card);
  }

  cards.push(sectionCard({
    title: "어획 표 관리",
    hint: `${record.catches.length}종 등록됨`,
    children: [
      el("div", {
        class: "db-ws-toolbar",
        children: [el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "＋ 어획 규칙 추가",
          attrs: { type: "button", ...(fishList.length === 0 ? { disabled: "true" } : {}) },
          dataset: { testid: `db-life-collections-fishing-add-catch-${record.id}` },
          on: { click: () => addCatch(record.id, rerender) },
        })],
      }),
      ...(fishList.length === 0 ? [el("p", { class: "db-ws-usage", text: "먼저 물고기를 하나 이상 만들어야 어획 규칙을 추가할 수 있습니다." })] : []),
    ],
    testid: `db-life-collections-fishing-catches-${record.id}`,
  }));

  return el("div", { class: "db-ws-stack", children: cards });
}

// ---------------------------------------------------------------------------
// 인스펙터 — 채집 구역
// ---------------------------------------------------------------------------

function areaInspector(record: ForageAreaDefinition, project: Project, rerender: () => void): HTMLElement {
  const items = itemOptions(project);
  const cards: HTMLElement[] = [
    sectionCard({
      title: "기본 정보",
      hint: `ID ${record.id}`,
      children: [
        nameInput("이름", `db-life-collections-name-forage-${record.id}`, record.name ?? "", (value) => patchArea(record.id, { name: value || undefined }), rerender),
        chooserField("맵", `db-life-collections-forage-map-${record.id}`, record.mapId, mapOptions(project), (mapId) => patchArea(record.id, { mapId }, rerender)),
      ],
      testid: `db-life-collections-forage-basics-${record.id}`,
    }),
    rectCard("채집 구역", `db-life-collections-forage-area-${record.id}`, record.area, project, record.mapId, (area) => patchArea(record.id, { area })),
    sectionCard({
      title: "스폰 규칙",
      hint: "날짜가 바뀔 때 적용됩니다",
      children: [
        numberField("하루 스폰 수", `db-life-collections-forage-daily-${record.id}`, record.dailySpawnCount, (dailySpawnCount) => patchArea(record.id, { dailySpawnCount }), { min: 0, max: 99 }),
        numberField("최대 동시 수", `db-life-collections-forage-max-${record.id}`, record.maxActive, (maxActive) => patchArea(record.id, { maxActive }), { min: 0, max: 999 }),
        numberField("스폰 주기(일)", `db-life-collections-forage-every-${record.id}`, record.spawnEveryDays ?? 1, (spawnEveryDays) => patchArea(record.id, { spawnEveryDays }), { min: 1, max: 99 }),
        numberField("소멸까지(일)", `db-life-collections-forage-despawn-${record.id}`, record.despawnAfterDays, (despawnAfterDays) => patchArea(record.id, { despawnAfterDays }), { min: 1, max: 99 }),
      ],
      testid: `db-life-collections-forage-spawn-${record.id}`,
    }),
  ];

  for (const [index, entry] of record.entries.entries()) {
    const prefix = `db-life-collections-forage-entry-${record.id}-${index}`;
    const card = sectionCard({
      title: `채집물 ${index + 1}`,
      hint: "계절별 드롭을 지정하면 기본 아이템보다 우선합니다",
      children: [
        el("div", {
          class: "db-life-inline-row",
          children: [
            chooserField("기본 아이템", `${prefix}-item`, entry.itemId ?? "", [{ id: "", name: "(계절별 드롭만 사용)" }, ...items], (itemId) => patchEntry(record.id, index, { itemId: itemId || undefined }, rerender)),
            numberField("가중치", `${prefix}-weight`, entry.weight, (weight) => patchEntry(record.id, index, { weight }), { min: 1, max: 999 }),
          ],
        }),
        el("div", {
          class: "db-life-season-grid",
          children: SEASONS.map((season) => chooserField(
            SEASON_LABEL[season],
            `${prefix}-drop-${season}`,
            entry.seasonalDrops?.[season] ?? "",
            [{ id: "", name: "(없음)" }, ...items],
            (itemId) => {
              const next = { ...(entry.seasonalDrops ?? {}) } as Partial<Record<Season, string>>;
              if (itemId) next[season] = itemId;
              else delete next[season];
              patchEntry(record.id, index, { seasonalDrops: Object.keys(next).length > 0 ? next : undefined }, rerender);
            },
          )),
        }),
        el("div", {
          class: "db-ws-toolbar",
          children: [el("button", {
            class: "db-ws-row-delete db-life-inline-delete",
            text: "채집물 삭제",
            attrs: { type: "button" },
            dataset: { testid: `${prefix}-delete` },
            on: { click: () => removeEntry(record.id, index, rerender) },
          })],
        }),
      ],
      testid: prefix,
    });
    card.classList.add("db-ws-span");
    cards.push(card);
  }

  cards.push(sectionCard({
    title: "채집 표 관리",
    hint: `${record.entries.length}종 등록됨`,
    children: [el("div", {
      class: "db-ws-toolbar",
      children: [el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: "＋ 채집물 추가",
        attrs: { type: "button", ...(items.length === 0 ? { disabled: "true" } : {}) },
        dataset: { testid: `db-life-collections-forage-add-entry-${record.id}` },
        on: { click: () => addEntry(record.id, rerender) },
      })],
    })],
    testid: `db-life-collections-forage-entries-${record.id}`,
  }));

  return el("div", { class: "db-ws-stack", children: cards });
}

// ---------------------------------------------------------------------------
// 인스펙터 — 박물관 보상
// ---------------------------------------------------------------------------

function rewardInspector(record: MuseumRewardDefinition, project: Project, rerender: () => void): HTMLElement {
  const items = itemOptions(project);
  const itemRewards = record.reward?.itemRewards ?? [];
  return el("div", {
    class: "db-ws-stack",
    children: [
      sectionCard({
        title: "기본 정보",
        hint: `ID ${record.id}`,
        children: [
          nameInput("이름", `db-life-collections-name-museum-${record.id}`, record.name ?? "", (value) => patchReward(record.id, { name: value || undefined }), rerender),
        ],
        testid: `db-life-collections-museum-basics-${record.id}`,
      }),
      sectionCard({
        title: "해금 조건",
        hint: "기부 개수 또는 지정 아이템 중 하나는 필요합니다",
        children: [
          numberField("최소 기부 개수", `db-life-collections-museum-mindonations-${record.id}`, record.minDonations ?? 0, (value) => patchReward(record.id, { minDonations: value > 0 ? value : undefined }), { min: 0, max: 999 }),
          el("span", { class: "db-life-sublabel", text: `지정 아이템 ${record.requiredItemIds?.length ?? 0}종` }),
          itemChips(items, record.requiredItemIds ?? [], `db-life-collections-museum-required-${record.id}`, (next) => patchReward(record.id, { requiredItemIds: next.length > 0 ? next : undefined }, rerender)),
        ],
        testid: `db-life-collections-museum-condition-${record.id}`,
      }),
      sectionCard({
        title: "보상",
        hint: "한 번만 지급됩니다",
        children: [
          numberField("골드", `db-life-collections-museum-gold-${record.id}`, record.reward?.gold ?? 0, (gold) => patchRewardPayload(record.id, { gold: gold > 0 ? gold : undefined })),
          chooserField("켜는 스위치", `db-life-collections-museum-switch-${record.id}`, record.reward?.switchId ?? "", [{ id: "", name: "(없음)" }, ...project.switches.map(namedOption)], (switchId) => patchRewardPayload(record.id, { switchId: switchId || undefined }, rerender)),
          el("span", { class: "db-life-sublabel", text: `아이템 보상 ${itemRewards.length}종` }),
          ...itemRewards.map((entry, index) => el("div", {
            class: "db-life-inline-row",
            children: [
              chooserField("아이템", `db-life-collections-museum-reward-item-${record.id}-${index}`, entry.itemId, items, (itemId) => patchRewardItem(record.id, index, { itemId }, rerender)),
              numberField("개수", `db-life-collections-museum-reward-count-${record.id}-${index}`, entry.count, (count) => patchRewardItem(record.id, index, { count })),
              el("button", {
                class: "db-ws-row-delete db-life-inline-delete",
                text: "삭제",
                attrs: { type: "button", "aria-label": "아이템 보상 삭제" },
                dataset: { testid: `db-life-collections-museum-reward-delete-${record.id}-${index}` },
                on: { click: () => removeRewardItem(record.id, index, rerender) },
              }),
            ],
          })),
          el("div", {
            class: "db-ws-toolbar",
            children: [el("button", {
              class: "db-ws-btn db-ws-btn-ghost",
              text: "＋ 아이템 보상 추가",
              attrs: { type: "button", ...(items.length === 0 ? { disabled: "true" } : {}) },
              dataset: { testid: `db-life-collections-museum-reward-add-${record.id}` },
              on: { click: () => addRewardItem(record.id, rerender) },
            })],
          }),
        ],
        testid: `db-life-collections-museum-reward-${record.id}`,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 시스템 설정 (탭 전체에 하나)
// ---------------------------------------------------------------------------

function systemStack(project: Project, rerender: () => void): HTMLElement {
  const items = itemOptions(project);
  return el("div", {
    class: "db-ws-stack db-life-system",
    dataset: { testid: "db-life-collections-system" },
    children: [
      sectionCard({
        title: "시스템 사용 여부",
        hint: "끄면 해당 생활 루프가 게임에서 동작하지 않습니다",
        children: [
          toggleSwitch("낚시", "db-life-collections-system-fishing", project.system.fishing?.enabled ?? false, (enabled) => setFishingEnabled(enabled, rerender)),
          numberField("낚시 기력 소모", "db-life-collections-system-energy", project.system.fishing?.energyCost ?? 0, (energyCost) => setFishingEnergy(energyCost)),
          toggleSwitch("계절 채집", "db-life-collections-system-forage", project.system.seasonalForage?.enabled ?? false, (enabled) => setForageEnabled(enabled, rerender)),
          toggleSwitch("박물관", "db-life-collections-system-museum", project.system.museum?.enabled ?? false, (enabled) => setMuseumEnabled(enabled, rerender)),
          toggleSwitch("수집 도감", "db-life-collections-system-collections", project.system.collections?.enabled ?? false, (enabled) => setCollectionsEnabled(enabled, rerender)),
        ],
        testid: "db-life-collections-system-toggles",
      }),
      sectionCard({
        title: "박물관 기부 가능 아이템",
        hint: `${project.system.museum?.eligibleItemIds.length ?? 0}종`,
        collapsible: true,
        collapsed: (project.system.museum?.eligibleItemIds.length ?? 0) === 0,
        children: [itemChips(items, project.system.museum?.eligibleItemIds ?? [], "db-life-collections-museum-eligible", (next) => setEligibleItems(next, rerender))],
        testid: "db-life-collections-museum-eligible-card",
      }),
      sectionCard({
        title: "도감 추적 아이템",
        hint: `${project.system.collections?.trackedItemIds?.length ?? 0}종`,
        collapsible: true,
        collapsed: (project.system.collections?.trackedItemIds?.length ?? 0) === 0,
        children: [itemChips(items, project.system.collections?.trackedItemIds ?? [], "db-life-collections-tracked", (next) => setTrackedItems(next, rerender))],
        testid: "db-life-collections-tracked-card",
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 공용 컨트롤
// ---------------------------------------------------------------------------

function rectCard(
  title: string,
  testid: string,
  rect: Rect,
  project: Project,
  mapId: string,
  commit: (rect: Rect) => void,
): HTMLElement {
  const map = project.maps[mapId];
  const width = map?.width ?? 20;
  const height = map?.height ?? 15;
  const preview = rectPreview(rect, width, height);
  // 저장소 객체를 직접 건드리지 않는다 — 로컬 사본에 누적하고 통째로 커밋한다.
  let live: Rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  const push = (patch: Partial<Rect>): void => {
    live = { ...live, ...patch };
    commit(live);
    preview.update(live, width, height);
  };
  const card = sectionCard({
    title,
    hint: map ? `${map.name} ${map.width}×${map.height} 타일 기준` : "맵을 찾을 수 없습니다",
    children: [
      el("div", {
        class: "db-life-rect-row",
        children: [
          preview.node,
          el("div", {
            class: "db-life-rect-fields",
            children: [
              numberField("X", `${testid}-x`, rect.x, (x) => push({ x }), { min: 0, max: 999 }),
              numberField("Y", `${testid}-y`, rect.y, (y) => push({ y }), { min: 0, max: 999 }),
              numberField("너비", `${testid}-w`, rect.w, (w) => push({ w }), { min: 1, max: 999 }),
              numberField("높이", `${testid}-h`, rect.h, (h) => push({ h }), { min: 1, max: 999 }),
            ],
          }),
        ],
      }),
    ],
    testid,
  });
  return card;
}

function rectPreview(rect: Rect, mapWidth: number, mapHeight: number): {
  node: HTMLElement;
  update: (next: Rect, width: number, height: number) => void;
} {
  const frame = el("div", { class: "db-life-rect-frame", attrs: { "aria-hidden": "true" } });
  const box = el("div", { class: "db-life-rect-box" });
  const caption = el("span", { class: "db-life-rect-caption" });
  frame.append(box);
  const paint = (next: Rect, width: number, height: number): void => {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    box.style.left = `${clampPercent((next.x / w) * 100)}%`;
    box.style.top = `${clampPercent((next.y / h) * 100)}%`;
    box.style.width = `${clampPercent((next.w / w) * 100)}%`;
    box.style.height = `${clampPercent((next.h / h) * 100)}%`;
    caption.textContent = `(${next.x}, ${next.y}) ${next.w}×${next.h} · ${next.w * next.h}칸`;
  };
  paint(rect, mapWidth, mapHeight);
  return { node: el("div", { class: "db-life-rect", children: [frame, caption] }), update: paint };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function toggleRow<T extends string>(
  label: string,
  all: readonly T[],
  selected: readonly T[] | undefined,
  labels: Readonly<Record<T, string>>,
  testid: string,
  onChange: (next: T[] | undefined) => void,
): HTMLElement {
  const active = selected ?? [];
  const chips = all.map((value) => {
    const on = active.includes(value);
    return el("button", {
      class: `db-life-toggle-chip${on ? " active" : ""}`,
      text: labels[value],
      attrs: { type: "button", "aria-pressed": on ? "true" : "false" },
      dataset: { testid: `${testid}-${value}` },
      on: {
        click: () => {
          const next = on ? active.filter((entry) => entry !== value) : [...active, value];
          onChange(next.length > 0 && next.length < all.length ? next : next.length === 0 ? undefined : next);
        },
      },
    });
  });
  return el("div", {
    class: "db-life-toggle-field",
    children: [
      el("span", { class: "db-life-sublabel", text: `${label}${active.length === 0 ? " (전체)" : ""}` }),
      el("div", { class: "db-life-toggle-row", dataset: { testid }, children: chips }),
    ],
  });
}

function itemChips(
  items: readonly { readonly id: string; readonly name: string }[],
  selected: readonly string[],
  testid: string,
  onChange: (next: string[]) => void,
): HTMLElement {
  if (items.length === 0) return el("p", { class: "db-ws-usage", text: "프로젝트에 아이템이 없습니다." });
  return el("div", {
    class: "db-life-item-chips",
    dataset: { testid },
    children: items.map((item) => {
      const on = selected.includes(item.id);
      return el("button", {
        class: `db-life-toggle-chip${on ? " active" : ""}`,
        text: item.name,
        attrs: { type: "button", "aria-pressed": on ? "true" : "false", title: item.id },
        dataset: { testid: `${testid}-${item.id}` },
        on: { click: () => onChange(on ? selected.filter((entry) => entry !== item.id) : [...selected, item.id]) },
      });
    }),
  });
}

function nameInput(
  label: string,
  testid: string,
  value: string,
  commit: (value: string) => void,
  rerender: () => void,
): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value, dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("input", () => commit(input.value));
  input.addEventListener("change", () => { commit(input.value); rerender(); });
  return field(label, input);
}

function chooserField(
  label: string,
  testid: string,
  value: string,
  options: readonly { readonly id: string; readonly name: string }[],
  onChange: (value: string) => void,
): HTMLElement {
  const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
  for (const option of options) select.append(el("option", { text: option.name, attrs: { value: option.id } }));
  if (options.length === 0) select.append(el("option", { text: "(선택 가능한 항목 없음)", attrs: { value: "" } }));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return field(label, select);
}

function itemOptions(project: Project): { id: string; name: string }[] {
  return project.database.items.map(namedOption);
}

function mapOptions(project: Project): { id: string; name: string }[] {
  return Object.values(project.maps).map(namedOption);
}

function namedOption(record: { readonly id: string; readonly name: string }): { id: string; name: string } {
  return { id: record.id, name: record.name };
}

function itemName(project: Project, itemId: string): string {
  return project.database.items.find((item) => item.id === itemId)?.name ?? itemId;
}

// ---------------------------------------------------------------------------
// 저장소 변경
// ---------------------------------------------------------------------------

function patchFish(id: string, patch: Partial<FishSpeciesRecord>, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-life-fish:${id}`);
  store.update((draft) => {
    draft.database.fishSpecies = (draft.database.fishSpecies ?? []).map((row) => row.id === id ? { ...row, ...patch } : row);
  });
  rerender?.();
}

function patchSpot(id: string, patch: Partial<FishingSpotDefinition>, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-life-spot:${id}`);
  store.update((draft) => {
    if (!draft.system.fishing) return;
    draft.system.fishing = {
      ...draft.system.fishing,
      spots: draft.system.fishing.spots.map((row) => row.id === id ? { ...row, ...patch } : row),
    };
  });
  rerender?.();
}

function patchCatch(spotId: string, index: number, patch: Partial<FishingCatchRule>, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-life-catch:${spotId}:${index}`);
  store.update((draft) => {
    if (!draft.system.fishing) return;
    draft.system.fishing = {
      ...draft.system.fishing,
      spots: draft.system.fishing.spots.map((spot) => spot.id !== spotId ? spot : {
        ...spot,
        catches: spot.catches.map((rule, current) => current === index ? sanitize({ ...rule, ...patch }) : rule),
      }),
    };
  });
  rerender?.();
}

function sanitize<T extends Record<string, unknown>>(value: T): T {
  const next = { ...value };
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
  }
  return next;
}

function addCatch(spotId: string, rerender: () => void): void {
  const fishId = store.getCurrent().database.fishSpecies?.[0]?.id;
  if (!fishId) { toast("먼저 물고기를 추가하세요.", "error"); return; }
  recordProjectSnapshot("어획 규칙 추가");
  store.update((draft) => {
    if (!draft.system.fishing) return;
    draft.system.fishing = {
      ...draft.system.fishing,
      spots: draft.system.fishing.spots.map((spot) => spot.id !== spotId ? spot : { ...spot, catches: [...spot.catches, { fishId, weight: 1 }] }),
    };
  });
  rerender();
}

function removeCatch(spotId: string, index: number, rerender: () => void): void {
  recordProjectSnapshot("어획 규칙 삭제");
  store.update((draft) => {
    if (!draft.system.fishing) return;
    draft.system.fishing = {
      ...draft.system.fishing,
      spots: draft.system.fishing.spots.map((spot) => spot.id !== spotId ? spot : { ...spot, catches: spot.catches.filter((_, current) => current !== index) }),
    };
  });
  toast("어획 규칙을 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function patchArea(id: string, patch: Partial<ForageAreaDefinition>, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-life-forage:${id}`);
  store.update((draft) => {
    if (!draft.system.seasonalForage) return;
    draft.system.seasonalForage = {
      ...draft.system.seasonalForage,
      areas: draft.system.seasonalForage.areas.map((row) => row.id === id ? sanitize({ ...row, ...patch }) : row),
    };
  });
  rerender?.();
}

function patchEntry(areaId: string, index: number, patch: Partial<ForageEntryDefinition>, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-life-forage-entry:${areaId}:${index}`);
  store.update((draft) => {
    if (!draft.system.seasonalForage) return;
    draft.system.seasonalForage = {
      ...draft.system.seasonalForage,
      areas: draft.system.seasonalForage.areas.map((area) => area.id !== areaId ? area : {
        ...area,
        entries: area.entries.map((entry, current) => current === index ? sanitize({ ...entry, ...patch }) : entry),
      }),
    };
  });
  rerender?.();
}

function addEntry(areaId: string, rerender: () => void): void {
  const itemId = store.getCurrent().database.items[0]?.id;
  if (!itemId) { toast("먼저 아이템을 추가하세요.", "error"); return; }
  recordProjectSnapshot("채집물 추가");
  store.update((draft) => {
    if (!draft.system.seasonalForage) return;
    draft.system.seasonalForage = {
      ...draft.system.seasonalForage,
      areas: draft.system.seasonalForage.areas.map((area) => area.id !== areaId ? area : { ...area, entries: [...area.entries, { id: genId("forage"), weight: 1, itemId }] }),
    };
  });
  rerender();
}

function removeEntry(areaId: string, index: number, rerender: () => void): void {
  recordProjectSnapshot("채집물 삭제");
  store.update((draft) => {
    if (!draft.system.seasonalForage) return;
    draft.system.seasonalForage = {
      ...draft.system.seasonalForage,
      areas: draft.system.seasonalForage.areas.map((area) => area.id !== areaId ? area : { ...area, entries: area.entries.filter((_, current) => current !== index) }),
    };
  });
  toast("채집물을 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function patchReward(id: string, patch: Partial<MuseumRewardDefinition>, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-life-museum:${id}`);
  store.update((draft) => {
    if (!draft.system.museum) return;
    draft.system.museum = {
      ...draft.system.museum,
      rewards: draft.system.museum.rewards.map((row) => row.id === id ? sanitize({ ...row, ...patch }) : row),
    };
  });
  rerender?.();
}

function patchRewardPayload(id: string, patch: Partial<BundleRewardDefinition>, rerender?: () => void): void {
  const current = store.getCurrent().system.museum?.rewards.find((row) => row.id === id)?.reward ?? {};
  patchReward(id, { reward: sanitize({ ...current, ...patch }) }, rerender);
}

function patchRewardItem(id: string, index: number, patch: { itemId?: string; count?: number }, rerender?: () => void): void {
  const current = store.getCurrent().system.museum?.rewards.find((row) => row.id === id)?.reward;
  const itemRewards = (current?.itemRewards ?? []).map((entry, position) => position === index ? { ...entry, ...patch } : entry);
  patchReward(id, { reward: { ...current, itemRewards } }, rerender);
}

function addRewardItem(id: string, rerender: () => void): void {
  const itemId = store.getCurrent().database.items[0]?.id;
  if (!itemId) { toast("먼저 아이템을 추가하세요.", "error"); return; }
  recordProjectSnapshot("박물관 아이템 보상 추가");
  const current = store.getCurrent().system.museum?.rewards.find((row) => row.id === id)?.reward;
  patchReward(id, { reward: { ...current, itemRewards: [...(current?.itemRewards ?? []), { itemId, count: 1 }] } }, rerender);
}

function removeRewardItem(id: string, index: number, rerender: () => void): void {
  recordProjectSnapshot("박물관 아이템 보상 삭제");
  const current = store.getCurrent().system.museum?.rewards.find((row) => row.id === id)?.reward;
  patchReward(id, { reward: { ...current, itemRewards: (current?.itemRewards ?? []).filter((_, position) => position !== index) } }, rerender);
  toast("아이템 보상을 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
}

function setFishingEnabled(enabled: boolean, rerender: () => void): void {
  recordProjectSnapshot("낚시 사용 여부 변경");
  store.update((draft) => { draft.system.fishing = { ...(draft.system.fishing ?? { spots: [] }), enabled }; });
  rerender();
}

function setFishingEnergy(energyCost: number): void {
  recordCoalescedSnapshot("db-life-fishing-energy");
  store.update((draft) => { draft.system.fishing = { ...(draft.system.fishing ?? { enabled: true, spots: [] }), energyCost }; });
}

function setForageEnabled(enabled: boolean, rerender: () => void): void {
  recordProjectSnapshot("계절 채집 사용 여부 변경");
  store.update((draft) => { draft.system.seasonalForage = { ...(draft.system.seasonalForage ?? { areas: [] }), enabled }; });
  rerender();
}

function setMuseumEnabled(enabled: boolean, rerender: () => void): void {
  recordProjectSnapshot("박물관 사용 여부 변경");
  store.update((draft) => { draft.system.museum = { ...(draft.system.museum ?? { eligibleItemIds: [], rewards: [] }), enabled }; });
  rerender();
}

function setCollectionsEnabled(enabled: boolean, rerender: () => void): void {
  recordProjectSnapshot("수집 도감 사용 여부 변경");
  store.update((draft) => { draft.system.collections = { ...(draft.system.collections ?? {}), enabled }; });
  rerender();
}

function setEligibleItems(next: string[], rerender: () => void): void {
  recordProjectSnapshot("박물관 기부 가능 아이템 변경");
  store.update((draft) => {
    draft.system.museum = { ...(draft.system.museum ?? { enabled: true, rewards: [] }), eligibleItemIds: next };
  });
  rerender();
}

function setTrackedItems(next: string[], rerender: () => void): void {
  recordProjectSnapshot("도감 추적 아이템 변경");
  store.update((draft) => {
    draft.system.collections = { ...(draft.system.collections ?? { enabled: true }), trackedItemIds: next };
  });
  rerender();
}

function deleteRecord(kind: LifeCollectionKind, id: string, rerender: () => void): void {
  recordProjectSnapshot("생활 콜렉션 항목 삭제");
  store.update((draft) => {
    if (kind === "fish") {
      draft.database.fishSpecies = (draft.database.fishSpecies ?? []).filter((row) => row.id !== id);
      if (draft.system.fishing) {
        draft.system.fishing = {
          ...draft.system.fishing,
          spots: draft.system.fishing.spots
            .map((spot) => ({ ...spot, catches: spot.catches.filter((row) => row.fishId !== id) }))
            .filter((spot) => spot.catches.length > 0),
        };
      }
    }
    if (kind === "fishing" && draft.system.fishing) draft.system.fishing = { ...draft.system.fishing, spots: draft.system.fishing.spots.filter((row) => row.id !== id) };
    if (kind === "forage" && draft.system.seasonalForage) draft.system.seasonalForage = { ...draft.system.seasonalForage, areas: draft.system.seasonalForage.areas.filter((row) => row.id !== id) };
    if (kind === "museum" && draft.system.museum) draft.system.museum = { ...draft.system.museum, rewards: draft.system.museum.rewards.filter((row) => row.id !== id) };
  });
  if (lifeSelection?.kind === kind && lifeSelection.id === id) lifeSelection = null;
  toast("삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function seedDefaults(rerender: () => void): void {
  const project = store.getCurrent();
  const items = project.database.items;
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!map || items.length === 0) { toast("먼저 아이템과 맵을 준비하세요.", "error"); return; }
  const fishItem = items[0]!.id;
  const forageItem = items[1]?.id ?? fishItem;
  const rewardItem = items[2]?.id ?? forageItem;
  recordProjectSnapshot("기본 낚시·채집·박물관 만들기");
  store.update((draft) => {
    const fishId = uniqueId("fish_river", new Set((draft.database.fishSpecies ?? []).map((row) => row.id)));
    const spotId = uniqueId("fishing_spot_river", new Set((draft.system.fishing?.spots ?? []).map((row) => row.id)));
    const areaId = uniqueId("forage_area_farm", new Set((draft.system.seasonalForage?.areas ?? []).map((row) => row.id)));
    draft.database.fishSpecies = [...(draft.database.fishSpecies ?? []), { id: fishId, name: "강 물고기", itemId: fishItem, skillXp: 8 }];
    draft.system.fishing = { enabled: true, energyCost: 2, spots: [...(draft.system.fishing?.spots ?? []), {
      id: spotId, name: "강 낚시터", mapId: map.id, area: safeRect(map.width, map.height), catches: [{ fishId, weight: 1, seasons: ["spring", "summer", "fall"], timePhases: ["morning", "day"], weatherKinds: ["none", "rain"] }],
    }] };
    draft.system.seasonalForage = { enabled: true, areas: [...(draft.system.seasonalForage?.areas ?? []), {
      id: areaId, name: "농장 채집 구역", mapId: map.id, area: safeRect(map.width, map.height), dailySpawnCount: 2, maxActive: 6, despawnAfterDays: 3,
      entries: [{ id: "forage_seasonal", weight: 1, seasonalDrops: { spring: forageItem, summer: forageItem, fall: forageItem, winter: forageItem } }],
    }] };
    draft.system.collections = { enabled: true, trackedItemIds: [...new Set([...(draft.system.collections?.trackedItemIds ?? []), fishItem, forageItem, rewardItem])] };
    draft.system.museum = { enabled: true, eligibleItemIds: [...new Set([...(draft.system.museum?.eligibleItemIds ?? []), fishItem])], rewards: [
      ...(draft.system.museum?.rewards ?? []),
      { id: uniqueId("museum_first_donation", new Set((draft.system.museum?.rewards ?? []).map((row) => row.id))), name: "첫 기부", minDonations: 1, reward: { itemRewards: [{ itemId: rewardItem, count: 1 }] } },
    ] };
  });
  toast("낚시·채집·수집 도감·박물관 기본값을 만들었습니다.", "ok");
  rerender();
}

function addFish(rerender: () => void): void {
  const itemId = store.getCurrent().database.items[0]?.id;
  if (!itemId) { toast("먼저 아이템을 추가하세요.", "error"); return; }
  recordProjectSnapshot("물고기 추가");
  const id = genId("fish");
  store.update((draft) => {
    draft.database.fishSpecies ??= [];
    draft.database.fishSpecies.push({ id, name: "새 물고기", itemId, skillXp: 1 });
  });
  lifeSelection = { kind: "fish", id };
  rerender();
}

function addSpot(rerender: () => void): void {
  const project = store.getCurrent();
  const fish = project.database.fishSpecies?.[0];
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!fish || !map) { toast("물고기와 맵이 먼저 필요합니다.", "error"); return; }
  recordProjectSnapshot("낚시터 추가");
  const id = genId("fishing_spot");
  store.update((draft) => {
    const fishing = draft.system.fishing ?? { enabled: true, spots: [] };
    draft.system.fishing = { ...fishing, spots: [...fishing.spots, { id, mapId: map.id, area: safeRect(map.width, map.height), catches: [{ fishId: fish.id, weight: 1 }] }] };
  });
  lifeSelection = { kind: "fishing", id };
  rerender();
}

function addForage(rerender: () => void): void {
  const project = store.getCurrent();
  const item = project.database.items[0];
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!item || !map) { toast("아이템과 맵이 먼저 필요합니다.", "error"); return; }
  recordProjectSnapshot("채집 구역 추가");
  const id = genId("forage_area");
  store.update((draft) => {
    const seasonalForage = draft.system.seasonalForage ?? { enabled: true, areas: [] };
    draft.system.seasonalForage = { ...seasonalForage, areas: [...seasonalForage.areas, { id, mapId: map.id, area: safeRect(map.width, map.height), dailySpawnCount: 1, maxActive: 3, despawnAfterDays: 2, entries: [{ id: genId("forage"), itemId: item.id, weight: 1 }] }] };
  });
  lifeSelection = { kind: "forage", id };
  rerender();
}

function addMuseumReward(rerender: () => void): void {
  const item = store.getCurrent().database.items[0];
  if (!item) { toast("먼저 아이템을 추가하세요.", "error"); return; }
  recordProjectSnapshot("박물관 보상 추가");
  const id = genId("museum_reward");
  store.update((draft) => {
    const museum = draft.system.museum ?? { enabled: true, eligibleItemIds: [item.id], rewards: [] };
    draft.system.museum = { ...museum, rewards: [...museum.rewards, { id, minDonations: 1, reward: { itemRewards: [{ itemId: item.id, count: 1 }] } }] };
  });
  lifeSelection = { kind: "museum", id };
  rerender();
}

function safeRect(width: number, height: number): Rect {
  return { x: 0, y: 0, w: Math.max(1, Math.min(4, width)), h: Math.max(1, Math.min(4, height)) };
}

function uniqueId(base: string, used: ReadonlySet<string>): string {
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}_${suffix++}`;
  return id;
}
