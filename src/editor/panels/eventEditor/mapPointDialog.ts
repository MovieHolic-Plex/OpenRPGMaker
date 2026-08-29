// 맵 위 한 칸을 눈으로 고르는 공용 서브다이얼로그.
//
// 왜 필요한가 (실측): 생활 이동 목적지는 233px 레일에서 X/Y 숫자칸에 좌표를 손으로 적는
// 유일한 경로였다. 저작자는 "(12, 7) 이 어디인지" 를 맵 캔버스로 돌아가 세어야 했고,
// 맵 밖 좌표를 적어도 저장 시점의 검증기(`validateMapPosition`)에서야 알 수 있었다.
//
// 「장소 이동」다이얼로그(`transferPlayerDialog.ts`)가 이미 같은 일을 하지만 시그니처가
// transfer 커맨드(페이드·방향)에 묶여 있다. 여기서는 렌더러(`drawTransferMapPreview`)만
// 재사용하고 맵 트리 대신 맵 select 를 쓴다 — 레일에서 열리는 작은 창이라 트리가 과하다.
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { el } from "@/util/dom";
import { mapSelectElement } from "./sharedPickers";
import { openEventSubdialog } from "./subdialog";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";

export type MapPoint = {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
};

export type MapPointDialogRequest = {
  readonly title: string;
  readonly point: MapPoint;
  readonly testIdPrefix: string;
  readonly onApply: (point: MapPoint) => void;
};

const ZOOM_STEPS = [1, 0.5, 0.25] as const;

export function openMapPointDialog(request: MapPointDialogRequest): void {
  openEventSubdialog({
    title: request.title,
    testId: `${request.testIdPrefix}-dialog`,
    width: "wide",
    render: (body, close) => renderMapPointPicker(body, request, close),
  });
}

function renderMapPointPicker(body: HTMLElement, request: MapPointDialogRequest, close: () => void): void {
  const project = store.getCurrent();
  const fallbackMapId = Object.keys(project.maps)[0] ?? "";
  const draft = {
    mapId: project.maps[request.point.mapId] ? request.point.mapId : fallbackMapId,
    x: request.point.x,
    y: request.point.y,
    zoom: 1 as number,
  };

  const canvas = el("canvas", { dataset: { testid: `${request.testIdPrefix}-canvas` } }) as HTMLCanvasElement;
  const preview = el("div", { class: "transfer-player-preview map-point-preview", children: [canvas] });
  const status = el("div", { class: "map-point-status", dataset: { testid: `${request.testIdPrefix}-status` } });
  const zoomRow = el("div", { class: "map-point-zoom" });
  let renderVersion = 0;

  const mapSelect = mapSelectElement({
    selectedId: draft.mapId,
    testid: `${request.testIdPrefix}-map`,
    allowEmpty: false,
    onChange: (mapId) => {
      draft.mapId = mapId;
      // 맵을 바꾸면 이전 좌표가 범위 밖일 수 있다. 새 맵 안으로 끌어다 놓는다.
      clampDraftIntoMap();
      rerender();
    },
  });

  const clampDraftIntoMap = (): void => {
    const map = store.getCurrent().maps[draft.mapId];
    if (!map) return;
    draft.x = clamp(draft.x, 0, map.width - 1);
    draft.y = clamp(draft.y, 0, map.height - 1);
  };

  const rerender = (): void => {
    renderVersion += 1;
    const version = renderVersion;
    const current = store.getCurrent();
    const fitDisplay = {
      maxWidth: Math.max(1, preview.clientWidth - 4),
      maxHeight: Math.max(1, preview.clientHeight - 4),
    };
    drawTransferMapPreview({
      canvas,
      project: current,
      mapId: draft.mapId,
      selection: draft,
      fitDisplay,
      isCurrent: () => version === renderVersion,
    }).catch(() => {
      if (version !== renderVersion) return;
      drawTransferFallback({ canvas, map: current.maps[draft.mapId], selection: draft, fitDisplay });
    });
    status.textContent = statusLabel(draft.mapId, draft.x, draft.y);
    for (const button of zoomRow.querySelectorAll("button")) {
      button.classList.toggle("active", button.textContent === zoomLabel(draft.zoom));
    }
  };

  canvas.addEventListener("click", (event) => {
    const map = store.getCurrent().maps[draft.mapId];
    if (!map) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    draft.x = clamp(Math.floor(((event.clientX - rect.left) * scaleX) / map.tileSize), 0, map.width - 1);
    draft.y = clamp(Math.floor(((event.clientY - rect.top) * scaleY) / map.tileSize), 0, map.height - 1);
    rerender();
  });

  for (const zoom of ZOOM_STEPS) {
    zoomRow.append(el("button", {
      class: "transfer-player-zoom-button" + (zoom === draft.zoom ? " active" : ""),
      text: zoomLabel(zoom),
      attrs: { type: "button" },
      on: {
        click: () => {
          draft.zoom = zoom;
          rerender();
        },
      },
    }));
  }

  body.append(el("div", {
    class: "map-point-dialog cream-command-form",
    children: [
      el("div", {
        class: "map-point-head",
        children: [
          el("label", { class: "map-point-map-label", children: [el("span", { text: "맵" }), mapSelect] }),
          zoomRow,
        ],
      }),
      preview,
      el("div", {
        class: "map-point-foot",
        children: [
          status,
          el("button", {
            class: "transfer-player-button map-point-ok",
            text: "이 칸으로",
            attrs: { type: "button" },
            dataset: { testid: `${request.testIdPrefix}-ok` },
            on: {
              click: () => {
                request.onApply({ mapId: draft.mapId, x: draft.x, y: draft.y });
                close();
              },
            },
          }),
          el("button", {
            class: "transfer-player-button map-point-cancel",
            text: "취소",
            attrs: { type: "button" },
            dataset: { testid: `${request.testIdPrefix}-cancel` },
            on: { click: close },
          }),
        ],
      }),
    ],
  }));

  // 레이아웃이 정해진 뒤에야 preview.clientWidth 가 0 이 아니다 — fit-to-box 배율이 여기 달렸다.
  const schedule = typeof globalThis.requestAnimationFrame === "function"
    ? (callback: () => void) => globalThis.requestAnimationFrame(callback)
    : (callback: () => void) => globalThis.setTimeout(callback, 0);
  schedule(() => rerender());
  rerender();
}

function statusLabel(mapId: MapId, x: number, y: number): string {
  const map = store.getCurrent().maps[mapId];
  return `${map?.name ?? mapId} · (${x}, ${y})`;
}

export function mapPointLabel(mapId: MapId, x: number, y: number): string {
  return statusLabel(mapId, x, y);
}

function zoomLabel(zoom: number): string {
  return zoom === 1 ? "1x" : zoom === 0.5 ? "2x 축소" : "4x 축소";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
