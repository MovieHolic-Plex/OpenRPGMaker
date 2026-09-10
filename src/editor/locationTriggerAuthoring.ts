// editor/locationTriggerAuthoring.ts
// 「구역에 들어오면/나가면」 트리거의 **저작 표면 한 곳**. 문구·기본값·선택기 DOM 이 여기 모인다.
//
// 왜 조건(`insideLocation`)과 같은 파일이 아닌가: 조건은 `conditionForm.ts` 의 조건 종류
// 스위치 안에 살고, 이 트리거는 페이지의 「시작 방식」 옆에 산다. 둘의 **공통 계약**은
// `mapLocationLabels.ts` 가 이미 갖고 있으므로(끊긴 참조를 눈에 보이게 만드는 문자열),
// 이 모듈은 그것을 재사용하고 이름 표기 규칙을 두 번 쓰지 않는다.
//
// 끊긴 참조 계약도 조건과 **똑같다**: 삭제된 로케이션은 선택기에서 사라지지 않고
// 「(삭제된 로케이션 …)」 항목으로 남는다 — 조용히 다른 구역으로 갈아치우면 사고가 데이터에 굳는다.

import { el } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { mapLocations } from "@/project/mapNamedLocations";
import { mapLocationLabel } from "@/editor/mapLocationLabels";
import type { MapNamedLocation, Project, Trigger } from "@/project/types";

export type LocationTransitionTrigger = Extract<Trigger, { kind: "locationTransition" }>;

export const LOCATION_TRANSITION_OPTIONS = [
  { value: "enter", label: "들어오면" },
  { value: "leave", label: "나가면" },
] as const satisfies readonly { readonly value: LocationTransitionTrigger["transition"]; readonly label: string }[];

/** 페이지 「시작 방식」 선택기에 실리는 낱말. TRIGGER_OPTIONS 와 같은 어조(플레이어 행동 기준). */
export const LOCATION_TRANSITION_TRIGGER_LABEL = "구역에 드나들면";

/** 이 트리거가 저작된 페이지의 한 줄 설명. 요약칩·호버 카드·페이지 요약이 공유한다. */
export function locationTransitionSentence(
  trigger: LocationTransitionTrigger,
  options: { readonly project?: Project; readonly mapId?: string } = {},
): string {
  const name = mapLocationLabel(trigger.locationId, options);
  return `주인공이 ${name} ${trigger.transition === "enter" ? "안에 들어오면" : "밖으로 나가면"}`;
}

/** 편집기 문맥의 현재 맵. 트리거는 조건과 마찬가지로 **같은 맵의 로케이션만** 가리킨다. */
export function currentEditorMapLocations(): readonly MapNamedLocation[] {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  return map ? mapLocations(map) : [];
}

/**
 * 트리거 생산기. 로케이션이 하나도 없는 맵에서도 빈 ID 로 만들 수 있게 둔다 —
 * 「저작은 되지만 실행 안 되는 상태」를 데이터에 남기고 검증기가 그걸 눈에 보이게 막는 쪽이,
 * 선택을 강제해 저작자를 막다른 길에 세우는 것보다 이 저장소의 기존 규약과 같다
 * (`insideLocation` 조건도 빈 ID 로 시작해 `eventDraftValidator` 가 잡는다).
 */
export function locationTransitionTrigger(
  previous?: Trigger,
): LocationTransitionTrigger {
  if (previous?.kind === "locationTransition") return previous;
  return {
    kind: "locationTransition",
    locationId: currentEditorMapLocations()[0]?.id ?? "",
    transition: "enter",
  };
}

/**
 * 「어느 구역, 들어옴/나감」 두 선택기. 이름으로 고르고 좌표는 절대 입력하지 않는다.
 * 끊긴 참조는 항목으로 남고 오류 문장이 같이 뜬다(조건 폼과 같은 문구 규칙).
 */
export function renderLocationTransitionTriggerFields(
  trigger: LocationTransitionTrigger,
  onChange: (next: LocationTransitionTrigger) => void,
): HTMLElement {
  const locations = currentEditorMapLocations();
  const known = locations.some((location) => location.id === trigger.locationId);
  const picker = el("select", {
    dataset: { testid: "event-page-trigger-location" },
  }) as HTMLSelectElement;
  if (trigger.locationId && !known) {
    picker.append(el("option", {
      text: `(삭제된 로케이션 ${trigger.locationId})`,
      attrs: { value: trigger.locationId },
    }));
  }
  if (locations.length === 0 && !trigger.locationId) {
    picker.append(el("option", { text: "(이 맵에 로케이션이 없습니다)", attrs: { value: "" } }));
  }
  for (const location of locations) {
    picker.append(el("option", {
      text: `${location.name} — (${location.x},${location.y}) ${location.w}×${location.h}`,
      attrs: { value: location.id },
    }));
  }
  picker.value = trigger.locationId;

  const side = el("select", {
    dataset: { testid: "event-page-trigger-location-transition" },
  }) as HTMLSelectElement;
  for (const option of LOCATION_TRANSITION_OPTIONS) {
    side.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  side.value = trigger.transition;

  const error = el("p", {
    class: "event-condition-error",
    dataset: { testid: "event-page-trigger-location-error" },
    text: known || !trigger.locationId
      ? "구역을 선택하세요. 맵의 「로케이션」 레이어에서 먼저 그려야 합니다."
      : `로케이션 '${trigger.locationId}' 이 삭제됐습니다. 다른 구역을 고르거나 시작 방식을 바꿔 주세요.`,
  });
  const syncError = (): void => {
    error.hidden = Boolean(picker.value.trim())
      && currentEditorMapLocations().some((location) => location.id === picker.value);
  };
  const apply = (): void => {
    onChange({
      kind: "locationTransition",
      locationId: picker.value,
      transition: side.value === "leave" ? "leave" : "enter",
    });
    syncError();
  };
  picker.addEventListener("change", apply);
  side.addEventListener("change", apply);
  syncError();

  return el("div", {
    class: "event-trigger-location-fields",
    dataset: { testid: "event-page-trigger-location-fields" },
    children: [
      el("div", { class: "field", children: [el("label", { text: "구역" }), picker] }),
      error,
      el("div", { class: "field", children: [el("label", { text: "시점" }), side] }),
    ],
  });
}
