// 능력치 곡선 입력 보정 — 조수가 99칸 배열 대신 짧게 준 곡선을 레벨 1~99 곡선으로 채운다.
//
// 왜: normalizeParameterCurves 는 99칸 미만 배열을 **말없이 버리고** 기본 곡선(배우 Lv1 HP 514)으로 바꾼다.
// 2026-09-24 도그푸딩 「잿불 광산의 세 사람」: 기획이 「레온 높은 HP, 미라 MP 광역 마법」 을 요구했는데
// 파티 셋의 Lv1 체력·마력이 전부 514·43 이었다. 모델에게 99칸 배열 여섯 개는 비싸다 — 짧은 입력을 받아 준다.
//   [v]            Lv1 값만 — 기본 곡선과 같은 비율로 Lv99 까지 자란다.
//   [lv1, lv99]    두 끝값 — 초반에도 자라는 곡선(1차·2차 반반)으로 잇는다.
//   [v1..vn] (n<99) 레벨 1..n 값 — 뒤는 마지막 증가폭으로 이어 간다.
import { ACTOR_LEVEL_MAX } from "@/project/actorModel";

const PARAMETER_KEYS = ["maxHp", "maxMp", "attack", "defense", "mind", "agility"] as const;
/** 배우 기본 곡선의 Lv99/Lv1 비율(actorModel PARAMETER_LEVEL_ONE/NINETY_NINE). */
const GROWTH_RATIO: Readonly<Record<(typeof PARAMETER_KEYS)[number], number>> = {
  maxHp: 10, maxMp: 10, attack: 420 / 45, defense: 360 / 59, mind: 340 / 45, agility: 320 / 43,
};

/**
 * 끝값 두 개를 잇는 성장 곡선. 순수 2차 곡선(배우 기본 곡선 모양)은 초반이 거의 평평해 Lv1→Lv8 HP 가
 * 90→94 였다 — 첫 던전에서 레벨을 올려도 전투가 달라지지 않는다(2026-09-24 도그푸딩 모의전: Lv1·Lv8 결과 동일).
 * 1차·2차를 반씩 섞어 초반에도 레벨마다 눈에 띄게 자라게 한다(Lv8 ≈ +35%, Lv50 ≈ 끝값의 38%).
 */
function growth(start: number, end: number): number[] {
  return Array.from({ length: ACTOR_LEVEL_MAX }, (_, index) => {
    const ratio = index / (ACTOR_LEVEL_MAX - 1);
    return Math.round(start + (end - start) * (ratio + ratio * ratio) / 2);
  });
}

function expandCurve(key: (typeof PARAMETER_KEYS)[number], values: readonly number[]): number[] {
  if (values.length === 1) return growth(values[0]!, Math.round(values[0]! * GROWTH_RATIO[key]));
  if (values.length === 2) return growth(values[0]!, values[1]!);
  const out = [...values];
  const step = Math.max(key === "maxMp" ? 0 : 1, values[values.length - 1]! - values[values.length - 2]!);
  while (out.length < ACTOR_LEVEL_MAX) out.push(out[out.length - 1]! + step);
  return out;
}

/** patch.parameterCurves 의 짧은 배열을 99칸으로 채운다(제자리). 채운 항목마다 경고 한 줄. */
export function expandShortParameterCurves(patch: unknown, label: string, warnings: string[]): void {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  const curves = (patch as { parameterCurves?: unknown }).parameterCurves;
  if (!curves || typeof curves !== "object" || Array.isArray(curves)) return;
  const record = curves as Record<string, unknown>;
  const expanded: string[] = [];
  for (const key of PARAMETER_KEYS) {
    const value = record[key];
    if (!Array.isArray(value) || value.length === 0 || value.length >= ACTOR_LEVEL_MAX) continue;
    if (!value.every((entry) => typeof entry === "number" && Number.isFinite(entry))) continue;
    const curve = expandCurve(key, value as number[]);
    record[key] = curve;
    expanded.push(`${key} [${value.join(",")}] → Lv1 ${curve[0]} · Lv50 ${curve[49]} · Lv99 ${curve[ACTOR_LEVEL_MAX - 1]}`);
  }
  if (expanded.length > 0) {
    warnings.push(`${label}.parameterCurves 짧은 배열을 레벨 1~99 곡선으로 채웠습니다([Lv1] 또는 [Lv1, Lv99] 입력): ${expanded.join("; ")}`);
  }
}
