import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { emptyToUndefined, numberField, textControl } from "@/editor/panels/databaseControls";
import { imageIconOf, recordIconElement } from "@/editor/panels/eventEditor/recordPicker";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { store } from "@/project/store";
import type { ActorLearnedSkill, EnemyStats, MonsterSpeciesRecord } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";

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
  detailPane.append(selected ? speciesForm(selected) : el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" }, text: "species가 없습니다." }));
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
  const remove = el("button", {
    class: "db-toolbar-button danger",
    text: "삭제",
    attrs: { type: "button" },
    dataset: { testid: "db-monster-species-delete" },
    on: {
      click: () => {
        const id = selectedSpeciesId;
        if (!id) return;
        recordProjectSnapshot();
        store.update((project) => {
          project.database.monsterSpecies = (project.database.monsterSpecies ?? []).filter((record) => record.id !== id);
        }, { scope: "database", collection: "monsterSpecies" });
        selectedSpeciesId = undefined;
        rerender();
      },
    },
  });
  return el("div", { class: "db-toolbar", children: [add, remove] });
}

function speciesForm(record: MonsterSpeciesRecord): HTMLElement {
  const form = el("section", { class: "db-detail-form rm2k3-detail-form", dataset: { testid: "db-detail-form" } });
  form.append(
    el("div", { class: "db-record-id", children: [el("span", { text: "ID" }), el("code", { text: record.id })] }),
    textControl("이름", record.name, (value) => updateSpecies(record.id, { name: value }), "db-monster-species-name"),
    textControl("몬스터 리소스", record.graphic.monsterResourceId ?? "", (value) => {
      updateSpecies(record.id, { graphic: { ...record.graphic, monsterResourceId: emptyToUndefined(value) } });
    }, "db-monster-species-resource"),
    numberField("그래픽 Hue", "db-monster-species-hue", record.graphic.graphicHue, (value) => {
      updateSpecies(record.id, { graphic: { ...record.graphic, graphicHue: value } });
    }),
    numberField("포획률(0~1)", "db-monster-species-capture-rate", record.captureRate, (value) => {
      updateSpecies(record.id, { captureRate: value });
    }),
    ...statFields(record),
    skillsByLevelField(record)
  );
  return form;
}

function statFields(record: MonsterSpeciesRecord): HTMLElement[] {
  const field = (label: string, key: keyof EnemyStats, testid: string): HTMLElement =>
    numberField(label, testid, record.baseStats[key], (value) => updateSpecies(record.id, { baseStats: { ...record.baseStats, [key]: value } }));
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
