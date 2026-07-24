import { updateEvent } from "@/editor/eventActions";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  characterIdExists,
  getCachedCharacterIdIndex,
  type CharacterIdIndexEntry,
} from "@/project/characterIdIndex";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { openEventSubdialog } from "./subdialog";

export type CharacterIdPickerRequest = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly currentId?: string;
};

type PickerMode = "select" | "create";

type PickerState = {
  mode: PickerMode;
  query: string;
  selectedId: string;
  createId: string;
  createDisplayName: string;
  createError: string;
};

type PickerHosts = {
  readonly list: HTMLElement;
  readonly searchInput: HTMLInputElement;
  readonly detail: HTMLElement;
  readonly createPane: HTMLElement;
  readonly createIdInput: HTMLInputElement;
  readonly createNameInput: HTMLInputElement;
  readonly createError: HTMLElement;
  readonly okButton: HTMLButtonElement;
  readonly createToggle: HTMLButtonElement;
};

/**
 * Dedicated characterId find/create dialog (not a switch/variable clone).
 * Select attaches an existing id; create registers a profile then attaches.
 */
export function openCharacterIdPicker(request: CharacterIdPickerRequest): void {
  openEventSubdialog({
    title: "캐릭터 ID 선택",
    subtitle: "프로필·이벤트 사용 현황을 보고 선택하거나 새로 등록합니다.",
    testId: "event-character-id-picker",
    width: "narrow",
    render: (body, close) => renderCharacterIdPicker({ body, close, request }),
  });
}

function renderCharacterIdPicker(options: {
  readonly body: HTMLElement;
  readonly close: () => void;
  readonly request: CharacterIdPickerRequest;
}): void {
  const currentId = options.request.currentId?.trim() ?? "";
  const state: PickerState = {
    mode: "select",
    query: "",
    selectedId: currentId,
    createId: "",
    createDisplayName: "",
    createError: "",
  };

  const searchInput = el("input", {
    class: "event-character-id-picker-search",
    attrs: {
      type: "search",
      placeholder: "ID / 표시 이름 검색",
      "aria-label": "캐릭터 검색",
    },
    dataset: { testid: "event-character-id-picker-search" },
  }) as HTMLInputElement;

  const createIdInput = el("input", {
    class: "event-character-id-picker-create-id",
    attrs: {
      type: "text",
      placeholder: "고유 캐릭터 ID",
      "aria-label": "새 캐릭터 ID",
      spellcheck: "false",
    },
    dataset: { testid: "event-character-id-picker-create-id" },
  }) as HTMLInputElement;

  const createNameInput = el("input", {
    class: "event-character-id-picker-create-name",
    attrs: {
      type: "text",
      placeholder: "표시 이름 (필수)",
      "aria-label": "표시 이름",
    },
    dataset: { testid: "event-character-id-picker-create-name" },
  }) as HTMLInputElement;

  const createError = el("div", {
    class: "event-character-id-picker-create-error",
    dataset: { testid: "event-character-id-picker-create-error" },
  });

  const createPane = el("section", {
    class: "event-character-id-picker-create",
    dataset: { testid: "event-character-id-picker-create-pane" },
    attrs: { hidden: "true" },
    children: [
      el("div", {
        class: "event-character-id-picker-create-heading",
        text: "새 캐릭터 등록",
      }),
      el("label", {
        class: "event-character-id-picker-field",
        children: [el("span", { text: "캐릭터 ID" }), createIdInput],
      }),
      el("label", {
        class: "event-character-id-picker-field",
        children: [el("span", { text: "표시 이름" }), createNameInput],
      }),
      createError,
      el("p", {
        class: "event-character-id-picker-hint",
        text: "등록 시 project.characters 프로필을 만들고 이 이벤트에 연결합니다. 자유 입력은 프로필을 만들지 않습니다.",
      }),
    ],
  });

  const okButton = footerButton({
    label: "확인",
    testId: "event-character-id-picker-ok",
    primary: true,
    onClick: () => {
      if (state.mode === "create") {
        if (!tryCreateAndAttach(options.request, state, hosts)) return;
        options.close();
        return;
      }
      if (!state.selectedId) {
        toast("캐릭터를 선택하세요.", "error");
        return;
      }
      attachCharacterId(options.request, state.selectedId);
      options.close();
    },
  });

  const createToggle = footerButton({
    label: "새로 만들기",
    testId: "event-character-id-picker-create-toggle",
    onClick: () => {
      state.mode = state.mode === "create" ? "select" : "create";
      state.createError = "";
      render(hosts, state);
    },
  });

  const hosts: PickerHosts = {
    list: el("div", {
      class: "event-character-id-picker-list",
      attrs: { role: "listbox", "aria-label": "캐릭터 목록" },
      dataset: { testid: "event-character-id-picker-list" },
    }),
    searchInput,
    detail: el("div", {
      class: "event-character-id-picker-detail",
      dataset: { testid: "event-character-id-picker-detail" },
    }),
    createPane,
    createIdInput,
    createNameInput,
    createError,
    okButton,
    createToggle,
  };

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    render(hosts, state);
  });
  createIdInput.addEventListener("input", () => {
    state.createId = createIdInput.value;
    state.createError = "";
    updateCreateChrome(hosts, state);
  });
  createNameInput.addEventListener("input", () => {
    state.createDisplayName = createNameInput.value;
    state.createError = "";
    updateCreateChrome(hosts, state);
  });

  options.body.append(
    el("div", {
      class: "event-character-id-picker",
      children: [
        el("div", {
          class: "event-character-id-picker-frame",
          children: [
            hosts.searchInput,
            hosts.list,
            hosts.detail,
            hosts.createPane,
          ],
        }),
        el("div", {
          class: "event-character-id-picker-footer",
          children: [
            hosts.okButton,
            footerButton({ label: "취소", onClick: options.close }),
            hosts.createToggle,
          ],
        }),
      ],
    })
  );

  render(hosts, state);
}

