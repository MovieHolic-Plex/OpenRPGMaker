// 도트 미리보기 무대의 「반복」 버튼 상태. 기본은 켬이고, 사용자가 끄면 다음 실행에도 꺼진 채로 둔다(qa1124 D4 리드 결정).
// 스킬 탭·도트 연출 탭·몬스터 스킬 무대가 같은 값을 쓴다.
const STORAGE_KEY = "oprn.stagePreview.repeat";
let cached: boolean | undefined;

export function stageRepeatEnabled(): boolean {
  if (cached === undefined) {
    try {
      cached = globalThis.localStorage?.getItem(STORAGE_KEY) !== "off";
    } catch {
      cached = true;
    }
  }
  return cached;
}

export function setStageRepeatEnabled(enabled: boolean): void {
  cached = enabled;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // 저장소를 못 쓰는 환경(사생활 모드 등)에서는 이번 실행 동안만 기억한다.
  }
}
