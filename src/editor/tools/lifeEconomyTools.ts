// editor/tools/lifeEconomyTools.ts
// 생활·경제 저작(레시피/업그레이드/판매가/도구행동/에너지/출하/번들/해금/제작기).
// 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)에서
// 에디터 UI 는 쓰는데 어떤 툴도 쓰지 못하던 저작 필드를 담당한다. Database 생활/제작 탭과 같은 데이터.
import { isValidToolCapability, type ItemUpgradeRule, type SellPriceEntry, type ToolCapability } from "@/project/upgrades";
import type { CraftIngredient, CraftRecipe } from "@/project/craftRecipes";
import type { ToolActionRule, ToolWorldAction } from "@/project/toolActions";
import type {
  BundleDefinition,
  BundleRewardDefinition,
  EnergySystemConfig,
  FarmTool,
  ItemAmount,
  ItemId,
  MakerDefinition,
  Project,
  ShippingSystemConfig,
  WorldUnlockDefinition,
} from "@/project/types";
import {
  CRAFT_RECIPE_PARAMS,
  DELETE_BY_ID_PARAMS,
  ITEM_UPGRADE_PARAMS,
  LIFE_ECONOMY_CONFIG_PARAMS,
  SELL_PRICES_PARAMS,
  TOOL_ACTION_PARAMS,
} from "./lifeEconomyToolSchemas";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { craftRecipeReferenceMessage } from "@/editor/databaseCraftReferences";
import { mergeRecordPatch } from "./mergeRecordPatch";

const FARM_TOOLS: readonly FarmTool[] = ["hoe", "wateringCan", "axe", "pickaxe"];
const TOOL_ACTIONS: readonly ToolWorldAction[] = ["till", "water", "chop", "mine", "fish", "harvest"];

function sampleIds(ids: readonly string[]): string {
  if (ids.length === 0) return "(없음)";
  const head = ids.slice(0, 12).join(", ");
  return ids.length > 12 ? `${head} …(총 ${ids.length}개)` : head;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-args" });
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new ToolError(`${label}는 배열이어야 합니다.`, { code: "invalid-args" });
  return value;
}

function requireId(record: Record<string, unknown>, key: string, label: string): string {
  const raw = record[key];
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) throw new ToolError(`${label}.${key}(문자열 id)가 필요합니다.`, { code: "invalid-args" });
  return id;
}

function optionalText(record: Record<string, unknown>, key: string): string | undefined {
  const raw = record[key];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalCount(record: Record<string, unknown>, key: string, label: string, min = 0): number | undefined {
  const raw = record[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < min) {
    throw new ToolError(`${label}.${key}는 ${min} 이상의 정수여야 합니다.`, { code: "invalid-args" });
  }
  return raw;
}

function itemIds(draft: Project): readonly string[] {
  return draft.database.items.map((item) => item.id);
}

function requireItemId(draft: Project, value: unknown, label: string): ItemId {
  const id = typeof value === "string" ? value.trim() : "";
  const known = itemIds(draft);
  if (!id || !known.includes(id)) {
    throw new ToolError(
      `${label}='${id}'는 database.items 에 없는 아이템입니다. 사용 가능한 itemId: ${sampleIds(known)} — 없으면 upsert_item 으로 먼저 만드세요.`,
      { code: "item-not-found" },
    );
  }
  return id;
}

function requireSwitchId(draft: Project, value: unknown, label: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  const known = draft.switches.map((entry) => entry.id);
  if (!id || !known.includes(id)) {
    throw new ToolError(
      `${label}='${id}'는 프로젝트 스위치가 아닙니다. 사용 가능한 switchId: ${sampleIds(known)} — 없으면 manage_flag_slot 으로 먼저 만드세요.`,
      { code: "switch-not-found" },
    );
  }
  return id;
}

function parseItemAmounts(draft: Project, value: unknown, label: string): ItemAmount[] {
  return asArray(value, label).map((entry, index) => {
    const record = asRecord(entry, `${label}[${index}]`);
    const count = optionalCount(record, "count", `${label}[${index}]`, 1) ?? 1;
    return { itemId: requireItemId(draft, record.itemId, `${label}[${index}].itemId`), count };
  });
}

function parseIngredients(draft: Project, value: unknown, label: string): CraftIngredient[] {
  return parseItemAmounts(draft, value, label);
}

function upsertById<T extends { readonly id: string }>(list: readonly T[], record: T): { list: T[]; added: boolean } {
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index < 0) return { list: [...list, record], added: true };
  return { list: list.map((entry, at) => (at === index ? record : entry)), added: false };
}

