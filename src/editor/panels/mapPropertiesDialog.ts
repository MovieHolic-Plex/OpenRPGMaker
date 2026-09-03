// editor/panels/mapPropertiesDialog.ts
// 「맵 설정」 창을 여는 단일 진입점.
//
// 왜 별 모듈인가: 이 창은 맵 트리(더블클릭·⋯ 메뉴)와 타일 팔레트 칩(타일셋 이름) 두 곳에서
// 열린다. mapList.ts 안의 비공개 함수였을 때 팔레트가 그걸 쓰려면 맵 패널 모듈 전체를 끌어와야
// 했다 — 패널끼리의 의존은 도크가 아니라 이런 작은 공용 모듈로 잇는다. 창의 정본(맵의 타일
// 그림판을 바꾸는 유일한 집)은 renderMapProps 이고, 여기서는 그 창을 열고 원하는 컨트롤에
// 초점을 옮기는 일만 한다 — 두 번째 편집 표면을 만들지 않는다(헤더 IA 규칙 「한 동작에 집 하나」).

import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import { renderMapProps } from "@/editor/panels/mapProps";
import { selectEditorMap } from "@/editor/mapSelection";
import type { MapId } from "@/project/types";

/** 창을 열자마자 초점을 둘 컨트롤. `tileset` = 「타일 그림판」 선택. */
export type MapPropertiesFocus = "tileset";

const FOCUS_TESTID: Record<MapPropertiesFocus, string> = {
  tileset: "map-props-tileset-select",
};

export function openMapPropertiesDialog(
  mapId: MapId,
  mapName: string,
  options: { readonly focus?: MapPropertiesFocus } = {},
): void {
  selectEditorMap(mapId);
  openEventSubdialog({
    render: (body) => renderMapProps(body),
    testId: `map-properties-modal-${mapId}`,
    title: "맵 설정",
    subtitle: mapName,
    width: "narrow",
  });
  if (options.focus) focusMapPropertiesControl(mapId, FOCUS_TESTID[options.focus]);
}

/**
 * 창 안의 컨트롤에 초점을 준다. 창은 네이티브 select 를 커스텀 셀렉트(트리거 버튼,
 * `data-custom-select-for=<select testid>`)로 감싸고 select 자체는 숨기므로, 트리거가 있으면
 * 그쪽을 잡고 없으면 select 를 잡는다. openEventSubdialog 는 동기적으로 조립을 끝내므로
 * 반환 직후에 찾아도 된다.
 */
function focusMapPropertiesControl(mapId: MapId, controlTestId: string): void {
  if (typeof document === "undefined") return;
  const dialog = document.querySelector<HTMLElement>(`[data-testid="map-properties-modal-${mapId}"]`);
  if (!dialog) return;
  const target =
    dialog.querySelector<HTMLElement>(`[data-custom-select-for="${controlTestId}"]`)
    ?? dialog.querySelector<HTMLElement>(`[data-testid="${controlTestId}"]`);
  if (!target) return;
  target.scrollIntoView?.({ block: "center" });
  target.focus?.({ preventScroll: true });
  // 프로그램 초점은 :focus-visible 링을 못 그리는 브라우저가 많다 — 어디로 보내졌는지 1.6초 동안
  // 링을 깜박여 알린다(event-editor.custom-select.css 의 .is-attention).
  target.classList?.add?.("is-attention");
  globalThis.setTimeout?.(() => target.classList?.remove?.("is-attention"), ATTENTION_MS);
}

const ATTENTION_MS = 1600;
