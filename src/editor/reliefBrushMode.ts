import type { ReliefBrushMode } from "@/project/relief/edit";

/**
 * 오른쪽 버튼 = 왼쪽의 반대. 올리기↔내리기, 산↔골짜기, 다듬기↔거칠게.
 * 평탄·단 지정은 반대가 따로 없으므로 0단으로 지운다(호출부가 set 의 level 을 0 으로 준다).
 */
export function reliefInverseMode(mode: ReliefBrushMode): ReliefBrushMode {
  switch (mode) {
    case "raise": return "lower";
    case "lower": return "raise";
    case "mountain": return "canyon";
    case "canyon": return "mountain";
    case "smooth": return "rough";
    case "rough": return "smooth";
    case "flatten":
    case "set": return "set";
  }
}

const RELIEF_HISTORY_LABELS: Readonly<Record<ReliefBrushMode, string>> = {
  raise: "높이 올리기",
  lower: "높이 내리기",
  flatten: "평탄",
  set: "단 지정",
  mountain: "산",
  canyon: "골짜기",
  smooth: "다듬기",
  rough: "거칠게",
};

/**
 * 높이 붓 한 획의 되돌리기 기록 이름. 기록 목록·되돌리기 툴팁이 「편집」 대신 무엇을 했는지 보인다(F10).
 * 오른쪽 버튼 단 지정은 0단으로 지우기다(reliefInverseMode 주석).
 */
export function reliefHistoryLabel(mode: ReliefBrushMode, inverted: boolean): string {
  if (inverted && mode === "set") return "높이 · 0단으로 지우기";
  return `높이 · ${RELIEF_HISTORY_LABELS[mode]}`;
}
