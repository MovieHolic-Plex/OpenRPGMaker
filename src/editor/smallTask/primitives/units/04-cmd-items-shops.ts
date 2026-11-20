import { newCommand } from "@/editor/eventCommandFactory";
import { commandSummary, commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import type { JsonSchema } from "@/editor/tools/types";
import { GOLD_MAX } from "@/project/economyValues";
import { EventCommandEditError, eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import type { Command, Project, VariableOperand } from "@/project/types";
import { displayText } from "../../target";
import { commandListAt, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
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
  amountVariableId: text("수량을 읽을 변수의 식별자"),
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
      recipeIds: ids("진열할 제작법의 식별자 목록. 새 공방에서 생략하면 모든 제작법을 표시합니다."),
      title: text("공방 이름"),
      speaker: text("공방 주인 이름"),
    },
  },
  openChest: {
    name: "보관 상자",
    fields: {
      chestId: text("상자끼리 인벤토리를 공유할 때 쓸 이름표. 빈 문자열이면 현재 위치의 상자를 엽니다."),
      displayName: text("상자 창에 표시할 이름"),
      template: choice("상자 양식: 농장, 창고, 금고", "farm", "warehouse", "vault"),
      layout: choice("창 위치: 중앙, 하단, 넓은 창", "center", "bottom", "wide"),
      capacity: integer("서로 다른 물건을 보관할 칸 수", 1),
      showIcons: flag("물건 아이콘을 표시할지 여부"),
      allowBulk: flag("여러 물건을 한꺼번에 옮길 수 있는지 여부"),
      allowSort: flag("상자 정렬을 허용할지 여부"),
      showCategories: flag("물건 종류별 탭을 표시할지 여부"),
      goldVault: flag("골드를 보관할 수 있는지 여부"),
      lockSwitchId: text("켜져 있어야 열리는 스위치의 식별자. 빈 문자열로 해제합니다."),
      lockItemId: text("열 때 필요한 아이템의 식별자. 빈 문자열로 해제합니다."),
      allowedItemTypes: ids("보관을 허용할 아이템 분류 목록"),
    },
  },
  shop: {
    name: "상점",
    fields: {
      itemIds: ids("진열할 아이템과 장비 전체의 식별자 목록"),
      title: text("상점 창에 표시할 이름"),
      allowSell: flag("손님이 물건을 팔 수 있게 할지 여부"),
      quantityMode: choice("구매 수량: 한 개씩, 수량 선택", "single", "select"),
      shopType: choice("거래 방식: 양방향, 구매 전용, 판매 전용", "normal", "buyOnly", "sellOnly"),
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
  if (args[valueKey] !== undefined) throw new PrimitiveError("숫자와 수량을 읽을 변수 중 하나만 지정하세요.");
  patch[valueKey] = { kind: "var", id: args[variableKey] };
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
  if (replacement !== undefined) {
    const itemIds = [...new Set(replacement)];
    patch.itemIds = itemIds;
    if (stock) {
      patch.stock = itemIds.flatMap(itemId => {
        const old = stock.filter(row => row.itemId === itemId);
        return old.length ? old : [{ itemId }];
      });
    }
    return;
  }

  const itemIds = current.itemIds.filter(id => id !== removeItemId);
  if (typeof addItemId === "string" && !itemIds.includes(addItemId)) itemIds.push(addItemId);
  patch.itemIds = itemIds;
  if (stock) {
    // 기존 재고 행의 순서와 계절·가격·그림 설정을 유지한다.
    const rows = stock.filter(row => row.itemId !== removeItemId);
    if (typeof addItemId === "string" && !rows.some(row => row.itemId === addItemId)) rows.push({ itemId: addItemId });
    patch.stock = rows;
  }
}

function editedCommand(kind: Kind, current: EconomyCommand, args: Args) {
  // 편집할 수 있는 필드만 골라 저장한다. 분기·대상 선택·위치 인자는 명령에 들어갈 수 없다.
  const patch = Object.fromEntries(Object.keys(specs[kind].fields)
    .filter(key => Object.hasOwn(args, key) && key !== "amountVariableId" && key !== "priceVariableId")
    .map(key => [key, args[key]]));
  replaceOperand(patch, args, "amount", "amountVariableId");
  replaceOperand(patch, args, "price", "priceVariableId");
  for (const key of ["resultVariableId", "lockSwitchId", "lockItemId"]) {
    if (patch[key] === "") patch[key] = undefined;
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
    : command.kind === "inn" ? { ...command, notEnoughBranch: [] } : command;
  try {
    validateCommands([row], context);
  } catch {
    if (command.kind === "changeGold") throw new PrimitiveError("수량을 읽을 변수를 찾을 수 없습니다.");
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
  if (command.kind === "applyItemUpgrade" && !project.system.itemUpgrades?.some(rule => rule.id === command.upgradeId)) {
    throw new PrimitiveError("지정한 강화 규칙을 찾을 수 없습니다.");
  }
  if (command.kind === "equipTool" && command.itemId && !itemIds.has(command.itemId)) {
    throw new PrimitiveError("장착할 도구를 자료집에서 찾을 수 없습니다.");
  }
  if (command.kind === "openChest") {
    if (command.lockSwitchId && !project.switches.some(row => row.id === command.lockSwitchId)) {
      throw new PrimitiveError("상자를 여는 스위치를 찾을 수 없습니다.");
    }
    if (command.lockItemId && !itemIds.has(command.lockItemId)) {
      throw new PrimitiveError("상자를 여는 아이템을 찾을 수 없습니다.");
    }
  }
  if (command.kind === "inn" && typeof command.price !== "number" && !variableIds.has(command.price.id)) {
    throw new PrimitiveError("숙박 요금을 읽을 변수를 찾을 수 없습니다.");
  }
  if (command.kind === "shop" && typeof args.removeItemId === "string"
    && !itemIds.has(args.removeItemId) && !equipmentIds.has(args.removeItemId)) {
    throw new PrimitiveError("진열에서 뺄 물건을 찾을 수 없습니다.");
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
    return `변수 「${safeName(name === value.id ? undefined : name, "지정한 변수")}」의 값`;
  };
  switch (command.kind) {
    case "changeGold":
    case "changeItem": {
      // 연산 표시 문구는 이벤트 편집기와 공유한다.
      const operation = commandSummaryParts({ kind: "changeGold", op: command.op, amount: 0 })
        .find(part => part.tone.startsWith("op-"))?.text;
      const name = command.kind === "changeItem" ? itemName(command.itemId) : "소지금";
      return `${name} ${amountName(command.amount, command.kind === "changeGold" ? "골드" : "개")} ${operation ?? "변경"}`;
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
      const summary = commandSummary({ ...command, chestId: undefined, displayName: safeName(command.displayName, "") })
        .replace(": ", " 열기 · ");
      return command.capacity === undefined ? summary : `${summary} · ${command.capacity}칸`;
    }
    case "shop": {
      const name = safeName(command.title, "상점");
      if (typeof args.addItemId === "string" && typeof args.removeItemId === "string") {
        return `${name}에서 ${itemName(args.removeItemId)} 대신 ${itemName(args.addItemId)} 진열`;
      }
      if (typeof args.addItemId === "string") return `${name}에 ${itemName(args.addItemId)} 진열`;
      if (typeof args.removeItemId === "string") return `${name}에서 ${itemName(args.removeItemId)} 빼기`;
      return commandSummary({ ...command, itemIds: command.stock?.map(row => row.itemId) ?? command.itemIds })
        .replace(/^상점: /u, () => `${name} 열기 · 상품 `).replace(/·(\d+)G$/u, " · 상인 소지금 $1골드");
    }
    case "inn": {
      // 숫자 요금과 회복·기상 표시는 기존 요약의 표현을 사용한다.
      const details = commandSummary({ ...command, price: typeof command.price === "number" ? command.price : 0 })
        .replace(": ", " 숙박 · ").replace(/(\d+)G/u, "$1골드").replace("HP만", "체력만 회복");
      return typeof command.price === "number" ? details : details.replace("무료", amountName(command.price, "골드"));
    }
  }
}

function createPrimitive(kind: Kind, mode: Mode): SmallTaskPrimitive {
  const spec: { name: string; fields: Fields; required?: string[] } = specs[kind];
  const verb = mode === "insert" ? "추가" : "수정";
  function prepare(ctx: PrimitiveContext, args: Args) {
    const { page } = scopedPage(ctx);
    const branch = (args.branchPath ?? []) as number[];
    const list = commandListAt(page, branch);
    const row = (args.index ?? list.length) as number;
    const index = [...branch, row];
    const current = mode === "insert" ? newCommand(kind) : list[row];
    if (current?.kind !== kind) throw new PrimitiveError(`선택한 줄에서 ${spec.name} 명령을 찾을 수 없습니다.`);
    return { index, current, ...editedCommand(kind, current, args) };
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
          type: "array", description: "페이지 안에서 분기를 선택할 때 줄 번호와 분기 번호를 순서대로 나열합니다.",
          items: { type: "integer" },
        },
        ...(mode === "update" ? { expectedHash: text("줄을 읽을 때 확인한 변경 확인값") } : {}),
        ...spec.fields,
        ...(mode === "update" && kind === "shop" ? updateShopFields : {}),
      },
      required: mode === "insert" ? spec.required : ["index"],
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
      const { index, current, patch, command } = prepare(ctx, args);
      validateReferences(ctx.project, command, args);
      try {
        return updateScopedPage(ctx, page => mode === "insert" ? insertEventCommand(page, index, command)
          : updateEventCommand(page, index, patch, (args.expectedHash as string | undefined) ?? eventCommandHash(current)));
      } catch (error) {
        if (!(error instanceof EventCommandEditError)) throw error;
        if (error.code === "stale-event-command") throw new PrimitiveError(error.message);
        throw new PrimitiveError("명령의 줄 위치나 입력값을 다시 확인하세요.");
      }
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] =
  (Object.keys(specs) as Kind[]).flatMap(kind => [createPrimitive(kind, "insert"), createPrimitive(kind, "update")]);
