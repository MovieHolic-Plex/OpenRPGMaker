// 스코프 턴(선택 영역이 걸린 조수 턴)이 모델에 보내는 메시지와 의도 라우팅.
//
// 예전에는 `runRegionTask` 라는 **두 번째 실행체**가 이 메시지를 만들고 자기 세션을 돌렸다.
// 실행체는 이제 조수 세션 하나뿐이고(`aiChatPanel.sendText` + `ai/turnGuide`), 이 파일은
// 그 조립 결과(지시 + 가이드 + 컨텍스트 꼬리표)와 라우터의 순수 판정만 고정한다.
// 턴을 실제로 돌리는 검증은 test/scopedAssistantTurn.test.ts 가 맡는다.
import { describe, expect, it } from "vitest";
import { buildScopedTurnMessage as buildRegionTaskMessage } from "./helpers/scopedTurnMessage";
import { isRegionEscapingIntent, routeRegionIntent } from "@/editor/regionTask/regionIntentRouter";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { implicitSpecFromContext } from "@/ai/buildSpec";

const MAP_ID = "map_region";
const REGION: RegionRect = { x: 1, y: 1, width: 3, height: 3 };

describe("buildRegionTaskMessage", () => {
  it("[컨텍스트] 라인이 implicitSpecFromContext에 선택 영역으로 파싱된다", () => {
    const message = buildRegionTaskMessage("여기 채워", "마을 맵", MAP_ID, REGION);
    const spec = implicitSpecFromContext(message);
    expect(spec).not.toBeNull();
    const asset = spec?.assets[0];
    expect(asset).toMatchObject({ x: 1, y: 1, w: 3, h: 3 });
  });

  it("실내 요청은 독립 실내 세션만 안내하고 야외 facade를 배제한다", () => {
    const message = buildRegionTaskMessage("연금술사의 집 이라는 실내 를 하나 만드렁줘", "외곽", MAP_ID, REGION);
    expect(message).toContain("start_interior_room_session");
    expect(message).not.toContain("run_interior_room_pipeline");
    expect(message).not.toContain("author_house");
    expect(message).not.toContain("author_village");
    expect(message).not.toContain("이 작업은 아래 선택 영역 안에서만 수행하라");
    expect(message).toContain("새 맵 전체를 시공하라");
  });

  it("영역 작업의 bare 집 요청은 야외 집으로 바로 시공한다 (되묻지 않음)", () => {
    const message = buildRegionTaskMessage("이 영역에 집 만들어줘", "외곽", MAP_ID, REGION);
    // 영역 선택이 현재 맵 위이므로 야외 집 의도 — 되묻지 않고 author_house 시공.
    expect(message).not.toContain("야외 집(외장) / 실내 맵 / 둘 다");
    expect(message).toContain("author_house");
    expect(message).toContain("되묻지 말고");
  });

  it("'건물' 단어는 author_house facade 시그니처를 강제하지 않는다 (탑/성벽 오경로 방지)", () => {
    // 탑/성벽 등은 structure 가이드가 build_wall/create_farm_plot 로 안내한다.
    // bare fallback 이 /건물/ 을 잡아 author_house 시그니처를 내면 가이드와 충돌한다.
    const tower = buildRegionTaskMessage("탑 건물 지어줘", "외곽", MAP_ID, REGION);
    expect(tower).not.toContain("야외 집 시공: author_house");
    const wall = buildRegionTaskMessage("성벽 건물 지어", "외곽", MAP_ID, REGION);
    expect(wall).not.toContain("야외 집 시공: author_house");
    // bare '건물' 단독도 facade 시그니처 강제 없음 — 가이드가 LLM 에게 맨긴다.
    const bare = buildRegionTaskMessage("건물 지어", "외곽", MAP_ID, REGION);
    expect(bare).not.toContain("야외 집 시공: author_house");
    expect(bare).not.toContain("되묻지 말고");
  });
});

describe("isRegionEscapingIntent / routeRegionIntent — 실내·새 맵", () => {
  it("실내·새 맵 요청은 영역 우회 대상이다", () => {
    expect(isRegionEscapingIntent("연금술사의 집 이라는 실내 를 하나 만드렁줘")).toBe(true);
    expect(isRegionEscapingIntent("아니 새로운 맵을 만들어서 진행해달라니까")).toBe(true);
    expect(isRegionEscapingIntent("여기 나무 3그루 심어줘")).toBe(false);
  });

  it("실내+집 문구는 interior만 잡고 structure(야외 집)는 뺀다", () => {
    const routed = routeRegionIntent("연금술사의 집 이라는 실내 를 하나 만드렁줘");
    expect(routed).toContain("interior");
    expect(routed).not.toContain("structure");
  });

  // 실내 명사 부분일치만으로 우회시키면 선택 영역과 하드클립이 함께 버려진다 —
  // "실내 시공은 영역 밖 작업"이라는 전제는 새로 만들 때만 맞다.
  it("실내 수정 요청은 영역 경로에 남는다", () => {
    for (const text of ["이 침실 좀 수정해줘", "침실 가구 배치를 개선해줘", "실내 조명 좀 어둡게 바꿔줘"]) {
      expect(isRegionEscapingIntent(text), text).toBe(false);
    }
  });
});
