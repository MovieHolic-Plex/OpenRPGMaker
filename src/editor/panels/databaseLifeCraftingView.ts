import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { commandsReferenceLocations } from "@/editor/databaseCommandReferences";
import type { CraftIngredient, CraftRecipe } from "@/project/craftRecipes";
import { store } from "@/project/store";
import type { ToolActionRule, ToolWorldAction } from "@/project/toolActions";
import type { FarmTool, LifeSkillRecord, LifeSkillType, Project } from "@/project/types";
import type { ItemUpgradeRule, SellPriceEntry } from "@/project/upgrades";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

type LifeSection = "skills" | "recipes" | "upgrades" | "sellPrices" | "toolActions";
type LifeRecord = LifeSkillRecord | CraftRecipe | ItemUpgradeRule | SellPriceEntry | ToolActionRule;

const SECTIONS: readonly { readonly id: LifeSection; readonly label: string; readonly testid: string }[] = [
  { id: "skills", label: "생활 기술", testid: "db-life-section-skills" },
  { id: "recipes", label: "제작법", testid: "db-life-section-recipes" },
  { id: "upgrades", label: "도구 강화", testid: "db-life-section-upgrades" },
  { id: "sellPrices", label: "판매 가격", testid: "db-life-section-sell-prices" },
  { id: "toolActions", label: "도구 행동", testid: "db-life-section-tool-actions" },
];

let activeSection: LifeSection = "skills";
const selectedIndex: Record<LifeSection, number> = {
  skills: 0,
  recipes: 0,
  upgrades: 0,
  sellPrices: 0,
  toolActions: 0,
};

export function renderLifeCraftingTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const records = recordsFor(project, activeSection);
  selectedIndex[activeSection] = clampIndex(selectedIndex[activeSection], records.length);
  const selected = records[selectedIndex[activeSection]];

  host.append(
    el("section", {
      class: "db-life-crafting-header",
      dataset: { testid: "db-life-crafting-header" },
      children: [
        el("div", {
          children: [
            el("span", { class: "db-life-panel-eyebrow", text: "생활 데이터" }),
            el("h2", { text: "생활 기술·제작" }),
            el("p", { text: "기술 성장, 제작 재료, 도구 강화와 판매 규칙을 레코드로 연결합니다." }),
          ],
        }),
        el("div", {
          class: "db-life-section-tabs",
          attrs: { role: "tablist", "aria-label": "생활 데이터 종류" },
          children: SECTIONS.map((section) => el("button", {
            class: `db-life-section-tab${activeSection === section.id ? " active" : ""}`,
            text: `${section.label} ${recordsFor(project, section.id).length}`,
            attrs: { type: "button", role: "tab", "aria-selected": String(activeSection === section.id) },
            dataset: { testid: section.testid, section: section.id },
            on: {
              click: () => {
                activeSection = section.id;
                rerender();
              },
            },
          })),
        }),
      ],
    }),
    el("div", {
      class: "db-record-workspace db-life-crafting-workspace",
      dataset: { testid: "db-life-workspace", section: activeSection },
      children: [
        renderListPane(records, rerender),
        el("div", {
          class: "db-detail-pane db-life-detail-pane",
          children: [selected ? renderDetail(activeSection, selected, selectedIndex[activeSection], rerender) : emptyState(rerender)],
        }),
      ],
    }),
  );
}

function renderListPane(records: readonly LifeRecord[], rerender: () => void): HTMLElement {
  const section = SECTIONS.find((entry) => entry.id === activeSection)!;
  return el("div", {
    class: "db-list-pane db-life-list-pane",
    children: [
      el("div", {
        class: "db-life-list-heading",
        children: [el("h3", { text: section.label }), el("span", { text: `${records.length}개` })],
      }),
      el("div", {
        class: "db-list db-life-record-list",
        children: records.map((record, index) => el("button", {
          class: `db-list-row${selectedIndex[activeSection] === index ? " active" : ""}`,
          text: labelFor(activeSection, record, index),
          attrs: { type: "button" },
          dataset: { testid: `db-life-row-${recordKey(activeSection, record, index)}`, recordIndex: String(index) },
          on: { click: () => { selectedIndex[activeSection] = index; rerender(); } },
        })),
      }),
      el("div", {
        class: "db-life-list-actions",
        children: [
          actionButton("+ 추가", "db-life-add", () => addRecord(activeSection, rerender)),
          actionButton("복제", "db-life-duplicate", () => duplicateRecord(activeSection, rerender), records.length === 0),
          actionButton("삭제", "db-life-delete", () => deleteRecord(activeSection, rerender), records.length === 0, "danger"),
        ],
      }),
    ],
  });
}

