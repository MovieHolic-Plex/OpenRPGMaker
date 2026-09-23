import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { duplicateInto } from "@/editor/databaseCopy";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { monsterSpeciesReferenceMessage } from "@/editor/databaseReferences";
import { numberInput, selectInput } from "@/editor/panels/actorRecordControls";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { emptyToUndefined, matchesNameOrId, numberField, textControl } from "@/editor/panels/databaseControls";
import {
  detailHero,
  emptyState,
  listPane,
  listRow,
  listToolbar,
  detailPane as makeDetailPane,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { clickDatabaseTabFrom, renderLifePanel } from "@/editor/panels/databaseLifeUi";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { imageIconOf, recordIconElement } from "@/editor/panels/eventEditor/recordPicker";
import { applyMagentaChromaKey } from "@/editor/panels/chromaKey";
import { DEFAULT_MONSTER_EXP_CURVE, monsterBattleStatsForSpecies, monsterEvolutionCycleSpeciesIds, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { CAPTURE_DIFFICULTIES, captureDifficulty, capturePreviewLine } from "@/editor/panels/databaseCapturePreview";
import { monsterSpeciesSections, type MonsterSpeciesSectionId, type MonsterSpeciesSectionsHandle } from "@/editor/panels/databaseMonsterSpeciesSections";
import { monsterTypeLabel, monsterTypeTone } from "@/editor/panels/databaseMonsterSpeciesTypeLabels";
import { uxLevel } from "@/editor/panels/databaseUxLevel";
import { renderExperienceCurvePanel } from "@/editor/panels/databaseClassExperienceCurveEditor";
import { store } from "@/project/store";
import type { EnemyStats, MonsterEvolutionRecord, MonsterSpeciesRecord } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let selectedSpeciesId: string | undefined;
let speciesSearch = "";
let revealSpeciesSelection = false;
// The modal keeps this host across deferred refreshes, but replaces its list.
// Weak ownership prevents a closed modal's scroll from leaking into a new one.
const speciesListScrollTops = new WeakMap<HTMLElement, number>();
// 「프로젝트 준비」 접이식의 펼침 상태 — 종족을 바꿔 다시 그려도 유지한다.
let readinessOpen = false;
// 지금 붙어 있는 상세 창의 요약(머리글·탭 요약·채울 순서·난이도)을 다시 칠한다.
// 값 편집은 전체를 다시 그리지 않으므로(포커스 유지) 요약만 따로 갱신한다.
let paintSpeciesSummaries: (() => void) | undefined;

export function setSelectedMonsterSpeciesId(id?: string, options?: { reveal: boolean }): void {
  selectedSpeciesId = id;
  revealSpeciesSelection = options?.reveal === true;
  if (revealSpeciesSelection) speciesSearch = "";
}

export function getSelectedMonsterSpeciesId(): string | undefined {
  return selectedSpeciesId;
}

// ---------------------------------------------------------------------------
// 몬스터 종족 — 워크스페이스 프리미티브로 재조립 (2026-08 모던 개편)
//
// 예전 구조의 P0 두 개가 전부 "손조립한 3-pane" 에서 나왔다:
//  1) 상세 창(.oprn-record-detail-pane)은 desktop.css:102 에서 `grid-template-rows:
//     auto minmax(0,1fr); overflow:hidden` 인데 자식으로 폼 하나만 넣었다. 폼이 `auto`
//     행에 얹혀 max-content 로 커지고, 창의 overflow:hidden 이 그대로 잘라먹어 17 개
//     필드 중 12 개(포획률·능력치 6종·레벨별 스킬·진화·경험치 곡선·역참조 2종)가
//     화면 밖이었다. detailPane() 은 본문 래퍼(.db-ws-detail-body)를 **항상** 만들어
//     스크롤 경계를 상세 창 안쪽에 두므로 구조적으로 재발하지 않는다.
//  2) "스킬 추가"/"진화 추가" 가 1 열 그리드의 자식이라 justify-self:stretch 로
//     998px 전폭 바가 됐다. sectionCard 본문 직계 자식으로 둔 `.db-ws-btn` 은
//     workspace-modern.css 가 justify-self:start 로 고정한다.
//
// 2026-09 UX 개편: 카드 9장이 한 번에 펼쳐져 초보자가 어디서 시작할지 몰랐다. 상세를
// 「기본 · 포획 · 성장 · 진화 · 연결」 구역 탭으로 나눈다(databaseMonsterSpeciesSections.ts).
// 공용 inspectorTabs() 는 패널을 지연 생성하므로 쓰지 않는다 — 다섯 패널을 모두 만들어 두고
// hidden 으로만 가려서, 모든 칸의 testid 가 언제나 DOM 에 있게 한다.
// ---------------------------------------------------------------------------

export function renderMonsterSpeciesTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const species = project.database.monsterSpecies ?? [];
  if (!selectedSpeciesId || !species.some((record) => record.id === selectedSpeciesId)) {
    setSelectedMonsterSpeciesId(species[0]?.id, { reveal: species.length > 0 });
  }
  const selected = species.find((record) => record.id === selectedSpeciesId);
  const search = el("input", {
    attrs: { type: "search", placeholder: "이름 또는 ID 검색", "aria-label": "이름 또는 ID 검색" },
    value: speciesSearch,
    dataset: { testid: "db-monster-species-search" },
  });
  const selectionNotice = el("div", {
    class: "db-filter-chips",
    dataset: { testid: "db-monster-species-selection-notice" },
    attrs: { role: "status" },
  });
  const revealSelected = (): void => {
    speciesSearch = "";
    search.value = "";
    renderRows();
    rowsHost.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest" });
    speciesListScrollTops.set(host, rowsHost.scrollTop);
    search.focus();
  };

  const toolbar = listToolbar([
    {
      label: "+ 추가",
      kind: "primary",
      testid: "db-monster-species-add",
      title: "새 종족을 만듭니다",
      onClick: () => addSpecies(rerender),
    },
    {
      label: "복제",
      testid: "db-monster-species-duplicate",
      title: "선택한 종족을 복사합니다",
      onClick: () => duplicateSpecies(rerender),
    },
  ]);
  toolbar.append(deleteSpeciesButton(rerender));

  const list = listPane({
    title: "포획·성장 종족",
    count: species.length,
    search: el("div", { class: "db-search db-ws-search", children: [search] }),
    chips: selectionNotice,
    rows: [],
    toolbar,
    testid: "db-monster-species-list-pane",
  });

  const rowsHost = list.querySelector<HTMLElement>(".db-ws-list")!;
  const count = list.querySelector<HTMLElement>(".db-ws-count")!;
  // Filtering only updates the list, count and notice. The mounted inspector owns
  // unsaved controls, skill-row identities, preview level and its scroll position.
  const renderRows = (): void => {
    const liveProject = store.getCurrent();
    const records = liveProject.database.monsterSpecies ?? [];
    const query = speciesSearch.trim();
    const visible = records.filter((record) => !query || matchesNameOrId(record.name, record.id, query));
    rowsHost.replaceChildren(...visible.map((record) => speciesListRow(liveProject, record, records.indexOf(record), rerender)));
    rowsHost.classList.toggle("db-ws-list-empty", visible.length === 0);
    count.textContent = visible.length === records.length ? `${records.length}개` : `${visible.length}/${records.length}개`;
    if (!visible.length) rowsHost.append(query
      ? emptyState({
        icon: "⌕", title: "검색 결과가 없습니다", body: `"${query}" 와 일치하는 종족이 없습니다.`, compact: true,
        action: { label: "검색 지우기", onClick: revealSelected, testid: "db-monster-species-empty-clear" },
      })
      : emptyState({ icon: "◇", title: "아직 종족이 없습니다", compact: true }));
    const current = records.find((record) => record.id === selectedSpeciesId);
    const outside = current && !visible.includes(current);
    selectionNotice.hidden = !outside;
    selectionNotice.dataset.recordId = current?.id ?? "";
    selectionNotice.replaceChildren(...(outside ? [
      el("p", { class: "db-field-hint", text: `선택 중: ${current.name || current.id} · 검색 결과 밖` }),
      el("button", {
        class: "db-ws-btn db-ws-btn-ghost", text: "검색 지우고 보기", attrs: { type: "button" },
        dataset: { testid: "db-monster-species-reveal-selection" }, on: { click: revealSelected },
      }),
    ] : []));
  };
  search.addEventListener("input", () => { speciesSearch = search.value; renderRows(); });
  renderRows();

  paintSpeciesSummaries = undefined;
  const detail = selected
    ? speciesDetailPane(project, selected, species.indexOf(selected), rerender)
    : makeDetailPane({
      body: emptyState({
        icon: "◇",
        title: "종족이 없습니다",
        body: "포획·성장·종족값을 설정합니다. 전투 몬스터 탭에서 연결하며, 전투의 고정 능력치는 별도로 편집합니다.",
        action: {
          label: "첫 종족 만들기",
          kind: "primary",
          testid: "db-monster-species-empty-create",
          onClick: () => addSpecies(rerender),
        },
      }),
      testid: "db-detail-form",
    });

  // 배너(.db-life-header)와 워크스페이스는 `.db-body` 의 형제로 둔다 —
  // 11-life-authoring.css 가 `.db-body:has(.oprn-record-monster-species)` 를
  // `auto minmax(0,1fr)` 2 행 그리드로 못박고 grid-row 를 배너/워크스페이스에
  // 직접 배정한다(수집 게이트 경고가 붙으면 3 행). workspaceShell 의 header 슬롯을
  // 쓰면 그 배정이 어긋난다.
  host.append(
    monsterPipelineHeader(project),
    workspaceShell({
      list,
      detail,
      legacyClass: "oprn-record-workspace oprn-record-monster-species",
      testid: "db-monster-species-workspace",
    })
  );
  rowsHost.scrollTop = speciesListScrollTops.get(host) ?? 0;
  if (revealSpeciesSelection) {
    revealSpeciesSelection = false;
    rowsHost.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest" });
  }
  // Capture native reveal/clamping now, before its asynchronous scroll event.
  speciesListScrollTops.set(host, rowsHost.scrollTop);
  rowsHost.addEventListener("scroll", () => {
    // A queued event from a replaced/cached list must not overwrite live scroll.
    if (host.contains(rowsHost)) speciesListScrollTops.set(host, rowsHost.scrollTop);
  });
}

function speciesListRow(
  project: ReturnType<typeof store.getCurrent>,
  record: MonsterSpeciesRecord,
  index: number,
  rerender: () => void,
): HTMLElement {
  return listRow({
    name: record.name,
    sub: (record.types ?? []).map(monsterTypeLabel).join("·") || undefined,
    number: index + 1,
    thumb: recordIconElement(imageIconOf(project, record.graphic.monsterResourceId), record.name),
    active: record.id === selectedSpeciesId,
    title: `${record.name} (${record.id})`,
    testid: `db-monster-species-row-${record.id}`,
    // qa-enemies.spec.ts 는 `.db-list-row.active` 의 data-record-id 로 선택을 읽는다.
    dataset: { recordId: record.id },
    onSelect: () => {
      selectedSpeciesId = record.id;
      rerender();
    },
  });
}

function speciesHero(
  project: ReturnType<typeof store.getCurrent>,
  record: MonsterSpeciesRecord,
  index: number,
): { readonly element: HTMLElement; readonly paint: (record: MonsterSpeciesRecord) => void } {
  const hero = detailHero({
    eyebrow: `포획·성장 종족 #${index + 1}`,
    title: record.name || "(이름 없음)",
    // 레코드 id 를 상세 창에 실제 텍스트로 노출한다 — 예전에는 목록 행의 title 속성에만
    // 있어서 "지금 편집 중인 게 어느 레코드인지" 를 화면에서 확인할 수 없었다.
    subtitle: record.id,
    media: recordIconElement(imageIconOf(project, record.graphic.monsterResourceId), record.name),
    testid: "db-monster-species-hero",
  });
  const chips = el("span", { class: "db-monster-species-hero-types", dataset: { testid: "db-monster-species-hero-types" } });
  const summary = el("span", { class: "db-monster-species-hero-summary", dataset: { testid: "db-monster-species-summary" } });
  const title = hero.querySelector<HTMLElement>(".db-ws-hero-title");
  const line = el("div", { class: "db-monster-species-hero-line", children: [chips, summary] });
  (title?.parentElement ?? hero).append(line);
  const paint = (live: MonsterSpeciesRecord): void => {
    if (title) title.textContent = live.name || "(이름 없음)";
    chips.replaceChildren(...(live.types ?? []).map((type) => typeChip(type)));
    summary.textContent = speciesSummaryText(live);
  };
  paint(record);
  return { element: hero, paint };
}

function typeChip(type: string): HTMLElement {
  return el("span", {
    class: "db-monster-species-type-pill",
    text: monsterTypeLabel(type),
    attrs: { title: type },
    dataset: { tone: monsterTypeTone(type) },
  });
}

/** 머리글 한 줄 요약 — 「잡기 보통 · Lv3 에 「잎날」 · 진화 없음」. */
function speciesSummaryText(record: MonsterSpeciesRecord): string {
  const project = store.getCurrent();
  const parts = [`잡기 ${captureDifficulty(record.captureRate).label}`];
  const skills = record.skillsByLevel ?? [];
  if (skills.length > 0) {
    const first = skills[0];
    const name = project.database.skills.find((skill) => skill.id === first.skillId)?.name || first.skillId;
    parts.push(`Lv${first.level} 에 「${name}」${skills.length > 1 ? ` 외 ${skills.length - 1}개` : ""}`);
  } else {
    parts.push("배우는 스킬 없음");
  }
  const evolutions = record.evolutions ?? [];
  if (evolutions.length > 0) {
    const first = evolutions[0];
    const target = (project.database.monsterSpecies ?? []).find((entry) => entry.id === first.toSpeciesId);
    const when = first.requires.level ? `Lv${first.requires.level} ` : "";
    parts.push(`${when}「${target?.name || first.toSpeciesId}」로 진화${evolutions.length > 1 ? ` 외 ${evolutions.length - 1}개` : ""}`);
  } else {
    parts.push("진화 없음");
  }
  return parts.join(" · ");
}

function speciesDetailPane(
  project: ReturnType<typeof store.getCurrent>,
  record: MonsterSpeciesRecord,
  index: number,
  rerender: () => void,
): HTMLElement {
  const hero = speciesHero(project, record, index);
  const inspector = speciesInspector(record, rerender);
  const pane = makeDetailPane({ hero: hero.element, body: inspector.element, testid: "db-detail-form" });
  paintSpeciesSummaries = () => {
    const live = currentSpecies(record.id, record);
    hero.paint(live);
    inspector.paint(live);
  };
  return pane;
}

function addSpecies(rerender: () => void): void {
  const id = genId("species");
  recordProjectSnapshot();
  store.update((project) => {
    project.database.monsterSpecies ??= [];
    project.database.monsterSpecies.push(normalizeMonsterSpeciesRecord({ id, name: "새 species" }));
  }, { scope: "database", collection: "monsterSpecies", label: "몬스터 종족 편집" });
  setSelectedMonsterSpeciesId(id, { reveal: true });
  rerender();
}

function duplicateSpecies(rerender: () => void): void {
  const id = selectedSpeciesId;
  if (!id) return;
  const copyId = genId("species");
  recordProjectSnapshot();
  store.update((project) => {
    project.database.monsterSpecies ??= [];
    duplicateInto(project.database.monsterSpecies, id, copyId);
  }, { scope: "database", collection: "monsterSpecies", label: "몬스터 종족 편집" });
  setSelectedMonsterSpeciesId(copyId, { reveal: true });
  rerender();
}

function monsterPipelineHeader(project: ReturnType<typeof store.getCurrent>): HTMLElement {
  const speciesIds = new Set((project.database.monsterSpecies ?? []).map((record) => record.id));
  const linkedEnemies = project.database.enemies.filter((enemy) => enemy.speciesId && speciesIds.has(enemy.speciesId));
  const spawnMaps = Object.values(project.maps).filter((map) => (map.fieldSpawns?.length ?? 0) > 0);
  const spawnCount = spawnMaps.reduce((count, map) => count + (map.fieldSpawns?.length ?? 0), 0);
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const dropEnemies = project.database.enemies.filter((enemy) => enemy.rewards.dropItemId && itemIds.has(enemy.rewards.dropItemId));
  const openTab = (
    event: Event,
    testid: string,
    options?: { readonly systemSection?: "startup"; readonly focusTestId?: string },
  ): void => {
    if (!clickDatabaseTabFrom(event.currentTarget as HTMLElement | null, testid, options)) {
      toast("데이터베이스 창에서 해당 탭을 열어 주세요.", "info");
    }
  };
  const selectSpawnMap = (): void => {
    const map = spawnMaps[0];
    if (!map) {
      toast("필드 출현이 설정된 맵이 없습니다.", "info");
      return;
    }
    if (selectEditorMap(map.id)) toast(`출현 맵 '${map.name}'을 선택했습니다.`, "ok");
    else toast("출현 맵을 찾을 수 없습니다.", "error");
  };

  const collection = project.system.monsterCollection === true;
  const readyCount = [linkedEnemies.length > 0, spawnCount > 0, dropEnemies.length > 0, collection].filter(Boolean).length;
  // 이 줄은 선택한 종족이 아니라 **프로젝트 전체** 정보다. 종족마다 한 줄을 통째로 차지하지 않게
  // 알약 하나로 접어 두고, 누르면 예전 준비 상태 카드를 그대로 펼친다(testid 는 그대로).
  const details = el("details", {
    class: "db-monster-species-readiness",
    dataset: { testid: "db-monster-pipeline-details", ready: String(readyCount) },
  }) as HTMLDetailsElement;
  details.open = readinessOpen;
  details.addEventListener("toggle", () => { readinessOpen = details.open; });
  const summary = el("summary", {
    class: "db-monster-species-readiness-summary",
    dataset: { testid: "db-monster-pipeline-toggle" },
    attrs: { title: "프로젝트 전체의 종족 연결·출현·드롭·포획 방식 준비 상태" },
    children: [
      el("span", { text: "프로젝트 준비" }),
      el("strong", { text: `${readyCount}/4` }),
    ],
  });
  details.append(summary);
  details.append(
      renderLifePanel({
        testid: "db-monster-pipeline",
        title: "프로젝트 전체 준비 상태",
        headingTestid: "db-monster-species-intro",
        cards: [
          {
            testid: "db-monster-pipeline-links",
            icon: "link",
            label: "명시적 종족 연결",
            value: `${linkedEnemies.length}/${project.database.enemies.length}`,
            detail: "전체 전투 몬스터 기준 · 같은 ID 호환 연결 제외",
            state: linkedEnemies.length > 0 ? "ready" : "needs-setup",
            data: { linked: String(linkedEnemies.length), total: String(project.database.enemies.length) },
            action: {
              label: "전투 몬스터 탭 열기",
              testid: "db-monster-pipeline-links-action",
              onClick: (event) => openTab(event, "db-tab-enemies"),
            },
          },
          {
            testid: "db-monster-pipeline-spawns",
            icon: "map",
            label: "출현",
            value: `${spawnCount}개 · ${spawnMaps.length}맵`,
            detail: spawnCount > 0 ? "프로젝트 모든 맵의 출현 영역입니다." : "맵에서 필드 출현 영역을 설정하세요.",
            state: spawnCount > 0 ? "ready" : "needs-setup",
            data: { spawns: String(spawnCount), maps: String(spawnMaps.length) },
            action: {
              label: spawnCount > 0 ? "첫 출현 맵 선택" : "출현 맵 확인",
              testid: "db-monster-pipeline-spawns-action",
              onClick: selectSpawnMap,
            },
          },
          {
            testid: "db-monster-pipeline-drops",
            icon: "drop",
            label: "드롭",
            value: `${dropEnemies.length}종`,
            detail: dropEnemies.length > 0 ? "전체 전투 몬스터 중 아이템 드롭이 있는 수입니다." : "전투 몬스터의 보상에서 드롭을 지정하세요.",
            state: dropEnemies.length > 0 ? "ready" : "needs-setup",
            data: { count: String(dropEnemies.length) },
            action: {
              label: "전투 몬스터 탭 열기",
              testid: "db-monster-pipeline-drops-action",
              onClick: (event) => openTab(event, "db-tab-enemies"),
            },
          },
          {
            testid: "db-monster-pipeline-mode",
            icon: "capture",
            label: "방식",
            value: project.system.monsterCollection === true ? "포획 사용" : "전투 중심",
            detail: project.system.monsterCollection === true ? "전투 중 포획 기능이 열립니다." : "종족은 전투 연결 정보로만 사용됩니다.",
            state: project.system.monsterCollection === true ? "ready" : "info",
            action: {
              label: "시스템 포획 설정 열기",
              testid: "db-monster-pipeline-mode-action",
              onClick: (event) => openTab(event, "db-tab-system", {
                systemSection: "startup",
                focusTestId: "db-field-system-monster-collection",
              }),
            },
          },
        ],
      }),
  );
  return el("div", { class: "db-life-header db-monster-species-life-header", children: [details] });
}

// 다른 레코드 탭(databaseAdvancedRecordViews.ts의 deleteButton)과 동일한 2단계 확인 +
// 참조 가드 패턴 — monsterSpecies는 DatabaseCollection에 편입돼 있지 않아 그 공용 구현을
// 그대로 재사용할 수 없으므로 이 뷰에서 같은 계약을 재현한다.
function deleteSpeciesButton(rerender: () => void): HTMLElement {
  let armedId: string | null = null;
  let armedUntil = 0;
  let resetTimer: number | null = null;

  const button = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button" },
    dataset: { testid: "db-monster-species-delete" },
    on: {
      click: () => {
        const id = selectedSpeciesId;
        if (!id) return;

        const blockedMessage = monsterSpeciesReferenceMessage(id);
        if (blockedMessage) {
          toast(blockedMessage, "error");
          return;
        }

        const now = Date.now();
        const isArmed = armedId === id && now <= armedUntil;
        if (!isArmed) {
          armedId = id;
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedId = null;
              button.textContent = DELETE_IDLE_LABEL;
              button.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }

        armedId = null;
        armedUntil = 0;
        button.textContent = DELETE_IDLE_LABEL;
        button.classList.remove("confirming");
        recordProjectSnapshot();
        store.update((project) => {
          project.database.monsterSpecies = (project.database.monsterSpecies ?? []).filter((record) => record.id !== id);
        }, { scope: "database", collection: "monsterSpecies", label: "몬스터 종족 편집" });
        selectedSpeciesId = undefined;
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        rerender();
      },
    },
  });
  return button;
}