const upsertCraftRecipe: ToolDefinition = {
  name: "upsert_craft_recipe",
  description:
    "제작 레시피(system.craftRecipes)를 id 기준으로 등록/수정한다. Database 생활·제작 탭의 제작법 행과 같은 저작 데이터. 재료/산출 itemId 는 database.items 에서 검증한다.",
  mode: "write",
  parameters: CRAFT_RECIPE_PARAMS,
  invalidArgsExample: { recipe: { id: "recipe_plank", name: "판자", ingredients: [{ itemId: "wood", count: 2 }], outputItemId: "plank", outputCount: 1 } },
  run(draft, args): ToolExecResult {
    const patch = asRecord(args.recipe, "recipe");
    const id = requireId(patch, "id", "recipe");
    const record = mergeRecordPatch(draft.system.craftRecipes?.find((recipe) => recipe.id === id), patch);
    const recipe: CraftRecipe = {
      id,
      ...(optionalText(record, "name") !== undefined ? { name: optionalText(record, "name") } : {}),
      ingredients: record.ingredients === undefined ? [] : parseIngredients(draft, record.ingredients, "recipe.ingredients"),
      outputItemId: requireItemId(draft, record.outputItemId, "recipe.outputItemId"),
      ...(optionalCount(record, "outputCount", "recipe", 1) !== undefined ? { outputCount: optionalCount(record, "outputCount", "recipe", 1) } : {}),
      ...(optionalCount(record, "goldCost", "recipe") !== undefined ? { goldCost: optionalCount(record, "goldCost", "recipe") } : {}),
      ...(typeof record.requiresUnlock === "boolean" ? { requiresUnlock: record.requiresUnlock } : {}),
    };
    const outcome = upsertById(draft.system.craftRecipes ?? [], recipe);
    draft.system.craftRecipes = outcome.list;
    return { summary: `제작 레시피 '${id}' ${outcome.added ? "추가" : "수정"}(총 ${outcome.list.length}건)`, data: recipe };
  },
};

const deleteCraftRecipe: ToolDefinition = {
  name: "delete_craft_recipe",
  description: "제작 레시피(system.craftRecipes) 1건을 id 로 삭제한다. 없는 id 는 남아 있는 레시피 id 를 알려주며 거부한다.",
  mode: "write",
  parameters: DELETE_BY_ID_PARAMS,
  invalidArgsExample: { id: "recipe_plank" },
  run(draft, args): ToolExecResult {
    const id = requireId(args, "id", "delete_craft_recipe");
    const reference = craftRecipeReferenceMessage(draft, id);
    if (reference) throw new ToolError(reference, { code: "recipe-in-use" });
    const current = draft.system.craftRecipes ?? [];
    const next = current.filter((recipe) => recipe.id !== id);
    if (next.length === current.length) {
      throw new ToolError(
        `제작 레시피 '${id}'가 없습니다. 현재 레시피 id: ${sampleIds(current.map((recipe) => recipe.id))}`,
        { code: "recipe-not-found" },
      );
    }
    draft.system.craftRecipes = next;
    return { summary: `제작 레시피 '${id}' 삭제(남은 ${next.length}건)`, data: { id } };
  },
};

