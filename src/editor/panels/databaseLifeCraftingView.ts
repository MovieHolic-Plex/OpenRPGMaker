import { craftRecipeReferenceMessage } from "@/editor/databaseCraftReferences";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { commandsReferenceLocations } from "@/editor/databaseCommandReferences";
import { field as wsField, matchesNameOrId } from "@/editor/panels/databaseControls";
import {
  detailHero,
  detailPane,
  emptyState as wsEmptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import type { CraftIngredient, CraftRecipe } from "@/project/craftRecipes";
import { store } from "@/project/store";
import { MAX_LIFE_SKILL_LEVEL } from "@/project/skillModel";
import { toolActionRulesOf, toolRuleRequiresFarmable, type ToolActionRule, type ToolWorldAction } from "@/project/toolActions";
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

// ---------------------------------------------------------------------------
// 섹션 사전
//
// 사이드바 탭 하나 안에 레코드 8종 + 설정 2종이 들어 있다. 이동은 워크스페이스
// 서브탭(`db-ws-section-tab`)만 쓴다 — 제목을 칩 줄에 섞거나, 빈 상세에 현황 보드를
// 다시 깔지 않는다.
// ---------------------------------------------------------------------------

type SectionMeta = {
  readonly id: LifeSection;
  readonly label: string;
  readonly testid: string;
  /** 탭 title 도움말 · 빈 상태 한 줄. */
  readonly blurb: string;
  readonly emptyBody: string;
  readonly searchPlaceholder: string;
  readonly related?: LifeSection;
};

const SECTIONS: readonly SectionMeta[] = [
  {
    id: "skills",
    label: "생활 기술",
    testid: "db-life-section-skills",
    blurb: "농사·채광·낚시 같은 활동의 숙련도와 레벨 보상",
    emptyBody: "생활 기술은 플레이어가 활동할 때 오르는 숙련도입니다. 레벨이 오를 때 스위치를 켜거나 제작법을 해금할 수 있습니다.",
    searchPlaceholder: "생활 기술 검색",
    related: "recipes",
  },
  {
    id: "recipes",
    label: "제작법",
    testid: "db-life-section-recipes",
    blurb: "재료와 골드를 결과 아이템으로 바꾸는 규칙",
    emptyBody: "제작법은 '재료 + 골드 → 결과 아이템' 한 줄짜리 규칙입니다. 이벤트 명령 '제작'이 이 목록을 그대로 씁니다.",
    searchPlaceholder: "제작법 검색",
    related: "skills",
  },
  {
    id: "upgrades",
    label: "도구 강화",
    testid: "db-life-section-upgrades",
    blurb: "도구를 상위 도구로 바꾸고 작업 범위를 넓힘",
    emptyBody: "도구 강화는 '강화 전 아이템 → 강화 후 아이템' 교체 규칙입니다. 강화된 도구가 한 번에 갈아엎는 칸 수와 에너지 배율도 여기서 정합니다.",
    searchPlaceholder: "도구 강화 검색",
    related: "energy",
  },
  {
    id: "sellPrices",
    label: "판매 가격",
    testid: "db-life-section-sell-prices",
    blurb: "아이템 한 개를 팔았을 때 받는 골드",
    emptyBody: "판매 가격은 아이템당 한 줄입니다. 출하 상자와 상점 판매가 이 값을 그대로 씁니다.",
    searchPlaceholder: "아이템 검색",
    related: "shipping",
  },
  {
    id: "toolActions",
    label: "도구 행동",
    testid: "db-life-section-tool-actions",
    blurb: "도구가 맵의 무엇에 어떤 작업을 하는지 연결",
    emptyBody: "도구 행동은 '이 도구를 들고 이 지형/오브젝트를 누르면 이 작업이 일어난다'는 규칙입니다. 밭 갈기·물 주기·채광·낚시가 전부 여기서 열립니다.",
    searchPlaceholder: "도구 행동 검색",
    related: "upgrades",
  },
  {
    id: "energy",
    label: "에너지",
    testid: "db-life-section-energy",
    blurb: "하루 동안 쓸 수 있는 작업량의 총량",
    emptyBody: "에너지는 도구 작업 한 번마다 줄어드는 하루치 체력입니다. 설정을 만들면 최대치·시작값·하루 회복량을 정할 수 있습니다.",
    searchPlaceholder: "",
    related: "toolActions",
  },
  {
    id: "shipping",
    label: "출하",
    testid: "db-life-section-shipping",
    blurb: "하루가 끝날 때 출하 상자를 정산하고 기록을 남김",
    emptyBody: "출하는 상자에 넣어 둔 물건을 자정에 판매 가격으로 정산하는 규칙입니다. 설정을 만들면 기록 보관 일수와 허용 아이템을 고를 수 있습니다.",
    searchPlaceholder: "",
    related: "sellPrices",
  },
  {
    id: "worldUnlocks",
    label: "지역 해금",
    testid: "db-life-section-world-unlocks",
    blurb: "다리 수리·광산 개방 같은 지역 개방 상태",
    emptyBody: "지역 해금은 '어디가 열렸는가'를 이름으로 관리하는 목록입니다. 꾸러미 보상이 이 항목을 열고, 연결된 스위치가 맵 이벤트를 움직입니다.",
    searchPlaceholder: "지역 해금 검색",
    related: "bundles",
  },
  {
    id: "bundles",
    label: "꾸러미",
    testid: "db-life-section-bundles",
    blurb: "아이템을 모아 바치면 보상과 해금을 주는 수집 과제",
    emptyBody: "꾸러미는 '요구 아이템을 모두 채우면 보상을 준다'는 수집 과제입니다. 골드·아이템·스위치·지역 해금·제작법을 한 번에 보상으로 줄 수 있습니다.",
    searchPlaceholder: "꾸러미 검색",
    related: "worldUnlocks",
  },
  {
    id: "makers",
    label: "가공 설비",
    testid: "db-life-section-makers",
    blurb: "시간을 들여 투입 아이템을 생산 아이템으로 바꾸는 설비",
    emptyBody: "가공 설비는 '넣고 기다리면 나오는' 장치입니다. 치즈 프레스·양조통처럼 투입 아이템과 가공 시간을 정하면 됩니다.",
    searchPlaceholder: "가공 설비 검색",
    related: "recipes",
  },
];

const SKILL_TYPE_LABELS: readonly (readonly [LifeSkillType, string])[] = [
  ["farming", "농사"], ["mining", "채광"], ["foraging", "채집"], ["fishing", "낚시"], ["combat", "전투"],
];

const TOOL_ACTION_LABELS: readonly (readonly [ToolWorldAction, string])[] = [
  ["till", "밭 갈기"], ["water", "물 주기"], ["chop", "베기"], ["mine", "채광"], ["fish", "낚시"], ["harvest", "수확"],
];

const FARM_TOOL_LABELS: readonly (readonly [string, string])[] = [
  ["", "도구 종류 조건 없음"], ["hoe", "괭이"], ["wateringCan", "물뿌리개"], ["axe", "도끼"], ["pickaxe", "곡괭이"],
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
const sectionSearch: Record<RecordSection, string> = {
  skills: "",
  recipes: "",
  upgrades: "",
  sellPrices: "",
  toolActions: "",
  worldUnlocks: "",
  bundles: "",
  makers: "",
};

export function renderLifeCraftingTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const header = sectionRailHeader(project, rerender);

  if (!isRecordSection(activeSection)) {
    const shell = workspaceShell({
      header,
      list: configListPane(activeSection),
      detail: configDetail(activeSection, rerender),
      testid: "db-life-workspace",
    });
    shell.dataset.section = activeSection;
    host.append(shell);
    return;
  }

  const recordSection = activeSection;
  const records = recordsFor(project, recordSection);
  selectedIndex[recordSection] = clampIndex(selectedIndex[recordSection], records.length);
  const selected = records[selectedIndex[recordSection]];

  const shell = workspaceShell({
    header,
    list: recordListPane(recordSection, records, rerender),
    detail: selected
      ? recordDetail(recordSection, selected, selectedIndex[recordSection], rerender)
      : sectionBriefing(recordSection, rerender),
    testid: "db-life-workspace",
  });
  shell.dataset.section = activeSection;
  host.append(shell);
}

// ---------------------------------------------------------------------------
// 섹션 서브탭
// ---------------------------------------------------------------------------

function sectionRailHeader(project: Project, rerender: () => void): HTMLElement {
  return el("nav", {
    class: "db-ws-section-tabs db-life-section-nav",
    attrs: { role: "tablist", "aria-label": "생활 데이터 종류" },
    dataset: { testid: "db-life-crafting-header" },
    children: SECTIONS.map((section) => {
      const count = sectionCount(project, section.id);
      const active = activeSection === section.id;
      return el("button", {
        class: `db-ws-section-tab${active ? " active" : ""}`,
        attrs: {
          type: "button",
          role: "tab",
          title: section.blurb,
          "aria-label": `${section.label} ${count}개`,
          "aria-selected": String(active),
        },
        dataset: { testid: section.testid, section: section.id },
        children: [
          el("span", { class: "db-ws-section-tab-label", text: section.label }),
          ...(count > 0 ? [el("span", { class: "db-ws-section-badge", text: String(count) })] : []),
        ],
        on: {
          click: () => {
            activeSection = section.id;
            rerender();
          },
        },
      });
    }),
  });
}

// ---------------------------------------------------------------------------
// 목록 창
// ---------------------------------------------------------------------------

function recordListPane(section: RecordSection, records: readonly LifeRecord[], rerender: () => void): HTMLElement {
  const meta = sectionMeta(section);
  const query = sectionSearch[section];

  const rows: HTMLElement[] = [];
  for (const [index, record] of records.entries()) {
    const name = labelFor(section, record, index);
    if (query && !matchesNameOrId(name, recordKey(section, record, index), query)) continue;
    rows.push(listRow({
      name,
      sub: rowSub(section, record),
      number: index + 1,
      active: selectedIndex[section] === index,
      title: recordKey(section, record, index),
      testid: `db-life-row-${recordKey(section, record, index)}`,
      dataset: { recordIndex: String(index) },
      onSelect: () => {
        selectedIndex[section] = index;
        rerender();
      },
    }));
  }

  return listPane({
    title: meta.label,
    count: records.length,
    search: listSearch({
      placeholder: meta.searchPlaceholder,
      value: query,
      testid: `db-life-search-${section}`,
      onInput: (value) => {
        sectionSearch[section] = value;
        rerender();
      },
    }),
    rows,
    empty: query.length > 0
      ? wsEmptyState({
        icon: "⌕",
        title: "검색 결과가 없습니다",
        body: `"${query}" 와 일치하는 ${meta.label} 레코드가 없습니다.`,
        compact: true,
        testid: "db-life-list-empty",
      })
      : wsEmptyState({
        icon: "○",
        title: `${meta.label} 레코드 없음`,
        body: "아래 '+ 추가'로 첫 레코드를 만드세요.",
        compact: true,
        testid: "db-life-list-empty",
      }),
    toolbar: listToolbar([
      { label: "+ 추가", testid: "db-life-add", onClick: () => addRecord(section, rerender) },
      { label: "복제", testid: "db-life-duplicate", disabled: records.length === 0, onClick: () => duplicateRecord(section, rerender) },
      { label: "삭제", kind: "danger", testid: "db-life-delete", disabled: records.length === 0, onClick: () => deleteRecord(section, rerender) },
    ]),
    testid: `db-life-list-pane-${section}`,
  });
}

/** 행의 핵심 수치 한 조각. 예전 목록은 이름 문자열 하나뿐이라 스캔이 불가능했다. */
function rowSub(section: RecordSection, record: LifeRecord): string | undefined {
  switch (section) {
    case "skills": {
      const skill = record as LifeSkillRecord;
      return `${skillTypeLabel(skill.skillType)} · Lv${skill.maxLevel}`;
    }
    case "recipes": {
      const recipe = record as CraftRecipe;
      return `재료 ${recipe.ingredients.length}종`;
    }
    case "upgrades": {
      const upgrade = record as ItemUpgradeRule;
      return upgrade.goldCost ? `${upgrade.goldCost}G` : `재료 ${(upgrade.ingredients ?? []).length}종`;
    }
    case "sellPrices":
      return `${(record as SellPriceEntry).price}G`;
    case "toolActions": {
      const rule = record as ToolActionRule;
      return farmToolLabel(rule.farmTool);
    }
    case "worldUnlocks":
      return (record as WorldUnlockDefinition).switchId ? "스위치 연결" : "스위치 없음";
    case "bundles":
      return `필요 ${(record as BundleDefinition).requirements.length}종`;
    case "makers":
      return `${(record as MakerDefinition).durationMinutes}분`;
  }
}

// ---------------------------------------------------------------------------
// 빈 섹션
// ---------------------------------------------------------------------------

function sectionBriefing(section: RecordSection, rerender: () => void): HTMLElement {
  const meta = sectionMeta(section);
  const related = meta.related ? sectionMeta(meta.related) : undefined;

  return detailPane({
    body: [
      wsEmptyState({
        icon: "＋",
        title: `${meta.label} 없음`,
        body: meta.emptyBody,
        action: {
          label: `첫 ${meta.label} 만들기`,
          kind: "primary",
          testid: "db-life-empty-add",
          onClick: () => addRecord(section, rerender),
        },
        ...(related
          ? {
            secondary: {
              label: `${related.label} 보기`,
              kind: "ghost" as const,
              testid: "db-life-empty-related",
              onClick: () => {
                activeSection = related.id;
                rerender();
              },
            },
          }
          : {}),
        testid: "db-life-empty",
      }),
    ],
    testid: `db-life-detail-${section}`,
  });
}

function configListPane(section: ConfigSection): HTMLElement {
  const meta = sectionMeta(section);
  const configured = sectionCount(store.getCurrent(), section) === 1;
  return listPane({
    title: meta.label,
    count: configured ? 1 : 0,
    rows: configured
      ? [listRow({
        name: meta.label,
        sub: "설정됨",
        number: 1,
        active: true,
        testid: `db-life-row-${section}`,
        onSelect: () => undefined,
      })]
      : [],
    empty: wsEmptyState({
      icon: "○",
      title: "설정 없음",
      compact: true,
      testid: "db-life-list-empty",
    }),
    testid: `db-life-list-pane-${section}`,
  });
}

// ---------------------------------------------------------------------------
// 레코드 상세
// ---------------------------------------------------------------------------

function recordDetail(section: RecordSection, record: LifeRecord, index: number, rerender: () => void): HTMLElement {
  const sub = rowSub(section, record);
  return detailPane({
    hero: detailHero({
      title: labelFor(section, record, index),
      tags: sub ? [sub] : undefined,
      testid: `db-life-hero-${section}`,
    }),
    body: recordInspector(section, record, index, rerender),
    testid: `db-life-detail-${section}`,
  });
}

function recordInspector(section: RecordSection, record: LifeRecord, index: number, rerender: () => void): HTMLElement {
  const cards = ((): readonly HTMLElement[] => {
    switch (section) {
      case "skills": return skillCards(record as LifeSkillRecord, index, rerender);
      case "recipes": return recipeCards(record as CraftRecipe, index, rerender);
      case "upgrades": return upgradeCards(record as ItemUpgradeRule, index, rerender);
      case "sellPrices": return sellPriceCards(record as SellPriceEntry, index);
      case "toolActions": return toolActionCards(record as ToolActionRule, index, rerender);
      case "worldUnlocks": return worldUnlockCards(record as WorldUnlockDefinition, index);
      case "bundles": return bundleCards(record as BundleDefinition, index, rerender);
      case "makers": return makerCards(record as MakerDefinition, index, rerender);
    }
  })();
  return el("div", { class: "db-ws-stack db-life-inspector", children: [...cards] });
}

function skillCards(record: LifeSkillRecord, index: number, rerender: () => void): readonly HTMLElement[] {
  const project = store.getCurrent();
  const enabled = project.system.skillSystem?.enabled === true;
  return [
    sectionCard({
      title: "기본",
      hint: "이벤트 명령이 참조하는 ID 입니다.",
      children: [
        textControl("ID", "db-life-skill-id", record.id, (value) => updateUniqueId("skills", index, value, record.id)),
        textControl("이름", "db-life-skill-name", record.name, (value) => updateSkill(index, { name: value })),
      ],
      testid: "db-life-skill-basic-card",
    }),
    sectionCard({
      title: "성장",
      hint: enabled ? "레벨업 시스템이 켜져 있습니다." : "레벨업 시스템이 꺼져 있어 경험치가 쌓이지 않습니다.",
      children: [
        selectControl("종류", "db-life-skill-type", record.skillType, SKILL_TYPE_LABELS as readonly (readonly [string, string])[], (value) => updateSkill(index, { skillType: value as LifeSkillType })),
        numberControl("최대 레벨", "db-life-skill-max-level", record.maxLevel, (value) => {
          updateSkill(index, { maxLevel: value });
          rerender();
        }, { min: 1, max: MAX_LIFE_SKILL_LEVEL }),
        checkboxControl("레벨업 시스템 사용", "db-life-skill-enabled", enabled, (checked) => {
          updateProject("skills:enabled", (draft) => { draft.system.skillSystem = { enabled: checked }; });
        }),
      ],
      testid: "db-life-skill-growth-card",
    }),
    rowsCard({
      title: "레벨 보상",
      hint: "레벨 2부터 최대 레벨까지 도달 보상을 설정합니다. 기존 레벨 1 보상은 보존되지만 레벨업으로 지급되지 않습니다.",
      addLabel: "+ 보상",
      addTestId: "db-life-skill-reward-add",
      onAdd: () => {
        if (record.maxLevel < 2) {
          toast("최대 레벨이 2 이상이어야 레벨업 보상을 추가할 수 있습니다.", "error");
          return;
        }
        updateSkill(index, { levelUpRewards: [...record.levelUpRewards, { level: 2 }] }, false);
        rerender();
      },
      emptyText: "아직 레벨 보상이 없습니다.",
      rows: record.levelUpRewards.map((reward, rewardIndex) => el("div", {
        // 필드가 셋 + 제거 버튼이라 amountEditor 의 3열 격자로는 모자란다. 전용 4열 클래스는
        // modern/life-crafting.css 가 정의하고, 그 시트가 없어도 기본 3열로 접혀 읽을 수는 있다.
        class: "db-life-nested-row db-life-reward-row",
        dataset: { testid: `db-life-skill-reward-row-${rewardIndex}` },
        children: [
          numberControl("레벨", `db-life-skill-reward-level-${rewardIndex}`, reward.level, (value) => updateReward(index, rewardIndex, { level: value }), { min: 2, max: Math.min(record.maxLevel, MAX_LIFE_SKILL_LEVEL) }),
          selectControl("스위치", `db-life-skill-reward-switch-${rewardIndex}`, reward.switchId ?? "", idOptions(project.switches, "없음"), (value) => updateReward(index, rewardIndex, { switchId: value || undefined })),
          selectControl("제작법", `db-life-skill-reward-recipe-${rewardIndex}`, reward.recipeId ?? "", idOptions(project.system.craftRecipes ?? [], "없음"), (value) => updateReward(index, rewardIndex, { recipeId: value || undefined })),
          removeButton(`db-life-skill-reward-delete-${rewardIndex}`, () => {
            updateSkill(index, { levelUpRewards: record.levelUpRewards.filter((_entry, i) => i !== rewardIndex) }, false);
            rerender();
          }),
        ],
      })),
      testid: "db-life-skill-reward-card",
    }),
  ];
}

function recipeCards(record: CraftRecipe, index: number, rerender: () => void): readonly HTMLElement[] {
  const items = store.getCurrent().database.items;
  return [
    sectionCard({
      title: "기본",
      hint: "이벤트 명령 '제작'이 이 ID 를 참조합니다.",
      children: [
        textControl("ID", "db-life-recipe-id", record.id, (value) => updateUniqueId("recipes", index, value, record.id)),
        textControl("이름", "db-life-recipe-name", record.name ?? "", (value) => updateRecipe(index, { name: value.trim() || undefined })),
        checkboxControl("해금 후 제작 가능", "db-life-recipe-requires-unlock", record.requiresUnlock === true, (checked) => updateRecipe(index, { requiresUnlock: checked || undefined })),
      ],
      testid: "db-life-recipe-basic-card",
    }),
    sectionCard({
      title: "결과물",
      hint: "제작에 성공하면 지급되는 아이템입니다.",
      children: [
        selectControl("결과 아이템", "db-life-recipe-output-item", record.outputItemId, idOptions(items), (value) => updateRecipe(index, { outputItemId: value })),
        numberControl("결과 수량", "db-life-recipe-output-count", record.outputCount ?? 1, (value) => updateRecipe(index, { outputCount: positiveInteger(value) })),
        numberControl("골드 비용", "db-life-recipe-gold-cost", record.goldCost ?? 0, (value) => updateRecipe(index, { goldCost: nonNegativeInteger(value) || undefined })),
      ],
      testid: "db-life-recipe-output-card",
    }),
    amountEditor("재료", "db-life-recipe-ingredient", record.ingredients, (ingredients: readonly CraftIngredient[], shouldRender = false) => {
      updateRecipe(index, { ingredients });
      if (shouldRender) rerender();
    }),
  ];
}

function upgradeCards(record: ItemUpgradeRule, index: number, rerender: () => void): readonly HTMLElement[] {
  const items = store.getCurrent().database.items;
  return [
    sectionCard({
      title: "교체",
      hint: "이벤트 명령 '도구 강화 적용'이 이 ID 를 참조합니다.",
      children: [
        textControl("ID", "db-life-upgrade-id", record.id, (value) => updateUniqueId("upgrades", index, value, record.id)),
        selectControl("강화 전", "db-life-upgrade-from-item", record.fromItemId, idOptions(items), (value) => updateUpgrade(index, { fromItemId: value })),
        selectControl("강화 후", "db-life-upgrade-to-item", record.toItemId, idOptions(items), (value) => updateUpgrade(index, { toItemId: value })),
        numberControl("골드 비용", "db-life-upgrade-gold-cost", record.goldCost ?? 0, (value) => updateUpgrade(index, { goldCost: nonNegativeInteger(value) || undefined })),
      ],
      testid: "db-life-upgrade-basic-card",
    }),
    sectionCard({
      title: "강화 도구 능력",
      hint: `한 번에 작업하는 칸 수는 축마다 최대 ${TOOL_CAPABILITY_AXIS_MAX} 입니다.`,
      children: [
        checkboxControl("강화 도구 능력 설정", "db-life-upgrade-capability-enabled", record.capability !== undefined, (checked) => {
          updateUpgrade(index, { capability: checked ? record.capability ?? { areaWidth: 1, areaHeight: 1, energyMultiplier: 1 } : undefined }, false);
          rerender();
        }),
        ...(record.capability
          ? [
            numberControl("효과 가로 칸", "db-life-upgrade-area-width", record.capability.areaWidth, (value) => updateUpgradeCapability(index, { areaWidth: boundedInteger(value, 1, TOOL_CAPABILITY_AXIS_MAX) })),
            numberControl("효과 세로 칸", "db-life-upgrade-area-height", record.capability.areaHeight, (value) => updateUpgradeCapability(index, { areaHeight: boundedInteger(value, 1, TOOL_CAPABILITY_AXIS_MAX) })),
            decimalControl("에너지 배율", "db-life-upgrade-energy-multiplier", record.capability.energyMultiplier, (value) => updateUpgradeCapability(index, { energyMultiplier: positiveNumber(value) })),
          ]
          : [el("p", { class: "db-life-help", text: "꺼 두면 강화 후에도 기본 도구와 같은 범위·에너지로 작동합니다." })]),
      ],
      testid: "db-life-upgrade-capability-card",
    }),
    amountEditor("강화 재료", "db-life-upgrade-ingredient", record.ingredients ?? [], (ingredients: readonly ItemAmount[], shouldRender = false) => {
      updateUpgrade(index, { ingredients: ingredients.length ? [...ingredients] : undefined });
      if (shouldRender) rerender();
    }),
  ];
}

function sellPriceCards(record: SellPriceEntry, index: number): readonly HTMLElement[] {
  return [
    sectionCard({
      title: "판매 가격",
      hint: "아이템 하나당 한 줄만 등록할 수 있습니다.",
      children: [
        selectControl("아이템", "db-life-sell-item", record.itemId, idOptions(store.getCurrent().database.items), (value) => updateSellPrice(index, { itemId: value })),
        numberControl("판매 가격", "db-life-sell-price", record.price, (value) => updateSellPrice(index, { price: nonNegativeInteger(value) })),
      ],
      testid: "db-life-sell-card",
    }),
    sectionCard({
      title: "어디에 쓰이나",
      children: [
        el("p", { class: "db-life-help", text: "· 출하 상자 정산이 이 가격으로 하루 수입을 계산합니다." }),
        el("p", { class: "db-life-help", text: "· 상점 판매 가격의 기준값으로도 쓰입니다." }),
      ],
      testid: "db-life-sell-usage-card",
    }),
  ];
}

function toolActionCards(record: ToolActionRule, index: number, rerender: () => void): readonly HTMLElement[] {
  return [
    sectionCard({
      title: "조건",
      hint: "아이템을 지정하면 도구 종류보다 우선합니다. 둘 다 비우면 씨앗·소비재를 제외한 모든 농사 도구에 적용됩니다. 같은 행동은 위쪽의 일치하는 규칙부터 적용합니다.",
      children: [
        textControl("ID", "db-life-tool-id", record.id, (value) => updateUniqueId("toolActions", index, value, record.id)),
        selectControl("아이템", "db-life-tool-item", record.itemId ?? "", idOptions(store.getCurrent().database.items, "아이템 조건 없음"), (value) => updateToolAction(index, { itemId: value || undefined })),
        selectControl("도구 종류", "db-life-tool-farm-tool", record.farmTool ?? "", FARM_TOOL_LABELS, (value) => updateToolAction(index, { farmTool: value ? value as FarmTool : undefined })),
      ],
      testid: "db-life-tool-condition-card",
    }),
    sectionCard({
      title: "행동",
      hint: "조건이 맞을 때 맵에서 실제로 일어나는 작업입니다.",
      children: [
        selectControl("행동", "db-life-tool-action", record.action, TOOL_ACTION_LABELS as readonly (readonly [string, string])[], (value) => {
          updateToolAction(index, { action: value as ToolWorldAction });
          rerender();
        }),
        checkboxControl("경작 가능 구역 필요", "db-life-tool-requires-farmable", toolRuleRequiresFarmable(record), (checked) => updateToolAction(index, { requiresFarmable: checked })),
        textControl("대상 오브젝트 종류", "db-life-tool-target-kind", record.targetPlaceableKind ?? "", (value) => updateToolAction(index, { targetPlaceableKind: value.trim() || undefined })),
      ],
      testid: "db-life-tool-action-card",
    }),
  ];
}

function worldUnlockCards(record: WorldUnlockDefinition, index: number): readonly HTMLElement[] {
  return [
    sectionCard({
      title: "기본",
      hint: "꾸러미 보상이 이 ID 로 해금을 지목합니다.",
      children: [
        textControl("ID", "db-life-world-unlock-id", record.id, (value) => updateUniqueId("worldUnlocks", index, value, record.id)),
        textControl("이름", "db-life-world-unlock-name", record.name ?? "", (value) => updateWorldUnlock(index, { name: value.trim() || undefined })),
      ],
      testid: "db-life-world-unlock-basic-card",
    }),
    sectionCard({
      title: "맵 연결",
      hint: "해금되면 이 스위치가 켜집니다. 맵 이벤트의 출현 조건에 쓰세요.",
      children: [
        selectControl("연결 스위치", "db-life-world-unlock-switch", record.switchId ?? "", idOptions(store.getCurrent().switches, "연결하지 않음"), (value) => updateWorldUnlock(index, { switchId: value || undefined })),
      ],
      testid: "db-life-world-unlock-switch-card",
    }),
  ];
}

function bundleCards(record: BundleDefinition, index: number, rerender: () => void): readonly HTMLElement[] {
  const project = store.getCurrent();
  const reward = record.reward;
  return [
    sectionCard({
      title: "기본",
      children: [
        textControl("ID", "db-life-bundle-id", record.id, (value) => updateUniqueId("bundles", index, value, record.id)),
        textControl("이름", "db-life-bundle-name", record.name ?? "", (value) => updateBundle(index, { name: value.trim() || undefined })),
      ],
      testid: "db-life-bundle-basic-card",
    }),
    sectionCard({
      title: "완료 보상",
      hint: "필요 아이템을 모두 채웠을 때 한 번 지급됩니다.",
      children: [
        numberControl("골드", "db-life-bundle-reward-gold", reward?.gold ?? 0, (value) => updateBundleReward(index, { gold: nonNegativeInteger(value) || undefined })),
        selectControl("켜질 스위치", "db-life-bundle-reward-switch", reward?.switchId ?? "", idOptions(project.switches, "없음"), (value) => updateBundleReward(index, { switchId: value || undefined })),
        ...(reward
          ? [el("button", {
            class: "db-ws-btn db-ws-btn-danger",
            text: "보상 비우기",
            attrs: { type: "button" },
            dataset: { testid: "db-life-bundle-reward-remove" },
            on: {
              click: () => {
                updateBundle(index, { reward: undefined }, false);
                rerender();
              },
            },
          })]
          : []),
      ],
      testid: "db-life-bundle-reward-card",
    }),
    amountEditor("필요 아이템", "db-life-bundle-requirement", record.requirements, (requirements: readonly ItemAmount[], shouldRender = false) => {
      updateBundle(index, { requirements: [...requirements] });
      if (shouldRender) rerender();
    }),
    amountEditor("보상 아이템", "db-life-bundle-reward-item", reward?.itemRewards ?? [], (itemRewards: readonly ItemAmount[], shouldRender = false) => {
      updateBundleReward(index, { itemRewards: itemRewards.length ? [...itemRewards] : undefined });
      if (shouldRender) rerender();
    }),
    checkboxListCard("지역 해금", "db-life-bundle-unlock", project.system.worldUnlocks ?? [], reward?.worldUnlockIds ?? [], (worldUnlockIds) => updateBundleReward(index, { worldUnlockIds: worldUnlockIds.length ? worldUnlockIds : undefined })),
    checkboxListCard("제작법 해금", "db-life-bundle-recipe", project.system.craftRecipes ?? [], reward?.recipeIds ?? [], (recipeIds) => updateBundleReward(index, { recipeIds: recipeIds.length ? recipeIds : undefined })),
  ];
}

function makerCards(record: MakerDefinition, index: number, rerender: () => void): readonly HTMLElement[] {
  return [
    sectionCard({
      title: "기본",
      hint: "가공은 즉시 끝나지 않고 게임 내 시간이 흘러야 완성됩니다.",
      children: [
        textControl("ID", "db-life-maker-id", record.id, (value) => updateUniqueId("makers", index, value, record.id)),
        textControl("이름", "db-life-maker-name", record.name ?? "", (value) => updateMaker(index, { name: value.trim() || undefined })),
        numberControl("가공 시간(분)", "db-life-maker-duration", record.durationMinutes, (value) => updateMaker(index, { durationMinutes: positiveInteger(value) })),
      ],
      testid: "db-life-maker-basic-card",
    }),
    amountEditor("투입 아이템", "db-life-maker-input", record.inputs, (inputs: readonly ItemAmount[], shouldRender = false) => {
      updateMaker(index, { inputs: [...inputs] });
      if (shouldRender) rerender();
    }),
    amountEditor("생산 아이템", "db-life-maker-output", record.outputs, (outputs: readonly ItemAmount[], shouldRender = false) => {
      updateMaker(index, { outputs: [...outputs] });
      if (shouldRender) rerender();
    }),
  ];
}

// ---------------------------------------------------------------------------
// 설정 패키지 (에너지 / 출하)
// ---------------------------------------------------------------------------

function configDetail(section: ConfigSection, rerender: () => void): HTMLElement {
  const meta = sectionMeta(section);
  const project = store.getCurrent();
  const value = section === "energy" ? project.system.energy : project.system.shipping;

  if (!value) {
    return detailPane({
      body: [
        wsEmptyState({
          icon: "＋",
          title: `${meta.label} 설정 없음`,
          body: meta.emptyBody,
          action: {
            label: "설정 만들기",
            kind: "primary",
            testid: "db-life-package-create",
            onClick: () => createConfigPackage(section, rerender),
          },
          testid: "db-life-package-empty",
        }),
      ],
      testid: `db-life-package-pane-${section}`,
    });
  }

  return detailPane({
    hero: detailHero({
      title: meta.label,
      testid: `db-life-hero-${section}`,
    }),
    body: [
      el("div", {
        class: "db-ws-stack db-life-inspector",
        children: section === "energy" ? [...energyCards(rerender)] : [...shippingCards(rerender)],
      }),
    ],
    testid: `db-life-package-pane-${section}`,
  });
}

function energyCards(rerender: () => void): readonly HTMLElement[] {
  const energy = store.getCurrent().system.energy!;
  return [
    sectionCard({
      title: "에너지 값",
      hint: "작업에 쓰는 최대 에너지와 하루 시작·회복량을 정합니다.",
      children: [
        numberControl("최대 에너지", "db-life-energy-max", energy.max, (value) => updateEnergy({ max: positiveInteger(value) })),
        numberControl("시작 에너지", "db-life-energy-initial", energy.initial ?? energy.max, (value) => updateEnergy({ initial: boundedInteger(value, 0, store.getCurrent().system.energy?.max ?? energy.max) })),
        numberControl("하루 회복량", "db-life-energy-restore", energy.restorePerDay ?? energy.max, (value) => updateEnergy({ restorePerDay: boundedInteger(value, 0, store.getCurrent().system.energy?.max ?? energy.max) })),
      ],
      testid: "db-life-energy-card",
    }),
    sectionCard({
      title: "어떻게 줄어드나",
      children: [
        el("p", { class: "db-life-help", text: "· 도구 행동 한 번마다 에너지가 줄어듭니다." }),
        el("p", { class: "db-life-help", text: "· 도구 강화의 에너지 배율이 여기에 곱해집니다." }),
        el("p", { class: "db-life-help", text: "· 잠을 자면 하루 회복량만큼 되돌아옵니다." }),
      ],
      testid: "db-life-energy-usage-card",
    }),
    removeCard("에너지 설정 영구 제거", "에너지 규칙과 입력값을 프로젝트에서 제거합니다.", () => removeConfigPackage("energy", rerender)),
  ];
}

function shippingCards(rerender: () => void): readonly HTMLElement[] {
  const project = store.getCurrent();
  const shipping = project.system.shipping!;
  const selected = shipping.allowedItemIds;
  return [
    sectionCard({
      title: "정산 규칙",
      hint: "하루가 끝날 때 출하 상자를 정산하고 기록을 보관합니다.",
      children: [
        checkboxControl("출하 사용", "db-life-shipping-enabled", shipping.enabled, (checked) => updateShipping({ enabled: checked })),
        numberControl("기록 보관 일수", "db-life-shipping-history-limit", shipping.historyLimit ?? 30, (value) => updateShipping({ historyLimit: boundedInteger(value, 1, 365) })),
      ],
      testid: "db-life-shipping-card",
    }),
    sectionCard({
      title: "어떻게 정산되나",
      children: [
        el("p", { class: "db-life-help", text: "· 자정에 출하 상자 안의 아이템이 판매 가격으로 환산됩니다." }),
        el("p", { class: "db-life-help", text: "· 판매 가격이 없는 아이템은 0G 로 처리됩니다." }),
        el("p", { class: "db-life-help", text: "· '출하 사용'을 꺼도 아래 목록과 보관 일수는 그대로 남습니다." }),
      ],
      testid: "db-life-shipping-usage-card",
    }),
    removeCard("출하 설정 영구 제거", "사용 중지만 하려면 위의 '출하 사용'을 끄세요. 이 버튼은 입력값도 제거합니다.", () => removeConfigPackage("shipping", rerender)),
    spanned(sectionCard({
      title: "출하 허용 아이템",
      hint: selected === undefined ? "판매 가능한 모든 아이템" : `${selected.length}개 선택`,
      children: [
        checkboxControl("판매 가능한 모든 아이템", "db-life-shipping-all-items", selected === undefined, (checked) => {
          updateShipping({ allowedItemIds: checked ? undefined : [] }, false);
          rerender();
        }),
        el("div", {
          class: "db-life-checkbox-list",
          children: project.database.items.map((item) => checkboxControl(
            item.name || item.id,
            `db-life-shipping-item-${item.id}`,
            selected?.includes(item.id) ?? selected === undefined,
            (checked) => {
              const project = store.getCurrent();
              const current = project.system.shipping?.allowedItemIds;
              // undefined = all: materialize every current item id before toggling one off/on.
              const ids = new Set(
                current === undefined
                  ? project.database.items.map((entry) => entry.id)
                  : current,
              );
              if (checked) ids.add(item.id);
              else ids.delete(item.id);
              updateShipping({ allowedItemIds: [...ids] });
              // 개별 토글은 목록을 실체화한다(undefined → 배열). 다시 그리지 않으면
              // 위의 「판매 가능한 모든 아이템」이 계속 켜진 채로 남는다 — 전부 허용이
              // 아닌데도 그렇게 보인다. 더 나쁜 건 그 체크박스의 핸들러가 **새** 체크
              // 상태로 `checked ? undefined : []` 를 쓴다는 점이다. 그래서 낡은 켠
              // 상태를 사용자가 한 번 누르면 「전부 허용」을 기대한 클릭이 출하 목록을
              // 통째로 비운다([]). 실측: 2026-09-09 네이티브 v13 (231개 배열인데
              // all-items checked:true).
              rerender();
            },
            true,
          )),
        }),
      ],
      testid: "db-life-shipping-items-card",
    })),
  ];
}

// ---------------------------------------------------------------------------
// 재사용 카드 조각
// ---------------------------------------------------------------------------

/** 행 목록 + 추가 버튼을 담는 전폭 카드. fieldset/legend 대신 sectionCard 를 쓴다. */
function rowsCard(options: {
  readonly title: string;
  readonly hint?: string;
  readonly addLabel: string;
  readonly addTestId: string;
  readonly onAdd: () => void;
  readonly emptyText: string;
  readonly rows: readonly HTMLElement[];
  readonly testid: string;
}): HTMLElement {
  return spanned(sectionCard({
    title: options.title,
    ...(options.hint ? { hint: options.hint } : {}),
    children: [
      el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: options.addLabel,
        attrs: { type: "button" },
        dataset: { testid: options.addTestId },
        on: { click: options.onAdd },
      }),
      ...(options.rows.length === 0
        ? [el("p", { class: "db-life-help", text: options.emptyText })]
        : options.rows),
    ],
    testid: options.testid,
  }));
}

