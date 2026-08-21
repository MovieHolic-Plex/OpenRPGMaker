// 감독 데스크 모드. 지시는 쓰고, 질문은 쓰지 않고, 계획은 확인 뒤에만 쓴다.

export const DIRECTOR_MODES = {
  instruct: "instruct",
  ask: "ask",
  plan: "plan",
} as const;

export type DirectorMode = (typeof DIRECTOR_MODES)[keyof typeof DIRECTOR_MODES];

export const DIRECTOR_MODE_LABEL = {
  instruct: "지시",
  ask: "질문",
  plan: "계획",
} as const;

export type DirectorSendGate = "write" | "read-only" | "confirm-before-write";

export function parseDirectorMode(raw: string | null | undefined): DirectorMode {
  if (raw === DIRECTOR_MODES.ask || raw === DIRECTOR_MODES.plan || raw === DIRECTOR_MODES.instruct) {
    return raw;
  }
  return DIRECTOR_MODES.instruct;
}

export function sendGateForMode(mode: DirectorMode): DirectorSendGate {
  switch (mode) {
    case "ask":
      return "read-only";
    case "plan":
      return "confirm-before-write";
    case "instruct":
      return "write";
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function canApplyWrites(mode: DirectorMode, planConfirmed: boolean): boolean {
  const gate = sendGateForMode(mode);
  if (gate === "read-only") return false;
  if (gate === "confirm-before-write") return planConfirmed;
  return true;
}

export function buildPlanSteps(instruction: string): readonly string[] {
  const parts = instruction
    .split(/[\n.。!！?？]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length >= 2) return parts.slice(0, 6);
  const one = instruction.trim();
  if (!one) return ["요청 수행", "결과 검토"];
  return [one, "결과 검토"];
}

export function askModeFooter(): string {
  return "[질문 모드] 맵·이벤트·프로젝트 데이터를 수정하지 말고 설명만 하세요.";
}