type SpeciesInspector = { readonly element: HTMLElement; readonly paint: (record: MonsterSpeciesRecord) => void };

/** 상세 인스펙터 — 구역 탭 다섯 개. 모든 패널이 DOM 에 있고 고른 하나만 보인다. */
function speciesInspector(record: MonsterSpeciesRecord, rerender: () => void): SpeciesInspector {
  const preview = speciesStatsPreview(record);
  const linkedCount = (): number => store.getCurrent().database.enemies.filter((entry) => entry.speciesId === record.id).length;
  let sections: MonsterSpeciesSectionsHandle | undefined;
  const goTo = (id: MonsterSpeciesSectionId): void => sections?.show(id, { focus: true });
  const checklist = fillOrderChecklist(record, goTo);
  const capture = captureCard(record);
  sections = monsterSpeciesSections([
    {
      id: "basic",
      label: "기본",
      children: [
        el("div", {
          class: "db-ws-stack db-monster-species-basic-main",
          children: [
            sectionCard({
              title: "이름과 타입",
              children: [
                textControl("이름", record.name, (value) => updateSpecies(record.id, { name: value }), "db-monster-species-name"),
                typesField(record, rerender),
              ],
              testid: "db-monster-species-identity-card",
            }),
            checklist.element,
          ],
        }),
        sectionCard({
          title: "그림",
          hint: "연결된 전투 몬스터의 그림은 따로 바꿉니다.",
          children: graphicChildren(record, rerender),
          testid: "db-monster-species-graphic-card",
        }),
      ],
    },
    { id: "capture", label: "포획", summary: captureDifficulty(record.captureRate).label, children: [capture.element] },
    {
      id: "growth",
      label: "성장",
      summary: growthSummary(record),
      children: [
        sectionCard({
          title: "종족값과 실제 능력치",
          hint: "포획 후 성장 공식에 쓰는 기본값입니다. 전투 몬스터의 고정 능력치와 별개이며, 아래에서 레벨별 수치를 확인합니다.",
          children: [...statFields(record, preview.refresh), preview.element],
          testid: "db-monster-species-stats-card",
        }),
        skillsByLevelCard(record, rerender),
        experienceCurveCard(record, rerender),
      ],
    },
    {
      id: "evolution",
      label: "진화",
      summary: String((record.evolutions ?? []).length),
      children: [evolutionsCard(record, rerender), evolutionReferrersCard(record, rerender)],
    },
    { id: "links", label: "연결", summary: String(linkedCount()), ux: "advanced", children: [linkedEnemiesCard(record)] },
  ]);
  const linksPanel = sections.element.querySelector<HTMLElement>('[data-section-id="links"][role="tabpanel"]');
  if (linksPanel) uxLevel(linksPanel, "advanced");
  const handle = sections;
  return {
    element: el("div", { class: "db-monster-species-inspector", children: [handle.element] }),
    paint: (live) => {
      handle.setSummary("capture", captureDifficulty(live.captureRate).label);
      handle.setSummary("growth", growthSummary(live));
      handle.setSummary("evolution", String((live.evolutions ?? []).length));
      handle.setSummary("links", String(linkedCount()));
      checklist.paint(live);
      capture.paint(live);
    },
  };
}

