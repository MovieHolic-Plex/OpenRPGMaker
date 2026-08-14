// DB UI 현대화 W4 — 모던 컨트롤 프리미티브 4종 계약 검증(fakeDom).
//
// databaseControls.ts 신규 프리미티브의 불변식:
//   1. sliderStepperField — range/number 쌍이 클램프·스텝 정규화된 값으로 양방향 동기화.
//   2. segmentedControl — 네이티브 radio 그룹(방향키 내비게이션 = 브라우저 기본 동작,
//      컨트롤은 keydown 리스너를 하나도 달지 않는다). change 는 선택된 옵션 id 로 발화.
//   3. toggleSwitch — checkbox 원형(checked 자체가 상태).
//   4. avatarChipRow — faceset 칩 버튼(aria-pressed/dimmed), 클릭 토글.
//   5. 모든 컨트롤은 Escape 를 삼키지 않는다 — 모달 최상층 dirty-close 라우팅은
//      document 레벨 keydown 리스너(버블 도착)로 동작하므로, 컨트롤이 preventDefault/
//      stopPropagation 하면 닫기 가드가 깨진다. 여기선 버블이 document 까지 도달하는지로 검증한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  avatarChipRow,
  segmentedControl,
  sliderStepperField,
  toggleSwitch,
  type AvatarChipActor,
} from "@/editor/panels/databaseControls";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const ACTORS: AvatarChipActor[] = [
  { id: "actor-1", name: "알렉스", faceResourceId: "easyrpg-faceset-actor1", faceIndex: 0 },
  { id: "actor-2", name: "브라이언", faceResourceId: "easyrpg-faceset-actor1", faceIndex: 1 },
  { id: "actor-3", name: "캐럴", faceResourceId: undefined },
];

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function keydown(key: string): Event {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  return event;
}

type DocumentTarget = {
  readonly addEventListener: (type: string, listener: EventListener) => void;
  readonly removeEventListener: (type: string, listener: EventListener) => void;
};

/** document 레벨 keydown 리스너(모달 dirty-close 라우팅)가 이벤트를 여전히 받는지. */
function escapeStillReachesDocumentLayer(control: FakeElement): boolean {
  const doc = globalThis.document as unknown as DocumentTarget;
  let reached = false;
  const listener = (): void => {
    reached = true;
  };
  doc.addEventListener("keydown", listener);
  try {
    control.dispatchEvent(keydown("Escape"));
  } finally {
    doc.removeEventListener("keydown", listener);
  }
  return reached;
}

describe("sliderStepperField", () => {
  function render(value = 50, bounds = { min: 0, max: 100, step: 1 }) {
    const committed: number[] = [];
    const node = sliderStepperField("HP 회복", "db-field-item-heal-percent", value, (next) => committed.push(next), bounds);
    const fieldNode = node as unknown as FakeElement;
    const range = findByTestId(fieldNode, "db-field-item-heal-percent-slider");
    const stepper = findByTestId(fieldNode, "db-field-item-heal-percent-stepper");
    if (!range || !stepper) throw new Error("sliderStepperField 가 range/number 쌍을 렌더하지 않음");
    return { fieldNode, range, stepper, committed };
  }

  it("renders a range + number pair under one label with testids", () => {
    const { fieldNode, range, stepper } = render();
    expect(fieldNode.tagName).toBe("LABEL");
    expect(fieldNode.className).toContain("db-field");
    expect(range.attrs.type).toBe("range");
    expect(stepper.attrs.type).toBe("number");
    expect(range.attrs.min).toBe("0");
    expect(range.attrs.max).toBe("100");
    expect(range.attrs.step).toBe("1");
    expect(range.value).toBe("50");
    expect(stepper.value).toBe("50");
  });

  it("moving the slider clamps to max and syncs the stepper (101 → 100)", () => {
    const { range, stepper, committed } = render();
    range.value = "101";
    range.dispatchEvent(new Event("input"));
    expect(committed.at(-1)).toBe(100);
    expect(stepper.value).toBe("100");
    expect(range.value).toBe("100");
  });

  it("typing below min in the stepper clamps and syncs the slider (-1 → 0)", () => {
    const { range, stepper, committed } = render();
    stepper.value = "-1";
    stepper.dispatchEvent(new Event("input"));
    expect(committed.at(-1)).toBe(0);
    expect(range.value).toBe("0");
    expect(stepper.value).toBe("0");
  });

  it("typing above max clamps and rewrites the visible value", () => {
    const { range, stepper, committed } = render();
    stepper.value = "500000";
    stepper.dispatchEvent(new Event("input"));
    expect(committed.at(-1)).toBe(100);
    expect(range.value).toBe("100");
    expect(stepper.value).toBe("100");
  });

  it("normalizes the display on blur(change) — cleared stepper shows the floor", () => {
    const { range, stepper, committed } = render(20, { min: 5, max: 95, step: 1 });
    stepper.value = "";
    stepper.dispatchEvent(new Event("input"));
    stepper.dispatchEvent(new Event("change"));
    expect(stepper.value).toBe("5");
    expect(range.value).toBe("5");
    expect(committed.at(-1)).toBe(5);
  });

  it("quantizes to the step (37 → 35 with step 5)", () => {
    const { range, stepper, committed } = render(30, { min: 0, max: 100, step: 5 });
    stepper.value = "37";
    stepper.dispatchEvent(new Event("input"));
    expect(committed.at(-1)).toBe(35);
    expect(range.value).toBe("35");
    expect(stepper.value).toBe("35");
  });

  it("clamps the initial value to bounds", () => {
    const { range, stepper } = render(140);
    expect(range.value).toBe("100");
    expect(stepper.value).toBe("100");
  });
});