function render(hosts: PickerHosts, state: PickerState): void {
  const entries = getCachedCharacterIdIndex(store.getCurrent());
  const filtered = filterEntries(entries, state.query);
  clearChildren(hosts.list);
  clearChildren(hosts.detail);

  if (state.mode === "select") {
    hosts.createPane.setAttribute("hidden", "true");
    hosts.createToggle.textContent = "새로 만들기";
    hosts.searchInput.disabled = false;
    hosts.okButton.textContent = "확인";
    hosts.okButton.disabled = !state.selectedId;

    if (filtered.length === 0) {
      hosts.list.append(
        el("div", {
          class: "empty-hint",
          text: state.query.trim()
            ? `"${state.query.trim()}" 와 일치하는 캐릭터가 없습니다.`
            : "등록·사용 중인 캐릭터 ID가 없습니다. 새로 만들거나 자유 입력하세요.",
          dataset: { testid: "event-character-id-picker-empty" },
        })
      );
    } else {
      for (const entry of filtered) {
        hosts.list.append(rowButton(entry, entry.characterId === state.selectedId, () => {
          state.selectedId = entry.characterId;
          render(hosts, state);
        }));
      }
    }

    const selected = entries.find((entry) => entry.characterId === state.selectedId);
    hosts.detail.append(detailPanel(selected));
  } else {
    hosts.createPane.removeAttribute("hidden");
    hosts.createToggle.textContent = "목록으로";
    hosts.searchInput.disabled = true;
    hosts.createIdInput.value = state.createId;
    hosts.createNameInput.value = state.createDisplayName;
    hosts.createError.textContent = state.createError;
    hosts.createError.hidden = !state.createError;
    hosts.okButton.textContent = "등록 후 연결";
    updateCreateChrome(hosts, state);

    hosts.list.append(
      el("div", {
        class: "empty-hint",
        text: "새 캐릭터 ID와 표시 이름을 입력한 뒤 등록하세요. 이미 쓰인 ID는 거부됩니다.",
        dataset: { testid: "event-character-id-picker-create-help" },
      })
    );
    hosts.detail.append(
      el("div", {
        class: "event-character-id-picker-detail-empty",
        text: "생성 모드 — 기존 항목을 덮어쓰지 않습니다.",
      })
    );
  }

  hosts.searchInput.value = state.query;
}

function updateCreateChrome(hosts: PickerHosts, state: PickerState): void {
  if (state.mode !== "create") return;
  const id = state.createId.trim();
  const name = state.createDisplayName.trim();
  hosts.okButton.disabled = !id || !name;
  hosts.createError.textContent = state.createError;
  hosts.createError.hidden = !state.createError;
}

function filterEntries(
  entries: readonly CharacterIdIndexEntry[],
  query: string
): CharacterIdIndexEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...entries];
  return entries.filter((entry) => {
    const displayName = entry.profile?.displayName?.trim() ?? "";
    return (
      entry.characterId.toLowerCase().includes(needle)
      || displayName.toLowerCase().includes(needle)
    );
  });
}

