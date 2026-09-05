import { captureSuccessRate, type CaptureModel } from "@/project/monsterCollection";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/**
 * 포획률(0~1)의 실효 성공률을 HP 구간별로 보여준다. 저작값 1.0 이 만HP에서 30% 인
 * 사실이 어느 화면에도 없었다 — 권위는 monsterCollection.captureSuccessRate.
 * battleModel 을 store 에서 읽어 gen1 프로젝트에는 gen1 공식(만HP 33%)을 보여준다 —
 * 프리뷰가 rm2k3 공식만 알면 gen1 프로젝트에서 실측과 다른 수치를 표시하게 된다.
 */
export function capturePreviewLine(captureRate: number, testid: string): HTMLElement {
  const model: CaptureModel = store.getCurrent().system.battleModel === "gen1" ? "gen1" : "rm2k3";
  const percent = (currentHp: number): string =>
    `${Math.round(captureSuccessRate(captureRate, currentHp, 100, 1, { model }) * 100)}%`;
  return el("p", {
    class: "db-capture-preview",
    dataset: { testid },
    text: `성공 확률${model === "gen1" ? " (Gen1)" : ""} — 만HP ${percent(100)} / HP 50% ${percent(50)} / HP 10% ${percent(10)} · 기본 볼, 상태 보너스 없음`,
  });
}
