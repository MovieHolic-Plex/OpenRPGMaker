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
