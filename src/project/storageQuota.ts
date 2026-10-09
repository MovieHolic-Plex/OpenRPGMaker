export class ProjectStorageQuotaError extends Error {
  readonly code = "storage-quota";
  constructor(cause: unknown) {
    super("브라우저 저장 공간이 부족합니다. 현재 작업을 프로젝트 파일로 내보내 보관한 뒤, 미디어 가져오기에서 새 온라인 사본으로 저장하거나 사용하지 않는 브라우저 사본을 정리하세요. 기존 저장본은 유지됩니다.", { cause });
    this.name = "ProjectStorageQuotaError";
  }
}

/** Browser quota names survive the transaction's stage wrapper via Error.cause. */
export function isStorageQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "QuotaExceededError"
    || error.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || error instanceof ProjectStorageQuotaError
    || (error.cause !== undefined && error.cause !== error && isStorageQuotaError(error.cause));
}
