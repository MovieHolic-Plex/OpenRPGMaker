import { captureSuccessRate } from "@/project/monsterCollection";
import { el } from "@/util/dom";

/**
 * 포획률(0~1)의 실효 성공률을 HP 구간별로 보여준다. 저작값 1.0 이 만HP에서 30% 인
 * 사실이 어느 화면에도 없었다 — 권위는 monsterCollection.captureSuccessRate.
 */
export function capturePreviewLine(captureRate: number, testid: string): HTMLElement {
  const percent = (currentHp: number): string => `${Math.round(captureSuccessRate(captureRate, currentHp, 100, 1) * 100)}%`;
  return el("p", {
    class: "db-capture-preview",
    dataset: { testid },
    text: `포획 확률 — 만HP ${percent(100)} / HP 50% ${percent(50)} / HP 10% ${percent(10)}`,
  });
}
