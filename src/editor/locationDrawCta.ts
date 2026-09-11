// editor/locationDrawCta.ts
// 「이 맵에는 아직 구역이 없습니다」 빈 상태의 **행동**. 조건 폼 · 구역 드나듦 트리거 ·
// 인카운터 세 표면이 같은 낱말과 같은 행동을 쓰도록 한 곳에 모았다 — 문장을 한 곳에 모으는
// `mapLocationLabels.ts` 와 같은 이유다(같은 사실을 두 낱말로 말하지 않는다).
//
// 왜 «대신 만들어 주기» 가 아니라 «켜 주기» 인가: 구역의 사각형은 저작 내용이다. 임의의 자리에
// 구역을 만들어 주면 사용자가 만들지 않은 장소가 조건·인카운터의 후보가 된다 — 로케이션 레이어
// 인스펙터의 «이 맵 전부 한 방에» 승격 버튼을 걷어낸 것과 같은 이유다
// (`openwiki/editor-pre-edit-routing.md` 의 「설계 영역 이관 도구」).
//
// 왜 토스트가 함께 나가는가: 이 CTA 를 쓰는 표면(이벤트 편집기 · 맵 설정)은 **모달**이고, 켜진
// 로케이션 레이어는 그 뒤에 가려져 있다. 켰다는 사실과 «이제 무엇을 하면 되는지» 를 지금 자리에서
// 말해 주지 않으면 버튼이 아무 일도 하지 않은 것처럼 보인다.

import { currentLocationMap, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { mapLocations } from "@/project/mapNamedLocations";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export const LOCATION_DRAW_CTA_LABEL = "맵에서 구역 그리기";

/**
 * 구역이 하나도 없는 맵에서만 버튼을 낸다. 이미 그린 사람에게는 소음이고, 이 CTA 의 문장은
 * «없다» 는 사실에만 참이기 때문이다. 맵을 아직 못 고른 부팅 중에는 null.
 */
export function renderLocationDrawCta(options: { readonly testId: string }): HTMLElement | null {
  const map = currentLocationMap();
  if (!map || mapLocations(map).length > 0) return null;
  return el("button", {
    class: "btn",
    text: LOCATION_DRAW_CTA_LABEL,
    attrs: {
      type: "button",
      title:
        "로케이션 레이어를 켭니다 — 맵에서 빈 곳을 드래그해 구역을 그리고 이름을 붙이면 " +
        "이벤트 조건과 랜덤 인카운터가 이름으로 가리킬 수 있습니다.",
    },
    dataset: { testid: options.testId },
    on: { click: () => startDrawingLocations() },
  });
}

/** 레이어를 켜고, 켠 결과가 지금 가려져 있으면 그 사실까지 말한다. */
export function startDrawingLocations(): void {
  setLocationLayerEnabled(true);
  toast(
    hasOpenModalLayer()
      ? "로케이션 레이어를 켰습니다 — 이 창을 닫으면 맵에서 빈 곳을 드래그해 구역을 그릴 수 있습니다."
      : "로케이션 레이어를 켰습니다 — 맵에서 빈 곳을 드래그해 구역을 그리세요.",
    "info",
  );
}
