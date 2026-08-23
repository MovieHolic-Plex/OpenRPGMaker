import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { duplicateInto } from "@/editor/databaseCopy";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { monsterSpeciesReferenceMessage } from "@/editor/databaseReferences";
import { numberInput, selectInput } from "@/editor/panels/actorRecordControls";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { emptyToUndefined, numberField, textControl } from "@/editor/panels/databaseControls";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { imageIconOf, recordIconElement } from "@/editor/panels/eventEditor/recordPicker";
import { applyMagentaChromaKey } from "@/editor/panels/chromaKey";
import { DEFAULT_MONSTER_EXP_CURVE, monsterEvolutionCycleSpeciesIds, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
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
export function setSelectedMonsterSpeciesId(id?: string): void {
  selectedSpeciesId = id;
}

export function getSelectedMonsterSpeciesId(): string | undefined {
  return selectedSpeciesId;
}

export function renderMonsterSpeciesTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const species = project.database.monsterSpecies ?? [];
  if (!selectedSpeciesId || !species.some((record) => record.id === selectedSpeciesId)) {
    selectedSpeciesId = species[0]?.id;
  }
  const selected = species.find((record) => record.id === selectedSpeciesId);
  const list = el("div", { class: "db-list" });
  for (const record of species) {
    const row = el("button", {
      class: `db-list-row${record.id === selectedSpeciesId ? " active" : ""}`,
      attrs: { type: "button", title: `${record.name} (${record.id})` },
      dataset: { testid: `db-monster-species-row-${record.id}`, recordId: record.id },
      on: {
        click: () => {
          selectedSpeciesId = record.id;
          rerender();
        },
      },
    });
    row.append(
      recordIconElement(imageIconOf(project, record.graphic.monsterResourceId), record.name),
      el("span", { class: "db-list-name", text: record.name || "(이름 없음)" }),
      el("small", { text: record.id })
    );
    list.append(row);
  }

  const listPane = el("div", { class: "db-list-pane oprn-record-list-pane" });
  listPane.append(
    el("h3", { text: "종족" }),
    list,
    el("div", { class: "db-list-footer", text: `${species.length}개` }),
    toolbar(rerender)
  );
  const detailPane = el("div", { class: "db-detail-pane oprn-record-detail-pane" });
  detailPane.append(selected ? speciesForm(selected, rerender) : el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" }, text: "종족이 없습니다." }));
  // 종족 탭은 dense 고정높이 스크롤 대상이 아니라(자연 흐름) 배너를 워크스페이스 앞 형제로 두면 된다.
  // 인트로-셸(height:100% 그리드)을 쓰면 상세 폼에 확정 높이가 생겨 그래픽 스테이지(height:100%)가
  // 늘어나 아래 필드를 밀어내므로 여기서는 셸을 쓰지 않는다.
  host.append(
    el("p", {
      class: "db-record-intro",
      dataset: { testid: "db-monster-species-intro" },
      text: "이 탭은 잡아서 키우는 몬스터(종족)의 종족값·레벨업 스킬·진화를 정의합니다. 전투에 나오는 야생·적 몬스터의 스탯은 [몬스터] 탭에서, 스킬 자체는 [스킬] 탭에서 만듭니다.",
    }),
    el("div", { class: "db-record-workspace oprn-record-workspace oprn-record-monster-species", children: [listPane, detailPane] })
  );
}

function toolbar(rerender: () => void): HTMLElement {
  const add = el("button", {
    class: "db-toolbar-button",
    text: "추가",
    attrs: { type: "button" },
    dataset: { testid: "db-monster-species-add" },
    on: {
      click: () => {
        const id = genId("species");
        recordProjectSnapshot();
        store.update((project) => {
          project.database.monsterSpecies ??= [];
          project.database.monsterSpecies.push(normalizeMonsterSpeciesRecord({ id, name: "새 species" }));
        }, { scope: "database", collection: "monsterSpecies" });
        selectedSpeciesId = id;
        rerender();
      },
    },
  });
  const duplicate = el("button", {
    class: "db-toolbar-button",
    text: "복제",
    attrs: { type: "button" },
    dataset: { testid: "db-monster-species-duplicate" },
    on: {
      click: () => {
        const id = selectedSpeciesId;
        if (!id) return;
        const copyId = genId("species");
        recordProjectSnapshot();
        store.update((project) => {
          project.database.monsterSpecies ??= [];
          duplicateInto(project.database.monsterSpecies, id, copyId);
        }, { scope: "database", collection: "monsterSpecies" });
        selectedSpeciesId = copyId;
        rerender();
      },
    },
  });
  const remove = deleteSpeciesButton(rerender);
  return el("div", { class: "db-toolbar", children: [add, duplicate, remove] });
}

// 다른 레코드 탭(databaseAdvancedRecordViews.ts의 deleteButton)과 동일한 2단계 확인 +
// 참조 가드 패턴 — monsterSpecies는 DatabaseCollection에 편입돼 있지 않아 그 공용 구현을
// 그대로 재사용할 수 없으므로 이 뷰에서 같은 계약을 재현한다.
function deleteSpeciesButton(rerender: () => void): HTMLElement {
  let armedId: string | null = null;
  let armedUntil = 0;
  let resetTimer: number | null = null;

  const button = el("button", {
    class: "db-toolbar-button danger",
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
        }, { scope: "database", collection: "monsterSpecies" });
        selectedSpeciesId = undefined;
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        rerender();
      },
    },
  });
  return button;
}

