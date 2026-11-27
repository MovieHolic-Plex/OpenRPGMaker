import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { newCommand } from "@/editor/eventCommandFactory";
import {
  INN_CANCELLED_BRANCH_INDEX,
  INN_NOT_ENOUGH_BRANCH_INDEX,
  INN_STAYED_BRANCH_INDEX,
  resolveCommandAtPath,
  resolveCommandListAtPath,
  SHOP_FAILED_TRANSACTION_BRANCH_INDEX, SHOP_TRANSACTION_BRANCH_INDEX,
} from "@/editor/eventCommandPaths";
import { commandSummary, commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import type { JsonSchema } from "@/editor/tools/types";
import { craftShopRecipeIds } from "@/project/craftShop";
import { GOLD_MAX } from "@/project/economyValues";
import { EventCommandEditError, eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { resolveStorageChest, STORAGE_CHEST_LAYOUTS, STORAGE_CHEST_TEMPLATES } from "@/project/storageChest";
import type { Command, EventPage, Project, VariableOperand } from "@/project/types";
import { roJosa } from "@/util/josa";
import { displayText } from "../../target";
import { commandListAt, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "04-cmd-items-shops";

type Args = Record<string, unknown>;
type Mode = "insert" | "update";
type Fields = Record<string, JsonSchema>;

const text = (description: string): JsonSchema => ({ type: "string", description });
const flag = (description: string): JsonSchema => ({ type: "boolean", description });
const integer = (description: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): JsonSchema => ({
  type: "integer", description, minimum, maximum,
});
const choice = (description: string, ...values: string[]): JsonSchema => ({ ...text(description), enum: values });
const ids = (description: string): JsonSchema => ({
  type: "array", description, items: { type: "string", minLength: 1 },
});

const amountFields = {
  op: choice("더하기(+=), 빼기(-=), 이 값으로 설정(=)", "+=", "-=", "="),
  amount: integer("골드", 0, GOLD_MAX),
  amountVariableId: text("숫자 대신 수량을 읽을 변수의 식별자"),
};
const resultVariableId = text("성공이면 1, 실패면 0을 기록할 변수의 식별자. 빈 문자열로 기록을 해제합니다.");

const specs = {
  changeGold: { name: "소지금 변경", fields: amountFields },
  changeItem: {
    name: "아이템 수량",
    fields: { ...amountFields, amount: integer("아이템 수량", 0, ITEM_QUANTITY_MAX), itemId: text("수량을 바꿀 아이템 또는 장비의 식별자") },
    required: ["itemId"],
  },
  craftRecipe: {
    name: "아이템 제작",
    fields: { recipeId: text("실행할 제작법의 식별자"), resultVariableId },
    required: ["recipeId"],
  },
  applyItemUpgrade: {
    name: "아이템 강화",
    fields: { upgradeId: text("적용할 강화 규칙의 식별자"), resultVariableId },
    required: ["upgradeId"],
  },
  equipTool: {
    name: "도구 장착",
    fields: { itemId: text("장착할 도구 아이템의 식별자. 빈 문자열로 장착을 해제합니다.") },
    required: ["itemId"],
  },
  openCraftShop: {
    name: "제작 공방",
    fields: {
      recipeIds: {
        ...ids("진열할 제작법을 표시 순서대로 하나 이상 지정합니다. null을 보내거나 새 공방에서 생략하면 모든 제작법을 표시합니다."),
        type: ["array", "null"],
      },
      title: text("공방 이름"),
      speaker: text("공방 주인 이름"),
    },
  },
  openChest: {
    name: "보관 상자",
    fields: {
      chestId: text("상자끼리 보관 내용을 공유할 때 쓰는 이름입니다. 새 상자에만 지정할 수 있고, 비우면 현재 위치의 상자를 엽니다."),
      displayName: text("상자 창에 표시할 이름"),
      template: choice("상자 양식: 농장, 창고, 금고", ...STORAGE_CHEST_TEMPLATES),
      layout: choice("창 위치: 중앙, 하단, 넓은 창", ...STORAGE_CHEST_LAYOUTS),
      capacity: integer("서로 다른 물건을 보관할 칸 수", 1),
      showIcons: flag("물건 아이콘을 표시할지 여부"),
      allowBulk: flag("여러 물건을 한꺼번에 옮길 수 있는지 여부"),
      allowSort: flag("상자 정렬을 허용할지 여부"),
      showCategories: flag("물건 종류별 탭을 표시할지 여부"),
      goldVault: flag("골드를 보관할 수 있는지 여부"),
      lockSwitchId: text("켜져 있어야 열리는 스위치의 식별자. 빈 문자열로 해제합니다."),
      lockItemId: text("열 때 필요한 아이템의 식별자. 빈 문자열로 해제합니다."),
      allowedItemTypes: ids("보관을 허용할 아이템 분류 목록. 빈 목록이면 모든 분류를 허용합니다."),
    },
  },
  shop: {
    name: "상점",
    fields: {
      itemIds: ids("진열할 아이템과 장비 전체의 식별자 목록"),
      title: text("상점 창에 표시할 이름"),
      allowSell: flag("손님이 물건을 팔 수 있게 할지 여부"),
      quantityMode: choice("구매 수량: 한 개씩, 수량 선택", "single", "select"),
      shopType: choice("손님이 사고팔기, 사기만, 팔기만", "normal", "buyOnly", "sellOnly"),
      merchantGold: integer("상인이 손님 물건을 살 때 쓸 소지금", 0, 999999),
    },
  },
  inn: {
    name: "여관",
    fields: {
      price: integer("숙박 요금. 무료는 0골드", 0, 999999),
      priceVariableId: text("숙박 요금을 읽을 변수의 식별자"),
      note: text("여관 인사말"),
      question: text("묵을지 물어볼 문구"),
      recoverMp: flag("체력과 함께 마력을 회복할지 여부"),
      advanceToMorning: flag("숙박한 뒤 아침으로 시간을 옮길지 여부"),
      restDurationMs: integer("휴식 암전 시간(밀리초)", 0, 10000),
      wakeDurationMs: integer("기상 안내 시간(밀리초)", 0, 10000),
    },
  },
} satisfies Record<string, { name: string; fields: Fields; required?: string[] }>;

type Kind = keyof typeof specs;
type EconomyCommand = Extract<Command, { kind: Kind }>;

const updateShopFields = {
  addItemId: text("기존 진열을 유지하며 추가할 아이템 또는 장비의 식별자"),
  removeItemId: text("기존 진열에서 뺄 아이템 또는 장비의 식별자"),
};

function replaceOperand(patch: Args, args: Args, valueKey: string, variableKey: string): void {
  if (args[variableKey] === undefined) return;
  if (args[valueKey] !== undefined) throw new PrimitiveError("숫자와 값을 읽을 변수 중 하나만 지정해 주세요.");
  patch[valueKey] = { kind: "var", id: args[variableKey] };
}

function shopItemIds(command: Extract<Command, { kind: "shop" }>): Set<string> {
  // 예전 명령에는 stock에만 있는 상품도 있으므로 이미 진열된 상품에 포함한다.
  return new Set([...command.itemIds, ...(command.stock?.map(row => row.itemId) ?? [])]);
}

function shopPatch(current: Extract<Command, { kind: "shop" }>, patch: Args, args: Args): void {
  const { allowSell, shopType, addItemId, removeItemId } = args;
  // 런타임이 우선하는 거래 방식과 구 저장본의 판매 설정을 함께 맞춘다.
  if (typeof allowSell === "boolean") {
    const type = shopType ?? (allowSell ? (current.shopType === "sellOnly" ? "sellOnly" : "normal") : "buyOnly");
    if ((type !== "buyOnly") !== allowSell) throw new PrimitiveError("거래 방식과 판매 허용 여부가 서로 맞지 않습니다.");
    patch.shopType = type;
  } else if (shopType !== undefined && current.allowSell !== undefined) {
    patch.allowSell = shopType !== "buyOnly";
  }

  const replacement = patch.itemIds as string[] | undefined;
  if (replacement === undefined && addItemId === undefined && removeItemId === undefined) return;
  if (replacement !== undefined && (addItemId !== undefined || removeItemId !== undefined)) {
    throw new PrimitiveError("진열 전체 교체와 상품 추가·삭제 중 하나를 골라 주세요.");
  }
  if (addItemId !== undefined && addItemId === removeItemId) {
    throw new PrimitiveError("같은 물건을 동시에 넣고 뺄 수 없습니다.");
  }
  const { stock } = current;
  const displayedIds = shopItemIds(current);
  if (typeof addItemId === "string" && displayedIds.has(addItemId)) {
    throw new PrimitiveError("이미 진열된 상품입니다. 추가할 다른 상품을 골라 주세요.");
  }
  if (typeof removeItemId === "string" && !displayedIds.has(removeItemId)) {
    throw new PrimitiveError("현재 상점에 진열된 물건만 뺄 수 있습니다.");
  }
  if (typeof removeItemId === "string") displayedIds.delete(removeItemId);
  if (typeof addItemId === "string") displayedIds.add(addItemId);
  const itemIds = [...(replacement === undefined ? displayedIds : new Set(replacement))];
  patch.itemIds = itemIds;
  if (!stock) return;
  // 게임은 stock이 있으면 그 목록을 읽으므로 기본 가격 상품에도 행을 채운다.
  if (replacement !== undefined) {
    patch.stock = itemIds.flatMap(itemId => {
      const rows = stock.filter(row => row.itemId === itemId);
      return rows.length ? rows : [{ itemId }];
    });
  } else {
    const retained = stock.filter(row => displayedIds.has(row.itemId));
    const stocked = new Set(retained.map(row => row.itemId));
    patch.stock = [...retained, ...itemIds.filter(itemId => !stocked.has(itemId)).map(itemId => ({ itemId }))];
  }
}

function editedCommand(current: EconomyCommand, mode: Mode, args: Args) {
  // 편집할 수 있는 필드만 골라 저장한다. 분기·대상 선택·위치 인자는 명령에 들어갈 수 없다.
  const patch = Object.fromEntries(Object.keys(specs[current.kind].fields)
    .filter(key => Object.hasOwn(args, key) && key !== "amountVariableId" && key !== "priceVariableId")
    .map(key => [key, args[key]]));
  if (current.kind === "changeGold" || current.kind === "changeItem") replaceOperand(patch, args, "amount", "amountVariableId");
  if (current.kind === "inn") replaceOperand(patch, args, "price", "priceVariableId");
  if (patch.resultVariableId === "") patch.resultVariableId = undefined;
  for (const key of ["lockSwitchId", "lockItemId"]) {
    const value = patch[key];
    if (typeof value === "string") patch[key] = value.trim() || undefined;
  }
  if (current.kind === "openCraftShop") {
    if (args.recipeIds === null) patch.recipeIds = undefined;
    if (Array.isArray(args.recipeIds)) patch.recipeIds = [...new Set(args.recipeIds)];
  }
  if (current.kind === "openChest" && typeof args.chestId === "string") {
    const chestId = args.chestId.trim();
    if (Object.hasOwn(Object.prototype, chestId)) {
      throw new PrimitiveError("공유 보관함에 쓸 수 없는 이름입니다. 다른 이름을 입력해 주세요.");
    }
    if (mode === "update" && chestId !== (current.chestId ?? "").trim()) {
      throw new PrimitiveError("기존 물건을 계속 꺼낼 수 있도록 연결된 보관함을 유지해 주세요. 화면에 보이는 이름은 바꿀 수 있습니다.");
    }
    patch.chestId = chestId;
  }
  if (current.kind === "shop") shopPatch(current, patch, args);
  return { patch, command: { ...current, ...patch } as EconomyCommand };
}

function recordIds(records: readonly { id: string }[] | undefined): Set<string> {
  return new Set(records?.map(({ id }) => id));
}

function validateReferences(project: Project, command: EconomyCommand, args: Args): void {
  const itemIds = recordIds(project.database.items);
  const equipmentIds = recordIds(project.database.equipment);
  const variableIds = recordIds(project.variables);
  // 이 명령군의 직접 참조를 검사한다. 기존 분기 본문은 이번 한 줄 편집의 소유가 아니다.
  const none = new Set<string>();
  const context: ReferenceContext = {
    itemIds, equipmentIds, variableIds, actorIds: none, classIds: none, enemyIds: none, skillIds: none,
    animationIds: none, switchIds: none, commonEventIds: none, endingIds: none, mapIds: none,
    troopIds: none, speciesIds: none, resourceIds: none,
  };
  const row = command.kind === "shop" ? { ...command, transactionBranch: [], failedTransactionBranch: [] }
    : command.kind === "inn" ? { ...command, stayedBranch: [], cancelledBranch: [], notEnoughBranch: [] } : command;
  try {
    validateCommands([row], context);
  } catch {
    if (command.kind === "changeGold") throw new PrimitiveError("수량을 읽을 변수를 찾을 수 없습니다.");
    if (command.kind === "inn") throw new PrimitiveError("숙박 요금을 읽을 변수를 찾을 수 없습니다.");
    if (command.kind === "craftRecipe" || command.kind === "applyItemUpgrade") {
      throw new PrimitiveError("결과를 기록할 변수를 찾을 수 없습니다.");
    }
    throw new PrimitiveError("지정한 물건이나 변수를 자료집에서 찾을 수 없습니다.");
  }

  const recipes = project.system.craftRecipes ?? [];
  const hasRecipe = (id: string) => recipes.some(recipe => recipe.id === id);
  if (command.kind === "craftRecipe" && !hasRecipe(command.recipeId)
    || command.kind === "openCraftShop" && command.recipeIds?.some(id => !hasRecipe(id))) {
    throw new PrimitiveError("지정한 제작법을 찾을 수 없습니다.");
  }
  if (command.kind === "openCraftShop" && craftShopRecipeIds(project, command).length === 0) {
    throw new PrimitiveError("제작 공방을 열려면 보여 줄 제작법이 하나 이상 필요합니다.");
  }
  if (command.kind === "applyItemUpgrade" && !project.system.itemUpgrades?.some(rule => rule.id === command.upgradeId)) {
    throw new PrimitiveError("지정한 강화 규칙을 찾을 수 없습니다.");
  }
  if (command.kind === "equipTool" && command.itemId && !itemIds.has(command.itemId)) {
    throw new PrimitiveError("장착할 도구를 자료집에서 찾을 수 없습니다.");
  }
  if (command.kind === "openChest") {
    const { lockSwitchId, lockItemId, allowedItemTypes } = resolveStorageChest(command);
    if (lockSwitchId && !project.switches.some(row => row.id === lockSwitchId)) {
      throw new PrimitiveError("상자를 여는 스위치를 찾을 수 없습니다.");
    }
    if (lockItemId && !itemIds.has(lockItemId)) {
      throw new PrimitiveError("상자를 여는 아이템을 찾을 수 없습니다.");
    }
    if (Array.isArray(args.allowedItemTypes) && allowedItemTypes.length !== args.allowedItemTypes.length) {
      throw new PrimitiveError("보관을 허용할 아이템 분류를 다시 골라 주세요.");
    }
  }
  if (command.kind === "inn" && typeof command.price !== "number" && !variableIds.has(command.price.id)) {
    throw new PrimitiveError("숙박 요금을 읽을 변수를 찾을 수 없습니다.");
  }
}

function safeName(value: string | undefined, fallback: string): string {
  return displayText(value ?? "", fallback).replace(/[\r\n.!?{}\[\]]/gu, "").trim() || fallback;
}

function describeCommand(project: Project, command: EconomyCommand, args: Args): string {
  const itemName = (id: string) => {
    const item = project.database.items.find(row => row.id === id) ?? project.database.equipment.find(row => row.id === id);
    return safeName(item?.name === id ? undefined : item?.name, "아이템");
  };
  const amountName = (value: VariableOperand, unit: string) => {
    if (typeof value === "number") return `${value}${unit}`;
    const name = project.variables.find(row => row.id === value.id)?.name;
    const variableName = safeName(name === value.id ? undefined : name, "");
    return variableName ? `변수 「${variableName}」의 값` : "지정한 변수의 값";
  };
  switch (command.kind) {
    case "changeGold":
    case "changeItem": {
      // 연산 표시 문구는 이벤트 편집기와 공유한다.
      const operation = commandSummaryParts({ kind: "changeGold", op: command.op, amount: 0 })
        .find(part => part.tone.startsWith("op-"))?.text;
      const name = command.kind === "changeItem" ? itemName(command.itemId) : "소지금";
      const amount = amountName(command.amount, command.kind === "changeGold" ? "골드" : "개");
      if (command.op === "=") return `${name} ${amount}${roJosa(amount)} 설정`;
      return `${name} ${amount} ${operation ?? "변경"}`;
    }
    case "craftRecipe": {
      const recipe = project.system.craftRecipes?.find(row => row.id === command.recipeId);
      const name = safeName(recipe?.name === command.recipeId ? undefined : recipe?.name, recipe ? itemName(recipe.outputItemId) : "지정한 아이템");
      return `${name} 제작`;
    }
    case "applyItemUpgrade": {
      const rule = project.system.itemUpgrades?.find(row => row.id === command.upgradeId);
      return rule ? `${itemName(rule.fromItemId)}에서 ${itemName(rule.toItemId)}로 강화` : "아이템 강화";
    }
    case "equipTool":
      return command.itemId ? `${itemName(command.itemId)} 장착` : "도구 장착 해제";
    case "openCraftShop": {
      const name = safeName(command.title || command.speaker, "제작 공방");
      const details = command.recipeIds === undefined ? "모든 제작법" : `제작법 ${command.recipeIds.length}개`;
      return `${name} 열기 · ${details}`;
    }
    case "openChest": {
      const { capacity, displayName } = resolveStorageChest(command);
      const name = safeName(displayName, "보관 상자");
      return capacity === undefined ? `${name} 열기` : `${name} 열기 · ${capacity}칸`;
    }
    case "shop": {
      const name = safeName(command.title, "상점");
      if (typeof args.addItemId === "string" && typeof args.removeItemId === "string") {
        return `${name}에서 ${itemName(args.removeItemId)} 대신 ${itemName(args.addItemId)} 진열`;
      }
      if (typeof args.addItemId === "string") return `${name}에 ${itemName(args.addItemId)} 진열`;
      if (typeof args.removeItemId === "string") return `${name}에서 ${itemName(args.removeItemId)} 빼기`;
      return commandSummary({ ...command, itemIds: [...shopItemIds(command)] })
        .replace(/^상점: /u, () => `${name} 열기 · 상품 `).replace(/·(\d+)G$/u, " · 상인 소지금 $1골드");
    }
    case "inn": {
      // 숫자 요금과 회복·기상 표시는 기존 요약의 표현을 사용한다.
      const { price } = command;
      const details = commandSummary({ ...command, price: typeof price === "number" ? price : 0 })
        .replace(": ", " 숙박 · ").replace(/(\d+)G/u, "$1골드").replace("HP만", "체력만 회복")
        .replace("부족분기", "골드가 모자랄 때 분기");
      return typeof price === "number" ? details : details.replace("무료", () => `요금은 ${amountName(price, "골드")}`);
    }
  }
}

function assertActiveShopInnBranches(page: EventPage, branchPath: readonly number[]): void {
  if (branchPath.length % 2 !== 0) return;
  for (let offset = 1; offset < branchPath.length; offset += 2) {
    const parent = resolveCommandAtPath(page.commands, branchPath.slice(0, offset));
    const branch = branchPath[offset];
    if (
      (parent?.kind === "shop" && branch === SHOP_TRANSACTION_BRANCH_INDEX && parent.branchOnTransaction !== true)
      || (parent?.kind === "shop" && branch === SHOP_FAILED_TRANSACTION_BRANCH_INDEX && parent.branchOnFailedTransaction !== true)
      || (parent?.kind === "inn" && branch === INN_STAYED_BRANCH_INDEX && parent.branchOnStay !== true)
      || (parent?.kind === "inn" && branch === INN_CANCELLED_BRANCH_INDEX && parent.branchOnCancel !== true)
      || (parent?.kind === "inn" && branch === INN_NOT_ENOUGH_BRANCH_INDEX && parent.branchOnNotEnoughGold !== true)
    ) {
      throw new PrimitiveError("꺼져 있는 상점·여관 분기의 명령은 추가하거나 수정할 수 없습니다.");
    }
  }
}

function pageWithInsertBranch(page: EventPage, branchPath: readonly number[]): EventPage {
  if (branchPath.length === 0 || branchPath.length % 2 !== 0) return page;
  const path = [...branchPath, 0];
  if (resolveCommandListAtPath(page.commands, path)) return page;
  const parent = resolveCommandAtPath(page.commands, branchPath.slice(0, -1));
  // 켜져 있지만 배열이 아직 저장되지 않은 분기도 명령 목록에는 표시된다.
  if (!parent || !eventCommandBranches(parent).some(branch => branch.branchIndex === branchPath.at(-1))) return page;
  const commands = structuredClone(page.commands);
  if (!resolveCommandListAtPath(commands, path, { missingBranches: "create" })) return page;
  return { ...page, commands };
}

function createPrimitive(kind: Kind, mode: Mode): SmallTaskPrimitive {
  const spec: { name: string; fields: Fields; required?: string[] } = specs[kind];
  const verb = mode === "insert" ? "추가" : "수정";
  function prepare(ctx: PrimitiveContext, args: Args) {
    const { page: selectedPage } = scopedPage(ctx);
    const branch = (args.branchPath ?? []) as number[];
    assertActiveShopInnBranches(selectedPage, branch);
    const page = mode === "insert" ? pageWithInsertBranch(selectedPage, branch) : selectedPage;
    const list = commandListAt(page, branch);
    const row = (args.index ?? list.length) as number;
    const index = [...branch, row];
    const current = mode === "insert" ? newCommand(kind) : list[row];
    if (current?.kind !== kind) throw new PrimitiveError(`선택한 줄에서 ${spec.name} 명령을 찾을 수 없습니다.`);
    if (mode === "update" && eventCommandHash(current) !== args.expectedHash) throw new PrimitiveError(STALE_COMMAND_LIST);
    return { page, index, ...editedCommand(current, mode, args) };
  }
  return {
    id: `cmd.${kind}.${mode}`,
    unit: UNIT,
    title: `${spec.name} ${verb}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      additionalProperties: false,
      properties: {
        index: integer(mode === "insert" ? "앞에 삽입할 줄 번호. 첫 줄은 0이며, 생략하면 목록 끝에 추가합니다." : "수정할 줄 번호. 첫 줄은 0입니다."),
        branchPath: {
          type: "array", description: "get_event에서 읽은 분기 경로입니다. 줄 번호와 분기 번호를 한 쌍씩 나열합니다. 분기 밖의 줄이면 생략합니다.",
          items: { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },
        },
        ...(mode === "update" ? {
          expectedHash: {
            ...text("get_event에서 includeCommandHashes를 켜고 읽은 해당 줄의 변경 확인값(hash)입니다."),
            minLength: 1,
          },
        } : {}),
        ...spec.fields,
        ...(mode === "update" && kind === "shop" ? updateShopFields : {}),
      },
      required: mode === "insert" ? spec.required : ["index", "expectedHash"],
    },
    scope(ctx) {
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { command } = prepare(ctx, args);
      const detail = describeCommand(ctx.project, command, args);
      const suffix = ` 명령을 ${verb}합니다.`;
      const limit = 80 - suffix.length;
      return `${detail.length > limit ? detail.slice(0, limit - 1) + "…" : detail}${suffix}`;
    },
    apply(ctx, args) {
      const { page, index, patch, command } = prepare(ctx, args);
      if (mode === "update" && Object.keys(patch).length === 0) {
        throw new PrimitiveError("고칠 내용을 하나 이상 입력해 주세요.");
      }
      validateReferences(ctx.project, command, args);
      try {
        return updateScopedPage(ctx, () => mode === "insert" ? insertEventCommand(page, index, command)
          : updateEventCommand(page, index, patch, args.expectedHash as string));
      } catch (error) {
        if (!(error instanceof EventCommandEditError) || error.code === "stale-event-command") throw error;
        throw new PrimitiveError("명령의 줄 위치나 입력값을 다시 확인하세요.");
      }
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] =
  (Object.keys(specs) as Kind[]).flatMap(kind => [createPrimitive(kind, "insert"), createPrimitive(kind, "update")]);
