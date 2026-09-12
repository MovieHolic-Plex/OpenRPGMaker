export type FailureClassification = {
  readonly regressions: readonly string[];
  readonly newFileFailures: readonly string[];
  readonly attribution: "known" | "unknown";
};

/**
 * 실패 파일을 기준선과 대조해 «기존 파일 회귀» 와 «기준선 이후 신규 파일» 로 가른다.
 * `isNewFile` 을 넘기지 않으면 미지의 파일은 전부 회귀로 남는다(fail-safe).
 */
export function classifyTestFailures(input: {
  readonly failedFiles?: readonly string[];
  readonly baselineFailedFiles?: readonly string[];
  readonly isNewFile?: (path: string) => boolean;
}): FailureClassification;