function growthSummary(record: MonsterSpeciesRecord): string {
  return `스킬 ${(record.skillsByLevel ?? []).length}`;
}

const DEFAULT_CAPTURE_RATE = normalizeMonsterSpeciesRecord({ id: "_", name: "_" }).captureRate;

/**
 * 「채울 순서」 — 초보·표준 모드 안내(전문가에게는 숨김). 표시는 실제 데이터로 판정한다:
 * 이름·타입 = 기본 이름이 아니고 타입이 1개 이상 / 그림 = 앞모습 리소스 있음 /
 * 잡기 난이도 = 계수가 기본값(0.3)에서 바뀜 / 진화 = 규칙 1개 이상(없어도 됨).
 */
function fillOrderChecklist(
  record: MonsterSpeciesRecord,
  goTo: (id: MonsterSpeciesSectionId) => void,
): { readonly element: HTMLElement; readonly paint: (record: MonsterSpeciesRecord) => void } {
  const items: readonly {
    readonly key: string;
    readonly label: string;
    readonly section: MonsterSpeciesSectionId;
    readonly done: (record: MonsterSpeciesRecord) => boolean;
    readonly optional?: boolean;
  }[] = [
    {
      key: "identity", label: "이름 · 타입", section: "basic",
      done: (live) => Boolean(live.name.trim()) && live.name !== "새 species" && (live.types ?? []).length > 0,
    },
    { key: "graphic", label: "그림", section: "basic", done: (live) => Boolean(live.graphic.monsterResourceId) },
    { key: "capture", label: "잡기 난이도", section: "capture", done: (live) => live.captureRate !== DEFAULT_CAPTURE_RATE },
    { key: "evolution", label: "진화 (없어도 됨)", section: "evolution", done: (live) => (live.evolutions ?? []).length > 0, optional: true },
  ];
  const rows = items.map((item) => {
    const mark = el("span", { class: "db-monster-species-check-mark", attrs: { "aria-hidden": "true" } });
    const where = el("span", {
      class: "db-monster-species-check-where",
      text: item.section === "basic" ? "" : `${item.section === "capture" ? "포획" : "진화"} 탭 →`,
    });
    const button = el("button", {
      class: "db-monster-species-check-item",
      attrs: { type: "button" },
      dataset: { testid: `db-monster-species-check-${item.key}`, section: item.section },
      children: [mark, el("span", { class: "db-monster-species-check-label", text: item.label }), where],
      on: { click: () => goTo(item.section) },
    });
    return { item, button, mark };
  });
  const paint = (live: MonsterSpeciesRecord): void => {
    for (const { item, button, mark } of rows) {
      const done = item.done(live);
      button.dataset.done = done ? "true" : "false";
      mark.textContent = done ? "✓" : "";
      button.setAttribute("aria-label", `${item.label} — ${done ? "채움" : item.optional ? "선택 사항" : "아직"}`);
    }
  };
  paint(record);
  const element = sectionCard({
    title: "채울 순서",
    hint: "위에서부터 채우면 됩니다.",
    children: [el("div", { class: "db-monster-species-checklist", children: rows.map((row) => row.button) })],
    testid: "db-monster-species-checklist",
  });
  uxLevel(element, "guide");
  return { element, paint };
}

