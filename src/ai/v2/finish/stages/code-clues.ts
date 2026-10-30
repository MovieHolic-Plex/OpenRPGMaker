// 번호 자물쇠 ↔ 단서 대사 맞추기 + 청사진 영문 id 대사 고치기(codeClues.ts) — 모델이 지은 경로에도 돈다.
import type { FinishStage } from "../types";
import { alignCodeClues, fixDigitClaims, humanizeBlueprintTokens } from "../../codeClues";
import { dropStaleChainClues } from "../../clueObjects";

export const stage: FinishStage = {
  id: "code-clues", phase: "blueprint", order: 50,
  run({ env, done }) {
    // 앞 판 경로 빌드가 남긴 죽은 단서 고리(주는 것을 아무도 안 받는 ev_chain_*)를 먼저 걷는다 — 틀린 번호를 주는 단서가 남지 않게(clueObjects.ts).
    const stale = dropStaleChainClues(env.ctx.project);
    if (stale.notes.length) done.push(`앞 판 단서 고리 정리: ${stale.notes.join("·").slice(0, 300)}(지금 청사진에 없고 주는 것을 아무도 받지 않음)`);
    const aligned = alignCodeClues(stale.project);
    const digits = fixDigitClaims(aligned.project);
    const human = humanizeBlueprintTokens(digits.project);
    env.ctx.project = human.project;
    const fixed = [...aligned.notes, ...digits.notes, ...(human.notes.length ? [`청사진 id 대사 ${human.notes.length}줄을 뜻 낱말로`] : [])];
    if (fixed.length) done.push(`번호·단서 대사: ${fixed.join(" / ").slice(0, 500)}`);
  },
};
