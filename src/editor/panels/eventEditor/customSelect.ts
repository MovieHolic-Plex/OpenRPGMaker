const SKIP_SELECT_CLASSES = [
  "rich-native-select",
  "shop-processing-native-select",
  "record-browser-hidden-select",
] as const;

const SEARCH_THRESHOLD = 9;
const TYPEAHEAD_RESET_MS = 650;

export type EventEditorCustomSelectController = {
  refresh(): void;
  dispose(): void;
};

type SelectInstance = {
  readonly select: HTMLSelectElement;
  readonly root: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly valueLabel: HTMLElement;
  readonly previousAriaHidden: string | null;
  readonly previousTabIndex: string | null;
  sync(): void;
  destroy(): void;
};

type MenuOption = {
  readonly option: HTMLOptionElement;
  readonly button: HTMLButtonElement;
  readonly group: HTMLElement | null;
};

type OpenMenu = {
  readonly owner: SelectInstance;
  readonly popover: HTMLElement;
  readonly list: HTMLElement;
  readonly options: MenuOption[];
  activeIndex: number;
};

/**
 * Replaces visible native selects inside one event-editor surface with a custom
 * listbox while retaining the original select as the value/event source.
 * Existing selectOption-based automation and all current change handlers keep
 * working because the native element is never removed from the DOM.
 */
