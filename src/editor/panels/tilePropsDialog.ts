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
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const PASSAGE_WORDS: Readonly<Record<string, string>> = {
  "passage-up": "위", "passage-left": "왼쪽", "passage-down": "아래", "passage-right": "오른쪽",
};

/**
 * 인스펙터의 방향 칸은 「상·좌·하·우」 한 글자만 보여, 체크가 통과인지 막힘인지 알 수 없었다.
 * 이 창에서는 각 칸이 무엇을 뜻하는지 이름으로 말하고, 표 위에 같은 뜻의 설명을 둔다.
 */
function explainPassageToggles(body: HTMLElement): void {
  const grid = body.querySelector<HTMLElement>(".tile-mapping-passage-grid");
  if (!grid) return;
  const noteId = "tile-props-passage-note";
  if (!body.querySelector(`#${noteId}`)) {
    grid.before(el("p", { class: "tile-props-passage-note", attrs: { id: noteId }, text: "체크한 방향으로 지나갈 수 있어요. 끄면 그 방향은 막힙니다." }));
  }
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-describedby", noteId);
  for (const input of grid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    const word = PASSAGE_WORDS[input.dataset.testid ?? ""];
    if (word) input.setAttribute("aria-label", `${word}으로 지나갈 수 있음`.replace("위으로", "위로").replace("아래으로", "아래로"));
  }
}

export function openTilePropsDialog(selectedTile: number, openedTileset: TilesetDef): void {
  if (typeof document === "undefined") return;
  // 호출 쪽(팔레트 칩)은 맵/타일셋 전환 때만 다시 그려져 옛 스냅숏을 들고 있을 수 있다 — 열 때 최신 값을 다시 읽는다.
  const latestTileset = (): TilesetDef => store.getCurrent().tilesets[openedTileset.id] ?? openedTileset;
  let tileset = latestTileset();
  // 이미 열려 있으면 새로 쌓지 않는다 (칩을 두 번 눌러도 창 하나).
  if (document.querySelector('[data-testid="tile-props-dialog"]')) return;

  const backdrop = el("div", {
    class: "tile-props-dialog-backdrop",
    dataset: { testid: "tile-props-dialog" },
  });
  let unsubscribe: (() => void) | null = null;
  const close = (): void => {
    unsubscribe?.();
    unsubscribe = null;
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
  header.append(el("h2", { text: "타일 속성", attrs: { id: "tile-props-dialog-title" } }));
  header.append(el("span", { class: "tile-props-dialog-tileset", text: tileset.name, attrs: { title: tileset.name } }));
  header.append(
    el("button", {
      class: "tile-props-dialog-close",
      html: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
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
    explainPassageToggles(body);
    // 적용·전체 통과/막힘은 store 에 새 타일셋을 쓴다 — 바뀐 값을 바로 보이도록 인스펙터를 다시 그린다.
    unsubscribe = store.subscribe(() => {
      const next = latestTileset();
      if (next === tileset) return;
      tileset = next;
      body.replaceChildren(renderTileMappingInspector(selectedTile, tileset));
      explainPassageToggles(body);
    });
  }

  backdrop.append(el("div", {
    class: "tile-props-dialog-panel",
    attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "tile-props-dialog-title" },
    children: [header, body],
  }));
  document.body.append(backdrop);
  backdrop.querySelector<HTMLElement>(".tile-props-dialog-close")?.focus();
}
