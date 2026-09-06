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
  listSearch,
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
import { capturePreviewLine } from "@/editor/panels/databaseCapturePreview";
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

export function setSelectedMonsterSpeciesId(id?: string): void {
  selectedSpeciesId = id;
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
// 서브탭(inspectorTabs)은 **의도적으로 쓰지 않는다**: qa-enemies.spec.ts 의 종족 CRUD
// 라운드트립이 db-monster-species-{hp,mp,atk,def,mind,agi,skill-*,evo-*} 를 서브탭
// 클릭 없이 fill() 한다(= 항상 보여야 한다). 대신 제목 있는 sectionCard 스택으로
// 나눠 감사 C 축(구분 없는 평평한 벽)을 해소한다.
// ---------------------------------------------------------------------------

export function renderMonsterSpeciesTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const species = project.database.monsterSpecies ?? [];
  if (!selectedSpeciesId || !species.some((record) => record.id === selectedSpeciesId)) {
    selectedSpeciesId = species[0]?.id;
  }
  const selected = species.find((record) => record.id === selectedSpeciesId);
  const query = speciesSearch.trim();

  const rows: HTMLElement[] = [];
  for (const [index, record] of species.entries()) {
    if (query && !matchesNameOrId(record.name, record.id, query)) continue;
    rows.push(speciesListRow(project, record, index, rerender));
  }

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
    // 필터가 걸리면 `보이는/전체` 로 적는다 — 필터 전 개수만 보여주면 행 0 개인데 "9개"가 된다.
    count: query && rows.length !== species.length ? `${rows.length}/${species.length}개` : species.length,
    search: listSearch({
      placeholder: "이름 또는 ID 검색",
      value: speciesSearch,
      testid: "db-monster-species-search",
      onInput: (value) => {
        speciesSearch = value;
        rerender();
      },
    }),
    rows,
    empty: query.length > 0
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${query}" 와 일치하는 종족이 없습니다.`, compact: true })
      : emptyState({ icon: "◇", title: "아직 종족이 없습니다", compact: true }),
    toolbar,
    testid: "db-monster-species-list-pane",
  });

  const detail = selected
    ? makeDetailPane({
      hero: speciesHero(project, selected, species.indexOf(selected)),
      body: speciesInspector(selected, rerender),
      testid: "db-detail-form",
    })
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
}

