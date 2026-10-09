import { el } from "@/util/dom";
import type { Command, ItemType } from "@/project/types";
import {
  isStorageChestLayout,
  isStorageChestTemplate,
  resolveStorageChest,
  type StorageChestLayout,
  type StorageChestTemplate,
} from "@/project/storageChest";
import { segmentedSelect } from "./recordPicker";
import { databasePicker } from "./switchVariablePicker";
import { itemPicker } from "./sharedPickers";
import type { CommandEditContext } from "./types";

const STORAGE_CHEST_SCOPE_SEGMENTS = [
  { value: "local", key: "local", label: "이 상자 전용" },
  { value: "shared", key: "shared", label: "여러 상자 공유" },
] as const satisfies readonly { readonly value: "local" | "shared"; readonly key: string; readonly label: string }[];

const ITEM_TYPE_OPTIONS: readonly { readonly value: ItemType; readonly label: string }[] = [
  { value: "normalGoods", label: "일반" },
  { value: "medicine", label: "회복" },
  { value: "seed", label: "씨앗" },
  { value: "weapon", label: "무기" },
  { value: "shield", label: "방패" },
  { value: "body", label: "몸" },
  { value: "head", label: "머리" },
  { value: "accessory", label: "장신구" },
  { value: "book", label: "책" },
  { value: "special", label: "특수" },
  { value: "switch", label: "열쇠" },
];

function labeledControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "inline-field", children: [el("span", { text: label }), control] });
}

function checkbox(label: string, checked: boolean, testid: string): HTMLInputElement {
  const input = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid },
  }) as HTMLInputElement;
  input.checked = checked;
  input.setAttribute("aria-label", label);
  return input;
}

