import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { commandsReferenceLocations } from "@/editor/databaseCommandReferences";
import type { CraftIngredient, CraftRecipe } from "@/project/craftRecipes";
import { store } from "@/project/store";
import type { ToolActionRule, ToolWorldAction } from "@/project/toolActions";
import type {
  BundleDefinition,
  BundleRewardDefinition,
  FarmTool,
  ItemAmount,
  LifeSkillRecord,
  LifeSkillType,
  MakerDefinition,
  Project,
  WorldUnlockDefinition,
} from "@/project/types";
import { TOOL_CAPABILITY_AXIS_MAX, type ItemUpgradeRule, type SellPriceEntry } from "@/project/upgrades";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

type RecordSection = "skills" | "recipes" | "upgrades" | "sellPrices" | "toolActions" | "worldUnlocks" | "bundles" | "makers";
type ConfigSection = "energy" | "shipping";
type LifeSection = RecordSection | ConfigSection;
type LifeRecord = LifeSkillRecord | CraftRecipe | ItemUpgradeRule | SellPriceEntry | ToolActionRule | WorldUnlockDefinition | BundleDefinition | MakerDefinition;

const SECTIONS: readonly { readonly id: LifeSection; readonly label: string; readonly testid: string }[] = [
  { id: "skills", label: "생활 기술", testid: "db-life-section-skills" },
  { id: "recipes", label: "제작법", testid: "db-life-section-recipes" },
  { id: "upgrades", label: "도구 강화", testid: "db-life-section-upgrades" },
  { id: "sellPrices", label: "판매 가격", testid: "db-life-section-sell-prices" },
  { id: "toolActions", label: "도구 행동", testid: "db-life-section-tool-actions" },
  { id: "energy", label: "에너지", testid: "db-life-section-energy" },
  { id: "shipping", label: "출하", testid: "db-life-section-shipping" },
  { id: "worldUnlocks", label: "지역 해금", testid: "db-life-section-world-unlocks" },
  { id: "bundles", label: "꾸러미", testid: "db-life-section-bundles" },
  { id: "makers", label: "가공 설비", testid: "db-life-section-makers" },
];

let activeSection: LifeSection = "skills";
const selectedIndex: Record<RecordSection, number> = {
  skills: 0,
  recipes: 0,
  upgrades: 0,
  sellPrices: 0,
  toolActions: 0,
  worldUnlocks: 0,
  bundles: 0,
  makers: 0,
};

export function renderLifeCraftingTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const recordSection = isRecordSection(activeSection) ? activeSection : undefined;
  const records = recordSection ? recordsFor(project, recordSection) : [];
  if (recordSection) selectedIndex[recordSection] = clampIndex(selectedIndex[recordSection], records.length);
  const selected = recordSection ? records[selectedIndex[recordSection]] : undefined;

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
            text: `${section.label} ${sectionCount(project, section.id)}`,
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
    recordSection
      ? el("div", {
          class: "db-record-workspace db-life-crafting-workspace",
          dataset: { testid: "db-life-workspace", section: activeSection },
          children: [
            renderListPane(recordSection, records, rerender),
            el("div", {
              class: "db-detail-pane db-life-detail-pane",
              children: [selected ? renderDetail(recordSection, selected, selectedIndex[recordSection], rerender) : emptyState(recordSection, rerender)],
            }),
          ],
        })
      : renderConfigSection(activeSection as ConfigSection, rerender),
  );
}

function renderListPane(activeRecordSection: RecordSection, records: readonly LifeRecord[], rerender: () => void): HTMLElement {
  const section = SECTIONS.find((entry) => entry.id === activeRecordSection)!;
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
          class: `db-list-row${selectedIndex[activeRecordSection] === index ? " active" : ""}`,
          text: labelFor(activeRecordSection, record, index),
          attrs: { type: "button" },
          dataset: { testid: `db-life-row-${recordKey(activeRecordSection, record, index)}`, recordIndex: String(index) },
          on: { click: () => { selectedIndex[activeRecordSection] = index; rerender(); } },
        })),
      }),
      el("div", {
        class: "db-life-list-actions",
        children: [
          actionButton("+ 추가", "db-life-add", () => addRecord(activeRecordSection, rerender)),
          actionButton("복제", "db-life-duplicate", () => duplicateRecord(activeRecordSection, rerender), records.length === 0),
          actionButton("삭제", "db-life-delete", () => deleteRecord(activeRecordSection, rerender), records.length === 0, "danger"),
        ],
      }),
    ],
  });
}

