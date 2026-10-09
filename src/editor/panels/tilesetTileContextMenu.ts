// 타일셋 DB 타일 그림판 셀 우클릭 메뉴 — 의미(라벨·설명) 편집 / 통행 / 레이어 / 번호 복사.

import { ensureTileMeta, metadataForTile } from "@/editor/panels/tilesetMetadataControls";
import {
  markUserTileRuntimeMetadata,
  setTileLayerOverride,
  userTileLayerOverride,
  type TileLayerChoice,
} from "@/editor/runtimeTileMetadata";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { store } from "@/project/store";
import { blockedFlag, isBlockedPassage, passableFlag } from "@/project/tilesetPassage";
import { el } from "@/util/dom";

type MenuItem = {
  readonly id: string;
  readonly label: string;
  readonly testId: string;
  readonly disabled?: boolean;
  readonly separatorBefore?: boolean;
  /** 있으면 menuitemradio 로 낸다 — 레이어 3택처럼 배타 선택인 항목. */
  readonly checked?: boolean;
  readonly action: () => void;
};

let activeMenu: HTMLElement | null = null;
let activeCleanup: (() => void) | null = null;
let activeDialog: HTMLElement | null = null;

export function openTilesetTileContextMenu(input: {
  readonly tilesetId: string;
  readonly tile: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly rerender: () => void;
}): void {
  const tileset = store.getCurrent().tilesets[input.tilesetId];
  if (!tileset || input.tile < 0 || input.tile >= tileset.count) return;

  closeTilesetTileContextMenu();
  const meta = metadataForTile(tileset, input.tile);
  const blocked = isBlockedPassage(tileset.passability[input.tile]);
  const layer = userTileLayerOverride(tileset, input.tile);
  const labelPreview = meta.label.trim() || "(라벨 없음)";

  const items: MenuItem[] = [
    {
      id: "edit-meaning",
      label: `의미 편집… (${labelPreview.slice(0, 18)})`,
      testId: "tileset-ctx-edit-meaning",
      action: () => openMeaningDialog(input.tilesetId, input.tile, input.rerender),
    },
    {
      id: "toggle-passage",
      // 예전 라벨의 "(O)"/"(X)" 는 단축키처럼 읽혔다. 무엇으로 바뀌는지만 쓴다.
      label: blocked ? "통행 허용으로 바꾸기" : "통행 차단으로 바꾸기",
      testId: "tileset-ctx-toggle-passage",
      separatorBefore: true,
      action: () => {
        store.update((project) => {
          const target = project.tilesets[input.tilesetId];
          if (!target) return;
          const nextBlocked = !isBlockedPassage(target.passability[input.tile]);
          target.passability[input.tile] = nextBlocked ? blockedFlag() : passableFlag();
          markUserTileRuntimeMetadata(target, input.tile, { passage: nextBlocked ? "solid" : "passable" });
        });
        input.rerender();
      },
    },
    {
      id: "layer-auto",
      label: "레이어 · 자동",
      checked: layer === null,
      testId: "tileset-ctx-layer-auto",
      separatorBefore: true,
      action: () => setLayer(input.tilesetId, input.tile, "auto", input.rerender),
    },
    {
      id: "layer-lower",
      label: "레이어 · 하위",
      checked: layer === "lower",
      testId: "tileset-ctx-layer-lower",
      action: () => setLayer(input.tilesetId, input.tile, "lower", input.rerender),
    },
    {
      id: "layer-upper",
      label: "레이어 · 상위",
      checked: layer === "upper",
      testId: "tileset-ctx-layer-upper",
      action: () => setLayer(input.tilesetId, input.tile, "upper", input.rerender),
    },
    {
      id: "copy-id",
      label: `타일 번호 복사 · ${input.tile}`,
      testId: "tileset-ctx-copy-id",
      separatorBefore: true,
      action: () => {
        void navigator.clipboard?.writeText(String(input.tile)).catch(() => {
          /* ignore */
        });
      },
    },
  ];

  const menu = el("div", {
    class: "map-context-menu tileset-tile-context-menu",
    attrs: {
      role: "menu",
      tabindex: "-1",
      "aria-label": `타일 ${input.tile} 메뉴`,
    },
    dataset: { testid: "tileset-tile-context-menu", tile: String(input.tile) },
  });

  for (const item of items) {
    menu.append(renderItem(item));
  }
  document.body.append(menu);
  activeMenu = menu;
  positionMenu(menu, input.clientX, input.clientY);

  const onPointerDown = (event: PointerEvent): void => {
    if (!activeMenu || !(event.target instanceof Node)) return;
    // 메뉴 안 클릭만 유지. 바깥 클릭 시 닫기(타일 그림판 스크롤 컨테이너 포함).
    if (!activeMenu.contains(event.target)) closeTilesetTileContextMenu();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    // 캡처 단계에서 가로채 DB 모달 Escape 닫기를 막는다.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeTilesetTileContextMenu();
  };
  const doc = document as Document & {
    addEventListener?: typeof document.addEventListener;
    removeEventListener?: typeof document.removeEventListener;
  };
  doc.addEventListener?.("pointerdown", onPointerDown, true);
  doc.addEventListener?.("keydown", onKey, true);
  activeCleanup = () => {
    doc.removeEventListener?.("pointerdown", onPointerDown, true);
    doc.removeEventListener?.("keydown", onKey, true);
  };

  const first = menu.querySelector<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])');
  first?.focus();
}