function amountEditor(
  title: string,
  prefix: string,
  amounts: readonly ItemAmount[],
  onChange: (amounts: readonly ItemAmount[], rerender?: boolean) => void,
): HTMLElement {
  const items = store.getCurrent().database.items;
  return rowsCard({
    title,
    addLabel: "+ 아이템",
    addTestId: `${prefix}-add`,
    onAdd: () => {
      const unused = items.find((item) => !amounts.some((amount) => amount.itemId === item.id))?.id;
      if (!unused) {
        toast("추가할 수 있는 미등록 아이템이 없습니다.");
        return;
      }
      onChange([...amounts, { itemId: unused, count: 1 }], true);
    },
    emptyText: "아직 아이템이 없습니다.",
    rows: amounts.map((amount, amountIndex) => el("div", {
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
        removeButton(`${prefix}-delete-${amountIndex}`, () => onChange(amounts.filter((_entry, index) => index !== amountIndex), true)),
      ],
    })),
    testid: `${prefix}-card`,
  });
}

function checkboxListCard(
  title: string,
  prefix: string,
  records: readonly { readonly id: string; readonly name?: string }[],
  selectedIds: readonly string[],
  onChange: (ids: string[]) => void,
): HTMLElement {
  const selected = new Set(selectedIds);
  return sectionCard({
    title,
    hint: records.length === 0 ? "선택할 레코드가 없습니다." : `${selectedIds.length}/${records.length} 선택`,
    children: records.length === 0
      ? [el("p", { class: "db-life-help", text: "먼저 해당 섹션에서 레코드를 만들면 여기에 나타납니다." })]
      : [el("div", {
        class: "db-life-checkbox-list",
        children: records.map((record) => checkboxControl(
          record.name || record.id,
          `${prefix}-${record.id}`,
          selectedIds.includes(record.id),
          (checked) => {
            if (checked) selected.add(record.id);
            else selected.delete(record.id);
            onChange([...selected]);
          },
          true,
        )),
      })],
    testid: `${prefix}-card`,
  });
}

