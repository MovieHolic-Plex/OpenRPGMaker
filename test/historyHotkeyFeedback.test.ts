/**
 * Ctrl+Z / Ctrl+Y 는 **반드시 눈에 보이는 응답**을 남겨야 한다.
 *
 * 회귀 배경: 되돌림이 조용히 성공하던 시절, 되돌려진 칸이 화면 밖이거나 변화가 미세하면
 * 감독은 눌렸는지 알 수 없었다. 확인하려고 한 번 더 누르면 두 단계가 되돌아갔다.
 * 스택이 비었을 때도 침묵해서 "고장인가" 로 읽혔다. 성공·실패 양쪽 모두 알린다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastSpy = vi.fn();
vi.mock("@/util/toast", () => ({ toast: (...args: unknown[]) => toastSpy(...args) }));

import { addDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import { pendingHistoryLabels, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

beforeEach(() => {
  vi.unstubAllGlobals();
  toastSpy.mockClear();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

function ctrl(key: string, shift = false): KeyboardEvent {
  return {
    key,
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: shift,
    target: undefined,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

/** 마지막 토스트의 [메시지, 종류]. 호출이 없으면 null. */
function lastToast(): readonly [string, unknown] | null {
  const call = toastSpy.mock.calls.at(-1);
  return call ? ([String(call[0]), call[1]] as const) : null;
}

describe("되돌림 피드백", () => {
  it("Ctrl+Z 성공 시 되돌린 작업 라벨을 알린다", () => {
    const id = addDatabaseRecord("items");
    recordProjectSnapshot("아이템 이름 변경");
    updateDatabaseRecord("items", id, { name: "검" });

    expect(handleHistoryHotkey(ctrl("z"))).toBe(true);

    const [message, kind] = lastToast()!;
    expect(kind).toBe("ok");
    expect(message).toContain("되돌렸습니다");
    expect(message).toContain("아이템 이름 변경");
  });

  it("Ctrl+Y 성공 시 다시 실행을 알린다", () => {
    const id = addDatabaseRecord("items");
    updateDatabaseRecord("items", id, { name: "검" });
    handleHistoryHotkey(ctrl("z"));
    toastSpy.mockClear();

    expect(handleHistoryHotkey(ctrl("y"))).toBe(true);

    const [message, kind] = lastToast()!;
    expect(kind).toBe("ok");
    expect(message).toContain("다시 실행했습니다");
  });

  it("되돌릴 것이 없으면 침묵하지 않고 그렇다고 알린다", () => {
    expect(handleHistoryHotkey(ctrl("z"))).toBe(false);

    const [message, kind] = lastToast()!;
    expect(kind).toBe("info");
    expect(message).toBe("되돌릴 작업이 없습니다");
  });

  it("다시 실행할 것이 없으면 그렇다고 알린다", () => {
    expect(handleHistoryHotkey(ctrl("y"))).toBe(false);

    const [message, kind] = lastToast()!;
    expect(kind).toBe("info");
    expect(message).toBe("다시 실행할 작업이 없습니다");
  });

  it("단축키가 무시되는 경로에서는 토스트도 뜨지 않는다", () => {
    // 수식키 없는 z 는 히스토리 단축키가 아니다 — 잡음 토스트가 뜨면 안 된다.
    const plain = { ...ctrl("z"), ctrlKey: false } as unknown as KeyboardEvent;
    expect(handleHistoryHotkey(plain)).toBe(false);
    expect(toastSpy).not.toHaveBeenCalled();
  });
});

describe("pendingHistoryLabels", () => {
  it("실행 전에 다음 undo 대상의 라벨을 알려준다", () => {
    expect(pendingHistoryLabels().undo).toBeNull();

    recordProjectSnapshot("타일 칠하기");
    expect(pendingHistoryLabels().undo).toBe("타일 칠하기");
  });

  it("undo 후에는 같은 라벨이 redo 쪽으로 넘어간다", () => {
    const id = addDatabaseRecord("items");
    recordProjectSnapshot("아이템 이름 변경");
    updateDatabaseRecord("items", id, { name: "검" });

    handleHistoryHotkey(ctrl("z"));
    expect(pendingHistoryLabels().redo).toBe("아이템 이름 변경");
  });
});
