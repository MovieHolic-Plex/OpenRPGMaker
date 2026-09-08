// eventEditor/moveRouteTargetPicker.ts — 「이동 경로 설정 → 누구에게 → 특정 이벤트」의 검색 픽커.
//
// 왜 필요한가 (OPRN-OUT-012): 이 자리는 자유 입력 텍스트 상자 하나였다. 그래서 대상 NPC 를
// 고르는 유일한 방법이 그 이벤트의 내부 id(`ev_npc_cb33408d-…`)를 어딘가에서 찾아 **손으로
// 붙여넣는 것**이었고, 조수가 `"this"` 같은 값을 써 넣으면 요약이 «this (없음)» 이 되고
// 테스트 플레이에서는 아무 일도 일어나지 않았다.
//
// 왜 새 드롭다운인가: `sharedPickers.eventPicker` 는 `<select>` + 카드이고 검색이 없다.
// `searchableRecordBrowser` 는 카드 격자라 이 한 줄짜리 도구모음에 넣을 크기가 아니다.
// 그래서 이미 검증된 형태 — `characterIdAutocomplete` 의 «입력 + 아래로 펼치는 목록 +
// ↑↓/Enter/Esc» — 를 그대로 따르고, 목록의 재료만 공용 카탈로그(eventTargetCatalog)에서 받는다.
// 목록을 여기서 따로 만들면 조수 프롬프트·조수 검증과 어긋나 같은 결함이 되살아난다.
//
// 원시 id 입력 경로는 **없애지 않는다**: 이 상자가 여전히 값의 정본 표시이고(e2e 계약
// `move-route-event-id-input`), 옛 프로젝트의 알 수 없는 id 를 조용히 지우지 않기 위한
// 유일한 자리이기도 하다. 대신 상자를 «이름 또는 ID 검색» 으로 바꿔 목록이 따라 열린다.
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import {
  buildEventTargetCatalog,
  matchEventTargets,
  resolveMoveTarget,
  type EventTargetCatalog,
} from "@/project/eventTargetCatalog";
import { clearChildren, el } from "@/util/dom";

// aria-controls 는 id 로만 가리킨다. 폼이 여러 번 렌더돼도 id 가 겹치지 않게 세어 붙인다.
let pickerSequence = 0;

export type MoveRouteTargetPickerHandle = {
  /** 목록. 호출자가 대상 줄에 붙인다. 닫혀 있을 때는 자식이 없다(표면 스냅샷 잡음 방지). */
  readonly dropdown: HTMLElement;
  /** 목록 열기 = 알 수 없는 값의 복구 진입점. */
  readonly openButton: HTMLElement;
  /** 대상 종류/값이 바뀐 뒤 상태 문구와 목록 가시성을 다시 맞춘다. */
  readonly sync: () => void;
  readonly close: () => void;
};

/**
 * 편집 중인 맵의 대상 카탈로그.
 *
 * mapId 선택 순서는 `commandBodyAdvanced.resolvePatternTargetEvent` 와 같은 근거다 —
 * 이벤트 편집 모달은 `data-map-id` 로 자기 맵을 들고 있고, 그게 없을 때만 편집기 선택
 * 상태로 내려간다. 이동 경로는 **이 맵**의 이벤트만 움직이므로 맵을 잘못 잡으면 판정이 틀린다.
 */
export function currentMapEventTargetCatalog(): EventTargetCatalog {
  const project = store.getCurrent();
  const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
  const mapId = modal?.dataset.mapId || editorState.get().currentMapId || project.startMapId;
  return buildEventTargetCatalog(project, mapId);
}

