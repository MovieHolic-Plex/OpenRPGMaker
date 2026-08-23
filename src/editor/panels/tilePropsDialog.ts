// editor/panels/tilePropsDialog.ts
// 선택 타일의 속성(통행 · 지면 종류 · 매핑 메타) 편집 창.
//
// 왜 좌패널 인라인이 아니라 창인가 —
// 2026-08-21 좌패널 1면 통합에서 처음에는 접이식 인라인 섹션으로 넣었다. 실측이
// 그 판단을 부정했다: 인스펙터 본문이 **346px**(좌패널 전체 526px 의 66%)라서
// 펼치면 타일 팔레트가 273px → **2px** 로 붕괴했다(min-height 160px 도 못 막았다).
// 타일 고르기가 이 패널의 주 작업이므로, 속성은 창으로 뺀다. 팔레트는 항상 온전하고
// 속성은 필요할 때 넓은 화면에서 편집한다.
//
// 진입: 선택 타일 칩의 ⚙ (tilePalette.ts).

import { renderTileMappingInspector } from "@/editor/panels/tileMappingInspector";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function openTilePropsDialog(selectedTile: number, tileset: TilesetDef): void {
  if (typeof document === "undefined") return;
  // 이미 열려 있으면 새로 쌓지 않는다 (칩을 두 번 눌러도 창 하나).
  if (document.querySelector('[data-testid="tile-props-dialog"]')) return;

  const backdrop = el("div", {
    class: "tile-props-dialog-backdrop",
    dataset: { testid: "tile-props-dialog" },
  });
  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
  };
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  registerModal(backdrop, close);

  const hasTile = selectedTile >= 0 && selectedTile < tileset.count;
  const header = el("header", { class: "tile-props-dialog-head" });
  if (hasTile) {
    header.append(
      el("span", {
        class: "tile-props-dialog-thumb",
        attrs: { "aria-hidden": "true", style: tilesetTileBackgroundStyle(tileset, selectedTile, 24) },
      })
    );
  }
  header.append(el("h2", { text: "타일 속성" }));
  header.append(el("span", { class: "tile-props-dialog-tileset", text: tileset.name, attrs: { title: tileset.name } }));
  header.append(
    el("button", {
      class: "tile-props-dialog-close",
      text: "×",
      attrs: { type: "button", title: "닫기 (Esc)", "aria-label": "닫기" },
      dataset: { testid: "tile-props-dialog-close" },
      on: { click: close },
    })
  );

  const body = el("main", { class: "tile-props-dialog-body" });
  if (!hasTile) {
    body.append(el("div", { class: "empty-hint", text: "팔레트에서 타일을 먼저 고르세요." }));
  } else {
    body.append(renderTileMappingInspector(selectedTile, tileset));
  }

  backdrop.append(el("div", { class: "tile-props-dialog-panel", children: [header, body] }));
  document.body.append(backdrop);
}
