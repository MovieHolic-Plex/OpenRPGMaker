// 맵 인터뷰 UX 계약(2026-07-04): 킥오프 프롬프트 / 원탭 답변 칩 파싱 /
// 메타데이터 전용 제안의 즉시 저장 판정 / 패널에 🎓 버튼·칩 호스트 존재.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildInterviewKickoff, buildStructureLearnKickoff, parseQuickReplies, QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import type { ProposedCall } from "@/ai/assistantSession";
import { isMetadataOnlyProposal, renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function installFakeLocalStorage(): void {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("buildInterviewKickoff", () => {
  it("맵 id와 핵심 프로토콜(분석→강조→선택지→확정 기록)을 담는다", () => {
    const kickoff = buildInterviewKickoff("map_village");
    expect(kickoff).toContain('analyze_map_tile_usage(mapId="map_village")');
    expect(kickoff).toContain("highlight_map_region");
    expect(kickoff).toContain("show_tiles"); // 타일 이미지 없이 번호로만 묻던 문제 방지.
    expect(kickoff).toContain(QUICK_REPLY_MARKER);
    expect(kickoff).toContain("confirmedByUser=true");
    expect(kickoff).toContain("upsert_tile_group");
  });

  it("맵 id가 없으면 시작 맵을 확인하도록 안내한다", () => {
    expect(buildInterviewKickoff(null)).toContain("시작 맵");
  });

  it("구조물 발견 시 집 외장/메타데이터 학습 프로토콜(그리드→집 판단→템플릿 저장 금지)을 담는다", () => {
    const kickoff = buildInterviewKickoff("map_v");
    expect(kickoff).toContain("show_tile_grid");
    expect(kickoff).toContain("author_house");
    expect(kickoff).toContain("별도 템플릿을 저장하지 않습니다");
  });
});

describe("buildStructureLearnKickoff (📐 선택 영역 학습)", () => {
  it("그림 먼저 + 집 외장 판단 + 타일/그룹만 저장한다(순서 강제)", () => {
    const kickoff = buildStructureLearnKickoff("map_v", { x: 3, y: 4, width: 10, height: 8 });
    const gridAt = kickoff.indexOf("show_tile_grid");
    const highlightAt = kickoff.indexOf("highlight_map_region");
    const kitAt = kickoff.indexOf("author_house");
    const noDumpAt = kickoff.indexOf("나열하지 말고");
    expect(gridAt).toBeGreaterThan(-1);
    expect(highlightAt).toBeGreaterThan(gridAt);
    expect(kitAt).toBeGreaterThan(highlightAt);
    expect(noDumpAt).toBeGreaterThan(kitAt); // 좌표·번호 목록을 채팅에 쏟지 않는다.
    expect(kickoff).toContain("x=3, y=4, w=10, h=8");
    expect(kickoff).toContain("set_tile_metadata");
    expect(kickoff).toContain("upsert_tile_group");
    expect(kickoff).toContain("지형 템플릿은 만들지 마세요");
  });
});

describe("parseQuickReplies", () => {
  it("마지막 줄의 [선택지] 마커를 칩 목록으로 파싱한다", () => {
    const text = "이 타일(12칸)은 무엇인가요? (설명됨 3/9)\n[선택지] 지붕 | 돌담 | 화단 | 모름/건너뛰기";
    expect(parseQuickReplies(text)).toEqual(["지붕", "돌담", "화단", "모름/건너뛰기"]);
  });

  it("마커가 마지막 줄이 아니거나 없으면 칩을 만들지 않는다", () => {
    expect(parseQuickReplies("일반 응답입니다.")).toEqual([]);
    expect(parseQuickReplies("[선택지] a | b\n마커 뒤에 다른 말")).toEqual([]);
  });

  it("빈 항목은 버리고 최대 6개까지만 취한다", () => {
    expect(parseQuickReplies("[선택지] a || b | c | d | e | f | g")).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("isMetadataOnlyProposal", () => {
  const call = (name: string): ProposedCall => ({
    name,
    args: {},
    summary: "",
    result: { ok: true, summary: "" },
    destructive: false,
  });

  it("타일 지식 툴만 있으면 true — 제안 카드 없이 즉시 저장 대상", () => {
    expect(isMetadataOnlyProposal([call("set_tile_metadata"), call("upsert_tile_group"), call("set_tile_passability")])).toBe(true);
  });

  it("맵/이벤트 변경이 섞이면 false — 기존 검토 절차 유지", () => {
    expect(isMetadataOnlyProposal([call("set_tile_metadata"), call("paint_tiles")])).toBe(false);
    expect(isMetadataOnlyProposal([])).toBe(false);
  });
});

describe("패널 인터뷰 UI", () => {
  it("원탭 칩 호스트는 남고, 스킬 서러 가르치기 3종은 ☰ 에 두지 않는다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(panel, "ai-quick-replies")).toBeTruthy();
    expect(findByTestId(panel, "ai-interview")).toBeNull();
    expect(findByTestId(panel, "ai-learn-structure")).toBeNull();
    expect(findByTestId(panel, "ai-demo-teach")).toBeNull();
  });
});