function rowButton(
  entry: CharacterIdIndexEntry,
  selected: boolean,
  onSelect: () => void
): HTMLButtonElement {
  const displayName = entry.profile?.displayName?.trim() || "(이름 없음)";
  const flags: string[] = [];
  if (entry.isOrphan) flags.push("프로필 없음");
  if (entry.isUnusedProfile) flags.push("미사용 프로필");
  const meta = [
    `사용 ${entry.usageCount}`,
    `맵 ${entry.mapCount}`,
    ...flags,
  ].join(" · ");

  return el("button", {
    class: "event-character-id-picker-row" + (selected ? " selected" : ""),
    attrs: {
      type: "button",
      role: "option",
      "aria-selected": selected ? "true" : "false",
      title: `${entry.characterId} — ${displayName}`,
    },
    dataset: {
      testid: `event-character-id-picker-row-${entry.characterId}`,
      characterId: entry.characterId,
    },
    on: {
      click: onSelect,
      dblclick: onSelect,
    },
    children: [
      el("span", {
        class: "event-character-id-picker-row-id",
        text: entry.characterId,
      }),
      el("span", {
        class: "event-character-id-picker-row-name",
        text: displayName,
      }),
      el("span", {
        class: "event-character-id-picker-row-meta",
        text: meta,
      }),
    ],
  });
}

function detailPanel(entry: CharacterIdIndexEntry | undefined): HTMLElement {
  if (!entry) {
    return el("div", {
      class: "event-character-id-picker-detail-empty",
      text: "목록에서 캐릭터를 선택하세요.",
    });
  }
  const displayName = entry.profile?.displayName?.trim() || "(표시 이름 없음)";
  const status = entry.isOrphan
    ? "이벤트에만 존재 (프로필 없음)"
    : entry.isUnusedProfile
      ? "프로필만 존재 (이벤트 미사용)"
      : "프로필 + 이벤트 사용 중";

  return el("div", {
    class: "event-character-id-picker-detail-body",
    children: [
      el("div", {
        class: "event-character-id-picker-detail-id",
        text: entry.characterId,
      }),
      el("div", {
        class: "event-character-id-picker-detail-name",
        text: displayName,
      }),
      el("div", {
        class: "event-character-id-picker-detail-meta",
        text: `이벤트 ${entry.usageCount}곳 · 맵 ${entry.mapCount}개`,
      }),
      el("div", {
        class: "event-character-id-picker-detail-status",
        text: status,
      }),
    ],
  });
}

function tryCreateAndAttach(
  request: CharacterIdPickerRequest,
  state: PickerState,
  hosts: PickerHosts
): boolean {
  const id = state.createId.trim();
  const displayName = state.createDisplayName.trim();
  if (!id) {
    state.createError = "캐릭터 ID를 입력하세요.";
    updateCreateChrome(hosts, state);
    return false;
  }
  if (!displayName) {
    state.createError = "표시 이름은 필수입니다.";
    updateCreateChrome(hosts, state);
    return false;
  }
  if (characterIdExists(store.getCurrent(), id)) {
    state.createError = `이미 사용 중인 ID입니다: ${id}`;
    updateCreateChrome(hosts, state);
    toast(state.createError, "error");
    return false;
  }
  recordProjectSnapshot("캐릭터 프로필 등록 및 연결", request.mapId, { kind: "project" });
  store.update((project) => {
    const next = { ...(project.characters ?? {}) };
    next[id] = { displayName };
    project.characters = next;
    const map = project.maps[request.mapId];
    const event = map?.events.find((entry) => entry.id === request.eventId);
    if (event) event.characterId = id;
  }, { scope: "project" });

  if (!store.getCurrent().characters?.[id]) {
    state.createError = "프로필 등록에 실패했습니다.";
    updateCreateChrome(hosts, state);
    return false;
  }
  if (store.getCurrent().maps[request.mapId]?.events.find((entry) => entry.id === request.eventId)?.characterId !== id) {
    attachCharacterId(request, id);
  }

  toast(`캐릭터 '${displayName}' 등록 및 연결`, "ok");
  return true;
}

function attachCharacterId(request: CharacterIdPickerRequest, characterId: string): void {
  updateEvent(request.mapId, request.eventId, { characterId });
}

function footerButton(options: {
  readonly label: string;
  readonly onClick: () => void;
  readonly primary?: boolean;
  readonly testId?: string;
}): HTMLButtonElement {
  const button = el("button", {
    class: "btn" + (options.primary ? " primary" : ""),
    text: options.label,
    attrs: { type: "button" },
    on: { click: options.onClick },
  });
  if (options.testId) button.dataset.testid = options.testId;
  return button;
}