function removeCard(label: string, description: string, onRemove: () => void): HTMLElement {
  return sectionCard({
    title: "설정 제거",
    hint: "되돌리려면 Ctrl+Z 를 누르세요.",
    children: [
      el("p", { class: "db-life-help", text: description }),
      el("button", {
        class: "db-ws-btn db-ws-btn-danger",
        text: label,
        attrs: { type: "button" },
        dataset: { testid: "db-life-package-remove" },
        on: { click: onRemove },
      }),
    ],
    testid: "db-life-package-remove-card",
  });
}

/** `db-ws-stack` 에서 한 줄을 다 쓰게 한다(표·긴 목록용 opt-in). */
function spanned(card: HTMLElement): HTMLElement {
  card.classList.add("db-ws-span");
  return card;
}

function removeButton(testid: string, onClick: () => void): HTMLElement {
  return el("button", {
    class: "db-ws-btn db-ws-btn-danger db-life-row-remove",
    text: "제거",
    attrs: { type: "button" },
    dataset: { testid },
    on: { click: onClick },
  });
}

// ---------------------------------------------------------------------------
// 컬렉션 액션 (기존 동작 그대로)
// ---------------------------------------------------------------------------

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
      case "toolActions": {
        const firstCustomTable = !draft.system.toolActions?.length;
        const rules = toolActionRulesOf(draft).map((rule) => ({ ...rule }));
        const added: ToolActionRule = { id: genId("tool_action"), farmTool: "hoe", action: "till" };
        selectedIndex.toolActions = firstCustomTable ? 0 : rules.length;
        draft.system.toolActions = firstCustomTable ? [added, ...rules] : [...rules, added];
        break;
      }
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
  // 새 레코드는 검색 필터에 걸려 안 보일 수 있다 — 추가 직후에는 목록을 원상 복구한다.
  sectionSearch[section] = "";
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
      toast(`이벤트 명령 ${locations.length}곳에서 이 ${sectionMeta(section).label}을 사용 중입니다.`);
      return;
    }
  }
  if (section === "recipes") {
    const reference = craftRecipeReferenceMessage(store.getCurrent(), (selected as CraftRecipe).id);
    if (reference) {
      toast(reference);
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
    const reference = craftRecipeReferenceMessage(project, id);
    if (reference) return reference;
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

function sectionMeta(section: LifeSection): SectionMeta {
  return SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];
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

// ---------------------------------------------------------------------------
// 입력 컨트롤
//
// 커밋 시점은 예전 그대로 `change` 다 — 유닛 테스트와 e2e 가 값 세팅 후 change 를
// 던지는 계약에 맞춘다. 바뀐 건 라벨/컨트롤을 감싸는 클래스뿐이다.
// ---------------------------------------------------------------------------

function textControl(label: string, testid: string, value: string, onChange: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value, dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("change", () => onChange(input.value));
  return wsField(label, input);
}

function numberControl(label: string, testid: string, value: number, onChange: (value: number) => void, bounds?: { min: number; max: number }): HTMLElement {
  const input = el("input", { attrs: { type: "number", step: "1", ...(bounds ? { min: String(bounds.min), max: String(bounds.max) } : {}) }, value: String(value), dataset: { testid } }) as HTMLInputElement;
  if (bounds && bounds.max < bounds.min) input.disabled = true;
  input.addEventListener("change", () => {
    if (bounds && bounds.max < bounds.min) return;
    const next = bounds ? Math.min(bounds.max, Math.max(bounds.min, positiveInteger(Number(input.value)))) : Number(input.value);
    if (bounds) input.value = String(next);
    onChange(next);
  });
  return wsField(label, input);
}

function decimalControl(label: string, testid: string, value: number, onChange: (value: number) => void): HTMLElement {
  const input = el("input", { attrs: { type: "number", step: "0.01", min: "0.01" }, value: String(value), dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("change", () => onChange(Number(input.value)));
  return wsField(label, input);
}

function checkboxControl(
  label: string,
  testid: string,
  value: boolean,
  onChange: (value: boolean) => void,
  inline = false,
): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = value;
  input.addEventListener("change", () => onChange(input.checked));
  const row = wsField(label, input);
  row.classList.add("db-life-field", "is-checkbox");
  if (inline) row.classList.add("db-life-field-inline");
  return row;
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
  return wsField(label, select);
}

function idOptions(records: readonly { readonly id: string; readonly name?: string }[], emptyLabel?: string): readonly (readonly [string, string])[] {
  return [
    ...(emptyLabel ? [["", emptyLabel] as const] : []),
    ...records.map((record) => [record.id, record.name ? `${record.name} (${record.id})` : record.id] as const),
  ];
}

// ---------------------------------------------------------------------------
// 표시 라벨
// ---------------------------------------------------------------------------

function labelFor(section: RecordSection, record: LifeRecord, index: number): string {
  if (section === "skills") return (record as LifeSkillRecord).name || `(기술 ${index + 1})`;
  if (section === "recipes") return (record as CraftRecipe).name || (record as CraftRecipe).id;
  if (section === "upgrades") return `${itemLabel((record as ItemUpgradeRule).fromItemId)} → ${itemLabel((record as ItemUpgradeRule).toItemId)}`;
  if (section === "sellPrices") return itemLabel((record as SellPriceEntry).itemId);
  if (section === "worldUnlocks") return (record as WorldUnlockDefinition).name || (record as WorldUnlockDefinition).id;
  if (section === "bundles") return (record as BundleDefinition).name || (record as BundleDefinition).id;
  if (section === "makers") return (record as MakerDefinition).name || (record as MakerDefinition).id;
  return toolActionLabel((record as ToolActionRule).action);
}

function itemLabel(itemId: string): string {
  const item = store.getCurrent().database.items.find((entry) => entry.id === itemId);
  return item?.name || itemId || "(아이템 없음)";
}

function skillTypeLabel(type: LifeSkillType): string {
  return SKILL_TYPE_LABELS.find(([value]) => value === type)?.[1] ?? type;
}

function toolActionLabel(action: ToolWorldAction): string {
  return TOOL_ACTION_LABELS.find(([value]) => value === action)?.[1] ?? action;
}

function farmToolLabel(tool: FarmTool | undefined): string {
  return FARM_TOOL_LABELS.find(([value]) => value === (tool ?? ""))?.[1] ?? String(tool);
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