function renderDetail(section: LifeSection, record: LifeRecord, index: number, rerender: () => void): HTMLElement {
  switch (section) {
    case "skills": return skillForm(record as LifeSkillRecord, index, rerender);
    case "recipes": return recipeForm(record as CraftRecipe, index, rerender);
    case "upgrades": return upgradeForm(record as ItemUpgradeRule, index, rerender);
    case "sellPrices": return sellPriceForm(record as SellPriceEntry, index);
    case "toolActions": return toolActionForm(record as ToolActionRule, index);
  }
}

function skillForm(record: LifeSkillRecord, index: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const enabled = project.system.skillSystem?.enabled === true;
  return detailShell("생활 기술", [
    checkboxControl("레벨업 시스템 사용", "db-life-skill-enabled", enabled, (checked) => {
      updateProject("skills:enabled", (draft) => { draft.system.skillSystem = { enabled: checked }; });
    }),
    textControl("ID", "db-life-skill-id", record.id, (value) => updateUniqueId("skills", index, value, record.id)),
    textControl("이름", "db-life-skill-name", record.name, (value) => updateSkill(index, { name: value })),
    selectControl("종류", "db-life-skill-type", record.skillType, [
      ["farming", "농사"], ["mining", "채광"], ["foraging", "채집"], ["fishing", "낚시"], ["combat", "전투"],
    ], (value) => updateSkill(index, { skillType: value as LifeSkillType })),
    numberControl("최대 레벨", "db-life-skill-max-level", record.maxLevel, (value) => updateSkill(index, { maxLevel: positiveInteger(value) })),
    el("section", {
      class: "db-life-nested-section",
      children: [
        el("div", {
          class: "db-life-nested-heading",
          children: [
            el("h4", { text: "레벨 보상" }),
            actionButton("+ 보상", "db-life-skill-reward-add", () => {
              updateSkill(index, { levelUpRewards: [...record.levelUpRewards, { level: 1 }] }, false);
              rerender();
            }),
          ],
        }),
        ...(record.levelUpRewards.length === 0 ? [emptyHint("보상이 없습니다.")] : record.levelUpRewards.map((reward, rewardIndex) => el("div", {
          class: "db-life-nested-row",
          dataset: { testid: `db-life-skill-reward-row-${rewardIndex}` },
          children: [
            numberControl("레벨", `db-life-skill-reward-level-${rewardIndex}`, reward.level, (value) => updateReward(index, rewardIndex, { level: positiveInteger(value) })),
            selectControl("스위치", `db-life-skill-reward-switch-${rewardIndex}`, reward.switchId ?? "", idOptions(project.switches, "없음"), (value) => updateReward(index, rewardIndex, { switchId: value || undefined })),
            selectControl("제작법", `db-life-skill-reward-recipe-${rewardIndex}`, reward.recipeId ?? "", idOptions(project.system.craftRecipes ?? [], "없음"), (value) => updateReward(index, rewardIndex, { recipeId: value || undefined })),
            actionButton("제거", `db-life-skill-reward-delete-${rewardIndex}`, () => {
              updateSkill(index, { levelUpRewards: record.levelUpRewards.filter((_entry, i) => i !== rewardIndex) }, false);
              rerender();
            }, false, "danger"),
          ],
        }))),
      ],
    }),
  ]);
}

