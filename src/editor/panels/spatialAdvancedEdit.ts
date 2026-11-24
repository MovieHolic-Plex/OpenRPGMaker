// 공간 「고급 편집」 스위치 (qa1124-space PR8, 오너 11 「공간은 90% 는 AI 만 쓴다고 가정하라」).
//
// 기본은 꺼짐: 오브젝트 상세는 그림·이름·크기와 「조수에게 시키기」·「고급 편집 열기」만 보인다.
// 켜면 지금까지의 칸 그리기·앵커·삭제 미리보기 편집기가 그대로 나온다(코드는 지우지 않는다 — 되돌릴 수 있게).
// 같은 일은 조수 도구(upsert_spatial_design·edit_spatial_occurrence)가 한다. 스위치는 ⌘K 「공간: 고급 편집」 으로도 켠다.
const STORAGE_KEY = "oprn:spatial-advanced-edit";
let memoryValue: boolean | undefined;

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function spatialAdvancedEdit(): boolean {
  if (memoryValue !== undefined) return memoryValue;
  memoryValue = storage()?.getItem(STORAGE_KEY) === "1";
  return memoryValue;
}

export function setSpatialAdvancedEdit(on: boolean): void {
  memoryValue = on;
  try {
    if (on) storage()?.setItem(STORAGE_KEY, "1");
    else storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* 저장이 막힌 창(사생활 모드)에서는 이번 세션만 기억한다 */
  }
}

/** 테스트 격리용 — 저장값을 다시 읽게 한다. */
export function resetSpatialAdvancedEditForTests(): void {
  memoryValue = undefined;
}