function parseCapability(value: unknown): ToolCapability {
  const record = asRecord(value, "upgrade.capability");
  const capability: ToolCapability = {
    areaWidth: optionalCount(record, "areaWidth", "upgrade.capability", 1) ?? 1,
    areaHeight: optionalCount(record, "areaHeight", "upgrade.capability", 1) ?? 1,
    energyMultiplier: typeof record.energyMultiplier === "number" ? record.energyMultiplier : 1,
  };
  if (!isValidToolCapability(capability)) {
    throw new ToolError(
      "upgrade.capability 가 범위를 벗어났습니다: areaWidth/areaHeight 는 1~9, 두 값의 곱은 81 이하, energyMultiplier 는 0 보다 커야 합니다.",
      { code: "invalid-args" },
    );
  }
  return capability;
}

const upsertItemUpgrade: ToolDefinition = {
  name: "upsert_item_upgrade",
  description:
    "아이템 업그레이드 규칙(system.itemUpgrades)을 id 기준으로 등록/수정한다. Database 생활·제작 탭의 업그레이드 행과 같은 저작 데이터. capability 로 도구 범위·에너지 배율까지 저작한다.",
  mode: "write",
  parameters: ITEM_UPGRADE_PARAMS,
  invalidArgsExample: { upgrade: { id: "upgrade_hoe", fromItemId: "hoe", toItemId: "hoe_gold", goldCost: 300, ingredients: [{ itemId: "iron", count: 2 }] } },
  run(draft, args): ToolExecResult {
    const record = asRecord(args.upgrade, "upgrade");
    const id = requireId(record, "id", "upgrade");
    const rule: ItemUpgradeRule = {
      id,
      fromItemId: requireItemId(draft, record.fromItemId, "upgrade.fromItemId"),
      toItemId: requireItemId(draft, record.toItemId, "upgrade.toItemId"),
      ...(optionalCount(record, "goldCost", "upgrade") !== undefined ? { goldCost: optionalCount(record, "goldCost", "upgrade") } : {}),
      ...(record.ingredients !== undefined ? { ingredients: parseIngredients(draft, record.ingredients, "upgrade.ingredients") } : {}),
      ...(record.capability !== undefined && record.capability !== null ? { capability: parseCapability(record.capability) } : {}),
    };
    const outcome = upsertById(draft.system.itemUpgrades ?? [], rule);
    draft.system.itemUpgrades = outcome.list;
    return { summary: `업그레이드 '${id}' ${outcome.added ? "추가" : "수정"}(총 ${outcome.list.length}건)`, data: rule };
  },
};

const setSellPrices: ToolDefinition = {
  name: "set_sell_prices",
  description:
    "판매가 표(system.sellPrices)를 itemId 기준으로 upsert 한다. Database 생활·제작 탭의 판매가 행과 같은 저작 데이터. 행을 없앨 때는 removeItemIds 에 itemId 를 넣는다(가격 생략이 아니라 명시 삭제 목록).",
  mode: "write",
  parameters: SELL_PRICES_PARAMS,
  invalidArgsExample: { entries: [{ itemId: "wood", price: 12 }], removeItemIds: ["plank"] },
  run(draft, args): ToolExecResult {
    if (args.entries === undefined && args.removeItemIds === undefined) {
      throw new ToolError("entries 또는 removeItemIds 중 하나는 있어야 합니다.", { code: "invalid-args" });
    }
    const entries = args.entries === undefined
      ? []
      : asArray(args.entries, "entries").map((entry, index) => {
        const record = asRecord(entry, `entries[${index}]`);
        return {
          itemId: requireItemId(draft, record.itemId, `entries[${index}].itemId`),
          price: optionalCount(record, "price", `entries[${index}]`) ?? 0,
        } satisfies SellPriceEntry;
      });
    const removeIds = args.removeItemIds === undefined
      ? []
      : asArray(args.removeItemIds, "removeItemIds").map((entry, index) => requireItemId(draft, entry, `removeItemIds[${index}]`));

    let table: SellPriceEntry[] = [...(draft.system.sellPrices ?? [])];
    for (const entry of entries) table = upsertByItemId(table, entry);
    const removed = removeIds.filter((id) => table.some((row) => row.itemId === id));
    table = table.filter((row) => !removeIds.includes(row.itemId));
    draft.system.sellPrices = table;
    const removedNote = removeIds.length > 0 ? `, 삭제 ${removed.length}/${removeIds.length}건` : "";
    return { summary: `판매가 ${entries.length}건 반영${removedNote}(표 ${table.length}행)`, data: { entries, removed } };
  },
};

