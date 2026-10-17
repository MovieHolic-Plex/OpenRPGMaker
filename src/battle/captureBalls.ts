// 포켓몬식 «조건부 볼»: 포획 도구(captureProfile)가 선언한 조건이 맞으면 포획 확률 배율이 오른다.
// 볼 등급(poke/great/ultra/master)과 별개로 겹친다 — 그물 볼은 물·벌레 타입에게 ×3.5, 퀵 볼은 첫 차례에 ×5, 타이머 볼은 차례가 지날수록 커진다, 리피트 볼은 이미 도감에 있는 종에게 ×3.5.
// 선언형 네 종류뿐이다(자유 코드 없음). 타입은 종·적의 타입 id(system.typeChart.types)와 비교한다.
import { withJosa } from "@/util/josa";
import type { ItemCaptureCondition, ItemCaptureConditionKind } from "@/project/types";

export const CAPTURE_CONDITION_KINDS: readonly ItemCaptureConditionKind[] = ["type", "firstTurn", "turns", "repeat"];
export const CAPTURE_CONDITION_MIN_MULTIPLIER = 1.1;
export const CAPTURE_CONDITION_MAX_MULTIPLIER = 8;
export const CAPTURE_CONDITION_LABELS: Readonly<Record<ItemCaptureConditionKind, string>> = {
  type: "특정 타입에게 강함",
  firstTurn: "첫 차례에 강함",
  turns: "차례가 지날수록 강해짐",
  repeat: "이미 도감에 있는 종에게 강함",
};

export interface CaptureConditionContext {
  /** 지금까지 끝난 차례 수(첫 차례 = 0). */
  readonly turn: number;
  /** 대상 몬스터의 타입 id. */
  readonly targetTypes: readonly string[];
  /** 이 종을 이미 잡은 적이 있는가(도감 기록). */
  readonly speciesCaught: boolean;
}

function clampMultiplier(value: unknown, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.max(CAPTURE_CONDITION_MIN_MULTIPLIER, Math.min(CAPTURE_CONDITION_MAX_MULTIPLIER, number)) * 100) / 100;
}

/** 필수 매개변수가 빠진 조건은 버린다(undefined) — 효과 없는 볼이 조용히 생기지 않게. */
export function normalizeCaptureCondition(raw: unknown): ItemCaptureCondition | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const kind = record.kind as ItemCaptureConditionKind;
  if (!CAPTURE_CONDITION_KINDS.includes(kind)) return undefined;
  switch (kind) {
    case "type": {
      const types = Array.isArray(record.types) ? [...new Set(record.types.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim().slice(0, 40)))].slice(0, 6) : [];
      return types.length > 0 ? { kind, types, multiplier: clampMultiplier(record.multiplier, 3.5) } : undefined;
    }
    case "firstTurn": return { kind, multiplier: clampMultiplier(record.multiplier, 5) };
    case "repeat": return { kind, multiplier: clampMultiplier(record.multiplier, 3.5) };
    case "turns": {
      const step = typeof record.step === "number" && Number.isFinite(record.step) ? Math.round(Math.max(0.05, Math.min(2, record.step)) * 100) / 100 : 0.3;
      return { kind, multiplier: clampMultiplier(record.multiplier, 4), step };
    }
  }
}

/** 이 조건이 지금 만드는 포획 배율(1 = 해당 없음). */
export function captureConditionMultiplier(condition: ItemCaptureCondition | undefined, context: CaptureConditionContext): number {
  if (!condition) return 1;
  switch (condition.kind) {
    case "type": return condition.types?.some((type) => context.targetTypes.includes(type)) ? condition.multiplier : 1;
    case "firstTurn": return context.turn <= 0 ? condition.multiplier : 1;
    case "repeat": return context.speciesCaught ? condition.multiplier : 1;
    case "turns": return Math.min(condition.multiplier, Math.round((1 + Math.max(0, context.turn) * (condition.step ?? 0.3)) * 100) / 100);
  }
}

/** 메뉴·도구 설명용 한 줄(「물·벌레 타입 ×3.5」). typeName 으로 타입 이름을 바꿔 쓴다. */
export function captureConditionLabel(condition: ItemCaptureCondition, typeName: (id: string) => string = (id) => id): string {
  switch (condition.kind) {
    case "type": return `${(condition.types ?? []).map(typeName).join("·")} 타입 ×${condition.multiplier}`;
    case "firstTurn": return `첫 차례 ×${condition.multiplier}`;
    case "repeat": return `도감에 있는 종 ×${condition.multiplier}`;
    case "turns": return `차례마다 +${condition.step ?? 0.3} (최대 ×${condition.multiplier})`;
  }
}

/** 조건이 맞아 확률이 올랐다는 전투 문장. */
export function captureConditionLine(condition: ItemCaptureCondition, itemName: string): string {
  switch (condition.kind) {
    case "type": return `${withJosa(itemName, "이/가")} 이 타입에게 잘 듣는 것 같다!`;
    case "firstTurn": return `${withJosa(itemName, "이/가")} 첫 차례라서 힘을 발휘한다!`;
    case "repeat": return `${withJosa(itemName, "이/가")} 낯익은 종에게 잘 듣는 것 같다!`;
    case "turns": return `${withJosa(itemName, "이/가")} 시간이 지나 점점 강해졌다!`;
  }
}
