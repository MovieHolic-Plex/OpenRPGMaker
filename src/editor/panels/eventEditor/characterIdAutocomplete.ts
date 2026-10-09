// characterIdAutocomplete.ts
// 인라인 캐릭터 ID 인풋에 붙는 자동완성 드롭다운.
// - getCachedCharacterIdIndex 로 캐시된 인덱스를 받아 매 키입력마다 O(n) 필터만 수행.
// - 키보드(↑↓ Enter Esc) + 마우스 클릭 지원.
// - 외부 클릭 / 블러 시 닫힘(클릭 등록을 위해 약간의 지연).
// - destroy() 로 리스너를 정리한다.
import { getCachedCharacterIdIndex, type CharacterIdIndexEntry } from "@/project/characterIdIndex";
import type { Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

const MAX_RESULTS = 10;
// Blur close is delayed so a click on a suggestion row registers before the
// input loses focus — without this, mousedown on a row closes the dropdown
// before the click event fires.
const BLUR_CLOSE_DELAY_MS = 150;

export type CharacterIdAutocompleteHandle = {
  readonly destroy: () => void;
};

/**
 * Attach a character-ID autocomplete dropdown to an existing text input.
 *
 * Suggestions come from `getCachedCharacterIdIndex`, which caches the full
 * map/event scan by project reference. Rapid typing only performs a cheap
 * client-side filter — the scan is reused until the store mutates (clone).
 */
export function attachCharacterIdAutocomplete(options: {
  readonly input: HTMLInputElement;
  readonly getProject: () => Project;
  readonly onSelect: (characterId: string) => void;
}): CharacterIdAutocompleteHandle {
  const { input, getProject, onSelect } = options;

  const dropdown = el("div", {
    class: "character-id-autocomplete",
    attrs: { role: "listbox", "aria-label": "캐릭터 ID 추천" },
    dataset: { testid: "character-id-autocomplete" },
  });
  dropdown.hidden = true;

  let entries: readonly CharacterIdIndexEntry[] = [];
  let filtered: readonly CharacterIdIndexEntry[] = [];
  let highlightedIndex = -1;
  let isOpen = false;

  function refreshEntries(): void {
    entries = getCachedCharacterIdIndex(getProject());
  }

  function computeFiltered(): void {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      filtered = [...entries]
        .sort((a, b) => b.usageCount - a.usageCount || a.characterId.localeCompare(b.characterId))
        .slice(0, MAX_RESULTS);
      return;
    }
    filtered = entries
      .filter((entry) => {
        const name = entry.profile?.displayName?.trim()?.toLowerCase() ?? "";
        return entry.characterId.toLowerCase().includes(query) || name.includes(query);
      })
      .slice(0, MAX_RESULTS);
  }

  function renderDropdown(): void {
    clearChildren(dropdown);
    highlightedIndex = -1;

    if (filtered.length === 0) {
      dropdown.append(
        el("div", {
          class: "character-id-autocomplete-empty",
          text: "일치하는 캐릭터가 없습니다. 자유 입력 가능.",
        }),
      );
      return;
    }

    filtered.forEach((entry) => {
      const displayName = entry.profile?.displayName?.trim() || "";
      const meta = [
        `사용 ${entry.usageCount}`,
        entry.isOrphan ? "프로필 없음" : "",
        entry.isUnusedProfile ? "미사용" : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const row = el("button", {
        class: "character-id-autocomplete-row",
        attrs: {
          type: "button",
          role: "option",
          "aria-selected": "false",
          title: `${entry.characterId} — ${displayName || "(이름 없음)"}`,
        },
        dataset: {
          testid: `character-id-autocomplete-row-${entry.characterId}`,
        },
        on: {
          click: () => {
            selectEntry(entry);
          },
        },
        children: [
          el("span", {
            class: "character-id-autocomplete-row-id",
            text: entry.characterId,
          }),
          displayName
            ? el("span", {
                class: "character-id-autocomplete-row-name",
                text: displayName,
              })
            : el("span", {
                class: "character-id-autocomplete-row-name muted",
                text: "(이름 없음)",
              }),
          meta
            ? el("span", {
                class: "character-id-autocomplete-row-meta",
                text: meta,
              })
            : el("span", {}),
        ],
      });
      dropdown.append(row);
    });
  }

  function open(): void {
    if (isOpen) return;
    refreshEntries();
    isOpen = true;
    dropdown.hidden = false;
    computeFiltered();
    renderDropdown();
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    dropdown.hidden = true;
    clearChildren(dropdown);
    highlightedIndex = -1;
  }

  function selectEntry(entry: CharacterIdIndexEntry): void {
    input.value = entry.characterId;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    onSelect(entry.characterId);
    close();
  }

  function selectHighlighted(): void {
    if (highlightedIndex < 0 || highlightedIndex >= filtered.length) return;
    selectEntry(filtered[highlightedIndex]);
  }

  function highlightRow(index: number): void {
    const rows = dropdown.querySelectorAll<HTMLElement>(".character-id-autocomplete-row");
    rows.forEach((row, i) => {
      const active = i === index;
      row.classList.toggle("highlighted", active);
      row.setAttribute("aria-selected", active ? "true" : "false");
    });
    const target = rows[index];
    if (target) {
      const dropdownRect = dropdown.getBoundingClientRect();
      const rowRect = target.getBoundingClientRect();
      if (rowRect.top < dropdownRect.top) {
        dropdown.scrollTop -= dropdownRect.top - rowRect.top;
      } else if (rowRect.bottom > dropdownRect.bottom) {
        dropdown.scrollTop += rowRect.bottom - dropdownRect.bottom;
      }
    }
    highlightedIndex = index;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!isOpen) {
      if (event.key === "ArrowDown" && input.value.trim() === "") {
        event.preventDefault();
        open();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        highlightRow(Math.min(highlightedIndex + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        highlightRow(Math.max(highlightedIndex - 1, 0));
        break;
      case "Enter":
        if (highlightedIndex >= 0) {
          event.preventDefault();
          selectHighlighted();
        }
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
    }
  }

  function onInput(): void {
    if (!isOpen) {
      refreshEntries();
      isOpen = true;
      dropdown.hidden = false;
    }
    computeFiltered();
    renderDropdown();
  }

  function onFocus(): void {
    open();
  }

  function onBlur(): void {
    window.setTimeout(close, BLUR_CLOSE_DELAY_MS);
  }

  function onOutsidePointer(event: PointerEvent): void {
    if (dropdown.contains(event.target as Node) || input.contains(event.target as Node)) return;
    close();
  }

  input.addEventListener("input", onInput);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", handleKeydown);
  document.addEventListener("pointerdown", onOutsidePointer, true);

  // Append the dropdown inside the input's parent so absolute positioning is
  // relative to the input row. Fall back to body+fixed when the input has no
  // parent (detached/test context).
  const parent = input.parentElement;
  if (parent) {
    parent.style.position = parent.style.position || "relative";
    parent.append(dropdown);
  } else {
    document.body.append(dropdown);
    dropdown.style.position = "fixed";
    positionFixed();
    input.addEventListener("scroll", positionFixed, { passive: true });
    window.addEventListener("scroll", positionFixed, { passive: true });
  }

  function positionFixed(): void {
    const rect = input.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + 2}px`;
    dropdown.style.minWidth = `${rect.width}px`;
  }

  function destroy(): void {
    input.removeEventListener("input", onInput);
    input.removeEventListener("focus", onFocus);
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    input.removeEventListener("scroll", positionFixed);
    window.removeEventListener("scroll", positionFixed);
    dropdown.remove();
  }

  return { destroy };
}