describe("segmentedControl (native radio group)", () => {
  const OPTIONS = [
    { id: "singleTarget", name: "단일 대상" },
    { id: "allTargets", name: "전체 대상" },
  ];

  function render(value = "singleTarget") {
    const committed: string[] = [];
    const node = segmentedControl("대상", "db-field-item-scope", value, OPTIONS, (next) => committed.push(next));
    const fieldNode = node as unknown as FakeElement;
    const radios = fieldNode.querySelectorAll("input").filter((input) => input.attrs.type === "radio");
    if (radios.length !== 2) throw new Error("segmentedControl 이 radio 그룹을 렌더하지 않음");
    return { fieldNode, radios, committed };
  }

  it("renders one native radio group with a shared name and pill labels", () => {
    const { fieldNode, radios } = render();
    expect(fieldNode.className).toContain("db-field");
    expect(findByTestId(fieldNode, "db-field-item-scope")).toBeTruthy();
    expect(radios[0].attrs.name).toBe(radios[1].attrs.name);
    const pills = fieldNode.querySelectorAll(".db-segmented-pill");
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toContain("단일 대상");
    expect(pills[1].textContent).toContain("전체 대상");
  });

  it("checks the option matching the value", () => {
    const { radios } = render("allTargets");
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
  });

  it("arrow-key navigation changes selection and fires onInput with the option id", () => {
    const { radios, committed } = render();
    // 브라우저 기본 동작 흉내: 방향키는 다음 radio 를 체크하고 change 를 발화한다.
    // 컨트롤 자체는 keydown 리스너가 없다(포커스 트랩 금지) — 네이티브 그룹 동작에 의존.
    radios[0].focus();
    radios[1].dispatchEvent(keydown("ArrowDown"));
    radios[1].checked = true;
    radios[1].dispatchEvent(new Event("change", { bubbles: true }));
    expect(committed).toEqual(["allTargets"]);
  });

  it("Escape keydown on a radio bubbles to the document layer unswallowed", () => {
    const { radios } = render();
    expect(escapeStillReachesDocumentLayer(radios[0])).toBe(true);
  });
});

describe("toggleSwitch", () => {
  function render(checked = false) {
    const committed: boolean[] = [];
    const node = toggleSwitch("전투 중 사용", "db-field-item-battle-usable", checked, (next) => committed.push(next));
    const fieldNode = node as unknown as FakeElement;
    const input = findByTestId(fieldNode, "db-field-item-battle-usable");
    if (!input) throw new Error("toggleSwitch 가 checkbox 를 렌더하지 않음");
    return { fieldNode, input, committed };
  }

  it("renders a checkbox styled as a switch under the label", () => {
    const { fieldNode, input } = render();
    expect(fieldNode.className).toContain("db-field");
    expect(input.attrs.type).toBe("checkbox");
    expect(input.attrs.role).toBe("switch");
    expect(input.checked).toBe(false);
    expect(fieldNode.querySelectorAll(".db-toggle-switch")).toHaveLength(1);
  });

  it("reflects the initial checked state", () => {
    const { input } = render(true);
    expect(input.checked).toBe(true);
  });

  it("Space toggles the checked boolean (native activation → change)", () => {
    const { input, committed } = render();
    input.focus();
    input.dispatchEvent(keydown(" "));
    // 합성 keydown 은 네이티브 체크박스 활성화를 일으키지 않는다(브라우저가 쏠 클릭 모사).
    input.checked = !input.checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(committed.at(-1)).toBe(true);
  });

  it("Escape keydown on the switch bubbles to the document layer unswallowed", () => {
    const { input } = render();
    expect(escapeStillReachesDocumentLayer(input)).toBe(true);
  });
});

