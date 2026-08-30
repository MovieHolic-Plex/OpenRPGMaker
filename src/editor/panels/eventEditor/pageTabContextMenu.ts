// 왜 있는가 (실측 2026-08-30): 명령 목록은 우클릭 메뉴(`event-command-context-menu`)로
// 잘라내기·복사·붙여넣기·삭제를 주는데, **같은 편집기 안의 페이지 탭은 우클릭에 아무 반응이
// 없었다**. 같은 화면에서 상호작용 모델이 두 갈래였고, 페이지 관리는 모달 오른쪽 끝
// 접힌 아코디언에만 있었다. 탭 자리에서 바로 조작할 수 있어야 한다.
//
// 메뉴 스킨은 명령 메뉴와 같은 `.event-command-context-menu` 를 쓴다 — 편집기의 유일한
// 컨텍스트 메뉴 스킨이므로 새로 만들면 두 벌이 갈린다.
//
// 삭제 확인은 `requestDelete` 로 주입받는다 — pageProps 에서 직접 import 하면 두 모듈이
// 서로를 참조하는 순환이 된다.
import { el } from "@/util/dom";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { copyEventPage, copyEventPageToClipboard, hasCopiedEventPage, moveEventPage, pasteEventPage } from "@/editor/eventPages";
import { toast } from "@/util/toast";
import { store } from "@/project/store";
import type { EventPage, GameEvent, MapId } from "@/project/types";

const MENU_TEST_ID = "event-page-context-menu";
let closeOpenMenu: (() => void) | null = null;

export interface PageTabContextMenuRequest {
  readonly x: number;
  readonly y: number;
  readonly mapId: MapId;
  readonly event: GameEvent;
  readonly page: EventPage;
  readonly index: number;
  readonly requestDelete: (page: EventPage) => void;
}

interface PageMenuItem {
  readonly label: string;
  readonly shortcut: string;
  readonly icon: string;
  readonly testId: string;
  readonly run: () => void;
  readonly disabled?: boolean;
}

export function openPageTabContextMenu(request: PageTabContextMenuRequest): void {
  closeOpenMenu?.();
  const menu = el("div", {
    class: "event-command-context-menu event-page-context-menu",
    attrs: { role: "menu", "aria-label": "페이지 관리" },
    dataset: { testid: MENU_TEST_ID },
  });
  let closed = false;
  let closeOnOutside: (event: MouseEvent) => void;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("mousedown", closeOnOutside);
    unregisterModal(menu);
    menu.remove();
    if (closeOpenMenu === close) closeOpenMenu = null;
  };
  closeOnOutside = (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    close();
  };
  closeOpenMenu = close;
  menu.append(...pageMenuItems(request, close).map(menuButton));
  document.body.append(menu);
  // Escape 는 메뉴만 닫는다.
  //
  // 메뉴의 keydown 핸들러만으로는 부족하다(실측): 이벤트 편집기는 focus trap 을 깔아 둔다.
  // 메뉴는 모달 DOM 밖(document.body)이라 포커스가 모달로 되돌리어지고, 그 상태의 Escape 는
  // **이벤트 편집기를 닫으려 하며 "적용하지 않은 변경" 확인창을 띄운다**. 모달 스택 최상단을
  // 잡아야 Escape 가 여기서 멈췄다.
  registerModal(menu, close);
  const rect = menu.getBoundingClientRect();
  const left = Math.min(request.x, window.innerWidth - rect.width - 8);
  const top = Math.min(request.y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  document.addEventListener("mousedown", closeOnOutside);
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    // Escape 는 메뉴만 닫는다 — 버블되면 이벤트 편집기 모달까지 닫힌다.
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  menu.querySelector<HTMLElement>(`[data-testid="event-page-menu-duplicate"]`)?.focus();
}

function pageMenuItems(request: PageTabContextMenuRequest, close: () => void): PageMenuItem[] {
  const { mapId, event, page } = request;
  const livePages = () => store.getCurrent().maps[mapId]?.events.find((candidate) => candidate.id === event.id)?.pages ?? [];
  const liveIndex = () => livePages().findIndex((candidate) => candidate.id === page.id);
  const pageCount = livePages().length;
  return [
    {
      label: "복제",
      shortcut: "",
      icon: "copy",
      testId: "event-page-menu-duplicate",
      run: () => {
        close();
        if (!copyEventPage(mapId, event.id, page.id)) return;
        toast(`"${page.name}" 페이지를 복제했어요.`, "ok");
      },
    },
    {
      label: "복사",
      shortcut: "",
      icon: "copy",
      testId: "event-page-menu-copy",
      run: () => {
        close();
        if (!copyEventPageToClipboard(mapId, event.id, page.id)) return;
        toast(`"${page.name}" 페이지를 복사해 뒀어요.`, "ok");
      },
    },
    {
      label: "붙여넣기",
      shortcut: "",
      icon: "paste",
      testId: "event-page-menu-paste",
      disabled: !hasCopiedEventPage(),
      run: () => {
        close();
        // 기지는 우클릭한 페이지다 — 이 메뉴의 다른 항목과 같은 대상을 쓴다(우클릭은 선택을 움기지 않는다).
        if (!pasteEventPage(mapId, event.id, page.id)) return;
        toast("복사해 둔 페이지를 붙여넣었어요.", "ok");
      },
    },
    {
      label: "앞으로 옮기기",
      shortcut: "Ctrl+←",
      icon: "",
      testId: "event-page-menu-move-back",
      disabled: liveIndex() <= 0,
      run: () => {
        close();
        if (!moveEventPage(mapId, event.id, page.id, -1)) return;
        toast(`"${page.name}" 페이지를 앞으로 옮겼어요.`, "ok");
      },
    },
    {
      label: "뒤로 옮기기",
      shortcut: "Ctrl+→",
      icon: "",
      testId: "event-page-menu-move-forward",
      disabled: liveIndex() < 0 || liveIndex() >= pageCount - 1,
      run: () => {
        close();
        if (!moveEventPage(mapId, event.id, page.id, 1)) return;
        toast(`"${page.name}" 페이지를 뒤로 옮겼어요.`, "ok");
      },
    },
    {
      label: "삭제",
      shortcut: "",
      icon: "delete",
      testId: "event-page-menu-delete",
      disabled: pageCount <= 1,
      run: () => {
        close();
        request.requestDelete(page);
      },
    },
  ];
}

function menuButton(item: PageMenuItem): HTMLButtonElement {
  const attrs: Record<string, string> = { type: "button", role: "menuitem" };
  if (item.disabled) attrs.disabled = "";
  return el("button", {
    class: "event-command-menu-item",
    attrs,
    children: [
      el("span", { class: `event-command-menu-icon ${item.icon}`, attrs: { "aria-hidden": "true" } }),
      el("span", { class: "event-command-menu-label", text: item.label }),
      el("span", { class: "event-command-menu-shortcut", text: item.shortcut }),
    ],
    dataset: { testid: item.testId },
    on: { click: item.run },
  }) as HTMLButtonElement;
}
