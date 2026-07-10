import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildInlineApprovalToolbar,
  getInlineProposalActions,
  setInlineProposalActions,
  subscribeInlineProposalActions,
} from "@/editor/proposalInlineApproval";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

describe("inline proposal actions registry", () => {
  afterEach(() => setInlineProposalActions(null));

  it("set/get/subscribe가 동작한다", () => {
    let notified = 0;
    const unsub = subscribeInlineProposalActions(() => { notified += 1; });
    const actions = { accept: () => {}, reject: () => {}, focusCard: () => {} };
    setInlineProposalActions(actions);
    expect(getInlineProposalActions()).toBe(actions);
    setInlineProposalActions(null);
    expect(getInlineProposalActions()).toBeNull();
    expect(notified).toBe(2);
    unsub();
  });

  it("CAS 해제 — A 등록 후 B가 덮어쓰면 A의 해제 시도는 무시된다(경합 방지)", () => {
    const actionsA = { accept: () => {}, reject: () => {} };
    const actionsB = { accept: () => {}, reject: () => {} };
    setInlineProposalActions(actionsA);
    // B가 A 모르게 슬롯을 덮어씀(last-writer-wins) — 예: 영역 pending이 채팅 제안 위에 등록.
    setInlineProposalActions(actionsB);
    // A가 자기 등록만 확인하고 해제(CAS): 현재 슬롯이 자신(actionsA)일 때만 지운다.
    if (getInlineProposalActions() === actionsA) setInlineProposalActions(null);
    // B의 등록은 A의 뒤늦은 해제에 영향받지 않고 그대로 남아야 한다.
    expect(getInlineProposalActions()).toBe(actionsB);
  });
});

describe("buildInlineApprovalToolbar", () => {
  let restore: () => void;
  let windowListeners: Map<string, EventListener[]>;
  // CameraPanController와 동일한 window 레벨 폴백 패턴을 검증하기 위한 최소 window mock
  // (test/mapHistoryPanel.test.ts의 기존 관례를 따름 — fakeDom.ts는 document/Node만 다룬다).
  const dispatchOnWindow = (event: Event): void => {
    for (const listener of [...(windowListeners.get(event.type) ?? [])]) listener(event);
  };
  beforeEach(() => {
    restore = installFakeDom();
    windowListeners = new Map();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        addEventListener: (type: string, listener: EventListener) => {
          windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]);
        },
        removeEventListener: (type: string, listener: EventListener) => {
          windowListeners.set(type, (windowListeners.get(type) ?? []).filter((item) => item !== listener));
        },
      },
    });
  });
  afterEach(() => {
    restore();
    setInlineProposalActions(null);
    Reflect.deleteProperty(globalThis, "window");
  });

  it("적용/거부/상세 버튼이 핸들러를 호출한다", () => {
    const hits: string[] = [];
    const bar = buildInlineApprovalToolbar({
      accept: () => hits.push("accept"),
      reject: () => hits.push("reject"),
      focusCard: () => hits.push("focus"),
    });
    document.body.append(bar);
    for (const id of ["ghost-inline-accept", "ghost-inline-reject", "ghost-inline-detail"]) {
      (findByTestId(document.body as unknown as FakeElement, id) as unknown as HTMLElement).click();
    }
    expect(hits).toEqual(["accept", "reject", "focus"]);
  });

  it("holdOrigin이 있으면 원본 보기 버튼을 렌더하고 pointerdown/up으로 start/end를 부른다", () => {
    const calls: string[] = [];
    const toolbar = renderWithFakeDom(() =>
      buildInlineApprovalToolbar({
        accept: () => calls.push("accept"),
        reject: () => calls.push("reject"),
        holdOrigin: {
          label: "원본 보기",
          start: () => calls.push("start"),
          end: () => calls.push("end"),
        },
      }),
    );
    const hold = findByTestId(toolbar, "ghost-inline-hold-origin");
    expect(hold).not.toBeNull();
    hold!.dispatchEvent(new Event("pointerdown"));
    hold!.dispatchEvent(new Event("pointerup"));
    expect(calls).toEqual(["start", "end"]);
  });

  it("리렌더로 버튼 DOM이 파괴돼도 window 폴백 pointerup으로 end가 정확히 1회 불린다", () => {
    const calls: string[] = [];
    const toolbar = renderWithFakeDom(() =>
      buildInlineApprovalToolbar({
        accept: () => {},
        reject: () => {},
        holdOrigin: {
          label: "원본 보기",
          start: () => calls.push("start"),
          end: () => calls.push("end"),
        },
      }),
    );
    const hold = findByTestId(toolbar, "ghost-inline-hold-origin")!;
    hold.dispatchEvent(new Event("pointerdown"));
    expect(calls).toEqual(["start"]);
    // 리렌더 시뮬레이션: 고스트 숨김 emit → 마커/툴바 재생성으로 버튼 노드가 파괴됨.
    // 로컬 pointerup 핸들러는 더 이상 도달 불가 — window 폴백만이 end를 보장한다.
    hold.remove();
    dispatchOnWindow(new Event("pointerup"));
    expect(calls).toEqual(["start", "end"]);
    // 리스너가 해제됐으므로 재차 dispatch해도 중복 호출 없음.
    dispatchOnWindow(new Event("pointerup"));
    expect(calls).toEqual(["start", "end"]);
  });

  it("pointerdown을 두 번 눌러도 start는 한 번만 불리고 window 리스너도 중복 등록되지 않는다", () => {
    const calls: string[] = [];
    const toolbar = renderWithFakeDom(() =>
      buildInlineApprovalToolbar({
        accept: () => {},
        reject: () => {},
        holdOrigin: {
          label: "원본 보기",
          start: () => calls.push("start"),
          end: () => calls.push("end"),
        },
      }),
    );
    const hold = findByTestId(toolbar, "ghost-inline-hold-origin")!;
    hold.dispatchEvent(new Event("pointerdown"));
    hold.dispatchEvent(new Event("pointerdown"));
    expect(calls).toEqual(["start"]);
    hold.remove();
    // 리스너가 중복 등록됐다면 단일 pointerup에도 end가 2회 이상 불렸을 것.
    dispatchOnWindow(new Event("pointerup"));
    expect(calls).toEqual(["start", "end"]);
  });

  it("Space 키다운 후 버튼이 파괴돼도 window 폴백 keyup으로 end가 호출된다", () => {
    const calls: string[] = [];
    const toolbar = renderWithFakeDom(() =>
      buildInlineApprovalToolbar({
        accept: () => {},
        reject: () => {},
        holdOrigin: {
          label: "원본 보기",
          start: () => calls.push("start"),
          end: () => calls.push("end"),
        },
      }),
    );
    const hold = findByTestId(toolbar, "ghost-inline-hold-origin")!;
    const keydown = new Event("keydown", { cancelable: true });
    Object.defineProperty(keydown, "key", { configurable: true, value: " " });
    hold.dispatchEvent(keydown);
    expect(calls).toEqual(["start"]);
    hold.remove();
    const keyup = new Event("keyup");
    Object.defineProperty(keyup, "key", { configurable: true, value: " " });
    dispatchOnWindow(keyup);
    expect(calls).toEqual(["start", "end"]);
  });

  it("focusCard가 없으면 상세 버튼을 렌더하지 않는다", () => {
    const toolbar = renderWithFakeDom(() => buildInlineApprovalToolbar({ accept: () => {}, reject: () => {} }));
    expect(findByTestId(toolbar, "ghost-inline-detail")).toBeNull();
  });
});