describe("avatarChipRow", () => {
  function render(selectedIds: string[] = ["actor-1"]) {
    const toggles: Array<[string, boolean]> = [];
    const node = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", ACTORS, selectedIds, (actorId, nextSelected) => {
      toggles.push([actorId, nextSelected]);
    });
    const fieldNode = node as unknown as FakeElement;
    const chips = fieldNode.querySelectorAll(".db-avatar-chip");
    if (chips.length !== ACTORS.length) throw new Error("avatarChipRow 가 칩 버튼을 렌더하지 않음");
    return { fieldNode, chips, toggles };
  }

  it("renders one button chip per actor with faceset crops and names", () => {
    const { fieldNode, chips } = render();
    expect(findByTestId(fieldNode, "db-field-item-usable-actors")).toBeTruthy();
    for (const [index, chip] of chips.entries()) {
      expect(chip.tagName).toBe("BUTTON");
      expect(chip.attrs.type).toBe("button");
      expect(chip.dataset.actorId).toBe(ACTORS[index].id);
      expect(chip.textContent).toContain(ACTORS[index].name);
      expect(chip.querySelectorAll(".db-avatar-chip-face")).toHaveLength(1);
    }
  });

  it("selected chip has aria-pressed=true and no dimmed class; unselected are dimmed", () => {
    const { chips } = render(["actor-1"]);
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");
    expect(chips[0].classList.contains("dimmed")).toBe(false);
    expect(chips[1].getAttribute("aria-pressed")).toBe("false");
    expect(chips[1].classList.contains("dimmed")).toBe(true);
    expect(chips[2].classList.contains("dimmed")).toBe(true);
  });

  it("click toggles the actor id in/out of selectedIds and mirrors state on the chip", () => {
    const { chips, toggles } = render(["actor-1"]);
    chips[1].click();
    expect(toggles.at(-1)).toEqual(["actor-2", true]);
    expect(chips[1].getAttribute("aria-pressed")).toBe("true");
    expect(chips[1].classList.contains("dimmed")).toBe(false);
    chips[0].click();
    expect(toggles.at(-1)).toEqual(["actor-1", false]);
    expect(chips[0].getAttribute("aria-pressed")).toBe("false");
    expect(chips[0].classList.contains("dimmed")).toBe(true);
  });

  it("actor without a faceset resource renders a faceless chip without crashing", () => {
    const { chips } = render(["actor-3"]);
    const face = chips[2].querySelector(".db-avatar-chip-face");
    expect(face).toBeTruthy();
    expect(face.style.backgroundImage ?? "").toBe("");
    expect(chips[2].getAttribute("aria-pressed")).toBe("true");
  });

  it("empty actors array renders an empty row without crashing", () => {
    const node = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", [], [], () => {});
    const fieldNode = node as unknown as FakeElement;
    const row = findByTestId(fieldNode, "db-field-item-usable-actors");
    expect(row).toBeTruthy();
    expect(row.querySelectorAll(".db-avatar-chip")).toHaveLength(0);
  });

  it("Escape keydown on a chip bubbles to the document layer unswallowed", () => {
    const { chips } = render();
    expect(escapeStillReachesDocumentLayer(chips[0])).toBe(true);
  });
});

describe("Escape passthrough inside the modal surface", () => {
  it("Escape on every control inside .database-modal-backdrop reaches the document layer", () => {
    const slider = sliderStepperField("HP 회복", "db-field-item-heal-percent", 50, () => {}, { min: 0, max: 100, step: 1 });
    const segmented = segmentedControl("대상", "db-field-item-scope", "singleTarget", OPTIONS_FOR_ESCAPE, () => {});
    const toggle = toggleSwitch("전투 중 사용", "db-field-item-battle-usable", false, () => {});
    const chips = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", ACTORS_FOR_ESCAPE, [], () => {});
    const body = document.body as unknown as FakeElement;
    const backdrop = document.createElement("div") as FakeElement;
    backdrop.className = "database-modal-backdrop";
    const windowLayer = document.createElement("div") as FakeElement;
    windowLayer.className = "database-modal-window";
    windowLayer.append(slider, segmented, toggle, chips);
    backdrop.append(windowLayer);
    body.append(backdrop);

    const doc = globalThis.document as unknown as DocumentTarget;
    let reached = 0;
    const listener = (): void => {
      reached += 1;
    };
    doc.addEventListener("keydown", listener);
    try {
      const controls = [...windowLayer.querySelectorAll("input"), ...windowLayer.querySelectorAll("button")];
      expect(controls).toHaveLength(6); // range + stepper + radio×2 + checkbox + chip button
      for (const control of controls) control.dispatchEvent(keydown("Escape"));
    } finally {
      doc.removeEventListener("keydown", listener);
    }
    // 모든 컨트롤에서 Escape 가 document 레벨(모달 dirty-close 라우팅)까지 도달한다.
    expect(reached).toBe(6);
  });
});

const OPTIONS_FOR_ESCAPE = [
  { id: "singleTarget", name: "단일" },
  { id: "allTargets", name: "전체" },
];
const ACTORS_FOR_ESCAPE: AvatarChipActor[] = [{ id: "actor-1", name: "알렉스" }];