export function createMoveRouteTargetPicker(options: {
  readonly input: HTMLInputElement;
  /** 해석 결과·경고를 싣는 스팬(`move-route-event-name`). 새 testid 를 만들지 않는다. */
  readonly status: HTMLElement;
  /** 대상 종류가 «특정 이벤트» 인가. 아니면 목록도 상태 문구도 쓰지 않는다. */
  readonly isEventTarget: () => boolean;
  readonly getCatalog?: () => EventTargetCatalog;
  /** 목록에서 고른 정본 id. 저장(apply)은 호출자가 한다 — 적용 경로를 둘로 나누지 않는다. */
  readonly onSelect: (eventId: string) => void;
}): MoveRouteTargetPickerHandle {
  const { input, status, isEventTarget, onSelect } = options;
  const getCatalog = options.getCatalog ?? currentMapEventTargetCatalog;

  pickerSequence += 1;
  const dropdownId = `move-route-target-picker-${pickerSequence}`;
  const dropdown = el("div", {
    class: "move-route-target-picker",
    attrs: { id: dropdownId, role: "listbox", "aria-label": "이동 대상 이벤트" },
    dataset: { testid: "move-route-event-picker" },
  });
  dropdown.hidden = true;
  input.setAttribute("aria-controls", dropdownId);

  let rows: readonly { readonly id: string; readonly node: HTMLElement }[] = [];
  let highlighted = -1;
  // 검색어는 입력 상자 값과 **별개**다. 상자에는 저장된 정본 id 가 들어 있어서, 그 값을
  // 검색어로 쓰면 「목록」을 눌러도 자기 자신 한 줄만 보인다(고를 수가 없다). null = 전체 목록.
  let query: string | null = null;

  const close = (): void => {
    input.setAttribute("aria-expanded", "false");
    if (dropdown.hidden) return;
    unregisterModal(dropdown);
    dropdown.hidden = true;
    clearChildren(dropdown);
    rows = [];
    highlighted = -1;
    query = null;
  };

  /**
   * 상태 문구. 저장값이 **이미 정본**일 때만 «해석됨» 이다.
   *
   * 왜 별칭을 여기서 «해석됨» 으로 보여 주지 않는가: 보고된 실제 값이 `"this"` 였다.
   * 카탈로그는 그것이 「이 이벤트」를 뜻한다고 알아볼 수 있지만, **저장된 문자열은 그대로**
   * `"this"` 이고 런타임(registerAutonomousMover)은 그런 이벤트를 못 찾는다. 그래서
   * 「이 이벤트로 읽힙니다」라고 안심시키면 여전히 안 움직이는 명령을 고쳐진 것으로 착각한다.
   * 정본과 다른 모든 값은 «(없음)» + 그 값에 맞는 복구 방법을 말한다.
   *
   * 경고만 띄우고 값은 절대 다시 쓰지 않는다 — 옛 프로젝트를 여는 것만으로 명령이 바뀌면
   * 사용자가 알아채기 전에 원래 의도가 사라진다(이 결함의 가장 나쁜 결말이다).
   */
  function sync(): void {
    if (!isEventTarget()) {
      status.textContent = "";
      status.dataset.state = "inactive";
      close();
      return;
    }
    const raw = input.value.trim();
    if (!raw) {
      status.textContent = "";
      status.dataset.state = "empty";
      return;
    }
    const resolved = resolveMoveTarget(raw, getCatalog());
    if (resolved.kind === "event" && resolved.storedValue === raw) {
      status.textContent = resolved.entry.label;
      status.dataset.state = "resolved";
      return;
    }
    status.textContent = `${raw} (없음) — ${repairHint(resolved)}`;
    status.dataset.state = "unresolved";
  }

  /** 그 값에 실제로 통하는 한 문장. 「목록에서 고르세요」로 뭉개지 않는다. */
  function repairHint(resolved: ReturnType<typeof resolveMoveTarget>): string {
    switch (resolved.kind) {
      case "this":
        return "「이 이벤트」를 뜻하는 낡은 값입니다. 위 대상 종류를 「이 이벤트」로 다시 고르세요.";
      case "player":
        return "「주인공」을 뜻하는 낡은 값입니다. 위 대상 종류를 「주인공」으로 다시 고르세요.";
      case "event":
        return `이름으로 적힌 값입니다. 목록에서 「${resolved.entry.label}」을 고르면 ID 로 고쳐집니다.`;
      default:
        if (resolved.reason === "foreignMap") {
          return `다른 맵 «${resolved.foreign?.mapName ?? "?"}» 의 이벤트라 여기서는 움직이지 않습니다. 목록에서 이 맵의 이벤트를 고르세요.`;
        }
        if (resolved.reason === "ambiguous") {
          return `같은 이름의 이벤트가 ${resolved.candidates.length}개 있습니다. 목록에서 하나를 고르세요.`;
        }
        return "이 맵에 없는 대상입니다. 목록에서 고르세요.";
    }
  }

  const choose = (eventId: string): void => {
    input.value = eventId;
    close();
    onSelect(eventId);
    sync();
  };

  const render = (): void => {
    const catalog = getCatalog();
    const matches = matchEventTargets(catalog, query ?? "");
    clearChildren(dropdown);
    highlighted = -1;
    if (matches.length === 0) {
      dropdown.append(
        el("div", {
          class: "move-route-target-picker-empty",
          text: catalog.entries.length === 0
            ? `맵 «${catalog.mapName}» 에는 이동시킬 다른 이벤트가 없습니다.`
            : "검색과 맞는 이벤트가 없습니다. 이름이나 ID 일부를 입력하세요.",
        })
      );
      rows = [];
      return;
    }
    rows = matches.map((entry) => {
      const node = el("button", {
        class: "move-route-target-option",
        attrs: {
          type: "button",
          role: "option",
          "aria-selected": "false",
          // 이름과 id 를 한 줄에 함께 보여 준다 — 어느 쪽으로 검색해도 결과가 스스로를 설명한다.
          title: `${entry.label} — ${entry.id}`,
        },
        dataset: { testid: `move-route-event-option-${entry.id}`, eventId: entry.id },
        on: {
          // Keep focus on the input: native change/blur would remove this row
          // before click. Selection still belongs to click, not a cancelled press.
          mousedown: (event) => event.preventDefault(),
          click: () => choose(entry.id),
        },
        children: [
          el("span", { class: "move-route-target-option-name", text: entry.label }),
          el("span", { class: "move-route-target-option-id", text: entry.id }),
          el("span", { class: "move-route-target-option-meta", text: `${entry.x},${entry.y}` }),
        ],
      });
      return { id: entry.id, node };
    });
    for (const row of rows) dropdown.append(row.node);
  };

  const open = (): void => {
    if (!isEventTarget()) return;
    // The parent's capture-phase Escape handler runs before input keydown.
    // Participate in that same stack while open, rather than racing it.
    if (dropdown.hidden) registerModal(dropdown, close);
    dropdown.hidden = false;
    input.setAttribute("aria-expanded", "true");
    render();
  };

  const highlight = (index: number): void => {
    if (rows.length === 0) return;
    const next = Math.min(Math.max(index, 0), rows.length - 1);
    rows.forEach((row, position) => {
      const active = position === next;
      // (fakeDom 호환) classList.toggle 대신 add/remove.
      if (active) row.node.classList.add("highlighted");
      else row.node.classList.remove("highlighted");
      row.node.setAttribute("aria-selected", active ? "true" : "false");
    });
    highlighted = next;
  };

  const openButton = el("button", {
    class: "btn small move-route-target-picker-open",
    text: "목록",
    attrs: { type: "button", title: "이 맵의 이벤트를 이름·ID 로 검색해 고릅니다" },
    dataset: { testid: "move-route-event-picker-open" },
    on: {
      click: () => {
        if (dropdown.hidden) {
          open();
          input.focus?.();
        } else close();
      },
    },
  });

  input.addEventListener("input", () => {
    // 타자를 치는 동안만 상자 값이 검색어다.
    query = input.value;
    if (dropdown.hidden) open();
    else render();
    sync();
  });
  input.addEventListener("focus", open);
  // Direct-ID commits and actual focus loss close immediately. Option presses
  // retain input focus, so no delayed close can outlive a selection or reopen.
  input.addEventListener("change", close);
  input.addEventListener("blur", close);
  input.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (dropdown.hidden) {
      if (key === "ArrowDown") {
        event.preventDefault();
        open();
      }
      return;
    }
    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        highlight(highlighted + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        highlight(highlighted - 1);
        break;
      case "Enter":
        if (highlighted >= 0 && rows[highlighted]) {
          event.preventDefault();
          choose(rows[highlighted].id);
        }
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  });

  const onOutsidePointer = (event: Event): void => {
    // 폼은 replaceCommand 로 여러 번 다시 그려진다. 떼어진 폼의 리스너를 그대로 두면
    // document 리스너가 편집 횟수만큼 쌓인다 — 자기 입력이 문서에서 사라지면 스스로 내려온다.
    if (input.isConnected === false) {
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      close();
      return;
    }
    const target = event.target as Node | null;
    if (!target) return;
    if (dropdown.contains(target) || input.contains(target) || openButton.contains(target)) return;
    close();
  };
  document.addEventListener("pointerdown", onOutsidePointer, true);

  sync();
  return { dropdown, openButton, sync, close };
}
