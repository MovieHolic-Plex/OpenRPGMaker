// src/editor/workshop/gateBadge.ts
/**
 * 후보 카드의 3/4 관문 조언 배지(pass / refer / fail). 공방 굽기는 막지 않는다 — 공방 그림은 이 게임에만 들어간다.
 * 판정은 _core/workshop/gateAdvice.ts(관문 지시문·규칙, 판정자 1표, 미보정)라 번들·공용·스토어 출구 영수증이 아니다.
 * 조수 「없는 기물」 카드(aiObjectGenCard.ts)와 공방 판 화면(workshopRoundView.ts)이 같이 쓴다.
 */
import type { WorkshopRun } from "@/harnesses/_core/workshop/types";
import { el } from "@/util/dom";

const LABELS = { pass: "3/4 통과", refer: "3/4 애매", fail: "3/4 미달" } as const;

/** 배지 하나. 아직 안 쟀으면(그리는 중·관문 없는 하네스) null. */
export function gateBadge(run: WorkshopRun): HTMLElement | null {
  const gate = run.gate;
  if (!gate) return null;
  const why = gate.reasons.length ? gate.reasons.join(" · ") : gate.state === "pass" ? "윗면·앞면이 3/4 로 읽힘" : "";
  const top = gate.topRows !== null ? ` · 윗면 ${gate.topRows}행` : "";
  return el("span", {
    class: `ws-gate-badge is-${gate.state}`,
    text: `${LABELS[gate.state]}${top}`,
    dataset: { gate: gate.state, testid: "workshop-gate-badge" },
    attrs: { title: `3/4 관문 조언(${gate.kind || "종류 없음"}, 판정 1번 — 참고용, 넣기를 막지 않아요). ${why}`.trim() },
  });
}