export function closeTilesetTileContextMenu(): void {
  activeCleanup?.();
  activeCleanup = null;
  activeMenu?.remove();
  activeMenu = null;
}

let dialogKeyHandler: ((event: KeyboardEvent) => void) | null = null;

export function closeTilesetMeaningDialog(): void {
  const doc = document as Document & {
    removeEventListener?: typeof document.removeEventListener;
  };
  if (dialogKeyHandler) {
    doc.removeEventListener?.("keydown", dialogKeyHandler, true);
    dialogKeyHandler = null;
  }
  activeDialog?.remove();
  activeDialog = null;
}

/** DB 모달 Escape 가드 — 중첩 오버레이가 열려 있으면 true. */
export function isTilesetTileOverlayOpen(): boolean {
  return activeMenu !== null || activeDialog !== null;
}

function setLayer(tilesetId: string, tile: number, choice: TileLayerChoice, rerender: () => void): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) setTileLayerOverride(target, tile, choice);
  });
  rerender();
}

function openMeaningDialog(tilesetId: string, tile: number, rerender: () => void): void {
  closeTilesetMeaningDialog();
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) return;
  const meta = metadataForTile(tileset, tile);

  const labelInput = el("input", {
    attrs: { type: "text", maxlength: "80", placeholder: "예: 우편함, 가로 벤치 좌" },
    value: meta.label,
    dataset: { testid: "tileset-meaning-dialog-label" },
  }) as HTMLInputElement;

  const descInput = el("textarea", {
    text: meta.description,
    attrs: { rows: "5", placeholder: "배치 규칙·용도를 한국어로 (AI·검색에 쓰임)" },
    dataset: { testid: "tileset-meaning-dialog-description" },
  }) as HTMLTextAreaElement;

  const backdrop = el("div", {
    class: "tileset-meaning-dialog-backdrop",
    dataset: { testid: "tileset-meaning-dialog" },
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": `타일 ${tile} 의미 편집` },
  });

  const save = (): void => {
    store.update((project) => {
      const target = project.tilesets[tilesetId];
      if (!target) return;
      const slot = ensureTileMeta(target, tile);
      slot.label = labelInput.value.trim();
      slot.description = descInput.value.trim();
      slot.source = "user";
      slot.userLocked = true;
    });
    closeTilesetMeaningDialog();
    rerender();
  };

  const panel = el("div", {
    class: "tileset-meaning-dialog-panel",
    children: [
      el("header", {
        class: "tileset-meaning-dialog-header",
        children: [
          // 이름을 붙이려는 그림을 실제로 보여준다 — 예전에는 미리보기가 하나도 없어서
          // 볼 수 없는 칩에 이름을 지어야 했다(창이 시트를 가린 채로).
          el("div", {
            class: "tileset-meaning-dialog-thumb",
            attrs: {
              style: `${tilesetTileBackgroundStyle(tileset, tile, 48)};width:48px;height:48px`,
              "aria-hidden": "true",
            },
            dataset: { testid: "tileset-meaning-dialog-thumb" },
          }),
          el("strong", { text: `${tile}번 타일 · 의미 편집` }),
          el("button", {
            class: "tileset-meaning-dialog-close",
            text: "×",
            attrs: { type: "button", "aria-label": "닫기" },
            dataset: { testid: "tileset-meaning-dialog-close" },
            on: { click: () => closeTilesetMeaningDialog() },
          }),
        ],
      }),
      el("div", {
        class: "tileset-meaning-dialog-body",
        children: [
          el("label", {
            class: "tileset-meaning-field",
            children: [el("span", { text: "라벨" }), labelInput],
          }),
          el("label", {
            class: "tileset-meaning-field",
            children: [el("span", { text: "설명" }), descInput],
          }),
          el("p", {
            class: "tileset-meaning-hint",
            text: "적용하면 이 타일은 「사람이 확정한 지식」이 되어 AI 재분석이 덮지 않습니다.",
          }),
        ],
      }),
      el("footer", {
        class: "tileset-meaning-dialog-footer",
        children: [
          el("button", {
            class: "database-footer-button",
            text: "취소",
            attrs: { type: "button" },
            dataset: { testid: "tileset-meaning-dialog-cancel" },
            on: { click: () => closeTilesetMeaningDialog() },
          }),
          el("button", {
            class: "database-footer-button primary",
            text: "적용",
            attrs: { type: "button" },
            dataset: { testid: "tileset-meaning-dialog-apply" },
            on: { click: () => save() },
          }),
        ],
      }),
    ],
  });

  backdrop.append(panel);
  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) closeTilesetMeaningDialog();
  });
  dialogKeyHandler = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      // 의미 편집만 닫고 데이터베이스 모달은 유지.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeTilesetMeaningDialog();
      return;
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      save();
    }
  };
  const doc = document as Document & {
    addEventListener?: typeof document.addEventListener;
  };
  doc.addEventListener?.("keydown", dialogKeyHandler, true);

  document.body.append(backdrop);
  activeDialog = backdrop;
  try {
    labelInput.focus();
    labelInput.select();
  } catch {
    /* fake DOM may not support focus */
  }
}