function recipeForm(record: CraftRecipe, index: number, rerender: () => void): HTMLElement {
  const items = store.getCurrent().database.items;
  return detailShell("제작법", [
    textControl("ID", "db-life-recipe-id", record.id, (value) => updateUniqueId("recipes", index, value, record.id)),
    textControl("이름", "db-life-recipe-name", record.name ?? "", (value) => updateRecipe(index, { name: value.trim() || undefined })),
    selectControl("결과 아이템", "db-life-recipe-output-item", record.outputItemId, idOptions(items), (value) => updateRecipe(index, { outputItemId: value })),
    numberControl("결과 수량", "db-life-recipe-output-count", record.outputCount ?? 1, (value) => updateRecipe(index, { outputCount: positiveInteger(value) })),
    numberControl("골드 비용", "db-life-recipe-gold-cost", record.goldCost ?? 0, (value) => updateRecipe(index, { goldCost: nonNegativeInteger(value) || undefined })),
    ingredientEditor("재료", "db-life-recipe", record.ingredients, (ingredients, shouldRender = false) => {
      updateRecipe(index, { ingredients });
      if (shouldRender) rerender();
    }),
  ]);
}

function upgradeForm(record: ItemUpgradeRule, index: number, rerender: () => void): HTMLElement {
  const items = store.getCurrent().database.items;
  return detailShell("도구 강화", [
    textControl("ID", "db-life-upgrade-id", record.id, (value) => updateUniqueId("upgrades", index, value, record.id)),
    selectControl("강화 전", "db-life-upgrade-from-item", record.fromItemId, idOptions(items), (value) => updateUpgrade(index, { fromItemId: value })),
    selectControl("강화 후", "db-life-upgrade-to-item", record.toItemId, idOptions(items), (value) => updateUpgrade(index, { toItemId: value })),
    numberControl("골드 비용", "db-life-upgrade-gold-cost", record.goldCost ?? 0, (value) => updateUpgrade(index, { goldCost: nonNegativeInteger(value) || undefined })),
    ingredientEditor("강화 재료", "db-life-upgrade", record.ingredients ?? [], (ingredients, shouldRender = false) => {
      updateUpgrade(index, { ingredients: ingredients.length ? ingredients : undefined });
      if (shouldRender) rerender();
    }),
  ]);
}

function sellPriceForm(record: SellPriceEntry, index: number): HTMLElement {
  return detailShell("판매 가격", [
    selectControl("아이템", "db-life-sell-item", record.itemId, idOptions(store.getCurrent().database.items), (value) => updateSellPrice(index, { itemId: value })),
    numberControl("판매 가격", "db-life-sell-price", record.price, (value) => updateSellPrice(index, { price: nonNegativeInteger(value) })),
  ]);
}

function toolActionForm(record: ToolActionRule, index: number): HTMLElement {
  return detailShell("도구 행동", [
    textControl("ID", "db-life-tool-id", record.id, (value) => updateUniqueId("toolActions", index, value, record.id)),
    selectControl("아이템", "db-life-tool-item", record.itemId ?? "", idOptions(store.getCurrent().database.items, "아이템 조건 없음"), (value) => updateToolAction(index, { itemId: value || undefined })),
    selectControl("도구 종류", "db-life-tool-farm-tool", record.farmTool ?? "", [
      ["", "도구 종류 조건 없음"], ["hoe", "괭이"], ["wateringCan", "물뿌리개"], ["axe", "도끼"], ["pickaxe", "곡괭이"],
    ], (value) => updateToolAction(index, { farmTool: value ? value as FarmTool : undefined })),
    selectControl("행동", "db-life-tool-action", record.action, [
      ["till", "밭 갈기"], ["water", "물 주기"], ["chop", "베기"], ["mine", "채광"], ["fish", "낚시"], ["harvest", "수확"],
    ], (value) => updateToolAction(index, { action: value as ToolWorldAction })),
    checkboxControl("경작 가능 구역 필요", "db-life-tool-requires-farmable", record.requiresFarmable === true, (checked) => updateToolAction(index, { requiresFarmable: checked || undefined })),
    textControl("대상 오브젝트 종류", "db-life-tool-target-kind", record.targetPlaceableKind ?? "", (value) => updateToolAction(index, { targetPlaceableKind: value.trim() || undefined })),
  ]);
}

