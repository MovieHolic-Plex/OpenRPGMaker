// OPRN 진입점(우리가 쓴 파일, 원본 아님) — general-good-writing 의 polish-lint 를 판정 모델 없이 로컬 규칙만으로 돌린다.
// 원본 scripts/sdk.ts 의 lint(text, { jev: false }) 와 같은 길이다: scan(jev:null) → 보고서.
// 원본 sdk.ts 는 키 파일·TypeSafe 클라이언트(node:fs·node:crypto)를 끌어오므로 쓰지 않고, 필요한 함수만 직접 부른다.
// 이 폴더는 편집기 조수 도구 lint_dialogue 가 동적 import 로만 불러온다 — 편집기 첫 번들·내보낸 플레이어에 들어가지 않는다.
// 출처·라이선스 상태: ./README.md

import type { Lang } from "./src/core.ts";
import { PROFILES, type ProfileName } from "./src/jev/questions.ts";
import { renderText } from "./src/report/render.ts";
import { overallBand, scan, type Report } from "./src/report/scan.ts";

export type { Report } from "./src/report/scan.ts";
export type { Hit } from "./src/hits.ts";

export interface LocalLintResult {
  readonly report: Report;
  /** pass | fix | rewrite (판정 모델이 없으므로 정규식 띠). */
  readonly overall: string;
  /** 원본 CLI 의 사람용 보고서. */
  readonly text: (ui?: Lang) => string;
}

export async function lintLocal(text: string, opts: { readonly lang?: Lang; readonly profile?: ProfileName } = {}): Promise<LocalLintResult> {
  const report = await scan(text, {
    lang: opts.lang ?? null,
    minSeverity: "low",
    jev: null,
    profile: PROFILES[opts.profile ?? "fiction"],
    brief: null,
    claim: null,
  });
  return { report, overall: overallBand(report), text: (ui?: Lang) => renderText(report, ui ?? null) };
}