/**
 * 포획 카드 — 계수 숫자 대신 난이도 말을 먼저 보여 준다. 난이도 단추를 누르면 그 단계의 대표 계수를
 * 저장한다(초보·표준 모드에서 계수 칸 없이도 바꿀 수 있게). 원래 계수 칸은 전문가 모드에서만 보이며
 * DOM 에는 늘 남는다.
 */
function captureCard(record: MonsterSpeciesRecord): { readonly element: HTMLElement; readonly paint: (record: MonsterSpeciesRecord) => void } {
  const word = el("strong", { class: "db-monster-species-capture-word", dataset: { testid: "db-monster-species-capture-difficulty" } });
  let rateInput: HTMLInputElement | null = null;
  const buttons = CAPTURE_DIFFICULTIES.map((difficulty) => el("button", {
    class: "db-monster-species-capture-step",
    text: difficulty.label,
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: `db-monster-species-capture-step-${difficulty.id}`, difficulty: difficulty.id },
    on: {
      click: () => {
        updateSpecies(record.id, { captureRate: difficulty.representativeRate });
        if (rateInput) rateInput.value = String(difficulty.representativeRate);
      },
    },
  }));
  const previewHost = el("div", { class: "db-monster-species-capture-odds" });
  const rateField = uxLevel(numberField("포획 계수 (0~1)", "db-monster-species-capture-rate", record.captureRate, (value) => {
    updateSpecies(record.id, { captureRate: value });
  }, { min: 0, max: 1, step: 0.01 }), "expert");
  rateInput = rateField.querySelector<HTMLInputElement>('[data-testid="db-monster-species-capture-rate"]');
  const paint = (live: MonsterSpeciesRecord): void => {
    const current = captureDifficulty(live.captureRate);
    word.textContent = current.label;
    word.dataset.difficulty = current.id;
    for (const button of buttons) {
      const selected = button.dataset.difficulty === current.id;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.classList.toggle("active", selected);
    }
    previewHost.replaceChildren(capturePreviewLine(live.captureRate, "db-monster-species-capture-preview"));
  };
  paint(record);
  const element = sectionCard({
    title: "포획",
    hint: "HP 절반일 때 기본 볼로 잡히는 확률로 난이도를 나눕니다.",
    children: [
      el("div", { class: "db-monster-species-capture-head", children: [el("span", { text: "잡기" }), word] }),
      el("div", {
        class: "db-monster-species-capture-steps",
        attrs: { role: "group", "aria-label": "잡기 난이도" },
        children: buttons,
      }),
      previewHost,
      rateField,
    ],
    testid: "db-monster-species-capture-card",
  });
  return { element, paint };
}