function speciesForm(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const form = el("section", { class: "db-detail-form oprn-detail-form", dataset: { testid: "db-detail-form" } });
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
  form.append(
    el("div", { class: "db-record-id", children: [el("span", { text: "ID" }), el("code", { text: record.id })] }),
    textControl("이름", record.name, (value) => updateSpecies(record.id, { name: value }), "db-monster-species-name"),
    el("div", {
      class: "db-monster-species-stage",
      dataset: { testid: "db-monster-species-stage" },
      children: [stageImage],
    }),
    resourcePickerControl({
      label: "몬스터 리소스",
      resourceId: record.graphic.monsterResourceId,
      kind: "monster",
      testid: "db-monster-species-resource",
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
    typesField(record, rerender),
    numberField("그래픽 Hue", "db-monster-species-hue", record.graphic.graphicHue, (value) => {
      const current = currentSpecies(record.id, record);
      updateSpecies(record.id, { graphic: { ...current.graphic, graphicHue: value } });
    }, { min: 0, max: 360 }),
    numberField("포획률(0~1)", "db-monster-species-capture-rate", record.captureRate, (value) => {
      updateSpecies(record.id, { captureRate: value });
    }, { min: 0, max: 1 }),
    capturePreviewLine(record.captureRate, "db-monster-species-capture-preview"),
    ...statFields(record),
    skillsByLevelField(record, rerender),
    evolutionsField(record, rerender),
    experienceCurveField(record, rerender),
    linkedEnemiesField(record),
    evolutionReferrersField(record)
  );
  return form;
}

// G006: reverse jump — enemies that point at this species via speciesId.
// Append-only list; delete guard remains monsterSpeciesReferenceMessage (toolbar).
function linkedEnemiesField(record: MonsterSpeciesRecord): HTMLElement {
  const enemies = store.getCurrent().database.enemies.filter((entry) => entry.speciesId === record.id);
  const rows =
    enemies.length === 0
      ? [el("p", { class: "db-monster-species-linked-empty", text: "이 종족을 포획 종족으로 쓰는 몬스터가 없습니다." })]
      : enemies.map((enemy) =>
          el("div", {
            class: "db-monster-species-linked-row",
            children: [
              el("span", { class: "db-monster-species-linked-name", text: enemy.name || "(이름 없음)" }),
              el("small", { text: enemy.id }),
              el("button", {
                class: "btn small",
                text: "몬스터 열기",
                attrs: { type: "button" },
                dataset: { testid: `db-monster-species-open-enemy-${enemy.id}` },
                on: {
                  click: (event) => {
                    const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
                    setSelectedRecordId("enemies", enemy.id);
                    if (!panelRoot) {
                      toast(`몬스터 탭에서 ${enemy.id}를 선택하세요`, "ok");
                      return;
                    }
                    switchDatabaseActiveTab("enemies", panelRoot);
                  },
                },
              }),
            ],
          })
        );

  return el("div", {
    class: "db-monster-species-linked-enemies",
    dataset: { testid: "db-monster-species-linked-enemies" },
    children: [
      el("h4", { class: "db-monster-species-linked-title", text: "이 종족을 쓰는 몬스터" }),
      ...rows,
    ],
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

function statFields(record: MonsterSpeciesRecord): HTMLElement[] {
  // bounds 는 normalizeSpeciesStats(monsterCollection.ts)의 clamp 범위와 숫자까지 일치해야 한다.
  const field = (label: string, key: keyof EnemyStats, testid: string, bounds: { min: number; max: number }): HTMLElement =>
    numberField(label, testid, record.baseStats[key], (value) => {
      const current = currentSpecies(record.id, record);
      updateSpecies(record.id, { baseStats: { ...current.baseStats, [key]: value } });
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

// 습득 스킬을 "레벨 숫자 + 스킬 드롭다운" 행으로 편집한다(주인공 탭 learnedSkillsPanel과 동일한
// 계약). 값 편집(레벨/스킬 변경)은 rerender 없이 store만 갱신해 포커스를 유지하고, 행 추가·삭제처럼
// 구조가 바뀔 때만 rerender 한다. 매 편집 직전 currentSpecies 로 라이브 배열을 refetch 해 연속 편집이
// 스테일 스냅샷 위에 덮이지 않게 한다.
function skillsByLevelField(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const skills = store.getCurrent().database.skills;
  const entries = record.skillsByLevel ?? [];
  const rows = entries.map((entry, index) =>
    el("div", {
      class: "actor-skill-row db-monster-species-skill-row",
      children: [
        boundedNumberInput(`db-monster-species-skill-level-${index}`, entry.level, 1, 99, (level) => {
          updateSpecies(record.id, {
            skillsByLevel: (currentSpecies(record.id, record).skillsByLevel ?? []).map((item, i) =>
              i === index ? { ...item, level } : item
            ),
          });
        }),
        selectInput(`db-monster-species-skill-${index}`, entry.skillId, skills, (skillId) => {
          updateSpecies(record.id, {
            skillsByLevel: (currentSpecies(record.id, record).skillsByLevel ?? []).map((item, i) =>
              i === index ? { ...item, skillId } : item
            ),
          });
        }),
        el("button", {
          class: "btn small",
          text: "삭제",
          attrs: { type: "button" },
          dataset: { testid: `db-monster-species-skill-delete-${index}` },
          on: {
            click: () => {
              updateSpecies(record.id, {
                skillsByLevel: (currentSpecies(record.id, record).skillsByLevel ?? []).filter((_, i) => i !== index),
              });
              rerender();
            },
          },
        }),
      ],
    })
  );
  const add = el("button", {
    class: "btn small db-monster-species-row-add",
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
  return el("div", {
    class: "db-field db-monster-species-skill-field",
    children: [
      el("span", { text: "레벨별 스킬" }),
      el("div", {
        class: "actor-skill-header",
        children: [el("span", { text: "레벨" }), el("span", { text: "스킬" }), el("span", { text: "" })],
      }),
      el("div", {
        class: "actor-skill-list",
        dataset: { testid: "db-monster-species-skills" },
        children: rows.length ? rows : [el("p", { class: "db-monster-species-empty-row", text: "아직 없음 — [스킬 추가]로 레벨별 스킬을 지정하세요." })],
      }),
      add,
    ],
  });
}

// 진화를 "대상 종족 드롭다운 + 조건(레벨/아이템/친밀도)" 행으로 편집한다(직업 탭 promotionControls의
// 계약을 종족용으로 옮긴 것). 대상 후보는 자기 자신을 제외한 다른 종족. 조건을 비우면(0/없음) 해당
// 조건은 무시된다 — updateSpecies가 normalizeMonsterSpeciesRecord로 재정규화하며 undefined로 정리한다.
function evolutionsField(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
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
        el("label", {
          class: "db-monster-species-evo-cond",
          children: [
            el("span", { text: "Lv" }),
            boundedNumberInput(`db-monster-species-evo-level-${index}`, evo.requires.level ?? 0, 0, 99, (level) =>
              setEvolution((current) => ({ ...current, requires: { ...current.requires, level: level > 0 ? level : undefined } }))
            ),
          ],
        }),
        selectInput(`db-monster-species-evo-item-${index}`, evo.requires.itemId ?? "", items, (itemId) =>
          setEvolution((current) => ({ ...current, requires: { ...current.requires, itemId: itemId || undefined } }))
        ),
        el("label", {
          class: "db-monster-species-evo-cond",
          children: [
            el("span", { text: "친밀도" }),
            boundedNumberInput(`db-monster-species-evo-friendship-${index}`, evo.requires.friendshipAtLeast ?? 0, 0, 255, (friendship) =>
              setEvolution((current) => ({
                ...current,
                requires: { ...current.requires, friendshipAtLeast: friendship > 0 ? friendship : undefined },
              }))
            ),
          ],
        }),
        el("button", {
          class: "btn small",
          text: "삭제",
          attrs: { type: "button" },
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
    class: "btn small db-monster-species-row-add",
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
  return el("div", {
    class: "db-field db-monster-species-evo-field",
    children: [
      el("span", { text: "진화" }),
      el("div", {
        class: "db-monster-species-evo-list",
        dataset: { testid: "db-monster-species-evolutions" },
        children: rows.length ? rows : [el("p", { class: "db-monster-species-empty-row", text: "없음 — [진화 추가]로 대상 종족과 조건을 지정하세요." })],
      }),
      add,
      ...cycleWarn,
      el("small", { text: "조건(레벨/아이템/친밀도)을 비우면(0/없음) 그 조건은 무시됩니다." }),
      el("small", { text: "아이템 조건이 있는 진화는 레벨업으로 발동하지 않습니다 — 이벤트 명령 \"몬스터 진화\"로만 발동합니다." }),
    ],
  });
}

function experienceCurveField(record: MonsterSpeciesRecord, rerender: () => void): HTMLElement {
  const host = el("div", { class: "db-class-exp-content", dataset: { testid: "db-monster-species-exp-curve" } });
  const refresh = (): void =>
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
  refresh();
  return el("div", { class: "db-field db-monster-species-exp-field", children: [el("span", { text: "경험치 곡선" }), host] });
}

// 이 종족을 진화 대상으로 가리키는 다른 종족 — 삭제 가드(monsterSpeciesReferenceMessage)와 같은 소스.
function evolutionReferrersField(record: MonsterSpeciesRecord): HTMLElement {
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
              el("small", { text: entry.id }),
              el("button", {
                class: "btn small",
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
  return el("div", {
    class: "db-monster-species-linked-enemies",
    dataset: { testid: "db-monster-species-evolution-referrers" },
    children: [el("h4", { class: "db-monster-species-linked-title", text: "이 종족으로 진화하는 종족" }), ...rows],
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
  const chips = chartTypes.map((type) => {
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
      children: [input, el("span", { text: type })],
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
  }, { scope: "database", collection: "monsterSpecies" });
}
