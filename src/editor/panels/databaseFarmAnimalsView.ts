import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { FarmAnimalBuildingDefinition, FarmAnimalSpeciesRecord, FarmAnimalStartInstance } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

export function renderFarmAnimalsTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const species = project.database.farmAnimalSpecies ?? [];
  const buildings = project.system.farmAnimalBuildings ?? [];
  const animals = project.session.farmAnimals ?? [];
  host.append(el("section", {
    class: "db-life-authoring-workspace db-farm-animals-workspace",
    dataset: { testid: "db-farm-animals-workspace" },
    children: [
      el("header", {
        class: "db-life-panel-heading",
        children: [
          el("span", { class: "db-life-panel-eyebrow", text: "돌봄과 생산" }),
          el("div", { children: [
            el("h2", { text: "동물·축사" }),
            el("p", { text: "동물 종, 먹이와 생산물, 축사 수용량, 게임 시작 개체를 한 화면에서 연결합니다." }),
          ] }),
        ],
      }),
      el("div", {
        class: "db-life-toolbar",
        children: [
          el("button", {
            class: "btn",
            text: "닭·소와 기본 축사 만들기",
            attrs: { type: "button" },
            dataset: { testid: "db-farm-animals-seed-defaults" },
            on: { click: () => seedDefaults(rerender) },
          }),
          el("span", { text: `종 ${species.length} · 축사 ${buildings.length} · 시작 개체 ${animals.length}` }),
        ],
      }),
      el("div", {
        class: "db-life-card-grid db-farm-animal-grid",
        children: [speciesPanel(species, rerender), buildingPanel(buildings, rerender), animalPanel(animals, species, buildings, rerender)],
      }),
    ],
  }));
}

function speciesPanel(records: readonly FarmAnimalSpeciesRecord[], rerender: () => void): HTMLElement {
  return authoringPanel("동물 종", "먹이, 생산물, 생산 주기와 쓰다듬기 친밀도를 정합니다.", [
    ...records.map((record, index) => el("article", {
      class: "db-life-record-card",
      dataset: { testid: `db-farm-species-${record.id}` },
      children: [
        textField("이름", record.name, (value) => patchSpecies(index, { name: value }, rerender)),
        textField("ID", record.id, undefined),
        itemSelect("먹이", record.feedItemId, (value) => patchSpecies(index, { feedItemId: value }, rerender)),
        itemSelect("생산물", record.productItemId, (value) => patchSpecies(index, { productItemId: value }, rerender)),
        numberField("수량", record.productCount, 1, 9_999_999, (value) => patchSpecies(index, { productCount: value }, rerender)),
        numberField("생산 주기(일)", record.productEveryDays, 1, 3650, (value) => patchSpecies(index, { productEveryDays: value }, rerender)),
        numberField("쓰다듬기 친밀도", record.petFriendship, 0, 1000, (value) => patchSpecies(index, { petFriendship: value }, rerender)),
        deleteButton(`${record.name} 종 삭제`, () => removeSpecies(index, rerender)),
      ],
    })),
    addButton("동물 종 추가", "db-farm-animals-add-species", () => addSpecies(rerender)),
  ]);
}

function buildingPanel(records: readonly FarmAnimalBuildingDefinition[], rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  return authoringPanel("축사", "맵의 위치와 수용 가능한 동물 종을 정합니다.", [
    ...records.map((record, index) => el("article", {
      class: "db-life-record-card",
      dataset: { testid: `db-farm-building-${record.id}` },
      children: [
        textField("이름", record.name, (value) => patchBuilding(index, { name: value }, rerender)),
        selectField("맵", record.mapId, Object.values(project.maps).map((map) => ({ value: map.id, label: map.name })), (value) => patchBuilding(index, { mapId: value }, rerender)),
        numberField("X", record.x, 0, 9999, (value) => patchBuilding(index, { x: value }, rerender)),
        numberField("Y", record.y, 0, 9999, (value) => patchBuilding(index, { y: value }, rerender)),
        numberField("수용량", record.capacity, 1, 500, (value) => patchBuilding(index, { capacity: value }, rerender)),
        textField("허용 종 ID", record.allowedSpeciesIds.join(", "), (value) => patchBuilding(index, { allowedSpeciesIds: splitIds(value) }, rerender)),
        deleteButton(`${record.name} 축사 삭제`, () => removeBuilding(index, rerender)),
      ],
    })),
    addButton("축사 추가", "db-farm-animals-add-building", () => addBuilding(rerender)),
  ]);
}