function speciesListRow(
  project: ReturnType<typeof store.getCurrent>,
  record: MonsterSpeciesRecord,
  index: number,
  rerender: () => void,
): HTMLElement {
  return listRow({
    name: record.name,
    sub: (record.types ?? []).join("·") || undefined,
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
): HTMLElement {
  const skills = (record.skillsByLevel ?? []).length;
  const evolutions = (record.evolutions ?? []).length;
  const tags = [
    `#${index + 1}`,
    ...(record.types ?? []),
    `포획 계수 ${record.captureRate}`,
    `레벨별 스킬 ${skills}개`,
    `진화 ${evolutions}개`,
  ];
  return detailHero({
    eyebrow: "포획·성장 종족",
    title: record.name || "(이름 없음)",
    // 레코드 id 를 상세 창에 실제 텍스트로 노출한다 — 예전에는 목록 행의 title 속성에만
    // 있어서 "지금 편집 중인 게 어느 레코드인지" 를 화면에서 확인할 수 없었다.
    subtitle: record.id,
    media: recordIconElement(imageIconOf(project, record.graphic.monsterResourceId), record.name),
    tags,
    testid: "db-monster-species-hero",
  });
}

function addSpecies(rerender: () => void): void {
  const id = genId("species");
  recordProjectSnapshot();
  store.update((project) => {
    project.database.monsterSpecies ??= [];
    project.database.monsterSpecies.push(normalizeMonsterSpeciesRecord({ id, name: "새 species" }));
  }, { scope: "database", collection: "monsterSpecies", label: "몬스터 종족 편집" });
  selectedSpeciesId = id;
  // 새 레코드가 검색 필터에 걸려 안 보이는 상황을 만들지 않는다.
  speciesSearch = "";
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
  selectedSpeciesId = copyId;
  speciesSearch = "";
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

  return el("div", {
    class: "db-life-header",
    children: [
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
    ],
  });
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

/** 상세 인스펙터 — 제목 있는 카드 스택. 카드는 폭이 되는 만큼 2 열로 흐른다. */
function speciesInspector(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const preview = speciesStatsPreview(record);
  return el("div", {
    class: "db-ws-stack",
    children: [
      sectionCard({
        title: "이름과 타입",
        hint: "타입은 시스템 탭의 타입 상성표와 연결됩니다.",
        children: [
          textControl("이름", record.name, (value) => updateSpecies(record.id, { name: value }), "db-monster-species-name"),
          typesField(record, rerender),
        ],
        testid: "db-monster-species-identity-card",
      }),
      sectionCard({
        title: "그래픽",
        hint: "종족의 외형입니다. 연결된 전투 몬스터의 외형은 자동으로 바뀌지 않습니다.",
        children: graphicChildren(record, rerender),
        testid: "db-monster-species-graphic-card",
      }),
      sectionCard({
        title: "포획",
        hint: "0에 가까울수록 잡기 어렵습니다.",
        children: [
          numberField("기본 포획 계수", "db-monster-species-capture-rate", record.captureRate, (value) => {
            updateSpecies(record.id, { captureRate: value });
          }, { min: 0, max: 1, step: 0.01 }),
          capturePreviewLine(record.captureRate, "db-monster-species-capture-preview"),
        ],
        testid: "db-monster-species-capture-card",
      }),
      sectionCard({
        title: "종족값과 실제 능력치",
        hint: "포획 후 성장 공식에 쓰는 기본값입니다. 전투 몬스터의 고정 능력치와 별개이며, 아래에서 레벨별 수치를 확인합니다.",
        children: [...statFields(record, preview.refresh), preview.element],
        testid: "db-monster-species-stats-card",
      }),
      skillsByLevelCard(record, rerender),
      evolutionsCard(record, rerender),
      experienceCurveCard(record, rerender),
      linkedEnemiesCard(record),
      evolutionReferrersCard(record),
    ],
  });
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

function graphicChildren(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement[] {
  const previewUrl = resolveAssetResourceUrl(record.graphic.monsterResourceId, { project: store.getCurrent() });
  const stageImage = previewUrl
    ? el("img", { attrs: { alt: `${record.name} 미리보기`, src: previewUrl } })
    : el("span", { class: "db-enemy-empty-graphic", text: "(없음)" });
  if (stageImage instanceof HTMLImageElement) {
    stageImage.style.filter = `hue-rotate(${record.graphic.graphicHue}deg)`;
    stageImage.style.opacity = record.graphic.transparent ? "0.58" : "1";
    // Magenta #FF00FF chroma-key (same contract as enemy previews / DB art pipeline).
    applyMagentaChromaKey(stageImage);
  }
  return [
    el("div", {
      class: "db-monster-species-stage",
      dataset: { testid: "db-monster-species-stage" },
      children: [stageImage],
    }),
    relaxHiddenIdInput(resourcePickerControl({
      label: "몬스터 리소스",
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
    })),
    numberField("그래픽 Hue", "db-monster-species-hue", record.graphic.graphicHue, (value) => {
      const current = currentSpecies(record.id, record);
      updateSpecies(record.id, { graphic: { ...current.graphic, graphicHue: value } });
    }, { min: 0, max: 360 }),
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
                    setSelectedRecordId("enemies", enemy.id);
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
function evolutionReferrersCard(record: MonsterSpeciesRecord): HTMLElement {
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
                    setSelectedMonsterSpeciesId(entry.id);
                    toast(`${entry.name || entry.id} 선택`, "ok");
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
    return el("label", {
      class: "actor-check db-monster-species-type-chip",
      children: [input, el("span", { text: chartSet.has(type) ? type : `${type} (미등록 · 해제 가능)` })],
    });
  });

  const children: HTMLElement[] = [
    el("strong", { text: "타입(최대 2)" }),
    ...chips,
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
}
