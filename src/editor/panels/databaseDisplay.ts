import type { CommonEvent } from "@/project/types";

export function ordinalLabel(index: number): string {
  return String(index + 1).padStart(4, "0");
}

export function numberedName(index: number, name: string): string {
  return `${ordinalLabel(index)}: ${name || "(이름 없음)"}`;
}

export const COMMON_EVENT_TRIGGER_OPTIONS = [
  { value: "none", label: "호출" },
  { value: "auto", label: "자동 실행" },
  { value: "parallel", label: "병렬 처리" },
] as const satisfies readonly { readonly value: CommonEvent["trigger"]; readonly label: string }[];

export function commonEventTriggerLabel(trigger: CommonEvent["trigger"]): string {
  return COMMON_EVENT_TRIGGER_OPTIONS.find((option) => option.value === trigger)?.label ?? trigger;
}
