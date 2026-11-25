// 편집 중 지시의 빠른 적용 — 영역 지시 「여기 상점 만들어 줘」는 짓고 바로 돌려준다. 검사는 막지 않고 경고로 남긴다.
// 오너(2026-11-25): «영역 지시는 1,2분 안에 끝났으면 좋겠는데. 우선 깔고, 그 후에 검증하고 사용자에게 뭐 경고가 날라가게 … 적당히 하는 게 중요하다.»
// 실측(assistant-measure-r2 상점 342초): build_region_place 는 8초였고, 끝맺음 관문이 짚은 것을 할 일로 4번 되돌려 넣어
// 비평가 3번(79초)·꾸미기 17번(62초)·검토자(14초)가 돌았다. 영역 장소 턴은 관문·검토자·화면 검수를 돌리지 않고,
// 관문이 본 문제는 결과 카드의 경고(v2.fast.warnings)와 보고의 «확인할 것» 으로만 남긴다.
import { REGION_PLACE_NOTE_MARK } from "@/ai/intentDeclaration";
import type { V2GateProblem } from "../judge/finishGate";
import type { PiAssistantV2Env } from "../shared/env";

/** 결과 카드에 싣는 경고 수 상한 — 꼭 필요한 것만(오너: 적당히). 나머지는 보고에만. */
export const FAST_WARNING_LIMIT = 3;

/** 이 요청이 선택 영역에 장소를 짓는 지시인가 — 패널이 붙인 영역 장소 노트(formatRegionPlaceNote)로 가린다. */
export function fastApplyTurn(task: unknown): boolean {
  return typeof task === "string" && task.includes(REGION_PLACE_NOTE_MARK);
}

export interface FastWarning {
  readonly key: string;
  readonly text: string;
  readonly detail: string;
}

/** 관문 줄을 카드용 짧은 줄로 — 「[게임 검사 방 쓰임] 도구점: … — tile_erase 로 …」 → 「도구점: …」. */
export function shortWarning(text: string): string {
  const body = text.replace(/^\s*\[[^\]]*\]\s*/u, "").replace(/\s+/gu, " ").trim();
  const cut = body.split(/\s—\s|\. |(?<=다)\.\s?/u)[0]!.trim();
  return cut.length > 72 ? `${cut.slice(0, 71)}…` : cut;
}

export function fastWarnings(problems: readonly V2GateProblem[]): FastWarning[] {
  const seen = new Set<string>();
  const out: FastWarning[] = [];
  for (const p of problems) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    out.push({ key: p.key, text: shortWarning(p.text), detail: p.text.slice(0, 400) });
  }
  return out;
}

export function noteFastWarnings(env: PiAssistantV2Env, problems: readonly V2GateProblem[], autoNotes: string[]): FastWarning[] {
  const warnings = fastWarnings(problems);
  env.emit({ type: "execution_status", name: "v2.fast.warnings", ok: warnings.length === 0,
    summary: warnings.length ? `바로 적용함 · 확인할 것 ${warnings.length}건: ${warnings.slice(0, FAST_WARNING_LIMIT).map((w) => w.text).join(" / ")}` : "바로 적용함 · 확인할 것 없음",
    data: { warnings: warnings.slice(0, FAST_WARNING_LIMIT), total: warnings.length } });
  if (warnings.length) autoNotes.push(`바로 적용했다 — 확인할 것 ${warnings.length}건(결과 카드의 「고치기」로 맡길 수 있음): ${warnings.map((w) => w.text).join(" / ")}`);
  return warnings;
}