function animalPanel(
  records: readonly FarmAnimalStartInstance[],
  species: readonly FarmAnimalSpeciesRecord[],
  buildings: readonly FarmAnimalBuildingDefinition[],
  rerender: () => void,
): HTMLElement {
  return authoringPanel("시작 개체", "새 게임을 시작할 때 생성될 동물과 이벤트 연결을 정합니다.", [
    ...records.map((record, index) => el("article", {
      class: "db-life-record-card",
      dataset: { testid: `db-farm-animal-${record.instanceId}` },
      children: [
        textField("이름", record.name, (value) => patchAnimal(index, { name: value }, rerender)),
        selectField("동물 종", record.speciesId, species.map((entry) => ({ value: entry.id, label: entry.name })), (value) => patchAnimal(index, { speciesId: value }, rerender)),
        selectField("축사", record.buildingId ?? "", [{ value: "", label: "배정 안 함" }, ...buildings.map((entry) => ({ value: entry.id, label: entry.name }))], (value) => patchAnimal(index, { buildingId: value || undefined }, rerender)),
        textField("표시 이벤트 ID", record.eventId ?? "", (value) => patchAnimal(index, { eventId: value || undefined }, rerender)),
        deleteButton(`${record.name} 개체 삭제`, () => removeAnimal(index, rerender)),
      ],
    })),
    addButton("시작 개체 추가", "db-farm-animals-add-instance", () => addAnimal(rerender)),
  ]);
}

function authoringPanel(title: string, description: string, children: HTMLElement[]): HTMLElement {
  return el("section", {
    class: "db-life-card db-farm-authoring-panel",
    children: [el("h3", { text: title }), el("p", { text: description }), ...children],
  });
}

function seedDefaults(rerender: () => void): void {
  const project = store.getCurrent();
  const feedId = project.database.items.find((item) => item.careProfile?.kind === "feed")?.id ?? project.database.items[0]?.id;
  const productIds = project.database.items.filter((item) => item.id !== feedId).map((item) => item.id);
  const eggId = project.database.items.find((item) => /egg|달걀/i.test(`${item.id} ${item.name}`))?.id ?? productIds[0] ?? feedId;
  const milkId = project.database.items.find((item) => /milk|우유/i.test(`${item.id} ${item.name}`))?.id ?? productIds[1] ?? eggId;
  if (!feedId || !eggId || !milkId) {
    toast("동물 기본값을 만들 아이템이 없습니다. 먼저 아이템을 추가하세요.", "error");
    return;
  }
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!map) {
    toast("축사를 배치할 맵이 없습니다.", "error");
    return;
  }
  recordProjectSnapshot("기본 농장 동물 만들기");
  store.update((draft) => {
    const coopId = uniqueId("building_coop", new Set((draft.system.farmAnimalBuildings ?? []).map((entry) => entry.id)));
    const chickenId = uniqueId("animal_chicken", new Set((draft.database.farmAnimalSpecies ?? []).map((entry) => entry.id)));
    const cowId = uniqueId("animal_cow", new Set([chickenId, ...(draft.database.farmAnimalSpecies ?? []).map((entry) => entry.id)]));
    draft.database.farmAnimalSpecies = [
      ...(draft.database.farmAnimalSpecies ?? []),
      { id: chickenId, name: "닭", feedItemId: feedId, productItemId: eggId, productCount: 1, productEveryDays: 1, petFriendship: 15 },
      { id: cowId, name: "소", feedItemId: feedId, productItemId: milkId, productCount: 1, productEveryDays: 2, petFriendship: 18 },
    ];
    draft.system.farmAnimalBuildings = [
      ...(draft.system.farmAnimalBuildings ?? []),
      { id: coopId, name: "햇살 축사", mapId: map.id, x: Math.min(3, Math.max(0, map.width - 1)), y: Math.min(3, Math.max(0, map.height - 1)), capacity: 8, allowedSpeciesIds: [chickenId, cowId] },
    ];
    draft.session.farmAnimals = [
      ...(draft.session.farmAnimals ?? []),
      { instanceId: uniqueId("farm_animal_bori", new Set((draft.session.farmAnimals ?? []).map((entry) => entry.instanceId))), speciesId: chickenId, name: "보리", buildingId: coopId },
      { instanceId: uniqueId("farm_animal_dubu", new Set(["farm_animal_bori", ...(draft.session.farmAnimals ?? []).map((entry) => entry.instanceId)])), speciesId: cowId, name: "두부", buildingId: coopId },
    ];
  });
  toast("닭·소와 기본 축사를 만들었습니다.", "ok");
  rerender();
}

function addSpecies(rerender: () => void): void {
  const project = store.getCurrent();
  const itemId = project.database.items[0]?.id;
  if (!itemId) return;
  recordProjectSnapshot("동물 종 추가");
  store.update((draft) => {
    draft.database.farmAnimalSpecies ??= [];
    draft.database.farmAnimalSpecies.push({ id: genId("animal_species"), name: "새 동물", feedItemId: itemId, productItemId: itemId, productCount: 1, productEveryDays: 1, petFriendship: 10 });
  });
  rerender();
}

