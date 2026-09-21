// 이벤트 페이지의 몸 크기와 통행 행 입력.
// 2차 스펙 docs/superpowers/specs/2026-08-30-character-body-vs-passage-rect-design.md §5.
//
// 몸 크기는 조사·전투·점유·렌더 중앙을 지배하고, 통행 행 수는 그 중 하단 몇 줄이
// 실제로 길을 막는지 정한다. 3x3 몸 + 통행 1행 = "상체 뒤로 지나가되 말은 걸리는" 골렘.

import { el } from "@/util/dom";
import { updateEventPage } from "@/editor/eventPages";
import {
  CHARACTER_FOOTPRINT_AXIS_MAX,
  UNIT_FOOTPRINT,
  normalizeCharacterFootprint,
  normalizeCharacterScale,
  normalizePassRows,
} from "@/project/footprint";
import { eventGraphicRenderScale, renderFootprintPreview } from "./eventGraphicPreview";
import { isAutomaticCharacterScale } from "@/project/characterScale";
import { mapTileSize } from "@/project/tileGeometry";
import { store } from "@/project/store";
import type { CharacterFootprint, EventPage, MapId } from "@/project/types";

/**
 * 몸 크기에서 파생하는 렌더 배율.
 *
 * 캐릭터셋 한 칸은 24x32 이고 타일은 16x16 이라, **1x1 캐릭터도 이미 가로 1.5칸·세로 2칸**을
 * 시각적으로 차지한다(RM2K3 관례). 그래서 배율을 타일 수로 나눠 맞추면 1x1 이 0.67 로
 * 쪼그라들어 기존 모습이 깨진다. 대신 **타일 수를 그대로 배율로 쓴다** — 1x1 은 1(항등),
 * 2x2 는 2(골렘 픽스처가 이미 쓰는 값), 3x3 은 3. 어느 크기에서도 캐릭터 비례가 같다.
 *
 * 축 중 큰 쪽을 쓰는 이유: 1x3 기둥에 폭(1)을 쓰면 3칸 몸에 2칸짜리 그림이 붙는다.
 */
export function derivedScaleForBody(footprint: CharacterFootprint): number {
  return Math.max(footprint.width, footprint.height);
}

/** 기존 명시 배율은 보존한다. 신규 자동 설정만 맵 크기를 따라간다. */
function isManualScale(page: EventPage): boolean {
  return !isAutomaticCharacterScale(page.graphic);
}

function axisInput(testid: string, value: number, max: number): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", min: "1", max: String(max), step: "1" },
    value: String(value),
    dataset: { testid },
  }) as HTMLInputElement;
}

function labeled(label: string, control: HTMLElement, hint?: string): HTMLElement {
  return el("label", {
    class: "event-footprint-field",
    attrs: hint ? { title: hint } : undefined,
    children: [el("span", { text: label }), control],
  });
}