/**
 * 자원 피커 안의 숨은 id 입력(`.db-authoring-id`)은 고전 sr-only 레시피
 * (`width:1px; clip:rect(0,0,0,0); overflow:hidden`)다. 예전 종족 폼에서는
 * `.oprn-detail-form :is(input,select,textarea){width:100%}`(04-modern-records.css:469)가
 * 이 폭을 944px 로 덮어써서 리소스 id 가 생 텍스트 필드로 노출돼 있었는데, 그 레거시
 * 훅을 떼자 입력이 의도대로 다시 숨었다. 문제는 크로미움이 폼 컨트롤의 `overflow` 를
 * `clip` 으로 강제해(작성자 CSS 로 못 되돌린다) 1px 폭 + 142px 텍스트가 적합성 게이트의
 * `clipped` 술어에 걸린다는 것 — 눈에 보이는 결함은 없지만(clip 이 요소 전체를 가린다)
 * 측정이 오탐한다. 폭만 넉넉히 주면 clip 이 그대로 가리면서 scrollWidth==clientWidth 가
 * 되어 오탐이 사라진다. 근본 수정은 record-thumbs.css 쪽(공유 파일) — leadRequests 참조.
 */
function relaxHiddenIdInput(picker: HTMLElement): HTMLElement {
  const hidden = picker.querySelector(".db-authoring-id");
  if (hidden instanceof HTMLElement) hidden.style.width = "640px";
  return picker;
}

function speciesStage(resourceId: string | undefined, alt: string, graphic: MonsterSpeciesRecord["graphic"], testid: string): HTMLElement {
  const previewUrl = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const stageImage = previewUrl
    ? el("img", { attrs: { alt, src: previewUrl } })
    : el("span", { class: "db-enemy-empty-graphic", text: "비어 있음" });
  if (stageImage instanceof HTMLImageElement) {
    stageImage.style.filter = `hue-rotate(${graphic.graphicHue}deg)`;
    stageImage.style.opacity = graphic.transparent ? "0.58" : "1";
    // Magenta #FF00FF chroma-key (same contract as enemy previews / DB art pipeline).
    applyMagentaChromaKey(stageImage);
  }
  return el("div", { class: "db-monster-species-stage", dataset: { testid }, children: [stageImage] });
}

function graphicChildren(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement[] {
  // 앞모습·뒷모습을 두 칸으로 나란히 둔다(각 칸 = 큰 미리보기 + 고르기 + AI 입력). AI 입력칸은 공용
  // aiImageGenerateField 안에 있어 하나로 합치지 않는다(공용 부품 변경 필요) — 대신 두 칸에 되풀이되던
  // 대기열 안내문과 작은 썸네일을 CSS 로 감춘다(monster-species.css).
  const column = (stage: HTMLElement, picker: HTMLElement): HTMLElement =>
    el("div", { class: "db-monster-species-graphic-side", children: [stage, relaxHiddenIdInput(picker)] });
  const pair = el("div", {
    class: "db-monster-species-graphic-pair",
    dataset: { testid: "db-monster-species-graphic-pair" },
    children: [
      column(
        speciesStage(record.graphic.monsterResourceId, `${record.name} 앞모습 미리보기`, record.graphic, "db-monster-species-stage"),
        resourcePickerControl({
          label: "앞모습 · 적으로 보일 때",
          resourceId: record.graphic.monsterResourceId,
          kind: "monster",
          testid: "db-monster-species-resource",
          queueKey: `monster-species-resource:${record.id}`,
          allowClear: true,
          allowHue: true,
          currentHue: record.graphic.graphicHue,
          dialogTitle: "종족 몬스터 그래픽",
          onChange: (result) => {
            const current = currentSpecies(record.id, record);
            updateSpecies(record.id, {
              graphic: {
                ...current.graphic,
                monsterResourceId: emptyToUndefined(result.resourceId),
                graphicHue: result.graphicHue ?? current.graphic.graphicHue,
              },
            });
          },
          rerender,
        }),
      ),
      column(
        speciesStage(record.graphic.backResourceId, `${record.name} 뒷모습 미리보기`, record.graphic, "db-monster-species-back-stage"),
        resourcePickerControl({
          label: "뒷모습 · 내 편일 때",
          resourceId: record.graphic.backResourceId,
          kind: "monster",
          testid: "db-monster-species-back-resource",
          queueKey: `monster-species-back-resource:${record.id}`,
          allowClear: true,
          dialogTitle: "종족 전투 뒷모습",
          onChange: (result) => {
            const current = currentSpecies(record.id, record);
            updateSpecies(record.id, {
              graphic: { ...current.graphic, backResourceId: emptyToUndefined(result.resourceId) },
            });
          },
          rerender,
        }),
      ),
    ],
  });
  return [
    pair,
    uxLevel(el("p", {
      class: "db-field-hint db-monster-species-graphic-hint",
      text: "AI 로 만들려면 모습을 한 줄로 적고 [AI로 만들기]를 누르세요. 만드는 동안에도 계속 편집할 수 있습니다.",
    }), "guide"),
    uxLevel(numberField("색조", "db-monster-species-hue", record.graphic.graphicHue, (value) => {
      const current = currentSpecies(record.id, record);
      updateSpecies(record.id, { graphic: { ...current.graphic, graphicHue: value } });
    }, { min: 0, max: 360 }), "advanced"),
  ];
}

// G006: reverse jump — enemies that point at this species via speciesId.
// Append-only list; delete guard remains monsterSpeciesReferenceMessage (toolbar).
function linkedEnemiesCard(record: MonsterSpeciesRecord): HTMLElement {
  const enemies = store.getCurrent().database.enemies.filter((entry) => entry.speciesId === record.id);
  const rows =
    enemies.length === 0
      ? [el("p", { class: "db-monster-species-linked-empty", text: "이 종족 ID를 지정한 전투 몬스터가 없습니다." })]
      : enemies.map((enemy) =>
          el("div", {
            class: "db-monster-species-linked-row",
            children: [
              el("span", { class: "db-monster-species-linked-name", text: enemy.name || "(이름 없음)" }),
              el("button", {
                class: "db-ws-btn db-ws-btn-ghost",
                text: "전투 몬스터 열기",
                attrs: { type: "button" },
                dataset: { testid: `db-monster-species-open-enemy-${enemy.id}` },
                on: {
                  click: (event) => {
                    const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
                    setSelectedRecordId("enemies", enemy.id, { reveal: true });
                    if (!panelRoot) {
                      toast(`전투 몬스터 탭에서 ${enemy.id}를 선택하세요`, "ok");
                      return;
                    }
                    switchDatabaseActiveTab("enemies", panelRoot);
                  },
                },
              }),
            ],
          })
        );

  return sectionCard({
    title: "선택 종족의 명시적 연결",
    hint: `전투 몬스터 ${enemies.length}개 · 같은 ID 호환 연결 제외. 참조가 남으면 삭제할 수 없습니다.`,
    children: [
      el("div", {
        class: "db-monster-species-linked-enemies",
        dataset: { testid: "db-monster-species-linked-enemies" },
        children: rows,
      }),
    ],
    testid: "db-monster-species-linked-card",
  });
}

function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-body") && !current.classList.contains("db-body")) return current;
    current = current.parentElement;
  }
  return null;
}