function upsertByItemId(list: readonly SellPriceEntry[], entry: SellPriceEntry): SellPriceEntry[] {
  const index = list.findIndex((row) => row.itemId === entry.itemId);
  if (index < 0) return [...list, entry];
  return list.map((row, at) => (at === index ? entry : row));
}

const upsertToolAction: ToolDefinition = {
  name: "upsert_tool_action",
  description:
    "도구→월드 행동 규칙(system.toolActions)을 id 기준으로 등록/수정한다. Database 생활·제작 탭의 도구 행동 행과 같은 저작 데이터. 1건이라도 저작하면 기본 괭이/물뿌리개 규칙 대신 저작 표가 쓰인다.",
  mode: "write",
  parameters: TOOL_ACTION_PARAMS,
  invalidArgsExample: { rule: { id: "tool_axe_chop", farmTool: "axe", targetPlaceableKind: "tree", action: "chop", requiresFarmable: false } },
  run(draft, args): ToolExecResult {
    const record = asRecord(args.rule, "rule");
    const id = requireId(record, "id", "rule");
    const action = typeof record.action === "string" ? record.action : "";
    if (!TOOL_ACTIONS.includes(action as ToolWorldAction)) {
      throw new ToolError(`rule.action 은 ${TOOL_ACTIONS.join("/")} 중 하나여야 합니다(받은 값: '${action}').`, { code: "invalid-args" });
    }
    const farmToolRaw = optionalText(record, "farmTool");
    if (farmToolRaw !== undefined && !FARM_TOOLS.includes(farmToolRaw as FarmTool)) {
      throw new ToolError(`rule.farmTool 은 ${FARM_TOOLS.join("/")} 중 하나여야 합니다(받은 값: '${farmToolRaw}').`, { code: "invalid-args" });
    }
    const rule: ToolActionRule = {
      id,
      ...(farmToolRaw !== undefined ? { farmTool: farmToolRaw as FarmTool } : {}),
      ...(record.itemId !== undefined && record.itemId !== null ? { itemId: requireItemId(draft, record.itemId, "rule.itemId") } : {}),
      ...(typeof record.requiresFarmable === "boolean" ? { requiresFarmable: record.requiresFarmable } : {}),
      ...(optionalText(record, "targetPlaceableKind") !== undefined ? { targetPlaceableKind: optionalText(record, "targetPlaceableKind") } : {}),
      action: action as ToolWorldAction,
    };
    const outcome = upsertById(draft.system.toolActions ?? [], rule);
    draft.system.toolActions = outcome.list;
    return { summary: `도구 행동 '${id}' ${outcome.added ? "추가" : "수정"}(총 ${outcome.list.length}건)`, data: rule };
  },
};

function parseEnergy(value: unknown): EnergySystemConfig {
  const record = asRecord(value, "energy");
  const max = optionalCount(record, "max", "energy", 1);
  if (max === undefined) throw new ToolError("energy.max(1 이상 정수)가 필요합니다.", { code: "invalid-args" });
  const initial = optionalCount(record, "initial", "energy");
  const restorePerDay = optionalCount(record, "restorePerDay", "energy");
  return {
    max,
    ...(initial !== undefined ? { initial: Math.min(initial, max) } : {}),
    ...(restorePerDay !== undefined ? { restorePerDay: Math.min(restorePerDay, max) } : {}),
  };
}

