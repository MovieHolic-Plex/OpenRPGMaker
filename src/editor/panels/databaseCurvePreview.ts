// 능력치 곡선 인라인 미리보기(주인공 성장 탭 · 직업 능력치 곡선)의 단일 출처.
//
// 왜 모듈로 뽑았나 — 이전에는 `actorRecordCurveEditors.ts` 와 `databaseClassCurveEditors.ts`
// 에 `curveBars`/`previewSampleIndexes` 가 **글자 단위로 같은 코드**로 복제돼 있었고,
// 막대 개수(33)는 TS 에, 그리드 열 개수(9)는 CSS 에 각각 하드코딩돼 있었다. CSS 는 TS 상수를
// 읽을 수 없으므로 둘의 합의를 강제할 방법이 없었고, 실측 결과 33개 막대가 9열 그리드에서
// 4행으로 접혀 막대 높이가 4~7px 로 뭉개졌다(원자료는 514→4000, 약 8배 범위였다).
//
// 그래서 두 가지를 바꿨다.
//  1) 샘플 수를 CSS 커스텀 프로퍼티 `--curve-samples` 로 **런타임에 내려보낸다.**
//     CSS 는 `grid-template-columns: repeat(var(--curve-samples, 9), 1fr)` 로 받으므로
//     막대 수와 열 수가 구조적으로 어긋날 수 없다.
//  2) 샘플 수를 12로 줄인다. 인라인 카드는 26~34px 높이라 33개를 넣으면 막대 폭이 1px 미만이
//     되고, 어차피 정밀 편집은 「능력치 곡선」 다이얼로그가 Lv1~99 전체를 크게 그려서 맡는다.
//     인라인 카드의 역할은 "모양이 어떤 경향인지"만 보여주는 스파크라인이다.
import { el } from "@/util/dom";

/** 인라인 스파크라인의 표본 개수. CSS `--curve-samples` 로 함께 내려간다. */
export const CURVE_PREVIEW_SAMPLES = 12;

/** 막대 최소 높이 비율(%). 값이 0에 가까워도 막대가 보이도록 바닥을 준다. */
const MIN_BAR_PERCENT = 6;

/** 곡선 배열에서 균등 표본 인덱스를 뽑는다. 현재 편집 중인 레벨은 항상 포함한다. */
export function curvePreviewIndexes(
  length: number,
  activeLevel: number,
  samples: number = CURVE_PREVIEW_SAMPLES,
): number[] {
  const lastIndex = Math.max(0, length - 1);
  const steps = Math.max(2, samples);
  const indexes = new Set<number>();
  for (let step = 0; step < steps; step += 1) {
    indexes.add(Math.round((step / (steps - 1)) * lastIndex));
  }
  indexes.add(Math.min(lastIndex, Math.max(0, activeLevel - 1)));
  return [...indexes].sort((left, right) => left - right);
}

/**
 * 곡선 미리보기 그래프 엘리먼트를 만든다.
 *
 * 막대 수와 `--curve-samples` 를 **같은 함수에서 함께 세우는 것**이 이 함수의 존재 이유다.
 * 호출부가 둘을 따로 관리하면 다시 어긋난다.
 */
export function curvePreviewGraph(
  className: string,
  curve: readonly number[],
  activeLevel: number,
): HTMLElement {
  const max = Math.max(...curve, 1);
  const indexes = curvePreviewIndexes(curve.length, activeLevel);
  const bars = indexes.map((index) => {
    const value = curve[index] ?? curve[curve.length - 1] ?? 1;
    const level = index + 1;
    const percent = Math.max(MIN_BAR_PERCENT, Math.round((value / max) * 100));
    return el("i", {
      class: level === activeLevel ? "active" : "",
      attrs: {
        "aria-label": `Lv${level}: ${value}`,
        "data-level": String(level),
        "data-value": String(value),
        style: `height:${percent}%`,
      },
    });
  });
  return el("div", {
    class: className,
    // 그래프 전체는 보조기술에 한 덩어리로 읽히면 소음이다 — 막대별 aria-label 로 충분하고,
    // 정확한 값 편집은 곡선 다이얼로그가 담당하므로 표(figure) 역할은 주지 않는다.
    attrs: { style: `--curve-samples:${indexes.length}` },
    children: bars,
  });
}