// 뮤테이션 직전 store에서 레코드를 refetch한다. statFields/hue/resourcePicker 콜백이
// 렌더 시점의 record를 클로저로 캡처한 채 스프레드하면, rerender 없이 연속 편집할 때마다
// 직전 편집이 스테일 스냅샷 위에 덮여 사라진다(HP→MP→공격 순서 입력 시 마지막 필드만 저장).
function currentSpecies(id: string, fallback: MonsterSpeciesRecord): MonsterSpeciesRecord {
  return store.getCurrent().database.monsterSpecies?.find((record) => record.id === id) ?? fallback;
}

function statFields(record: MonsterSpeciesRecord, refresh: () => void): HTMLElement[] {
  // bounds 는 normalizeSpeciesStats(monsterCollection.ts)의 clamp 범위와 숫자까지 일치해야 한다.
  const field = (label: string, key: keyof EnemyStats, testid: string, bounds: { min: number; max: number }): HTMLElement =>
    numberField(label, testid, record.baseStats[key], (value) => {
      const current = currentSpecies(record.id, record);
      updateSpecies(record.id, { baseStats: { ...current.baseStats, [key]: value } });
      refresh();
    }, bounds);
  return [
    field("HP", "maxHp", "db-monster-species-hp", { min: 1, max: 99999 }),
    field("MP", "maxMp", "db-monster-species-mp", { min: 0, max: 9999 }),
    field("공격", "attack", "db-monster-species-atk", { min: 1, max: 999 }),
    field("방어", "defense", "db-monster-species-def", { min: 1, max: 999 }),
    field("정신", "mind", "db-monster-species-mind", { min: 1, max: 999 }),
    field("민첩", "agility", "db-monster-species-agi", { min: 1, max: 999 }),
  ];
}

function speciesStatsPreview(record: MonsterSpeciesRecord): { element: HTMLElement; refresh: () => void } {
  let previewLevel = 1;
  const result = el("p", { class: "db-ws-usage", dataset: { testid: "db-monster-species-stats-preview" } });
  const paint = (level: number): void => {
    previewLevel = level;
    const stats = monsterBattleStatsForSpecies(currentSpecies(record.id, record), level, { hp: 0, atk: 0, def: 0, spd: 0 });
    result.textContent = `Lv${level} · 개체값 0 기준 — HP ${stats.maxHp} / MP ${stats.maxMp} / 공격 ${stats.attack} / 방어 ${stats.defense} / 정신 ${stats.mind} / 민첩 ${stats.agility}`;
  };
  paint(1);
  return { refresh: () => paint(previewLevel), element: el("div", { class: "db-ws-stack", children: [
    numberField("미리보기 레벨", "db-monster-species-preview-level", 1, paint, { min: 1, max: 99 }),
    result,
  ] }) };
}

/**
 * numberInput 에 min/max 를 붙이고 change 시 클램프된 값을 되쓴다 — 화면값과 저장값이
 * 어긋나지 않게(normalize 가 조용히 자르는 것을 사용자가 보게) 한다.
 */
function boundedNumberInput(testid: string, value: number, min: number, max: number, onInput: (value: number) => void): HTMLInputElement {
  const input = numberInput(testid, value, (raw) => onInput(Math.min(max, Math.max(min, raw))));
  input.min = String(min);
  input.max = String(max);
  input.addEventListener("change", () => {
    const clamped = Math.min(max, Math.max(min, Number(input.value) || min));
    input.value = String(clamped);
    onInput(clamped);
  });
  return input;
}

/** 좁은 숫자 입력 + 앞라벨. record-thumbs.css 의 `.db-monster-species-evo-cond` 를 재사용한다. */
function inlineNumber(label: string, input: HTMLInputElement): HTMLElement {
  return el("label", {
    class: "db-monster-species-evo-cond",
    children: [el("span", { text: label }), input],
  });
}

// 습득 스킬을 "레벨 숫자 + 스킬 드롭다운" 행으로 편집한다(주인공 탭 learnedSkillsPanel과 동일한
// 계약). 값 편집(레벨/스킬 변경)은 rerender 없이 store만 갱신해 포커스를 유지하고, 행 추가·삭제처럼
// 구조가 바뀔 때만 rerender 한다. 매 편집 직전 currentSpecies 로 라이브 배열을 refetch 해 연속 편집이
// 스테일 스냅샷 위에 덮이지 않게 한다.
function skillsByLevelCard(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const skills = store.getCurrent().database.skills;
  // Keep row identities in this mounted editor while normalization sorts the saved array.
  // Never write an entire stale draft over a change from undo, another panel, or remote sync.
  const entries = (record.skillsByLevel ?? []).map((entry) => ({ ...entry }));
  let saved = JSON.stringify(record.skillsByLevel ?? []);
  const commit = (mutate: () => void): void => {
    const live = currentSpecies(record.id, record).skillsByLevel ?? [];
    if (JSON.stringify(live) !== saved) {
      toast("스킬 목록이 변경되어 새로 표시합니다. 다시 편집해 주세요.", "info");
      rerender();
      return;
    }
    mutate();
    updateSpecies(record.id, { skillsByLevel: entries });
    saved = JSON.stringify(currentSpecies(record.id, record).skillsByLevel ?? []);
  };
  const rows = entries.map((entry, index) =>
    // `.db-monster-species-evo-row` 는 record-thumbs.css 가 이미 "편집 가능한 행"(flex-wrap,
    // 테두리, select flex, 삭제 버튼 우측 정렬)으로 스타일링해 둔 클래스다 — 스킬 행에도
    // 그대로 재사용해 새 스타일시트 없이 같은 모양을 얻는다.
    el("div", {
      class: "db-monster-species-evo-row db-monster-species-skill-row",
      children: [
        inlineNumber("Lv", boundedNumberInput(`db-monster-species-skill-level-${index}`, entry.level, 1, 99, (level) => {
          commit(() => { entry.level = Math.round(level); });
        })),
        selectInput(`db-monster-species-skill-${index}`, entry.skillId, skills, (skillId) => {
          commit(() => { entry.skillId = skillId; });
        }),
        el("button", {
          class: "db-ws-btn db-ws-btn-danger",
          text: "삭제",
          // 한 탭에 "삭제" 접근명이 3 개(목록·스킬 행·진화 행) 있어 보조기술에서 구분되지
          // 않았다. 보이는 글자는 좁은 행에 맞춰 그대로 두고 접근명만 무엇을 지우는지 밝힌다.
          attrs: { type: "button", "aria-label": `${index + 1}번째 레벨업 스킬 삭제` },
          dataset: { testid: `db-monster-species-skill-delete-${index}` },
          on: {
            click: () => {
              commit(() => { const index = entries.indexOf(entry); if (index >= 0) entries.splice(index, 1); });
              rerender();
            },
          },
        }),
      ],
    })
  );
  const add = el("button", {
    class: "db-ws-btn db-ws-btn-ghost db-monster-species-row-add",
    text: "스킬 추가",
    attrs: { type: "button" },
    dataset: { testid: "db-monster-species-skill-add" },
    on: {
      click: () => {
        const skillId = skills[0]?.id;
        if (!skillId) {
          toast("먼저 [스킬] 탭에서 스킬을 만들어 주세요.", "error");
          return;
        }
        // 스킬은 normalizeSkillsByLevel이 레벨 오름차순으로 정렬한다. 새 행을 레벨 1로 넣으면
        // 목록 맨 위로 튀어 방금 누른 위치(맨 아래)와 어긋나므로, 기존 최대 레벨을 기본값으로 써서
        // 새 행이 맨 아래에 붙게 한다.
        const existing = currentSpecies(record.id, record).skillsByLevel ?? [];
        const nextLevel = existing.reduce((max, entry) => Math.max(max, entry.level), 1);
        updateSpecies(record.id, { skillsByLevel: [...existing, { level: nextLevel, skillId }] });
        rerender();
      },
    },
  });
  return sectionCard({
    title: "레벨별 스킬",
    hint: "지정한 레벨에 도달하면 자동으로 익힙니다.",
    children: [
      el("div", {
        class: "db-monster-species-evo-list",
        dataset: { testid: "db-monster-species-skills" },
        children: rows.length ? rows : [el("p", { class: "db-monster-species-empty-row", text: "아직 없음 — [스킬 추가]로 레벨별 스킬을 지정하세요." })],
      }),
      // sectionCard 본문 직계 자식이어야 workspace-modern.css 의 justify-self:start 가
      // 걸린다(전폭 바 재발 방지).
      add,
    ],
    testid: "db-monster-species-skills-card",
  });
}