function parseShipping(draft: Project, value: unknown): ShippingSystemConfig {
  const record = asRecord(value, "shipping");
  if (typeof record.enabled !== "boolean") throw new ToolError("shipping.enabled(boolean)가 필요합니다.", { code: "invalid-args" });
  const historyLimit = optionalCount(record, "historyLimit", "shipping");
  const allowed = record.allowedItemIds === undefined || record.allowedItemIds === null
    ? undefined
    : asArray(record.allowedItemIds, "shipping.allowedItemIds").map((entry, index) => requireItemId(draft, entry, `shipping.allowedItemIds[${index}]`));
  return {
    enabled: record.enabled,
    ...(historyLimit !== undefined ? { historyLimit } : {}),
    ...(allowed !== undefined ? { allowedItemIds: allowed } : {}),
  };
}

function parseWorldUnlocks(draft: Project, value: unknown): WorldUnlockDefinition[] {
  return asArray(value, "worldUnlocks").map((entry, index) => {
    const record = asRecord(entry, `worldUnlocks[${index}]`);
    return {
      id: requireId(record, "id", `worldUnlocks[${index}]`),
      ...(optionalText(record, "name") !== undefined ? { name: optionalText(record, "name") } : {}),
      ...(record.switchId !== undefined && record.switchId !== null
        ? { switchId: requireSwitchId(draft, record.switchId, `worldUnlocks[${index}].switchId`) }
        : {}),
    };
  });
}

function parseBundleReward(draft: Project, value: unknown, label: string, unlockIds: readonly string[]): BundleRewardDefinition {
  const record = asRecord(value, label);
  const recipeIds = record.recipeIds === undefined || record.recipeIds === null
    ? undefined
    : asArray(record.recipeIds, `${label}.recipeIds`).map((entry, index) => {
      const id = typeof entry === "string" ? entry.trim() : "";
      const known = (draft.system.craftRecipes ?? []).map((recipe) => recipe.id);
      if (!id || !known.includes(id)) {
        throw new ToolError(
          `${label}.recipeIds[${index}]='${id}'는 system.craftRecipes 에 없는 레시피입니다. 사용 가능한 recipeId: ${sampleIds(known)} — 없으면 upsert_craft_recipe 로 먼저 만드세요.`,
          { code: "recipe-not-found" },
        );
      }
      return id;
    });
  const worldUnlockIds = record.worldUnlockIds === undefined || record.worldUnlockIds === null
    ? undefined
    : asArray(record.worldUnlockIds, `${label}.worldUnlockIds`).map((entry, index) => {
      const id = typeof entry === "string" ? entry.trim() : "";
      if (!id || !unlockIds.includes(id)) {
        throw new ToolError(
          `${label}.worldUnlockIds[${index}]='${id}'는 system.worldUnlocks 에 없는 해금입니다. 사용 가능한 worldUnlockId: ${sampleIds(unlockIds)} — 같은 호출의 worldUnlocks 로 함께 정의할 수 있습니다.`,
          { code: "world-unlock-not-found" },
        );
      }
      return id;
    });
  const gold = optionalCount(record, "gold", label);
  return {
    ...(gold !== undefined ? { gold } : {}),
    ...(record.itemRewards !== undefined && record.itemRewards !== null
      ? { itemRewards: parseItemAmounts(draft, record.itemRewards, `${label}.itemRewards`) }
      : {}),
    ...(record.switchId !== undefined && record.switchId !== null
      ? { switchId: requireSwitchId(draft, record.switchId, `${label}.switchId`) }
      : {}),
    ...(worldUnlockIds !== undefined ? { worldUnlockIds } : {}),
    ...(recipeIds !== undefined ? { recipeIds } : {}),
  };
}

function parseBundles(draft: Project, value: unknown, unlockIds: readonly string[]): BundleDefinition[] {
  return asArray(value, "bundles").map((entry, index) => {
    const record = asRecord(entry, `bundles[${index}]`);
    return {
      id: requireId(record, "id", `bundles[${index}]`),
      ...(optionalText(record, "name") !== undefined ? { name: optionalText(record, "name") } : {}),
      requirements: parseItemAmounts(draft, record.requirements ?? [], `bundles[${index}].requirements`),
      ...(record.reward !== undefined && record.reward !== null
        ? { reward: parseBundleReward(draft, record.reward, `bundles[${index}].reward`, unlockIds) }
        : {}),
    };
  });
}

