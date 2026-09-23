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

export type CaptureDifficultyId = "very-easy" | "easy" | "normal" | "hard" | "legendary";

export type CaptureDifficulty = {
  readonly id: CaptureDifficultyId;
  readonly label: string;
  /** 이 단계를 고르면 저장할 대표 계수 — 다시 읽으면 같은 단계로 분류된다. */
  readonly representativeRate: number;
};

/**
 * 계수 대신 보여 줄 난이도 말. 기준은 **HP 절반·기본 볼** 성공 확률
 * (monsterCollection.captureSuccessRate — rm2k3 는 계수×0.65, Gen1 은 계수×2/3):
 *   55% 이상 매우 쉬움 · 35% 이상 쉬움 · 15% 이상 보통 · 5% 이상 어려움 · 그 아래 전설.
 * 기본 계수 0.3(절반 HP ≈20%)이 「보통」에 들어오도록 잡았다. 대표 계수 1.0/0.7/0.4/0.15/0.05 는
 * 두 공식 모두에서 자기 단계로 되돌아온다.
 */
export const CAPTURE_DIFFICULTIES: readonly CaptureDifficulty[] = [
  { id: "very-easy", label: "매우 쉬움", representativeRate: 1 },
  { id: "easy", label: "쉬움", representativeRate: 0.7 },
  { id: "normal", label: "보통", representativeRate: 0.4 },
  { id: "hard", label: "어려움", representativeRate: 0.15 },
  { id: "legendary", label: "전설", representativeRate: 0.05 },
];

const CAPTURE_DIFFICULTY_FLOORS: readonly number[] = [0.55, 0.35, 0.15, 0.05, 0];

export function captureDifficulty(captureRate: number): CaptureDifficulty {
  const model: CaptureModel = store.getCurrent().system.battleModel === "gen1" ? "gen1" : "rm2k3";
  const halfHp = captureSuccessRate(captureRate, 50, 100, 1, { model });
  const index = CAPTURE_DIFFICULTY_FLOORS.findIndex((floor) => halfHp >= floor);
  return CAPTURE_DIFFICULTIES[index < 0 ? CAPTURE_DIFFICULTIES.length - 1 : index];
}