function addBuilding(rerender: () => void): void {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!map) return;
  recordProjectSnapshot("축사 추가");
  store.update((draft) => {
    draft.system.farmAnimalBuildings ??= [];
    draft.system.farmAnimalBuildings.push({ id: genId("animal_building"), name: "새 축사", mapId: map.id, x: 0, y: 0, capacity: 4, allowedSpeciesIds: (draft.database.farmAnimalSpecies ?? []).map((entry) => entry.id) });
  });
  rerender();
}

function addAnimal(rerender: () => void): void {
  const project = store.getCurrent();
  const species = project.database.farmAnimalSpecies?.[0];
  if (!species) { toast("먼저 동물 종을 추가하세요.", "info"); return; }
  recordProjectSnapshot("시작 동물 추가");
  store.update((draft) => {
    draft.session.farmAnimals ??= [];
    draft.session.farmAnimals.push({ instanceId: genId("farm_animal"), speciesId: species.id, name: "새 동물", buildingId: draft.system.farmAnimalBuildings?.[0]?.id });
  });
  rerender();
}

function patchSpecies(index: number, patch: Partial<FarmAnimalSpeciesRecord>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-farm-species:${index}`);
  store.update((project) => { const row = project.database.farmAnimalSpecies?.[index]; if (row) project.database.farmAnimalSpecies![index] = { ...row, ...patch }; });
  rerender();
}
function patchBuilding(index: number, patch: Partial<FarmAnimalBuildingDefinition>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-farm-building:${index}`);
  store.update((project) => { const row = project.system.farmAnimalBuildings?.[index]; if (row) project.system.farmAnimalBuildings![index] = { ...row, ...patch }; });
  rerender();
}
function patchAnimal(index: number, patch: Partial<FarmAnimalStartInstance>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-farm-animal:${index}`);
  store.update((project) => { const row = project.session.farmAnimals?.[index]; if (row) project.session.farmAnimals![index] = { ...row, ...patch }; });
  rerender();
}
function removeSpecies(index: number, rerender: () => void): void { recordProjectSnapshot("동물 종 삭제"); store.update((project) => { project.database.farmAnimalSpecies?.splice(index, 1); }); rerender(); }
function removeBuilding(index: number, rerender: () => void): void { recordProjectSnapshot("축사 삭제"); store.update((project) => { project.system.farmAnimalBuildings?.splice(index, 1); }); rerender(); }
function removeAnimal(index: number, rerender: () => void): void { recordProjectSnapshot("시작 동물 삭제"); store.update((project) => { project.session.farmAnimals?.splice(index, 1); }); rerender(); }

function itemSelect(label: string, value: string, onChange: (value: string) => void): HTMLElement {
  return selectField(label, value, store.getCurrent().database.items.map((item) => ({ value: item.id, label: item.name })), onChange);
}
function textField(label: string, value: string, onChange: ((value: string) => void) | undefined): HTMLElement {
  return field(label, el("input", { attrs: { type: "text", value, ...(onChange ? {} : { readonly: "" }) }, on: onChange ? { change: (event) => onChange(valueOf(event)) } : undefined }));
}
function numberField(label: string, value: number, min: number, max: number, onChange: (value: number) => void): HTMLElement {
  return field(label, el("input", { attrs: { type: "number", value: String(value), min: String(min), max: String(max) }, on: { change: (event) => onChange(clampInt(valueOf(event), min, max)) } }));
}
function selectField(label: string, value: string, options: readonly { value: string; label: string }[], onChange: (value: string) => void): HTMLElement {
  return field(label, el("select", { on: { change: (event) => onChange(valueOf(event)) }, children: options.map((entry) => el("option", { text: entry.label, attrs: { value: entry.value, ...(entry.value === value ? { selected: "" } : {}) } })) }));
}
function field(label: string, control: HTMLElement): HTMLElement { return el("label", { class: "field", children: [el("span", { text: label }), control] }); }
function addButton(label: string, testid: string, onClick: () => void): HTMLElement { return el("button", { class: "btn small", text: label, attrs: { type: "button" }, dataset: { testid }, on: { click: onClick } }); }
function deleteButton(label: string, onClick: () => void): HTMLElement { return el("button", { class: "btn small danger", text: "삭제", attrs: { type: "button", "aria-label": label }, on: { click: onClick } }); }
function valueOf(event: Event): string { return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value.trim(); }
function clampInt(value: string, min: number, max: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : min; }
function splitIds(value: string): string[] { return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))]; }
function uniqueId(base: string, used: ReadonlySet<string>): string { let id = base; let suffix = 2; while (used.has(id)) id = `${base}_${suffix++}`; return id; }