function renderDetail(section: RecordSection, record: LifeRecord, index: number, rerender: () => void): HTMLElement {
  switch (section) {
    case "skills": return skillForm(record as LifeSkillRecord, index, rerender);
    case "recipes": return recipeForm(record as CraftRecipe, index, rerender);
    case "upgrades": return upgradeForm(record as ItemUpgradeRule, index, rerender);
    case "sellPrices": return sellPriceForm(record as SellPriceEntry, index);
    case "toolActions": return toolActionForm(record as ToolActionRule, index);
    case "worldUnlocks": return worldUnlockForm(record as WorldUnlockDefinition, index);
    case "bundles": return bundleForm(record as BundleDefinition, index, rerender);
    case "makers": return makerForm(record as MakerDefinition, index, rerender);
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
    checkboxControl("해금 후 제작 가능", "db-life-recipe-requires-unlock", record.requiresUnlock === true, (checked) => updateRecipe(index, { requiresUnlock: checked || undefined })),
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
    checkboxControl("강화 도구 능력 설정", "db-life-upgrade-capability-enabled", record.capability !== undefined, (checked) => {
      updateUpgrade(index, { capability: checked ? record.capability ?? { areaWidth: 1, areaHeight: 1, energyMultiplier: 1 } : undefined }, false);
      rerender();
    }),
    ...(record.capability ? [
      numberControl("효과 가로 칸", "db-life-upgrade-area-width", record.capability.areaWidth, (value) => updateUpgradeCapability(index, { areaWidth: boundedInteger(value, 1, TOOL_CAPABILITY_AXIS_MAX) })),
      numberControl("효과 세로 칸", "db-life-upgrade-area-height", record.capability.areaHeight, (value) => updateUpgradeCapability(index, { areaHeight: boundedInteger(value, 1, TOOL_CAPABILITY_AXIS_MAX) })),
      decimalControl("에너지 배율", "db-life-upgrade-energy-multiplier", record.capability.energyMultiplier, (value) => updateUpgradeCapability(index, { energyMultiplier: positiveNumber(value) })),
    ] : []),
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

function renderConfigSection(section: ConfigSection, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const value = section === "energy" ? project.system.energy : project.system.shipping;
  if (!value) {
    return el("div", {
      class: "db-detail-pane db-life-package-pane",
      dataset: { testid: "db-life-package-empty", section },
      children: [
        el("div", {
          class: "db-empty db-life-empty",
          children: [
            el("strong", { text: section === "energy" ? "에너지 규칙이 꺼져 있습니다." : "출하 규칙이 아직 없습니다." }),
            el("p", { text: "설정을 만들면 모든 값이 프로젝트에 저장됩니다." }),
            actionButton("설정 만들기", "db-life-package-create", () => createConfigPackage(section, rerender)),
          ],
        }),
      ],
    });
  }
  return el("div", {
    class: "db-detail-pane db-life-package-pane",
    dataset: { testid: "db-life-package-pane", section },
    children: [section === "energy" ? energyForm(rerender) : shippingForm(rerender)],
  });
}

function energyForm(rerender: () => void): HTMLElement {
  const energy = store.getCurrent().system.energy!;
  return detailShell("에너지", [
    el("p", { class: "db-life-help", text: "작업에 쓰는 최대 에너지와 하루 시작·회복량을 정합니다." }),
    numberControl("최대 에너지", "db-life-energy-max", energy.max, (value) => updateEnergy({ max: positiveInteger(value) })),
    numberControl("시작 에너지", "db-life-energy-initial", energy.initial ?? energy.max, (value) => updateEnergy({ initial: boundedInteger(value, 0, store.getCurrent().system.energy?.max ?? energy.max) })),
    numberControl("하루 회복량", "db-life-energy-restore", energy.restorePerDay ?? energy.max, (value) => updateEnergy({ restorePerDay: boundedInteger(value, 0, store.getCurrent().system.energy?.max ?? energy.max) })),
    explicitRemoveAction("에너지 설정 영구 제거", "에너지 규칙과 입력값을 프로젝트에서 제거합니다.", () => removeConfigPackage("energy", rerender)),
  ]);
}

function shippingForm(rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const shipping = project.system.shipping!;
  const selected = shipping.allowedItemIds;
  return detailShell("출하", [
    el("p", { class: "db-life-help", text: "하루가 끝날 때 출하 상자를 정산하고 기록을 보관합니다." }),
    checkboxControl("출하 사용", "db-life-shipping-enabled", shipping.enabled, (checked) => updateShipping({ enabled: checked })),
    numberControl("기록 보관 일수", "db-life-shipping-history-limit", shipping.historyLimit ?? 30, (value) => updateShipping({ historyLimit: boundedInteger(value, 1, 365) })),
    el("section", {
      class: "db-life-nested-section",
      children: [
        el("div", { class: "db-life-nested-heading", children: [el("h4", { text: "출하 허용 아이템" }), el("span", { text: selected === undefined ? "판매 가능한 모든 아이템" : `${selected.length}개 선택` })] }),
        checkboxControl("판매 가능한 모든 아이템", "db-life-shipping-all-items", selected === undefined, (checked) => {
          updateShipping({ allowedItemIds: checked ? undefined : [] }, false);
          rerender();
        }),
        ...project.database.items.map((item) => checkboxControl(item.name || item.id, `db-life-shipping-item-${item.id}`, selected?.includes(item.id) ?? selected === undefined, (checked) => {
          const current = store.getCurrent().system.shipping?.allowedItemIds;
          const ids = new Set(current ?? []);
          if (checked) ids.add(item.id);
          else ids.delete(item.id);
          updateShipping({ allowedItemIds: [...ids] });
        })),
      ],
    }),
    explicitRemoveAction("출하 설정 영구 제거", "사용 중지만 하려면 위의 '출하 사용'을 끄세요. 이 버튼은 입력값도 제거합니다.", () => removeConfigPackage("shipping", rerender)),
  ]);
}

function worldUnlockForm(record: WorldUnlockDefinition, index: number): HTMLElement {
  return detailShell("지역 해금", [
    textControl("ID", "db-life-world-unlock-id", record.id, (value) => updateUniqueId("worldUnlocks", index, value, record.id)),
    textControl("이름", "db-life-world-unlock-name", record.name ?? "", (value) => updateWorldUnlock(index, { name: value.trim() || undefined })),
    selectControl("연결 스위치", "db-life-world-unlock-switch", record.switchId ?? "", idOptions(store.getCurrent().switches, "연결하지 않음"), (value) => updateWorldUnlock(index, { switchId: value || undefined })),
  ]);
}

function bundleForm(record: BundleDefinition, index: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const reward = record.reward;
  return detailShell("꾸러미", [
    textControl("ID", "db-life-bundle-id", record.id, (value) => updateUniqueId("bundles", index, value, record.id)),
    textControl("이름", "db-life-bundle-name", record.name ?? "", (value) => updateBundle(index, { name: value.trim() || undefined })),
    amountEditor("필요 아이템", "db-life-bundle-requirement", record.requirements, (requirements, shouldRender = false) => {
      updateBundle(index, { requirements: [...requirements] });
      if (shouldRender) rerender();
    }),
    el("section", {
      class: "db-life-nested-section db-life-reward-section",
      children: [
        el("div", {
          class: "db-life-nested-heading",
          children: [
            el("h4", { text: "완료 보상" }),
            ...(reward ? [actionButton("보상 비우기", "db-life-bundle-reward-remove", () => {
              updateBundle(index, { reward: undefined }, false);
              rerender();
            }, false, "danger")] : []),
          ],
        }),
        numberControl("골드", "db-life-bundle-reward-gold", reward?.gold ?? 0, (value) => updateBundleReward(index, { gold: nonNegativeInteger(value) || undefined })),
        amountEditor("보상 아이템", "db-life-bundle-reward-item", reward?.itemRewards ?? [], (itemRewards, shouldRender = false) => {
          updateBundleReward(index, { itemRewards: itemRewards.length ? [...itemRewards] : undefined });
          if (shouldRender) rerender();
        }),
        selectControl("켜질 스위치", "db-life-bundle-reward-switch", reward?.switchId ?? "", idOptions(project.switches, "없음"), (value) => updateBundleReward(index, { switchId: value || undefined })),
        checkboxList("지역 해금", "db-life-bundle-unlock", project.system.worldUnlocks ?? [], reward?.worldUnlockIds ?? [], (worldUnlockIds) => updateBundleReward(index, { worldUnlockIds: worldUnlockIds.length ? worldUnlockIds : undefined })),
        checkboxList("제작법 해금", "db-life-bundle-recipe", project.system.craftRecipes ?? [], reward?.recipeIds ?? [], (recipeIds) => updateBundleReward(index, { recipeIds: recipeIds.length ? recipeIds : undefined })),
      ],
    }),
  ]);
}

function makerForm(record: MakerDefinition, index: number, rerender: () => void): HTMLElement {
  return detailShell("가공 설비", [
    textControl("ID", "db-life-maker-id", record.id, (value) => updateUniqueId("makers", index, value, record.id)),
    textControl("이름", "db-life-maker-name", record.name ?? "", (value) => updateMaker(index, { name: value.trim() || undefined })),
    numberControl("가공 시간(분)", "db-life-maker-duration", record.durationMinutes, (value) => updateMaker(index, { durationMinutes: positiveInteger(value) })),
    amountEditor("투입 아이템", "db-life-maker-input", record.inputs, (inputs, shouldRender = false) => {
      updateMaker(index, { inputs: [...inputs] });
      if (shouldRender) rerender();
    }),
    amountEditor("생산 아이템", "db-life-maker-output", record.outputs, (outputs, shouldRender = false) => {
      updateMaker(index, { outputs: [...outputs] });
      if (shouldRender) rerender();
    }),
  ]);
}

function ingredientEditor(
  title: string,
  prefix: string,
  ingredients: readonly CraftIngredient[],
  onChange: (ingredients: readonly CraftIngredient[], rerender?: boolean) => void,
): HTMLElement {
  return amountEditor(title, `${prefix}-ingredient`, ingredients, onChange);
}

function amountEditor(
  title: string,
  prefix: string,
  amounts: readonly ItemAmount[],
  onChange: (amounts: readonly ItemAmount[], rerender?: boolean) => void,
): HTMLElement {
  const items = store.getCurrent().database.items;
  return el("section", {
    class: "db-life-nested-section",
    children: [
      el("div", {
        class: "db-life-nested-heading",
        children: [el("h4", { text: title }), actionButton("+ 아이템", `${prefix}-add`, () => {
          const unused = items.find((item) => !amounts.some((amount) => amount.itemId === item.id))?.id;
          if (!unused) {
            toast("추가할 수 있는 미등록 아이템이 없습니다.");
            return;
          }
          onChange([...amounts, { itemId: unused, count: 1 }], true);
        })],
      }),
      ...(amounts.length === 0 ? [emptyHint("아이템이 없습니다.")] : amounts.map((amount, amountIndex) => el("div", {
        class: "db-life-nested-row",
        children: [
          selectControl("아이템", `${prefix}-item-${amountIndex}`, amount.itemId, idOptions(items), (value) => {
            if (amounts.some((entry, index) => index !== amountIndex && entry.itemId === value)) {
              toast("같은 아이템은 한 번만 등록할 수 있습니다.");
              return;
            }
            onChange(replaceAt(amounts, amountIndex, { ...amount, itemId: value }));
          }),
          numberControl("수량", `${prefix}-count-${amountIndex}`, amount.count, (value) => onChange(replaceAt(amounts, amountIndex, { ...amount, count: positiveInteger(value) }))),
          actionButton("제거", `${prefix}-delete-${amountIndex}`, () => onChange(amounts.filter((_entry, index) => index !== amountIndex), true), false, "danger"),
        ],
      }))),
    ],
  });
}

function checkboxList(
  title: string,
  prefix: string,
  records: readonly { readonly id: string; readonly name?: string }[],
  selectedIds: readonly string[],
  onChange: (ids: string[]) => void,
): HTMLElement {
  const selected = new Set(selectedIds);
  return el("fieldset", {
    class: "db-life-checkbox-list",
    children: [
      el("legend", { text: title }),
      ...(records.length === 0 ? [emptyHint("선택할 레코드가 없습니다.")] : records.map((record) => checkboxControl(record.name || record.id, `${prefix}-${record.id}`, selectedIds.includes(record.id), (checked) => {
        if (checked) selected.add(record.id);
        else selected.delete(record.id);
        onChange([...selected]);
      }))),
    ],
  });
}

function addRecord(section: RecordSection, rerender: () => void): void {
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
      case "worldUnlocks":
        draft.system.worldUnlocks ??= [];
        selectedIndex.worldUnlocks = draft.system.worldUnlocks.length;
        draft.system.worldUnlocks.push({ id: genId("world_unlock"), name: "새 지역 해금" });
        break;
      case "bundles":
        draft.system.bundles ??= [];
        selectedIndex.bundles = draft.system.bundles.length;
        draft.system.bundles.push({ id: genId("bundle"), name: "새 꾸러미", requirements: [] });
        break;
      case "makers":
        draft.system.makers ??= [];
        selectedIndex.makers = draft.system.makers.length;
        draft.system.makers.push({ id: genId("maker"), name: "새 가공 설비", inputs: [], outputs: [], durationMinutes: 60 });
        break;
    }
  }, { scope: "database", collection: section });
  rerender();
}

