import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { duplicateInto } from "@/editor/databaseCopy";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { monsterSpeciesReferenceMessage } from "@/editor/databaseReferences";
import { emptyToUndefined, numberField, textControl } from "@/editor/panels/databaseControls";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { imageIconOf, recordIconElement } from "@/editor/panels/eventEditor/recordPicker";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { store } from "@/project/store";
import type { ActorLearnedSkill, EnemyStats, MonsterEvolutionRecord, MonsterSpeciesRecord } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let selectedSpeciesId: string | undefined;

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

  const listPane = el("div", { class: "db-list-pane rm2k3-record-list-pane" });
  listPane.append(
    el("h3", { text: "몬스터 species" }),
    list,
    el("div", { class: "db-list-footer", text: `${species.length}개` }),
    toolbar(rerender)
  );
  const detailPane = el("div", { class: "db-detail-pane rm2k3-record-detail-pane" });
  detailPane.append(selected ? speciesForm(selected, rerender) : el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" }, text: "species가 없습니다." }));
  host.append(el("div", { class: "db-record-workspace rm2k3-record-workspace rm2k3-record-monster-species", children: [listPane, detailPane] }));
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
  const form = el("section", { class: "db-detail-form rm2k3-detail-form", dataset: { testid: "db-detail-form" } });
  const previewUrl = resolveAssetResourceUrl(record.graphic.monsterResourceId, { project: store.getCurrent() });
  const stageImage = previewUrl
    ? el("img", { attrs: { alt: `${record.name} 미리보기`, src: previewUrl } })
    : el("span", { class: "db-enemy-empty-graphic", text: "(없음)" });
  if (stageImage instanceof HTMLImageElement) {
    stageImage.style.filter = `hue-rotate(${record.graphic.graphicHue}deg)`;
    stageImage.style.opacity = record.graphic.transparent ? "0.58" : "1";
  }
  form.append(
    el("div", { class: "db-record-id", children: [el("span", { text: "ID" }), el("code", { text: record.id })] }),
    textControl("이름", record.name, (value) => updateSpecies(record.id, { name: value }), "db-monster-species-name"),
    el("div", {
      class: "db-enemy-graphic-stage db-monster-species-stage",
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
      dialogTitle: "Species 몬스터 그래픽",
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
    textControl("타입(최대 2, 쉼표 구분)", (record.types ?? []).join(", "), (value) => {
      updateSpecies(record.id, { types: parseTypes(value) });
    }, "db-monster-species-types"),
    numberField("그래픽 Hue", "db-monster-species-hue", record.graphic.graphicHue, (value) => {
      const current = currentSpecies(record.id, record);
      updateSpecies(record.id, { graphic: { ...current.graphic, graphicHue: value } });
    }),
    numberField("포획률(0~1)", "db-monster-species-capture-rate", record.captureRate, (value) => {
      updateSpecies(record.id, { captureRate: value });
    }),
    ...statFields(record),
    skillsByLevelField(record),
    evolutionsField(record)
  );
  return form;
}

// 뮤테이션 직전 store에서 레코드를 refetch한다. statFields/hue/resourcePicker 콜백이
// 렌더 시점의 record를 클로저로 캡처한 채 스프레드하면, rerender 없이 연속 편집할 때마다
// 직전 편집이 스테일 스냅샷 위에 덮여 사라진다(HP→MP→공격 순서 입력 시 마지막 필드만 저장).
function currentSpecies(id: string, fallback: MonsterSpeciesRecord): MonsterSpeciesRecord {
  return store.getCurrent().database.monsterSpecies?.find((record) => record.id === id) ?? fallback;
}

function statFields(record: MonsterSpeciesRecord): HTMLElement[] {
  const field = (label: string, key: keyof EnemyStats, testid: string): HTMLElement =>
    numberField(label, testid, record.baseStats[key], (value) => {
      const current = currentSpecies(record.id, record);
      updateSpecies(record.id, { baseStats: { ...current.baseStats, [key]: value } });
    });
  return [
    field("HP", "maxHp", "db-monster-species-hp"),
    field("MP", "maxMp", "db-monster-species-mp"),
    field("공격", "attack", "db-monster-species-atk"),
    field("방어", "defense", "db-monster-species-def"),
    field("정신", "mind", "db-monster-species-mind"),
    field("민첩", "agility", "db-monster-species-agi"),
  ];
}

function skillsByLevelField(record: MonsterSpeciesRecord): HTMLElement {
  const textarea = el("textarea", {
    value: (record.skillsByLevel ?? []).map((entry) => `${entry.level}:${entry.skillId}`).join("\n"),
    attrs: { rows: "4" },
    dataset: { testid: "db-monster-species-skills" },
  }) as HTMLTextAreaElement;
  textarea.addEventListener("change", () => updateSpecies(record.id, { skillsByLevel: parseSkillsByLevel(textarea.value) }));
  return el("label", { class: "db-field", children: [el("span", { text: "레벨별 스킬" }), textarea] });
}

function parseSkillsByLevel(value: string): ActorLearnedSkill[] {
  return value
    .split(/\r?\n/)
    .flatMap((line): ActorLearnedSkill[] => {
      const [levelText, skillId] = line.split(":").map((part) => part.trim());
      if (!skillId) return [];
      return [{ level: parseInt(levelText ?? "1", 10) || 1, skillId }];
    });
}

function evolutionsField(record: MonsterSpeciesRecord): HTMLElement {
  const textarea = el("textarea", {
    value: (record.evolutions ?? []).map(formatEvolution).join("\n"),
    attrs: { rows: "4" },
    dataset: { testid: "db-monster-species-evolutions" },
  }) as HTMLTextAreaElement;
  textarea.addEventListener("change", () => updateSpecies(record.id, { evolutions: parseEvolutions(textarea.value) }));
  return el("label", {
    class: "db-field",
    children: [
      el("span", { text: "진화" }),
      textarea,
      el("small", { text: "예: species_king_slime | level=7 | item=item_stone | friendship=220" }),
    ],
  });
}

function parseTypes(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))].slice(0, 2);
}

function formatEvolution(evolution: MonsterEvolutionRecord): string {
  const parts = [evolution.toSpeciesId];
  if (evolution.requires.level !== undefined) parts.push(`level=${evolution.requires.level}`);
  if (evolution.requires.itemId) parts.push(`item=${evolution.requires.itemId}`);
  if (evolution.requires.friendshipAtLeast !== undefined) parts.push(`friendship=${evolution.requires.friendshipAtLeast}`);
  return parts.join(" | ");
}

function parseEvolutions(value: string): MonsterEvolutionRecord[] {
  return value
    .split(/\r?\n/)
    .flatMap((line): MonsterEvolutionRecord[] => {
      const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
      const toSpeciesId = parts[0];
      if (!toSpeciesId) return [];
      const requires: MonsterEvolutionRecord["requires"] = {};
      for (const part of parts.slice(1)) {
        const [key, raw] = part.split("=").map((entry) => entry.trim());
        if (key === "level") {
          const level = parseInt(raw ?? "", 10);
          if (Number.isFinite(level) && level > 0) requires.level = level;
        }
        if ((key === "item" || key === "itemId") && raw) requires.itemId = raw;
        if (key === "friendship" || key === "friendshipAtLeast") {
          const friendship = parseInt(raw ?? "", 10);
          if (Number.isFinite(friendship) && friendship > 0) requires.friendshipAtLeast = friendship;
        }
      }
      return [{ toSpeciesId, requires }];
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