function renderItem(item: MenuItem): HTMLButtonElement {
  // map-context-menu-item 그리드: 16px 아이콘 | 라벨 | 단축키
  // 라벨만 넣으면 첫 칸(16px)에 들어가 한글 한 글자만 보임 → 빈 아이콘/단축키 슬롯 유지.
  return el("button", {
    class: [
      "map-context-menu-item",
      "tileset-tile-context-item",
      item.disabled ? "disabled" : "",
      item.separatorBefore ? "separator-before" : "",
    ]
      .filter(Boolean)
      .join(" "),
    attrs: {
      type: "button",
      // 배타 선택은 menuitemradio + aria-checked 로 낸다. 예전에는 평범한 menuitem 라벨 앞에
      // "✓" 글자만 붙여서 보조기술이 선택 상태를 전혀 알 수 없었다.
      role: item.checked === undefined ? "menuitem" : "menuitemradio",
      ...(item.checked === undefined ? {} : { "aria-checked": String(item.checked) }),
      tabindex: "-1",
      "aria-disabled": String(Boolean(item.disabled)),
      title: item.label,
    },
    dataset: { testid: item.testId },
    children: [
      el("span", {
        class: "map-context-menu-icon",
        attrs: { "aria-hidden": "true" },
        text: item.checked ? "✓" : " ",
      }),
      el("span", { class: "map-context-menu-label", text: item.label }),
      el("span", { class: "map-context-menu-shortcut", text: "" }),
    ],
    on: {
      click: (event) => {
        event.preventDefault();
        if (item.disabled) return;
        closeTilesetTileContextMenu();
        item.action();
      },
    },
  }) as HTMLButtonElement;
}

function positionMenu(menu: HTMLElement, x: number, y: number): void {
  const margin = 4;
  const viewW = typeof window !== "undefined" ? window.innerWidth : 800;
  const viewH = typeof window !== "undefined" ? window.innerHeight : 600;
  const menuW = menu.offsetWidth || 220;
  const menuH = menu.offsetHeight || 180;
  const left = Math.max(margin, Math.min(x, viewW - menuW - margin));
  const top = Math.max(margin, Math.min(y, viewH - menuH - margin));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}
