import { openRecordPickerPanel } from "./recordPickerPanel";
import type { RecordKind } from "./recordKinds";

type RecordPickerRequest = {
  readonly kind: RecordKind;
  readonly currentId: string;
  readonly onSelect: (id: string) => void;
};

export { openRecordPickerPanel };
export type { RecordPickerRequest };