function ingredientEditor(
  title: string,
  prefix: string,
  ingredients: readonly CraftIngredient[],
  onChange: (ingredients: readonly CraftIngredient[], rerender?: boolean) => void,
): HTMLElement {
  const items = store.getCurrent().database.items;
  return el("section", {
    class: "db-life-nested-section",
    children: [
      el("div", {
        class: "db-life-nested-heading",
        children: [el("h4", { text: title }), actionButton("+ 재료", `${prefix}-ingredient-add`, () => onChange([...ingredients, { itemId: items[0]?.id ?? "", count: 1 }], true))],
      }),
      ...(ingredients.length === 0 ? [emptyHint("재료가 없습니다.")] : ingredients.map((ingredient, ingredientIndex) => el("div", {
        class: "db-life-nested-row",
        children: [
          selectControl("아이템", `${prefix}-ingredient-item-${ingredientIndex}`, ingredient.itemId, idOptions(items), (value) => onChange(replaceAt(ingredients, ingredientIndex, { ...ingredient, itemId: value }))),
          numberControl("수량", `${prefix}-ingredient-count-${ingredientIndex}`, ingredient.count, (value) => onChange(replaceAt(ingredients, ingredientIndex, { ...ingredient, count: positiveInteger(value) }))),
          actionButton("제거", `${prefix}-ingredient-delete-${ingredientIndex}`, () => onChange(ingredients.filter((_entry, index) => index !== ingredientIndex), true), false, "danger"),
        ],
      }))),
    ],
  });
}

function addRecord(section: LifeSection, rerender: () => void): void {
  const project = store.getCurrent();
  const usedSellItems = new Set((project.system.sellPrices ?? []).map((entry) => entry.itemId));
  const sellItemId = project.database.items.find((item) => !usedSellItems.has(item.id))?.id;
  if (section === "sellPrices" && !sellItemId) {
    toast("판매 가격을 추가할 미등록 아이템이 없습니다.");
    return;
  }
  const itemId = section === "sellPrices" ? sellItemId! : project.database.items[0]?.id ?? "";
  recordProjectSnapshot();
  store.update((draft) => {
    switch (section) {
      case "skills":
        draft.database.lifeSkills ??= [];
        selectedIndex.skills = draft.database.lifeSkills.length;
        draft.database.lifeSkills.push({ id: genId("life_skill"), name: "새 생활 기술", skillType: "farming", maxLevel: 10, levelUpRewards: [] });
        draft.system.skillSystem ??= { enabled: true };
        break;
      case "recipes":
        draft.system.craftRecipes ??= [];
        selectedIndex.recipes = draft.system.craftRecipes.length;
        draft.system.craftRecipes.push({ id: genId("recipe"), name: "새 제작법", ingredients: [], outputItemId: itemId, outputCount: 1 });
        break;
      case "upgrades":
        draft.system.itemUpgrades ??= [];
        selectedIndex.upgrades = draft.system.itemUpgrades.length;
        draft.system.itemUpgrades.push({ id: genId("upgrade"), fromItemId: itemId, toItemId: itemId, ingredients: [] });
        break;
      case "sellPrices":
        draft.system.sellPrices ??= [];
        selectedIndex.sellPrices = draft.system.sellPrices.length;
        draft.system.sellPrices.push({ itemId, price: 0 });
        break;
      case "toolActions":
        draft.system.toolActions ??= [];
        selectedIndex.toolActions = draft.system.toolActions.length;
        draft.system.toolActions.push({ id: genId("tool_action"), farmTool: "hoe", itemId, action: "till" });
        break;
    }
  }, { scope: "database", collection: section });
  rerender();
}

function duplicateRecord(section: LifeSection, rerender: () => void): void {
  const records = recordsFor(store.getCurrent(), section);
  const source = records[selectedIndex[section]];
  if (!source) return;
  recordProjectSnapshot();
  store.update((draft) => {
    const copy = structuredClone(source) as LifeRecord;
    if ("id" in copy) (copy as { id: string }).id = genId(section === "skills" ? "life_skill" : section === "recipes" ? "recipe" : section === "upgrades" ? "upgrade" : "tool_action");
    if ("name" in copy && typeof copy.name === "string") (copy as { name?: string }).name = `${copy.name} 복사본`;
    pushRecord(draft, section, copy);
    selectedIndex[section] = records.length;
  }, { scope: "database", collection: section });
  rerender();
}

