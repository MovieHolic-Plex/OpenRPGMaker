// P1 이동 경로 다이얼로그 리치화 테스트 (높음-2).
// - 커맨드 버튼: 아이콘 스팬(data-glyph) 존재 + 버튼 textContent(라벨) 불변
// - 좌측 리스트 아래 경로 프리뷰: moves 변경 시 라이브 갱신
// - 스위치 레코드 피커 / 그래픽 차셋 셀렉트가 커맨드 생성 컨텍스트에 반영
// - 원시 id 입력(fill 경로) 하이브리드 동기화 유지 (e2e testid 보호)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPageMoveRouteDialog } from "@/editor/panels/eventEditor/moveRouteDialog";
import { MOVE_ROUTE_COMMAND_ROWS } from "@/editor/panels/eventEditor/moveRouteCommandCatalog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPageMovement } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

function fakeBody(): FakeElement {
  const body = (globalThis.document as unknown as { body: FakeElement }).body;
  if (!(body instanceof FakeElement)) throw new Error("fake dom body missing");
  return body;
}

function openDialog(onApply: (movement: EventPageMovement) => void = vi.fn()): FakeElement {
  openPageMoveRouteDialog({
    movement: { type: "custom", speed: 3, frequency: 3, route: { moves: [], repeat: true } },
    onApply,
  });
  const dialog = findByTestId(fakeBody(), "event-page-move-route-dialog");
  if (!dialog) throw new Error("move route dialog did not open");
  return dialog;
}

function mustFind(root: FakeElement, testId: string): FakeElement {
  const found = findByTestId(root, testId);
  if (!found) throw new Error(`missing testid: ${testId}`);
  return found;
}

function clickAddButton(dialog: FakeElement, id: string): void {
  mustFind(dialog, `event-page-move-route-add-${id}`).click();
}