export function renderPageFootprint(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const body = normalizeCharacterFootprint(page.footprint);
  const passRows = normalizePassRows(page.passRows, body.height);
  const manual = isManualScale(page);
  const tileSize = mapTileSize(store.getCurrent().maps[mapId]);

  const control = el("div", {
    class: "event-footprint-control",
    dataset: { testid: "event-page-footprint-control" },
  });

  const widthInput = axisInput("event-page-body-width", body.width, CHARACTER_FOOTPRINT_AXIS_MAX);
  const heightInput = axisInput("event-page-body-height", body.height, CHARACTER_FOOTPRINT_AXIS_MAX);
  const passInput = axisInput("event-page-pass-rows", passRows, body.height);
  const scaleInput = el("input", {
    attrs: { type: "number", min: "0.25", max: "8", step: "0.25" },
    value: String(eventGraphicRenderScale(page.graphic, tileSize)),
    dataset: { testid: "event-page-body-scale" },
  }) as HTMLInputElement;
  const manualToggle = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-page-body-scale-manual" },
  }) as HTMLInputElement;
  manualToggle.checked = manual;

  const summary = el("p", {
    class: "event-footprint-summary",
    dataset: { testid: "event-page-footprint-summary" },
    text: footprintSummary(body, passRows),
  });
  const previewHost = el("div", {
    class: "event-footprint-preview-host",
    dataset: { testid: "event-page-footprint-preview-host" },
    children: [renderFootprintPreview({ graphic: page.graphic, footprint: body, passRows, tileSize })],
  });

  /**
   * 한 패치로 몸 크기·통행 행·배율을 같이 쓴다. 셋을 따로 커밋하면 중간 상태에서
   * passRows > height 가 되어 불변식이 깨진 프로젝트가 저장될 수 있다.
   *
   * 저장 뒤에는 이 컨트롤이 **자기 표시면을 직접 갱신한다**. 패널 재렌더에 기대면
   * 스피너에 포커스가 남은 동안 미리보기가 이전 크기로 굳는다.
   */
  function commit(next: { width: number; height: number; rows: number }): void {
    const footprint: CharacterFootprint = {
      width: clamp(next.width, CHARACTER_FOOTPRINT_AXIS_MAX),
      height: clamp(next.height, CHARACTER_FOOTPRINT_AXIS_MAX),
    };
    // 몸 높이를 줄이면 통행 행도 같이 줄인다 — UI 가 불변식을 유지한다.
    const rows = Math.min(clamp(next.rows, CHARACTER_FOOTPRINT_AXIS_MAX), footprint.height);
    const scale = manualToggle.checked
      ? normalizeCharacterScale(Number.parseFloat(scaleInput.value))
      : derivedScaleForBody(footprint);
    const graphic: EventPage["graphic"] = { ...page.graphic, scale, scaleMode: manualToggle.checked ? "manual" : "auto" };
    updateEventPage(mapId, eventId, page.id, { footprint, passRows: rows, graphic });
    reflect(footprint, rows, graphic);
  }

  /** 커밋한 값을 입력·문구·미리보기에 되비춘다. 클램프 결과가 화면에 보여야 한다. */
  function reflect(footprint: CharacterFootprint, rows: number, graphic: EventPage["graphic"]): void {
    widthInput.value = String(footprint.width);
    heightInput.value = String(footprint.height);
    passInput.value = String(rows);
    passInput.max = String(footprint.height);
    scaleInput.value = String(eventGraphicRenderScale(graphic, tileSize));
    summary.textContent = footprintSummary(footprint, rows);
    previewHost.replaceChildren(renderFootprintPreview({ graphic, footprint, passRows: rows, tileSize }));
  }

  function currentFields(): { width: number; height: number; rows: number } {
    return {
      width: Number.parseInt(widthInput.value, 10),
      height: Number.parseInt(heightInput.value, 10),
      rows: Number.parseInt(passInput.value, 10),
    };
  }

  for (const input of [widthInput, heightInput, passInput, scaleInput]) {
    input.addEventListener("change", () => commit(currentFields()));
  }
  manualToggle.addEventListener("change", () => {
    scaleInput.disabled = !manualToggle.checked;
    commit(currentFields());
  });
  scaleInput.disabled = !manual;

  control.append(
    el("div", {
      class: "event-footprint-body",
      children: [
        el("div", {
          class: "event-footprint-grid",
          children: [
            labeled("몸 폭", widthInput, "타일 단위. 조사·전투·점유가 이 사각을 쓴다"),
            labeled("몸 높이", heightInput, "타일 단위. 발밑 칸에서 위로 자란다"),
            labeled("통행 차단 행", passInput, "몸 사각 하단에서 몇 줄이 길을 막는가"),
          ],
        }),
        previewHost,
      ],
    }),
    summary,
    el("div", {
      class: "event-footprint-scale",
      children: [
        el("label", {
          class: "event-footprint-scale-manual",
          attrs: { title: "끄면 맵의 타일 크기와 몸 크기에 맞춰 캐릭터를 정수 배율로 확대합니다" },
          children: [manualToggle, el("span", { text: "배율 직접 지정" })],
        }),
        labeled("배율", scaleInput, "그림 크기. 몸 사각과 독립이다"),
      ],
    })
  );
  return control;
}

function clamp(value: number, max: number): number {
  if (!Number.isSafeInteger(value)) return 1;
  return Math.max(1, Math.min(max, value));
}

export function footprintSummary(body: CharacterFootprint, passRows: number): string {
  const size = `${body.width}x${body.height}`;
  if (body.width === UNIT_FOOTPRINT.width && body.height === UNIT_FOOTPRINT.height) {
    return "1칸 — 한 칸을 차지하고 그 칸이 길을 막습니다.";
  }
  if (passRows >= body.height) {
    return `${size} — ${body.width * body.height}칸 전부가 길을 막습니다.`;
  }
  return `${size} 중 하단 ${passRows}행(${body.width * passRows}칸)만 길을 막습니다. `
    + `위 ${body.height - passRows}행은 뒤로 지나갈 수 있고, 조사는 몸 전체로 받습니다.`;
}
