import { switchVariablePicker } from "./switchVariablePicker";
import type { RecordKind } from "./recordKinds";

type SwitchVariableKind = "switch" | "variable";
type DatabaseRecordKind = "item" | "actor";

type IdPickerParams = {
  readonly kind: SwitchVariableKind;
  readonly currentId: string;
  readonly inputTestId: string;
  readonly pickerTestId: string;
  readonly onChange: (id: string) => void;
};

type RecordSelectParams = {
  readonly kind: DatabaseRecordKind;
  readonly currentId: string;
  readonly testId: string;
  readonly onChange: (id: string) => void;
  /**
   * 트리거 버튼 testid. 생략하면 `${testId}` 에서 `-input` 을 떼고 `-picker-open` 을 붙인다
   * (event-page-item-condition-input → event-page-item-condition-picker-open).
   */
  readonly pickerTestId?: string;
};

/** 페이지 조건 슬롯용 — 공용 switchVariablePicker 를 밀도 높은 레이아웃으로 감싼다. */
export function switchVariableIdPicker(params: IdPickerParams): HTMLElement {
  return switchVariablePicker({
    kind: params.kind,
    selectedId: params.currentId,
    onChange: params.onChange,
    selectTestId: params.inputTestId,
    pickerTestId: params.pickerTestId,
    keepMissingId: true,
    showFilter: false,
    className: "event-condition-id-picker",
  }).root;
}

/**
 * 아이템·주인공 조건 슬롯.
 *
 * 예전에는 네이티브 <select> 를 그대로 돌려줬다. 좁은 조건 칸에서 폭이 눌려
 * "0001: 회복약" 같은 값이 읽히지 않았고, 같은 폼의 스위치·변수는 모달 픽커라
 * 한 화면에서 선택 방식이 두 갈래로 갈렸다. 이제 넷 다 같은 트리거 컨트롤을 쓴다.
 *
 * 반환 타입이 HTMLSelectElement → HTMLElement 로 바뀌었다. 숨은 select 는 루트 안에
 * 그대로 남으므로 `[data-testid=...-input]` 셀렉터와 selectOption 은 계속 동작한다.
 */
export function databaseRecordSelect(params: RecordSelectParams): HTMLElement {
  return switchVariablePicker({
    kind: params.kind as RecordKind,
    selectedId: params.currentId,
    onChange: params.onChange,
    selectTestId: params.testId,
    pickerTestId: params.pickerTestId ?? defaultPickerTestId(params.testId),
    // 삭제된/유령 itemId·actorId도 선택 상태로 보이게 한다(스위치 피커와 동일).
    // 없으면 값이 조용히 "(선택)"으로 떨어져 조건이 비어 보이는 착시가 난다.
    keepMissingId: true,
    showFilter: false,
    className: "event-condition-id-picker",
  }).root;
}

function defaultPickerTestId(inputTestId: string): string {
  const base = inputTestId.endsWith("-input") ? inputTestId.slice(0, -"-input".length) : inputTestId;
  return `${base}-picker-open`;
}