export function installEventEditorCustomSelects(root: HTMLElement): EventEditorCustomSelectController {
  const instances = new Map<HTMLSelectElement, SelectInstance>();
  let openMenu: OpenMenu | null = null;
  let disposed = false;
  let typeahead = "";
  let typeaheadTimer: number | undefined;

  const closeMenu = (restoreFocus = false): void => {
    const current = openMenu;
    if (!current) return;
    openMenu = null;
    current.owner.trigger.setAttribute("aria-expanded", "false");
    current.owner.trigger.removeAttribute("aria-controls");
    current.popover.remove();
    if (restoreFocus && current.owner.trigger.isConnected) current.owner.trigger.focus({ preventScroll: true });
  };

  const syncOpenMenu = (instance: SelectInstance): void => {
    if (openMenu?.owner !== instance) return;
    for (const entry of openMenu.options) {
      const selected = entry.option.index === instance.select.selectedIndex;
      entry.button.classList.toggle("is-selected", selected);
      entry.button.setAttribute("aria-selected", String(selected));
    }
  };

  const chooseOption = (entry: MenuOption): void => {
    if (entry.option.disabled || openMenu?.owner.select.disabled) return;
    const instance = openMenu?.owner;
    if (!instance) return;
    closeMenu(false);
    instance.select.selectedIndex = entry.option.index;
    instance.sync();
    instance.select.dispatchEvent(new Event("input", { bubbles: true }));
    instance.select.dispatchEvent(new Event("change", { bubbles: true }));
    queueMicrotask(() => {
      if (instance.trigger.isConnected) instance.trigger.focus({ preventScroll: true });
    });
  };

  const enabledMenuIndexes = (menu: OpenMenu): number[] => menu.options
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !entry.option.disabled && !entry.button.hidden)
    .map(({ index }) => index);

  const setActiveOption = (menu: OpenMenu, index: number, focus = false): void => {
    const enabled = enabledMenuIndexes(menu);
    if (enabled.length === 0) return;
    const resolved = enabled.includes(index) ? index : enabled[0]!;
    menu.activeIndex = resolved;
    menu.options.forEach((entry, optionIndex) => {
      entry.button.classList.toggle("is-active", optionIndex === resolved);
    });
    const target = menu.options[resolved]?.button;
    if (!target) return;
    try {
      target.scrollIntoView({ block: "nearest" });
    } catch {
      // Test DOMs may not implement scrollIntoView.
    }
    if (focus) target.focus({ preventScroll: true });
  };

  const moveActiveOption = (menu: OpenMenu, delta: number, focus = false): void => {
    const enabled = enabledMenuIndexes(menu);
    if (enabled.length === 0) return;
    const current = enabled.indexOf(menu.activeIndex);
    const next = current < 0
      ? enabled[0]!
      : enabled[(current + delta + enabled.length) % enabled.length]!;
    setActiveOption(menu, next, focus);
  };

  const positionMenu = (): void => {
    const menu = openMenu;
    if (!menu || !menu.owner.trigger.isConnected) {
      closeMenu(false);
      return;
    }
    const rect = menu.owner.trigger.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth, globalThis.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight, globalThis.innerHeight || 0);
    const margin = 8;
    const gap = 6;
    const width = Math.min(Math.max(rect.width, 220), Math.max(220, viewportWidth - margin * 2));
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - width - margin));
    const spaceBelow = viewportHeight - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;
    const openAbove = spaceBelow < 190 && spaceAbove > spaceBelow;
    const available = Math.max(140, openAbove ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(360, available);

    menu.popover.style.width = `${width}px`;
    menu.popover.style.left = `${left}px`;
    menu.popover.style.setProperty("--event-custom-select-max-height", `${maxHeight}px`);
    const measuredHeight = Math.min(menu.popover.getBoundingClientRect().height || maxHeight, maxHeight);
    const top = openAbove
      ? Math.max(margin, rect.top - gap - measuredHeight)
      : Math.min(viewportHeight - margin - measuredHeight, rect.bottom + gap);
    menu.popover.style.top = `${Math.max(margin, top)}px`;
    menu.popover.classList.toggle("opens-above", openAbove);
  };

  const buildMenuOptions = (select: HTMLSelectElement, list: HTMLElement): MenuOption[] => {
    const result: MenuOption[] = [];
    let currentGroup: HTMLElement | null = null;
    let currentGroupElement: Element | null = null;

    for (const option of Array.from(select.options)) {
      const parent = option.parentElement;
      const inGroup = parent?.tagName === "OPTGROUP";
      if (inGroup && parent !== currentGroupElement) {
        currentGroupElement = parent;
        currentGroup = document.createElement("div");
        currentGroup.className = "event-custom-select-group";
        currentGroup.textContent = parent?.getAttribute("label") ?? "";
        list.append(currentGroup);
      } else if (!inGroup) {
        currentGroupElement = null;
        currentGroup = null;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-custom-select-option";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option.index === select.selectedIndex));
      button.disabled = option.disabled || (inGroup && (parent as HTMLOptGroupElement).disabled);
      button.dataset.optionIndex = String(option.index);

      const label = document.createElement("span");
      label.className = "event-custom-select-option-label";
      label.textContent = option.label || option.textContent || option.value;
      const check = document.createElement("span");
      check.className = "event-custom-select-option-check";
      check.setAttribute("aria-hidden", "true");
      button.append(label, check);
      list.append(button);

      const entry: MenuOption = { option, button, group: currentGroup };
      button.addEventListener("pointerenter", () => {
        const menu = openMenu;
        if (!menu || button.disabled) return;
        setActiveOption(menu, menu.options.indexOf(entry));
      });
      button.addEventListener("click", () => chooseOption(entry));
      button.addEventListener("keydown", (event) => {
        const menu = openMenu;
        if (!menu) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          moveActiveOption(menu, event.key === "ArrowDown" ? 1 : -1, true);
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const enabled = enabledMenuIndexes(menu);
          const target = event.key === "Home" ? enabled[0] : enabled.at(-1);
          if (target !== undefined) setActiveOption(menu, target, true);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseOption(entry);
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeMenu(true);
        } else if (event.key === "Tab") {
          closeMenu(false);
        }
      });
      result.push(entry);
    }
    return result;
  };

  const filterMenu = (menu: OpenMenu, query: string): void => {
    const normalized = query.trim().toLocaleLowerCase();
    for (const entry of menu.options) {
      const label = entry.option.label || entry.option.textContent || entry.option.value;
      entry.button.hidden = normalized.length > 0 && !label.toLocaleLowerCase().includes(normalized);
    }
    const groups = new Set(menu.options.map((entry) => entry.group).filter((group): group is HTMLElement => group !== null));
    for (const group of groups) {
      group.hidden = !menu.options.some((entry) => entry.group === group && !entry.button.hidden);
    }
    const enabled = enabledMenuIndexes(menu);
    if (!enabled.includes(menu.activeIndex) && enabled[0] !== undefined) setActiveOption(menu, enabled[0]);
    menu.list.classList.toggle("is-empty", enabled.length === 0);
  };

  const openSelectMenu = (instance: SelectInstance): void => {
    if (instance.select.disabled || instance.select.options.length === 0) return;
    if (openMenu?.owner === instance) {
      closeMenu(true);
      return;
    }
    closeMenu(false);
    instance.sync();

    const popover = document.createElement("div");
    popover.className = "event-custom-select-popover";
    popover.dataset.customSelectPopover = "true";

    const list = document.createElement("div");
    list.className = "event-custom-select-options";
    list.id = `event-custom-select-list-${nextSelectId()}`;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", accessibleSelectName(instance.select));
    const options = buildMenuOptions(instance.select, list);

    if (options.length >= SEARCH_THRESHOLD) {
      const searchWrap = document.createElement("div");
      searchWrap.className = "event-custom-select-search-wrap";
      const search = document.createElement("input");
      search.className = "event-custom-select-search";
      search.type = "search";
      search.placeholder = "옵션 검색…";
      search.setAttribute("aria-label", "옵션 검색");
      search.autocomplete = "off";
      search.addEventListener("input", () => {
        if (openMenu) filterMenu(openMenu, search.value);
      });
      search.addEventListener("keydown", (event) => {
        const menu = openMenu;
        if (!menu) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          moveActiveOption(menu, event.key === "ArrowDown" ? 1 : -1, true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeMenu(true);
        } else if (event.key === "Tab") {
          closeMenu(false);
        }
      });
      searchWrap.append(search);
      popover.append(searchWrap);
    }

    popover.append(list);
    root.append(popover);
    const selectedIndex = options.findIndex((entry) => entry.option.index === instance.select.selectedIndex && !entry.button.disabled);
    const firstEnabled = options.findIndex((entry) => !entry.button.disabled);
    openMenu = {
      owner: instance,
      popover,
      list,
      options,
      activeIndex: selectedIndex >= 0 ? selectedIndex : firstEnabled,
    };
    instance.trigger.setAttribute("aria-expanded", "true");
    instance.trigger.setAttribute("aria-controls", list.id);
    options.forEach((entry, index) => {
      entry.button.classList.toggle("is-selected", entry.option.index === instance.select.selectedIndex);
      entry.button.classList.toggle("is-active", index === openMenu?.activeIndex);
    });
    positionMenu();
    const active = options[openMenu.activeIndex]?.button;
    try {
      active?.scrollIntoView({ block: "nearest" });
    } catch {
      // Test DOMs may not implement scrollIntoView.
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent, instance: SelectInstance): void => {
    const menu = openMenu?.owner === instance ? openMenu : null;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!menu) {
        openSelectMenu(instance);
        if (openMenu) moveActiveOption(openMenu, event.key === "ArrowDown" ? 1 : -1);
      } else {
        moveActiveOption(menu, event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!menu) openSelectMenu(instance);
      else {
        const entry = menu.options[menu.activeIndex];
        if (entry) chooseOption(entry);
      }
      return;
    }
    if (event.key === "Escape" && menu) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!menu) openSelectMenu(instance);
      const current = openMenu?.owner === instance ? openMenu : null;
      if (!current) return;
      const enabled = enabledMenuIndexes(current);
      const index = event.key === "Home" ? enabled[0] : enabled.at(-1);
      if (index !== undefined) setActiveOption(current, index);
      return;
    }
    if (event.key === "Tab") {
      closeMenu(false);
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    typeahead += event.key.toLocaleLowerCase();
    if (typeaheadTimer !== undefined) globalThis.clearTimeout(typeaheadTimer);
    typeaheadTimer = globalThis.setTimeout(() => { typeahead = ""; }, TYPEAHEAD_RESET_MS);
    if (!menu) openSelectMenu(instance);
    const current = openMenu?.owner === instance ? openMenu : null;
    if (!current) return;
    const match = current.options.findIndex((entry) => {
      const label = entry.option.label || entry.option.textContent || entry.option.value;
      return !entry.button.disabled && label.toLocaleLowerCase().startsWith(typeahead);
    });
    if (match >= 0) setActiveOption(current, match);
  };

  const enhanceSelect = (select: HTMLSelectElement): void => {
    if (disposed || instances.has(select) || shouldSkipSelect(select)) return;
    const parent = select.parentElement;
    if (!parent || typeof parent.insertBefore !== "function") return;

    const wrapper = document.createElement("span");
    wrapper.className = "event-custom-select";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "event-custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", accessibleSelectName(select));
    if (select.dataset.testid) trigger.dataset.customSelectFor = select.dataset.testid;

    const valueLabel = document.createElement("span");
    valueLabel.className = "event-custom-select-value";
    const chevron = document.createElement("span");
    chevron.className = "event-custom-select-chevron";
    chevron.setAttribute("aria-hidden", "true");
    trigger.append(valueLabel, chevron);

    const previousAriaHidden = select.getAttribute("aria-hidden");
    const previousTabIndex = select.getAttribute("tabindex");
    parent.insertBefore(wrapper, select);
    wrapper.append(select, trigger);
    select.classList.add("event-custom-select-native");
    select.dataset.eventCustomSelect = "true";
    select.setAttribute("aria-hidden", "true");
    select.setAttribute("tabindex", "-1");

    let instance!: SelectInstance;
    const sync = (): void => {
      const selected = select.options[select.selectedIndex] ?? select.selectedOptions[0];
      const text = selected?.label || selected?.textContent || select.getAttribute("placeholder") || "선택";
      valueLabel.textContent = text;
      trigger.title = text;
      trigger.disabled = select.disabled || select.options.length === 0;
      wrapper.classList.toggle("is-disabled", trigger.disabled);
      wrapper.classList.toggle("is-placeholder", !selected);
      syncOpenMenu(instance);
    };
    const onNativeChange = (): void => {
      sync();
      if (openMenu?.owner === instance) closeMenu(false);
    };
    const onNativeFocus = (): void => trigger.focus({ preventScroll: true });
    select.addEventListener("change", onNativeChange);
    select.addEventListener("input", sync);
    select.addEventListener("focus", onNativeFocus);
    trigger.addEventListener("click", () => openSelectMenu(instance));
    trigger.addEventListener("keydown", (event) => handleTriggerKeyDown(event, instance));

    instance = {
      select,
      root: wrapper,
      trigger,
      valueLabel,
      previousAriaHidden,
      previousTabIndex,
      sync,
      destroy: () => {
        select.removeEventListener("change", onNativeChange);
        select.removeEventListener("input", sync);
        select.removeEventListener("focus", onNativeFocus);
        select.classList.remove("event-custom-select-native");
        delete select.dataset.eventCustomSelect;
        restoreAttribute(select, "aria-hidden", previousAriaHidden);
        restoreAttribute(select, "tabindex", previousTabIndex);
        if (wrapper.parentElement && typeof wrapper.parentElement.insertBefore === "function") {
          wrapper.parentElement.insertBefore(select, wrapper);
          wrapper.remove();
        }
      },
    };
    instances.set(select, instance);
    sync();
  };

  const refresh = (): void => {
    if (disposed) return;
    if (root instanceof HTMLSelectElement) enhanceSelect(root);
    root.querySelectorAll<HTMLSelectElement>("select").forEach(enhanceSelect);
    for (const [select, instance] of instances) {
      if (!root.contains(select)) {
        if (openMenu?.owner === instance) closeMenu(false);
        instances.delete(select);
        continue;
      }
      instance.sync();
    }
  };

  // Subdialogs can replace only their command form without repainting the modal.
  // Observe child insertion only (never our own class/ARIA changes) so newly added
  // selects are upgraded without creating a mutation feedback loop.
  const observer = typeof MutationObserver === "undefined"
    ? null
    : new MutationObserver((mutations) => {
        let removedNodes = false;
        for (const mutation of mutations) {
          removedNodes = removedNodes || mutation.removedNodes.length > 0;
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node instanceof HTMLSelectElement) enhanceSelect(node);
            node.querySelectorAll<HTMLSelectElement>("select").forEach(enhanceSelect);
          }
          const changedSelect = mutation.target instanceof Element
            ? mutation.target.closest<HTMLSelectElement>("select")
            : mutation.target.parentElement?.closest<HTMLSelectElement>("select");
          if (changedSelect) instances.get(changedSelect)?.sync();
        }
        if (!removedNodes) return;
        for (const [select, instance] of instances) {
          if (root.contains(select)) continue;
          if (openMenu?.owner === instance) closeMenu(false);
          instances.delete(select);
        }
      });
  observer?.observe(root, { subtree: true, childList: true });

  const onRootPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Node) || !openMenu) return;
    if (openMenu.popover.contains(target) || openMenu.owner.root.contains(target)) return;
    closeMenu(false);
  };
  const onRootKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && openMenu) {
      event.stopPropagation();
      closeMenu(true);
    }
  };
  root.addEventListener("pointerdown", onRootPointerDown, true);
  root.addEventListener("keydown", onRootKeyDown, true);
  root.addEventListener("scroll", positionMenu, true);
  globalThis.addEventListener?.("resize", positionMenu);
  refresh();

  return {
    refresh,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      closeMenu(false);
      if (typeaheadTimer !== undefined) globalThis.clearTimeout(typeaheadTimer);
      root.removeEventListener("pointerdown", onRootPointerDown, true);
      root.removeEventListener("keydown", onRootKeyDown, true);
      root.removeEventListener("scroll", positionMenu, true);
      globalThis.removeEventListener?.("resize", positionMenu);
      for (const instance of Array.from(instances.values())) instance.destroy();
      instances.clear();
    },
  };
}

function shouldSkipSelect(select: HTMLSelectElement): boolean {
  return select.hidden
    || select.multiple
    || select.size > 1
    || select.getAttribute("aria-hidden") === "true"
    || SKIP_SELECT_CLASSES.some((className) => select.classList.contains(className));
}

function accessibleSelectName(select: HTMLSelectElement): string {
  const explicit = select.getAttribute("aria-label")?.trim();
  if (explicit) return explicit;
  const labels = Array.from(select.labels ?? [])
    .map((label) => label.textContent?.trim() ?? "")
    .filter(Boolean);
  return labels.join(" ") || "옵션 선택";
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

let selectId = 0;
function nextSelectId(): number {
  selectId += 1;
  return selectId;
}
