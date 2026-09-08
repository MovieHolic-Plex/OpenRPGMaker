// eventEditor/eventIdReadout.ts — 선택한 이벤트의 정본 ID 를 읽기 전용으로 보여 준다.
//
// 왜 필요한가: `event.id`(=`genId("ev")` → `ev_<uuid>`)는 이벤트 명령 참조·조수 도구·
// 드래프트 검증·진단·런타임 상태가 **모두** 쓰는 정본 식별자다. 그런데 지금까지 이 값이
// 사용자에게 보이는 곳은 맵 이벤트 목록의 호버 카드(`eventMarkerUx` 의 `ID <id>`)와
// 전역 검색 결과의 detail 뿐이었다 — 둘 다 «값을 이미 알아야» 닿는 경로다.
//
// 왜 「번호」가 아닌가: 예전 모달 헤더에는 `0007` 이 있었는데 그건 ID 가 아니라 맵 events
// 배열의 순번(findIndex+1)이었고, 앞 이벤트를 지우면 밀렸다(modal.ts 의 주석 참고).
// 그래서 이 표시는 **저장된 event.id 문자열 그 자체**만 쓴다. 배열 위치·페이지 순서·표시
// 이름·연결된 characterId 에서 유도하지 않는다.
//
// 왜 `readonly` 이고 `disabled` 가 아닌가: 이 값은 사용자가 고칠 수 없지만 **복사해서
// 조수·진단에 붙여넣는 것이 주 용도**다. `disabled` 는 포커스와 키보드 선택까지 함께
// 막아 버려서 그 용도를 무너뜨린다. 그래서 잠금은 `readonly` 로만 한다.
//
// 상태를 만들지 않는다: 여기에는 change/input 핸들러가 없고 `updateEvent` 계열을 호출하는
// 경로도 없다. 그래서 상자를 만지거나 값을 스크립트로 덮어써도 프로젝트도 이벤트
// 드래프트도 더러워지지 않는다(테스트가 이걸 못 박는다).
import { el } from "@/util/dom";
import { copyTextToClipboard } from "@/util/clipboard";
import { toast } from "@/util/toast";

/**
 * `card` — 왼쪽 패널의 선택 요약처럼 폭이 있는 자리. 라벨·값·복사·도움말 한 문장 전부.
 * `chip` — 이벤트 편집 모달의 48px 제목 줄. 도움말 문장 자리가 없어 `title` 이 대신한다.
 */
export type EventIdReadoutVariant = "card" | "chip";

const LABEL = "이벤트 ID";

// 「무엇이 아닌지」를 함께 말한다 — 이벤트 이름 상자가 바로 옆에 있고, 페이지 이름·NPC
// 코드(characterId)·목록 순번이 전부 비슷하게 생긴 문자열이라 라벨만으로는 구분되지 않는다.
const HELP =
  "시스템이 배정한 고정 식별자예요. 이벤트 이름·페이지 이름·NPC 코드(characterId)·목록 순서와는 다르고, 고칠 수 없어요.";

export type EventIdReadoutOptions = {
  /** testid·id 접두사. 요약과 모달 헤더가 동시에 떠 있어도 서로를 가리지 않게 한다. */
  readonly scope: string;
  readonly variant?: EventIdReadoutVariant;
};

/**
 * 이벤트 ID 읽기 전용 표시.
 *
 * @param eventId 저장된 `event.id` 그 자체. 호출자는 절대 가공하지 않는다.
 */
export function renderEventIdReadout(eventId: string, options: EventIdReadoutOptions): HTMLElement {
  const { scope } = options;
  const variant: EventIdReadoutVariant = options.variant ?? "card";
  const labelId = `${scope}-event-id-label`;
  const hintId = `${scope}-event-id-hint`;

  const value = el("input", {
    class: "event-id-readout-value",
    value: eventId,
    attrs: {
      type: "text",
      // 값 전체를 마우스 없이도 집을 수 있어야 한다(포커스 → Ctrl+A → Ctrl+C).
      readonly: "",
      spellcheck: "false",
      autocomplete: "off",
      "aria-labelledby": labelId,
      // 칩 변형에는 도움말 문장을 붙일 자리가 없다. `display:none` 요소를 describedby 로
      // 가리키면 보조기술이 읽지 못하는 경우가 있어, 그때는 요소를 아예 만들지 않고
      // 같은 문장을 `title` 로 싣는다.
      ...(variant === "card" ? { "aria-describedby": hintId } : {}),
      // 잘려 보일 수 있는 자리에서도 전체 값을 확인할 수 있게 항상 값을 함께 담는다.
      title: variant === "card" ? `${LABEL} ${eventId}` : `${LABEL} ${eventId}\n${HELP}`,
    },
    dataset: { testid: `${scope}-event-id-value` },
  }) as HTMLInputElement;

  // 글자 라벨이다. `renderEditorIcon` 의 SVG 는 viewBox 만 갖고 width/height 가 없어서
  // 크기를 시트가 정해 줘야 하는데, 이 저장소에는 그 전역 규칙이 없다 — 실측(1440×900)에서
  // 아이콘 단추가 **8×8px** 로 찍혔다. 페이지 관리 줄(`renderPageActions` 의 «복제·복사·
  // 붙여넣기»)도 글자 라벨이라 주변과도 맞는다.
  const copy = el("button", {
    class: "event-id-readout-copy",
    text: "복사",
    attrs: { type: "button", "aria-label": `${LABEL} 복사`, title: `${LABEL} 복사` },
    dataset: { testid: `${scope}-event-id-copy` },
    on: {
      click: (event) => {
        // 요약 카드의 버튼은 이벤트 편집 열기 버튼 옆에 있다 — 클릭이 위로 새면
        // 카드 전체 동작(선택/열기)까지 딸려 실행된다.
        event.preventDefault();
        event.stopPropagation();
        void copyTextToClipboard(eventId).then((ok) => {
          // 실패를 조용히 넘기지 않는다 — 붙여넣기를 시도한 뒤에야 알게 되면
          // 사용자는 같은 버튼을 반복해서 누른다. error 토스트는 role=alert 이다.
          toast(ok ? `${LABEL}를 복사했어요.` : `${LABEL} 복사에 실패했어요. 값을 직접 선택해 복사해 주세요.`,
            ok ? "ok" : "error");
        });
      },
    },
  });

  return el("div", {
    class: "event-id-readout",
    dataset: { testid: `${scope}-event-id`, variant },
    children: [
      el("span", {
        class: "event-id-readout-label",
        text: LABEL,
        attrs: { id: labelId },
        dataset: { testid: `${scope}-event-id-label` },
      }),
      value,
      copy,
      ...(variant === "card"
        ? [
            el("p", {
              class: "event-id-readout-hint",
              text: HELP,
              attrs: { id: hintId },
              dataset: { testid: `${scope}-event-id-hint` },
            }),
          ]
        : []),
    ],
  });
}