// 진화를 "대상 종족 드롭다운 + 조건(레벨/아이템/친밀도)" 행으로 편집한다(직업 탭 promotionControls의
// 계약을 종족용으로 옮긴 것). 대상 후보는 자기 자신을 제외한 다른 종족. 조건을 비우면(0/없음) 해당
// 조건은 무시된다 — updateSpecies가 normalizeMonsterSpeciesRecord로 재정규화하며 undefined로 정리한다.
function evolutionsCard(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const speciesOptions = (project.database.monsterSpecies ?? []).filter((entry) => entry.id !== record.id);
  const items = project.database.items;
  const entries = record.evolutions ?? [];
  const rows = entries.map((evo, index) => {
    const setEvolution = (updater: (current: MonsterEvolutionRecord) => MonsterEvolutionRecord): void => {
      const live = currentSpecies(record.id, record).evolutions ?? [];
      const current = live[index] ?? evo;
      updateSpecies(record.id, { evolutions: live.map((item, i) => (i === index ? updater(current) : item)) });
    };
    return el("div", {
      class: "db-monster-species-evo-row",
      children: [
        selectInput(`db-monster-species-evo-target-${index}`, evo.toSpeciesId, speciesOptions, (toSpeciesId) =>
          setEvolution((current) => ({ ...current, toSpeciesId }))
        ),
        inlineNumber("Lv", boundedNumberInput(`db-monster-species-evo-level-${index}`, evo.requires.level ?? 0, 0, 99, (level) =>
          setEvolution((current) => ({ ...current, requires: { ...current.requires, level: level > 0 ? level : undefined } }))
        )),
        selectInput(`db-monster-species-evo-item-${index}`, evo.requires.itemId ?? "", items, (itemId) =>
          setEvolution((current) => ({ ...current, requires: { ...current.requires, itemId: itemId || undefined } }))
        ),
        inlineNumber("친밀도", boundedNumberInput(`db-monster-species-evo-friendship-${index}`, evo.requires.friendshipAtLeast ?? 0, 0, 255, (friendship) =>
          setEvolution((current) => ({
            ...current,
            requires: { ...current.requires, friendshipAtLeast: friendship > 0 ? friendship : undefined },
          }))
        )),
        el("button", {
          class: "db-ws-btn db-ws-btn-danger",
          text: "삭제",
          attrs: { type: "button", "aria-label": `${index + 1}번째 진화 규칙 삭제` },
          dataset: { testid: `db-monster-species-evo-delete-${index}` },
          on: {
            click: () => {
              updateSpecies(record.id, {
                evolutions: (currentSpecies(record.id, record).evolutions ?? []).filter((_, i) => i !== index),
              });
              rerender();
            },
          },
        }),
      ],
    });
  });
  const add = el("button", {
    class: "db-ws-btn db-ws-btn-ghost db-monster-species-row-add",
    text: "진화 추가",
    attrs: { type: "button" },
    dataset: { testid: "db-monster-species-evo-add" },
    on: {
      click: () => {
        const target = speciesOptions[0]?.id;
        if (!target) {
          toast("진화 대상이 될 다른 종족을 먼저 추가하세요.", "error");
          return;
        }
        updateSpecies(record.id, {
          evolutions: [...(currentSpecies(record.id, record).evolutions ?? []), { toSpeciesId: target, requires: { level: defaultEvolutionLevel(record) } }],
        });
        rerender();
      },
    },
  });
  const cycleIds = monsterEvolutionCycleSpeciesIds(store.getCurrent().database.monsterSpecies ?? []);
  const cycleWarn = cycleIds.includes(record.id)
    ? [
        el("p", {
          class: "db-field-hint db-monster-species-evolution-cycle-warn",
          dataset: { testid: "db-monster-species-evolution-cycle-warn" },
          text: `진화 그래프에 사이클이 있습니다: ${cycleIds.join(" → ")} — 레벨업마다 종족이 왕복합니다.`,
        }),
      ]
    : [];
  return sectionCard({
    title: "진화",
    hint: "입력한 조건은 모두 충족해야 합니다. 여러 진화가 가능하면 위의 규칙부터 적용됩니다. 0/없음은 조건을 사용하지 않습니다.",
    children: [
      el("div", {
        class: "db-monster-species-evo-list",
        dataset: { testid: "db-monster-species-evolutions" },
        children: rows.length ? rows : [el("p", { class: "db-monster-species-empty-row", text: "없음 — [진화 추가]로 대상 종족과 조건을 지정하세요." })],
      }),
      add,
      ...cycleWarn,
      el("small", { text: "아이템 조건이 있는 진화는 레벨업으로 발동하지 않습니다 — 이벤트 명령 \"몬스터 진화\"로만 발동합니다." }),
    ],
    testid: "db-monster-species-evolutions-card",
  });
}

/**
 * 공유 곡선 패널이 그리는 스파크라인 버튼(`.db-class-exp-graph` + `<i>` 막대)은 대응
 * 스타일시트가 어디에도 없다 — 막대가 `height:%` 만 갖고 부모가 높이도 flex 도 아니라서
 * 20×6px 짜리 회색 조각으로 찌그러지고, 그게 곡선 편집기를 여는 유일한 어피던스였다.
 * 공유 파일을 건드리지 않고(그리고 아직 import 되지 않은 새 스타일시트를 기다리지 않고)
 * 이 탭이 만든 노드에만 최소 치수를 인라인으로 준다. 근본 수정은 leadRequests 참조.
 */