function deleteRecord(section: LifeSection, rerender: () => void): void {
  const records = recordsFor(store.getCurrent(), section);
  const selected = records[selectedIndex[section]];
  if (!selected) return;
  const commandCollection = section === "skills" ? "lifeSkills" : section === "recipes" ? "craftRecipes" : section === "upgrades" ? "itemUpgrades" : undefined;
  if (commandCollection && "id" in selected) {
    const locations = commandsReferenceLocations(store.getCurrent(), commandCollection, selected.id);
    if (locations.length > 0) {
      toast(`이벤트 명령 ${locations.length}곳에서 이 ${SECTIONS.find((entry) => entry.id === section)?.label ?? "레코드"}을 사용 중입니다.`);
      return;
    }
  }
  if (section === "recipes") {
    const recipeId = (selected as CraftRecipe).id;
    const referrer = (store.getCurrent().database.lifeSkills ?? []).find((skill) =>
      skill.levelUpRewards.some((reward) => reward.recipeId === recipeId)
    );
    if (referrer) {
      toast(`생활 기술 '${referrer.name}'의 레벨 보상이 이 제작법을 사용 중입니다.`);
      return;
    }
  }
  recordProjectSnapshot();
  store.update((draft) => replaceRecords(draft, section, recordsFor(draft, section).filter((_entry, index) => index !== selectedIndex[section])), { scope: "database", collection: section });
  selectedIndex[section] = Math.max(0, selectedIndex[section] - 1);
  rerender();
}

function updateSkill(index: number, patch: Partial<LifeSkillRecord>, coalesce = true): void {
  updateRecord("skills", index, patch, coalesce);
}

function updateReward(index: number, rewardIndex: number, patch: Partial<LifeSkillRecord["levelUpRewards"][number]>): void {
  const record = recordsFor(store.getCurrent(), "skills")[index] as LifeSkillRecord | undefined;
  if (!record) return;
  updateSkill(index, { levelUpRewards: replaceAt(record.levelUpRewards, rewardIndex, { ...record.levelUpRewards[rewardIndex], ...patch }) });
}

function updateRecipe(index: number, patch: Partial<CraftRecipe>): void { updateRecord("recipes", index, patch); }
function updateUpgrade(index: number, patch: Partial<ItemUpgradeRule>): void { updateRecord("upgrades", index, patch); }
function updateSellPrice(index: number, patch: Partial<SellPriceEntry>): void {
  if (patch.itemId && (store.getCurrent().system.sellPrices ?? []).some((entry, entryIndex) => entryIndex !== index && entry.itemId === patch.itemId)) {
    toast("이 아이템의 판매 가격은 이미 등록되어 있습니다.");
    return;
  }
  updateRecord("sellPrices", index, patch);
}
function updateToolAction(index: number, patch: Partial<ToolActionRule>): void { updateRecord("toolActions", index, patch); }

function updateUniqueId(section: Exclude<LifeSection, "sellPrices">, index: number, rawValue: string, fallback: string): void {
  const id = rawValue.trim() || fallback;
  if (recordsFor(store.getCurrent(), section).some((record, recordIndex) => recordIndex !== index && "id" in record && record.id === id)) {
    toast(`이미 사용 중인 ID입니다: ${id}`);
    return;
  }
  updateRecord(section, index, { id } as Partial<LifeRecord>);
}

function updateRecord(section: LifeSection, index: number, patch: Partial<LifeRecord>, coalesce = true): void {
  const current = recordsFor(store.getCurrent(), section)[index];
  if (!current) return;
  if (coalesce) recordCoalescedSnapshot(`db-life:${section}:${index}`);
  else recordProjectSnapshot();
  store.update((draft) => {
    const records = [...recordsFor(draft, section)];
    records[index] = { ...records[index], ...patch } as LifeRecord;
    replaceRecords(draft, section, records);
  }, { scope: "database", collection: section });
}

function updateProject(key: string, mutator: (draft: Project) => void): void {
  recordCoalescedSnapshot(`db-life:${key}`);
  store.update(mutator, { scope: "database", collection: "life" });
}

function recordsFor(project: Project, section: LifeSection): readonly LifeRecord[] {
  switch (section) {
    case "skills": return project.database.lifeSkills ?? [];
    case "recipes": return project.system.craftRecipes ?? [];
    case "upgrades": return project.system.itemUpgrades ?? [];
    case "sellPrices": return project.system.sellPrices ?? [];
    case "toolActions": return project.system.toolActions ?? [];
  }
}