function typeNumber(dialog: FakeElement, testId: string, value: string): void {
  const input = mustFind(dialog, testId);
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

describe("move route dialog rich UI", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.switches = [
      { id: "sw_alpha", name: "알파" },
      { id: "sw_beta", name: "베타" },
    ];
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders an icon span per command button while keeping the Korean label text intact", () => {
    const dialog = openDialog();
    for (const row of MOVE_ROUTE_COMMAND_ROWS) {
      for (const item of row) {
        const button = mustFind(dialog, `event-page-move-route-add-${item.testId}`);
        const icon = button.querySelector(".event-page-move-route-command-icon");
        expect(icon, item.testId).not.toBeNull();
        expect(icon?.dataset.glyph ?? "", item.testId).not.toBe("");
        // 글리프는 data-glyph(CSS ::before)로만 그려서 버튼 텍스트는 라벨 그대로다 (e2e toHaveText 보호).
        expect(button.textContent, item.testId).toBe(item.label);
      }
    }
    const moveUpIcon = mustFind(dialog, "event-page-move-route-add-move-up").querySelector(
      ".event-page-move-route-command-icon"
    );
    expect(moveUpIcon?.dataset.glyph).toBe("↑");
    // 방향 이동 버튼은 아이콘 강조 클래스를 가진다.
    expect(
      mustFind(dialog, "event-page-move-route-add-move-upper-right").classList.contains(
        "event-page-move-route-command-directional"
      )
    ).toBe(true);
    expect(
      mustFind(dialog, "event-page-move-route-add-turn-up").classList.contains(
        "event-page-move-route-command-directional"
      )
    ).toBe(false);
  });

  it("updates the route preview live as moves are added and cleared", () => {
    const dialog = openDialog();
    const preview = mustFind(dialog, "event-page-move-route-preview");
    expect(preview.textContent).toContain("이동 명령 없음");
    // repeat 체크박스 초기값(true)이 프리뷰 배지에 반영된다.
    expect(preview.textContent).toContain("반복");

    clickAddButton(dialog, "move-up");
    clickAddButton(dialog, "move-lower-right");
    expect(preview.textContent).toContain("↑");
    expect(preview.textContent).toContain("↘");
    expect(preview.textContent).not.toContain("이동 명령 없음");

    mustFind(dialog, "event-page-move-route-delete-all").click();
    expect(preview.textContent).toContain("이동 명령 없음");
  });

  it("feeds switch picker and charset select values into created route commands", () => {
    const dialog = openDialog();
    const commandList = mustFind(dialog, "event-page-move-route-command-list");
    const rawSwitchInput = mustFind(dialog, "event-page-move-route-switch-id");
    // 초기 스위치는 프로젝트 첫 스위치 id (원시 문자열 기본값 제거).
    expect(rawSwitchInput.value).toBe("sw_alpha");

    // 레코드 피커 셀렉트 선택 → 원시 입력 동기화 + setSwitch 커맨드 반영.
    const pickerSelect = mustFind(dialog, "event-page-move-route-switch-picker").querySelector("select");
    expect(pickerSelect).not.toBeNull();
    expect(pickerSelect?.value).toBe("sw_alpha");
    if (!pickerSelect) throw new Error("switch picker select missing");
    pickerSelect.value = "sw_beta";
    pickerSelect.dispatchEvent(new Event("change"));
    expect(rawSwitchInput.value).toBe("sw_beta");
    clickAddButton(dialog, "switch-on");
    expect(commandList.textContent).toContain("스위치 sw_beta ON");

    // 원시 입력(fill 경로)도 여전히 커맨드 컨텍스트를 갱신한다.
    rawSwitchInput.value = "sw_custom";
    rawSwitchInput.dispatchEvent(new Event("input"));
    clickAddButton(dialog, "switch-off");
    expect(commandList.textContent).toContain("스위치 sw_custom OFF");

    // 그래픽: 차셋 셀렉트 초기값 유지 + 선택 시 칩/원시 입력/커맨드 반영.
    const graphicSelect = mustFind(dialog, "event-page-move-route-graphic-select");
    const rawGraphicInput = mustFind(dialog, "event-page-move-route-graphic-id");
    const graphicChip = mustFind(dialog, "event-page-move-route-graphic-preview");
    expect(graphicSelect.value).toBe("tex_easyrpg_charset_people1");
    expect(rawGraphicInput.value).toBe("tex_easyrpg_charset_people1");
    expect(graphicChip.dataset.spriteId).toBe("tex_easyrpg_charset_people1");
    graphicSelect.value = "tex_easyrpg_charset_actor1";
    graphicSelect.dispatchEvent(new Event("change"));
    expect(rawGraphicInput.value).toBe("tex_easyrpg_charset_actor1");
    expect(graphicChip.dataset.spriteId).toBe("tex_easyrpg_charset_actor1");
    clickAddButton(dialog, "change-graphic");
    expect(commandList.textContent).toContain("그래픽 tex_easyrpg_charset_actor1");
  });

  // 체공 저작 경로: 스키마(heightPx/durationMs/dx/dy)는 있었지만 버튼이 기본값만 뱉어서
  // "보스가 8칸 위에서 떨어진다" 나 "두 칸 건너뛴다" 를 에디터로 만들 수 없었다.
  it("feeds hop parameters into jump and drop-in commands, omitting untouched defaults", () => {
    const onApply = vi.fn();
    const dialog = openDialog(onApply);
    const commandList = mustFind(dialog, "event-page-move-route-command-list");

    // 손대지 않은 상태(0)는 "저작하지 않음" — 예전과 같은 제자리 점프가 나온다.
    clickAddButton(dialog, "jump");
    expect(commandList.textContent).toContain("점프");

    typeNumber(dialog, "event-page-move-route-hop-dx", "2");
    typeNumber(dialog, "event-page-move-route-hop-dy", "-1");
    typeNumber(dialog, "event-page-move-route-hop-height", "48");
    typeNumber(dialog, "event-page-move-route-hop-duration", "1200");
    clickAddButton(dialog, "jump");
    clickAddButton(dialog, "drop-in");
    // 저작값은 리스트 라벨에도 보여야 한다 — 안 그러면 낙하 두 개를 구분할 수 없다.
    expect(commandList.textContent).toContain("점프 (2, -1) 48px 1200ms");
    expect(commandList.textContent).toContain("위에서 낙하 48px 1200ms");

    mustFind(dialog, "event-page-move-route-ok").click();
    const movement = onApply.mock.calls[0]?.[0] as EventPageMovement;
    expect(movement.route?.moves).toEqual([
      { kind: "jump", dx: 0, dy: 0 },
      { kind: "jump", dx: 2, dy: -1, heightPx: 48, durationMs: 1200 },
      { kind: "dropIn", heightPx: 48, durationMs: 1200 },
    ]);
  });

  it("prefills the hop fields from the route being edited", () => {
    openPageMoveRouteDialog({
      movement: {
        type: "custom",
        speed: 3,
        frequency: 3,
        route: {
          moves: [
            { kind: "jump", dx: 3, dy: 0, heightPx: 40, durationMs: 700 },
            { kind: "dropIn", heightPx: 128, durationMs: 1500 },
          ],
          repeat: true,
        },
      },
      onApply: vi.fn(),
    });
    const dialog = findByTestId(fakeBody(), "event-page-move-route-dialog");
    if (!dialog) throw new Error("move route dialog did not open");
    // dx/dy 는 점프만 가지므로 마지막 점프에서, 높이·시간은 둘이 공유하므로 마지막 체공에서 온다.
    expect(mustFind(dialog, "event-page-move-route-hop-dx").value).toBe("3");
    expect(mustFind(dialog, "event-page-move-route-hop-height").value).toBe("128");
    expect(mustFind(dialog, "event-page-move-route-hop-duration").value).toBe("1500");
  });
});
