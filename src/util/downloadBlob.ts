// util/downloadBlob.ts
// 브라우저 다운로드 트리거. menu.ts 의 exportProjectPackage/doExportWebGame 에 두 번 중복돼 있던
// 패턴을 뽑았다. 그 코드에 주석으로 박힌 과거 결함 두 가지를 여기서 한 번만 지킨다:
//   ② anchor 를 DOM 에 붙이지 않고 click() → 일부 환경에서 다운로드가 시작되지 않음
//   ③ click() 직후 동기 revokeObjectURL → 브라우저가 fetch 를 시작하기 전에 URL 무효화
// (① store.flush() reject 로 함수 전체 중단은 호출부의 책임이라 여기 없다.)

const REVOKE_DELAY_MS = 10_000;

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