function replaceRecords(project: Project, section: LifeSection, records: readonly LifeRecord[]): void {
  switch (section) {
    case "skills": project.database.lifeSkills = records as LifeSkillRecord[]; break;
    case "recipes": project.system.craftRecipes = records as CraftRecipe[]; break;
    case "upgrades": project.system.itemUpgrades = records as ItemUpgradeRule[]; break;
    case "sellPrices": project.system.sellPrices = records as SellPriceEntry[]; break;
    case "toolActions": project.system.toolActions = records as ToolActionRule[]; break;
  }
}

function pushRecord(project: Project, section: LifeSection, record: LifeRecord): void {
  replaceRecords(project, section, [...recordsFor(project, section), record]);
}

function detailShell(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("div", { class: "db-life-detail-form", children: [el("h3", { text: title }), ...children] });
}

function emptyState(rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-empty db-life-empty",
    dataset: { testid: "db-life-empty" },
    children: [el("strong", { text: "아직 레코드가 없습니다." }), actionButton("첫 레코드 만들기", "db-life-empty-add", () => addRecord(activeSection, rerender))],
  });
}

function textControl(label: string, testid: string, value: string, onChange: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value, dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("change", () => onChange(input.value));
  return field(label, input);
}

function numberControl(label: string, testid: string, value: number, onChange: (value: number) => void): HTMLElement {
  const input = el("input", { attrs: { type: "number", step: "1" }, value: String(value), dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("change", () => onChange(Number(input.value)));
  return field(label, input);
}

function checkboxControl(label: string, testid: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = value;
  input.addEventListener("change", () => onChange(input.checked));
  return field(label, input, "is-checkbox");
}

function selectControl(
  label: string,
  testid: string,
  value: string,
  options: readonly (readonly [string, string])[],
  onChange: (value: string) => void,
): HTMLElement {
  const select = el("select", {
    dataset: { testid },
    children: options.map(([optionValue, optionLabel]) => el("option", { value: optionValue, text: optionLabel })),
  }) as HTMLSelectElement;
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return field(label, select);
}

function field(label: string, control: HTMLElement, className = ""): HTMLElement {
  return el("label", { class: `db-field db-life-field ${className}`.trim(), children: [el("span", { text: label }), control] });
}

function actionButton(label: string, testid: string, onClick: () => void, disabled = false, variant = ""): HTMLElement {
  return el("button", {
    class: `btn small ${variant}`.trim(),
    text: label,
    attrs: { type: "button", ...(disabled ? { disabled: "" } : {}) },
    dataset: { testid },
    on: { click: onClick },
  });
}

function idOptions(records: readonly { readonly id: string; readonly name?: string }[], emptyLabel?: string): readonly (readonly [string, string])[] {
  return [
    ...(emptyLabel ? [["", emptyLabel] as const] : []),
    ...records.map((record) => [record.id, record.name ? `${record.name} (${record.id})` : record.id] as const),
  ];
}

function emptyHint(text: string): HTMLElement {
  return el("p", { class: "db-life-empty-hint", text });
}

function labelFor(section: LifeSection, record: LifeRecord, index: number): string {
  if (section === "skills") return (record as LifeSkillRecord).name || `(기술 ${index + 1})`;
  if (section === "recipes") return (record as CraftRecipe).name || (record as CraftRecipe).id;
  if (section === "upgrades") return `${(record as ItemUpgradeRule).fromItemId} → ${(record as ItemUpgradeRule).toItemId}`;
  if (section === "sellPrices") return `${(record as SellPriceEntry).itemId} · ${(record as SellPriceEntry).price}G`;
  return (record as ToolActionRule).id;
}

function recordKey(section: LifeSection, record: LifeRecord, index: number): string {
  return section === "sellPrices" ? String(index) : (record as { readonly id: string }).id;
}

function clampIndex(index: number, length: number): number {
  return length === 0 ? 0 : Math.min(Math.max(0, index), length - 1);
}

function positiveInteger(value: number): number { return Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)); }
function nonNegativeInteger(value: number): number { return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)); }

function replaceAt<T>(records: readonly T[], index: number, value: T): T[] {
  const next = [...records];
  next[index] = value;
  return next;
}