export function openChestBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "openChest" }>
): HTMLElement {
  const resolved = resolveStorageChest(cmd);
  const scope = segmentedSelect({
    options: STORAGE_CHEST_SCOPE_SEGMENTS,
    value: cmd.chestId?.trim() ? "shared" : "local",
    testid: "open-chest-scope-select",
    ariaLabel: "보관 상자 연결 방식",
  });
  const chestId = el("input", {
    class: "storage-chest-shared-id",
    attrs: {
      type: "text",
      title: "같은 이름을 사용하는 상자끼리 보관 내용을 공유합니다",
      placeholder: "예: 마을 공동 창고",
      autocomplete: "off",
      spellcheck: "false",
    },
    value: cmd.chestId ?? "",
    dataset: { testid: "open-chest-id-input" },
  }) as HTMLInputElement;
  const displayName = el("input", {
    attrs: { type: "text", placeholder: resolved.displayName, autocomplete: "off" },
    value: cmd.displayName ?? "",
    dataset: { testid: "open-chest-display-name" },
  }) as HTMLInputElement;
  const template = el("select", { dataset: { testid: "open-chest-template" } }) as HTMLSelectElement;
  template.append(
    el("option", { text: "지정 안 함 (무제한)", attrs: { value: "" } }),
    el("option", { text: "농장 상자", attrs: { value: "farm" } }),
    el("option", { text: "공동 창고", attrs: { value: "warehouse" } }),
    el("option", { text: "금고", attrs: { value: "vault" } }),
  );
  template.value = cmd.template ?? "";
  const layout = el("select", { dataset: { testid: "open-chest-layout" } }) as HTMLSelectElement;
  layout.append(
    el("option", { text: "양식 기본", attrs: { value: "" } }),
    el("option", { text: "화면 중앙", attrs: { value: "center" } }),
    el("option", { text: "화면 하단", attrs: { value: "bottom" } }),
    el("option", { text: "넓은 창", attrs: { value: "wide" } }),
  );
  layout.value = cmd.layout ?? "";
  const capacity = el("input", {
    attrs: { type: "number", min: "1", placeholder: resolved.capacity === undefined ? "무제한" : String(resolved.capacity) },
    value: cmd.capacity !== undefined ? String(cmd.capacity) : "",
    dataset: { testid: "open-chest-capacity" },
  }) as HTMLInputElement;
  const showIcons = checkbox("아이콘", resolved.showIcons, "open-chest-show-icons");
  const allowBulk = checkbox("대량 이동", resolved.allowBulk, "open-chest-allow-bulk");
  const allowSort = checkbox("정렬", resolved.allowSort, "open-chest-allow-sort");
  const showCategories = checkbox("분류 탭", resolved.showCategories, "open-chest-show-categories");
  const goldVault = checkbox("골드 금고", resolved.goldVault, "open-chest-gold-vault");
  const lockSwitchId = { current: cmd.lockSwitchId ?? "" };
  const lockSwitch = databasePicker("switch", lockSwitchId.current, (id) => {
    lockSwitchId.current = id;
    apply();
  }, "open-chest-lock-switch");
  const lockItem = itemPicker({
    selectedId: cmd.lockItemId ?? "",
    placeholder: "열쇠 아이템 없음",
    testid: "open-chest-lock-item",
  });
  const allowedWrap = el("div", {
    class: "storage-chest-allowed-types",
    dataset: { testid: "open-chest-allowed-types" },
  });
  const allowedBoxes = ITEM_TYPE_OPTIONS.map((option) => {
    const box = checkbox(option.label, (cmd.allowedItemTypes ?? []).includes(option.value), `open-chest-type-${option.value}`);
    allowedWrap.append(labeledControl(option.label, box));
    return { type: option.value, box };
  });
  const scopeHint = el("span", {
    class: "storage-chest-scope-hint",
    dataset: { testid: "open-chest-scope-hint" },
  });
  const sharedSettings = el("div", {
    class: "storage-chest-shared-settings",
    dataset: { testid: "open-chest-shared-settings" },
    children: [
      labeledControl("공유 보관함 이름", chestId),
      el("span", {
        class: "rich-form-hint",
        text: "같은 이름을 지정한 다른 상자에서도 동일한 아이템을 꺼낼 수 있습니다.",
      }),
    ],
  });
  const syncScopeUi = () => {
    const shared = scope.select.value === "shared";
    sharedSettings.dataset.active = String(shared);
    sharedSettings.setAttribute("aria-hidden", String(!shared));
    chestId.disabled = !shared;
    scopeHint.textContent = shared
      ? "마을 공동 창고처럼 여러 상자가 하나의 보관 내용을 함께 엽니다."
      : "현재 이벤트가 있는 이 상자에만 아이템을 보관합니다. 가장 간단한 설정입니다.";
  };
  const apply = () => {
    const shared = scope.select.value === "shared";
    if (shared && !chestId.value.trim()) chestId.value = "shared_storage";
    const value = shared ? chestId.value.trim() : "";
    const selectedTemplate = isStorageChestTemplate(template.value) ? template.value : undefined;
    const selectedLayout = isStorageChestLayout(layout.value) ? layout.value : undefined;
    const parsedCapacity = Number.parseInt(capacity.value, 10);
    const capacityValue = Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : undefined;
    const allowedItemTypes = allowedBoxes.filter((entry) => entry.box.checked).map((entry) => entry.type);
    const baseline = resolveStorageChest({ template: selectedTemplate });
    const next: Extract<Command, { kind: "openChest" }> = {
      kind: "openChest",
      ...(value ? { chestId: value } : {}),
      ...(displayName.value.trim() ? { displayName: displayName.value.trim() } : {}),
      ...(selectedTemplate ? { template: selectedTemplate as StorageChestTemplate } : {}),
      ...(selectedLayout && selectedLayout !== baseline.layout ? { layout: selectedLayout as StorageChestLayout } : {}),
      ...(capacityValue !== undefined && capacityValue !== baseline.capacity ? { capacity: capacityValue } : {}),
      ...(showIcons.checked !== baseline.showIcons ? { showIcons: showIcons.checked } : {}),
      ...(allowBulk.checked !== baseline.allowBulk ? { allowBulk: allowBulk.checked } : {}),
      ...(allowSort.checked !== baseline.allowSort ? { allowSort: allowSort.checked } : {}),
      ...(showCategories.checked !== baseline.showCategories ? { showCategories: showCategories.checked } : {}),
      ...(goldVault.checked !== baseline.goldVault ? { goldVault: goldVault.checked } : {}),
      ...(lockSwitchId.current.trim() ? { lockSwitchId: lockSwitchId.current.trim() } : {}),
      ...(lockItem.select.value.trim() ? { lockItemId: lockItem.select.value.trim() } : {}),
      ...(allowedItemTypes.length > 0 ? { allowedItemTypes } : {}),
    };
    context.actions.replaceCommand(context.path, next);
  };
  scope.select.addEventListener("change", () => {
    syncScopeUi();
    apply();
  });
  chestId.addEventListener("change", apply);
  chestId.addEventListener("input", apply);
  displayName.addEventListener("change", apply);
  displayName.addEventListener("input", apply);
  template.addEventListener("change", apply);
  layout.addEventListener("change", apply);
  capacity.addEventListener("change", apply);
  lockItem.select.addEventListener("change", apply);
  for (const control of [showIcons, allowBulk, allowSort, showCategories, goldVault]) {
    control.addEventListener("change", apply);
  }
  for (const entry of allowedBoxes) entry.box.addEventListener("change", apply);
  syncScopeUi();
  const wrap = el("div", {
    class: "rich-command-form cream-command-form storage-chest-command-body",
    dataset: { testid: "open-chest-command-body" },
  });
  wrap.append(
    el("div", {
      class: "storage-chest-purpose-card",
      dataset: { testid: "open-chest-purpose-card" },
      children: [
        el("span", {
          class: "storage-chest-glyph",
          attrs: { "aria-hidden": "true" },
          children: [
            el("span", { class: "storage-chest-glyph-lid" }),
            el("span", { class: "storage-chest-glyph-body" }),
          ],
        }),
        el("span", {
          class: "storage-chest-purpose-copy",
          children: [
            el("strong", { text: "아이템을 맡기고 다시 찾는 상자" }),
            el("span", { text: "플레이어가 소지품을 넣고 다시 꺼낼 수 있습니다." }),
          ],
        }),
        el("span", { class: "storage-chest-purpose-badge", text: "입출고" }),
      ],
    }),
    el("div", {
      class: "storage-chest-scope-section",
      children: [
        el("strong", { class: "storage-chest-section-label", text: "보관 내용 연결" }),
        scope.root,
        scopeHint,
      ],
    }),
    sharedSettings,
    labeledControl("표시 이름", displayName),
    labeledControl("상자 양식", template),
    labeledControl("창 배치", layout),
    labeledControl("칸 수", capacity),
    el("div", {
      class: "storage-chest-toggles",
      children: [
        labeledControl("아이콘", showIcons),
        labeledControl("대량 이동", allowBulk),
        labeledControl("정렬", allowSort),
        labeledControl("분류 탭", showCategories),
        labeledControl("골드 금고", goldVault),
      ],
    }),
    labeledControl("잠금 스위치", lockSwitch),
    labeledControl("잠금 아이템", lockItem.root),
    el("div", {
      class: "storage-chest-types-section",
      children: [
        el("strong", { class: "storage-chest-section-label", text: "넣을 수 있는 종류" }),
        allowedWrap,
      ],
    }),
    el("div", {
      class: "storage-chest-treasure-note",
      children: [
        el("strong", { text: "아이템을 바로 주는 보물상자와는 다릅니다." }),
        el("span", { text: "한 번 지급하는 상자는 ‘아이템 변경’ 명령으로 만드세요." }),
      ],
    }),
  );
  return wrap;
}
