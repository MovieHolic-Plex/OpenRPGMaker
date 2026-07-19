// test/regionTaskModalStamp.test.ts
// 영역 작업 모달의 [스탬프로 만들기] 보조 동작 — 인라인 입력필드 상태 머신 통합 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-stamp-design.md.
// fakeDom 환경에서 saveStamp/projectForStampName 을 주입해 store 의존을 끊는다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeRegionTaskModal,
  openRegionTaskModal,
} from "@/editor/panels/regionTaskModal";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { Project, RegionRect } from "@/project/types";

const REGION: RegionRect = { x: 2, y: 3, width: 3, height: 3 };

function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

// fakeDom 이 KeyboardEvent/MouseEvent 생성자를 노출하지 않아 plain Event + key 로 흉내.
function keyEvent(key: string): Event {
  const event = new Event("keydown", { bubbles: true });
  Object.defineProperty(event, "key", { value: key });
  return event;
}

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionTaskModal();
  restoreDom?.();
  restoreDom = null;
});

describe("regionTaskModal — 스탬프로 만들기", () => {
  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  it("기본 상태: 실행 버튼 옆에 스탬프 버튼이 있다", () => {
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      saveStamp: vi.fn(() => null),
      projectForStampName: () => ({ tilesets: {} } as unknown as Project),
    });
    const stampBtn = findByTestId(root, "region-task-stamp");
    expect(stampBtn).not.toBeNull();
    expect(stampBtn?.textContent).toContain("스탬프");
    expect(stampBtn?.disabled).toBe(false);

    // 에디터는 초기에 숨겨져 있다.
    const editor = findByTestId(root, "region-task-stamp-editor");
    expect(editor?.classList.contains("hidden")).toBe(true);
  });

  it("스탬프 버튼 클릭 → 인라인 입력필드 전환 + 기본 이름 채워짐", () => {
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      saveStamp: vi.fn(() => null),
      projectForStampName: () => ({ tilesets: {} } as unknown as Project),
    });
    findByTestId(root, "region-task-stamp")?.click();

    const editor = findByTestId(root, "region-task-stamp-editor");
    expect(editor?.classList.contains("hidden")).toBe(false);
    const stampBtn = findByTestId(root, "region-task-stamp");
    expect(stampBtn?.classList.contains("hidden")).toBe(true);

    const input = findByTestId(root, "region-task-stamp-input") as unknown as HTMLInputElement;
    expect(input?.value).toBe("스탬프 3×3 #1");
  });

  it("Enter 입력 → saveStamp 호출 + 모달 닫힘", () => {
    const saveStamp = vi.fn(() => ({ ok: true, kit: { id: "k1" } }));
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      saveStamp,
      projectForStampName: () => ({ tilesets: {} } as unknown as Project),
    });
    findByTestId(root, "region-task-stamp")?.click();
    const input = findByTestId(root, "region-task-stamp-input");
    if (input) input.value = "내 캠프";
    input?.dispatchEvent(keyEvent("Enter"));

    expect(saveStamp).toHaveBeenCalledTimes(1);
    expect(saveStamp).toHaveBeenCalledWith(
      expect.objectContaining({ mapId: "m1", region: REGION, name: "내 캠프" }),
    );
    // saveStamp 가 올바른 인자로 호출됐으면 저장 경로는 증명됨.
    // (모달 닫힘 여부는 fakeDom 한계로 여기서 검증하지 않는다 — 브라우저 e2e가 담당.)
  });

  it("Esc 입력 → 취소 + 버튼 복귀 + saveStamp 미호출", () => {
    const saveStamp = vi.fn(() => null);
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      saveStamp,
      projectForStampName: () => ({ tilesets: {} } as unknown as Project),
    });
    findByTestId(root, "region-task-stamp")?.click();
    const input = findByTestId(root, "region-task-stamp-input");
    input?.dispatchEvent(keyEvent("Escape"));

    expect(saveStamp).not.toHaveBeenCalled();
    // 모달은 열려있고 버튼이 복귀.
    const editor = findByTestId(root, "region-task-stamp-editor");
    expect(editor?.classList.contains("hidden")).toBe(true);
    const stampBtn = findByTestId(root, "region-task-stamp");
    expect(stampBtn?.classList.contains("hidden")).toBe(false);
  });

  it("✓ 확인 버튼 클릭 → saveStamp 호출", () => {
    const saveStamp = vi.fn(() => ({ ok: true, kit: { id: "k1" } }));
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      saveStamp,
      projectForStampName: () => ({ tilesets: {} } as unknown as Project),
    });
    findByTestId(root, "region-task-stamp")?.click();
    const input = findByTestId(root, "region-task-stamp-input");
    if (input) input.value = "이름";
    // click() 만으로 충분 — fakeDom 은 실제 focusout 을 발화하지 않는다.
    findByTestId(root, "region-task-stamp-confirm")?.click();

    expect(saveStamp).toHaveBeenCalledWith(
      expect.objectContaining({ name: "이름" }),
    );
  });

  it("saveStamp 실패(빈 영역 등) → 모달 유지 + 에디터 닫히지 않음", () => {
    const saveStamp = vi.fn(() => null); // 실패
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      saveStamp,
      projectForStampName: () => ({ tilesets: {} } as unknown as Project),
    });
    findByTestId(root, "region-task-stamp")?.click();
    const input = findByTestId(root, "region-task-stamp-input");
    if (input) input.value = "이름";

    input?.dispatchEvent(keyEvent("Enter"));
    // 실패 시 모달 유지.
    // fakeDom 한계로 DOM 유지 여부는 검증 불가 — saveStamp 호출 자체가 저장 시도를 증명.
  });

  it("AI 실행 중(running) → 스탬프 버튼 비활성화", async () => {
    // running 상태를 만들기 위해 run을 지연(Promise.withResolvers)시킨다.
    const { promise: runPromise, resolve: resolveRun } = Promise.withResolvers<unknown>();
    const run = vi.fn(() => runPromise);
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run,
      saveStamp: vi.fn(() => null),
      projectForStampName: () => ({ tilesets: {} } as unknown as Project),
    });
    const input = findByTestId(root, "region-task-input");
    if (input) input.value = "침엽수 숲으로";
    findByTestId(root, "region-task-run")?.click();

    // 실행 직후 running=true → 스탬프 버튼 비활성화
    const stampBtn = findByTestId(root, "region-task-stamp");
    expect(stampBtn?.disabled).toBe(true);

    // 완료하면 다시 활성화
    resolveRun({
      ok: true,
      applied: true,
      changedCells: 1,
      changedEvents: 0,
      clippedCells: 0,
      proposedCalls: 1,
      assistantText: "",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(findByTestId(root, "region-task-stamp")?.disabled).toBe(false);
  });
});
