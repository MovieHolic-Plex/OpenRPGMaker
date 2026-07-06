// 시연으로 가르치기 계약(2026-07-05): 붓질 기록 → 메시지 조립 → AI 해석 지침 내장.
// AI 추측이 틀렸을 때 말 대신 직접 깔아서 보여주는 교정 채널.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemonstrationMessage, type DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal } from "@/editor/panels/demoTeachCanvas";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("buildDemonstrationMessage", () => {
  const payload: DemonstrationPayload = {
    w: 3,
    h: 2,
    seed: { mapId: "map_v", x: 5, y: 7 },
    lower: [
      [240, 290, 290],
      [240, 290, 290],
    ],
    upper: [
      [-1, -1, -1],
      [-1, 87, -1],
    ],
    strokes: [
      { layer: "lower", x: 1, y: 0, tile: 290 },
      { layer: "lower", x: 2, y: 0, tile: 290 },
      { layer: "upper", x: 1, y: 1, tile: 87 },
    ],
    explanation: "나무는 2×2 이상 뭉쳐야 숲으로 보임",
  };

  it("최종 그리드·붓질 순서·설명·해석 지침(교정 툴 안내)을 담는다", () => {
    const message = buildDemonstrationMessage(payload);
    expect(message).toContain("[시연]");
    expect(message).toContain("나무는 2×2 이상 뭉쳐야");
    expect(message).toContain("240 290 290"); // 하위 그리드 행.
    expect(message).toContain(". 87 ."); // 상위 그리드(빈 칸은 .).
    expect(message).toContain("1) lower (1,0) ← 타일 290"); // 붓질 순서 보존.
    expect(message).toContain("set_tile_metadata");
    expect(message).toContain("upsert_tile_group");
    expect(message).toContain("upsert_terrain_template");
    expect(message).toContain("map_v"); // 시드 출처 + 실제 맵 불변 안내.
    expect(message).toContain("실제 맵은 바뀌지 않았음");
    expect(message).toContain("[선택지]"); // 배운 내용 확인 칩.
  });

  it("붓질이 많으면 60개까지만 나열하고 총횟수를 남긴다", () => {
    const many: DemonstrationPayload = {
      ...payload,
      strokes: Array.from({ length: 75 }, (_, index) => ({ layer: "lower" as const, x: index % 3, y: 0, tile: 240 })),
    };
    const message = buildDemonstrationMessage(many);
    expect(message).toContain("60)");
    expect(message).not.toContain("61)");
    expect(message).toContain("총 75회");
  });
});

describe("demoTeachCanvas 모달", () => {
  it("칠하면 붓질이 기록되고, 보내기 콜백이 최종 상태를 담는다", () => {
    const onSend = vi.fn();
    const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;

    // 기본 붓은 잔디/하위 — (0,0)과 (1,0)을 칠한다.
    (findByTestId(modal, "demo-teach-cell-0-0") as unknown as HTMLElement).click();
    (findByTestId(modal, "demo-teach-cell-1-0") as unknown as HTMLElement).click();
    expect((findByTestId(modal, "demo-teach-count") as unknown as HTMLElement).textContent).toContain("2회");

    // 실행취소 한 번 → 1회.
    (findByTestId(modal, "demo-teach-undo") as unknown as HTMLElement).click();
    expect((findByTestId(modal, "demo-teach-count") as unknown as HTMLElement).textContent).toContain("1회");

    const explanation = findByTestId(modal, "demo-teach-explanation") as unknown as HTMLTextAreaElement;
    explanation.value = "잔디 시연";
    explanation.dispatchEvent(new Event("input"));

    (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
    expect(onSend).toHaveBeenCalledTimes(1);
    const payload = onSend.mock.calls[0][0] as DemonstrationPayload;
    expect(payload.strokes).toHaveLength(1);
    expect(payload.strokes[0]).toEqual({ layer: "lower", x: 0, y: 0, tile: TILE.GRASS });
    expect(payload.explanation).toBe("잔디 시연");
    expect(payload.seed).toBeNull();
    expect(payload.lower[0][0]).toBe(TILE.GRASS);
  });

  it("붓질 없이 보내기는 거부한다(빈 시연 방지)", () => {
    const onSend = vi.fn();
    const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;
    (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("상위 지우개를 고르면 레이어가 상위로 바뀌고 -1 붓질이 기록된다", () => {
    const onSend = vi.fn();
    const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;
    (findByTestId(modal, "demo-teach-eraser") as unknown as HTMLElement).click();
    (findByTestId(modal, "demo-teach-cell-2-1") as unknown as HTMLElement).click();
    (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
    const payload = onSend.mock.calls[0][0] as DemonstrationPayload;
    expect(payload.strokes[0]).toEqual({ layer: "upper", x: 2, y: 1, tile: -1 });
  });
});