function paintCurveSparkline(host: HTMLElement): void {
  const graph = host.querySelector(".db-class-exp-graph");
  if (!(graph instanceof HTMLElement)) return;
  graph.style.alignItems = "flex-end";
  graph.style.background = "var(--db-studio-inset)";
  graph.style.border = "1px solid var(--db-studio-border-subtle)";
  graph.style.borderRadius = "8px";
  graph.style.cursor = "pointer";
  graph.style.display = "flex";
  graph.style.gap = "1px";
  graph.style.height = "58px";
  graph.style.padding = "6px";
  graph.style.width = "100%";
  // 카드 폭을 다 먹으면 "전폭 액션 바"(감사 A 축 결함)와 구분이 안 된다 — 차트로 읽히게 캡을 둔다.
  graph.style.maxWidth = "400px";
  for (const bar of Array.from(graph.querySelectorAll("i"))) {
    if (!(bar instanceof HTMLElement)) continue;
    bar.style.background = "var(--db-studio-accent)";
    bar.style.borderRadius = "1px";
    bar.style.flex = "1 1 0";
    bar.style.minWidth = "0";
    bar.style.opacity = "0.7";
  }
}

function experienceCurveCard(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const host = el("div", { class: "db-class-exp-content", dataset: { testid: "db-monster-species-exp-curve" } });
  const refresh = (): void => {
    renderExperienceCurvePanel(
      {
        testidPrefix: "db-monster-species-exp",
        dialogLabel: "종족 경험치 곡선 설정",
        readCurve: () => currentSpecies(record.id, record).expCurve ?? DEFAULT_MONSTER_EXP_CURVE,
        onCommit: (expCurve) => updateSpecies(record.id, { expCurve }),
        refresh: () => {
          refresh();
          rerender();
        },
      },
      host
    );
    paintCurveSparkline(host);
  };
  refresh();
  return sectionCard({
    title: "경험치 곡선",
    hint: "포획한 개체가 레벨업하는 속도입니다.",
    children: [host],
    testid: "db-monster-species-exp-card",
  });
}

// 이 종족을 진화 대상으로 가리키는 다른 종족 — 삭제 가드(monsterSpeciesReferenceMessage)와 같은 소스.
function evolutionReferrersCard(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const referrers = (store.getCurrent().database.monsterSpecies ?? []).filter(
    (entry) => entry.id !== record.id && (entry.evolutions ?? []).some((evo) => evo.toSpeciesId === record.id)
  );
  const rows =
    referrers.length === 0
      ? [el("p", { class: "db-monster-species-linked-empty", text: "이 종족으로 진화하는 종족이 없습니다." })]
      : referrers.map((entry) =>
          el("div", {
            class: "db-monster-species-linked-row",
            children: [
              el("span", { class: "db-monster-species-linked-name", text: entry.name || "(이름 없음)" }),
              el("button", {
                class: "db-ws-btn db-ws-btn-ghost",
                text: "종족 열기",
                attrs: { type: "button" },
                dataset: { testid: `db-monster-species-open-referrer-${entry.id}` },
                on: {
                  click: () => {
                    setSelectedMonsterSpeciesId(entry.id, { reveal: true });
                    rerender();
                  },
                },
              }),
            ],
          })
        );
  return sectionCard({
    title: "이 종족으로 진화하는 종족",
    children: [
      el("div", {
        class: "db-monster-species-linked-enemies",
        dataset: { testid: "db-monster-species-evolution-referrers" },
        children: rows,
      }),
    ],
    testid: "db-monster-species-referrers-card",
  });
}

/** 조건 없는 진화(다음 레벨업 즉시 진화)를 기본값으로 만들지 않는다. */
function defaultEvolutionLevel(record: MonsterSpeciesRecord): number {
  const highestSkillLevel = (record.skillsByLevel ?? []).reduce((max, entry) => Math.max(max, entry.level), 5);
  return Math.min(99, highestSkillLevel + 5);
}

function parseTypes(value: string): { readonly types: string[]; readonly truncated: boolean } {
  const unique = [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
  return { types: unique.slice(0, 2), truncated: unique.length > 2 };
}

function typesField(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const chartTypes = store.getCurrent().system.typeChart?.types ?? [];
  if (chartTypes.length === 0) {
    return el("div", {
      class: "db-monster-species-types-free",
      dataset: { testid: "db-monster-species-types-free" },
      children: [
        textControl("타입(최대 2, 쉼표 구분)", (record.types ?? []).join(", "), (value) => {
          const parsed = parseTypes(value);
          if (parsed.truncated) toast("타입 2개까지만 저장했습니다", "info");
          updateSpecies(record.id, { types: parsed.types });
        }, "db-monster-species-types"),
        el("div", {
          class: "db-field-hint",
          dataset: { testid: "db-monster-species-types-hint" },
          text: "시스템 탭의 타입 상성에서 타입 목록을 설정하면 여기서 선택 UI로 바뀝니다.",
        }),
      ],
    });
  }

  const selected = record.types ?? [];
  const chartSet = new Set(chartTypes);
  const outliers = selected.filter((type) => !chartSet.has(type));
  const chips = [...chartTypes, ...outliers].map((type) => {
    const input = el("input", {
      attrs: { type: "checkbox" },
      dataset: { testid: `db-monster-species-type-${type}` },
    }) as HTMLInputElement;
    input.checked = selected.includes(type);
    input.addEventListener("change", () => {
      const current = currentSpecies(record.id, record);
      const live = current.types ?? [];
      let next: string[];
      if (input.checked) {
        if (live.includes(type)) {
          next = [...live];
        } else if (live.length >= 2) {
          // 최대 2개 — 세 번째 선택은 저장하지 않고 체크 표시만 되돌린다.
          input.checked = false;
          toast("타입은 최대 2개입니다", "info");
          return;
        } else {
          next = [...live, type];
        }
      } else {
        next = live.filter((entry) => entry !== type);
      }
      updateSpecies(record.id, { types: next.length > 0 ? next : undefined });
      rerender();
    });
    const label = monsterTypeLabel(type);
    return el("label", {
      class: "actor-check db-monster-species-type-chip",
      attrs: { title: label === type ? type : `${label} (${type})` },
      dataset: { tone: monsterTypeTone(type), checked: input.checked ? "true" : "false" },
      children: [input, el("span", { text: chartSet.has(type) ? label : `${label} (미등록 · 해제 가능)` })],
    });
  });

  const children: HTMLElement[] = [
    el("strong", { text: "타입(최대 2)" }),
    el("div", { class: "db-monster-species-type-chips", children: chips }),
    el("span", { class: "db-field-hint db-monster-species-type-hint", text: "타입 상성표는 시스템 탭에 있습니다." }),
  ];
  if (outliers.length > 0) {
    children.push(
      el("div", {
        class: "db-field-hint db-monster-species-type-warn",
        dataset: { testid: "db-monster-species-type-warn" },
        text: `타입 상성표에 없는 타입: ${outliers.join(", ")}`,
      }),
    );
  }

  return el("div", {
    class: "db-item-choice-list db-monster-species-types",
    dataset: { testid: "db-monster-species-types" },
    children,
  });
}

function updateSpecies(id: string, patch: Partial<MonsterSpeciesRecord>): void {
  recordCoalescedSnapshot(`db-monster-species:${id}:${Object.keys(patch).sort().join(",")}`);
  store.update((project) => {
    const records = project.database.monsterSpecies ?? [];
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return;
    records[index] = normalizeMonsterSpeciesRecord({ ...records[index], ...patch });
    project.database.monsterSpecies = records;
  }, { scope: "database", collection: "monsterSpecies", label: "몬스터 종족 편집" });
  paintSpeciesSummaries?.();
}