function duplicateRecord(section: RecordSection, rerender: () => void): void {
  const records = recordsFor(store.getCurrent(), section);
  const source = records[selectedIndex[section]];
  if (!source) return;
  recordProjectSnapshot();
  store.update((draft) => {
    const copy = structuredClone(source) as LifeRecord;
    if ("id" in copy) (copy as { id: string }).id = genId(recordPrefix(section));
    if ("name" in copy && typeof copy.name === "string") (copy as { name?: string }).name = `${copy.name} 복사본`;
    pushRecord(draft, section, copy);
    selectedIndex[section] = records.length;
  }, { scope: "database", collection: section });
  rerender();
}

function deleteRecord(section: RecordSection, rerender: () => void): void {
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
    const bundle = (store.getCurrent().system.bundles ?? []).find((entry) => entry.reward?.recipeIds?.includes(recipeId));
    if (bundle) {
      toast(`꾸러미 '${bundle.name ?? bundle.id}'의 보상이 이 제작법을 사용 중입니다.`);
      return;
    }
  }
  if (section === "worldUnlocks") {
    const unlockId = (selected as WorldUnlockDefinition).id;
    const bundle = (store.getCurrent().system.bundles ?? []).find((entry) => entry.reward?.worldUnlockIds?.includes(unlockId));
    if (bundle) {
      toast(`꾸러미 '${bundle.name ?? bundle.id}'의 보상이 이 지역 해금을 사용 중입니다.`);
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
function updateUpgrade(index: number, patch: Partial<ItemUpgradeRule>, coalesce = true): void { updateRecord("upgrades", index, patch, coalesce); }
function updateUpgradeCapability(index: number, patch: Partial<NonNullable<ItemUpgradeRule["capability"]>>): void {
  const record = recordsFor(store.getCurrent(), "upgrades")[index] as ItemUpgradeRule | undefined;
  if (!record?.capability) return;
  updateUpgrade(index, { capability: { ...record.capability, ...patch } });
}
function updateSellPrice(index: number, patch: Partial<SellPriceEntry>): void {
  if (patch.itemId && (store.getCurrent().system.sellPrices ?? []).some((entry, entryIndex) => entryIndex !== index && entry.itemId === patch.itemId)) {
    toast("이 아이템의 판매 가격은 이미 등록되어 있습니다.");
    return;
  }
  updateRecord("sellPrices", index, patch);
}
function updateToolAction(index: number, patch: Partial<ToolActionRule>): void { updateRecord("toolActions", index, patch); }
function updateWorldUnlock(index: number, patch: Partial<WorldUnlockDefinition>): void { updateRecord("worldUnlocks", index, patch); }
function updateBundle(index: number, patch: Partial<BundleDefinition>, coalesce = true): void { updateRecord("bundles", index, patch, coalesce); }
function updateBundleReward(index: number, patch: Partial<BundleRewardDefinition>): void {
  const record = recordsFor(store.getCurrent(), "bundles")[index] as BundleDefinition | undefined;
  if (!record) return;
  updateBundle(index, { reward: { ...(record.reward ?? {}), ...patch } });
}
function updateMaker(index: number, patch: Partial<MakerDefinition>): void { updateRecord("makers", index, patch); }

function updateUniqueId(section: Exclude<RecordSection, "sellPrices">, index: number, rawValue: string, fallback: string): void {
  const id = rawValue.trim() || fallback;
  if (recordsFor(store.getCurrent(), section).some((record, recordIndex) => recordIndex !== index && "id" in record && record.id === id)) {
    toast(`이미 사용 중인 ID입니다: ${id}`);
    return;
  }
  if (id !== fallback) {
    const referenceMessage = idRenameReferenceMessage(store.getCurrent(), section, fallback);
    if (referenceMessage) {
      toast(referenceMessage);
      return;
    }
  }
  updateRecord(section, index, { id } as Partial<LifeRecord>);
}

function idRenameReferenceMessage(project: Project, section: Exclude<RecordSection, "sellPrices">, id: string): string | undefined {
  const commandCollection = section === "skills" ? "lifeSkills" : section === "recipes" ? "craftRecipes" : section === "upgrades" ? "itemUpgrades" : undefined;
  if (commandCollection) {
    const locations = commandsReferenceLocations(project, commandCollection, id);
    if (locations.length > 0) return `이벤트 명령 ${locations.length}곳에서 이 ID를 사용 중입니다.`;
  }
  if (section === "recipes") {
    const skill = (project.database.lifeSkills ?? []).find((entry) => entry.levelUpRewards.some((reward) => reward.recipeId === id));
    if (skill) return `생활 기술 '${skill.name}'의 레벨 보상에서 이 ID를 사용 중입니다.`;
    const bundle = (project.system.bundles ?? []).find((entry) => entry.reward?.recipeIds?.includes(id));
    if (bundle) return `꾸러미 '${bundle.name ?? bundle.id}'의 보상에서 이 ID를 사용 중입니다.`;
  }
  if (section === "worldUnlocks") {
    const bundle = (project.system.bundles ?? []).find((entry) => entry.reward?.worldUnlockIds?.includes(id));
    if (bundle) return `꾸러미 '${bundle.name ?? bundle.id}'의 보상에서 이 ID를 사용 중입니다.`;
  }
  return undefined;
}

function updateRecord(section: RecordSection, index: number, patch: Partial<LifeRecord>, coalesce = true): void {
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

function recordsFor(project: Project, section: RecordSection): readonly LifeRecord[] {
  switch (section) {
    case "skills": return project.database.lifeSkills ?? [];
    case "recipes": return project.system.craftRecipes ?? [];
    case "upgrades": return project.system.itemUpgrades ?? [];
    case "sellPrices": return project.system.sellPrices ?? [];
    case "toolActions": return project.system.toolActions ?? [];
    case "worldUnlocks": return project.system.worldUnlocks ?? [];
    case "bundles": return project.system.bundles ?? [];
    case "makers": return project.system.makers ?? [];
  }
}

function createConfigPackage(section: ConfigSection, rerender: () => void): void {
  recordProjectSnapshot();
  store.update((draft) => {
    if (section === "energy") draft.system.energy = { max: 100, initial: 100, restorePerDay: 100 };
    else draft.system.shipping = { enabled: true, historyLimit: 30 };
  }, { scope: "database", collection: section });
  rerender();
}

function removeConfigPackage(section: ConfigSection, rerender: () => void): void {
  recordProjectSnapshot();
  store.update((draft) => {
    if (section === "energy") delete draft.system.energy;
    else delete draft.system.shipping;
  }, { scope: "database", collection: section });
  rerender();
}

function updateEnergy(patch: Partial<NonNullable<Project["system"]["energy"]>>, coalesce = true): void {
  const current = store.getCurrent().system.energy;
  if (!current) return;
  if (coalesce) recordCoalescedSnapshot("db-life:energy");
  else recordProjectSnapshot();
  store.update((draft) => {
    if (!draft.system.energy) return;
    const next = { ...draft.system.energy, ...patch };
    if (patch.max !== undefined) {
      if (next.initial !== undefined) next.initial = Math.min(next.initial, patch.max);
      if (next.restorePerDay !== undefined) next.restorePerDay = Math.min(next.restorePerDay, patch.max);
    }
    draft.system.energy = next;
  }, { scope: "database", collection: "energy" });
}

function updateShipping(patch: Partial<NonNullable<Project["system"]["shipping"]>>, coalesce = true): void {
  if (!store.getCurrent().system.shipping) return;
  if (coalesce) recordCoalescedSnapshot("db-life:shipping");
  else recordProjectSnapshot();
  store.update((draft) => {
    if (draft.system.shipping) draft.system.shipping = { ...draft.system.shipping, ...patch };
  }, { scope: "database", collection: "shipping" });
}

function sectionCount(project: Project, section: LifeSection): number {
  if (section === "energy") return project.system.energy ? 1 : 0;
  if (section === "shipping") return project.system.shipping ? 1 : 0;
  return recordsFor(project, section).length;
}

function isRecordSection(section: LifeSection): section is RecordSection {
  return section !== "energy" && section !== "shipping";
}

function recordPrefix(section: RecordSection): string {
  switch (section) {
    case "skills": return "life_skill";
    case "recipes": return "recipe";
    case "upgrades": return "upgrade";
    case "toolActions": return "tool_action";
    case "worldUnlocks": return "world_unlock";
    case "bundles": return "bundle";
    case "makers": return "maker";
    case "sellPrices": return "sell_price";
  }
}

function replaceRecords(project: Project, section: RecordSection, records: readonly LifeRecord[]): void {
  switch (section) {
    case "skills": project.database.lifeSkills = records as LifeSkillRecord[]; break;
    case "recipes": project.system.craftRecipes = records as CraftRecipe[]; break;
    case "upgrades": project.system.itemUpgrades = records as ItemUpgradeRule[]; break;
    case "sellPrices": project.system.sellPrices = records as SellPriceEntry[]; break;
    case "toolActions": project.system.toolActions = records as ToolActionRule[]; break;
    case "worldUnlocks": project.system.worldUnlocks = records as WorldUnlockDefinition[]; break;
    case "bundles": project.system.bundles = records as BundleDefinition[]; break;
    case "makers": project.system.makers = records as MakerDefinition[]; break;
  }
}

function pushRecord(project: Project, section: RecordSection, record: LifeRecord): void {
  replaceRecords(project, section, [...recordsFor(project, section), record]);
}

function detailShell(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("div", { class: "db-life-detail-form", children: [el("h3", { text: title }), ...children] });
}

function emptyState(section: RecordSection, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-empty db-life-empty",
    dataset: { testid: "db-life-empty" },
    children: [el("strong", { text: "아직 레코드가 없습니다." }), actionButton("첫 레코드 만들기", "db-life-empty-add", () => addRecord(section, rerender))],
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

function decimalControl(label: string, testid: string, value: number, onChange: (value: number) => void): HTMLElement {
  const input = el("input", { attrs: { type: "number", step: "0.01", min: "0.01" }, value: String(value), dataset: { testid } }) as HTMLInputElement;
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

function explicitRemoveAction(label: string, description: string, onRemove: () => void): HTMLElement {
  return el("section", {
    class: "db-life-explicit-remove",
    children: [el("p", { text: description }), actionButton(label, "db-life-package-remove", onRemove, false, "danger")],
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

function labelFor(section: RecordSection, record: LifeRecord, index: number): string {
  if (section === "skills") return (record as LifeSkillRecord).name || `(기술 ${index + 1})`;
  if (section === "recipes") return (record as CraftRecipe).name || (record as CraftRecipe).id;
  if (section === "upgrades") return `${(record as ItemUpgradeRule).fromItemId} → ${(record as ItemUpgradeRule).toItemId}`;
  if (section === "sellPrices") return `${(record as SellPriceEntry).itemId} · ${(record as SellPriceEntry).price}G`;
  if (section === "worldUnlocks") return (record as WorldUnlockDefinition).name || (record as WorldUnlockDefinition).id;
  if (section === "bundles") return (record as BundleDefinition).name || (record as BundleDefinition).id;
  if (section === "makers") return (record as MakerDefinition).name || (record as MakerDefinition).id;
  return (record as ToolActionRule).id;
}

function recordKey(section: RecordSection, record: LifeRecord, index: number): string {
  return section === "sellPrices" ? String(index) : (record as { readonly id: string }).id;
}

function clampIndex(index: number, length: number): number {
  return length === 0 ? 0 : Math.min(Math.max(0, index), length - 1);
}

function positiveInteger(value: number): number { return Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)); }
function nonNegativeInteger(value: number): number { return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)); }
function positiveNumber(value: number): number { return Number.isFinite(value) && value > 0 ? value : 1; }
function boundedInteger(value: number, min: number, max: number): number {
  const finite = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, finite));
}

function replaceAt<T>(records: readonly T[], index: number, value: T): T[] {
  const next = [...records];
  next[index] = value;
  return next;
}