function parseMakers(draft: Project, value: unknown): MakerDefinition[] {
  return asArray(value, "makers").map((entry, index) => {
    const record = asRecord(entry, `makers[${index}]`);
    const durationMinutes = optionalCount(record, "durationMinutes", `makers[${index}]`, 1);
    if (durationMinutes === undefined) {
      throw new ToolError(`makers[${index}].durationMinutes(1 이상 정수)가 필요합니다.`, { code: "invalid-args" });
    }
    return {
      id: requireId(record, "id", `makers[${index}]`),
      ...(optionalText(record, "name") !== undefined ? { name: optionalText(record, "name") } : {}),
      inputs: parseItemAmounts(draft, record.inputs ?? [], `makers[${index}].inputs`),
      outputs: parseItemAmounts(draft, record.outputs ?? [], `makers[${index}].outputs`),
      durationMinutes,
    };
  });
}

const configureLifeEconomy: ToolDefinition = {
  name: "configure_life_economy",
  description:
    "생활·경제 opt-in 블록을 저작한다: system.energy(에너지 풀)/shipping(출하 상자)/bundles(꾸러미)/worldUnlocks(지역 해금)/makers(가공 설비). "
    + "섹션은 서로 독립이라 전달한 섹션만 바뀌고 나머지는 그대로 남는다. 배열 섹션(bundles/worldUnlocks/makers)은 전달하면 그 섹션 전체 목록을 교체한다. "
    + "참조하는 itemId/switchId/recipeId/worldUnlockId 는 프로젝트에서 검증한다.",
  mode: "write",
  parameters: LIFE_ECONOMY_CONFIG_PARAMS,
  invalidArgsExample: { energy: { max: 100, initial: 100, restorePerDay: 100 }, shipping: { enabled: true, historyLimit: 30 } },
  run(draft: Project, args): ToolExecResult {
    const changed: string[] = [];
    if (args.energy !== undefined && args.energy !== null) {
      draft.system.energy = parseEnergy(args.energy);
      changed.push(`에너지 max=${draft.system.energy.max}`);
    }
    if (args.shipping !== undefined && args.shipping !== null) {
      draft.system.shipping = parseShipping(draft, args.shipping);
      changed.push(`출하 ${draft.system.shipping.enabled ? "on" : "off"}`);
    }
    if (args.worldUnlocks !== undefined && args.worldUnlocks !== null) {
      draft.system.worldUnlocks = parseWorldUnlocks(draft, args.worldUnlocks);
      changed.push(`지역 해금 ${draft.system.worldUnlocks.length}건`);
    }
    if (args.bundles !== undefined && args.bundles !== null) {
      const unlockIds = (draft.system.worldUnlocks ?? []).map((unlock) => unlock.id);
      draft.system.bundles = parseBundles(draft, args.bundles, unlockIds);
      changed.push(`꾸러미 ${draft.system.bundles.length}건`);
    }
    if (args.makers !== undefined && args.makers !== null) {
      draft.system.makers = parseMakers(draft, args.makers);
      changed.push(`가공 설비 ${draft.system.makers.length}건`);
    }
    if (changed.length === 0) {
      throw new ToolError(
        "바꿀 섹션이 없습니다. energy/shipping/bundles/worldUnlocks/makers 중 하나 이상을 전달하세요.",
        { code: "invalid-args" },
      );
    }
    return { summary: `생활·경제 설정 ${changed.join(", ")}`, data: { changed } };
  },
};

export const LIFE_ECONOMY_TOOLS: readonly ToolDefinition[] = [
  upsertCraftRecipe,
  deleteCraftRecipe,
  upsertItemUpgrade,
  setSellPrices,
  upsertToolAction,
  configureLifeEconomy,
];
